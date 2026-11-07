export const ASSET_TYPES = ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] as const;
export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"] as const;
export const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY", "ROUTINE", "OTHER"] as const;
/** OVERDUE stays for compatibility but is never written: overdue is derived from the scheduled date and an open status. */
export const MAINTENANCE_STATUSES = ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED", "REJECTED"] as const;
export const ASSET_SENSITIVITIES = ["STANDARD", "RESTRICTED"] as const;

export const ASSET_OPERATIONAL_STATUSES = ["IN_SERVICE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DECOMMISSIONED"] as const;
export const ASSET_ORIGINS = ["CONVERSION", "ADDITION", "LEGACY"] as const;
export const MAINTENANCE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const MAINTENANCE_ORIGINS = ["REQUEST", "PLANNED", "CONDITION_TRIGGER", "INSPECTION_FINDING", "RECURRENCE"] as const;
export const MAINTENANCE_OUTCOMES = ["RESOLVED", "PARTIAL", "NOT_RESOLVED"] as const;
export const CONVERSION_STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const ASSESSMENT_BASES = ["INSPECTION_VERIFIED", "MANUAL_ENTRY"] as const;
export const ASSESSMENT_STATUSES = ["ACTIVE", "SUPERSEDED"] as const;
export const ISSUE_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const ISSUE_STATUSES = ["OPEN", "RESOLVED"] as const;
export const KNOWN_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type OperationalStatus = (typeof ASSET_OPERATIONAL_STATUSES)[number];
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

/** Condition scale. UNKNOWN has no score. */
export const CONDITION_SCORE: Record<(typeof KNOWN_CONDITIONS)[number], number> = { EXCELLENT: 95, GOOD: 80, FAIR: 60, POOR: 35, CRITICAL: 10 };
/** Ordinal steps for trend maths (higher is better). */
export const CONDITION_STEP: Record<(typeof KNOWN_CONDITIONS)[number], number> = { EXCELLENT: 5, GOOD: 4, FAIR: 3, POOR: 2, CRITICAL: 1 };

/** Default condition-assessment interval by type, editable within the bounds. */
export const DEFAULT_MONITORING_DAYS: Record<AssetType, number> = { ROAD: 365, WATER: 365, ELECTRICITY: 365, TELECOM: 365, DRAINAGE: 365, BRIDGE: 180, BUILDING: 365, PUBLIC_FACILITY: 365, OTHER: 365 };
export const MONITORING_MIN_DAYS = 30;
export const MONITORING_MAX_DAYS = 1825;
export const MAX_MAINTENANCE_EVIDENCE = 20;
export const MAX_PROPOSED_ASSETS = 10;

/** Project type to the asset type suggested in the conversion wizard (the user may change or split it). */
export const ASSET_TYPE_FOR_PROJECT: Record<string, AssetType> = { ROAD: "ROAD", BRIDGE: "BRIDGE", WATER: "WATER", ELECTRICITY: "ELECTRICITY", TELECOM: "TELECOM", DRAINAGE: "DRAINAGE", BUILDING: "BUILDING", PUBLIC_FACILITY: "PUBLIC_FACILITY" };
export const assetTypeForProject = (projectType: string): AssetType => ASSET_TYPE_FOR_PROJECT[projectType] ?? "OTHER";
