/**
 * Step 76 resolution actions. Agreement, application and resolution are separate: an `agreed` negotiation never edits a
 * work request. Submitted requests change ONLY through applyAmendmentToRequest after approvals; the resolution status is
 * always DERIVED by recomputeResolution so a partial write is repaired by the next call. Free text (justification,
 * notes) never reaches events, notifications, audit or the ledger.
 */
import mongoose from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { User } from "../identity/models/user.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import { bandRank } from "./conflict-record.machine.js";
import { emitChanged, hash, loadReadable, pushEvent, recipientIds, whoIs, withRecord, type RecordPlain, type Who } from "./conflict-record.service.js";
import { OPEN_LIKE } from "./conflict-record.rules.js";
import { autoWithdrawForRecord } from "./coordination.service.js";
import { computeAmendmentImpact, type AmendmentImpact } from "./coordination.impact.js";
import { runDetection } from "./detection.service.js";
import { appendLedger } from "./ledger.service.js";
import type { LedgerActor } from "./ledger.engine.js";
import { ConflictRecord, RoadsyncCounter } from "./models/conflict-record.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { Candidate } from "./models/candidate.model.js";
import { Amendment, Resolution } from "./models/resolution.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { buildApprovals, canApprove, deriveStatus, isOfficer, nationalReasons, shiftDays, termsToPlan, validateDates, verifyResult, type Approval, type Commitment, type Viewer } from "./resolution.engine.js";
import { IN_FLIGHT, RES, type LedgerAction, type OutcomeCode, type ResolutionStatus, type ResolutionType } from "./resolution.rules.js";
import { applyAmendmentToRequest } from "./work-requests.service.js";
import { roadsyncEvents } from "./roadsync.events.js";

export { whoIs };
type Oid = mongoose.Types.ObjectId;
const oid = (id: string) => new mongoose.Types.ObjectId(id);
const AMENDABLE = ["SUBMITTED", "PLANNED", "APPROVED"];

export type ResEvent = { id: string; at: Date; type: string; actorType: "system" | "user"; actorId: string | null; actorAgencyId: string | null; data: Record<string, unknown> };
export type CommitmentRow = Commitment & { id: string; status: "pending" | "done" | "waived"; doneBy?: string | null; doneAt?: Date | null; waivedBy?: string | null; waiveReason?: string };
export type Verification = { requestedAt: Date; assessedAt: Date | null; assessedRequestIds: string[]; before: { score: number; band: string; pairActive: boolean }; after: { score: number; band: string; pairActive: boolean } | null; thirdParty: { newConflicts: number; worsened: number; cleared: number; source: "preview" } | null; result: string };
export type ResPlain = {
  _id: Oid; resolutionNo: string; conflictId: Oid; conflictNo: string; pairKey: string; type: ResolutionType; source: { coordinationRequestId?: string; round?: number; directiveBy?: string } | null; status: ResolutionStatus; active: boolean;
  contested: { by: string; at: Date; reason: string } | null; initiator: { agencyId: string; userId: string; onBehalf?: { by: string; reason: string } };
  plan: { noAction?: { reasonCode: string; note?: string }; riskAcceptance?: { justification: string; mitigations: { code: string; text?: string }[]; acceptedBand: string; acceptedScore: number }; directive?: { justification: string; deadlineAt: Date; targets: string[] }; opportunity?: { leadAgencyId: string | null; note?: string } };
  approvals: Approval[]; commitments: CommitmentRow[]; verification: Verification | null; outcome: { code: OutcomeCode; resolvedAt: Date; resolvedBand: string; severityAtResolution: number } | null;
  events: ResEvent[]; version: number; closedAt: Date | null; createdAt: Date; updatedAt: Date;
};
export type AmPlain = {
  _id: Oid; amendmentNo: string; resolutionId: Oid; conflictId: Oid; workRequestId: Oid; agencyId: Oid; source: { type: string; coordinationRequestId?: string; round?: number }; mandated: boolean; baseVersion: number;
  changes: { schedule: { before: { plannedStart: Date; plannedEnd: Date }; after: { plannedStart: Date; plannedEnd: Date } } }; impact: AmendmentImpact | null; status: string;
  createdBy: { userId: string; agencyId: string }; submittedBy: { userId: string; agencyId: string } | null; appliedAt: Date | null; appliedBy: { userId: string; agencyId: string } | null; appliedVersion: number | null; version: number; createdAt: Date;
};

export type Fail = { ok: false; status: 400 | 403 | 404 | 409; code: string; checks?: { code: string; ok: boolean }[] };
export type Ok = { ok: true; res: ResPlain; value?: unknown };
export type Result = Ok | Fail;
const no = (status: Fail["status"], code: string, checks?: Fail["checks"]): Fail => ({ ok: false, status, code, ...(checks ? { checks } : {}) });

function clone<T>(v: T): T {
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(v.toHexString()) as T;
  if (Array.isArray(v)) return v.map((x) => clone(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, clone(x)])) as T;
  return v;
}

// ---------- context ----------

export const viewerOf = (w: Who): Viewer => ({ userId: w.actor.userId, agencyId: w.actor.agencyId, roleKey: w.actor.roleKey, national: w.national, scopeIds: w.scopeIds });
export const requiredAgencies = (rec: Pick<RecordPlain, "affectedAgencies">) => rec.affectedAgencies.filter((a) => a.active && !a.excluded && a.required).map((a) => a.agencyId);
/** Participant of the resolution proper (can see free text): a required agency, or national. Informed-only agencies get the redacted view. */
export const isParty = (w: Who, rec: Pick<RecordPlain, "affectedAgencies">) => w.national || requiredAgencies(rec).some((id) => w.scopeIds.has(id) || id === w.actor.agencyId);
const ledgerActor = (w: Who, onBehalf?: string): LedgerActor => ({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId, role: w.actor.roleKey, ...(onBehalf ? { onBehalfOfAgencyId: onBehalf } : {}) });
const sysActor: LedgerActor = { type: "system" };
const reasonOk = (r?: string) => Boolean(r && r.trim().length >= RES.REASON_MIN);

async function nextNo(prefix: "RSR" | "RSA", now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const row = await RoadsyncCounter.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `${prefix}-${year}-${String(row!.seq).padStart(6, "0")}`;
}

async function usersWithRole(role: string, agencyId?: string): Promise<string[]> {
  const users = await User.find({ status: "ACTIVE", ...(agencyId ? { agencyId: oid(agencyId) } : {}) }).populate({ path: "roleId", select: "key" }).select("_id roleId").limit(200).lean();
  return users.filter((u) => (u.roleId as unknown as { key?: string } | null)?.key === role).map((u) => String(u._id));
}
const hasSecond = async (role: string, agencyId: string | undefined, exceptUserId: string) => (await usersWithRole(role, agencyId)).some((id) => id !== exceptUserId);

export async function loadRes(id: string): Promise<ResPlain | null> {
  return /^[a-f0-9]{24}$/i.test(id) ? ((await Resolution.findById(oid(id)).lean()) as unknown as ResPlain | null) : null;
}
export async function loadAms(resolutionId: Oid | string): Promise<AmPlain[]> {
  return (await Amendment.find({ resolutionId: typeof resolutionId === "string" ? oid(resolutionId) : resolutionId }).sort({ createdAt: 1 }).lean()) as unknown as AmPlain[];
}
/** 404 for anything the viewer cannot read; never reveals existence. */
export async function loadForViewer(w: Who, id: string): Promise<{ res: ResPlain; rec: RecordPlain } | null> {
  const res = await loadRes(id);
  if (!res) return null;
  const rec = await loadReadable(w, String(res.conflictId));
  return rec ? { res, rec } : null;
}

function pushRes(r: ResPlain, type: string, actor: { type: "system" } | { type: "user"; userId: string; agencyId: string }, data: Record<string, unknown> = {}, at = new Date()): void {
  r.events.push({ id: new mongoose.Types.ObjectId().toHexString(), at, type, actorType: actor.type, actorId: actor.type === "user" ? actor.userId : null, actorAgencyId: actor.type === "user" ? actor.agencyId : null, data });
  r.events = r.events.slice(-RES.EVENTS_MAX);
}
const evActor = (w: Who) => ({ type: "user" as const, userId: w.actor.userId, agencyId: w.actor.agencyId });

const SAVED = ["status", "active", "contested", "plan", "approvals", "commitments", "verification", "outcome", "events", "closedAt"] as const;
async function saveRes(before: ResPlain, after: ResPlain): Promise<boolean> {
  const set: Record<string, unknown> = {};
  for (const k of SAVED) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) set[k] = after[k];
  if (!Object.keys(set).length) return true;
  return (await Resolution.updateOne({ _id: before._id, version: before.version }, { $set: set, $inc: { version: 1 } })).matchedCount === 1;
}
async function updateRes(id: Oid, fn: (r: ResPlain, now: Date) => boolean | void): Promise<ResPlain | null> {
  for (let i = 0; i < 3; i += 1) {
    const before = (await Resolution.findById(id).lean()) as unknown as ResPlain | null;
    if (!before) return null;
    const after = clone(before);
    if (fn(after, new Date()) === false) return before;
    if (await saveRes(before, after)) return { ...after, version: after.version + 1 };
  }
  return null;
}
async function saveAm(a: AmPlain, set: Record<string, unknown>): Promise<boolean> {
  return (await Amendment.updateOne({ _id: a._id, version: a.version }, { $set: set, $inc: { version: 1 } })).matchedCount === 1;
}

// ---------- audit + notifications ----------

async function audit(w: Who | null, action: string, res: Pick<ResPlain, "conflictId">, status: string): Promise<void> {
  try {
    await AuditLog.create({ ...(w ? { userId: oid(w.actor.userId) } : {}), action: `roadsync.resolution.${action}`, resourceType: "CONFLICT", resourceId: res.conflictId, newValue: { status: status.toUpperCase().replace(/[^A-Z_]/g, "_"), ...(w ? { agencyId: oid(w.actor.agencyId) } : {}) }, requestId: "resolution", ...(w ? { agencyId: oid(w.actor.agencyId) } : {}) });
  } catch { /* the event log and ledger keep the fact */ }
}

type Kind = "resolution_started" | "approval_requested" | "approval_granted" | "approval_rejected" | "amendment_ready_to_apply" | "amendment_applied" | "verification_cleared" | "verification_followup" | "directive_issued" | "directive_contested" | "commitment_waived" | "risk_accepted" | "resolution_cancelled" | "record_reopened_after_resolution";
/** Params are numbers, codes, names and dates only; never justification or notes. `to` is agency ids and/or "national". */
export async function notifyRes(res: ResPlain, rec: Pick<RecordPlain, "_id" | "severity">, kind: Kind, to: (string | "national")[], extra: Record<string, unknown> = {}, excludeUserId?: string): Promise<void> {
  const ids = new Map<string, string>();
  for (const t of [...new Set(to)]) for (const u of t === "national" ? await usersWithRole("SUPER_ADMIN") : await recipientIds(t)) ids.set(u, t);
  if (!ids.size) return;
  const message = JSON.stringify({ resolutionNo: res.resolutionNo, conflictNo: res.conflictNo, conflictId: String(res.conflictId), type: res.type, band: rec.severity.current.band, status: res.status, ...extra });
  const rows = [...ids.keys()].filter((u) => u !== excludeUserId).map((u) => ({ userId: oid(u), type: "COORDINATION" as const, title: `roadsync.resolution.${kind}`, message, resourceType: "CONFLICT" as const, resourceId: res.conflictId, eventKey: hash(`${res._id}:${String(extra.amendmentNo ?? "")}:${kind}:${res.status}:${u}`) }));
  const have = new Set((await Notification.find({ eventKey: { $in: rows.map((x) => x.eventKey) } }).select("eventKey").lean()).map((x) => x.eventKey));
  const fresh = rows.filter((x) => !have.has(x.eventKey));
  if (fresh.length) { try { await Notification.insertMany(fresh, { ordered: false }); } catch { /* duplicates are the dedupe */ } }
}

const led = (rec: Pick<RecordPlain, "conflictNo">, conflictId: Oid | string, action: LedgerAction, actor: LedgerActor, entity: { type: "resolution" | "amendment" | "approval"; id: string; no: string }, data: Record<string, unknown>, state: { requestStatus?: string; amendmentStatus?: string } = {}) =>
  appendLedger(String(conflictId), { entityType: entity.type, entityId: entity.id, entityNo: entity.no, action, actor, data, state }).catch(() => null).then(() => void rec);

// ---------- record sync ----------

async function syncRecord(res: ResPlain, now = new Date()): Promise<void> {
  const open = res.commitments.filter((c) => c.status === "pending").length;
  const resolved = res.status === "resolved";
  const r = await withRecord(res.conflictId, (rec) => {
    const summary = { state: res.status, id: String(res._id), no: res.resolutionNo, type: res.type, outcome: res.outcome?.code ?? null, resolvedAt: res.outcome?.resolvedAt ?? null, openCommitments: open, ...(res.outcome ? { resolvedBand: res.outcome.resolvedBand as never } : {}), ...(rec.resolution?.reopened && !resolved ? { reopened: true } : {}) };
    if (res.status === "cancelled") { rec.resolution = undefined; return rec.status; }
    rec.resolution = summary;
    if (resolved && rec.status !== "resolved" && OPEN_LIKE.includes(rec.status)) {
      pushEvent(rec, "resolved", { type: "system" }, { resolutionNo: res.resolutionNo, outcome: res.outcome?.code ?? null }, now);
      rec.status = "resolved"; rec.statusChangedAt = now; rec.statusChangedBy = null; rec.closedAt = now;
    }
    return rec.status;
  });
  if (r.saved && r.changed && r.rec) emitChanged(r.rec, resolved ? "resolved" : "resolution", null);
  if (resolved) await autoWithdrawForRecord(String(res.conflictId), "conflict_resolved").catch(() => 0);
}

const OUTCOME: Record<ResolutionType, OutcomeCode> = { amendment: "amendment_cleared", directive: "directive_cleared", risk_acceptance: "risk_accepted", no_action: "no_action", opportunity: "opportunity_realized" };

/** The single derive-and-persist path. Safe to call after any partial operation. */
export async function recomputeResolution(id: Oid | string): Promise<ResPlain | null> {
  const rid = typeof id === "string" ? oid(id) : id;
  const cur = (await Resolution.findById(rid).lean()) as unknown as ResPlain | null;
  if (!cur) return null;
  const ams = await loadAms(rid);
  const rec = (await ConflictRecord.findById(cur.conflictId).lean()) as unknown as RecordPlain | null;
  let changedFrom: ResolutionStatus | null = null;
  const saved = await updateRes(rid, (r, now) => {
    const next = deriveStatus({ type: r.type, current: r.status, amendments: ams.map((a) => a.status as never), approvals: r.approvals, verification: (r.verification?.result ?? null) as never });
    if (next === r.status && (next !== "resolved" || r.outcome)) { changedFrom = null; return false; }
    changedFrom = r.status;
    r.status = next;
    if (next === "resolved" && !r.outcome && rec) { r.outcome = { code: OUTCOME[r.type], resolvedAt: now, resolvedBand: rec.severity.current.band, severityAtResolution: rec.severity.current.score }; r.closedAt = now; r.active = false; }
    pushRes(r, "status_changed", { type: "system" }, { from: changedFrom, to: next }, now);
  });
  if (!saved || !rec) return saved;
  await syncRecord(saved);
  if (changedFrom && saved.status !== changedFrom) {
    const agencies = requiredAgencies(rec);
    if (saved.status === "resolved") {
      await led(rec, saved.conflictId, "resolution_resolved", sysActor, { type: "resolution", id: String(saved._id), no: saved.resolutionNo }, { outcome: saved.outcome?.code ?? null, band: saved.outcome?.resolvedBand ?? null });
      if (saved.outcome?.code === "risk_accepted") await led(rec, saved.conflictId, "risk_accepted", sysActor, { type: "resolution", id: String(saved._id), no: saved.resolutionNo }, { band: saved.plan.riskAcceptance?.acceptedBand ?? null });
      await notifyRes(saved, rec, saved.outcome?.code === "risk_accepted" ? "risk_accepted" : "verification_cleared", [...agencies, "national"], { outcome: saved.outcome?.code ?? null });
    } else if (saved.status === "needs_followup") {
      await led(rec, saved.conflictId, "resolution_followup", sysActor, { type: "resolution", id: String(saved._id), no: saved.resolutionNo }, { result: saved.verification?.result ?? null });
      await notifyRes(saved, rec, "verification_followup", [...agencies, "national"], { result: saved.verification?.result ?? null });
    }
  }
  return saved;
}

// ---------- create ----------

export type CreateInput = {
  type: ResolutionType; source?: { coordinationRequestId?: string }; manual?: { targetRequestId: string; schedule: { plannedStart: string; plannedEnd: string } };
  noAction?: { reasonCode: string; note?: string }; riskAcceptance?: { justification: string; mitigations: { code: string; text?: string }[] };
  directive?: { justification: string; deadlineAt?: string; targets: { targetRequestId: string; schedule: { plannedStart: string; plannedEnd: string } }[] };
  opportunity?: { leadAgencyId?: string; note?: string }; onBehalfOfAgencyId?: string; reason?: string;
};

type Target = { workRequestId: string; agencyId: string; schedule: { plannedStart: string; plannedEnd: string }; source: AmPlain["source"] };

async function buildAmendment(res: { _id: Oid; conflictId: Oid }, rec: RecordPlain, t: Target, w: Who, mandated: boolean, now: Date): Promise<AmPlain | Fail> {
  const wr = await WorkRequest.findById(oid(t.workRequestId)).select("agencyId plannedStart plannedEnd status __v").lean();
  if (!wr || !AMENDABLE.includes(wr.status)) return no(409, "request_not_amendable");
  if (String(wr.agencyId) !== t.agencyId) return no(403, "forbidden");
  const start = new Date(t.schedule.plannedStart);
  const end = new Date(t.schedule.plannedEnd);
  if (!validateDates(start, end, now).every((c) => c.code === "start_not_past" || c.ok)) return no(400, "invalid_dates");
  if (start.getTime() === wr.plannedStart.getTime() && end.getTime() === wr.plannedEnd.getTime()) return no(400, "no_change");
  const impact = await computeAmendmentImpact(t.workRequestId, String(rec.candidateId), { start, end });
  const doc = await Amendment.create({
    amendmentNo: await nextNo("RSA", now), resolutionId: res._id, conflictId: res.conflictId, workRequestId: oid(t.workRequestId), agencyId: oid(t.agencyId), source: t.source, mandated, baseVersion: (wr as { __v?: number }).__v ?? 0,
    changes: { schedule: { before: { plannedStart: wr.plannedStart, plannedEnd: wr.plannedEnd }, after: { plannedStart: start, plannedEnd: end } } }, impact, status: mandated ? "approved" : "draft", createdBy: { userId: w.actor.userId, agencyId: w.actor.agencyId },
  });
  return doc.toObject() as unknown as AmPlain;
}

const toCommitments = (cs: Commitment[]): CommitmentRow[] => cs.slice(0, RES.COMMITMENTS_MAX).map((c) => ({ ...c, id: new mongoose.Types.ObjectId().toHexString(), status: "pending" as const }));

export async function createResolution(w: Who, conflictId: string, input: CreateInput): Promise<Result> {
  const rec = await loadReadable(w, conflictId);
  if (!rec) return no(404, "not_found");
  if (!OPEN_LIKE.includes(rec.status)) return no(409, "invalid_state");
  const nationalType = input.type === "directive" || input.type === "risk_acceptance";
  const required = requiredAgencies(rec);
  const onBehalf = w.national && input.onBehalfOfAgencyId ? input.onBehalfOfAgencyId : undefined;
  if (nationalType ? !w.national : !(w.national ? onBehalf && reasonOk(input.reason) && required.includes(onBehalf) : isOfficer(viewerOf(w)) && required.includes(w.actor.agencyId))) return no(403, "forbidden");
  if (input.type === "directive" && !(input.directive && input.directive.justification.trim().length >= RES.JUSTIFICATION_MIN && input.directive.targets.length)) return no(400, "invalid");
  if (input.type === "risk_acceptance" && !(input.riskAcceptance && input.riskAcceptance.justification.trim().length >= RES.JUSTIFICATION_MIN && input.riskAcceptance.mitigations.length)) return no(400, "invalid");
  if (input.type === "no_action" && !(input.noAction && (input.noAction.reasonCode !== "other" || input.noAction.note?.trim()))) return no(400, "invalid");
  if (input.type === "opportunity" && rec.recordType !== "opportunity" && !input.source?.coordinationRequestId) return no(400, "invalid");
  if (await Resolution.exists({ conflictId: oid(conflictId), active: true })) return no(409, "active_resolution");

  const now = new Date();
  const actorAgency = onBehalf ?? w.actor.agencyId;
  const pair = { aId: String(rec.aId), bId: String(rec.bId), aType: rec.aType, bType: rec.bType, aAgencyId: rec.sides.a.agencyId, bAgencyId: rec.sides.b.agencyId };
  let targets: Target[] = [];
  let commitments: Commitment[] = [];
  let source: ResPlain["source"] = null;
  let opportunity: ResPlain["plan"]["opportunity"] | undefined;
  if (input.type === "amendment") {
    if (input.source?.coordinationRequestId) {
      const cr = (await CoordinationRequest.findById(oid(input.source.coordinationRequestId)).lean()) as unknown as { conflictId: Oid; status: string; agreedTerms: Parameters<typeof termsToPlan>[0] & { round: number } } | null;
      if (!cr || String(cr.conflictId) !== conflictId || cr.status !== "agreed" || !cr.agreedTerms) return no(409, "terms_not_agreed");
      const plan = termsToPlan(cr.agreedTerms, pair);
      targets = plan.amendments.map((a) => ({ workRequestId: a.workRequestId, agencyId: a.agencyId, schedule: a.schedule, source: { type: "agreed_terms", coordinationRequestId: input.source!.coordinationRequestId, round: cr.agreedTerms.round } }));
      commitments = plan.commitments;
      source = { coordinationRequestId: input.source.coordinationRequestId, round: cr.agreedTerms.round };
      if (!targets.length) return no(400, "terms_have_no_amendment");
    } else if (input.manual) {
      const side = [pair.aId === input.manual.targetRequestId && pair.aType === "work_request" ? pair.aAgencyId : null, pair.bId === input.manual.targetRequestId && pair.bType === "work_request" ? pair.bAgencyId : null].find(Boolean);
      if (!side || (!w.national && side !== w.actor.agencyId) || (w.national && side !== onBehalf)) return no(403, "forbidden");
      targets = [{ workRequestId: input.manual.targetRequestId, agencyId: side, schedule: input.manual.schedule, source: { type: "manual" } }];
    } else return no(400, "invalid");
    if (targets.length > RES.MAX_AMENDMENTS) return no(400, "too_many_amendments");
  } else if (input.type === "directive") {
    const d = input.directive!;
    for (const t of d.targets) {
      const agencyId = [pair.aId === t.targetRequestId && pair.aType === "work_request" ? pair.aAgencyId : null, pair.bId === t.targetRequestId && pair.bType === "work_request" ? pair.bAgencyId : null].find(Boolean);
      if (!agencyId) return no(400, "invalid_target");
      targets.push({ workRequestId: t.targetRequestId, agencyId, schedule: t.schedule, source: { type: "directive" } });
    }
    source = { directiveBy: w.actor.userId };
  } else if (input.type === "opportunity") opportunity = { leadAgencyId: input.opportunity?.leadAgencyId ?? rec.lead?.agencyId ?? null, ...(input.opportunity?.note ? { note: input.opportunity.note } : {}) };

  const resNo = await nextNo("RSR", now);
  const days = Math.min(RES.DIRECTIVE_MAX_DAYS, Math.max(RES.DIRECTIVE_MIN_DAYS, input.directive?.deadlineAt ? Math.round((new Date(input.directive.deadlineAt).getTime() - now.getTime()) / 86_400_000) : RES.DIRECTIVE_DEFAULT_DAYS));
  let doc;
  try {
    doc = await Resolution.create({
      resolutionNo: resNo, conflictId: oid(conflictId), conflictNo: rec.conflictNo, pairKey: rec.pairKey, type: input.type, source, status: "draft", active: true, initiator: { agencyId: actorAgency, userId: w.actor.userId, ...(onBehalf ? { onBehalf: { by: w.actor.userId, reason: input.reason } } : {}) },
      plan: {
        ...(input.noAction ? { noAction: input.noAction } : {}), ...(opportunity ? { opportunity } : {}),
        ...(input.riskAcceptance ? { riskAcceptance: { ...input.riskAcceptance, acceptedBand: rec.severity.current.band, acceptedScore: rec.severity.current.score } } : {}),
        ...(input.directive ? { directive: { justification: input.directive.justification, deadlineAt: new Date(now.getTime() + days * 86_400_000), targets: input.directive.targets.map((t) => t.targetRequestId) } } : {}),
      },
      commitments: toCommitments(commitments), events: [],
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return no(409, "active_resolution");
    throw e;
  }
  const res = doc.toObject() as unknown as ResPlain;
  const made: AmPlain[] = [];
  for (const t of targets) {
    const a = await buildAmendment(res, rec, t, w, input.type === "directive", now);
    if ("ok" in a) { await Resolution.deleteOne({ _id: res._id }); await Amendment.deleteMany({ resolutionId: res._id }); return a; }
    made.push(a);
  }
  const resolved = await updateRes(res._id, (r) => { pushRes(r, "created", evActor(w), { type: r.type, amendments: made.length }, now); });
  const fresh = resolved ?? res;
  // Non-amendment types submit immediately: their approvals are the whole workflow.
  if (input.type === "risk_acceptance" || input.type === "no_action" || input.type === "opportunity") {
    const reasons = nationalReasons({ type: input.type, thirdParty: null, severityAtDetection: rec.severity.atDetection.band, shiftDays: 0, band: rec.severity.current.band });
    const approvals = input.type === "risk_acceptance" ? buildApprovals({ kind: "risk", hasSecondNational: await hasSecond("SUPER_ADMIN", undefined, w.actor.userId), now }) : buildApprovals({ kind: "confirm", requiredAgencyIds: required, nationalNeeded: reasons.includes("no_action_high_band"), now });
    await updateRes(res._id, (r) => { r.approvals = approvals; r.status = "pending_approval"; });
  }
  await syncRecord((await loadRes(String(res._id))) ?? fresh);
  const actor = ledgerActor(w, onBehalf);
  await led(rec, conflictId, "resolution_started", actor, { type: "resolution", id: String(res._id), no: resNo }, { type: input.type, amendments: made.length });
  for (const a of made) await led(rec, conflictId, "amendment_created", actor, { type: "amendment", id: String(a._id), no: a.amendmentNo }, { resolutionNo: resNo, mandated: a.mandated, shiftDays: shiftDays(a.changes.schedule.before.plannedStart, a.changes.schedule.after.plannedStart) });
  if (input.type === "directive") {
    await led(rec, conflictId, "directive_issued", actor, { type: "resolution", id: String(res._id), no: resNo }, { targets: made.length });
    await notifyRes(fresh, rec, "directive_issued", [...new Set(made.map((a) => String(a.agencyId)))], { amendmentNo: made[0]?.amendmentNo }, w.actor.userId);
  } else await notifyRes(fresh, rec, "resolution_started", required, {}, w.actor.userId);
  await audit(w, "created", res, "draft");
  const out = (await recomputeResolution(res._id)) ?? fresh;
  return { ok: true, res: out };
}

// ---------- submit / approve / reject / confirm ----------

const stepsOf = (r: ResPlain, amId: string) => r.approvals.filter((a) => a.amendmentId === amId);

async function approvers(a: AmPlain, step: Approval): Promise<(string | "national")[]> {
  return step.step === "national" || step.step === "national_second" ? ["national"] : [step.agencyId ?? String(a.agencyId)];
}

export async function submitAmendment(w: Who, resId: string, amId: string, input: { onBehalfOfAgencyId?: string; reason?: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  const a = (await loadAms(res._id)).find((x) => String(x._id) === amId);
  if (!a) return no(404, "not_found");
  const v = viewerOf(w);
  const onBehalf = w.national ? input.onBehalfOfAgencyId : undefined;
  if (!(w.national ? onBehalf === String(a.agencyId) && reasonOk(input.reason) : isOfficer(v) && w.scopeIds.has(String(a.agencyId)) || w.actor.agencyId === String(a.agencyId))) return no(403, "forbidden");
  if (a.status !== "draft" || res.status === "cancelled" || res.status === "resolved") return no(409, "invalid_state");
  const wr = await WorkRequest.findById(a.workRequestId).select("__v status").lean();
  if (!wr || (wr as { __v?: number }).__v !== a.baseVersion || !AMENDABLE.includes(wr.status)) { await saveAm(a, { status: "stale" }); await led(rec, res.conflictId, "amendment_stale", sysActor, { type: "amendment", id: amId, no: a.amendmentNo }, {}); await recomputeResolution(res._id); return no(409, "stale_amendment"); }
  if (!a.impact) return no(409, "impact_missing");
  const reasons = nationalReasons({ type: res.type, thirdParty: a.impact.thirdParty, severityAtDetection: rec.severity.atDetection.band, shiftDays: shiftDays(a.changes.schedule.before.plannedStart, a.changes.schedule.after.plannedStart), band: rec.severity.current.band });
  const now = new Date();
  const steps = buildApprovals({ kind: "amendment", amendmentId: amId, ownerAgencyId: String(a.agencyId), hasSecondAdmin: await hasSecond("GOV_ADMIN", String(a.agencyId), w.actor.userId), nationalNeeded: reasons.length > 0, now });
  if (!(await saveAm(a, { status: "pending_approval", submittedBy: { userId: w.actor.userId, agencyId: w.actor.agencyId } }))) return no(409, "stale");
  const next = await updateRes(res._id, (r) => { r.approvals = [...r.approvals.filter((x) => x.amendmentId !== amId), ...steps]; pushRes(r, "amendment_submitted", evActor(w), { amendmentNo: a.amendmentNo, reasons }, now); });
  await led(rec, res.conflictId, "amendment_submitted", ledgerActor(w, onBehalf), { type: "amendment", id: amId, no: a.amendmentNo }, { resolutionNo: res.resolutionNo, nationalReasons: reasons.length, steps: steps.map((s) => s.step) }, { amendmentStatus: "pending_approval" });
  for (const s of steps) await notifyRes(next ?? res, rec, "approval_requested", await approvers(a, s), { amendmentNo: a.amendmentNo, step: s.step }, w.actor.userId);
  await audit(w, "amendment_submitted", res, "pending_approval");
  return { ok: true, res: (await recomputeResolution(res._id)) ?? res };
}

async function decide(w: Who, resId: string, pick: (r: ResPlain, v: Viewer) => Approval | undefined, input: { version: number; approve: boolean; note?: string; onBehalfOfAgencyId?: string; reason?: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  if (res.version !== input.version) return no(409, "stale");
  if (res.status === "cancelled" || res.status === "resolved") return no(409, "invalid_state");
  const step = pick(res, viewerOf(w));
  if (!step) return no(403, "forbidden");
  const ams = await loadAms(res._id);
  const am = step.amendmentId ? ams.find((x) => String(x._id) === step.amendmentId) : undefined;
  const submitter = am?.submittedBy?.userId ?? res.initiator.userId;
  const firstNational = res.approvals.find((s) => s.step === "national" && s.status === "approved" && (!s.amendmentId || s.amendmentId === step.amendmentId))?.by ?? null;
  const onBehalf = w.national ? input.onBehalfOfAgencyId : undefined;
  if (w.national && step.agencyId && !(onBehalf === step.agencyId && reasonOk(input.reason))) return no(403, "forbidden");
  const verdict = canApprove(step, viewerOf(w), { submitterUserId: submitter, firstNationalUserId: firstNational, onBehalfOfAgencyId: onBehalf });
  if (verdict !== "ok") return no(403, verdict);
  if (!input.approve && !reasonOk(input.note)) return no(400, "note_required");
  const now = new Date();
  const solo = step.soloApproval === true && w.actor.userId === submitter;
  const saved = await updateRes(res._id, (r) => {
    const s = r.approvals.find((x) => x.id === step.id);
    if (!s || s.status !== "pending") return false;
    s.status = input.approve ? "approved" : "rejected"; s.by = w.actor.userId; s.at = now; s.note = input.note?.trim() || null; if (solo) s.soloApproval = true; if (onBehalf) s.onBehalf = true;
    pushRes(r, input.approve ? "approval_granted" : "approval_rejected", evActor(w), { step: s.step, ...(am ? { amendmentNo: am.amendmentNo } : {}), ...(solo ? { solo: true } : {}) }, now);
  });
  if (!saved) return no(409, "stale");
  const entity = { type: "approval" as const, id: step.id, no: res.resolutionNo };
  await led(rec, res.conflictId, input.approve ? "approval_granted" : "approval_rejected", ledgerActor(w, onBehalf), entity, { step: step.step, ...(am ? { amendmentNo: am.amendmentNo } : {}), ...(solo ? { soloApproval: true } : {}), hasNote: Boolean(input.note), ...(onBehalf ? { hasReason: true } : {}) });
  if (am) {
    if (!input.approve) await saveAm(am, { status: "rejected" });
    else if (stepsOf(saved, step.amendmentId!).every((s) => s.status === "approved")) {
      if (await saveAm(am, { status: "approved" })) await notifyRes(saved, rec, "amendment_ready_to_apply", [String(am.agencyId)], { amendmentNo: am.amendmentNo }, w.actor.userId);
    }
  } else if (!input.approve) await updateRes(res._id, (r) => { r.status = "cancelled"; r.active = false; r.closedAt = now; });
  await notifyRes(saved, rec, input.approve ? "approval_granted" : "approval_rejected", [res.initiator.agencyId, ...requiredAgencies(rec)], { ...(am ? { amendmentNo: am.amendmentNo } : {}), step: step.step }, w.actor.userId);
  await audit(w, input.approve ? "approved" : "rejected", res, input.approve ? "approved" : "rejected");
  return { ok: true, res: (await recomputeResolution(res._id)) ?? saved };
}

export const approve = (w: Who, resId: string, stepId: string, i: { version: number; note?: string; onBehalfOfAgencyId?: string; reason?: string }) => decide(w, resId, (r) => r.approvals.find((s) => s.id === stepId), { ...i, approve: true });
export const reject = (w: Who, resId: string, stepId: string, i: { version: number; note: string; onBehalfOfAgencyId?: string; reason?: string }) => decide(w, resId, (r) => r.approvals.find((s) => s.id === stepId), { ...i, approve: false });
/** Party confirmation for the caller's own agency (opportunity / no-action). */
export const confirmParty = (w: Who, resId: string, i: { version: number; note?: string; onBehalfOfAgencyId?: string; reason?: string }) =>
  decide(w, resId, (r, v) => r.approvals.find((s) => s.step === "party_confirmation" && s.status === "pending" && (s.agencyId === (v.national ? i.onBehalfOfAgencyId : v.agencyId) || (s.agencyId ? v.scopeIds.has(s.agencyId) : false))), { ...i, approve: true });

// ---------- preflight + apply ----------

export async function preflight(res: ResPlain, a: AmPlain, rec: RecordPlain, now = new Date()): Promise<{ ok: boolean; checks: { code: string; ok: boolean }[]; applied: boolean }> {
  const wr = await WorkRequest.findById(a.workRequestId).select("status __v revisions").lean();
  const already = Boolean((wr?.revisions as { via?: { amendmentId?: string } }[] | undefined)?.some((x) => x.via?.amendmentId === String(a._id)));
  const checks: { code: string; ok: boolean }[] = [
    { code: "request_active", ok: Boolean(wr && AMENDABLE.includes(wr.status)) },
    { code: "version_unchanged", ok: Boolean(wr && (wr as { __v?: number }).__v === a.baseVersion) },
    ...validateDates(a.changes.schedule.after.plannedStart, a.changes.schedule.after.plannedEnd, now).map((c) => (c.code === "start_not_past" && a.mandated ? { ...c, ok: true } : c)),
    { code: "approvals_complete", ok: a.mandated || stepsOf(res, String(a._id)).every((s) => s.status === "approved") },
    { code: "resolution_active", ok: res.status !== "cancelled" && res.status !== "resolved" },
  ];
  if (a.source.type === "agreed_terms" && a.source.coordinationRequestId) checks.push({ code: "terms_still_agreed", ok: Boolean(await CoordinationRequest.exists({ _id: oid(a.source.coordinationRequestId), status: "agreed" })) });
  if (!a.mandated && a.impact) {
    const now2 = await computeAmendmentImpact(String(a.workRequestId), String(rec.candidateId), { start: a.changes.schedule.after.plannedStart, end: a.changes.schedule.after.plannedEnd });
    const worse = bandRank(now2.pair.after.band) > bandRank(a.impact.pair.after.band);
    const national = nationalReasons({ type: res.type, thirdParty: now2.thirdParty, severityAtDetection: rec.severity.atDetection.band, shiftDays: shiftDays(a.changes.schedule.before.plannedStart, a.changes.schedule.after.plannedStart), band: rec.severity.current.band }).length > 0;
    const nationalDone = stepsOf(res, String(a._id)).some((s) => s.step === "national" && s.status === "approved");
    checks.push({ code: "impact_unchanged", ok: !worse && (!national || nationalDone) && now2.thirdParty.newConflicts <= a.impact.thirdParty.newConflicts });
  }
  return { ok: checks.every((c) => c.ok), checks, applied: already };
}

export async function applyAmendment(w: Who, resId: string, amId: string, input: { onBehalfOfAgencyId?: string; reason?: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  const a = (await loadAms(res._id)).find((x) => String(x._id) === amId);
  if (!a) return no(404, "not_found");
  const onBehalf = w.national ? input.onBehalfOfAgencyId : undefined;
  const mine = w.actor.agencyId === String(a.agencyId) || w.scopeIds.has(String(a.agencyId));
  if (!(w.national ? onBehalf === String(a.agencyId) && reasonOk(input.reason) : mine && isOfficer(viewerOf(w)))) return no(403, "forbidden");
  if (a.status === "applied") return { ok: true, res, value: { replayed: true } };
  if (a.status !== "approved") return no(409, "invalid_state");
  const pf = await preflight(res, a, rec);
  const now = new Date();
  if (pf.applied) { await saveAm(a, { status: "applied", appliedAt: now }); return { ok: true, res: (await recomputeResolution(res._id)) ?? res, value: { repaired: true } }; }
  if (!pf.ok) {
    if (pf.checks.find((c) => c.code === "impact_unchanged" && !c.ok)) {
      const steps = buildApprovals({ kind: "amendment", amendmentId: amId, ownerAgencyId: String(a.agencyId), hasSecondAdmin: await hasSecond("GOV_ADMIN", String(a.agencyId), a.submittedBy?.userId ?? ""), nationalNeeded: true, now });
      await updateRes(res._id, (r) => { r.approvals = [...r.approvals.map((s) => (s.amendmentId === amId && s.status === "pending" ? { ...s, status: "skipped" as const } : s)), ...steps.filter((s) => !r.approvals.some((x) => x.id === s.id && x.status === "approved"))]; });
      await saveAm(a, { status: "pending_approval", preflightLast: { at: now, checks: pf.checks } });
      await recomputeResolution(res._id);
    }
    if (pf.checks.find((c) => c.code === "version_unchanged" && !c.ok)) { await saveAm(a, { status: "stale" }); await led(rec, res.conflictId, "amendment_stale", sysActor, { type: "amendment", id: amId, no: a.amendmentNo }, {}); await recomputeResolution(res._id); }
    return no(409, "preflight_failed", pf.checks);
  }
  const done = await applyAmendmentToRequest({ amendmentId: amId, resolutionId: String(res._id), workRequestId: String(a.workRequestId), baseVersion: a.baseVersion, plannedStart: a.changes.schedule.after.plannedStart, plannedEnd: a.changes.schedule.after.plannedEnd }, { userId: w.actor.userId, agencyId: onBehalf ?? w.actor.agencyId });
  if (!done.ok) return no(409, done.code);
  await saveAm(a, { status: "applied", appliedAt: now, appliedBy: { userId: w.actor.userId, agencyId: w.actor.agencyId }, appliedVersion: done.version, preflightLast: { at: now, checks: pf.checks } }).then((ok) => ok || saveAm({ ...a, version: a.version + 1 }, { status: "applied", appliedAt: now }));
  const all = await loadAms(res._id);
  const live = all.filter((x) => !["cancelled", "rejected", "stale"].includes(x.status));
  const pair = (await Candidate.findById(rec.candidateId).select("status assessment").lean()) as unknown as { status: string; assessment?: { effective: { score: number; band: string } } } | null;
  const updated = await updateRes(res._id, (r) => {
    if (live.every((x) => x.status === "applied") && !r.verification) r.verification = { requestedAt: now, assessedAt: null, assessedRequestIds: [], before: { score: rec.severity.current.score, band: rec.severity.current.band, pairActive: pair?.status === "active" }, after: null, thirdParty: all.length === 1 ? { ...(a.impact?.thirdParty ?? { newConflicts: 0, worsened: 0, cleared: 0 }), source: "preview" as const } : null, result: "pending" };
    pushRes(r, "amendment_applied", evActor(w), { amendmentNo: a.amendmentNo }, now);
  });
  await led(rec, res.conflictId, "amendment_applied", ledgerActor(w, onBehalf), { type: "amendment", id: amId, no: a.amendmentNo }, { resolutionNo: res.resolutionNo, workRequestVersion: done.version, shiftDays: shiftDays(a.changes.schedule.before.plannedStart, a.changes.schedule.after.plannedStart) }, { amendmentStatus: "applied" });
  await notifyRes(updated ?? res, rec, "amendment_applied", [...requiredAgencies(rec), "national"], { amendmentNo: a.amendmentNo }, w.actor.userId);
  await audit(w, "amendment_applied", res, "applied");
  return { ok: true, res: (await recomputeResolution(res._id)) ?? res };
}

// ---------- verification (fed by the SAME assessment engine) ----------

export async function verifyAfterAssessment(requestId: string): Promise<void> {
  const ams = (await Amendment.find({ workRequestId: oid(requestId), status: "applied" }).lean()) as unknown as AmPlain[];
  for (const resId of [...new Set(ams.map((a) => String(a.resolutionId)))]) {
    const res = await loadRes(resId);
    if (!res || !(IN_FLIGHT as readonly string[]).includes(res.status) || !res.verification || res.verification.result === "cleared") continue;
    const all = (await loadAms(res._id)).filter((x) => !["cancelled", "rejected", "stale"].includes(x.status));
    if (!all.every((x) => x.status === "applied")) continue;
    const seen = new Set([...res.verification.assessedRequestIds, requestId]);
    if (!all.every((x) => seen.has(String(x.workRequestId)))) { await updateRes(res._id, (r) => { r.verification!.assessedRequestIds = [...seen]; }); continue; }
    const rec = (await ConflictRecord.findById(res.conflictId).lean()) as unknown as RecordPlain | null;
    if (!rec) continue;
    const pair = (await Candidate.findById(rec.candidateId).select("status assessment").lean()) as unknown as { status: string; assessment?: { kind: string; effective: { score: number; band: never } } } | null;
    const now = pair?.assessment ? { active: pair.status === "active", kind: pair.assessment.kind, score: pair.assessment.effective.score, band: pair.assessment.effective.band } : null;
    const result = verifyResult(res.verification.before as never, now);
    const saved = await updateRes(res._id, (r, at) => { r.verification = { ...r.verification!, assessedAt: at, assessedRequestIds: [...seen], after: now ? { score: now.score, band: now.band, pairActive: now.active } : { score: 0, band: "info", pairActive: false }, result }; pushRes(r, "verification_completed", { type: "system" }, { result }, at); });
    if (!saved) continue;
    await led(rec, res.conflictId, "verification_completed", sysActor, { type: "resolution", id: resId, no: res.resolutionNo }, { result, beforeScore: res.verification.before.score, afterScore: now?.score ?? 0 });
    await recomputeResolution(res._id);
  }
}

export async function reassess(w: Who, resId: string): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  if (!isParty(w, ctx.rec)) return no(403, "forbidden");
  if (!(IN_FLIGHT as readonly string[]).includes(ctx.res.status)) return no(409, "invalid_state");
  const ams = (await loadAms(ctx.res._id)).filter((a) => a.status === "applied");
  await updateRes(ctx.res._id, (r, now) => { if (r.verification) { r.verification.requestedAt = now; r.verification.assessedRequestIds = []; r.verification.result = "pending"; } });
  for (const a of ams) void runDetection(String(a.workRequestId), { runBy: "reassess" }).catch(() => undefined);
  return { ok: true, res: ctx.res };
}

// ---------- cancel / contest / commitments / reopen ----------

export async function cancelResolution(w: Who, resId: string, input: { version: number; reason: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  if (res.version !== input.version) return no(409, "stale");
  if (!reasonOk(input.reason)) return no(400, "reason_required");
  if (!w.national && !(res.initiator.agencyId === w.actor.agencyId && isOfficer(viewerOf(w)))) return no(403, "forbidden");
  if (!res.active) return no(409, "invalid_state");
  const ams = await loadAms(res._id);
  if (ams.some((a) => a.status === "applied")) return no(409, "already_applied");
  for (const a of ams) if (["draft", "pending_approval", "approved"].includes(a.status)) await saveAm(a, { status: "cancelled" });
  const now = new Date();
  const saved = await updateRes(res._id, (r) => { r.status = "cancelled"; r.active = false; r.closedAt = now; pushRes(r, "cancelled", evActor(w), {}, now); });
  if (!saved) return no(409, "stale");
  await syncRecord(saved);
  await led(rec, res.conflictId, "resolution_cancelled", ledgerActor(w), { type: "resolution", id: resId, no: res.resolutionNo }, { hasReason: true });
  await notifyRes(saved, rec, "resolution_cancelled", requiredAgencies(rec), {}, w.actor.userId);
  await audit(w, "cancelled", res, "cancelled");
  return { ok: true, res: saved };
}

export async function cancelAmendment(w: Who, resId: string, amId: string): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const a = (await loadAms(ctx.res._id)).find((x) => String(x._id) === amId);
  if (!a) return no(404, "not_found");
  if (!(w.national || a.createdBy.userId === w.actor.userId)) return no(403, "forbidden");
  if (!["draft", "pending_approval", "approved"].includes(a.status)) return no(409, "invalid_state");
  await saveAm(a, { status: "cancelled" });
  await updateRes(ctx.res._id, (r) => { r.approvals = r.approvals.map((s) => (s.amendmentId === amId && s.status === "pending" ? { ...s, status: "skipped" as const } : s)); });
  await led(ctx.rec, ctx.res.conflictId, "amendment_cancelled", ledgerActor(w), { type: "amendment", id: amId, no: a.amendmentNo }, {}, { amendmentStatus: "cancelled" });
  return { ok: true, res: (await recomputeResolution(ctx.res._id)) ?? ctx.res };
}

export async function contest(w: Who, resId: string, input: { version: number; reason: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  if (res.type !== "directive" || !res.active) return no(409, "invalid_state");
  if (res.version !== input.version) return no(409, "stale");
  const ams = await loadAms(res._id);
  if (!ams.some((a) => String(a.agencyId) === w.actor.agencyId)) return no(403, "forbidden");
  if (!reasonOk(input.reason)) return no(400, "reason_required");
  const saved = await updateRes(res._id, (r, now) => { if (r.contested) return false; r.contested = { by: w.actor.userId, at: now, reason: input.reason.trim() }; pushRes(r, "contested", evActor(w), {}, now); });
  if (!saved) return no(409, "stale");
  await led(rec, res.conflictId, "directive_contested", ledgerActor(w), { type: "resolution", id: resId, no: res.resolutionNo }, { hasReason: true });
  await notifyRes(saved, rec, "directive_contested", ["national"], { agencyId: w.actor.agencyId }, w.actor.userId);
  return { ok: true, res: saved };
}

export async function commitmentAction(w: Who, resId: string, cid: string, input: { action: "done" | "waive"; reason?: string }): Promise<Result> {
  const ctx = await loadForViewer(w, resId);
  if (!ctx) return no(404, "not_found");
  const { res, rec } = ctx;
  const c = res.commitments.find((x) => x.id === cid);
  if (!c) return no(404, "not_found");
  if (c.status !== "pending") return no(409, "invalid_state");
  if (input.action === "waive" ? !w.national || !reasonOk(input.reason) : !(isOfficer(viewerOf(w)) && (w.actor.agencyId === c.agencyId || w.scopeIds.has(c.agencyId)))) return no(403, "forbidden");
  const saved = await updateRes(res._id, (r, now) => { const x = r.commitments.find((k) => k.id === cid)!; if (x.status !== "pending") return false; x.status = input.action === "done" ? "done" : "waived"; if (input.action === "done") { x.doneBy = w.actor.userId; x.doneAt = now; } else { x.waivedBy = w.actor.userId; x.waiveReason = input.reason!.trim(); } });
  if (!saved) return no(409, "stale");
  await led(rec, res.conflictId, input.action === "done" ? "commitment_done" : "commitment_waived", ledgerActor(w), { type: "resolution", id: resId, no: res.resolutionNo }, { code: c.code, agencyId: c.agencyId, ...(input.action === "waive" ? { hasReason: true } : {}) });
  if (input.action === "waive") await notifyRes(saved, rec, "commitment_waived", [c.agencyId], { code: c.code }, w.actor.userId);
  await syncRecord(saved);
  return { ok: true, res: saved };
}

export async function reopenResolved(w: Who, conflictId: string, input: { version: number; reason: string }): Promise<{ ok: true; version: number } | Fail> {
  if (!w.national) return no(403, "forbidden");
  const rec = await loadReadable(w, conflictId);
  if (!rec) return no(404, "not_found");
  if (rec.version !== input.version) return no(409, "stale");
  if (rec.status !== "resolved") return no(409, "invalid_transition");
  if (!reasonOk(input.reason)) return no(400, "reason_required");
  const r = await withRecord(oid(conflictId), (x) => {
    if (x.status !== "resolved") return false;
    const now = new Date();
    x.status = "open"; x.statusReason = input.reason; x.statusChangedAt = now; x.statusChangedBy = oid(w.actor.userId); x.closedAt = null;
    for (const a of x.affectedAgencies) if (a.active && !a.excluded) a.ack = { status: "pending", by: null, at: null };
    if (x.resolution) x.resolution = { ...x.resolution, reopened: true };
    pushEvent(x, "reopened", { type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId }, { manual: true, afterResolution: true }, now);
    return true;
  });
  if (!r.saved || !r.rec) return no(409, "stale");
  emitChanged(r.rec, "reopened", "resolved");
  const res = await Resolution.findOne({ conflictId: oid(conflictId) }).sort({ createdAt: -1 }).lean() as unknown as ResPlain | null;
  if (res) await notifyRes(res, rec, "record_reopened_after_resolution", [...requiredAgencies(rec)], {}, w.actor.userId);
  await audit(w, "record_reopened", { conflictId: oid(conflictId) }, "open");
  return { ok: true, version: r.rec.version };
}

let registered = false;
export function registerResolutionSubscribers(): void {
  if (registered) return;
  registered = true;
  roadsyncEvents.on("workRequestAmended", (e: { requestId: string }) => { setImmediate(() => { void runDetection(e.requestId, { runBy: "amendment" }).catch(() => undefined); }); });
  roadsyncEvents.on("roadsyncAssessmentCompleted", (e: { requestId: string }) => { setTimeout(() => { void verifyAfterAssessment(e.requestId).catch(() => undefined); }, 150); });
}
