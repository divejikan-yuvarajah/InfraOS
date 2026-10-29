import type { Permission } from "@infraos/shared-types";
import mongoose from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Milestone } from "./models/milestone.model.js";
import { ProgressReport } from "./models/progress-report.model.js";
import { Project } from "./models/project.model.js";
import {
  ACTIVITY_SOURCE_CAP,
  MILESTONE_ACTIVITY_ACTIONS,
  PROJECT_ACTIVITY_ACTIONS,
  activityActor,
  classifyActivityAction,
  decodeActivityCursor,
  pageActivities,
  type ActivityCategory,
  type ActivityItem,
} from "./activity.policy.js";
import type { ActivityQuery } from "./activity.schema.js";
import type { ProjectFailure } from "./projects.types.js";

const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);
const PROJECT_STATUSES = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED"]);
const MILESTONE_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "DELAYED", "BLOCKED", "COMPLETED", "CANCELLED"]);

class FlowControl extends Error {
  constructor(readonly status: ProjectFailure["status"], readonly code: ProjectFailure["code"]) {
    super(code);
  }
}

export class ActivityDependencyError extends Error {}

export const activityHooks: { beforeRead: () => Promise<void> } = { beforeRead: async () => {} };

function fail(status: ProjectFailure["status"], code: ProjectFailure["code"]): ProjectFailure {
  return { ok: false, status, code };
}

function objectId(value: unknown): string | null {
  if (!value) return null;
  const text = typeof value === "object" && value !== null && "toString" in value ? String(value) : typeof value === "string" ? value : "";
  return /^[a-f0-9]{24}$/i.test(text) ? text : null;
}

function snapshotField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const readable = value as { get?: (path: string) => unknown };
  if (typeof readable.get === "function") return readable.get(key);
  return (value as Record<string, unknown>)[key];
}

function statusToken(value: unknown, allowed: Set<string>): string | null {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function percentToken(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

async function liveGrants(actor: AuthenticatedActor): Promise<void> {
  const user = await User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const role = await Role.findById(actor.roleId).select("key isActive permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const required: Permission[] = ["project.read", "project.timeline.read"];
  const allowed = role?.isActive && role.key === actor.roleKey && required.every((permission) => hasPermission(granted, permission));
  if (!allowed) throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
}

async function loadProject(actor: AuthenticatedActor, projectId: string) {
  if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
  if (PRIVATE_DENY.has(actor.roleKey)) throw new FlowControl(403, "FORBIDDEN");
  const filter = actor.roleKey === "INSPECTOR"
    ? { _id: { $in: await Inspection.find({ inspectorId: actor.userId }).distinct("projectId") } }
    : projectReadFilter(await resolveResourceScope(actor));
  const project = await Project.findOne({ $and: [filter, { _id: projectId }] }).select("status physicalProgress createdAt agencyId");
  if (!project) throw new FlowControl(404, "NOT_FOUND");
  return project;
}

type AuditRow = {
  _id: mongoose.Types.ObjectId;
  action: string;
  timestamp?: Date;
  userId?: mongoose.Types.ObjectId | null;
  newValue?: unknown;
};

function itemFromAudit(row: AuditRow, detail: ActivityItem["detail"]): ActivityItem | null {
  const mapped = classifyActivityAction(row.action);
  if (!mapped || !(row.timestamp instanceof Date)) return null;
  return {
    id: `audit:${row._id.toString()}`,
    kind: mapped.kind,
    category: mapped.category,
    occurredAt: row.timestamp.toISOString(),
    source: "audit",
    titleKey: mapped.titleKey,
    actor: activityActor(Boolean(row.userId)),
    detail,
  };
}

export async function getProjectActivity(actor: AuthenticatedActor, projectId: string, query: ActivityQuery) {
  try {
    await activityHooks.beforeRead();
    await liveGrants(actor);
    const project = await loadProject(actor, projectId);
    const milestones = await Milestone.find({ projectId: project._id }).select("title status").limit(ACTIVITY_SOURCE_CAP + 1);
    const milestoneIds = milestones.slice(0, ACTIVITY_SOURCE_CAP).map((row) => row._id);
    const titles = new Map(milestones.map((row) => [row._id.toString(), row.title]));
    const [projectRows, milestoneRows, reports] = await Promise.all([
      AuditLog.find({ resourceType: "PROJECT", resourceId: project._id, action: { $in: [...PROJECT_ACTIVITY_ACTIONS] } })
        .sort({ timestamp: -1, _id: -1 })
        .limit(ACTIVITY_SOURCE_CAP + 1)
        .select("+newValue action timestamp userId"),
      milestoneIds.length === 0
        ? Promise.resolve([])
        : AuditLog.find({ resourceType: "MILESTONE", resourceId: { $in: milestoneIds }, action: { $in: [...MILESTONE_ACTIVITY_ACTIONS] } })
          .sort({ timestamp: -1, _id: -1 })
          .limit(ACTIVITY_SOURCE_CAP + 1)
          .select("+newValue action resourceId timestamp userId"),
      ProgressReport.find({ projectId: project._id }).sort({ reportedAt: -1, _id: -1 }).limit(ACTIVITY_SOURCE_CAP + 1).select("reportedPercent reportedAt"),
    ]);
    const capped = projectRows.length > ACTIVITY_SOURCE_CAP || milestoneRows.length > ACTIVITY_SOURCE_CAP || reports.length > ACTIVITY_SOURCE_CAP || milestones.length > ACTIVITY_SOURCE_CAP;
    const scope = actor.roleKey === "INSPECTOR" ? null : await resolveResourceScope(actor);
    const readFilter = scope ? projectReadFilter(scope) : { _id: project._id };
    const kept = projectRows.slice(0, ACTIVITY_SOURCE_CAP);
    const targetIds = [...new Set(kept.flatMap((row) => {
      const mapped = classifyActivityAction(row.action);
      if (mapped?.category !== "dependency") return [];
      const targetId = objectId(snapshotField(row.newValue, "prerequisiteProjectId"));
      return targetId ? [targetId] : [];
    }))];
    const visibleTargets = targetIds.length === 0
      ? []
      : await Project.find({ $and: [readFilter, { _id: { $in: targetIds } }] }).select("projectCode title");
    const targets = new Map(visibleTargets.map((row) => [row._id.toString(), row]));
    const items: ActivityItem[] = [];
    const progressTimes: Array<{ at: number; percent: number | null }> = [];
    for (const row of kept) {
      const mapped = classifyActivityAction(row.action);
      if (!mapped) continue;
      let detail: ActivityItem["detail"] = null;
      if (mapped.category === "progress") {
        const reportedPercent = percentToken(snapshotField(row.newValue, "physicalProgress"));
        detail = { reportedPercent, meaning: "reported_not_verified", completesProject: false };
        progressTimes.push({ at: row.timestamp instanceof Date ? row.timestamp.getTime() : 0, percent: reportedPercent });
      } else if (mapped.category === "dependency") {
        const targetId = objectId(snapshotField(row.newValue, "prerequisiteProjectId"));
        const visible = targetId ? targets.get(targetId) : undefined;
        detail = visible
          ? { scheduling: "informational", prerequisiteVisibility: "visible", projectCode: visible.projectCode, title: visible.title }
          : { scheduling: "informational", prerequisiteVisibility: "restricted" };
      } else if (mapped.category === "project" && row.action !== "project.created" && row.action !== "project.updated") {
        detail = { status: statusToken(snapshotField(row.newValue, "status"), PROJECT_STATUSES) };
      }
      const item = itemFromAudit(row, detail);
      if (item) items.push(item);
    }
    for (const row of milestoneRows.slice(0, ACTIVITY_SOURCE_CAP)) {
      const title = titles.get(row.resourceId.toString());
      if (!title) continue;
      const item = itemFromAudit(row, {
        milestoneTitle: title,
        milestoneStatus: statusToken(snapshotField(row.newValue, "status"), MILESTONE_STATUSES),
        completesProject: false,
      });
      if (item) items.push(item);
    }
    for (const report of reports.slice(0, ACTIVITY_SOURCE_CAP)) {
      const at = report.reportedAt instanceof Date ? report.reportedAt.getTime() : 0;
      const duplicate = progressTimes.some((event) => event.percent === report.reportedPercent && Math.abs(event.at - at) < 5000);
      if (duplicate || !(report.reportedAt instanceof Date)) continue;
      items.push({
        id: `report:${report._id.toString()}`,
        kind: "PROGRESS_RECORDED",
        category: "progress",
        occurredAt: report.reportedAt.toISOString(),
        source: "recorded_report",
        titleKey: "activity.progressRecorded",
        actor: activityActor(false),
        detail: { reportedPercent: report.reportedPercent, meaning: "recorded_source_not_audit", completesProject: false },
      });
    }
    if (!capped && !items.some((item) => item.kind === "PROJECT_CREATED") && project.createdAt instanceof Date) {
      items.push({
        id: `record:${project._id.toString()}`,
        kind: "PROJECT_RECORD_METADATA",
        category: "project",
        occurredAt: project.createdAt.toISOString(),
        source: "record_metadata",
        titleKey: "activity.projectRecorded",
        actor: activityActor(false),
        detail: { meaning: "record_timestamp_not_audit" },
      });
    }
    const cursor = query.cursor ? decodeActivityCursor(query.cursor) : null;
    if (query.cursor && !cursor) throw new FlowControl(400, "VALIDATION_ERROR");
    const filtered = query.category === "all" ? items : items.filter((item) => item.category === query.category);
    const page = pageActivities(filtered, cursor, query.limit);
    return {
      ok: true as const,
      activity: {
        projectId: project._id.toString(),
        projectStatus: project.status,
        physicalProgress: project.physicalProgress,
        progressMeaning: "reported_not_verified" as const,
        activities: page.activities,
        pageSize: query.limit,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        coverage: capped ? "partial_source_coverage" as const : "supported_events_only" as const,
        sourceAvailability: { audit: "available" as const, progress: "available" as const },
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new ActivityDependencyError();
  }
}

export type { ActivityCategory };
