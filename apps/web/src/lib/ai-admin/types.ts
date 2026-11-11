import type { AiFeatureKey, AiModelTier, AiSettingsDto } from "@infraos/shared-types";

export type { AiFeatureKey, AiModelTier, AiSettingsDto };

export type LiteFeatureStatus = "available" | "degraded" | "unavailable" | "disabled";

export type AiStatusLiteDto = {
  features: Record<AiFeatureKey, LiteFeatureStatus>;
  overall: "available" | "degraded" | "unavailable";
  timestamp: string;
};

export type AiFeatureLimitMe = {
  enabled: boolean;
  limit10Min: number;
  used10Min: number;
  remaining10Min: number;
  resetAt: string;
  agencyDailyLimit: number;
  agencyDailyUsed: number;
};

export type AiLimitsMeDto = {
  features: Record<AiFeatureKey, AiFeatureLimitMe>;
  concurrencyPerUser: number;
  dailyResetAt: string;
  dailyTokensUsed: number;
  dailyTokenBudget: number;
  dailyByTier: Record<AiModelTier, { used: number; limit: number }>;
  dailyVisionImagesUsed: number;
  dailyVisionImagesLimit: number;
  copilotMaxMessageLength: number;
  visionMaxImages: number;
};

export type AiUsageMeDto = {
  today: { requests: number; inputTokens: number; outputTokens: number };
  week: { requests: number; inputTokens: number; outputTokens: number };
  byFeature: Record<string, { requests: number; tokens: number }>;
  recentRequests: Array<{
    id: string;
    feature: string;
    model: string;
    status: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    createdAt: string;
  }>;
};

export type AiUsageAgencyDto = {
  scope: string;
  from: string;
  to: string;
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    images: number;
    errorRate: number;
    fallbackRate: number;
    estimatedCostMinor: number | null;
    pricesVerified: boolean;
  };
  budgets: {
    dailyTokenBudget: Record<AiModelTier, number>;
    monthlyTokenBudget: Record<AiModelTier, number>;
    dailyVisionImages: number;
    autoDowngradeAtBudgetPercent: number;
  };
  dailyChart: Array<{ day: string } & Partial<Record<AiFeatureKey, number>>>;
  byFeature: Record<string, { requests: number; tokens: number; errors: number; fallbacks: number }>;
  topUsers: Array<{
    userPseudonymId: string;
    requests: number;
    flaggedPromptsCount: number;
  }>;
};

export type AiAuditItemDto = {
  id: string;
  timestamp: string;
  feature: string;
  kind: string;
  userPseudonymId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: string;
  latencyMs: number;
  flags: string[];
  providerPolicy?: string;
};

export type AiAuditPageDto = {
  items: AiAuditItemDto[];
  nextCursor: string | null;
};

export type AiAuditQuery = {
  from?: string;
  to?: string;
  feature?: AiFeatureKey | "";
  status?: "OK" | "ERROR" | "RATE_LIMITED" | "";
  limit?: number;
  cursor?: string;
};

export type AiEffectiveSettingsDto = {
  featureToggles: Record<AiFeatureKey, boolean>;
  userRequestsPer10Min: Record<AiFeatureKey, number>;
  agencyRequestsPerDay: Record<AiFeatureKey, number>;
  concurrencyPerUser: number;
  copilotMaxMessageLength: number;
  visionMaxImages: number;
  dailyTokenBudget: Record<AiModelTier, number>;
  monthlyTokenBudget: Record<AiModelTier, number>;
  dailyVisionImages: number;
  strongSummaryInputThreshold: number;
  autoDowngradeAtBudgetPercent: number;
  modelCatalog: AiSettingsDto["modelCatalog"];
};

export type AiSettingsResponseDto = {
  effective: AiEffectiveSettingsDto;
  platform?: AiSettingsDto;
  agency?: AiSettingsDto;
};

/** Exact strict schema accepted by PUT /api/v1/ai/settings and PUT /api/v1/ai/settings/agency/:id */
export type UpdateAiSettingsPayload = {
  scope?: "PLATFORM" | "AGENCY";
  agencyId?: string;
  version: number;
  featureToggles?: Partial<Record<AiFeatureKey, boolean>>;
  limits?: {
    userRequestsPer10Min?: Partial<Record<AiFeatureKey, number>>;
    agencyRequestsPerDay?: Partial<Record<AiFeatureKey, number>>;
    concurrencyPerUser?: number;
  };
  budgets?: {
    dailyTokenBudget?: Partial<Record<AiModelTier, number>>;
    dailyVisionImages?: number;
  };
  modelCatalog?: NonNullable<AiSettingsDto["modelCatalog"]>;
  routing?: {
    strongSummaryInputThreshold?: number;
    autoDowngradeAtBudgetPercent?: number;
  };
};

export type ModelsCheckProbeDto = {
  reachable: boolean;
  message: string;
  capabilities?: Record<string, unknown>;
  configuredModels: Record<AiModelTier, string>;
};

export type AboutAiFeatureInfo = {
  enabled: boolean;
  model: string;
  sends: string[];
  humanReviewRule: string;
};

export type AboutAiDto = {
  provider: {
    name: string;
    dataHandlingPolicy: string;
    serviceArchitecture: string;
  };
  features: Record<Exclude<AiFeatureKey, "embedding">, AboutAiFeatureInfo> & Partial<Record<"embedding", AboutAiFeatureInfo>>;
  neverSent: string[];
  neverDoes: string[];
  retention: {
    qaHistoryDays: number;
    copilotHistoryDays: number;
    usageAuditDays: number;
  };
  limits: {
    concurrencyPerUser: number;
    copilotMaxMessageLength: number;
    visionMaxImages: number;
  };
  lastSettingsUpdatedAt: string | null;
};

