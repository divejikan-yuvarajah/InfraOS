import { Contractor } from "./models/contractor.model.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";
import { Project } from "../projects/models/project.model.js";
import { emailKeyOf, nameKeyOf, taxIdKeyOf } from "./contractor.keys.js";

export type BackfillReport = {
  mode: "dry-run" | "commit";
  contractorsScanned: number; keysToSet: number; ownersToSet: number; ownerUnresolved: number;
  assignmentsToCreate: number; assignmentsCreated: number; contractorsUpdated: number;
};

const CLOSED = new Set(["COMPLETED", "CANCELLED"]);

/**
 * Idempotent. Sets duplicate keys and the registering agency (the agency of the earliest project that references the contractor, otherwise it is
 * left unset = platform-registered) and creates one PRIMARY assignment per project that already has contractorId but no assignment row.
 * Never invents contract references, values or dates.
 */
export async function backfillContractors(commit: boolean): Promise<BackfillReport> {
  const report: BackfillReport = { mode: commit ? "commit" : "dry-run", contractorsScanned: 0, keysToSet: 0, ownersToSet: 0, ownerUnresolved: 0, assignmentsToCreate: 0, assignmentsCreated: 0, contractorsUpdated: 0 };

  for await (const c of Contractor.find({}).cursor()) {
    report.contractorsScanned += 1;
    const set: Record<string, unknown> = {};
    const nameKey = nameKeyOf(c.name);
    if (nameKey && c.nameKey !== nameKey) set.nameKey = nameKey;
    const taxKey = taxIdKeyOf(c.business?.taxId);
    if (taxKey && c.taxIdKey !== taxKey) set.taxIdKey = taxKey;
    const emailKey = emailKeyOf(c.contact?.email);
    if (emailKey && c.emailKey !== emailKey) set.emailKey = emailKey;
    if (Object.keys(set).length) report.keysToSet += 1;
    if (!c.registeredByAgencyId) {
      const first = await Project.findOne({ contractorId: c._id }).sort({ createdAt: 1 }).select("agencyId").lean();
      if (first?.agencyId) { set.registeredByAgencyId = first.agencyId; report.ownersToSet += 1; } else report.ownerUnresolved += 1;
    }
    if (commit && Object.keys(set).length) { await Contractor.updateOne({ _id: c._id }, { $set: set }); report.contractorsUpdated += 1; }
  }

  for await (const p of Project.find({ contractorId: { $exists: true, $ne: null } }).cursor()) {
    if (await ContractorAssignment.exists({ projectId: p._id, contractorId: p.contractorId })) continue;
    report.assignmentsToCreate += 1;
    if (!commit) continue;
    const closed = CLOSED.has(p.status);
    await ContractorAssignment.create({
      projectId: p._id, contractorId: p.contractorId, agencyId: p.agencyId, role: "PRIMARY",
      status: closed ? "ENDED" : "ACTIVE",
      startDate: p.startDate ?? (p as unknown as { createdAt: Date }).createdAt,
      ...(closed ? { endDate: p.actualEndDate ?? (p as unknown as { updatedAt: Date }).updatedAt, endReason: `Project ${p.status.toLowerCase()} before the assignment register existed (backfilled).` } : {}),
      assignedBy: p.createdBy,
    });
    report.assignmentsCreated += 1;
  }
  return report;
}
