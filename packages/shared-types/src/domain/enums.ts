/** Domain enums copied from Step 13 module constants. Models remain the persistence source until a later migration imports these. */

export const PROJECT_TYPES = ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "MULTI_INFRASTRUCTURE", "OTHER"] as const;
export const PROJECT_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED"] as const;
export const MILESTONE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED", "BLOCKED", "CANCELLED"] as const;

export const WORK_TYPES = ["ROAD_RESURFACING", "ROAD_EXCAVATION", "PIPELINE_INSTALLATION", "ELECTRIC_CABLE_WORK", "TELECOM_CABLE_WORK", "DRAINAGE_WORK", "UTILITY_REPAIR", "BRIDGE_WORK", "OTHER"] as const;
export const WORK_STATUSES = ["DRAFT", "SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const WORK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const CONFLICT_TYPES = ["GEOGRAPHIC_OVERLAP", "NEARBY_WORK", "SCHEDULE_OVERLAP", "UTILITY_INTERFERENCE", "ACCESS_CONFLICT", "MULTI_FACTOR"] as const;
export const CONFLICT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const CONFLICT_STATUSES = ["OPEN", "COORDINATION_PENDING", "UNDER_REVIEW", "RESOLVED", "CLOSED", "DISMISSED"] as const;
export const COORDINATION_STATUSES = ["PENDING", "ACCEPTED", "COUNTER_PROPOSED", "REJECTED", "CANCELLED"] as const;

export const CONTRACTOR_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const CONTRACTOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const PAYMENT_TYPES = ["ADVANCE", "INTERIM", "FINAL", "RETENTION", "OTHER"] as const;
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED"] as const;

export const DOCUMENT_TYPES = ["CONTRACT", "TENDER", "BOQ", "INVOICE", "APPROVAL", "PROGRESS_REPORT", "INSPECTION_REPORT", "DRAWING", "OTHER"] as const;
export const DOCUMENT_PROCESSING_STATUSES = ["NOT_STARTED", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "UNSUPPORTED"] as const;
export const DOCUMENT_VISIBILITIES = ["INTERNAL", "PROJECT_TEAM", "PUBLIC"] as const;

export const INSPECTION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "REQUIRES_REVIEW", "REJECTED", "CANCELLED"] as const;

export const ASSET_TYPES = ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] as const;
export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"] as const;
export const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY", "ROUTINE", "OTHER"] as const;
export const MAINTENANCE_STATUSES = ["PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"] as const;

export const ISSUE_CATEGORIES = ["POTHOLE", "ROAD_DAMAGE", "WATER_LEAK", "DRAINAGE", "STREET_LIGHT", "UTILITY_DAMAGE", "PUBLIC_ASSET_DAMAGE", "OTHER"] as const;
export const ISSUE_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"] as const;
export const ISSUE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

export const NOTIFICATION_TYPES = ["CONFLICT", "COORDINATION", "RISK", "APPROVAL", "MILESTONE", "INSPECTION", "CITIZEN_ISSUE", "SYSTEM"] as const;
export const NOTIFICATION_RESOURCES = ["PROJECT", "WORK_REQUEST", "CONFLICT", "COORDINATION_REQUEST", "MILESTONE", "INSPECTION", "CITIZEN_ISSUE", "DOCUMENT", "PAYMENT", "ASSET", "RISK_ASSESSMENT"] as const;

export const RISK_FACTOR_CATEGORIES = ["DELAY", "BUDGET", "SCHEDULE", "PROGRESS", "COORDINATION", "OTHER"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type WorkType = (typeof WORK_TYPES)[number];
export type WorkStatus = (typeof WORK_STATUSES)[number];
export type WorkPriority = (typeof WORK_PRIORITIES)[number];
export type ConflictType = (typeof CONFLICT_TYPES)[number];
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];
export type CoordinationStatus = (typeof COORDINATION_STATUSES)[number];
export type ContractorRiskLevel = (typeof CONTRACTOR_RISK_LEVELS)[number];
export type ContractorStatus = (typeof CONTRACTOR_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentProcessingStatus = (typeof DOCUMENT_PROCESSING_STATUSES)[number];
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationResource = (typeof NOTIFICATION_RESOURCES)[number];
