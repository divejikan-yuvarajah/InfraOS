import { AI_FEATURE_KEYS, type AiFeatureKey } from "@infraos/shared-types";
import { colomboDayString } from "./ai.defaults.js";
import { loadEffectiveSettings } from "./ai-gate.js";
import { resolveModelForTier, resolveTierForFeature } from "./model-router.js";
import { AiUsageDaily } from "./usage-daily.model.js";

export type LiteFeatureStatus = "available" | "degraded" | "unavailable" | "disabled";

/** Why a feature is "unavailable". Additive: older clients ignore it. */
export type AiUnavailableReason = "model_not_configured" | "daily_request_limit" | "token_budget";

export type AiStatusLite = {
  features: Record<AiFeatureKey, LiteFeatureStatus>;
  overall: "available" | "degraded" | "unavailable";
  reasons?: Partial<Record<AiFeatureKey, AiUnavailableReason>>;
  timestamp: string;
};

export async function getAiStatusLite(agencyId?: string): Promise<AiStatusLite> {
  const settings = await loadEffectiveSettings(agencyId);
  const today = colomboDayString();

  const statuses: Partial<Record<AiFeatureKey, LiteFeatureStatus>> = {};
  const reasons: Partial<Record<AiFeatureKey, AiUnavailableReason>> = {};

  // Load rollups for today
  const rollups = await AiUsageDaily.find({
    day: today,
    scope: agencyId ? { $in: [agencyId, "PLATFORM"] } : "PLATFORM",
  }).lean().catch(() => []);

  for (const feature of AI_FEATURE_KEYS) {
    // 1. Feature disabled
    if (!settings.featureToggles[feature]) {
      statuses[feature] = "disabled";
      continue;
    }

    // 2. Model resolution
    const tier = resolveTierForFeature(feature, {}, settings);
    const model = resolveModelForTier(tier, settings);
    if (!model) {
      statuses[feature] = "unavailable";
      reasons[feature] = "model_not_configured";
      continue;
    }

    // 3. Daily usage checks (check scoped rollups separately so PLATFORM + agency aren't double-counted)
    const primaryScope = agencyId ?? "PLATFORM";
    const scopedRollups = rollups.filter((r) => r.scope === primaryScope);
    const featureRollups = scopedRollups.filter((r) => r.feature === feature);
    const agencyLimit = settings.agencyRequestsPerDay[feature] ?? 2000;
    const requestsUsed = featureRollups.reduce((acc, r) => acc + (r.requests ?? 0), 0);

    if (requestsUsed >= agencyLimit) {
      statuses[feature] = "unavailable";
      reasons[feature] = "daily_request_limit";
      continue;
    }

    if (requestsUsed >= agencyLimit * 0.8) {
      statuses[feature] = "degraded";
      continue;
    }

    // 4. Token budget checks (take max of agency scope vs platform scope)
    const tierBudget = settings.dailyTokenBudget[tier] ?? 1_000_000;
    const agencyTokens = scopedRollups
      .filter((r) => r.tier === tier)
      .reduce((acc, r) => acc + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0);
    const platformTokens = rollups
      .filter((r) => r.scope === "PLATFORM" && r.tier === tier)
      .reduce((acc, r) => acc + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0);
    const tokensUsed = Math.max(agencyTokens, platformTokens);

    if (tokensUsed >= tierBudget) {
      statuses[feature] = "unavailable";
      reasons[feature] = "token_budget";
      continue;
    }

    if (tokensUsed >= tierBudget * 0.8) {
      statuses[feature] = "degraded";
      continue;
    }

    statuses[feature] = "available";
  }

  const activeFeatures = AI_FEATURE_KEYS.filter((f) => settings.featureToggles[f]);
  const activeStatuses = activeFeatures.map((f) => statuses[f]);
  let overall: "available" | "degraded" | "unavailable" = "available";
  if (activeStatuses.length === 0 || activeStatuses.every((s) => s === "unavailable")) {
    overall = "unavailable";
  } else if (activeStatuses.some((s) => s === "degraded" || s === "unavailable")) {
    overall = "degraded";
  }

  return {
    features: statuses as Record<AiFeatureKey, LiteFeatureStatus>,
    overall,
    reasons,
    timestamp: new Date().toISOString(),
  };
}
