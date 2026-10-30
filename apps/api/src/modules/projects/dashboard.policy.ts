import { PROJECT_STATUSES } from "./project.constants.js";

export const DASHBOARD_SCOPE_CAP = 500;
export const DASHBOARD_LIST_CAP = 10;
export const DASHBOARD_DUE_DAYS = 14;
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const OPEN_MILESTONE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DELAYED", "BLOCKED"] as const;

export const dashboardQuerySchemaKeys = [] as const;

/** Start of the Asia/Colombo calendar day that contains `asOf`, as a UTC instant. Colombo has no daylight-saving shift. */
export function colomboDayStart(asOf: Date): Date {
  const local = new Date(asOf.getTime() + COLOMBO_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(start - COLOMBO_OFFSET_MS);
}

export function colomboDayEnd(dayStart: Date, days: number): Date {
  return new Date(dayStart.getTime() + days * 24 * 60 * 60 * 1000);
}

export function milestoneWindow(asOf: Date): { dayStart: Date; dueEnd: Date } {
  const dayStart = colomboDayStart(asOf);
  return { dayStart, dueEnd: colomboDayEnd(dayStart, DASHBOARD_DUE_DAYS) };
}

export function milestoneCoverage(projectCount: number): "complete" | "unavailable" {
  return projectCount > DASHBOARD_SCOPE_CAP ? "unavailable" : "complete";
}

export function emptyStatusCounts(): Record<(typeof PROJECT_STATUSES)[number], number> {
  return {
    DRAFT: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    REJECTED: 0,
    APPROVED: 0,
    ACTIVE: 0,
    ON_HOLD: 0,
    DELAYED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
}
