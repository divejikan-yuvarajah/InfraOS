import { z } from "zod";

import { MILESTONE_ACTIONS } from "./milestone.policy.js";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const milestoneCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  plannedStart: day,
  plannedEnd: day,
}).strict();

export const milestonePatchSchema = z.object({
  revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  plannedStart: day.optional(),
  plannedEnd: day.optional(),
  progress: z.number().int().min(0).max(100).optional(),
}).strict();

export const milestoneTransitionSchema = z.object({
  action: z.enum(MILESTONE_ACTIONS),
  revision: z.number().int().nonnegative(),
}).strict();

export const milestoneListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["plannedEnd", "title", "status"]).default("plannedEnd"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export type MilestoneCreateInput = z.infer<typeof milestoneCreateSchema>;
export type MilestonePatchInput = z.infer<typeof milestonePatchSchema>;
export type MilestoneTransitionInput = z.infer<typeof milestoneTransitionSchema>;
export type MilestoneListQuery = z.infer<typeof milestoneListQuerySchema>;
