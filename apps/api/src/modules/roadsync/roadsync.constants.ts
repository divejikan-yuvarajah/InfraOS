export const WORK_TYPES = ["ROAD_RESURFACING", "ROAD_EXCAVATION", "PIPELINE_INSTALLATION", "ELECTRIC_CABLE_WORK", "TELECOM_CABLE_WORK", "DRAINAGE_WORK", "UTILITY_REPAIR", "BRIDGE_WORK", "OTHER"] as const;
export const WORK_STATUSES = ["DRAFT", "SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const WORK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const CONFLICT_TYPES = ["GEOGRAPHIC_OVERLAP", "NEARBY_WORK", "SCHEDULE_OVERLAP", "UTILITY_INTERFERENCE", "ACCESS_CONFLICT", "MULTI_FACTOR"] as const;
export const CONFLICT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const CONFLICT_STATUSES = ["OPEN", "COORDINATION_PENDING", "UNDER_REVIEW", "RESOLVED", "CLOSED", "DISMISSED"] as const;
export const COORDINATION_STATUSES = ["PENDING", "ACCEPTED", "COUNTER_PROPOSED", "REJECTED", "CANCELLED"] as const;

/** Steps 68-69 detection tuning. Fixed constants, not a settings surface. */
export const DETECTION = {
  PERSIST_RADIUS_M: 500,
  DEFAULT_VIEW_RADIUS_M: 250,
  VIEW_RADII_M: [50, 100, 250, 500],
  MIN_PREVIEW_RADIUS_M: 10,
  MAX_PREVIEW_RADIUS_M: 500,
  ADJACENT_DISTANCE_M: 25,
  ADJACENT_WINDOW_DAYS: 7,
  MAX_CANDIDATES_PERSISTED: 200,
  PREVIEW_MAX: 50,
  SHARED_LENGTH_SAMPLE_CAP: 2000,
  SAMPLE_STEP_M: 5,
  RUN_LOCK_TIMEOUT_MS: 2 * 60 * 1000,
  /** Work requests carry no stored buffer yet; the safety buffer defaults to the geometry itself. */
  DEFAULT_BUFFER_M: 0,
  MAX_BUFFER_M: 100,
} as const;
/** Work requests that count as scheduled activity for detection: submitted or later, not closed. */
export const DETECTION_ACTIVE_WORK_STATUSES = ["SUBMITTED", "PLANNED", "APPROVED", "ACTIVE"] as const;
export const DETECTION_ACTIVE_PROJECT_STATUSES = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED"] as const;
export const WORKING_HOURS = ["day", "night", "24h"] as const;
