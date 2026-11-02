import type { Band } from "./assessment";

/** Steps 74-75 read models, exactly as the API sends them. Display text is always composed client-side. */
export type ProposalType = "schedule_shift" | "working_hours" | "joint_works" | "sequence_order" | "traffic_management" | "information_request" | "site_meeting";
export const PROPOSAL_TYPES: ProposalType[] = ["schedule_shift", "working_hours", "joint_works", "sequence_order", "traffic_management", "information_request", "site_meeting"];
export type Stance = "proposer" | "pending" | "accepted" | "conditional" | "countered" | "needs_info" | "declined";
export type Decision = "accepted" | "accepted_with_conditions" | "counter_proposed" | "needs_info" | "declined";
export type CoordStatus = "awaiting_response" | "negotiating" | "agreed" | "no_agreement" | "withdrawn";
export type Action = "respond" | "counter" | "revise" | "confirm_conditions" | "nudge" | "extend_deadline" | "withdraw" | "close_no_agreement" | "escalate" | "deescalate" | "message";
export const CONDITION_CODES = ["night_work_only", "traffic_management_plan", "cost_sharing_agreed", "notice_period_7d", "joint_inspection", "other"] as const;
export const DECLINE_REASONS = ["infeasible_schedule", "budget_constraint", "safety_concern", "technical_constraint", "already_committed", "disagree_with_assessment", "other"] as const;
export const TRAFFIC_MEASURES = ["flaggers", "night_work", "lane_staging", "detour_signage", "temporary_signals", "public_notice"] as const;

export type DeadlineState = { at: string | null; state: "ok" | "soon" | "today" | "overdue" | "closed"; hours: number };
export type ParticipantRow = { agencyId: string; agencyName: string | null; role: "initiator" | "recipient" | "consulted"; required: boolean; stance: Stance };

export type HubRow = {
  id: string; requestNo: string; conflictId: string; conflictNo: string; type: ProposalType; status: CoordStatus; escalated: boolean;
  severity: { band: Band; score: number } | null; round: number; maxRounds: number;
  initiator: { agencyId: string; agencyName: string | null };
  participants: ParticipantRow[];
  myParticipation: { role: "initiator" | "recipient" | "consulted"; required: boolean; stance: Stance; mustRespond: boolean; dueAt: string | null; overdue: boolean } | null;
  deadline: DeadlineState; agreement: { done: number; required: number }; unreadMessages: number; lastActivityAt: string | null; version: number;
};
export type HubList = { items: HubRow[]; total: number; page: number; limit: number };
export type HubSummary = { needsMyResponse: number; overdueForMe: number; awaitingOthers: number; negotiating: number; escalated: number; agreed30d: number; capped: boolean };

export type Proposal = { type: ProposalType; before: Record<string, unknown>; after: Record<string, unknown>; derived?: Record<string, unknown> };
export type Outcome = { riskIndex: number; maxBand: Band | null; conflictCount: number; pairScore: number; pairBand: Band; pairKind: string };
export type Impact = { applicable: false } | { applicable: true; before: Outcome; after: Outcome; verdict: "clears" | "lowers" | "none" | "raises"; proposed: { requestId: string; start: string | null; end: string | null; workingHours: string | null } };
export type Who = { agencyId: string; agencyName: string | null; name?: string | null };
export type ResponseView = Who & { decision: Decision; conditions: { code: string; text?: string }[]; reasonCode: string | null; note: string | null; selectedSlot: string | null; counterRound: number | null; onBehalf: boolean; at: string | null };
export type RoundView = { n: number; proposal: Proposal; note: string | null; createdAt: string | null; impact: Impact | null; proposedBy: Who; responses: ResponseView[] };
export type RoomEvent = { id: string; at: string; type: string; data: Record<string, unknown>; actor: { kind: "system" } | { kind: "user"; agencyId: string | null; agencyName: string | null; name?: string | null } };

export type Room = {
  id: string; requestNo: string; conflictId: string; conflictNo: string; type: ProposalType; summary: string; status: CoordStatus;
  escalated: { at: string | null; reason: string } | null; severity: { conflictNo: string; band: Band; score: number } | null;
  round: number; maxRounds: number; version: number; createdAt: string | null; closedAt: string | null; warnings: string[];
  initiator: Who; deadline: DeadlineState; extensions: { round: number; days: number }[];
  participants: (ParticipantRow & { lastDecisionAt: string | null; dueAt: string | null; mine: boolean })[];
  rounds: RoundView[];
  agreedTerms: { round: number; proposal: Proposal; conditions: { agencyId: string; agencyName: string | null; code: string; text?: string }[]; acceptedBy: { agencyId: string; agencyName: string | null; at: string | null }[]; agreedAt: string | null; ruleSnapshot: { severityAtAgreement: { score: number; band: string } } } | null;
  allowedActions: Action[]; myParticipation: { role: string; required: boolean; stance: Stance } | null;
  nudges: { at: string | null; agencyName: string | null }[]; events: RoomEvent[];
  diffSinceLastSeen: { newRounds: number; newResponses: number; newMessages: number } | null;
};
export type Message = { id: string; text: string; at: string | null; agencyId: string; agencyName: string | null; name?: string | null; mine: boolean };
export type MessagePage = { items: Message[]; nextCursor: string | null; lastSeenMessageId: string | null };
export type Suggestions = {
  shifts: { side: "a" | "b"; requestId: string | null; agencyId: string; ref: string; mine: boolean; shift: { daysToClearAfter: number | null; daysToClearBefore: number | null } | { clearingDateExists: boolean } | null }[];
  jointWorks: { sharedTrenchMeters: number | null; overlap: { start: string | null; end: string | null } } | null;
  sequenceGaps: number[]; meetingSlots: string[]; today: number;
};
export type PreviewOut = { valid: true; warnings: string[]; before: Record<string, unknown>; after: Record<string, unknown>; derived: Record<string, unknown> | null; impact: Impact };
export type ConflictCoordination = { coordination: { activeCount: number; agreedCount: number; noAgreementCount: number; lastActivityAt: string | null; state: "none" | "awaiting_response" | "negotiating" | "escalated" | "agreed" }; items: HubRow[] };

// ---------- pure helpers ----------

export const TERMINAL: CoordStatus[] = ["agreed", "no_agreement", "withdrawn"];
export const isActive = (s: CoordStatus) => !TERMINAL.includes(s);
export const DAY = 86_400_000;
export const dayDelta = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);
export const initialsOf = (name: string | null) => (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Deadline clock state from the absolute deadline, computed client-side so it keeps ticking. */
export function clockState(at: string | null, closed: boolean, now: number): { kind: "closed" | "ok" | "today" | "overdue"; days: number; hours: number } {
  if (closed || !at) return { kind: "closed", days: 0, hours: 0 };
  const diff = new Date(at).getTime() - now;
  if (diff < 0) return { kind: "overdue", days: Math.floor(-diff / DAY), hours: Math.ceil(-diff / 3_600_000) };
  const hours = Math.ceil(diff / 3_600_000);
  return hours <= 12 ? { kind: "today", days: 0, hours } : { kind: "ok", days: Math.floor(hours / 24), hours: hours % 24 };
}

export const HUB_PRESET: Record<string, Record<string, string>> = {
  needs: { needsMyResponse: "true" }, sent: { role: "initiator" }, all: {}, overdue: { overdue: "true" }, awaiting: { role: "initiator", status: "awaiting_response,negotiating" },
  negotiating: { status: "negotiating" }, escalated: { escalated: "true" }, agreed: { status: "agreed" },
};
export function hubQuery(params: URLSearchParams, page: number, limit: number): string {
  const out = new URLSearchParams();
  const preset = params.get("preset");
  for (const [k, v] of Object.entries(preset && preset in HUB_PRESET ? HUB_PRESET[preset]! : HUB_PRESET.all!)) out.set(k, v);
  for (const k of ["status", "type", "q", "conflictId", "overdue", "escalated", "needsMyResponse", "role", "sort"]) { const v = params.get(k); if (v) out.set(k, v); }
  out.set("page", String(page));
  out.set("limit", String(limit));
  return out.toString();
}

export type DiffLine = { key: string; label: string; before: string | null; after: string | null; text: string };
/** Plain-data before/after lines for the Proposal Diff; the copy layer turns them into sentences. */
export function diffLines(p: Proposal): { field: string; before: unknown; after: unknown; deltaDays?: number }[] {
  const b = p.before;
  const a = p.after;
  const d = p.derived;
  if (p.type === "schedule_shift") return [
    { field: "start", before: b.start, after: a.start, deltaDays: b.start && a.start ? dayDelta(String(b.start), String(a.start)) : undefined },
    { field: "end", before: b.end, after: a.end, deltaDays: b.end && a.end ? dayDelta(String(b.end), String(a.end)) : undefined },
  ];
  if (p.type === "working_hours") return [{ field: "workingHours", before: b.workingHours, after: a.workingHours }];
  if (p.type === "sequence_order") return [{ field: "secondStart", before: b.secondStart, after: d?.newStart, deltaDays: b.secondStart && d?.newStart ? dayDelta(String(b.secondStart), String(d.newStart)) : undefined }, { field: "minGapDays", before: null, after: a.minGapDays }];
  if (p.type === "joint_works") return [{ field: "jointStart", before: null, after: a.start }, { field: "jointEnd", before: null, after: a.end }, { field: "leadAgency", before: null, after: a.leadAgencyId }];
  if (p.type === "traffic_management") return [{ field: "measures", before: null, after: a.measures }];
  if (p.type === "information_request") return [{ field: "questions", before: null, after: a.questions }];
  return [{ field: "slots", before: null, after: a.slots }, { field: "mode", before: null, after: a.mode }];
}
