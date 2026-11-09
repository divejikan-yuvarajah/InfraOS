import { z } from "zod";
import { AI_FEEDBACK_REASONS, AI_FEEDBACK_RATINGS, AI_LANGUAGES, AI_SCOPE_MAX_DOCUMENTS, AI_SCOPE_MODES } from "@infraos/shared-types";

import { objectId } from "../../contractors/contractor.schema.js";

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const clean = (v: string) => !/[\u0000-\u001f\u007f]/.test(v);

export const scopeSchema = z.object({
  mode: z.enum(AI_SCOPE_MODES), documentIds: z.array(objectId).min(1).max(AI_SCOPE_MAX_DOCUMENTS).optional(), projectId: objectId.optional(),
}).strict().refine((s) => (s.mode === "DOCUMENT" ? s.documentIds?.length === 1 && !s.projectId : s.mode === "DOCUMENTS" ? Boolean(s.documentIds?.length) && !s.projectId : s.mode === "PROJECT" ? Boolean(s.projectId) && !s.documentIds : !s.documentIds && !s.projectId), "scope fields do not match the mode");

export const askBody = z.object({
  question: z.string().trim().min(3).max(600).refine(clean, "control characters"), scope: scopeSchema,
  threadId: z.string().regex(/^[a-f0-9-]{36}$/).optional(), language: z.enum(AI_LANGUAGES).optional(), regenerate: z.boolean().optional(),
}).strict();

export const threadsQuery = z.object({ cursor: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(30).default(20) }).strict();
export const feedbackBody = z.object({
  rating: z.enum(AI_FEEDBACK_RATINGS), reason: z.enum(AI_FEEDBACK_REASONS).optional(), comment: z.string().trim().max(300).refine(clean, "control characters").optional(),
}).strict();

const csvIds = z.string().max(600).transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)).pipe(z.array(objectId).max(AI_SCOPE_MAX_DOCUMENTS));
export const scopePreviewQuery = z.object({ mode: z.enum(AI_SCOPE_MODES), documentIds: csvIds.optional(), projectId: objectId.optional() }).strict();
export const threadParam = z.string().regex(/^[a-f0-9-]{36}$/);
export const chunkContextParams = z.object({ chunkId: z.string().regex(/^[a-f0-9]{24}:\d+:\d+$/) });
