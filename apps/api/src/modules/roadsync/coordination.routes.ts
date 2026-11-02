import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { COORD, CONDITION_CODES, DECISIONS, PROPOSAL_TYPES, REQUEST_STATUSES } from "./coordination.rules.js";
import { getDetail, listMessages, listRequests, previewImpact, requestsForConflict, suggestions, summary, type HubQuery } from "./coordination.read.js";
import { autoWithdrawForRecord, closeNoAgreement, confirm, createRequest, extendDeadline, loadReadableReq, markRead, nudge, postMessage, registerCoordinationSubscribers, respond, revise, setEscalation, whoIs, withdraw, type CoordResult, type Who } from "./coordination.service.js";
import { assertLive, FlowControl } from "./work-requests.service.js";

registerCoordinationSubscribers();
void autoWithdrawForRecord;

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const csv = <T extends string>(allowed: readonly T[]) =>
  z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10)).refine((arr) => arr.every((v) => (allowed as readonly string[]).includes(v))).transform((arr) => arr as T[]);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const noControl = (v: string) => ![...v].some((c) => (c.charCodeAt(0) <= 31 && c !== "\n") || c.charCodeAt(0) === 127);
const text = (max: number) => z.string().trim().max(max).refine(noControl, "unsafe text");
const reasonText = z.string().trim().min(COORD.REASON_MIN_CHARS).max(500).refine((v) => noControl(v) && !v.includes("$"), "unsafe text");
const version = z.number().int().min(1);

const HUB_KEYS = ["status", "role", "needsMyResponse", "overdue", "escalated", "type", "conflictId", "q", "sort", "page", "limit"] as const;
const hubSchema = z.object({
  status: csv(REQUEST_STATUSES).optional(), role: z.enum(["initiator", "recipient", "consulted"]).optional(), needsMyResponse: bool.optional(), overdue: bool.optional(), escalated: bool.optional(),
  type: csv(PROPOSAL_TYPES).optional(), conflictId: objectId.optional(), q: z.string().trim().min(1).max(40).optional(),
  sort: z.enum(["deadline", "updatedAt", "severity", "round"]).default("deadline"), page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(COORD.LIST_MAX).default(20),
}).strict();

const proposalIn = { type: z.enum(PROPOSAL_TYPES), proposal: z.record(z.string(), z.unknown()) };
const createSchema = z.object({
  ...proposalIn, summary: text(COORD.SUMMARY_MAX).pipe(z.string().min(1)),
  participants: z.array(z.object({ agencyId: objectId, mode: z.enum(["recipient", "consulted"]) }).strict()).max(COORD.MAX_PARTICIPANTS).optional(),
  deadlineAt: z.string().datetime({ offset: true }).optional(), onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional(),
}).strict();
const respondSchema = z.object({
  version, round: z.number().int().min(1), decision: z.enum(DECISIONS),
  conditions: z.array(z.object({ code: z.enum(CONDITION_CODES), text: text(COORD.CONDITION_TEXT_MAX).optional() }).strict()).max(COORD.CONDITIONS_MAX).optional(),
  reasonCode: z.string().max(40).optional(), note: text(COORD.NOTE_MAX).optional(),
  counterProposal: z.object(proposalIn).strict().optional(), selectedSlot: z.string().datetime({ offset: true }).optional(), onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional(),
}).strict();
const reviseSchema = z.object({ version, ...proposalIn, note: text(COORD.NOTE_MAX).optional() }).strict();
const confirmSchema = z.object({ version, agencyIds: z.union([z.literal("all"), z.array(objectId).min(1).max(COORD.MAX_PARTICIPANTS)]) }).strict();
const reasonBody = z.object({ version, reason: reasonText }).strict();
const versionOnly = z.object({ version }).strict();
const deadlineBody = z.object({ version, deadlineAt: z.string().datetime({ offset: true }) }).strict();
const messageBody = z.object({ text: text(COORD.MESSAGE_MAX).pipe(z.string().min(1)) }).strict();
const previewBody = z.object({ conflictId: objectId, ...proposalIn }).strict();
const messagesQuery = z.object({ cursor: objectId.optional(), limit: z.coerce.number().int().min(1).max(COORD.MESSAGE_PAGE_MAX).default(30) }).strict();

const limiter = (perMinute: number) =>
  rateLimit({
    windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : perMinute, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
  });
const readLimiter = limiter(240);
const writeLimiter = limiter(60);
const createLimiter = limiter(20);
const previewLimiter = limiter(30);
const messageLimiter = limiter(40);

const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const bad = (res: Response, req: Request) => void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const notFound = (res: Response, req: Request) => void res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));

type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who; canWrite: boolean };
const R = "roadsync.coordination.read" as const;
const auth = [requireAuthenticated, requirePermission(R)] as const;
const canRespond = async (actor: AuthenticatedActor) => { try { await assertLive(actor, ["roadsync.coordination.respond"]); return true; } catch { return false; } };

function handle(fn: (c: Ctx) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [R]);
      await fn({ req, res, actor, w: await whoIs(actor), canWrite: await canRespond(actor) });
    } catch (error) {
      if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}
const jsonOnly = (c: Ctx): boolean => {
  if (isJsonContentType(c.req)) return true;
  c.res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", c.req.requestId));
  return false;
};
function send(c: Ctx, r: CoordResult, okStatus = 200): void {
  if (r.ok) return void c.res.status(okStatus).json(success({ id: String(r.req._id), requestNo: r.req.requestNo, status: r.req.status, version: r.req.version, round: r.req.currentRound, ...(r.value && typeof r.value === "object" ? (r.value as object) : {}) }, c.req.requestId));
  const code = r.status === 404 ? "NOT_FOUND" : r.status === 403 ? "FORBIDDEN" : r.status === 400 ? "VALIDATION_ERROR" : "CONFLICT";
  const message = r.status === 404 ? "resource was not found" : r.status === 403 ? "not permitted" : "request could not be completed";
  c.res.status(r.status).json(failure(code, message, c.req.requestId, r.status === 400 || r.status === 409 ? [{ code: r.code === "stale" ? "STALE_VERSION" : r.code.toUpperCase(), message: "The request could not be completed." }] : null));
}

export const coordinationRouter = Router();

coordinationRouter.get("/coordination/summary", ...auth, readLimiter, handle(async (c) => {
  if (Object.keys(c.req.query).length) return bad(c.res, c.req);
  c.res.status(200).json(success(await summary(c.w, c.canWrite), c.req.requestId));
}));

coordinationRouter.post("/coordination/preview-impact", ...auth, previewLimiter, handle(async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = previewBody.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  const out = await previewImpact(c.w, parsed.data);
  if (!out) return notFound(c.res, c.req);
  if (!out.valid) return void c.res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", c.req.requestId, [{ code: out.code.toUpperCase(), message: "The proposal is not valid." }]));
  c.res.status(200).json(success(out, c.req.requestId));
}));

coordinationRouter.get("/coordination", ...auth, readLimiter, handle(async (c) => {
  const unknown = Object.keys(c.req.query).some((k) => !(HUB_KEYS as readonly string[]).includes(k));
  const parsed = hubSchema.safeParse(c.req.query);
  if (unknown || !parsed.success || Object.values(c.req.query).some((v) => Array.isArray(v))) return bad(c.res, c.req);
  c.res.status(200).json(success(await listRequests(c.w, parsed.data as HubQuery, c.canWrite), c.req.requestId));
}));

coordinationRouter.get("/conflicts/:id/coordination/suggestions", ...auth, readLimiter, handle(async (c) => {
  const out = await suggestions(c.w, idOf(c.req.params.id));
  if (!out) return notFound(c.res, c.req);
  c.res.status(200).json(success(out, c.req.requestId));
}));
coordinationRouter.get("/conflicts/:id/coordination", ...auth, readLimiter, handle(async (c) => {
  const out = await requestsForConflict(c.w, idOf(c.req.params.id), c.canWrite);
  if (!out) return notFound(c.res, c.req);
  c.res.status(200).json(success(out, c.req.requestId));
}));
coordinationRouter.post("/conflicts/:id/coordination", ...auth, createLimiter, handle(async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = createSchema.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  send(c, await createRequest(c.w, idOf(c.req.params.id), parsed.data, c.canWrite), 201);
}));

coordinationRouter.get("/coordination/:id", ...auth, readLimiter, handle(async (c) => {
  const r = await loadReadableReq(c.w, idOf(c.req.params.id));
  if (!r) return notFound(c.res, c.req);
  c.res.status(200).json(success(await getDetail(c.w, r, c.canWrite), c.req.requestId));
}));

const action = <S extends z.ZodTypeAny>(path: string, schema: S, run: (c: Ctx, id: string, body: z.infer<S>) => Promise<CoordResult>) =>
  coordinationRouter.post(`/coordination/:id/${path}`, ...auth, writeLimiter, handle(async (c) => {
    if (!jsonOnly(c)) return;
    const parsed = schema.safeParse(c.req.body ?? {});
    if (!parsed.success) return bad(c.res, c.req);
    const id = idOf(c.req.params.id);
    if (!objectId.safeParse(id).success) return notFound(c.res, c.req);
    send(c, await run(c, id, parsed.data));
  }));
action("respond", respondSchema, (c, id, b) => respond(c.w, id, b, c.canWrite));
action("revise", reviseSchema, (c, id, b) => revise(c.w, id, b, c.canWrite));
action("confirm-conditions", confirmSchema, (c, id, b) => confirm(c.w, id, b, c.canWrite));
action("withdraw", reasonBody, (c, id, b) => withdraw(c.w, id, b, c.canWrite));
action("close-no-agreement", reasonBody, (c, id, b) => closeNoAgreement(c.w, id, b, c.canWrite));
action("nudge", versionOnly, (c, id, b) => nudge(c.w, id, b, c.canWrite));
action("escalate", reasonBody, (c, id, b) => setEscalation(c.w, id, true, b));
action("deescalate", reasonBody, (c, id, b) => setEscalation(c.w, id, false, b));

coordinationRouter.patch("/coordination/:id/deadline", ...auth, writeLimiter, handle(async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = deadlineBody.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  send(c, await extendDeadline(c.w, idOf(c.req.params.id), parsed.data, c.canWrite));
}));

coordinationRouter.get("/coordination/:id/messages", ...auth, readLimiter, handle(async (c) => {
  const parsed = messagesQuery.safeParse(c.req.query);
  if (!parsed.success) return bad(c.res, c.req);
  const r = await loadReadableReq(c.w, idOf(c.req.params.id));
  if (!r) return notFound(c.res, c.req);
  c.res.status(200).json(success(await listMessages(c.w, r, parsed.data.cursor ?? null, parsed.data.limit), c.req.requestId));
}));
coordinationRouter.post("/coordination/:id/messages", ...auth, messageLimiter, handle(async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = messageBody.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  send(c, await postMessage(c.w, idOf(c.req.params.id), parsed.data.text, c.canWrite), 201);
}));
coordinationRouter.post("/coordination/:id/read", ...auth, readLimiter, handle(async (c) => send(c, await markRead(c.w, idOf(c.req.params.id)))));
