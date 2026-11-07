import { AuditLog } from "../audit/models/audit-log.model.js";
import { canSee, type ContractorLike } from "../contractors/contractor.access.js";
import { assignedInScope, run, type Ctx, type Result } from "../contractors/contractor.context.js";
import { escapeRegex } from "../contractors/contractor.keys.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { Project } from "../projects/models/project.model.js";
import { agencyFilter, expenseFilter } from "./expense.service.js";
import { contextOf, Flow, isId, loadProject, need, oid, paymentTotals, expenseTotals, type Id } from "./finance.common.js";
import { evaluateFinance, type Flag, type Intel, type IntelInput } from "./finance-intelligence.rules.js";
import { ratioBp } from "./finance.money.js";
import { ProjectBudgetRevision } from "./models/project-budget-revision.model.js";
import { ProjectExpense } from "./models/project-expense.model.js";
import { ProjectPayment } from "./models/project-payment.model.js";
import { paymentFilter } from "./payment.service.js";
import { physicalProgressMany, physicalProgressOf, type ProgressSource } from "./physical-progress.source.js";

const PORTFOLIO_CAP = 500;

type PStats = { paid: number; approvedUnpaid: number; pending: number; oldestPending: Date | null };

type Proj = { _id: Id; projectCode: string; title: string; status: string; agencyId: Id; contractorId?: Id | null; budget: { amountMinor: number } };

async function computePortfolio(ctx: Ctx, q: { agencyId?: string; status?: string; q?: string }, now = new Date()) {
  const and: Record<string, unknown>[] = [projectReadFilter(ctx.scope), { "budget.amountMinor": { $gt: 0 } }];
  if (q.agencyId) and.push({ agencyId: oid(q.agencyId) });
  if (q.status) and.push({ status: q.status });
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), "i"); and.push({ $or: [{ projectCode: rx }, { title: rx }] }); }
  const projects = (await Project.find({ $and: and }).select("projectCode title status agencyId contractorId budget").sort({ projectCode: 1 }).limit(PORTFOLIO_CAP + 1).maxTimeMS(8000).lean()) as unknown as Proj[];
  const truncated = projects.length > PORTFOLIO_CAP;
  const list = projects.slice(0, PORTFOLIO_CAP);
  const ids = list.map((p) => p._id);
  const [payRows, progress, revRows, expRows, pendingRev, assignRows] = await Promise.all([
    ProjectPayment.aggregate<{ _id: { p: Id; s: string }; sum: number; oldest: Date }>([{ $match: { projectId: { $in: ids }, status: { $in: ["PENDING", "APPROVED", "PAID"] } } }, { $group: { _id: { p: "$projectId", s: "$status" }, sum: { $sum: "$amount.amountMinor" }, oldest: { $min: { $ifNull: ["$requestedAt", "$createdAt"] } } } }]).option({ maxTimeMS: 8000 }),
    physicalProgressMany(ids),
    ProjectBudgetRevision.find({ projectId: { $in: ids }, status: "APPROVED" }).sort({ sequence: -1 }).select("projectId allocations").lean(),
    ProjectExpense.aggregate<{ _id: { p: Id; c: string }; sum: number }>([{ $match: { projectId: { $in: ids }, status: "VERIFIED" } }, { $group: { _id: { p: "$projectId", c: "$category" }, sum: { $sum: "$amount.amountMinor" } } }]).option({ maxTimeMS: 8000 }),
    ProjectBudgetRevision.find({ projectId: { $in: ids }, status: "PENDING_APPROVAL" }).select("projectId").lean(),
    ContractorAssignment.aggregate<{ _id: { a: Id; p: Id }; cap: number; sum: number }>([
      { $match: { projectId: { $in: ids }, "contractValue.amountMinor": { $gt: 0 } } },
      { $lookup: { from: "projectPayments", let: { a: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$assignmentId", "$$a"] }, { $in: ["$status", ["APPROVED", "PAID"]] }] } } }, { $group: { _id: null, s: { $sum: "$amount.amountMinor" } } }], as: "pay" } },
      { $project: { cap: "$contractValue.amountMinor", sum: { $ifNull: [{ $first: "$pay.s" }, 0] }, p: "$projectId" } }, { $group: { _id: { a: "$_id", p: "$p" }, cap: { $first: "$cap" }, sum: { $first: "$sum" } } },
    ]).option({ maxTimeMS: 8000 }),
  ]);
  const stats = new Map<string, PStats>();
  for (const r of payRows) {
    const k = String(r._id.p);
    const s = stats.get(k) ?? { paid: 0, approvedUnpaid: 0, pending: 0, oldestPending: null };
    if (r._id.s === "PAID") s.paid = r.sum; else if (r._id.s === "APPROVED") s.approvedUnpaid = r.sum; else { s.pending = r.sum; s.oldestPending = r.oldest; }
    stats.set(k, s);
  }
  const alloc = new Map<string, { category: string; amountMinor: number }[]>();
  for (const r of revRows) if (!alloc.has(String(r.projectId))) alloc.set(String(r.projectId), r.allocations.map((a) => ({ category: a.category, amountMinor: a.amount.amountMinor })));
  const spent = new Map<string, Record<string, number>>();
  for (const r of expRows) spent.set(String(r._id.p), { ...(spent.get(String(r._id.p)) ?? {}), [r._id.c]: r.sum });
  const pending = new Set(pendingRev.map((r) => String(r.projectId)));
  const overruns = new Map<string, { assignmentId: string; overByMinor: number }[]>();
  for (const a of assignRows) if (a.sum > a.cap) overruns.set(String(a._id.p), [...(overruns.get(String(a._id.p)) ?? []), { assignmentId: String(a._id.a), overByMinor: a.sum - a.cap }]);
  const contractors = await Contractor.find({ _id: { $in: list.map((p) => p.contractorId).filter(Boolean) } }).select("name").lean();
  const cname = new Map(contractors.map((c) => [String(c._id), c.name]));

  const rows = list.map((p) => {
    const k = String(p._id);
    const s = stats.get(k) ?? { paid: 0, approvedUnpaid: 0, pending: 0, oldestPending: null };
    const input: IntelInput = {
      budgetMinor: p.budget.amountMinor, paidMinor: s.paid, approvedUnpaidMinor: s.approvedUnpaid, pendingMinor: s.pending, oldestPendingAt: s.oldestPending,
      verifiedExpensesMinor: Object.values(spent.get(k) ?? {}).reduce((a, b) => a + b, 0), allocations: alloc.get(k) ?? [], expenseByCategory: spent.get(k) ?? {}, contractOverruns: overruns.get(k) ?? [],
      revisionPending: pending.has(k), progress: progress.get(k) as ProgressSource, now,
    };
    const intel = evaluateFinance(input);
    return { id: k, code: p.projectCode, title: p.title, status: p.status, agencyId: String(p.agencyId), contractor: p.contractorId ? cname.get(String(p.contractorId)) ?? null : null, budgetMinor: p.budget.amountMinor, paidMinor: s.paid, approvedUnpaidMinor: s.approvedUnpaid, pendingMinor: s.pending, intel };
  });
  return { rows, truncated, total: list.length };
}

const flagsOf = (i: Intel): Flag[] => i.flags;
const view = (r: Awaited<ReturnType<typeof computePortfolio>>["rows"][number]) => ({
  id: r.id, code: r.code, title: r.title, status: r.status, agencyId: r.agencyId, contractor: r.contractor, budgetMinor: r.budgetMinor, paidMinor: r.paidMinor, approvedUnpaidMinor: r.approvedUnpaidMinor, pendingMinor: r.pendingMinor,
  committedMinor: r.intel.available ? r.intel.committedMinor : r.paidMinor + r.approvedUnpaidMinor, utilizationBp: r.intel.available ? r.intel.utilizationBp : null, financialBp: r.intel.available ? r.intel.financialProgressBp : null,
  physicalBp: r.intel.available ? r.intel.physicalBp : null, basis: r.intel.available ? r.intel.basis : "NONE", gapTenths: r.intel.available ? r.intel.gapTenths : null,
  flags: flagsOf(r.intel).map((f) => ({ code: f.code, severity: f.severity, confidence: f.confidence })),
});

export function financeProjects(actor: AuthenticatedActor, q: { q?: string; agencyId?: string; status?: string; flag?: string; overBudget?: boolean; basis?: string; sort: string; page: number; limit: number }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.budget.read");
    const { rows, truncated } = await computePortfolio(ctx, q);
    let out = rows.map(view);
    if (q.flag) out = out.filter((r) => r.flags.some((f) => f.code === q.flag));
    if (q.overBudget) out = out.filter((r) => r.flags.some((f) => f.code === "OVER_BUDGET_COMMITMENT"));
    if (q.basis) out = out.filter((r) => r.basis === q.basis);
    const sorts: Record<string, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
      code: (a, b) => a.code.localeCompare(b.code), budget: (a, b) => b.budgetMinor - a.budgetMinor, utilization: (a, b) => (b.utilizationBp ?? -1) - (a.utilizationBp ?? -1), gap: (a, b) => (b.gapTenths ?? -1e9) - (a.gapTenths ?? -1e9),
    };
    out.sort(sorts[q.sort] ?? sorts.code!);
    return { ok: true, data: { rows: out.slice((q.page - 1) * q.limit, q.page * q.limit), total: out.length, page: q.page, limit: q.limit, truncated, cap: PORTFOLIO_CAP } };
  });
}

export function financeSummary(actor: AuthenticatedActor, q: { agencyId?: string; projectStatus?: string; dateFrom?: string; dateTo?: string }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.budget.read");
    const { rows, truncated } = await computePortfolio(ctx, { agencyId: q.agencyId, status: q.projectStatus });
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + BigInt(f(r)), 0n);
    const budget = sum((r) => r.budgetMinor), paid = sum((r) => r.paidMinor), unpaid = sum((r) => r.approvedUnpaidMinor), pending = sum((r) => r.pendingMinor);
    const committed = paid + unpaid;
    const safe = (v: bigint) => { if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Flow(503, "SERVICE_UNAVAILABLE"); return Number(v); };
    const flagged = rows.filter((r) => r.intel.flags.some((f) => f.severity === "HIGH" || f.severity === "MEDIUM"));
    const topFlags = rows.flatMap((r) => r.intel.flags.filter((f) => f.severity === "HIGH" || f.severity === "MEDIUM").map((f) => ({ projectId: r.id, code: r.code, title: r.title, flag: { code: f.code, severity: f.severity, confidence: f.confidence, params: f.params } }))).sort((a, b) => (b.flag.severity === "HIGH" ? 1 : 0) - (a.flag.severity === "HIGH" ? 1 : 0)).slice(0, 8);
    const agency = agencyFilter(ctx);
    const mineWhere = (extra: Record<string, unknown>) => ({ $and: [agency, { createdBy: { $ne: oid(actor.userId) } }, extra] });
    const [payInbox, expInbox, revInbox, recentPay, recentExp] = await Promise.all([
      ctx.has("finance.payment.approve") ? ProjectPayment.countDocuments(mineWhere({ status: "PENDING" })) : Promise.resolve(null),
      ctx.has("finance.expense.verify") ? ProjectExpense.countDocuments(mineWhere({ status: "PENDING_VERIFICATION" })) : Promise.resolve(null),
      ctx.has("finance.budget.approve") ? ProjectBudgetRevision.countDocuments({ $and: [agency, { status: "PENDING_APPROVAL", requestedBy: { $ne: oid(actor.userId) } }] }) : Promise.resolve(null),
      ctx.has("finance.payment.read") ? ProjectPayment.find({ $and: [agency, ...(q.dateFrom || q.dateTo ? [{ date: { ...(q.dateFrom ? { $gte: new Date(`${q.dateFrom}T00:00:00Z`) } : {}), ...(q.dateTo ? { $lte: new Date(`${q.dateTo}T23:59:59Z`) } : {}) } }] : [])] }).sort({ updatedAt: -1 }).limit(10).select("paymentNo projectId amount status paymentType updatedAt").lean() : Promise.resolve([]),
      ctx.has("finance.expense.read") ? ProjectExpense.find(agency).sort({ updatedAt: -1 }).limit(10).select("expenseNo projectId amount status category updatedAt").lean() : Promise.resolve([]),
    ]);
    const revWaiting = ctx.has("finance.budget.approve") ? await ProjectBudgetRevision.find({ $and: [agency, { status: "PENDING_APPROVAL", requestedBy: { $ne: oid(actor.userId) } }] }).sort({ requestedAt: 1 }).limit(5).select("projectId sequence").lean() : [];
    const pr = await Project.find({ _id: { $in: [...recentPay.map((p) => p.projectId), ...recentExp.map((e) => e.projectId), ...revWaiting.map((r) => r.projectId)] } }).select("projectCode").lean();
    const code = new Map(pr.map((p) => [String(p._id), p.projectCode]));
    const recent = [
      ...recentPay.map((p) => ({ kind: "payment" as const, id: String(p._id), number: p.paymentNo ?? null, projectCode: code.get(String(p.projectId)) ?? "", amountMinor: p.amount.amountMinor, status: p.status, at: (p as unknown as { updatedAt: Date }).updatedAt.toISOString() })),
      ...recentExp.map((e) => ({ kind: "expense" as const, id: String(e._id), number: e.expenseNo, projectCode: code.get(String(e.projectId)) ?? "", amountMinor: e.amount.amountMinor, status: e.status, at: (e as unknown as { updatedAt: Date }).updatedAt.toISOString() })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
    return { ok: true, data: {
      scope: ctx.scope.kind, projects: rows.length, truncated,
      totals: { budgetMinor: safe(budget), committedMinor: safe(committed), paidMinor: safe(paid), approvedUnpaidMinor: safe(unpaid), pendingMinor: safe(pending), remainingMinor: committed > budget ? 0 : safe(budget - committed), utilizationBp: budget > 0n ? ratioBp(safe(committed), safe(budget)) : null },
      counts: { overBudget: rows.filter((r) => r.intel.flags.some((f) => f.code === "OVER_BUDGET_COMMITMENT")).length, nearBudget: rows.filter((r) => r.intel.flags.some((f) => f.code === "NEAR_BUDGET")).length, flagged: flagged.length },
      inbox: { payments: payInbox, expenses: expInbox, revisions: revInbox, revisionProjects: revWaiting.map((r) => ({ projectId: String(r.projectId), code: code.get(String(r.projectId)) ?? "", sequence: r.sequence })) }, recent, topFlags,
    } };
  });
}

export function projectFinance(actor: AuthenticatedActor, projectId: string) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.budget.read");
    const project = await loadProject(ctx, actor, projectId, undefined, "read");
    const [t, et, progress, rev, pending, assigns] = await Promise.all([
      paymentTotals(project._id), expenseTotals(project._id), physicalProgressOf(project._id),
      ProjectBudgetRevision.findOne({ projectId: project._id, status: "APPROVED" }).sort({ sequence: -1 }).select("allocations sequence").lean(),
      ProjectBudgetRevision.exists({ projectId: project._id, status: "PENDING_APPROVAL" }),
      ContractorAssignment.find({ projectId: project._id }).sort({ startDate: -1 }).limit(20).lean(),
    ]);
    const allocations = (rev?.allocations ?? []).map((a) => ({ category: a.category, amountMinor: a.amount.amountMinor }));
    const caps = await ProjectPayment.aggregate<{ _id: Id; s: number }>([{ $match: { assignmentId: { $in: assigns.map((a) => a._id) }, status: { $in: ["APPROVED", "PAID"] } } }, { $group: { _id: "$assignmentId", s: { $sum: "$amount.amountMinor" } } }]);
    const paidBy = new Map(caps.map((c) => [String(c._id), c.s]));
    const cs = await Contractor.find({ _id: { $in: assigns.map((a) => a.contractorId) } }).select("name").lean();
    const cn = new Map(cs.map((c) => [String(c._id), c.name]));
    const strip = assigns.map((a) => ({ assignmentId: String(a._id), contractorId: String(a.contractorId), contractor: cn.get(String(a.contractorId)) ?? null, role: a.role, status: a.status, contractValueMinor: a.contractValue?.amountMinor ?? null, committedMinor: paidBy.get(String(a._id)) ?? 0 }));
    const overruns = strip.filter((s) => s.contractValueMinor !== null && s.committedMinor > s.contractValueMinor).map((s) => ({ assignmentId: s.assignmentId, overByMinor: s.committedMinor - (s.contractValueMinor as number) }));
    const intel = evaluateFinance({
      budgetMinor: project.budget.amountMinor, paidMinor: t.paidMinor, approvedUnpaidMinor: t.approvedUnpaidMinor, pendingMinor: t.pendingMinor, oldestPendingAt: t.oldestPendingAt, verifiedExpensesMinor: et.verifiedMinor,
      allocations, expenseByCategory: et.byCategory, contractOverruns: overruns, revisionPending: Boolean(pending), progress, now: new Date(),
    });
    // Reported progress history (labelled reported, never verified) and verified inspection points for the timeline chart.
    const { ProgressReport } = await import("../projects/models/progress-report.model.js");
    const { Inspection } = await import("../inspections/models/inspection.model.js");
    const [reports, verified, paidRows] = await Promise.all([
      ProgressReport.find({ projectId: project._id }).sort({ reportedAt: 1 }).limit(100).select("reportedPercent reportedAt").lean(),
      Inspection.find({ projectId: project._id, status: "VERIFIED", physicalProgress: { $ne: null } }).sort({ inspectionDate: 1 }).limit(50).select("physicalProgress inspectionDate").lean(),
      ProjectPayment.find({ projectId: project._id, status: "PAID", paidAt: { $ne: null } }).sort({ paidAt: 1 }).limit(200).select("amount paidAt").lean(),
    ]);
    let run = 0n;
    const cumulativePaid = paidRows.map((p) => { run += BigInt(p.amount.amountMinor); return { at: (p.paidAt as Date).toISOString(), paidMinor: Number(run), bp: ratioBp(Number(run), project.budget.amountMinor) }; });
    const actions = {
      paymentsToApprove: ctx.has("finance.payment.approve") ? await ProjectPayment.countDocuments({ projectId: project._id, status: "PENDING", createdBy: { $ne: oid(actor.userId) } }) : null,
      expensesToVerify: ctx.has("finance.expense.verify") ? await ProjectExpense.countDocuments({ projectId: project._id, status: "PENDING_VERIFICATION", createdBy: { $ne: oid(actor.userId) } }) : null,
    };
    return { ok: true, data: {
      project: { id: String(project._id), code: project.projectCode, title: project.title, status: project.status },
      totals: { budgetMinor: project.budget.amountMinor, paidMinor: t.paidMinor, approvedUnpaidMinor: t.approvedUnpaidMinor, pendingMinor: t.pendingMinor, verifiedExpensesMinor: et.verifiedMinor },
      allocations: allocations.map((a) => ({ ...a, spentMinor: et.byCategory[a.category] ?? 0 })), expensesByCategory: et.byCategory, intelligence: intel, strip, actions, revisionPending: Boolean(pending),
      series: { cumulativePaid, reported: reports.map((r) => ({ at: r.reportedAt.toISOString(), pct: r.reportedPercent })), verified: verified.map((v) => ({ at: v.inspectionDate.toISOString(), pct: v.physicalProgress as number })) },
      can: { revise: ctx.has("finance.budget.update"), requestPayment: ctx.has("finance.payment.create"), addExpense: ctx.has("finance.expense.create") },
    } };
  });
}

export function projectLedger(actor: AuthenticatedActor, projectId: string, q: { cursor?: string; limit: number; type?: string }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    if (!(ctx.has("finance.payment.read") || ctx.has("finance.expense.read"))) throw new Flow(403, "FORBIDDEN");
    const project = await loadProject(ctx, actor, projectId, undefined, "read");
    type Ev = { key: string; type: "budget" | "expense" | "payment"; event: string; at: Date; number: string | null; amountMinor: number; status: string; committedDelta: number; paidDelta: number; spentDelta: number; reversalOf?: string };
    const evs: Ev[] = [];
    if (ctx.has("finance.budget.read") && (!q.type || q.type === "budget")) {
      for (const r of await ProjectBudgetRevision.find({ projectId: project._id }).sort({ sequence: 1 }).limit(200).lean()) {
        evs.push({ key: `b:${r._id}`, type: "budget", event: r.kind === "INITIAL" ? "budget.initial" : `budget.${r.status.toLowerCase()}`, at: r.decidedAt ?? r.requestedAt, number: `REV-${r.sequence}`, amountMinor: r.newTotal.amountMinor, status: r.status, committedDelta: 0, paidDelta: 0, spentDelta: 0 });
      }
    }
    if (ctx.has("finance.payment.read") && (!q.type || q.type === "payment")) {
      for (const p of await ProjectPayment.find({ projectId: project._id }).limit(1000).lean()) {
        const a = p.amount.amountMinor, no = p.paymentNo ?? null;
        evs.push({ key: `p:${p._id}:r`, type: "payment", event: "payment.requested", at: p.requestedAt ?? (p as unknown as { createdAt: Date }).createdAt, number: no, amountMinor: a, status: "PENDING", committedDelta: 0, paidDelta: 0, spentDelta: 0 });
        const approved = ["APPROVED", "PAID", "REVERSED"].includes(p.status) || (p.status === "CANCELLED" && p.decidedAt);
        if (approved && p.decidedAt) evs.push({ key: `p:${p._id}:a`, type: "payment", event: "payment.approved", at: p.decidedAt, number: no, amountMinor: a, status: "APPROVED", committedDelta: a, paidDelta: 0, spentDelta: 0 });
        if (p.status === "REJECTED") evs.push({ key: `p:${p._id}:x`, type: "payment", event: "payment.rejected", at: p.decidedAt ?? new Date(0), number: no, amountMinor: a, status: "REJECTED", committedDelta: 0, paidDelta: 0, spentDelta: 0 });
        if (p.paidAt) evs.push({ key: `p:${p._id}:p`, type: "payment", event: "payment.paid", at: p.paidAt, number: no, amountMinor: a, status: "PAID", committedDelta: 0, paidDelta: a, spentDelta: 0 });
        if (p.status === "CANCELLED" && p.cancelledAt) evs.push({ key: `p:${p._id}:c`, type: "payment", event: "payment.cancelled", at: p.cancelledAt, number: no, amountMinor: a, status: "CANCELLED", committedDelta: p.decidedAt ? -a : 0, paidDelta: 0, spentDelta: 0 });
        if (p.reversal) evs.push({ key: `p:${p._id}:v`, type: "payment", event: "payment.reversed", at: p.reversal.at, number: no, amountMinor: a, status: "REVERSED", committedDelta: -a, paidDelta: -a, spentDelta: 0, reversalOf: no ?? undefined });
      }
    }
    if (ctx.has("finance.expense.read") && (!q.type || q.type === "expense")) {
      for (const e of await ProjectExpense.find({ projectId: project._id, status: { $in: ["VERIFIED", "REVERSED"] } }).limit(1000).lean()) {
        const a = e.amount.amountMinor;
        evs.push({ key: `e:${e._id}:v`, type: "expense", event: "expense.verified", at: e.verifiedAt ?? e.expenseDate, number: e.expenseNo, amountMinor: a, status: "VERIFIED", committedDelta: 0, paidDelta: 0, spentDelta: a });
        if (e.reversal) evs.push({ key: `e:${e._id}:v2`, type: "expense", event: "expense.reversed", at: e.reversal.at, number: e.expenseNo, amountMinor: a, status: "REVERSED", committedDelta: 0, paidDelta: 0, spentDelta: -a, reversalOf: e.expenseNo });
      }
    }
    evs.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
    let committed = 0n, paid = 0n, spent = 0n;
    const withBalance = evs.map((e) => { committed += BigInt(e.committedDelta); paid += BigInt(e.paidDelta); spent += BigInt(e.spentDelta); return { ...e, at: e.at.toISOString(), runningCommittedMinor: Number(committed), runningPaidMinor: Number(paid), runningSpentMinor: Number(spent) }; });
    const newest = withBalance.reverse();
    const offset = q.cursor?.startsWith("o") ? Number(q.cursor.slice(1)) : 0;
    const page = newest.slice(offset, offset + q.limit);
    return { ok: true, data: { events: page, nextCursor: offset + q.limit < newest.length ? `o${offset + q.limit}` : null } };
  });
}

/** Spreadsheet formulas: any cell that starts with = + - @ tab or CR is prefixed with an apostrophe, and all cells are quoted. */
export function csvSafe(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const money = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
const EXPORT_CAP = 5000;

export function exportPaymentsCsv(actor: AuthenticatedActor, q: Parameters<typeof paymentFilter>[2], requestId: string) {
  return run(async (): Promise<Result<{ csv: string; rows: number }>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.report.export");
    need(ctx, "finance.payment.read");
    const rows = await ProjectPayment.find(paymentFilter(ctx, actor, q)).sort({ date: -1, _id: 1 }).limit(EXPORT_CAP).maxTimeMS(15000).lean();
    const pr = await Project.find({ _id: { $in: rows.map((r) => r.projectId) } }).select("projectCode").lean();
    const cs = await Contractor.find({ _id: { $in: rows.map((r) => r.contractorId) } }).select("name").lean();
    const pm = new Map(pr.map((p) => [String(p._id), p.projectCode])), cm = new Map(cs.map((c) => [String(c._id), c.name]));
    const head = ["Payment no", "Project", "Contractor", "Type", "Status", "Amount (LKR)", "Invoice reference", "Date", "Paid at", "Payment reference"].map(csvSafe).join(",");
    const lines = rows.map((r) => [r.paymentNo, pm.get(String(r.projectId)), cm.get(String(r.contractorId)), r.paymentType, r.status, money(r.amount.amountMinor), r.invoiceReference, r.date.toISOString().slice(0, 10), r.paidAt?.toISOString().slice(0, 10), r.paymentReference].map(csvSafe).join(","));
    await auditExport(actor, "PAYMENT", rows.length, requestId);
    return { ok: true, data: { csv: [head, ...lines].join("\r\n") + "\r\n", rows: rows.length } };
  });
}

export function exportExpensesCsv(actor: AuthenticatedActor, q: Parameters<typeof expenseFilter>[1], requestId: string) {
  return run(async (): Promise<Result<{ csv: string; rows: number }>> => {
    const ctx = await contextOf(actor);
    need(ctx, "finance.report.export");
    need(ctx, "finance.expense.read");
    const rows = await ProjectExpense.find(expenseFilter(ctx, q, actor)).sort({ expenseDate: -1, _id: 1 }).limit(EXPORT_CAP).maxTimeMS(15000).lean();
    const pr = await Project.find({ _id: { $in: rows.map((r) => r.projectId) } }).select("projectCode").lean();
    const pm = new Map(pr.map((p) => [String(p._id), p.projectCode]));
    const head = ["Expense no", "Project", "Category", "Status", "Amount (LKR)", "Supplier", "Supporting reference", "Date", "Description"].map(csvSafe).join(",");
    const lines = rows.map((r) => [r.expenseNo, pm.get(String(r.projectId)), r.category, r.status, money(r.amount.amountMinor), r.supplierName, r.supportingRef, r.expenseDate.toISOString().slice(0, 10), r.description].map(csvSafe).join(","));
    await auditExport(actor, "EXPENSE", rows.length, requestId);
    return { ok: true, data: { csv: [head, ...lines].join("\r\n") + "\r\n", rows: rows.length } };
  });
}

async function auditExport(actor: AuthenticatedActor, kind: "PAYMENT" | "EXPENSE", rows: number, requestId: string) {
  const mongoose = (await import("mongoose")).default;
  await AuditLog.create([{ userId: oid(actor.userId), action: "finance.exported", resourceType: kind, resourceId: new mongoose.Types.ObjectId(), requestId: /^[A-Za-z0-9_-]+$/.test(requestId) ? requestId.slice(0, 100) : "request", newValue: { reason: `rows:${rows}` } }]);
}

export function contractorFinance(actor: AuthenticatedActor, rawId: string) {
  return run(async (): Promise<Result<unknown>> => {
    if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
    const ctx = await contextOf(actor);
    need(ctx, "finance.payment.read");
    const doc = await Contractor.findById(rawId).lean();
    if (!doc || !canSee(ctx.viewer, doc as unknown as ContractorLike, await assignedInScope(ctx, doc._id))) throw new Flow(404, "NOT_FOUND");
    const scope = agencyFilter(ctx);
    const rows = await ProjectPayment.find({ $and: [scope, { contractorId: doc._id }] }).select("projectId status amount").limit(5000).lean();
    const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + BigInt(r.amount.amountMinor), 0n);
    const projectIds = [...new Set(rows.map((r) => String(r.projectId)))].map(oid);
    const progress = await physicalProgressMany(projectIds);
    const paidProjects = new Set(rows.filter((r) => r.status === "PAID").map((r) => String(r.projectId)));
    const unverified = [...paidProjects].filter((p) => progress.get(p)?.basis !== "VERIFIED_INSPECTION").length;
    const assigns = await ContractorAssignment.find({ contractorId: doc._id, ...(ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {}), "contractValue.amountMinor": { $gt: 0 } }).select("contractValue").lean();
    const caps = await ProjectPayment.aggregate<{ _id: Id; s: number }>([{ $match: { assignmentId: { $in: assigns.map((a) => a._id) }, status: { $in: ["APPROVED", "PAID"] } } }, { $group: { _id: "$assignmentId", s: { $sum: "$amount.amountMinor" } } }]);
    const by = new Map(caps.map((c) => [String(c._id), c.s]));
    const over = assigns.filter((a) => (by.get(String(a._id)) ?? 0) > (a.contractValue?.amountMinor ?? 0)).length;
    return { ok: true, data: { paidMinor: Number(sum("PAID")), pendingMinor: Number(sum("PENDING")), approvedUnpaidMinor: Number(sum("APPROVED")), projects: projectIds.length, overCapAssignments: over, paidWithoutVerifiedProgress: unverified, basedOn: "projects you can access" } };
  });
}
