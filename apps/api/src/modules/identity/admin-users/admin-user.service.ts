import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";
import type { SystemRoleKey } from "@infraos/shared-types";

import { Agency } from "../../agencies/models/agency.model.js";
import { AuditLog } from "../../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../auth/require-authenticated.js";
import { resolveResourceScope, type ResourceScope } from "../authorization/resource-scope.js";
import { hasPermission } from "../authorization/require-permission.js";
import { RefreshFamily } from "../models/refresh-family.model.js";
import { RefreshSession } from "../models/refresh-session.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import {
  RegistrationConflictError,
  RegistrationDeniedError,
  RegistrationDependencyError,
  RegistrationPolicyBlockedError,
  provisionStaff,
} from "../registration.service.js";
import { RegistrationInputError } from "../registration.schema.js";
import type { TrustedProvisioningActor } from "../registration.types.js";
import { AdminLifecycleLock, USER_LIFECYCLE_LOCK } from "./admin-lifecycle-lock.model.js";
import type {
  AdminUserAssignmentInput,
  AdminUserCreateInput,
  AdminUserListQuery,
  AdminUserNamePatchInput,
  AdminUserRevisionInput,
} from "./admin-user.schema.js";
import type { AdminUserDto, AdminUserFailure, AdminUserList, AdminUserSuccess } from "./admin-user.types.js";

const READ_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER"]);
const WRITE_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN"]);
const PRIVILEGED_TARGETS = new Set(["SUPER_ADMIN", "GOV_ADMIN"]);
const GOV_CREATE_ROLES = new Set(["AGENCY_OFFICER", "PROJECT_MANAGER", "CONTRACTOR", "INSPECTOR"]);
const SUPER_CREATE_ROLES = new Set([
  "GOV_ADMIN",
  "AGENCY_OFFICER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
  "INSPECTOR",
]);

export const adminUserHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export class AdminUserDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("admin user directory is temporarily unavailable");
    this.name = "AdminUserDependencyError";
  }
}

class FlowControl extends Error {
  constructor(
    readonly status: AdminUserFailure["status"],
    readonly code: AdminUserFailure["code"],
  ) {
    super(code);
    this.name = "FlowControl";
  }
}

type LoadedUser = {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  emailVerified: boolean;
  roleId: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId | null;
  credentialEpoch?: number;
  __v?: number;
};

function fail(status: AdminUserFailure["status"], code: AdminUserFailure["code"]): AdminUserFailure {
  return { ok: false, status, code };
}

async function assertLiveGrant(
  actor: AuthenticatedActor,
  permission: Permission,
  session?: ClientSession,
): Promise<void> {
  const userQuery = User.findById(actor.userId).select("roleId status emailVerified credentialEpoch");
  if (session) userQuery.session(session);
  const user = await userQuery;
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const roleQuery = Role.findById(actor.roleId).select("key isActive permissions");
  if (session) roleQuery.session(session);
  const role = await roleQuery;
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  if (!role?.isActive || role.key !== actor.roleKey || !hasPermission(granted, permission)) {
    throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
}

function revisionOf(user: { __v?: number }): number {
  return typeof user.__v === "number" ? user.__v : 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

async function roleKeyOf(roleId: mongoose.Types.ObjectId, session?: ClientSession): Promise<string | null> {
  const query = Role.findById(roleId).select("key isActive");
  if (session) query.session(session);
  const role = await query;
  return role?.key ?? null;
}

async function agencyNameOf(
  agencyId: mongoose.Types.ObjectId | null | undefined,
): Promise<string | null> {
  if (!agencyId) return null;
  const agency = await Agency.findById(agencyId).select("name");
  return agency?.name ?? null;
}

function toDto(user: LoadedUser, roleKey: string, agencyName: string | null): AdminUserDto {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
    roleKey,
    agencyId: user.agencyId ? user.agencyId.toString() : null,
    agencyName,
    revision: revisionOf(user),
  };
}

function inScope(scope: ResourceScope, agencyId: mongoose.Types.ObjectId | null): boolean {
  if (scope.kind === "platform") return true;
  if (scope.kind !== "agencies" || !agencyId) return false;
  return scope.agencyIds.some((id) => id.equals(agencyId));
}

async function citizenRoleIds(): Promise<mongoose.Types.ObjectId[]> {
  const roles = await Role.find({ key: "CITIZEN" }).select("_id");
  return roles.map((role) => role._id);
}

function assertDirectory(actor: AuthenticatedActor, mode: "read" | "write" | "assign"): AdminUserFailure | null {
  if (!READ_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  if (mode === "write" && !WRITE_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  if (mode === "assign" && actor.roleKey !== "SUPER_ADMIN") return fail(403, "FORBIDDEN");
  return null;
}

async function seedLifecycleLock(): Promise<void> {
  await AdminLifecycleLock.updateOne(
    { key: USER_LIFECYCLE_LOCK },
    { $setOnInsert: { key: USER_LIFECYCLE_LOCK, seq: 0 } },
    { upsert: true },
  );
}

async function ensureLock(session: ClientSession): Promise<void> {
  const locked = await AdminLifecycleLock.findOneAndUpdate(
    { key: USER_LIFECYCLE_LOCK },
    { $inc: { seq: 1 } },
    { session, new: true },
  );
  if (!locked) throw new AdminUserDependencyError();
}

async function revokeCredentials(
  userId: mongoose.Types.ObjectId,
  now: Date,
  session: ClientSession,
): Promise<void> {
  await RefreshFamily.updateMany(
    { userId },
    { $set: { closedAt: now, activeTokenHash: null } },
    { session },
  );
  await RefreshSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: now } },
    { session },
  );
}

async function writeAudit(
  actor: AuthenticatedActor,
  targetId: mongoose.Types.ObjectId,
  action: string,
  requestId: string,
  oldValue: { status?: string; roleId?: mongoose.Types.ObjectId; agencyId?: mongoose.Types.ObjectId | null },
  newValue: { status?: string; roleId?: mongoose.Types.ObjectId; agencyId?: mongoose.Types.ObjectId | null },
  session: ClientSession,
): Promise<void> {
  await adminUserHooks.beforeAudit();
  await AuditLog.create(
    [
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action,
        resourceType: "USER",
        resourceId: targetId,
        oldValue,
        newValue,
        requestId: auditRequestId(requestId),
        agencyId: actor.agencyId ? new mongoose.Types.ObjectId(actor.agencyId) : null,
      },
    ],
    { session },
  );
}

async function viableSuperAdminCount(
  exceptId: mongoose.Types.ObjectId | null,
  session: ClientSession,
): Promise<number> {
  const role = await Role.findOne({ key: "SUPER_ADMIN", isActive: true }).select("_id").session(session);
  if (!role) return 0;
  const filter: Record<string, unknown> = {
    roleId: role._id,
    status: "ACTIVE",
    emailVerified: true,
  };
  if (exceptId) filter._id = { $ne: exceptId };
  return User.countDocuments(filter).session(session);
}

export async function listAdminUsers(
  actor: AuthenticatedActor,
  query: AdminUserListQuery,
): Promise<{ ok: true; list: AdminUserList } | AdminUserFailure> {
  const denied = assertDirectory(actor, "read");
  if (denied) return denied;
  try {
    const scope = await resolveResourceScope(actor);
    const filter: Record<string, unknown> = {};
    if (scope.kind === "none") {
      return { ok: true, list: { users: [], page: query.page, pageSize: query.pageSize, total: 0 } };
    }
    if (scope.kind === "agencies") filter.agencyId = { $in: scope.agencyIds };
    const citizens = await citizenRoleIds();
    if (citizens.length > 0) filter.roleId = { $nin: citizens };
    if (query.status) filter.status = query.status;
    if (query.q) {
      const pattern = escapeRegex(query.q);
      filter.$or = [
        { firstName: { $regex: pattern, $options: "i" } },
        { lastName: { $regex: pattern, $options: "i" } },
        { email: { $regex: pattern, $options: "i" } },
      ];
    }
    const total = await User.countDocuments(filter);
    const rows = await User.find(filter)
      .select("firstName lastName email status emailVerified roleId agencyId __v")
      .sort({ email: 1, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize);
    const roleIds = [...new Set(rows.map((row) => row.roleId.toString()))];
    const agencyIds = [...new Set(rows.flatMap((row) => (row.agencyId ? [row.agencyId.toString()] : [])))];
    const [roles, agencies] = await Promise.all([
      Role.find({ _id: { $in: roleIds } }).select("key"),
      Agency.find({ _id: { $in: agencyIds } }).select("name"),
    ]);
    const roleMap = new Map(roles.map((role) => [role._id.toString(), role.key]));
    const agencyMap = new Map(agencies.map((agency) => [agency._id.toString(), agency.name]));
    const users = rows.flatMap((row) => {
      const roleKey = roleMap.get(row.roleId.toString());
      if (!roleKey || roleKey === "CITIZEN") return [];
      return [
        toDto(
          row as LoadedUser,
          roleKey,
          row.agencyId ? (agencyMap.get(row.agencyId.toString()) ?? null) : null,
        ),
      ];
    });
    return { ok: true, list: { users, page: query.page, pageSize: query.pageSize, total } };
  } catch (error) {
    if (error instanceof AdminUserDependencyError) throw error;
    throw new AdminUserDependencyError();
  }
}

async function loadVisible(
  actor: AuthenticatedActor,
  rawId: string,
  session?: ClientSession,
): Promise<{ user: LoadedUser; roleKey: string; scope: ResourceScope } | AdminUserFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  const scope = await resolveResourceScope(actor);
  const query = User.findById(rawId).select(
    "firstName lastName email status emailVerified roleId agencyId credentialEpoch __v",
  );
  if (session) query.session(session);
  const user = await query;
  if (!user) return fail(404, "NOT_FOUND");
  const roleKey = await roleKeyOf(user.roleId, session);
  if (!roleKey || roleKey === "CITIZEN" || !inScope(scope, user.agencyId ?? null)) {
    return fail(404, "NOT_FOUND");
  }
  return { user: user as LoadedUser, roleKey, scope };
}

export async function getAdminUser(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  const denied = assertDirectory(actor, "read");
  if (denied) return denied;
  try {
    const loaded = await loadVisible(actor, rawId);
    if (!("user" in loaded)) return loaded;
    return { ok: true, user: toDto(loaded.user, loaded.roleKey, await agencyNameOf(loaded.user.agencyId)) };
  } catch (error) {
    if (error instanceof AdminUserDependencyError) throw error;
    throw new AdminUserDependencyError();
  }
}

function createRoleAllowed(actor: AuthenticatedActor, roleKey: SystemRoleKey): boolean {
  if (roleKey === "SUPER_ADMIN" || roleKey === "CITIZEN") return false;
  if (actor.roleKey === "SUPER_ADMIN") return SUPER_CREATE_ROLES.has(roleKey);
  if (actor.roleKey === "GOV_ADMIN") return GOV_CREATE_ROLES.has(roleKey);
  return false;
}

export async function createAdminUser(
  actor: AuthenticatedActor,
  input: AdminUserCreateInput,
  requestId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  const denied = assertDirectory(actor, "write");
  if (denied) return denied;
  if (input.roleKey === "SUPER_ADMIN") return fail(409, "CONFLICT");
  if (!createRoleAllowed(actor, input.roleKey)) return fail(403, "FORBIDDEN");
  try {
    const scope = await resolveResourceScope(actor);
    if (scope.kind === "none") return fail(403, "FORBIDDEN");
    if (actor.roleKey === "GOV_ADMIN") {
      if (!input.agencyCode || scope.kind !== "agencies") return fail(403, "FORBIDDEN");
      const agency = await Agency.findOne({ code: input.agencyCode, status: "ACTIVE" }).select("_id");
      if (!agency || !scope.agencyIds.some((id) => id.equals(agency._id))) return fail(403, "FORBIDDEN");
    }
    const trusted: TrustedProvisioningActor = {
      source: "server-internal",
      capability: "identity.provision",
      actorUserId: actor.userId,
    };
    const mongo = await mongoose.startSession();
    let provisionedId = "";
    try {
      await mongo.withTransaction(async () => {
        await assertLiveGrant(actor, "user.create", mongo);
        const result = await provisionStaff(input, trusted, mongo);
        provisionedId = result.user.id;
        const created = await User.findById(provisionedId).session(mongo).select("roleId agencyId status");
        if (!created) throw new AdminUserDependencyError();
        await writeAudit(
          actor,
          created._id,
          "identity.user.provisioned",
          requestId,
          {},
          { status: "PENDING", roleId: created.roleId, agencyId: created.agencyId },
          mongo,
        );
      });
    } finally {
      await mongo.endSession();
    }
    const loaded = await getAdminUser(actor, provisionedId);
    if (!loaded.ok) return loaded;
    return { ok: true, user: loaded.user, activationDelivery: "BLOCKED" };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof RegistrationConflictError) return fail(409, "CONFLICT");
    if (error instanceof RegistrationInputError || error instanceof RegistrationPolicyBlockedError) {
      return fail(400, "VALIDATION_ERROR");
    }
    if (error instanceof RegistrationDeniedError) return fail(403, "FORBIDDEN");
    if (error instanceof RegistrationDependencyError || error instanceof AdminUserDependencyError) {
      throw new AdminUserDependencyError();
    }
    throw new AdminUserDependencyError();
  }
}

function mutateDenied(actor: AuthenticatedActor, targetRole: string, targetId: string): AdminUserFailure | null {
  if (targetId === actor.userId) return fail(409, "CONFLICT");
  if (actor.roleKey === "GOV_ADMIN" && PRIVILEGED_TARGETS.has(targetRole)) return fail(403, "FORBIDDEN");
  return null;
}

export async function updateAdminUserName(
  actor: AuthenticatedActor,
  rawId: string,
  input: AdminUserNamePatchInput,
  requestId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  const denied = assertDirectory(actor, "write");
  if (denied) return denied;
  try {
    const loaded = await loadVisible(actor, rawId);
    if (!("user" in loaded)) return loaded;
    const blocked = mutateDenied(actor, loaded.roleKey, loaded.user._id.toString());
    if (blocked) return blocked;
    if (revisionOf(loaded.user) !== input.revision) return fail(409, "CONFLICT");
    if (loaded.user.firstName === input.firstName && loaded.user.lastName === input.lastName) {
      return { ok: true, user: toDto(loaded.user, loaded.roleKey, await agencyNameOf(loaded.user.agencyId)) };
    }
    const mongo = await mongoose.startSession();
    try {
      await mongo.withTransaction(async () => {
        await assertLiveGrant(actor, "user.update", mongo);
        const updated = await User.findOneAndUpdate(
          { _id: loaded.user._id, __v: input.revision },
          {
            $set: {
              firstName: input.firstName,
              lastName: input.lastName,
              updatedBy: new mongoose.Types.ObjectId(actor.userId),
            },
            $inc: { __v: 1 },
          },
          { session: mongo, new: true },
        );
        if (!updated) throw new FlowControl(409, "CONFLICT");
        await writeAudit(
          actor,
          updated._id,
          "identity.user.updated",
          requestId,
          { status: loaded.user.status, roleId: loaded.user.roleId, agencyId: loaded.user.agencyId },
          { status: updated.status, roleId: updated.roleId, agencyId: updated.agencyId },
          mongo,
        );
      });
    } finally {
      await mongo.endSession();
    }
    return getAdminUser(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof AdminUserDependencyError) throw error;
    throw new AdminUserDependencyError();
  }
}

async function setStatus(
  actor: AuthenticatedActor,
  rawId: string,
  input: AdminUserRevisionInput,
  requestId: string,
  nextStatus: "DISABLED" | "ACTIVE",
): Promise<AdminUserSuccess | AdminUserFailure> {
  const denied = assertDirectory(actor, "write");
  if (denied) return denied;
  const mongo = await mongoose.startSession();
  try {
    await seedLifecycleLock();
    let result: AdminUserSuccess | null = null;
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "user.disable", mongo);
      await ensureLock(mongo);
      const loaded = await loadVisible(actor, rawId, mongo);
      if (!("user" in loaded)) throw new FlowControl(loaded.status, loaded.code);
      const blocked = mutateDenied(actor, loaded.roleKey, loaded.user._id.toString());
      if (blocked) throw new FlowControl(blocked.status, blocked.code);
      if (revisionOf(loaded.user) !== input.revision) throw new FlowControl(409, "CONFLICT");
      if (nextStatus === "DISABLED" && loaded.user.status === "DISABLED") {
        result = { ok: true, user: toDto(loaded.user, loaded.roleKey, await agencyNameOf(loaded.user.agencyId)) };
        return;
      }
      if (nextStatus === "ACTIVE" && loaded.user.status === "ACTIVE") {
        result = { ok: true, user: toDto(loaded.user, loaded.roleKey, await agencyNameOf(loaded.user.agencyId)) };
        return;
      }
      if (nextStatus === "ACTIVE") {
        if (loaded.user.status !== "DISABLED" || loaded.user.emailVerified !== true) {
          throw new FlowControl(409, "CONFLICT");
        }
        const role = await Role.findById(loaded.user.roleId).select("isActive").session(mongo);
        if (!role?.isActive) throw new FlowControl(409, "CONFLICT");
        if (!loaded.user.agencyId) throw new FlowControl(409, "CONFLICT");
        const agency = await Agency.findById(loaded.user.agencyId).select("status").session(mongo);
        if (!agency || agency.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
      }
      if (nextStatus === "DISABLED" && loaded.roleKey === "SUPER_ADMIN" && loaded.user.status === "ACTIVE" && loaded.user.emailVerified) {
        const others = await viableSuperAdminCount(loaded.user._id, mongo);
        if (others < 1) throw new FlowControl(409, "CONFLICT");
      }
      const epoch = loaded.user.credentialEpoch ?? 0;
      const updated = await User.findOneAndUpdate(
        { _id: loaded.user._id, __v: input.revision, credentialEpoch: epoch, status: loaded.user.status },
        {
          $set: {
            status: nextStatus,
            credentialEpoch: epoch + 1,
            updatedBy: new mongoose.Types.ObjectId(actor.userId),
          },
          $inc: { __v: 1 },
        },
        { session: mongo, new: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await revokeCredentials(updated._id, new Date(), mongo);
      await writeAudit(
        actor,
        updated._id,
        nextStatus === "DISABLED" ? "identity.user.disabled" : "identity.user.enabled",
        requestId,
        { status: loaded.user.status, roleId: loaded.user.roleId, agencyId: loaded.user.agencyId },
        { status: nextStatus, roleId: updated.roleId, agencyId: updated.agencyId },
        mongo,
      );
    });
    return result ?? (await getAdminUser(actor, rawId));
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof AdminUserDependencyError) throw error;
    throw new AdminUserDependencyError();
  } finally {
    await mongo.endSession();
  }
}

export function disableAdminUser(
  actor: AuthenticatedActor,
  rawId: string,
  input: AdminUserRevisionInput,
  requestId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  return setStatus(actor, rawId, input, requestId, "DISABLED");
}

export function enableAdminUser(
  actor: AuthenticatedActor,
  rawId: string,
  input: AdminUserRevisionInput,
  requestId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  return setStatus(actor, rawId, input, requestId, "ACTIVE");
}

export async function assignAdminUser(
  actor: AuthenticatedActor,
  rawId: string,
  input: AdminUserAssignmentInput,
  requestId: string,
): Promise<AdminUserSuccess | AdminUserFailure> {
  const denied = assertDirectory(actor, "assign");
  if (denied) return denied;
  if (input.roleKey === "SUPER_ADMIN" || input.roleKey === "CITIZEN") return fail(409, "CONFLICT");
  const mongo = await mongoose.startSession();
  try {
    await seedLifecycleLock();
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "user.update", mongo);
      await ensureLock(mongo);
      const loaded = await loadVisible(actor, rawId, mongo);
      if (!("user" in loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (loaded.user._id.toString() === actor.userId) throw new FlowControl(409, "CONFLICT");
      if (revisionOf(loaded.user) !== input.revision) throw new FlowControl(409, "CONFLICT");
      let nextRoleId = loaded.user.roleId;
      let nextRoleKey = loaded.roleKey;
      if (input.roleKey) {
        if (!SUPER_CREATE_ROLES.has(input.roleKey)) throw new FlowControl(403, "FORBIDDEN");
        const role = await Role.findOne({ key: input.roleKey, isActive: true }).session(mongo);
        if (!role) throw new FlowControl(400, "VALIDATION_ERROR");
        nextRoleId = role._id;
        nextRoleKey = role.key;
      }
      let nextAgencyId = loaded.user.agencyId;
      if (input.agencyCode !== undefined) {
        if (input.agencyCode === null) throw new FlowControl(409, "CONFLICT");
        const agency = await Agency.findOne({ code: input.agencyCode, status: "ACTIVE" }).session(mongo);
        if (!agency) throw new FlowControl(400, "VALIDATION_ERROR");
        nextAgencyId = agency._id;
      }
      if (!nextAgencyId) throw new FlowControl(409, "CONFLICT");
      if (loaded.roleKey === "SUPER_ADMIN" && nextRoleKey !== "SUPER_ADMIN") {
        if (loaded.user.status === "ACTIVE" && loaded.user.emailVerified) {
          const others = await viableSuperAdminCount(loaded.user._id, mongo);
          if (others < 1) throw new FlowControl(409, "CONFLICT");
        }
      }
      const epoch = loaded.user.credentialEpoch ?? 0;
      const updated = await User.findOneAndUpdate(
        { _id: loaded.user._id, __v: input.revision, credentialEpoch: epoch },
        {
          $set: {
            roleId: nextRoleId,
            agencyId: nextAgencyId,
            credentialEpoch: epoch + 1,
            updatedBy: new mongoose.Types.ObjectId(actor.userId),
          },
          $inc: { __v: 1 },
        },
        { session: mongo, new: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await revokeCredentials(updated._id, new Date(), mongo);
      await writeAudit(
        actor,
        updated._id,
        "identity.user.assignment_changed",
        requestId,
        { status: loaded.user.status, roleId: loaded.user.roleId, agencyId: loaded.user.agencyId },
        { status: updated.status, roleId: updated.roleId, agencyId: updated.agencyId },
        mongo,
      );
    });
    return getAdminUser(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof AdminUserDependencyError) throw error;
    throw new AdminUserDependencyError();
  } finally {
    await mongo.endSession();
  }
}
