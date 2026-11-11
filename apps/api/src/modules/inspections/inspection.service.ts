import mongoose from "mongoose";
import type { z } from "zod";

import { contextOf, Flow, need, run, type Ctx, type Result } from "../contractors/contractor.context.js";
import { loadProject } from "../finance/finance.common.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { ProgressReport } from "../projects/models/progress-report.model.js";
import { Project } from "../projects/models/project.model.js";
import { checklistFor, CHECKLIST_TEMPLATES } from "./inspection-checklists.js";
import {
  CHECKLIST_VERSION, PROJECT_STATUSES_FOR_SCHEDULING, TERMINAL_STATUSES, type InspectionStatus, type InspectionType,
} from "./inspection.constants.js";
import {
  displayNames, inTransaction, inspectionScope, iso, isId, loadInspection, notifyInspection, oid, summaryRow, writeInspectionAudit,
  type Id, type InspectionRow,
} from "./inspection.common.js";
import {
  calendarWindowOk, canTransition, colomboDayStart, isOverdue, makerCheckerOk, overlaps, representativePoint, scheduleDateOk, startWindowOpen,
} from "./inspection.rules.js";
import { loadAsset } from "../assets/asset.common.js";
import { Inspection } from "./models/inspection.model.js";
import { InspectionEvidence } from "./models/inspection-evidence.model.js";
import { ProgressVerification } from "./models/progress-verification.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import type { calendarQuery, cancelBody, editBody, inspectorsQuery, listQuery, reassignBody, rescheduleBody, scheduleBody, summaryQuery } from "./inspection.schema.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const conflict = (current: string): never => { throw new Flow(409, "CONFLICT", { current }); };
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Valid assignee: ACTIVE, verified INSPECTOR whose agency is inside the assigner's scope (platform: any). */
async function assertInspector(ctx: Ctx, inspectorId: string, session?: mongoose.ClientSession): Promise<{ _id: Id; agencyId: Id }> {
  if (!isId(inspectorId)) throw new Flow(400, "VALIDATION_ERROR");
  const q = User.findOne({ _id: inspectorId, status: "ACTIVE", emailVerified: true }).select("roleId agencyId");
  if (session) q.session(session);
  const user = await q;
  const role = user?.roleId ? await Role.findById(user.roleId).select("key isActive").lean() : null;
  if (!user || !role?.isActive || role.key !== "INSPECTOR" || !user.agencyId) throw new Flow(400, "VALIDATION_ERROR", { field: "inspectorId" });
  if (ctx.scope.kind !== "platform" && !ctx.agencyObjectIds.some((a) => String(a) === String(user.agencyId))) throw new Flow(400, "VALIDATION_ERROR", { field: "inspectorId" });
  return { _id: user._id as Id, agencyId: user.agencyId as Id };
}

async function latestClaim(projectId: Id, session?: mongoose.ClientSession): Promise<number | null> {
  const q = ProgressReport.findOne({ projectId }).sort({ sequence: -1 }).select("reportedPercent");
  if (session) q.session(session);
  const r = await q.lean();
  return r ? r.reportedPercent : null;
}

async function assertMilestones(projectId: Id, ids: string[], session?: mongoose.ClientSession): Promise<void> {
  if (!ids.length) return;
  const q = Milestone.countDocuments({ _id: { $in: ids }, projectId });
  if (session) q.session(session);
  if ((await q) !== new Set(ids).size) throw new Flow(400, "VALIDATION_ERROR", { field: "milestoneIds" });
}

/* ---------------- schedule ---------------- */

export const scheduleInspection = (actor: AuthenticatedActor, input: z.infer<typeof scheduleBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.assign");
    const project = await loadProject(ctx, actor, input.projectId, session, "write");
    if (!(PROJECT_STATUSES_FOR_SCHEDULING as readonly string[]).includes(project.status)) throw new Flow(409, "CONFLICT", { current: project.status, reason: "project_status" });
    if (!scheduleDateOk(input.inspectionDate, now)) throw new Flow(400, "VALIDATION_ERROR", { field: "inspectionDate" });
    if (input.inspectionType === "FINAL_HANDOVER" && !["ACTIVE", "COMPLETED"].includes(project.status)) throw new Flow(409, "CONFLICT", { reason: "project_status" });
    if (input.inspectionType === "FOLLOW_UP") {
      if (!input.followUpOfId) throw new Flow(400, "VALIDATION_ERROR", { field: "followUpOfId" });
      const parent = await Inspection.findOne({ _id: input.followUpOfId, projectId: project._id }).select("status").session(session).lean();
      if (!parent || !TERMINAL_STATUSES.includes(parent.status as InspectionStatus)) throw new Flow(400, "VALIDATION_ERROR", { field: "followUpOfId" });
    } else if (input.followUpOfId) throw new Flow(400, "VALIDATION_ERROR", { field: "followUpOfId" });
    let assetId: Id | null = null;
    if (input.inspectionType === "ASSET_CONDITION") {
      if (!input.assetId) throw new Flow(400, "VALIDATION_ERROR", { field: "assetId" });
      const asset = await loadAsset(ctx, actor, input.assetId, session, "read");
      if (String(asset.sourceProjectId) !== String(project._id) || asset.operationalStatus === "DECOMMISSIONED") throw new Flow(400, "VALIDATION_ERROR", { field: "assetId" });
      assetId = asset._id;
    } else if (input.assetId) throw new Flow(400, "VALIDATION_ERROR", { field: "assetId" });
    const inspector = await assertInspector(ctx, input.inspectorId, session);
    await assertMilestones(project._id, input.milestoneIds, session);
    const geo = await Project.findById(project._id).select("geometry").session(session).lean();
    const pt = input.useProjectPoint ? representativePoint(geo?.geometry as { type: string; coordinates: unknown } | undefined) : null;
    const claimed = await latestClaim(project._id, session);
    const inspectionNo = await nextNumber("INS", now, session);
    const [created] = await Inspection.create([{
      inspectionNo, projectId: project._id, agencyId: project.agencyId, inspectorId: inspector._id, inspectionDate: input.inspectionDate, inspectionType: input.inspectionType,
      purpose: input.purpose, priority: input.priority, locationNote: input.locationNote, durationMinutes: input.durationMinutes, milestoneIds: input.milestoneIds,
      ...(pt ? { sitePoint: { type: "Point", coordinates: pt } } : {}), ...(input.followUpOfId ? { followUpOfId: input.followUpOfId } : {}), ...(assetId ? { assetId } : {}),
      ...(claimed !== null ? { claimedProgressAtSchedule: claimed } : {}), scheduledBy: oid(actor.userId), status: "SCHEDULED", version: 0,
      assignmentHistory: [{ inspectorId: inspector._id, assignedBy: oid(actor.userId), assignedAt: now }],
    }], { session });
    await writeInspectionAudit(session, { actor, action: "inspection.scheduled", inspectionId: created!._id, agencyId: project.agencyId, newValue: { status: "SCHEDULED", agencyId: project.agencyId }, requestId });
    return { id: String(created!._id), inspectionNo, inspectorId: inspector._id, projectCode: project.projectCode };
  });
  await notifyInspection([out.inspectorId], { title: "Inspection assigned", message: `${out.inspectionNo} for ${out.projectCode} was assigned to you.`, inspectionId: oid(out.id), eventKey: `ins-assign:${out.id}` });
  return ok({ id: out.id, inspectionNo: out.inspectionNo });
});

/* ---------------- edit / reschedule / reassign / cancel ---------------- */

export const editInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof editBody>, requestId: string) => run(async () => {
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.assign");
    const row = await loadInspection(ctx, actor, rawId, session, "assign");
    if (!canTransition("EDIT", row.status)) conflict(row.status);
    if (input.milestoneIds) await assertMilestones(row.projectId, input.milestoneIds, session);
    const { version, ...fields } = input;
    const $set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: "SCHEDULED", version }, { $set, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.updated", inspectionId: row._id, agencyId: row.agencyId, newValue: { status: row.status, reason: `fields: ${Object.keys($set).join(",")}` }, requestId });
  });
  return ok({ updated: true });
});

export const rescheduleInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof rescheduleBody>, requestId: string) => run(async () => {
  const now = new Date();
  const notice = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.assign");
    const row = await loadInspection(ctx, actor, rawId, session, "assign");
    if (!canTransition("RESCHEDULE", row.status)) conflict(row.status);
    if (!scheduleDateOk(input.inspectionDate, now)) throw new Flow(400, "VALIDATION_ERROR", { field: "inspectionDate" });
    if ((row.rescheduleHistory?.length ?? 0) >= 20) throw new Flow(409, "CONFLICT", { reason: "history_full" });
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, version: row.version ?? 0 }, {
      $set: { inspectionDate: input.inspectionDate }, $inc: { version: 1 }, $push: { rescheduleHistory: { from: row.inspectionDate, to: input.inspectionDate, by: oid(actor.userId), at: now, reason: input.reason } },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.rescheduled", inspectionId: row._id, agencyId: row.agencyId, newValue: { status: row.status, reason: input.reason }, requestId });
    return { to: row.inspectorId, no: row.inspectionNo ?? String(row._id), id: row._id };
  });
  await notifyInspection([notice.to], { title: "Inspection rescheduled", message: `${notice.no} was moved to ${input.inspectionDate.toISOString()}.`, inspectionId: notice.id, eventKey: `ins-resched:${notice.id}:${input.inspectionDate.getTime()}` });
  return ok({ rescheduled: true });
});

export const reassignInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof reassignBody>, requestId: string) => run(async () => {
  const now = new Date();
  const notice = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.assign");
    const row = await loadInspection(ctx, actor, rawId, session, "assign");
    if (!canTransition("REASSIGN", row.status)) conflict(row.status);
    if (String(row.inspectorId) === input.inspectorId) throw new Flow(400, "VALIDATION_ERROR", { field: "inspectorId" });
    if ((row.assignmentHistory?.length ?? 0) >= 20) throw new Flow(409, "CONFLICT", { reason: "history_full" });
    const next = await assertInspector(ctx, input.inspectorId, session);
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, version: row.version ?? 0 }, {
      $set: { inspectorId: next._id }, $inc: { version: 1 }, $push: { assignmentHistory: { inspectorId: next._id, assignedBy: oid(actor.userId), assignedAt: now, reason: input.reason } },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.reassigned", inspectionId: row._id, agencyId: row.agencyId, newValue: { status: row.status, reason: input.reason }, requestId });
    return { from: row.inspectorId, to: next._id, no: row.inspectionNo ?? String(row._id), id: row._id };
  });
  await notifyInspection([notice.to], { title: "Inspection assigned", message: `${notice.no} was assigned to you.`, inspectionId: notice.id, eventKey: `ins-reassign-in:${notice.id}:${notice.to}` });
  await notifyInspection([notice.from], { title: "Inspection reassigned", message: `${notice.no} was reassigned to another inspector.`, inspectionId: notice.id, eventKey: `ins-reassign-out:${notice.id}:${notice.from}` });
  return ok({ reassigned: true });
});

export const cancelInspection = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof cancelBody>, requestId: string) => run(async () => {
  const now = new Date();
  const notice = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.assign");
    const row = await loadInspection(ctx, actor, rawId, session, "assign");
    if (!canTransition("CANCEL", row.status)) conflict(row.status);
    const res = await Inspection.findOneAndUpdate({ _id: row._id, status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, version: row.version ?? 0 }, {
      $set: { status: "CANCELLED", cancelReason: input.reason, cancelledBy: oid(actor.userId), completedAt: now }, $inc: { version: 1 },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await writeInspectionAudit(session, { actor, action: "inspection.cancelled", inspectionId: row._id, agencyId: row.agencyId, oldValue: { status: row.status }, newValue: { status: "CANCELLED", reason: input.reason }, requestId });
    return { to: row.inspectorId, no: row.inspectionNo ?? String(row._id), id: row._id };
  });
  await notifyInspection([notice.to], { title: "Inspection cancelled", message: `${notice.no} was cancelled.`, inspectionId: notice.id, eventKey: `ins-cancel:${notice.id}` });
  return ok({ cancelled: true });
});

/* ---------------- queries ---------------- */

type ListFilters = Partial<Pick<z.infer<typeof listQuery>, "q" | "status" | "type" | "priority" | "projectId" | "inspectorId" | "agencyId" | "dateFrom" | "dateTo" | "overdue" | "needsReview" | "mine">>;

async function buildFilter(ctx: Ctx, actor: AuthenticatedActor, f: ListFilters, now: Date): Promise<Record<string, unknown>> {
  const and: Record<string, unknown>[] = [inspectionScope(ctx, actor)];
  if (f.status?.length) and.push({ status: { $in: f.status } });
  if (f.type) and.push({ inspectionType: f.type });
  if (f.priority) and.push({ priority: f.priority });
  if (f.projectId) and.push({ projectId: oid(f.projectId) });
  if (f.inspectorId) and.push({ inspectorId: oid(f.inspectorId) });
  if (f.agencyId) and.push({ agencyId: oid(f.agencyId) });
  if (f.mine) and.push({ inspectorId: oid(actor.userId) });
  if (f.needsReview) and.push({ status: "SUBMITTED" });
  if (f.dateFrom || f.dateTo) and.push({ inspectionDate: { ...(f.dateFrom ? { $gte: new Date(f.dateFrom) } : {}), ...(f.dateTo ? { $lte: new Date(f.dateTo) } : {}) } });
  if (f.overdue) and.push({ status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, $expr: { $lt: [{ $add: ["$inspectionDate", { $multiply: [{ $ifNull: ["$durationMinutes", 120] }, 60_000] }] }, now] } });
  if (f.q) {
    const rx = new RegExp(escapeRx(f.q), "i");
    const ids = await Inspection.distinct("projectId", inspectionScope(ctx, actor));
    const projects = await Project.find({ _id: { $in: ids.slice(0, 5000) }, $or: [{ title: rx }, { projectCode: rx }] }).select("_id").limit(200).lean();
    and.push({ $or: [{ inspectionNo: rx }, { projectId: { $in: projects.map((p) => p._id) } }] });
  }
  return { $and: and };
}

async function decorate(rows: InspectionRow[], now: Date) {
  const projects = new Map((await Project.find({ _id: { $in: [...new Set(rows.map((r) => String(r.projectId)))] } }).select("projectCode title").lean()).map((p) => [String(p._id), { projectCode: p.projectCode, title: p.title }]));
  const names = await displayNames(rows.map((r) => r.inspectorId));
  return rows.map((r) => summaryRow(r, { projects, names, now }));
}

const LIST_SELECT = "inspectionNo projectId agencyId inspectorId inspectionDate inspectionType priority status durationMinutes evidence claimedProgressAtSchedule physicalProgress version report.measuredProgress submissions.no";

export const listInspections = (actor: AuthenticatedActor, q: z.infer<typeof listQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  const now = new Date();
  const filter = await buildFilter(ctx, actor, q, now);
  const sort: Record<string, 1 | -1> = q.sort === "date_desc" ? { inspectionDate: -1, _id: -1 } : { inspectionDate: 1, _id: 1 };
  const [rows, total, facets] = await Promise.all([
    Inspection.find(filter).select(LIST_SELECT).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean(),
    Inspection.countDocuments(filter).maxTimeMS(8000),
    Inspection.aggregate<{ _id: string; n: number }>([{ $match: { $and: [inspectionScope(ctx, actor)] } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
  ]);
  return ok({ rows: await decorate(rows as unknown as InspectionRow[], now), total, page: q.page, limit: q.limit, facets: Object.fromEntries(facets.map((f) => [f._id, f.n])) });
});

export const calendarInspections = (actor: AuthenticatedActor, q: z.infer<typeof calendarQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  const from = new Date(q.from), to = new Date(q.to);
  if (!calendarWindowOk(from, to)) throw new Flow(400, "VALIDATION_ERROR", { field: "window" });
  const now = new Date();
  const filter = await buildFilter(ctx, actor, { ...q, dateFrom: q.from, dateTo: q.to }, now);
  const rows = await Inspection.find(filter).select(LIST_SELECT).sort({ inspectionDate: 1, _id: 1 }).limit(501).maxTimeMS(8000).lean();
  const truncated = rows.length > 500;
  return ok({ rows: await decorate(rows.slice(0, 500) as unknown as InspectionRow[], now), truncated, from: from.toISOString(), to: to.toISOString(), timezone: "Asia/Colombo" });
});

export const inspectionSummary = (actor: AuthenticatedActor, q: z.infer<typeof summaryQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  const now = new Date();
  const scope = inspectionScope(ctx, actor);
  const base: Record<string, unknown> = q.projectId ? { $and: [scope, { projectId: oid(q.projectId) }] } : scope;
  const day = 86_400_000;
  const overdueExpr = { $lt: [{ $add: ["$inspectionDate", { $multiply: [{ $ifNull: ["$durationMinutes", 120] }, 60_000] }] }, now] };
  const count = (extra: Record<string, unknown>) => Inspection.countDocuments({ $and: [base, extra] }).maxTimeMS(8000);
  const [upcoming7d, inProgress, awaitingReview, revisionRequired, overdue, verified30d] = await Promise.all([
    count({ status: "SCHEDULED", inspectionDate: { $gte: now, $lte: new Date(now.getTime() + 7 * day) } }), count({ status: "IN_PROGRESS" }), count({ status: "SUBMITTED" }), count({ status: "REQUIRES_REVIEW" }),
    count({ status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, $expr: overdueExpr }), count({ status: "VERIFIED", completedAt: { $gte: new Date(now.getTime() - 30 * day) } }),
  ]);
  const since90 = new Date(now.getTime() - 90 * day);
  const decided = await Inspection.find({ $and: [base, { reviewedAt: { $gte: since90 }, submittedAt: { $exists: true } }] }).select("submittedAt reviewedAt").limit(500).lean();
  const hours = decided.map((d) => ((d.reviewedAt as Date).getTime() - (d.submittedAt as Date).getTime()) / 3_600_000).filter((h) => h >= 0).sort((a, b) => a - b);
  const median = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2]! : (hours[hours.length / 2 - 1]! + hours[hours.length / 2]!) / 2) : null;
  const outcomes = await Inspection.aggregate<{ _id: string; n: number }>([{ $match: base }, { $unwind: "$submissions" }, { $match: { "submissions.decision.at": { $gte: since90 } } }, { $group: { _id: "$submissions.decision.decision", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 });
  const agencyFilter = ctx.scope.kind === "platform" ? {} : ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : { _id: { $in: [] } };
  const gaps = actor.roleKey === "INSPECTOR" ? [] : await ProgressVerification.aggregate<{ projectId: Id; inspectionId: Id; claimed: number; verified: number; pp: number; asOf: Date }>([
    { $match: { ...agencyFilter, status: "ACTIVE", discrepancyPp: { $ne: null } } }, { $addFields: { abs: { $abs: "$discrepancyPp" } } }, { $sort: { abs: -1 } }, { $limit: 5 },
    { $project: { projectId: 1, inspectionId: 1, claimed: "$claimedPercent", verified: "$verifiedPercent", pp: "$discrepancyPp", asOf: 1 } },
  ]).option({ maxTimeMS: 8000 });
  const gapProjects = new Map((await Project.find({ _id: { $in: gaps.map((g) => g.projectId) } }).select("projectCode title").lean()).map((p) => [String(p._id), p]));
  const gapRows = gaps.map((g) => ({
    projectId: String(g.projectId), projectCode: gapProjects.get(String(g.projectId))?.projectCode ?? null, projectTitle: gapProjects.get(String(g.projectId))?.title ?? null, inspectionId: String(g.inspectionId),
    claimedPercent: g.claimed, verifiedPercent: g.verified, discrepancyPp: g.pp, asOf: iso(g.asOf), basis: "inspection_verified_vs_reported",
  }));
  // Items needing the caller's action (role-aware, bounded).
  const action: Record<string, unknown>[] = [];
  if (actor.roleKey === "INSPECTOR") action.push({ inspectorId: oid(actor.userId), status: { $in: ["SCHEDULED", "IN_PROGRESS", "REQUIRES_REVIEW"] } });
  else {
    if (ctx.has("inspection.verify") || ctx.has("inspection.reject")) action.push({ status: "SUBMITTED" });
    if (ctx.has("inspection.assign")) action.push({ status: { $in: ["SCHEDULED", "IN_PROGRESS"] }, $expr: overdueExpr });
  }
  const needing = action.length ? await Inspection.find({ $and: [base, { $or: action }] }).select(LIST_SELECT).sort({ inspectionDate: 1 }).limit(10).lean() : [];
  return ok({
    counts: { upcoming7d, inProgress, awaitingReview, revisionRequired, overdue, verified30d },
    turnaround: { medianHours: hours.length >= 5 ? Math.round((median ?? 0) * 10) / 10 : null, sample: hours.length, enough: hours.length >= 5 },
    outcomes: Object.fromEntries(outcomes.map((o) => [o._id, o.n])), verificationGaps: gapRows, needsAction: await decorate(needing as unknown as InspectionRow[], now),
  });
});

export const myWork = (actor: AuthenticatedActor) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  if (!ctx.has("inspection.submit")) throw new Flow(403, "FORBIDDEN");
  const now = new Date();
  const mine = { inspectorId: oid(actor.userId) };
  const dayStart = colomboDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const open = await Inspection.find({ ...mine, status: { $in: ["SCHEDULED", "IN_PROGRESS", "REQUIRES_REVIEW"] } }).select(LIST_SELECT).sort({ inspectionDate: 1 }).limit(100).lean();
  const recent = await Inspection.find({ ...mine, status: { $in: ["VERIFIED", "REJECTED"] }, completedAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) } }).select(LIST_SELECT).sort({ completedAt: -1 }).limit(10).lean();
  const rows = await decorate([...open, ...recent] as unknown as InspectionRow[], now);
  const openIds = new Set(open.map((o) => String(o._id)));
  const view = rows.filter((r) => openIds.has(r.id)).map((r) => ({ ...r, dueIn24h: r.status === "SCHEDULED" && new Date(r.inspectionDate).getTime() - now.getTime() <= 86_400_000 && new Date(r.inspectionDate).getTime() >= now.getTime(), canStart: r.status === "SCHEDULED" && startWindowOpen(new Date(r.inspectionDate), now) }));
  return ok({
    today: view.filter((r) => r.status !== "REQUIRES_REVIEW" && new Date(r.inspectionDate) >= dayStart && new Date(r.inspectionDate) < dayEnd),
    upcoming: view.filter((r) => r.status === "SCHEDULED" && new Date(r.inspectionDate) >= dayEnd),
    overdue: view.filter((r) => r.overdue), inProgress: view.filter((r) => r.status === "IN_PROGRESS"), revisions: view.filter((r) => r.status === "REQUIRES_REVIEW"),
    recentDecisions: rows.filter((r) => !openIds.has(r.id)), asOf: now.toISOString(),
  });
});

export const inspectorLookup = (actor: AuthenticatedActor, q: z.infer<typeof inspectorsQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.assign");
  await loadProject(ctx, actor, q.projectId, undefined, "write");
  const roles = await Role.find({ key: "INSPECTOR", isActive: true }).select("_id").lean();
  const agencyFilter = ctx.scope.kind === "platform" ? {} : { agencyId: { $in: ctx.agencyObjectIds } };
  const users = await User.find({ ...agencyFilter, roleId: { $in: roles.map((r) => r._id) }, status: "ACTIVE", emailVerified: true }).select("firstName lastName agencyId").sort({ firstName: 1 }).limit(100).lean();
  const ids = users.map((u) => u._id);
  const now = new Date();
  const from = q.from ? new Date(q.from) : null;
  const dur = q.durationMinutes ?? 120;
  const open = await Inspection.find({ inspectorId: { $in: ids }, status: { $in: ["SCHEDULED", "IN_PROGRESS", "REQUIRES_REVIEW", "SUBMITTED"] } }).select("inspectorId inspectionDate durationMinutes status inspectionNo").lean();
  const agencies = new Map((await Agency.find({ _id: { $in: users.map((u) => u.agencyId) } }).select("name").lean()).map((a) => [String(a._id), a.name as string]));
  const horizon = now.getTime() + 14 * 86_400_000;
  return ok({
    inspectors: users.map((u) => {
      const mine = open.filter((o) => String(o.inspectorId) === String(u._id));
      const upcoming = mine.filter((o) => o.status === "SCHEDULED" && o.inspectionDate.getTime() >= now.getTime() && o.inspectionDate.getTime() <= horizon).sort((a, b) => a.inspectionDate.getTime() - b.inspectionDate.getTime());
      return {
        id: String(u._id), name: `${u.firstName} ${u.lastName}`.trim(), agencyId: String(u.agencyId), agencyName: agencies.get(String(u.agencyId)) ?? null,
        openCount: mine.length, upcoming14dCount: upcoming.length, nextInspectionAt: iso(upcoming[0]?.inspectionDate),
        conflicts: from ? mine.filter((o) => ["SCHEDULED", "IN_PROGRESS"].includes(o.status) && overlaps(from, dur, o.inspectionDate, o.durationMinutes ?? 120)).slice(0, 5).map((o) => ({ inspectionNo: o.inspectionNo ?? null, at: o.inspectionDate.toISOString() })) : [],
      };
    }),
  });
});

export const checklistTemplate = (actor: AuthenticatedActor, type: InspectionType) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  if (!(type in CHECKLIST_TEMPLATES)) throw new Flow(400, "VALIDATION_ERROR");
  return ok({ type, version: CHECKLIST_VERSION, items: checklistFor(type) });
});

/* ---------------- detail ---------------- */

export const getInspection = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  const row = await loadInspection(ctx, actor, rawId, undefined, "read");
  const now = new Date();
  const isOwner = String(row.inspectorId) === actor.userId;
  const [project, evidence, verification] = await Promise.all([
    Project.findById(row.projectId).select("projectCode title status physicalProgress verifiedProgress").lean(),
    InspectionEvidence.find({ inspectionId: row._id, status: { $in: ["ACTIVE", "PENDING_UPLOAD"] } }).sort({ uploadedAt: 1 }).lean(),
    ProgressVerification.findOne({ inspectionId: row._id }).select("verifiedPercent claimedPercent discrepancyPp status asOf milestones").lean(),
  ]);
  const people = await displayNames([row.inspectorId, row.scheduledBy, row.reviewedBy, ...(row.assignmentHistory ?? []).flatMap((a) => [a.inspectorId, a.assignedBy]), ...(row.rescheduleHistory ?? []).map((r) => r.by), ...(row.submissions ?? []).flatMap((s) => [s.submittedBy, s.decision?.by])]);
  const nm = (id?: Id | null) => (id ? people.get(String(id)) ?? null : null);
  const lastSub = row.submissions?.[row.submissions.length - 1];
  const reviewer = ctx.has("inspection.verify") || ctx.has("inspection.reject");
  const writeOk = ctx.has("inspection.assign") && (await Project.exists({ _id: row.projectId, ...(await writeFilterFor(ctx, actor)) })) !== null;
  const status = row.status;
  const makerOk = makerCheckerOk(actor.userId, lastSub ? String(lastSub.submittedBy) : null, String(row.inspectorId));
  const hideDraft = !isOwner && (status === "SCHEDULED" || status === "IN_PROGRESS");
  const contractors = row.contractorIdsAtInspection?.length ? await (await import("../contractors/models/contractor.model.js")).Contractor.find({ _id: { $in: row.contractorIdsAtInspection } }).select("name").lean() : [];
  const report = hideDraft ? null : row.report ?? null;
  return ok({
    id: String(row._id), inspectionNo: row.inspectionNo ?? null, project: project ? { id: String(project._id), projectCode: project.projectCode, title: project.title, status: project.status, reportedProgress: project.physicalProgress, verifiedProgress: project.verifiedProgress ? { percent: project.verifiedProgress.percent, asOf: iso(project.verifiedProgress.asOf) } : null } : null,
    agencyId: row.agencyId ? String(row.agencyId) : null, inspectionType: row.inspectionType ?? "PROGRESS_VERIFICATION", priority: row.priority ?? "NORMAL", purpose: row.purpose ?? null, locationNote: row.locationNote ?? null,
    sitePoint: row.sitePoint ? { lon: row.sitePoint.coordinates[0], lat: row.sitePoint.coordinates[1] } : null, status, overdue: isOverdue(status, row.inspectionDate, row.durationMinutes, now),
    inspectionDate: row.inspectionDate.toISOString(), durationMinutes: row.durationMinutes ?? 120, inspector: { id: String(row.inspectorId), name: nm(row.inspectorId) }, scheduledByName: nm(row.scheduledBy),
    milestoneIds: (row.milestoneIds ?? []).map(String), followUpOfId: row.followUpOfId ? String(row.followUpOfId) : null, claimedProgressAtSchedule: row.claimedProgressAtSchedule ?? null,
    measuredProgress: row.status === "VERIFIED" ? row.physicalProgress ?? null : row.report?.measuredProgress ?? null, version: row.version ?? 0,
    startedAt: iso(row.startedAt), submittedAt: iso(row.submittedAt), reviewedAt: iso(row.reviewedAt), completedAt: iso(row.completedAt), cancelReason: row.cancelReason ?? null,
    report, checklist: { version: CHECKLIST_VERSION, items: checklistFor((row.inspectionType ?? "PROGRESS_VERIFICATION") as InspectionType) }, contractors: contractors.map((c) => ({ id: String(c._id), name: c.name })),
    submissions: (row.submissions ?? []).map((s) => ({ no: s.no, submittedAt: s.submittedAt.toISOString(), submittedByName: nm(s.submittedBy), report: s.reportSnapshot, decision: s.decision ? { decision: s.decision.decision, byName: nm(s.decision.by), at: s.decision.at.toISOString(), note: s.decision.note ?? null, itemComments: s.decision.itemComments ?? [] } : null })),
    assignmentHistory: (row.assignmentHistory ?? []).map((a) => ({ inspectorName: nm(a.inspectorId), assignedByName: nm(a.assignedBy), assignedAt: a.assignedAt.toISOString(), reason: a.reason ?? null })),
    rescheduleHistory: (row.rescheduleHistory ?? []).map((r) => ({ from: r.from.toISOString(), to: r.to.toISOString(), byName: nm(r.by), at: r.at.toISOString(), reason: r.reason })),
    evidence: evidence.map((e) => ({ id: String(e._id), caption: e.caption ?? null, checklistItemKey: e.checklistItemKey ?? null, defectKey: e.defectKey ?? null, capturedAt: e.capturedAt.toISOString(), uploadedAt: e.uploadedAt.toISOString(), status: e.status, width: e.width ?? null, height: e.height ?? null, sizeBytes: e.sizeBytes, hasThumb: Boolean(e.thumbDocumentId), shaPrefix: e.sha256.slice(0, 12), sitePresence: e.sitePresence ?? null, hasLocation: Boolean(e.location), uploadedByMe: String(e.uploadedBy) === actor.userId })),
    verification: verification ? { verifiedPercent: verification.verifiedPercent, claimedPercent: verification.claimedPercent ?? null, discrepancyPp: verification.discrepancyPp ?? null, status: verification.status, asOf: iso(verification.asOf), milestones: verification.milestones } : null,
    aiAssistRefs: (row.aiAssistRefs ?? []).map((r) => ({ analysisId: String(r.analysisId), observationKey: r.observationKey, insertedAt: r.insertedAt.toISOString() })),
    can: {
      edit: writeOk && canTransition("EDIT", status), reschedule: writeOk && canTransition("RESCHEDULE", status), reassign: writeOk && canTransition("REASSIGN", status), cancel: writeOk && canTransition("CANCEL", status),
      start: isOwner && ctx.has("inspection.submit") && status === "SCHEDULED" && startWindowOpen(row.inspectionDate, now), editReport: isOwner && ctx.has("inspection.submit") && (status === "IN_PROGRESS" || status === "REQUIRES_REVIEW"),
      decide: reviewer && status === "SUBMITTED" && makerOk, decideBlockedReason: reviewer && status === "SUBMITTED" && !makerOk ? "own_submission" : null,
      approve: ctx.has("inspection.verify"), reject: ctx.has("inspection.reject") && (status === "SUBMITTED" || status === "REQUIRES_REVIEW"), followUp: writeOk && (status === "REJECTED" || status === "VERIFIED"),
    },
  });
});

async function writeFilterFor(ctx: Ctx, actor: AuthenticatedActor): Promise<Record<string, unknown>> {
  const { projectWriteFilter } = await import("../identity/authorization/resource-scope.js");
  return projectWriteFilter(actor, ctx.scope);
}

/* ---------------- project views ---------------- */

export const projectInspections = (actor: AuthenticatedActor, rawProjectId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "inspection.read");
  if (!isId(rawProjectId)) throw new Flow(404, "NOT_FOUND");
  const now = new Date();
  const scope = inspectionScope(ctx, actor);
  if (actor.roleKey !== "INSPECTOR") {
    const p = await Project.exists({ $and: [projectReadFilter(ctx.scope), { _id: rawProjectId }] });
    if (!p) throw new Flow(404, "NOT_FOUND");
  }
  const rows = await Inspection.find({ $and: [scope, { projectId: oid(rawProjectId) }] }).select(LIST_SELECT).sort({ inspectionDate: -1 }).limit(100).lean();
  if (actor.roleKey === "INSPECTOR" && !rows.length) throw new Flow(404, "NOT_FOUND");
  const latest = await ProgressVerification.findOne({ projectId: oid(rawProjectId), status: "ACTIVE" }).sort({ asOf: -1 }).select("verifiedPercent claimedPercent discrepancyPp asOf inspectionId").lean();
  // Open findings: defects (MAJOR/CRITICAL) from the latest approved report that no later approved inspection has rechecked.
  const concluded = await Inspection.find({ $and: [scope, { projectId: oid(rawProjectId), status: "VERIFIED" }] }).select("inspectionDate submissions inspectionNo").sort({ inspectionDate: -1 }).limit(10).lean();
  const openFindings = concluded[0]?.submissions?.[concluded[0].submissions.length - 1]?.reportSnapshot?.defects?.filter((d) => d.severity !== "MINOR").map((d) => ({ key: d.key, title: d.title, severity: d.severity, inspectionNo: concluded[0]!.inspectionNo ?? null })) ?? [];
  return ok({ rows: await decorate(rows as unknown as InspectionRow[], now), latestVerification: latest ? { verifiedPercent: latest.verifiedPercent, claimedPercent: latest.claimedPercent ?? null, discrepancyPp: latest.discrepancyPp ?? null, asOf: iso(latest.asOf), inspectionId: String(latest.inspectionId) } : null, openFindings });
});

export const verifiedProgressSeries = (actor: AuthenticatedActor, rawProjectId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "project.read");
  need(ctx, "progress.read");
  if (!isId(rawProjectId)) throw new Flow(404, "NOT_FOUND");
  const p = await Project.exists({ $and: [projectReadFilter(ctx.scope), { _id: rawProjectId }] });
  if (!p) throw new Flow(404, "NOT_FOUND");
  const [verifications, reports] = await Promise.all([
    ProgressVerification.find({ projectId: oid(rawProjectId) }).select("verifiedPercent claimedPercent discrepancyPp asOf status inspectionId").sort({ asOf: 1 }).limit(100).lean(),
    ProgressReport.find({ projectId: oid(rawProjectId) }).select("reportedPercent reportedAt sequence").sort({ sequence: 1 }).limit(200).lean(),
  ]);
  return ok({
    verified: verifications.map((v) => ({ percent: v.verifiedPercent, claimed: v.claimedPercent ?? null, discrepancyPp: v.discrepancyPp ?? null, asOf: iso(v.asOf), status: v.status, inspectionId: String(v.inspectionId) })),
    reported: reports.map((r) => ({ percent: r.reportedPercent, at: iso(r.reportedAt), label: "reported_unverified" })),
  });
});
