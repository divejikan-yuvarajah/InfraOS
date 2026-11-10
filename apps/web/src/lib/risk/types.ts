import type {
  RiskAssessmentDto,
  RiskCategoryDeltaDto,
  RiskCategorySummaryDto,
  RiskChangeDto,
  RiskComparisonDto,
  RiskEvidenceBasis,
  RiskEvidenceRefDto,
  RiskFactorCategory,
  RiskHistoryItemDto,
  RiskIndicatorDto,
  RiskLevel,
  RiskMethodologyDto,
  RiskOverviewDto,
  RiskProjectRowDto,
  RiskProjectsListDto,
  RiskRecommendationDto,
  RiskResolutionDto,
  RiskResolutionEventDto,
  RiskResolutionStatus,
  RiskRunDto,
  RiskScatterPointDto,
  RiskSeverity,
  RiskSourceFreshnessDto,
  RiskSufficiency,
} from "@infraos/shared-types";

export type {
  RiskAssessmentDto,
  RiskCategoryDeltaDto,
  RiskCategorySummaryDto,
  RiskChangeDto,
  RiskComparisonDto,
  RiskEvidenceBasis,
  RiskEvidenceRefDto,
  RiskFactorCategory,
  RiskHistoryItemDto,
  RiskIndicatorDto,
  RiskLevel,
  RiskMethodologyDto,
  RiskOverviewDto,
  RiskProjectRowDto,
  RiskProjectsListDto,
  RiskRecommendationDto,
  RiskResolutionDto,
  RiskResolutionEventDto,
  RiskResolutionStatus,
  RiskRunDto,
  RiskScatterPointDto,
  RiskSeverity,
  RiskSourceFreshnessDto,
  RiskSufficiency,
};

// Aliases for convenience
export type RiskBasis = RiskEvidenceBasis;
export type RiskScatterItemDto = RiskScatterPointDto;
export type RiskProjectListItemDto = RiskProjectRowDto;
export type RiskEvidenceItemDto = RiskEvidenceRefDto;
export type RiskChangeItemDto = RiskChangeDto;

export interface ProjectLatestRiskResponse {
  assessment: RiskAssessmentDto | null;
  resolutions: RiskResolutionDto[];
  canAssess: boolean;
  canResolve: boolean;
}

export type RiskListFilters = {
  q?: string;
  agencyId?: string;
  projectType?: string;
  status?: string;
  level?: string; // CSV of levels e.g. "HIGH,CRITICAL"
  category?: string; // Category with >= HIGH indicator
  sufficiency?: string;
  resolution?: string; // "unacknowledged" | "acknowledged" | "reopened"
  stale?: boolean;
  district?: string;
  sort?: "level" | "index" | "assessedAt" | "title" | "gap";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type ResolutionFormValues = {
  status: RiskResolutionStatus;
  note: string;
  assignedTo?: string;
  reviewAt?: string;
};
