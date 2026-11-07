import { CONDITION_STEP, type KNOWN_CONDITIONS } from "./asset.constants.js";

/**
 * Condition monitoring rules (version k1). Pure and explainable: every flag carries its inputs.
 * Maintenance never appears here: condition changes only through an assessment.
 */
export const CONDITION_RULES_VERSION = "k1";
export const DUE_SOON_RATIO = 0.85;
export const MIN_SPAN_DAYS_FOR_RATE = 180;
const DAY = 86_400_000;

type Known = (typeof KNOWN_CONDITIONS)[number];
export type AssessmentFacts = { condition: Known; assessedAt: Date; issues: { key: string; severity: string; status: string }[] };
export type Trend = "DETERIORATING" | "IMPROVING" | "STABLE" | "INSUFFICIENT_HISTORY";

export type ConditionFlag = { code: "CONDITION_CRITICAL" | "OPEN_CRITICAL_ISSUE" | "ASSESSMENT_OVERDUE" | "ASSESSMENT_DUE_SOON" | "NO_ASSESSMENT_RECORDED" | "WITHIN_DEFECTS_LIABILITY" | "DLP_DETERIORATION" | "OUT_OF_SERVICE"; severity: "INFO" | "LOW" | "MEDIUM" | "HIGH"; params: Record<string, string | number> };

/** Trend over the last up-to-three assessments (newest first in, oldest to newest inside). */
export function trendOf(newestFirst: AssessmentFacts[]): Trend {
  if (newestFirst.length < 2) return "INSUFFICIENT_HISTORY";
  const last3 = newestFirst.slice(0, 3).reverse().map((a) => CONDITION_STEP[a.condition]);
  const last = last3[last3.length - 1]!;
  const prev = last3[last3.length - 2]!;
  if (last - prev <= -1 || (last3.length === 3 && last3[0]! - last >= 2)) return "DETERIORATING";
  if (last - prev >= 1 || (last3.length === 3 && last - last3[0]! >= 2)) return "IMPROVING";
  return "STABLE";
}

/** Steps lost per year, shown only with at least three assessments spanning at least 180 days. Positive means decline. */
export function declinePerYear(newestFirst: AssessmentFacts[]): number | null {
  if (newestFirst.length < 3) return null;
  const oldest = newestFirst[newestFirst.length - 1]!;
  const newest = newestFirst[0]!;
  const span = (newest.assessedAt.getTime() - oldest.assessedAt.getTime()) / DAY;
  if (span < MIN_SPAN_DAYS_FOR_RATE) return null;
  const steps = CONDITION_STEP[oldest.condition] - CONDITION_STEP[newest.condition];
  return Math.round((steps / (span / 365)) * 10) / 10;
}

export type ConditionInput = {
  now: Date; intervalDays: number; operationalStatus: string;
  assessments: AssessmentFacts[]; // ACTIVE, newest first
  defectsLiabilityEndsOn?: Date | null; handoverAt?: Date | null;
};

export function evaluateCondition(i: ConditionInput) {
  const latest = i.assessments[0];
  const flags: ConditionFlag[] = [];
  const interval = i.intervalDays * DAY;
  if (!latest) flags.push({ code: "NO_ASSESSMENT_RECORDED", severity: "MEDIUM", params: { intervalDays: i.intervalDays } });
  else {
    const age = i.now.getTime() - latest.assessedAt.getTime();
    const ratio = age / interval;
    if (ratio > 1) flags.push({ code: "ASSESSMENT_OVERDUE", severity: ratio > 2 ? "HIGH" : "MEDIUM", params: { ageDays: Math.floor(age / DAY), intervalDays: i.intervalDays } });
    else if (ratio >= DUE_SOON_RATIO) flags.push({ code: "ASSESSMENT_DUE_SOON", severity: "LOW", params: { ageDays: Math.floor(age / DAY), intervalDays: i.intervalDays } });
    if (latest.condition === "CRITICAL") flags.push({ code: "CONDITION_CRITICAL", severity: "HIGH", params: {} });
    const openCritical = latest.issues.filter((x) => x.status === "OPEN" && x.severity === "CRITICAL").length;
    if (openCritical) flags.push({ code: "OPEN_CRITICAL_ISSUE", severity: "HIGH", params: { count: openCritical } });
  }
  const trend = trendOf(i.assessments);
  const dlp = i.defectsLiabilityEndsOn ?? null;
  if (dlp && i.now.getTime() <= dlp.getTime()) {
    flags.push({ code: "WITHIN_DEFECTS_LIABILITY", severity: "INFO", params: { endsOn: dlp.toISOString().slice(0, 10) } });
    // Defects Liability Watch: a drop recorded while the period was still running.
    const prev = i.assessments[1];
    if (latest && prev && latest.assessedAt.getTime() <= dlp.getTime() && CONDITION_STEP[latest.condition] < CONDITION_STEP[prev.condition]) flags.push({ code: "DLP_DETERIORATION", severity: "HIGH", params: { endsOn: dlp.toISOString().slice(0, 10), from: prev.condition, to: latest.condition } });
  }
  if (i.operationalStatus === "OUT_OF_SERVICE") flags.push({ code: "OUT_OF_SERVICE", severity: "MEDIUM", params: {} });
  return { version: CONDITION_RULES_VERSION, trend, declinePerYear: declinePerYear(i.assessments), flags };
}
