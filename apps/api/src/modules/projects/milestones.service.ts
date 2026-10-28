import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { milestoneTarget } from "./milestone.policy.js";
import type { MilestoneCreateInput, MilestoneListQuery, MilestonePatchInput, MilestoneTransitionInput } from "./milestones.schema.js";
import { Milestone } from "./models/milestone.model.js";
import { Project } from "./models/project.model.js";
import type { MilestoneStatus } from "./project.constants.js";

const WRITE_ELIGIBLE = new Set(["APPROVED", "ACTIVE"]);
const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);

class FlowControl extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE") {
    super(code);
  }
}

export class MilestoneDependencyError extends Error {}

export const milestoneHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export type MilestoneDto = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  status: MilestoneStatus;
  revision: number;
};

export type MilestoneFailure = { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: FlowControl["code"] };

function fail(status: MilestoneFailure["status"], code: MilestoneFailure["code"]): MilestoneFailure {
  return { ok: false, status, code };
}

function day(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function parseDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new FlowControl(400, "VALIDATION_ERROR");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) {
    throw new FlowControl(400, "VALIDATION_ERROR");
  }
  return parsed;
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

function dto(row: {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  title: string;
  description?: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  progress: number;
  status: string;
  __v?: number;
}): MilestoneDto {
  return {
    id: row._id.toString(),
    projectId: row.projectId.toString(),
    title: row.title,
    description: row.description?.trim() ? row.description : null,
    plannedStart: day(row.plannedStart) ?? "",
    plannedEnd: day(row.plannedEnd) ?? "",
    actualStart: day(row.actualStart),
    actualEnd: day(row.actualEnd),
    progress: row.progress,
    status: row.status as MilestoneStatus,
    revision: row.__v ?? 0,
  };
}

async function assertLive(actor: AuthenticatedActor, permissions: Permission[], session?: ClientSession): Promise<void> {
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

async function projectFilter(actor: AuthenticatedActor, write: boolean, session?: ClientSession) {
  if (!write && PRIVATE_DENY.has(actor.roleKey)) return { denied: true as const };
  if (!write && actor.roleKey === "INSPECTOR") {
    const query = Inspection.find({ inspectorId: actor.userId }).distinct("projectId");
    if (session) query.session(session);
    const ids = await query;
    return { denied: false as const, filter: { _id: { $in: ids } } };
  }
  const scope = await resolveResourceScope(actor);
  return { denied: false as const, filter: write ? projectWriteFilter(actor, scope) : projectReadFilter(scope) };
}

async function loadProject(actor: AuthenticatedActor, projectId: string, write: boolean, session?: ClientSession) {
  if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
  const scoped = await projectFilter(actor, write, session);
  if (scoped.denied) throw new FlowControl(403, "FORBIDDEN");
  const query = Project.findOne({ $and: [scoped.filter, { _id: projectId }] }).select("status agencyId physicalProgress financialProgress");
  if (session) query.session(session);
  const project = await query;
  if (!project) throw new FlowControl(404, "NOT_FOUND");
  return project;
}

async function writeAudit(
  actor: AuthenticatedActor,
  milestoneId: mongoose.Types.ObjectId,
  action: string,
  requestId: string,
  snapshot: { status: string; agencyId: mongoose.Types.ObjectId },
  session: ClientSession,
  previous?: { status: string; agencyId: mongoose.Types.ObjectId },
): Promise<void> {
  await milestoneHooks.beforeAudit();
  await AuditLog.create(
    [{
      userId: new mongoose.Types.ObjectId(actor.userId),
      action,
      resourceType: "MILESTONE",
      resourceId: milestoneId,
      oldValue: previous ?? snapshot,
      newValue: snapshot,
      requestId: auditRequestId(requestId),
      agencyId: new mongoose.Types.ObjectId(actor.agencyId),
    }],
    { session },
  );
}

function countsOf(rows: { status: string }[]) {
  const counts = { notStarted: 0, inProgress: 0, delayed: 0, blocked: 0, completed: 0, cancelled: 0 };
  for (const row of rows) {
    if (row.status === "NOT_STARTED") counts.notStarted += 1;
    else if (row.status === "IN_PROGRESS") counts.inProgress += 1;
    else if (row.status === "DELAYED") counts.delayed += 1;
    else if (row.status === "BLOCKED") counts.blocked += 1;
    else if (row.status === "COMPLETED") counts.completed += 1;
    else if (row.status === "CANCELLED") counts.cancelled += 1;
  }
  return counts;
}

export async function listMilestones(actor: AuthenticatedActor, projectId: string, query: MilestoneListQuery) {
  try {
    await assertLive(actor, ["milestone.read"]);
    await loadProject(actor, projectId, false);
    const filter = { projectId };
    const total = await Milestone.countDocuments(filter);
    const all = await Milestone.find(filter).select("status");
    const direction = query.sortDir === "asc" ? 1 : -1;
    const rows = await Milestone.find(filter)
      .sort({ [query.sortBy]: direction, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);
    return {
      ok: true as const,
      list: {
        milestones: rows.map((row) => dto(row)),
        page: query.page,
        limit: query.limit,
        total,
        counts: countsOf(all),
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new MilestoneDependencyError();
  }
}

export async function getMilestone(actor: AuthenticatedActor, projectId: string, milestoneId: string) {
  if (!/^[a-f0-9]{24}$/i.test(milestoneId)) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor, ["milestone.read"]);
    await loadProject(actor, projectId, false);
    const row = await Milestone.findOne({ _id: milestoneId, projectId });
    if (!row) return fail(404, "NOT_FOUND");
    return { ok: true as const, milestone: dto(row) };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new MilestoneDependencyError();
  }
}

export async function createMilestone(actor: AuthenticatedActor, projectId: string, input: MilestoneCreateInput, requestId: string) {
  let start: Date;
  let end: Date;
  try {
    start = parseDay(input.plannedStart);
    end = parseDay(input.plannedEnd);
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw error;
  }
  if (end < start) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor, ["milestone.create"]);
    const project = await loadProject(actor, projectId, true);
    if (!WRITE_ELIGIBLE.has(project.status)) return fail(409, "CONFLICT");
    const mongo = await mongoose.startSession();
    let created: MilestoneDto | null = null;
    try {
      await mongo.withTransaction(async () => {
        await assertLive(actor, ["milestone.create"], mongo);
        const fresh = await loadProject(actor, projectId, true, mongo);
        if (!WRITE_ELIGIBLE.has(fresh.status)) throw new FlowControl(409, "CONFLICT");
        const [row] = await Milestone.create([{
          projectId: fresh._id,
          title: input.title,
          description: input.description,
          plannedStart: start,
          plannedEnd: end,
          progress: 0,
          status: "NOT_STARTED",
        }], { session: mongo });
        if (!row) throw new MilestoneDependencyError();
        await writeAudit(actor, row._id, "milestone.created", requestId, { status: "NOT_STARTED", agencyId: fresh.agencyId }, mongo);
        created = dto(row);
      });
    } finally {
      await mongo.endSession();
    }
    if (!created) throw new MilestoneDependencyError();
    return { ok: true as const, milestone: created };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new MilestoneDependencyError();
  }
}

export async function updateMilestone(actor: AuthenticatedActor, projectId: string, milestoneId: string, input: MilestonePatchInput, requestId: string) {
  if (!/^[a-f0-9]{24}$/i.test(milestoneId)) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor, ["milestone.update"]);
    const project = await loadProject(actor, projectId, true);
    if (!WRITE_ELIGIBLE.has(project.status)) return fail(409, "CONFLICT");
    const current = await Milestone.findOne({ _id: milestoneId, projectId });
    if (!current) return fail(404, "NOT_FOUND");
    if (current.status === "COMPLETED" || current.status === "CANCELLED") return fail(409, "CONFLICT");
    const plannedStart = input.plannedStart ? parseDay(input.plannedStart) : current.plannedStart;
    const plannedEnd = input.plannedEnd ? parseDay(input.plannedEnd) : current.plannedEnd;
    if (plannedEnd < plannedStart) return fail(400, "VALIDATION_ERROR");
    const mongo = await mongoose.startSession();
    let updated: MilestoneDto | null = null;
    try {
      await mongo.withTransaction(async () => {
        await assertLive(actor, ["milestone.update"], mongo);
        const fresh = await loadProject(actor, projectId, true, mongo);
        if (!WRITE_ELIGIBLE.has(fresh.status)) throw new FlowControl(409, "CONFLICT");
        const row = await Milestone.findOneAndUpdate(
          { _id: milestoneId, projectId: fresh._id, __v: input.revision, status: { $nin: ["COMPLETED", "CANCELLED"] } },
          {
            $set: {
              ...(input.title != null ? { title: input.title } : {}),
              ...(input.description != null ? { description: input.description } : {}),
              plannedStart,
              plannedEnd,
              ...(input.progress != null ? { progress: input.progress } : {}),
            },
            $inc: { __v: 1 },
          },
          { session: mongo, new: true },
        );
        if (!row) throw new FlowControl(409, "CONFLICT");
        await writeAudit(actor, row._id, "milestone.updated", requestId, { status: row.status, agencyId: fresh.agencyId }, mongo, { status: current.status, agencyId: fresh.agencyId });
        updated = dto(row);
      });
    } finally {
      await mongo.endSession();
    }
    if (!updated) throw new MilestoneDependencyError();
    return { ok: true as const, milestone: updated };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new MilestoneDependencyError();
  }
}

export async function transitionMilestone(actor: AuthenticatedActor, projectId: string, milestoneId: string, input: MilestoneTransitionInput, requestId: string) {
  if (!/^[a-f0-9]{24}$/i.test(milestoneId)) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor, ["milestone.update"]);
    const project = await loadProject(actor, projectId, true);
    if (!WRITE_ELIGIBLE.has(project.status)) return fail(409, "CONFLICT");
    const current = await Milestone.findOne({ _id: milestoneId, projectId });
    if (!current) return fail(404, "NOT_FOUND");
    const target = milestoneTarget(current.status, input.action);
    if (!target) return fail(409, "CONFLICT");
    const mongo = await mongoose.startSession();
    let updated: MilestoneDto | null = null;
    try {
      await mongo.withTransaction(async () => {
        await assertLive(actor, ["milestone.update"], mongo);
        const fresh = await loadProject(actor, projectId, true, mongo);
        if (!WRITE_ELIGIBLE.has(fresh.status)) throw new FlowControl(409, "CONFLICT");
        const now = new Date();
        const set: Record<string, unknown> = { status: target };
        if (target === "IN_PROGRESS" && !current.actualStart) set.actualStart = now;
        if (target === "COMPLETED") {
          set.progress = 100;
          set.actualEnd = now;
        }
        const row = await Milestone.findOneAndUpdate(
          { _id: milestoneId, projectId: fresh._id, __v: input.revision, status: current.status },
          { $set: set, $inc: { __v: 1 } },
          { session: mongo, new: true },
        );
        if (!row) throw new FlowControl(409, "CONFLICT");
        await writeAudit(
          actor,
          row._id,
          "milestone.status_changed",
          requestId,
          { status: target, agencyId: fresh.agencyId },
          mongo,
          { status: current.status, agencyId: fresh.agencyId },
        );
        updated = dto(row);
      });
    } finally {
      await mongo.endSession();
    }
    if (!updated) throw new MilestoneDependencyError();
    return { ok: true as const, milestone: updated };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new MilestoneDependencyError();
  }
}
