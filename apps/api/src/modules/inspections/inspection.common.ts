import mongoose, { type ClientSession } from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Flow, type Ctx } from "../contractors/contractor.context.js";
import { inTransaction, oid, isId } from "../finance/finance.common.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectWriteFilter } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import { Project } from "../projects/models/project.model.js";
import { isOverdue } from "./inspection.rules.js";
import { Inspection } from "./models/inspection.model.js";

export { inTransaction, oid, isId };
export type Id = mongoose.Types.ObjectId;
export type InspectionRow = mongoose.InferSchemaType<typeof Inspection.schema> & { _id: Id };

const NONE = { _id: { $in: [] as Id[] } };

/** Scope filter for the inspections collection. Inspectors see only their own; staff see inspections of in-scope agencies. */
export function inspectionScope(ctx: Ctx, actor: AuthenticatedActor): Record<string, unknown> {
  if (actor.roleKey === "INSPECTOR") {
    if (!mongoose.isValidObjectId(actor.userId)) return NONE;
    const own = { inspectorId: oid(actor.userId) };
    // Peer review: an inspector holding a decision grant may also see other inspectors' SUBMITTED reports in their own agency (maker-checker still bars deciding their own).
    if ((ctx.has("inspection.verify") || ctx.has("inspection.reject")) && mongoose.isValidObjectId(actor.agencyId)) return { $or: [own, { agencyId: oid(actor.agencyId), status: "SUBMITTED" }] };
    return own;
  }
  if (ctx.scope.kind === "platform") return { agencyId: { $exists: true, $ne: null } };
  if (ctx.scope.kind === "agencies") return { agencyId: { $in: ctx.agencyObjectIds } };
  return NONE;
}

/** Loads one inspection inside the caller's scope (plain 404 outside it). `assign` additionally requires project write scope (403 if readable only). */
export async function loadInspection(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session: ClientSession | undefined, mode: "read" | "assign" | "inspector"): Promise<InspectionRow> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = Inspection.findOne({ $and: [inspectionScope(ctx, actor), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as InspectionRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  if (mode === "assign") {
    const w = Project.exists({ $and: [projectWriteFilter(actor, ctx.scope), { _id: row.projectId }] });
    if (session) w.session(session);
    if (!(await w)) throw new Flow(403, "FORBIDDEN");
  }
  if (mode === "inspector" && String(row.inspectorId) !== actor.userId) throw new Flow(404, "NOT_FOUND");
  return row;
}

export async function displayNames(ids: (Id | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((i): i is Id => Boolean(i)).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("firstName lastName").lean();
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

type Snapshot = { status?: string; reason?: string; agencyId?: Id | null; physicalProgress?: number };

/** Allowlisted snapshot keys only. Report text, captions, coordinates and hashes are never written to audit rows. */
export async function writeInspectionAudit(session: ClientSession, i: { actor: AuthenticatedActor; action: string; inspectionId: Id; agencyId?: Id | null; oldValue?: Snapshot; newValue?: Snapshot; requestId: string }): Promise<void> {
  const clean = (s?: Snapshot) => (s ? Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)) : undefined);
  const rid = i.requestId.trim().slice(0, 100);
  await AuditLog.create([{
    userId: oid(i.actor.userId), action: i.action, resourceType: "INSPECTION", resourceId: i.inspectionId, ...(i.agencyId ? { agencyId: i.agencyId } : {}),
    oldValue: clean(i.oldValue), newValue: clean(i.newValue), requestId: /^[A-Za-z0-9_-]+$/.test(rid) ? rid : "request",
  }], { session });
}

/** Best-effort in-app notices after commit. A failure here never rolls back or hides inspection state. */
export async function notifyInspection(userIds: Id[], n: { title: string; message: string; inspectionId: Id; eventKey: string }): Promise<void> {
  try {
    const unique = [...new Map(userIds.map((u) => [String(u), u])).values()];
    if (!unique.length) return;
    await Notification.insertMany(unique.map((userId) => ({ userId, type: "INSPECTION", title: n.title.slice(0, 200), message: n.message.slice(0, 2000), resourceType: "INSPECTION", resourceId: n.inspectionId, isRead: false, eventKey: `${n.eventKey}:${userId}`.slice(0, 80) })), { ordered: false }).catch(() => undefined);
  } catch { /* best effort */ }
}

/** Active holders of a permission in an agency (verified accounts only). Bounded. */
export async function holdersOf(agencyIds: Id[], permission: string, exclude: string[] = []): Promise<Id[]> {
  const roles = await Role.find({ isActive: true, permissions: permission }).select("_id").lean();
  const users = await User.find({ roleId: { $in: roles.map((r) => r._id) }, agencyId: { $in: agencyIds }, status: "ACTIVE", emailVerified: true }).select("_id").limit(60).lean();
  return users.map((u) => u._id as Id).filter((u) => !exclude.includes(String(u)));
}

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** Allowlisted list/calendar row. No contact data, no report text. */
export function summaryRow(row: InspectionRow, ref: { projects: Map<string, { projectCode: string; title: string }>; names: Map<string, string>; now: Date }) {
  const p = ref.projects.get(String(row.projectId));
  const measured = row.report?.measuredProgress ?? null;
  const claimed = row.claimedProgressAtSchedule ?? null;
  return {
    id: String(row._id), inspectionNo: row.inspectionNo ?? null, projectId: String(row.projectId), projectCode: p?.projectCode ?? null, projectTitle: p?.title ?? null,
    agencyId: row.agencyId ? String(row.agencyId) : null, inspectionType: row.inspectionType ?? "PROGRESS_VERIFICATION", priority: row.priority ?? "NORMAL", status: row.status,
    inspectionDate: row.inspectionDate.toISOString(), durationMinutes: row.durationMinutes ?? 120, inspectorId: String(row.inspectorId), inspectorName: ref.names.get(String(row.inspectorId)) ?? null,
    overdue: isOverdue(row.status, row.inspectionDate, row.durationMinutes, ref.now), evidenceCount: row.evidence?.length ?? 0, submissionCount: row.submissions?.length ?? 0,
    claimedProgress: claimed, measuredProgress: row.status === "VERIFIED" ? (row.physicalProgress ?? null) : measured,
    discrepancyPp: measured !== null && claimed !== null ? Math.round(measured) - Math.round(claimed) : null, version: row.version ?? 0,
  };
}
