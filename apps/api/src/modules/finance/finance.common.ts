import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { contextOf, Flow, need, type Ctx } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter } from "../identity/authorization/resource-scope.js";
import { Notification } from "../notifications/models/notification.model.js";
import { Project } from "../projects/models/project.model.js";
import { ratioBp } from "./finance.money.js";
import { ProjectExpense } from "./models/project-expense.model.js";
import { ProjectPayment } from "./models/project-payment.model.js";

export { contextOf, Flow, need };
export type Id = mongoose.Types.ObjectId;
export const oid = (v: string) => new mongoose.Types.ObjectId(v);
export const isId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
export const lkr = (amountMinor: number) => ({ amountMinor, currency: "LKR" as const });

export type ProjectDoc = { _id: Id; projectCode: string; title: string; status: string; agencyId: Id; managerId?: Id | null; contractorId?: Id | null; budget: { amountMinor: number }; startDate?: Date | null; physicalProgress?: number };

/** Read scope first (out of scope is a plain 404), then write scope (readable but not writable is 403). Mirrors projectReadFilter / projectWriteFilter exactly. */
export async function loadProject(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session: ClientSession | undefined, mode: "read" | "write"): Promise<ProjectDoc> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = Project.findOne({ $and: [projectReadFilter(ctx.scope), { _id: rawId }] }).select("projectCode title status agencyId managerId contractorId budget startDate physicalProgress");
  if (session) q.session(session);
  const project = (await q.lean()) as unknown as ProjectDoc | null;
  if (!project) throw new Flow(404, "NOT_FOUND");
  if (mode === "write") {
    const w = Project.exists({ $and: [projectWriteFilter(actor, ctx.scope), { _id: rawId }] });
    if (session) w.session(session);
    if (!(await w)) throw new Flow(403, "FORBIDDEN");
  }
  return project;
}

/** Serialises every budget-affecting write on one project: concurrent writers conflict and the loser retries against committed state. */
export async function touchProject(session: ClientSession, projectId: Id): Promise<void> {
  await Project.updateOne({ _id: projectId }, { $inc: { financeVersion: 1 } }, { session, timestamps: false });
}

export type PaymentTotals = { paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number; oldestPendingAt: Date | null };
export async function paymentTotals(projectId: Id, session?: ClientSession): Promise<PaymentTotals> {
  const q = ProjectPayment.aggregate<{ _id: string; sum: number; oldest: Date }>([
    { $match: { projectId, status: { $in: ["PENDING", "APPROVED", "PAID"] } } },
    { $group: { _id: "$status", sum: { $sum: "$amount.amountMinor" }, oldest: { $min: { $ifNull: ["$requestedAt", "$createdAt"] } } } },
  ]);
  if (session) q.session(session);
  const rows = await q;
  const by = new Map(rows.map((r) => [r._id, r]));
  const safe = (n: number | undefined) => { const v = n ?? 0; if (!Number.isSafeInteger(v)) throw new Flow(503, "SERVICE_UNAVAILABLE"); return v; };
  return { paidMinor: safe(by.get("PAID")?.sum), approvedUnpaidMinor: safe(by.get("APPROVED")?.sum), pendingMinor: safe(by.get("PENDING")?.sum), oldestPendingAt: by.get("PENDING")?.oldest ?? null };
}

/** Verified, non-reversed expenses: total and by category. DRAFT, pending, rejected and reversed rows never count. */
export async function expenseTotals(projectId: Id, session?: ClientSession): Promise<{ verifiedMinor: number; byCategory: Record<string, number> }> {
  const q = ProjectExpense.aggregate<{ _id: string; sum: number }>([{ $match: { projectId, status: "VERIFIED" } }, { $group: { _id: "$category", sum: { $sum: "$amount.amountMinor" } } }]);
  if (session) q.session(session);
  const rows = await q;
  const byCategory = Object.fromEntries(rows.map((r) => [r._id, r.sum]));
  const total = rows.reduce((s, r) => s + BigInt(r.sum), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Flow(503, "SERVICE_UNAVAILABLE");
  return { verifiedMinor: Number(total), byCategory };
}

/** Cache sync, in the caller's transaction: Project.financialProgress = paid / budget as a percentage, from the same integer maths. Never touches physicalProgress. */
export async function syncFinancialProgress(projectId: Id, session: ClientSession): Promise<void> {
  const p = await Project.findById(projectId).select("budget").session(session).lean();
  if (!p) return;
  const { paidMinor } = await paymentTotals(projectId, session);
  const bp = ratioBp(paidMinor, p.budget.amountMinor) ?? 0;
  await Project.updateOne({ _id: projectId }, { $set: { financialProgress: Math.min(100, bp / 100) } }, { session, timestamps: false });
}

/** Test seam: lets a test fail a transaction after the data changed but before the audit row, to prove nothing persists. */
export const financeHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

export const auditId = (requestId: string): string => {
  const t = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : "request";
};

type Snapshot = { status?: string; reason?: string; agencyId?: Id | null; contractorId?: Id; projectId?: Id; amount?: { amountMinor: number; currency: "LKR" }; budget?: { amountMinor: number; currency: "LKR" }; financialProgress?: number };

/** Allowlisted snapshot keys only. Never a request body, never free personal data; `reason` carries decision notes or warning keys. */
export async function writeFinanceAudit(session: ClientSession, i: { actor: AuthenticatedActor; action: string; resourceType: "BUDGET" | "EXPENSE" | "PAYMENT"; resourceId: Id; agencyId: Id; oldValue?: Snapshot; newValue?: Snapshot; requestId: string }): Promise<void> {
  await financeHooks.beforeAudit();
  const clean = (s?: Snapshot) => (s ? Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)) : undefined);
  await AuditLog.create([{ userId: oid(i.actor.userId), action: i.action, resourceType: i.resourceType, resourceId: i.resourceId, agencyId: i.agencyId, oldValue: clean(i.oldValue), newValue: clean(i.newValue), requestId: auditId(i.requestId) }], { session });
}

export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await work(session); });
    return out;
  } finally {
    await session.endSession();
  }
}

export const isDuplicateKey = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

export const duplicateKeyOf = (projectId: string, supplier: string | undefined, ref: string, amountMinor: number): string =>
  createHash("sha1").update(`${projectId}|${(supplier ?? "").toLowerCase().replace(/\s+/g, " ").trim()}|${ref.toUpperCase().replace(/\s+/g, "")}|${amountMinor}`).digest("hex");

/** Best-effort in-app notices after commit. A failure here never rolls back or hides finance state. */
export async function notifyUsers(userIds: Id[], n: { type: "APPROVAL" | "SYSTEM"; title: string; message: string; resource: { type: "PAYMENT" | "PROJECT"; id: Id }; eventKey: string }): Promise<void> {
  try {
    const unique = [...new Map(userIds.map((u) => [String(u), u])).values()];
    if (!unique.length) return;
    await Notification.insertMany(unique.map((userId) => ({ userId, type: n.type, title: n.title, message: n.message, resourceType: n.resource.type, resourceId: n.resource.id, isRead: false, eventKey: `${n.eventKey}:${userId}`.slice(0, 80) })), { ordered: false }).catch(() => undefined);
  } catch { /* best effort */ }
}

/** Active holders of a permission in the given agency, for notices. Bounded. */
export async function approversOf(agencyId: Id, permission: string): Promise<Id[]> {
  const { Role } = await import("../identity/models/role.model.js");
  const { User } = await import("../identity/models/user.model.js");
  const roles = await Role.find({ isActive: true, permissions: permission }).select("_id").lean();
  const users = await User.find({ roleId: { $in: roles.map((r) => r._id) }, agencyId, status: "ACTIVE", emailVerified: true }).select("_id").limit(50).lean();
  return users.map((u) => u._id as Id);
}

export async function contractorBrief(contractorId: Id, session?: ClientSession) {
  const q = Contractor.findById(contractorId).select("name registrationNumber status");
  if (session) q.session(session);
  return (await q.lean()) as { _id: Id; name: string; registrationNumber: string; status: string } | null;
}

export async function activeAssignmentFor(projectId: Id, contractorId: Id, assignmentId: string | undefined, session?: ClientSession) {
  const filter: Record<string, unknown> = { projectId, contractorId };
  if (assignmentId) filter._id = assignmentId; else filter.status = "ACTIVE";
  const q = ContractorAssignment.findOne(filter).sort({ startDate: -1 });
  if (session) q.session(session);
  return (await q.lean()) as { _id: Id; status: string; contractValue?: { amountMinor: number } | null } | null;
}

/** Colombo calendar day (UTC+5:30) as yyyy-mm-dd, used for the "not in the future" expense rule. */
export const colomboToday = (now = new Date()): string => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
