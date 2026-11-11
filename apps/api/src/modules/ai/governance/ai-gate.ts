import mongoose from "mongoose";
import type { AiFeatureKey, AiModelTier } from "@infraos/shared-types";
import { AiUsageRecord } from "../usage.model.js";
import { AiSettings } from "./settings.model.js";
import { AiUsageDaily } from "./usage-daily.model.js";
import { AiRateBucket } from "./rate-bucket.model.js";
import {
  colomboDayString,
  colomboMonthString,
  DEFAULT_COST_UNITS,
  nextColomboMidnight,
  resolveEffectiveSettings,
  type EffectiveAiSettings,
} from "./ai.defaults.js";
import { resolveModelForTier, resolveTierForFeature, shouldDowngradeTier } from "./model-router.js";

export type GateDenyCode =
  | "FEATURE_DISABLED"
  | "MODEL_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_CONCURRENCY_EXCEEDED"
  | "AI_BUDGET_EXCEEDED";

export type GateDenial = {
  code: GateDenyCode;
  scope: "USER" | "AGENCY" | "PLATFORM" | "FEATURE";
  retryAfterSeconds?: number;
  limit?: number;
  remaining?: number;
  resetsAt?: Date;
  message?: string;
};

export type GateDecision =
  | { allow: true; settings: EffectiveAiSettings; tier: AiModelTier; model: string }
  | { allow: false; deny: GateDenial };

export type GateCheckParams = {
  actor: { userId: string; agencyId?: string; role?: string };
  agencyId?: string;
  feature: AiFeatureKey;
  tier?: AiModelTier;
  estimate?: {
    inputTokens?: number;
    outputTokens?: number;
    images?: number;
    costUnits?: number;
  };
  preferStrong?: boolean;
};

export type GateRecordParams = {
  actor: { userId: string; agencyId?: string };
  agencyId?: string;
  feature: AiFeatureKey;
  tier: AiModelTier;
  provider?: string;
  model: string;
  actual: {
    inputTokens: number;
    outputTokens: number;
    images?: number;
    costMinor?: number;
    costUnits?: number;
    status: "OK" | "ERROR" | "RATE_LIMITED";
    flags?: string[];
    latencyMs?: number;
    providerPolicy?: string;
    isFallback?: boolean;
    purpose?: "QA" | "SUMMARY_MAP" | "SUMMARY_REDUCE" | "EXTRACTION" | "COPILOT" | "VISION" | "RISK_NARRATIVE" | "EMBEDDING";
    documentId?: string;
    jobId?: string;
  };
};

// In-memory active operation tracking for per-user concurrency
const activeUserOps = new Map<string, number>();

export function acquireUserConcurrency(userId: string, feature: AiFeatureKey): boolean {
  if (feature !== "copilot" && feature !== "vision") {
    return true; // only strict for long-running interactive features
  }
  const key = `${userId}:${feature}`;
  const current = activeUserOps.get(key) ?? 0;
  if (current >= 1) return false;
  activeUserOps.set(key, current + 1);
  return true;
}

export function releaseUserConcurrency(userId: string, feature: AiFeatureKey): void {
  const key = `${userId}:${feature}`;
  const current = activeUserOps.get(key) ?? 0;
  if (current <= 1) {
    activeUserOps.delete(key);
  } else {
    activeUserOps.set(key, current - 1);
  }
}

export async function loadEffectiveSettings(agencyId?: string): Promise<EffectiveAiSettings & { hasCustomDbOverrides?: boolean }> {
  const query: mongoose.FilterQuery<Record<string, unknown>>[] = [{ scope: "PLATFORM" }];
  if (agencyId && mongoose.Types.ObjectId.isValid(agencyId)) {
    query.push({ scope: "AGENCY", agencyId: new mongoose.Types.ObjectId(agencyId) });
  }
  const docs = await AiSettings.find({ $or: query }).lean().catch(() => []);
  const platformDoc = docs.find((d) => d.scope === "PLATFORM");
  const agencyDoc = docs.find((d) => d.scope === "AGENCY");
  const effective = resolveEffectiveSettings(platformDoc, agencyDoc);
  return {
    ...effective,
    hasCustomDbOverrides: Boolean(platformDoc || agencyDoc),
  };
}

export async function checkGate(params: GateCheckParams): Promise<GateDecision> {
  const agencyId = params.agencyId ?? params.actor.agencyId;
  const settings = await loadEffectiveSettings(agencyId);

  // 1. Feature toggle check
  if (!settings.featureToggles[params.feature]) {
    return {
      allow: false,
      deny: {
        code: "FEATURE_DISABLED",
        scope: "FEATURE",
        message: `AI feature '${params.feature}' is disabled by policy`,
      },
    };
  }

  // 2. Resolve Tier and Model
  let tier = params.tier ?? resolveTierForFeature(params.feature, {
    inputTokens: params.estimate?.inputTokens,
    preferStrong: params.preferStrong,
  }, settings);

  // Check budget usage for soft downgrade STRONG -> LOW
  if (tier === "STRONG") {
    const today = colomboDayString();
    const strongAgg = await AiUsageDaily.aggregate<{ tokens: number }>([
      { $match: { day: today, scope: agencyId ?? "PLATFORM", tier: "STRONG" } },
      { $group: { _id: null, tokens: { $sum: { $add: ["$inputTokens", "$outputTokens"] } } } },
    ]).catch(() => []);
    const used = strongAgg[0]?.tokens ?? 0;
    if (shouldDowngradeTier("STRONG", used, settings)) {
      tier = "LOW";
    }
  }

  const model = resolveModelForTier(tier, settings);
  if (!model) {
    return {
      allow: false,
      deny: {
        code: "MODEL_NOT_CONFIGURED",
        scope: "PLATFORM",
        message: `Model for tier '${tier}' is not configured`,
      },
    };
  }

  // 3. Concurrency check
  if (!acquireUserConcurrency(params.actor.userId, params.feature)) {
    return {
      allow: false,
      deny: {
        code: "AI_CONCURRENCY_EXCEEDED",
        scope: "USER",
        message: "Another AI operation is already running for your account",
      },
    };
  }

  // 4. Rate Limiting (10-minute window)
  const windowMs = 10 * 60 * 1000;
  const currentWindow = Math.floor(Date.now() / windowMs);
  const bucketKey = `rate:u:${params.actor.userId}:${params.feature}:${currentWindow}`;
  const costUnits = params.estimate?.costUnits ?? DEFAULT_COST_UNITS[params.feature] ?? 1;
  const configuredLimit = settings.userRequestsPer10Min[params.feature] ?? 20;
  // In test environment, if no custom DB settings were seeded, use relaxed limit (5000) so multi-turn integration test suites aren't throttled
  const userLimit = (process.env.NODE_ENV === "test" && !settings.hasCustomDbOverrides)
    ? 5000
    : configuredLimit;

  try {
    const bucket = await AiRateBucket.findOneAndUpdate(
      { key: bucketKey },
      {
        $inc: { count: costUnits },
        $setOnInsert: { expiresAt: new Date((currentWindow + 1) * windowMs) },
      },
      { upsert: true, new: true },
    );

    if (bucket && bucket.count > userLimit) {
      releaseUserConcurrency(params.actor.userId, params.feature);
      const retryAfterSeconds = Math.max(1, Math.ceil(((currentWindow + 1) * windowMs - Date.now()) / 1000));
      return {
        allow: false,
        deny: {
          code: "AI_RATE_LIMITED",
          scope: "USER",
          limit: userLimit,
          remaining: 0,
          retryAfterSeconds,
          message: `Rate limit reached. Try again in ${retryAfterSeconds} seconds.`,
        },
      };
    }
  } catch {
    // If rate bucket write fails (e.g. temporary DB blip), do not fail closed completely on rate bucket unless critical
  }

  // 5. Daily Agency limits & Budgets
  const today = colomboDayString();
  const monthPrefix = colomboMonthString();
  const resetsAt = nextColomboMidnight();

  if (agencyId) {
    const featureReqAgg = await AiUsageDaily.aggregate<{ totalRequests: number }>([
      { $match: { day: today, scope: agencyId, feature: params.feature } },
      { $group: { _id: null, totalRequests: { $sum: "$requests" } } },
    ]).catch(() => []);

    const agencyLimit = settings.agencyRequestsPerDay[params.feature] ?? 2000;
    const requestsUsed = featureReqAgg[0]?.totalRequests ?? 0;
    if (requestsUsed >= agencyLimit) {
      releaseUserConcurrency(params.actor.userId, params.feature);
      return {
        allow: false,
        deny: {
          code: "AI_RATE_LIMITED",
          scope: "AGENCY",
          limit: agencyLimit,
          remaining: 0,
          resetsAt,
          message: "Agency daily request limit exceeded.",
        },
      };
    }
  }

  // Daily & Monthly Token Budget checks for tier
  const tierBudget = settings.dailyTokenBudget[tier] ?? 1_000_000;
  const monthlyBudget = settings.monthlyTokenBudget[tier] ?? 25_000_000;
  const scopesToCheck = agencyId ? [agencyId, "PLATFORM"] : ["PLATFORM"];
  let totalUsed = 0;
  let totalMonthlyUsed = 0;
  for (const sc of scopesToCheck) {
    const [dailyAgg, monthlyAgg] = await Promise.all([
      AiUsageDaily.aggregate<{ tokens: number }>([
        { $match: { day: today, scope: sc, tier } },
        { $group: { _id: null, tokens: { $sum: { $add: ["$inputTokens", "$outputTokens"] } } } },
      ]).catch(() => []),
      AiUsageDaily.aggregate<{ tokens: number }>([
        { $match: { scope: sc, day: { $regex: `^${monthPrefix}-` }, tier } },
        { $group: { _id: null, tokens: { $sum: { $add: ["$inputTokens", "$outputTokens"] } } } },
      ]).catch(() => []),
    ]);
    const u = dailyAgg[0]?.tokens ?? 0;
    if (u > totalUsed) totalUsed = u;
    const mu = monthlyAgg[0]?.tokens ?? 0;
    if (mu > totalMonthlyUsed) totalMonthlyUsed = mu;
  }

  const pending = (params.estimate?.inputTokens ?? 0) + (params.estimate?.outputTokens ?? 0);
  if (totalUsed + pending > tierBudget) {
    releaseUserConcurrency(params.actor.userId, params.feature);
    return {
      allow: false,
      deny: {
        code: "AI_BUDGET_EXCEEDED",
        scope: agencyId ? "AGENCY" : "PLATFORM",
        limit: tierBudget,
        remaining: Math.max(0, tierBudget - totalUsed),
        resetsAt,
        message: `Daily token budget for tier ${tier} exceeded. Resets at midnight.`,
      },
    };
  }
  if (totalMonthlyUsed + pending > monthlyBudget) {
    releaseUserConcurrency(params.actor.userId, params.feature);
    return {
      allow: false,
      deny: {
        code: "AI_BUDGET_EXCEEDED",
        scope: agencyId ? "AGENCY" : "PLATFORM",
        limit: monthlyBudget,
        remaining: Math.max(0, monthlyBudget - totalMonthlyUsed),
        resetsAt,
        message: `Monthly token budget for tier ${tier} exceeded.`,
      },
    };
  }

  // Vision image budget
  if (params.feature === "vision") {
    const visionRollup = await AiUsageDaily.aggregate([
      { $match: { day: today, scope: agencyId ?? "PLATFORM", feature: "vision" } },
      { $group: { _id: null, totalImages: { $sum: "$images" } } },
    ]).catch(() => []);
    const usedImages = visionRollup[0]?.totalImages ?? 0;
    const requestedImages = params.estimate?.images ?? 1;
    if (usedImages + requestedImages > settings.dailyVisionImages) {
      releaseUserConcurrency(params.actor.userId, params.feature);
      return {
        allow: false,
        deny: {
          code: "AI_BUDGET_EXCEEDED",
          scope: "AGENCY",
          limit: settings.dailyVisionImages,
          remaining: Math.max(0, settings.dailyVisionImages - usedImages),
          resetsAt,
          message: "Daily vision analysis image limit exceeded.",
        },
      };
    }
  }

  return { allow: true, settings, tier, model };
}

export async function recordGate(params: GateRecordParams): Promise<void> {
  const today = colomboDayString();
  const agencyId = params.agencyId ?? params.actor.agencyId;
  const isError = params.actual.status === "ERROR";
  const isFallback = Boolean(params.actual.isFallback);

  // Release concurrency slot
  releaseUserConcurrency(params.actor.userId, params.feature);

  // 1. Insert detailed AiUsageRecord (90-day retention)
  const kind = params.feature === "embedding" ? "EMBEDDING" : params.feature === "vision" ? "VISION" : "CHAT";
  const purposeMap: Record<AiFeatureKey, NonNullable<GateRecordParams["actual"]["purpose"]>> = {
    qa: "QA",
    summary: "SUMMARY_MAP",
    extraction: "EXTRACTION",
    riskNarrative: "RISK_NARRATIVE",
    vision: "VISION",
    copilot: "COPILOT",
    embedding: "EMBEDDING",
  };
  const purpose = params.actual.purpose ?? purposeMap[params.feature] ?? "QA";

  await AiUsageRecord.create({
    kind,
    purpose,
    feature: params.feature,
    agencyId: agencyId && mongoose.Types.ObjectId.isValid(agencyId) ? new mongoose.Types.ObjectId(agencyId) : undefined,
    userId: mongoose.Types.ObjectId.isValid(params.actor.userId) ? new mongoose.Types.ObjectId(params.actor.userId) : undefined,
    documentId: params.actual.documentId && mongoose.Types.ObjectId.isValid(params.actual.documentId) ? new mongoose.Types.ObjectId(params.actual.documentId) : undefined,
    jobId: params.actual.jobId && mongoose.Types.ObjectId.isValid(params.actual.jobId) ? new mongoose.Types.ObjectId(params.actual.jobId) : undefined,
    provider: params.provider ?? "openrouter",
    model: params.model,
    inputTokens: params.actual.inputTokens,
    outputTokens: params.actual.outputTokens,
    estimatedCostMinor: params.actual.costMinor,
    costUnits: params.actual.costUnits ?? DEFAULT_COST_UNITS[params.feature] ?? 1,
    status: params.actual.status,
    flags: params.actual.flags ?? [],
    latencyMs: params.actual.latencyMs,
    providerPolicy: params.actual.providerPolicy,
  }).catch(() => undefined);

  // 2. Atomic increment on AiUsageDaily rollup
  const scopesToUpdate = [agencyId ? agencyId : "PLATFORM"];
  if (agencyId && agencyId !== "PLATFORM") {
    scopesToUpdate.push("PLATFORM");
  }

  for (const s of scopesToUpdate) {
    await AiUsageDaily.updateOne(
      { day: today, scope: s, feature: params.feature, tier: params.tier },
      {
        $inc: {
          requests: 1,
          inputTokens: params.actual.inputTokens,
          outputTokens: params.actual.outputTokens,
          images: params.actual.images ?? 0,
          costMinor: params.actual.costMinor ?? 0,
          errors: isError ? 1 : 0,
          fallbacks: isFallback ? 1 : 0,
        },
      },
      { upsert: true },
    ).catch(() => undefined);
  }
}
