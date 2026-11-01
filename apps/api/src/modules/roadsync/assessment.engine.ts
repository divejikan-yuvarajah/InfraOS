/**
 * Steps 70-71 pure engine: classification + explainable 0-100 severity for ONE stored pair.
 * No I/O, no randomness. Scoring is pair-level and symmetric: assessPair(a, b) and assessPair(b, a)
 * (with the facts re-oriented) give the same score, band, classes and floors.
 * Explanations are i18n keys plus params; this module never produces English prose.
 */
import { ASSESSMENT, ASSET_HAZARD, bandOf, CLASS_CODES, COMPONENT_MAX, FLOORS, INVASIVE_WORK, JOINT_WORKS_FAMILY, LIGHT_WORK, STRIKE_ASSETS, SURFACE_WORK, TRAFFIC_LEVELS, type Band, type ClassCode, type ComponentKey, type TrafficLevel } from "./assessment.rules.js";
import { colomboDay, type TemporalResult, type WorkingHours } from "./schedule.analysis.js";
import { distanceFromPoint, lineLengthMeters, pointAlongLine, type AnyGeometry, type SpatialResult } from "./spatial.analysis.js";

export type Traffic = { level: TrafficLevel; closureType?: string | null };
export type SourceKind = "work_request" | "project" | "asset";
export type AssessSide = {
  sourceType: SourceKind;
  workType: string | null;
  infrastructureType: string;
  traffic: Traffic | null;
  priority: string | null;
  isEmergency: boolean;
  workingHours: WorkingHours;
  start: Date | null;
  end: Date | null;
};

export type Factor = { key: ComponentKey | "floor"; points: number; max: number; code: string; params: Record<string, unknown>; sensitive?: boolean };
export type Mitigation = { key: "different_shifts"; points: number; params: Record<string, unknown> };
export type Sequence = { direction: "a_then_b" | "b_then_a"; gapDays: number };
export type PairAssessment = {
  kind: "conflict" | "opportunity" | "advisory";
  classes: ClassCode[];
  primaryClass: ClassCode | null;
  score: number;
  band: Band;
  floorApplied: { code: "F1" | "F2" | "F3"; min: number } | null;
  factors: Factor[];
  mitigations: Mitigation[];
  incompleteInputs: string[];
  inputsAssumed: string[];
  sequence: Sequence | null;
  estimatedSharedTrenchMeters: number | null;
};

type Group = "INVASIVE" | "SURFACE" | "LIGHT" | "ASSET" | "UNKNOWN";
export const groupOf = (s: AssessSide): Group =>
  s.sourceType === "asset" ? "ASSET" : s.workType === null ? "UNKNOWN" : INVASIVE_WORK.has(s.workType) ? "INVASIVE" : SURFACE_WORK.has(s.workType) ? "SURFACE" : LIGHT_WORK.has(s.workType) ? "LIGHT" : "LIGHT";

const OVERLAPPING = new Set(["identical", "contained", "partial_overlap"]);
const CLOSE = new Set(["intersecting", "footprint_overlap"]);
const level = (t: Traffic | null) => (t ? TRAFFIC_LEVELS[t.level] : 0);
const priorityOf = (s: AssessSide) => (s.priority ?? "").toLowerCase();

/** Symmetric hazard rating 0-4 plus whether it rests on an assumed (missing) work type. */
export function hazardRating(a: AssessSide, b: AssessSide): { rating: number; assumed: boolean } {
  const [ga, gb] = [groupOf(a), groupOf(b)];
  if (ga === "ASSET" && gb === "ASSET") return { rating: 0, assumed: false };
  if (ga === "ASSET" || gb === "ASSET") {
    const [asset, other] = ga === "ASSET" ? [a, gb] : [b, ga];
    if (other === "INVASIVE") return { rating: ASSET_HAZARD[asset.infrastructureType] ?? 1, assumed: false };
    return other === "UNKNOWN" ? { rating: 1, assumed: true } : { rating: 0, assumed: false };
  }
  if (ga === "UNKNOWN" || gb === "UNKNOWN") return { rating: 1, assumed: true };
  const key = [ga, gb].sort().join("+");
  if (key === "INVASIVE+INVASIVE") {
    const electric = a.infrastructureType === "ELECTRICITY" || b.infrastructureType === "ELECTRICITY";
    return { rating: Math.min(4, 2 + (a.infrastructureType !== b.infrastructureType ? 1 : 0) + (electric ? 1 : 0)), assumed: false };
  }
  const table: Record<string, number> = { "INVASIVE+SURFACE": 2, "INVASIVE+LIGHT": 1, "SURFACE+SURFACE": 1, "LIGHT+SURFACE": 0, "LIGHT+LIGHT": 0 };
  return { rating: table[key] ?? 0, assumed: false };
}

/** Surface work finishing before invasive work starts (digging up fresh surface), within the sequence window. */
export function sequenceOf(a: AssessSide, b: AssessSide, t: TemporalResult): Sequence | null {
  if (!t.applicable || t.overlapDays > 0 || !a.start || !a.end || !b.start || !b.end) return null;
  const [ga, gb] = [groupOf(a), groupOf(b)];
  let direction: Sequence["direction"] | null = null;
  if (ga === "SURFACE" && gb === "INVASIVE" && colomboDay(a.end) < colomboDay(b.start)) direction = "a_then_b";
  else if (gb === "SURFACE" && ga === "INVASIVE" && colomboDay(b.end) < colomboDay(a.start)) direction = "b_then_a";
  if (!direction || t.gapDays > ASSESSMENT.SEQUENCE_WINDOW_DAYS) return null;
  return { direction, gapDays: t.gapDays };
}

export function assessPair(a: AssessSide, b: AssessSide, spatial: SpatialResult, temporal: TemporalResult): PairAssessment {
  const [ga, gb] = [groupOf(a), groupOf(b)];
  const assetPair = ga === "ASSET" || gb === "ASSET";
  const workSide = ga === "ASSET" ? b : a;
  const assetSide = ga === "ASSET" ? a : b;
  const bothInvasive = ga === "INVASIVE" && gb === "INVASIVE";
  const overlapping = OVERLAPPING.has(temporal.relation);
  const close = CLOSE.has(spatial.relation);
  const sequence = sequenceOf(a, b, temporal);
  const incompleteInputs: string[] = [];
  const inputsAssumed: string[] = [];
  const factors: Factor[] = [];

  // spatial (0-30)
  const sp = spatial.relation === "intersecting" ? 30 : spatial.relation === "footprint_overlap" ? 22 : spatial.relation === "adjacent" ? 12
    : spatial.relation === "nearby" ? Math.max(2, Math.min(8, Math.round(8 * (1 - spatial.distanceMeters / 500)))) : 0;
  factors.push({ key: "spatial", points: sp, max: COMPONENT_MAX.spatial, code: spatial.relation, params: { distanceMeters: spatial.distanceMeters } });

  // shared corridor (0-10)
  const shared = Math.max(spatial.sharedPctOfA ?? 0, spatial.sharedPctOfB ?? 0);
  const corridor = shared >= 0.75 ? 10 : shared >= 0.5 ? 8 : shared >= 0.25 ? 5 : shared > 0 ? 3 : 0;
  factors.push({ key: "sharedCorridor", points: corridor, max: COMPONENT_MAX.sharedCorridor, code: corridor ? "shared" : "none", params: { sharedPct: Math.round(shared * 100), sharedMeters: spatial.sharedLengthMeters } });

  // temporal (0-25)
  let tp = 0;
  let tcode: string = temporal.relation;
  if (temporal.relation === "permanent") tp = 12;
  else if (temporal.relation === "identical" || temporal.relation === "contained") tp = 25;
  else if (temporal.relation === "partial_overlap") tp = Math.round(10 + 15 * Math.max(temporal.overlapPctOfA ?? 0, temporal.overlapPctOfB ?? 0));
  else if (sequence) { tp = Math.round(6 + 14 * (1 - sequence.gapDays / ASSESSMENT.SEQUENCE_WINDOW_DAYS)); tcode = "sequence"; }
  else if (temporal.relation === "adjacent") tp = 4;
  if (temporal.relation === "unknown") incompleteInputs.push("schedule");
  factors.push({ key: "temporal", points: tp, max: COMPONENT_MAX.temporal, code: tcode, params: { overlapDays: temporal.overlapDays, gapDays: temporal.gapDays } });

  // hazard (0-20)
  const hazard = sequence ? { rating: 3, assumed: false } : hazardRating(a, b);
  if (hazard.assumed) inputsAssumed.push("workType");
  factors.push({ key: "hazard", points: hazard.rating * 5, max: COMPONENT_MAX.hazard, code: sequence ? "sequence" : String(hazard.rating), params: { rating: hazard.rating } });

  // traffic compounding (0-10), only while works overlap in time
  if (!assetPair) {
    if ((a.sourceType === "work_request" && !a.traffic) || (b.sourceType === "work_request" && !b.traffic)) incompleteInputs.push("trafficImpact");
  }
  const tsum = level(a.traffic) + level(b.traffic);
  const fullBoth = a.traffic?.closureType === "full_road" && b.traffic?.closureType === "full_road";
  const traffic = !overlapping || assetPair ? 0 : fullBoth || tsum >= 7 ? 10 : tsum >= 5 ? 7 : tsum >= 3 ? 4 : tsum >= 1 ? 1 : 0;
  factors.push({ key: "trafficCompounding", points: traffic, max: COMPONENT_MAX.trafficCompounding, code: traffic ? "compounding" : "none", params: { trafficSum: tsum } });

  // priority / emergency (0-5). Depends on the other agency's private fields, so it is flagged for redaction.
  const emergency = a.isEmergency || b.isEmergency;
  const rank = (s: AssessSide) => (priorityOf(s) === "critical" ? 2 : priorityOf(s) === "high" ? 1 : 0);
  const pr = emergency || Math.max(rank(a), rank(b)) === 2 ? 5 : Math.max(rank(a), rank(b)) === 1 ? 3 : 0;
  factors.push({ key: "priorityEmergency", points: pr, max: COMPONENT_MAX.priorityEmergency, code: emergency ? "emergency" : pr === 5 ? "critical" : pr === 3 ? "high" : "none", params: {}, sensitive: true });

  // mitigation
  const mitigations: Mitigation[] = [];
  if (!assetPair && overlapping && temporal.hoursCompatibility === "different_shifts" && level(a.traffic) <= 2 && level(b.traffic) <= 2) {
    mitigations.push({ key: "different_shifts", points: -ASSESSMENT.DIFFERENT_SHIFTS_MITIGATION, params: { hoursA: a.workingHours, hoursB: b.workingHours } });
  }
  const sum = factors.reduce((n, f) => n + f.points, 0) + mitigations.reduce((n, m) => n + m.points, 0);
  const pre = Math.max(0, Math.min(100, Math.round(sum)));

  // classification
  const classes = new Set<ClassCode>();
  const otherInvasive = assetPair && groupOf(workSide) === "INVASIVE";
  if ((bothInvasive && a.infrastructureType !== b.infrastructureType && close && overlapping) || (otherInvasive && STRIKE_ASSETS.has(assetSide.infrastructureType) && close)) classes.add("utility_strike_risk");
  const emergencyFlag = a.isEmergency !== b.isEmergency && ["INVASIVE", "SURFACE"].includes(groupOf(a.isEmergency ? b : a));
  const interferes = emergencyFlag && overlapping && (close || spatial.relation === "adjacent");
  if (interferes) classes.add("emergency_interference");
  if (!assetPair && spatial.relation === "intersecting" && overlapping) classes.add("direct_physical_overlap");
  if (!assetPair && spatial.relation === "footprint_overlap" && overlapping) classes.add("footprint_encroachment");
  if (sequence && (close || spatial.relation === "adjacent")) classes.add("sequential_disruption");
  if (traffic >= 7 && spatial.distanceMeters <= 100 && overlapping) classes.add("traffic_compounding");
  if (otherInvasive && (spatial.relation === "adjacent" || spatial.relation === "nearby") && !classes.has("utility_strike_risk")) classes.add("asset_proximity_risk");
  const sameFamily = a.infrastructureType === b.infrastructureType || (JOINT_WORKS_FAMILY.has(a.infrastructureType) && JOINT_WORKS_FAMILY.has(b.infrastructureType));
  const nearInTime = overlapping || (temporal.applicable && temporal.overlapDays === 0 && temporal.gapDays <= ASSESSMENT.JOINT_WORKS_WINDOW_DAYS);
  if (bothInvasive && sameFamily && (close || shared >= 0.4) && nearInTime) classes.add("joint_works_opportunity");
  const ordered = CLASS_CODES.filter((code) => classes.has(code));

  // floors (max, never below the computed score)
  const floors: { code: "F1" | "F2" | "F3"; min: number }[] = [];
  const electric = a.infrastructureType === "ELECTRICITY" || b.infrastructureType === "ELECTRICITY";
  if (bothInvasive && electric && close && temporal.overlapDays >= 1) floors.push({ code: "F1", min: FLOORS.F1 });
  if (bothInvasive && spatial.relation === "intersecting" && temporal.overlapDays >= 1) floors.push({ code: "F2", min: FLOORS.F2 });
  if (interferes) floors.push({ code: "F3", min: FLOORS.F3 });
  const top = floors.sort((x, y) => y.min - x.min)[0] ?? null;
  const floorApplied = top && top.min > pre ? top : null;
  const score = floorApplied ? floorApplied.min : pre;
  if (floorApplied) factors.push({ key: "floor", points: floorApplied.min - pre, max: floorApplied.min, code: floorApplied.code, params: {} });

  const kind: PairAssessment["kind"] = ordered.includes("joint_works_opportunity") && !ordered.includes("utility_strike_risk") && !ordered.includes("emergency_interference")
    ? "opportunity" : score >= ASSESSMENT.CONFLICT_MIN_SCORE && ordered.length > 0 ? "conflict" : "advisory";
  return {
    kind,
    classes: ordered,
    primaryClass: kind === "opportunity" ? "joint_works_opportunity" : ordered[0] ?? null,
    score,
    band: bandOf(score),
    floorApplied,
    factors,
    mitigations,
    incompleteInputs: [...new Set(incompleteInputs)],
    inputsAssumed: [...new Set(inputsAssumed)],
    sequence,
    estimatedSharedTrenchMeters: kind === "opportunity" ? spatial.sharedLengthMeters : null,
  };
}

/** Noisy-OR over the top-N conflict scores. Opportunities and advisories never raise it. */
export function riskIndexOf(scores: number[]): number {
  const top = [...scores].sort((x, y) => y - x).slice(0, ASSESSMENT.RISK_INDEX_TOP_N);
  return top.length ? Math.round(100 * (1 - top.reduce((p, s) => p * (1 - Math.max(0, Math.min(100, s)) / 100), 1))) : 0;
}

export type ProfileItem = { id: string; score: number; geometry: AnyGeometry; reachMeters: number };
export type ProfileBin = { fromM: number; toM: number; score: number; topCandidateIds: string[] };

/** Gap-free bins covering [0, length] along a LineString subject. Null for points and polygons. */
export function corridorProfile(line: AnyGeometry, items: ProfileItem[]): ProfileBin[] | null {
  const length = lineLengthMeters(line);
  if (line.type !== "LineString" || length <= 0) return null;
  const size = Math.max(ASSESSMENT.PROFILE_MIN_BIN_M, length / ASSESSMENT.PROFILE_MAX_BINS);
  const count = Math.ceil(length / size - 1e-9);
  const bins: ProfileBin[] = [];
  for (let i = 0; i < count; i += 1) {
    const fromM = i * size;
    const toM = Math.min(length, (i + 1) * size);
    const center = pointAlongLine(line, (fromM + toM) / 2);
    const hits = items
      .filter((item) => distanceFromPoint(center, item.geometry) <= item.reachMeters + (toM - fromM) / 2)
      .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
    bins.push({ fromM: Math.round(fromM), toM: Math.round(toM), score: hits[0]?.score ?? 0, topCandidateIds: hits.slice(0, 3).map((h) => h.id) });
  }
  return bins;
}

/** Cross-agency view: factors that depend on the other agency's private fields keep their points only. */
export function redactFactors(factors: Factor[]): Factor[] {
  return factors.map((f) => (f.sensitive ? { ...f, code: "other_agency", params: { involvesOtherAgency: true } } : f));
}
