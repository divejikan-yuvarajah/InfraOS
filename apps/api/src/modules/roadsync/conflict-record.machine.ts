/**
 * Step 73 record state machine. Pure: no I/O, no clocks (callers pass `now`).
 * Implemented: open, acknowledged, dismissed, auto_closed. Every other enum value is reserved for
 * Steps 74-77 and has NO transition here, so adding them means adding rows to TRANSITIONS.
 */
import { BAND_CODES, type Band } from "./assessment.rules.js";
import { ACK_DRIVEN, ACK_SLA_HOURS, OPEN_LIKE, RECORD, type EventType, type RecordStatus } from "./conflict-record.rules.js";

export type AckEntry = { agencyId: string; required: boolean; active: boolean; excluded: unknown | null; ack: { status: "pending" | "acknowledged" } };

export type UserAction = "dismiss" | "reopen";
/** The data-driven transition table. Steps 74-77 extend it; nothing else changes. */
export const TRANSITIONS: Record<UserAction, { from: readonly RecordStatus[]; to: RecordStatus; nationalOnly: boolean }> = {
  dismiss: { from: OPEN_LIKE, to: "dismissed", nationalOnly: true },
  reopen: { from: ["dismissed", "auto_closed"], to: "open", nationalOnly: true },
};

export type GuardResult = { ok: true; to: RecordStatus } | { ok: false; code: "forbidden" | "invalid_transition" | "pair_inactive" };

export function guardAction(action: UserAction, from: RecordStatus, opts: { national: boolean; pairActive: boolean }): GuardResult {
  const rule = TRANSITIONS[action];
  if (rule.nationalOnly && !opts.national) return { ok: false, code: "forbidden" };
  if (!rule.from.includes(from)) return { ok: false, code: "invalid_transition" };
  if (action === "reopen" && from === "auto_closed" && !opts.pairActive) return { ok: false, code: "pair_inactive" };
  return { ok: true, to: rule.to };
}

const counts = (e: AckEntry) => e.active && !e.excluded;

/** True when at least one required agency exists and every active, non-excluded required agency has acknowledged. */
export function allRequiredAcked(agencies: AckEntry[]): boolean {
  const required = agencies.filter((a) => counts(a) && a.required);
  return required.length > 0 && required.every((a) => a.ack.status === "acknowledged");
}
export const hasAnyAck = (agencies: AckEntry[]) => agencies.some((a) => counts(a) && a.ack.status === "acknowledged");

/** open <-> acknowledged is automatic and derived from the acknowledgements; other statuses are untouched. */
export function syncAck(status: RecordStatus, agencies: AckEntry[]): RecordStatus {
  if (!ACK_DRIVEN.includes(status)) return status;
  return allRequiredAcked(agencies) ? "acknowledged" : "open";
}

export const bandRank = (band: Band) => BAND_CODES.indexOf(band);

export type ReconcileInput = {
  status: RecordStatus;
  belowThreshold: boolean;
  qualifies: boolean;
  pairActive: boolean;
  band: Band;
  dismissedBand: Band | null;
  agencies: AckEntry[];
};
export type ReconcileResult = {
  status: RecordStatus;
  belowThreshold: boolean;
  event: Extract<EventType, "auto_closed" | "redetected" | "reopened"> | null;
  reason: "pair_inactive" | "below_threshold" | "severity_increased" | null;
};

/** System-driven decisions after an assessment or a source cancellation. */
export function reconcile(i: ReconcileInput): ReconcileResult {
  const keep = (status: RecordStatus, belowThreshold = i.belowThreshold): ReconcileResult => ({ status, belowThreshold, event: null, reason: null });
  if (OPEN_LIKE.includes(i.status)) {
    if (!i.pairActive) return { status: "auto_closed", belowThreshold: i.belowThreshold, event: "auto_closed", reason: "pair_inactive" };
    if (!i.qualifies) {
      if (!hasAnyAck(i.agencies)) return { status: "auto_closed", belowThreshold: true, event: "auto_closed", reason: "below_threshold" };
      return keep(syncAck(i.status, i.agencies), true);
    }
    return keep(syncAck(i.status, i.agencies), false);
  }
  if (i.status === "dismissed") {
    const raised = i.dismissedBand !== null && bandRank(i.band) >= bandRank(i.dismissedBand) + RECORD.DISMISS_REOPEN_BAND_STEPS;
    if (i.pairActive && i.qualifies && raised) return { status: syncAck("open", i.agencies), belowThreshold: false, event: "reopened", reason: "severity_increased" };
    return keep("dismissed");
  }
  if (i.status === "auto_closed" && i.pairActive && i.qualifies) return { status: syncAck("open", i.agencies), belowThreshold: false, event: "redetected", reason: null };
  return keep(i.status);
}

export type HistoryPoint = { at: Date; score: number; band: Band; ruleVersion: string; reason: "detected" | "reassessed" | "override" | "override_cleared" };

/** Append only on a band change or a score move of at least HISTORY_MIN_SCORE_DELTA; capped, oldest dropped. */
export function appendHistory(history: HistoryPoint[], next: HistoryPoint): { history: HistoryPoint[]; changed: boolean } {
  const last = history.at(-1);
  const changed = !last || last.band !== next.band || Math.abs(last.score - next.score) >= RECORD.HISTORY_MIN_SCORE_DELTA;
  if (!changed) return { history, changed: false };
  return { history: [...history, next].slice(-RECORD.HISTORY_MAX), changed: true };
}

/** Due time = start + band SLA. Once set it only tightens (earlier of old and new) when called on escalation. */
export function ackDueAt(from: Date, band: Band, existing: Date | null): Date {
  const fresh = new Date(from.getTime() + ACK_SLA_HOURS[band] * 3_600_000);
  return existing && existing.getTime() <= fresh.getTime() ? existing : fresh;
}

const KEEP_ALWAYS = new Set<EventType>(["detected", "dismissed", "reopened", "auto_closed", "redetected", "lead_set"]);
export function trimEvents<T extends { type: EventType }>(events: T[], max: number = RECORD.EVENTS_MAX): T[] {
  let over = events.length - max;
  if (over <= 0) return events;
  const out: T[] = [];
  for (const e of events) {
    if (over > 0 && !KEEP_ALWAYS.has(e.type)) over -= 1;
    else out.push(e);
  }
  return out.length > max ? out.slice(out.length - max) : out;
}
