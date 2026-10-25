import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { AuditLog } from "../../audit/models/audit-log.model.js";
import { Project } from "../../projects/models/project.model.js";
import { WorkRequest } from "../../roadsync/models/work-request.model.js";
import type { AuthenticatedActor } from "../../identity/auth/require-authenticated.js";
import { hasPermission } from "../../identity/authorization/require-permission.js";
import { resolveResourceScope, type ResourceScope } from "../../identity/authorization/resource-scope.js";
import {
  AGENCY_HIERARCHY_LOCK,
  AdminLifecycleLock,
} from "../../identity/admin-users/admin-lifecycle-lock.model.js";
import { Role } from "../../identity/models/role.model.js";
import { User } from "../../identity/models/user.model.js";
import { mapMongoDuplicateField } from "../../../shared/errors/mongo-duplicate.js";
import { Agency } from "../models/agency.model.js";
import type {
  AgencyCreateInput,
  AgencyDeactivateInput,
  AgencyListQuery,
  AgencyMetadataPatchInput,
  AgencyReparentInput,
} from "./agency-management.schema.js";
import type {
  AgencyDto,
  AgencyFailure,
  AgencyImpact,
  AgencyList,
  AgencySuccess,
} from "./agency-management.types.js";

const READ_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);
const MAX_DEPTH = 8;

export const agencyManagementHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export class AgencyManagementDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("agency directory is temporarily unavailable");
    this.name = "AgencyManagementDependencyError";
  }
}

class FlowControl extends Error {
  constructor(
    readonly status: AgencyFailure["status"],
    readonly code: AgencyFailure["code"],
    readonly details: AgencyImpact | null = null,
  ) {
    super(code);
    this.name = "FlowControl";
  }
}

type LoadedAgency = {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  shortName?: string | null;
  type: string;
  status: string;
  parentAgencyId?: mongoose.Types.ObjectId | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  __v?: number;
};

function fail(
  status: AgencyFailure["status"],
  code: AgencyFailure["code"],
  details: AgencyImpact | null = null,
): AgencyFailure {
  return { ok: false, status, code, details };
}

function revisionOf(agency: { __v?: number }): number {
  return typeof agency.__v === "number" ? agency.__v : 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

function toDto(agency: LoadedAgency): AgencyDto {
  return {
    id: agency._id.toString(),
    code: agency.code,
    name: agency.name,
    shortName: agency.shortName ?? null,
    type: agency.type,
    status: agency.status,
    parentAgencyId: agency.parentAgencyId ? agency.parentAgencyId.toString() : null,
    description: agency.description ?? null,
    contactEmail: agency.contactEmail ?? null,
    contactPhone: agency.contactPhone ?? null,
    address: agency.address ?? null,
    revision: revisionOf(agency),
  };
}

function isLoadedAgency(value: LoadedAgency | AgencyFailure): value is LoadedAgency {
  return !("ok" in value);
}

function visible(scope: ResourceScope, id: mongoose.Types.ObjectId): boolean {
  if (scope.kind === "platform") return true;
  if (scope.kind !== "agencies") return false;
  return scope.agencyIds.some((agencyId) => agencyId.equals(id));
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
    throw new FlowControl(
      role?.isActive && role.key === actor.roleKey ? 403 : 401,
      role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED",
    );
  }
}

async function seedHierarchyLock(): Promise<void> {
  await AdminLifecycleLock.updateOne(
    { key: AGENCY_HIERARCHY_LOCK },
    { $setOnInsert: { key: AGENCY_HIERARCHY_LOCK, seq: 0 } },
    { upsert: true },
  );
}

async function holdHierarchyLock(session: ClientSession): Promise<void> {
  const locked = await AdminLifecycleLock.findOneAndUpdate(
    { key: AGENCY_HIERARCHY_LOCK },
    { $inc: { seq: 1 } },
    { session, new: true },
  );
  if (!locked) throw new AgencyManagementDependencyError();
}

async function writeAudit(
  actor: AuthenticatedActor,
  targetId: mongoose.Types.ObjectId,
  action: string,
  requestId: string,
  oldValue: { status?: string; agencyId?: mongoose.Types.ObjectId | null },
  newValue: { status?: string; agencyId?: mongoose.Types.ObjectId | null },
  session: ClientSession,
): Promise<void> {
  await agencyManagementHooks.beforeAudit();
  await AuditLog.create(
    [
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action,
        resourceType: "AGENCY",
        resourceId: targetId,
        oldValue,
        newValue,
        requestId: auditRequestId(requestId),
        agencyId: targetId,
      },
    ],
    { session },
  );
}

async function ancestorChain(
  startId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<mongoose.Types.ObjectId[] | "broken"> {
  const chain: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  let current: mongoose.Types.ObjectId | null = startId;
  for (let depth = 0; depth < MAX_DEPTH && current; depth += 1) {
    const key = current.toString();
    if (seen.has(key)) return "broken";
    seen.add(key);
    chain.push(current);
    const node = await Agency.findById(current).select("parentAgencyId").session(session);
    if (!node) return "broken";
    current = node.parentAgencyId ?? null;
  }
  if (current) return "broken";
  return chain;
}

async function descendantIds(
  rootId: mongoose.Types.ObjectId,
  session: ClientSession,
): Promise<mongoose.Types.ObjectId[] | "broken"> {
  const ids = [rootId];
  const seen = new Set([rootId.toString()]);
  let frontier = [rootId];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    const children = await Agency.find({ parentAgencyId: { $in: frontier } }).select("_id").session(session);
    const next: mongoose.Types.ObjectId[] = [];
    for (const child of children) {
      const key = child._id.toString();
      if (seen.has(key)) return "broken";
      seen.add(key);
      ids.push(child._id);
      next.push(child._id);
    }
    frontier = next;
  }
  if (frontier.length > 0) return "broken";
  return ids;
}

async function impactOf(id: mongoose.Types.ObjectId, session: ClientSession): Promise<AgencyImpact> {
  const [activeChildren, activeUsers, projects, workRequests] = await Promise.all([
    Agency.countDocuments({ parentAgencyId: id, status: "ACTIVE" }).session(session),
    User.countDocuments({ agencyId: id, status: { $in: ["PENDING", "ACTIVE", "SUSPENDED"] } }).session(session),
    Project.countDocuments({ agencyId: id, status: { $nin: ["CANCELLED", "COMPLETED"] } }).session(session),
    WorkRequest.countDocuments({ agencyId: id, status: { $nin: ["CANCELLED", "COMPLETED"] } }).session(session),
  ]);
  return { activeChildren, activeUsers, projects, workRequests };
}

function blocked(impact: AgencyImpact): boolean {
  return impact.activeChildren > 0 || impact.activeUsers > 0 || impact.projects > 0 || impact.workRequests > 0;
}

export async function listAgencies(
  actor: AuthenticatedActor,
  query: AgencyListQuery,
): Promise<{ ok: true; list: AgencyList } | AgencyFailure> {
  if (!READ_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  try {
    await assertLiveGrant(actor, "agency.read");
    const scope = await resolveResourceScope(actor);
    if (scope.kind === "none") {
      return { ok: true, list: { agencies: [], page: query.page, pageSize: query.pageSize, total: 0 } };
    }
    const filter: Record<string, unknown> = {};
    if (scope.kind === "agencies") filter._id = { $in: scope.agencyIds };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.q) {
      const pattern = escapeRegex(query.q);
      filter.$or = [{ name: { $regex: pattern, $options: "i" } }, { code: { $regex: pattern, $options: "i" } }];
    }
    const total = await Agency.countDocuments(filter);
    const rows = await Agency.find(filter)
      .select("code name shortName type status parentAgencyId description contactEmail contactPhone address __v")
      .sort({ code: 1, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize);
    return {
      ok: true,
      list: {
        agencies: rows.map((row) => toDto(row as LoadedAgency)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code, error.details);
    throw new AgencyManagementDependencyError();
  }
}

async function loadVisible(
  actor: AuthenticatedActor,
  rawId: string,
  session?: ClientSession,
): Promise<LoadedAgency | AgencyFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  const scope = await resolveResourceScope(actor);
  const query = Agency.findById(rawId).select(
    "code name shortName type status parentAgencyId description contactEmail contactPhone address __v",
  );
  if (session) query.session(session);
  const agency = await query;
  if (!agency || !visible(scope, agency._id)) return fail(404, "NOT_FOUND");
  return agency as LoadedAgency;
}

export async function getAgency(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AgencySuccess | AgencyFailure> {
  if (!READ_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  try {
    await assertLiveGrant(actor, "agency.read");
    const loaded = await loadVisible(actor, rawId);
    if (!isLoadedAgency(loaded)) return loaded;
    return { ok: true, agency: toDto(loaded) };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AgencyManagementDependencyError();
  }
}

function assertManager(actor: AuthenticatedActor): AgencyFailure | null {
  if (actor.roleKey !== "SUPER_ADMIN") return fail(403, "FORBIDDEN");
  return null;
}

export async function createAgency(
  actor: AuthenticatedActor,
  input: AgencyCreateInput,
  requestId: string,
): Promise<AgencySuccess | AgencyFailure> {
  const denied = assertManager(actor);
  if (denied) return denied;
  if (input.type === "MINISTRY" && input.parentAgencyId) return fail(400, "VALIDATION_ERROR");
  if (input.type !== "MINISTRY" && !input.parentAgencyId) return fail(400, "VALIDATION_ERROR");
  const mongo = await mongoose.startSession();
  let createdId = "";
  try {
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "agency.manage", mongo);
      if (input.parentAgencyId) {
        const parent = await Agency.findById(input.parentAgencyId).select("status").session(mongo);
        if (!parent || parent.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
      }
      const created = (
        await Agency.create(
          [
            {
              code: input.code,
              name: input.name,
              type: input.type,
              shortName: input.shortName ?? null,
              description: input.description ?? null,
              contactEmail: input.contactEmail ?? null,
              contactPhone: input.contactPhone ?? null,
              address: input.address ?? null,
              status: "ACTIVE",
              parentAgencyId: input.parentAgencyId ? new mongoose.Types.ObjectId(input.parentAgencyId) : null,
            },
          ],
          { session: mongo },
        )
      )[0];
      if (!created) throw new AgencyManagementDependencyError();
      createdId = created._id.toString();
      await writeAudit(
        actor,
        created._id,
        "identity.agency.created",
        requestId,
        {},
        { status: "ACTIVE", agencyId: created.parentAgencyId },
        mongo,
      );
    });
    return getAgency(actor, createdId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code, error.details);
    if (mapMongoDuplicateField(error) === "code") return fail(409, "CONFLICT");
    throw new AgencyManagementDependencyError();
  } finally {
    await mongo.endSession();
  }
}

export async function updateAgencyMetadata(
  actor: AuthenticatedActor,
  rawId: string,
  input: AgencyMetadataPatchInput,
  requestId: string,
): Promise<AgencySuccess | AgencyFailure> {
  const denied = assertManager(actor);
  if (denied) return denied;
  const mongo = await mongoose.startSession();
  try {
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "agency.manage", mongo);
      const loaded = await loadVisible(actor, rawId, mongo);
      if (!isLoadedAgency(loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (revisionOf(loaded) !== input.revision) throw new FlowControl(409, "CONFLICT");
      const next = {
        name: input.name ?? loaded.name,
        shortName: input.shortName === undefined ? (loaded.shortName ?? null) : input.shortName,
        description: input.description === undefined ? (loaded.description ?? null) : input.description,
        contactEmail: input.contactEmail === undefined ? (loaded.contactEmail ?? null) : input.contactEmail,
        contactPhone: input.contactPhone === undefined ? (loaded.contactPhone ?? null) : input.contactPhone,
        address: input.address === undefined ? (loaded.address ?? null) : input.address,
      };
      const unchanged =
        next.name === loaded.name &&
        next.shortName === (loaded.shortName ?? null) &&
        next.description === (loaded.description ?? null) &&
        next.contactEmail === (loaded.contactEmail ?? null) &&
        next.contactPhone === (loaded.contactPhone ?? null) &&
        next.address === (loaded.address ?? null);
      if (unchanged) return;
      const updated = await Agency.findOneAndUpdate(
        { _id: loaded._id, __v: input.revision, code: loaded.code, type: loaded.type, status: loaded.status },
        { $set: next, $inc: { __v: 1 } },
        { session: mongo, new: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(
        actor,
        updated._id,
        "identity.agency.updated",
        requestId,
        { status: loaded.status, agencyId: loaded.parentAgencyId ?? null },
        { status: updated.status, agencyId: updated.parentAgencyId ?? null },
        mongo,
      );
    });
    return getAgency(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AgencyManagementDependencyError();
  } finally {
    await mongo.endSession();
  }
}

export async function reparentAgency(
  actor: AuthenticatedActor,
  rawId: string,
  input: AgencyReparentInput,
  requestId: string,
): Promise<AgencySuccess | AgencyFailure> {
  const denied = assertManager(actor);
  if (denied) return denied;
  const mongo = await mongoose.startSession();
  try {
    await seedHierarchyLock();
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "agency.manage", mongo);
      await holdHierarchyLock(mongo);
      const loaded = await loadVisible(actor, rawId, mongo);
      if (!isLoadedAgency(loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (revisionOf(loaded) !== input.revision) throw new FlowControl(409, "CONFLICT");
      const nextParent = input.parentAgencyId ? new mongoose.Types.ObjectId(input.parentAgencyId) : null;
      const currentParent = loaded.parentAgencyId ?? null;
      if ((currentParent?.toString() ?? null) === (nextParent?.toString() ?? null)) return;
      if (loaded.type === "MINISTRY" && nextParent) throw new FlowControl(409, "CONFLICT");
      if (loaded.type !== "MINISTRY" && !nextParent) throw new FlowControl(409, "CONFLICT");
      if (nextParent) {
        if (nextParent.equals(loaded._id)) throw new FlowControl(409, "CONFLICT");
        const parent = await Agency.findById(nextParent).select("status").session(mongo);
        if (!parent || parent.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
        const ancestors = await ancestorChain(nextParent, mongo);
        const descendants = await descendantIds(loaded._id, mongo);
        if (ancestors === "broken" || descendants === "broken") throw new FlowControl(409, "CONFLICT");
        if (ancestors.some((id) => id.equals(loaded._id)) || descendants.some((id) => id.equals(nextParent))) {
          throw new FlowControl(409, "CONFLICT");
        }
      }
      const updated = await Agency.findOneAndUpdate(
        {
          _id: loaded._id,
          __v: input.revision,
          parentAgencyId: currentParent,
        },
        { $set: { parentAgencyId: nextParent }, $inc: { __v: 1 } },
        { session: mongo, new: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(
        actor,
        updated._id,
        "identity.agency.reparented",
        requestId,
        { status: loaded.status, agencyId: currentParent },
        { status: updated.status, agencyId: nextParent },
        mongo,
      );
    });
    return getAgency(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new AgencyManagementDependencyError();
  } finally {
    await mongo.endSession();
  }
}

export async function deactivateAgency(
  actor: AuthenticatedActor,
  rawId: string,
  input: AgencyDeactivateInput,
  requestId: string,
): Promise<AgencySuccess | AgencyFailure> {
  const denied = assertManager(actor);
  if (denied) return denied;
  const mongo = await mongoose.startSession();
  try {
    await seedHierarchyLock();
    await mongo.withTransaction(async () => {
      await assertLiveGrant(actor, "agency.manage", mongo);
      await holdHierarchyLock(mongo);
      const loaded = await loadVisible(actor, rawId, mongo);
      if (!isLoadedAgency(loaded)) throw new FlowControl(loaded.status, loaded.code);
      if (revisionOf(loaded) !== input.revision) throw new FlowControl(409, "CONFLICT");
      if (loaded.status === "INACTIVE") return;
      const impact = await impactOf(loaded._id, mongo);
      if (blocked(impact)) throw new FlowControl(409, "CONFLICT", impact);
      const updated = await Agency.findOneAndUpdate(
        { _id: loaded._id, __v: input.revision, status: "ACTIVE" },
        { $set: { status: "INACTIVE" }, $inc: { __v: 1 } },
        { session: mongo, new: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(
        actor,
        updated._id,
        "identity.agency.deactivated",
        requestId,
        { status: "ACTIVE", agencyId: loaded.parentAgencyId ?? null },
        { status: "INACTIVE", agencyId: updated.parentAgencyId ?? null },
        mongo,
      );
    });
    return getAgency(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code, error.details);
    throw new AgencyManagementDependencyError();
  } finally {
    await mongo.endSession();
  }
}
