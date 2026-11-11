import type {
  DiscrepancySeverity,
  InspectorDecision,
  VisionAnalysisResult,
  VisionAnalysisStatus,
  VisionConsistency,
  VisionImageResult,
  VisionPotentialDiscrepancy,
  VisionQualityIssue,
} from "@infraos/shared-types";

export type {
  DiscrepancySeverity,
  InspectorDecision,
  VisionAnalysisResult,
  VisionAnalysisStatus,
  VisionConsistency,
  VisionImageResult,
  VisionPotentialDiscrepancy,
  VisionQualityIssue,
};

export type QualityCheckSeverity = "INFO" | "WARNING" | "CRITICAL";

export type QualityCheckItemDto = {
  code: string;
  severity: QualityCheckSeverity;
  message: string;
  evidenceId?: string;
  details?: Record<string, unknown>;
};

export type QualityChecksOutputDto = {
  checks: QualityCheckItemDto[];
  coverage: {
    totalPhotos: number;
    milestonesWithEvidence: number;
    totalMilestones: number;
    uncoveredMilestones: string[];
  };
  metadataNote: string;
};

export type SelectableEvidenceDto = {
  evidenceId: string;
  sha256: string;
  capturedAt: string;
  uploadedAt?: string;
  sitePresence?: {
    distanceM: number;
    status: "ON_SITE" | "NEAR_SITE" | "AWAY";
    basis: "project_geometry" | "inspection_site_point";
  } | null;
  checklistItemKey?: string | null;
  defectKey?: string | null;
  width?: number | null;
  height?: number | null;
};

export type VisionEligibilityDto = {
  visionEnabled: boolean;
  eligible: boolean;
  role: "INSPECTOR" | "REVIEWER" | "NONE";
  ineligibleReason?: string;
  selectableEvidence: SelectableEvidenceDto[];
  qualityPreview: QualityChecksOutputDto;
  estimatedCostUnits: number;
  maxImages: number;
};

export type InspectionAiAnalysisView = {
  id: string;
  analysisNo: string;
  inspectionId: string;
  projectId: string;
  agencyId: string;
  requestedBy: string;
  requestedByRole: "INSPECTOR" | "REVIEWER";
  evidence: Array<{
    evidenceId: string;
    sha256: string;
    capturedAt?: string;
    sitePresence?: {
      distanceM: number;
      status: "ON_SITE" | "NEAR_SITE" | "AWAY";
      basis: "project_geometry" | "inspection_site_point";
    } | null;
  }>;
  contextHash: string;
  status: VisionAnalysisStatus;
  errorCode?: string;
  result?: VisionAnalysisResult;
  qualityChecks: QualityChecksOutputDto;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    images: number;
    estimatedCostMinor?: number;
  };
  inspectorReview: {
    status: "PENDING" | "REVIEWED";
    decisions: Record<string, { decision: InspectorDecision; comment?: string }>;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  supersededBy?: string;
  createdAt: string;
};

export type ReviewDecisionsPayload = {
  decisions: Record<string, { decision: InspectorDecision; comment?: string }>;
};

export type InsertedObservationDto = {
  key: string;
  text: string;
};

