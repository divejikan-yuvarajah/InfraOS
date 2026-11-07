import type { z } from "zod";

import { contextOf, Flow, need, run, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { ProgressReport } from "../projects/models/progress-report.model.js";
import { Project } from "../projects/models/project.model.js";
import { PROJECT_STATUSES_FOR_VERIFICATION, type InspectionType } from "./inspection.constants.js";
import { inTransaction, loadInspection, notifyInspection, oid, writeInspectionAudit, type Id } from "./inspection.common.js";
import { canTransition, discrepancyPp, isProgressType, makerCheckerOk, overThreshold, rejectAllowed } from "./inspection.rules.js";
import type { decisionBody } from "./inspection.schema.js";
import { Asset } from "../assets/models/asset.model.js";
import { AssetConditionAssessment } from "../assets/models/asset-condition-assessment.model.js";
import { notifyAssessment, recordAssessment, type RecordedAssessment } from "../assets/asset-assessment.js";
import { writeAssetAudit, type AssetRow } from "../assets/asset.common.js";
import { Inspection } from "./models/inspection.model.js";
import { ProgressVerification } from "./models/progress-verification.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const decisionHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

type Hold = { verificationId: Id | null; bigGap: boolean; verified: number | null; assessment?: { asset: AssetRow; rec: RecordedAssessment } };

/** Approve / request revision / reject. One transaction: scope, grant and maker-checker are re-checked inside it; the status+version filter makes exactly one concurrent decider win. */
export const decideInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof decisionBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    const may = input.decision === "APPROVE" ? ctx.has("inspection.verify") : input.decision === "REJECT" ? ctx.has("inspection.reject") : ctx.has("inspection.verify") || ctx.has("inspection.reject");
    if (!may) throw new Flow(403, "FORBIDDEN");
    need(ctx, "inspection.read");
    const row = await loadInspection(ctx, actor, rawId, session, "read");
    const submissions = row.submissions ?? [];
    const last = submissions[submissions.length - 1];
    const action = input.decision === "APPROVE" ? "APPROVE" : input.decision === "REJECT" ? "REJECT" : "REQUEST_REVISION";
    if (!canTransition(action, row.status) || (action === "REJECT" && !rejectAllowed(row.status, submissions.length))) throw new Flow(409, "CONFLICT", { current: row.status });
    if (!last) throw new Flow(409, "CONFLICT", { current: row.status });
    if (row.status === "SUBMITTED" && !makerCheckerOk(actor.userId, String(last.submittedBy), String(row.inspectorId))) throw new Flow(403, "FORBIDDEN", { reason: "own_submission" });
    if (input.decision !== "APPROVE" && !input.note) throw new Flow(400, "VALIDATION_ERROR", { field: "note" });
    const type = (row.inspectionType ?? "PROGRESS_VERIFICATION") as InspectionType;
    const decisionValue = input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "REVISION_REQUESTED";
    const decision = { decision: decisionValue, by: oid(actor.userId), at: now, ...(input.note ? { note: input.note } : {}), itemComments: input.itemComments };
    const idx = submissions.length - 1;
    const $set: Record<string, unknown> = { [`submissions.${idx}.decision`]: decision, reviewedBy: oid(actor.userId), reviewedAt: now };
    const hold: Hold = { verificationId: null, bigGap: false, verified: null };

    if (input.decision === "APPROVE") {
      const project = await Project.findById(row.projectId).select("agencyId status managerId").session(session).lean();
      if (!project) throw new Flow(404, "NOT_FOUND");
      $set.status = "VERIFIED"; $set.completedAt = now;
      const measured = last.reportSnapshot?.measuredProgress;
      if (isProgressType(type) && measured !== undefined && measured !== null) {
        if (!(PROJECT_STATUSES_FOR_VERIFICATION as readonly string[]).includes(project.status)) throw new Flow(409, "CONFLICT", { reason: "project_status", current: project.status });
        const claimedRow = await ProgressReport.findOne({ projectId: row.projectId }).sort({ sequence: -1 }).select("reportedPercent").session(session).lean();
        const claimed = claimedRow ? claimedRow.reportedPercent : null;
        const big = overThreshold(measured, claimed);
        if (big && input.acknowledgeDiscrepancy !== true) throw new Flow(400, "VALIDATION_ERROR", { field: "acknowledgeDiscrepancy" });
        const assessed = new Map((last.reportSnapshot?.milestoneAssessments ?? []).map((m) => [String(m.milestoneId), m.verifiedProgress]));
        const milestones = assessed.size ? (await Milestone.find({ _id: { $in: [...assessed.keys()] }, projectId: row.projectId }).select("progress").session(session).lean()).map((m) => ({ milestoneId: m._id, claimedProgress: m.progress, verifiedProgress: assessed.get(String(m._id))! })) : [];
        const current = await ProgressVerification.findOne({ projectId: row.projectId, status: "ACTIVE" }).sort({ asOf: -1, createdAt: -1 }).select("asOf").session(session).lean();
        const becomesActive = !current || row.inspectionDate.getTime() >= current.asOf.getTime();
        const [ver] = await ProgressVerification.create([{
          projectId: row.projectId, agencyId: project.agencyId, inspectionId: row._id, submissionNo: last.no, verifiedPercent: measured, claimedPercent: claimed, discrepancyPp: discrepancyPp(measured, claimed),
          milestones, inspectorId: row.inspectorId, reviewerId: oid(actor.userId), asOf: row.inspectionDate, status: becomesActive ? "ACTIVE" : "SUPERSEDED",
          ...(becomesActive ? {} : { supersededBy: (await ProgressVerification.findOne({ projectId: row.projectId, status: "ACTIVE" }).sort({ asOf: -1 }).select("_id").session(session).lean())?._id }),
          ...(last.reportSnapshot?.discrepancyNote ? { note: last.reportSnapshot.discrepancyNote } : {}), contractorIds: row.contractorIdsAtInspection ?? [],
        }], { session });
        if (becomesActive) {
          await ProgressVerification.updateMany({ projectId: row.projectId, status: "ACTIVE", _id: { $ne: ver!._id } }, { $set: { status: "SUPERSEDED", supersededBy: ver!._id } }, { session });
          // Cache only. Project.physicalProgress (reported) and milestones are never touched.
          await Project.updateOne({ _id: row.projectId }, { $set: { verifiedProgress: { percent: measured, asOf: row.inspectionDate, verificationId: ver!._id } } }, { session, timestamps: false });
        }
        $set.physicalProgress = measured;
        hold.verificationId = ver!._id as Id; hold.bigGap = big; hold.verified = measured;
      } else if (type === "ASSET_CONDITION") {
        // The reviewer's approval is what makes the rating a recorded condition. No progress verification is created for this type.
        const rating = last.reportSnapshot?.conditionRating;
        const asset = row.assetId ? ((await Asset.findById(row.assetId).session(session).lean()) as AssetRow | null) : null;
        if (!rating || !asset) throw new Flow(409, "CONFLICT", { reason: "asset_condition_incomplete" });
        const prev = await AssetConditionAssessment.findOne({ assetId: asset._id, status: "ACTIVE" }).sort({ assessedAt: -1, createdAt: -1 }).session(session).lean();
        const reported = (last.reportSnapshot?.defects ?? []).map((d) => ({ key: d.key, title: d.title, severity: d.severity, status: "OPEN" as const, ...(d.location ? { location: d.location } : {}) }));
        // Open issues from the previous assessment that this report does not mention stay OPEN (never silently resolved).
        const carried = (prev?.issues ?? []).filter((i) => i.status === "OPEN" && !reported.some((r) => r.key === i.key)).map((i) => ({ key: i.key, title: i.title, severity: i.severity, status: "OPEN" as const, ...(i.location ? { location: i.location } : {}) }));
        const rec = await recordAssessment(session, { asset, condition: rating, basis: "INSPECTION_VERIFIED", assessedAt: row.inspectionDate.getTime() > now.getTime() ? now : row.inspectionDate, observations: last.reportSnapshot?.siteObservations ?? undefined, issues: [...reported, ...carried].slice(0, 20), inspectionId: row._id, assessedBy: row.inspectorId as Id, reviewedBy: oid(actor.userId) });
        await writeAssetAudit(session, { actor, action: "asset.assessment_recorded", resourceType: "ASSET", resourceId: asset._id, agencyId: asset.agencyId, oldValue: { status: asset.condition }, newValue: { status: rating }, requestId });
        hold.assessment = { asset, rec };
      }
    } else if (input.decision === "REJECT") { $set.status = "REJECTED"; $set.completedAt = now; }
    else $set.status = "REQUIRES_REVIEW";

    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: row.status, version: row.version ?? 0, [`submissions.${idx}.decision`]: { $exists: false } }, { $set, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "already_decided" });
    await decisionHooks.beforeAudit();
    const action2 = input.decision === "APPROVE" ? "inspection.approved" : input.decision === "REJECT" ? "inspection.rejected" : "inspection.revision_requested";
    await writeInspectionAudit(session, { actor, action: action2, inspectionId: row._id, agencyId: row.agencyId, oldValue: { status: row.status }, newValue: { status: String($set.status), ...(typeof $set.physicalProgress === "number" ? { physicalProgress: $set.physicalProgress } : {}), ...(input.note ? { reason: input.note } : {}) }, requestId });
    const project = await Project.findById(row.projectId).select("managerId").session(session).lean();
    return { id: row._id as Id, no: row.inspectionNo ?? String(row._id), inspector: row.inspectorId as Id, manager: (project?.managerId ?? null) as Id | null, agencyId: row.agencyId as Id | undefined, status: String($set.status), hold };
  });

  const label = out.status === "VERIFIED" ? "approved" : out.status === "REJECTED" ? "rejected" : "returned for revision";
  await notifyInspection([out.inspector, ...(out.manager ? [out.manager] : [])], { title: `Inspection ${label}`, message: `${out.no} was ${label}.`, inspectionId: out.id, eventKey: `ins-decision:${out.id}:${now.getTime()}` });
  if (out.hold.assessment) await notifyAssessment(out.hold.assessment.asset, out.hold.assessment.rec, [actor.userId]);
  if (out.hold.bigGap && out.agencyId) {
    const govRole = await Role.findOne({ key: "GOV_ADMIN", isActive: true }).select("_id").lean();
    const gov = govRole ? (await User.find({ roleId: govRole._id, agencyId: out.agencyId, status: "ACTIVE", emailVerified: true }).select("_id").limit(20).lean()).map((u) => u._id as Id) : [];
    await notifyInspection([...(out.manager ? [out.manager] : []), ...gov], { title: "Large progress discrepancy", message: `${out.no}: verified progress differs from reported progress by more than 10 points.`, inspectionId: out.id, eventKey: `ins-gap:${out.id}` });
  }
  return ok({ status: out.status, verificationId: out.hold.verificationId ? String(out.hold.verificationId) : null, verifiedPercent: out.hold.verified });
});

