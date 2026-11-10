import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import {
  assessProject,
  compareProjectAssessments,
  getProjectAssessmentById,
  getProjectLatestAssessment,
  getProjectRiskHistory,
} from "../src/modules/risk/risk-assessment.service.js";
import {
  exportRiskCsv,
  getMethodology,
  getRiskOverview,
  getRiskProjects,
  getRiskScatter,
} from "../src/modules/risk/risk-read.service.js";
import {
  listProjectResolutions,
  updateResolution,
} from "../src/modules/risk/risk-resolution.service.js";
import { tierAssessmentEvidence } from "../src/modules/risk/risk-tiering.js";
import { RiskAccessError } from "../src/modules/risk/risk-inputs.service.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const id = () => new mongoose.Types.ObjectId();

describe("Risk Assessment, Resolutions & Read Service (§4.7, §4.8, Step 122)", () => {
  let agencyId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;
  let roleId: mongoose.Types.ObjectId;
  let actor: any;

  beforeAll(async () => {
    await startIsolatedMongo();

    agencyId = id();
    userId = id();
    roleId = id();

    await Agency.create({
      _id: agencyId,
      code: "RDA",
      name: "Road Development Authority",
      status: "ACTIVE",
      type: "ROAD",
    });

    await Role.create({
      _id: roleId,
      key: "AGENCY_OFFICER",
      name: "Agency Officer",
      description: "Agency Officer role",
      scopeType: "AGENCY",
      isActive: true,
      permissions: [
        "risk.read",
        "risk.request",
        "risk.resolve",
        "finance.budget.read",
        "contractor.read",
        "report.export",
      ],
    });

    await User.create({
      _id: userId,
      roleId,
      agencyId,
      status: "ACTIVE",
      emailVerified: true,
      firstName: "Test",
      lastName: "Officer",
      email: "officer@rda.gov.lk",
      passwordHash: "dummy-password-hash-test",
    });

    actor = {
      userId: userId.toString(),
      roleKey: "AGENCY_OFFICER",
      roleId: roleId.toString(),
      agencyId: agencyId.toString(),
      credentialEpoch: 1,
    };
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("assesses project, generates atomic RSK number, updates Project cache and respects idempotency", async () => {
    const projectId = id();

    await Project.create({
      _id: projectId,
      projectCode: "INF-RDA-2001",
      title: "Kandy Highway Expansion",
      status: "ACTIVE",
      agencyId,
      projectType: "ROAD",
      budget: { currency: "LKR", amountMinor: 100_000_000 },
      physicalProgress: 30,
      financialProgress: 25,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      plannedEndDate: new Date("2026-12-01T00:00:00.000Z"),
      createdBy: userId,
    });

    // First assess
    const now = new Date("2026-03-01T10:00:00.000Z");
    const { assessment, unchanged } = await assessProject(
      actor,
      projectId.toString(),
      "ON_DEMAND",
      now,
    );

    expect(unchanged).toBe(false);
    expect(assessment.assessmentNo).toMatch(/^RSK-\d{4}-\d{6}$/);
    expect(assessment.overallLevel).toBeDefined();

    // Verify Project cache fields updated
    const updatedProject = await Project.findById(projectId).lean();
    expect(updatedProject?.riskLevel).toBe(assessment.overallLevel);
    expect(updatedProject?.latestRiskAssessmentId?.toString()).toBe(assessment._id.toString());
    expect(updatedProject?.riskAssessedAt).toBeDefined();

    // Second assess within 24h with identical inputs -> unchanged: true, no new row
    const secondCall = await assessProject(
      actor,
      projectId.toString(),
      "ON_DEMAND",
      new Date("2026-03-01T11:00:00.000Z"),
    );
    expect(secondCall.unchanged).toBe(true);
    expect(secondCall.assessment.assessmentNo).toBe(assessment.assessmentNo);

    // Force assess -> writes new row
    const forced = await assessProject(
      actor,
      projectId.toString(),
      "ON_DEMAND",
      new Date("2026-03-01T12:00:00.000Z"),
      { force: true },
    );
    expect(forced.unchanged).toBe(false);
    expect(forced.assessment.assessmentNo).not.toBe(assessment.assessmentNo);
  });

  it("manages resolutions with OCC, validates minimum note length and appends event history", async () => {
    const projectId = id();

    await Project.create({
      _id: projectId,
      projectCode: "INF-RDA-2002",
      title: "Galle Overpass",
      status: "ACTIVE",
      agencyId,
      projectType: "BRIDGE",
      budget: { currency: "LKR", amountMinor: 50_000_000 },
      createdBy: userId,
    });

    const fingerprint = "DL1:-";

    // 1. Rejects short note (< 12 chars) for RESOLVED
    await expect(
      updateResolution(actor, projectId.toString(), fingerprint, {
        status: "RESOLVED",
        note: "too short",
        version: 0,
      }),
    ).rejects.toThrow(RiskAccessError);

    // 2. Successful initial resolution
    const resolved = await updateResolution(actor, projectId.toString(), fingerprint, {
      status: "RESOLVED",
      note: "Contractor mobilized additional drilling rigs to recover schedule",
      version: 0,
    });

    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.version).toBe(1);
    expect(resolved.events).toHaveLength(1);

    // 3. Version conflict on stale version
    await expect(
      updateResolution(actor, projectId.toString(), fingerprint, {
        status: "IN_PROGRESS",
        note: "Monitoring progress",
        version: 0, // stale version
      }),
    ).rejects.toThrow(RiskAccessError);

    // 4. Update with correct version
    const updated = await updateResolution(actor, projectId.toString(), fingerprint, {
      status: "IN_PROGRESS",
      note: "Monitoring ongoing weekly output",
      version: 1,
    });

    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.version).toBe(2);
    expect(updated.events).toHaveLength(2);

    // List resolutions
    const list = await listProjectResolutions(actor, projectId.toString());
    expect(list).toHaveLength(1);
  });

  it("tiers evidence when viewer lacks finance read permission", () => {
    const mockAssessment: any = {
      overallLevel: "HIGH",
      indicators: [
        {
          code: "BG1",
          category: "BUDGET",
          severity: "HIGH",
          points: 25,
          fingerprint: "BG1:-",
          titleKey: "t",
          explainKey: "e",
          inputs: {
            budgetMinor: 100_000_000,
            spentMinor: 75_000_000,
            financialPct: 75,
            physicalPct: 20,
          },
          evidence: [
            {
              kind: "finance",
              ref: { type: "finance", id: "1" },
              value: 100_000_000,
              unit: "LKR minor",
            },
          ],
          calc: {
            formulaKey: "calc",
            steps: ["Budget is 100_000_000 spent is 75_000_000"],
          },
          basis: "REPORTED",
        },
      ],
    };

    // Viewer WITHOUT finance permission
    const tiered = tierAssessmentEvidence(mockAssessment, {
      canReadFinance: false,
      canReadContractor: true,
      agencyId: agencyId.toString(),
      isPlatformScope: false,
    });

    const bg1 = tiered.indicators[0]!;
    expect(bg1.inputs?.budgetMinor).toBeUndefined();
    expect(bg1.inputs?.spentMinor).toBeUndefined();
    expect(bg1.inputs?.financialPct).toBe(75); // Percentages preserved!
    expect(bg1.evidence[0]?.value).toBe("[REDACTED]");
    expect(bg1.calc?.steps[0]).toContain("[Financial amounts redacted");
  });

  it("provides overview counts, project table, scatter, methodology and export", async () => {
    const overview = await getRiskOverview(actor);
    expect(overview.scope).toBe("agency");
    expect(overview.counts.assessed).toBeGreaterThanOrEqual(1);

    const projectsList = await getRiskProjects(actor, { page: 1, limit: 10 });
    expect(projectsList.items.length).toBeGreaterThanOrEqual(1);
    expect(projectsList.pagination.total).toBeGreaterThanOrEqual(1);

    const scatter = await getRiskScatter(actor);
    expect(scatter.length).toBeGreaterThanOrEqual(1);
    expect(scatter[0]?.physicalPct).toBeDefined();

    const methodology = await getMethodology();
    expect(methodology.engineVersion).toBe("r1");
    expect(methodology.honestyStatement).toContain("Rule-based baseline");

    const csv = await exportRiskCsv(actor, {}, "req-test-1");
    expect(csv).toContain('"Project Code","Title","Agency"');
    expect(csv).toContain("INF-RDA-2001");
  });
});
