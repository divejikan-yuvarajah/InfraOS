import type mongoose from "mongoose";
import type { ClientSession } from "mongoose";

import { Inspection } from "../inspections/models/inspection.model.js";
import { ProgressReport } from "../projects/models/progress-report.model.js";
import { Project } from "../projects/models/project.model.js";
import { pctToBp } from "./finance.money.js";
import type { ProgressBasis } from "./payment.gates.js";

/**
 * THE seam between finance and physical progress. Batch 06 replaces the first branch with real verification records; everything downstream keeps
 * working as long as the contract holds:
 *   valueBp  progress in basis points of a percent (0..10000), or null
 *   basis    VERIFIED_INSPECTION only when a verifier confirmed the figure; REPORTED_UNVERIFIED for contractor/manager claims; NONE otherwise
 *   asOf     when the figure applies; sourceRef  id of the record it came from (inspection or project)
 * Reported progress must never be presented as verified.
 */
export type ProgressSource = { valueBp: number | null; basis: ProgressBasis; asOf: Date | null; sourceRef: string | null };
const NONE: ProgressSource = { valueBp: null, basis: "NONE", asOf: null, sourceRef: null };

type Id = mongoose.Types.ObjectId;

export async function physicalProgressMany(projectIds: Id[], session?: ClientSession): Promise<Map<string, ProgressSource>> {
  const out = new Map<string, ProgressSource>(projectIds.map((id) => [String(id), NONE]));
  if (!projectIds.length) return out;
  const q = Inspection.find({ projectId: { $in: projectIds }, status: "VERIFIED", physicalProgress: { $ne: null } }).select("projectId physicalProgress inspectionDate").sort({ inspectionDate: -1 }).lean();
  if (session) q.session(session);
  const verified = await q;
  const seen = new Set<string>();
  for (const v of verified) {
    const key = String(v.projectId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.set(key, { valueBp: pctToBp(v.physicalProgress as number), basis: "VERIFIED_INSPECTION", asOf: v.inspectionDate, sourceRef: String(v._id) });
  }
  const rest = projectIds.filter((id) => !seen.has(String(id)));
  if (rest.length) {
    const reported = await ProgressReport.aggregate<{ _id: Id; at: Date }>([{ $match: { projectId: { $in: rest } } }, { $group: { _id: "$projectId", at: { $max: "$reportedAt" } } }]).session(session ?? null);
    const hasReport = new Map(reported.map((r) => [String(r._id), r.at]));
    const q2 = Project.find({ _id: { $in: rest } }).select("physicalProgress").lean();
    if (session) q2.session(session);
    for (const p of await q2) {
      const at = hasReport.get(String(p._id));
      if (at && typeof p.physicalProgress === "number") out.set(String(p._id), { valueBp: pctToBp(p.physicalProgress), basis: "REPORTED_UNVERIFIED", asOf: at, sourceRef: String(p._id) });
    }
  }
  return out;
}

export async function physicalProgressOf(projectId: Id, session?: ClientSession): Promise<ProgressSource> {
  return (await physicalProgressMany([projectId], session)).get(String(projectId)) ?? NONE;
}
