import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { projectReadFilter, projectWriteFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { PROJECT_LIST_SORT_FIELDS } from "./projects.schema.js";
import { actionBlock, actionPermission, hintActions, submitGaps, transitionTarget, type LifecycleAction } from "./lifecycle.policy.js";
import { AdminLifecycleLock, AGENCY_HIERARCHY_LOCK } from "../identity/admin-users/admin-lifecycle-lock.model.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Project } from "./models/project.model.js";
import type { ProjectCreateInput, ProjectListQuery, ProjectPatchInput, ProjectTransitionInput } from "./projects.schema.js";
import type { ProjectDetailDto, ProjectFailure, ProjectListDto, ProjectSummaryDto } from "./projects.types.js";

const WRITE_ROLES = new Set(["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);
const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);

export const projectHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export class ProjectDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("project service is temporarily unavailable");
    this.name = "ProjectDependencyError";
  }
}

class FlowControl extends Error {
  constructor(readonly status: ProjectFailure["status"], readonly code: ProjectFailure["code"]) {
    super(code);
    this.name = "FlowControl";
  }
}

type Loaded = {
  _id: mongoose.Types.ObjectId;
  projectCode: string;
  title: string;
  description?: string;
  projectType: string;
  status: string;
  agencyId: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId | null;
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  actualEndDate?: Date | null;
  physicalProgress?: number | null;
  location?: ProjectDetailDto["location"];
  geometry?: { type: string; coordinates: unknown } | null;
  budget?: { amountMinor: number; currency: "LKR" };
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
};

function fail(status: ProjectFailure["status"], code: ProjectFailure["code"]): ProjectFailure {
  return { ok: false, status, code };
}

function revisionOf(project: { __v?: number }): number {
  return typeof project.__v === "number" ? project.__v : 0;
}

function iso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

function mongoCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "number") {
    return (error as { code: number }).code;
  }
  if ("cause" in error) return mongoCode((error as { cause?: unknown }).cause);
  return undefined;
}

function isDuplicate(error: unknown): boolean {
  return mongoCode(error) === 11000;
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
  if (!locked) throw new ProjectDependencyError();
}

async function assertLive(
  actor: AuthenticatedActor,
  permissions: Permission[],
  session?: ClientSession,
): Promise<void> {
  const userQuery = User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  if (session) userQuery.session(session);
  const user = await userQuery;
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const roleQuery = Role.findById(actor.roleId).select("key isActive permissions");
  if (session) roleQuery.session(session);
  const role = await roleQuery;
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const allowed = role?.isActive && role.key === actor.roleKey && permissions.every((permission) => hasPermission(granted, permission));
  if (!allowed) {
    throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
}

async function readFilter(actor: AuthenticatedActor, session?: ClientSession) {
  if (PRIVATE_DENY.has(actor.roleKey)) return { denied: true as const };
  if (actor.roleKey === "INSPECTOR") {
    const query = Inspection.find({ inspectorId: actor.userId }).distinct("projectId");
    if (session) query.session(session);
    const ids = await query;
    return { denied: false as const, filter: { _id: { $in: ids } } };
  }
  const scope = await resolveResourceScope(actor);
  return { denied: false as const, filter: projectReadFilter(scope) };
}

async function agencyCodes(ids: mongoose.Types.ObjectId[]): Promise<Map<string, string>> {
  const rows = await Agency.find({ _id: { $in: ids } }).select("code");
  return new Map(rows.map((row) => [row._id.toString(), row.code]));
}

function summary(project: Loaded, codes: Map<string, string>): ProjectSummaryDto {
  return {
    id: project._id.toString(),
    projectCode: project.projectCode,
    title: project.title,
    projectType: project.projectType,
    status: project.status,
    agencyId: project.agencyId.toString(),
    agencyCode: codes.get(project.agencyId.toString()) ?? null,
    managerId: project.managerId ? project.managerId.toString() : null,
    startDate: iso(project.startDate),
    plannedEndDate: iso(project.plannedEndDate),
    createdAt: project.createdAt ? project.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : new Date(0).toISOString(),
    revision: revisionOf(project),
  };
}

async function managerName(project: Loaded): Promise<string | null> {
  if (!project.managerId) return null;
  const user = await User.findById(project.managerId).select("firstName lastName agencyId");
  if (!user || !user.agencyId || user.agencyId.toString() !== project.agencyId.toString()) return null;
  const name = `${user.firstName} ${user.lastName}`.replace(/\s+/g, " ").trim();
  return name || null;
}

function detail(
  project: Loaded,
  codes: Map<string, string>,
  includeBudget: boolean,
  manager: string | null,
  canEditDraft: boolean,
  availableActions: ("SUBMIT" | "HOLD" | "RESUME")[],
  submissionGaps: string[],
): ProjectDetailDto {
  return {
    ...summary(project, codes),
    description: project.description ?? null,
    location: project.location ?? null,
    geometry: project.geometry ?? null,
    actualEndDate: iso(project.actualEndDate),
    physicalProgress: typeof project.physicalProgress === "number" ? project.physicalProgress : null,
    managerName: manager,
    canEditDraft,
    availableActions,
    submissionGaps,
    ...(includeBudget && project.budget ? { budget: { amountMinor: project.budget.amountMinor, currency: "LKR" as const } } : {}),
  };
}

async function canEditProjectDraft(actor: AuthenticatedActor, project: Loaded): Promise<boolean> {
  if (project.status !== "DRAFT" || !WRITE_ROLES.has(actor.roleKey)) return false;
  try {
    const user = await User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.emailVerified !== true ||
      !user.agencyId ||
      user.credentialEpoch !== actor.credentialEpoch ||
      !user.roleId ||
      user.roleId.toString() !== actor.roleId
    ) {
      return false;
    }
    const role = await Role.findById(actor.roleId).select("key isActive permissions");
    const granted = Array.isArray(role?.permissions) ? role.permissions : [];
    if (!(role?.isActive && role.key === actor.roleKey && hasPermission(granted, "project.update"))) return false;
    const agency = await Agency.findById(actor.agencyId).select("status");
    if (!agency || agency.status !== "ACTIVE") return false;
    const scope = await resolveResourceScope(actor);
    const filter = projectWriteFilter(actor, scope);
    const match = await Project.findOne({ $and: [filter, { _id: project._id }] }).select("_id");
    return Boolean(match);
  } catch {
    return false;
  }
}

async function canReadBudget(actor: AuthenticatedActor): Promise<boolean> {
  const role = await Role.findById(actor.roleId).select("permissions isActive key");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  return Boolean(role?.isActive && role.key === actor.roleKey && hasPermission(granted, "finance.budget.read"));
}

function datesAllowed(start: Date | null | undefined, end: Date | null | undefined): boolean {
  if (start instanceof Date && end instanceof Date && end < start) return false;
  return true;
}

export async function listProjectCatalog(
  actor: AuthenticatedActor,
  query: ProjectListQuery,
): Promise<{ ok: true; list: ProjectListDto } | ProjectFailure> {
  try {
    await assertLive(actor, ["project.read"]);
    const scoped = await readFilter(actor);
    if (scoped.denied) return fail(403, "FORBIDDEN");
    const parts: Record<string, unknown>[] = [scoped.filter];
    if (query.status) parts.push({ status: query.status });
    if (query.type) parts.push({ projectType: query.type });
    if (query.q) {
      const pattern = escapeRegex(query.q);
      parts.push({ $or: [{ title: { $regex: pattern, $options: "i" } }, { projectCode: { $regex: pattern, $options: "i" } }] });
    }
    const catalogFilter = { $and: parts };
    const filter = query.agencyId
      ? { $and: [...parts, { agencyId: new mongoose.Types.ObjectId(query.agencyId) }] }
      : catalogFilter;
    const sortField = PROJECT_LIST_SORT_FIELDS.find((field) => field === query.sortBy) ?? "createdAt";
    const sort = { [sortField]: query.sortDir === "asc" ? 1 : -1, _id: 1 } as Record<string, 1 | -1>;
    const skip = (query.page - 1) * query.limit;
    const [rows, total, agencyIds] = await Promise.all([
      Project.find(filter).sort(sort).skip(skip).limit(query.limit),
      Project.countDocuments(filter),
      Project.distinct("agencyId", catalogFilter),
    ]);
    const codes = await agencyCodes([...rows.map((row) => row.agencyId), ...agencyIds]);
    const agencies = agencyIds
      .map((id) => ({ id: id.toString(), code: codes.get(id.toString()) ?? null }))
      .sort((left, right) => (left.code ?? left.id).localeCompare(right.code ?? right.id));
    return {
      ok: true,
      list: {
        projects: rows.map((row) => summary(row as Loaded, codes)),
        page: query.page,
        limit: query.limit,
        total,
        agencies,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProjectDependencyError();
  }
}

export async function getProject(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<{ ok: true; project: ProjectDetailDto } | ProjectFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor, ["project.read"]);
    const scoped = await readFilter(actor);
    if (scoped.denied) return fail(403, "FORBIDDEN");
    const project = await Project.findOne({ $and: [scoped.filter, { _id: rawId }] });
    if (!project) return fail(404, "NOT_FOUND");
    const codes = await agencyCodes([project.agencyId]);
    const loaded = project as Loaded;
    const manager = await managerName(loaded);
    const editable = await canEditProjectDraft(actor, loaded);
    const hints = await lifecycleHints(actor, loaded);
    return { ok: true, project: detail(loaded, codes, await canReadBudget(actor), manager, editable, hints.actions, hints.gaps) };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProjectDependencyError();
  }
}

async function writeAudit(
  actor: AuthenticatedActor,
  projectId: mongoose.Types.ObjectId,
  action: string,
  requestId: string,
  snapshot: { status: string; agencyId: mongoose.Types.ObjectId; budget?: { amountMinor: number; currency: "LKR" } },
  session: ClientSession,
  previous?: { status: string; agencyId: mongoose.Types.ObjectId },
): Promise<void> {
  await projectHooks.beforeAudit();
  await AuditLog.create(
    [
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action,
        resourceType: "PROJECT",
        resourceId: projectId,
        oldValue: previous ?? { status: snapshot.status, agencyId: snapshot.agencyId },
        newValue: snapshot,
        requestId: auditRequestId(requestId),
        agencyId: new mongoose.Types.ObjectId(actor.agencyId),
      },
    ],
    { session },
  );
}

export async function createProject(
  actor: AuthenticatedActor,
  input: ProjectCreateInput,
  requestId: string,
): Promise<{ ok: true; project: ProjectDetailDto } | ProjectFailure> {
  if (!WRITE_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  if (input.startDate && input.plannedEndDate && new Date(input.plannedEndDate) < new Date(input.startDate)) {
    return fail(400, "VALIDATION_ERROR");
  }
  let createdId = "";
  try {
    await seedHierarchyLock();
    for (let attempt = 0; attempt < 3 && !createdId; attempt += 1) {
      const mongo = await mongoose.startSession();
      try {
        await mongo.withTransaction(async () => {
          await holdHierarchyLock(mongo);
          await assertLive(actor, ["project.create"], mongo);
          const agency = await Agency.findById(actor.agencyId).session(mongo).select("status");
          if (!agency || agency.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
          const scope = await resolveResourceScope(actor);
          if (scope.kind === "none" || (scope.kind === "agencies" && !scope.agencyIds.some((id) => id.toString() === actor.agencyId))) {
            throw new FlowControl(403, "FORBIDDEN");
          }
        const existing = await Project.findOne({ projectCode: input.projectCode }).session(mongo).select("_id");
          if (existing) {
            const ownAudit = await AuditLog.findOne({
              resourceId: existing._id,
              requestId: auditRequestId(requestId),
              action: "project.created",
            }).session(mongo).select("_id");
            if (ownAudit) {
              createdId = existing._id.toString();
              return;
            }
            throw new FlowControl(409, "CONFLICT");
          }
          const doc = {
            projectCode: input.projectCode,
            title: input.title,
            description: input.description,
            projectType: input.projectType,
            agencyId: new mongoose.Types.ObjectId(actor.agencyId),
            managerId: actor.roleKey === "PROJECT_MANAGER" ? new mongoose.Types.ObjectId(actor.userId) : undefined,
            location: input.location,
            geometry: input.geometry,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : undefined,
            budget: input.budget,
            physicalProgress: 0,
            financialProgress: 0,
            status: "DRAFT" as const,
            createdBy: new mongoose.Types.ObjectId(actor.userId),
          };
          const [created] = await Project.create([doc], { session: mongo });
          if (!created) throw new ProjectDependencyError();
          createdId = created._id.toString();
          await writeAudit(
            actor,
            created._id,
            "project.created",
            requestId,
            { status: "DRAFT", agencyId: created.agencyId, budget: input.budget },
            mongo,
          );
        });
      } catch (error) {
        if (error instanceof FlowControl || error instanceof ProjectDependencyError) throw error;
        if (!isDuplicate(error)) throw error;
        const winner = await Project.findOne({ projectCode: input.projectCode }).select("_id");
        if (winner) {
          const ownAudit = await AuditLog.findOne({
            resourceId: winner._id,
            requestId: auditRequestId(requestId),
            action: "project.created",
          }).select("_id");
          if (ownAudit) {
            createdId = winner._id.toString();
            break;
          }
        }
        if (winner || attempt === 2) throw error;
      } finally {
        await mongo.endSession();
      }
    }
    if (!createdId) return fail(409, "CONFLICT");
    return getProject(actor, createdId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (isDuplicate(error)) return fail(409, "CONFLICT");
    throw new ProjectDependencyError();
  }
}

export async function updateProjectDraft(
  actor: AuthenticatedActor,
  rawId: string,
  input: ProjectPatchInput,
  requestId: string,
): Promise<{ ok: true; project: ProjectDetailDto } | ProjectFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  if (!WRITE_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  const mongo = await mongoose.startSession();
  try {
    await seedHierarchyLock();
    await mongo.withTransaction(async () => {
      await holdHierarchyLock(mongo);
      await assertLive(actor, ["project.update"], mongo);
      const agency = await Agency.findById(actor.agencyId).session(mongo).select("status");
      if (!agency || agency.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
      const scope = await resolveResourceScope(actor);
      const filter = projectWriteFilter(actor, scope);
      const current = await Project.findOne({ $and: [filter, { _id: rawId }] }).session(mongo);
      if (!current) throw new FlowControl(404, "NOT_FOUND");
      if (current.status !== "DRAFT") throw new FlowControl(409, "CONFLICT");
      if (revisionOf(current) !== input.revision) throw new FlowControl(409, "CONFLICT");
      const nextStart = input.startDate === undefined ? current.startDate : input.startDate === null ? null : new Date(input.startDate);
      const nextEnd = input.plannedEndDate === undefined ? current.plannedEndDate : input.plannedEndDate === null ? null : new Date(input.plannedEndDate);
      if (!datesAllowed(nextStart, nextEnd)) throw new FlowControl(400, "VALIDATION_ERROR");
      const $set: Record<string, unknown> = {};
      const $unset: Record<string, 1> = {};
      if (input.title !== undefined) $set.title = input.title;
      if (input.description === null) $unset.description = 1;
      else if (input.description !== undefined) $set.description = input.description;
      if (input.location === null) $unset.location = 1;
      else if (input.location !== undefined) $set.location = input.location;
      if (input.geometry === null) $unset.geometry = 1;
      else if (input.geometry !== undefined) $set.geometry = input.geometry;
      if (input.startDate === null) $unset.startDate = 1;
      else if (input.startDate !== undefined) $set.startDate = new Date(input.startDate);
      if (input.plannedEndDate === null) $unset.plannedEndDate = 1;
      else if (input.plannedEndDate !== undefined) $set.plannedEndDate = new Date(input.plannedEndDate);
      if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) return;
      const updated = await Project.findOneAndUpdate(
        { $and: [filter, { _id: current._id, status: "DRAFT", __v: input.revision }] },
        { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}), $inc: { __v: 1 } },
        { session: mongo, new: true, runValidators: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(
        actor,
        current._id,
        "project.updated",
        requestId,
        { status: "DRAFT", agencyId: current.agencyId },
        mongo,
        { status: current.status, agencyId: current.agencyId },
      );
    });
    return getProject(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProjectDependencyError();
  } finally {
    await mongo.endSession();
  }
}

async function lifecycleHints(
  actor: AuthenticatedActor,
  project: Loaded,
): Promise<{ actions: ("SUBMIT" | "HOLD" | "RESUME")[]; gaps: string[] }> {
  try {
    if (!WRITE_ROLES.has(actor.roleKey)) return { actions: [], gaps: [] };
    const role = await Role.findById(actor.roleId).select("key isActive permissions");
    const granted = Array.isArray(role?.permissions) ? role.permissions : [];
    if (!(role?.isActive && role.key === actor.roleKey)) return { actions: [], gaps: [] };
    const scope = await resolveResourceScope(actor);
    const match = await Project.findOne({ $and: [projectWriteFilter(actor, scope), { _id: project._id }] }).select("_id");
    if (!match) return { actions: [], gaps: [] };
    const actions = hintActions(project.status, granted).filter(
      (action): action is "SUBMIT" | "HOLD" | "RESUME" => action === "SUBMIT" || action === "HOLD" || action === "RESUME",
    );
    const gaps = project.status === "DRAFT" && granted.includes("project.submit") ? submitGaps(project) : [];
    return { actions, gaps };
  } catch {
    return { actions: [], gaps: [] };
  }
}

export async function transitionProject(
  actor: AuthenticatedActor,
  rawId: string,
  input: ProjectTransitionInput,
  requestId: string,
): Promise<{ ok: true; project: ProjectDetailDto } | ProjectFailure> {
  if (!/^[a-f0-9]{24}$/i.test(rawId)) return fail(400, "VALIDATION_ERROR");
  if (!WRITE_ROLES.has(actor.roleKey)) return fail(403, "FORBIDDEN");
  const action = input.action as LifecycleAction;
  const permission = actionPermission(action);
  if (!permission) return fail(403, "FORBIDDEN");
  if ((action === "HOLD" || action === "RESUME") && !input.reason) return fail(400, "VALIDATION_ERROR");
  const mongo = await mongoose.startSession();
  try {
    await seedHierarchyLock();
    await mongo.withTransaction(async () => {
      await holdHierarchyLock(mongo);
      await assertLive(actor, [permission], mongo);
      const agency = await Agency.findById(actor.agencyId).session(mongo).select("status");
      if (!agency || agency.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
      const scope = await resolveResourceScope(actor);
      const filter = projectWriteFilter(actor, scope);
      const current = await Project.findOne({ $and: [filter, { _id: rawId }] }).session(mongo);
      if (!current) throw new FlowControl(404, "NOT_FOUND");
      if (revisionOf(current) !== input.revision) throw new FlowControl(409, "CONFLICT");
      const block = actionBlock(action);
      if (block) throw new FlowControl(409, "CONFLICT");
      const target = transitionTarget(current.status, action);
      if (!target) throw new FlowControl(409, "CONFLICT");
      if (action === "SUBMIT" && submitGaps(current).length > 0) throw new FlowControl(400, "VALIDATION_ERROR");
      const updated = await Project.findOneAndUpdate(
        { $and: [filter, { _id: current._id, status: current.status, __v: input.revision }] },
        { $set: { status: target }, $inc: { __v: 1 } },
        { session: mongo, new: true, runValidators: true },
      );
      if (!updated) throw new FlowControl(409, "CONFLICT");
      await writeAudit(
        actor,
        current._id,
        action === "SUBMIT" ? "project.submitted" : "project.status_changed",
        requestId,
        { status: target, agencyId: current.agencyId },
        mongo,
        { status: current.status, agencyId: current.agencyId },
      );
    });
    return getProject(actor, rawId);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProjectDependencyError();
  } finally {
    await mongo.endSession();
  }
}
