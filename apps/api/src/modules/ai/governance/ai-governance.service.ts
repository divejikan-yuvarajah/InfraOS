import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type {
  AiModelTier,
  AiSettingsDto,
} from "@infraos/shared-types";
import { AI_FEATURE_KEYS, AI_MODEL_TIERS, type AiFeatureKey } from "@infraos/shared-types";
import { AiSettings } from "./settings.model.js";
import { AiUsageDaily } from "./usage-daily.model.js";
import { AiRateBucket } from "./rate-bucket.model.js";
import { AiUsageRecord } from "../usage.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiClient } from "../ai-client.js";
import { aiConfig } from "../ai.config.js";
import {
  colomboDayString,
  getPlatformDefaults,
  nextColomboMidnight,
  resolveEffectiveSettings,
  type AiSettingsOverridesInput,
} from "./ai.defaults.js";

export type GovernanceActor = {
  userId: string;
  agencyId?: string;
  roleKey?: string;
};

export class GovernanceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly message: string,
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}

function pseudonymizeUserId(userId?: mongoose.Types.ObjectId | string | null): string {
  if (!userId) return "system";
  const hash = createHash("sha256").update(String(userId)).digest("hex");
  return `usr_${hash.slice(0, 8)}`;
}

async function loadPlatformAndAgencyDocs(agencyId?: string) {
  const platformDoc = await AiSettings.findOne({ scope: "PLATFORM" }).lean();
  const agencyDoc =
    agencyId && mongoose.Types.ObjectId.isValid(agencyId)
      ? await AiSettings.findOne({ scope: "AGENCY", agencyId: new mongoose.Types.ObjectId(agencyId) }).lean()
      : null;
  return { platformDoc, agencyDoc };
}

export async function getMyLimits(actor: GovernanceActor) {
  const { platformDoc, agencyDoc } = await loadPlatformAndAgencyDocs(actor.agencyId);
  const settings = resolveEffectiveSettings(platformDoc, agencyDoc);

  const now = new Date();
  const windowMs = 10 * 60_000;
  const windowBucket = Math.floor(now.getTime() / windowMs);
  const windowResetAt = new Date((windowBucket + 1) * windowMs);
  const dailyResetAt = nextColomboMidnight(now);
  const today = colomboDayString(now);

  // Scoped daily rollups (never sum AGENCY + PLATFORM together, as recordGate writes both)
  const primaryScope = actor.agencyId || "PLATFORM";
  const dailyRollups = await AiUsageDaily.find({ day: today, scope: primaryScope }).lean().catch(() => []);

  const features: Record<
    string,
    {
      enabled: boolean;
      limit10Min: number;
      used10Min: number;
      remaining10Min: number;
      resetAt: string;
      agencyDailyLimit: number;
      agencyDailyUsed: number;
    }
  > = {};

  for (const feature of AI_FEATURE_KEYS) {
    // Must match ai-gate.ts rate bucket key format exactly
    const key = `rate:u:${actor.userId}:${feature}:${windowBucket}`;
    const bucket = await AiRateBucket.findOne({ key }).lean().catch(() => null);
    const used = bucket?.count ?? 0;
    const limit = settings.userRequestsPer10Min[feature] ?? 10;
    const agencyDailyUsed = dailyRollups
      .filter((r) => r.feature === feature)
      .reduce((acc, r) => acc + (r.requests || 0), 0);

    features[feature] = {
      enabled: settings.featureToggles[feature],
      limit10Min: limit,
      used10Min: used,
      remaining10Min: Math.max(0, limit - used),
      resetAt: windowResetAt.toISOString(),
      agencyDailyLimit: settings.agencyRequestsPerDay[feature] ?? 2000,
      agencyDailyUsed,
    };
  }

  let dailyTokensUsed = 0;
  let dailyVisionImagesUsed = 0;
  const dailyByTier: Record<string, { used: number; limit: number }> = {
    LOW: { used: 0, limit: settings.dailyTokenBudget.LOW || 0 },
    STRONG: { used: 0, limit: settings.dailyTokenBudget.STRONG || 0 },
    VISION: { used: 0, limit: settings.dailyTokenBudget.VISION || 0 },
    EMBED: { used: 0, limit: settings.dailyTokenBudget.EMBED || 0 },
  };
  for (const r of dailyRollups) {
    const tokens = (r.inputTokens || 0) + (r.outputTokens || 0);
    dailyTokensUsed += tokens;
    dailyVisionImagesUsed += r.images || 0;
    if (dailyByTier[r.tier]) {
      dailyByTier[r.tier]!.used += tokens;
    }
  }

  const totalTokenBudget =
    (settings.dailyTokenBudget.LOW || 0) +
    (settings.dailyTokenBudget.STRONG || 0) +
    (settings.dailyTokenBudget.VISION || 0) +
    (settings.dailyTokenBudget.EMBED || 0);

  return {
    features,
    concurrencyPerUser: settings.concurrencyPerUser,
    dailyResetAt: dailyResetAt.toISOString(),
    dailyTokensUsed,
    dailyTokenBudget: totalTokenBudget,
    dailyByTier,
    dailyVisionImagesUsed,
    dailyVisionImagesLimit: settings.dailyVisionImages,
    copilotMaxMessageLength: settings.copilotMaxMessageLength,
    visionMaxImages: settings.visionMaxImages,
  };
}

export async function getMyUsage(actor: GovernanceActor) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const userOid = new mongoose.Types.ObjectId(actor.userId);
  const records = await AiUsageRecord.find({
    userId: userOid,
    createdAt: { $gte: weekAgo },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const todaySummary = { requests: 0, inputTokens: 0, outputTokens: 0 };
  const weekSummary = { requests: 0, inputTokens: 0, outputTokens: 0 };
  const byFeature: Record<string, { requests: number; tokens: number }> = {};

  for (const rec of records) {
    const tokens = (rec.inputTokens || 0) + (rec.outputTokens || 0);
    weekSummary.requests += 1;
    weekSummary.inputTokens += rec.inputTokens || 0;
    weekSummary.outputTokens += rec.outputTokens || 0;

    if (rec.createdAt >= todayStart) {
      todaySummary.requests += 1;
      todaySummary.inputTokens += rec.inputTokens || 0;
      todaySummary.outputTokens += rec.outputTokens || 0;
    }

    const feat = rec.feature || rec.purpose || "qa";
    if (!byFeature[feat]) byFeature[feat] = { requests: 0, tokens: 0 };
    byFeature[feat]!.requests += 1;
    byFeature[feat]!.tokens += tokens;
  }

  // Strictly NO message/prompt/answer content returned
  const recentRequests = records.slice(0, 20).map((r) => ({
    id: r._id.toString(),
    feature: r.feature || r.purpose,
    model: r.model,
    status: r.status,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    today: todaySummary,
    week: weekSummary,
    byFeature,
    recentRequests,
  };
}

export async function getAgencyUsage(
  actor: GovernanceActor,
  params: { from?: string; to?: string; feature?: string; agencyId?: string },
) {
  const isSuperAdmin = actor.roleKey === "SUPER_ADMIN";
  if (!isSuperAdmin && params.agencyId && params.agencyId !== actor.agencyId) {
    throw new GovernanceError(403, "FORBIDDEN", "Cannot inspect usage for another agency.");
  }
  const targetScope = isSuperAdmin && params.agencyId ? params.agencyId : actor.agencyId || "PLATFORM";

  const fromDay = params.from || colomboDayString(new Date(Date.now() - 14 * 86_400_000));
  const toDay = params.to || colomboDayString(new Date());

  const query: mongoose.FilterQuery<Record<string, unknown>> = {
    scope: targetScope,
    day: { $gte: fromDay, $lte: toDay },
  };
  if (params.feature) query.feature = params.feature;

  const rollups = await AiUsageDaily.find(query).sort({ day: 1 }).lean();

  const { platformDoc, agencyDoc } = await loadPlatformAndAgencyDocs(targetScope === "PLATFORM" ? undefined : targetScope);
  const settings = resolveEffectiveSettings(platformDoc, agencyDoc);

  // Determine whether verified prices exist in modelCatalog
  const pricesVerified = Object.values(settings.modelCatalog).some(
    (c) => Boolean(c.verifiedAt) && (c.pricePerMInputMinor != null || c.pricePerImageMinor != null),
  );

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalImages = 0;
  let totalErrors = 0;
  let totalFallbacks = 0;
  let totalCostMinor = 0;

  const dailyChart: Record<string, Record<string, number>> = {};
  const byFeature: Record<string, { requests: number; tokens: number; errors: number; fallbacks: number }> = {};

  for (const r of rollups) {
    totalRequests += r.requests || 0;
    totalInputTokens += r.inputTokens || 0;
    totalOutputTokens += r.outputTokens || 0;
    totalImages += r.images || 0;
    totalErrors += r.errors || 0;
    totalFallbacks += r.fallbacks || 0;
    if (pricesVerified && r.costMinor) totalCostMinor += r.costMinor;

    if (!dailyChart[r.day]) dailyChart[r.day] = {};
    dailyChart[r.day]![r.feature] = (dailyChart[r.day]![r.feature] || 0) + (r.requests || 0);

    if (!byFeature[r.feature]) {
      byFeature[r.feature] = { requests: 0, tokens: 0, errors: 0, fallbacks: 0 };
    }
    byFeature[r.feature]!.requests += r.requests || 0;
    byFeature[r.feature]!.tokens += (r.inputTokens || 0) + (r.outputTokens || 0);
    byFeature[r.feature]!.errors += r.errors || 0;
    byFeature[r.feature]!.fallbacks += r.fallbacks || 0;
  }

  // Top users by requests in date range (pseudonymized/counts only)
  const recordFilter: mongoose.FilterQuery<Record<string, unknown>> = {
    createdAt: { $gte: new Date(`${fromDay}T00:00:00.000Z`), $lte: new Date(`${toDay}T23:59:59.999Z`) },
  };
  if (targetScope !== "PLATFORM" && mongoose.Types.ObjectId.isValid(targetScope)) {
    recordFilter.agencyId = new mongoose.Types.ObjectId(targetScope);
  }
  if (params.feature) recordFilter.feature = params.feature;

  const topUserAgg = await AiUsageRecord.aggregate<{ _id: mongoose.Types.ObjectId; requests: number; flagsCount: number }>([
    { $match: recordFilter },
    {
      $group: {
        _id: "$userId",
        requests: { $sum: 1 },
        flagsCount: { $sum: { $size: { $ifNull: ["$flags", []] } } },
      },
    },
    { $sort: { requests: -1 } },
    { $limit: 10 },
  ]);

  const topUsers = topUserAgg.map((u) => ({
    userPseudonymId: pseudonymizeUserId(u._id),
    requests: u.requests,
    flaggedPromptsCount: u.flagsCount,
  }));

  return {
    scope: targetScope,
    from: fromDay,
    to: toDay,
    totals: {
      requests: totalRequests,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      images: totalImages,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      fallbackRate: totalRequests > 0 ? totalFallbacks / totalRequests : 0,
      estimatedCostMinor: pricesVerified ? totalCostMinor : null,
      pricesVerified,
    },
    budgets: {
      dailyTokenBudget: settings.dailyTokenBudget,
      monthlyTokenBudget: settings.monthlyTokenBudget,
      dailyVisionImages: settings.dailyVisionImages,
      autoDowngradeAtBudgetPercent: settings.autoDowngradeAtBudgetPercent,
    },
    dailyChart: Object.entries(dailyChart).map(([day, features]) => ({ day, ...features })),
    byFeature,
    topUsers,
  };
}

export async function getAiAudit(
  actor: GovernanceActor,
  params: { from?: string; to?: string; feature?: string; status?: string; limit?: number; cursor?: string },
) {
  const isSuperAdmin = actor.roleKey === "SUPER_ADMIN";
  const query: mongoose.FilterQuery<Record<string, unknown>> = {};

  if (!isSuperAdmin && actor.agencyId && mongoose.Types.ObjectId.isValid(actor.agencyId)) {
    query.agencyId = new mongoose.Types.ObjectId(actor.agencyId);
  }
  if (params.feature) query.feature = params.feature;
  if (params.status) query.status = params.status;
  if (params.from || params.to) {
    const createdAtFilter: { $gte?: Date; $lte?: Date } = {};
    if (params.from) createdAtFilter.$gte = new Date(`${params.from}T00:00:00.000Z`);
    if (params.to) createdAtFilter.$lte = new Date(`${params.to}T23:59:59.999Z`);
    query.createdAt = createdAtFilter;
  }
  if (params.cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(params.cursor) };
  }

  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const records = await AiUsageRecord.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const page = records.slice(0, limit);
  const nextCursor = records.length > limit ? page[page.length - 1]?._id.toString() ?? null : null;

  // HARD SECURITY GUARANTEE: NEVER return prompts, answers, documents, or user identities
  const items = page.map((r) => ({
    id: r._id.toString(),
    timestamp: r.createdAt.toISOString(),
    feature: r.feature || r.purpose,
    kind: r.kind,
    userPseudonymId: pseudonymizeUserId(r.userId),
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    status: r.status,
    latencyMs: r.latencyMs ?? 0,
    flags: r.flags || [],
    providerPolicy: r.providerPolicy,
  }));

  return { items, nextCursor };
}

function csvSafe(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection characters (=, +, -, @, tab, CR)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, "\"\"");
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

export async function exportAiAuditCsv(
  actor: GovernanceActor,
  params: { from?: string; to?: string; feature?: string; status?: string },
  requestId: string,
): Promise<string> {
  const { items } = await getAiAudit(actor, { ...params, limit: 100 });
  const headers = [
    "Timestamp",
    "Feature",
    "Kind",
    "User Pseudonym",
    "Model",
    "Input Tokens",
    "Output Tokens",
    "Status",
    "Latency Ms",
    "Flags",
    "Provider Policy",
  ];
  const lines = [headers.map(csvSafe).join(",")];
  for (const item of items) {
    lines.push(
      [
        item.timestamp,
        item.feature,
        item.kind,
        item.userPseudonymId,
        item.model,
        item.inputTokens,
        item.outputTokens,
        item.status,
        item.latencyMs,
        (item.flags || []).join(";"),
        item.providerPolicy || "",
      ]
        .map(csvSafe)
        .join(","),
    );
  }

  await writeAiAudit(undefined, {
    action: "ai.usage_exported",
    actorUserId: actor.userId,
    resourceType: actor.agencyId ? "AGENCY" : "SYSTEM",
    resourceId: actor.agencyId && mongoose.Types.ObjectId.isValid(actor.agencyId)
      ? new mongoose.Types.ObjectId(actor.agencyId)
      : new mongoose.Types.ObjectId(actor.userId),
    agencyId: actor.agencyId,
    status: "EXPORTED",
    reason: `rows:${items.length}`,
    requestId,
  }).catch(() => undefined);

  return lines.join("\r\n");
}

function mapDocToDto(
  doc: AiSettingsOverridesInput | null | undefined,
  scope: "PLATFORM" | "AGENCY",
  agencyId?: string,
): AiSettingsDto {
  const defaults = getPlatformDefaults();
  const toIso = (val?: Date | string | null) => (val ? new Date(val).toISOString() : undefined);
  return {
    scope,
    agencyId,
    featureToggles: {
      qa: doc?.featureToggles?.qaEnabled ?? defaults.featureToggles.qa,
      summary: doc?.featureToggles?.summaryEnabled ?? defaults.featureToggles.summary,
      extraction: doc?.featureToggles?.extractionEnabled ?? defaults.featureToggles.extraction,
      riskNarrative: doc?.featureToggles?.riskNarrativeEnabled ?? defaults.featureToggles.riskNarrative,
      vision: doc?.featureToggles?.visionEnabled ?? defaults.featureToggles.vision,
      copilot: doc?.featureToggles?.copilotEnabled ?? defaults.featureToggles.copilot,
      embedding: doc?.featureToggles?.embeddingEnabled ?? defaults.featureToggles.embedding,
    },
    limits: {
      userRequestsPer10Min: {
        qa: doc?.limits?.userRequestsPer10Min?.qa ?? defaults.userRequestsPer10Min.qa,
        summary: doc?.limits?.userRequestsPer10Min?.summary ?? defaults.userRequestsPer10Min.summary,
        extraction: doc?.limits?.userRequestsPer10Min?.extraction ?? defaults.userRequestsPer10Min.extraction,
        riskNarrative: doc?.limits?.userRequestsPer10Min?.riskNarrative ?? defaults.userRequestsPer10Min.riskNarrative,
        vision: doc?.limits?.userRequestsPer10Min?.vision ?? defaults.userRequestsPer10Min.vision,
        copilot: doc?.limits?.userRequestsPer10Min?.copilot ?? defaults.userRequestsPer10Min.copilot,
        embedding: doc?.limits?.userRequestsPer10Min?.embedding ?? defaults.userRequestsPer10Min.embedding,
      },
      agencyRequestsPerDay: {
        qa: doc?.limits?.agencyRequestsPerDay?.qa ?? defaults.agencyRequestsPerDay.qa,
        summary: doc?.limits?.agencyRequestsPerDay?.summary ?? defaults.agencyRequestsPerDay.summary,
        extraction: doc?.limits?.agencyRequestsPerDay?.extraction ?? defaults.agencyRequestsPerDay.extraction,
        riskNarrative: doc?.limits?.agencyRequestsPerDay?.riskNarrative ?? defaults.agencyRequestsPerDay.riskNarrative,
        vision: doc?.limits?.agencyRequestsPerDay?.vision ?? defaults.agencyRequestsPerDay.vision,
        copilot: doc?.limits?.agencyRequestsPerDay?.copilot ?? defaults.agencyRequestsPerDay.copilot,
        embedding: doc?.limits?.agencyRequestsPerDay?.embedding ?? defaults.agencyRequestsPerDay.embedding,
      },
      concurrencyPerUser: doc?.limits?.concurrencyPerUser ?? defaults.concurrencyPerUser,
      copilotMaxMessageLength: doc?.limits?.copilotMaxMessageLength ?? defaults.copilotMaxMessageLength,
      visionMaxImages: doc?.limits?.visionMaxImages ?? defaults.visionMaxImages,
    },
    budgets: {
      dailyTokenBudget: {
        LOW: doc?.budgets?.dailyTokenBudget?.LOW ?? defaults.dailyTokenBudget.LOW,
        STRONG: doc?.budgets?.dailyTokenBudget?.STRONG ?? defaults.dailyTokenBudget.STRONG,
        VISION: doc?.budgets?.dailyTokenBudget?.VISION ?? defaults.dailyTokenBudget.VISION,
        EMBED: doc?.budgets?.dailyTokenBudget?.EMBED ?? defaults.dailyTokenBudget.EMBED,
      },
      monthlyTokenBudget: {
        LOW: doc?.budgets?.monthlyTokenBudget?.LOW ?? defaults.monthlyTokenBudget.LOW,
        STRONG: doc?.budgets?.monthlyTokenBudget?.STRONG ?? defaults.monthlyTokenBudget.STRONG,
        VISION: doc?.budgets?.monthlyTokenBudget?.VISION ?? defaults.monthlyTokenBudget.VISION,
        EMBED: doc?.budgets?.monthlyTokenBudget?.EMBED ?? defaults.monthlyTokenBudget.EMBED,
      },
      dailyVisionImages: doc?.budgets?.dailyVisionImages ?? defaults.dailyVisionImages,
    },
    modelCatalog:
      scope === "PLATFORM"
        ? {
            LOW: {
              modelId: doc?.modelCatalog?.LOW?.modelId ?? defaults.modelCatalog.LOW.modelId,
              verifiedAt: toIso(doc?.modelCatalog?.LOW?.verifiedAt),
              source: doc?.modelCatalog?.LOW?.source ?? "admin-entered",
              pricePerMInputMinor: doc?.modelCatalog?.LOW?.pricePerMInputMinor ?? undefined,
              pricePerMOutputMinor: doc?.modelCatalog?.LOW?.pricePerMOutputMinor ?? undefined,
            },
            STRONG: {
              modelId: doc?.modelCatalog?.STRONG?.modelId ?? defaults.modelCatalog.STRONG.modelId,
              verifiedAt: toIso(doc?.modelCatalog?.STRONG?.verifiedAt),
              source: doc?.modelCatalog?.STRONG?.source ?? "admin-entered",
              pricePerMInputMinor: doc?.modelCatalog?.STRONG?.pricePerMInputMinor ?? undefined,
              pricePerMOutputMinor: doc?.modelCatalog?.STRONG?.pricePerMOutputMinor ?? undefined,
            },
            VISION: {
              modelId: doc?.modelCatalog?.VISION?.modelId ?? defaults.modelCatalog.VISION.modelId,
              verifiedAt: toIso(doc?.modelCatalog?.VISION?.verifiedAt),
              source: doc?.modelCatalog?.VISION?.source ?? "admin-entered",
              pricePerImageMinor: doc?.modelCatalog?.VISION?.pricePerImageMinor ?? undefined,
            },
            EMBED: {
              modelId: doc?.modelCatalog?.EMBED?.modelId ?? defaults.modelCatalog.EMBED.modelId,
              verifiedAt: toIso(doc?.modelCatalog?.EMBED?.verifiedAt),
              source: doc?.modelCatalog?.EMBED?.source ?? "admin-entered",
              pricePerMInputMinor: doc?.modelCatalog?.EMBED?.pricePerMInputMinor ?? undefined,
            },
          }
        : undefined,
    routing: {
      strongSummaryInputThreshold: doc?.routing?.strongSummaryInputThreshold ?? defaults.strongSummaryInputThreshold,
      autoDowngradeAtBudgetPercent: doc?.routing?.autoDowngradeAtBudgetPercent ?? defaults.autoDowngradeAtBudgetPercent,
    },
    updatedBy: doc?.updatedBy ? String(doc.updatedBy) : undefined,
    version: doc?.version ?? 1,
  };
}

export async function getSettings(actor: GovernanceActor, targetAgencyId?: string) {
  const isSuperAdmin = actor.roleKey === "SUPER_ADMIN";
  const resolvedAgencyId = isSuperAdmin && targetAgencyId ? targetAgencyId : actor.agencyId;

  const { platformDoc, agencyDoc } = await loadPlatformAndAgencyDocs(resolvedAgencyId);
  const effective = resolveEffectiveSettings(platformDoc, agencyDoc);

  return {
    effective,
    platform: isSuperAdmin ? mapDocToDto(platformDoc, "PLATFORM") : undefined,
    agency: resolvedAgencyId ? mapDocToDto(agencyDoc, "AGENCY", resolvedAgencyId) : undefined,
  };
}

export type UpdateAiSettingsInput = {
  scope?: "PLATFORM" | "AGENCY";
  agencyId?: string;
  version: number;
  featureToggles?: Partial<Record<AiFeatureKey, boolean | undefined>>;
  limits?: {
    userRequestsPer10Min?: Partial<Record<AiFeatureKey, number | undefined>>;
    agencyRequestsPerDay?: Partial<Record<AiFeatureKey, number | undefined>>;
    concurrencyPerUser?: number;
  };
  budgets?: {
    dailyTokenBudget?: Partial<Record<AiModelTier, number | undefined>>;
    dailyVisionImages?: number;
  };
  modelCatalog?: Partial<Record<AiModelTier, {
    modelId: string;
    verifiedAt?: string;
    source?: "admin-entered" | "provider-listing";
    pricePerMInputMinor?: number;
    pricePerMOutputMinor?: number;
    pricePerImageMinor?: number;
  }>>;
  routing?: {
    strongSummaryInputThreshold?: number;
    autoDowngradeAtBudgetPercent?: number;
  };
};

export async function updateSettings(
  actor: GovernanceActor,
  scope: "PLATFORM" | "AGENCY",
  input: UpdateAiSettingsInput,
  requestId: string,
) {
  const isSuperAdmin = actor.roleKey === "SUPER_ADMIN";
  if (scope === "PLATFORM" && !isSuperAdmin) {
    throw new GovernanceError(403, "FORBIDDEN", "Only Platform Super Admin can update platform-wide AI settings.");
  }
  if (input.modelCatalog && (scope !== "PLATFORM" || !isSuperAdmin)) {
    throw new GovernanceError(403, "FORBIDDEN", "Model catalog can only be modified at PLATFORM scope by Super Admin.");
  }

  const targetAgencyId = scope === "AGENCY" ? (isSuperAdmin && input.agencyId ? input.agencyId : actor.agencyId) : undefined;
  if (scope === "AGENCY" && !targetAgencyId) {
    throw new GovernanceError(400, "MISSING_AGENCY", "Agency ID is required for agency settings.");
  }
  if (scope === "AGENCY" && !isSuperAdmin && input.agencyId && input.agencyId !== actor.agencyId) {
    throw new GovernanceError(403, "FORBIDDEN", "Cannot modify settings for another agency.");
  }

  const filter: mongoose.FilterQuery<Record<string, unknown>> = { scope };
  if (targetAgencyId) filter.agencyId = new mongoose.Types.ObjectId(targetAgencyId);

  const existing = await AiSettings.findOne(filter);
  if (existing && existing.version !== input.version) {
    throw new GovernanceError(409, "CONFLICT", "Settings were modified concurrently by another administrator.");
  }

  const updateSet: Record<string, unknown> = {
    updatedBy: new mongoose.Types.ObjectId(actor.userId),
  };

  if (input.featureToggles) {
    for (const k of AI_FEATURE_KEYS) {
      if (typeof input.featureToggles[k] === "boolean") {
        updateSet[`featureToggles.${k}Enabled`] = input.featureToggles[k];
      }
    }
  }

  if (input.limits) {
    if (input.limits.userRequestsPer10Min) {
      for (const k of AI_FEATURE_KEYS) {
        const val = input.limits.userRequestsPer10Min[k];
        if (typeof val === "number") {
          updateSet[`limits.userRequestsPer10Min.${k}`] = Math.max(1, val);
        }
      }
    }
    if (input.limits.agencyRequestsPerDay) {
      for (const k of AI_FEATURE_KEYS) {
        const val = input.limits.agencyRequestsPerDay[k];
        if (typeof val === "number") {
          updateSet[`limits.agencyRequestsPerDay.${k}`] = Math.max(1, val);
        }
      }
    }
    if (typeof input.limits.concurrencyPerUser === "number") {
      updateSet["limits.concurrencyPerUser"] = Math.max(1, Math.min(5, input.limits.concurrencyPerUser));
    }
  }

  if (input.budgets) {
    if (input.budgets.dailyTokenBudget) {
      for (const t of AI_MODEL_TIERS) {
        const val = input.budgets.dailyTokenBudget[t];
        if (typeof val === "number") {
          updateSet[`budgets.dailyTokenBudget.${t}`] = Math.max(1000, val);
        }
      }
    }
    if (typeof input.budgets.dailyVisionImages === "number") {
      updateSet["budgets.dailyVisionImages"] = Math.max(0, input.budgets.dailyVisionImages);
    }
  }

  // Model catalog is PLATFORM-only
  if (scope === "PLATFORM" && input.modelCatalog) {
    for (const t of AI_MODEL_TIERS) {
      const entry = input.modelCatalog[t];
      if (entry && typeof entry.modelId === "string") {
        updateSet[`modelCatalog.${t}`] = {
          modelId: entry.modelId.trim(),
          verifiedAt: entry.verifiedAt ? new Date(entry.verifiedAt) : undefined,
          source: entry.source || "admin-entered",
          pricePerMInputMinor: entry.pricePerMInputMinor,
          pricePerMOutputMinor: entry.pricePerMOutputMinor,
          pricePerImageMinor: entry.pricePerImageMinor,
        };
      }
    }
  }

  if (input.routing) {
    if (typeof input.routing.autoDowngradeAtBudgetPercent === "number") {
      updateSet["routing.autoDowngradeAtBudgetPercent"] = Math.max(10, Math.min(100, input.routing.autoDowngradeAtBudgetPercent));
    }
    if (typeof input.routing.strongSummaryInputThreshold === "number") {
      updateSet["routing.strongSummaryInputThreshold"] = Math.max(1000, input.routing.strongSummaryInputThreshold);
    }
  }

  let saved;
  if (existing) {
    saved = await AiSettings.findOneAndUpdate(
      { _id: existing._id, version: input.version },
      { $set: updateSet, $inc: { version: 1 } },
      { new: true },
    ).lean();
    if (!saved) {
      throw new GovernanceError(409, "CONFLICT", "Settings conflict detected during save.");
    }
  } else {
    saved = await AiSettings.create({
      scope,
      agencyId: targetAgencyId ? new mongoose.Types.ObjectId(targetAgencyId) : undefined,
      ...updateSet,
      version: 1,
    });
  }

  await writeAiAudit(undefined, {
    action: "ai.settings_updated",
    actorUserId: actor.userId,
    resourceType: scope === "AGENCY" && targetAgencyId ? "AGENCY" : "SYSTEM",
    resourceId: saved._id,
    agencyId: targetAgencyId,
    status: scope,
    reason: `v:${saved.version}`,
    requestId,
  }).catch(() => undefined);

  return mapDocToDto(saved, scope, targetAgencyId);
}

export async function resetSettings(
  actor: GovernanceActor,
  scope: "PLATFORM" | "AGENCY",
  targetAgencyId: string | undefined,
  requestId: string,
) {
  const isSuperAdmin = actor.roleKey === "SUPER_ADMIN";
  if (scope === "PLATFORM" && !isSuperAdmin) {
    throw new GovernanceError(403, "FORBIDDEN", "Only Platform Super Admin can reset platform settings.");
  }
  if (scope === "AGENCY" && !isSuperAdmin && targetAgencyId && targetAgencyId !== actor.agencyId) {
    throw new GovernanceError(403, "FORBIDDEN", "Cannot reset settings for another agency.");
  }

  const agencyId = scope === "AGENCY" ? (isSuperAdmin && targetAgencyId ? targetAgencyId : actor.agencyId) : undefined;
  const filter: mongoose.FilterQuery<Record<string, unknown>> = { scope };
  if (agencyId) filter.agencyId = new mongoose.Types.ObjectId(agencyId);

  const existing = await AiSettings.findOne(filter);
  if (existing) {
    await AiSettings.deleteOne({ _id: existing._id });
  }

  await writeAiAudit(undefined, {
    action: "ai.settings_reset",
    actorUserId: actor.userId,
    resourceType: scope === "AGENCY" && agencyId ? "AGENCY" : "SYSTEM",
    resourceId: existing?._id ?? new mongoose.Types.ObjectId(),
    agencyId,
    status: scope,
    reason: "RESET_TO_DEFAULTS",
    requestId,
  }).catch(() => undefined);

  return mapDocToDto(null, scope, agencyId);
}

export async function checkModelsProbe(actor: GovernanceActor, requestId: string) {
  const client = aiClient();
  let result: {
    reachable: boolean;
    message: string;
    capabilities?: Record<string, unknown>;
    configuredModels: Record<AiModelTier, string>;
  } = {
    reachable: false,
    message: "AI Service not configured (AI_BASE_URL unset).",
    configuredModels: {
      LOW: aiConfig.chat?.model || "",
      STRONG: aiConfig.chat?.strongModel || "",
      VISION: aiConfig.vision?.model || "",
      EMBED: aiConfig.embedModel || "",
    },
  };

  if (client.configured) {
    try {
      const caps = await client.capabilities();
      result = {
        reachable: true,
        message: "Connected to AI service capabilities successfully. Never auto-applies settings.",
        capabilities: caps as Record<string, unknown>,
        configuredModels: {
          LOW: aiConfig.chat?.model || "",
          STRONG: aiConfig.chat?.strongModel || "",
          VISION: aiConfig.vision?.model || "",
          EMBED: aiConfig.embedModel || "",
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unreachable";
      result.message = `AI service or upstream provider probe failed/SKIPPED (${msg}).`;
    }
  }

  await writeAiAudit(undefined, {
    action: "ai.models_checked",
    actorUserId: actor.userId,
    resourceType: "SYSTEM",
    resourceId: new mongoose.Types.ObjectId(),
    agencyId: actor.agencyId,
    status: result.reachable ? "REACHABLE" : "UNREACHABLE",
    requestId,
  }).catch(() => undefined);

  return result;
}

export async function getAboutAi(agencyId?: string) {
  const { platformDoc, agencyDoc } = await loadPlatformAndAgencyDocs(agencyId);
  const settings = resolveEffectiveSettings(platformDoc, agencyDoc);

  return {
    provider: {
      name: "OpenRouter / OpenAI-Compatible API Gateway",
      dataHandlingPolicy: "Zero data retention / training opted-out per request routing headers",
      serviceArchitecture: "FastAPI microservice with zero direct database access; stateless LLM proxy",
    },
    features: {
      qa: {
        enabled: settings.featureToggles.qa,
        model: settings.modelCatalog.LOW.modelId || "Not Configured",
        sends: ["Redacted indexed document passages matching query", "System language preference"],
        humanReviewRule: "Outputs are quote-verified with inline [n] citations to exact document pages",
      },
      summary: {
        enabled: settings.featureToggles.summary,
        model: settings.modelCatalog.STRONG.modelId || settings.modelCatalog.LOW.modelId || "Not Configured",
        sends: ["Redacted section text of chosen document"],
        humanReviewRule: "Advisory summary saved separately; never modifies official document contents",
      },
      extraction: {
        enabled: settings.featureToggles.extraction,
        model: settings.modelCatalog.STRONG.modelId || settings.modelCatalog.LOW.modelId || "Not Configured",
        sends: ["Redacted document excerpts and requested schema keys"],
        humanReviewRule: "Requires explicit human review before applying extracted metadata fields",
      },
      riskNarrative: {
        enabled: settings.featureToggles.riskNarrative,
        model: settings.modelCatalog.LOW.modelId || "Not Configured",
        sends: ["Calculated deterministic indicator codes, severities, and explanation keys"],
        humanReviewRule: "Optional explanatory prose only; deterministic risk scores cannot be changed by AI",
      },
      vision: {
        enabled: settings.featureToggles.vision,
        model: settings.modelCatalog.VISION.modelId || "Not Configured",
        sends: ["Selected evidence photos (EXIF/GPS stripped)", "Project type, milestone titles, claimed progress"],
        humanReviewRule: "OFF by default. Requires provider notice acknowledgement before send, and explicit inspector review before adding advisory observations to report",
      },
      copilot: {
        enabled: settings.featureToggles.copilot,
        model: settings.modelCatalog.LOW.modelId || "Not Configured",
        sends: ["Sanitized user question", "Validated read-only tool facts from authorized scope"],
        humanReviewRule: "Strictly read-only tools. Every numerical/factual claim is verified server-side against source records",
      },
    },
    neverSent: [
      "Documents marked SENSITIVE or AI-excluded",
      "Original uploaded file names or uploader names/identities",
      "Photo GPS coordinates or camera EXIF metadata",
      "Personal identifiers (Sri Lankan NICs, phone numbers, email addresses)",
      "Direct database credentials or records outside your authorized agency scope",
    ],
    neverDoes: [
      "Approve or reject inspections, contractors, or payments",
      "Write or mutate verified progress percentages or milestone completion statuses",
      "Identify individuals in photos or attribute legal blame/fraud",
      "Estimate numeric completion percentages directly from site photographs",
    ],
    retention: {
      qaHistoryDays: 90,
      copilotHistoryDays: 30,
      usageAuditDays: 90,
    },
    limits: {
      concurrencyPerUser: settings.concurrencyPerUser,
      copilotMaxMessageLength: settings.copilotMaxMessageLength,
      visionMaxImages: settings.visionMaxImages,
    },
    lastSettingsUpdatedAt: agencyDoc?.updatedAt?.toISOString() || platformDoc?.updatedAt?.toISOString() || null,
  };
}
