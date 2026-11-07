import { z } from "zod";

import { objectId, reasonText, text } from "../contractors/contractor.schema.js";
import { ASSET_CONDITIONS, ASSET_OPERATIONAL_STATUSES, ASSET_TYPES, CONVERSION_STATUSES, ISSUE_SEVERITIES, ISSUE_STATUSES, KNOWN_CONDITIONS, MONITORING_MAX_DAYS, MONITORING_MIN_DAYS } from "./asset.constants.js";

const optText = (max: number) => z.string().trim().max(max).optional();
const date = z.coerce.date();
const key = z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/);
const designLife = z.number().int().min(1).max(150);
const interval = z.number().int().min(MONITORING_MIN_DAYS).max(MONITORING_MAX_DAYS);

const location = z.object({ district: optText(100), province: optText(100), locality: optText(120), roadName: optText(160), description: optText(300) }).strict();
const proposedAsset = z.object({
  key, assetType: z.enum(ASSET_TYPES), name: text(200), description: optText(2000), location: location.optional(), geometrySource: z.enum(["PROJECT", "NONE"]).default("NONE"),
  commissionedAt: date.optional(), designLifeYears: designLife.optional(), monitoringIntervalDays: interval.optional(),
}).strict();

export const conversionBody = z.object({
  projectId: objectId, receivingAgencyId: objectId.optional(),
  handover: z.object({ handoverDate: date, handoverNote: optText(2000), defectsLiabilityEndsOn: date.optional(), documentIds: z.array(objectId).max(20).default([]), conditionAtHandover: z.enum(ASSET_CONDITIONS).default("UNKNOWN") }).strict(),
  proposedAssets: z.array(proposedAsset).min(1).max(10), acknowledgeWarnings: z.boolean().optional(),
}).strict().refine((b) => new Set(b.proposedAssets.map((a) => a.key)).size === b.proposedAssets.length && new Set(b.proposedAssets.map((a) => a.name.toLowerCase())).size === b.proposedAssets.length, "duplicate asset key or name");
export const decideBody = z.object({ note: reasonText.optional() }).strict();
export const rejectBody = z.object({ note: reasonText }).strict();
export const previewQuery = z.object({ projectId: objectId, receivingAgencyId: objectId.optional() }).strict();

export const addAssetBody = z.object({ projectId: objectId, asset: proposedAsset, reason: reasonText }).strict();
export const patchAssetBody = z.object({
  version: z.number().int().min(0), name: text(200).optional(), description: optText(2000), location: location.optional(), designLifeYears: designLife.optional(),
  monitoringIntervalDays: interval.optional(), defectsLiabilityEndsOn: date.nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 1, "nothing to update");
export const statusBody = z.object({ version: z.number().int().min(0), status: z.enum(ASSET_OPERATIONAL_STATUSES), reason: reasonText.optional() }).strict();

const issue = z.object({ key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/), title: text(160), severity: z.enum(ISSUE_SEVERITIES), status: z.enum(ISSUE_STATUSES), location: optText(200) }).strict();
export const assessmentBody = z.object({
  assessedAt: date, condition: z.enum(KNOWN_CONDITIONS), observations: z.string().trim().min(20).max(2000), issues: z.array(issue).max(20).default([]),
  maintenanceRefs: z.array(objectId).max(20).default([]), reason: reasonText,
}).strict();

const num = (min: number, max: number) => z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(min).max(max));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const csv = <T extends string>(allowed: readonly T[]) => z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.enum(allowed as unknown as [T, ...T[]])).max(allowed.length));

export const assetListQuery = z.object({
  q: z.string().trim().min(1).max(80).optional(), assetType: csv(ASSET_TYPES).optional(), condition: csv(ASSET_CONDITIONS).optional(), operationalStatus: csv(ASSET_OPERATIONAL_STATUSES).optional(),
  agencyId: objectId.optional(), projectId: objectId.optional(), district: z.string().trim().min(1).max(80).optional(), attention: bool.optional(), healthBand: csv(["GOOD", "WATCH", "POOR", "CRITICAL", "NONE"] as const).optional(),
  hasOpenMaintenance: bool.optional(), dlp: bool.optional(), sort: z.enum(["name", "condition", "health", "nextMaintenance", "recent"]).default("recent"), page: num(1, 10000).default(1), limit: num(1, 50).default(20),
}).strict();
export const timelineQuery = z.object({ cursor: z.string().max(60).optional(), source: z.enum(["project", "inspection", "conversion", "assessment", "maintenance", "status"]).optional(), limit: num(1, 50).default(25) }).strict();
export const conversionListQuery = z.object({ status: csv(CONVERSION_STATUSES).optional(), projectId: objectId.optional(), agencyId: objectId.optional(), page: num(1, 10000).default(1), limit: num(1, 50).default(20) }).strict();
export const exportQuery = assetListQuery.omit({ page: true, limit: true, sort: true });
export const convertibleQuery = z.object({ q: z.string().trim().min(1).max(80).optional() }).strict();
