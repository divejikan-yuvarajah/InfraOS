import { z } from "zod";
import { DOCUMENT_CATEGORY_KEYS, DOCUMENT_CONFIDENTIALITIES, DOCUMENT_FILE_TYPES, DOCUMENT_LANGUAGES, DOCUMENT_LIMITS, DOCUMENT_ORIGINS, DOCUMENT_STATUSES } from "@infraos/shared-types";

import { objectId, reasonText } from "../contractors/contractor.schema.js";
import { DOCUMENT_VISIBILITIES } from "./document.constants.js";

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const clean = (v: string) => !/[\u0000-\u001f\u007f]/.test(v);
const text = (max: number) => z.string().trim().min(1).max(max).refine(clean, "control characters");
const optText = (max: number) => z.string().trim().max(max).refine(clean, "control characters");
const day = z.coerce.date();
const csv = <T extends string>(values: readonly T[]) => z.string().max(300).transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.enum(values as readonly [T, ...T[]])).max(20));

export const tagList = z.array(z.string().trim().toLowerCase().min(1).max(40).refine(clean, "control characters")).max(DOCUMENT_LIMITS.maxTags)
  .transform((t) => [...new Set(t)]);

const links = z.object({
  contractorId: objectId.nullable().optional(), inspectionId: objectId.nullable().optional(), paymentId: objectId.nullable().optional(),
  expenseId: objectId.nullable().optional(), assetId: objectId.nullable().optional(), milestoneId: objectId.nullable().optional(),
}).strict();

const fileInfo = { fileName: text(255), mimeType: text(100), sizeBytes: z.number().int().min(1).max(DOCUMENT_LIMITS.maxFileBytes) };

/** Step 1 of an upload. `agencyId` is deliberately absent: the owning agency is derived server-side from the project or the uploader. */
export const uploadInit = z.object({
  ...fileInfo,
  category: z.enum(DOCUMENT_CATEGORY_KEYS as unknown as [string, ...string[]]),
  title: text(200).optional(), description: optText(2000).optional(), tags: tagList.default([]),
  documentDate: day.optional(), reference: optText(100).optional(), language: z.enum(DOCUMENT_LANGUAGES).optional(), expiresAt: day.optional(),
  visibility: z.enum(DOCUMENT_VISIBILITIES).optional(), confidentiality: z.enum(DOCUMENT_CONFIDENTIALITIES).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
  projectId: objectId.optional(), links: links.default({}),
}).strict();

export const versionInit = z.object({ ...fileInfo, changeNote: z.string().trim().min(5).max(500).refine(clean, "control characters") }).strict();
export const commitBody = z.object({ allowDuplicate: z.boolean().default(false) }).strict();
export const restoreVersionBody = z.object({ changeNote: z.string().trim().min(5).max(500).refine(clean, "control characters") }).strict();
export const removeVersionBody = z.object({ reason: reasonText }).strict();

export const patchBody = z.object({
  version: z.number().int().min(0),
  title: text(200).optional(), description: optText(2000).nullable().optional(),
  category: z.enum(DOCUMENT_CATEGORY_KEYS as unknown as [string, ...string[]]).optional(),
  tags: tagList.optional(), documentDate: day.nullable().optional(), reference: optText(100).nullable().optional(),
  language: z.enum(DOCUMENT_LANGUAGES).nullable().optional(), expiresAt: day.nullable().optional(),
  visibility: z.enum(DOCUMENT_VISIBILITIES).optional(), links: links.optional(),
}).strict().refine((b) => Object.keys(b).length > 1, "nothing to change");

export const statusBody = z.object({ version: z.number().int().min(0), status: z.enum(["DRAFT", "ACTIVE"]), supersededById: objectId.optional() }).strict();
export const archiveBody = z.object({ reason: reasonText }).strict();
export const restoreBody = z.object({ reason: reasonText.optional() }).strict();
export const deleteBody = z.object({ reason: reasonText, confirm: z.string().trim().min(1).max(30) }).strict();
export const restrictBody = z.object({ version: z.number().int().min(0), confidentiality: z.enum(DOCUMENT_CONFIDENTIALITIES).optional(), aiProcessingAllowed: z.boolean().optional(), reason: reasonText }).strict()
  .refine((b) => b.confidentiality !== undefined || b.aiProcessingAllowed !== undefined, "nothing to change");
export const bulkBody = z.object({
  ids: z.array(objectId).min(1).max(50), action: z.enum(["ARCHIVE", "ADD_TAG", "CHANGE_CATEGORY"]),
  reason: reasonText.optional(), tag: z.string().trim().toLowerCase().min(1).max(40).optional(), category: z.enum(DOCUMENT_CATEGORY_KEYS as unknown as [string, ...string[]]).optional(),
}).strict();

const yes = z.enum(["true", "false"]).transform((v) => v === "true");
const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idOrMe = z.union([z.literal("me"), objectId]);
const SORTS = ["relevance", "newest", "oldest", "title", "size", "updated"] as const;

/** Repeated keys are rejected by `parseStrict` before this runs. Lists are comma separated. */
export const listQuery = z.object({
  q: z.string().max(200).optional(), category: csv(DOCUMENT_CATEGORY_KEYS).optional(), group: z.string().max(40).optional(), projectId: objectId.optional(), agencyId: objectId.optional(),
  contractorId: objectId.optional(), assetId: objectId.optional(), inspectionId: objectId.optional(), fileType: csv(DOCUMENT_FILE_TYPES).optional(), status: csv(DOCUMENT_STATUSES).optional(),
  confidentiality: z.enum(DOCUMENT_CONFIDENTIALITIES).optional(), visibility: z.enum(DOCUMENT_VISIBILITIES).optional(), tag: z.string().max(700).optional(), uploadedBy: idOrMe.optional(),
  from: dayStr.optional(), to: dayStr.optional(), docDateFrom: dayStr.optional(), docDateTo: dayStr.optional(), hasFile: yes.optional(), origin: z.enum(DOCUMENT_ORIGINS).optional(), aiReady: yes.optional(), aiStatus: z.enum(["NOT_STARTED", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "UNSUPPORTED"]).optional(),
  expiring: z.enum(["30"]).optional(), thisMonth: yes.optional(),
  sort: z.enum(SORTS).default("newest"), page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(25),
}).strict();
export type ListQuery = z.infer<typeof listQuery>;

export const activityQuery = z.object({ cursor: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();
export const downloadQuery = z.object({ version: z.coerce.number().int().min(1).max(DOCUMENT_LIMITS.maxVersions).optional() }).strict();
export const exportQuery = listQuery.omit({ page: true, limit: true, sort: true });
export const projectDocsQuery = z.object({ category: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();
