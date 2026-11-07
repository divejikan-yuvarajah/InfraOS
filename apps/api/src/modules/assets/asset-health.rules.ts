import { CONDITION_SCORE, KNOWN_CONDITIONS } from "./asset.constants.js";

/**
 * Infrastructure health indicator (version h1). Transparent, rule-based and evidence-gated.
 * A number exists ONLY when the condition component is available (a recent enough assessment). Otherwise: no score, no band.
 * Maintenance never adds points; completed work only removes a prior penalty because it is no longer overdue.
 * Every threshold lives in this one block.
 */
export const HEALTH_RULES_VERSION = "h1";
export const HEALTH = {
  weights: { condition: 45, openIssues: 20, maintenance: 20, assessmentTimeliness: 10, hazardExposure: 5 },
  staleMultiplier: 2,        // an assessment older than 2x the interval makes the condition component unavailable
  ageAdjustAfter: 1,         // older than 1x the interval: subtract ageAdjustPoints
  ageAdjustPoints: 10,
  issuePenalty: { CRITICAL: 40, MAJOR: 20, MINOR: 5 },
  maintenancePenalty: { overdueHigh: 30, overdueNormal: 15, overdueLongExtra: 10, overdueLongDays: 30, waitingRequest: 10, waitingRequestDays: 30 },
  hazard: { VERY_HIGH: 20, HIGH: 40, MEDIUM: 70, LOW: 90, NONE: 100 },
  bands: { good: 75, watch: 50, poor: 25 },
} as const;
const DAY = 86_400_000;

export type HealthComponentKey = keyof typeof HEALTH.weights;
export type Band = "GOOD" | "WATCH" | "POOR" | "CRITICAL";
export type Hazard = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | null;

export type HealthInput = {
  now: Date; intervalDays: number;
  assessment: { condition: (typeof KNOWN_CONDITIONS)[number]; assessedAt: Date; basis: "INSPECTION_VERIFIED" | "MANUAL_ENTRY"; issues: { severity: string; status: string }[] } | null;
  maintenance: { status: string; priority?: string | null; scheduledDate: Date; requestedAt?: Date | null }[];
  /** undefined = no hazard model or no valid geometry (component skipped); null = checked, no hazard zone. */
  hazard: Hazard | undefined;
};

export type HealthComponent = { key: HealthComponentKey; score: number | null; weight: number; weightUsed: number; inputs: Record<string, string | number | boolean | null>; reasonKey: string };
export type HealthHint = "RECORD_ASSESSMENT" | "CLOSE_OVERDUE_MAINTENANCE" | "REVIEW_OPEN_CRITICAL_ISSUE" | "APPROVE_WAITING_REQUESTS";
export type HealthResult = {
  version: string; availability: "AVAILABLE" | "INSUFFICIENT_EVIDENCE"; score: number | null; band: Band | null; caps: string[];
  evidenceLevel: "LOW" | "MODERATE" | "GOOD" | null; basis: "INSPECTION_VERIFIED" | "MANUAL_ENTRY" | null;
  components: HealthComponent[]; weightsUsed: Partial<Record<HealthComponentKey, number>>; reasons: string[]; hints: HealthHint[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const bandOf = (s: number): Band => (s >= HEALTH.bands.good ? "GOOD" : s >= HEALTH.bands.watch ? "WATCH" : s >= HEALTH.bands.poor ? "POOR" : "CRITICAL");
const ORDER: Band[] = ["CRITICAL", "POOR", "WATCH", "GOOD"];
const capAt = (band: Band, max: Band): Band => (ORDER.indexOf(band) > ORDER.indexOf(max) ? max : band);

export function computeHealth(i: HealthInput): HealthResult {
  const W = HEALTH.weights;
  const interval = i.intervalDays * DAY;
  const a = i.assessment;
  const age = a ? i.now.getTime() - a.assessedAt.getTime() : null;
  const stale = age !== null && age > HEALTH.staleMultiplier * interval;
  const reasons: string[] = [];
  const hints = new Set<HealthHint>();

  // condition
  let condition: number | null = null;
  if (!a) { reasons.push("NO_ASSESSMENT"); hints.add("RECORD_ASSESSMENT"); }
  else if (stale) { reasons.push("ASSESSMENT_STALE"); hints.add("RECORD_ASSESSMENT"); }
  else { condition = CONDITION_SCORE[a.condition] - (age! > HEALTH.ageAdjustAfter * interval ? HEALTH.ageAdjustPoints : 0); }

  // open issues (from the latest assessment only)
  const open = a ? a.issues.filter((x) => x.status === "OPEN") : [];
  const nCrit = open.filter((x) => x.severity === "CRITICAL").length, nMaj = open.filter((x) => x.severity === "MAJOR").length, nMin = open.filter((x) => x.severity === "MINOR").length;
  const issues = a ? clamp(100 - HEALTH.issuePenalty.CRITICAL * nCrit - HEALTH.issuePenalty.MAJOR * nMaj - HEALTH.issuePenalty.MINOR * nMin) : null;
  if (nCrit) hints.add("REVIEW_OPEN_CRITICAL_ISSUE");

  // maintenance (always available; no work recorded means no penalty)
  const P = HEALTH.maintenancePenalty;
  let penalty = 0, overdueCount = 0, waiting = 0;
  for (const m of i.maintenance) {
    const lateDays = Math.floor((i.now.getTime() - m.scheduledDate.getTime()) / DAY);
    if ((m.status === "PLANNED" || m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && lateDays > 0) {
      overdueCount += 1;
      penalty += (m.priority === "URGENT" || m.priority === "HIGH" ? P.overdueHigh : P.overdueNormal) + (lateDays > P.overdueLongDays ? P.overdueLongExtra : 0);
    }
    if (m.status === "REQUESTED" && m.requestedAt && (i.now.getTime() - m.requestedAt.getTime()) / DAY > P.waitingRequestDays) { waiting += 1; penalty += P.waitingRequest; }
  }
  if (overdueCount) hints.add("CLOSE_OVERDUE_MAINTENANCE");
  if (waiting) hints.add("APPROVE_WAITING_REQUESTS");
  const maintenance = clamp(100 - penalty);

  // assessment timeliness
  let timeliness: number | null = null;
  if (a) {
    const r = age! / interval;
    timeliness = r <= 1 ? 100 : r >= 2 ? 0 : clamp(100 - (r - 1) * 100);
    if (timeliness < 50) hints.add("RECORD_ASSESSMENT");
  }

  // hazard exposure (skipped when unknown)
  const hazard = i.hazard === undefined ? null : i.hazard === null ? HEALTH.hazard.NONE : HEALTH.hazard[i.hazard];

  const raw: { key: HealthComponentKey; score: number | null; inputs: HealthComponent["inputs"]; reasonKey: string }[] = [
    { key: "condition", score: condition, inputs: { condition: a?.condition ?? null, ageDays: age === null ? null : Math.floor(age / DAY), intervalDays: i.intervalDays }, reasonKey: condition === null ? (a ? "stale" : "none") : "ok" },
    { key: "openIssues", score: issues, inputs: { critical: nCrit, major: nMaj, minor: nMin }, reasonKey: a ? "ok" : "none" },
    { key: "maintenance", score: maintenance, inputs: { overdue: overdueCount, waitingRequests: waiting, records: i.maintenance.length }, reasonKey: i.maintenance.length ? "ok" : "no_records" },
    { key: "assessmentTimeliness", score: timeliness, inputs: { ageDays: age === null ? null : Math.floor(age / DAY), intervalDays: i.intervalDays }, reasonKey: a ? "ok" : "none" },
    { key: "hazardExposure", score: i.hazard === undefined ? null : hazard, inputs: { level: i.hazard === undefined ? null : i.hazard ?? "NONE" }, reasonKey: i.hazard === undefined ? "skipped" : "ok" },
  ];

  const availableWeight = raw.filter((c) => c.score !== null).reduce((s, c) => s + W[c.key], 0);
  const components: HealthComponent[] = raw.map((c) => ({ ...c, weight: W[c.key], weightUsed: c.score === null ? 0 : Math.round((W[c.key] * 100) / availableWeight) }));
  const weightsUsed = Object.fromEntries(components.filter((c) => c.score !== null).map((c) => [c.key, c.weightUsed])) as Partial<Record<HealthComponentKey, number>>;

  if (condition === null) {
    return { version: HEALTH_RULES_VERSION, availability: "INSUFFICIENT_EVIDENCE", score: null, band: null, caps: [], evidenceLevel: null, basis: a?.basis ?? null, components, weightsUsed: {}, reasons, hints: [...hints] };
  }

  const total = raw.reduce((s, c) => s + (c.score === null ? 0 : c.score * W[c.key]), 0);
  const score = clamp(total / availableWeight);
  let band = bandOf(score);
  const caps: string[] = [];
  const latest = a!.condition;
  if (latest === "CRITICAL" && band !== "CRITICAL") { band = "CRITICAL"; caps.push("CONDITION_CRITICAL"); }
  else if (latest === "POOR") { const b = capAt(band, "POOR"); if (b !== band) { band = b; caps.push("CONDITION_POOR"); } }
  if (nCrit > 0) { const b = capAt(band, "POOR"); if (b !== band) { band = b; caps.push("OPEN_CRITICAL_ISSUE"); } }

  // Evidence level: GOOD needs every component (including maintenance history and the hazard check); a manual-entry basis caps it at MODERATE.
  const hasHistory = i.maintenance.length > 0, hasHazard = i.hazard !== undefined;
  let evidenceLevel: "LOW" | "MODERATE" | "GOOD" = hasHistory && hasHazard ? "GOOD" : hasHistory || hasHazard ? "MODERATE" : "LOW";
  if (a!.basis === "MANUAL_ENTRY" && evidenceLevel === "GOOD") evidenceLevel = "MODERATE";

  return { version: HEALTH_RULES_VERSION, availability: "AVAILABLE", score, band, caps, evidenceLevel, basis: a!.basis, components, weightsUsed, reasons, hints: [...hints] };
}
