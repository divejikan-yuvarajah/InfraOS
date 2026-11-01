import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectWriteFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Project } from "../projects/models/project.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { candidateCounts, requestIdsWithCandidates } from "./candidate.counts.js";
import { validateWorkGeometry, type GeoIssue } from "./geo.service.js";
import type { WorkRequestCreateInput, WorkRequestListQuery } from "./work-requests.schema.js";

/** Draft work requests are only planned against projects that are approved and not closed (BR-PRJ-007). */
const PROJECT_ELIGIBLE = new Set(["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED"]);
const MATCH_NONE = { _id: { $in: [] as mongoose.Types.ObjectId[] } };

type Code = "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";

export class FlowControl extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code: Code) {
    super(code);
  }
}

export class WorkRequestDependencyError extends Error {}
export const workRequestHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

export type WorkRequestFailure = { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: Code; details?: GeoIssue[] };

export type WorkRequestView = {
  id: string;
  projectId: string;
  agencyId: string;
  projectTitle: string | null;
  projectCode: string | null;
  agencyName: string | null;
  workType: string;
  status: string;
  priority: string;
  plannedStart: string;
  plannedEnd: string;
  geometry: { type: string; coordinates: unknown };
  createdAt: string;
  updatedAt: string;
  revision: number;
  detection: { status: string; completedAt: string | null; counts: { nearby: number; candidates: number; agencies: number; truncated: boolean } | null } | null;
  nearbyCount: number;
};

function fail(status: WorkRequestFailure["status"], code: Code): WorkRequestFailure {
  return { ok: false, status, code };
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

export async function assertLive(actor: AuthenticatedActor, permissions: Permission[], session?: ClientSession): Promise<void> {
  const userQuery = User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  if (session) userQuery.session(session);
  const user = await userQuery;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId || (user.credentialEpoch ?? 0) !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const roleQuery = Role.findById(actor.roleId).select("key isActive permissions");
  if (session) roleQuery.session(session);
  const role = await roleQuery;
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  if (!(role?.isActive && role.key === actor.roleKey)) throw new FlowControl(401, "AUTH_REQUIRED");
  if (!permissions.every((permission) => hasPermission(granted, permission))) throw new FlowControl(403, "FORBIDDEN");
}

/** Server-built read filter. An unknown relationship is match-none, never {}. */
export async function readFilter(actor: AuthenticatedActor): Promise<Record<string, unknown>> {
  const scope = await resolveResourceScope(actor);
  if (scope.kind === "none") return MATCH_NONE;
  if (actor.roleKey === "PROJECT_MANAGER") {
    const agencyIds = scope.kind === "agencies" ? scope.agencyIds : [];
    const projects = await Project.find({ agencyId: { $in: agencyIds }, managerId: actor.userId }).select("_id");
    return { projectId: { $in: projects.map((item) => item._id) } };
  }
  if (scope.kind === "platform") return { agencyId: { $exists: true, $ne: null } };
  return { agencyId: { $in: scope.agencyIds } };
}

type Row = {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId;
  workType: string;
  status: string;
  priority: string;
  plannedStart: Date;
  plannedEnd: Date;
  geometry: { type: string; coordinates: unknown };
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
  detection?: { status: string; completedAt?: Date; counts?: { nearby: number; candidates: number; agencies: number; truncated: boolean } } | null;
};

async function toViews(rows: Row[], session?: ClientSession): Promise<WorkRequestView[]> {
  const projectQuery = Project.find({ _id: { $in: rows.map((row) => row.projectId) } }).select("title projectCode");
  const agencyQuery = Agency.find({ _id: { $in: rows.map((row) => row.agencyId) } }).select("name");
  if (session) {
    projectQuery.session(session);
    agencyQuery.session(session);
  }
  const [projects, agencies, nearby] = await Promise.all([projectQuery, agencyQuery, candidateCounts(rows.map((row) => row._id))]);
  const project = new Map(projects.map((item) => [item._id.toString(), item]));
  const agency = new Map(agencies.map((item) => [item._id.toString(), item.name]));
  return rows.map((row) => ({
    id: row._id.toString(),
    projectId: row.projectId.toString(),
    agencyId: row.agencyId.toString(),
    projectTitle: project.get(row.projectId.toString())?.title ?? null,
    projectCode: project.get(row.projectId.toString())?.projectCode ?? null,
    agencyName: agency.get(row.agencyId.toString()) ?? null,
    workType: row.workType,
    status: row.status,
    priority: row.priority,
    plannedStart: row.plannedStart.toISOString(),
    plannedEnd: row.plannedEnd.toISOString(),
    geometry: { type: row.geometry.type, coordinates: row.geometry.coordinates },
    createdAt: (row.createdAt ?? row.plannedStart).toISOString(),
    updatedAt: (row.updatedAt ?? row.plannedStart).toISOString(),
    revision: row.__v ?? 0,
    detection: row.detection ? { status: row.detection.status, completedAt: row.detection.completedAt?.toISOString() ?? null, counts: row.detection.counts ?? null } : null,
    nearbyCount: nearby.get(row._id.toString()) ?? 0,
  }));
}

export async function listWorkRequests(actor: AuthenticatedActor, query: WorkRequestListQuery) {
  try {
    await assertLive(actor, ["roadsync.work_request.read"]);
    const scoped = await readFilter(actor);
    const narrow: Record<string, unknown> = {};
    if (query.status) narrow.status = query.status;
    if (query.workType) narrow.workType = query.workType;
    if (query.priority) narrow.priority = query.priority;
    if (query.projectId) narrow.projectId = new mongoose.Types.ObjectId(query.projectId);
    if (query.hasCandidates) narrow._id = { $in: await requestIdsWithCandidates() };
    const filter = { $and: [scoped, narrow] };
    const [total, rows, byStatus, byPriority] = await Promise.all([
      WorkRequest.countDocuments(filter),
      WorkRequest.find(filter).sort({ plannedStart: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      WorkRequest.aggregate<{ _id: string; n: number }>([{ $match: scoped }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      WorkRequest.aggregate<{ _id: string; n: number }>([{ $match: scoped }, { $group: { _id: "$priority", n: { $sum: 1 } } }]),
    ]);
    return {
      ok: true as const,
      list: {
        workRequests: await toViews(rows as unknown as Row[]),
        page: query.page,
        limit: query.limit,
        total,
        counts: {
          byStatus: Object.fromEntries(byStatus.map((item) => [item._id, item.n])),
          byPriority: Object.fromEntries(byPriority.map((item) => [item._id, item.n])),
        },
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

export async function getWorkRequest(actor: AuthenticatedActor, id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail(404, "NOT_FOUND");
  try {
    await assertLive(actor, ["roadsync.work_request.read"]);
    const scoped = await readFilter(actor);
    const row = await WorkRequest.findOne({ $and: [scoped, { _id: id }] });
    if (!row) return fail(404, "NOT_FOUND");
    const [view] = await toViews([row as unknown as Row]);
    return { ok: true as const, workRequest: view as WorkRequestView };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

const MAP_FEATURE_CAP = 1000;

/** Step 67 map overview: the same RBAC read filter as list and detail, optional bbox, hard feature cap. */
export async function mapWorkRequests(actor: AuthenticatedActor, query: { status?: string; workType?: string; priority?: string; projectId?: string; bbox?: [number, number, number, number] }) {
  try {
    await assertLive(actor, ["roadsync.work_request.read"]);
    const scoped = await readFilter(actor);
    const narrow: Record<string, unknown> = {};
    if (query.status) narrow.status = query.status;
    if (query.workType) narrow.workType = query.workType;
    if (query.priority) narrow.priority = query.priority;
    if (query.projectId) narrow.projectId = new mongoose.Types.ObjectId(query.projectId);
    if (query.bbox) {
      const [w, s, e, n] = query.bbox;
      narrow.geometry = { $geoIntersects: { $geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } } };
    }
    const rows = await WorkRequest.find({ $and: [scoped, narrow] }).sort({ plannedStart: 1, _id: 1 }).limit(MAP_FEATURE_CAP + 1);
    const views = await toViews(rows.slice(0, MAP_FEATURE_CAP) as unknown as Row[]);
    return {
      ok: true as const,
      map: {
        type: "FeatureCollection" as const,
        truncated: rows.length > MAP_FEATURE_CAP,
        features: views.map((v) => ({
          type: "Feature" as const,
          geometry: v.geometry,
          properties: { id: v.id, workType: v.workType, status: v.status, priority: v.priority, plannedStart: v.plannedStart, plannedEnd: v.plannedEnd, nearbyCount: v.nearbyCount, agencyName: v.agencyName, projectTitle: v.projectTitle, projectCode: v.projectCode },
        })),
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

async function loadWritableProject(actor: AuthenticatedActor, projectId: string, session?: ClientSession) {
  const scope = await resolveResourceScope(actor);
  const filter = projectWriteFilter(actor, scope);
  const query = Project.findOne({ $and: [filter, { _id: projectId }] }).select("status agencyId");
  if (session) query.session(session);
  const project = await query;
  if (!project) throw new FlowControl(404, "NOT_FOUND");
  if (!PROJECT_ELIGIBLE.has(project.status)) throw new FlowControl(409, "CONFLICT");
  const agencyQuery = Agency.findById(project.agencyId).select("status");
  if (session) agencyQuery.session(session);
  const agency = await agencyQuery;
  if (!agency || agency.status !== "ACTIVE") throw new FlowControl(409, "CONFLICT");
  return project;
}

export async function createWorkRequest(actor: AuthenticatedActor, input: WorkRequestCreateInput, requestId: string) {
  const start = new Date(input.plannedStart);
  const end = new Date(input.plannedEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return fail(400, "VALIDATION_ERROR");
  // Step 67: the server validates and normalizes geometry; the client shape is never stored as sent.
  const geo = validateWorkGeometry(input.geometry);
  if (!geo.valid) return { ...fail(400, "VALIDATION_ERROR"), details: geo.errors };
  try {
    await assertLive(actor, ["roadsync.work_request.create"]);
    await loadWritableProject(actor, input.projectId);
    const mongo = await mongoose.startSession();
    let created: WorkRequestView | null = null;
    try {
      await mongo.withTransaction(async () => {
        await assertLive(actor, ["roadsync.work_request.create"], mongo);
        const project = await loadWritableProject(actor, input.projectId, mongo);
        const [row] = await WorkRequest.create([{
          projectId: project._id,
          agencyId: project.agencyId,
          geometry: geo.geometry,
          workType: input.workType,
          plannedStart: start,
          plannedEnd: end,
          status: "DRAFT",
          priority: input.priority ?? "NORMAL",
        }], { session: mongo });
        if (!row) throw new WorkRequestDependencyError();
        await workRequestHooks.beforeAudit();
        // Snapshot holds status and agency only: never geometry, dates or request bodies.
        const snapshot = { status: "DRAFT", agencyId: project.agencyId };
        await AuditLog.create([{
          userId: new mongoose.Types.ObjectId(actor.userId),
          action: "work_request.created",
          resourceType: "WORK_REQUEST",
          resourceId: row._id,
          oldValue: snapshot,
          newValue: snapshot,
          requestId: auditRequestId(requestId),
          // Platform admins act across agencies: audit under the owning agency, userId stays the real actor.
          agencyId: actor.roleKey === "SUPER_ADMIN" ? project.agencyId : new mongoose.Types.ObjectId(actor.agencyId),
        }], { session: mongo });
        const views = await toViews([row as unknown as Row], mongo);
        created = views[0] ?? null;
      });
    } finally {
      await mongo.endSession();
    }
    if (!created) throw new WorkRequestDependencyError();
    return { ok: true as const, workRequest: created as WorkRequestView };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}
