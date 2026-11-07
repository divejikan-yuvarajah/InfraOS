export const ASSET_TYPES = ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] as const;
export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"] as const;
export const KNOWN_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"] as const;
export const OPERATIONAL_STATUSES = ["IN_SERVICE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DECOMMISSIONED"] as const;
export const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY", "ROUTINE", "OTHER"] as const;
export const MAINTENANCE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const MAINTENANCE_STATUSES = ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"] as const;
export const CONVERSION_STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const HEALTH_BANDS = ["GOOD", "WATCH", "POOR", "CRITICAL"] as const;
export const ISSUE_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const OUTCOMES = ["RESOLVED", "PARTIAL", "NOT_RESOLVED"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type KnownCondition = (typeof KNOWN_CONDITIONS)[number];
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export type ConversionStatus = (typeof CONVERSION_STATUSES)[number];
export type Basis = "INSPECTION_VERIFIED" | "MANUAL_ENTRY" | "LEGACY" | "NONE";
export type GateStatus = "PASS" | "WARN" | "BLOCK" | "SKIPPED";
export type Gate = { key: string; status: GateStatus; message: string; values?: Record<string, string | number | null> };

export type AssetRow = {
  id: string; assetNo: string | null; name: string; assetType: AssetType; agencyId: string; agencyName: string | null; district: string | null; condition: AssetCondition; conditionBasis: Basis;
  healthScore: number | null; healthLegacy: boolean; operationalStatus: OperationalStatus; origin: string; nextAssessmentDue: string; assessmentOverdue: boolean; nextMaintenanceAt: string | null; lastInspectionAt: string | null;
  attention: string[]; withinDlp: boolean; version: number;
};
export type AssetList = { rows: AssetRow[]; total: number; page: number; limit: number; facets: { condition: Record<string, number>; operationalStatus: Record<string, number>; assetType: Record<string, number> } };

export type AssetSummary = {
  total: number; byType: Record<string, number>; byCondition: Record<string, number>; byOperationalStatus: Record<string, number>; unassessed: number; attention: number;
  assessments: { overdue: number; dueSoon: number }; maintenance: { overdue: number; openRequests: number; upcoming30d: number }; pendingConversions: number | null;
  health: { restricted: true } | { available: number; total: number; distribution: Record<"CRITICAL" | "POOR" | "WATCH" | "GOOD", number> };
  workload: { month: string; planned: number; completed: number }[]; attentionList: AssetRow[];
};

export type HealthComponent = { key: "condition" | "openIssues" | "maintenance" | "assessmentTimeliness" | "hazardExposure"; score: number | null; weight: number; weightUsed: number; inputs: Record<string, string | number | boolean | null>; reasonKey: string };
export type Health = { restricted: true } | {
  version: string; availability: "AVAILABLE" | "INSUFFICIENT_EVIDENCE"; score: number | null; band: (typeof HEALTH_BANDS)[number] | null; caps: string[]; evidenceLevel: "LOW" | "MODERATE" | "GOOD" | null;
  basis: "INSPECTION_VERIFIED" | "MANUAL_ENTRY" | null; components: HealthComponent[]; weightsUsed: Record<string, number>; reasons: string[]; hints: string[];
};
export type Flag = { code: string; severity: "INFO" | "LOW" | "MEDIUM" | "HIGH"; params: Record<string, string | number> };
export type Issue = { key: string; title: string; severity: (typeof ISSUE_SEVERITIES)[number]; status: "OPEN" | "RESOLVED"; location?: string };
export type Assessment = { id: string; assessedAt: string; condition: KnownCondition; basis: "INSPECTION_VERIFIED" | "MANUAL_ENTRY"; status: "ACTIVE" | "SUPERSEDED"; observations: string | null; issues: Issue[]; inspectionId: string | null; assessedByName: string | null; reviewedByName: string | null; previousCondition: string | null };
export type MaintenanceLite = { id: string; maintenanceNo: string | null; title: string | null; maintenanceType: MaintenanceType; priority: MaintenancePriority; status: MaintenanceStatus; overdue: boolean; scheduledDate: string; completedDate: string | null; estimatedCostMinor: number | null; actualCostMinor: number | null; outcome: string | null };

export type AssetDetail = {
  id: string; assetNo: string | null; name: string; description: string | null; assetType: AssetType; origin: string; operationalStatus: OperationalStatus; owner: { id: string; name: string | null }; constructionAgency: { id: string; name: string | null } | null;
  location: { district?: string; province?: string; locality?: string; roadName?: string; description?: string } | null; hasGeometry: boolean; handoverAt: string | null; defectsLiabilityEndsOn: string | null; designLifeYears: number | null; monitoringIntervalDays: number; commissionedAt: string | null; version: number; sensitivity: string | null;
  condition: { value: AssetCondition; basis: Basis; lastAssessedAt: string | null; trend: string; declinePerYear: number | null; flags: Flag[]; rulesVersion: string };
  health: Health; assessments: Assessment[]; openIssues: Issue[]; maintenance: MaintenanceLite[]; repeatFailures: { flagged: boolean; count: number };
  costs: { estimatedMinor: number; actualMinor: number; currency: "LKR" };
  conversion: { id: string; conversionNo: string | null; status: string; handoverNote: string | null } | null;
  construction: { project: { id: string; projectCode: string; title: string; status: string; projectType: string; completedOn: string | null } | null; contractors?: { contractorId: string; name: string | null; role: string; status: string; contractReference: string | null }[]; finance?: { paidMinor: number; basis: string }; inspections?: Record<string, number>; documents?: { id: string; fileName: string; documentType: string }[] };
  can: { update: boolean; recordAssessment: boolean; requestMaintenance: boolean; viewHealth: boolean; export: boolean; requestVerifiedAssessment: boolean };
};
export type TimelineEvent = { at: string; source: string; type: string; ref: string | null; params: Record<string, string | number | null>; link: string | null };
export type Timeline = { events: TimelineEvent[]; nextCursor: string | null };

export type ConversionRow = { id: string; conversionNo: string | null; status: ConversionStatus; projectId: string; projectCode: string | null; projectTitle: string | null; agencyName: string | null; receivingAgencyName: string | null; requestedByName: string | null; requestedAt: string | null; decidedAt: string | null; assetCount: number; requestedByMe: boolean };
export type ConversionList = { rows: ConversionRow[]; total: number; page: number; limit: number; facets: Record<string, number> };
export type ProposedAsset = { key: string; assetType: AssetType; name: string; description?: string; location?: { district?: string; locality?: string; roadName?: string }; geometrySource: "PROJECT" | "NONE"; commissionedAt?: string; designLifeYears?: number; monitoringIntervalDays?: number };
export type ConversionDetail = {
  id: string; conversionNo: string | null; status: ConversionStatus; project: { id: string; projectCode: string; title: string; status: string } | null; agencyName: string | null; receivingAgencyId: string; receivingAgencyName: string | null;
  requestedByName: string | null; requestedAt: string | null; decidedByName: string | null; decidedAt: string | null; decisionNote: string | null;
  handover: { handoverDate: string | null; handoverNote: string | null; defectsLiabilityEndsOn: string | null; conditionAtHandover: AssetCondition; documents: { id: string; fileName: string; documentType: string }[] };
  proposedAssets: ProposedAsset[]; gateSnapshots: { at: string; evaluatedAt: string; gates: Gate[] }[]; liveGates: Gate[] | null; createdAssets: { id: string; assetNo: string | null; name: string; assetType: string }[]; version: number;
  can: { cancel: boolean; decide: boolean; decideBlockedReason: string | null };
};
export type ConversionPreview = {
  project: { id: string; projectCode: string; title: string; status: string; projectType: string }; gates: Gate[]; blocked: boolean; warnings: number;
  suggestions: { name: string; assetType: AssetType; hasGeometry: boolean; defaultMonitoringDays: number; receivingAgencyId: string }; documents: { id: string; fileName: string; documentType: string }[]; receivingOptions: { id: string; name: string }[];
};
export type ConvertibleProjects = { projects: { id: string; projectCode: string; title: string; projectType: string; verifiedPercent: number | null }[] };

export type MaintRow = {
  id: string; maintenanceNo: string | null; title: string | null; maintenanceType: MaintenanceType; priority: MaintenancePriority; status: MaintenanceStatus; overdue: boolean; scheduledDate: string; completedDate: string | null;
  assetId: string; assetNo: string | null; assetName: string | null; assetType: AssetType | null; estimatedCostMinor: number | null; actualCostMinor: number | null; taskCount: number; tasksDone: number; requestedByMe: boolean; version: number;
};
export type MaintList = { rows: MaintRow[]; total: number; page: number; limit: number; facets: Record<string, number> };
export type MaintCalendar = { rows: MaintRow[]; truncated: boolean; from: string; to: string; timezone: string };
export type MaintSummary = { counts: { requested: number; next7d: number; inProgress: number; overdue: number; completed30d: number; myOpenRequests: number }; oldestRequestAgeDays: number | null };
export type MaintTask = { key: string; title: string; done: boolean; skippedNote?: string };
export type MaintEvidence = { id: string; caption: string | null; capturedAt: string; uploadedAt: string; status: "PENDING_UPLOAD" | "ACTIVE" | "REMOVED"; width: number | null; height: number | null; sizeBytes: number; hasThumb: boolean; shaPrefix: string; uploadedByMe: boolean };
export type MaintDetail = {
  id: string; maintenanceNo: string | null; title: string | null; description: string | null; maintenanceType: MaintenanceType; priority: MaintenancePriority; origin: string; status: MaintenanceStatus; overdue: boolean;
  asset: { id: string; assetNo: string | null; name: string; assetType: AssetType; operationalStatus: OperationalStatus } | null; scheduledDate: string; completedDate: string | null; startedAt: string | null; requestedAt: string | null; decidedAt: string | null; decisionNote: string | null;
  requestedByName: string | null; decidedByName: string | null; completedByName: string | null; requestedByMe: boolean; assignedTeam: string | null; contractor: { id: string; name: string } | null; responsibleAgency: { id: string; name: string } | null;
  tasks: MaintTask[]; linkedIssueKeys: string[]; estimatedCostMinor: number | null; actualCostMinor: number | null; currency: "LKR"; completionNotes: string | null; outcome: string | null; cancelReason: string | null; recurrenceDays: number | null;
  emergencyAcknowledged: boolean; version: number; repeatFailures: { flagged: boolean; count: number }; evidence: MaintEvidence[];
  can: { edit: boolean; approve: boolean; approveBlockedReason: string | null; emergencySelfApproval: boolean; reject: boolean; schedule: boolean; start: boolean; complete: boolean; cancel: boolean; manageEvidence: boolean };
};

export type ScoreCard = { agencyId: string; agencyName: string | null; cases: number; open: number; overdueAcks: number; overdueResponses: number; agreementRate: number | null; medianAckHours: number | null; medianResponseHours: number | null; avgRounds: number | null; resolved: number; commitmentCompletion: number | null; healthScore: number | null; grade: string | null; availability: "OK" | "NOT_ENOUGH_CASES"; casesNeeded: number };
export type InsightsMeta = { minCases: number; minCohort: number; weights: Record<string, number>; grades: { min: number; code: string }[]; range: { key: string; from: string; to: string; days: number }; mapping: { key: string; source: string | null; unit: string; definitionKey: string | null }[]; notAvailable: string[] };
export type Benchmark = { cohort: number; medians: Record<string, number | null> } | null;
export type Insights = ({ level: "national"; items: ScoreCard[]; divider: number | null; sort: string; benchmark: Benchmark; benchmarkUnavailable: string | null; meta: InsightsMeta }) | ({ level: "agency"; own: ScoreCard; benchmark: Benchmark; benchmarkUnavailable: string | null; meta: InsightsMeta });
