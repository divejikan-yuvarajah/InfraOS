/** Phase 10 Batch 12 — Infrastructure Copilot, Vision Analysis, and AI Governance contracts. */

// ---------------------------------------------------------------- Copilot enums and contracts

export const COPILOT_TURN_STATUSES = [
  "RUNNING",
  "ANSWERED",
  "PARTIAL",
  "INSUFFICIENT_EVIDENCE",
  "FAILED",
  "CANCELLED",
  "BLOCKED_BY_POLICY",
] as const;
export type CopilotTurnStatus = (typeof COPILOT_TURN_STATUSES)[number];

export const COPILOT_STEP_KINDS = ["PLAN", "TOOL", "VERIFY", "COMPOSE"] as const;
export type CopilotStepKind = (typeof COPILOT_STEP_KINDS)[number];

export const COPILOT_STEP_STATUSES = ["OK", "DENIED", "ERROR", "SKIPPED"] as const;
export type CopilotStepStatus = (typeof COPILOT_STEP_STATUSES)[number];

export const COPILOT_PAGE_TYPES = [
  "PROJECT",
  "RISK",
  "INSPECTION",
  "DOCUMENT",
  "ASSET",
  "CONTRACTOR",
  "CONFLICT",
  "DASHBOARD",
  "OTHER",
] as const;
export type CopilotPageType = (typeof COPILOT_PAGE_TYPES)[number];

export const FACT_BASES = ["VERIFIED", "REPORTED", "RECORDED"] as const;
export type FactBasis = (typeof FACT_BASES)[number];

export const TOOL_RESULT_STATUSES = ["OK", "DENIED", "NOT_FOUND", "UNAVAILABLE", "ERROR"] as const;
export type ToolResultStatus = (typeof TOOL_RESULT_STATUSES)[number];

export type FactRef = {
  type: string;
  id: string;
  label: string;
};

export type CopilotFact = {
  id: string;
  label: string;
  value: string | number | boolean;
  unit?: string;
  asOf?: string;
  ref?: FactRef;
  basis?: FactBasis;
  untrusted?: boolean;
  redacted?: boolean;
};

export type CopilotToolResult = {
  status: ToolResultStatus;
  facts: CopilotFact[];
  truncated?: boolean;
  message?: string;
};

export type CopilotStepDto = {
  at: string;
  kind: CopilotStepKind;
  tool?: string;
  status: CopilotStepStatus;
  labelKey: string;
  durationMs: number;
};

export type CopilotSourceDto = {
  n: number;
  type: string;
  recordId?: string;
  label: string;
  link: string;
  asOf?: string;
  tool: string;
};

export type CopilotClaimDto = {
  text: string;
  sourceRefs: number[];
  supported: boolean;
};

export type CopilotAnswerDto = {
  text: string;
  claims: CopilotClaimDto[];
};

export type CopilotEvidenceSummaryDto = {
  level: "VERIFIED" | "PARTIAL" | "NONE";
  unverifiedFigures: string[];
  droppedClaims: number;
};

export type CopilotTurnDto = {
  id: string;
  threadId: string;
  message: string;
  pageContext?: {
    type: CopilotPageType;
    recordId?: string;
    route: string;
  };
  status: CopilotTurnStatus;
  steps: CopilotStepDto[];
  answer?: CopilotAnswerDto;
  sources: CopilotSourceDto[];
  evidence?: CopilotEvidenceSummaryDto;
  toolsUsed: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model?: string;
  latencyMs?: number;
  errorCode?: string;
  feedback?: {
    rating: "HELPFUL" | "NOT_HELPFUL";
    reason?: string;
    comment?: string;
  };
  createdAt: string;
};

export type QuickFactsDto = {
  projectId?: string;
  asOf: string;
  status?: string;
  progressReported?: number;
  progressVerified?: number;
  progressBasis?: string;
  financialSpentMinor?: number;
  financialBudgetMinor?: number;
  financialPercent?: number;
  physicalPercent?: number;
  riskLevel?: string;
  riskIndicators?: Array<{ code: string; label: string; level: string }>;
  openConflictsCount?: number;
  overdueMilestonesCount?: number;
  latestInspection?: { outcome?: string; date?: string; verifiedPercent?: number };
  overdueMaintenanceCount?: number;
  links: Array<{ label: string; route: string }>;
};

// ---------------------------------------------------------------- Vision Analysis enums and contracts

export const VISION_ANALYSIS_STATUSES = ["QUEUED", "RUNNING", "READY", "FAILED"] as const;
export type VisionAnalysisStatus = (typeof VISION_ANALYSIS_STATUSES)[number];

export const VISION_CONSISTENCIES = [
  "CONSISTENT",
  "PARTIALLY_CONSISTENT",
  "INCONSISTENT",
  "INDETERMINATE",
] as const;
export type VisionConsistency = (typeof VISION_CONSISTENCIES)[number];

export const VISION_QUALITY_ISSUES = [
  "BLURRY",
  "DARK",
  "OVEREXPOSED",
  "PARTIAL_VIEW",
  "NO_SCALE_REFERENCE",
  "OBSTRUCTED",
  "LOW_RESOLUTION",
  "OTHER",
] as const;
export type VisionQualityIssue = (typeof VISION_QUALITY_ISSUES)[number];

export const DISCREPANCY_SEVERITIES = ["LOW", "MODERATE", "HIGH"] as const;
export type DiscrepancySeverity = (typeof DISCREPANCY_SEVERITIES)[number];

export const INSPECTOR_DECISIONS = ["CONFIRMED", "DISPUTED", "NOT_RELEVANT"] as const;
export type InspectorDecision = (typeof INSPECTOR_DECISIONS)[number];

export type VisionVisibleIndicator = {
  label: string;
  certainty: "CLEAR" | "POSSIBLE";
};

export type VisionImageResult = {
  n: number;
  activityDescription: string;
  visibleWorkIndicators: VisionVisibleIndicator[];
  qualityIssues: VisionQualityIssue[];
  notes?: string;
};

export type VisionPotentialDiscrepancy = {
  statement: string;
  imageNs: number[];
  severity: DiscrepancySeverity;
};

export type VisionOverallResult = {
  consistencyWithReportedStage: VisionConsistency;
  rationale: string;
};

export type VisionAnalysisResult = {
  images: VisionImageResult[];
  overall: VisionOverallResult;
  potentialDiscrepancies: VisionPotentialDiscrepancy[];
  cannotBeDetermined: string[];
  questionsForInspector: string[];
  droppedStatements?: number;
};

export type EvidenceQualityCheck = {
  code: string;
  labelKey: string;
  passed: boolean;
  details?: string;
  metadataWarning?: boolean;
};

export type InspectionAiAnalysisDto = {
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
    sitePresence?: string;
  }>;
  contextHash: string;
  status: VisionAnalysisStatus;
  errorCode?: string;
  result?: VisionAnalysisResult;
  qualityChecks: EvidenceQualityCheck[];
  inspectorReview?: {
    status: "PENDING" | "REVIEWED";
    decisions: Record<string, { decision: InspectorDecision; comment?: string }>;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  supersededBy?: string;
  createdAt: string;
};

// ---------------------------------------------------------------- AI Governance enums and contracts

export const AI_FEATURE_KEYS = [
  "qa",
  "summary",
  "extraction",
  "riskNarrative",
  "vision",
  "copilot",
  "embedding",
] as const;
export type AiFeatureKey = (typeof AI_FEATURE_KEYS)[number];

export const AI_MODEL_TIERS = ["LOW", "STRONG", "VISION", "EMBED"] as const;
export type AiModelTier = (typeof AI_MODEL_TIERS)[number];

export const AI_LITE_STATUSES = ["available", "degraded", "unavailable", "disabled"] as const;
export type AiLiteStatus = (typeof AI_LITE_STATUSES)[number];

export type AiLiteStatusMap = Record<AiFeatureKey, AiLiteStatus>;

export const AI_GOVERNANCE_AUDIT_ACTIONS = [
  "ai.settings_updated",
  "ai.settings_reset",
  "ai.vision_analysis_requested",
  "ai.vision_analysis_completed",
  "ai.vision_analysis_failed",
  "ai.vision_analysis_reviewed",
  "ai.vision_observations_inserted",
  "ai.copilot_turn_started",
  "ai.copilot_turn_completed",
  "ai.copilot_turn_cancelled",
  "ai.models_checked",
  "ai.usage_exported",
] as const;
export type AiGovernanceAuditAction = (typeof AI_GOVERNANCE_AUDIT_ACTIONS)[number];

export type ModelCatalogEntry = {
  modelId: string;
  verifiedAt?: string;
  source: "admin-entered" | "provider-listing";
  pricePerMInputMinor?: number;
  pricePerMOutputMinor?: number;
  pricePerImageMinor?: number;
};

export type AiSettingsDto = {
  scope: "PLATFORM" | "AGENCY";
  agencyId?: string;
  featureToggles: Record<AiFeatureKey, boolean>;
  limits: {
    userRequestsPer10Min: Record<AiFeatureKey, number>;
    agencyRequestsPerDay: Record<AiFeatureKey, number>;
    concurrencyPerUser: number;
    copilotMaxMessageLength: number;
    visionMaxImages: number;
  };
  budgets: {
    dailyTokenBudget: Record<AiModelTier, number>;
    monthlyTokenBudget: Record<AiModelTier, number>;
    dailyVisionImages: number;
  };
  modelCatalog?: Record<AiModelTier, ModelCatalogEntry>;
  routing?: {
    strongSummaryInputThreshold: number;
    autoDowngradeAtBudgetPercent: number;
  };
  updatedBy?: string;
  version: number;
};
