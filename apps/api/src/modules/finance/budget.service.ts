import type { ClientSession } from "mongoose";

import { run, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { User } from "../identity/models/user.model.js";
import { Project } from "../projects/models/project.model.js";
import { approversOf, contextOf, expenseTotals, Flow, inTransaction, isDuplicateKey, isId, lkr, loadProject, need, notifyUsers, oid, paymentTotals, syncFinancialProgress, touchProject, writeFinanceAudit, type Id, type ProjectDoc } from "./finance.common.js";
import { overBy, ratioBp } from "./finance.money.js";
import type { RevisionBody } from "./finance.schema.js";
import { ProjectBudgetRevision } from "./models/project-budget-revision.model.js";

/** From APPROVED onward the project budget changes only through revisions. Before that the normal project edit owns the budget. */
const REVISABLE = new Set(["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"]);

type Alloc = { category: string; amount: number };
type Impact = {
  currentTotalMinor: number; proposedTotalMinor: number; committedMinor: number; paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number;
  newUtilizationBp: number | null; newRemainingMinor: number; allocatedMinor: number; unallocatedMinor: number; blocking: { code: string; belowByMinor?: number }[];
};

async function impactOf(project: ProjectDoc, newTotal: number, allocs: Alloc[], session?: ClientSession): Promise<Impact> {
  const t = await paymentTotals(project._id, session);
  const committed = Number(BigInt(t.paidMinor) + BigInt(t.approvedUnpaidMinor));
  const allocated = allocs.reduce((s, a) => s + BigInt(a.amount), 0n);
  const blocking: Impact["blocking"] = [];
  if (committed > newTotal) blocking.push({ code: "BELOW_COMMITMENTS", belowByMinor: overBy(committed, newTotal) });
  if (allocated > BigInt(newTotal)) blocking.push({ code: "ALLOCATIONS_EXCEED_TOTAL" });
  return {
    currentTotalMinor: project.budget.amountMinor, proposedTotalMinor: newTotal, committedMinor: committed, paidMinor: t.paidMinor, approvedUnpaidMinor: t.approvedUnpaidMinor, pendingMinor: t.pendingMinor,
    newUtilizationBp: ratioBp(committed, newTotal), newRemainingMinor: committed > newTotal ? 0 : newTotal - committed, allocatedMinor: Number(allocated), unallocatedMinor: Number(BigInt(newTotal) - allocated), blocking,
  };
}

async function ensureInitial(project: ProjectDoc, session: ClientSession): Promise<void> {
  if (await ProjectBudgetRevision.exists({ projectId: project._id }).session(session)) return;
  await ProjectBudgetRevision.create([{
    projectId: project._id, agencyId: project.agencyId, sequence: 1, kind: "INITIAL", status: "APPROVED", previousTotal: lkr(0), newTotal: lkr(project.budget.amountMinor), allocations: [],
    requestedAt: new Date(), decidedAt: new Date(), decisionNote: "Backfilled from project budget",
  }], { session });
}

const allocsOf = (b: RevisionBody): Alloc[] => b.allocations.map((a) => ({ category: a.category, amount: a.amount }));

export function previewRevision(actor: AuthenticatedActor, projectId: string, body: RevisionBody) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.budget.update");
    const project = await loadProject(ctx, actor, projectId, undefined, "write");
    return { ok: true, data: await impactOf(project, body.newTotal, allocsOf(body)) };
  });
}

export function requestRevision(actor: AuthenticatedActor, projectId: string, body: RevisionBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string; sequence: number }>> => {
    try {
      return await inTransaction(async (session) => {
        const ctx = await contextOf(actor, session);
        need(ctx, "finance.budget.update");
        const project = await loadProject(ctx, actor, projectId, session, "write");
        if (!REVISABLE.has(project.status)) throw new Flow(409, "CONFLICT", { kind: "use_project_edit", status: project.status });
        await touchProject(session, project._id);
        await ensureInitial(project, session);
        if (await ProjectBudgetRevision.exists({ projectId: project._id, status: "PENDING_APPROVAL" }).session(session)) throw new Flow(409, "CONFLICT", { kind: "revision_pending" });
        const impact = await impactOf(project, body.newTotal, allocsOf(body), session);
        if (impact.blocking.length) throw new Flow(409, "CONFLICT", { kind: impact.blocking[0]!.code, impact });
        const last = await ProjectBudgetRevision.findOne({ projectId: project._id }).sort({ sequence: -1 }).select("sequence").session(session).lean();
        const [row] = await ProjectBudgetRevision.create([{
          projectId: project._id, agencyId: project.agencyId, sequence: (last?.sequence ?? 0) + 1, kind: "REVISION", status: "PENDING_APPROVAL", previousTotal: lkr(project.budget.amountMinor), newTotal: lkr(body.newTotal),
          allocations: body.allocations.map((a) => ({ category: a.category, amount: lkr(a.amount) })), reason: body.reason, requestedBy: oid(actor.userId), requestedAt: new Date(),
        }], { session });
        await writeFinanceAudit(session, { actor, action: "budget.revision_requested", resourceType: "BUDGET", resourceId: row!._id, agencyId: project.agencyId, oldValue: { budget: lkr(project.budget.amountMinor) }, newValue: { budget: lkr(body.newTotal), status: "PENDING_APPROVAL", reason: body.reason }, requestId });
        notifyAfter(project, row!._id, actor, "requested");
        return { ok: true as const, data: { id: String(row!._id), sequence: row!.sequence } };
      });
    } catch (e) {
      if (isDuplicateKey(e)) throw new Flow(409, "CONFLICT", { kind: "revision_pending" });
      throw e;
    }
  });
}

function notifyAfter(project: ProjectDoc, revisionId: Id, actor: AuthenticatedActor, kind: "requested" | "approved" | "rejected", requester?: Id) {
  void (async () => {
    const to = kind === "requested" ? (await approversOf(project.agencyId, "finance.budget.approve")).filter((u) => String(u) !== actor.userId) : requester ? [requester] : [];
    await notifyUsers(to, { type: "APPROVAL", title: `Budget revision ${kind}`, message: `${project.projectCode}: budget revision ${kind}.`, resource: { type: "PROJECT", id: project._id }, eventKey: `BR:${revisionId}:${kind}` });
  })();
}

export function decideRevision(actor: AuthenticatedActor, projectId: string, revisionId: string, decision: "approve" | "reject", note: string | undefined, requestId: string) {
  return run(async (): Promise<Result<{ id: string; status: string }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "finance.budget.approve");
    const project = await loadProject(ctx, actor, projectId, session, "read");
    if (!isId(revisionId)) throw new Flow(404, "NOT_FOUND");
    await touchProject(session, project._id);
    const rev = await ProjectBudgetRevision.findOne({ _id: revisionId, projectId: project._id }).session(session).lean();
    if (!rev) throw new Flow(404, "NOT_FOUND");
    if (rev.status !== "PENDING_APPROVAL") throw new Flow(409, "CONFLICT", { kind: "not_pending", status: rev.status });
    if (String(rev.requestedBy) === actor.userId) throw new Flow(403, "FORBIDDEN", { kind: "maker_checker" });
    const next = decision === "approve" ? "APPROVED" : "REJECTED";
    if (decision === "approve") {
      const impact = await impactOf(project, rev.newTotal.amountMinor, rev.allocations.map((a) => ({ category: a.category, amount: a.amount.amountMinor })), session);
      if (impact.blocking.length) throw new Flow(409, "CONFLICT", { kind: impact.blocking[0]!.code, impact });
    }
    const res = await ProjectBudgetRevision.updateOne({ _id: rev._id, status: "PENDING_APPROVAL" }, { $set: { status: next, decidedBy: oid(actor.userId), decidedAt: new Date(), ...(note ? { decisionNote: note } : {}) } }, { session });
    if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "not_pending" });
    if (decision === "approve") {
      await Project.updateOne({ _id: project._id }, { $set: { budget: lkr(rev.newTotal.amountMinor) } }, { session });
      await syncFinancialProgress(project._id, session);
    }
    await writeFinanceAudit(session, { actor, action: decision === "approve" ? "budget.revision_approved" : "budget.revision_rejected", resourceType: "BUDGET", resourceId: rev._id, agencyId: project.agencyId, oldValue: { budget: lkr(project.budget.amountMinor) }, newValue: { budget: lkr(decision === "approve" ? rev.newTotal.amountMinor : project.budget.amountMinor), status: next, ...(note ? { reason: note } : {}) }, requestId });
    if (rev.requestedBy) notifyAfter(project, rev._id, actor, decision === "approve" ? "approved" : "rejected", rev.requestedBy as Id);
    return { ok: true as const, data: { id: String(rev._id), status: next } };
  }));
}

export function cancelRevision(actor: AuthenticatedActor, projectId: string, revisionId: string, requestId: string) {
  return run(async (): Promise<Result<{ id: string; status: string }>> => inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "finance.budget.update");
    const project = await loadProject(ctx, actor, projectId, session, "write");
    if (!isId(revisionId)) throw new Flow(404, "NOT_FOUND");
    await touchProject(session, project._id);
    const rev = await ProjectBudgetRevision.findOne({ _id: revisionId, projectId: project._id }).session(session).lean();
    if (!rev) throw new Flow(404, "NOT_FOUND");
    if (rev.status !== "PENDING_APPROVAL") throw new Flow(409, "CONFLICT", { kind: "not_pending", status: rev.status });
    if (String(rev.requestedBy) !== actor.userId) throw new Flow(403, "FORBIDDEN", { kind: "requester_only" });
    const res = await ProjectBudgetRevision.updateOne({ _id: rev._id, status: "PENDING_APPROVAL" }, { $set: { status: "CANCELLED", decidedBy: oid(actor.userId), decidedAt: new Date() } }, { session });
    if (res.modifiedCount !== 1) throw new Flow(409, "CONFLICT", { kind: "not_pending" });
    await writeFinanceAudit(session, { actor, action: "budget.revision_cancelled", resourceType: "BUDGET", resourceId: rev._id, agencyId: project.agencyId, newValue: { status: "CANCELLED" }, requestId });
    return { ok: true as const, data: { id: String(rev._id), status: "CANCELLED" } };
  }));
}

export function listRevisions(actor: AuthenticatedActor, projectId: string) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.budget.read");
    const project = await loadProject(ctx, actor, projectId, undefined, "read");
    const rows = await ProjectBudgetRevision.find({ projectId: project._id }).sort({ sequence: -1 }).limit(100).lean();
    const people = await User.find({ _id: { $in: rows.flatMap((r) => [r.requestedBy, r.decidedBy].filter(Boolean)) } }).select("firstName lastName").lean();
    const name = (id: unknown) => { const u = people.find((p) => String(p._id) === String(id)); return u ? `${u.firstName} ${u.lastName}`.trim() : null; };
    const t = await expenseTotals(project._id);
    return { ok: true, data: {
      currentTotalMinor: project.budget.amountMinor,
      revisions: rows.map((r) => ({
        id: String(r._id), sequence: r.sequence, kind: r.kind, status: r.status, previousTotalMinor: r.previousTotal.amountMinor, newTotalMinor: r.newTotal.amountMinor, deltaMinor: r.newTotal.amountMinor - r.previousTotal.amountMinor,
        allocations: r.allocations.map((a) => ({ category: a.category, amountMinor: a.amount.amountMinor })), reason: r.reason ?? null, requestedBy: name(r.requestedBy), requestedAt: r.requestedAt.toISOString(),
        decidedBy: name(r.decidedBy), decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote ?? null,
        canDecide: r.status === "PENDING_APPROVAL" && ctx.has("finance.budget.approve") && String(r.requestedBy) !== actor.userId,
        canCancel: r.status === "PENDING_APPROVAL" && ctx.has("finance.budget.update") && String(r.requestedBy) === actor.userId,
      })),
      expensesByCategory: t.byCategory,
    } };
  });
}
