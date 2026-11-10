import type {
  RiskChangeDto,
  RiskEvidenceBasis,
  RiskFactorCategory,
  RiskIndicatorDto,
  RiskLevel,
  RiskRecommendationDto,
  RiskSeverity,
  RiskSourceFreshnessDto,
  RiskSufficiency,
} from "@infraos/shared-types";

export interface SourceEnvelope<T> {
  available: boolean;
  asOf: Date | null;
  reasonKey?: string;
  data?: T;
}

export interface ProjectInputData {
  id: string;
  projectCode: string;
  title: string;
  status: string;
  agencyId: string;
  projectType: string;
  district?: string;
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  actualEndDate?: Date | null;
  budgetMinor: number;
  physicalProgress: number;
  financialProgress: number;
  verifiedProgress?: {
    percent: number;
    asOf: Date;
    verificationId: string;
  } | null;
  physicalBasis: RiskEvidenceBasis;
  contractorId?: string | null;
}

export interface MilestoneInputItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
}

export interface ProgressReportInputItem {
  id: string;
  reportedPercent: number;
  previousPercent: number;
  reportedAt: Date;
  sequence: number;
}

export interface DependencyInputItem {
  id: string;
  predecessorProjectId?: string | null;
  predecessorProjectCode?: string | null;
  predecessorMilestoneId?: string | null;
  predecessorMilestoneTitle?: string | null;
  predecessorStatus?: string | null;
  predecessorPlannedEnd?: Date | null;
  successorMilestoneId?: string | null;
  successorPlannedStart?: Date | null;
  isCriticalChain?: boolean;
}

export interface ProjectReviewsInputData {
  pendingReviewsCount: number;
  oldestPendingDays: number;
  items: Array<{
    id: string;
    type: string;
    submittedAt: Date;
    daysPending: number;
  }>;
}

export interface FinanceInputData {
  budgetMinor: number;
  spentMinor: number;
  committedMinor: number;
  approvedRevisionsCount: number;
  cumulativeBudgetIncreaseMinor: number;
  pendingRevisionsCount: number;
  oldestPendingRevisionDays: number;
  pendingPaymentApprovalsCount: number;
  oldestPendingPaymentApprovalDays: number;
  unverifiedExpensesCount: number;
  oldestUnverifiedExpenseDays: number;
  largestSingleTransactionMinor: number;
  trailingMonthlySpendMinor: number[]; // Last N full months
  last30DaysSpendMinor: number;
}

export interface InspectionsInputData {
  scheduledOverdueCount: number;
  oldestScheduledOverdueDays: number;
  openCriticalDefectsCount: number;
  oldestCriticalDefectDays: number;
  openMajorDefectsCount: number;
  oldestMajorDefectDays: number;
  verificationsAwaitingReviewCount: number;
  oldestVerificationAwaitingDays: number;
  totalCompletedInspectionsCount: number;
}

export interface ContractorInputData {
  assigned: boolean;
  contractorId?: string | null;
  contractorName?: string | null;
  priorClosedProjectsCount: number;
  priorProjectsDelayedCount: number;
  activeAssignmentsCount: number;
}

export interface RoadsyncConflictInputItem {
  conflictId: string;
  conflictNo: string;
  severityBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  openDays: number;
  affectedAgencyCount: number;
  affectedAgencyNames?: string[];
  coordinationStatus?: string | null;
  openCommitmentsCount?: number;
  coordinationOverdueDays?: number;
}

export interface RoadsyncInputData {
  conflicts: RoadsyncConflictInputItem[];
  unacknowledgedCoordinationCount: number;
  oldestUnacknowledgedDays: number;
  overdueCommitmentsCount: number;
  oldestOverdueCommitmentDays: number;
}

export interface HistoryInputData {
  comparableCount: number;
  medianDurationOverrunRatio: number; // e.g. 1.25 = 25% overrun
}

export interface RiskInputs {
  project: SourceEnvelope<ProjectInputData>;
  milestones: SourceEnvelope<MilestoneInputItem[]>;
  progressReports: SourceEnvelope<ProgressReportInputItem[]>;
  dependencies: SourceEnvelope<DependencyInputItem[]>;
  reviews: SourceEnvelope<ProjectReviewsInputData>;
  finance: SourceEnvelope<FinanceInputData>;
  inspections: SourceEnvelope<InspectionsInputData>;
  contractor: SourceEnvelope<ContractorInputData>;
  roadsync: SourceEnvelope<RoadsyncInputData>;
  history: SourceEnvelope<HistoryInputData>;
}

export interface CategoryResult {
  category: RiskFactorCategory;
  level: RiskLevel;
  index: number;
  sufficiency: RiskSufficiency;
  missing: string[];
}

export interface RiskResult {
  engineVersion: string;
  applicable: boolean;
  notApplicableReason?: string;
  overallLevel: RiskLevel;
  overallIndex?: number;
  categories: CategoryResult[];
  indicators: RiskIndicatorDto[];
  sourceFreshness: RiskSourceFreshnessDto[];
  missingData: string[];
  recommendations: RiskRecommendationDto[];
  changes: RiskChangeDto[];
  levelChange?: {
    from: RiskLevel;
    to: RiskLevel;
  };
  inputsHash: string;
}

