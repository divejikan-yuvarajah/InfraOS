/**
 * Steps 74-75 reads: hub list, summary, room detail, thread, suggestions and the impact preview.
 * Participant-only visibility: non-participant affected agencies see only the record-level summary.
 * Rounds and impact expose scores, bands, counts and already-visible dates only.
 */
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { User } from "../identity/models/user.model.js";
import { canRead, type RecordPlain, type Who } from "./conflict-record.service.js";
import { COORD, ACTIVE_REQUEST, type ProposalType, type RequestStatus } from "./coordination.rules.js";
import { allowedActions, deadlineState, isTerminal, validateProposal, type Proposal } from "./coordination.engine.js";
import { computeImpact } from "./coordination.impact.js";
import { canReadReq, myParticipant, viewerOf, type ReqPlain } from "./coordination.service.js";
import { loadItems } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { CoordinationMessage, CoordinationRead, CoordinationRequest } from "./models/coordination.model.js";
import { colomboDay } from "./schedule.analysis.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const FETCH_CAP = 1000;
const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function agencyNames(ids: string[]) {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}
async function userNames(ids: string[]) {
  const rows = ids.length ? await User.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("firstName lastName").lean() : [];
  return new Map(rows.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

export type HubQuery = { status?: RequestStatus[]; role?: "initiator" | "recipient" | "consulted"; needsMyResponse?: boolean; overdue?: boolean; escalated?: boolean; type?: ProposalType[]; conflictId?: string; q?: string; sort: "deadline" | "updatedAt" | "severity" | "round"; page: number; limit: number };

function scopeFilter(w: Who): Record<string, unknown> {
  if (w.national) return {};
  if (!w.scopeIds.size) return { _id: { $in: [] } };
  return { participantAgencyIds: { $in: [...w.scopeIds].map(oid) } };
}

type RecInfo = { conflictNo: string; band: string; score: number };
async function recordInfo(reqs: ReqPlain[]): Promise<Map<string, RecInfo>> {
  const ids = [...new Set(reqs.map((r) => String(r.conflictId)))];
  const rows = ids.length ? ((await ConflictRecord.find({ _id: { $in: ids.map(oid) } }).select("conflictNo severity.current").lean()) as unknown as (RecordPlain & { _id: mongoose.Types.ObjectId })[]) : [];
  return new Map(rows.map((r) => [String(r._id), { conflictNo: r.conflictNo, band: r.severity.current.band, score: r.severity.current.score }]));
}

function rowOf(w: Who, r: ReqPlain, info: RecInfo | undefined, names: Map<string, string>, unread: number, now: Date, canWrite: boolean) {
  const mine = myParticipant(w, r);
  const dl = deadlineState(new Date(r.deadlineAt), r.status, now);
  const required = r.participants.filter((p) => p.required && p.stance !== "proposer");
  return {
    id: String(r._id), requestNo: r.requestNo, conflictId: String(r.conflictId), conflictNo: r.conflictNo, type: r.type, status: r.status, escalated: Boolean(r.escalated),
    severity: info ? { band: info.band, score: info.score } : null, round: r.currentRound, maxRounds: r.maxRounds,
    initiator: { agencyId: r.initiator.agencyId, agencyName: names.get(r.initiator.agencyId) ?? null },
    participants: r.participants.map((p) => ({ agencyId: p.agencyId, agencyName: names.get(p.agencyId) ?? null, role: p.role, required: p.required, stance: p.stance })),
    myParticipation: mine ? { role: mine.role, required: mine.required, stance: mine.stance, mustRespond: !isTerminal(r.status) && mine.stance === "pending" && canWrite, dueAt: iso(mine.dueAt), overdue: !isTerminal(r.status) && mine.stance === "pending" && dl.state === "overdue" } : null,
    deadline: { at: iso(r.deadlineAt), state: dl.state, hours: dl.hours },
    agreement: { done: required.filter((p) => p.stance === "accepted").length, required: required.length },
    unreadMessages: unread, lastActivityAt: iso(r.updatedAt), version: r.version,
  };
}
export type HubRow = ReturnType<typeof rowOf>;

async function unreadMap(w: Who, reqs: ReqPlain[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!reqs.length) return out;
  const reads = await CoordinationRead.find({ userId: oid(w.actor.userId), requestId: { $in: reqs.map((r) => r._id) } }).lean();
  const seen = new Map(reads.map((x) => [String(x.requestId), x.lastSeenMessageId]));
  const all = await CoordinationMessage.find({ requestId: { $in: reqs.map((r) => r._id) }, authorUserId: { $ne: oid(w.actor.userId) } }).select("requestId _id").lean();
  for (const m of all) {
    const last = seen.get(String(m.requestId));
    if (!last || String(m._id) > String(last)) out.set(String(m.requestId), (out.get(String(m.requestId)) ?? 0) + 1);
  }
  return out;
}

export async function listRequests(w: Who, q: HubQuery, canWrite: boolean) {
  const and: Record<string, unknown>[] = [scopeFilter(w)];
  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.type?.length) and.push({ type: { $in: q.type } });
  if (q.conflictId) and.push({ conflictId: oid(q.conflictId) });
  if (q.q) { const re = new RegExp(escapeRe(q.q.slice(0, 40)), "i"); and.push({ $or: [{ requestNo: re }, { conflictNo: re }] }); }
  if (q.escalated) and.push({ escalated: { $ne: null } });
  const reqs = (await CoordinationRequest.find({ $and: and }).sort({ updatedAt: -1 }).limit(FETCH_CAP).lean()) as unknown as ReqPlain[];
  const [info, names, unread] = await Promise.all([recordInfo(reqs), agencyNames(reqs.flatMap((r) => r.participants.map((p) => p.agencyId))), unreadMap(w, reqs)]);
  const now = new Date();
  let rows = reqs.map((r) => rowOf(w, r, info.get(String(r.conflictId)), names, unread.get(String(r._id)) ?? 0, now, canWrite));
  if (q.role) rows = rows.filter((x) => x.myParticipation?.role === q.role);
  if (q.needsMyResponse) rows = rows.filter((x) => x.myParticipation?.mustRespond);
  if (q.overdue) rows = rows.filter((x) => x.deadline.state === "overdue" && !["agreed", "no_agreement", "withdrawn"].includes(x.status));
  const rank = (b: string | undefined) => ["info", "low", "medium", "high", "critical"].indexOf(b ?? "info");
  const sorters: Record<HubQuery["sort"], (a: HubRow, b: HubRow) => number> = {
    deadline: (a, b) => (a.deadline.at ?? "9").localeCompare(b.deadline.at ?? "9"),
    updatedAt: (a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
    severity: (a, b) => rank(b.severity?.band) - rank(a.severity?.band),
    round: (a, b) => b.round - a.round,
  };
  rows.sort((a, b) => sorters[q.sort](a, b) || a.requestNo.localeCompare(b.requestNo));
  const start = (q.page - 1) * q.limit;
  return { items: rows.slice(start, start + q.limit), total: rows.length, page: q.page, limit: q.limit };
}

export async function summary(w: Who, canWrite: boolean) {
  const reqs = (await CoordinationRequest.find(scopeFilter(w)).limit(FETCH_CAP).lean()) as unknown as ReqPlain[];
  const now = new Date();
  const active = reqs.filter((r) => (ACTIVE_REQUEST as readonly string[]).includes(r.status));
  const mine = (r: ReqPlain) => myParticipant(w, r);
  const mustRespond = (r: ReqPlain) => canWrite && mine(r)?.stance === "pending";
  const since = now.getTime() - 30 * 86_400_000;
  return {
    needsMyResponse: active.filter(mustRespond).length,
    overdueForMe: active.filter((r) => mustRespond(r) && now > new Date(r.deadlineAt)).length,
    awaitingOthers: active.filter((r) => mine(r)?.stance === "proposer").length,
    negotiating: active.filter((r) => r.status === "negotiating").length,
    escalated: active.filter((r) => r.escalated).length,
    agreed30d: reqs.filter((r) => r.status === "agreed" && r.closedAt && new Date(r.closedAt).getTime() >= since).length,
    capped: reqs.length >= FETCH_CAP,
  };
}

export async function requestsForConflict(w: Who, conflictId: string, canWrite: boolean) {
  if (!/^[a-f0-9]{24}$/i.test(conflictId)) return null;
  const rec = (await ConflictRecord.findById(oid(conflictId)).lean()) as unknown as RecordPlain | null;
  if (!rec || !canRead(w, rec)) return null;
  const summaryOnly = rec.coordination ?? { activeCount: 0, agreedCount: 0, noAgreementCount: 0, lastActivityAt: null, state: "none" };
  const reqs = (await CoordinationRequest.find({ $and: [{ conflictId: rec._id }, scopeFilter(w)] }).sort({ updatedAt: -1 }).limit(50).lean()) as unknown as ReqPlain[];
  const [info, names, unread] = await Promise.all([recordInfo(reqs), agencyNames(reqs.flatMap((r) => r.participants.map((p) => p.agencyId))), unreadMap(w, reqs)]);
  const now = new Date();
  return { coordination: summaryOnly, items: reqs.map((r) => rowOf(w, r, info.get(String(r.conflictId)), names, unread.get(String(r._id)) ?? 0, now, canWrite)) };
}

// ---------- room detail ----------

export async function getDetail(w: Who, r: ReqPlain, canWrite: boolean) {
  const now = new Date();
  const userIds = [...r.rounds.flatMap((x) => [x.proposedBy.userId, ...x.responses.map((y) => y.userId)]), ...r.events.map((e) => e.actorId ?? "")].filter(Boolean);
  const [names, people, info, marker] = await Promise.all([
    agencyNames(r.participants.map((p) => p.agencyId)), userNames(userIds), recordInfo([r]),
    CoordinationRead.findOne({ requestId: r._id, userId: oid(w.actor.userId) }).lean(),
  ]);
  const own = (agencyId: string | null | undefined) => Boolean(agencyId && (w.national || w.scopeIds.has(agencyId)));
  const who = (agencyId: string, userId: string | null) => ({ agencyId, agencyName: names.get(agencyId) ?? null, ...(own(agencyId) && userId ? { name: people.get(userId) ?? null } : {}) });
  const dl = deadlineState(new Date(r.deadlineAt), r.status, now);
  const snap = (marker?.snapshot ?? null) as { round: number; responses: number; status: string } | null;
  const responsesNow = r.rounds.reduce((n, x) => n + x.responses.length, 0);
  const lastMsg = marker?.lastSeenMessageId ?? null;
  const newMessages = await CoordinationMessage.countDocuments({ requestId: r._id, authorUserId: { $ne: oid(w.actor.userId) }, ...(lastMsg ? { _id: { $gt: lastMsg } } : {}) });
  const diff = marker ? { newRounds: Math.max(0, r.currentRound - (snap?.round ?? r.currentRound)), newResponses: Math.max(0, responsesNow - (snap?.responses ?? responsesNow)), newMessages } : null;
  await CoordinationRead.updateOne({ requestId: r._id, userId: oid(w.actor.userId) }, { $set: { lastSeenAt: now, snapshot: { round: r.currentRound, responses: responsesNow, status: r.status } }, $setOnInsert: { lastSeenMessageId: null } }, { upsert: true });
  const viewer = viewerOf(w, r, canWrite, now);
  const mine = myParticipant(w, r);
  return {
    id: String(r._id), requestNo: r.requestNo, conflictId: String(r.conflictId), conflictNo: r.conflictNo, type: r.type, summary: r.summary, status: r.status,
    escalated: r.escalated ? { at: iso(r.escalated.at), reason: r.escalated.reason } : null, severity: info.get(String(r.conflictId)) ?? null,
    round: r.currentRound, maxRounds: r.maxRounds, version: r.version, createdAt: iso(r.createdAt), closedAt: iso(r.closedAt), warnings: r.warnings,
    initiator: who(r.initiator.agencyId, r.initiator.userId),
    deadline: { at: iso(r.deadlineAt), state: dl.state, hours: dl.hours }, extensions: r.extensions.map((x) => ({ round: x.round, days: x.days })),
    participants: r.participants.map((p) => ({ agencyId: p.agencyId, agencyName: names.get(p.agencyId) ?? null, role: p.role, required: p.required, stance: p.stance, lastDecisionAt: iso(p.lastDecisionAt), dueAt: iso(p.dueAt), mine: mine?.agencyId === p.agencyId })),
    rounds: r.rounds.map((x) => ({
      n: x.n, proposal: x.proposal, note: x.note, createdAt: iso(x.createdAt), impact: x.impact, proposedBy: who(x.proposedBy.agencyId, x.proposedBy.userId),
      responses: x.responses.map((y) => ({ ...who(y.agencyId, y.userId), decision: y.decision, conditions: y.conditions, reasonCode: y.reasonCode, note: y.note, selectedSlot: y.selectedSlot, counterRound: y.counterRound, onBehalf: Boolean(y.onBehalf), at: iso(y.at) })),
    })),
    agreedTerms: r.agreedTerms ? { ...r.agreedTerms, agreedAt: iso(r.agreedTerms.agreedAt), acceptedBy: r.agreedTerms.acceptedBy.map((a) => ({ agencyId: a.agencyId, agencyName: names.get(a.agencyId) ?? null, at: iso(a.at) })), conditions: r.agreedTerms.conditions.map((c) => ({ ...c, agencyName: names.get(c.agencyId) ?? null })) } : null,
    allowedActions: allowedActions(r as never, viewer), myParticipation: mine ? { role: mine.role, required: mine.required, stance: mine.stance } : null,
    nudges: r.nudges.map((n) => ({ at: iso(n.at), agencyName: names.get(n.agencyId) ?? null })),
    events: r.events.map((e) => ({ id: e.id, at: iso(e.at), type: e.type, data: e.data, actor: e.actorType === "system" ? { kind: "system" as const } : { kind: "user" as const, agencyId: e.actorAgencyId, agencyName: e.actorAgencyId ? names.get(e.actorAgencyId) ?? null : null, ...(own(e.actorAgencyId) && e.actorId ? { name: people.get(e.actorId) ?? null } : {}) } })),
    diffSinceLastSeen: diff,
  };
}

export async function listMessages(w: Who, r: ReqPlain, cursor: string | null, limit: number) {
  const filter: Record<string, unknown> = { requestId: r._id };
  if (cursor) filter._id = { $gt: oid(cursor) };
  const rows = await CoordinationMessage.find(filter).sort({ _id: 1 }).limit(limit + 1).lean();
  const page = rows.slice(0, limit);
  const [names, people] = await Promise.all([agencyNames(page.map((m) => String(m.authorAgencyId))), userNames(page.map((m) => String(m.authorUserId)))]);
  const marker = await CoordinationRead.findOne({ requestId: r._id, userId: oid(w.actor.userId) }).select("lastSeenMessageId").lean();
  return {
    items: page.map((m) => {
      const agencyId = String(m.authorAgencyId);
      const own = w.national || w.scopeIds.has(agencyId);
      return { id: String(m._id), text: m.text, at: iso(m.createdAt), agencyId, agencyName: names.get(agencyId) ?? null, ...(own ? { name: people.get(String(m.authorUserId)) ?? null } : {}), mine: String(m.authorUserId) === w.actor.userId };
    }),
    nextCursor: rows.length > limit ? String(page.at(-1)!._id) : null,
    lastSeenMessageId: marker?.lastSeenMessageId ? String(marker.lastSeenMessageId) : null,
  };
}

// ---------- suggestions and impact preview ----------

async function loadRecord(w: Who, id: string): Promise<RecordPlain | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const rec = (await ConflictRecord.findById(oid(id)).lean()) as unknown as RecordPlain | null;
  return rec && canRead(w, rec) ? rec : null;
}
const nextWorkingDaySlots = (from: Date, n: number): string[] => {
  const out: string[] = [];
  for (let d = 1; out.length < n && d < 14; d += 1) {
    const day = new Date(from.getTime() + d * 86_400_000);
    const dow = new Date(day.getTime() + 5.5 * 3_600_000).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const ymd = new Date(day.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    out.push(new Date(`${ymd}T10:00:00+05:30`).toISOString());
  }
  return out;
};

/** Deterministic FACTS only: no ranking, no AI. Numeric shift advice only for the viewer's own request. */
export async function suggestions(w: Who, conflictId: string) {
  const rec = await loadRecord(w, conflictId);
  if (!rec) return null;
  const cand = await Candidate.findById(rec.candidateId).select("temporal spatial assessment").lean();
  const temporal = (cand?.temporal ?? {}) as { shift?: { a: { daysToClearAfter: number | null; daysToClearBefore: number | null; resolvable: boolean | null }; b: { daysToClearAfter: number | null; daysToClearBefore: number | null; resolvable: boolean | null } } | null; overlapStart?: string | null; overlapEnd?: string | null };
  const side = (k: "a" | "b") => {
    const s = rec.sides[k];
    const type = k === "a" ? rec.aType : rec.bType;
    const id = String(k === "a" ? rec.aId : rec.bId);
    const mine = w.national || w.scopeIds.has(s.agencyId);
    const advice = temporal.shift?.[k] ?? null;
    return { side: k, requestId: type === "work_request" ? id : null, agencyId: s.agencyId, ref: s.ref, mine, shift: type !== "work_request" || !advice ? null : mine ? { daysToClearAfter: advice.daysToClearAfter, daysToClearBefore: advice.daysToClearBefore } : { clearingDateExists: advice.daysToClearAfter !== null || advice.daysToClearBefore !== null } };
  };
  const trench = (cand?.assessment as { estimatedSharedTrenchMeters?: number | null } | undefined)?.estimatedSharedTrenchMeters ?? null;
  return {
    shifts: [side("a"), side("b")],
    jointWorks: rec.recordType === "opportunity" || rec.severity.current.classes.includes("joint_works_opportunity" as never) ? { sharedTrenchMeters: trench, overlap: { start: temporal.overlapStart ?? null, end: temporal.overlapEnd ?? null } } : null,
    sequenceGaps: [7, 14, 30],
    meetingSlots: nextWorkingDaySlots(new Date(), 3),
    today: colomboDay(new Date()),
  };
}

export async function previewImpact(w: Who, body: { conflictId: string; type: ProposalType; proposal: unknown }) {
  const rec = await loadRecord(w, body.conflictId);
  if (!rec) return null;
  const items = await loadItems([{ type: rec.aType, id: String(rec.aId) }, { type: rec.bType, id: String(rec.bId) }]);
  const side = (type: RecordPlain["aType"], id: mongoose.Types.ObjectId, agencyId: string) => { const i = items.get(`${type}:${id}`); return { id: String(id), type, agencyId, start: i?.start ?? null, end: i?.end ?? null, workingHours: i?.workingHours ?? ("day" as const), isEmergency: false }; };
  const a = side(rec.aType, rec.aId, rec.sides.a.agencyId);
  const b = side(rec.bType, rec.bId, rec.sides.b.agencyId);
  const v = validateProposal(body.type, body.proposal, { a, b, recordType: rec.recordType, classes: rec.severity.current.classes, now: new Date() });
  if (!v.ok) return { valid: false as const, code: v.code };
  const subject = [a, b].find((s) => s.type === "work_request" && (w.national || w.scopeIds.has(s.agencyId))) ?? (a.type === "work_request" ? a : b);
  const impact = subject.type === "work_request" ? await computeImpact(subject.id, String(rec.candidateId), v.proposal as Proposal) : ({ applicable: false } as const);
  return { valid: true as const, warnings: v.warnings, before: v.proposal.before, after: v.proposal.after, derived: v.proposal.derived ?? null, impact };
}

export { canReadReq, COORD };
