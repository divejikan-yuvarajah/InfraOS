import type { NearbyOther, SpatialFacts, TemporalFacts } from "./nearby";
import type { GeometryInput, Position } from "./work-requests-view";

/** Steps 70-71: mirrors the API projection. Scores are explained by factor keys + params; the client composes the sentences. */
export type Band = "info" | "low" | "medium" | "high" | "critical";
export type Kind = "conflict" | "opportunity" | "advisory";
export type ClassCode =
  | "utility_strike_risk" | "emergency_interference" | "direct_physical_overlap" | "footprint_encroachment"
  | "sequential_disruption" | "traffic_compounding" | "asset_proximity_risk" | "joint_works_opportunity";

export const BANDS_ASC: readonly Band[] = ["info", "low", "medium", "high", "critical"];
export const BANDS_DESC: readonly Band[] = ["critical", "high", "medium", "low", "info"];
export const CLASS_ORDER: readonly ClassCode[] = [
  "utility_strike_risk", "emergency_interference", "direct_physical_overlap", "footprint_encroachment",
  "sequential_disruption", "traffic_compounding", "asset_proximity_risk", "joint_works_opportunity",
];
/** Distinct from the infrastructure-type palette: severity is pill + ring, infrastructure is the left edge and icon. */
export const BAND_COLOR: Record<Band, string> = { info: "#6B8AA8", low: "#3E9B7A", medium: "#E0A526", high: "#D9632B", critical: "#8D153A" };
export const BAND_INK: Record<Band, string> = { info: "#2f4a63", low: "#1f5e47", medium: "#6b4a00", high: "#7a3210", critical: "#5e0d27" };
export const OPPORTUNITY_COLOR = "#1B6B3A";
export const BAND_RANGE: Record<Band, [number, number]> = { info: [0, 19], low: [20, 39], medium: [40, 59], high: [60, 79], critical: [80, 100] };

export type Factor = { key: string; points: number; max: number; code: string; params: Record<string, unknown>; sensitive?: boolean };
export type Mitigation = { key: string; points: number; params: Record<string, unknown> };
export type ItemAssessment = {
  kind: Kind;
  classes: ClassCode[];
  primaryClass: ClassCode | null;
  score: number;
  band: Band;
  effective: { score: number; band: Band };
  floorApplied: { code: string; min: number } | null;
  factors: Factor[];
  mitigations: Mitigation[];
  incompleteInputs: string[];
  inputsAssumed: string[];
  sequence: { direction: "self_then_other" | "other_then_self"; gapDays: number } | null;
  estimatedSharedTrenchMeters: number | null;
  hotspot: { type: "Point"; coordinates: [number, number] };
  overridden: boolean;
  overrideStale: boolean;
  override?: { band: Band; reason: string; by: string; at: string };
};
export type AssessmentItem = { candidateId: string; key: string; other: NearbyOther; spatial: SpatialFacts; temporal: TemporalFacts; assessment: ItemAssessment; stale: boolean; canOpen: boolean };
export type ProfileBin = { fromM: number; toM: number; score: number; topCandidateIds: string[] };
export type AssessmentCounts = { conflicts: number; opportunities: number; advisories: number; byBand: Record<Band, number>; byClass: Record<string, number> };
export type AssessmentSummary = {
  status: "pending" | "running" | "completed" | "failed";
  ruleVersion: string | null;
  ruleStale: boolean;
  currentRuleVersion: string;
  assessedAt: string | null;
  riskIndex: number;
  maxBand: Band | null;
  maxScore: number;
  counts: AssessmentCounts;
  corridorProfile: ProfileBin[] | null;
  topCandidateIds: string[];
  anyStale: boolean;
};
export type AssessmentResult = { summary: AssessmentSummary; items: AssessmentItem[]; total: number; page: number; limit: number };

export type PreviewAssessment = { riskIndex: number; maxBand: Band | null; counts: { conflicts: number; opportunities: number; advisories: number }; corridorProfile: ProfileBin[] | null; incompleteInputs: string[]; ruleVersion: string };
export type PreviewItemAssessment = Pick<ItemAssessment, "kind" | "classes" | "primaryClass" | "score" | "band" | "floorApplied" | "factors" | "mitigations" | "incompleteInputs" | "inputsAssumed">;

export type WhatIfOutcome = { riskIndex: number; maxBand: Band | null; conflictCount: number };
export type ClearShift = { shiftDays: number; newStart: string; newEnd: string; withinFlexibility: boolean } | null;
export type WhatIfResult = {
  coverageNote: "stored_pairs_only";
  range: [number, number];
  flexibleDays: number;
  earliestShiftDays: number;
  current: WhatIfOutcome;
  scenario: WhatIfOutcome & { shiftDays: number; newStart: string; newEnd: string; bufferMeters: number; workingHours: string };
  curve?: ({ shiftDays: number } & WhatIfOutcome)[];
  firstClearShifts?: { earlier: ClearShift; later: ClearShift };
  startDate: string;
};
export type RulesSummary = {
  version: string;
  bands: { code: Band; min: number; max: number }[];
  components: { key: string; max: number }[];
  mitigations: { key: string; points: number }[];
  floors: { code: string; min: number; rule: string }[];
  windows: { conflictMinScore: number; sequenceDays: number; jointWorksDays: number };
  classes: ClassCode[];
};

export const isOpportunity = (a: ItemAssessment | PreviewItemAssessment) => a.kind === "opportunity";

export function groupByBand(items: AssessmentItem[]): { band: Band; items: AssessmentItem[] }[] {
  return BANDS_DESC.map((band) => ({ band, items: items.filter((i) => i.assessment.effective.band === band) })).filter((g) => g.items.length > 0);
}

/** Fills `{name}` placeholders. Values are rendered as text only. */
export function fmt(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] === undefined || params[name] === null ? "" : String(params[name])));
}

const K = (Math.PI / 180) * 6_371_008.8;

/** Point `meters` along a LineString, using the same local flat projection as the server. */
export function pointAtChainage(line: Position[], meters: number): Position {
  const lat0 = line.reduce((n, p) => n + p[1], 0) / line.length;
  const cx = Math.cos((lat0 * Math.PI) / 180);
  let left = Math.max(0, meters);
  for (let i = 1; i < line.length; i += 1) {
    const [a, b] = [line[i - 1]!, line[i]!];
    const len = Math.hypot((b[0] - a[0]) * K * cx, (b[1] - a[1]) * K);
    if (left <= len || i === line.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    left -= len;
  }
  return line[line.length - 1]!;
}

export type ConflictOverlay = {
  mode: "conflicts";
  features: unknown[];
  selectedKey: string | null;
  hoverKey: string | null;
  onSelect?: (candidateId: string) => void;
};

/** Server map features plus the corridor-profile scrub marker, ready for the shared overlay layers. */
export function conflictOverlayFeatures(map: unknown[], self: GeometryInput | null, scrub: ProfileBin | null): unknown[] {
  const out = [...map];
  if (self?.type === "LineString" && scrub) {
    out.push({ type: "Feature", geometry: { type: "Point", coordinates: pointAtChainage(self.coordinates, (scrub.fromM + scrub.toM) / 2) }, properties: { feature: "scrub", kind: "scrub" } });
  }
  return out;
}

/** Same noisy-OR as the server: top 10 conflict scores. Used only to preview an override before it is saved. */
export function riskIndexOf(scores: number[]): number {
  const top = [...scores].sort((x, y) => y - x).slice(0, 10);
  return top.length ? Math.round(100 * (1 - top.reduce((p, s) => p * (1 - Math.max(0, Math.min(100, s)) / 100), 1))) : 0;
}

/** An override pins the band; the score is clamped into it so score and band never disagree (mirrors the server). */
export function clampToBand(score: number, band: Band): number {
  const [lo, hi] = BAND_RANGE[band];
  return Math.min(hi, Math.max(lo, score));
}
