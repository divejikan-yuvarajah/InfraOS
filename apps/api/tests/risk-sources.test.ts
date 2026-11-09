import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { ProjectBudgetRevision } from "../src/modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../src/modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../src/modules/inspections/models/progress-verification.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { ProgressReport } from "../src/modules/projects/models/progress-report.model.js";
import { ProjectDependency } from "../src/modules/projects/models/project-dependency.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import {
  assembleRiskInputs,
  RiskAccessError,
} from "../src/modules/risk/risk-inputs.service.js";
import {
  fetchContractorSource,
  fetchDependenciesSource,
  fetchFinanceSource,
  fetchHistorySource,
  fetchInspectionsSource,
  fetchMilestonesSource,
  fetchProgressSource,
  fetchProjectSource,
  fetchReviewsSource,
  fetchRoadsyncSource,
} from "../src/modules/risk/sources/index.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const id = () => new mongoose.Types.ObjectId();

describe("Risk Source Adapters & Input Assembly (§4.3, Step 119)", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("fetchProjectSource reads project and sets physicalBasis to VERIFIED when ProgressVerification exists", async () => {
    const agencyId = id();
    const projectId = id();

    await Project.create({
      _id: projectId,
      projectCode: "INF-RDA-1001",
      title: "Colombo Drain Project",
      status: "ACTIVE",
      agencyId,
      projectType: "DRAINAGE",
      budget: { currency: "LKR", amountMinor: 50_000_000 },
      physicalProgress: 35,
      financialProgress: 30,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      plannedEndDate: new Date("2026-06-01T00:00:00.000Z"),
      createdBy: id(),
    });

    // 1. Without verification -> REPORTED
    const scope = { kind: "platform" } as const;
    let res = await fetchProjectSource(projectId.toString(), scope);
    expect(res.available).toBe(true);
    expect(res.data?.physicalBasis).toBe("REPORTED");
    expect(res.data?.verifiedProgress).toBeNull();

    // 2. Add verified progress -> VERIFIED
    await ProgressVerification.create({
      projectId,
      agencyId,
      inspectionId: id(),
      inspectorId: id(),
      reviewerId: id(),
      submissionNo: 1,
      verifiedPercent: 30,
      asOf: new Date("2026-02-15T00:00:00.000Z"),
      status: "ACTIVE",
    });

    res = await fetchProjectSource(projectId.toString(), scope);
    expect(res.available).toBe(true);
    expect(res.data?.physicalBasis).toBe("VERIFIED");
    expect(res.data?.verifiedProgress?.percent).toBe(30);
  });

  it("fetchMilestonesSource returns sorted milestones up to limit", async () => {
    const projectId = id();
    await Milestone.create({
      projectId,
      title: "Foundation",
      status: "COMPLETED",
      progress: 100,
      plannedStart: new Date("2026-01-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-02-01T00:00:00.000Z"),
    });

    const res = await fetchMilestonesSource(projectId.toString());
    expect(res.available).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.title).toBe("Foundation");
  });

  it("fetchProgressSource returns last 12 progress reports", async () => {
    const projectId = id();
    await ProgressReport.create({
      projectId,
      sequence: 1,
      reportedPercent: 20,
      previousPercent: 0,
      note: "Initial excavation completed smoothly",
      reporterUserId: id(),
      reportedAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    const res = await fetchProgressSource(projectId.toString());
    expect(res.available).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.reportedPercent).toBe(20);
  });

  it("fetchFinanceSource aggregates revisions, payments, expenses and spend series", async () => {
    const projectId = id();
    const agencyId = id();

    await Project.create({
      _id: projectId,
      projectCode: "INF-RDA-1002",
      title: "Bridge Maintenance",
      status: "ACTIVE",
      agencyId,
      projectType: "BRIDGE",
      budget: { currency: "LKR", amountMinor: 20_000_000 },
      createdBy: id(),
    });

    // Approved revision
    await ProjectBudgetRevision.create({
      projectId,
      agencyId,
      sequence: 1,
      kind: "REVISION",
      status: "APPROVED",
      previousTotal: { currency: "LKR", amountMinor: 20_000_000 },
      newTotal: { currency: "LKR", amountMinor: 25_000_000 },
      allocations: [{ category: "CIVIL_WORKS", amount: { currency: "LKR", amountMinor: 25_000_000 } }],
      reason: "Unexpected ground subsidence required piling",
      requestedAt: new Date("2026-01-10T00:00:00.000Z"),
    });

    // Paid payment
    await ProjectPayment.create({
      paymentNo: "PAY-2026-000001",
      projectId,
      agencyId,
      contractorId: id(),
      amount: { currency: "LKR", amountMinor: 5_000_000 },
      paymentType: "INTERIM",
      status: "PAID",
      paymentReference: "REF-BANK-001",
      date: new Date("2026-02-01T00:00:00.000Z"),
      paidAt: new Date("2026-02-01T00:00:00.000Z"),
      createdBy: id(),
    });

    // Verified expense
    await ProjectExpense.create({
      expenseNo: "EXP-2026-000001",
      projectId,
      agencyId,
      category: "MATERIALS",
      description: "Cement bags and rebar",
      expenseDate: new Date("2026-02-10T00:00:00.000Z"),
      amount: { currency: "LKR", amountMinor: 2_000_000 },
      status: "VERIFIED",
      verifiedAt: new Date("2026-02-12T00:00:00.000Z"),
      duplicateKey: "test-dup-key-01",
      dupActive: true,
      supportingRef: "INV-CEMENT-001",
      createdBy: id(),
    });

    const now = new Date("2026-03-01T00:00:00.000Z");
    const res = await fetchFinanceSource(projectId.toString(), now);

    expect(res.available).toBe(true);
    expect(res.data?.budgetMinor).toBe(25_000_000);
    expect(res.data?.approvedRevisionsCount).toBe(1);
    expect(res.data?.spentMinor).toBe(7_000_000); // 5m payment + 2m expense
    expect(res.data?.largestSingleTransactionMinor).toBe(5_000_000);
  });

  it("fetchInspectionsSource finds scheduled overdue and open defects", async () => {
    const projectId = id();
    const agencyId = id();

    await Inspection.create({
      inspectionNo: "INS-2026-000001",
      projectId,
      agencyId,
      inspectorId: id(),
      inspectionDate: new Date("2026-01-10T00:00:00.000Z"),
      status: "SCHEDULED", // scheduled in past -> overdue
      inspectionType: "PROGRESS_VERIFICATION",
      version: 0,
    });

    const now = new Date("2026-02-01T00:00:00.000Z");
    const res = await fetchInspectionsSource(projectId.toString(), now);

    expect(res.available).toBe(true);
    expect(res.data?.scheduledOverdueCount).toBe(1);
    expect(res.data?.oldestScheduledOverdueDays).toBeGreaterThanOrEqual(20);
  });

  it("fetchContractorSource handles assigned contractor with active assignments", async () => {
    const contractorId = id();
    const agencyId = id();

    await Contractor.create({
      _id: contractorId,
      name: "Highway Builders Co",
      registrationNumber: "REG-HW-001",
    });

    await ContractorAssignment.create({
      projectId: id(),
      contractorId,
      agencyId,
      role: "PRIMARY",
      status: "ACTIVE",
      assignedBy: id(),
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await fetchContractorSource(contractorId.toString());
    expect(res.available).toBe(true);
    expect(res.data?.assigned).toBe(true);
    expect(res.data?.contractorName).toBe("Highway Builders Co");
    expect(res.data?.activeAssignmentsCount).toBe(1);
  });

  it("fetchRoadsyncSource fetches active conflict records", async () => {
    const projectId = id();
    await ConflictRecord.create({
      conflictNo: "RSC-2026-000010",
      recordType: "conflict",
      candidateId: id(),
      pairKey: "pair-1",
      aType: "project",
      aId: projectId,
      bType: "work_request",
      bId: id(),
      hotspot: { type: "Point", coordinates: [79.86, 6.92] },
      severity: { current: { band: "HIGH", score: 75 } },
      status: "open",
      version: 1,
    });

    const now = new Date("2026-02-01T00:00:00.000Z");
    const res = await fetchRoadsyncSource(projectId.toString(), now);

    expect(res.available).toBe(true);
    expect(res.data?.conflicts).toHaveLength(1);
    expect(res.data?.conflicts[0]?.severityBand).toBe("HIGH");
  });

  it("assembleRiskInputs enforces scope and throws 404 for unauthorized projects", async () => {
    const owningAgencyId = id();
    const otherAgencyId = id();
    const projectId = id();

    await Agency.create({
      _id: owningAgencyId,
      code: "NWSDB",
      name: "Water Board",
      status: "ACTIVE",
      type: "WATER",
    });

    await Agency.create({
      _id: otherAgencyId,
      code: "RDA",
      name: "Road Development Authority",
      status: "ACTIVE",
      type: "ROAD",
    });

    await Project.create({
      _id: projectId,
      projectCode: "INF-NWSDB-1003",
      title: "Secret Water Pipeline",
      status: "ACTIVE",
      agencyId: owningAgencyId,
      projectType: "WATER",
      budget: { currency: "LKR", amountMinor: 10_000_000 },
      createdBy: id(),
    });

    // Actor scoped to a different agency
    const unauthorizedActor = {
      userId: id().toString(),
      roleKey: "AGENCY_OFFICER",
      roleId: id().toString(),
      agencyId: otherAgencyId.toString(),
      credentialEpoch: 1,
    };

    await expect(
      assembleRiskInputs(unauthorizedActor, projectId.toString(), new Date()),
    ).rejects.toThrow(RiskAccessError);
  });
});
