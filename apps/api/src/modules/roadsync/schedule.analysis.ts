/**
 * Step 69 pure schedule analysis. Days are inclusive, DATE-ONLY and evaluated in Asia/Colombo
 * (UTC+05:30, no DST) through the single `colomboDay` helper.
 */
import { DETECTION } from "./roadsync.constants.js";

export type WorkingHours = "day" | "night" | "24h";
export type ScheduleSide = { start: Date; end: Date; workingHours: WorkingHours; flexibleDays: number; isEmergency: boolean };
export type TemporalRelation = "identical" | "contained" | "partial_overlap" | "adjacent" | "none" | "permanent" | "unknown";
export type ShiftAdvice = { daysToClearAfter: number | null; daysToClearBefore: number | null; effectiveFlex: number; resolvable: boolean | null };
export type TemporalResult = {
  applicable: boolean;
  relation: TemporalRelation;
  /** The side that fully contains the other when relation is "contained". */
  containedBy: "a" | "b" | null;
  overlapDays: number;
  overlapStart: string | null;
  overlapEnd: string | null;
  gapDays: number;
  overlapPctOfA: number | null;
  overlapPctOfB: number | null;
  hoursCompatibility: "same_shift" | "different_shifts" | "overlaps_24h" | null;
  shift: { a: ShiftAdvice; b: ShiftAdvice } | null;
  /** Step 70: set by detection, not by analyzeSchedules. Surface work first, invasive work later, within the sequence window. */
  sequenceRisk?: { direction: "a_then_b" | "b_then_a"; gapDays: number } | null;
};

const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Integer day number of an instant on the Asia/Colombo calendar. */
export function colomboDay(value: Date): number {
  return Math.floor((value.getTime() + COLOMBO_OFFSET_MS) / DAY_MS);
}
export function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function notApplicable(relation: "permanent" | "unknown"): TemporalResult {
  return { applicable: false, relation, containedBy: null, overlapDays: 0, overlapStart: null, overlapEnd: null, gapDays: 0, overlapPctOfA: null, overlapPctOfB: null, hoursCompatibility: null, shift: null };
}

const pct = (n: number) => Math.round(n * 100) / 100;

export function analyzeSchedules(a: ScheduleSide, b: ScheduleSide): TemporalResult {
  const [sa, ea, sb, eb] = [colomboDay(a.start), colomboDay(a.end), colomboDay(b.start), colomboDay(b.end)];
  if (![sa, ea, sb, eb].every(Number.isFinite) || ea < sa || eb < sb) return notApplicable("unknown");
  const lenA = ea - sa + 1;
  const lenB = eb - sb + 1;
  const oStart = Math.max(sa, sb);
  const oEnd = Math.min(ea, eb);
  const overlapDays = Math.max(0, oEnd - oStart + 1);
  const gapDays = overlapDays > 0 ? 0 : Math.max(sa, sb) - Math.min(ea, eb);

  let relation: TemporalRelation;
  let containedBy: "a" | "b" | null = null;
  if (overlapDays === 0) relation = gapDays <= DETECTION.ADJACENT_WINDOW_DAYS ? "adjacent" : "none";
  else if (sa === sb && ea === eb) relation = "identical";
  else if (sa <= sb && ea >= eb) {
    relation = "contained";
    containedBy = "a";
  } else if (sb <= sa && eb >= ea) {
    relation = "contained";
    containedBy = "b";
  } else relation = "partial_overlap";

  const hoursCompatibility = a.workingHours === "24h" || b.workingHours === "24h" ? "overlaps_24h" : a.workingHours === b.workingHours ? "same_shift" : "different_shifts";
  const advice = (self: { s: number; e: number; flex: number; emergency: boolean }, other: { s: number; e: number }): ShiftAdvice => {
    const effectiveFlex = self.emergency ? 0 : Math.max(0, self.flex);
    if (overlapDays === 0) return { daysToClearAfter: null, daysToClearBefore: null, effectiveFlex, resolvable: null };
    const after = other.e + 1 - self.s;
    const before = self.e - (other.s - 1);
    return { daysToClearAfter: after, daysToClearBefore: before, effectiveFlex, resolvable: Math.min(after, before) <= effectiveFlex };
  };
  return {
    applicable: true,
    relation,
    containedBy,
    overlapDays,
    overlapStart: overlapDays ? dayToIso(oStart) : null,
    overlapEnd: overlapDays ? dayToIso(oEnd) : null,
    gapDays,
    overlapPctOfA: pct(overlapDays / lenA),
    overlapPctOfB: pct(overlapDays / lenB),
    hoursCompatibility,
    shift: {
      a: advice({ s: sa, e: ea, flex: a.flexibleDays, emergency: a.isEmergency }, { s: sb, e: eb }),
      b: advice({ s: sb, e: eb, flex: b.flexibleDays, emergency: b.isEmergency }, { s: sa, e: ea }),
    },
  };
}

export const TIMED_RELATIONS: TemporalRelation[] = ["identical", "contained", "partial_overlap", "adjacent"];
