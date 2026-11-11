import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FINANCE_CATEGORIES, type SystemRoleKey } from "@infraos/shared-types";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { aiClient } from "../src/modules/ai/ai-client.js";
import { COPILOT_TOOLS } from "../src/modules/ai/copilot/tool-registry.js";
import { releaseUserConcurrency } from "../src/modules/ai/governance/ai-gate.js";
import { AiRateBucket } from "../src/modules/ai/governance/rate-bucket.model.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { AiUsageDaily } from "../src/modules/ai/governance/usage-daily.model.js";
import { AiInteraction } from "../src/modules/ai/rag/interaction.model.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { ProjectExpense } from "../src/modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { InspectionAiAnalysis } from "../src/modules/inspections/ai/models/inspection-ai-analysis.model.js";
import { getEvidenceStorage, storageKeyFor } from "../src/modules/inspections/evidence-storage.js";
import { InspectionEvidence } from "../src/modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Batch 12 Safety Boundaries, Gate Regression, Role Matrix & Zero-Authoritative-Write (Section 8)", () => {
  const app = createApp();

  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-test-0123456789abcdef0123456789";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-test-0123456789abcdef0123456789";
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await Promise.all([
      Project.deleteMany({}),
      Milestone.deleteMany({}),
      ProjectPayment.deleteMany({}),
      ProjectExpense.deleteMany({}),
      Inspection.deleteMany({}),
      InspectionEvidence.deleteMany({}),
      InspectionAiAnalysis.deleteMany({}),
      AiInteraction.deleteMany({}),
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

  describe("Static import-boundary and read-only checks", () => {
    const srcRoot = resolve(__dirname, "../src");
    const aiDirs = [
      resolve(srcRoot, "modules/ai/copilot"),
      resolve(srcRoot, "modules/inspections/ai"),
      resolve(srcRoot, "modules/ai/governance"),
    ];

    it("never imports mutating domain services or mutates authoritative domain models", () => {
      const forbiddenServiceImports = [
        /projects\/.*service/i,
        /finance\/.*service/i,
        /contractors\/.*service/i,
        /inspections\/inspection\.service/i,
        /inspections\/verification/i,
        /assets\/.*service/i,
        /roadsync\/.*service/i,
      ];

      const authoritativeWritePattern =
        /\b(Project|Milestone|ProjectPayment|ProjectExpense|ProgressVerification|Contractor|ContractorAssignment|Asset)\.(updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|deleteOne|deleteMany|create|insertMany)\b/;

      for (const dir of aiDirs) {
        for (const file of collectTsFiles(dir)) {
          const content = readFileSync(file, "utf8");
          const rel = relative(srcRoot, file);

          for (const pat of forbiddenServiceImports) {
            expect(content, `${rel} must not import authoritative write service ${pat}`).not.toMatch(pat);
          }
          expect(content, `${rel} must not mutate authoritative models`).not.toMatch(authoritativeWritePattern);

          // Inspection model may only be saved when explicitly attaching aiAssistRefs
          if (/\bInspection\.save\b|\binspection\.save\(/.test(content)) {
            expect(rel.replace(/\\/g, "/")).toBe("modules/inspections/ai/inspection-ai.service.ts");
            expect(content).toContain('inspection.set("aiAssistRefs"');
          }
        }
      }

      for (const [name, tool] of Object.entries(COPILOT_TOOLS)) {
        expect(tool.readOnly, `Copilot tool ${name} must be readOnly`).toBe(true);
      }
    });

    it("enforces checkGate and recordGate across all Batches 09-12 LLM call sites", () => {
      const gateCallers: Array<{ path: string; requireCheck: boolean; requireRecord: boolean }> = [
        { path: "modules/ai/rag/rag.service.ts", requireCheck: true, requireRecord: true },
        { path: "modules/ai/rag/artifact.service.ts", requireCheck: true, requireRecord: false },
        { path: "modules/ai/rag/summary.runner.ts", requireCheck: false, requireRecord: true },
        { path: "modules/ai/rag/extraction.runner.ts", requireCheck: false, requireRecord: true },
        { path: "modules/risk/risk-narrative.service.ts", requireCheck: true, requireRecord: true },
        { path: "modules/inspections/ai/inspection-ai.service.ts", requireCheck: true, requireRecord: true },
        { path: "modules/ai/copilot/copilot-turn.service.ts", requireCheck: true, requireRecord: true },
      ];

      for (const entry of gateCallers) {
        const content = readFileSync(resolve(srcRoot, entry.path), "utf8");
        if (entry.requireCheck) {
          expect(content, `${entry.path} must call checkGate`).toMatch(/\bcheckGate\(/);
        }
        if (entry.requireRecord) {
          expect(content, `${entry.path} must call recordGate`).toMatch(/\brecordGate\(/);
        }
      }
    });
  });

  describe("Full Role × Permission Matrix", () => {
    it("matches canonical Batch 12 & AI grants across all 7 system roles", () => {
      const expected: Record<SystemRoleKey, { copilot: boolean; aiManage: boolean; ask: boolean; inspectSubmit: boolean; inspectVerify: boolean }> = {
        SUPER_ADMIN: { copilot: true, aiManage: true, ask: true, inspectSubmit: false, inspectVerify: false },
        GOV_ADMIN: { copilot: true, aiManage: true, ask: true, inspectSubmit: false, inspectVerify: true },
        AGENCY_OFFICER: { copilot: true, aiManage: false, ask: true, inspectSubmit: false, inspectVerify: true },
        PROJECT_MANAGER: { copilot: true, aiManage: false, ask: true, inspectSubmit: false, inspectVerify: false },
        INSPECTOR: { copilot: true, aiManage: false, ask: true, inspectSubmit: true, inspectVerify: true },
        CONTRACTOR: { copilot: false, aiManage: false, ask: false, inspectSubmit: false, inspectVerify: false },
        CITIZEN: { copilot: false, aiManage: false, ask: false, inspectSubmit: false, inspectVerify: false },
      };

      for (const [roleKey, rules] of Object.entries(expected) as Array<[SystemRoleKey, (typeof expected)[SystemRoleKey]]>) {
        const perms = new Set(SYSTEM_ROLE_PERMISSIONS[roleKey]);
        expect(perms.has("copilot.use"), `${roleKey} copilot.use`).toBe(rules.copilot);
        expect(perms.has("ai.manage"), `${roleKey} ai.manage`).toBe(rules.aiManage);
        expect(perms.has("document.ask"), `${roleKey} document.ask`).toBe(rules.ask);
        expect(perms.has("inspection.submit"), `${roleKey} inspection.submit`).toBe(rules.inspectSubmit);
        expect(perms.has("inspection.verify"), `${roleKey} inspection.verify`).toBe(rules.inspectVerify);
      }
    });

    it("enforces HTTP RBAC across all 7 system roles for Copilot and AI Governance routes", async () => {
      const agency = await Agency.create({
        code: `AGY_RBAC_${Math.floor(Math.random() * 90000)}`,
        name: "RBAC Test Agency",
        type: "MINISTRY",
        status: "ACTIVE",
      });

      const tokens: Record<string, string> = {};
      const roles: SystemRoleKey[] = [
        "SUPER_ADMIN",
        "GOV_ADMIN",
        "AGENCY_OFFICER",
        "PROJECT_MANAGER",
        "INSPECTOR",
        "CONTRACTOR",
        "CITIZEN",
      ];

      for (const roleKey of roles) {
        const role = await Role.create({
          key: roleKey,
          name: `${roleKey} Role`,
          description: roleKey,
          scopeType: roleKey === "SUPER_ADMIN" ? "PLATFORM" : roleKey === "CITIZEN" ? "PUBLIC" : "AGENCY",
          permissions: [...SYSTEM_ROLE_PERMISSIONS[roleKey]],
          isSystem: true,
          isActive: true,
        });
        const user = await User.create({
          agencyId: agency._id,
          roleId: role._id,
          firstName: roleKey,
          lastName: "User",
          email: `${roleKey.toLowerCase()}.${Date.now()}.${Math.random()}@gov.lk`,
          passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
          status: "ACTIVE",
          emailVerified: true,
          credentialEpoch: 1,
        });
        const { token } = await signAccessToken(user._id.toString(), 1);
        tokens[roleKey] = token;
      }

      for (const roleKey of roles) {
        const token = tokens[roleKey]!;
        const allowCopilot = !["CONTRACTOR", "CITIZEN"].includes(roleKey);
        const allowManage = ["SUPER_ADMIN", "GOV_ADMIN"].includes(roleKey);

        const liteRes = await request(app)
          .get("/api/v1/ai/status/lite")
          .set("Authorization", `Bearer ${token}`);
        expect(liteRes.status, `${roleKey} /ai/status/lite`).toBe(allowCopilot ? 200 : 403);

        const suggRes = await request(app)
          .get("/api/v1/ai/copilot/suggestions")
          .set("Authorization", `Bearer ${token}`);
        expect(suggRes.status, `${roleKey} /ai/copilot/suggestions`).toBe(allowCopilot ? 200 : 403);

        const settingsGetRes = await request(app)
          .get("/api/v1/ai/settings")
          .set("Authorization", `Bearer ${token}`);
        expect(settingsGetRes.status, `${roleKey} GET /ai/settings`).toBe(allowCopilot ? 200 : 403);

        const settingsPutRes = await request(app)
          .put("/api/v1/ai/settings")
          .set("Authorization", `Bearer ${token}`)
          .send({ scope: "PLATFORM", version: 1, featureToggles: { qa: true } });
        expect(settingsPutRes.status, `${roleKey} PUT /ai/settings`).toBe(roleKey === "SUPER_ADMIN" ? 200 : 403);

        const auditGetRes = await request(app)
          .get("/api/v1/ai/audit")
          .set("Authorization", `Bearer ${token}`);
        expect(auditGetRes.status, `${roleKey} GET /ai/audit`).toBe(allowManage ? 200 : 403);

        const agencySettingsPutRes = await request(app)
          .put(`/api/v1/ai/settings/agency/${agency._id.toString()}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ version: 1, featureToggles: { qa: true } });
        expect(
          agencySettingsPutRes.status,
          `${roleKey} PUT /ai/settings/agency`,
        ).toBe(allowManage ? 200 : 403);
        if (roleKey === "GOV_ADMIN") {
          // Reset agency doc version clean for any later checks
          await AiSettings.deleteOne({ scope: "AGENCY", agencyId: agency._id });
        }
        if (roleKey === "SUPER_ADMIN") {
          await AiSettings.deleteOne({ scope: "AGENCY", agencyId: agency._id });
        }

        const aboutRes = await request(app).get("/api/v1/ai/about");
        expect(aboutRes.status).toBe(200);
      }
    });
  });

  describe("End-to-End DB-Diff Zero-Authoritative-Write Invariant", () => {
    it("executes governance update, Vision lifecycle + insert, Quick Facts, and Copilot turn without mutating authoritative domain records", async () => {
      const agency = await Agency.create({
        code: `AGY_E2E_${Math.floor(Math.random() * 90000)}`,
        name: "Infrastructure Delivery Agency",
        type: "MINISTRY",
        status: "ACTIVE",
      });

      const adminRole = await Role.create({
        key: "SUPER_ADMIN",
        name: "Super Admin",
        description: "Super Admin",
        scopeType: "PLATFORM",
        permissions: [...SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN],
        isSystem: true,
        isActive: true,
      });

      const inspectorRole = await Role.create({
        key: "INSPECTOR",
        name: "Inspector",
        description: "Inspector",
        scopeType: "ASSIGNED_INSPECTION",
        permissions: [...SYSTEM_ROLE_PERMISSIONS.INSPECTOR],
        isSystem: true,
        isActive: true,
      });

      const adminUser = await User.create({
        agencyId: agency._id,
        roleId: adminRole._id,
        firstName: "Nimal",
        lastName: "Admin",
        email: `admin.${Date.now()}@gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });

      const inspectorUser = await User.create({
        agencyId: agency._id,
        roleId: inspectorRole._id,
        firstName: "Kasun",
        lastName: "Inspector",
        email: `inspector.${Date.now()}@gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });

      const adminToken = (await signAccessToken(adminUser._id.toString(), 1)).token;
      const inspectorToken = (await signAccessToken(inspectorUser._id.toString(), 1)).token;

      const project = await Project.create({
        projectCode: `INF-ROAD-${Math.floor(Math.random() * 900) + 100}`,
        title: "Southern Expressway Widening",
        projectType: "ROAD",
        agencyId: agency._id,
        budget: { amountMinor: 80_000_000_00, currency: "LKR" },
        createdBy: adminUser._id,
        status: "ACTIVE",
        physicalProgress: 45,
      });

      const milestone = await Milestone.create({
        projectId: project._id,
        title: "Sub-base Compaction Km 12",
        plannedStart: new Date("2026-10-01T00:00:00Z"),
        plannedEnd: new Date("2026-12-15T00:00:00Z"),
        progress: 45,
      });

      const payment = await ProjectPayment.create({
        paymentNo: "PAY-2026-000101",
        projectId: project._id,
        agencyId: agency._id,
        contractorId: new mongoose.Types.ObjectId(),
        amount: { amountMinor: 500_000_00, currency: "LKR" },
        paymentType: "INTERIM",
        status: "PENDING",
        date: new Date("2026-10-20T00:00:00Z"),
        createdBy: adminUser._id,
      });

      const expense = await ProjectExpense.create({
        expenseNo: "EXP-2026-000101",
        projectId: project._id,
        agencyId: agency._id,
        category: FINANCE_CATEGORIES[0]!,
        description: "Aggregate material sample testing",
        expenseDate: new Date("2026-10-18T00:00:00Z"),
        amount: { amountMinor: 120_000_00, currency: "LKR" },
        supportingRef: "VOUCH-2026-101",
        duplicateKey: `dup-${Date.now()}`,
        createdBy: adminUser._id,
      });

      const inspection = await Inspection.create({
        inspectionNo: "INS-2026-000101",
        projectId: project._id,
        agencyId: agency._id,
        inspectorId: inspectorUser._id,
        inspectionDate: new Date("2026-11-10T09:00:00Z"),
        inspectionType: "PROGRESS_VERIFICATION",
        status: "IN_PROGRESS",
        claimedProgressAtSchedule: 45,
        physicalProgress: 20,
      });

      const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const photoSha = createHash("sha256").update(photoBytes).digest("hex");

      const evidence = await InspectionEvidence.create({
        inspectionId: inspection._id,
        projectId: project._id,
        agencyId: agency._id,
        documentId: new mongoose.Types.ObjectId(),
        capturedAt: new Date("2026-11-10T08:30:00Z"),
        uploadedBy: inspectorUser._id,
        sha256: photoSha,
        mimeType: "image/jpeg",
        width: 1280,
        height: 960,
        sizeBytes: photoBytes.length,
        status: "ACTIVE",
      });
      await getEvidenceStorage().put(
        storageKeyFor(inspection._id.toString(), evidence._id.toString(), "full"),
        photoBytes,
        "image/jpeg",
      );

      // Capture exact before snapshots
      const beforeProject = await Project.findById(project._id).lean();
      const beforeMilestone = await Milestone.findById(milestone._id).lean();
      const beforePayment = await ProjectPayment.findById(payment._id).lean();
      const beforeExpense = await ProjectExpense.findById(expense._id).lean();
      const beforeInspection = await Inspection.findById(inspection._id).lean();

      // Stub external AI service methods cleanly
      const client = aiClient();
      vi.spyOn(client, "visionAnalyze").mockResolvedValue({
        output: {
          images: [
            {
              n: 1,
              activityDescription: "Sub-base aggregate layer visibly compacted along shoulder.",
              visibleWorkIndicators: [{ label: "Sub-base layer", certainty: "CLEAR" }],
              qualityIssues: [],
              notes: null,
            },
          ],
          overall: {
            consistencyWithReportedStage: "PARTIALLY_CONSISTENT",
            rationale: "Image 1 shows compacted aggregate consistent with ongoing sub-base works.",
          },
          potentialDiscrepancies: [],
          cannotBeDetermined: ["Core compaction density cannot be verified by photograph."],
          questionsForInspector: ["Confirm Proctor density lab test sheet reference."],
        },
        usage: { inputTokens: 150, outputTokens: 80 },
        model: "test-stub/vision",
        promptVersion: "vision.v1",
        structuredMode: "json_schema",
      });

      let stepCall = 0;
      vi.spyOn(client, "copilotStep").mockImplementation(async () => {
        stepCall++;
        if (stepCall === 1) {
          return {
            output: {
              type: "tool_calls",
              calls: [
                {
                  id: "c1",
                  tool: "get_project_summary",
                  args: { projectId: project._id.toString() },
                },
              ],
              answer: null,
              claims: [],
              missingInfo: [],
            },
            usage: { inputTokens: 90, outputTokens: 30 },
            model: "test-stub/chat-low",
            promptVersion: "copilot.v1",
            structuredMode: "json_schema",
          };
        }
        return {
          output: {
            type: "final",
            calls: [],
            answer: `Project ${project.projectCode} has 45% reported progress [1] [4].`,
            claims: [
              {
                text: `Project ${project.projectCode} has 45% reported progress.`,
                sourceRefs: [1, 4],
              },
            ],
            missingInfo: [],
          },
          usage: { inputTokens: 120, outputTokens: 45 },
          model: "test-stub/chat-low",
          promptVersion: "copilot.v1",
          structuredMode: "json_schema",
        };
      });

      // 1. Update Platform Settings via Governance endpoint (enables vision + stub models)
      const govRes = await request(app)
        .put("/api/v1/ai/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          scope: "PLATFORM",
          version: 1,
          featureToggles: { qa: true, vision: true, copilot: true },
          modelCatalog: {
            LOW: { modelId: "test-stub/chat-low", source: "admin-entered" },
            VISION: { modelId: "test-stub/vision", source: "admin-entered" },
          },
        });
      expect(govRes.status).toBe(200);

      // 2. Request Vision Analysis
      const visCreateRes = await request(app)
        .post(`/api/v1/inspections/${inspection._id}/ai/analyses`)
        .set("Authorization", `Bearer ${inspectorToken}`)
        .send({
          evidenceIds: [evidence._id.toString()],
          acknowledgedProvider: true,
        });
      expect([200, 202]).toContain(visCreateRes.status);
      expect(visCreateRes.body.data.status).toBe("READY");
      const analysisId = visCreateRes.body.data._id;
      releaseUserConcurrency(inspectorUser._id.toString(), "vision");

      // 3. Inspector reviews & confirms observation
      const reviewRes = await request(app)
        .put(`/api/v1/inspections/${inspection._id}/ai/analyses/${analysisId}/review`)
        .set("Authorization", `Bearer ${inspectorToken}`)
        .send({
          decisions: {
            "img:1": { decision: "CONFIRMED", comment: "Matches site chainage" },
          },
        });
      expect(reviewRes.status).toBe(200);

      // 4. Insert confirmed observation -> sets ONLY aiAssistRefs
      const insertRes = await request(app)
        .post(`/api/v1/inspections/${inspection._id}/ai/analyses/${analysisId}/insert`)
        .set("Authorization", `Bearer ${inspectorToken}`)
        .send({ keys: ["img:1"] });
      expect(insertRes.status).toBe(200);
      expect(insertRes.body.data.insertedObservations).toHaveLength(1);

      // 5. Copilot Quick Facts + Copilot Turn (including read-only tool call + grounded answer)
      const factsRes = await request(app)
        .get(`/api/v1/ai/copilot/quick-facts?projectId=${project._id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(factsRes.status).toBe(200);

      const turnCreateRes = await request(app)
        .post("/api/v1/ai/copilot/turns")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          message: `Summarize progress for ${project.projectCode}`,
          pageContext: {
            type: "PROJECT",
            recordId: project._id.toString(),
            route: `/projects/${project._id}`,
          },
        });
      expect(turnCreateRes.status).toBe(202);
      const turnId = turnCreateRes.body.data.turnId;

      // Poll briefly until background planner settles
      let settledTurn: { status: string; toolsUsed?: string[] } | undefined;
      for (let i = 0; i < 30; i++) {
        const pollRes = await request(app)
          .get(`/api/v1/ai/copilot/turns/${turnId}`)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(pollRes.status).toBe(200);
        if (pollRes.body.data.status !== "RUNNING") {
          settledTurn = pollRes.body.data;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(settledTurn?.status).toBe("ANSWERED");
      expect(settledTurn?.toolsUsed).toContain("get_project_summary");
      releaseUserConcurrency(adminUser._id.toString(), "copilot");

      // Capture exact after snapshots and verify ZERO authoritative mutations
      const afterProject = await Project.findById(project._id).lean();
      const afterMilestone = await Milestone.findById(milestone._id).lean();
      const afterPayment = await ProjectPayment.findById(payment._id).lean();
      const afterExpense = await ProjectExpense.findById(expense._id).lean();
      const afterInspection = await Inspection.findById(inspection._id).lean();

      expect(afterProject).toEqual(beforeProject);
      expect(afterMilestone).toEqual(beforeMilestone);
      expect(afterPayment).toEqual(beforePayment);
      expect(afterExpense).toEqual(beforeExpense);

      // Inspection differs ONLY on aiAssistRefs (+ updatedAt)
      expect(afterInspection?.aiAssistRefs).toHaveLength(1);
      expect(afterInspection?.status).toBe(beforeInspection?.status);
      expect(afterInspection?.physicalProgress).toBe(beforeInspection?.physicalProgress);
      expect(afterInspection?.report).toEqual(beforeInspection?.report);
      expect(afterInspection?.submissions).toEqual(beforeInspection?.submissions);
      expect(afterInspection?.submittedAt).toEqual(beforeInspection?.submittedAt);
      expect(afterInspection?.reviewedBy).toEqual(beforeInspection?.reviewedBy);
      expect(afterInspection?.reviewedAt).toEqual(beforeInspection?.reviewedAt);
      expect(afterInspection?.completedAt).toEqual(beforeInspection?.completedAt);
    });
  });
});

