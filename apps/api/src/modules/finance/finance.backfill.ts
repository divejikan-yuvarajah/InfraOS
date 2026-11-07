import { nextNumber } from "../../shared/database/counter.js";
import { Project } from "../projects/models/project.model.js";
import { ProjectBudgetRevision } from "./models/project-budget-revision.model.js";
import { ProjectPayment } from "./models/project-payment.model.js";

export type FinanceBackfillReport = {
  mode: "dry-run" | "commit";
  projectsScanned: number; initialRevisionsToCreate: number; initialRevisionsCreated: number;
  paymentsScanned: number; paymentsToUpdate: number; paymentsUpdated: number;
};

/**
 * Idempotent. Creates the INITIAL APPROVED budget revision (sequence 1, no allocations, decided by the system) for every project that has a
 * budget but no revision, and gives legacy payments a paymentNo, agencyId and requestedAt (createdAt). Legacy PAID rows get paidAt = their
 * existing date. Never invents amounts, invoice references or payment references: those stay empty and are shown as "not recorded".
 */
export async function backfillFinance(commit: boolean): Promise<FinanceBackfillReport> {
  const r: FinanceBackfillReport = { mode: commit ? "commit" : "dry-run", projectsScanned: 0, initialRevisionsToCreate: 0, initialRevisionsCreated: 0, paymentsScanned: 0, paymentsToUpdate: 0, paymentsUpdated: 0 };

  for await (const p of Project.find({ "budget.amountMinor": { $gt: 0 } }).cursor()) {
    r.projectsScanned += 1;
    if (await ProjectBudgetRevision.exists({ projectId: p._id })) continue;
    r.initialRevisionsToCreate += 1;
    if (!commit) continue;
    const at = (p as unknown as { createdAt: Date }).createdAt;
    await ProjectBudgetRevision.create({
      projectId: p._id, agencyId: p.agencyId, sequence: 1, kind: "INITIAL", status: "APPROVED",
      previousTotal: { amountMinor: 0, currency: "LKR" }, newTotal: { amountMinor: p.budget.amountMinor, currency: "LKR" }, allocations: [],
      requestedBy: p.createdBy, requestedAt: at, decidedAt: at, decisionNote: "Backfilled from project budget",
    });
    r.initialRevisionsCreated += 1;
  }

  for await (const pay of ProjectPayment.find({ paymentNo: { $exists: false } }).sort({ createdAt: 1 }).cursor()) {
    r.paymentsScanned += 1;
    r.paymentsToUpdate += 1;
    if (!commit) continue;
    const project = await Project.findById(pay.projectId).select("agencyId").lean();
    const created = (pay as unknown as { createdAt: Date }).createdAt;
    await ProjectPayment.updateOne({ _id: pay._id }, {
      $set: { paymentNo: await nextNumber("PAY", created), requestedAt: created, ...(project?.agencyId ? { agencyId: project.agencyId } : {}), ...(pay.status === "PAID" ? { paidAt: pay.date } : {}) },
    });
    r.paymentsUpdated += 1;
  }
  return r;
}
