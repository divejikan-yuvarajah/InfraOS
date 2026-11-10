import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { InspectionEvidence } from "../src/modules/inspections/models/inspection-evidence.model.js";
import { InspectionAiAnalysis } from "../src/modules/inspections/ai/models/inspection-ai-analysis.model.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { runDeterministicQualityChecks } from "../src/modules/inspections/ai/quality-checks.js";
import { verifyVisionOutput } from "../src/modules/inspections/ai/vision-verify.js";
import { checkInspectionRole } from "../src/modules/inspections/ai/inspection-ai.service.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("AI Physical Progress Evidence Analysis (Step 124)", () => {
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
      InspectionAiAnalysis.deleteMany({}),
      InspectionEvidence.deleteMany({}),
      Inspection.deleteMany({}),
      Milestone.deleteMany({}),
      Project.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Agency.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);
  });

  describe("Deterministic evidence-quality checks (no AI)", () => {
    it("flags photos captured outside the expected window (-14d to +1d)", () => {
      const inspDate = new Date("2026-06-15T10:00:00Z");
      const ev = [
        {
          _id: "e1",
          capturedAt: new Date("2026-05-01T10:00:00Z"), // 45 days earlier
          uploadedAt: new Date("2026-06-15T12:00:00Z"),
          sha256: "a".repeat(64),
        },
      ];

      const res = runDeterministicQualityChecks({ inspectionDate: inspDate, evidence: ev });
      expect(res.checks.some((c) => c.code === "CAPTURED_OUTSIDE_WINDOW")).toBe(true);
      expect(res.metadataNote).toContain("Metadata can be inaccurate");
    });

    it("flags duplicate hashes, low resolution, and away-from-site presence", () => {
      const inspDate = new Date("2026-06-15T10:00:00Z");
      const sha = "b".repeat(64);
      const ev = [
        {
          _id: "e1",
          capturedAt: new Date("2026-06-14T10:00:00Z"),
          uploadedAt: new Date("2026-06-15T10:00:00Z"),
          sha256: sha,
          width: 640,
          height: 480, // < 800px
          sitePresence: { distanceM: 450, status: "AWAY", basis: "project_geometry" },
        },
        {
          _id: "e2",
          capturedAt: new Date("2026-06-14T10:01:00Z"),
          uploadedAt: new Date("2026-06-15T10:00:00Z"),
          sha256: sha, // duplicate
        },
      ];

      const res = runDeterministicQualityChecks({ inspectionDate: inspDate, evidence: ev });
      expect(res.checks.some((c) => c.code === "DUPLICATE_PHOTO" && c.severity === "CRITICAL")).toBe(true);
      expect(res.checks.some((c) => c.code === "LOW_RESOLUTION")).toBe(true);
      expect(res.checks.some((c) => c.code === "AWAY_FROM_SITE")).toBe(true);
    });

    it("notes optional location when not attached", () => {
      const inspDate = new Date("2026-06-15T10:00:00Z");
      const ev = [
        {
          _id: "e1",
          capturedAt: new Date("2026-06-14T10:00:00Z"),
          uploadedAt: new Date("2026-06-15T10:00:00Z"),
          sha256: "c".repeat(64),
          sitePresence: null,
        },
      ];

      const res = runDeterministicQualityChecks({ inspectionDate: inspDate, evidence: ev });
      expect(res.checks.some((c) => c.code === "LOCATION_NOT_ATTACHED")).toBe(true);
    });
  });

  describe("Express output verification and safety screening", () => {
    it("drops statements with unverified percentages not in the context", () => {
      const raw = {
        images: [{ n: 1, activityDescription: "The earthworks appear 85% complete.", visibleWorkIndicators: [] }],
        overall: { consistencyWithReportedStage: "CONSISTENT", rationale: "Progress verified from photo 1." },
      };

      // Context only knows about 50% claimed progress
      const verified = verifyVisionOutput({
        raw: raw as any,
        imageCount: 1,
        allowedPercentages: [50],
      });

      expect(verified.droppedStatements).toBeGreaterThan(0);
      expect(verified.images[0]?.activityDescription).not.toContain("85%");
    });

    it("drops accusatory/blame words and identifying details", () => {
      const raw = {
        images: [
          {
            n: 1,
            activityDescription: "This is fake and fraudulent work by contractor.",
            visibleWorkIndicators: [{ label: "worker named Perera with license plate WP-1234", certainty: "CLEAR" }],
          },
        ],
        overall: { consistencyWithReportedStage: "CONSISTENT", rationale: "Checked photo 1." },
      };

      const verified = verifyVisionOutput({
        raw: raw as any,
        imageCount: 1,
        allowedPercentages: [],
      });

      expect(verified.droppedStatements).toBeGreaterThan(0);
      expect(verified.images[0]?.activityDescription).not.toContain("fraudulent");
      expect(verified.images[0]?.visibleWorkIndicators).toHaveLength(0);
    });

    it("downgrades CONSISTENT to INDETERMINATE under quality issues or single image", () => {
      const raw = {
        images: [
          {
            n: 1,
            activityDescription: "Trench excavation",
            visibleWorkIndicators: [],
            qualityIssues: ["BLURRY"],
          },
        ],
        overall: { consistencyWithReportedStage: "CONSISTENT", rationale: "Excavation visible in photo 1." },
      };

      // Only 1 image -> must downgrade
      const verified = verifyVisionOutput({
        raw: raw as any,
        imageCount: 1,
        allowedPercentages: [],
      });

      expect(verified.overall.consistencyWithReportedStage).toBe("INDETERMINATE");
    });
  });

  describe("Role check and eligibility", () => {
    it("allows assigned inspector during IN_PROGRESS and reviewer during SUBMITTED", () => {
      const inspectorId = new mongoose.Types.ObjectId();
      const reviewerId = new mongoose.Types.ObjectId();

      const inProgressInsp = {
        inspectorId,
        status: "IN_PROGRESS",
        submissions: [],
      } as any;

      const inspectorCheck = checkInspectionRole(
        inProgressInsp,
        { userId: inspectorId.toHexString() } as any,
        ["inspection.submit"],
      );
      expect(inspectorCheck.eligible).toBe(true);
      expect(inspectorCheck.isInspector).toBe(true);

      const submittedInsp = {
        inspectorId,
        status: "SUBMITTED",
        submissions: [{ submittedBy: inspectorId }],
      } as any;

      const reviewerCheck = checkInspectionRole(
        submittedInsp,
        { userId: reviewerId.toHexString() } as any,
        ["inspection.verify"],
      );
      expect(reviewerCheck.eligible).toBe(true);
      expect(reviewerCheck.isReviewer).toBe(true);

      // Submitter cannot review their own submission
      const submitterAsReviewer = checkInspectionRole(
        submittedInsp,
        { userId: inspectorId.toHexString() } as any,
        ["inspection.verify"],
      );
      expect(submitterAsReviewer.eligible).toBe(false);
    });
  });

  describe("End-to-end vision endpoint lifecycle", () => {
    async function setupWorld() {
      const agency = await Agency.create({
        code: `AGY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "Infrastructure Ministry",
        type: "MINISTRY",
        status: "ACTIVE",
      });

      const role = await Role.create({
        key: "INSPECTOR",
        name: "Field Inspector",
        description: "Field inspector role",
        scopeType: "ASSIGNED_INSPECTION",
        permissions: ["inspection.read", "inspection.submit"],
        isSystem: true,
        isActive: true,
      });

      const user = await User.create({
        firstName: "Sunil",
        lastName: "Perera",
        email: `sunil_${Date.now()}_${Math.random()}@agency.gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        roleId: role._id,
        agencyId: agency._id,
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });

      const project = await Project.create({
        projectCode: `INF-ROAD-${Math.floor(Math.random() * 900) + 100}`,
        title: "Kandy Road Upgrade",
        projectType: "ROAD",
        agencyId: agency._id,
        budget: { amountMinor: 10_000_000_00, currency: "LKR" },
        createdBy: user._id,
        status: "ACTIVE",
      });

      const milestone = await Milestone.create({
        projectId: project._id,
        title: "Subbase Compaction",
        plannedStart: new Date(),
        plannedEnd: new Date(Date.now() + 86400000),
        progress: 40,
      });

      const inspection = await Inspection.create({
        inspectionNo: `INS-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        projectId: project._id,
        agencyId: agency._id,
        inspectorId: user._id,
        inspectionDate: new Date(),
        status: "IN_PROGRESS",
        claimedProgressAtSchedule: 40,
        milestoneIds: [milestone._id],
        report: {
          revision: 1,
          measuredProgress: 40,
        },
      });

      const evidence = await InspectionEvidence.create({
        inspectionId: inspection._id,
        projectId: project._id,
        agencyId: agency._id,
        documentId: new mongoose.Types.ObjectId(),
        capturedAt: new Date(),
        uploadedAt: new Date(),
        uploadedBy: user._id,
        sha256: "e".repeat(64),
        mimeType: "image/jpeg",
        sizeBytes: 150_000,
        status: "ACTIVE",
      });

      const { token } = await signAccessToken(user._id.toString(), 1);

      return { agency, role, user, project, milestone, inspection, evidence, token };
    }

    it("requires explicit provider acknowledgement to run vision analysis", async () => {
      const world = await setupWorld();

      // Enable vision in settings
      await AiSettings.create({
        scope: "PLATFORM",
        featureToggles: { visionEnabled: true },
        modelCatalog: {
          VISION: { modelId: "test-vision-model", source: "admin-entered" },
        },
      });

      // Missing acknowledgedProvider
      const res = await request(app)
        .post(`/api/v1/inspections/${world.inspection._id}/ai/analyses`)
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          evidenceIds: [world.evidence._id.toString()],
          acknowledgedProvider: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("PROVIDER_ACKNOWLEDGEMENT_REQUIRED");
    });

    it("refuses analysis when vision is disabled by default", async () => {
      const world = await setupWorld();

      // Vision is false by default in empty settings
      const res = await request(app)
        .post(`/api/v1/inspections/${world.inspection._id}/ai/analyses`)
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          evidenceIds: [world.evidence._id.toString()],
          acknowledgedProvider: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FEATURE_DISABLED");
    });

    it("allows assigned inspector to review and insert confirmed observations", async () => {
      const world = await setupWorld();

      // Seed an existing READY analysis
      const analysis = await InspectionAiAnalysis.create({
        analysisNo: "AIV-2026-000001",
        inspectionId: world.inspection._id,
        projectId: world.project._id,
        agencyId: world.agency._id,
        requestedBy: world.user._id,
        requestedByRole: "INSPECTOR",
        evidence: [
          {
            evidenceId: world.evidence._id,
            sha256: world.evidence.sha256,
            capturedAt: world.evidence.capturedAt,
          },
        ],
        contextHash: "f".repeat(64),
        status: "READY",
        qualityChecks: {
          checks: [],
          coverage: { totalPhotos: 1, milestonesWithEvidence: 1, totalMilestones: 1, uncoveredMilestones: [] },
          metadataNote: "Metadata can be inaccurate",
        },
        result: {
          images: [
            {
              n: 1,
              activityDescription: "Crushed stone layer compacted across road section.",
              visibleWorkIndicators: [{ label: "subbase aggregate", certainty: "CLEAR" }],
              qualityIssues: [],
            },
          ],
          overall: {
            consistencyWithReportedStage: "CONSISTENT",
            rationale: "Aggregates visible in image 1 correspond to subbase milestone.",
          },
          potentialDiscrepancies: [],
          cannotBeDetermined: [],
          questionsForInspector: [],
          droppedStatements: 0,
        },
        promptVersion: "vision.v1",
        usage: { inputTokens: 500, outputTokens: 200, images: 1 },
      });

      // 1. Submit review decisions
      const reviewRes = await request(app)
        .put(`/api/v1/inspections/${world.inspection._id}/ai/analyses/${analysis._id}/review`)
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          decisions: {
            "img:1": { decision: "CONFIRMED", comment: "Confirmed accurate" },
            overall: { decision: "DISPUTED", comment: "Section needs extra roller passes" },
          },
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.inspectorReview.status).toBe("REVIEWED");

      // 2. Insert only confirmed observations into report
      const insertRes = await request(app)
        .post(`/api/v1/inspections/${world.inspection._id}/ai/analyses/${analysis._id}/insert`)
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          keys: ["img:1", "overall"],
        });

      expect(insertRes.status).toBe(200);
      // 'overall' was DISPUTED so it must NOT be inserted
      expect(insertRes.body.data.insertedObservations).toHaveLength(1);
      expect(insertRes.body.data.insertedObservations[0].key).toBe("img:1");

      // Verify that Inspection has aiAssistRefs marker
      const updatedInsp = await Inspection.findById(world.inspection._id);
      expect(updatedInsp?.aiAssistRefs).toHaveLength(1);
      expect(updatedInsp?.aiAssistRefs[0]?.observationKey).toBe("img:1");

      // HARD RULE: measuredProgress must NOT have changed from original 40
      expect(updatedInsp?.report?.measuredProgress).toBe(40);
      expect(updatedInsp?.physicalProgress).toBeUndefined();
    });
  });
});
