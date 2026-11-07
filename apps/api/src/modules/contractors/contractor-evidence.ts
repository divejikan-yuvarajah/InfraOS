import type mongoose from "mongoose";

import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { ProgressReport } from "../projects/models/progress-report.model.js";
import { Project } from "../projects/models/project.model.js";
import { certState, profileGaps, tierOf, type ContractorLike } from "./contractor.access.js";
import type { Ctx } from "./contractor.context.js";
import type { AssignmentEv, ClaimEv, Evidence, InspectionEv, MilestoneEv } from "./contractor-performance.rules.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";

/**
 * THE evidence adapter: the one place that turns stored records into the plain rows the pure rules consume.
 * Extension points (do not touch the rules file for these):
 *   Batch 05 (finance): add payments by assignment id, overspend and payment-delay rows to Evidence.
 *   Batch 06 (inspections): replace the coarse `inspection.v1` rows with result, defect and rework rows, and verified progress.
 *   Batch 07 (assets): add handover and maintenance-quality rows.
 * Everything here is limited to projects the viewer can read, and to the window each assignment was active.
 */
export const EVIDENCE_SOURCES = { inspections: "inspection.v1" } as const;

type Id = mongoose.Types.ObjectId;
export type ContractorDoc = ContractorLike & { _id: Id; status: string };
export type EvidenceMeta = { projects: number; milestones: number; assignments: number; inspections: number; truncated: boolean };

const MAX_ASSIGNMENTS_PER_CONTRACTOR = 500;
const MAX_ROWS = 20_000;

export async function loadEvidenceMany(ctx: Ctx, docs: ContractorDoc[], now: Date): Promise<Map<string, { evidence: Evidence; meta: EvidenceMeta }>> {
  const out = new Map<string, { evidence: Evidence; meta: EvidenceMeta }>();
  if (!docs.length) return out;
  const scope = ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {};
  const raw = await ContractorAssignment.find({ contractorId: { $in: docs.map((d) => d._id) }, ...scope }).sort({ startDate: -1 }).limit(MAX_ASSIGNMENTS_PER_CONTRACTOR * docs.length).maxTimeMS(8000).lean();
  const projects = await Project.find({ $and: [projectReadFilter(ctx.scope), { _id: { $in: [...new Set(raw.map((r) => String(r.projectId)))] } }] })
    .select("projectCode title status plannedEndDate actualEndDate").maxTimeMS(8000).lean();
  const byProject = new Map(projects.map((p) => [String(p._id), p]));
  const rows = raw.filter((r) => byProject.has(String(r.projectId)));
  const projectIds = [...byProject.keys()];
  const [milestones, inspections, claims] = await Promise.all([
    Milestone.find({ projectId: { $in: projectIds }, status: "COMPLETED" }).select("projectId title status plannedEnd actualEnd").limit(MAX_ROWS).maxTimeMS(8000).lean(),
    Inspection.find({ projectId: { $in: projectIds } }).select("projectId status inspectionDate physicalProgress").limit(MAX_ROWS).maxTimeMS(8000).lean(),
    ProgressReport.find({ projectId: { $in: projectIds } }).select("projectId reportedPercent reportedAt").sort({ reportedAt: -1 }).limit(MAX_ROWS).maxTimeMS(8000).lean(),
  ]);

  for (const doc of docs) {
    const mine = rows.filter((r) => String(r.contractorId) === String(doc._id));
    const asg: AssignmentEv[] = mine.map((r) => {
      const p = byProject.get(String(r.projectId))!;
      return { id: String(r._id), projectId: String(r.projectId), role: r.role, status: r.status, startDate: r.startDate, endDate: r.endDate ?? null, contractReference: r.contractReference ?? null, hasContractValue: Boolean(r.contractValue), projectCode: p.projectCode, projectTitle: p.title, projectStatus: p.status, plannedEndDate: p.plannedEndDate ?? null, actualEndDate: p.actualEndDate ?? null };
    });
    const inWindow = (projectId: unknown, at: Date) => mine.some((r) => String(r.projectId) === String(projectId) && at >= r.startDate && (!r.endDate || at <= r.endDate));
    const ms: MilestoneEv[] = milestones.filter((m) => m.actualEnd && inWindow(m.projectId, m.actualEnd)).map((m) => ({ id: String(m._id), projectId: String(m.projectId), title: m.title, status: m.status, plannedEnd: m.plannedEnd, actualEnd: m.actualEnd ?? null }));
    const ins: InspectionEv[] = inspections.filter((i) => inWindow(i.projectId, i.inspectionDate)).map((i) => ({ id: String(i._id), projectId: String(i.projectId), status: i.status, inspectionDate: i.inspectionDate, physicalProgress: i.physicalProgress ?? null }));
    const cl: ClaimEv[] = claims.filter((c) => inWindow(c.projectId, c.reportedAt)).map((c) => ({ id: String(c._id), projectId: String(c.projectId), claimed: c.reportedPercent, at: c.reportedAt }));
    // Profile gaps are manage-tier detail: a viewer who only sees the directory tier gets none, so the flag cannot reveal what is missing.
    const manage = tierOf(ctx.viewer, doc, true) === "manage";
    out.set(String(doc._id), {
      evidence: {
        contractorStatus: doc.status, assignments: asg, milestones: ms, inspections: ins, claims: cl,
        certifications: manage ? (doc.certifications ?? []).map((c) => ({ id: String(c._id), name: c.name, state: certState(c, now), expiresOn: c.expiresOn ? new Date(c.expiresOn) : null })) : [],
        profileGaps: manage ? profileGaps(doc) : [],
      },
      meta: { projects: new Set(asg.map((a) => a.projectId)).size, milestones: ms.length, assignments: asg.length, inspections: ins.length, truncated: raw.length >= MAX_ASSIGNMENTS_PER_CONTRACTOR * docs.length },
    });
  }
  return out;
}
