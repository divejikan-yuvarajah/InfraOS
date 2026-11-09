import mongoose from "mongoose";
import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { User } from "../../../modules/identity/models/user.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { ProgressReport } from "../../../modules/projects/models/progress-report.model.js";
import { ProjectDependency } from "../../../modules/projects/models/project-dependency.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { ProjectExpense } from "../../../modules/finance/models/project-expense.model.js";
import { ConflictRecord } from "../../../modules/roadsync/models/conflict-record.model.js";
import { DEMO_RISK_PROJECT_CODES } from "./catalog.js";

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
const dFuture = (daysAhead: number) => new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

export async function seedDemoRiskProjects(): Promise<{ count: number; projectIds: string[] }> {
  // 1. Resolve demo agencies & users
  let rdaAgency = await Agency.findOne({ code: "DEMO_RDA" });
  if (!rdaAgency) {
    rdaAgency = await Agency.create({
      code: "DEMO_RDA",
      name: "Road Development Authority (Demo)",
      status: "ACTIVE",
      type: "ROAD",
    });
  }
  let waterAgency = await Agency.findOne({ code: "DEMO_WATER" });
  if (!waterAgency) {
    waterAgency = await Agency.create({
      code: "DEMO_WATER",
      name: "National Water Supply and Drainage Board (Demo)",
      status: "ACTIVE",
      type: "WATER",
    });
  }
  let elecAgency = await Agency.findOne({ code: "DEMO_ELEC" });
  if (!elecAgency) {
    elecAgency = await Agency.create({
      code: "DEMO_ELEC",
      name: "Ceylon Electricity Board (Demo)",
      status: "ACTIVE",
      type: "ELECTRICITY",
    });
  }

  const defaultAgencyId = rdaAgency._id;
  const rdaId = rdaAgency._id;
  const waterId = waterAgency._id;
  const elecId = elecAgency._id;

  const fixtureUser = await User.findOne({ status: "ACTIVE" }).select("_id").lean();
  const userId = fixtureUser?._id ?? new mongoose.Types.ObjectId();

  const seededIds: string[] = [];

  // Helper to upsert project
  async function upsertProject(data: any) {
    const existing = await Project.findOne({ projectCode: data.projectCode });
    if (existing) {
      existing.startDate = data.startDate ?? null;
      existing.plannedEndDate = data.plannedEndDate ?? null;
      existing.budget = data.budget ?? { currency: "LKR", amountMinor: 0 };
      Object.assign(existing, data);
      await existing.save();
      seededIds.push(existing._id.toString());
      return existing;
    }
    const created = await Project.create(data);
    seededIds.push(created._id.toString());
    return created;
  }

  // --- Project 1: Healthy (LOW risk) ---
  const p1 = await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[0], // INF-RISK_HEALTHY-001
    title: "Kandy Road Resurfacing Section A (Synthetic)",
    description: "Healthy municipal road resurfacing on track and on budget (Synthetic).",
    projectType: "ROAD",
    agencyId: rdaId,
    status: "ACTIVE",
    startDate: d(90),
    plannedEndDate: dFuture(90),
    budget: { currency: "LKR", amountMinor: 120_000_000_00 },
    physicalProgress: 45,
    financialProgress: 42,
    location: { district: "Kandy", province: "Central Province" },
    createdBy: userId,
  });

  // Seed milestone for P1
  await Milestone.deleteMany({ projectId: p1._id });
  await Milestone.create([
    {
      projectId: p1._id,
      title: "Sub-base preparation (Synthetic)",
      plannedStart: d(90),
      plannedEnd: d(40),
      actualStart: d(90),
      actualEnd: d(42),
      status: "COMPLETED",
      progress: 100,
    },
    {
      projectId: p1._id,
      title: "Asphalt surfacing (Synthetic)",
      plannedStart: d(39),
      plannedEnd: dFuture(30),
      status: "IN_PROGRESS",
      progress: 40,
    },
  ]);

  // Seed fresh on-track progress report for P1 (reported 5 days ago)
  await ProgressReport.collection.deleteMany({ projectId: p1._id });
  await ProgressReport.collection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    projectId: p1._id,
    sequence: 1,
    reportedPercent: 45,
    previousPercent: 40,
    reportedAt: d(5),
    submittedBy: userId,
    notes: "Surfacing progressing on schedule (Synthetic).",
    createdAt: d(5),
    updatedAt: d(5),
  });

  // --- Project 2: Delayed with Overdue Milestones & Stagnant Progress (HIGH risk) ---
  const p2 = await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[1], // INF-RISK_DELAYED-001
    title: "Galle Coastal Link Bridge Phase 2 (Synthetic)",
    description: "Delayed bridge project with overdue milestones and stagnant site progress (Synthetic).",
    projectType: "BRIDGE",
    agencyId: rdaId,
    status: "DELAYED",
    startDate: d(180),
    plannedEndDate: d(20), // overall planned end passed 20 days ago
    budget: { currency: "LKR", amountMinor: 250_000_000_00 },
    physicalProgress: 20,
    financialProgress: 22,
    location: { district: "Galle", province: "Southern Province" },
    createdBy: userId,
  });

  await Milestone.deleteMany({ projectId: p2._id });
  await Milestone.create([
    {
      projectId: p2._id,
      title: "Foundation piling (Synthetic)",
      plannedStart: d(180),
      plannedEnd: d(50), // 50 days overdue!
      status: "IN_PROGRESS",
      progress: 20,
    },
    {
      projectId: p2._id,
      title: "Pier erection (Synthetic)",
      plannedStart: d(49),
      plannedEnd: d(10), // 10 days overdue!
      status: "NOT_STARTED",
      progress: 0,
    },
  ]);

  // Seed progress reports (stagnant at 20% for > 30 days)
  await ProgressReport.collection.deleteMany({ projectId: p2._id });
  await ProgressReport.collection.insertMany([
    {
      _id: new mongoose.Types.ObjectId(),
      projectId: p2._id,
      sequence: 1,
      reportedPercent: 20,
      previousPercent: 15,
      note: "Piling rig arrived (Synthetic)",
      reporterUserId: userId,
      reportedAt: d(40),
      createdAt: d(40),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      projectId: p2._id,
      sequence: 2,
      reportedPercent: 20,
      previousPercent: 20,
      note: "No physical movement observed on site (Synthetic)",
      reporterUserId: userId,
      reportedAt: d(5),
      createdAt: d(5),
    },
  ]);

  // --- Project 3: Financial Ahead of Physical (BG1/BG3, HIGH/CRITICAL risk) ---
  const p3 = await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[2], // INF-RISK_FINAHEAD-001
    title: "Matara Drainage Upgrading Package B (Synthetic)",
    description: "Financial spending significantly outpaces physical progress (Synthetic).",
    projectType: "DRAINAGE",
    agencyId: waterId,
    status: "ACTIVE",
    startDate: d(120),
    plannedEndDate: dFuture(120),
    budget: { currency: "LKR", amountMinor: 180_000_000_00 },
    physicalProgress: 15,
    financialProgress: 65, // 50 point gap!
    location: { district: "Matara", province: "Southern Province" },
    createdBy: userId,
  });

  await ProjectExpense.deleteMany({ projectId: p3._id });
  await ProjectExpense.create({
    expenseNo: "EXP-RISK-SYNTH-001",
    projectId: p3._id,
    agencyId: waterId,
    category: "CIVIL_WORKS",
    description: "Advance payments and equipment mobilization (Synthetic)",
    expenseDate: d(15),
    amount: { currency: "LKR", amountMinor: 117_000_000_00 },
    supportingRef: "SYNTH-REF-001",
    duplicateKey: "DUP-EXP-RISK-001",
    status: "VERIFIED",
    createdBy: userId,
  });

  // --- Project 4: Open RoadSync Conflict (CO1, HIGH risk) ---
  const p4 = await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[3], // INF-RISK_CONFLICT-001
    title: "Jaffna Town Road & Water Line Integration (Synthetic)",
    description: "Active road rehabilitation stalled by unresolved cross-agency corridor conflict (Synthetic).",
    projectType: "ROAD",
    agencyId: rdaId,
    status: "ACTIVE",
    startDate: d(60),
    plannedEndDate: dFuture(120),
    budget: { currency: "LKR", amountMinor: 95_000_000_00 },
    physicalProgress: 25,
    financialProgress: 25,
    location: { district: "Jaffna", province: "Northern Province" },
    createdBy: userId,
  });

  await ConflictRecord.deleteMany({
    $or: [
      { aId: p4._id, aType: "project" },
      { bId: p4._id, bType: "project" },
    ],
  });

  const conflictPartnerId = new mongoose.Types.ObjectId();
  await ConflictRecord.create({
    conflictNo: "RSC-2026-900001",
    recordType: "conflict",
    candidateId: new mongoose.Types.ObjectId(),
    pairKey: `PRJ:${p4._id}:${conflictPartnerId}`,
    aId: p4._id,
    aType: "project",
    bId: conflictPartnerId,
    bType: "project",
    hotspot: { type: "Point", coordinates: [80.7, 7.8] },
    status: "open",
    severity: {
      current: {
        score: 75,
        band: "HIGH",
        calculatedAt: d(15),
      },
    },
    affectedAgencies: [
      { agencyId: rdaId, ack: { status: "unacknowledged" } },
      { agencyId: waterId, ack: { status: "unacknowledged" } },
    ],
    createdAt: d(15),
  });

  // --- Project 5: Dependency & Schedule Inconsistency (SC1, HIGH risk) ---
  const p5 = await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[4], // INF-RISK_SCHED-001
    title: "Negombo Flyover Foundation Works (Synthetic)",
    description: "Project planned start precedes prerequisite project completion date (Synthetic).",
    projectType: "BRIDGE",
    agencyId: rdaId,
    status: "ACTIVE",
    startDate: d(30),
    plannedEndDate: dFuture(150),
    budget: { currency: "LKR", amountMinor: 150_000_000_00 },
    physicalProgress: 10,
    financialProgress: 10,
    location: { district: "Gampaha", province: "Western Province" },
    createdBy: userId,
  });

  // p5 depends on p2 (which is delayed with plannedEnd in future relative to p5's start)
  await ProjectDependency.deleteMany({ projectId: p5._id });
  await ProjectDependency.create({
    projectId: p5._id,
    prerequisiteProjectId: p2._id,
    agencyId: rdaId,
    type: "PREREQUISITE",
    createdBy: userId,
  });

  // --- Project 6: Pre-start APPROVED project ---
  await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[5], // INF-RISK_APPROVED-001
    title: "Batticaloa Solar Grid Access Road (Synthetic)",
    description: "Approved project in pre-start planning phase (Synthetic).",
    projectType: "ROAD",
    agencyId: elecId,
    status: "APPROVED",
    startDate: dFuture(45),
    plannedEndDate: dFuture(240),
    budget: { currency: "LKR", amountMinor: 80_000_000_00 },
    physicalProgress: 0,
    financialProgress: 0,
    location: { district: "Batticaloa", province: "Eastern Province" },
    createdBy: userId,
  });

  // --- Project 7: Insufficient Data (NOT_ASSESSABLE categories) ---
  await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[6], // INF-RISK_NODATA-001
    title: "Kurunegala Rural Access Track (Synthetic)",
    description: "Active project lacking required milestone, progress, and financial data records (Synthetic).",
    projectType: "ROAD",
    agencyId: rdaId,
    status: "ACTIVE",
    startDate: undefined,
    plannedEndDate: undefined,
    budget: { currency: "LKR", amountMinor: 0 },
    physicalProgress: 0,
    financialProgress: 0,
    location: { district: "Kurunegala", province: "North Western Province" },
    createdBy: userId,
  });

  // --- Project 8: Completed Project (Not applicable) ---
  await upsertProject({
    projectCode: DEMO_RISK_PROJECT_CODES[7], // INF-RISK_COMPLETE-001
    title: "Colombo North Canal Dredging (Synthetic)",
    description: "Completed flood mitigation project with finalized actual end date (Synthetic).",
    projectType: "DRAINAGE",
    agencyId: waterId,
    status: "COMPLETED",
    startDate: d(240),
    plannedEndDate: d(60),
    actualEndDate: d(55),
    budget: { currency: "LKR", amountMinor: 70_000_000_00 },
    physicalProgress: 100,
    financialProgress: 100,
    location: { district: "Colombo", province: "Western Province" },
    createdBy: userId,
  });

  return {
    count: seededIds.length,
    projectIds: seededIds,
  };
}
