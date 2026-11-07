import mongoose, { type ClientSession } from "mongoose";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter } from "../identity/authorization/resource-scope.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Project } from "../projects/models/project.model.js";
import { canReceiveAssignments, canSee, contractValuesVisible, type ContractorLike } from "./contractor.access.js";
import { agencyNames, assignedInScope, contextOf, Flow, lockContractor, need, notFound, run, writeAudit, type Ctx, type Result } from "./contractor.context.js";
import type { AssignBody, EndBody, ReassignBody } from "./contractor.schema.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";
import { Contractor } from "./models/contractor.model.js";

type Id = mongoose.Types.ObjectId;
const oid = (v: string) => new mongoose.Types.ObjectId(v);
const isId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
const DAY = 86_400_000;

/** Test seam: lets a test fail a multi-document write after the data changed but before the audit row, to prove nothing persists. */
export const assignmentHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

/** Project states that cannot take on, keep or change contractors. */
const CLOSED_FOR_ASSIGNMENT = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);

const money = (minor: number | undefined) => (minor === undefined ? undefined : { amountMinor: minor, currency: "LKR" as const });

async function writableProject(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session: ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  // Visible to the actor's read scope first, so an unreadable project is a plain 404; a readable one the actor may not write is 403.
  const readable = await Project.findOne({ $and: [projectReadFilter(ctx.scope), { _id: rawId }] }).select("_id").session(session);
  if (!readable) throw new Flow(404, "NOT_FOUND");
  const project = await Project.findOne({ $and: [projectWriteFilter(actor, ctx.scope), { _id: rawId }] }).session(session);
  if (!project) throw new Flow(403, "FORBIDDEN");
  return project;
}

async function usableContractor(ctx: Ctx, rawId: string, session: ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const doc = await Contractor.findById(rawId).session(session);
  if (!doc) throw new Flow(404, "NOT_FOUND");
  const assigned = await assignedInScope(ctx, doc._id, session);
  if (!canSee(ctx.viewer, doc as unknown as ContractorLike, assigned)) throw new Flow(404, "NOT_FOUND");
  if (!canReceiveAssignments(doc.status)) throw new Flow(409, "CONFLICT", { kind: "contractor_inactive", status: doc.status });
  return doc;
}

const duplicate = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await work(session); });
    return out;
  } catch (error) {
    // Only the two partial unique indexes can raise this here; both mean "someone else got there first".
    if (duplicate(error)) throw new Flow(409, "CONFLICT", { kind: "assignment_conflict" });
    throw error;
  } finally {
    await session.endSession();
  }
}

export function assignContractor(actor: AuthenticatedActor, projectId: string, input: AssignBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "contractor.manage");
    const project = await writableProject(ctx, actor, projectId, session);
    if (CLOSED_FOR_ASSIGNMENT.has(project.status)) throw new Flow(409, "CONFLICT", { kind: "project_state", status: project.status });
    const contractor = await usableContractor(ctx, input.contractorId, session);
    await lockContractor(session, contractor._id);
    if (input.role === "PRIMARY") {
      const current = await ContractorAssignment.findOne({ projectId: project._id, role: "PRIMARY", status: "ACTIVE" }).select("_id").session(session);
      if (current) throw new Flow(409, "CONFLICT", { kind: "primary_exists", requiresReassignment: true, assignmentId: String(current._id) });
    }
    const [row] = await ContractorAssignment.create([{
      projectId: project._id, contractorId: contractor._id, agencyId: project.agencyId, role: input.role, status: "ACTIVE",
      startDate: input.startDate, ...(input.contractReference ? { contractReference: input.contractReference } : {}), ...(input.contractValueMinor !== undefined ? { contractValue: money(input.contractValueMinor) } : {}),
      assignedBy: oid(actor.userId), ...(input.notes ? { notes: input.notes } : {}),
    }], { session });
    if (input.role === "PRIMARY") await Project.updateOne({ _id: project._id }, { $set: { contractorId: contractor._id } }, { session });
    await assignmentHooks.beforeAudit();
    await writeAudit(session, { actor, action: "contractor.assigned", contractorId: contractor._id, agencyId: project.agencyId, newValue: { contractorId: contractor._id, projectId: project._id, assignmentId: row!._id, agencyId: project.agencyId, status: "ACTIVE", ...(input.contractValueMinor !== undefined ? { amount: money(input.contractValueMinor) } : {}) }, requestId });
    return { ok: true as const, data: { id: String(row!._id) } };
  }));
}

async function activeAssignment(projectId: Id, rawId: string, session: ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const row = await ContractorAssignment.findOne({ _id: rawId, projectId }).session(session);
  if (!row) throw new Flow(404, "NOT_FOUND");
  if (row.status !== "ACTIVE") throw new Flow(409, "CONFLICT", { kind: "not_active", status: row.status });
  return row;
}

export function endAssignment(actor: AuthenticatedActor, projectId: string, assignmentId: string, input: EndBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "contractor.manage");
    const project = await writableProject(ctx, actor, projectId, session);
    const row = await activeAssignment(project._id, assignmentId, session);
    if (input.endDate < row.startDate) throw new Flow(400, "VALIDATION_ERROR", { field: "endDate" });
    await lockContractor(session, row.contractorId);
    row.status = input.status;
    row.endDate = input.endDate;
    row.endReason = input.endReason;
    row.endedBy = oid(actor.userId);
    await row.save({ session });
    if (row.role === "PRIMARY") {
      let promote: InstanceType<typeof ContractorAssignment> | null = null;
      if (input.promoteAssignmentId) {
        if (!isId(input.promoteAssignmentId)) throw new Flow(404, "NOT_FOUND");
        promote = await ContractorAssignment.findOne({ _id: input.promoteAssignmentId, projectId: project._id, role: "ADDITIONAL", status: "ACTIVE" }).session(session);
        if (!promote) throw new Flow(409, "CONFLICT", { kind: "promote_invalid" });
        const next = await Contractor.findById(promote.contractorId).select("status").session(session);
        if (!next || !canReceiveAssignments(next.status)) throw new Flow(409, "CONFLICT", { kind: "contractor_inactive" });
        promote.role = "PRIMARY";
        await promote.save({ session });
      }
      await Project.updateOne({ _id: project._id }, promote ? { $set: { contractorId: promote.contractorId } } : { $unset: { contractorId: 1 } }, { session });
    }
    await assignmentHooks.beforeAudit();
    await writeAudit(session, { actor, action: "contractor.assignment_ended", contractorId: row.contractorId, agencyId: project.agencyId, newValue: { contractorId: row.contractorId, projectId: project._id, assignmentId: row._id, agencyId: project.agencyId, status: input.status, reason: input.endReason }, requestId });
    return { ok: true as const, data: { id: String(row._id) } };
  }));
}

/** One transaction: the current assignment is closed as REPLACED and its successor is created, so history never has a gap or an overlap. */
export function reassign(actor: AuthenticatedActor, projectId: string, assignmentId: string, input: ReassignBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string; previousId: string }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "contractor.manage");
    const project = await writableProject(ctx, actor, projectId, session);
    if (CLOSED_FOR_ASSIGNMENT.has(project.status)) throw new Flow(409, "CONFLICT", { kind: "project_state", status: project.status });
    const old = await activeAssignment(project._id, assignmentId, session);
    if (String(old.contractorId) === input.newContractorId) throw new Flow(409, "CONFLICT", { kind: "same_contractor" });
    if (input.effectiveDate < old.startDate) throw new Flow(400, "VALIDATION_ERROR", { field: "effectiveDate" });
    const next = await usableContractor(ctx, input.newContractorId, session);
    await lockContractor(session, old.contractorId);
    await lockContractor(session, next._id);
    old.status = "REPLACED";
    old.endDate = input.effectiveDate;
    old.endReason = input.reason;
    old.endedBy = oid(actor.userId);
    await old.save({ session });
    const [created] = await ContractorAssignment.create([{
      projectId: project._id, contractorId: next._id, agencyId: project.agencyId, role: old.role, status: "ACTIVE", startDate: input.effectiveDate,
      ...(input.contractReference ? { contractReference: input.contractReference } : {}), ...(input.contractValueMinor !== undefined ? { contractValue: money(input.contractValueMinor) } : {}),
      assignedBy: oid(actor.userId), ...(input.notes ? { notes: input.notes } : {}),
    }], { session });
    old.replacedByAssignmentId = created!._id;
    await old.save({ session });
    if (old.role === "PRIMARY") await Project.updateOne({ _id: project._id }, { $set: { contractorId: next._id } }, { session });
    await assignmentHooks.beforeAudit();
    await writeAudit(session, { actor, action: "contractor.reassigned", contractorId: old.contractorId, agencyId: project.agencyId, oldValue: { contractorId: old.contractorId, projectId: project._id, assignmentId: old._id, status: "ACTIVE" }, newValue: { contractorId: next._id, projectId: project._id, assignmentId: created!._id, agencyId: project.agencyId, status: "REPLACED", reason: input.reason }, requestId });
    await writeAudit(session, { actor, action: "contractor.reassigned", contractorId: next._id, agencyId: project.agencyId, oldValue: { contractorId: old.contractorId, projectId: project._id, assignmentId: old._id }, newValue: { contractorId: next._id, projectId: project._id, assignmentId: created!._id, agencyId: project.agencyId, status: "ACTIVE", reason: input.reason }, requestId });
    return { ok: true as const, data: { id: String(created!._id), previousId: String(old._id) } };
  }));
}

type Row = {
  _id: Id; projectId: Id; contractorId: Id; agencyId: Id; role: string; status: string; startDate: Date; endDate?: Date | null; endReason?: string | null;
  contractReference?: string | null; contractValue?: { amountMinor: number; currency: string } | null; replacedByAssignmentId?: Id | null; notes?: string | null;
};
type ProjectLite = { _id: Id; projectCode: string; title: string; status: string; agencyId: Id; startDate?: Date | null; plannedEndDate?: Date | null; actualEndDate?: Date | null; location?: { district?: string; locality?: string; roadName?: string } | null };

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

function delayDays(p: ProjectLite, now: Date): number | null {
  if (!p.plannedEndDate) return null;
  const end = p.actualEndDate ?? (["COMPLETED", "CANCELLED"].includes(p.status) ? null : now);
  if (!end) return null;
  const days = Math.floor((end.getTime() - p.plannedEndDate.getTime()) / DAY);
  return days > 0 ? days : 0;
}

/** In-scope projects only. Money is included only for viewers who may see contract values. */
async function decorate(ctx: Ctx, rows: Row[]) {
  const projects = (await Project.find({ $and: [projectReadFilter(ctx.scope), { _id: { $in: rows.map((r) => r.projectId) } }] }).select("projectCode title status agencyId startDate plannedEndDate actualEndDate location").lean()) as unknown as ProjectLite[];
  const byProject = new Map(projects.map((p) => [String(p._id), p]));
  const inScope = rows.filter((r) => byProject.has(String(r.projectId)));
  const [agencies, inspections, contractors] = await Promise.all([
    agencyNames(projects.map((p) => p.agencyId)),
    Inspection.find({ projectId: { $in: inScope.map((r) => r.projectId) }, status: { $in: ["VERIFIED", "REJECTED", "REQUIRES_REVIEW"] } }).select("projectId status inspectionDate").sort({ inspectionDate: -1 }).lean(),
    Contractor.find({ _id: { $in: [...new Set(rows.flatMap((r) => [r.contractorId]))] } }).select("name registrationNumber status category registeredByAgencyId").lean(),
  ]);
  const cMap = new Map(contractors.map((c) => [String(c._id), c]));
  const values = contractValuesVisible(ctx.viewer);
  const now = new Date();
  const succ = new Map(inScope.map((r) => [String(r._id), r]));
  const out = inScope.map((r) => {
    const p = byProject.get(String(r.projectId))!;
    const window = inspections.filter((i) => String(i.projectId) === String(r.projectId) && i.inspectionDate >= r.startDate && (!r.endDate || i.inspectionDate <= r.endDate));
    const next = r.replacedByAssignmentId ? succ.get(String(r.replacedByAssignmentId)) : undefined;
    const c = cMap.get(String(r.contractorId));
    return {
      id: String(r._id), role: r.role, status: r.status, startDate: iso(r.startDate), endDate: iso(r.endDate), endReason: r.endReason ?? null, contractReference: r.contractReference ?? null,
      ...(values ? { contractValue: r.contractValue ? { amountMinor: r.contractValue.amountMinor, currency: r.contractValue.currency } : null } : {}),
      contractor: c ? { id: String(c._id), name: c.name, registrationNumber: c.registrationNumber, status: c.status, category: c.category ?? null } : null,
      project: { id: String(p._id), code: p.projectCode, title: p.title, status: p.status, agencyId: String(p.agencyId), agencyName: agencies.get(String(p.agencyId)) ?? null, plannedEndDate: iso(p.plannedEndDate), actualEndDate: iso(p.actualEndDate), startDate: iso(p.startDate), locationText: [p.location?.roadName, p.location?.locality, p.location?.district].filter(Boolean).join(", ") || null },
      delayDays: delayDays(p, now),
      // Coarse v1 outcome: the latest concluded inspection inside the assignment window. Batch 06 replaces this source.
      inspectionOutcome: window[0]?.status ?? null, inspectionCount: window.length,
      successor: next ? { assignmentId: String(next._id), contractorId: String(next.contractorId), name: cMap.get(String(next.contractorId))?.name ?? null } : null,
    };
  });
  return { rows: out, hidden: rows.length - inScope.length };
}

export function listContractorAssignments(actor: AuthenticatedActor, rawId: string, q: { view: "active" | "completed" | "all"; page: number; limit: number }) {
  return run(async (): Promise<Result<unknown>> => {
    if (!isId(rawId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    const doc = await Contractor.findById(rawId).select("registeredByAgencyId status").lean();
    if (!doc || !canSee(ctx.viewer, doc as unknown as ContractorLike, await assignedInScope(ctx, doc._id))) return notFound();
    const scoped = ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {};
    const filter = { contractorId: doc._id, ...scoped, ...(q.view === "active" ? { status: "ACTIVE" } : q.view === "completed" ? { status: { $ne: "ACTIVE" } } : {}) };
    const [rows, total, active, ended] = await Promise.all([
      ContractorAssignment.find(filter).sort({ startDate: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean() as unknown as Promise<Row[]>,
      ContractorAssignment.countDocuments(filter),
      ContractorAssignment.countDocuments({ contractorId: doc._id, ...scoped, status: "ACTIVE" }),
      ContractorAssignment.countDocuments({ contractorId: doc._id, ...scoped, status: { $ne: "ACTIVE" } }),
    ]);
    const d = await decorate(ctx, rows);
    return { ok: true, data: { rows: d.rows, total, page: q.page, limit: q.limit, counts: { active, ended }, basedOn: "projects you can access", valuesVisible: contractValuesVisible(ctx.viewer) } };
  });
}

export function listProjectContractors(actor: AuthenticatedActor, projectId: string) {
  return run(async (): Promise<Result<unknown>> => {
    if (!isId(projectId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    need(ctx, "project.read");
    const project = await Project.findOne({ $and: [projectReadFilter(ctx.scope), { _id: projectId }] }).select("status agencyId managerId").lean();
    if (!project) return notFound();
    const rows = (await ContractorAssignment.find({ projectId: project._id }).sort({ status: 1, startDate: -1 }).limit(100).lean()) as unknown as Row[];
    const d = await decorate(ctx, rows);
    const writable = ctx.viewer.canManage && Boolean(await Project.exists({ $and: [projectWriteFilter(actor, ctx.scope), { _id: project._id }] }));
    return { ok: true, data: { rows: d.rows, can: { assign: writable && !CLOSED_FOR_ASSIGNMENT.has(project.status), manage: writable }, projectStatus: project.status, valuesVisible: contractValuesVisible(ctx.viewer) } };
  });
}
