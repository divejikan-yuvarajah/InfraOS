import type mongoose from "mongoose";

import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import type { DemoProjectCode } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

type Seed = {
  project: DemoProjectCode; contractor: string; role: "PRIMARY" | "ADDITIONAL"; status: "ACTIVE" | "ENDED" | "REPLACED" | "TERMINATED";
  start: Date; end?: Date; endReason?: string; contractReference?: string; contractValueMinor?: number; replacedBy?: string;
};

/**
 * Demo assignments: an ACTIVE PRIMARY, an ENDED one (completed bridge), an ADDITIONAL, and a REPLACED chain (Alpha replaced by Gamma on drainage).
 * Only the road contract carries a reference and value, so the other active assignments honestly show incomplete contract data.
 * No inspections or milestones are invented for them: low-evidence contractors show "Not enough evidence", which is the intended demo.
 */
const SEEDS: Seed[] = [
  { project: "INF-ROAD-001", contractor: "SYNTH/ALPHA-001", role: "PRIMARY", status: "ACTIVE", start: d("2026-01-01T00:00:00.000Z"), contractReference: "DEMO-CT-ROAD-001", contractValueMinor: 800_000_000_00 },
  { project: "INF-WATER-001", contractor: "SYNTH/BETA-001", role: "PRIMARY", status: "ACTIVE", start: d("2026-02-15T00:00:00.000Z") },
  { project: "INF-PFAC-001", contractor: "SYNTH/BETA-001", role: "PRIMARY", status: "ACTIVE", start: d("2025-06-01T00:00:00.000Z") },
  { project: "INF-PFAC-001", contractor: "SYNTH/GAMMA-001", role: "ADDITIONAL", status: "ACTIVE", start: d("2025-09-01T00:00:00.000Z") },
  { project: "INF-BRIDGE-001", contractor: "SYNTH/ALPHA-001", role: "PRIMARY", status: "ENDED", start: d("2024-01-01T00:00:00.000Z"), end: d("2025-12-15T00:00:00.000Z"), endReason: "Works completed and handed over (synthetic)." },
  { project: "INF-DRAINAGE-001", contractor: "SYNTH/ALPHA-001", role: "PRIMARY", status: "REPLACED", start: d("2026-02-15T00:00:00.000Z"), end: d("2026-03-15T00:00:00.000Z"), endReason: "Replaced after a change of delivery plan (synthetic).", replacedBy: "SYNTH/GAMMA-001" },
  { project: "INF-DRAINAGE-001", contractor: "SYNTH/GAMMA-001", role: "PRIMARY", status: "ACTIVE", start: d("2026-03-15T00:00:00.000Z") },
];

export async function seedDemoAssignments(context: DemoContext): Promise<number> {
  const manager = ctxId(context.users as unknown as Map<string, mongoose.Types.ObjectId>, "PROJECT_MANAGER");
  const ids = new Map<string, mongoose.Types.ObjectId>();
  for (const s of SEEDS) {
    const projectId = ctxId(context.projects as unknown as Map<string, mongoose.Types.ObjectId>, s.project);
    const project = await Project.findById(projectId).select("agencyId");
    const contractorId = ctxId(context.contractors, s.contractor);
    const doc = await ContractorAssignment.findOneAndUpdate(
      { projectId, contractorId, startDate: s.start },
      {
        $set: {
          agencyId: project!.agencyId, role: s.role, status: s.status, assignedBy: manager,
          ...(s.end ? { endDate: s.end, endedBy: manager } : {}), ...(s.endReason ? { endReason: s.endReason } : {}),
          ...(s.contractReference ? { contractReference: s.contractReference } : {}),
          ...(s.contractValueMinor ? { contractValue: { amountMinor: s.contractValueMinor, currency: "LKR" } } : {}),
        },
        $setOnInsert: { projectId, contractorId, startDate: s.start },
      },
      { upsert: true, new: true },
    );
    ids.set(`${s.project}|${s.contractor}|${s.role}`, doc._id);
  }
  // Link the replaced assignment to its successor (same project, same role).
  for (const s of SEEDS.filter((x) => x.replacedBy)) {
    const from = ids.get(`${s.project}|${s.contractor}|${s.role}`);
    const to = ids.get(`${s.project}|${s.replacedBy}|${s.role}`);
    if (from && to) await ContractorAssignment.updateOne({ _id: from }, { $set: { replacedByAssignmentId: to } });
  }
  return SEEDS.length;
}
