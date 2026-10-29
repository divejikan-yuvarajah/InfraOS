import { z } from "zod";

import { decodeActivityCursor } from "./activity.policy.js";

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(240).optional().refine((value) => value === undefined || decodeActivityCursor(value) !== null),
  category: z.enum(["all", "project", "milestone", "progress", "dependency"]).default("all"),
}).strict();

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export const ACTIVITY_QUERY_KEYS = ["limit", "cursor", "category"] as const;
