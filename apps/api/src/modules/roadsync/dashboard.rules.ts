/**
 * Step 78 dashboard rules. ONE small module; fixed constants, not a settings surface.
 * Display text is composed client-side from codes (i18n keys), never from server prose.
 */
export const RANGES = ["7d", "30d", "90d", "12m", "custom"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_DAYS: Record<Exclude<RangeKey, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

export const DASH = {
  DEFAULT_RANGE: "30d" as RangeKey,
  MAX_CUSTOM_DAYS: 24 * 31,
  MIN_CASES_FOR_SCORE: 5,
  MIN_COHORT_FOR_BENCHMARK: 3,
  AGING_BUCKETS_DAYS: [[0, 2], [3, 7], [8, 14], [15, 30], [31, Infinity]] as readonly (readonly [number, number])[],
  CALENDAR_DAYS: 30,
  MAP_GRID_DEG: 0.02,
  MAP_CELL_CAP: 300,
  TOP_N: 8,
  CACHE_TTL_SECONDS: 60,
  SIGNALS_MAX: 8,
  STUCK_NEGOTIATION_DAYS: 10,
  UNCOORDINATED_START_DAYS: 7,
  ESCALATION_UNATTENDED_DAYS: 3,
  STARTING_SOON_DAYS: 14,
  OPPORTUNITY_WINDOW_DAYS: 14,
  OPPORTUNITY_MIN_TRENCH_M: 100,
  BACKLOG_AGING_SHARE: 0.2,
  BACKLOG_AGING_DAYS: 30,
  OVERDUE_CLUSTER_MIN: 3,
  FETCH_CAP: 5000,
  PERCENTILE_CAP: 5000,
  SPARK_POINTS: 30,
} as const;

/** Weights sum to 100. */
export const HEALTH_WEIGHTS = { ackTimeliness: 25, responseTimeliness: 25, resolutionProgress: 20, backlogHealth: 15, commitmentCompletion: 15 } as const;
export type HealthComponent = keyof typeof HEALTH_WEIGHTS;
export const BAND_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
export const GRADES = [{ min: 85, code: "excellent" }, { min: 70, code: "good" }, { min: 50, code: "needs_attention" }, { min: 0, code: "at_risk" }] as const;
export type Grade = (typeof GRADES)[number]["code"];
