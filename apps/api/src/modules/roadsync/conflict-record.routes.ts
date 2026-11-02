import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { BAND_CODES, CLASS_CODES } from "./assessment.rules.js";
import { RECORD, RECORD_STATUSES } from "./conflict-record.rules.js";
import { acknowledge, acknowledgeBulk, addAgency, addNote, audit, deleteNote, dismiss, excludeAgency, registerConflictRecordSubscribers, reopen, restoreAgency, setLead, setWatch, whoIs, type Mutation, type Who } from "./conflict-record.service.js";
import { exportCsv, getDossier, getEvidence, getMap, listRecords, recordsForRequest, summary, type ListQuery } from "./conflict-record.read.js";
import { WorkRequest } from "./models/work-request.model.js";
import { assertLive, FlowControl, readFilter } from "./work-requests.service.js";

registerConflictRecordSubscribers();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const csv = <T extends string>(allowed: readonly T[]) =>
  z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10)).refine((arr) => arr.every((v) => (allowed as readonly string[]).includes(v))).transform((arr) => arr as T[]);
const csvIds = z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 10)).refine((arr) => arr.every((v) => objectId.safeParse(v).success));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const LIST_KEYS = ["status", "band", "recordType", "class", "agencyId", "leadAgencyId", "needsMyAck", "ackOverdue", "startsWithinDays", "requestId", "q", "watching", "internal", "hasActiveCoordination", "sort", "page", "limit"] as const;
const listSchema = z.object({
  status: csv(RECORD_STATUSES).optional(),
  band: csv(BAND_CODES).optional(),
  recordType: csv(["conflict", "opportunity"] as const).optional(),
  class: csv(CLASS_CODES).optional(),
  agencyId: csvIds.optional(),
  leadAgencyId: objectId.optional(),
  needsMyAck: bool.optional(),
  ackOverdue: bool.optional(),
  startsWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  requestId: objectId.optional(),
  q: z.string().trim().min(1).max(60).optional(),
  watching: bool.optional(),
  internal: bool.optional(),
  hasActiveCoordination: bool.optional(),
  sort: z.enum(["severity", "timeToImpact", "ackDue", "createdAt", "updatedAt"]).default("severity"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(RECORD.LIST_MAX).default(20),
}).strict();

const noControl = (v: string) => ![...v].some((c) => (c.charCodeAt(0) <= 31 && c !== "\n") || c.charCodeAt(0) === 127);
const reasonText = z.string().trim().min(RECORD.REASON_MIN_CHARS).max(500).refine((v) => noControl(v) && !v.includes("$"), "unsafe text");
const version = z.number().int().min(1);
const ackSchema = z.object({ version, note: z.string().trim().max(RECORD.ACK_NOTE_MAX_CHARS).refine(noControl).optional(), agencyId: objectId.optional(), reason: reasonText.optional() }).strict();
const bulkSchema = z.object({ ids: z.array(objectId).min(1).max(RECORD.BULK_ACK_MAX) }).strict();
const reasonBody = z.object({ version, reason: reasonText }).strict();
const leadBody = z.object({ version, agencyId: objectId }).strict();
const addBody = z.object({ version, agencyId: objectId, reason: reasonText }).strict();
const removeBody = z.object({ version, reason: reasonText }).strict();
const restoreBody = z.object({ version }).strict();
const noteBody = z.object({ text: z.string().trim().min(1).max(RECORD.NOTE_MAX_CHARS).refine(noControl, "unsafe text") }).strict();

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
const readLimiter = limiter(240);
const writeLimiter = limiter(60);
const bulkLimiter = limiter(10);
const exportLimiter = limiter(5);

const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const bad = (res: Response, req: Request) => void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const notFound = (res: Response, req: Request) => void res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));

type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who };
/** Shared plumbing: no-store, auth already checked, live re-check, scope, and uniform error mapping. */
function handle(permission: "roadsync.conflict.read", fn: (c: Ctx) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [permission]);
      await fn({ req, res, actor, w: await whoIs(actor) });
    } catch (error) {
      if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}

const can = async (actor: AuthenticatedActor, permission: "roadsync.coordination.respond"): Promise<boolean> => {
  try { await assertLive(actor, [permission]); return true; } catch { return false; }
};

function sendMutation(c: Ctx, m: Mutation, okStatus = 200): void {
  if (m.ok) return void c.res.status(okStatus).json(success({ id: String(m.rec._id), status: m.rec.status, version: m.rec.version, ...(m.value && typeof m.value === "object" ? (m.value as object) : {}) }, c.req.requestId));
  const code = m.status === 404 ? "NOT_FOUND" : m.status === 403 ? "FORBIDDEN" : m.status === 400 ? "VALIDATION_ERROR" : "CONFLICT";
  const message = m.status === 404 ? "resource was not found" : m.status === 403 ? "not permitted" : "request could not be completed";
  c.res.status(m.status).json(failure(code, message, c.req.requestId, m.status === 409 ? [{ code: m.code === "stale" ? "STALE_VERSION" : m.code.toUpperCase(), message: "The record changed. Reload and retry." }] : null));
}
const jsonOnly = (c: Ctx): boolean => {
  if (isJsonContentType(c.req)) return true;
  c.res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", c.req.requestId));
  return false;
};

export const conflictRecordRouter = Router();
const R = "roadsync.conflict.read" as const;
const auth = [requireAuthenticated, requirePermission(R)] as const;

// Static paths first so they are never captured by "/conflicts/:id".
conflictRecordRouter.get("/conflicts/summary", ...auth, readLimiter, handle(R, async (c) => {
  if (Object.keys(c.req.query).length) return bad(c.res, c.req);
  c.res.status(200).json(success(await summary(c.w), c.req.requestId));
}));

conflictRecordRouter.get("/conflicts/export.csv", ...auth, exportLimiter, handle(R, async (c) => {
  const unknown = Object.keys(c.req.query).some((k) => !(LIST_KEYS as readonly string[]).includes(k));
  const parsed = listSchema.safeParse(c.req.query);
  if (unknown || !parsed.success) return bad(c.res, c.req);
  const { body, count } = await exportCsv(c.w, parsed.data as ListQuery);
  await audit({ type: "user", userId: c.actor.userId, agencyId: c.actor.agencyId }, "exported", { _id: new mongoose.Types.ObjectId() }, "exported", `rows ${count}`);
  c.res.setHeader("Content-Type", "text/csv; charset=utf-8");
  c.res.setHeader("Content-Disposition", `attachment; filename="roadsync-conflicts-${new Date().toISOString().slice(0, 10)}.csv"`);
  c.res.status(200).send(body);
}));

conflictRecordRouter.post("/conflicts/acknowledge-bulk", ...auth, bulkLimiter, handle(R, async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = bulkSchema.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  if (!c.w.national && !(await can(c.actor, "roadsync.coordination.respond"))) return void c.res.status(403).json(failure("FORBIDDEN", "not permitted", c.req.requestId));
  c.res.status(200).json(success({ results: await acknowledgeBulk(c.w, parsed.data.ids) }, c.req.requestId));
}));

conflictRecordRouter.get("/conflicts", ...auth, readLimiter, handle(R, async (c) => {
  const unknown = Object.keys(c.req.query).some((k) => !(LIST_KEYS as readonly string[]).includes(k));
  const repeated = Object.values(c.req.query).some((v) => Array.isArray(v));
  const parsed = listSchema.safeParse(c.req.query);
  if (unknown || repeated || !parsed.success) return bad(c.res, c.req);
  c.res.status(200).json(success(await listRecords(c.w, parsed.data as ListQuery), c.req.requestId));
}));

conflictRecordRouter.get("/conflicts/:id", ...auth, readLimiter, handle(R, async (c) => {
  const dossier = await getDossier(c.w, idOf(c.req.params.id), { respond: await can(c.actor, "roadsync.coordination.respond"), note: await can(c.actor, "roadsync.coordination.respond") });
  if (!dossier) return notFound(c.res, c.req);
  c.res.status(200).json(success(dossier, c.req.requestId));
}));

conflictRecordRouter.get("/conflicts/:id/map", ...auth, readLimiter, handle(R, async (c) => {
  const map = await getMap(c.w, idOf(c.req.params.id));
  if (!map) return notFound(c.res, c.req);
  c.res.status(200).json(success(map, c.req.requestId));
}));

conflictRecordRouter.get("/conflicts/:id/evidence.geojson", ...auth, exportLimiter, handle(R, async (c) => {
  const evidence = await getEvidence(c.w, idOf(c.req.params.id));
  if (!evidence) return notFound(c.res, c.req);
  c.res.setHeader("Content-Type", "application/geo+json; charset=utf-8");
  c.res.setHeader("Content-Disposition", `attachment; filename="${String((evidence.properties as { conflictNo: string }).conflictNo).replace(/[^A-Za-z0-9-]/g, "")}.geojson"`);
  c.res.status(200).send(JSON.stringify(evidence));
}));

conflictRecordRouter.post("/conflicts/:id/acknowledge", ...auth, writeLimiter, handle(R, async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = ackSchema.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  if (!c.w.national && !(await can(c.actor, "roadsync.coordination.respond"))) return void c.res.status(403).json(failure("FORBIDDEN", "not permitted", c.req.requestId));
  sendMutation(c, await acknowledge(c.w, idOf(c.req.params.id), parsed.data));
}));

const national = (name: string, schema: z.ZodType<{ version: number }>, run: (w: Who, id: string, body: never) => Promise<Mutation>, method: "post" | "delete" = "post", path = "") => {
  const fn = handle(R, async (c) => {
    if (!jsonOnly(c)) return;
    const parsed = schema.safeParse(c.req.body);
    if (!parsed.success) return bad(c.res, c.req);
    const id = idOf(c.req.params.id);
    if (!objectId.safeParse(id).success) return notFound(c.res, c.req);
    sendMutation(c, await run(c.w, id, { ...parsed.data, ...(c.req.params.agencyId ? { agencyId: idOf(c.req.params.agencyId) } : {}) } as never));
  });
  conflictRecordRouter[method](`/conflicts/:id/${name}${path}`, ...auth, writeLimiter, fn);
};
national("dismiss", reasonBody, dismiss);
national("reopen", reasonBody, reopen);
national("lead", leadBody, setLead);
national("agencies", addBody, addAgency);
national("agencies", removeBody, excludeAgency, "delete", "/:agencyId");
national("agencies", restoreBody, restoreAgency, "post", "/:agencyId/restore");

conflictRecordRouter.post("/conflicts/:id/watch", ...auth, writeLimiter, handle(R, async (c) => sendMutation(c, await setWatch(c.w, idOf(c.req.params.id), true))));
conflictRecordRouter.delete("/conflicts/:id/watch", ...auth, writeLimiter, handle(R, async (c) => sendMutation(c, await setWatch(c.w, idOf(c.req.params.id), false))));

conflictRecordRouter.post("/conflicts/:id/notes", ...auth, writeLimiter, handle(R, async (c) => {
  if (!jsonOnly(c)) return;
  const parsed = noteBody.safeParse(c.req.body);
  if (!parsed.success) return bad(c.res, c.req);
  if (!c.w.national && !(await can(c.actor, "roadsync.coordination.respond"))) return void c.res.status(403).json(failure("FORBIDDEN", "not permitted", c.req.requestId));
  sendMutation(c, await addNote(c.w, idOf(c.req.params.id), parsed.data.text), 201);
}));
conflictRecordRouter.delete("/conflicts/:id/notes/:noteId", ...auth, writeLimiter, handle(R, async (c) => {
  const noteId = idOf(c.req.params.noteId);
  if (!objectId.safeParse(noteId).success) return notFound(c.res, c.req);
  sendMutation(c, await deleteNote(c.w, idOf(c.req.params.id), noteId));
}));

conflictRecordRouter.get("/work-requests/:id/conflicts", ...auth, readLimiter, handle(R, async (c) => {
  const id = idOf(c.req.params.id);
  const readable = objectId.safeParse(id).success && Boolean(await WorkRequest.exists({ $and: [await readFilter(c.actor), { _id: id }] }));
  const result = await recordsForRequest(c.w, id, readable);
  if (!result) return notFound(c.res, c.req);
  c.res.status(200).json(success(result, c.req.requestId));
}));

