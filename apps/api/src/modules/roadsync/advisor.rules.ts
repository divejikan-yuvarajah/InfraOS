/**
 * Step 80 advisor rules. ONE small module; fixed constants, not a settings surface.
 * Explanations are i18n codes + params, never server prose.
 */
export const ADVISOR_VERSION = "1.0.0";

export const ADV = {
  MAX_FOCUS_PAIRS: 12,
  SINGLE_MOVES_PER_REQUEST: 12,
  BEAM_WIDTH: 5,
  MAX_EVALUATIONS: 600,
  RUN_TIME_BUDGET_MS: 8000,
  MAX_PLANS: 5,
  WHY_NOT_MAX: 5,
  SEQUENCE_GAPS: [7, 14, 30] as readonly number[],
  SHIFT_LIMIT_DAYS: 180,
  DISRUPTION_CAP_DAYS: 60,
  RECORD_MIN_SCORE: 40,
  CACHE_TTL_HOURS: 24,
  URGENT_DAYS: 7,
  COORDINATE_WITHIN_DAYS: 14,
  FEEDBACK_CAP: 100,
  WIZARD_SWEEP_DAYS: 180,
  /** Start offsets (days) tried for each request; chosen to cover just-clear, mid-window and far windows deterministically. */
  OFFSETS: [-90, -60, -45, -30, -21, -14, -10, -7, -5, -3, -2, -1, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120] as readonly number[],
} as const;

/** Sum 100. Each component is normalized to 0-100 before weighting. */
export const WEIGHTS = { riskReduction: 30, clearance: 20, collateral: 15, disruption: 15, fairness: 10, approvalBurden: 5, coordinationEffort: 5 } as const;
export type Component = keyof typeof WEIGHTS;

export const ARCHETYPES = ["fastest", "leastDisruption", "lowestRisk", "fairShare", "jointWorks"] as const;
export type Archetype = (typeof ARCHETYPES)[number];
export const MOVE_KINDS = ["shift_request", "sequence_pair", "set_hours", "joint_works", "start_coordination"] as const;
export const FEEDBACK_ACTIONS = ["helpful", "not_helpful", "dismissed", "handoff_used"] as const;
export const DISMISS_REASONS = ["not_feasible", "already_coordinated_offline", "disagree_with_assessment", "too_disruptive", "other"] as const;
export const EXCLUDE_CODES = ["start_in_past", "no_improvement", "creates_new_high_conflict", "disruption_too_high", "requires_national_approval_only_option"] as const;

/** Data-confidence deductions (a label, not a probability). */
export const CONF = { ASSUMPTION: 15, ASSUMPTION_CAP: 45, INCOMPLETE: 20, PAIRS_CAPPED: 10, TRUNCATED: 10, RULE_MISMATCH: 15, HIGH: 75, MEDIUM: 50 } as const;
