/**
 * Steps 74-75 coordination actions. Every action: validate -> allowedActions -> optimistic version -> mutate -> event ->
 * audit -> recomputeRecordCoordination -> emit -> notify. Submitted work requests are NEVER modified; an agreement only
 * records `agreedTerms`. Free text (summary, notes, conditions, messages) never reaches events, notifications or audit.
 */
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import { BAND_CODES } from "./assessment.rules.js";
import { syncAck, trimEvents } from "./conflict-record.machine.js";
import { canRead, emitChanged, hash, pushEvent, recipientIds, whoIs, withRecord, type RecordPlain, type Who } from "./conflict-record.service.js";
import { RECORD } from "./conflict-record.rules.js";
import { ACTIVE_REQUEST, COORD, CONDITION_CODES, DECLINE_REASONS, DEADLINE_DEFAULT_DAYS, STANCE_OF, type Decision, type ProposalType, type RequestEvent, type RequestStatus } from "./coordination.rules.js";
import { allowedActions, applyDecision, compatibleTypes, confirmConditions, deadlineState, isTerminal, openNextRound, proposerOf, validateProposal, type Action, type Participant, type Proposal, type ReqState, type Response, type Round, type SideCtx } from "./coordination.engine.js";
import { computeImpact } from "./coordination.impact.js";
import { loadItems, type SourceItem } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRecord, RoadsyncCounter } from "./models/conflict-record.model.js";
import { CoordinationMessage, CoordinationRead, CoordinationRequest } from "./models/coordination.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { roadsyncEvents } from "./roadsync.events.js";

type Oid = mongoose.Types.ObjectId;
const oid = (id: string) => new mongoose.Types.ObjectId(id);
const DAY = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export type ReqEvent = { id: string; at: Date; type: RequestEvent; actorType: "system" | "user"; actorId: string | null; actorAgencyId: string | null; data: Record<string, unknown> };
export type Agreed = { round: number; proposal: Proposal; conditions: { agencyId: string; code: string; text?: string }[]; acceptedBy: { agencyId: string; at: Date }[]; agreedAt: Date; ruleSnapshot: { severityAtAgreement: { score: number; band: string } } };
export type ReqPlain = Omit<ReqState, "extendedRounds"> & {
  _id: Oid; requestNo: string; conflictId: Oid; conflictNo: string; pairKey: string; type: ProposalType; summary: string;
  initiator: { agencyId: string; userId: string }; participantAgencyIds: Oid[]; warnings: string[];
  escalated: ({ by: string; at: Date; reason: string } | null) & ReqState["escalated"];
  agreedTerms: Agreed | null; extensions: { round: number; days: number; at: Date }[]; events: ReqEvent[]; version: number; closedAt: Date | null; createdAt: Date; updatedAt: Date;
};
type Actor = { type: "system" } | { type: "user"; userId: string; agencyId: string };
const asActor = (w: Who): Actor => ({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId });
const plain = (r: unknown) => (r ? (r as ReqPlain) : null);

function clone<T>(v: T): T {
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(v.toHexString()) as T;
  if (Array.isArray(v)) return v.map((x) => clone(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, clone(x)])) as T;
  return v;
}

export function pushReqEvent(r: ReqPlain, type: RequestEvent, actor: Actor, data: Record<string, unknown> = {}, at = new Date()): void {
  r.events.push({ id: new mongoose.Types.ObjectId().toHexString(), at, type, actorType: actor.type, actorId: actor.type === "user" ? actor.userId : null, actorAgencyId: actor.type === "user" ? actor.agencyId : null, data });
  r.events = trimEvents(r.events.map((e) => ({ ...e, type: e.type as never }))) as unknown as ReqEvent[];
}

const SAVED = ["participants", "participantAgencyIds", "deadlineAt", "currentRound", "rounds", "status", "escalated", "agreedTerms", "nudges", "extensions", "events", "closedAt", "warnings"] as const;
const syncParticipantIds = (r: ReqPlain) => { r.participantAgencyIds = r.participants.map((p) => oid(p.agencyId)); };

async function saveReq(before: ReqPlain, after: ReqPlain): Promise<boolean> {
  const set: Record<string, unknown> = {};
  for (const k of SAVED) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) set[k] = after[k];
  if (!Object.keys(set).length) return true;
  const res = await CoordinationRequest.updateOne({ _id: before._id, version: before.version, currentRound: before.currentRound }, { $set: set, $inc: { version: 1 } });
  return res.matchedCount === 1;
}

// ---------- visibility ----------

export const canReadReq = (w: Who, r: Pick<ReqPlain, "participantAgencyIds">) => w.national || r.participantAgencyIds.some((id) => w.scopeIds.has(String(id)));
export const myParticipant = (w: Who, r: Pick<ReqPlain, "participants">): Participant | null => r.participants.find((p) => p.agencyId === w.actor.agencyId) ?? r.participants.find((p) => w.scopeIds.has(p.agencyId)) ?? null;
export const viewerOf = (w: Who, r: ReqPlain, canWrite: boolean, now = new Date()) => ({ agencyId: myParticipant(w, r)?.agencyId ?? null, national: w.national, canWrite, isParticipant: Boolean(myParticipant(w, r)), now });
export async function loadReadableReq(w: Who, id: string): Promise<ReqPlain | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const r = plain(await CoordinationRequest.findById(oid(id)).lean());
  return r && canReadReq(w, r) ? r : null;
}

// ---------- audit + notifications ----------

async function audit(actor: Actor, action: string, r: Pick<ReqPlain, "_id">, status: string, agencyId?: string): Promise<void> {
  try {
    await AuditLog.create({
      ...(actor.type === "user" ? { userId: oid(actor.userId) } : {}), action: `roadsync.coordination.${action}`, resourceType: "COORDINATION_REQUEST", resourceId: r._id,
      newValue: { status: status.toUpperCase().replace(/[^A-Z_]/g, "_"), ...(agencyId ? { agencyId: oid(agencyId) } : {}) }, requestId: "coordination", ...(agencyId ? { agencyId: oid(agencyId) } : {}),
    });
  } catch { /* the event log keeps the fact */ }
}

type NoteKind = "request_received" | "response_received" | "counter_proposed" | "conditions_confirmed" | "agreed" | "no_agreement" | "withdrawn" | "nudge" | "escalated" | "deescalated" | "info_needed" | "new_message";
type Note = { agencyId: string; kind: NoteKind; extra?: Record<string, unknown>; bucket?: string };

async function names(ids: string[]) {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

/** Params are codes, names, numbers and dates only. NEVER notes, messages, conditions text or private fields. */
export async function notifyCoord(r: ReqPlain, notes: Note[], excludeUserId?: string): Promise<void> {
  if (!notes.length) return;
  const nm = await names([r.initiator.agencyId, ...r.participants.map((p) => p.agencyId), ...notes.flatMap((n) => (typeof n.extra?.agencyId === "string" ? [n.extra.agencyId] : []))]);
  const rows: { userId: Oid; type: "COORDINATION"; title: string; message: string; resourceType: "COORDINATION_REQUEST"; resourceId: Oid; eventKey: string }[] = [];
  for (const n of notes) {
    const part = r.participants.find((p) => p.agencyId === n.agencyId);
    const message = JSON.stringify({ requestNo: r.requestNo, conflictNo: r.conflictNo, conflictId: String(r.conflictId), type: r.type, round: r.currentRound, deadline: iso(r.deadlineAt), initiator: nm.get(r.initiator.agencyId) ?? null, role: part?.role ?? null, ...(n.extra ?? {}), ...(typeof n.extra?.agencyId === "string" ? { agencyName: nm.get(n.extra.agencyId) ?? null } : {}) });
    for (const userId of await recipientIds(n.agencyId)) {
      if (userId === excludeUserId) continue;
      rows.push({ userId: oid(userId), type: "COORDINATION", title: `roadsync.coordination.${n.kind}`, message, resourceType: "COORDINATION_REQUEST", resourceId: r._id, eventKey: hash(`${r._id}:${n.agencyId}:${n.kind}:${n.bucket ?? r.currentRound}:${userId}`) });
    }
  }
  if (!rows.length) return;
  const have = new Set((await Notification.find({ eventKey: { $in: rows.map((x) => x.eventKey) } }).select("eventKey").lean()).map((x) => x.eventKey));
  const fresh = rows.filter((x) => !have.has(x.eventKey));
  if (!fresh.length) return;
  try { await Notification.insertMany(fresh, { ordered: false }); } catch { /* duplicates are the dedupe */ }
}

// ---------- record sync (the ONE recompute path) ----------

export async function refreshWorkRequestCoordination(requestId: string): Promise<void> {
  const wr = await WorkRequest.findById(requestId).select("agencyId").lean();
  if (!wr) return;
  const records = await ConflictRecord.find({ $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).select("_id").lean();
  const reqs = records.length ? ((await CoordinationRequest.find({ conflictId: { $in: records.map((x) => x._id) }, status: { $in: [...ACTIVE_REQUEST] } }).select("participants").lean()) as unknown as ReqPlain[]) : [];
  const owner = String(wr.agencyId);
  const needs = reqs.filter((x) => x.participants.some((p) => p.agencyId === owner && p.stance === "pending")).length;
  await WorkRequest.updateOne({ _id: oid(requestId) }, { $set: { coordination: { active: reqs.length, needsMyResponse: needs } } });
}

export async function recomputeRecordCoordination(conflictId: string): Promise<void> {
  const reqs = (await CoordinationRequest.find({ conflictId: oid(conflictId) }).select("status escalated updatedAt").lean()) as unknown as Pick<ReqPlain, "status" | "escalated" | "updatedAt">[];
  const active = reqs.filter((x) => (ACTIVE_REQUEST as readonly string[]).includes(x.status));
  const state = active.some((x) => x.escalated) ? "escalated" : active.some((x) => x.status === "negotiating") ? "negotiating" : active.length ? "awaiting_response" : reqs.some((x) => x.status === "agreed") ? "agreed" : "none";
  const summary = { activeCount: active.length, agreedCount: reqs.filter((x) => x.status === "agreed").length, noAgreementCount: reqs.filter((x) => x.status === "no_agreement").length, lastActivityAt: reqs.length ? new Date(Math.max(...reqs.map((x) => new Date(x.updatedAt).getTime()))) : null, state } as NonNullable<RecordPlain["coordination"]>;
  const res = await withRecord(oid(conflictId), (rec) => {
    const prevCount = rec.coordination?.activeCount ?? 0;
    rec.coordination = summary;
    if (["open", "acknowledged", "awaiting_response", "negotiating", "escalated"].includes(rec.status)) {
      const base = syncAck("open", rec.affectedAgencies);
      const target = state === "escalated" ? "escalated" : state === "negotiating" ? "negotiating" : state === "awaiting_response" ? "awaiting_response" : base;
      if (prevCount === 0 && active.length > 0) pushEvent(rec, "coordination_started", { type: "system" }, { activeCount: active.length });
      if (target !== rec.status) {
        pushEvent(rec, "coordination_state_changed", { type: "system" }, { from: rec.status, to: target });
        rec.status = target;
        rec.statusChangedAt = new Date();
      }
    }
    return rec.status;
  });
  if (res.saved && res.changed && res.rec) emitChanged(res.rec, "coordination", null);
  const rec = await ConflictRecord.findById(oid(conflictId)).select("aType aId bType bId").lean();
  for (const [t, id] of [[rec?.aType, rec?.aId], [rec?.bType, rec?.bId]] as const) if (t === "work_request" && id) await refreshWorkRequestCoordination(String(id)).catch(() => null);
}

// ---------- shared mutation plumbing ----------

export type CoordFail = { ok: false; status: 400 | 403 | 404 | 409; code: string };
export type CoordOk = { ok: true; req: ReqPlain; value?: unknown };
export type CoordResult = CoordOk | CoordFail;
const no = (status: CoordFail["status"], code: string): CoordFail => ({ ok: false, status, code });

type Done = { change: string; audit: string; notes?: Note[]; actorAgency?: string; noop?: boolean };
async function mutate(w: Who, id: string, expected: number, fn: (r: ReqPlain, now: Date, rec: RecordPlain) => CoordFail | Done): Promise<CoordResult> {
  const current = await loadReadableReq(w, id);
  if (!current) return no(404, "not_found");
  if (current.version !== expected) return no(409, "stale");
  const rec = plain(await ConflictRecord.findById(current.conflictId).lean()) as unknown as RecordPlain;
  const now = new Date();
  const after = clone(current);
  const res = fn(after, now, rec);
  if ("ok" in res) return res;
  if (res.noop) return { ok: true, req: current, value: { replayed: true } };
  syncParticipantIds(after);
  if (isTerminal(after.status) && !after.closedAt) after.closedAt = now;
  if (!(await saveReq(current, after))) return no(409, "stale");
  after.version += 1;
  await recomputeRecordCoordination(String(after.conflictId));
  roadsyncEvents.emit("roadsyncCoordinationChanged", { requestId: String(after._id), conflictId: String(after.conflictId), change: res.change, from: current.status, to: after.status });
  await audit(asActor(w), res.audit, after, after.status, res.actorAgency ?? w.actor.agencyId);
  await notifyCoord(after, res.notes ?? [], w.actor.userId);
  return { ok: true, req: after };
}

function actingAgency(w: Who, r: ReqPlain, input: { onBehalfOfAgencyId?: string; reason?: string }): { agencyId: string; onBehalf: { by: string; reason: string } | null } | CoordFail {
  if (!w.national) {
    if (input.onBehalfOfAgencyId && input.onBehalfOfAgencyId !== w.actor.agencyId) return no(403, "forbidden");
    return { agencyId: w.actor.agencyId, onBehalf: null };
  }
  if (!input.onBehalfOfAgencyId || (input.reason ?? "").trim().length < COORD.REASON_MIN_CHARS) return no(403, "forbidden");
  if (!r.participants.some((p) => p.agencyId === input.onBehalfOfAgencyId)) return no(400, "invalid");
  return { agencyId: input.onBehalfOfAgencyId, onBehalf: { by: w.actor.userId, reason: input.reason!.trim() } };
}
const failure = (x: unknown): x is CoordFail => Boolean(x && typeof x === "object" && "ok" in x);
const engineFail = (e: string): CoordFail => no(e === "max_rounds" || e === "terminal" || e === "wrong_round" ? 409 : e === "not_participant" || e === "own_round" || e === "not_proposer" || e === "counter_not_allowed" ? 403 : 400, e);

// ---------- creation ----------

async function sideContext(rec: RecordPlain): Promise<{ a: SideCtx; b: SideCtx; items: Map<string, SourceItem> }> {
  const items = await loadItems([{ type: rec.aType, id: String(rec.aId) }, { type: rec.bType, id: String(rec.bId) }]);
  const side = (type: RecordPlain["aType"], id: Oid, agencyId: string): SideCtx => {
    const i = items.get(`${type}:${id}`);
    return { id: String(id), type, agencyId, start: i?.start ?? null, end: i?.end ?? null, workingHours: i?.workingHours ?? "day", isEmergency: false };
  };
  return { a: side(rec.aType, rec.aId, rec.sides.a.agencyId), b: side(rec.bType, rec.bId, rec.sides.b.agencyId), items };
}

export type CreateInput = { type: ProposalType; summary: string; proposal: unknown; participants?: { agencyId: string; mode: "recipient" | "consulted" }[]; deadlineAt?: string; onBehalfOfAgencyId?: string; reason?: string };
const CREATABLE = ["open", "acknowledged", "awaiting_response", "negotiating"];

export async function createRequest(w: Who, conflictId: string, input: CreateInput, canWrite: boolean): Promise<CoordResult> {
  if (!/^[a-f0-9]{24}$/i.test(conflictId)) return no(404, "not_found");
  const rec = plain(await ConflictRecord.findById(oid(conflictId)).lean()) as unknown as RecordPlain | null;
  if (!rec || !canRead(w, rec)) return no(404, "not_found");
  if (!CREATABLE.includes(rec.status)) return no(409, "invalid_transition");
  const live = rec.affectedAgencies.filter((a) => a.active && !a.excluded);
  let initiatorAgency = w.actor.agencyId;
  let onBehalf: { by: string; reason: string } | null = null;
  if (w.national) {
    if (!input.onBehalfOfAgencyId || (input.reason ?? "").trim().length < COORD.REASON_MIN_CHARS) return no(403, "forbidden");
    initiatorAgency = input.onBehalfOfAgencyId;
    onBehalf = { by: w.actor.userId, reason: input.reason!.trim() };
  } else if (!canWrite) return no(403, "forbidden");
  const me = live.find((a) => a.agencyId === initiatorAgency);
  if (!me || !me.required) return no(403, "forbidden"); // informed-only agencies cannot initiate
  const siblings = (await CoordinationRequest.find({ conflictId: rec._id, status: { $in: [...ACTIVE_REQUEST] } }).select("type initiator").lean()) as unknown as ReqPlain[];
  if (siblings.length >= COORD.MAX_ACTIVE_PER_CONFLICT) return no(409, "max_active");
  if (siblings.some((x) => x.type === input.type && x.initiator.agencyId === initiatorAgency)) return no(409, "duplicate_active");

  const ctx = await sideContext(rec);
  const now = new Date();
  const v = validateProposal(input.type, input.proposal, { a: ctx.a, b: ctx.b, recordType: rec.recordType, classes: rec.severity.current.classes, now });
  if (!v.ok) return no(400, v.code);
  const parts: Participant[] = [{ agencyId: initiatorAgency, role: "initiator", required: true, stance: "proposer", lastDecisionAt: null, dueAt: null }];
  const wanted = new Map<string, "recipient" | "consulted">();
  for (const a of live.filter((x) => x.required && x.agencyId !== initiatorAgency)) wanted.set(a.agencyId, "recipient");
  for (const p of input.participants ?? []) {
    const a = live.find((x) => x.agencyId === p.agencyId);
    if (!a || p.agencyId === initiatorAgency) return no(400, "invalid_participant");
    if (p.mode === "consulted" && a.required) continue; // required agencies are always recipients
    if (p.mode === "recipient" && !a.required) return no(400, "invalid_participant"); // informed-only agencies can only be consulted
    wanted.set(p.agencyId, a.required ? "recipient" : "consulted");
  }
  if (![...wanted.values()].includes("recipient")) return no(400, "no_required_recipient");
  if (wanted.size + 1 > COORD.MAX_PARTICIPANTS) return no(400, "too_many_participants");

  const days = DEADLINE_DEFAULT_DAYS[rec.recordType === "opportunity" ? "opportunity" : rec.severity.current.band];
  const deadlineAt = input.deadlineAt ? new Date(input.deadlineAt) : new Date(now.getTime() + days * DAY);
  const span = (deadlineAt.getTime() - now.getTime()) / DAY;
  if (Number.isNaN(span) || span < COORD.DEADLINE_MIN_DAYS - 0.01 || span > COORD.DEADLINE_MAX_DAYS) return no(400, "invalid_deadline");
  const warnings = [...v.warnings];
  if (rec.overlapWindow && deadlineAt.getTime() > new Date(rec.overlapWindow.start).getTime() - COORD.DEADLINE_WARN_DAYS_BEFORE_START * DAY) warnings.push("deadline_close_to_start");
  for (const [agencyId, mode] of wanted) parts.push({ agencyId, role: mode, required: mode === "recipient", stance: "pending", lastDecisionAt: null, dueAt: deadlineAt });
  if (v.proposal.type === "joint_works" && !parts.some((p) => p.agencyId === v.proposal.after.leadAgencyId)) return no(400, "invalid_participant");

  const sideOfInitiator = [ctx.a, ctx.b].find((s) => s.agencyId === initiatorAgency && s.type === "work_request") ?? (ctx.a.type === "work_request" ? ctx.a : ctx.b);
  const impact = sideOfInitiator.type === "work_request" ? await computeImpact(sideOfInitiator.id, String(rec.candidateId), v.proposal).catch(() => null) : null;
  const year = now.getUTCFullYear();
  const counter = await RoadsyncCounter.findOneAndUpdate({ _id: `RSQ-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  const requestNo = `RSQ-${year}-${String(counter!.seq).padStart(6, "0")}`;
  const doc: Omit<ReqPlain, "_id" | "createdAt" | "updatedAt"> = {
    requestNo, conflictId: rec._id, conflictNo: rec.conflictNo, pairKey: rec.pairKey, type: input.type, summary: input.summary,
    initiator: { agencyId: initiatorAgency, userId: w.actor.userId }, participants: parts, participantAgencyIds: parts.map((p) => oid(p.agencyId)), deadlineAt, warnings,
    currentRound: 1, maxRounds: COORD.MAX_ROUNDS, status: "awaiting_response", escalated: null as never, agreedTerms: null, nudges: [], extensions: [], events: [], version: 1, closedAt: null,
    rounds: [{ n: 1, proposal: v.proposal, proposedBy: { agencyId: initiatorAgency, userId: w.actor.userId }, note: null, createdAt: now, responses: [], impact } as Round],
  } as never;
  const draft = doc as unknown as ReqPlain;
  pushReqEvent(draft, "created", asActor(w), { type: input.type, ...(onBehalf ? { onBehalf: true } : {}) }, now);
  pushReqEvent(draft, "round_opened", asActor(w), { round: 1 }, now);
  const saved = plain((await CoordinationRequest.create(draft)).toObject()) as ReqPlain;
  // Initiating implies acknowledgement for the initiator's agency.
  await withRecord(rec._id, (r) => {
    const e = r.affectedAgencies.find((x) => x.agencyId === initiatorAgency);
    if (!e || e.ack.status === "acknowledged") return false;
    e.ack = { status: "acknowledged", by: w.actor.userId, at: now, byRole: w.actor.roleKey, onBehalf: Boolean(onBehalf) };
    pushEvent(r, "acknowledged", asActor(w), { agencyId: initiatorAgency, via: "coordination" }, now);
    r.status = syncAck(r.status, r.affectedAgencies);
    return true;
  });
  await recomputeRecordCoordination(String(rec._id));
  roadsyncEvents.emit("roadsyncCoordinationChanged", { requestId: String(saved._id), conflictId: conflictId, change: "created", from: null, to: saved.status });
  await audit(asActor(w), "created", saved, saved.status, initiatorAgency);
  await notifyCoord(saved, parts.filter((p) => p.stance !== "proposer").map((p) => ({ agencyId: p.agencyId, kind: "request_received" as const })), w.actor.userId);
  return { ok: true, req: saved, value: { warnings } };
}

// ---------- respond / revise / confirm ----------

export type RespondInput = { version: number; round: number; decision: Decision; conditions?: { code: string; text?: string }[]; reasonCode?: string; note?: string; counterProposal?: { type: ProposalType; proposal: unknown }; selectedSlot?: string; onBehalfOfAgencyId?: string; reason?: string };

function setAgreed(r: ReqPlain, rec: RecordPlain, now: Date): void {
  const round = r.rounds[r.currentRound - 1]!;
  const accepted = r.participants.filter((p) => p.stance === "accepted" && p.stance !== ("proposer" as never));
  r.status = "agreed";
  r.agreedTerms = {
    round: r.currentRound, proposal: clone(round.proposal),
    conditions: round.responses.filter((x) => accepted.some((p) => p.agencyId === x.agencyId)).flatMap((x) => x.conditions.map((c) => ({ agencyId: x.agencyId, code: c.code, ...(c.text ? { text: c.text } : {}) }))),
    acceptedBy: accepted.map((p) => ({ agencyId: p.agencyId, at: p.lastDecisionAt ?? now })), agreedAt: now,
    ruleSnapshot: { severityAtAgreement: { score: rec.severity.current.score, band: rec.severity.current.band } },
  };
}

const sameResponse = (a: Response | undefined, b: Response) => Boolean(a && a.decision === b.decision && JSON.stringify(a.conditions) === JSON.stringify(b.conditions) && a.reasonCode === b.reasonCode && a.note === b.note && a.selectedSlot === b.selectedSlot);

export async function respond(w: Who, id: string, input: RespondInput, canWrite: boolean): Promise<CoordResult> {
  if (!w.national && !canWrite) return no(403, "forbidden");
  if (!DECISION_SET.has(input.decision)) return no(400, "invalid");
  const conditions = input.conditions ?? [];
  if (input.decision === "accepted_with_conditions" && (!conditions.length || conditions.length > COORD.CONDITIONS_MAX || conditions.some((c) => !(CONDITION_CODES as readonly string[]).includes(c.code) || (c.code === "other" && !c.text?.trim()) || (c.text ?? "").length > COORD.CONDITION_TEXT_MAX))) return no(400, "invalid_conditions");
  if (input.decision === "declined" && (!input.reasonCode || !(DECLINE_REASONS as readonly string[]).includes(input.reasonCode) || (input.reasonCode === "other" && !input.note?.trim()))) return no(400, "invalid_reason");
  if (input.decision === "needs_info" && !input.note?.trim()) return no(400, "note_required");
  if (input.decision === "counter_proposed" && !input.counterProposal) return no(400, "counter_required");
  return mutate(w, id, input.version, (r, now, rec) => {
    const who = actingAgency(w, r, input);
    if (failure(who)) return who;
    if (input.round !== r.currentRound) return no(409, "wrong_round");
    if (isTerminal(r.status)) return no(409, "terminal");
    const round = r.rounds[r.currentRound - 1]!;
    if (input.decision === "counter_proposed" && r.currentRound + 1 > r.maxRounds) return no(409, "max_rounds");
    const slots = (round.proposal.after.slots as string[] | undefined) ?? null;
    const needsSlot = round.proposal.type === "site_meeting" && (input.decision === "accepted" || input.decision === "accepted_with_conditions");
    if (needsSlot && (!input.selectedSlot || !slots?.includes(input.selectedSlot))) return no(400, "slot_required");
    const response: Response = { agencyId: who.agencyId, userId: w.actor.userId, onBehalf: who.onBehalf, decision: input.decision, conditions: input.decision === "accepted_with_conditions" ? conditions : [], reasonCode: input.reasonCode ?? null, note: input.note?.trim() || null, selectedSlot: needsSlot ? input.selectedSlot! : null, counterRound: input.decision === "counter_proposed" ? r.currentRound + 1 : null, at: now };
    if (sameResponse(round.responses.find((x) => x.agencyId === who.agencyId), response) && input.decision !== "counter_proposed") return { change: "response", audit: "responded", noop: true };
    const asUser: Actor = { type: "user", userId: w.actor.userId, agencyId: who.agencyId };
    const prevProposer = proposerOf(r)?.agencyId;
    const e = applyDecision(r, response);
    if (e !== "ok") return engineFail(e);
    pushReqEvent(r, input.decision === "needs_info" ? "needs_info" : "response", asUser, { decision: input.decision, round: r.currentRound, agencyId: who.agencyId, ...(who.onBehalf ? { onBehalf: true } : {}) }, now);
    const notes: Note[] = [];
    if (input.decision === "counter_proposed") {
      const part = r.participants.find((p) => p.agencyId === who.agencyId)!;
      const side = sideSync(rec);
      const v = validateProposal(input.counterProposal!.type, input.counterProposal!.proposal, { a: side.a, b: side.b, recordType: rec.recordType, classes: rec.severity.current.classes, now });
      if (!v.ok) return no(400, v.code);
      if (!compatibleTypes(round.proposal.type, v.proposal.type)) return no(400, "incompatible_type");
      const ne = openNextRound(r, { agencyId: part.agencyId, userId: w.actor.userId }, v.proposal, input.note?.trim() || null, now);
      if (ne !== "ok") return engineFail(ne);
      pushReqEvent(r, "counter_proposed", asUser, { round: r.currentRound, agencyId: who.agencyId }, now);
      pushReqEvent(r, "round_opened", asUser, { round: r.currentRound }, now);
      for (const p of r.participants.filter((x) => x.agencyId !== who.agencyId)) notes.push({ agencyId: p.agencyId, kind: "counter_proposed", extra: { agencyId: who.agencyId } });
      return { change: "counter_proposed", audit: "responded", notes, actorAgency: who.agencyId };
    }
    if ((r.status as RequestStatus) === "agreed") { setAgreed(r, rec, now); pushReqEvent(r, "agreed", { type: "system" }, { round: r.currentRound }, now); for (const p of r.participants) notes.push({ agencyId: p.agencyId, kind: "agreed" }); }
    else if (prevProposer) notes.push({ agencyId: prevProposer, kind: input.decision === "needs_info" ? "info_needed" : "response_received", extra: { agencyId: who.agencyId, decision: input.decision } });
    return { change: (r.status as RequestStatus) === "agreed" ? "agreed" : "response", audit: "responded", notes, actorAgency: who.agencyId };
  });
}
const DECISION_SET = new Set<string>(["accepted", "accepted_with_conditions", "counter_proposed", "needs_info", "declined"]);

/** Sync variant of sideContext using the denormalized record sides plus already-stored request dates. */
function sideSync(rec: RecordPlain): { a: SideCtx; b: SideCtx } {
  const dates = (s: RecordPlain["sides"]["a"]) => ({ start: s.plannedStart ? new Date(s.plannedStart) : null, end: s.plannedEnd ? new Date(s.plannedEnd) : null });
  return {
    a: { id: String(rec.aId), type: rec.aType, agencyId: rec.sides.a.agencyId, ...dates(rec.sides.a), workingHours: "day", isEmergency: false },
    b: { id: String(rec.bId), type: rec.bType, agencyId: rec.sides.b.agencyId, ...dates(rec.sides.b), workingHours: "day", isEmergency: false },
  };
}

export async function revise(w: Who, id: string, input: { version: number; type: ProposalType; proposal: unknown; note?: string }, canWrite: boolean): Promise<CoordResult> {
  if (!canWrite || w.national) return no(403, "forbidden");
  return mutate(w, id, input.version, (r, now, rec) => {
    const me = proposerOf(r);
    if (!me || me.agencyId !== w.actor.agencyId) return no(403, "forbidden");
    const side = sideSync(rec);
    const v = validateProposal(input.type, input.proposal, { a: side.a, b: side.b, recordType: rec.recordType, classes: rec.severity.current.classes, now });
    if (!v.ok) return no(400, v.code);
    const e = openNextRound(r, { agencyId: me.agencyId, userId: w.actor.userId }, v.proposal, input.note?.trim() || null, now);
    if (e !== "ok") return engineFail(e);
    pushReqEvent(r, "revised", asActor(w), { round: r.currentRound }, now);
    pushReqEvent(r, "round_opened", asActor(w), { round: r.currentRound }, now);
    return { change: "revised", audit: "revised", notes: r.participants.filter((p) => p.agencyId !== me.agencyId).map((p) => ({ agencyId: p.agencyId, kind: "request_received" as const })) };
  });
}

export async function confirm(w: Who, id: string, input: { version: number; agencyIds: string[] | "all" }, canWrite: boolean): Promise<CoordResult> {
  if (!canWrite || w.national) return no(403, "forbidden");
  return mutate(w, id, input.version, (r, now, rec) => {
    const me = proposerOf(r);
    if (!me || me.agencyId !== w.actor.agencyId) return no(403, "forbidden");
    const targets = r.participants.filter((p) => p.stance === "conditional" && (input.agencyIds === "all" || input.agencyIds.includes(p.agencyId))).map((p) => p.agencyId);
    const e = confirmConditions(r, input.agencyIds, now);
    if (e !== "ok") return engineFail(e);
    pushReqEvent(r, "conditions_confirmed", asActor(w), { agencies: targets.length }, now);
    const notes: Note[] = targets.map((agencyId) => ({ agencyId, kind: "conditions_confirmed" as const }));
    if (r.status === "agreed") { setAgreed(r, rec, now); pushReqEvent(r, "agreed", { type: "system" }, { round: r.currentRound }, now); for (const p of r.participants) notes.push({ agencyId: p.agencyId, kind: "agreed" }); }
    return { change: r.status === "agreed" ? "agreed" : "conditions_confirmed", audit: "confirmed", notes };
  });
}

// ---------- terminal and control actions ----------

const reasonOk = (reason: string | undefined) => (reason ?? "").trim().length >= COORD.REASON_MIN_CHARS;

function closeWith(status: "withdrawn" | "no_agreement", event: RequestEvent, kind: NoteKind, audit: string, guard: (r: ReqPlain, w: Who) => boolean) {
  return async (w: Who, id: string, input: { version: number; reason: string }, canWrite: boolean): Promise<CoordResult> => {
    if (!reasonOk(input.reason)) return no(400, "invalid");
    if (!w.national && !canWrite) return no(403, "forbidden");
    return mutate(w, id, input.version, (r, now) => {
      if (isTerminal(r.status)) return no(409, "terminal");
      if (!w.national && !guard(r, w)) return no(403, "forbidden");
      r.status = status;
      pushReqEvent(r, event, asActor(w), { round: r.currentRound, ...(w.national ? { national: true } : {}) }, now);
      return { change: event, audit, notes: r.participants.map((p) => ({ agencyId: p.agencyId, kind })) };
    });
  };
}
export const withdraw = closeWith("withdrawn", "withdrawn", "withdrawn", "withdrawn", (r, w) => r.initiator.agencyId === w.actor.agencyId);
export const closeNoAgreement = closeWith("no_agreement", "closed_no_agreement", "no_agreement", "closed", (r, w) => proposerOf(r)?.agencyId === w.actor.agencyId);

export async function nudge(w: Who, id: string, input: { version: number }, canWrite: boolean): Promise<CoordResult> {
  if (!canWrite || w.national) return no(403, "forbidden");
  return mutate(w, id, input.version, (r, now) => {
    const me = proposerOf(r);
    if (!me || me.agencyId !== w.actor.agencyId) return no(403, "forbidden");
    if (isTerminal(r.status)) return no(409, "terminal");
    if (!allowedActions(r as never, { agencyId: me.agencyId, national: false, canWrite, isParticipant: true, now }).includes("nudge")) {
      const last = r.nudges.at(-1);
      return no(409, r.nudges.length >= COORD.NUDGES_MAX ? "nudge_cap" : last && now.getTime() - new Date(last.at).getTime() < COORD.NUDGE_COOLDOWN_HOURS * 3_600_000 ? "nudge_cooldown" : "nothing_pending");
    }
    const targets = r.participants.filter((p) => p.required && p.stance === "pending");
    r.nudges.push({ at: now, by: w.actor.userId, agencyId: me.agencyId });
    pushReqEvent(r, "nudged", asActor(w), { agencies: targets.length }, now);
    return { change: "nudged", audit: "nudged", notes: targets.map((p) => ({ agencyId: p.agencyId, kind: "nudge" as const, bucket: String(r.nudges.length) })) };
  });
}

export async function setEscalation(w: Who, id: string, on: boolean, input: { version: number; reason: string }): Promise<CoordResult> {
  if (!reasonOk(input.reason)) return no(400, "invalid");
  return mutate(w, id, input.version, (r, now) => {
    if (!w.national) return no(403, "forbidden");
    if (isTerminal(r.status)) return no(409, "terminal");
    if (on === Boolean(r.escalated)) return no(409, "already");
    r.escalated = on ? ({ by: w.actor.userId, at: now, reason: input.reason.trim() } as never) : (null as never);
    pushReqEvent(r, on ? "escalated" : "deescalated", asActor(w), { round: r.currentRound }, now);
    return { change: on ? "escalated" : "deescalated", audit: on ? "escalated" : "deescalated", notes: r.participants.map((p) => ({ agencyId: p.agencyId, kind: on ? ("escalated" as const) : ("deescalated" as const) })) };
  });
}

export async function extendDeadline(w: Who, id: string, input: { version: number; deadlineAt: string }, canWrite: boolean): Promise<CoordResult> {
  if (!canWrite || w.national) return no(403, "forbidden");
  return mutate(w, id, input.version, (r, now) => {
    const me = proposerOf(r);
    if (!me || me.agencyId !== w.actor.agencyId) return no(403, "forbidden");
    if (isTerminal(r.status)) return no(409, "terminal");
    const next = new Date(input.deadlineAt);
    const add = (next.getTime() - new Date(r.deadlineAt).getTime()) / DAY;
    if (Number.isNaN(add) || add <= 0 || add > COORD.EXTEND_MAX_DAYS + 0.01) return no(400, "invalid_deadline");
    if (r.extensions.some((x) => x.round === r.currentRound)) return no(409, "already_extended");
    if ((next.getTime() - new Date(r.createdAt).getTime()) / DAY > COORD.DEADLINE_MAX_DAYS) return no(400, "invalid_deadline");
    r.deadlineAt = next;
    r.extensions.push({ round: r.currentRound, days: Math.round(add * 10) / 10, at: now });
    for (const p of r.participants) if (p.stance !== "proposer") p.dueAt = next;
    pushReqEvent(r, "deadline_extended", asActor(w), { round: r.currentRound }, now);
    return { change: "deadline_extended", audit: "deadline_extended" };
  });
}

/** System: a cancelled source closes the record, which withdraws every active request on it. */
export async function autoWithdrawForRecord(conflictId: string): Promise<number> {
  const active = (await CoordinationRequest.find({ conflictId: oid(conflictId), status: { $in: [...ACTIVE_REQUEST] } }).lean()) as unknown as ReqPlain[];
  for (const before of active) {
    const after = clone(before);
    after.status = "withdrawn";
    after.closedAt = new Date();
    pushReqEvent(after, "auto_withdrawn", { type: "system" }, { reason: "source_cancelled" });
    if (await saveReq(before, after)) { after.version += 1; await notifyCoord(after, after.participants.map((p) => ({ agencyId: p.agencyId, kind: "withdrawn" as const }))); }
  }
  if (active.length) await recomputeRecordCoordination(conflictId);
  return active.length;
}

let registered = false;
export function registerCoordinationSubscribers(): void {
  if (registered) return;
  registered = true;
  roadsyncEvents.on("roadsyncConflictRecordChanged", (e: { conflictId: string; to: string }) => {
    if (e.to === "auto_closed") setImmediate(() => { void autoWithdrawForRecord(e.conflictId).catch(() => undefined); });
  });
}

// ---------- messages ----------

export async function postMessage(w: Who, id: string, text: string, canWrite: boolean): Promise<CoordResult> {
  const r = await loadReadableReq(w, id);
  if (!r) return no(404, "not_found");
  const mine = myParticipant(w, r);
  if (!w.national && !(mine && canWrite)) return no(403, "forbidden");
  if (isTerminal(r.status) && !w.national) return no(409, "terminal");
  if ((await CoordinationMessage.countDocuments({ requestId: r._id })) >= COORD.MESSAGES_PER_REQUEST_MAX) return no(409, "messages_cap");
  const agencyId = mine?.agencyId ?? w.actor.agencyId;
  const msg = await CoordinationMessage.create({ requestId: r._id, conflictId: r.conflictId, authorUserId: oid(w.actor.userId), authorAgencyId: oid(agencyId), text, kind: "message" });
  // A proposer answering after a needs_info marks the thread; append-only, so it never races a decision.
  const proposer = proposerOf(r);
  if (proposer?.agencyId === agencyId && r.participants.some((p) => p.stance === "needs_info")) {
    const ev: ReqEvent = { id: new mongoose.Types.ObjectId().toHexString(), at: new Date(), type: "info_provided", actorType: "user", actorId: w.actor.userId, actorAgencyId: agencyId, data: { round: r.currentRound } };
    await CoordinationRequest.updateOne({ _id: r._id }, { $push: { events: ev } });
  }
  const bucket = String(Math.floor(Date.now() / (COORD.MESSAGE_NOTIFY_WINDOW_MIN * 60_000)));
  await notifyCoord(r, r.participants.filter((p) => p.agencyId !== agencyId).map((p) => ({ agencyId: p.agencyId, kind: "new_message" as const, bucket: `m${bucket}` })), w.actor.userId);
  return { ok: true, req: r, value: { id: String(msg._id) } };
}

export async function markRead(w: Who, id: string): Promise<CoordResult> {
  const r = await loadReadableReq(w, id);
  if (!r) return no(404, "not_found");
  const last = await CoordinationMessage.findOne({ requestId: r._id }).sort({ _id: -1 }).select("_id").lean();
  await CoordinationRead.updateOne({ requestId: r._id, userId: oid(w.actor.userId) }, { $set: { lastSeenAt: new Date(), lastSeenMessageId: last?._id ?? null, snapshot: { round: r.currentRound, responses: r.rounds.reduce((n, x) => n + x.responses.length, 0), status: r.status } } }, { upsert: true });
  return { ok: true, req: r };
}

export { whoIs, BAND_CODES, RECORD, STANCE_OF, deadlineState };
export type { Who };
