import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import mongoose from "mongoose";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { WorkRequest } from "./models/work-request.model.js";
import { getDetection, getDetectionMap, registerDetectionSubscribers, runDetection, runDetectionPreview } from "./detection.service.js";
import { validateWorkGeometry } from "./geo.service.js";
import { DETECTION, WORKING_HOURS } from "./roadsync.constants.js";
import { geometryInputSchema } from "./work-requests.schema.js";
import { assertLive, FlowControl, readFilter } from "./work-requests.service.js";

registerDetectionSubscribers();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const instant = z.string().max(40).datetime({ offset: true });

const previewSchema = z.object({
  geometry: geometryInputSchema,
  bufferMeters: z.number().finite().min(0).max(DETECTION.MAX_BUFFER_M).optional(),
  schedule: z.object({
    plannedStart: instant,
    plannedEnd: instant,
    workingHours: z.enum(WORKING_HOURS).default("day"),
    flexibleDays: z.number().int().min(0).max(365).default(0),
    isEmergency: z.boolean().default(false),
  }).strict().optional(),
  radiusMeters: z.number().int().min(DETECTION.MIN_PREVIEW_RADIUS_M).max(DETECTION.MAX_PREVIEW_RADIUS_M).optional(),
  excludeRequestId: objectId.optional(),
}).strict();

const list = <O extends string = string>(item: z.ZodType<string>) =>
  z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10) as O[]).refine((arr) => arr.every((v) => item.safeParse(v).success));
const tokens = z.string().regex(/^[A-Za-z_]{1,40}$/);

const DETECTION_QUERY_KEYS = ["radiusMeters", "sourceType", "agencyId", "temporalRelation", "spatialRelation", "infrastructureType", "onlyCandidates", "sort", "page", "limit"] as const;
const detectionQuerySchema = z.object({
  radiusMeters: z.coerce.number().int().min(DETECTION.MIN_PREVIEW_RADIUS_M).max(DETECTION.MAX_PREVIEW_RADIUS_M).default(DETECTION.DEFAULT_VIEW_RADIUS_M),
  sourceType: list<"work_request" | "project" | "asset">(z.enum(["work_request", "project", "asset"])).optional(),
  agencyId: list(objectId).optional(),
  temporalRelation: list(tokens).optional(),
  spatialRelation: list(tokens).optional(),
  infrastructureType: list(tokens).optional(),
  onlyCandidates: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  sort: z.enum(["distance", "overlapDays", "startDate", "agency"]).default("overlapDays"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const previewLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId));
  },
});

type Res = { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void };
const noStore = (res: Res) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Pragma", "no-cache"); };
const bad = (res: Res, req: { requestId: string }) => res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const notFound = (res: Res, req: { requestId: string }) => res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));
const unavailable = (res: Res, req: { requestId: string }) => res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export const detectionRouter = Router();

/** Object-level read check: the subject must be readable through the Step 66 scoped filter, else 404. */
async function readableSubject(actor: Parameters<typeof readFilter>[0], id: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  return Boolean(await WorkRequest.exists({ $and: [await readFilter(actor), { _id: id }] }));
}

detectionRouter.post("/detect/preview", requireAuthenticated, requirePermission("roadsync.work_request.read"), previewLimiter, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) return void res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, req);
    const geo = validateWorkGeometry(parsed.data.geometry);
    if (!geo.valid) return void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId, geo.errors));
    const s = parsed.data.schedule;
    if (s && !(new Date(s.plannedEnd) >= new Date(s.plannedStart))) return bad(res, req);
    await assertLive(actor, ["roadsync.work_request.read"]);
    const result = await runDetectionPreview(actor, {
      geometry: geo.geometry,
      bufferMeters: parsed.data.bufferMeters ?? DETECTION.DEFAULT_BUFFER_M,
      schedule: s ?? null,
      radiusMeters: parsed.data.radiusMeters ?? DETECTION.DEFAULT_VIEW_RADIUS_M,
      excludeRequestId: parsed.data.excludeRequestId ?? null,
    });
    res.status(200).json(success(result, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

detectionRouter.post("/work-requests/:id/detection/run", requireAuthenticated, requirePermission("roadsync.work_request.update"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const id = idOf(req.params.id);
    await assertLive(actor, ["roadsync.work_request.update"]);
    if (!(await readableSubject(actor, id))) return notFound(res, req);
    const outcome = await runDetection(id, { runBy: actor.userId });
    if (outcome.state === "missing") return notFound(res, req);
    if (outcome.state === "draft") return void res.status(409).json(failure("CONFLICT", "request could not be completed", req.requestId, [{ code: "DRAFT_USE_PREVIEW", message: "Drafts are not scanned. Use the live preview." }]));
    if (outcome.state === "completed") {
      const row = await WorkRequest.findById(id).select("agencyId detection").lean();
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(actor.userId),
        action: "work_request.detection_run",
        resourceType: "WORK_REQUEST",
        resourceId: new mongoose.Types.ObjectId(id),
        newValue: { status: row?.detection?.status === "failed" ? "FAILED" : "COMPLETED" },
        requestId: /^[A-Za-z0-9_-]+$/.test(req.requestId) ? req.requestId.slice(0, 100) : "request",
        agencyId: actor.roleKey === "SUPER_ADMIN" && row?.agencyId ? row.agencyId : new mongoose.Types.ObjectId(actor.agencyId),
      });
    }
    res.status(outcome.state === "running" ? 202 : 200).json(success({ detection: outcome.detection }, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

detectionRouter.get("/work-requests/:id/detection", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const unknown = Object.keys(req.query).some((key) => !(DETECTION_QUERY_KEYS as readonly string[]).includes(key));
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = detectionQuerySchema.safeParse(req.query);
    if (unknown || repeated || !parsed.success) return bad(res, req);
    const id = idOf(req.params.id);
    await assertLive(actor, ["roadsync.work_request.read"]);
    if (!(await readableSubject(actor, id))) return notFound(res, req);
    res.status(200).json(success(await getDetection(actor, id, parsed.data), req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});

detectionRouter.get("/work-requests/:id/detection/map", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const parsed = z.object({ radiusMeters: z.coerce.number().int().min(DETECTION.MIN_PREVIEW_RADIUS_M).max(DETECTION.MAX_PREVIEW_RADIUS_M).default(DETECTION.DEFAULT_VIEW_RADIUS_M) }).strict().safeParse(req.query);
    if (!parsed.success) return bad(res, req);
    const id = idOf(req.params.id);
    await assertLive(actor, ["roadsync.work_request.read"]);
    if (!(await readableSubject(actor, id))) return notFound(res, req);
    res.status(200).json(success(await getDetectionMap(actor, id, parsed.data.radiusMeters), req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    unavailable(res, req);
  }
});
