import { z } from "zod";

import { validGeometry, type Geometry } from "../../shared/database/geometry.js";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./project.constants.js";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const safeText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasControlChar(value) && !value.includes("$"), "unsafe text");

const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}, "invalid date");

const locationSchema = z
  .object({
    district: safeText(100).optional(),
    province: safeText(100).optional(),
    locality: safeText(160).optional(),
    roadName: safeText(160).optional(),
    description: safeText(500).optional(),
  })
  .strict();

const geometrySchema = z.custom<Geometry>((value) => validGeometry(value), "invalid geometry");

const budgetSchema = z
  .object({
    amountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("LKR"),
  })
  .strict();

export const projectCreateSchema = z
  .object({
    projectCode: z.string().regex(/^INF-[A-Z_]+-[0-9]+$/).max(48),
    title: safeText(200),
    description: safeText(5000).optional(),
    projectType: z.enum(PROJECT_TYPES),
    startDate: isoDate.optional(),
    plannedEndDate: isoDate.optional(),
    location: locationSchema.optional(),
    geometry: geometrySchema.optional(),
    budget: budgetSchema,
  })
  .strict();

export const projectTransitionSchema = z
  .object({
    action: z.enum(["SUBMIT", "HOLD", "RESUME", "REOPEN", "START", "MARK_DELAYED", "COMPLETE", "CANCEL"]),
    revision: z.number().int().min(0).max(1_000_000),
    reason: z.union([safeText(500), z.null()]).optional(),
  })
  .strict();

export const projectPatchSchema = z
  .object({
    title: safeText(200).optional(),
    description: z.union([safeText(5000), z.null()]).optional(),
    location: z.union([locationSchema, z.null()]).optional(),
    geometry: z.union([geometrySchema, z.null()]).optional(),
    startDate: z.union([isoDate, z.null()]).optional(),
    plannedEndDate: z.union([isoDate, z.null()]).optional(),
    revision: z.number().int().min(0).max(1_000_000),
  })
  .strict();

const queryText = z.string().trim().max(80).refine((value) => !value.includes("$") && !hasControlChar(value));

export const PROJECT_LIST_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "projectCode",
  "title",
  "projectType",
  "status",
  "startDate",
  "plannedEndDate",
] as const;

export const projectListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    limit: z.coerce.number().int().min(1).max(25).default(20),
    status: z.enum(PROJECT_STATUSES).optional(),
    type: z.enum(PROJECT_TYPES).optional(),
    q: queryText.optional(),
    agencyId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    sortBy: z.enum(PROJECT_LIST_SORT_FIELDS).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const projectReviewSchema = z
  .object({
    action: z.enum(["BEGIN_REVIEW", "APPROVE", "REJECT", "RETURN_FOR_CHANGES"]),
    revision: z.number().int().min(0).max(1_000_000),
    reason: safeText(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const needsReason = value.action === "REJECT" || value.action === "RETURN_FOR_CHANGES";
    if (needsReason && !value.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "reason is required" });
    }
    if (!needsReason && value.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "reason is not accepted" });
    }
  });

export const projectReviewQueueQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    limit: z.coerce.number().int().min(1).max(25).default(10),
    status: z.enum(["SUBMITTED", "UNDER_REVIEW"]).optional(),
    q: queryText.optional(),
    agencyId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    sortBy: z.enum(PROJECT_LIST_SORT_FIELDS).default("updatedAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectPatchInput = z.infer<typeof projectPatchSchema>;
export type ProjectTransitionInput = z.infer<typeof projectTransitionSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type ProjectReviewInput = z.infer<typeof projectReviewSchema>;
export type ProjectReviewQueueQuery = z.infer<typeof projectReviewQueueQuerySchema>;
