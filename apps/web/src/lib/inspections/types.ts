export const INSPECTION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "REQUIRES_REVIEW", "REJECTED", "CANCELLED"] as const;
export const INSPECTION_TYPES = ["PROGRESS_VERIFICATION", "QUALITY", "SAFETY", "MILESTONE", "FINAL_HANDOVER", "FOLLOW_UP", "ASSET_CONDITION"] as const;
export const INSPECTION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const CHECKLIST_RESULTS = ["PASS", "FAIL", "NA", "NOT_CHECKED"] as const;
export const DEFECT_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const DISCREPANCY_THRESHOLD_PP = 10;
export const PROGRESS_TYPES: readonly InspectionType[] = ["PROGRESS_VERIFICATION", "MILESTONE", "FINAL_HANDOVER"];

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type InspectionType = (typeof INSPECTION_TYPES)[number];
export type InspectionPriority = (typeof INSPECTION_PRIORITIES)[number];
export type ChecklistResult = (typeof CHECKLIST_RESULTS)[number];
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

export type InspectionRow = {
  id: string; inspectionNo: string | null; projectId: string; projectCode: string | null; projectTitle: string | null; agencyId: string | null;
  inspectionType: InspectionType; priority: InspectionPriority; status: InspectionStatus; inspectionDate: string; durationMinutes: number;
  inspectorId: string; inspectorName: string | null; overdue: boolean; evidenceCount: number; submissionCount: number;
  claimedProgress: number | null; measuredProgress: number | null; discrepancyPp: number | null; version: number;
  dueIn24h?: boolean; canStart?: boolean;
};
export type InspectionList = { rows: InspectionRow[]; total: number; page: number; limit: number; facets: Record<string, number> };
export type CalendarPayload = { rows: InspectionRow[]; truncated: boolean; from: string; to: string; timezone: string };

export type Summary = {
  counts: { upcoming7d: number; inProgress: number; awaitingReview: number; revisionRequired: number; overdue: number; verified30d: number };
  turnaround: { medianHours: number | null; sample: number; enough: boolean };
  outcomes: Record<string, number>;
  verificationGaps: { projectId: string; projectCode: string | null; projectTitle: string | null; inspectionId: string; claimedPercent: number | null; verifiedPercent: number; discrepancyPp: number; asOf: string | null }[];
  needsAction: InspectionRow[];
};

export type MyWork = { today: InspectionRow[]; upcoming: InspectionRow[]; overdue: InspectionRow[]; inProgress: InspectionRow[]; revisions: InspectionRow[]; recentDecisions: InspectionRow[]; asOf: string };

export type InspectorOption = { id: string; name: string; agencyId: string; agencyName: string | null; openCount: number; upcoming14dCount: number; nextInspectionAt: string | null; conflicts: { inspectionNo: string | null; at: string }[] };

export type ChecklistItem = { key: string; group: string; mandatory: boolean };
export type ChecklistEntry = { key: string; result: ChecklistResult; note?: string };
export type Defect = { key: string; title: string; description?: string; severity: DefectSeverity; location?: string; reworkRequired: boolean };
export type MilestoneAssessment = { milestoneId: string; verifiedProgress: number; note?: string };
export type Report = {
  revision: number; checklistVersion?: string; checklist: ChecklistEntry[]; siteObservations?: string; workCompletionObservations?: string; safetyObservations?: string;
  defects: Defect[]; followUpChecks: { parentInspectionId: string; defectKey: string; resolved: boolean; note?: string }[]; recommendations?: string;
  followUpRequired: boolean; followUpNote?: string; measuredProgress?: number; milestoneAssessments: MilestoneAssessment[]; discrepancyNote?: string; inspectorDeclaration: boolean;
};

export type SitePresence = { distanceM: number; status: "ON_SITE" | "NEAR_SITE" | "AWAY"; basis: "project_geometry" | "inspection_site_point" };
export type EvidenceItem = {
  id: string; caption: string | null; checklistItemKey: string | null; defectKey: string | null; capturedAt: string; uploadedAt: string; status: "PENDING_UPLOAD" | "ACTIVE" | "REMOVED";
  width: number | null; height: number | null; sizeBytes: number; hasThumb: boolean; shaPrefix: string; sitePresence: SitePresence | null; hasLocation: boolean; uploadedByMe: boolean;
};
export type Decision = { decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED"; byName: string | null; at: string; note: string | null; itemComments: { itemKey: string; comment: string }[] };
export type Submission = { no: number; submittedAt: string; submittedByName: string | null; report: Report; decision: Decision | null };

export type InspectionDetail = {
  id: string; inspectionNo: string | null;
  project: { id: string; projectCode: string; title: string; status: string; reportedProgress: number; verifiedProgress: { percent: number; asOf: string | null } | null } | null;
  agencyId: string | null; inspectionType: InspectionType; priority: InspectionPriority; purpose: string | null; locationNote: string | null; sitePoint: { lon: number; lat: number } | null;
  status: InspectionStatus; overdue: boolean; inspectionDate: string; durationMinutes: number; inspector: { id: string; name: string | null }; scheduledByName: string | null; milestoneIds: string[];
  followUpOfId: string | null; claimedProgressAtSchedule: number | null; measuredProgress: number | null; version: number;
  startedAt: string | null; submittedAt: string | null; reviewedAt: string | null; completedAt: string | null; cancelReason: string | null;
  report: Report | null; checklist: { version: string; items: ChecklistItem[] }; contractors: { id: string; name: string }[]; submissions: Submission[];
  assignmentHistory: { inspectorName: string | null; assignedByName: string | null; assignedAt: string; reason: string | null }[];
  rescheduleHistory: { from: string; to: string; byName: string | null; at: string; reason: string }[];
  evidence: EvidenceItem[];
  verification: { verifiedPercent: number; claimedPercent: number | null; discrepancyPp: number | null; status: string; asOf: string | null; milestones: { milestoneId: string; claimedProgress?: number; verifiedProgress: number }[] } | null;
  can: { edit: boolean; reschedule: boolean; reassign: boolean; cancel: boolean; start: boolean; editReport: boolean; decide: boolean; decideBlockedReason: string | null; approve: boolean; reject: boolean; followUp: boolean };
};

export type ProjectInspections = { rows: InspectionRow[]; latestVerification: { verifiedPercent: number; claimedPercent: number | null; discrepancyPp: number | null; asOf: string | null; inspectionId: string } | null; openFindings: { key: string; title: string; severity: string; inspectionNo: string | null }[] };
export type VerifiedSeries = { verified: { percent: number; claimed: number | null; discrepancyPp: number | null; asOf: string | null; status: string; inspectionId: string }[]; reported: { percent: number; at: string | null; label: string }[] };
export type ContractorOutcomes = {
  contractorId: string; basedOn: string;
  inspections: { id: string; inspectionNo: string | null; projectId: string; projectCode: string | null; status: string; inspectionDate: string; inspectionType: InspectionType; revisionCycles: number; defects: { minor: number; major: number; critical: number; rework: number } }[];
  verifications: { inspectionId: string; projectId: string; verifiedPercent: number; claimedPercent: number | null; discrepancyPp: number | null; asOf: string; status: string }[];
};
