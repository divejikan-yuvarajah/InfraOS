import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { resolveResourceScope, type ResourceScope } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import type { ContractorViewer } from "./contractor.access.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";
import { Contractor } from "./models/contractor.model.js";

export type Failure = { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE"; details: Record<string, unknown> | null };
export type Result<T> = { ok: true; data: T } | Failure;

export class Flow extends Error {
  constructor(readonly status: Failure["status"], readonly code: Failure["code"], readonly details: Record<string, unknown> | null = null) {
    super(code);
    this.name = "Flow";
  }
}
export const failed = (status: Failure["status"], code: Failure["code"], details: Record<string, unknown> | null = null): Failure => ({ ok: false, status, code, details });
export const notFound = (): Failure => failed(404, "NOT_FOUND");

export class ContractorDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() { super("contractor service is temporarily unavailable"); this.name = "ContractorDependencyError"; }
}

export type Ctx = { viewer: ContractorViewer; scope: ResourceScope; has: (p: Permission) => boolean; agencyObjectIds: mongoose.Types.ObjectId[] };

/**
 * Re-reads the live user and role (never trusts the token's claims), resolves the viewer's agency scope and builds the tier flags.
 * Called inside the write transaction too, so a revoked grant or a moved agency cannot be used by an in-flight request.
 */
export async function contextOf(actor: AuthenticatedActor, session?: ClientSession): Promise<Ctx> {
  const userQuery = User.findById(actor.userId).select("roleId status emailVerified credentialEpoch");
  if (session) userQuery.session(session);
  const user = await userQuery;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || (user.credentialEpoch ?? 0) !== actor.credentialEpoch || !user.roleId || user.roleId.toString() !== actor.roleId) throw new Flow(401, "AUTH_REQUIRED");
  const roleQuery = Role.findById(actor.roleId).select("key isActive permissions");
  if (session) roleQuery.session(session);
  const role = await roleQuery;
  if (!role?.isActive || role.key !== actor.roleKey) throw new Flow(401, "AUTH_REQUIRED");
  const granted = Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
  const has = (p: Permission) => hasPermission(granted, p);
  const scope = await resolveResourceScope(actor);
  const agencyObjectIds = scope.kind === "agencies" ? scope.agencyIds : [];
  return {
    scope, has, agencyObjectIds,
    viewer: { platform: scope.kind === "platform", agencyIds: agencyObjectIds.map(String), canRead: has("contractor.read"), canManage: has("contractor.manage"), canPerformance: has("contractor.performance.read"), canBudget: has("finance.budget.read") },
  };
}

export function need(ctx: Ctx, permission: Permission): void {
  if (!ctx.has(permission)) throw new Flow(403, "FORBIDDEN");
}

/** Scope filter for the contractors collection: registered by an in-scope agency OR assigned (any status) to an in-scope project. */
export async function visibleFilter(ctx: Ctx, session?: ClientSession): Promise<Record<string, unknown>> {
  if (!ctx.viewer.canRead) return { _id: { $in: [] } };
  if (ctx.scope.kind === "platform") return {};
  if (ctx.scope.kind !== "agencies") return { _id: { $in: [] } };
  const q = ContractorAssignment.distinct("contractorId", { agencyId: { $in: ctx.agencyObjectIds } });
  if (session) q.session(session);
  const assigned = await q;
  return { $or: [{ registeredByAgencyId: { $in: ctx.agencyObjectIds } }, { _id: { $in: assigned } }] };
}

export async function assignedInScope(ctx: Ctx, contractorId: mongoose.Types.ObjectId, session?: ClientSession): Promise<boolean> {
  if (ctx.scope.kind === "platform") return true;
  if (ctx.scope.kind !== "agencies") return false;
  const q = ContractorAssignment.exists({ contractorId, agencyId: { $in: ctx.agencyObjectIds } });
  if (session) q.session(session);
  return Boolean(await q);
}

export async function agencyNames(ids: (mongoose.Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((i): i is mongoose.Types.ObjectId => Boolean(i)).map(String))];
  if (!unique.length) return new Map();
  const rows = await Agency.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

export const auditRequestId = (requestId: string): string => {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
};

type Snapshot = { status?: string; reason?: string; agencyId?: mongoose.Types.ObjectId | null; contractorId?: mongoose.Types.ObjectId; projectId?: mongoose.Types.ObjectId; assignmentId?: mongoose.Types.ObjectId; amount?: { amountMinor: number; currency: "LKR" } };

/** Allowlisted snapshot keys only. Contact data, tax ids and request bodies are never written here. */
export async function writeAudit(session: ClientSession, input: { actor: AuthenticatedActor; action: string; contractorId: mongoose.Types.ObjectId; agencyId?: mongoose.Types.ObjectId | null; oldValue?: Snapshot; newValue?: Snapshot; requestId: string }): Promise<void> {
  const clean = (s?: Snapshot) => (s && Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)));
  await AuditLog.create([{
    userId: new mongoose.Types.ObjectId(input.actor.userId), action: input.action, resourceType: "CONTRACTOR", resourceId: input.contractorId,
    oldValue: clean(input.oldValue), newValue: clean(input.newValue), requestId: auditRequestId(input.requestId),
    ...(input.agencyId ? { agencyId: input.agencyId } : {}),
  }], { session });
}

/** Serialises writers on one contractor (assign vs suspend/archive) without disturbing the profile's optimistic-concurrency token. */
export async function lockContractor(session: ClientSession, contractorId: mongoose.Types.ObjectId): Promise<void> {
  await Contractor.updateOne({ _id: contractorId }, { $inc: { lockSeq: 1 } }, { session, timestamps: false });
}

export function run<T>(fn: () => Promise<T>): Promise<T | Failure> {
  return fn().catch((error: unknown) => {
    if (error instanceof Flow) return failed(error.status, error.code, error.details);
    throw error;
  });
}
