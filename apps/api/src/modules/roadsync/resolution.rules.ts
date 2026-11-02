/**
 * Steps 76-77 rules. ONE small module; fixed constants, not a settings surface. Codes are i18n keys, never server prose.
 */
export const RES = {
  APPROVAL_DUE_DAYS: 3,
  DIRECTIVE_DEFAULT_DAYS: 5,
  DIRECTIVE_MIN_DAYS: 1,
  DIRECTIVE_MAX_DAYS: 30,
  NATIONAL_APPROVAL_SHIFT_DAYS: 60,
  VERIFY_DELAY_MINUTES: 10,
  MAX_AMENDMENTS: 4,
  COMMITMENTS_MAX: 10,
  JUSTIFICATION_MIN: 30,
  REASON_MIN: 10,
  REVISIONS_MAX: 20,
  EVENTS_MAX: 300,
  RISK_ACCEPT_FOUR_EYES: true,
  MAX_DURATION_DAYS: 36 * 31,
  JUSTIFICATION_MAX: 1000,
  MITIGATION_TEXT_MAX: 200,
  LIST_MAX: 50,
} as const;

export const LEDGER = { PAGE_MAX: 100, REPLAY_MAX_ENTRIES: 1000, VERIFY_BATCH_MAX: 25, EXPORT_MAX_ROWS: 5000, VERIFY_AUDIT_WINDOW_MS: 5 * 60_000 } as const;

export const RESOLUTION_TYPES = ["amendment", "directive", "risk_acceptance", "no_action", "opportunity"] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
export const RESOLUTION_STATUSES = ["draft", "pending_approval", "approved", "applying", "verifying", "resolved", "needs_followup", "cancelled"] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];
/** Statuses that hold the one-active-resolution-per-conflict slot. */
export const ACTIVE_RESOLUTION: readonly ResolutionStatus[] = ["draft", "pending_approval", "approved", "applying", "verifying", "needs_followup"];
export const IN_FLIGHT: readonly ResolutionStatus[] = ["applying", "verifying"];

export const AMENDMENT_STATUSES = ["draft", "pending_approval", "approved", "rejected", "applied", "cancelled", "stale"] as const;
export type AmendmentStatus = (typeof AMENDMENT_STATUSES)[number];
export const AMENDMENT_SOURCES = ["agreed_terms", "directive", "manual"] as const;
export type AmendmentSource = (typeof AMENDMENT_SOURCES)[number];

export const APPROVAL_STEPS = ["agency_admin", "party_confirmation", "national", "national_second"] as const;
export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

export const NO_ACTION_CODES = ["false_positive_geometry", "different_depth_levels", "already_coordinated_offline", "works_completed_or_withdrawn", "other"] as const;
export const MITIGATION_CODES = ["traffic_management_plan", "night_work_only", "flagger_deployment", "public_notice", "enhanced_supervision", "utility_locating_survey", "daily_coordination_call", "other"] as const;
export const VERIFY_RESULTS = ["pending", "cleared", "reduced", "unchanged", "worse", "delayed"] as const;
export type VerifyResult = (typeof VERIFY_RESULTS)[number];
export const OUTCOME_CODES = ["amendment_cleared", "risk_accepted", "no_action", "opportunity_realized", "directive_cleared"] as const;
export type OutcomeCode = (typeof OUTCOME_CODES)[number];

/** Canonical ledger action codes (also the i18n keys under roadsync.ledger.*). */
export const LEDGER_ACTIONS = [
  "ledger_started", "record_detected", "severity_changed", "agency_added", "agency_removed", "agency_excluded", "agency_restored", "acknowledged", "lead_set", "dismissed", "reopened", "auto_closed", "redetected",
  "coordination_created", "coordination_response", "coordination_counter", "coordination_conditions_confirmed", "coordination_agreed", "coordination_closed_no_agreement", "coordination_withdrawn", "coordination_escalated",
  "coordination_deescalated", "coordination_nudged", "deadline_extended", "resolution_started", "amendment_created", "amendment_submitted", "approval_granted", "approval_rejected", "amendment_applied", "amendment_stale",
  "amendment_cancelled", "directive_issued", "directive_contested", "commitment_done", "commitment_waived", "verification_completed", "resolution_resolved", "resolution_followup", "resolution_cancelled", "risk_accepted",
  "risk_reopened", "note_added", "export_generated", "integrity_verified",
] as const;
export type LedgerAction = (typeof LEDGER_ACTIONS)[number];
