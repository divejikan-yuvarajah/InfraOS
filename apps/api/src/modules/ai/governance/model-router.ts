import type { AiFeatureKey, AiModelTier } from "@infraos/shared-types";
import type { EffectiveAiSettings } from "./ai.defaults.js";

export function resolveTierForFeature(
  feature: AiFeatureKey,
  options?: { inputTokens?: number; preferStrong?: boolean },
  settings?: EffectiveAiSettings,
): AiModelTier {
  if (feature === "vision") return "VISION";
  if (feature === "embedding") return "EMBED";

  if (feature === "summary") {
    const threshold = settings?.strongSummaryInputThreshold ?? 10_000;
    if (options?.preferStrong || (options?.inputTokens && options.inputTokens > threshold)) {
      return "STRONG";
    }
    return "LOW";
  }

  if (feature === "extraction" && options?.preferStrong) {
    return "STRONG";
  }

  if (feature === "copilot" && options?.preferStrong) {
    return "STRONG";
  }

  return "LOW";
}

export function resolveModelForTier(
  tier: AiModelTier,
  settings: EffectiveAiSettings,
): string | undefined {
  const entry = settings.modelCatalog[tier];
  if (!entry?.modelId || entry.modelId.trim() === "") {
    return undefined; // Not configured
  }
  return entry.modelId.trim();
}

export function shouldDowngradeTier(
  tier: AiModelTier,
  tierUsedTokens: number,
  settings: EffectiveAiSettings,
): boolean {
  if (tier !== "STRONG") return false;
  const budget = settings.dailyTokenBudget.STRONG;
  if (!budget || budget <= 0) return false;
  const percent = (tierUsedTokens / budget) * 100;
  return percent >= settings.autoDowngradeAtBudgetPercent;
}
