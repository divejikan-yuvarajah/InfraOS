import type mongoose from "mongoose";

import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { backfillFinance } from "../../../modules/finance/finance.backfill.js";
import { duplicateKeyOf } from "../../../modules/finance/finance.common.js";
import { ProjectExpense } from "../../../modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { ProgressReport } from "../../../modules/projects/models/progress-report.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import type { Geometry } from "../../../shared/database/geometry.js";
import { lkr } from "../helpers/money.js";
import { ctxId, type DemoContext } from "./context.js";

type Id = mongoose.Types.ObjectId;
const M = 100_000_00; // LKR 100,000.00 in cents
export const SHOWCASE_CODES = ["INF-SHOW-001", "INF-SHOW-002", "INF-SHOW-003", "INF-SHOW-004", "INF-SHOW-005", "INF-SHOW-006"] as const;
type Code = (typeof SHOWCASE_CODES)[number];

type P = {
  code: Code; title: string; type: string; agency: string; status: string; contractor: string; budget: number; phys: number; start: string; end: string; actualEnd?: string;
  loc: { province: string; district: string; locality: string; roadName?: string }; geometry: Geometry; risk?: number;
  milestones: { title: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED"; progress: number; start: string; end: string; actualStart?: string; actualEnd?: string }[];
  reported?: number; contractRef: string;
};

/**
 * Showcase layer: six more projects across districts, project types and statuses, so every page (projects, timelines, finance, contractors, inspections,
 * DocTrace, maps, assets) has something to explain in a walkthrough. All text is labelled (Synthetic); numbers live in reserved ranges so re-seeding is idempotent.
 * Projects use fixed codes INF-SHOW-00n, which the demo reset and verification both know about.
 */
const PROJECTS: P[] = [
  { code: "INF-SHOW-001", title: "Kandy Ring Road Widening (Showcase)", type: "ROAD", agency: "DEMO_RDA", status: "ACTIVE", contractor: "SYNTH/ALPHA-001", budget: 12_000 * M, phys: 62, start: "2026-01-12", end: "2027-03-30", contractRef: "SHOW-CT-001",
    loc: { province: "Central Province", district: "Kandy", locality: "Peradeniya Junction", roadName: "Ring Road Section 2" }, geometry: { type: "LineString", coordinates: [[80.5903, 7.2618], [80.6048, 7.2751], [80.6167, 7.2894]] }, reported: 62,
    milestones: [
      { title: "Land acquisition and utility relocation", status: "COMPLETED", progress: 100, start: "2026-01-12", end: "2026-03-15", actualStart: "2026-01-14", actualEnd: "2026-03-10" },
      { title: "Earthworks and drainage", status: "COMPLETED", progress: 100, start: "2026-03-16", end: "2026-06-30", actualStart: "2026-03-18", actualEnd: "2026-07-04" },
      { title: "Base course and asphalt layers", status: "IN_PROGRESS", progress: 55, start: "2026-07-01", end: "2026-12-15", actualStart: "2026-07-06" },
      { title: "Signage, markings and handover", status: "NOT_STARTED", progress: 0, start: "2026-12-16", end: "2027-03-30" },
    ] },
  { code: "INF-SHOW-002", title: "Galle Coastal Water Supply Extension (Showcase)", type: "WATER", agency: "DEMO_WATER", status: "ACTIVE", contractor: "SYNTH/BETA-001", budget: 7_400 * M, phys: 40, start: "2026-02-02", end: "2027-01-29", contractRef: "SHOW-CT-002",
    loc: { province: "Southern Province", district: "Galle", locality: "Hikkaduwa", roadName: "Coastal Road" }, geometry: { type: "LineString", coordinates: [[80.0973, 6.1395], [80.1105, 6.1621], [80.1232, 6.1839]] }, reported: 40,
    milestones: [
      { title: "Pipe route survey and design", status: "COMPLETED", progress: 100, start: "2026-02-02", end: "2026-04-10", actualStart: "2026-02-04", actualEnd: "2026-04-08" },
      { title: "Trenching and pipe laying", status: "IN_PROGRESS", progress: 45, start: "2026-04-11", end: "2026-10-30", actualStart: "2026-04-14" },
      { title: "Pressure testing and commissioning", status: "NOT_STARTED", progress: 0, start: "2026-11-01", end: "2027-01-29" },
    ] },
  { code: "INF-SHOW-003", title: "Jaffna Grid Substation Upgrade (Showcase)", type: "ELECTRICITY", agency: "DEMO_ELEC", status: "DELAYED", contractor: "SYNTH/GAMMA-001", budget: 9_800 * M, phys: 28, start: "2025-09-01", end: "2026-09-30", risk: 71, contractRef: "SHOW-CT-003",
    loc: { province: "Northern Province", district: "Jaffna", locality: "Chunnakam", roadName: "Substation Road" }, geometry: { type: "Point", coordinates: [80.0255, 9.7487] }, reported: 40,
    milestones: [
      { title: "Transformer procurement", status: "COMPLETED", progress: 100, start: "2025-09-01", end: "2025-12-15", actualStart: "2025-09-03", actualEnd: "2026-01-20" },
      { title: "Switchgear installation", status: "DELAYED", progress: 30, start: "2025-12-16", end: "2026-05-30", actualStart: "2026-02-02" },
      { title: "Grid testing and energisation", status: "NOT_STARTED", progress: 0, start: "2026-06-01", end: "2026-09-30" },
    ] },
  { code: "INF-SHOW-004", title: "Matara Bridge Rehabilitation (Showcase)", type: "BRIDGE", agency: "DEMO_RDA", status: "COMPLETED", contractor: "SYNTH/ALPHA-001", budget: 4_600 * M, phys: 100, start: "2025-02-03", end: "2026-02-27", actualEnd: "2026-03-05", contractRef: "SHOW-CT-004",
    loc: { province: "Southern Province", district: "Matara", locality: "Nilwala River", roadName: "Matara Bridge" }, geometry: { type: "Point", coordinates: [80.5421, 5.9492] }, reported: 100,
    milestones: [
      { title: "Bearing and deck assessment", status: "COMPLETED", progress: 100, start: "2025-02-03", end: "2025-04-30", actualStart: "2025-02-05", actualEnd: "2025-04-28" },
      { title: "Deck repair and waterproofing", status: "COMPLETED", progress: 100, start: "2025-05-01", end: "2025-11-30", actualStart: "2025-05-05", actualEnd: "2025-12-02" },
      { title: "Load test and handover", status: "COMPLETED", progress: 100, start: "2025-12-01", end: "2026-02-27", actualStart: "2025-12-04", actualEnd: "2026-03-05" },
    ] },
  { code: "INF-SHOW-005", title: "Kurunegala Flood Relief Canal (Showcase)", type: "DRAINAGE", agency: "AGENCY_DEMO_DRAINAGE", status: "ON_HOLD", contractor: "SYNTH/GAMMA-001", budget: 5_200 * M, phys: 18, start: "2026-03-02", end: "2027-02-26", contractRef: "SHOW-CT-005",
    loc: { province: "North Western Province", district: "Kurunegala", locality: "Wellawa", roadName: "Canal Reserve" }, geometry: { type: "LineString", coordinates: [[80.3631, 7.4801], [80.3752, 7.4912]] },
    milestones: [
      { title: "Canal alignment survey", status: "COMPLETED", progress: 100, start: "2026-03-02", end: "2026-05-15", actualStart: "2026-03-04", actualEnd: "2026-05-12" },
      { title: "Excavation (paused for land dispute)", status: "IN_PROGRESS", progress: 20, start: "2026-05-16", end: "2026-11-30", actualStart: "2026-05-20" },
      { title: "Lining and outfall works", status: "NOT_STARTED", progress: 0, start: "2026-12-01", end: "2027-02-26" },
    ] },
  { code: "INF-SHOW-006", title: "Anuradhapura Community Health Hall (Showcase)", type: "PUBLIC_FACILITY", agency: "AGENCY_DEMO_LOCAL", status: "APPROVED", contractor: "SYNTH/BETA-001", budget: 2_900 * M, phys: 0, start: "2026-12-01", end: "2027-09-30", contractRef: "SHOW-CT-006",
    loc: { province: "North Central Province", district: "Anuradhapura", locality: "Thirappane", roadName: "Hospital Road" }, geometry: { type: "Point", coordinates: [80.4037, 8.3114] },
    milestones: [
      { title: "Site preparation", status: "NOT_STARTED", progress: 0, start: "2026-12-01", end: "2027-02-15" },
      { title: "Structure and roofing", status: "NOT_STARTED", progress: 0, start: "2027-02-16", end: "2027-07-15" },
      { title: "Fit-out and handover", status: "NOT_STARTED", progress: 0, start: "2027-07-16", end: "2027-09-30" },
    ] },
];

const PAYMENTS: { no: string; code: Code; type: "ADVANCE" | "INTERIM" | "FINAL" | "RETENTION"; amount: number; status: "PENDING" | "APPROVED" | "PAID"; invoice: string; date: string; paidAt?: string; ref?: string }[] = [
  { no: "PAY-DEMO-1001", code: "INF-SHOW-001", type: "ADVANCE", amount: 1_800 * M, status: "PAID", invoice: "SHOW-INV-001", date: "2026-01-20", paidAt: "2026-01-27", ref: "SHOW-CHQ-001" },
  { no: "PAY-DEMO-1002", code: "INF-SHOW-001", type: "INTERIM", amount: 2_400 * M, status: "PAID", invoice: "SHOW-INV-002", date: "2026-05-18", paidAt: "2026-05-24", ref: "SHOW-CHQ-002" },
  { no: "PAY-DEMO-1003", code: "INF-SHOW-001", type: "INTERIM", amount: 1_500 * M, status: "PENDING", invoice: "SHOW-INV-003", date: "2026-10-02" },
  { no: "PAY-DEMO-1004", code: "INF-SHOW-002", type: "ADVANCE", amount: 1_100 * M, status: "PAID", invoice: "SHOW-INV-004", date: "2026-02-12", paidAt: "2026-02-19", ref: "SHOW-CHQ-003" },
  { no: "PAY-DEMO-1005", code: "INF-SHOW-002", type: "INTERIM", amount: 900 * M, status: "APPROVED", invoice: "SHOW-INV-005", date: "2026-09-14" },
  { no: "PAY-DEMO-1006", code: "INF-SHOW-003", type: "ADVANCE", amount: 1_960 * M, status: "PAID", invoice: "SHOW-INV-006", date: "2025-09-15", paidAt: "2025-09-22", ref: "SHOW-CHQ-004" },
  { no: "PAY-DEMO-1007", code: "INF-SHOW-003", type: "INTERIM", amount: 2_100 * M, status: "PAID", invoice: "SHOW-INV-007", date: "2026-02-10", paidAt: "2026-02-17", ref: "SHOW-CHQ-005" },
  { no: "PAY-DEMO-1008", code: "INF-SHOW-004", type: "INTERIM", amount: 2_700 * M, status: "PAID", invoice: "SHOW-INV-008", date: "2025-08-12", paidAt: "2025-08-19", ref: "SHOW-CHQ-006" },
  { no: "PAY-DEMO-1009", code: "INF-SHOW-004", type: "FINAL", amount: 1_850 * M, status: "PAID", invoice: "SHOW-INV-009", date: "2026-03-10", paidAt: "2026-03-17", ref: "SHOW-CHQ-007" },
  { no: "PAY-DEMO-1010", code: "INF-SHOW-005", type: "ADVANCE", amount: 780 * M, status: "PAID", invoice: "SHOW-INV-010", date: "2026-03-16", paidAt: "2026-03-23", ref: "SHOW-CHQ-008" },
];

const EXPENSES: { no: string; code: Code; category: "CIVIL_WORKS" | "MATERIALS" | "LABOUR" | "EQUIPMENT"; description: string; amount: number; status: "VERIFIED" | "PENDING_VERIFICATION" | "DRAFT"; supplier: string; ref: string; date: string }[] = [
  { no: "EXP-DEMO-1001", code: "INF-SHOW-001", category: "MATERIALS", description: "Asphalt supply, batch 4 (Synthetic)", amount: 640 * M, status: "VERIFIED", supplier: "Synthetic Asphalt Works", ref: "SHOW-VCH-001", date: "2026-08-12" },
  { no: "EXP-DEMO-1002", code: "INF-SHOW-001", category: "EQUIPMENT", description: "Roller and paver hire, August (Synthetic)", amount: 210 * M, status: "VERIFIED", supplier: "Synthetic Plant Hire", ref: "SHOW-VCH-002", date: "2026-08-30" },
  { no: "EXP-DEMO-1003", code: "INF-SHOW-001", category: "LABOUR", description: "Daily-paid labour, October (Synthetic)", amount: 150 * M, status: "PENDING_VERIFICATION", supplier: "Synthetic Labour Pool", ref: "SHOW-VCH-003", date: "2026-10-28" },
  { no: "EXP-DEMO-1004", code: "INF-SHOW-002", category: "MATERIALS", description: "HDPE pipes, 400 mm (Synthetic)", amount: 780 * M, status: "VERIFIED", supplier: "Synthetic Pipes", ref: "SHOW-VCH-004", date: "2026-06-05" },
  { no: "EXP-DEMO-1005", code: "INF-SHOW-002", category: "CIVIL_WORKS", description: "Road crossing bores (Synthetic)", amount: 320 * M, status: "DRAFT", supplier: "Synthetic Civil", ref: "SHOW-VCH-005", date: "2026-10-20" },
  { no: "EXP-DEMO-1006", code: "INF-SHOW-003", category: "EQUIPMENT", description: "33 kV transformer (Synthetic)", amount: 2_300 * M, status: "VERIFIED", supplier: "Synthetic Power Equipment", ref: "SHOW-VCH-006", date: "2026-01-18" },
  { no: "EXP-DEMO-1007", code: "INF-SHOW-004", category: "CIVIL_WORKS", description: "Deck repair and waterproofing (Synthetic)", amount: 2_900 * M, status: "VERIFIED", supplier: "Synthetic Civil", ref: "SHOW-VCH-007", date: "2025-11-28" },
  { no: "EXP-DEMO-1008", code: "INF-SHOW-005", category: "EQUIPMENT", description: "Excavator mobilisation (Synthetic)", amount: 260 * M, status: "PENDING_VERIFICATION", supplier: "Synthetic Plant Hire", ref: "SHOW-VCH-008", date: "2026-05-22" },
];

const INSPECTIONS: { no: string; code: Code; type: "PROGRESS_VERIFICATION" | "QUALITY" | "SAFETY" | "MILESTONE"; status: "SCHEDULED" | "IN_PROGRESS"; date: string; priority: "NORMAL" | "HIGH" | "URGENT"; purpose: string }[] = [
  { no: "INS-2026-901001", code: "INF-SHOW-001", type: "QUALITY", status: "SCHEDULED", date: "2026-11-25T04:00:00.000Z", priority: "HIGH", purpose: "Asphalt compaction and level check (Synthetic)" },
  { no: "INS-2026-901002", code: "INF-SHOW-002", type: "PROGRESS_VERIFICATION", status: "IN_PROGRESS", date: "2026-11-07T04:00:00.000Z", priority: "NORMAL", purpose: "Verify pipe-laying progress against the report (Synthetic)" },
  { no: "INS-2026-901003", code: "INF-SHOW-003", type: "SAFETY", status: "SCHEDULED", date: "2026-11-18T04:00:00.000Z", priority: "URGENT", purpose: "Switchyard safety review on the delayed project (Synthetic)" },
  { no: "INS-2026-901004", code: "INF-SHOW-005", type: "MILESTONE", status: "SCHEDULED", date: "2026-12-02T04:00:00.000Z", priority: "NORMAL", purpose: "Excavation milestone check once work resumes (Synthetic)" },
];

const ISSUES = [
  { category: "POTHOLE", agency: "DEMO_RDA", status: "IN_PROGRESS", priority: "HIGH", district: "Kandy", locality: "Peradeniya", text: "Deep pothole near the Ring Road works entrance (Showcase)." },
  { category: "ROAD_DAMAGE", agency: "DEMO_RDA", status: "ASSIGNED", priority: "NORMAL", district: "Matara", locality: "Nilwala bank", text: "Edge damage at the bridge approach after heavy rain (Showcase)." },
  { category: "WATER_LEAK", agency: "DEMO_WATER", status: "ASSIGNED", priority: "HIGH", district: "Galle", locality: "Hikkaduwa", text: "Pipe leak next to the coastal trench (Showcase)." },
  { category: "UTILITY_DAMAGE", agency: "DEMO_ELEC", status: "IN_REVIEW", priority: "CRITICAL", district: "Jaffna", locality: "Chunnakam", text: "Hanging cable near the substation fence (Showcase)." },
  { category: "DRAINAGE", agency: "AGENCY_DEMO_DRAINAGE", status: "RESOLVED", priority: "NORMAL", district: "Kurunegala", locality: "Wellawa", text: "Blocked culvert cleared by the council crew (Showcase)." },
  { category: "PUBLIC_ASSET_DAMAGE", agency: "AGENCY_DEMO_LOCAL", status: "SUBMITTED", priority: "LOW", district: "Anuradhapura", locality: "Thirappane", text: "Broken bus shelter bench at the hall site (Showcase)." },
] as const;

const ISSUE_XY: Record<string, [number, number]> = { Kandy: [80.62, 7.29], Matara: [80.54, 5.95], Galle: [80.11, 6.16], Jaffna: [80.03, 9.75], Kurunegala: [80.37, 7.49], Anuradhapura: [80.4, 8.31] };

export async function seedDemoShowcase(context: DemoContext): Promise<{ projects: number; milestones: number; payments: number; expenses: number; inspections: number; issues: number }> {
  const users = context.users as unknown as Map<string, Id>;
  const pm = ctxId(users, "PROJECT_MANAGER");
  const finance = ctxId(users, "FINANCE_OFFICER");
  const inspector = ctxId(users, "INSPECTOR");
  const citizen = ctxId(users, "CITIZEN");
  const ids = new Map<Code, Id>();
  let milestones = 0;

  for (const p of PROJECTS) {
    const contractorId = ctxId(context.contractors, p.contractor);
    const agencyId = ctxId(context.agencies, p.agency);
    const doc = await Project.findOneAndUpdate({ projectCode: p.code }, { $set: {
      title: p.title, description: `${p.title}. Synthetic INFRAOS showcase data for walkthroughs; not official government data.`, projectType: p.type, agencyId, managerId: pm, contractorId: ["APPROVED", "ACTIVE", "DELAYED", "ON_HOLD", "COMPLETED"].includes(p.status) ? contractorId : null,
      location: { ...p.loc, description: "Synthetic location for demonstrations." }, geometry: p.geometry, startDate: d(`${p.start}T00:00:00.000Z`), plannedEndDate: d(`${p.end}T00:00:00.000Z`), ...(p.actualEnd ? { actualEndDate: d(`${p.actualEnd}T00:00:00.000Z`) } : {}),
      budget: lkr(p.budget), physicalProgress: p.phys, financialProgress: 0, ...(p.risk ? { riskScore: p.risk } : {}), status: p.status, createdBy: pm,
    }, $setOnInsert: { projectCode: p.code } }, { upsert: true, new: true, runValidators: true });
    ids.set(p.code, doc._id as Id);
    context.projects.set(p.code as never, doc._id as Id);

    for (const m of p.milestones) {
      await Milestone.findOneAndUpdate({ projectId: doc._id, title: m.title }, { $set: {
        description: "Synthetic milestone for walkthroughs.", plannedStart: d(`${m.start}T00:00:00.000Z`), plannedEnd: d(`${m.end}T00:00:00.000Z`), progress: m.progress, status: m.status,
        ...(m.actualStart ? { actualStart: d(`${m.actualStart}T00:00:00.000Z`) } : {}), ...(m.actualEnd ? { actualEnd: d(`${m.actualEnd}T00:00:00.000Z`) } : {}),
      }, $setOnInsert: { projectId: doc._id, title: m.title } }, { upsert: true, runValidators: true });
      milestones += 1;
    }

    const status = p.status === "COMPLETED" ? "ENDED" : "ACTIVE";
    await ContractorAssignment.findOneAndUpdate({ projectId: doc._id, contractorId, startDate: d(`${p.start}T00:00:00.000Z`) }, { $set: {
      agencyId, role: "PRIMARY", status, assignedBy: pm, contractReference: p.contractRef, contractValue: { amountMinor: Math.round(p.budget * 0.95), currency: "LKR" },
      ...(status === "ENDED" ? { endDate: d(`${p.actualEnd}T00:00:00.000Z`), endedBy: pm, endReason: "Works completed and handed over (synthetic)." } : {}),
    }, $setOnInsert: { projectId: doc._id, contractorId, startDate: d(`${p.start}T00:00:00.000Z`) } }, { upsert: true, new: true });

    // Reported progress is an append-only claim, so project pages can show reported-versus-verified honestly.
    if (p.reported !== undefined && !(await ProgressReport.exists({ projectId: doc._id }))) {
      await ProgressReport.create({ projectId: doc._id, sequence: 1, reportedPercent: p.reported, previousPercent: 0, note: "Synthetic progress report for the showcase.", reporterUserId: pm, reportedAt: d("2026-10-15T06:00:00.000Z") });
    }
  }

  // Baseline INITIAL budget revisions and payment numbers for the new projects only, then the rows below.
  await backfillFinance(true, [...ids.values()]);

  for (const p of PAYMENTS) {
    const projectId = ids.get(p.code)!;
    const proj = PROJECTS.find((x) => x.code === p.code)!;
    const agencyId = ctxId(context.agencies, proj.agency);
    const contractorId = ctxId(context.contractors, proj.contractor);
    const assignment = await ContractorAssignment.findOne({ projectId, contractorId }).select("_id").lean();
    const decided = p.status !== "PENDING";
    await ProjectPayment.findOneAndUpdate({ paymentNo: p.no }, { $set: {
      projectId, agencyId, contractorId, ...(assignment ? { assignmentId: assignment._id } : {}), amount: lkr(p.amount), paymentType: p.type, status: p.status, invoiceReference: p.invoice, description: "Synthetic payment record",
      date: d(`${p.date}T00:00:00.000Z`), requestedAt: d(`${p.date}T00:00:00.000Z`), createdBy: pm, dupActive: true,
      ...(decided ? { decidedAt: d(`${p.date}T12:00:00.000Z`), approvedBy: finance } : {}), ...(p.paidAt ? { paidAt: d(`${p.paidAt}T00:00:00.000Z`), paidBy: finance, paymentReference: p.ref } : {}),
    }, $setOnInsert: { paymentNo: p.no } }, { upsert: true });
  }
  for (const e of EXPENSES) {
    const projectId = ids.get(e.code)!;
    const agencyId = ctxId(context.agencies, PROJECTS.find((x) => x.code === e.code)!.agency);
    await ProjectExpense.findOneAndUpdate({ expenseNo: e.no }, { $set: {
      projectId, agencyId, category: e.category, description: e.description, expenseDate: d(`${e.date}T00:00:00.000Z`), amount: lkr(e.amount), supplierName: e.supplier, supportingRef: e.ref, status: e.status,
      duplicateKey: duplicateKeyOf(String(projectId), e.supplier, e.ref, e.amount), dupActive: e.status !== "DRAFT", createdBy: pm,
      ...(e.status !== "DRAFT" ? { submittedAt: d(`${e.date}T06:00:00.000Z`) } : {}), ...(e.status === "VERIFIED" ? { verifiedBy: finance, verifiedAt: d(`${e.date}T12:00:00.000Z`) } : {}),
    }, $setOnInsert: { expenseNo: e.no } }, { upsert: true });
  }
  // financialProgress follows the PAID rows, same integer maths as the service.
  for (const [, projectId] of ids) {
    const p = await Project.findById(projectId).select("budget").lean();
    const paid = (await ProjectPayment.aggregate<{ s: number }>([{ $match: { projectId, status: "PAID" } }, { $group: { _id: null, s: { $sum: "$amount.amountMinor" } } }]))[0]?.s ?? 0;
    const bp = p && p.budget.amountMinor > 0 ? Number((BigInt(paid) * 10000n) / BigInt(p.budget.amountMinor)) : 0;
    await Project.updateOne({ _id: projectId }, { $set: { financialProgress: Math.min(100, bp / 100) } }, { timestamps: false });
  }

  for (const s of INSPECTIONS) {
    const projectId = ids.get(s.code)!;
    const proj = PROJECTS.find((x) => x.code === s.code)!;
    const date = d(s.date);
    await Inspection.findOneAndUpdate({ inspectionNo: s.no }, { $set: {
      projectId, agencyId: ctxId(context.agencies, proj.agency), inspectorId: inspector, inspectionDate: date, inspectionType: s.type, purpose: s.purpose, priority: s.priority, durationMinutes: 120, status: s.status, scheduledBy: pm,
      assignmentHistory: [{ inspectorId: inspector, assignedBy: pm, assignedAt: new Date(date.getTime() - 7 * 86_400_000) }], notes: "Synthetic inspection for the showcase.", version: 1, contractorIdsAtInspection: [],
      ...(s.status === "IN_PROGRESS" ? { startedAt: date } : {}),
    }, $setOnInsert: { inspectionNo: s.no } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  }

  for (const i of ISSUES) {
    await CitizenIssue.findOneAndUpdate({ citizenId: citizen, category: i.category, description: i.text }, { $set: {
      location: { province: "Island-wide", district: i.district, locality: i.locality, description: i.text }, geometry: { type: "Point", coordinates: ISSUE_XY[i.district] ?? [80.6, 7.3] },
      assignedAgency: ctxId(context.agencies, i.agency), status: i.status, priority: i.priority,
    }, $setOnInsert: { citizenId: citizen, category: i.category, description: i.text } }, { upsert: true, runValidators: true });
  }
  return { projects: PROJECTS.length, milestones, payments: PAYMENTS.length, expenses: EXPENSES.length, inspections: INSPECTIONS.length, issues: ISSUES.length };
}
