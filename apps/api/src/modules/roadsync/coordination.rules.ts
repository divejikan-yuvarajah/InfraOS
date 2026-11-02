/** Steps 74-75 coordination rules. ONE small module; fixed constants, not a settings surface. Codes are i18n keys. */
export const COORD = {
  MAX_ACTIVE_PER_CONFLICT: 3,
  MAX_PARTICIPANTS: 8,
  MAX_ROUNDS: 5,
  DEADLINE_MIN_DAYS: 1,
  DEADLINE_MAX_DAYS: 30,
  DEADLINE_WARN_DAYS_BEFORE_START: 3,
  EXTEND_MAX_DAYS: 7,
  NUDGE_COOLDOWN_HOURS: 24,
  NUDGES_MAX: 20,
  SUMMARY_MAX: 1000,
  NOTE_MAX: 500,
  MESSAGE_MAX: 1000,
  MESSAGES_PER_REQUEST_MAX: 500,
  MESSAGE_PAGE_MAX: 50,
  CONDITIONS_MAX: 5,
  CONDITION_TEXT_MAX: 200,
  SLOTS_MAX: 3,
  SHIFT_LIMIT_DAYS: 180,
  DURATION_CHANGE_PCT: 25,
  MAX_DURATION_DAYS: 1095,
  EVENTS_MAX: 300,
  REASON_MIN_CHARS: 10,
  LIST_MAX: 50,
  MESSAGE_NOTIFY_WINDOW_MIN: 15,
} as const;

export const DEADLINE_DEFAULT_DAYS = { critical: 2, high: 4, medium: 7, low: 7, info: 7, opportunity: 10 } as const;

export const PROPOSAL_TYPES = ["schedule_shift", "working_hours", "joint_works", "sequence_order", "traffic_management", "information_request", "site_meeting"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];
/** A counter may switch type only inside this group; everything else must keep its type. */
export const COMPATIBLE_GROUP: readonly ProposalType[] = ["schedule_shift", "working_hours", "sequence_order"];

export const DECISIONS = ["accepted", "accepted_with_conditions", "counter_proposed", "needs_info", "declined"] as const;
export type Decision = (typeof DECISIONS)[number];
export const STANCES = ["proposer", "pending", "accepted", "conditional", "countered", "needs_info", "declined"] as const;
export type Stance = (typeof STANCES)[number];
export const STANCE_OF: Record<Decision, Stance> = { accepted: "accepted", accepted_with_conditions: "conditional", counter_proposed: "countered", needs_info: "needs_info", declined: "declined" };

export const CONDITION_CODES = ["night_work_only", "traffic_management_plan", "cost_sharing_agreed", "notice_period_7d", "joint_inspection", "other"] as const;
export const DECLINE_REASONS = ["infeasible_schedule", "budget_constraint", "safety_concern", "technical_constraint", "already_committed", "disagree_with_assessment", "other"] as const;
export const TRAFFIC_MEASURES = ["flaggers", "night_work", "lane_staging", "detour_signage", "temporary_signals", "public_notice"] as const;

export const REQUEST_STATUSES = ["awaiting_response", "negotiating", "agreed", "no_agreement", "withdrawn"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const ACTIVE_REQUEST: readonly RequestStatus[] = ["awaiting_response", "negotiating"];
export const REQUEST_EVENTS = ["created", "round_opened", "response", "counter_proposed", "conditions_confirmed", "needs_info", "info_provided", "nudged", "escalated", "deescalated", "agreed", "closed_no_agreement", "withdrawn", "revised", "auto_withdrawn", "deadline_extended"] as const;
export type RequestEvent = (typeof REQUEST_EVENTS)[number];
