import { z } from "zod";

export const timelineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  sort: z.enum(["asc", "desc"]).default("asc"),
  kind: z.enum([
    "all",
    "project",
    "milestone",
    "progress",
    "PROJECT_CREATED",
    "PROJECT_SCHEDULE",
    "MILESTONE_DATE",
    "PROGRESS_REPORTED",
  ]).default("all"),
}).strict();

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

export const TIMELINE_QUERY_KEYS = ["page", "limit", "sort", "kind"] as const;
