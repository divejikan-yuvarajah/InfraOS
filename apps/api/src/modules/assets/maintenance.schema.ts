import { z } from "zod";

import { objectId, reasonText, text } from "../contractors/contractor.schema.js";
import { amountField } from "../finance/finance.schema.js";
import { MAINTENANCE_OUTCOMES, MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from "./asset.constants.js";

const optText = (max: number) => z.string().trim().max(max).optional();
const date = z.coerce.date();
const key = z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/);
const task = z.object({ key, title: text(160) }).strict();

export const requestBody = z.object({
  title: text(160), description: optText(3000), maintenanceType: z.enum(MAINTENANCE_TYPES), priority: z.enum(MAINTENANCE_PRIORITIES).default("NORMAL"), scheduledDate: date,
  estimatedCost: amountField.optional(), recurrenceDays: z.number().int().min(30).max(1825).optional(), linkedIssueKeys: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  tasks: z.array(task).max(20).default([]), plan: z.boolean().default(false), origin: z.enum(["PLANNED", "CONDITION_TRIGGER", "INSPECTION_FINDING"]).optional(),
  assignedTeam: optText(120), contractorId: objectId.optional(), responsibleAgencyId: objectId.optional(), acknowledgeEmergency: z.boolean().optional(),
}).strict();

export const patchBody = z.object({
  version: z.number().int().min(0), title: text(160).optional(), description: optText(3000), priority: z.enum(MAINTENANCE_PRIORITIES).optional(), scheduledDate: date.optional(),
  estimatedCost: amountField.optional(), recurrenceDays: z.number().int().min(30).max(1825).nullable().optional(), assignedTeam: optText(120), contractorId: objectId.nullable().optional(),
  responsibleAgencyId: objectId.nullable().optional(), tasks: z.array(task).max(20).optional(), linkedIssueKeys: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
}).strict().refine((v) => Object.keys(v).length > 1, "nothing to update");

export const approveBody = z.object({ note: reasonText.optional(), acknowledgeEmergency: z.boolean().optional() }).strict();
export const rejectBody = z.object({ note: reasonText }).strict();
export const scheduleBody = z.object({ scheduledDate: date, assignedTeam: optText(120), contractorId: objectId.nullable().optional(), responsibleAgencyId: objectId.nullable().optional() }).strict();
export const startBody = z.object({}).strict();
export const cancelBody = z.object({ reason: reasonText }).strict();
export const completeBody = z.object({
  completedDate: date, completionNotes: z.string().trim().min(20).max(3000), outcome: z.enum(MAINTENANCE_OUTCOMES), cost: amountField.optional(),
  tasks: z.array(z.object({ key, done: z.boolean(), skippedNote: optText(300) }).strict()).max(20).default([]),
}).strict();
export const taskPatch = z.object({ done: z.boolean(), skippedNote: optText(300) }).strict();

export const evidenceBody = z.object({
  caption: optText(300), capturedAt: date, sha256: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096), sizeBytes: z.number().int().min(1).max(4 * 1024 * 1024),
  thumb: z.object({ sizeBytes: z.number().int().min(1).max(150 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
}).strict();
export const evidencePatch = z.object({ caption: optText(300) }).strict();
export const evidenceRemove = z.object({ reason: z.string().trim().min(5).max(300) }).strict();

const num = (min: number, max: number) => z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(min).max(max));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const csv = <T extends string>(allowed: readonly T[]) => z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.enum(allowed as unknown as [T, ...T[]])).max(allowed.length));
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/);
const filters = {
  q: z.string().trim().min(1).max(80).optional(), status: csv(MAINTENANCE_STATUSES).optional(), type: z.enum(MAINTENANCE_TYPES).optional(), priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  assetId: objectId.optional(), agencyId: objectId.optional(), dateFrom: dateStr.optional(), dateTo: dateStr.optional(), overdue: bool.optional(), mine: bool.optional(),
};
export const maintListQuery = z.object({ ...filters, sort: z.enum(["date_asc", "date_desc", "priority"]).default("date_asc"), page: num(1, 10000).default(1), limit: num(1, 50).default(20) }).strict();
export const maintCalendarQuery = z.object({ ...filters, from: dateStr, to: dateStr }).strict();
export const fileQuery = z.object({ variant: z.enum(["full", "thumb"]).default("full") }).strict();
