import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { AuditLog } from "../audit/models/audit-log.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { CORRECTION_NOTE_MIN, PROGRESS_REPORTING_STATUS, needsCorrectionNote } from "./progress.policy.js";
import type { ProgressHistoryQuery, ProgressSubmitInput } from "./progress.schema.js";
import { ProgressReport } from "./models/progress-report.model.js";
import { Project } from "./models/project.model.js";

const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);

class FlowControl extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE") {
    super(code);
  }
}

export class ProgressDependencyError extends Error {}

export const progressHooks: { beforeAudit: () => Promise<void> } = {
  beforeAudit: async () => {},
};

export type ProgressFailure = { ok: false; status: FlowControl["status"]; code: FlowControl["code"] };

export type ProgressReportDto = {
  id: string;
  reportedPercent: number;
  previousPercent: number;
  note: string;
  reportedAt: string;
  sequence: number;
};

function fail(status: ProgressFailure["status"], code: ProgressFailure["code"]): ProgressFailure {
  return { ok: false, status, code };
}

function auditRequestId(requestId: string): string {
  const trimmed = requestId.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "request";
}

function dto(row: {
  _id: mongoose.Types.ObjectId;
  reportedPercent: number;
  previousPercent: number;
  note: string;
  reportedAt: Date;
  sequence: number;
}): ProgressReportDto {
  return {
    id: row._id.toString(),
    reportedPercent: row.reportedPercent,
    previousPercent: row.previousPercent,
    note: row.note,
    reportedAt: row.reportedAt.toISOString(),
    sequence: row.sequence,
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
  if (PRIVATE_DENY.has(actor.roleKey)) return { denied: true as const };
  if (write && actor.roleKey !== "PROJECT_MANAGER") throw new FlowControl(403, "FORBIDDEN");
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
  const query = Project.findOne({ $and: [scoped.filter, { _id: projectId }] }).select("status agencyId physicalProgress financialProgress __v");
  if (session) query.session(session);
  const project = await query;
  if (!project) throw new FlowControl(404, "NOT_FOUND");
  return project;
}

export async function getProgress(actor: AuthenticatedActor, projectId: string) {
  try {
    await assertLive(actor, ["progress.read"]);
    const project = await loadProject(actor, projectId, false);
    const latest = await ProgressReport.findOne({ projectId: project._id }).sort({ sequence: -1 });
    return {
      ok: true as const,
      progress: {
        projectId: project._id.toString(),
        status: project.status,
        physicalProgress: project.physicalProgress,
        revision: project.__v ?? 0,
        latest: latest ? dto(latest) : null,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProgressDependencyError();
  }
}

export async function listProgressHistory(actor: AuthenticatedActor, projectId: string, query: ProgressHistoryQuery) {
  try {
    await assertLive(actor, ["progress.read"]);
    const project = await loadProject(actor, projectId, false);
    const filter = { projectId: project._id };
    const total = await ProgressReport.countDocuments(filter);
    const rows = await ProgressReport.find(filter)
      .sort({ sequence: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);
    return {
      ok: true as const,
      history: {
        reports: rows.map((row) => dto(row)),
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProgressDependencyError();
  }
}

export async function submitProgress(actor: AuthenticatedActor, projectId: string, input: ProgressSubmitInput, requestId: string) {
  try {
    await assertLive(actor, ["progress.submit"]);
    const project = await loadProject(actor, projectId, true);
    if (project.status !== PROGRESS_REPORTING_STATUS) return fail(409, "CONFLICT");
    if (needsCorrectionNote(project.physicalProgress, input.percentage) && input.note.length < CORRECTION_NOTE_MIN) {
      return fail(400, "VALIDATION_ERROR");
    }
    const mongo = await mongoose.startSession();
    let saved: ProgressReportDto | null = null;
    let revision = 0;
    try {
      await mongo.withTransaction(async () => {
        await assertLive(actor, ["progress.submit"], mongo);
        const fresh = await loadProject(actor, projectId, true, mongo);
        if (fresh.status !== PROGRESS_REPORTING_STATUS) throw new FlowControl(409, "CONFLICT");
        if (fresh.__v !== input.revision) throw new FlowControl(409, "CONFLICT");
        if (needsCorrectionNote(fresh.physicalProgress, input.percentage) && input.note.length < CORRECTION_NOTE_MIN) {
          throw new FlowControl(400, "VALIDATION_ERROR");
        }
        const latest = await ProgressReport.findOne({ projectId: fresh._id }).sort({ sequence: -1 }).session(mongo);
        if (latest && latest.reportedPercent === input.percentage && latest.note === input.note) {
          throw new FlowControl(409, "CONFLICT");
        }
        const previous = fresh.physicalProgress;
        const financialProgress = fresh.financialProgress;
        const updated = await Project.findOneAndUpdate(
          { _id: fresh._id, __v: input.revision, status: PROGRESS_REPORTING_STATUS },
          { $set: { physicalProgress: input.percentage }, $inc: { __v: 1 } },
          { session: mongo, new: true },
        );
        if (!updated || updated.status !== PROGRESS_REPORTING_STATUS || updated.financialProgress !== financialProgress) {
          throw new FlowControl(409, "CONFLICT");
        }
        const sequence = (latest?.sequence ?? 0) + 1;
        const reportedAt = new Date();
        const [row] = await ProgressReport.create([{
          projectId: fresh._id,
          sequence,
          reportedPercent: input.percentage,
          previousPercent: previous,
          note: input.note,
          reporterUserId: new mongoose.Types.ObjectId(actor.userId),
          reportedAt,
        }], { session: mongo });
        if (!row) throw new ProgressDependencyError();
        await progressHooks.beforeAudit();
        await AuditLog.create([{
          userId: new mongoose.Types.ObjectId(actor.userId),
          action: "progress.reported",
          resourceType: "PROJECT",
          resourceId: fresh._id,
          oldValue: { physicalProgress: previous, agencyId: fresh.agencyId },
          newValue: { physicalProgress: input.percentage, agencyId: fresh.agencyId },
          requestId: auditRequestId(requestId),
          agencyId: new mongoose.Types.ObjectId(actor.agencyId),
        }], { session: mongo });
        saved = dto(row);
        revision = updated.__v ?? input.revision + 1;
      });
    } finally {
      await mongo.endSession();
    }
    if (!saved) throw new ProgressDependencyError();
    return { ok: true as const, report: saved, revision, status: PROGRESS_REPORTING_STATUS, physicalProgress: input.percentage };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ProgressDependencyError();
  }
}
