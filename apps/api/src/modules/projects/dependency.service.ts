import mongoose from "mongoose";
import type { Permission } from "@infraos/shared-types";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { DEPENDENCY_GRAPH_LOCK_ID, DependencyGraphLock } from "./models/dependency-graph-lock.model.js";
import { ProjectDependency } from "./models/project-dependency.model.js";
import { Project } from "./models/project.model.js";
import {
  DEPENDENCY_LINK_TYPE,
  GRAPH_EDGE_CAP,
  dependencyStatusAllowed,
  prerequisiteReachesDependent,
} from "./dependency.policy.js";
import type { DependencyCandidateQuery, DependencyCreateBody, DependencyListQuery, DependencyRemoveBody } from "./dependency.schema.js";
import type { ProjectFailure } from "./projects.types.js";

const WRITE_DENY = new Set(["SUPER_ADMIN", "CONTRACTOR", "INSPECTOR", "CITIZEN"]);

class FlowControl extends Error {
  constructor(readonly status: ProjectFailure["status"], readonly code: ProjectFailure["code"]) {
    super(code);
  }
}

class RetryGraph extends Error {}

export class DependencyLinkError extends Error {}

export const dependencyHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export type DependencyLinkDto = {
  id: string;
  direction: "depends_on";
  type: "PREREQUISITE";
  scheduling: "informational";
  prerequisite:
    | { visibility: "visible"; projectId: string; projectCode: string; title: string; projectStatus: string }
    | { visibility: "restricted" };
  recordedAt: string;
  revision: number;
};

function fail(status: ProjectFailure["status"], code: ProjectFailure["code"]): ProjectFailure {
  return { ok: false, status, code };
}

function auditRequestId(requestId: string | undefined): string {
  const value = requestId?.trim();
  return value && value.length <= 80 ? value : "dependency";
}

async function liveGrants(actor: AuthenticatedActor, permissions: Permission[], session?: mongoose.ClientSession): Promise<void> {
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

async function readScope(actor: AuthenticatedActor) {
  return projectReadFilter(await resolveResourceScope(actor));
}

async function ensureLock(): Promise<void> {
  await DependencyGraphLock.updateOne(
    { _id: DEPENDENCY_GRAPH_LOCK_ID },
    { $setOnInsert: { seq: 0 } },
    { upsert: true },
  );
}

async function currentRevision(): Promise<number> {
  await ensureLock();
  const lock = await DependencyGraphLock.findById(DEPENDENCY_GRAPH_LOCK_ID).select("seq");
  return lock?.seq ?? 0;
}

function visiblePrerequisite(project: { _id: mongoose.Types.ObjectId; projectCode: string; title: string; status: string }) {
  return {
    visibility: "visible" as const,
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    title: project.title,
    projectStatus: project.status,
  };
}

export async function listProjectDependencies(actor: AuthenticatedActor, projectId: string, query: DependencyListQuery) {
  try {
    await liveGrants(actor, ["project.read", "project.timeline.read"]);
    if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
    const dependent = await Project.findOne({ $and: [await readScope(actor), { _id: projectId }] }).select("_id");
    if (!dependent) throw new FlowControl(404, "NOT_FOUND");
    const graphRevision = await currentRevision();
    const filter = { projectId: dependent._id, removedAt: null };
    const total = await ProjectDependency.countDocuments(filter);
    const rows = await ProjectDependency.find(filter).sort({ createdAt: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit);
    const targetIds = rows.map((row) => row.prerequisiteProjectId);
    const visible = await Project.find({ $and: [await readScope(actor), { _id: { $in: targetIds } }] }).select("projectCode title status");
    const byId = new Map(visible.map((project) => [project._id.toString(), project]));
    const links: DependencyLinkDto[] = rows.map((row) => {
      const target = byId.get(row.prerequisiteProjectId.toString());
      return {
        id: row._id.toString(),
        direction: "depends_on",
        type: "PREREQUISITE",
        scheduling: "informational",
        prerequisite: target ? visiblePrerequisite(target) : { visibility: "restricted" },
        recordedAt: (row.createdAt ?? new Date(0)).toISOString(),
        revision: row.__v ?? 0,
      };
    });
    return { ok: true as const, dependencies: { projectId, graphRevision, links, page: query.page, limit: query.limit, total, scheduling: "informational" as const } };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new DependencyLinkError();
  }
}

export async function searchDependencyCandidates(actor: AuthenticatedActor, projectId: string, query: DependencyCandidateQuery) {
  try {
    await liveGrants(actor, ["project.update"]);
    if (WRITE_DENY.has(actor.roleKey)) throw new FlowControl(403, "FORBIDDEN");
    if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
    const scope = await resolveResourceScope(actor);
    const dependent = await Project.findOne({ $and: [projectWriteFilter(actor, scope), { _id: projectId }] }).select("agencyId status");
    if (!dependent) throw new FlowControl(404, "NOT_FOUND");
    if (!dependencyStatusAllowed(dependent.status)) throw new FlowControl(409, "CONFLICT");
    const term = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const text = term.length > 0 ? { $or: [{ projectCode: new RegExp(term, "i") }, { title: new RegExp(term, "i") }] } : {};
    const rows = await Project.find({
      $and: [
        await readScope(actor),
        { agencyId: dependent.agencyId, _id: { $ne: dependent._id } },
        text,
      ],
    }).select("projectCode title status").sort({ projectCode: 1 }).limit(8);
    return {
      ok: true as const,
      candidates: rows.map((row) => ({
        projectId: row._id.toString(),
        projectCode: row.projectCode,
        title: row.title,
        projectStatus: row.status,
      })),
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new DependencyLinkError();
  }
}

async function claimRevision(expected: number, session: mongoose.ClientSession): Promise<void> {
  const updated = await DependencyGraphLock.findOneAndUpdate(
    { _id: DEPENDENCY_GRAPH_LOCK_ID, seq: expected },
    { $inc: { seq: 1 } },
    { session, new: true },
  );
  if (!updated) throw new RetryGraph();
}

async function activeEdges(agencyId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  const rows = await ProjectDependency.find({ agencyId, removedAt: null }).select("projectId prerequisiteProjectId").limit(GRAPH_EDGE_CAP + 1).session(session);
  if (rows.length > GRAPH_EDGE_CAP) throw new FlowControl(503, "SERVICE_UNAVAILABLE");
  return rows.map((row) => ({ from: row.projectId.toString(), to: row.prerequisiteProjectId.toString() }));
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const labeled = error as { code?: number; hasErrorLabel?: (label: string) => boolean };
  if (labeled.code === 112) return true;
  return Boolean(labeled.hasErrorLabel?.("TransientTransactionError"));
}

async function runGraph<T>(graphRevision: number, work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  await ensureLock();
  const starting = await DependencyGraphLock.findById(DEPENDENCY_GRAPH_LOCK_ID).select("seq");
  if ((starting?.seq ?? 0) !== graphRevision) throw new FlowControl(409, "CONFLICT");
  const expected = graphRevision;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const mongo = await mongoose.startSession();
    try {
      let saved: T | undefined;
      await mongo.withTransaction(async () => {
        await claimRevision(expected, mongo);
        saved = await work(mongo);
      });
      if (saved === undefined) throw new DependencyLinkError();
      return saved;
    } catch (error) {
      if (error instanceof FlowControl || error instanceof DependencyLinkError) throw error;
      if ((error as { code?: number }).code === 11000 || error instanceof RetryGraph) throw new FlowControl(409, "CONFLICT");
      if (!isRetryable(error)) throw error;
      const latest = await DependencyGraphLock.findById(DEPENDENCY_GRAPH_LOCK_ID).select("seq");
      if ((latest?.seq ?? 0) !== expected) throw new FlowControl(409, "CONFLICT");
    } finally {
      await mongo.endSession();
    }
  }
  throw new FlowControl(409, "CONFLICT");
}

export async function addProjectDependency(actor: AuthenticatedActor, projectId: string, input: DependencyCreateBody, requestId: string | undefined) {
  try {
    const saved = await runGraph(input.graphRevision, async (session) => {
      await liveGrants(actor, ["project.update"], session);
      if (WRITE_DENY.has(actor.roleKey)) throw new FlowControl(403, "FORBIDDEN");
      if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
      if (projectId.toLowerCase() === input.prerequisiteProjectId.toLowerCase()) throw new FlowControl(409, "CONFLICT");
      const scope = await resolveResourceScope(actor);
      const dependent = await Project.findOne({ $and: [projectWriteFilter(actor, scope), { _id: projectId }] }).select("agencyId status").session(session);
      if (!dependent) throw new FlowControl(404, "NOT_FOUND");
      if (!dependencyStatusAllowed(dependent.status)) throw new FlowControl(409, "CONFLICT");
      const prerequisite = await Project.findOne({ $and: [await readScope(actor), { _id: input.prerequisiteProjectId }] }).select("agencyId status projectCode title").session(session);
      if (!prerequisite) throw new FlowControl(404, "NOT_FOUND");
      if (prerequisite.agencyId.toString() !== dependent.agencyId.toString()) throw new FlowControl(409, "CONFLICT");
      const edges = await activeEdges(dependent.agencyId, session);
      const cycle = prerequisiteReachesDependent(prerequisite._id.toString(), dependent._id.toString(), edges);
      if (cycle === "too_large") throw new FlowControl(503, "SERVICE_UNAVAILABLE");
      if (cycle === "cycle") throw new FlowControl(409, "CONFLICT");
      const existing = await ProjectDependency.findOne({ projectId: dependent._id, prerequisiteProjectId: prerequisite._id }).sort({ createdAt: -1 }).session(session);
      if (existing && existing.removedAt == null) throw new FlowControl(409, "CONFLICT");
      let row = existing;
      if (row) {
        await ProjectDependency.updateOne(
          { _id: row._id },
          { $set: { removedAt: null, type: DEPENDENCY_LINK_TYPE }, $unset: { removedBy: "" } },
          { session },
        );
        row = await ProjectDependency.findById(row._id).session(session);
      } else {
        const created = await ProjectDependency.create([{
          projectId: dependent._id,
          prerequisiteProjectId: prerequisite._id,
          agencyId: dependent.agencyId,
          type: DEPENDENCY_LINK_TYPE,
          createdBy: new mongoose.Types.ObjectId(actor.userId),
          removedAt: null,
        }], { session });
        row = created[0] ?? null;
      }
      if (!row) throw new DependencyLinkError();
      await dependencyHooks.beforeAudit();
      await AuditLog.create([{
        userId: new mongoose.Types.ObjectId(actor.userId),
        action: "project.dependency_linked",
        resourceType: "PROJECT",
        resourceId: dependent._id,
        oldValue: { agencyId: dependent.agencyId },
        newValue: { agencyId: dependent.agencyId, dependencyId: row._id, prerequisiteProjectId: prerequisite._id },
        requestId: auditRequestId(requestId),
        agencyId: new mongoose.Types.ObjectId(actor.agencyId),
      }], { session });
      const lock = await DependencyGraphLock.findById(DEPENDENCY_GRAPH_LOCK_ID).select("seq").session(session);
      return {
        link: {
          id: row._id.toString(),
          direction: "depends_on" as const,
          type: "PREREQUISITE" as const,
          scheduling: "informational" as const,
          prerequisite: visiblePrerequisite(prerequisite),
          recordedAt: (row.createdAt ?? new Date()).toISOString(),
          revision: row.__v ?? 0,
        },
        graphRevision: lock?.seq ?? input.graphRevision + 1,
        dependentStatus: dependent.status,
        prerequisiteStatus: prerequisite.status,
      };
    });
    return { ok: true as const, ...saved };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new DependencyLinkError();
  }
}

export async function removeProjectDependency(actor: AuthenticatedActor, projectId: string, dependencyId: string, input: DependencyRemoveBody, requestId: string | undefined) {
  try {
    const saved = await runGraph(input.graphRevision, async (session) => {
      await liveGrants(actor, ["project.update"], session);
      if (WRITE_DENY.has(actor.roleKey)) throw new FlowControl(403, "FORBIDDEN");
      if (!/^[a-f0-9]{24}$/i.test(projectId) || !/^[a-f0-9]{24}$/i.test(dependencyId)) throw new FlowControl(400, "VALIDATION_ERROR");
      const scope = await resolveResourceScope(actor);
      const dependent = await Project.findOne({ $and: [projectWriteFilter(actor, scope), { _id: projectId }] }).select("agencyId status").session(session);
      if (!dependent) throw new FlowControl(404, "NOT_FOUND");
      if (!dependencyStatusAllowed(dependent.status)) throw new FlowControl(409, "CONFLICT");
      const row = await ProjectDependency.findOne({ _id: dependencyId, projectId: dependent._id, removedAt: null }).session(session);
      if (!row) throw new FlowControl(404, "NOT_FOUND");
      const statusBefore = dependent.status;
      row.removedAt = new Date();
      row.removedBy = new mongoose.Types.ObjectId(actor.userId);
      await row.save({ session });
      await dependencyHooks.beforeAudit();
      await AuditLog.create([{
        userId: new mongoose.Types.ObjectId(actor.userId),
        action: "project.dependency_removed",
        resourceType: "PROJECT",
        resourceId: dependent._id,
        oldValue: { agencyId: dependent.agencyId, dependencyId: row._id, prerequisiteProjectId: row.prerequisiteProjectId },
        newValue: { agencyId: dependent.agencyId },
        requestId: auditRequestId(requestId),
        agencyId: new mongoose.Types.ObjectId(actor.agencyId),
      }], { session });
      const after = await Project.findById(dependent._id).select("status").session(session);
      if (!after || after.status !== statusBefore) throw new DependencyLinkError();
      const lock = await DependencyGraphLock.findById(DEPENDENCY_GRAPH_LOCK_ID).select("seq").session(session);
      return { removedId: row._id.toString(), graphRevision: lock?.seq ?? input.graphRevision + 1, dependentStatus: after.status };
    });
    return { ok: true as const, ...saved };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new DependencyLinkError();
  }
}

export async function timelineDependencyLinks(actor: AuthenticatedActor, projectId: mongoose.Types.ObjectId) {
  const rows = await ProjectDependency.find({ projectId, removedAt: null }).sort({ createdAt: 1, _id: 1 }).limit(25);
  const visible = await Project.find({ $and: [await readScope(actor), { _id: { $in: rows.map((row) => row.prerequisiteProjectId) } }] }).select("projectCode title status");
  const byId = new Map(visible.map((project) => [project._id.toString(), project]));
  return {
    status: "visible" as const,
    scheduling: "informational" as const,
    links: rows.map((row) => {
      const target = byId.get(row.prerequisiteProjectId.toString());
      return {
        id: row._id.toString(),
        direction: "depends_on" as const,
        scheduling: "informational" as const,
        prerequisite: target ? visiblePrerequisite(target) : { visibility: "restricted" as const },
        recordedAt: (row.createdAt ?? new Date(0)).toISOString(),
      };
    }),
  };
}
