import type { Band } from "./assessment";

/** Step 78 read models, exactly as the API sends them. Display text is composed client-side from codes and params. */
export type RangeKey = "7d" | "30d" | "90d" | "12m" | "custom";
export const RANGES: RangeKey[] = ["7d", "30d", "90d", "12m", "custom"];
export type Drill = { page: "conflicts" | "coordination" | "approvals" | "history"; query: Record<string, string> };
export type Delta = { abs: number; pct: number | null } | null;
export type Kpi = {
  key: string; value: number | null; numerator: number | null; denominator: number | null; unit: "count" | "percent" | "days" | "hours" | "meters";
  definitionKey: string; drilldown: Drill; sampled?: boolean; previous?: number | null; delta?: Delta; spark: (number | null)[] | null;
};
export type FunnelStage = { key: string; count: number; ofPrevious: number | null; medianDays: number | null; stepDays: number | null; bottleneck: boolean };
export type TrendPoint = { date: string; created: number; resolved: number; open: number; criticalHigh: number; exposure: number; ackTimeliness: number | null; responseTimeliness: number | null };
export type AgingBucket = { fromDays: number; toDays: number | null; count: number; byBand: Record<string, number> };
export type HealthRow = { key: string; value: number | null; baseWeight: number; weight: number; contribution: number; excluded: boolean };
export type Health = { score: number | null; grade: "excellent" | "good" | "needs_attention" | "at_risk" | null; cases: number; insufficientData: boolean; components: HealthRow[]; excluded: string[] };
export type Signal = { code: string; severity: "info" | "warning" | "critical"; params: Record<string, number | string>; drilldown: Drill };
export type Overview = {
  scope: { level: "national" | "agency"; agencyId?: string };
  range: { key: RangeKey; start: string; end: string; days: number };
  generatedAt: string; cached: boolean;
  kpis: Kpi[]; funnel: FunnelStage[]; trends: TrendPoint[];
  backlogAging: { buckets: AgingBucket[]; oldest: { conflictNo: string; ageDays: number } | null };
  byBand: Record<string, number>; byClass: Record<string, number>; byStatus: Record<string, number>; newInRange: number; resolvedInRange: number;
  outcomes: { byOutcome: Record<string, number>; verification: { cleared: number; total: number; rate: number | null }; meanShiftDays: number | null; amendmentsApplied: number; nationalApprovalShare: number | null };
  coordination: { created: number; agreed: number; noAgreement: number; withdrawn: number; firstRound: number; avgRounds: number | null; escalatedNow: number; stuck: number };
  timeliness: { ack: { medianHours: number | null; p90Hours: number | null; overdueNow: number }; response: { medianHours: number | null; overdueNow: number } };
  digOnce: { realized: number; realizedMeters: number; openCount: number; openMeters: number };
  health: Health; signals: Signal[]; exposure: { index: number; openConflicts: number };
  topLists: { districts: { district: string; open: number; exposure: number }[]; longestOpen: { id: string; conflictNo: string; band: Band; ageDays: number; status: string }[] };
  attention: { needsMyAck: number; needsMyResponse: number; needsMyApproval: number; startingSoon: number; overdue: { acks: number; responses: number; approvals: number }; overdueTotal: number };
};
export type MapBin = { center: [number, number]; count: number; maxBand: Band; bandCounts: Record<string, number>; topConflictNos: string[] };
export type MapOut = { bins: MapBin[]; asOf: string; generatedAt: string; cached: boolean };
export type CalDay = { date: string; starts: number; ends: number; activeCount: number; maxBand: Band | null; topConflictNos: string[]; uncoordinated: number };
export type CalOut = { days: CalDay[]; generatedAt: string; cached: boolean };
export type Scorecard = { agencyId: string; agencyName?: string | null; cases: number; open: number; overdueAcks: number; overdueResponses: number; agreementRate: number | null; medianAckHours: number | null; medianResponseHours: number | null; avgRounds: number | null; resolved: number; commitmentCompletion: number | null; healthScore: number | null; grade: Health["grade"] };
export type Benchmark = { cohort: number; medians: Record<"agreementRate" | "medianAckHours" | "medianResponseHours" | "avgRounds" | "commitmentCompletion" | "healthScore", number | null> } | null;
export type AgenciesOut =
  | { level: "national"; items: Scorecard[]; benchmark: Benchmark }
  | { level: "agency"; own: Scorecard; benchmark: Benchmark; benchmarkUnavailable: "cohort_too_small" | null };
export type Brief = {
  scope: Overview["scope"]; range: Overview["range"]; generatedAt: string; cached: boolean;
  kpis: { key: string; value: number | null; numerator: number | null; denominator: number | null; unit: Kpi["unit"]; definitionKey: string }[];
  signals: { code: string; severity: Signal["severity"]; params: Record<string, number | string> }[];
  topCritical: { conflictNo: string; band: Band; classes: string[]; start: string | null; end: string | null; district: string | null; ageDays: number }[];
  health: Health; scorecards: Scorecard[] | { own: Scorecard; benchmark: Benchmark };
};

export type DashFilters = { range: RangeKey; from: string; to: string; compare: boolean; agencyId: string; district: string };
export function filtersOf(p: URLSearchParams): DashFilters {
  const r = p.get("range");
  return { range: RANGES.includes(r as RangeKey) ? (r as RangeKey) : "30d", from: p.get("from") ?? "", to: p.get("to") ?? "", compare: p.get("compare") === "true", agencyId: p.get("agencyId") ?? "", district: p.get("district") ?? "" };
}
/** API query for the current filters. Custom needs both dates; unset filters are omitted so the server defaults apply. */
export function dashQuery(f: DashFilters): string {
  const q = new URLSearchParams({ range: f.range });
  if (f.range === "custom") { if (f.from) q.set("from", f.from); if (f.to) q.set("to", f.to); }
  if (f.compare) q.set("compare", "true");
  if (f.agencyId) q.set("agencyId", f.agencyId);
  if (f.district) q.set("district", f.district);
  return q.toString();
}
export const customReady = (f: DashFilters) => f.range !== "custom" || Boolean(f.from && f.to && f.to >= f.from);

/**
 * Every number links to an EXISTING page filtered by the same query the server used. The Inbox needs a preset to avoid
 * its default status filter; the Hub reads `preset` and a few flat keys.
 */
export function drillHref(d: Drill): string {
  const q = new URLSearchParams();
  if (d.page === "conflicts") { q.set("preset", "all"); for (const [k, v] of Object.entries(d.query)) q.set(k, v); return `/roadsync/conflicts?${q}`; }
  if (d.page === "coordination") {
    const { tab, ...rest } = d.query;
    q.set("preset", tab === "escalated" ? "escalated" : "all");
    for (const [k, v] of Object.entries(rest)) q.set(k, v);
    return `/roadsync/coordination?${q}`;
  }
  for (const [k, v] of Object.entries(d.query)) q.set(k, v);
  return `/roadsync/${d.page}${q.size ? `?${q}` : ""}`;
}

export const kmOf = (meters: number) => Math.round((meters / 1000) * 10) / 10;
export function formatKpi(k: { value: number | null; unit: Kpi["unit"] }, locale: string): string {
  if (k.value === null) return "—";
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (k.unit === "percent") return `${n.format(k.value)}%`;
  if (k.unit === "meters") return `${n.format(kmOf(k.value))} km`;
  return n.format(k.value);
}
/** Which direction is good for a KPI; used only to pick the semantic icon next to the arrow, never colour alone. */
export const UP_IS_GOOD: Record<string, boolean> = { openConflicts: false, criticalHigh: false, medianDaysToResolve: false, agreementRate: true, ackTimeliness: true, responseTimeliness: true, digOnceMeters: true };
export const BAND_ORDER: Band[] = ["critical", "high", "medium", "low", "info"];
