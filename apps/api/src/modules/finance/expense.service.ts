import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { run, type Ctx, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { readDocument } from "../identity/authorization/resource-scope.js";
import { User } from "../identity/models/user.model.js";
import { Project } from "../projects/models/project.model.js";
import { colomboToday, contextOf, duplicateKeyOf, Flow, inTransaction, isDuplicateKey, isId, lkr, loadProject, need, oid, touchProject, writeFinanceAudit, type Id, type ProjectDoc } from "./finance.common.js";
import { escapeRegex } from "../contractors/contractor.keys.js";
import type { ExpenseBody } from "./finance.schema.js";
import { ProjectExpense } from "./models/project-expense.model.js";
import { expenseDupActiveFor, expenseEditable, nextExpenseStatus } from "./payment.state.js";
import { nextNumber } from "../../shared/database/counter.js";

type ExpenseRow = {
  _id: Id; expenseNo: string; projectId: Id; agencyId: Id; category: string; description: string; expenseDate: Date; amount: { amountMinor: number }; contractorId?: Id | null; assignmentId?: Id | null;
  supplierName?: string | null; supportingRef: string; documentIds?: Id[]; status: string; submittedAt?: Date | null; verifiedBy?: Id | null; verifiedAt?: Date | null; rejectionReason?: string | null;
  reversal?: { by: Id; at: Date; reason: string } | null; createdBy: Id; createdAt?: Date;
};

/** Agency-level scope for lists: platform sees all, agency scopes see their agencies, everyone else nothing. */
export function agencyFilter(ctx: Ctx): Record<string, unknown> {
  if (ctx.scope.kind === "platform") return {};
  if (ctx.scope.kind === "agencies") return { agencyId: { $in: ctx.agencyObjectIds } };
  return { _id: { $in: [] } };
}

async function names(ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("firstName lastName").lean();
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

async function toDtos(ctx: Ctx, actor: AuthenticatedActor, rows: ExpenseRow[]) {
  const [people, projects, contractors] = await Promise.all([
    names(rows.flatMap((r) => [r.createdBy, r.verifiedBy, r.reversal?.by])),
    Project.find({ _id: { $in: rows.map((r) => r.projectId) } }).select("projectCode title").lean(),
    import("../contractors/models/contractor.model.js").then(({ Contractor }) => Contractor.find({ _id: { $in: rows.map((r) => r.contractorId).filter(Boolean) } }).select("name").lean()),
  ]);
  const pm = new Map(projects.map((p) => [String(p._id), p]));
  const cm = new Map(contractors.map((c) => [String(c._id), c.name]));
  const verifier = ctx.has("finance.expense.verify");
  return rows.map((r) => {
    const mine = String(r.createdBy) === actor.userId;
    return {
      id: String(r._id), expenseNo: r.expenseNo, projectId: String(r.projectId), project: { code: pm.get(String(r.projectId))?.projectCode ?? "", title: pm.get(String(r.projectId))?.title ?? "" },
      category: r.category, description: r.description, expenseDate: r.expenseDate.toISOString(), amountMinor: r.amount.amountMinor, currency: "LKR",
      contractor: r.contractorId ? { id: String(r.contractorId), name: cm.get(String(r.contractorId)) ?? null } : null, assignmentId: r.assignmentId ? String(r.assignmentId) : null,
      supplierName: r.supplierName ?? null, supportingRef: r.supportingRef, documentCount: r.documentIds?.length ?? 0, status: r.status,
      submittedAt: r.submittedAt?.toISOString() ?? null, verifiedBy: r.verifiedBy ? people.get(String(r.verifiedBy)) ?? null : null, verifiedAt: r.verifiedAt?.toISOString() ?? null,
      rejectionReason: r.rejectionReason ?? null, reversal: r.reversal ? { by: people.get(String(r.reversal.by)) ?? null, at: r.reversal.at.toISOString(), reason: r.reversal.reason } : null,
      createdBy: people.get(String(r.createdBy)) ?? null, createdAt: r.createdAt?.toISOString() ?? null,
      can: {
        edit: expenseEditable(r.status) && (mine || actor.roleKey === "GOV_ADMIN") && ctx.has("finance.expense.create"),
        submit: expenseEditable(r.status) && mine && ctx.has("finance.expense.create"),
        verify: r.status === "PENDING_VERIFICATION" && verifier && !mine, reject: r.status === "PENDING_VERIFICATION" && verifier && !mine,
        reverse: r.status === "VERIFIED" && verifier && !mine,
      },
    };
  });
}

async function validateLinks(ctx: Ctx, actor: AuthenticatedActor, project: ProjectDoc, b: Partial<ExpenseBody>, session?: import("mongoose").ClientSession) {
  if (b.assignmentId && !b.contractorId) throw new Flow(400, "VALIDATION_ERROR", { field: "contractorId" });
  if (b.contractorId) {
    const a = ContractorAssignment.findOne({ projectId: project._id, contractorId: b.contractorId, ...(b.assignmentId ? { _id: b.assignmentId } : {}) }).select("_id");
    if (session) a.session(session);
    if (!(await a.lean())) throw new Flow(400, "VALIDATION_ERROR", { field: "contractorId" });
  }
  if (b.documentIds?.length) {
    if (!ctx.has("document.read")) throw new Flow(400, "VALIDATION_ERROR", { field: "documentIds" });
    for (const d of b.documentIds) { const ok = await readDocument(actor, d); if (!ok.ok) throw new Flow(400, "VALIDATION_ERROR", { field: "documentIds" }); }
  }
  if (b.expenseDate && b.expenseDate.toISOString().slice(0, 10) > colomboToday()) throw new Flow(400, "VALIDATION_ERROR", { field: "expenseDate", kind: "future" });
}

const earlyWarning = (project: ProjectDoc, date: Date | undefined): string[] =>
  date && project.startDate && date.getTime() < project.startDate.getTime() - 30 * 86_400_000 ? ["EXPENSE_BEFORE_PROJECT_START"] : [];

export function createExpense(actor: AuthenticatedActor, projectId: string, b: ExpenseBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string; expenseNo: string; warnings: string[] }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "finance.expense.create");
    const project = await loadProject(ctx, actor, projectId, session, "write");
    await validateLinks(ctx, actor, project, b, session);
    const expenseNo = await nextNumber("EXP", new Date(), session);
    const [row] = await ProjectExpense.create([{
      expenseNo, projectId: project._id, agencyId: project.agencyId, category: b.category, description: b.description, expenseDate: b.expenseDate, amount: lkr(b.amount),
      ...(b.contractorId ? { contractorId: oid(b.contractorId) } : {}), ...(b.assignmentId ? { assignmentId: oid(b.assignmentId) } : {}), ...(b.supplierName ? { supplierName: b.supplierName } : {}),
      supportingRef: b.supportingRef, documentIds: b.documentIds.map(oid), status: "DRAFT", duplicateKey: duplicateKeyOf(projectId, b.supplierName, b.supportingRef, b.amount), createdBy: oid(actor.userId),
    }], { session });
    await writeFinanceAudit(session, { actor, action: "expense.created", resourceType: "EXPENSE", resourceId: row!._id, agencyId: project.agencyId, newValue: { status: "DRAFT", amount: lkr(b.amount) }, requestId });
    return { ok: true as const, data: { id: String(row!._id), expenseNo, warnings: earlyWarning(project, b.expenseDate) } };
  }));
}

async function loadExpense(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session?: import("mongoose").ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = ProjectExpense.findOne({ $and: [agencyFilter(ctx), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as unknown as ExpenseRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  // Re-apply project scope (PROJECT_MANAGER narrowing is checked by loadProject in write mode where needed).
  await loadProject(ctx, actor, String(row.projectId), session, "read");
  return row;
}

export function updateExpense(actor: AuthenticatedActor, id: string, b: Partial<ExpenseBody>, requestId: string) {
  return run(async (): Promise<Result<{ id: string; warnings: string[] }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "finance.expense.create");
    const row = await loadExpense(ctx, actor, id, session);
    if (!expenseEditable(row.status)) throw new Flow(409, "CONFLICT", { kind: "immutable", status: row.status });
    if (String(row.createdBy) !== actor.userId && actor.roleKey !== "GOV_ADMIN") throw new Flow(403, "FORBIDDEN");
    const project = await loadProject(ctx, actor, String(row.projectId), session, "write");
    await validateLinks(ctx, actor, project, b, session);
    await touchProject(session, project._id);
    const merged = { supplier: b.supplierName ?? row.supplierName ?? undefined, ref: b.supportingRef ?? row.supportingRef, amount: b.amount ?? row.amount.amountMinor };
    const set: Record<string, unknown> = { duplicateKey: duplicateKeyOf(String(row.projectId), merged.supplier, merged.ref, merged.amount) };
    if (b.category) set.category = b.category;
    if (b.description) set.description = b.description;
    if (b.expenseDate) set.expenseDate = b.expenseDate;
    if (b.amount) set.amount = lkr(b.amount);
    if (b.supplierName !== undefined) set.supplierName = b.supplierName;
    if (b.supportingRef) set.supportingRef = b.supportingRef;
    if (b.contractorId) set.contractorId = oid(b.contractorId);
    if (b.assignmentId) set.assignmentId = oid(b.assignmentId);
    if (b.documentIds) set.documentIds = b.documentIds.map(oid);
    const res = await ProjectExpense.updateOne({ _id: row._id, status: { $in: ["DRAFT", "REJECTED"] } }, { $set: set }, { session });
    if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "immutable" });
    await writeFinanceAudit(session, { actor, action: "expense.updated", resourceType: "EXPENSE", resourceId: row._id, agencyId: row.agencyId, newValue: { status: row.status }, requestId });
    return { ok: true as const, data: { id: String(row._id), warnings: earlyWarning(project, b.expenseDate) } };
  }));
}

type Transition = { action: "submit" | "verify" | "reject" | "reverse"; note?: string };
const AUDIT_ACTION = { submit: "expense.submitted", verify: "expense.verified", reject: "expense.rejected", reverse: "expense.reversed" } as const;

export function transitionExpense(actor: AuthenticatedActor, id: string, t: Transition, requestId: string) {
  return run(async (): Promise<Result<{ id: string; status: string; expenseNo: string }>> => {
    try {
      return await inTransaction(async (session) => {
        const ctx = await contextOf(actor, session);
        need(ctx, t.action === "submit" ? "finance.expense.create" : "finance.expense.verify");
        const row = await loadExpense(ctx, actor, id, session);
        const to = nextExpenseStatus(row.status, t.action);
        if (!to) throw new Flow(409, "CONFLICT", { kind: "illegal_transition", from: row.status });
        const mine = String(row.createdBy) === actor.userId;
        if (t.action === "submit" && !mine) throw new Flow(403, "FORBIDDEN", { kind: "creator_only" });
        if (t.action !== "submit" && mine) throw new Flow(403, "FORBIDDEN", { kind: "maker_checker" });
        const project = await loadProject(ctx, actor, String(row.projectId), session, "read");
        await touchProject(session, project._id);
        const now = new Date();
        const set: Record<string, unknown> = { status: to, dupActive: expenseDupActiveFor(to) };
        const unset: Record<string, 1> = {};
        if (t.action === "submit") { set.submittedAt = now; unset.rejectionReason = 1; }
        if (t.action === "verify") { set.verifiedBy = oid(actor.userId); set.verifiedAt = now; }
        if (t.action === "reject") set.rejectionReason = t.note;
        if (t.action === "reverse") set.reversal = { by: oid(actor.userId), at: now, reason: t.note };
        const res = await ProjectExpense.updateOne({ _id: row._id, status: row.status, ...(t.action !== "submit" ? { createdBy: { $ne: oid(actor.userId) } } : {}) }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { session });
        if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "illegal_transition" });
        await writeFinanceAudit(session, { actor, action: AUDIT_ACTION[t.action], resourceType: "EXPENSE", resourceId: row._id, agencyId: row.agencyId, oldValue: { status: row.status }, newValue: { status: to, amount: lkr(row.amount.amountMinor), ...(t.note ? { reason: t.note } : {}) }, requestId });
        return { ok: true as const, data: { id: String(row._id), status: to, expenseNo: row.expenseNo } };
      });
    } catch (e) {
      if (isDuplicateKey(e) && t.action === "submit") {
        const ctx = await contextOf(actor);
        const mine = (await ProjectExpense.findById(id).lean()) as unknown as ExpenseRow | null;
        const existing = mine ? ((await ProjectExpense.findOne({ $and: [agencyFilter(ctx), { duplicateKey: (mine as unknown as { duplicateKey: string }).duplicateKey, dupActive: true }] }).select("expenseNo").lean()) as { expenseNo: string } | null) : null;
        throw new Flow(409, "CONFLICT", { kind: "duplicate", existingExpenseNo: existing?.expenseNo ?? null });
      }
      throw e;
    }
  });
}

export function getExpense(actor: AuthenticatedActor, id: string) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.expense.read");
    const row = await loadExpense(ctx, actor, id);
    return { ok: true, data: (await toDtos(ctx, actor, [row]))[0] };
  });
}

export function expenseFilter(ctx: Ctx, q: { projectId?: string; category?: string; status?: string[]; contractorId?: string; dateFrom?: string; dateTo?: string; amountMin?: number; amountMax?: number; q?: string; needsMyVerification?: boolean }, actor: AuthenticatedActor) {
  const and: Record<string, unknown>[] = [agencyFilter(ctx)];
  if (q.projectId) and.push({ projectId: oid(q.projectId) });
  if (q.category) and.push({ category: q.category });
  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.contractorId) and.push({ contractorId: oid(q.contractorId) });
  if (q.dateFrom || q.dateTo) and.push({ expenseDate: { ...(q.dateFrom ? { $gte: new Date(`${q.dateFrom}T00:00:00Z`) } : {}), ...(q.dateTo ? { $lte: new Date(`${q.dateTo}T23:59:59Z`) } : {}) } });
  if (q.amountMin !== undefined || q.amountMax !== undefined) and.push({ "amount.amountMinor": { ...(q.amountMin !== undefined ? { $gte: q.amountMin } : {}), ...(q.amountMax !== undefined ? { $lte: q.amountMax } : {}) } });
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), "i"); and.push({ $or: [{ expenseNo: rx }, { supportingRef: rx }, { supplierName: rx }, { description: rx }] }); }
  if (q.needsMyVerification) and.push({ status: "PENDING_VERIFICATION", createdBy: { $ne: oid(actor.userId) } });
  return { $and: and };
}

export function listExpenses(actor: AuthenticatedActor, q: Parameters<typeof expenseFilter>[1] & { sort: "date" | "amount"; page: number; limit: number }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.expense.read");
    const filter = expenseFilter(ctx, q, actor);
    const sort: Record<string, 1 | -1> = q.sort === "amount" ? { "amount.amountMinor": -1, _id: 1 } : { expenseDate: -1, _id: 1 };
    const [rows, total, counts] = await Promise.all([
      ProjectExpense.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean() as unknown as Promise<ExpenseRow[]>,
      ProjectExpense.countDocuments(filter).maxTimeMS(8000),
      ProjectExpense.aggregate<{ _id: string; n: number }>([{ $match: { $and: [agencyFilter(ctx), ...(q.projectId ? [{ projectId: oid(q.projectId) }] : [])] } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
    ]);
    const mineToVerify = ctx.has("finance.expense.verify") ? await ProjectExpense.countDocuments({ $and: [agencyFilter(ctx), { status: "PENDING_VERIFICATION", createdBy: { $ne: oid(actor.userId) } }] }) : null;
    return { ok: true, data: { rows: await toDtos(ctx, actor, rows), total, page: q.page, limit: q.limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])), needsMyVerification: mineToVerify } };
  });
}
