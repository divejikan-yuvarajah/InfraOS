import { MILESTONE_STATUSES, type MilestoneStatus } from "./project.constants.js";

export const MILESTONE_ACTIONS = ["START", "COMPLETE", "DELAY", "BLOCK", "RESUME", "CANCEL"] as const;
export type MilestoneAction = (typeof MILESTONE_ACTIONS)[number];

const EDGES: Record<MilestoneAction, Partial<Record<MilestoneStatus, MilestoneStatus>>> = {
  START: { NOT_STARTED: "IN_PROGRESS" },
  COMPLETE: { IN_PROGRESS: "COMPLETED" },
  DELAY: { NOT_STARTED: "DELAYED", IN_PROGRESS: "DELAYED" },
  BLOCK: { NOT_STARTED: "BLOCKED", IN_PROGRESS: "BLOCKED" },
  RESUME: { DELAYED: "IN_PROGRESS", BLOCKED: "IN_PROGRESS" },
  CANCEL: { IN_PROGRESS: "CANCELLED", DELAYED: "CANCELLED", BLOCKED: "CANCELLED" },
};

export function milestoneTarget(status: string, action: string): MilestoneStatus | null {
  if (!MILESTONE_STATUSES.includes(status as MilestoneStatus)) return null;
  if (!MILESTONE_ACTIONS.includes(action as MilestoneAction)) return null;
  return EDGES[action as MilestoneAction][status as MilestoneStatus] ?? null;
}
