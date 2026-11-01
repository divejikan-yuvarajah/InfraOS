import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { ASSESSMENT, BAND_CODES, CLASS_CODES, rulesSummary } from "./assessment.rules.js";
import { getAssessment, getAssessmentMap, registerAssessmentSubscribers, runForActor, setOverride, whatIf } from "./assessment.service.js";
import { WORKING_HOURS } from "./roadsync.constants.js";
import { assertLive, FlowControl } from "./work-requests.service.js";

registerAssessmentSubscribers();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const csv = <T extends string>(allowed: readonly T[]) =>
  z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10)).refine((arr) => arr.every((v) => (allowed as readonly string[]).includes(v))).transform((arr) => arr as T[]);
const csvIds = z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10)).refine((arr) => arr.every((v) => objectId.safeParse(v).success));

const QUERY_KEYS = ["band", "kind", "class", "agencyId", "sourceType", "onlyConflicts", "sort", "page", "limit"] as const;
const querySchema = z.object({
  band: csv(BAND_CODES).optional(),
  kind: csv(["conflict", "opportunity", "advisory"] as const).optional(),
  class: csv(CLASS_CODES).optional(),
  agencyId: csvIds.optional(),
  sourceType: csv(["work_request", "project", "asset"] as const).optional(),
  onlyConflicts: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  sort: z.enum(["severity", "distance", "overlap", "startDate"]).default("severity"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(ASSESSMENT.PAGE_MAX).default(20),
}).strict();

const whatIfSchema = z.object({
  shiftDays: z.number().int().min(ASSESSMENT.WHATIF_MIN_DAYS).max(ASSESSMENT.WHATIF_MAX_DAYS).optional(),
  bufferMeters: z.number().finite().min(0).max(500).optional(),
  workingHours: z.enum(WORKING_HOURS).optional(),
  sweep: z.boolean().optional(),
}).strict();

const hasControl = (v: string) => [...v].some((c) => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127);
const overrideSchema = z.object({
  band: z.enum(BAND_CODES),
  reason: z.string().trim().min(10).max(500).refine((v) => !hasControl(v) && !v.includes("$"), "unsafe text"),
}).strict();

const limiter = (perMinute: number) =>
  rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === "test" ? 1000 : perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId));
    },
  });
const whatIfLimiter = limiter(30);
const runLimiter = limiter(10);

type Res = { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void };
const noStore = (res: Res) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Pragma", "no-cache"); };
const bad = (res: Res, req: { requestId: string }) => res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const notFound = (res: Res, req: { requestId: string }) => res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));
const unavailable = (res: Res, req: { requestId: string }) => res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export const assessmentRouter = Router();

assessmentRouter.get("/assessment/rules", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    if (!req.actor) return;
    await assertLive(req.actor, ["roadsync.work_request.read"]);
    res.status(200).json(success(rulesSummary(), req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

assessmentRouter.get("/work-requests/:id/assessment", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const unknown = Object.keys(req.query).some((key) => !(QUERY_KEYS as readonly string[]).includes(key));
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = querySchema.safeParse(req.query);
    if (unknown || repeated || !parsed.success) return bad(res, req);
    const id = idOf(req.params.id);
    if (!objectId.safeParse(id).success) return notFound(res, req);
    await assertLive(actor, ["roadsync.work_request.read"]);
    const result = await getAssessment(actor, id, parsed.data);
    if (!result) return notFound(res, req);
    res.status(200).json(success(result, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

assessmentRouter.post("/work-requests/:id/assessment/run", requireAuthenticated, requirePermission("roadsync.work_request.update"), runLimiter, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const id = idOf(req.params.id);
    if (!objectId.safeParse(id).success) return notFound(res, req);
    await assertLive(actor, ["roadsync.work_request.update"]);
    const outcome = await runForActor(actor, id);
    if (outcome === "missing") return notFound(res, req);
    if (outcome === "draft") return void res.status(409).json(failure("CONFLICT", "request could not be completed", req.requestId, [{ code: "DRAFT_NOT_ASSESSED", message: "Drafts are not assessed." }]));
    res.status(outcome.state === "running" ? 202 : 200).json(success(outcome, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

assessmentRouter.get("/work-requests/:id/assessment/map", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (Object.keys(req.query).length > 0) return bad(res, req);
    const id = idOf(req.params.id);
    if (!objectId.safeParse(id).success) return notFound(res, req);
    await assertLive(actor, ["roadsync.work_request.read"]);
    const map = await getAssessmentMap(actor, id);
    if (!map) return notFound(res, req);
    res.status(200).json(success(map, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

assessmentRouter.post("/work-requests/:id/assessment/whatif", requireAuthenticated, requirePermission("roadsync.work_request.read"), whatIfLimiter, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) return void res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
    const parsed = whatIfSchema.safeParse(req.body ?? {});
    if (!parsed.success) return bad(res, req);
    const id = idOf(req.params.id);
    if (!objectId.safeParse(id).success) return notFound(res, req);
    await assertLive(actor, ["roadsync.work_request.read"]);
    const result = await whatIf(actor, id, parsed.data);
    if (result === "missing") return notFound(res, req);
    if (result === "draft") return void res.status(409).json(failure("CONFLICT", "request could not be completed", req.requestId));
    res.status(200).json(success(result, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

async function overrideHandler(req: Request, res: Response, clear: boolean) {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const id = idOf(req.params.candidateId);
    if (!objectId.safeParse(id).success) return notFound(res, req);
    let input: { band: (typeof BAND_CODES)[number]; reason: string } | null = null;
    if (!clear) {
      if (!isJsonContentType(req)) return void res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      const parsed = overrideSchema.safeParse(req.body);
      if (!parsed.success) return bad(res, req);
      input = parsed.data;
    }
    await assertLive(actor, ["roadsync.work_request.update"]);
    const outcome = await setOverride(actor, id, input);
    if (outcome === "forbidden") return void res.status(403).json(failure("FORBIDDEN", "not permitted", req.requestId));
    if (outcome === "missing") return notFound(res, req);
    res.status(200).json(success({ candidateId: id, overridden: !clear }, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
}
assessmentRouter.post("/assessment/candidates/:candidateId/override", requireAuthenticated, requirePermission("roadsync.work_request.update"), (req, res) => void overrideHandler(req, res, false));
assessmentRouter.delete("/assessment/candidates/:candidateId/override", requireAuthenticated, requirePermission("roadsync.work_request.update"), (req, res) => void overrideHandler(req, res, true));
