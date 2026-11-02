/**
 * Steps 72-73 record rules. ONE small module; fixed constants, not a settings surface.
 * Reason codes are i18n keys, never server prose.
 */
import type { Band } from "./assessment.rules.js";

export const RECORD = {
  RECORD_MIN_SCORE: 40,
  OPPORTUNITY_MIN_TRENCH_M: 100,
  THIRD_PARTY_RADIUS_M: 100,
  THIRD_PARTY_WINDOW_DAYS: 7,
  ASSET_MIN_RADIUS_M: 25,
  MAX_AFFECTED_AGENCIES: 12,
  RELATED_RADIUS_M: 150,
  EVENTS_MAX: 300,
  NOTES_MAX: 100,
  HISTORY_MAX: 100,
  WATCHERS_MAX: 200,
  BULK_ACK_MAX: 25,
  EXPORT_MAX_ROWS: 5000,
  DISMISS_REOPEN_BAND_STEPS: 1,
  HISTORY_MIN_SCORE_DELTA: 5,
  MAP_FEATURE_CAP: 200,
  LIST_MAX: 50,
  NOTE_MAX_CHARS: 1000,
  ACK_NOTE_MAX_CHARS: 300,
  REASON_MIN_CHARS: 10,
} as const;

/** Calendar hours to acknowledge, by band at the moment the agency joined (info is never recorded). */
export const ACK_SLA_HOURS: Record<Band, number> = { critical: 24, high: 48, medium: 120, low: 240, info: 240 };

export const AGENCY_ROLES = ["requesting", "counterpart", "asset_owner", "third_party"] as const;
export type AgencyRole = (typeof AGENCY_ROLES)[number];
export const REQUIRED_ROLES: readonly AgencyRole[] = ["requesting", "counterpart", "asset_owner"];

export const REASON_CODES = ["owns_this_request", "owns_other_request", "owns_asset_in_footprint", "third_party_work_nearby", "manually_added"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const RECORD_STATUSES = ["open", "acknowledged", "awaiting_response", "negotiating", "escalated", "resolved", "dismissed", "auto_closed", "withdrawn"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];
/** Only these are reachable in Steps 72-73; the rest are reserved enum values for Steps 74-77. */
export const IMPLEMENTED_STATUSES: readonly RecordStatus[] = ["open", "acknowledged", "dismissed", "auto_closed"];
export const OPEN_LIKE: readonly RecordStatus[] = ["open", "acknowledged", "awaiting_response", "negotiating", "escalated"];
/** Statuses driven by the acknowledgement rule; the coordination states are driven by recomputeRecordCoordination. */
export const ACK_DRIVEN: readonly RecordStatus[] = ["open", "acknowledged"];

export const EVENT_TYPES = ["detected", "agency_added", "agency_removed", "agency_excluded", "agency_restored", "severity_changed", "acknowledged", "lead_set", "dismissed", "reopened", "auto_closed", "redetected", "note_added", "override_applied", "coordination_started", "coordination_state_changed"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
