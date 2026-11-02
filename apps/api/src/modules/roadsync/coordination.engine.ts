/**
 * Steps 74-75 pure negotiation engine: proposal validation, derived status, round mechanics and the single
 * `allowedActions` function. No I/O and no clocks (callers pass `now`).
 */
import { z } from "zod";

import { COMPATIBLE_GROUP, COORD, CONDITION_CODES, DECISIONS, STANCE_OF, TRAFFIC_MEASURES, type Decision, type ProposalType, type RequestStatus, type Stance } from "./coordination.rules.js";
import { colomboDay } from "./schedule.analysis.js";

const DAY = 86_400_000;
const iso = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().max(max).refine((v) => ![...v].some((c) => (c.charCodeAt(0) <= 31 && c !== "\n") || c.charCodeAt(0) === 127), "unsafe text");
const oid = z.string().regex(/^[a-f0-9]{24}$/i);

// ---------- proposal schemas (strict: unknown keys rejected) ----------

const shape = {
  schedule_shift: z.object({ targetRequestId: oid, newStart: iso, newEnd: iso, changeDuration: z.boolean().optional() }).strict(),
  working_hours: z.object({ targetRequestId: oid, workingHours: z.enum(["day", "night", "24h"]) }).strict(),
  joint_works: z.object({ leadAgencyId: oid, proposedStart: iso, proposedEnd: iso, scopeNote: text(300) }).strict(),
  sequence_order: z.object({ firstRequestId: oid, minGapDays: z.number().int().min(0).max(60) }).strict(),
  traffic_management: z.object({ measures: z.array(z.enum(TRAFFIC_MEASURES)).min(1).max(TRAFFIC_MEASURES.length), notes: text(300).optional() }).strict(),
  information_request: z.object({ questions: z.array(text(200).pipe(z.string().min(1))).min(1).max(5) }).strict(),
  site_meeting: z.object({ mode: z.enum(["onsite", "online"]), locationText: text(150), slots: z.array(iso).min(1).max(COORD.SLOTS_MAX) }).strict(),
} as const;

export type SideCtx = { id: string; type: "work_request" | "project" | "asset"; agencyId: string; start: Date | null; end: Date | null; workingHours: "day" | "night" | "24h"; isEmergency: boolean };
export type ValidateCtx = { a: SideCtx; b: SideCtx; recordType: "conflict" | "opportunity"; classes: string[]; now: Date };
export type Proposal = { type: ProposalType; before: Record<string, unknown>; after: Record<string, unknown>; derived?: Record<string, unknown> };
export type Validation = { ok: true; proposal: Proposal; warnings: string[] } | { ok: false; code: string };

const fail = (code: string): Validation => ({ ok: false, code });
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

export function validateProposal(type: ProposalType, raw: unknown, ctx: ValidateCtx): Validation {
  const parsed = shape[type].safeParse(raw);
  if (!parsed.success) return fail("invalid_proposal");
  const p = parsed.data as Record<string, unknown>;
  const side = (id: unknown) => [ctx.a, ctx.b].find((s) => s.id === id && s.type === "work_request");
  const warnings: string[] = [];
  const scheduled = (s: SideCtx) => s.start && s.end;

  if (type === "schedule_shift") {
    const t = side(p.targetRequestId);
    if (!t || !scheduled(t)) return fail("target_not_in_pair");
    const ns = new Date(p.newStart as string);
    const ne = new Date(p.newEnd as string);
    if (ne < ns) return fail("end_before_start");
    const newLen = days(ns, ne);
    const oldLen = days(t.start!, t.end!);
    if (newLen > COORD.MAX_DURATION_DAYS) return fail("duration_too_long");
    if (!t.isEmergency && colomboDay(ns) < colomboDay(ctx.now)) return fail("start_in_past");
    if (Math.abs(days(t.start!, ns)) > COORD.SHIFT_LIMIT_DAYS) return fail("shift_too_large");
    if (p.changeDuration) {
      if (oldLen > 0 && Math.abs(newLen - oldLen) / oldLen > COORD.DURATION_CHANGE_PCT / 100) return fail("duration_change_too_large");
    } else if (newLen !== oldLen) return fail("duration_changed");
    return { ok: true, warnings, proposal: { type, before: { targetRequestId: t.id, start: t.start!.toISOString(), end: t.end!.toISOString() }, after: { targetRequestId: t.id, start: ns.toISOString(), end: ne.toISOString(), shiftDays: days(t.start!, ns) } } };
  }
  if (type === "working_hours") {
    const t = side(p.targetRequestId);
    if (!t) return fail("target_not_in_pair");
    if (t.workingHours === p.workingHours) return fail("no_change");
    return { ok: true, warnings, proposal: { type, before: { targetRequestId: t.id, workingHours: t.workingHours }, after: { targetRequestId: t.id, workingHours: p.workingHours } } };
  }
  if (type === "joint_works") {
    if (ctx.recordType !== "opportunity" && !ctx.classes.includes("joint_works_opportunity")) return fail("not_an_opportunity");
    const s = new Date(p.proposedStart as string);
    const e = new Date(p.proposedEnd as string);
    if (e < s) return fail("end_before_start");
    if (days(s, e) > COORD.MAX_DURATION_DAYS) return fail("duration_too_long");
    return { ok: true, warnings, proposal: { type, before: { a: ctx.a.start && ctx.a.end ? { start: ctx.a.start.toISOString(), end: ctx.a.end.toISOString() } : null, b: ctx.b.start && ctx.b.end ? { start: ctx.b.start.toISOString(), end: ctx.b.end.toISOString() } : null }, after: { leadAgencyId: p.leadAgencyId, start: s.toISOString(), end: e.toISOString(), scopeNote: p.scopeNote } } };
  }
  if (type === "sequence_order") {
    const first = side(p.firstRequestId);
    const second = first ? (first.id === ctx.a.id ? ctx.b : ctx.a) : null;
    if (!first || !second || second.type !== "work_request" || !scheduled(first) || !scheduled(second)) return fail("target_not_in_pair");
    const gap = p.minGapDays as number;
    const len = days(second.start!, second.end!);
    const newStart = addDays(first.end!, gap + 1);
    // Implied dates are derived here and never trusted from the client.
    return { ok: true, warnings, proposal: { type, before: { firstRequestId: first.id, secondRequestId: second.id, secondStart: second.start!.toISOString(), secondEnd: second.end!.toISOString() }, after: { firstRequestId: first.id, minGapDays: gap }, derived: { secondRequestId: second.id, newStart: newStart.toISOString(), newEnd: addDays(newStart, len).toISOString(), shiftDays: days(second.start!, newStart) } } };
  }
  if (type === "traffic_management") {
    const m = p.measures as string[];
    if (new Set(m).size !== m.length) return fail("duplicate_measures");
    return { ok: true, warnings, proposal: { type, before: {}, after: { measures: m, notes: p.notes ?? null } } };
  }
  if (type === "information_request") return { ok: true, warnings, proposal: { type, before: {}, after: { questions: p.questions } } };
  const slots = (p.slots as string[]).map((s) => new Date(s));
  if (new Set(slots.map((s) => s.getTime())).size !== slots.length) return fail("duplicate_slots");
  if (slots.some((s) => s.getTime() < ctx.now.getTime() + 24 * 3_600_000)) return fail("slot_too_soon");
  return { ok: true, warnings, proposal: { type, before: {}, after: { mode: p.mode, locationText: p.locationText, slots: slots.map((s) => s.toISOString()).sort() } } };
}

/** The shifted schedules a proposal implies, used by the impact preview. Null for non-schedule proposals. */
export function scheduleOverrides(p: Proposal): { requestId: string; start?: Date; end?: Date; workingHours?: "day" | "night" | "24h" } | null {
  if (p.type === "schedule_shift") return { requestId: String(p.after.targetRequestId), start: new Date(p.after.start as string), end: new Date(p.after.end as string) };
  if (p.type === "working_hours") return { requestId: String(p.after.targetRequestId), workingHours: p.after.workingHours as "day" | "night" | "24h" };
  if (p.type === "sequence_order" && p.derived) return { requestId: String(p.derived.secondRequestId), start: new Date(p.derived.newStart as string), end: new Date(p.derived.newEnd as string) };
  return null;
}

export const compatibleTypes = (from: ProposalType, to: ProposalType) => from === to || (COMPATIBLE_GROUP.includes(from) && COMPATIBLE_GROUP.includes(to));

// ---------- request state ----------

export type Participant = { agencyId: string; role: "initiator" | "recipient" | "consulted"; required: boolean; stance: Stance; lastDecisionAt: Date | null; dueAt: Date | null };
export type Response = { agencyId: string; userId: string; onBehalf?: { by: string; reason: string } | null; decision: Decision; conditions: { code: string; text?: string }[]; reasonCode: string | null; note: string | null; selectedSlot: string | null; counterRound: number | null; at: Date };
export type Round = { n: number; proposal: Proposal; proposedBy: { agencyId: string; userId: string }; note: string | null; createdAt: Date; responses: Response[]; impact: unknown | null };
export type ReqState = { status: RequestStatus; escalated: boolean; currentRound: number; maxRounds: number; participants: Participant[]; rounds: Round[]; nudges: { at: Date; by: string; agencyId: string }[]; deadlineAt: Date; initiator: { agencyId: string }; extendedRounds?: number[] };
export const isTerminal = (s: RequestStatus) => s === "agreed" || s === "no_agreement" || s === "withdrawn";

/** Status is DERIVED from the current round's stances. Consulted agencies never block; conditional blocks until confirmed. */
export function deriveStatus(participants: Participant[], round = 1): "awaiting_response" | "negotiating" | "agreed" {
  const required = participants.filter((p) => p.required && p.stance !== "proposer" && p.role !== "consulted");
  if (required.length && required.every((p) => p.stance === "accepted")) return "agreed";
  if (required.some((p) => ["conditional", "countered", "needs_info", "declined"].includes(p.stance)) || round > 1) return "negotiating";
  return "awaiting_response";
}

export const proposerOf = (r: Pick<ReqState, "participants">) => r.participants.find((p) => p.stance === "proposer") ?? null;

export type EngineError = "not_participant" | "own_round" | "wrong_round" | "terminal" | "counter_not_allowed" | "max_rounds" | "incompatible_type" | "not_proposer" | "invalid_decision" | "nothing_to_confirm";

/** Records (or replaces) one agency's decision in the CURRENT round. Returns the derived status. */
export function applyDecision(r: ReqState, response: Response): EngineError | "ok" {
  if (isTerminal(r.status)) return "terminal";
  const part = r.participants.find((p) => p.agencyId === response.agencyId);
  if (!part) return "not_participant";
  if (part.stance === "proposer") return "own_round";
  if (response.decision === "counter_proposed" && part.role === "consulted") return "counter_not_allowed";
  const round = r.rounds[r.currentRound - 1]!;
  round.responses = [...round.responses.filter((x) => x.agencyId !== response.agencyId), response];
  part.stance = STANCE_OF[response.decision];
  part.lastDecisionAt = response.at;
  r.status = deriveStatus(r.participants, r.currentRound);
  return "ok";
}

/** Counter (by a recipient) and revise (by the proposer) both open round n+1 with everyone else reset to pending. */
export function openNextRound(r: ReqState, by: { agencyId: string; userId: string }, proposal: Proposal, note: string | null, now: Date): EngineError | "ok" {
  if (isTerminal(r.status)) return "terminal";
  if (r.currentRound + 1 > r.maxRounds) return "max_rounds";
  const prev = r.rounds[r.currentRound - 1]!;
  if (!compatibleTypes(prev.proposal.type, proposal.type)) return "incompatible_type";
  for (const p of r.participants) p.stance = p.agencyId === by.agencyId ? "proposer" : "pending";
  r.currentRound += 1;
  r.rounds.push({ n: r.currentRound, proposal, proposedBy: by, note, createdAt: now, responses: [], impact: null });
  r.status = "negotiating"; // a request past round 1 is, by definition, being negotiated
  return "ok";
}

/** The proposer confirms conditional agencies; confirmed agencies become accepted and may complete agreement. */
export function confirmConditions(r: ReqState, agencyIds: string[] | "all", now: Date): EngineError | "ok" {
  if (isTerminal(r.status)) return "terminal";
  const targets = r.participants.filter((p) => p.stance === "conditional" && (agencyIds === "all" || agencyIds.includes(p.agencyId)));
  if (!targets.length) return "nothing_to_confirm";
  for (const p of targets) { p.stance = "accepted"; p.lastDecisionAt = now; }
  r.status = deriveStatus(r.participants, r.currentRound);
  return "ok";
}

// ---------- allowed actions ----------

export type Viewer = { agencyId: string | null; national: boolean; canWrite: boolean; isParticipant: boolean; now: Date };
export type Action = "respond" | "counter" | "revise" | "confirm_conditions" | "nudge" | "extend_deadline" | "withdraw" | "close_no_agreement" | "escalate" | "deescalate" | "message";

export function allowedActions(r: ReqState & { escalated: boolean }, v: Viewer): Action[] {
  if (!v.isParticipant && !v.national) return [];
  const out: Action[] = [];
  const terminal = isTerminal(r.status);
  const me = v.agencyId ? r.participants.find((p) => p.agencyId === v.agencyId) : undefined;
  const proposer = proposerOf(r);
  const iAmProposer = Boolean(me && proposer && me.agencyId === proposer.agencyId);
  const write = v.canWrite;
  if (!terminal) {
    if (write && me && !iAmProposer) {
      out.push("respond");
      if (me.role !== "consulted" && r.currentRound < r.maxRounds) out.push("counter");
    }
    if (write && iAmProposer) {
      if (r.currentRound < r.maxRounds) out.push("revise");
      if (r.participants.some((p) => p.stance === "conditional")) out.push("confirm_conditions");
      const pending = r.participants.some((p) => p.required && p.stance === "pending");
      const last = r.nudges.at(-1);
      const cooled = !last || v.now.getTime() - last.at.getTime() >= COORD.NUDGE_COOLDOWN_HOURS * 3_600_000;
      if (pending && cooled && r.nudges.length < COORD.NUDGES_MAX) out.push("nudge");
      out.push("extend_deadline", "close_no_agreement");
    }
    if ((write && me?.agencyId === r.initiator.agencyId) || v.national) out.push("withdraw");
    if (v.national && !iAmProposer) out.push("close_no_agreement");
    if (v.national) out.push(r.escalated ? "deescalate" : "escalate");
    out.push("message");
  } else if (v.national) out.push("message");
  return [...new Set(out)];
}

/** Derived deadline state; there is no cron. */
export function deadlineState(deadlineAt: Date, status: RequestStatus, now: Date): { state: "ok" | "soon" | "today" | "overdue" | "closed"; hours: number } {
  if (isTerminal(status)) return { state: "closed", hours: 0 };
  const hours = Math.ceil((deadlineAt.getTime() - now.getTime()) / 3_600_000);
  return { state: hours < 0 ? "overdue" : hours <= 12 ? "today" : hours <= 48 ? "soon" : "ok", hours };
}

export { CONDITION_CODES, DECISIONS };
