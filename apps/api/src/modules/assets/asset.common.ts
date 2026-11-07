import mongoose, { type ClientSession } from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Flow, type Ctx } from "../contractors/contractor.context.js";
import { inTransaction, isId, oid } from "../finance/finance.common.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import { Asset } from "./models/asset.model.js";

export { inTransaction, isId, oid };
export type Id = mongoose.Types.ObjectId;
export type AssetRow = mongoose.InferSchemaType<typeof Asset.schema> & { _id: Id };

const NONE = { _id: { $in: [] as Id[] } };

/**
 * Asset read scope. Staff: the owning agency or the construction agency is in scope. Platform: every asset that has an owning agency.
 * Inspectors (scope none) see only assets they hold an ASSET_CONDITION inspection for. Anything else is match-none (404, never 403).
 */
export async function assetScope(ctx: Ctx, actor: AuthenticatedActor): Promise<Record<string, unknown>> {
  if (actor.roleKey === "INSPECTOR") {
    if (!mongoose.isValidObjectId(actor.userId)) return NONE;
    const ids = await Inspection.distinct("assetId", { inspectorId: oid(actor.userId), assetId: { $exists: true, $ne: null }, status: { $ne: "CANCELLED" } });
    return ids.length ? { _id: { $in: ids } } : NONE;
  }
  if (ctx.scope.kind === "platform") return { agencyId: { $exists: true, $ne: null } };
  if (ctx.scope.kind === "agencies") return { $or: [{ agencyId: { $in: ctx.agencyObjectIds } }, { constructionAgencyId: { $in: ctx.agencyObjectIds } }] };
  return NONE;
}

/** Write scope: only the OWNING agency (never the construction agency alone). Platform writes only records that have an owning agency, exactly like projectWriteFilter. */
export function assetWriteScope(ctx: Ctx, actor: AuthenticatedActor): Record<string, unknown> {
  if (actor.roleKey === "CONTRACTOR" || actor.roleKey === "INSPECTOR" || actor.roleKey === "CITIZEN") return NONE;
  if (ctx.scope.kind === "platform") return actor.roleKey === "SUPER_ADMIN" || actor.roleKey === "GOV_ADMIN" ? { agencyId: { $exists: true, $ne: null } } : NONE;
  if (ctx.scope.kind === "agencies") return { agencyId: { $in: ctx.agencyObjectIds } };
  return NONE;
}

/** Loads one asset inside the caller's scope (plain 404 outside it). `write` additionally requires the owning-agency write scope (403 if readable only). */
export async function loadAsset(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session: ClientSession | undefined, mode: "read" | "write"): Promise<AssetRow> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = Asset.findOne({ $and: [await assetScope(ctx, actor), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as AssetRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  if (mode === "write") {
    const w = Asset.exists({ $and: [assetWriteScope(ctx, actor), { _id: rawId }] });
    if (session) w.session(session);
    if (!(await w)) throw new Flow(403, "FORBIDDEN");
  }
  return row;
}

type Snapshot = { status?: string; reason?: string; agencyId?: Id | null; contractorId?: Id | null; cost?: { amountMinor: number; currency: "LKR" } };

/** Allowlisted snapshot keys only. Free text and coordinates never enter audit rows; `status` carries a condition or operational value. */
export async function writeAssetAudit(session: ClientSession, i: { actor: AuthenticatedActor; action: string; resourceType: "ASSET" | "MAINTENANCE_RECORD"; resourceId: Id; agencyId?: Id | null; oldValue?: Snapshot; newValue?: Snapshot; requestId: string }): Promise<void> {
  const clean = (s?: Snapshot) => (s ? Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)) : undefined);
  const rid = i.requestId.trim().slice(0, 100);
  await AuditLog.create([{
    userId: oid(i.actor.userId), action: i.action, resourceType: i.resourceType, resourceId: i.resourceId, ...(i.agencyId ? { agencyId: i.agencyId } : {}),
    oldValue: clean(i.oldValue), newValue: clean(i.newValue), requestId: /^[A-Za-z0-9_-]+$/.test(rid) ? rid : "request",
  }], { session });
}

/** Best-effort in-app notices after commit. A failure here never rolls back or hides state. */
export async function notifyAsset(userIds: Id[], n: { title: string; message: string; resource: { type: "ASSET" | "PROJECT"; id: Id }; eventKey: string }): Promise<void> {
  try {
    const unique = [...new Map(userIds.map((u) => [String(u), u])).values()];
    if (!unique.length) return;
    await Notification.insertMany(unique.map((userId) => ({ userId, type: "SYSTEM", title: n.title.slice(0, 200), message: n.message.slice(0, 2000), resourceType: n.resource.type, resourceId: n.resource.id, isRead: false, eventKey: `${n.eventKey}:${userId}`.slice(0, 80) })), { ordered: false }).catch(() => undefined);
  } catch { /* best effort */ }
}

/** Active, verified holders of a permission in the given agencies. Bounded. */
export async function holdersOf(agencyIds: Id[], permission: string, exclude: string[] = []): Promise<Id[]> {
  const roles = await Role.find({ isActive: true, permissions: permission }).select("_id").lean();
  const users = await User.find({ roleId: { $in: roles.map((r) => r._id) }, agencyId: { $in: agencyIds }, status: "ACTIVE", emailVerified: true }).select("_id").limit(60).lean();
  return users.map((u) => u._id as Id).filter((u) => !exclude.includes(String(u)));
}

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const escapeRx = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const keyOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "item";
