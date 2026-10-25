import mongoose, { type ClientSession } from "mongoose";
import { PERMISSION_CATALOG, SYSTEM_ROLE_KEYS, type Permission, type SystemRoleKey } from "@infraos/shared-types";

import { AuditLog } from "../../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../auth/require-authenticated.js";
import { hasPermission } from "../authorization/require-permission.js";
import { AdminLifecycleLock, USER_LIFECYCLE_LOCK } from "../admin-users/admin-lifecycle-lock.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import { decideGrantUpdate } from "./admin-role.policy.js";
import type { RoleMetadataInput, RolePermissionsInput } from "./admin-role.schema.js";
import type {
  PermissionCatalogGroup,
  RoleAdminDto,
  RoleAdminFailure,
  RoleAdminSuccess,
} from "./admin-role.types.js";

const READ_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN"]);

export const adminRoleHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export class AdminRoleDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("role administration is temporarily unavailable");
    this.name = "AdminRoleDependencyError";
  }
}

class FlowControl extends Error {
  constructor(
    readonly status: RoleAdminFailure["status"],
    readonly code: RoleAdminFailure["code"],
  ) {
    super(code);
    this.name = "FlowControl";
  }
}

type LoadedRole = {
  _id: mongoose.Types.ObjectId;
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: string[];
  scopeType: string;
  isSystem: boolean;
  isActive: boolean;
  __v?: number;
};

function fail(status: RoleAdminFailure["status"], code: RoleAdminFailure["code"]): RoleAdminFailure {
  return { ok: false, status, code };
}

function revisionOf(role: { __v?: number }): number {
  return typeof role.__v === "number" ? role.__v : 0;
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((value) => values.has(value));
}

async function toDto(role: LoadedRole, session?: ClientSession): Promise<RoleAdminDto> {
  const count = User.countDocuments({ roleId: role._id });
  if (session) count.session(session);
  return {
    id: role._id.toString(),
    key: role.key,
    name: role.name,
    description: role.description,
    scopeType: role.scopeType,
    isSystem: true,
    isActive: role.isActive,
    permissions: [...role.permissions].sort() as Permission[],
    revision: revisionOf(role),
    assignedUserCount: await count,
  };
}

function assertReader(actor: AuthenticatedActor): RoleAdminFailure | null {
  if (!READ_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  return null;
}

function assertSuper(actor: AuthenticatedActor): RoleAdminFailure | null {
  if (actor.roleKey !== "SUPER_ADMIN") return fail(403, "FORBIDDEN");
  return null;
}

async function assertLiveGrant(
  actor: AuthenticatedActor,
  permissions: Permission[],
  session?: ClientSession,
): Promise<void> {
  const userQuery = User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  if (session) userQuery.session(session);
  const user = await userQuery;
  const epoch = user?.credentialEpoch ?? 0;
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.emailVerified !== true ||
    !user.agencyId ||
    epoch !== actor.credentialEpoch
  ) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const roleQuery = Role.findById(actor.roleId).select("key isActive permissions");
  if (session) roleQuery.session(session);
  const role = await roleQuery;
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const allowed =
    role?.isActive &&
    role.key === actor.roleKey &&
    permissions.every((permission) => hasPermission(granted, permission));
  if (!allowed) {
    throw new FlowControl(role?.isActive && role?.key === actor.roleKey ? 403 : 401, role?.isActive && role?.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
}

async function seedLock(): Promise<void> {
  await AdminLifecycleLock.updateOne(
    { key: USER_LIFECYCLE_LOCK },
    { $setOnInsert: { key: USER_LIFECYCLE_LOCK, seq: 0 } },
    { upsert: true },
  );
}

async function holdLock(session: ClientSession): Promise<void> {
  const locked = await AdminLifecycleLock.findOneAndUpdate(
    { key: USER_LIFECYCLE_LOCK },
    { $inc: { seq: 1 } },
    { session, new: true },
  );
  if (!locked) throw new AdminRoleDependencyError();
}

async function writeAudit(
  actor: AuthenticatedActor,
  role: LoadedRole,
  action: string,
  requestId: string,
  previous: string[],
  next: string[],
  session: ClientSession,
): Promise<void> {
  await adminRoleHooks.beforeAudit();
  await AuditLog.create(
    [
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action,
        resourceType: "ROLE",
        resourceId: role._id,
        oldValue: { permissions: previous },
        newValue: { permissions: next },
        requestId: auditRequestId(requestId),
        agencyId: new mongoose.Types.ObjectId(actor.agencyId),
      },
    ],
    { session },
  );
}

async function loadRole(rawId: string, session?: ClientSession): Promise<LoadedRole | RoleAdminFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  const query = Role.findById(rawId);
  if (session) query.session(session);
  const role = await query;
  if (!role || !SYSTEM_ROLE_KEYS.includes(role.key)) return fail(404, "NOT_FOUND");
  return role as LoadedRole;
}

export function permissionCatalog(): PermissionCatalogGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of PERMISSION_CATALOG) {
    const moduleName = permission.split(".")[0] ?? "other";
    const list = groups.get(moduleName) ?? [];
    list.push(permission);
    groups.set(moduleName, list);
  }
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
}

export async function listRoles(actor: AuthenticatedActor): Promise<{ ok: true; roles: RoleAdminDto[] } | RoleAdminFailure> {
  const denied = assertReader(actor);
  if (denied) return denied;
  try {
    await assertLiveGrant(actor, ["role.read"]);
    const rows = await Role.find({ key: { $in: [...SYSTEM_ROLE_KEYS] } }).sort({ key: 1 });
    const roles = await Promise.all(rows.map((row) => toDto(row as LoadedRole)));
    return { ok: true, roles };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AdminRoleDependencyError();
  }
}

export async function getRole(actor: AuthenticatedActor, rawId: string): Promise<RoleAdminSuccess | RoleAdminFailure> {
  const denied = assertReader(actor);
  if (denied) return denied;
  try {
    await assertLiveGrant(actor, ["role.read"]);
    const loaded = await loadRole(rawId);
    if (!("key" in loaded)) return loaded;
    return { ok: true, role: await toDto(loaded) };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AdminRoleDependencyError();
  }
}

export async function updateRoleMetadata(
  actor: AuthenticatedActor,
  rawId: string,
  input: RoleMetadataInput,
  requestId: string,
): Promise<RoleAdminSuccess | RoleAdminFailure> {
  const denied = assertSuper(actor);
  if (denied) return denied;
  let mongo: ClientSession | undefined;
  try {
    mongo = await mongoose.startSession();
    await seedLock();
    await mongo.withTransaction(async () => {
      await holdLock(mongo as ClientSession);
      await assertLiveGrant(actor, ["role.manage"], mongo as ClientSession);
      const loaded = await loadRole(rawId, mongo);
      if (!("key" in loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (!loaded.isActive || !loaded.isSystem) throw new FlowControl(409, "CONFLICT");
      if (revisionOf(loaded) !== input.revision) throw new FlowControl(409, "CONFLICT");
      if (loaded.name === input.name && loaded.description === input.description) return;
      const updated = await Role.findOneAndUpdate(
        { _id: loaded._id, __v: input.revision, key: loaded.key, scopeType: loaded.scopeType, isActive: true },
        { $set: { name: input.name, description: input.description }, $inc: { __v: 1 } },
        { session: mongo, new: true, runValidators: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(actor, loaded, "identity.role.updated", requestId, loaded.permissions, loaded.permissions, mongo as ClientSession);
    });
    return getRole(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AdminRoleDependencyError();
  } finally {
    await mongo?.endSession();
  }
}

export async function updateRolePermissions(
  actor: AuthenticatedActor,
  rawId: string,
  input: RolePermissionsInput,
  requestId: string,
): Promise<RoleAdminSuccess | RoleAdminFailure> {
  const denied = assertSuper(actor);
  if (denied) return denied;
  let mongo: ClientSession | undefined;
  try {
    mongo = await mongoose.startSession();
    await seedLock();
    await mongo.withTransaction(async () => {
      await holdLock(mongo as ClientSession);
      await assertLiveGrant(actor, ["role.manage", "permission.manage"], mongo as ClientSession);
      const loaded = await loadRole(rawId, mongo);
      if (!("key" in loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (!loaded.isActive || !loaded.isSystem) throw new FlowControl(409, "CONFLICT");
      if (revisionOf(loaded) !== input.revision) throw new FlowControl(409, "CONFLICT");
      const decision = decideGrantUpdate(loaded.key, loaded.permissions, input.permissions);
      if (!decision.ok) throw new FlowControl(decision.status, decision.code);
      if (loaded.key === "SUPER_ADMIN") {
        const operable = await User.countDocuments({
          roleId: loaded._id,
          status: "ACTIVE",
          emailVerified: true,
          agencyId: { $ne: null },
        }).session(mongo as ClientSession);
        if (operable < 1) throw new FlowControl(409, "CONFLICT");
      }
      if (sameSet(loaded.permissions, decision.next)) return;
      const updated = await Role.findOneAndUpdate(
        { _id: loaded._id, __v: input.revision, key: loaded.key },
        { $set: { permissions: decision.next }, $inc: { __v: 1 } },
        { session: mongo as ClientSession, new: true, runValidators: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(actor, loaded, "identity.role.permissions_updated", requestId, loaded.permissions, decision.next, mongo as ClientSession);
    });
    return getRole(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AdminRoleDependencyError();
  } finally {
    await mongo?.endSession();
  }
}
