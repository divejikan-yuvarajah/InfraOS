import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const milestoneFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  plannedStart: day,
  plannedEnd: day,
}).strict().refine((value) => value.plannedEnd >= value.plannedStart, { path: ["plannedEnd"] });

export const MILESTONE_ACTIONS = ["START", "COMPLETE", "DELAY", "BLOCK", "RESUME", "CANCEL"] as const;

export function actionsFor(status: string): (typeof MILESTONE_ACTIONS)[number][] {
  if (status === "NOT_STARTED") return ["START", "DELAY", "BLOCK"];
  if (status === "IN_PROGRESS") return ["COMPLETE", "DELAY", "BLOCK", "CANCEL"];
  if (status === "DELAYED" || status === "BLOCKED") return ["RESUME", "CANCEL"];
  return [];
}
