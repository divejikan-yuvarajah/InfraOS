import type mongoose from "mongoose";

import { backfillFinance } from "../../../modules/finance/finance.backfill.js";
import { duplicateKeyOf } from "../../../modules/finance/finance.common.js";
import { ProjectBudgetRevision } from "../../../modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../../../modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import { lkr } from "../helpers/money.js";
import type { DemoProjectCode } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

type Id = mongoose.Types.ObjectId;
const M = 100_000_00; // LKR 100,000.00 in cents; keeps the literals below readable (e.g. 1200 * M = LKR 120,000,000.00)

/**
 * Synthetic finance data for the demo. Everything here is labelled (Synthetic) and uses fixed numbers (PAY-DEMO-*, EXP-DEMO-*) so re-seeding
 * is idempotent and never consumes the real PAY/EXP counters. The project set tells a story on purpose:
 *   INF-ROAD-001      healthy, with a VERIFIED inspection (68%) so the verified basis and the cost-efficiency index are demonstrable
 *   INF-PFAC-001      spending ahead of progress; an approved inspection verification (30% vs 45% reported, seed-inspections) makes the conclusions CONFIRMED
 *   INF-BRIDGE-001    near budget (95.5%)
 *   INF-DRAINAGE-001  healthy with reported progress
 *   INF-WATER-001     a pending budget revision and an approved, unpaid advance
 */
const PAYMENTS: { no: string; project: DemoProjectCode; contractor: string; type: "ADVANCE" | "INTERIM" | "FINAL" | "RETENTION" | "OTHER"; amount: number; status: "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED" | "REVERSED"; invoice: string; date: string; paidAt?: string; ref?: string; note?: string }[] = [
  { no: "PAY-DEMO-0001", project: "INF-ROAD-001", contractor: "SYNTH/ALPHA-001", type: "INTERIM", amount: 600 * M, status: "PENDING", invoice: "SYN-INV-R-003", date: "2026-03-20" },
  { no: "PAY-DEMO-0002", project: "INF-ROAD-001", contractor: "SYNTH/ALPHA-001", type: "INTERIM", amount: 300 * M, status: "REJECTED", invoice: "SYN-INV-R-004", date: "2026-03-05", note: "Invoice does not match the BOQ (Synthetic)." },
  { no: "PAY-DEMO-0003", project: "INF-ROAD-001", contractor: "SYNTH/ALPHA-001", type: "OTHER", amount: 100 * M, status: "CANCELLED", invoice: "SYN-INV-R-005", date: "2026-03-06", note: "Raised against the wrong stage (Synthetic)." },
  { no: "PAY-DEMO-0004", project: "INF-WATER-001", contractor: "SYNTH/BETA-001", type: "ADVANCE", amount: 210 * M, status: "APPROVED", invoice: "SYN-INV-W-001", date: "2026-03-10" },
  { no: "PAY-DEMO-0005", project: "INF-PFAC-001", contractor: "SYNTH/BETA-001", type: "INTERIM", amount: 1_244 * M, status: "PAID", invoice: "SYN-INV-P-001", date: "2026-01-20", paidAt: "2026-01-25", ref: "SYN-CHQ-0001" },
  { no: "PAY-DEMO-0006", project: "INF-PFAC-001", contractor: "SYNTH/BETA-001", type: "INTERIM", amount: 832 * M, status: "PAID", invoice: "SYN-INV-P-002", date: "2026-02-20", paidAt: "2026-02-24", ref: "SYN-CHQ-0002" },
  { no: "PAY-DEMO-0007", project: "INF-BRIDGE-001", contractor: "SYNTH/ALPHA-001", type: "FINAL", amount: 5_350 * M, status: "PAID", invoice: "SYN-INV-B-001", date: "2025-12-10", paidAt: "2025-12-18", ref: "SYN-CHQ-0003" },
  { no: "PAY-DEMO-0008", project: "INF-BRIDGE-001", contractor: "SYNTH/ALPHA-001", type: "RETENTION", amount: 50 * M, status: "REVERSED", invoice: "SYN-INV-B-002", date: "2025-12-12", paidAt: "2025-12-19", ref: "SYN-CHQ-0004", note: "Reference entered against the wrong invoice (Synthetic)." },
  { no: "PAY-DEMO-0009", project: "INF-DRAINAGE-001", contractor: "SYNTH/GAMMA-001", type: "INTERIM", amount: 315 * M, status: "PAID", invoice: "SYN-INV-D-001", date: "2026-03-01", paidAt: "2026-03-04", ref: "SYN-CHQ-0005" },
];

const EXPENSES: { no: string; project: DemoProjectCode; category: "CIVIL_WORKS" | "MATERIALS" | "LABOUR" | "EQUIPMENT" | "OTHER"; description: string; amount: number; status: "DRAFT" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "REVERSED"; supplier: string; ref: string; date: string; reason?: string }[] = [
  { no: "EXP-DEMO-0001", project: "INF-ROAD-001", category: "MATERIALS", description: "Aggregate delivery, week 6 (Synthetic)", amount: 120 * M, status: "VERIFIED", supplier: "Synthetic Aggregates", ref: "SYN-VCH-001", date: "2026-02-12" },
  { no: "EXP-DEMO-0002", project: "INF-ROAD-001", category: "EQUIPMENT", description: "Paver hire, February (Synthetic)", amount: 75 * M, status: "VERIFIED", supplier: "Synthetic Plant Hire", ref: "SYN-VCH-002", date: "2026-02-20" },
  { no: "EXP-DEMO-0003", project: "INF-ROAD-001", category: "LABOUR", description: "Daily-paid labour, March (Synthetic)", amount: 40 * M, status: "PENDING_VERIFICATION", supplier: "Synthetic Labour Pool", ref: "SYN-VCH-003", date: "2026-03-15" },
  { no: "EXP-DEMO-0004", project: "INF-ROAD-001", category: "MATERIALS", description: "Bitumen purchase (Synthetic)", amount: 90 * M, status: "DRAFT", supplier: "Synthetic Bitumen", ref: "SYN-VCH-004", date: "2026-03-18" },
  { no: "EXP-DEMO-0005", project: "INF-ROAD-001", category: "OTHER", description: "Site signage (Synthetic)", amount: 8 * M, status: "REJECTED", supplier: "Synthetic Signs", ref: "SYN-VCH-005", date: "2026-03-02", reason: "Receipt is not legible (Synthetic)." },
  { no: "EXP-DEMO-0006", project: "INF-ROAD-001", category: "CIVIL_WORKS", description: "Culvert repair posted in error (Synthetic)", amount: 55 * M, status: "REVERSED", supplier: "Synthetic Civil", ref: "SYN-VCH-006", date: "2026-02-25", reason: "Posted against the wrong project (Synthetic)." },
  { no: "EXP-DEMO-0007", project: "INF-PFAC-001", category: "CIVIL_WORKS", description: "Access road base course (Synthetic)", amount: 1_100 * M, status: "VERIFIED", supplier: "Synthetic Civil", ref: "SYN-VCH-007", date: "2026-01-30" },
  { no: "EXP-DEMO-0008", project: "INF-DRAINAGE-001", category: "MATERIALS", description: "Concrete pipes (Synthetic)", amount: 180 * M, status: "PENDING_VERIFICATION", supplier: "Synthetic Concrete", ref: "SYN-VCH-008", date: "2026-03-08" },
];

const REVISIONS: { project: DemoProjectCode; sequence: number; status: "APPROVED" | "PENDING_APPROVAL"; previous: number; total: number; allocations: [string, number][]; reason: string }[] = [
  { project: "INF-ROAD-001", sequence: 2, status: "APPROVED", previous: 8_500 * M, total: 8_500 * M, allocations: [["CIVIL_WORKS", 5_000 * M], ["MATERIALS", 2_000 * M], ["LABOUR", 1_000 * M], ["CONTINGENCY", 300 * M]], reason: "Category allocations added to the approved budget (Synthetic)." },
  { project: "INF-BRIDGE-001", sequence: 2, status: "APPROVED", previous: 5_600 * M, total: 5_600 * M, allocations: [["CIVIL_WORKS", 4_000 * M], ["MATERIALS", 1_000 * M], ["EQUIPMENT", 300 * M]], reason: "Category allocations added to the approved budget (Synthetic)." },
  { project: "INF-WATER-001", sequence: 2, status: "PENDING_APPROVAL", previous: 4_200 * M, total: 4_500 * M, allocations: [["CIVIL_WORKS", 2_500 * M], ["MATERIALS", 1_500 * M]], reason: "Pipe specification changed after the utility survey (Synthetic)." },
];

export async function seedDemoFinance(context: DemoContext): Promise<{ revisions: number; payments: number; expenses: number }> {
  const pm = ctxId(context.users as unknown as Map<string, Id>, "PROJECT_MANAGER");
  const finance = ctxId(context.users as unknown as Map<string, Id>, "FINANCE_OFFICER");
  const projects = new Map<string, Id>([...context.projects].map(([code, id]) => [code, id as Id]));
  const projectIds = [...projects.values()];

  // Baseline INITIAL revisions and payment numbers for the demo projects only.
  await backfillFinance(true, projectIds);

  for (const r of REVISIONS) {
    const projectId = projects.get(r.project)!;
    if (await ProjectBudgetRevision.exists({ projectId, sequence: r.sequence })) continue;
    const project = await Project.findById(projectId).select("agencyId").lean();
    await ProjectBudgetRevision.create({
      projectId, agencyId: project!.agencyId, sequence: r.sequence, kind: "REVISION", status: r.status, previousTotal: lkr(r.previous), newTotal: lkr(r.total),
      allocations: r.allocations.map(([category, amount]) => ({ category, amount: lkr(amount) })), reason: r.reason, requestedBy: pm, requestedAt: d("2026-03-01T00:00:00.000Z"),
      ...(r.status === "APPROVED" ? { decidedBy: finance, decidedAt: d("2026-03-02T00:00:00.000Z") } : {}),
    });
  }

  for (const p of PAYMENTS) {
    const projectId = projects.get(p.project)!;
    const project = await Project.findById(projectId).select("agencyId").lean();
    const contractorId = ctxId(context.contractors, p.contractor);
    const assignment = await ContractorAssignment.findOne({ projectId, contractorId }).sort({ startDate: -1 }).select("_id").lean();
    const live = !["REJECTED", "CANCELLED", "REVERSED"].includes(p.status);
    const decided = p.status !== "PENDING";
    await ProjectPayment.findOneAndUpdate({ paymentNo: p.no }, {
      $set: {
        projectId, agencyId: project!.agencyId, contractorId, ...(assignment ? { assignmentId: assignment._id } : {}), amount: lkr(p.amount), paymentType: p.type, status: p.status,
        invoiceReference: p.invoice, description: "Synthetic payment record", date: d(`${p.date}T00:00:00.000Z`), requestedAt: d(`${p.date}T00:00:00.000Z`), createdBy: pm, dupActive: live,
        ...(decided ? { decidedAt: d(`${p.date}T12:00:00.000Z`) } : {}), ...(["APPROVED", "PAID", "REVERSED"].includes(p.status) ? { approvedBy: finance } : {}),
        ...(p.status === "REJECTED" ? { decisionNote: p.note } : {}), ...(p.status === "CANCELLED" ? { cancelledAt: d(`${p.date}T18:00:00.000Z`), cancelReason: p.note } : {}),
        ...(p.paidAt ? { paidAt: d(`${p.paidAt}T00:00:00.000Z`), paidBy: finance, paymentReference: p.ref } : {}),
        ...(p.status === "REVERSED" ? { reversal: { by: finance, at: d("2025-12-20T00:00:00.000Z"), reason: p.note } } : {}),
      },
      $setOnInsert: { paymentNo: p.no },
    }, { upsert: true });
  }

  for (const e of EXPENSES) {
    const projectId = projects.get(e.project)!;
    const project = await Project.findById(projectId).select("agencyId").lean();
    const active = e.status === "PENDING_VERIFICATION" || e.status === "VERIFIED";
    await ProjectExpense.findOneAndUpdate({ expenseNo: e.no }, {
      $set: {
        projectId, agencyId: project!.agencyId, category: e.category, description: e.description, expenseDate: d(`${e.date}T00:00:00.000Z`), amount: lkr(e.amount), supplierName: e.supplier, supportingRef: e.ref,
        status: e.status, duplicateKey: duplicateKeyOf(String(projectId), e.supplier, e.ref, e.amount), dupActive: active, createdBy: pm,
        ...(e.status !== "DRAFT" ? { submittedAt: d(`${e.date}T06:00:00.000Z`) } : {}), ...(e.status === "VERIFIED" || e.status === "REVERSED" ? { verifiedBy: finance, verifiedAt: d(`${e.date}T12:00:00.000Z`) } : {}),
        ...(e.status === "REJECTED" ? { rejectionReason: e.reason } : {}), ...(e.status === "REVERSED" ? { reversal: { by: finance, at: d("2026-03-01T00:00:00.000Z"), reason: e.reason } } : {}),
      },
      $setOnInsert: { expenseNo: e.no },
    }, { upsert: true });
  }

  // The financialProgress cache follows the paid rows (same integer maths as the service), so the demo never shows a stale ratio.
  for (const [, projectId] of projects) {
    const p = await Project.findById(projectId).select("budget").lean();
    const paid = (await ProjectPayment.aggregate<{ s: number }>([{ $match: { projectId, status: "PAID" } }, { $group: { _id: null, s: { $sum: "$amount.amountMinor" } } }]))[0]?.s ?? 0;
    const bp = p && p.budget.amountMinor > 0 ? Number((BigInt(paid) * 10000n) / BigInt(p.budget.amountMinor)) : 0;
    await Project.updateOne({ _id: projectId }, { $set: { financialProgress: Math.min(100, bp / 100) } }, { timestamps: false });
  }
  return { revisions: REVISIONS.length, payments: PAYMENTS.length, expenses: EXPENSES.length };
}
