import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { AiUsageDaily } from "../src/modules/ai/governance/usage-daily.model.js";
import { AiRateBucket } from "../src/modules/ai/governance/rate-bucket.model.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { checkGate, recordGate, releaseUserConcurrency } from "../src/modules/ai/governance/ai-gate.js";
import { resolveEffectiveSettings, getPlatformDefaults, colomboDayString } from "../src/modules/ai/governance/ai.defaults.js";
import { resolveTierForFeature, shouldDowngradeTier } from "../src/modules/ai/governance/model-router.js";

describe("Central AI Governance Gate (Phase 10 Step 126)", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  beforeEach(async () => {
    await Promise.all([
      AiSettings.deleteMany({}),
      AiUsageDaily.deleteMany({}),
      AiRateBucket.deleteMany({}),
      AiUsageRecord.deleteMany({}),
    ]);
  });

  describe("Effective settings resolution", () => {
    it("uses platform defaults when no database settings exist", () => {
      const defaults = getPlatformDefaults();
      const effective = resolveEffectiveSettings(undefined, undefined);

      expect(effective.featureToggles.vision).toBe(defaults.featureToggles.vision);
      expect(effective.featureToggles.vision).toBe(false); // Vision is OFF by default
      expect(effective.featureToggles.copilot).toBe(true);
      expect(effective.userRequestsPer10Min.copilot).toBe(15);
      expect(effective.userRequestsPer10Min.qa).toBe(20);
    });

    it("enforces most restrictive rule between platform and agency", () => {
      const platformDoc = {
        featureToggles: { visionEnabled: false, qaEnabled: true },
        limits: {
          userRequestsPer10Min: { copilot: 10 },
          agencyRequestsPerDay: { copilot: 1000 },
        },
      };

      // Agency attempts to enable vision (which platform disabled) and raise copilot limit
      const agencyDoc = {
        featureToggles: { visionEnabled: true, qaEnabled: false },
        limits: {
          userRequestsPer10Min: { copilot: 25 }, // Cannot raise above 10
        },
      };

      const effective = resolveEffectiveSettings(platformDoc, agencyDoc);

      // Vision remains false because platform disabled it
      expect(effective.featureToggles.vision).toBe(false);
      // QA is disabled because agency disabled it
      expect(effective.featureToggles.qa).toBe(false);
      // Copilot limit takes the lower of platform (10) and agency (25)
      expect(effective.userRequestsPer10Min.copilot).toBe(10);
    });
  });

  describe("Gate checks and rate limiting", () => {
    const actor = {
      userId: new mongoose.Types.ObjectId().toHexString(),
      agencyId: new mongoose.Types.ObjectId().toHexString(),
    };

    it("denies access if feature is disabled", async () => {
      // Vision is false by default
      const res = await checkGate({
        actor,
        feature: "vision",
      });

      expect(res.allow).toBe(false);
      if (!res.allow) {
        expect(res.deny.code).toBe("FEATURE_DISABLED");
      }
    });

    it("enforces per-user concurrency limit of 1 for copilot", async () => {
      // Configure low model in platform settings
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { copilotEnabled: true },
        modelCatalog: {
          LOW: { modelId: "test-chat-model", source: "admin-entered" },
        },
      });

      const first = await checkGate({
        actor,
        feature: "copilot",
      });
      expect(first.allow).toBe(true);

      // Second simultaneous request from the same user
      const second = await checkGate({
        actor,
        feature: "copilot",
      });
      expect(second.allow).toBe(false);
      if (!second.allow) {
        expect(second.deny.code).toBe("AI_CONCURRENCY_EXCEEDED");
      }

      // After releasing concurrency
      releaseUserConcurrency(actor.userId, "copilot");
      const third = await checkGate({
        actor,
        feature: "copilot",
      });
      expect(third.allow).toBe(true);
      releaseUserConcurrency(actor.userId, "copilot");
    });

    it("enforces fixed-window rate limit via atomic rate buckets", async () => {
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { qaEnabled: true },
        limits: {
          userRequestsPer10Min: { qa: 2 },
        },
        modelCatalog: {
          LOW: { modelId: "test-chat-model", source: "admin-entered" },
        },
      });

      const res1 = await checkGate({ actor, feature: "qa" });
      expect(res1.allow).toBe(true);

      const res2 = await checkGate({ actor, feature: "qa" });
      expect(res2.allow).toBe(true);

      // Third request exceeds limit of 2
      const res3 = await checkGate({ actor, feature: "qa" });
      expect(res3.allow).toBe(false);
      if (!res3.allow) {
        expect(res3.deny.code).toBe("AI_RATE_LIMITED");
        expect(res3.deny.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it("denies requests when daily token budget is exceeded", async () => {
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { qaEnabled: true },
        budgets: {
          dailyTokenBudget: { LOW: 1000 },
        },
        modelCatalog: {
          LOW: { modelId: "test-chat-model", source: "admin-entered" },
        },
      });

      // Record 950 tokens used today
      const today = colomboDayString();
      await AiUsageDaily.create({
        day: today,
        scope: "PLATFORM",
        feature: "qa",
        tier: "LOW",
        inputTokens: 500,
        outputTokens: 450,
        requests: 2,
      });

      // Estimate of 100 tokens will exceed 1000 limit
      const res = await checkGate({
        actor,
        feature: "qa",
        estimate: { inputTokens: 50, outputTokens: 60 },
      });

      expect(res.allow).toBe(false);
      if (!res.allow) {
        expect(res.deny.code).toBe("AI_BUDGET_EXCEEDED");
        expect(res.deny.resetsAt).toBeDefined();
      }
    });
  });

  describe("Usage rollups and recording", () => {
    const actor = {
      userId: new mongoose.Types.ObjectId().toHexString(),
      agencyId: new mongoose.Types.ObjectId().toHexString(),
    };

    it("records both detailed ledger and atomic daily rollups", async () => {
      await recordGate({
        actor,
        agencyId: actor.agencyId,
        feature: "qa",
        tier: "LOW",
        model: "test-chat-model",
        actual: {
          inputTokens: 120,
          outputTokens: 80,
          costMinor: 2,
          status: "OK",
          latencyMs: 350,
          purpose: "QA",
        },
      });

      // 1. Detailed ledger check
      const record = await AiUsageRecord.findOne({ userId: actor.userId }).lean();
      expect(record).not.toBeNull();
      expect(record?.inputTokens).toBe(120);
      expect(record?.outputTokens).toBe(80);
      expect(record?.feature).toBe("qa");
      expect(record?.latencyMs).toBe(350);

      // 2. Daily rollups check (agency and platform)
      const today = colomboDayString();
      const agencyRollup = await AiUsageDaily.findOne({
        day: today,
        scope: actor.agencyId,
        feature: "qa",
      }).lean();
      expect(agencyRollup).not.toBeNull();
      expect(agencyRollup?.requests).toBe(1);
      expect(agencyRollup?.inputTokens).toBe(120);
      expect(agencyRollup?.outputTokens).toBe(80);

      const platformRollup = await AiUsageDaily.findOne({
        day: today,
        scope: "PLATFORM",
        feature: "qa",
      }).lean();
      expect(platformRollup).not.toBeNull();
      expect(platformRollup?.requests).toBe(1);
      expect(platformRollup?.inputTokens).toBe(120);
    });
  });

  describe("Model router and soft downgrade", () => {
    it("routes features to appropriate tiers", () => {
      expect(resolveTierForFeature("qa")).toBe("LOW");
      expect(resolveTierForFeature("riskNarrative")).toBe("LOW");
      expect(resolveTierForFeature("vision")).toBe("VISION");
      expect(resolveTierForFeature("embedding")).toBe("EMBED");
      expect(resolveTierForFeature("summary", { preferStrong: true })).toBe("STRONG");
    });

    it("triggers downgrade from STRONG to LOW at soft threshold", () => {
      const settings = getPlatformDefaults();
      settings.dailyTokenBudget.STRONG = 100_000;
      settings.autoDowngradeAtBudgetPercent = 80;

      // 79,000 tokens (79%) -> no downgrade
      expect(shouldDowngradeTier("STRONG", 79_000, settings)).toBe(false);
      // 81,000 tokens (81%) -> downgrade
      expect(shouldDowngradeTier("STRONG", 81_000, settings)).toBe(true);
    });
  });
});

