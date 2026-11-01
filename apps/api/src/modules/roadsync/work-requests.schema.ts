import { z } from "zod";

import { BAND_CODES, type Band } from "./assessment.rules.js";
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

export const WORK_REQUEST_LIST_KEYS = ["page", "limit", "status", "workType", "priority", "projectId", "hasCandidates", "band", "hasConflicts", "sort"] as const;

/** Step 71: comma-separated severity bands, validated against the rule config. */
const bandList = z.string().max(100).transform((v) => v.split(",").filter(Boolean).slice(0, 5)).refine((arr) => arr.length > 0 && arr.every((b) => (BAND_CODES as readonly string[]).includes(b))).transform((arr) => arr as Band[]);

export const workRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(WORK_STATUSES).optional(),
  workType: z.enum(WORK_TYPES).optional(),
  priority: z.enum(WORK_PRIORITIES).optional(),
  projectId: objectId.optional(),
  hasCandidates: z.enum(["true"]).optional(),
  band: bandList.optional(),
  hasConflicts: z.enum(["true"]).optional(),
  sort: z.enum(["startDate", "riskIndex"]).default("startDate"),
}).strict();

const bboxSchema = z.string().max(120).transform((v, ctx) => {
  const n = v.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[0]! >= n[2]! || n[1]! >= n[3]! || Math.abs(n[0]!) > 180 || Math.abs(n[2]!) > 180 || Math.abs(n[1]!) > 90 || Math.abs(n[3]!) > 90) {
    ctx.addIssue({ code: "custom", message: "bbox" });
    return z.NEVER;
  }
  return n as [number, number, number, number];
});

export const workRequestMapQuerySchema = z.object({
  status: z.enum(WORK_STATUSES).optional(),
  workType: z.enum(WORK_TYPES).optional(),
  priority: z.enum(WORK_PRIORITIES).optional(),
  projectId: objectId.optional(),
  bbox: bboxSchema.optional(),
}).strict();

export type WorkRequestCreateInput = z.infer<typeof workRequestCreateSchema>;
export type WorkRequestListQuery = z.infer<typeof workRequestListQuerySchema>;
