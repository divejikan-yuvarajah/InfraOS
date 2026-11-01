import { z } from "zod";

import { WORK_PRIORITIES, WORK_STATUSES, WORK_TYPES } from "./roadsync.constants.js";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
/** Explicit instant only: a Z or numeric offset is mandatory so no server-local zone is guessed. */
const instant = z.string().max(40).datetime({ offset: true });
const lon = z.number().finite().min(-180).max(180);
const lat = z.number().finite().min(-90).max(90);
const position = z.tuple([lon, lat]);

export const geometryInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }).strict(),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2).max(500) }).strict(),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(position).min(4).max(500)).min(1).max(10) }).strict(),
]);

export const workRequestCreateSchema = z.object({
  projectId: objectId,
  workType: z.enum(WORK_TYPES),
  priority: z.enum(WORK_PRIORITIES).optional(),
  plannedStart: instant,
  plannedEnd: instant,
  geometry: geometryInputSchema,
}).strict();

export const WORK_REQUEST_LIST_KEYS = ["page", "limit", "status", "workType", "priority", "projectId"] as const;

export const workRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(WORK_STATUSES).optional(),
  workType: z.enum(WORK_TYPES).optional(),
  priority: z.enum(WORK_PRIORITIES).optional(),
  projectId: objectId.optional(),
}).strict();

export type WorkRequestCreateInput = z.infer<typeof workRequestCreateSchema>;
export type WorkRequestListQuery = z.infer<typeof workRequestListQuerySchema>;
