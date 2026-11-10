import type { AiFeatureKey, AiModelTier } from "@infraos/shared-types";
import { aiConfig } from "../ai.config.js";

const COLOMBO_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

export function colomboDayString(now = new Date()): string {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function colomboMonthString(now = new Date()): string {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function nextColomboMidnight(now = new Date()): Date {
  const local = now.getTime() + COLOMBO_OFFSET_MS;
  const startLocal = Math.floor(local / DAY_MS) * DAY_MS;
  return new Date(startLocal + DAY_MS - COLOMBO_OFFSET_MS);
}

export const DEFAULT_FEATURE_TOGGLES: Record<AiFeatureKey, boolean> = {
  qa: true,
  summary: true,
  extraction: true,
  riskNarrative: true,
  vision: false, // OFF by default
  copilot: true,
  embedding: true,
};

export const DEFAULT_USER_REQUESTS_PER_10MIN: Record<AiFeatureKey, number> = {
  qa: 20,
  summary: 6,
  extraction: 6,
  riskNarrative: 6,
  vision: 4,
  copilot: 15,
  embedding: 30,
};

export const DEFAULT_AGENCY_REQUESTS_PER_DAY: Record<AiFeatureKey, number> = {
  qa: 2000,
  summary: 500,
  extraction: 500,
  riskNarrative: 500,
  vision: 200,
  copilot: 1500,
  embedding: 3000,
};

export const DEFAULT_DAILY_TOKEN_BUDGET: Record<AiModelTier, number> = {
  LOW: 1_000_000,
  STRONG: 500_000,
  VISION: 500_000,
  EMBED: 2_000_000,
};

export const DEFAULT_MONTHLY_TOKEN_BUDGET: Record<AiModelTier, number> = {
  LOW: 25_000_000,
  STRONG: 12_500_000,
  VISION: 12_500_000,
  EMBED: 50_000_000,
};

export const DEFAULT_COST_UNITS: Record<AiFeatureKey, number> = {
  qa: 1,
  copilot: 3,
  summary: 5,
  extraction: 5,
  vision: 10,
  riskNarrative: 2,
  embedding: 1,
};

export type EffectiveAiSettings = {
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
  modelCatalog: Record<AiModelTier, {
    modelId: string;
    verifiedAt?: Date;
    source: "admin-entered" | "provider-listing";
    pricePerMInputMinor?: number;
    pricePerMOutputMinor?: number;
    pricePerImageMinor?: number;
  }>;
};

export function getPlatformDefaults(): EffectiveAiSettings {
  return {
    featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
    userRequestsPer10Min: { ...DEFAULT_USER_REQUESTS_PER_10MIN },
    agencyRequestsPerDay: { ...DEFAULT_AGENCY_REQUESTS_PER_DAY },
    concurrencyPerUser: 1,
    copilotMaxMessageLength: 800,
    visionMaxImages: 6,
    dailyTokenBudget: {
      LOW: aiConfig.chat?.dailyTokenBudget ?? 1_000_000,
      STRONG: Math.floor((aiConfig.chat?.dailyTokenBudget ?? 1_000_000) / 2),
      VISION: 500_000,
      EMBED: aiConfig.dailyTokenBudget ?? 2_000_000,
    },
    monthlyTokenBudget: { ...DEFAULT_MONTHLY_TOKEN_BUDGET },
    dailyVisionImages: aiConfig.vision?.dailyImageBudget ?? 100,
    strongSummaryInputThreshold: 10_000,
    autoDowngradeAtBudgetPercent: 80,
    modelCatalog: {
      LOW: {
        modelId: aiConfig.chat?.model ?? "",
        source: "admin-entered",
        pricePerMInputMinor: aiConfig.chat?.priceInputPerMMinor,
        pricePerMOutputMinor: aiConfig.chat?.priceOutputPerMMinor,
      },
      STRONG: {
        modelId: aiConfig.chat?.strongModel ?? "",
        source: "admin-entered",
      },
      VISION: {
        modelId: aiConfig.vision?.model ?? "",
        source: "admin-entered",
        pricePerImageMinor: aiConfig.vision?.pricePerImageMinor,
      },
      EMBED: {
        modelId: aiConfig.embedModel ?? "",
        source: "admin-entered",
        pricePerMInputMinor: aiConfig.pricePerMTokensMinor,
      },
    },
  };
}

/**
 * Resolves effective settings: most restrictive of platform and agency.
 * An agency can lower limits or disable features, but can never enable what platform disabled or raise limits.
 */
export function resolveEffectiveSettings(
  platformDoc?: any,
  agencyDoc?: any,
): EffectiveAiSettings {
  const base = getPlatformDefaults();

  // Apply stored platform overrides
  if (platformDoc) {
    if (platformDoc.featureToggles) {
      for (const k of Object.keys(DEFAULT_FEATURE_TOGGLES) as AiFeatureKey[]) {
        const toggleKey = `${k}Enabled` as const;
        if (typeof platformDoc.featureToggles[toggleKey] === "boolean") {
          base.featureToggles[k] = platformDoc.featureToggles[toggleKey];
        }
      }
    }
    if (platformDoc.limits) {
      if (platformDoc.limits.userRequestsPer10Min) {
        for (const k of Object.keys(DEFAULT_USER_REQUESTS_PER_10MIN) as AiFeatureKey[]) {
          const val = platformDoc.limits.userRequestsPer10Min[k];
          if (typeof val === "number" && val > 0) base.userRequestsPer10Min[k] = val;
        }
      }
      if (platformDoc.limits.agencyRequestsPerDay) {
        for (const k of Object.keys(DEFAULT_AGENCY_REQUESTS_PER_DAY) as AiFeatureKey[]) {
          const val = platformDoc.limits.agencyRequestsPerDay[k];
          if (typeof val === "number" && val > 0) base.agencyRequestsPerDay[k] = val;
        }
      }
      if (typeof platformDoc.limits.concurrencyPerUser === "number") {
        base.concurrencyPerUser = platformDoc.limits.concurrencyPerUser;
      }
    }
    if (platformDoc.budgets) {
      if (platformDoc.budgets.dailyTokenBudget) {
        for (const t of ["LOW", "STRONG", "VISION", "EMBED"] as AiModelTier[]) {
          const val = platformDoc.budgets.dailyTokenBudget[t];
          if (typeof val === "number" && val > 0) base.dailyTokenBudget[t] = val;
        }
      }
      if (typeof platformDoc.budgets.dailyVisionImages === "number") {
        base.dailyVisionImages = platformDoc.budgets.dailyVisionImages;
      }
    }
    if (platformDoc.modelCatalog) {
      for (const t of ["LOW", "STRONG", "VISION", "EMBED"] as AiModelTier[]) {
        const entry = platformDoc.modelCatalog[t];
        if (entry?.modelId) {
          base.modelCatalog[t] = {
            modelId: entry.modelId,
            verifiedAt: entry.verifiedAt ? new Date(entry.verifiedAt) : undefined,
            source: entry.source || "admin-entered",
            pricePerMInputMinor: entry.pricePerMInputMinor,
            pricePerMOutputMinor: entry.pricePerMOutputMinor,
            pricePerImageMinor: entry.pricePerImageMinor,
          };
        }
      }
    }
    if (platformDoc.routing) {
      if (typeof platformDoc.routing.strongSummaryInputThreshold === "number") {
        base.strongSummaryInputThreshold = platformDoc.routing.strongSummaryInputThreshold;
      }
      if (typeof platformDoc.routing.autoDowngradeAtBudgetPercent === "number") {
        base.autoDowngradeAtBudgetPercent = platformDoc.routing.autoDowngradeAtBudgetPercent;
      }
    }
  }

  // Apply agency restrictions (can only restrict further, never widen)
  if (agencyDoc) {
    if (agencyDoc.featureToggles) {
      for (const k of Object.keys(DEFAULT_FEATURE_TOGGLES) as AiFeatureKey[]) {
        const toggleKey = `${k}Enabled` as const;
        // Agency can disable, but if platform disabled it, agency cannot enable it
        if (agencyDoc.featureToggles[toggleKey] === false) {
          base.featureToggles[k] = false;
        }
      }
    }
    if (agencyDoc.limits) {
      if (agencyDoc.limits.userRequestsPer10Min) {
        for (const k of Object.keys(DEFAULT_USER_REQUESTS_PER_10MIN) as AiFeatureKey[]) {
          const val = agencyDoc.limits.userRequestsPer10Min[k];
          if (typeof val === "number" && val > 0) {
            base.userRequestsPer10Min[k] = Math.min(base.userRequestsPer10Min[k], val);
          }
        }
      }
      if (agencyDoc.limits.agencyRequestsPerDay) {
        for (const k of Object.keys(DEFAULT_AGENCY_REQUESTS_PER_DAY) as AiFeatureKey[]) {
          const val = agencyDoc.limits.agencyRequestsPerDay[k];
          if (typeof val === "number" && val > 0) {
            base.agencyRequestsPerDay[k] = Math.min(base.agencyRequestsPerDay[k], val);
          }
        }
      }
    }
    if (agencyDoc.budgets) {
      if (agencyDoc.budgets.dailyTokenBudget) {
        for (const t of ["LOW", "STRONG", "VISION", "EMBED"] as AiModelTier[]) {
          const val = agencyDoc.budgets.dailyTokenBudget[t];
          if (typeof val === "number" && val > 0) {
            base.dailyTokenBudget[t] = Math.min(base.dailyTokenBudget[t], val);
          }
        }
      }
      if (typeof agencyDoc.budgets.dailyVisionImages === "number") {
        base.dailyVisionImages = Math.min(base.dailyVisionImages, agencyDoc.budgets.dailyVisionImages);
      }
    }
  }

  return base;
}
