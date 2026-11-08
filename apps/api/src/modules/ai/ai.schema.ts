import { z } from "zod";
import { AI_JOB_STATUSES, AI_JOB_TRIGGERS } from "@infraos/shared-types";

import { objectId } from "../contractors/contractor.schema.js";

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const clean = (v: string) => !/[\u0000-\u001f\u007f]/.test(v);
const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const intIn = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const chunkQuery = z.object({ page: intIn(1, 1000).default(1), limit: intIn(1, 20).default(10) }).strict();

export const jobsQuery = z.object({
  status: z.enum(AI_JOB_STATUSES).optional(), trigger: z.enum(AI_JOB_TRIGGERS).optional(), from: dayStr.optional(), to: dayStr.optional(),
  documentId: objectId.optional(), agencyId: objectId.optional(), q: z.string().trim().max(100).refine(clean, "control characters").optional(),
  page: intIn(1, 1000).default(1), limit: intIn(1, 50).default(25),
}).strict();

export const bulkReprocessBody = z.object({
  ids: z.array(objectId).min(1).max(50).optional(),
  status: z.literal("FAILED").optional(),
}).strict().refine((b) => Boolean(b.ids) !== Boolean(b.status), "provide either ids or status");

export const reindexBody = z.object({ action: z.enum(["start", "finalize"]), confirm: z.enum(["REINDEX", "FINALIZE"]) }).strict()
  .refine((b) => (b.action === "start" ? b.confirm === "REINDEX" : b.confirm === "FINALIZE"), "confirmation does not match the action");

export const diagnosticBody = z.object({
  query: z.string().trim().min(2).max(300).refine(clean, "control characters"),
  projectId: objectId.optional(),
  limit: z.number().int().min(1).max(8).default(5),
}).strict();
