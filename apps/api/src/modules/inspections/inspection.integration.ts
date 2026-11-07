import type mongoose from "mongoose";
import type { ClientSession } from "mongoose";

import { Inspection } from "./models/inspection.model.js";

type Id = mongoose.Types.ObjectId;

/**
 * Finance seam (payment gate INSPECTION_HOLD). Returns null when the project has no concluded inspection at all.
 * rejected: the latest concluded (VERIFIED or REJECTED) inspection was rejected.
 * openCritical: the latest approved inspection report records a CRITICAL defect (a later approved report without it clears the hold).
 */
export async function inspectionHoldFor(projectId: Id, session?: ClientSession): Promise<{ rejected: boolean; openCritical: boolean } | null> {
  const q = Inspection.find({ projectId, status: { $in: ["VERIFIED", "REJECTED"] } }).select("status completedAt inspectionDate inspectionType submissions").sort({ completedAt: -1, inspectionDate: -1 }).limit(20);
  if (session) q.session(session);
  const rows = await q.lean();
  if (!rows.length) return null;
  const rejected = rows[0]!.status === "REJECTED";
  const latest = rows.find((r) => r.status === "VERIFIED");
  const snapshot = latest?.submissions?.[latest.submissions.length - 1]?.reportSnapshot;
  // A later approved follow-up inspection that no longer records the defect is itself the latest report, so it clears the hold.
  return { rejected, openCritical: (snapshot?.defects ?? []).some((d) => d.severity === "CRITICAL") };
}

/* ---------------- contractor profile: inspection outcomes ---------------- */

import { canSee } from "../contractors/contractor.access.js";
import { assignedInScope, contextOf, need, notFound, run, type Result } from "../contractors/contractor.context.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { Project } from "../projects/models/project.model.js";
import { ProgressVerification } from "./models/progress-verification.model.js";

/** Structured inspections that named this contractor on site, limited to projects the viewer can read. Counts and links only: no report text, photos or contact data. */
export function contractorInspectionOutcomes(actor: AuthenticatedActor, rawId: string) {
  return run(async (): Promise<Result<unknown>> => {
    if (!/^[a-f0-9]{24}$/i.test(rawId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.performance.read");
    need(ctx, "contractor.read");
    const doc = await Contractor.findById(rawId).lean();
    if (!doc || !canSee(ctx.viewer, doc as never, await assignedInScope(ctx, doc._id))) return notFound();
    const projects = await Project.find({ $and: [projectReadFilter(ctx.scope)] }).select("_id").limit(5000).lean();
    const readable = new Map<string, { projectCode: string; title: string }>();
    const rows = await Inspection.find({ contractorIdsAtInspection: doc._id, projectId: { $in: projects.map((p) => p._id) }, status: { $in: ["VERIFIED", "REJECTED", "REQUIRES_REVIEW", "SUBMITTED"] } })
      .select("inspectionNo projectId status inspectionDate inspectionType submissions.decision.decision submissions.reportSnapshot.defects").sort({ inspectionDate: -1 }).limit(100).maxTimeMS(8000).lean();
    for (const p of await Project.find({ _id: { $in: [...new Set(rows.map((r) => r.projectId))] } }).select("projectCode title").lean()) readable.set(String(p._id), { projectCode: p.projectCode, title: p.title });
    const verifications = await ProgressVerification.find({ contractorIds: doc._id, projectId: { $in: projects.map((p) => p._id) } }).select("projectId verifiedPercent claimedPercent discrepancyPp asOf status inspectionId").sort({ asOf: -1 }).limit(50).lean();
    return {
      ok: true,
      data: {
        contractorId: String(doc._id),
        inspections: rows.map((r) => {
          const last = r.submissions?.[r.submissions.length - 1];
          const defects = last?.reportSnapshot?.defects ?? [];
          return {
            id: String(r._id), inspectionNo: r.inspectionNo ?? null, projectId: String(r.projectId), projectCode: readable.get(String(r.projectId))?.projectCode ?? null, status: r.status, inspectionDate: r.inspectionDate.toISOString(), inspectionType: r.inspectionType ?? "PROGRESS_VERIFICATION",
            revisionCycles: (r.submissions ?? []).filter((s) => s.decision?.decision === "REVISION_REQUESTED").length,
            defects: { minor: defects.filter((d) => d.severity === "MINOR").length, major: defects.filter((d) => d.severity === "MAJOR").length, critical: defects.filter((d) => d.severity === "CRITICAL").length, rework: defects.filter((d) => (d as { reworkRequired?: boolean }).reworkRequired).length },
          };
        }),
        verifications: verifications.map((v) => ({ inspectionId: String(v.inspectionId), projectId: String(v.projectId), verifiedPercent: v.verifiedPercent, claimedPercent: v.claimedPercent ?? null, discrepancyPp: v.discrepancyPp ?? null, asOf: v.asOf.toISOString(), status: v.status })),
        basedOn: "projects you can access",
      },
    };
  });
}
