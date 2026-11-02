import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { archive, archiveCsv, auditList, chronicleCsv, evidencePack, verifyBatch } from "./history.read.js";
import { chronicle, registerLedgerSubscribers, stateAtTime, verifyCase } from "./ledger.service.js";
import { approvalsQueue, approvalsSummary, forConflict, getOne, previewImpact, suggestions } from "./resolution.read.js";
import { applyAmendment, approve, cancelAmendment, cancelResolution, commitmentAction, confirmParty, contest, createResolution, loadAms, loadForViewer, preflight, reassess, registerResolutionSubscribers, reject, reopenResolved, submitAmendment, whoIs, type Result } from "./resolution.service.js";
import type { Who } from "./conflict-record.service.js";
import { LEDGER, MITIGATION_CODES, NO_ACTION_CODES, RES, RESOLUTION_TYPES } from "./resolution.rules.js";
import { assertLive, FlowControl } from "./work-requests.service.js";

registerResolutionSubscribers();
registerLedgerSubscribers();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const noControl = (v: string) => ![...v].some((c) => (c.charCodeAt(0) <= 31 && c !== "\n") || c.charCodeAt(0) === 127);
const text = (max: number) => z.string().trim().max(max).refine(noControl, "unsafe text");
const reasonText = z.string().trim().min(RES.REASON_MIN).max(500).refine((v) => noControl(v) && !v.includes("$"), "unsafe text");
const justification = z.string().trim().min(RES.JUSTIFICATION_MIN).max(RES.JUSTIFICATION_MAX).refine((v) => noControl(v) && !v.includes("$"), "unsafe text");
const version = z.number().int().min(1);
const csv = z.string().max(300).transform((v) => v.split(",").filter(Boolean).slice(0, 12));
const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));
const schedule = z.object({ plannedStart: z.string().datetime({ offset: true }), plannedEnd: z.string().datetime({ offset: true }) }).strict();

const createSchema = z.object({
  type: z.enum(RESOLUTION_TYPES), source: z.object({ coordinationRequestId: objectId }).strict().optional(),
  manual: z.object({ targetRequestId: objectId, schedule }).strict().optional(),
  noAction: z.object({ reasonCode: z.enum(NO_ACTION_CODES), note: text(300).optional() }).strict().optional(),
  riskAcceptance: z.object({ justification, mitigations: z.array(z.object({ code: z.enum(MITIGATION_CODES), text: text(RES.MITIGATION_TEXT_MAX).optional() }).strict()).min(1).max(8) }).strict().optional(),
  directive: z.object({ justification, deadlineAt: z.string().datetime({ offset: true }).optional(), targets: z.array(z.object({ targetRequestId: objectId, schedule }).strict()).min(1).max(RES.MAX_AMENDMENTS) }).strict().optional(),
  opportunity: z.object({ leadAgencyId: objectId.optional(), note: text(300).optional() }).strict().optional(),
  onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional(),
}).strict();
const previewSchema = z.object({ conflictId: objectId, changes: z.array(z.object({ targetRequestId: objectId, schedule }).strict()).min(1).max(RES.MAX_AMENDMENTS) }).strict();
const behalf = z.object({ onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional() }).strict();
const decideSchema = z.object({ version, note: text(500).optional(), onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional() }).strict();
const rejectSchema = z.object({ version, note: reasonText, onBehalfOfAgencyId: objectId.optional(), reason: reasonText.optional() }).strict();
const reasonBody = z.object({ version, reason: reasonText }).strict();
const commitSchema = z.object({ action: z.enum(["done", "waive"]), reason: reasonText.optional() }).strict();
const queueSchema = z.object({ tab: z.enum(["mine", "submitted", "all"]).default("mine"), step: z.enum(["agency_admin", "party_confirmation", "national", "national_second"]).optional(), overdue: z.enum(["true", "false"]).transform((v) => v === "true").optional(), page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(RES.LIST_MAX).default(20) }).strict();
const historySchema = z.object({ cursor: z.coerce.number().int().min(0).optional(), limit: z.coerce.number().int().min(1).max(LEDGER.PAGE_MAX).default(50), category: csv.optional(), actorAgencyId: objectId.optional(), from: date.optional(), to: date.optional(), q: z.string().trim().max(40).optional(), includePreLedger: z.enum(["true", "false"]).transform((v) => v === "true").default(true) }).strict();
const stateSchema = z.object({ at: date }).strict();
const archiveSchema = z.object({ outcome: csv.optional(), band: csv.optional(), from: date.optional(), to: date.optional(), q: z.string().trim().max(20).optional(), sort: z.enum(["resolvedAt", "duration", "severity"]).default("resolvedAt"), page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(RES.LIST_MAX).default(20) }).strict();
const auditSchema = z.object({ action: csv.optional(), actorAgencyId: objectId.optional(), entityType: z.string().max(20).optional(), from: date.optional(), to: date.optional(), conflictId: objectId.optional(), q: z.string().trim().max(40).optional(), page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(RES.LIST_MAX).default(30) }).strict();
const batchSchema = z.object({ conflictIds: z.array(objectId).min(1).max(LEDGER.VERIFY_BATCH_MAX) }).strict();

const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : perMinute, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
const readLimiter = limiter(240);
const writeLimiter = limiter(60);
const previewLimiter = limiter(30);
const verifyLimiter = limiter(10);
const exportLimiter = limiter(20);

const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const bad = (res: Response, req: Request) => void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const notFound = (res: Response, req: Request) => void res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));
type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who };
const R = "roadsync.coordination.read" as const;
const W = "roadsync.coordination.respond" as const;
const read = [requireAuthenticated, requirePermission(R)] as const;
/** SUPER_ADMIN holds the read permission only (platform oversight); other roles need respond for writes, checked in handle(). */
const write = read;

function handle(perm: typeof R | typeof W, fn: (c: Ctx) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [R]);
      const w = await whoIs(actor);
      if (perm === W && !w.national) await assertLive(actor, [W]);
      await fn({ req, res, actor, w });
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
type Sendable = Result | { ok: true; version: number } | { ok: false; status: 400 | 403 | 404 | 409; code: string; checks?: { code: string; ok: boolean }[] };
function send(c: Ctx, r: Sendable, okStatus = 200): void {
  if (r.ok) {
    const res = "res" in r ? r.res : null;
    const extra = "value" in r && r.value && typeof r.value === "object" ? (r.value as object) : {};
    return void c.res.status(okStatus).json(success(res ? { id: String(res._id), resolutionNo: res.resolutionNo, status: res.status, version: res.version, ...extra } : { version: (r as { version: number }).version }, c.req.requestId));
  }
  const code = r.status === 404 ? "NOT_FOUND" : r.status === 403 ? "FORBIDDEN" : r.status === 400 ? "VALIDATION_ERROR" : "CONFLICT";
  const message = r.status === 404 ? "resource was not found" : r.status === 403 ? "not permitted" : "request could not be completed";
  const detail = { code: r.code === "stale" ? "STALE_VERSION" : r.code.toUpperCase(), message: "The request could not be completed.", ...(r.checks ? { checks: r.checks } : {}) };
  c.res.status(r.status).json(failure(code, message, c.req.requestId, r.status === 400 || r.status === 409 ? [detail as never] : null));
}

export const resolutionRouter = Router();

// ---------- resolution ----------
resolutionRouter.get("/approvals/summary", ...read, readLimiter, handle(R, async (c) => void c.res.json(success(await approvalsSummary(c.w), c.req.requestId))));
resolutionRouter.get("/approvals", ...read, readLimiter, handle(R, async (c) => {
  const q = queueSchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  c.res.json(success(await approvalsQueue(c.w, { tab: q.data.tab, page: q.data.page, limit: q.data.limit, ...(q.data.step ? { step: q.data.step } : {}), ...(q.data.overdue !== undefined ? { overdue: q.data.overdue } : {}) }), c.req.requestId));
}));
resolutionRouter.post("/resolutions/preview-impact", ...read, previewLimiter, handle(R, async (c) => {
  if (!jsonOnly(c)) return;
  const b = previewSchema.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  const out = await previewImpact(c.w, b.data);
  if (out === null) return notFound(c.res, c.req);
  if (typeof out === "string") return bad(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
resolutionRouter.get("/conflicts/:id/resolution/suggestions", ...read, readLimiter, handle(R, async (c) => { const out = await suggestions(c.w, idOf(c.req.params.id)); if (!out) return notFound(c.res, c.req); c.res.json(success(out, c.req.requestId)); }));
resolutionRouter.get("/conflicts/:id/resolution", ...read, readLimiter, handle(R, async (c) => { const out = await forConflict(c.w, idOf(c.req.params.id)); if (!out) return notFound(c.res, c.req); c.res.json(success(out, c.req.requestId)); }));
resolutionRouter.post("/conflicts/:id/resolution", ...write, writeLimiter, handle(W, async (c) => {
  if (!jsonOnly(c)) return;
  const b = createSchema.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  const { source, manual, noAction, riskAcceptance, directive, opportunity, onBehalfOfAgencyId, reason, type } = b.data;
  send(c, await createResolution(c.w, idOf(c.req.params.id), {
    type, ...(source ? { source } : {}), ...(manual ? { manual } : {}),
    ...(noAction ? { noAction: { reasonCode: noAction.reasonCode, ...(noAction.note ? { note: noAction.note } : {}) } } : {}),
    ...(riskAcceptance ? { riskAcceptance: { justification: riskAcceptance.justification, mitigations: riskAcceptance.mitigations.map((m) => ({ code: m.code, ...(m.text ? { text: m.text } : {}) })) } } : {}),
    ...(directive ? { directive: { justification: directive.justification, targets: directive.targets, ...(directive.deadlineAt ? { deadlineAt: directive.deadlineAt } : {}) } } : {}),
    ...(opportunity ? { opportunity: { ...(opportunity.leadAgencyId ? { leadAgencyId: opportunity.leadAgencyId } : {}), ...(opportunity.note ? { note: opportunity.note } : {}) } } : {}),
    ...(onBehalfOfAgencyId ? { onBehalfOfAgencyId } : {}), ...(reason ? { reason } : {}),
  }), 201);
}));
resolutionRouter.post("/conflicts/:id/reopen-resolved", ...write, writeLimiter, handle(W, async (c) => {
  if (!jsonOnly(c)) return;
  const b = reasonBody.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  send(c, await reopenResolved(c.w, idOf(c.req.params.id), b.data));
}));
resolutionRouter.get("/resolutions/:id", ...read, readLimiter, handle(R, async (c) => { const out = await getOne(c.w, idOf(c.req.params.id)); if (!out) return notFound(c.res, c.req); c.res.json(success(out, c.req.requestId)); }));

const amBody = (c: Ctx) => {
  if (!jsonOnly(c)) return null;
  const b = behalf.safeParse(c.req.body ?? {});
  if (!b.success) { bad(c.res, c.req); return null; }
  return { ...(b.data.onBehalfOfAgencyId ? { onBehalfOfAgencyId: b.data.onBehalfOfAgencyId } : {}), ...(b.data.reason ? { reason: b.data.reason } : {}) };
};
resolutionRouter.post("/resolutions/:id/amendments/:aid/submit", ...write, writeLimiter, handle(W, async (c) => { const b = amBody(c); if (b) send(c, await submitAmendment(c.w, idOf(c.req.params.id), idOf(c.req.params.aid), b)); }));
resolutionRouter.post("/resolutions/:id/amendments/:aid/apply", ...write, writeLimiter, handle(W, async (c) => { const b = amBody(c); if (b) send(c, await applyAmendment(c.w, idOf(c.req.params.id), idOf(c.req.params.aid), b)); }));
resolutionRouter.post("/resolutions/:id/amendments/:aid/cancel", ...write, writeLimiter, handle(W, async (c) => { send(c, await cancelAmendment(c.w, idOf(c.req.params.id), idOf(c.req.params.aid))); }));
resolutionRouter.get("/resolutions/:id/amendments/:aid/preflight", ...read, readLimiter, handle(R, async (c) => {
  const ctx = await loadForViewer(c.w, idOf(c.req.params.id));
  const a = ctx ? (await loadAms(ctx.res._id)).find((x) => String(x._id) === idOf(c.req.params.aid)) : null;
  if (!ctx || !a) return notFound(c.res, c.req);
  const { ok, checks } = await preflight(ctx.res, a, ctx.rec);
  c.res.json(success({ ok, checks }, c.req.requestId));
}));
const decideOpts = (d: { note?: string | undefined; onBehalfOfAgencyId?: string | undefined; reason?: string | undefined }) => ({ ...(d.note ? { note: d.note } : {}), ...(d.onBehalfOfAgencyId ? { onBehalfOfAgencyId: d.onBehalfOfAgencyId } : {}), ...(d.reason ? { reason: d.reason } : {}) });
resolutionRouter.post("/resolutions/:id/approvals/:sid/approve", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = decideSchema.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await approve(c.w, idOf(c.req.params.id), idOf(c.req.params.sid), { version: b.data.version, ...decideOpts(b.data) })); }));
resolutionRouter.post("/resolutions/:id/approvals/:sid/reject", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = rejectSchema.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await reject(c.w, idOf(c.req.params.id), idOf(c.req.params.sid), { version: b.data.version, note: b.data.note, ...decideOpts({ onBehalfOfAgencyId: b.data.onBehalfOfAgencyId, reason: b.data.reason }) })); }));
resolutionRouter.post("/resolutions/:id/confirm", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = decideSchema.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await confirmParty(c.w, idOf(c.req.params.id), { version: b.data.version, ...decideOpts(b.data) })); }));
resolutionRouter.post("/resolutions/:id/commitments/:cid", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = commitSchema.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await commitmentAction(c.w, idOf(c.req.params.id), idOf(c.req.params.cid), { action: b.data.action, ...(b.data.reason ? { reason: b.data.reason } : {}) })); }));
resolutionRouter.post("/resolutions/:id/reassess", ...write, writeLimiter, handle(W, async (c) => { send(c, await reassess(c.w, idOf(c.req.params.id)), 202); }));
resolutionRouter.post("/resolutions/:id/cancel", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = reasonBody.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await cancelResolution(c.w, idOf(c.req.params.id), b.data)); }));
resolutionRouter.post("/resolutions/:id/contest", ...write, writeLimiter, handle(W, async (c) => { if (!jsonOnly(c)) return; const b = reasonBody.safeParse(c.req.body); if (!b.success) return bad(c.res, c.req); send(c, await contest(c.w, idOf(c.req.params.id), b.data)); }));

// ---------- history / audit ----------
resolutionRouter.get("/conflicts/:id/history/state", ...read, readLimiter, handle(R, async (c) => {
  const q = stateSchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  const out = await stateAtTime(c.w, idOf(c.req.params.id), q.data.at);
  if (!out) return notFound(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
resolutionRouter.get("/conflicts/:id/history/verify", ...read, verifyLimiter, handle(R, async (c) => {
  const out = await verifyCase(c.w, idOf(c.req.params.id));
  if (!out) return notFound(c.res, c.req);
  const { headHash: _omit, ...rest } = out.result as typeof out.result & { headHash?: string | null };
  void _omit;
  c.res.json(success({ ...rest, shortHead: out.shortHead, ...(out.fullHead ? { headHash: out.fullHead } : {}), notice: "tamper_evident_not_tamper_proof" }, c.req.requestId));
}));
resolutionRouter.get("/conflicts/:id/history/export.json", ...read, exportLimiter, handle(R, async (c) => {
  const out = await evidencePack(c.w, idOf(c.req.params.id));
  if (!out) return notFound(c.res, c.req);
  c.res.setHeader("Content-Disposition", `attachment; filename="${out.case.conflictNo.replace(/[^A-Za-z0-9-]/g, "")}-evidence.json"`);
  c.res.json(success(out, c.req.requestId));
}));
resolutionRouter.get("/conflicts/:id/history/export.csv", ...read, exportLimiter, handle(R, async (c) => {
  const out = await chronicleCsv(c.w, idOf(c.req.params.id));
  if (!out) return notFound(c.res, c.req);
  c.res.setHeader("Content-Type", "text/csv; charset=utf-8");
  c.res.setHeader("Content-Disposition", `attachment; filename="chronicle-${idOf(c.req.params.id).replace(/[^a-f0-9]/gi, "").slice(0, 24)}.csv"`);
  c.res.send(out.body);
}));
resolutionRouter.get("/conflicts/:id/history", ...read, readLimiter, handle(R, async (c) => {
  const q = historySchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  const d = q.data;
  const out = await chronicle(c.w, idOf(c.req.params.id), { limit: d.limit, includePreLedger: d.includePreLedger, ...(d.cursor !== undefined ? { cursor: d.cursor } : {}), ...(d.category ? { category: d.category } : {}), ...(d.actorAgencyId ? { actorAgencyId: d.actorAgencyId } : {}), ...(d.from ? { from: d.from } : {}), ...(d.to ? { to: d.to } : {}), ...(d.q ? { q: d.q } : {}) });
  if (!out) return notFound(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
const archiveQuery = (d: z.infer<typeof archiveSchema>) => ({ sort: d.sort, page: d.page, limit: d.limit, ...(d.outcome ? { outcome: d.outcome } : {}), ...(d.band ? { band: d.band } : {}), ...(d.from ? { from: d.from } : {}), ...(d.to ? { to: d.to } : {}), ...(d.q ? { q: d.q } : {}) });
resolutionRouter.get("/history/export.csv", ...read, exportLimiter, handle(R, async (c) => {
  const q = archiveSchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  const out = await archiveCsv(c.w, archiveQuery(q.data));
  c.res.setHeader("Content-Type", "text/csv; charset=utf-8");
  c.res.setHeader("Content-Disposition", 'attachment; filename="roadsync-history.csv"');
  c.res.send(out.body);
}));
resolutionRouter.get("/history", ...read, readLimiter, handle(R, async (c) => {
  const q = archiveSchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  const { _rows, ...rest } = await archive(c.w, archiveQuery(q.data));
  void _rows;
  c.res.json(success(rest, c.req.requestId));
}));
resolutionRouter.get("/audit", ...read, readLimiter, handle(R, async (c) => {
  if (!c.w.national) return notFound(c.res, c.req);
  const q = auditSchema.safeParse(c.req.query);
  if (!q.success) return bad(c.res, c.req);
  const d = q.data;
  c.res.json(success(await auditList({ page: d.page, limit: d.limit, ...(d.action ? { action: d.action } : {}), ...(d.actorAgencyId ? { actorAgencyId: d.actorAgencyId } : {}), ...(d.entityType ? { entityType: d.entityType } : {}), ...(d.from ? { from: d.from } : {}), ...(d.to ? { to: d.to } : {}), ...(d.conflictId ? { conflictId: d.conflictId } : {}), ...(d.q ? { q: d.q } : {}) }), c.req.requestId));
}));
resolutionRouter.post("/audit/verify-batch", ...read, verifyLimiter, handle(R, async (c) => {
  if (!c.w.national) return notFound(c.res, c.req);
  if (!jsonOnly(c)) return;
  const b = batchSchema.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  c.res.json(success({ results: await verifyBatch(b.data.conflictIds) }, c.req.requestId));
}));
