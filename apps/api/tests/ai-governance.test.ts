import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { AiUsageDaily } from "../src/modules/ai/governance/usage-daily.model.js";
import { AiRateBucket } from "../src/modules/ai/governance/rate-bucket.model.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { checkGate, recordGate, releaseUserConcurrency } from "../src/modules/ai/governance/ai-gate.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("AI Governance APIs (Phase 10 Batch 12 Steps 126-127)", () => {
  const app = createApp();

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
      AiRateBucket.deleteMany({}),
      AiUsageRecord.deleteMany({}),
      AuditLog.collection.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Agency.deleteMany({}),
    ]);
  });

  async function seedActor(roleKey: "SUPER_ADMIN" | "GOV_ADMIN" | "INSPECTOR" | "CITIZEN", customAgencyId?: mongoose.Types.ObjectId) {
    const agency = customAgencyId
      ? await Agency.findById(customAgencyId)
      : await Agency.create({
          code: `AGY_${Date.now()}_${Math.floor(Math.random() * 10_000)}`,
          name: "Road Development Agency",
          type: "MINISTRY",
          status: "ACTIVE",
        });

    let role = await Role.findOne({ key: roleKey });
    if (!role) {
      role = await Role.create({
        key: roleKey,
        name: `${roleKey} Role`,
        description: `Role ${roleKey}`,
        scopeType: roleKey === "SUPER_ADMIN" ? "PLATFORM" : "AGENCY",
        permissions: [...SYSTEM_ROLE_PERMISSIONS[roleKey]],
        isSystem: true,
        isActive: true,
      });
    }

    const user = await User.create({
      firstName: roleKey,
      lastName: "Tester",
      email: `${roleKey.toLowerCase()}.${Date.now()}.${Math.random()}@gov.lk`,
      passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
      roleId: role._id,
      agencyId: agency!._id,
      status: "ACTIVE",
      emailVerified: true,
      credentialEpoch: 1,
    });

    const { token } = await signAccessToken(user._id.toString(), 1);
    return { user, role, agency: agency!, token };
  }

  it("returns accurate limits without double-counting agency + platform rollups and syncs with checkGate rate buckets", async () => {
    const gov = await seedActor("GOV_ADMIN");
    await AiSettings.create({
      scope: "PLATFORM",
      featureToggles: { qaEnabled: true, copilotEnabled: true },
      limits: { userRequestsPer10Min: { qa: 12, copilot: 15 } },
      modelCatalog: {
        LOW: { modelId: "test-stub/chat-low", source: "admin-entered" },
      },
    });

    const gate = await checkGate({
      actor: { userId: gov.user._id.toString(), agencyId: gov.agency._id.toString() },
      agencyId: gov.agency._id.toString(),
      feature: "qa",
      estimate: { costUnits: 2 },
    });
    expect(gate.allow).toBe(true);

    await recordGate({
      actor: { userId: gov.user._id.toString(), agencyId: gov.agency._id.toString() },
      agencyId: gov.agency._id.toString(),
      feature: "qa",
      tier: "LOW",
      model: "test-stub/chat-low",
      actual: { inputTokens: 150, outputTokens: 50, status: "OK" },
    });

    const res = await request(app)
      .get("/api/v1/ai/limits/me")
      .set("Authorization", `Bearer ${gov.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.features.qa.used10Min).toBe(2);
    expect(res.body.data.features.qa.remaining10Min).toBe(10);
    expect(res.body.data.dailyTokensUsed).toBe(200); // Not double-counted (150+50 once!)
    expect(res.body.data.features.qa.agencyDailyUsed).toBe(1);
    releaseUserConcurrency(gov.user._id.toString(), "qa");
  });

  it("returns personal usage without any prompt or content fields", async () => {
    const inspector = await seedActor("INSPECTOR");
    await recordGate({
      actor: { userId: inspector.user._id.toString(), agencyId: inspector.agency._id.toString() },
      agencyId: inspector.agency._id.toString(),
      feature: "qa",
      tier: "LOW",
      model: "test-stub/chat-low",
      actual: { inputTokens: 100, outputTokens: 40, status: "OK", latencyMs: 420 },
    });

    const res = await request(app)
      .get("/api/v1/ai/usage/me")
      .set("Authorization", `Bearer ${inspector.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.today.requests).toBe(1);
    expect(res.body.data.today.inputTokens).toBe(100);
    expect(res.body.data.recentRequests).toHaveLength(1);
    expect(res.body.data.recentRequests[0]).not.toHaveProperty("question");
    expect(res.body.data.recentRequests[0]).not.toHaveProperty("prompt");
    expect(res.body.data.recentRequests[0]).not.toHaveProperty("answer");
  });

  it("isolates agency usage by scope and gates cost reporting on verifiedAt", async () => {
    const gov1 = await seedActor("GOV_ADMIN");
    const gov2 = await seedActor("GOV_ADMIN");

    await recordGate({
      actor: { userId: gov1.user._id.toString(), agencyId: gov1.agency._id.toString() },
      agencyId: gov1.agency._id.toString(),
      feature: "qa",
      tier: "LOW",
      model: "test-stub/chat-low",
      actual: { inputTokens: 1000, outputTokens: 500, costMinor: 5, status: "OK" },
    });

    // Cross-agency access rejected
    const crossRes = await request(app)
      .get(`/api/v1/ai/usage/agency?agencyId=${gov2.agency._id.toString()}`)
      .set("Authorization", `Bearer ${gov1.token}`);
    expect(crossRes.status).toBe(403);

    // Without verifiedAt -> pricesVerified: false, estimatedCostMinor: null
    const ownRes = await request(app)
      .get("/api/v1/ai/usage/agency")
      .set("Authorization", `Bearer ${gov1.token}`);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.data.totals.requests).toBe(1);
    expect(ownRes.body.data.totals.pricesVerified).toBe(false);
    expect(ownRes.body.data.totals.estimatedCostMinor).toBeNull();
    expect(ownRes.body.data.topUsers[0].userPseudonymId).toMatch(/^usr_[a-f0-9]{8}$/);

    // Add verified catalog price -> pricesVerified: true, estimatedCostMinor computed
    await AiSettings.create({
      scope: "PLATFORM",
      modelCatalog: {
        LOW: {
          modelId: "test-stub/chat-low",
          source: "admin-entered",
          verifiedAt: new Date("2026-11-10T00:00:00Z"),
          pricePerMInputMinor: 100,
          pricePerMOutputMinor: 200,
        },
      },
    });
    const verifiedRes = await request(app)
      .get("/api/v1/ai/usage/agency")
      .set("Authorization", `Bearer ${gov1.token}`);
    expect(verifiedRes.status).toBe(200);
    expect(verifiedRes.body.data.totals.pricesVerified).toBe(true);
    expect(verifiedRes.body.data.totals.estimatedCostMinor).toBe(5);
  });

  it("enforces settings hierarchy, OCC 409 conflicts, admin boundaries, audit writes, and reset", async () => {
    const superAdmin = await seedActor("SUPER_ADMIN");
    const gov = await seedActor("GOV_ADMIN");
    const otherGov = await seedActor("GOV_ADMIN");

    // Agency admin cannot update PLATFORM settings or modelCatalog
    const forbidPlatform = await request(app)
      .put("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${gov.token}`)
      .send({ scope: "PLATFORM", version: 1, featureToggles: { vision: true } });
    expect(forbidPlatform.status).toBe(403);

    const forbidCatalog = await request(app)
      .put(`/api/v1/ai/settings/agency/${gov.agency._id.toString()}`)
      .set("Authorization", `Bearer ${gov.token}`)
      .send({
        version: 1,
        modelCatalog: { LOW: { modelId: "rogue-model" } },
      });
    expect(forbidCatalog.status).toBe(403);

    // Agency admin cannot edit another agency's settings
    const forbidOtherAgency = await request(app)
      .put(`/api/v1/ai/settings/agency/${otherGov.agency._id.toString()}`)
      .set("Authorization", `Bearer ${gov.token}`)
      .send({ version: 1, featureToggles: { copilot: false } });
    expect(forbidOtherAgency.status).toBe(403);

    // Super Admin creates platform settings
    const pSave = await request(app)
      .put("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({
        scope: "PLATFORM",
        version: 1,
        featureToggles: { vision: true, copilot: true },
        limits: { userRequestsPer10Min: { copilot: 10 } },
        modelCatalog: { LOW: { modelId: "test-stub/chat-low", source: "admin-entered" } },
      });
    expect(pSave.status).toBe(200);
    expect(pSave.body.data.version).toBe(1);

    // Agency tries to raise copilot limit to 30 & disable vision
    const aSave = await request(app)
      .put(`/api/v1/ai/settings/agency/${gov.agency._id.toString()}`)
      .set("Authorization", `Bearer ${gov.token}`)
      .send({
        version: 1,
        featureToggles: { vision: false },
        limits: { userRequestsPer10Min: { copilot: 30 } },
      });
    expect(aSave.status).toBe(200);

    // Effective resolution: vision stays false (most restrictive), copilot capped at platform's 10
    const getRes = await request(app)
      .get("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.effective.featureToggles.vision).toBe(false);
    expect(getRes.body.data.effective.userRequestsPer10Min.copilot).toBe(10);

    // OCC 409 conflict on stale version (v1 instead of latest platform v1 -> bump platform to v2 first)
    const pSave2 = await request(app)
      .put("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ scope: "PLATFORM", version: 1, featureToggles: { qa: false } });
    expect(pSave2.status).toBe(200);
    expect(pSave2.body.data.version).toBe(2);

    const conflict = await request(app)
      .put("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ scope: "PLATFORM", version: 1, featureToggles: { qa: true } });
    expect(conflict.status).toBe(409);

    // Verify AuditLog rows persisted cleanly
    const audits = await AuditLog.find({ action: "ai.settings_updated" }).lean();
    expect(audits.length).toBeGreaterThanOrEqual(2);

    // Reset agency settings
    const resetRes = await request(app)
      .post("/api/v1/ai/settings/reset")
      .set("Authorization", `Bearer ${gov.token}`)
      .send({ scope: "AGENCY" });
    expect(resetRes.status).toBe(200);
    const resetAudit = await AuditLog.findOne({ action: "ai.settings_reset" }).lean();
    expect(resetAudit).not.toBeNull();
  });

  it("returns pseudonymized audit log and CSV-injection-safe export", async () => {
    const gov = await seedActor("GOV_ADMIN");
    const inspector = await seedActor("INSPECTOR", gov.agency._id);

    await recordGate({
      actor: { userId: inspector.user._id.toString(), agencyId: gov.agency._id.toString() },
      agencyId: gov.agency._id.toString(),
      feature: "copilot",
      tier: "LOW",
      model: "=CMD|' /C calc'!A0", // hostile formula string in model field test
      actual: { inputTokens: 80, outputTokens: 20, status: "OK", latencyMs: 310, providerPolicy: "zero-retention" },
    });

    const auditRes = await request(app)
      .get("/api/v1/ai/audit")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.items).toHaveLength(1);
    expect(auditRes.body.data.items[0].userPseudonymId).toMatch(/^usr_[a-f0-9]{8}$/);
    expect(auditRes.body.data.items[0].providerPolicy).toBe("zero-retention");

    // Inspector lacks ai.manage -> 403
    const forbidInspector = await request(app)
      .get("/api/v1/ai/audit")
      .set("Authorization", `Bearer ${inspector.token}`);
    expect(forbidInspector.status).toBe(403);

    // CSV export requires ai.manage + report.export and escapes formula injection
    const csvRes = await request(app)
      .get("/api/v1/ai/audit/export.csv")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("'=CMD|' /C calc'!A0");

    const exportAudit = await AuditLog.findOne({ action: "ai.usage_exported" }).lean();
    expect(exportAudit).not.toBeNull();
  });

  it("probes models safely without mutating AiSettings and exposes public-to-auth transparency /about", async () => {
    const gov = await seedActor("GOV_ADMIN");

    const checkRes = await request(app)
      .post("/api/v1/ai/models/check")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data).toHaveProperty("configuredModels");
    expect(await AiSettings.countDocuments({})).toBe(0);

    // Public unauthenticated /about returns default vision=false and transparency clauses
    const publicAbout = await request(app).get("/api/v1/ai/about");
    expect(publicAbout.status).toBe(200);
    expect(publicAbout.body.data.features.vision.enabled).toBe(false);
    expect(publicAbout.body.data.neverDoes.length).toBeGreaterThanOrEqual(4);
    expect(publicAbout.body.data.neverSent.length).toBeGreaterThanOrEqual(4);
    expect(publicAbout.body.data.retention.copilotHistoryDays).toBe(30);

    // Agency disables copilot -> authenticated /about reflects own agency policy
    await AiSettings.create({
      scope: "AGENCY",
      agencyId: gov.agency._id,
      featureToggles: { copilotEnabled: false },
    });
    const authAbout = await request(app)
      .get("/api/v1/ai/about")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(authAbout.status).toBe(200);
    expect(authAbout.body.data.features.copilot.enabled).toBe(false);
  });
});
