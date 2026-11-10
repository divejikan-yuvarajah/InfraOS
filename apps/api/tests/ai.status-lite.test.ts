import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { AiUsageDaily } from "../src/modules/ai/governance/usage-daily.model.js";
import { mapAiFailure } from "../src/modules/ai/governance/ai-failure.js";
import { getAiStatusLite } from "../src/modules/ai/governance/ai-status.service.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { createApp } from "../src/app.js";
import { colomboDayString } from "../src/modules/ai/governance/ai.defaults.js";
import { env } from "../src/config/env.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("AI Failure Mapping & Lite Status (Phase 10 Steps 126-127)", () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-test-0123456789abcdef0123456789";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-test-0123456789abcdef0123456789";
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  beforeEach(async () => {
    await Promise.all([
      AiSettings.deleteMany({}),
      AiUsageDaily.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Agency.deleteMany({}),
    ]);
  });

  describe("Failure mapping per §4.8", () => {
    it("maps feature disabled to user-safe message and copilot quick-facts fallback", () => {
      const mapped = mapAiFailure("FEATURE_DISABLED", { feature: "copilot" });
      expect(mapped.code).toBe("FEATURE_DISABLED");
      expect(mapped.retryable).toBe(false);
      expect(mapped.fallbackType).toBe("QUICK_FACTS");
      expect(mapped.userMessage).toContain("turned off");
    });

    it("maps model not configured to clear unavailable state", () => {
      const mapped = mapAiFailure("MODEL_NOT_CONFIGURED", { feature: "vision" });
      expect(mapped.code).toBe("MODEL_NOT_CONFIGURED");
      expect(mapped.retryable).toBe(false);
      expect(mapped.fallbackType).toBe("MANUAL_INSPECTION");
    });

    it("maps rate limiting with retryAfter countdown", () => {
      const mapped = mapAiFailure("AI_RATE_LIMITED", { retryAfterSeconds: 42, feature: "qa" });
      expect(mapped.code).toBe("AI_RATE_LIMITED");
      expect(mapped.retryable).toBe(true);
      expect(mapped.retryAfterSeconds).toBe(42);
      expect(mapped.userMessage).toContain("42 seconds");
    });

    it("maps budget exceeded with reset date", () => {
      const reset = new Date("2026-11-11T00:00:00Z");
      const mapped = mapAiFailure("AI_BUDGET_EXCEEDED", { resetsAt: reset, feature: "copilot" });
      expect(mapped.code).toBe("AI_BUDGET_EXCEEDED");
      expect(mapped.retryable).toBe(false);
      expect(mapped.fallbackType).toBe("QUICK_FACTS");
      expect(mapped.resetsAt).toEqual(reset);
    });

    it("maps service unavailable to correct domain fallback per feature", () => {
      const copilot = mapAiFailure("AI_SERVICE_UNAVAILABLE", { feature: "copilot" });
      expect(copilot.fallbackType).toBe("QUICK_FACTS");

      const qa = mapAiFailure("AI_SERVICE_UNAVAILABLE", { feature: "qa" });
      expect(qa.fallbackType).toBe("PASSAGES_ONLY");

      const vision = mapAiFailure("AI_SERVICE_UNAVAILABLE", { feature: "vision" });
      expect(vision.fallbackType).toBe("MANUAL_INSPECTION");
    });
  });

  describe("Lite status evaluation", () => {
    it("reports disabled for vision by default, and reflects configured models", async () => {
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { visionEnabled: false, copilotEnabled: true, qaEnabled: true },
        modelCatalog: {
          LOW: { modelId: "test-chat-model", source: "admin-entered" },
          STRONG: { modelId: "test-strong-model", source: "admin-entered" },
          EMBED: { modelId: "test-embed-model", source: "admin-entered" },
        },
      });

      const status = await getAiStatusLite();
      expect(status.features.vision).toBe("disabled");
      expect(status.features.copilot).toBe("available");
      expect(status.features.qa).toBe("available");
      expect(status.overall).toBe("available");
    });

    it("reports degraded at 80% daily budget and unavailable at 100%", async () => {
      const today = colomboDayString();
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { copilotEnabled: true },
        limits: {
          agencyRequestsPerDay: { copilot: 100 },
        },
        modelCatalog: {
          LOW: { modelId: "test-chat-model", source: "admin-entered" },
        },
      });

      // 85 requests used -> degraded
      await AiUsageDaily.create({
        day: today,
        scope: "PLATFORM",
        feature: "copilot",
        tier: "LOW",
        requests: 85,
        inputTokens: 1000,
        outputTokens: 500,
      });

      const degraded = await getAiStatusLite();
      expect(degraded.features.copilot).toBe("degraded");

      // Update to 100 requests used -> unavailable
      await AiUsageDaily.updateOne(
        { day: today, scope: "PLATFORM", feature: "copilot" },
        { $set: { requests: 100 } },
      );

      const exhausted = await getAiStatusLite();
      expect(exhausted.features.copilot).toBe("unavailable");
    });
  });

  describe("GET /api/v1/ai/status/lite HTTP endpoint", () => {
    const app = createApp();

    async function setupActor(permissions: string[]) {
      const agency = await Agency.create({
        code: `AGY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "Test Agency",
        type: "MINISTRY",
        status: "ACTIVE",
      });
      const role = await Role.create({
        key: "PROJECT_MANAGER",
        name: "Test Role",
        description: "Test role description",
        scopeType: "ASSIGNED_PROJECT",
        permissions,
        isSystem: true,
        isActive: true,
      });
      const user = await User.create({
        firstName: "Test",
        lastName: "User",
        email: `u${Date.now()}_${Math.random()}@test.gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        roleId: role._id,
        agencyId: agency._id,
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });
      const { token } = await signAccessToken(user._id.toString(), 1);
      return { user, role, agency, token };
    }

    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/v1/ai/status/lite");
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks any AI permission", async () => {
      const { token } = await setupActor(["project.read"]);
      const res = await request(app)
        .get("/api/v1/ai/status/lite")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it("returns 200 with lite status for user with copilot.use permission", async () => {
      const { token } = await setupActor(["copilot.use"]);
      const res = await request(app)
        .get("/api/v1/ai/status/lite")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("features");
      expect(res.body.data).toHaveProperty("overall");
      expect(res.body.data.features).toHaveProperty("copilot");
      expect(res.body.data.features).toHaveProperty("vision");
      expect(res.body.data).not.toHaveProperty("secret");
      expect(res.body.data).not.toHaveProperty("key");
    });
  });
});
