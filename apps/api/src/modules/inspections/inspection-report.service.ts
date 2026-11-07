import type { z } from "zod";

import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { contextOf, Flow, need, run, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { ProgressReport } from "../projects/models/progress-report.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { checklistFor } from "./inspection-checklists.js";
import { CHECKLIST_VERSION, MAX_SUBMISSIONS, type InspectionType } from "./inspection.constants.js";
import { holdersOf, inTransaction, loadInspection, notifyInspection, oid, writeInspectionAudit, type Id } from "./inspection.common.js";
import { canTransition, startWindowOpen, submitGaps } from "./inspection.rules.js";
import type { reportBody, submitBody } from "./inspection.schema.js";
import { InspectionEvidence } from "./models/inspection-evidence.model.js";
import { Inspection } from "./models/inspection.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const typeOf = (row: { inspectionType?: string | null }): InspectionType => (row.inspectionType ?? "PROGRESS_VERIFICATION") as InspectionType;

export const startInspection = (actor: AuthenticatedActor, rawId: string, requestId: string) => run(async () => {
  const now = new Date();
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.submit");
    const row = await loadInspection(ctx, actor, rawId, session, "inspector");
    if (!canTransition("START", row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
    if (!startWindowOpen(row.inspectionDate, now)) throw new Flow(409, "CONFLICT", { reason: "start_window" });
    const checklist = checklistFor(typeOf(row)).map((i) => ({ key: i.key, result: "NOT_CHECKED" as const }));
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: "SCHEDULED", inspectorId: oid(actor.userId), version: row.version ?? 0 }, {
      $set: { status: "IN_PROGRESS", startedAt: now, report: { revision: 0, checklistVersion: CHECKLIST_VERSION, checklist, defects: [], followUpChecks: [], milestoneAssessments: [], followUpRequired: false, inspectorDeclaration: false } },
      $inc: { version: 1 },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.started", inspectionId: row._id, agencyId: row.agencyId, oldValue: { status: "SCHEDULED" }, newValue: { status: "IN_PROGRESS" }, requestId });
  });
  return ok({ started: true });
});

/** Autosave. Optimistic by `revision`; no audit row per save (audit is written on submit and decisions). */
export const saveReport = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof reportBody>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.submit");
  const row = await loadInspection(ctx, actor, rawId, undefined, "inspector");
  if (!canTransition("SAVE_DRAFT", row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
  const keys = new Set(checklistFor(typeOf(row)).map((i) => i.key));
  if (input.checklist.some((c) => !keys.has(c.key)) || new Set(input.checklist.map((c) => c.key)).size !== input.checklist.length) throw new Flow(400, "VALIDATION_ERROR", { field: "checklist" });
  if (new Set(input.defects.map((d) => d.key)).size !== input.defects.length) throw new Flow(400, "VALIDATION_ERROR", { field: "defects" });
  if (input.milestoneAssessments.length) {
    const ids = input.milestoneAssessments.map((m) => m.milestoneId);
    if (new Set(ids).size !== ids.length || (await Milestone.countDocuments({ _id: { $in: ids }, projectId: row.projectId })) !== ids.length) throw new Flow(400, "VALIDATION_ERROR", { field: "milestoneAssessments" });
  }
  const { revision, measuredProgress, ...rest } = input;
  const report = { ...rest, ...(measuredProgress !== null && measuredProgress !== undefined ? { measuredProgress } : {}), revision: revision + 1, checklistVersion: CHECKLIST_VERSION };
  const res = await Inspection.findOneAndUpdate(
    { _id: row._id, inspectorId: oid(actor.userId), status: { $in: ["IN_PROGRESS", "REQUIRES_REVIEW"] }, "report.revision": revision },
    { $set: { report } }, { new: true, timestamps: false },
  ).select("report.revision").lean();
  if (!res) {
    const current = await Inspection.findById(row._id).select("report.revision status").lean();
    throw new Flow(409, "CONFLICT", { current: "stale_revision", revision: current?.report?.revision ?? null, status: current?.status ?? null });
  }
  return ok({ revision: res.report?.revision ?? revision + 1, savedAt: new Date().toISOString() });
});

export const submitInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof submitBody>, requestId: string) => run(async () => {
  const now = new Date();
  const notice = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.submit");
    const row = await loadInspection(ctx, actor, rawId, session, "inspector");
    if (!canTransition("SUBMIT", row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
    if ((row.submissions?.length ?? 0) >= MAX_SUBMISSIONS) throw new Flow(409, "CONFLICT", { reason: "submission_cap" });
    const report = row.report;
    if (!report || report.revision !== input.revision) throw new Flow(409, "CONFLICT", { current: "stale_revision", revision: report?.revision ?? null });
    const evidence = await InspectionEvidence.find({ inspectionId: row._id, status: { $in: ["ACTIVE", "PENDING_UPLOAD"] } }).select("status checklistItemKey defectKey").session(session).lean();
    if (evidence.some((e) => e.status === "PENDING_UPLOAD")) throw new Flow(400, "VALIDATION_ERROR", { gaps: ["evidence_uploading"] });
    const latest = await ProgressReport.findOne({ projectId: row.projectId }).sort({ sequence: -1 }).select("reportedPercent").session(session).lean();
    const gaps = submitGaps(typeOf(row), {
      checklist: (report.checklist ?? []).map((c) => ({ key: c.key, result: c.result, note: c.note })), defects: (report.defects ?? []).map((d) => ({ key: d.key, severity: d.severity })),
      measuredProgress: report.measuredProgress ?? null, discrepancyNote: report.discrepancyNote, inspectorDeclaration: report.inspectorDeclaration, conditionRating: report.conditionRating ?? null,
    }, evidence.map((e) => ({ checklistItemKey: e.checklistItemKey, defectKey: e.defectKey })), latest ? latest.reportedPercent : null);
    if (gaps.length) throw new Flow(400, "VALIDATION_ERROR", { gaps });
    const contractorIds = await ContractorAssignment.distinct("contractorId", { projectId: row.projectId, startDate: { $lte: row.inspectionDate }, $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: row.inspectionDate } }] }).session(session);
    const snapshot = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: { $in: ["IN_PROGRESS", "REQUIRES_REVIEW"] }, version: row.version ?? 0 }, {
      $set: { status: "SUBMITTED", submittedAt: now, contractorIdsAtInspection: contractorIds }, $inc: { version: 1 },
      $push: { submissions: { no: (row.submissions?.length ?? 0) + 1, submittedAt: now, submittedBy: oid(actor.userId), reportSnapshot: snapshot } },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.submitted", inspectionId: row._id, agencyId: row.agencyId, oldValue: { status: row.status }, newValue: { status: "SUBMITTED" }, requestId });
    return { id: row._id as Id, agencyId: row.agencyId as Id | undefined, no: row.inspectionNo ?? String(row._id) };
  });
  if (notice.agencyId) {
    const reviewers = await holdersOf([notice.agencyId], "inspection.verify", [actor.userId]);
    await notifyInspection(reviewers, { title: "Inspection awaiting review", message: `${notice.no} was submitted for review.`, inspectionId: notice.id, eventKey: `ins-submit:${notice.id}:${now.getTime()}` });
  }
  return ok({ submitted: true });
});
