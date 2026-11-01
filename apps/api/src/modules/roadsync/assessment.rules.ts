/**
 * Steps 70-71 rule configuration. ONE versioned module; changing a number here changes behavior everywhere.
 * Fixed constants, not a settings surface. Bump RULE_VERSION whenever scoring or classification changes.
 */
export const RULE_VERSION = "1.0.0";

export const ASSESSMENT = {
  CONFLICT_MIN_SCORE: 20,
  SEQUENCE_WINDOW_DAYS: 180,
  JOINT_WORKS_WINDOW_DAYS: 30,
  PROFILE_MAX_BINS: 60,
  PROFILE_MIN_BIN_M: 25,
  WHATIF_MIN_DAYS: -60,
  WHATIF_MAX_DAYS: 120,
  RISK_INDEX_TOP_N: 10,
  BATCH_MAX: 200,
  PAGE_MAX: 50,
  MAP_FEATURE_CAP: 250,
  DIFFERENT_SHIFTS_MITIGATION: 8,
  RUN_LOCK_TIMEOUT_MS: 2 * 60 * 1000,
} as const;

export const BAND_CODES = ["info", "low", "medium", "high", "critical"] as const;
export type Band = (typeof BAND_CODES)[number];
export const BAND_RANGE: Record<Band, readonly [number, number]> = { info: [0, 19], low: [20, 39], medium: [40, 59], high: [60, 79], critical: [80, 100] };

export function bandOf(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return BAND_CODES.find((band) => s <= BAND_RANGE[band][1]) ?? "critical";
}

/** Maximum points per component. They sum to 100. */
export const COMPONENT_MAX = { spatial: 30, sharedCorridor: 10, temporal: 25, hazard: 20, trafficCompounding: 10, priorityEmergency: 5 } as const;
export type ComponentKey = keyof typeof COMPONENT_MAX;

/** Work-type groups over the real WORK_TYPES enum. */
export const INVASIVE_WORK = new Set(["ROAD_EXCAVATION", "PIPELINE_INSTALLATION", "ELECTRIC_CABLE_WORK", "TELECOM_CABLE_WORK", "DRAINAGE_WORK", "BRIDGE_WORK", "UTILITY_REPAIR"]);
export const SURFACE_WORK = new Set(["ROAD_RESURFACING"]);
export const LIGHT_WORK = new Set(["OTHER"]);

/** Existing-asset hazard when invasive work runs next to it (0-4). Unlisted types rate 1. */
export const ASSET_HAZARD: Record<string, number> = { ELECTRICITY: 4, WATER: 3, DRAINAGE: 3, TELECOM: 2 };
/** Asset types that make "invasive work vs asset" a utility-strike risk rather than a proximity advisory. */
export const STRIKE_ASSETS = new Set(["ELECTRICITY", "WATER", "DRAINAGE"]);
export const JOINT_WORKS_FAMILY = new Set(["WATER", "DRAINAGE"]);

export const TRAFFIC_LEVELS = { none: 0, low: 1, moderate: 2, high: 3, full_closure: 4 } as const;
export type TrafficLevel = keyof typeof TRAFFIC_LEVELS;
export const TRAFFIC_LEVEL_CODES = Object.keys(TRAFFIC_LEVELS) as TrafficLevel[];
export const CLOSURE_TYPES = ["none", "lane", "partial", "full_road"] as const;

export const FLOORS = { F1: 80, F2: 60, F3: 60 } as const;

/** Classification priority: the first match becomes the primary class. */
export const CLASS_CODES = [
  "utility_strike_risk", "emergency_interference", "direct_physical_overlap", "footprint_encroachment",
  "sequential_disruption", "traffic_compounding", "asset_proximity_risk", "joint_works_opportunity",
] as const;
export type ClassCode = (typeof CLASS_CODES)[number];

/** Read-only summary served to the "How scoring works" popover. */
export function rulesSummary() {
  return {
    version: RULE_VERSION,
    bands: BAND_CODES.map((code) => ({ code, min: BAND_RANGE[code][0], max: BAND_RANGE[code][1] })),
    components: Object.entries(COMPONENT_MAX).map(([key, max]) => ({ key, max })),
    mitigations: [{ key: "different_shifts", points: -ASSESSMENT.DIFFERENT_SHIFTS_MITIGATION }],
    floors: [
      { code: "F1", min: FLOORS.F1, rule: "electricity involved, both invasive, geometries meet, dates overlap" },
      { code: "F2", min: FLOORS.F2, rule: "both invasive, geometries intersect, dates overlap" },
      { code: "F3", min: FLOORS.F3, rule: "emergency work interferes with planned works" },
    ],
    windows: { conflictMinScore: ASSESSMENT.CONFLICT_MIN_SCORE, sequenceDays: ASSESSMENT.SEQUENCE_WINDOW_DAYS, jointWorksDays: ASSESSMENT.JOINT_WORKS_WINDOW_DAYS },
    classes: [...CLASS_CODES],
  };
}
