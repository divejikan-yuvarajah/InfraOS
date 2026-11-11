import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { AiInteraction } from "../src/modules/ai/rag/interaction.model.js";
import { AiSettings } from "../src/modules/ai/governance/settings.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { COPILOT_TOOLS } from "../src/modules/ai/copilot/tool-registry.js";
import { validateArgsProvenance } from "../src/modules/ai/copilot/id-provenance.js";
import { verifyCopilotAnswer } from "../src/modules/ai/copilot/copilot-grounding.js";
import { getQuickFacts } from "../src/modules/ai/copilot/quick-facts.service.js";
import { getSuggestions } from "../src/modules/ai/copilot/copilot-suggestions.service.js";
import { reconcileStaleCopilotTurns } from "../src/modules/ai/copilot/copilot-turn.service.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("Infrastructure Copilot Backend (Step 125)", () => {
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
      AiInteraction.deleteMany({}),
      Milestone.deleteMany({}),
      Project.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Agency.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);
  });

  describe("Static Registry & Tool Safety Guarantees", () => {
    it("asserts that all tools in COPILOT_TOOLS have readOnly: true", () => {
      for (const [name, tool] of Object.entries(COPILOT_TOOLS)) {
        expect(tool.readOnly, `Tool ${name} must be readOnly`).toBe(true);
      }
    });

    it("asserts that no tool name contains mutating or write verbs", () => {
      const writeVerbs = ["create", "update", "delete", "mutate", "insert", "post", "put", "patch", "remove", "approve", "cancel"];
      for (const name of Object.keys(COPILOT_TOOLS)) {
        for (const verb of writeVerbs) {
          expect(name.toLowerCase().startsWith(verb), `Tool name ${name} must not start with write verb ${verb}`).toBe(false);
        }
      }
    });
  });

  describe("ID Provenance Verification", () => {
    it("denies unprovenanced IDs and allows provenanced IDs", () => {
      const pool = new Set(["6af353e5e2c85e88a23588bc", "inf-road-123"]);

      // Unprovenanced ObjectId
      const check1 = validateArgsProvenance({ projectId: "6af353e5e2c85e88a2358899" }, pool);
      expect(check1.valid).toBe(false);
      expect(check1.unprovenancedId).toBe("6af353e5e2c85e88a2358899");

      // Provenanced ObjectId
      const check2 = validateArgsProvenance({ projectId: "6af353e5e2c85e88a23588bc" }, pool);
      expect(check2.valid).toBe(true);

      // Provenanced Project Code
      const check3 = validateArgsProvenance({ projectId: "INF-ROAD-123" }, pool);
      expect(check3.valid).toBe(true);

      // Unprovenanced Project Code
      const check4 = validateArgsProvenance({ projectId: "INF-BRIDGE-999" }, pool);
      expect(check4.valid).toBe(false);
    });
  });

  describe("Copilot Grounding & Output Safety Verification", () => {
    const executedFacts = [
      {
        n: 1,
        fact: { id: "T1.f1", label: "project_code", value: "INF-ROAD-100", basis: "RECORDED" as const },
        tool: "get_project_summary",
        link: "/projects/p1",
      },
      {
        n: 2,
        fact: { id: "T1.f2", label: "reported_progress", value: 45, unit: "%", basis: "REPORTED" as const },
        tool: "get_project_summary",
        link: "/projects/p1",
      },
      {
        n: 3,
        fact: { id: "T1.f3", label: "delayed_milestones", value: 2, basis: "RECORDED" as const },
        tool: "get_project_summary",
        link: "/projects/p1",
      },
    ];

    it("accepts supported claims with matching numbers and adds [n] citations", () => {
      const result = verifyCopilotAnswer({
        rawClaims: [
          { text: "Project INF-ROAD-100 has 45% reported progress.", sourceRefs: [1, 2] },
          { text: "There are currently 2 delayed milestones.", sourceRefs: [3] },
        ],
        executedFacts,
      });

      expect(result.status).toBe("ANSWERED");
      expect(result.claims).toHaveLength(2);
      expect(result.sources).toHaveLength(3);
      expect(result.text).toContain("[1] [2]");
      expect(result.text).toContain("[3]");
      // Guarantees all source links are internal
      for (const s of result.sources) {
        expect(s.link.startsWith("/")).toBe(true);
        expect(s.link).not.toContain("http://");
        expect(s.link).not.toContain("https://");
      }
    });

    it("drops claims with unverified figures and accusatory wording", () => {
      const result = verifyCopilotAnswer({
        rawClaims: [
          { text: "Project has 99% progress.", sourceRefs: [1, 2] }, // 99% is not in facts (facts say 45%)
          { text: "The contractor is fraudulent and cheated.", sourceRefs: [1] }, // Denylist word
        ],
        executedFacts,
      });

      expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
      expect(result.claims).toHaveLength(0);
      expect(result.evidence.droppedClaims).toBe(2);
    });
  });

  describe("End-to-End Turn Flow & Quick Facts", () => {
    async function setupWorld() {
      const agency = await Agency.create({
        code: `RDA_${Math.floor(Math.random() * 90000)}`,
        name: "Road Development Authority",
        type: "MINISTRY",
        status: "ACTIVE",
      });

      const role = await Role.create({
        key: "PROJECT_MANAGER",
        name: "Project Manager",
        description: "Project Manager role",
        scopeType: "AGENCY",
        permissions: ["copilot.use", "project.read", "risk.read", "inspection.read"],
        isSystem: true,
        isActive: true,
      });

      const user = await User.create({
        agencyId: agency._id,
        roleId: role._id,
        firstName: "Kamal",
        lastName: "Silva",
        email: `kamal_${Date.now()}_${Math.random()}@agency.gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });

      const project = await Project.create({
        projectCode: `INF-ROAD-${Math.floor(Math.random() * 900) + 100}`,
        title: "Colombo Express Highway",
        projectType: "ROAD",
        agencyId: agency._id,
        budget: { amountMinor: 50_000_000_00, currency: "LKR" },
        createdBy: user._id,
        status: "ACTIVE",
        physicalProgress: 55,
      });

      const milestone = await Milestone.create({
        projectId: project._id,
        title: "Paving Section A",
        plannedStart: new Date(Date.now() - 86400000 * 20),
        plannedEnd: new Date(Date.now() - 86400000 * 5), // overdue
        progress: 30,
      });

      const { token } = await signAccessToken(user._id.toString(), 1);

      return { agency, role, user, project, milestone, token };
    }

    it("returns deterministic quick facts without LLM invocation", async () => {
      const world = await setupWorld();
      const actor = {
        userId: world.user._id.toString(),
        agencyId: world.agency._id.toString(),
        roleKey: "PROJECT_MANAGER",
        permissions: ["project.read"],
      };

      const facts = await getQuickFacts(actor, world.project._id.toString());
      expect(facts.status).toBe("ACTIVE");
      expect(facts.progressReported).toBe(55);
      expect(facts.overdueMilestonesCount).toBe(1);
      expect(facts.links).toBeDefined();
    });

    it("generates contextual suggestions filtered by real database entities", async () => {
      const world = await setupWorld();
      const actor = {
        userId: world.user._id.toString(),
        agencyId: world.agency._id.toString(),
        roleKey: "PROJECT_MANAGER",
        permissions: ["project.read"],
      };

      const { suggestions } = await getSuggestions(actor, "PROJECT", world.project._id.toString());
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.prompt.includes("delayed"))).toBe(true);
    });

    it("fails closed when model unset (503), then creates copilot turn (202), enforces author-only read, and handles cancel", async () => {
      const world = await setupWorld();

      // 0. Fail closed when model is not configured (Decision C requirement)
      const unconfiguredRes = await request(app)
        .post("/api/v1/ai/copilot/turns")
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          message: "What is the progress on this project?",
        });

      expect(unconfiguredRes.status).toBe(503);
      expect(unconfiguredRes.body.error.code).toBe("AI_UNAVAILABLE");

      // Configure test-only stub model in Platform Settings
      await AiSettings.create({
        scope: "PLATFORM",
        modelCatalog: {
          LOW: { modelId: "test-stub/chat-low", verifiedAt: new Date(), source: "admin-entered" },
        },
      });

      // 1. Create turn
      const postRes = await request(app)
        .post("/api/v1/ai/copilot/turns")
        .set("Authorization", `Bearer ${world.token}`)
        .send({
          message: "What is the progress on this project?",
          pageContext: {
            type: "PROJECT",
            recordId: world.project._id.toString(),
            route: `/projects/${world.project._id}`,
          },
        });

      expect(postRes.status).toBe(202);
      expect(postRes.body.data.turnId).toBeDefined();
      expect(postRes.body.data.status).toBe("RUNNING");

      const turnId = postRes.body.data.turnId;

      // 2. Author can read turn
      const getRes = await request(app)
        .get(`/api/v1/ai/copilot/turns/${turnId}`)
        .set("Authorization", `Bearer ${world.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(turnId);

      // 3. Another user cannot read this turn (404 private history guarantee)
      const otherUser = await User.create({
        agencyId: world.agency._id,
        roleId: world.role._id,
        firstName: "Nimal",
        lastName: "Perera",
        email: `nimal_${Date.now()}_${Math.random()}@agency.gov.lk`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
        status: "ACTIVE",
        emailVerified: true,
        credentialEpoch: 1,
      });
      const { token: otherToken } = await signAccessToken(otherUser._id.toString(), 1);

      const leakRes = await request(app)
        .get(`/api/v1/ai/copilot/turns/${turnId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(leakRes.status).toBe(404);

      // 4. Cancel turn
      const cancelRes = await request(app)
        .post(`/api/v1/ai/copilot/turns/${turnId}/cancel`)
        .set("Authorization", `Bearer ${world.token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.cancelled).toBe(true);
    });

    it("reconciles stale turns older than 120s to FAILED (TURN_TIMEOUT)", async () => {
      const world = await setupWorld();

      // Create a simulated old turn
      const oldTurn = await AiInteraction.create({
        kind: "COPILOT",
        userId: world.user._id,
        agencyId: world.agency._id,
        threadId: "12345678-1234-1234-1234-123456789012",
        message: "Stale turn test",
        language: "en",
        status: "RUNNING",
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Force createdAt in the past
      await AiInteraction.collection.updateOne(
        { _id: oldTurn._id },
        { $set: { createdAt: new Date(Date.now() - 150_000) } },
      );

      const modifiedCount = await reconcileStaleCopilotTurns();
      expect(modifiedCount).toBeGreaterThanOrEqual(1);

      const fresh = await AiInteraction.findById(oldTurn._id);
      expect(fresh?.status).toBe("FAILED");
      expect(fresh?.errorCode).toBe("TURN_TIMEOUT");
    });
  });
});
