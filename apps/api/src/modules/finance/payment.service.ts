import type { ClientSession } from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { escapeRegex } from "../contractors/contractor.keys.js";
import { run, type Ctx, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { User } from "../identity/models/user.model.js";
import { Project } from "../projects/models/project.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import { activeAssignmentFor, approversOf, contextOf, Flow, inTransaction, isDuplicateKey, isId, lkr, loadProject, need, notifyUsers, oid, paymentTotals, syncFinancialProgress, touchProject, writeFinanceAudit, type Id, type ProjectDoc } from "./finance.common.js";
import { agencyFilter } from "./expense.service.js";
import type { PaymentBody } from "./finance.schema.js";
import { blocked, evaluateGates, warnings, type Gate, type GateInput } from "./payment.gates.js";
import { dupActiveFor, nextPaymentStatus, type PaymentAction, type PaymentStatus } from "./payment.state.js";
import { physicalProgressOf } from "./physical-progress.source.js";
import { ProjectPayment } from "./models/project-payment.model.js";

export type PayRow = {
  _id: Id; paymentNo?: string | null; projectId: Id; agencyId?: Id | null; contractorId: Id; assignmentId?: Id | null; amount: { amountMinor: number }; paymentType: string; status: PaymentStatus;
  invoiceReference?: string | null; description?: string | null; approvedBy?: Id | null; date: Date; requestedAt?: Date | null; decidedAt?: Date | null; decisionNote?: string | null;
  paidAt?: Date | null; paidBy?: Id | null; paymentReference?: string | null; cancelledAt?: Date | null; cancelReason?: string | null; reversal?: { by: Id; at: Date; reason: string } | null; createdBy: Id; createdAt?: Date;
};

/** Everything a gate needs, read inside the caller's transaction when there is one. */
export async function gateInputFor(project: ProjectDoc, p: { contractorId: Id; assignmentId?: string; paymentType: string; amountMinor: number; invoiceReference?: string | null; selfId?: Id; alreadyCountedMinor?: number; requesterId?: Id | null; actorId?: string | null }, session?: ClientSession): Promise<GateInput> {
  const cq = Contractor.findById(p.contractorId).select("status");
  if (session) cq.session(session);
  const contractor = (await cq.lean()) as { status: string } | null;
  const assignment = await activeAssignmentFor(project._id, p.contractorId, p.assignmentId, session);
  const totals = await paymentTotals(project._id, session);
  let cumulative = 0;
  if (assignment) {
    const agg = ProjectPayment.aggregate<{ s: number }>([{ $match: { assignmentId: assignment._id, status: { $in: ["APPROVED", "PAID"] } } }, { $group: { _id: null, s: { $sum: "$amount.amountMinor" } } }]);
    if (session) agg.session(session);
    cumulative = (await agg)[0]?.s ?? 0;
  }
  let dup = false;
  if (p.invoiceReference) {
    const d = ProjectPayment.exists({ projectId: project._id, contractorId: p.contractorId, invoiceReference: p.invoiceReference, dupActive: true, ...(p.selfId ? { _id: { $ne: p.selfId } } : {}) });
    if (session) d.session(session);
    dup = Boolean(await d);
  }
  const progress = await physicalProgressOf(project._id, session);
  return {
    paymentType: p.paymentType, amountMinor: p.amountMinor, projectStatus: project.status, contractor, hasAssignment: Boolean(assignment), budgetMinor: project.budget.amountMinor,
    paidMinor: totals.paidMinor, approvedUnpaidMinor: totals.approvedUnpaidMinor, alreadyCountedMinor: p.alreadyCountedMinor ?? 0,
    contractValueMinor: assignment?.contractValue?.amountMinor ?? null, assignmentCumulativeMinor: cumulative, duplicateInvoice: dup,
    progress: { valueBp: progress.valueBp, basis: progress.basis }, actorIsRequester: p.actorId && p.requesterId ? String(p.requesterId) === p.actorId : null,
  };
}

const warnKeys = (g: Gate[]) => warnings(g).map((x) => x.key).join(",");

export function previewGates(actor: AuthenticatedActor, q: { projectId: string; contractorId: string; assignmentId?: string; paymentType: string; amount: number; invoiceReference?: string }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.payment.create");
    const project = await loadProject(ctx, actor, q.projectId, undefined, "write");
    const gates = evaluateGates(await gateInputFor(project, { contractorId: oid(q.contractorId), assignmentId: q.assignmentId, paymentType: q.paymentType, amountMinor: q.amount, invoiceReference: q.invoiceReference }));
    return { ok: true, data: { gates, canSubmit: blocked(gates).length === 0, hasWarnings: warnings(gates).length > 0 } };
  });
}

export function requestPayment(actor: AuthenticatedActor, projectId: string, b: PaymentBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string; paymentNo: string; gates: Gate[] }>> => {
    try {
      return await inTransaction(async (session) => {
        const ctx = await contextOf(actor, session);
        need(ctx, "finance.payment.create");
        const project = await loadProject(ctx, actor, projectId, session, "write");
        await touchProject(session, project._id);
        const assignment = await activeAssignmentFor(project._id, oid(b.contractorId), b.assignmentId, session);
        const gates = evaluateGates(await gateInputFor(project, { contractorId: oid(b.contractorId), assignmentId: b.assignmentId, paymentType: b.paymentType, amountMinor: b.amount, invoiceReference: b.invoiceReference }, session));
        if (blocked(gates).length) throw new Flow(409, "CONFLICT", { kind: "gates_blocked", gates });
        const recent = await ProjectPayment.findOne({ projectId: project._id, contractorId: oid(b.contractorId), "amount.amountMinor": b.amount, date: b.date, paymentType: b.paymentType, status: "PENDING", createdAt: { $gte: new Date(Date.now() - 24 * 3_600_000) } }).select("paymentNo").session(session).lean();
        if (recent) throw new Flow(409, "CONFLICT", { kind: "duplicate_recent", existingId: String(recent._id), existingPaymentNo: recent.paymentNo ?? null });
        const paymentNo = await nextNumber("PAY", new Date(), session);
        const [row] = await ProjectPayment.create([{
          paymentNo, projectId: project._id, agencyId: project.agencyId, contractorId: oid(b.contractorId), ...(assignment ? { assignmentId: assignment._id } : {}), amount: lkr(b.amount), paymentType: b.paymentType, status: "PENDING",
          invoiceReference: b.invoiceReference, ...(b.description ? { description: b.description } : {}), date: b.date, requestedAt: new Date(), dupActive: true, createdBy: oid(actor.userId),
        }], { session });
        await writeFinanceAudit(session, { actor, action: "payment.requested", resourceType: "PAYMENT", resourceId: row!._id, agencyId: project.agencyId, newValue: { status: "PENDING", amount: lkr(b.amount), contractorId: oid(b.contractorId), ...(warnings(gates).length ? { reason: `warnings: ${warnKeys(gates)}` } : {}) }, requestId });
        void approversOf(project.agencyId, "finance.payment.approve").then((u) => notifyUsers(u.filter((x) => String(x) !== actor.userId), { type: "APPROVAL", title: "Payment awaiting approval", message: `${paymentNo} (${project.projectCode}) was requested.`, resource: { type: "PAYMENT", id: row!._id }, eventKey: `PAY:${row!._id}:req` }));
        return { ok: true as const, data: { id: String(row!._id), paymentNo, gates } };
      });
    } catch (e) {
      if (isDuplicateKey(e)) throw new Flow(409, "CONFLICT", { kind: "duplicate_invoice" });
      throw e;
    }
  });
}

async function loadPayment(ctx: Ctx, rawId: string, session?: ClientSession): Promise<PayRow> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = ProjectPayment.findOne({ $and: [agencyFilter(ctx), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as unknown as PayRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  return row;
}

export function updatePayment(actor: AuthenticatedActor, id: string, b: Partial<PaymentBody>, requestId: string) {
  return run(async (): Promise<Result<{ id: string }>> => {
    try {
      return await inTransaction(async (session) => {
        const ctx = await contextOf(actor, session);
        need(ctx, "finance.payment.update");
        const row = await loadPayment(ctx, id, session);
        if (row.status !== "PENDING") throw new Flow(409, "CONFLICT", { kind: "illegal_transition", from: row.status });
        if (String(row.createdBy) !== actor.userId) throw new Flow(403, "FORBIDDEN", { kind: "own_only" });
        const project = await loadProject(ctx, actor, String(row.projectId), session, "write");
        await touchProject(session, project._id);
        const next = { paymentType: b.paymentType ?? row.paymentType, amount: b.amount ?? row.amount.amountMinor, invoiceReference: b.invoiceReference ?? row.invoiceReference ?? undefined, date: b.date ?? row.date };
        const gates = evaluateGates(await gateInputFor(project, { contractorId: row.contractorId, assignmentId: row.assignmentId ? String(row.assignmentId) : undefined, paymentType: next.paymentType, amountMinor: next.amount, invoiceReference: next.invoiceReference, selfId: row._id }, session));
        if (blocked(gates).length) throw new Flow(409, "CONFLICT", { kind: "gates_blocked", gates });
        const set: Record<string, unknown> = { paymentType: next.paymentType, amount: lkr(next.amount), date: next.date };
        if (b.invoiceReference) set.invoiceReference = b.invoiceReference;
        if (b.description !== undefined) set.description = b.description;
        const res = await ProjectPayment.updateOne({ _id: row._id, status: "PENDING", createdBy: oid(actor.userId) }, { $set: set }, { session });
        if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "illegal_transition" });
        await writeFinanceAudit(session, { actor, action: "payment.updated", resourceType: "PAYMENT", resourceId: row._id, agencyId: project.agencyId, newValue: { status: "PENDING", amount: lkr(next.amount) }, requestId });
        return { ok: true as const, data: { id: String(row._id) } };
      });
    } catch (e) {
      if (isDuplicateKey(e)) throw new Flow(409, "CONFLICT", { kind: "duplicate_invoice" });
      throw e;
    }
  });
}

export type PayAction = { action: PaymentAction; note?: string; acknowledgeWarnings?: boolean; paidAt?: Date; paymentReference?: string };
const AUDIT_ACTION: Record<PaymentAction, string> = { approve: "payment.approved", reject: "payment.rejected", cancel: "payment.cancelled", "mark-paid": "payment.paid", reverse: "payment.reversed" };

/**
 * One atomic transition. The project's financeVersion is touched first, so two concurrent approvals for the same project conflict and the loser
 * re-reads committed totals and re-evaluates the gates. The update names the expected status in its filter; the audit row, the project cache and
 * the status change all commit together or not at all.
 */
export function transitionPayment(actor: AuthenticatedActor, id: string, t: PayAction, requestId: string) {
  return run(async (): Promise<Result<{ id: string; paymentNo: string | null; status: string; warnings: string[] }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    const perm = t.action === "approve" ? "finance.payment.approve" : t.action === "reject" ? "finance.payment.reject" : t.action === "reverse" ? "finance.payment.approve" : t.action === "cancel" ? "finance.payment.update" : "finance.payment.update";
    if (t.action === "cancel") { if (!(ctx.has("finance.payment.update") || ctx.has("finance.payment.approve"))) throw new Flow(403, "FORBIDDEN"); } else need(ctx, perm);
    const row = await loadPayment(ctx, id, session);
    const project = await loadProject(ctx, actor, String(row.projectId), session, t.action === "mark-paid" ? "write" : "read");
    await touchProject(session, project._id);
    const to = nextPaymentStatus(row.status, t.action);
    if (!to) throw new Flow(409, "CONFLICT", { kind: "illegal_transition", from: row.status });
    const mine = String(row.createdBy) === actor.userId;
    if ((t.action === "approve" || t.action === "reject" || t.action === "reverse") && mine) throw new Flow(403, "FORBIDDEN", { kind: "maker_checker" });
    if (t.action === "reverse" && row.paidBy && String(row.paidBy) === actor.userId) throw new Flow(403, "FORBIDDEN", { kind: "maker_checker" });
    if (t.action === "cancel" && !mine && !ctx.has("finance.payment.approve")) throw new Flow(403, "FORBIDDEN", { kind: "own_or_approver" });
    if ((t.action === "reject" || t.action === "cancel" || t.action === "reverse") && !t.note) throw new Flow(400, "VALIDATION_ERROR", { field: "note" });
    if (t.action === "mark-paid") {
      if (!t.paymentReference) throw new Flow(400, "VALIDATION_ERROR", { field: "paymentReference" });
      if (!t.paidAt || t.paidAt.getTime() > Date.now() + 5 * 60_000) throw new Flow(400, "VALIDATION_ERROR", { field: "paidAt" });
    }
    let reason = t.note;
    if (t.action === "approve" || t.action === "mark-paid") {
      const gates = evaluateGates(await gateInputFor(project, { contractorId: row.contractorId, assignmentId: row.assignmentId ? String(row.assignmentId) : undefined, paymentType: row.paymentType, amountMinor: row.amount.amountMinor, invoiceReference: row.invoiceReference, selfId: row._id, alreadyCountedMinor: t.action === "mark-paid" ? row.amount.amountMinor : 0, requesterId: t.action === "approve" ? row.createdBy : null, actorId: actor.userId }, session));
      const hard = blocked(gates);
      if (hard.length) throw new Flow(409, "CONFLICT", { kind: "gates_blocked", gates });
      const warn = warnings(gates);
      if (t.action === "approve" && warn.length && !t.acknowledgeWarnings) throw new Flow(409, "CONFLICT", { kind: "warnings_ack_required", gates });
      if (warn.length) reason = `warnings: ${warnKeys(gates)}${t.note ? ` | ${t.note}` : ""}`.slice(0, 500);
    }
    const now = new Date();
    const set: Record<string, unknown> = { status: to };
    const dupActive = dupActiveFor(to);
    if (!dupActive) set.dupActive = false;
    if (t.action === "approve") { set.approvedBy = oid(actor.userId); set.decidedAt = now; if (t.note) set.decisionNote = t.note; }
    if (t.action === "reject") { set.decidedAt = now; set.decisionNote = t.note; }
    if (t.action === "cancel") { set.cancelledAt = now; set.cancelReason = t.note; }
    if (t.action === "mark-paid") { set.paidAt = t.paidAt; set.paidBy = oid(actor.userId); set.paymentReference = t.paymentReference; }
    if (t.action === "reverse") set.reversal = { by: oid(actor.userId), at: now, reason: t.note };
    const filter: Record<string, unknown> = { _id: row._id, status: row.status };
    if (t.action === "approve" || t.action === "reject") filter.createdBy = { $ne: oid(actor.userId) };
    const res = await ProjectPayment.updateOne(filter, { $set: set }, { session });
    if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "illegal_transition" });
    if (t.action === "mark-paid" || t.action === "reverse") await syncFinancialProgress(project._id, session);
    await writeFinanceAudit(session, { actor, action: AUDIT_ACTION[t.action], resourceType: "PAYMENT", resourceId: row._id, agencyId: project.agencyId, oldValue: { status: row.status }, newValue: { status: to, amount: lkr(row.amount.amountMinor), contractorId: row.contractorId, ...(reason ? { reason } : {}) }, requestId });
    void notifyUsers([row.createdBy], { type: "APPROVAL", title: `Payment ${to.toLowerCase()}`, message: `${row.paymentNo ?? "Payment"} (${project.projectCode}) is now ${to.toLowerCase()}.`, resource: { type: "PAYMENT", id: row._id }, eventKey: `PAY:${row._id}:${to}` });
    return { ok: true as const, data: { id: String(row._id), paymentNo: row.paymentNo ?? null, status: to, warnings: reason?.startsWith("warnings:") ? reason.slice(10).split(" | ")[0]!.split(",") : [] } };
  }));
}

async function toDtos(ctx: Ctx, actor: AuthenticatedActor, rows: PayRow[]) {
  const [projects, contractors, people] = await Promise.all([
    Project.find({ _id: { $in: rows.map((r) => r.projectId) } }).select("projectCode title status").lean(),
    Contractor.find({ _id: { $in: rows.map((r) => r.contractorId) } }).select("name registrationNumber status").lean(),
    User.find({ _id: { $in: rows.flatMap((r) => [r.createdBy, r.approvedBy, r.paidBy, r.reversal?.by].filter(Boolean)) } }).select("firstName lastName").lean(),
  ]);
  const pm = new Map(projects.map((p) => [String(p._id), p]));
  const cm = new Map(contractors.map((c) => [String(c._id), c]));
  const name = (id: unknown) => { const u = people.find((p) => String(p._id) === String(id)); return u ? `${u.firstName} ${u.lastName}`.trim() : null; };
  return rows.map((r) => {
    const mine = String(r.createdBy) === actor.userId;
    const c = cm.get(String(r.contractorId));
    return {
      id: String(r._id), paymentNo: r.paymentNo ?? null, projectId: String(r.projectId), project: { code: pm.get(String(r.projectId))?.projectCode ?? "", title: pm.get(String(r.projectId))?.title ?? "", status: pm.get(String(r.projectId))?.status ?? "" },
      contractor: c ? { id: String(c._id), name: c.name, status: c.status } : null, assignmentId: r.assignmentId ? String(r.assignmentId) : null, paymentType: r.paymentType, status: r.status,
      amountMinor: r.amount.amountMinor, currency: "LKR", invoiceReference: r.invoiceReference ?? null, description: r.description ?? null, date: r.date.toISOString(), requestedAt: (r.requestedAt ?? r.createdAt)?.toISOString() ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote ?? null, paidAt: r.paidAt?.toISOString() ?? null, paymentReference: r.paymentReference ?? null, cancelReason: r.cancelReason ?? null,
      reversal: r.reversal ? { by: name(r.reversal.by), at: r.reversal.at.toISOString(), reason: r.reversal.reason } : null, createdBy: name(r.createdBy), approvedBy: name(r.approvedBy), paidBy: name(r.paidBy),
      can: {
        edit: r.status === "PENDING" && mine && ctx.has("finance.payment.update"),
        approve: r.status === "PENDING" && ctx.has("finance.payment.approve") && !mine, reject: r.status === "PENDING" && ctx.has("finance.payment.reject") && !mine,
        cancel: (r.status === "PENDING" || r.status === "APPROVED") && ((mine && ctx.has("finance.payment.update")) || ctx.has("finance.payment.approve")),
        markPaid: r.status === "APPROVED" && ctx.has("finance.payment.update"),
        reverse: r.status === "PAID" && ctx.has("finance.payment.approve") && !mine && String(r.paidBy) !== actor.userId,
      },
    };
  });
}

export function paymentFilter(ctx: Ctx, actor: AuthenticatedActor, q: { projectId?: string; status?: string[]; type?: string; contractorId?: string; agencyId?: string; dateFrom?: string; dateTo?: string; amountMin?: number; amountMax?: number; q?: string; needsMyApproval?: boolean }) {
  const and: Record<string, unknown>[] = [agencyFilter(ctx)];
  if (q.projectId) and.push({ projectId: oid(q.projectId) });
  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.type) and.push({ paymentType: q.type });
  if (q.contractorId) and.push({ contractorId: oid(q.contractorId) });
  if (q.agencyId) and.push({ agencyId: oid(q.agencyId) });
  if (q.dateFrom || q.dateTo) and.push({ date: { ...(q.dateFrom ? { $gte: new Date(`${q.dateFrom}T00:00:00Z`) } : {}), ...(q.dateTo ? { $lte: new Date(`${q.dateTo}T23:59:59Z`) } : {}) } });
  if (q.amountMin !== undefined || q.amountMax !== undefined) and.push({ "amount.amountMinor": { ...(q.amountMin !== undefined ? { $gte: q.amountMin } : {}), ...(q.amountMax !== undefined ? { $lte: q.amountMax } : {}) } });
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), "i"); and.push({ $or: [{ paymentNo: rx }, { invoiceReference: rx }, { paymentReference: rx }] }); }
  if (q.needsMyApproval) and.push({ status: "PENDING", createdBy: { $ne: oid(actor.userId) } });
  return { $and: and };
}

export function listPayments(actor: AuthenticatedActor, q: Parameters<typeof paymentFilter>[2] & { sort: "date" | "amount"; page: number; limit: number }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.payment.read");
    const filter = paymentFilter(ctx, actor, q);
    const sort: Record<string, 1 | -1> = q.sort === "amount" ? { "amount.amountMinor": -1, _id: 1 } : { date: -1, _id: 1 };
    const scopeOnly = { $and: [agencyFilter(ctx), ...(q.projectId ? [{ projectId: oid(q.projectId) }] : [])] };
    const [rows, total, counts, mine] = await Promise.all([
      ProjectPayment.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean() as unknown as Promise<PayRow[]>,
      ProjectPayment.countDocuments(filter).maxTimeMS(8000),
      ProjectPayment.aggregate<{ _id: string; n: number }>([{ $match: scopeOnly }, { $group: { _id: "$status", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
      ctx.has("finance.payment.approve") ? ProjectPayment.countDocuments({ $and: [agencyFilter(ctx), { status: "PENDING", createdBy: { $ne: oid(actor.userId) } }] }) : Promise.resolve(null),
    ]);
    return { ok: true, data: { rows: await toDtos(ctx, actor, rows), total, page: q.page, limit: q.limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])), needsMyApproval: mine } };
  });
}

export function getPayment(actor: AuthenticatedActor, id: string) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.payment.read");
    const row = await loadPayment(ctx, id);
    const project = await loadProject(ctx, actor, String(row.projectId), undefined, "read");
    const [dto] = await toDtos(ctx, actor, [row]);
    const live = row.status === "PENDING" || row.status === "APPROVED";
    const gates = live ? evaluateGates(await gateInputFor(project, { contractorId: row.contractorId, assignmentId: row.assignmentId ? String(row.assignmentId) : undefined, paymentType: row.paymentType, amountMinor: row.amount.amountMinor, invoiceReference: row.invoiceReference, selfId: row._id, alreadyCountedMinor: row.status === "APPROVED" ? row.amount.amountMinor : 0, requesterId: row.createdBy, actorId: actor.userId })) : [];
    const audit = await AuditLog.find({ resourceType: "PAYMENT", resourceId: row._id }).select("+newValue").sort({ timestamp: 1 }).limit(50).lean();
    const people = await User.find({ _id: { $in: audit.map((a) => a.userId).filter(Boolean) } }).select("firstName lastName").lean();
    let cap: { contractValueMinor: number | null; cumulativeMinor: number } | null = null;
    if (row.assignmentId) {
      const a = await ContractorAssignment.findById(row.assignmentId).select("contractValue").lean();
      const agg = await ProjectPayment.aggregate<{ s: number }>([{ $match: { assignmentId: row.assignmentId, status: { $in: ["APPROVED", "PAID"] } } }, { $group: { _id: null, s: { $sum: "$amount.amountMinor" } } }]);
      cap = { contractValueMinor: a?.contractValue?.amountMinor ?? null, cumulativeMinor: agg[0]?.s ?? 0 };
    }
    return { ok: true, data: { ...dto, gates, contractCap: cap, timeline: audit.map((a) => ({ action: a.action, at: (a.timestamp ?? new Date(0)).toISOString(), by: (() => { const u = people.find((p) => String(p._id) === String(a.userId)); return u ? `${u.firstName} ${u.lastName}`.trim() : null; })(), status: a.newValue?.status ?? null, note: a.newValue?.reason ?? null })) } };
  });
}
