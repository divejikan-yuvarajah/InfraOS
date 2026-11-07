export const INSPECTION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "REQUIRES_REVIEW", "REJECTED", "CANCELLED"] as const;
export const INSPECTION_TYPES = ["PROGRESS_VERIFICATION", "QUALITY", "SAFETY", "MILESTONE", "FINAL_HANDOVER", "FOLLOW_UP"] as const;
export const INSPECTION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const CHECKLIST_RESULTS = ["PASS", "FAIL", "NA", "NOT_CHECKED"] as const;
export const DEFECT_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const DECISIONS = ["APPROVED", "REVISION_REQUESTED", "REJECTED"] as const;
export const EVIDENCE_STATUSES = ["PENDING_UPLOAD", "ACTIVE", "REMOVED"] as const;
export const VERIFICATION_STATUSES = ["ACTIVE", "SUPERSEDED"] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type InspectionType = (typeof INSPECTION_TYPES)[number];

/** Types whose approval changes verified progress (they must carry a measured percentage). */
export const PROGRESS_TYPES: readonly InspectionType[] = ["PROGRESS_VERIFICATION", "MILESTONE", "FINAL_HANDOVER"];
export const TERMINAL_STATUSES: readonly InspectionStatus[] = ["VERIFIED", "REJECTED", "CANCELLED"];

/** Verified vs claimed difference (percentage points) above which a note and reviewer acknowledgement are required. */
export const DISCREPANCY_THRESHOLD_PP = 10;
export const START_WINDOW_HOURS = 24;
export const MAX_SUBMISSIONS = 6;
export const MAX_EVIDENCE = 30;
export const MAX_FULL_BYTES = 4 * 1024 * 1024;
export const MAX_THUMB_BYTES = 150 * 1024;
export const CHECKLIST_VERSION = "k1";
export const SITE_ON_M = 300;
export const SITE_NEAR_M = 1500;
export const PROJECT_STATUSES_FOR_SCHEDULING = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"] as const;
export const PROJECT_STATUSES_FOR_VERIFICATION = ["ACTIVE", "DELAYED", "ON_HOLD", "COMPLETED"] as const;
