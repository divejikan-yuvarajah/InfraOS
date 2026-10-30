import mongoose from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { Inspection } from "../inspections/models/inspection.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Milestone } from "./models/milestone.model.js";
import { Project } from "./models/project.model.js";
import { PROJECT_STATUSES } from "./project.constants.js";
import {
  DASHBOARD_LIST_CAP,
  DASHBOARD_SCOPE_CAP,
  OPEN_MILESTONE_STATUSES,
  emptyStatusCounts,
  milestoneCoverage,
  milestoneWindow,
} from "./dashboard.policy.js";
import type { ProjectFailure } from "./projects.types.js";

const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);
const REVIEW_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;

export const dashboardHooks: { beforeRead: () => Promise<void> } = {
  beforeRead: async () => {},
};

export class DashboardDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("project dashboard is temporarily unavailable");
    this.name = "DashboardDependencyError";
  }
}

class FlowControl extends Error {
  constructor(readonly status: ProjectFailure["status"], readonly code: ProjectFailure["code"]) {
    super(code);
    this.name = "FlowControl";
  }
}

export type DashboardRecentProject = {
  id: string;
  projectCode: string;
  title: string;
  status: string;
  updatedAt: string;
};

export type DashboardMilestoneItem = {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  title: string;
  status: string;
  plannedEnd: string;
  classification: "overdue" | "due";
  meaning: "planned_not_completed";
};

export type DashboardReviewItem = {
  id: string;
  projectCode: string;
  title: string;
  status: "SUBMITTED" | "UNDER_REVIEW";
  updatedAt: string;
};

export type ProjectDashboard = {
  asOf: string;
  timezone: "Asia/Colombo";
  scope: "platform" | "agency" | "assigned";
  coverage: {
    projects: "complete";
    milestones: "complete" | "unavailable";
    reviews: "complete" | "unavailable";
    finance: "complete" | "unavailable" | "withheld";
  };
  counts: {
    total: number;
    byStatus: Record<(typeof PROJECT_STATUSES)[number], number>;
    active: number;
    onHold: number;
    delayed: number;
  };
  recentProjects: DashboardRecentProject[];
  physical: {
    reportedAt100StillNotCompleted: number;
    completedByStatus: number;
    meaning: "physical_progress_does_not_set_status";
  };
  milestones: null | {
    overdue: number;
    dueWithin14Days: number;
    items: DashboardMilestoneItem[];
    meaning: "planned_not_completed";
  };
  reviews: null | {
    pending: number;
    items: DashboardReviewItem[];
  };
  finance: null | {
    storedPaidCount: number;
    storedPaidAmountMinor: number;
    currency: "LKR";
    provenance: "stored_record_provisional_not_bank_settlement";
  };
  assignedToYou: number | null;
  availableWidgets: string[];
};

function fail(status: ProjectFailure["status"], code: ProjectFailure["code"]): ProjectFailure {
  return { ok: false, status, code };
}

async function assertLive(actor: AuthenticatedActor, permissions: Permission[]): Promise<void> {
  if (!mongoose.isValidObjectId(actor.userId) || !mongoose.isValidObjectId(actor.roleId)) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  const user = await User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const role = await Role.findById(actor.roleId).select("key isActive permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const allowed = role?.isActive && role.key === actor.roleKey && permissions.every((permission) => hasPermission(granted, permission));
  if (!allowed) {
    throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
}

async function readFilter(actor: AuthenticatedActor): Promise<{ denied: true } | { denied: false; filter: Record<string, unknown>; scope: ProjectDashboard["scope"] }> {
  if (PRIVATE_DENY.has(actor.roleKey)) return { denied: true };
  if (actor.roleKey === "INSPECTOR") {
    const ids = await Inspection.find({ inspectorId: actor.userId }).distinct("projectId");
    return { denied: false, filter: { _id: { $in: ids } }, scope: "assigned" };
  }
  const scope = await resolveResourceScope(actor);
  return { denied: false, filter: projectReadFilter(scope), scope: actor.roleKey === "SUPER_ADMIN" ? "platform" : "agency" };
}

function iso(value: Date | null | undefined): string {
  return value instanceof Date ? value.toISOString() : new Date(0).toISOString();
}

export async function getProjectDashboard(actor: AuthenticatedActor, now = new Date()): Promise<{ ok: true; dashboard: ProjectDashboard } | ProjectFailure> {
  try {
    await dashboardHooks.beforeRead();
    await assertLive(actor, ["project.dashboard.read", "project.read"]);
    const scoped = await readFilter(actor);
    if (scoped.denied) return fail(403, "FORBIDDEN");
    const filter = scoped.filter;
    const asOf = now;
    const { dayStart, dueEnd } = milestoneWindow(asOf);
    const byStatus = emptyStatusCounts();
    const statusCounts = await Promise.all(
      PROJECT_STATUSES.map(async (status) => [status, await Project.countDocuments({ $and: [filter, { status }] })] as const),
    );
    for (const [status, count] of statusCounts) byStatus[status] = count;
    const summed = PROJECT_STATUSES.reduce((total, status) => total + byStatus[status], 0);
    const total = await Project.countDocuments(filter);
    if (summed !== total) throw new DashboardDependencyError();
    const recent = await Project.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(DASHBOARD_LIST_CAP).select("projectCode title status updatedAt");
    const reportedAt100StillNotCompleted = await Project.countDocuments({
      $and: [filter, { physicalProgress: 100, status: { $ne: "COMPLETED" } }],
    });
    const projectRows = await Project.find(filter).select("_id projectCode title managerId").limit(DASHBOARD_SCOPE_CAP + 1);
    const milestonesAvailable = milestoneCoverage(projectRows.length) === "complete";
    const projectIds = projectRows.map((row) => row._id);
    const projectById = new Map(projectRows.map((row) => [row._id.toString(), row]));
    let milestones: ProjectDashboard["milestones"] = null;
    if (milestonesAvailable) {
      const open = { projectId: { $in: projectIds }, status: { $in: [...OPEN_MILESTONE_STATUSES] } };
      const [overdue, dueWithin14Days, items] = await Promise.all([
        Milestone.countDocuments({ ...open, plannedEnd: { $lt: dayStart } }),
        Milestone.countDocuments({ ...open, plannedEnd: { $gte: dayStart, $lt: dueEnd } }),
        Milestone.find({ ...open, plannedEnd: { $lt: dueEnd } }).sort({ plannedEnd: 1, _id: 1 }).limit(DASHBOARD_LIST_CAP).select("projectId title status plannedEnd"),
      ]);
      milestones = {
        overdue,
        dueWithin14Days,
        meaning: "planned_not_completed",
        items: items.flatMap((item) => {
          const project = projectById.get(item.projectId.toString());
          if (!project || !(item.plannedEnd instanceof Date)) return [];
          return [{
            id: item._id.toString(),
            projectId: project._id.toString(),
            projectCode: project.projectCode,
            projectTitle: project.title,
            title: item.title,
            status: item.status,
            plannedEnd: item.plannedEnd.toISOString(),
            classification: item.plannedEnd < dayStart ? "overdue" as const : "due" as const,
            meaning: "planned_not_completed" as const,
          }];
        }),
      };
    }
    const role = await Role.findById(actor.roleId).select("key isActive permissions");
    const granted = Array.isArray(role?.permissions) ? role.permissions : [];
    const reviewer = actor.roleKey === "GOV_ADMIN" && role?.isActive && role.key === actor.roleKey && hasPermission(granted, "project.approve");
    let reviews: ProjectDashboard["reviews"] = null;
    if (reviewer) {
      const scope = await resolveResourceScope(actor);
      const approval = scope.kind === "agencies" ? { agencyId: { $in: scope.agencyIds } } : { _id: { $in: [] as mongoose.Types.ObjectId[] } };
      const pendingFilter = { $and: [filter, approval, { status: { $in: [...REVIEW_STATUSES] } }] };
      const [pending, reviewRows] = await Promise.all([
        Project.countDocuments(pendingFilter),
        Project.find(pendingFilter).sort({ updatedAt: -1, _id: -1 }).limit(DASHBOARD_LIST_CAP).select("projectCode title status updatedAt"),
      ]);
      reviews = {
        pending,
        items: reviewRows.flatMap((row) => {
          if (row.status !== "SUBMITTED" && row.status !== "UNDER_REVIEW") return [];
          return [{ id: row._id.toString(), projectCode: row.projectCode, title: row.title, status: row.status, updatedAt: iso(row.updatedAt) }];
        }),
      };
    }
    const financeAllowed = Boolean(role?.isActive && role.key === actor.roleKey && hasPermission(granted, "finance.budget.read") && hasPermission(granted, "finance.payment.read"));
    let finance: ProjectDashboard["finance"] = null;
    let financeCoverage: ProjectDashboard["coverage"]["finance"] = "withheld";
    if (financeAllowed && milestonesAvailable) {
      const paid = await ProjectPayment.find({ projectId: { $in: projectIds }, status: "PAID" }).select("amount status");
      let storedPaidAmountMinor = 0;
      for (const row of paid) {
        if (row.status !== "PAID") continue;
        const amount = row.amount?.amountMinor;
        if (typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0) storedPaidAmountMinor += amount;
      }
      finance = {
        storedPaidCount: paid.length,
        storedPaidAmountMinor,
        currency: "LKR",
        provenance: "stored_record_provisional_not_bank_settlement",
      };
      financeCoverage = "complete";
    } else if (financeAllowed) {
      financeCoverage = "unavailable";
    }
    const assignedToYou = actor.roleKey === "PROJECT_MANAGER"
      ? (milestonesAvailable ? projectRows.filter((row) => row.managerId?.toString() === actor.userId).length : null)
      : null;
    const availableWidgets = ["counts", "status", "recent", "physical"];
    if (milestones) availableWidgets.push("milestones");
    if (reviews) availableWidgets.push("reviews");
    if (finance) availableWidgets.push("finance");
    return {
      ok: true,
      dashboard: {
        asOf: asOf.toISOString(),
        timezone: "Asia/Colombo",
        scope: scoped.scope,
        coverage: {
          projects: "complete",
          milestones: milestones ? "complete" : "unavailable",
          reviews: reviews ? "complete" : "unavailable",
          finance: financeCoverage,
        },
        counts: {
          total,
          byStatus,
          active: byStatus.ACTIVE,
          onHold: byStatus.ON_HOLD,
          delayed: byStatus.DELAYED,
        },
        recentProjects: recent.map((row) => ({
          id: row._id.toString(),
          projectCode: row.projectCode,
          title: row.title,
          status: row.status,
          updatedAt: iso(row.updatedAt),
        })),
        physical: {
          reportedAt100StillNotCompleted,
          completedByStatus: byStatus.COMPLETED,
          meaning: "physical_progress_does_not_set_status",
        },
        milestones,
        reviews,
        finance,
        assignedToYou,
        availableWidgets,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof DashboardDependencyError) return fail(503, "SERVICE_UNAVAILABLE");
    throw new DashboardDependencyError();
  }
}
