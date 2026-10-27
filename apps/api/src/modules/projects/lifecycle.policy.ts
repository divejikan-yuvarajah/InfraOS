import type { Permission } from "@infraos/shared-types";

import { PROJECT_STATUSES } from "./project.constants.js";

export const LIFECYCLE_ACTIONS = [
  "SUBMIT",
  "HOLD",
  "RESUME",
  "START",
  "MARK_DELAYED",
  "COMPLETE",
  "CANCEL",
] as const;

export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Actions this step will commit. START/MARK_DELAYED have no confirmed grant. COMPLETE/CANCEL lack a safe dependency adapter. */
const EXECUTABLE = new Set<LifecycleAction>(["SUBMIT", "HOLD", "RESUME"]);

const PERMISSION: Record<LifecycleAction, Permission | null> = {
  SUBMIT: "project.submit",
  HOLD: "project.hold",
  RESUME: "project.hold",
  START: null,
  MARK_DELAYED: null,
  COMPLETE: "project.complete",
  CANCEL: "project.cancel",
};

const EDGES: Record<LifecycleAction, Partial<Record<ProjectStatus, ProjectStatus>>> = {
  SUBMIT: { DRAFT: "SUBMITTED" },
  HOLD: { ACTIVE: "ON_HOLD" },
  RESUME: { ON_HOLD: "ACTIVE" },
  START: { APPROVED: "ACTIVE" },
  MARK_DELAYED: { ACTIVE: "DELAYED" },
  COMPLETE: { ACTIVE: "COMPLETED" },
  CANCEL: { APPROVED: "CANCELLED", ACTIVE: "CANCELLED", ON_HOLD: "CANCELLED", DELAYED: "CANCELLED" },
};

export type LifecycleBlock = "unmapped_permission" | "dependency_unavailable" | "illegal_transition" | "missing_fields";

export function isLifecycleAction(value: string): value is LifecycleAction {
  return (LIFECYCLE_ACTIONS as readonly string[]).includes(value);
}

export function transitionTarget(from: string, action: LifecycleAction): ProjectStatus | null {
  const edge = EDGES[action][from as ProjectStatus];
  return edge ?? null;
}

export function actionPermission(action: LifecycleAction): Permission | null {
  return PERMISSION[action];
}

export function actionBlock(action: LifecycleAction): Exclude<LifecycleBlock, "illegal_transition" | "missing_fields"> | null {
  if (!EXECUTABLE.has(action)) {
    return PERMISSION[action] === null ? "unmapped_permission" : "dependency_unavailable";
  }
  return null;
}

export type SubmitShape = {
  title?: string | null;
  projectCode?: string | null;
  projectType?: string | null;
  budget?: { amountMinor?: number | null } | null;
  startDate?: Date | string | null;
  plannedEndDate?: Date | string | null;
  geometry?: { type?: string } | null;
  location?: Record<string, unknown> | null;
  physicalProgress?: number | null;
};

export function submitGaps(project: SubmitShape): string[] {
  const gaps: string[] = [];
  if (!project.title?.trim() || !project.projectCode?.trim() || !project.projectType?.trim()) gaps.push("identity");
  if (typeof project.budget?.amountMinor !== "number") gaps.push("budget");
  const start = project.startDate ? new Date(project.startDate) : null;
  const end = project.plannedEndDate ? new Date(project.plannedEndDate) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime()) || end < start) gaps.push("dates");
  if (!project.geometry || typeof project.geometry.type !== "string") gaps.push("geometry");
  const location = project.location as Record<string, unknown> | null | undefined;
  const keys = ["district", "province", "locality", "roadName", "description"];
  const located = Boolean(location && keys.some((key) => typeof location[key] === "string" && (location[key] as string).trim().length > 0));
  if (!located) gaps.push("location");
  return gaps;
}

/** Physical progress never implies completion. */
export function progressDoesNotComplete(progress: number | null | undefined, status: string): boolean {
  return progress === 100 && status !== "COMPLETED";
}

export function hintActions(status: string, granted: readonly string[]): LifecycleAction[] {
  return LIFECYCLE_ACTIONS.filter((action) => {
    if (actionBlock(action)) return false;
    if (!transitionTarget(status, action)) return false;
    const permission = actionPermission(action);
    return permission !== null && granted.includes(permission);
  });
}
