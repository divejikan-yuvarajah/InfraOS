import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectPatchSchema } from "../src/modules/projects/projects.schema.js";
import {
  RiskAssessment,
  nextAssessmentNo,
} from "../src/modules/risk/models/risk-assessment.model.js";
import { RiskResolution } from "../src/modules/risk/models/risk-resolution.model.js";
import { RiskRun } from "../src/modules/risk/models/risk-run.model.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const id = () => new mongoose.Types.ObjectId();

describe("Risk models & integrity (Batch 11 Step 119)", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });
  it("rejects client attempts to patch server-owned risk cache fields on Project", () => {
    // projectPatchSchema must reject riskScore, riskLevel, riskAssessedAt, latestRiskAssessmentId
    expect(() =>
      projectPatchSchema.parse({
        revision: 1,
        riskScore: 50,
      }),
    ).toThrow();

    expect(() =>
      projectPatchSchema.parse({
        revision: 1,
        riskLevel: "HIGH",
      }),
    ).toThrow();

    expect(() =>
      projectPatchSchema.parse({
        revision: 1,
        riskAssessedAt: new Date().toISOString(),
      }),
    ).toThrow();

    expect(() =>
      projectPatchSchema.parse({
        revision: 1,
        latestRiskAssessmentId: id().toString(),
      }),
    ).toThrow();
  });

  it("validates RiskAssessment structure, allowing optional relaxed numerics and structured indicators", async () => {
    const pId = id();
    const aId = id();
    const doc = new RiskAssessment({
      assessmentNo: "RSK-2026-000001",
      projectId: pId,
      agencyId: aId,
      projectStatus: "ACTIVE",
      trigger: "ON_DEMAND",
      engineVersion: "r1",
      inputsHash: "a".repeat(64),
      applicable: true,
      overallLevel: "MODERATE",
      overallIndex: 25,
      categories: [
        {
          category: "DELAY",
          level: "MODERATE",
          index: 25,
          sufficiency: "SUFFICIENT",
          missing: [],
        },
      ],
      indicators: [
        {
          code: "DL1",
          category: "DELAY",
          severity: "MODERATE",
          points: 12,
          fingerprint: "DL1:-",
          titleKey: "risk.indicator.DL1.title",
          explainKey: "risk.indicator.DL1.explain",
          evidence: [],
          basis: "RECORDED",
        },
      ],
      sourceFreshness: [
        {
          source: "projectTrace",
          available: true,
          asOf: new Date(),
          stale: false,
        },
      ],
      missingData: [],
      recommendations: [
        {
          code: "REVIEW_DELAYED_MILESTONES",
          priority: "MODERATE",
          indicatorFingerprints: ["DL1:-"],
        },
      ],
      changes: [
        {
          type: "NEW",
          code: "DL1",
          fingerprint: "DL1:-",
          to: "MODERATE",
        },
      ],
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("validates RiskResolution and requires note", async () => {
    const res = new RiskResolution({
      projectId: id(),
      agencyId: id(),
      fingerprint: "DL1:-",
      indicatorCode: "DL1",
      status: "ACKNOWLEDGED",
      note: "Acknowledged by project manager during monthly review",
      severityAtDecision: "MODERATE",
      assessmentId: id(),
      decidedBy: id(),
      decidedAt: new Date(),
      version: 1,
    });

    await expect(res.validate()).resolves.toBeUndefined();

    // Invalid status rejected
    const invalid = new RiskResolution({
      projectId: id(),
      agencyId: id(),
      fingerprint: "DL1:-",
      indicatorCode: "DL1",
      status: "MAGIC_STATUS" as any,
      note: "Test note",
      severityAtDecision: "MODERATE",
      assessmentId: id(),
      decidedBy: id(),
      decidedAt: new Date(),
    });
    await expect(invalid.validate()).rejects.toThrow();
  });

  it("validates RiskRun structure and counters", async () => {
    const run = new RiskRun({
      runId: "run_test_123",
      trigger: "SCHEDULED",
      scope: "platform",
      status: "RUNNING",
      startedAt: new Date(),
      counters: {
        considered: 10,
        assessed: 8,
        unchanged: 2,
        notApplicable: 0,
        failed: 0,
      },
    });

    await expect(run.validate()).resolves.toBeUndefined();
  });

  it("generates sequential RSK-YYYY-NNNNNN numbers atomically", async () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const no1 = await nextAssessmentNo(now);
    expect(no1).toMatch(/^RSK-2026-\d{6}$/);
    const no2 = await nextAssessmentNo(now);
    expect(no2).toMatch(/^RSK-2026-\d{6}$/);
    expect(no1).not.toBe(no2);
  });
});
