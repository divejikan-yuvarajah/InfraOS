import { z } from "zod";

import { objectId, reasonText, text } from "../contractors/contractor.schema.js";
import { CHECKLIST_RESULTS, DEFECT_SEVERITIES, INSPECTION_PRIORITIES, INSPECTION_STATUSES, INSPECTION_TYPES } from "./inspection.constants.js";

const optText = (max: number) => z.string().trim().max(max).optional();
const pct = z.number().int().min(0).max(100);
const keyField = z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/);
const date = z.coerce.date();

export const scheduleBody = z.object({
  projectId: objectId, inspectorId: objectId, inspectionDate: date, durationMinutes: z.number().int().min(15).max(480).default(120),
  inspectionType: z.enum(INSPECTION_TYPES).default("PROGRESS_VERIFICATION"), purpose: optText(500), priority: z.enum(INSPECTION_PRIORITIES).default("NORMAL"),
  locationNote: optText(300), useProjectPoint: z.boolean().default(true), milestoneIds: z.array(objectId).max(10).default([]), followUpOfId: objectId.optional(),
}).strict();

export const editBody = z.object({
  version: z.number().int().min(0), purpose: optText(500), priority: z.enum(INSPECTION_PRIORITIES).optional(), locationNote: optText(300),
  durationMinutes: z.number().int().min(15).max(480).optional(), inspectionType: z.enum(INSPECTION_TYPES).optional(), milestoneIds: z.array(objectId).max(10).optional(),
}).strict().refine((v) => Object.keys(v).length > 1, "nothing to update");

export const rescheduleBody = z.object({ inspectionDate: date, reason: reasonText }).strict();
export const reassignBody = z.object({ inspectorId: objectId, reason: reasonText }).strict();
export const cancelBody = z.object({ reason: reasonText }).strict();

const checklistEntry = z.object({ key: keyField, result: z.enum(CHECKLIST_RESULTS), note: optText(500) }).strict();
const defectEntry = z.object({ key: keyField, title: text(160), description: optText(1000), severity: z.enum(DEFECT_SEVERITIES), location: optText(200), reworkRequired: z.boolean().default(false) }).strict();
const followUpCheck = z.object({ parentInspectionId: objectId, defectKey: keyField, resolved: z.boolean(), note: optText(500) }).strict();
const milestoneAssessment = z.object({ milestoneId: objectId, verifiedProgress: pct, note: optText(500) }).strict();

/** Autosave body. `revision` is the token the client last saw; the server increments it. */
export const reportBody = z.object({
  revision: z.number().int().min(0),
  checklist: z.array(checklistEntry).max(40), siteObservations: optText(4000), workCompletionObservations: optText(4000), safetyObservations: optText(3000),
  defects: z.array(defectEntry).max(30), followUpChecks: z.array(followUpCheck).max(30).default([]), recommendations: optText(3000),
  followUpRequired: z.boolean().default(false), followUpNote: optText(1000), measuredProgress: pct.nullable().optional(),
  milestoneAssessments: z.array(milestoneAssessment).max(10).default([]), discrepancyNote: optText(1000), inspectorDeclaration: z.boolean().default(false),
}).strict();

export const submitBody = z.object({ revision: z.number().int().min(0) }).strict();

export const decisionBody = z.object({
  decision: z.enum(["APPROVE", "REQUEST_REVISION", "REJECT"]), note: reasonText.optional(),
  itemComments: z.array(z.object({ itemKey: keyField, comment: text(500) }).strict()).max(40).default([]), acknowledgeDiscrepancy: z.boolean().optional(),
}).strict();

export const evidenceBody = z.object({
  caption: optText(300), checklistItemKey: keyField.optional(), defectKey: keyField.optional(), capturedAt: date,
  location: z.object({ lon: z.number().min(-180).max(180), lat: z.number().min(-90).max(90), accuracyM: z.number().min(0).max(5000) }).strict().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096), sizeBytes: z.number().int().min(1).max(4 * 1024 * 1024),
  thumb: z.object({ sizeBytes: z.number().int().min(1).max(150 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
}).strict();
export const evidencePatch = z.object({ caption: optText(300), checklistItemKey: keyField.nullable().optional(), defectKey: keyField.nullable().optional() }).strict().refine((v) => Object.keys(v).length > 0, "nothing to update");
export const evidenceRemoveBody = z.object({ reason: z.string().trim().min(5).max(300) }).strict();

const num = (min: number, max: number) => z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(min).max(max));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const csv = <T extends string>(allowed: readonly T[]) => z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.enum(allowed as unknown as [T, ...T[]])).max(allowed.length));
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/);

const filters = {
  q: z.string().trim().min(1).max(80).optional(), status: csv(INSPECTION_STATUSES).optional(), type: z.enum(INSPECTION_TYPES).optional(), priority: z.enum(INSPECTION_PRIORITIES).optional(),
  projectId: objectId.optional(), inspectorId: objectId.optional(), agencyId: objectId.optional(), dateFrom: dateStr.optional(), dateTo: dateStr.optional(),
  overdue: bool.optional(), needsReview: bool.optional(), mine: bool.optional(),
};
export const listQuery = z.object({ ...filters, sort: z.enum(["date_asc", "date_desc"]).default("date_asc"), page: num(1, 10000).default(1), limit: num(1, 50).default(20) }).strict();
export const calendarQuery = z.object({ ...filters, from: dateStr, to: dateStr }).strict();
export const summaryQuery = z.object({ projectId: objectId.optional() }).strict();
export const inspectorsQuery = z.object({ projectId: objectId, from: dateStr.optional(), to: dateStr.optional(), durationMinutes: num(15, 480).optional() }).strict();
export const fileQuery = z.object({ variant: z.enum(["full", "thumb"]).default("full") }).strict();
