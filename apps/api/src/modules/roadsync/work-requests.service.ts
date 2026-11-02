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
import { roadsyncEvents } from "./roadsync.events.js";
import { candidateCounts, requestIdsWithCandidates } from "./candidate.counts.js";
import { validateWorkGeometry, type GeoIssue } from "./geo.service.js";
import { startDateAllowed, type WorkRequestCreateInput, type WorkRequestListQuery } from "./work-requests.schema.js";
import { RoadsyncCounter } from "./models/conflict-record.model.js";

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
  workingHours: "day" | "night" | "24h";
  isEmergency: boolean;
  referenceNo: string | null;
  geometry: { type: string; coordinates: unknown };
  createdAt: string;
  updatedAt: string;
  revision: number;
  detection: { status: string; completedAt: string | null; counts: { nearby: number; candidates: number; agencies: number; truncated: boolean } | null } | null;
  nearbyCount: number;
  assessment: { status: string; riskIndex: number; maxBand: string | null; conflicts: number; opportunities: number } | null;
  conflictRecords: { total: number; open: number; acknowledged: number; needsAck: number } | null;
  hasConflictRecords: boolean;
  coordination: { active: number; needsMyResponse: number } | null;
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
  schedule?: { workingHours?: "day" | "night" | "24h" } | null;
  isEmergency?: boolean;
  referenceNo?: string | null;
  geometry: { type: string; coordinates: unknown };
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
  detection?: { status: string; completedAt?: Date; counts?: { nearby: number; candidates: number; agencies: number; truncated: boolean } } | null;
  assessment?: { status?: string; riskIndex?: number; maxBand?: string | null; ruleVersion?: string; counts?: { conflicts?: number; opportunities?: number } } | null;
  conflictRecords?: { total?: number; open?: number; acknowledged?: number; needsAck?: number } | null;
  coordination?: { active?: number; needsMyResponse?: number } | null;
};

/** Step 71 list/map summary. Null until a request has been assessed. */
function assessmentSummary(a: Row["assessment"]) {
  if (!a || a.status === undefined || !a.counts) return null;
  return { status: a.status, riskIndex: a.riskIndex ?? 0, maxBand: a.maxBand ?? null, conflicts: a.counts.conflicts ?? 0, opportunities: a.counts.opportunities ?? 0 };
}

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
    workingHours: row.schedule?.workingHours ?? "day",
    isEmergency: row.isEmergency ?? false,
    referenceNo: row.referenceNo ?? null,
    geometry: { type: row.geometry.type, coordinates: row.geometry.coordinates },
    createdAt: (row.createdAt ?? row.plannedStart).toISOString(),
    updatedAt: (row.updatedAt ?? row.plannedStart).toISOString(),
    revision: row.__v ?? 0,
    detection: row.detection ? { status: row.detection.status, completedAt: row.detection.completedAt?.toISOString() ?? null, counts: row.detection.counts ?? null } : null,
    nearbyCount: nearby.get(row._id.toString()) ?? 0,
    assessment: assessmentSummary(row.assessment),
    conflictRecords: row.conflictRecords ? { total: row.conflictRecords.total ?? 0, open: row.conflictRecords.open ?? 0, acknowledged: row.conflictRecords.acknowledged ?? 0, needsAck: row.conflictRecords.needsAck ?? 0 } : null,
    hasConflictRecords: (row.conflictRecords?.total ?? 0) > 0,
    coordination: row.coordination ? { active: row.coordination.active ?? 0, needsMyResponse: row.coordination.needsMyResponse ?? 0 } : null,
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
    if (query.band) narrow["assessment.maxBand"] = { $in: query.band };
    if (query.hasConflicts) narrow["assessment.counts.conflicts"] = { $gt: 0 };
    const filter = { $and: [scoped, narrow] };
    const order: Record<string, 1 | -1> = query.sort === "riskIndex" ? { "assessment.riskIndex": -1, _id: 1 } : { plannedStart: 1, _id: 1 };
    const [total, rows, byStatus, byPriority] = await Promise.all([
      WorkRequest.countDocuments(filter),
      WorkRequest.find(filter).sort(order).skip((query.page - 1) * query.limit).limit(query.limit),
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
          properties: { id: v.id, workType: v.workType, status: v.status, priority: v.priority, plannedStart: v.plannedStart, plannedEnd: v.plannedEnd, nearbyCount: v.nearbyCount, maxBand: v.assessment?.maxBand ?? null, riskIndex: v.assessment?.riskIndex ?? null, agencyName: v.agencyName, projectTitle: v.projectTitle, projectCode: v.projectCode },
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
          schedule: { workingHours: input.workingHours ?? "day" },
          isEmergency: input.isEmergency ?? false,
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

// ---------- Step 76: the ONE controlled path that changes a submitted request's schedule ----------

const AMENDABLE = ["SUBMITTED", "PLANNED", "APPROVED"] as const;
const REVISIONS_CAP = 20;
export type AmendInput = { amendmentId: string; resolutionId: string; workRequestId: string; baseVersion: number; plannedStart?: Date; plannedEnd?: Date; workingHours?: "day" | "night" | "24h" };
export type AmendResult = { ok: true; version: number; before: { plannedStart: Date; plannedEnd: Date; workingHours: "day" | "night" | "24h" } } | { ok: false; code: "not_found" | "stale" | "not_amendable" | "invalid" };

/**
 * Atomic compare-and-set on the request version: a stale or already-applied amendment matches nothing. The Step 66-67
 * create path and its whitelist are untouched; nothing else may mutate schedule fields of a submitted request.
 * Changes dates and/or working hours; the revision records both sides of every change.
 */
export async function applyAmendmentToRequest(a: AmendInput, by: { userId: string; agencyId: string }): Promise<AmendResult> {
  if (!a.plannedStart !== !a.plannedEnd || (!a.plannedStart && !a.workingHours)) return { ok: false, code: "invalid" };
  if (a.plannedStart && a.plannedEnd && (Number.isNaN(a.plannedStart.getTime()) || Number.isNaN(a.plannedEnd.getTime()) || a.plannedEnd < a.plannedStart)) return { ok: false, code: "invalid" };
  const id = new mongoose.Types.ObjectId(a.workRequestId);
  const current = await WorkRequest.findById(id).select("plannedStart plannedEnd schedule status __v").lean();
  if (!current) return { ok: false, code: "not_found" };
  if (!(AMENDABLE as readonly string[]).includes(current.status)) return { ok: false, code: "not_amendable" };
  if ((current as { __v?: number }).__v !== a.baseVersion) return { ok: false, code: "stale" };
  const now = new Date();
  const hours = { $ifNull: ["$schedule.workingHours", "day"] };
  const rev = {
    n: { $add: [{ $ifNull: ["$amendedCount", 0] }, 1] }, at: { $literal: now }, by: { $literal: { userId: by.userId, agencyId: by.agencyId } }, via: { $literal: { amendmentId: a.amendmentId, resolutionId: a.resolutionId } },
    before: { plannedStart: "$plannedStart", plannedEnd: "$plannedEnd", workingHours: hours },
    after: { plannedStart: a.plannedStart ? { $literal: a.plannedStart } : "$plannedStart", plannedEnd: a.plannedEnd ? { $literal: a.plannedEnd } : "$plannedEnd", workingHours: a.workingHours ? { $literal: a.workingHours } : hours },
  };
  const res = await WorkRequest.findOneAndUpdate(
    { _id: id, __v: a.baseVersion, status: { $in: [...AMENDABLE] } },
    [{ $set: {
      originalSchedule: { $ifNull: ["$originalSchedule", { plannedStart: "$plannedStart", plannedEnd: "$plannedEnd", workingHours: hours }] },
      revisions: { $slice: [{ $concatArrays: [{ $ifNull: ["$revisions", []] }, [rev]] }, -REVISIONS_CAP] },
      amendedCount: { $add: [{ $ifNull: ["$amendedCount", 0] }, 1] },
      lastAmendedAt: { $literal: now }, updatedAt: { $literal: now },
      ...(a.plannedStart && a.plannedEnd ? { plannedStart: { $literal: a.plannedStart }, plannedEnd: { $literal: a.plannedEnd } } : {}),
      ...(a.workingHours ? { "schedule.workingHours": { $literal: a.workingHours } } : {}),
      "detection.status": "pending", __v: { $add: ["$__v", 1] },
    } }] as never,
    { new: true, timestamps: false },
  ).lean();
  if (!res) return { ok: false, code: "stale" };
  try {
    await AuditLog.create({ userId: new mongoose.Types.ObjectId(by.userId), action: "work_request.amended", resourceType: "WORK_REQUEST", resourceId: id, newValue: { status: String(res.status), agencyId: res.agencyId }, requestId: "amendment", agencyId: new mongoose.Types.ObjectId(by.agencyId) });
  } catch { /* the revision on the request keeps the fact */ }
  roadsyncEvents.emit("workRequestAmended", { requestId: a.workRequestId, amendmentId: a.amendmentId, resolutionId: a.resolutionId });
  return { ok: true, version: (res as { __v?: number }).__v ?? a.baseVersion + 1, before: { plannedStart: current.plannedStart, plannedEnd: current.plannedEnd, workingHours: (current as { schedule?: { workingHours?: "day" | "night" | "24h" } }).schedule?.workingHours ?? "day" } };
}

// ---------- Step 66 lifecycle: edit draft, submit, cancel, delete draft ----------

export type LifecycleInput = { version: number };
type Loaded = { row: Row & { status: string; __v?: number }; id: mongoose.Types.ObjectId };

/** Read scope (404 when unknown to the caller) plus project write scope (403 when readable but not writable). */
async function loadWritable(actor: AuthenticatedActor, perms: Permission[], id: string): Promise<Loaded> {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new FlowControl(404, "NOT_FOUND");
  await assertLive(actor, perms);
  const row = await WorkRequest.findOne({ $and: [await readFilter(actor), { _id: id }] }).lean();
  if (!row) throw new FlowControl(404, "NOT_FOUND");
  const scope = await resolveResourceScope(actor);
  if (!(await Project.exists({ $and: [projectWriteFilter(actor, scope), { _id: row.projectId }] }))) throw new FlowControl(403, "FORBIDDEN");
  return { row: row as unknown as Loaded["row"], id: row._id };
}

async function auditLifecycle(actor: AuthenticatedActor, action: string, id: mongoose.Types.ObjectId, status: string, agencyId: mongoose.Types.ObjectId, requestId: string): Promise<void> {
  try {
    await AuditLog.create({ userId: new mongoose.Types.ObjectId(actor.userId), action: `work_request.${action}`, resourceType: "WORK_REQUEST", resourceId: id, newValue: { status, agencyId }, requestId: auditRequestId(requestId), agencyId: actor.roleKey === "SUPER_ADMIN" ? agencyId : new mongoose.Types.ObjectId(actor.agencyId) });
  } catch { /* the status history on the request keeps the fact */ }
}

const history = (from: string, to: string, by: string, extra: Record<string, unknown> = {}) => ({ from, to, at: new Date(), by, ...extra });

export async function updateWorkRequestDraft(actor: AuthenticatedActor, id: string, input: { version: number; workType?: string; priority?: string; plannedStart?: string; plannedEnd?: string; workingHours?: string; isEmergency?: boolean; geometry?: unknown }, requestId: string) {
  try {
    const { row, id: oid } = await loadWritable(actor, ["roadsync.work_request.update"], id);
    if (row.status !== "DRAFT") return fail(409, "CONFLICT");
    if ((row.__v ?? 0) !== input.version) return fail(409, "CONFLICT");
    const start = input.plannedStart ? new Date(input.plannedStart) : row.plannedStart;
    const end = input.plannedEnd ? new Date(input.plannedEnd) : row.plannedEnd;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return fail(400, "VALIDATION_ERROR");
    const set: Record<string, unknown> = { plannedStart: start, plannedEnd: end };
    if (input.workType) set.workType = input.workType;
    if (input.priority) set.priority = input.priority;
    if (input.workingHours) set["schedule.workingHours"] = input.workingHours;
    if (input.isEmergency !== undefined) set.isEmergency = input.isEmergency;
    if (input.geometry) {
      const geo = validateWorkGeometry(input.geometry as never);
      if (!geo.valid) return { ...fail(400, "VALIDATION_ERROR"), details: geo.errors };
      set.geometry = geo.geometry;
    }
    const updated = await WorkRequest.findOneAndUpdate({ _id: oid, __v: input.version, status: "DRAFT" }, { $set: set, $inc: { __v: 1 } }, { new: true }).lean();
    if (!updated) return fail(409, "CONFLICT");
    await auditLifecycle(actor, "updated", oid, "DRAFT", row.agencyId, requestId);
    const [view] = await toViews([updated as unknown as Row]);
    return { ok: true as const, workRequest: view as WorkRequestView };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

async function nextReference(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const r = await RoadsyncCounter.findOneAndUpdate({ _id: `WR-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `WR-${year}-${String(r!.seq).padStart(6, "0")}`;
}

/** DRAFT -> SUBMITTED. Assigns the reference once, records history and starts detection through the event. */
export async function submitWorkRequest(actor: AuthenticatedActor, id: string, input: LifecycleInput, requestId: string) {
  try {
    const { row, id: oid } = await loadWritable(actor, ["roadsync.work_request.update"], id);
    if (row.status !== "DRAFT" || (row.__v ?? 0) !== input.version) return fail(409, "CONFLICT");
    await loadWritableProject(actor, String(row.projectId)); // project must still be approved/active and its agency active
    const emergency = (row as { isEmergency?: boolean }).isEmergency === true;
    if (!startDateAllowed(row.plannedStart, emergency) || row.plannedEnd < row.plannedStart || !row.geometry) return fail(400, "VALIDATION_ERROR");
    const updated = await WorkRequest.findOneAndUpdate(
      { _id: oid, __v: input.version, status: "DRAFT" },
      { $set: { status: "SUBMITTED", referenceNo: row.referenceNo ?? (await nextReference()), "detection.status": "pending" }, $push: { statusHistory: history("DRAFT", "SUBMITTED", actor.userId) }, $inc: { __v: 1 } },
      { new: true },
    ).lean();
    if (!updated) return fail(409, "CONFLICT");
    await auditLifecycle(actor, "submitted", oid, "SUBMITTED", row.agencyId, requestId);
    roadsyncEvents.emit("workRequestSubmitted", { requestId: String(oid), runBy: "submit" });
    const [view] = await toViews([updated as unknown as Row]);
    return { ok: true as const, workRequest: view as WorkRequestView };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

/** Submitted -> CANCELLED. The reason is validated but stored only as its length; detection deactivates the pairs. */
export async function cancelWorkRequest(actor: AuthenticatedActor, id: string, input: { version: number; reason: string }, requestId: string) {
  try {
    const { row, id: oid } = await loadWritable(actor, ["roadsync.work_request.cancel"], id);
    if (!["SUBMITTED", "PLANNED", "APPROVED", "ACTIVE"].includes(row.status) || (row.__v ?? 0) !== input.version) return fail(409, "CONFLICT");
    const updated = await WorkRequest.findOneAndUpdate(
      { _id: oid, __v: input.version, status: row.status },
      { $set: { status: "CANCELLED" }, $push: { statusHistory: history(row.status, "CANCELLED", actor.userId, { reasonLength: input.reason.length }) }, $inc: { __v: 1 } },
      { new: true },
    ).lean();
    if (!updated) return fail(409, "CONFLICT");
    await auditLifecycle(actor, "cancelled", oid, "CANCELLED", row.agencyId, requestId);
    roadsyncEvents.emit("workRequestCancelled", { requestId: String(oid) });
    const [view] = await toViews([updated as unknown as Row]);
    return { ok: true as const, workRequest: view as WorkRequestView };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}

export async function deleteWorkRequestDraft(actor: AuthenticatedActor, id: string, requestId: string) {
  try {
    const { row, id: oid } = await loadWritable(actor, ["roadsync.work_request.update"], id);
    if (row.status !== "DRAFT") return fail(409, "CONFLICT");
    const res = await WorkRequest.deleteOne({ _id: oid, status: "DRAFT" });
    if (res.deletedCount !== 1) return fail(409, "CONFLICT");
    await auditLifecycle(actor, "deleted", oid, "DELETED", row.agencyId, requestId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new WorkRequestDependencyError();
  }
}
