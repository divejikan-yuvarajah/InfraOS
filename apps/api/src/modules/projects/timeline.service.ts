import type { Permission } from "@infraos/shared-types";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Milestone } from "./models/milestone.model.js";
import { ProgressReport } from "./models/progress-report.model.js";
import { Project } from "./models/project.model.js";
import { timelineDependencyLinks } from "./dependency.service.js";
import {
  TIMELINE_SOURCE_CAP,
  matchesTimelineKind,
  milestoneDateEntries,
  pageTimeline,
  progressReportEntry,
  projectScheduleEntries,
  type TimelineEntry,
} from "./timeline.policy.js";
import type { TimelineQuery } from "./timeline.schema.js";
import type { ProjectFailure } from "./projects.types.js";

const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);

class FlowControl extends Error {
  constructor(readonly status: ProjectFailure["status"], readonly code: ProjectFailure["code"]) {
    super(code);
  }
}

export class TimelineDependencyError extends Error {}

export const timelineHooks: {
  beforeRead: () => Promise<void>;
  beforeMilestoneRead: () => Promise<void>;
  beforeProgressRead: () => Promise<void>;
} = {
  beforeRead: async () => {},
  beforeMilestoneRead: async () => {},
  beforeProgressRead: async () => {},
};

export type TimelinePayload = {
  projectId: string;
  entries: TimelineEntry[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  historyCapped: boolean;
  sourceCap: number;
  sourceAvailability: {
    milestone: "visible" | "restricted" | "unavailable";
    progress: "visible" | "restricted" | "unavailable";
  };
  current: {
    projectStatus: string;
    physicalProgress: number;
    meaning: "reported_not_verified";
  };
  dependencies: Awaited<ReturnType<typeof timelineDependencyLinks>> | { status: "unavailable"; scheduling: "informational"; links: [] };
  provenance: "Reported physical progress is not inspection verification.";
};

function fail(status: ProjectFailure["status"], code: ProjectFailure["code"]): ProjectFailure {
  return { ok: false, status, code };
}

async function liveGrants(actor: AuthenticatedActor): Promise<string[]> {
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
  if (!allowed) {
    throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
  return granted;
}

async function loadProject(actor: AuthenticatedActor, projectId: string) {
  if (!/^[a-f0-9]{24}$/i.test(projectId)) throw new FlowControl(400, "VALIDATION_ERROR");
  if (PRIVATE_DENY.has(actor.roleKey)) throw new FlowControl(403, "FORBIDDEN");
  const filter = actor.roleKey === "INSPECTOR"
    ? { _id: { $in: await Inspection.find({ inspectorId: actor.userId }).distinct("projectId") } }
    : projectReadFilter(await resolveResourceScope(actor));
  const project = await Project.findOne({ $and: [filter, { _id: projectId }] }).select("status physicalProgress startDate plannedEndDate actualEndDate createdAt");
  if (!project) throw new FlowControl(404, "NOT_FOUND");
  return project;
}

export async function getProjectTimeline(actor: AuthenticatedActor, projectId: string, query: TimelineQuery) {
  try {
    await timelineHooks.beforeRead();
    const granted = await liveGrants(actor);
    const project = await loadProject(actor, projectId);
    const canMilestones = hasPermission(granted, "milestone.read");
    const canProgress = hasPermission(granted, "progress.read");
    let historyCapped = false;
    const entries: TimelineEntry[] = projectScheduleEntries({
      id: project._id.toString(),
      createdAt: project.createdAt,
      startDate: project.startDate,
      plannedEndDate: project.plannedEndDate,
      actualEndDate: project.actualEndDate,
    });
    let milestoneAvailability: TimelinePayload["sourceAvailability"]["milestone"] = canMilestones ? "visible" : "restricted";
    let progressAvailability: TimelinePayload["sourceAvailability"]["progress"] = canProgress ? "visible" : "restricted";
    if (canMilestones) {
      try {
        await timelineHooks.beforeMilestoneRead();
        const rows = await Milestone.find({ projectId: project._id })
          .sort({ plannedStart: 1, _id: 1 })
          .limit(TIMELINE_SOURCE_CAP + 1)
          .select("title status plannedStart plannedEnd actualStart actualEnd");
        if (rows.length > TIMELINE_SOURCE_CAP) historyCapped = true;
        for (const row of rows.slice(0, TIMELINE_SOURCE_CAP)) {
          entries.push(...milestoneDateEntries({
            id: row._id.toString(),
            title: row.title,
            status: row.status,
            plannedStart: row.plannedStart,
            plannedEnd: row.plannedEnd,
            actualStart: row.actualStart,
            actualEnd: row.actualEnd,
          }));
        }
      } catch (error) {
        if (error instanceof FlowControl) throw error;
        milestoneAvailability = "unavailable";
      }
    }
    if (canProgress) {
      try {
        await timelineHooks.beforeProgressRead();
        const rows = await ProgressReport.find({ projectId: project._id })
          .sort({ reportedAt: 1, _id: 1 })
          .limit(TIMELINE_SOURCE_CAP + 1)
          .select("reportedAt reportedPercent note");
        if (rows.length > TIMELINE_SOURCE_CAP) historyCapped = true;
        for (const row of rows.slice(0, TIMELINE_SOURCE_CAP)) {
          const entry = progressReportEntry({
            id: row._id.toString(),
            reportedAt: row.reportedAt,
            reportedPercent: row.reportedPercent,
            note: canProgress ? row.note : null,
          });
          if (entry) entries.push(entry);
        }
      } catch (error) {
        if (error instanceof FlowControl) throw error;
        progressAvailability = "unavailable";
      }
    }
    const filtered = entries.filter((entry) => matchesTimelineKind(entry, query.kind));
    const page = pageTimeline(filtered, query.page, query.limit, query.sort);
    const payload: TimelinePayload = {
      projectId: project._id.toString(),
      entries: page.entries,
      page: query.page,
      limit: query.limit,
      total: page.total,
      hasMore: page.hasMore,
      historyCapped,
      sourceCap: TIMELINE_SOURCE_CAP,
      sourceAvailability: {
        milestone: milestoneAvailability,
        progress: progressAvailability,
      },
      current: {
        projectStatus: project.status,
        physicalProgress: project.physicalProgress,
        meaning: "reported_not_verified",
      },
      dependencies: await (async () => {
        try {
          return await timelineDependencyLinks(actor, project._id);
        } catch {
          return { status: "unavailable" as const, scheduling: "informational" as const, links: [] };
        }
      })(),
      provenance: "Reported physical progress is not inspection verification.",
    };
    return { ok: true as const, timeline: payload };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new TimelineDependencyError();
  }
}
