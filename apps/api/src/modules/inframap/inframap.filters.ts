import mongoose from "mongoose";
import { z } from "zod";

import { ASSET_CONDITIONS } from "../assets/asset.constants.js";
import { HAZARD_LEVELS, HAZARD_TYPES } from "../risk/hazard.constants.js";
import { WORK_TYPES } from "../roadsync/roadsync.constants.js";
import { DISTRICT_NAMES, PROVINCE_NAMES } from "./gazetteer.js";
import { ASSET_LAYER_TYPES, UTILITY_CLASS, UTILITY_TYPES } from "./inframap.access.js";
import { BANDS, bboxField, PROJECT_STATUSES, PROJECT_TYPES, WORK_STATUSES, type Bbox } from "./inframap.geo.js";

/**
 * Unified filter contract shared by every layer endpoint, /search and /facets.
 *
 * Semantics: values inside one facet are OR (comma separated, at most 12); different facets are AND. A filter that does
 * not apply to a layer never hides that layer (projectStatus only narrows projects). agencyId, province, district and
 * the date range apply to every layer that has the field. Date ranges use OVERLAP semantics: a record matches when its
 * [start, end] intersects [dateFrom, dateTo]. Older single-value names (status, band, group, level, projectLevel,
 * overdue=1, attention=1) keep working per layer and are mapped onto the unified names.
 */
export type LayerId = "projects" | "roadworks" | "conflicts" | "assets" | "utilities" | "risks";
export const LAYER_IDS: readonly LayerId[] = ["projects", "roadworks", "conflicts", "assets", "utilities", "risks"];

const MAX_VALUES = 12;
const MAX_RANGE_DAYS = 5 * 366;
const ASSET_TYPES_ALL = [...ASSET_LAYER_TYPES, ...UTILITY_TYPES] as const;
const UTILITY_CLASSES = ["water", "drainage", "electricity", "telecom"] as const;
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

const csv = (item: z.ZodType) =>
  z.string().max(400).transform((s) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))]).pipe(z.array(item).min(1).max(MAX_VALUES) as unknown as z.ZodType<string[], string[]>);
const flag = z.enum(["1", "true"]).transform(() => true as const);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "date");

/** The unified filters, as a zod raw shape so every endpoint schema can spread it. */
export const unifiedFilterShape = {
  agencyId: csv(objectId).optional(),
  province: csv(z.enum(PROVINCE_NAMES)).optional(),
  district: csv(z.enum(DISTRICT_NAMES)).optional(),
  projectStatus: csv(z.enum(PROJECT_STATUSES)).optional(),
  projectType: csv(z.enum(PROJECT_TYPES)).optional(),
  roadworkStatus: csv(z.enum(WORK_STATUSES)).optional(),
  workType: csv(z.enum(WORK_TYPES)).optional(),
  overdue: flag.optional(),
  dateFrom: isoDay.optional(),
  dateTo: isoDay.optional(),
  conflictBand: csv(z.enum(BANDS)).optional(),
  conflictStatusGroup: z.enum(["open", "resolved", "all"]).optional(),
  recordType: csv(z.enum(["conflict", "opportunity"])).optional(),
  assetType: csv(z.enum(ASSET_TYPES_ALL)).optional(),
  condition: csv(z.enum(ASSET_CONDITIONS)).optional(),
  attention: flag.optional(),
  utilityClass: csv(z.enum(UTILITY_CLASSES)).optional(),
  hazardType: csv(z.enum(HAZARD_TYPES)).optional(),
  hazardLevel: csv(z.enum(HAZARD_LEVELS)).optional(),
  riskBand: csv(z.enum(["LOW", "MEDIUM", "HIGH"])).optional(),
};

/** Per-layer legacy names from Batches 01 and 02, still accepted. */
const legacyShape = {
  projects: { status: z.enum(PROJECT_STATUSES).optional() },
  roadworks: { status: z.enum(WORK_STATUSES).optional() },
  conflicts: { band: z.enum(BANDS).optional(), group: z.enum(["open", "closed"]).optional() },
  assets: {},
  utilities: {},
  risks: { level: z.enum(HAZARD_LEVELS).optional(), kind: z.enum(["hazard", "project"]).optional(), projectLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional() },
} as const;

/** Viewport controls shared by all layer endpoints. */
export const LAYER_DEFAULT_LIMIT = 500;
export const LAYER_MAX_LIMIT = 1000;
const viewportShape = {
  bbox: bboxField,
  zoom: z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(0).max(22)).optional(),
  limit: z.string().regex(/^\d{1,4}$/).transform(Number).pipe(z.number().int().min(1).max(LAYER_MAX_LIMIT)).optional(),
  fields: z.enum(["min", "full"]).optional(),
};

export const layerSchemas = Object.fromEntries(
  LAYER_IDS.map((id) => [id, z.object({ ...viewportShape, ...unifiedFilterShape, ...legacyShape[id] }).strict()]),
) as unknown as Record<LayerId, z.ZodObject>;

/** Normalised filters used by the services: arrays for multi-value facets, Dates for the range. */
export type NF = {
  agencyId: string[]; province: string[]; district: string[]; projectStatus: string[]; projectType: string[]; roadworkStatus: string[]; workType: string[];
  overdue: boolean; dateFrom?: Date; dateTo?: Date; conflictBand: string[]; conflictStatusGroup: "open" | "resolved" | "all"; recordType: string[];
  assetType: string[]; condition: string[]; attention: boolean; utilityClass: string[]; hazardType: string[]; hazardLevel: string[]; riskBand: string[]; kind?: "hazard" | "project";
};
export const EMPTY_NF = (): NF => ({
  agencyId: [], province: [], district: [], projectStatus: [], projectType: [], roadworkStatus: [], workType: [], overdue: false, conflictBand: [], conflictStatusGroup: "all",
  recordType: [], assetType: [], condition: [], attention: false, utilityClass: [], hazardType: [], hazardLevel: [], riskBand: [],
});

export type LayerQ = { nf: NF; limit: number; zoom: number | null; fields: "min" | "full"; bbox?: Bbox };
type Raw = Record<string, unknown>;
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Maps a parsed (unified + legacy) query onto NF, or returns an error message for an invalid combination. */
export function normalizeFilters(layer: LayerId | null, p: Raw): { ok: true; nf: NF } | { ok: false } {
  const nf = EMPTY_NF();
  for (const k of ["agencyId", "province", "district", "projectStatus", "projectType", "roadworkStatus", "workType", "conflictBand", "recordType", "assetType", "condition", "utilityClass", "hazardType", "hazardLevel", "riskBand"] as const) nf[k] = arr(p[k]);
  nf.overdue = p.overdue === true;
  nf.attention = p.attention === true;
  if (p.conflictStatusGroup) nf.conflictStatusGroup = p.conflictStatusGroup as NF["conflictStatusGroup"];
  // legacy aliases
  if (typeof p.status === "string") { if (layer === "projects") nf.projectStatus = [...new Set([...nf.projectStatus, p.status])]; if (layer === "roadworks") nf.roadworkStatus = [...new Set([...nf.roadworkStatus, p.status])]; }
  if (typeof p.band === "string") nf.conflictBand = [...new Set([...nf.conflictBand, p.band])];
  if (p.group === "open") nf.conflictStatusGroup = "open";
  if (p.group === "closed") nf.conflictStatusGroup = "resolved";
  if (typeof p.level === "string") nf.hazardLevel = [...new Set([...nf.hazardLevel, p.level])];
  if (typeof p.projectLevel === "string") nf.riskBand = [...new Set([...nf.riskBand, p.projectLevel])];
  if (p.kind === "hazard" || p.kind === "project") nf.kind = p.kind;
  if (typeof p.dateFrom === "string") nf.dateFrom = new Date(`${p.dateFrom}T00:00:00.000Z`);
  if (typeof p.dateTo === "string") nf.dateTo = new Date(`${p.dateTo}T23:59:59.999Z`);
  if (nf.dateFrom && nf.dateTo) {
    if (nf.dateFrom.getTime() > nf.dateTo.getTime()) return { ok: false };
    if ((nf.dateTo.getTime() - nf.dateFrom.getTime()) / 86_400_000 > MAX_RANGE_DAYS) return { ok: false };
  }
  return { ok: true, nf };
}

export function parseLayerQuery(layer: LayerId, query: unknown): { ok: true; q: LayerQ & { bbox: Bbox } } | { ok: false } {
  if (Object.values((query ?? {}) as Raw).some((v) => Array.isArray(v))) return { ok: false };
  const parsed = layerSchemas[layer].safeParse(query);
  if (!parsed.success) return { ok: false };
  const data = parsed.data as Raw;
  const norm = normalizeFilters(layer, data);
  if (!norm.ok) return { ok: false };
  return { ok: true, q: { nf: norm.nf, bbox: data.bbox as Bbox, limit: (data.limit as number | undefined) ?? LAYER_DEFAULT_LIMIT, zoom: (data.zoom as number | undefined) ?? null, fields: (data.fields as "min" | "full" | undefined) ?? "min" } };
}

// ---------- Mongo fragments (one builder per layer; /search and /facets reuse them) ----------

const oids = (ids: string[]) => ids.map((id) => new mongoose.Types.ObjectId(id));
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export { escapeRegex };
/** Exact, case-insensitive, fully escaped name match for canonical province/district strings. */
const names = (values: string[]) => values.map((v) => new RegExp(`^${escapeRegex(v)}$`, "i"));
const CLOSED = ["resolved", "dismissed", "auto_closed", "withdrawn"] as const;
export { CLOSED as CLOSED_CONFLICT_STATUSES_SERVER };

const dateOverlap = (start: string, end: string, nf: NF): Record<string, unknown>[] => [
  ...(nf.dateFrom ? [{ [end]: { $gte: nf.dateFrom } }] : []),
  ...(nf.dateTo ? [{ [start]: { $lte: nf.dateTo } }] : []),
];
const andOf = (parts: Record<string, unknown>[]): Record<string, unknown> => (parts.length ? { $and: parts } : {});

export function projectNarrow(nf: NF, omit?: keyof NF): Record<string, unknown> {
  const p: Record<string, unknown>[] = [];
  if (omit !== "agencyId" && nf.agencyId.length) p.push({ agencyId: { $in: oids(nf.agencyId) } });
  if (omit !== "province" && nf.province.length) p.push({ "location.province": { $in: names(nf.province) } });
  if (omit !== "district" && nf.district.length) p.push({ "location.district": { $in: names(nf.district) } });
  if (omit !== "projectStatus" && nf.projectStatus.length) p.push({ status: { $in: nf.projectStatus } });
  if (omit !== "projectType" && nf.projectType.length) p.push({ projectType: { $in: nf.projectType } });
  p.push(...dateOverlap("startDate", "plannedEndDate", nf));
  return andOf(p);
}

/** Work requests have no place of their own: province/district resolve through `projectIds` (computed by the caller from the project location). */
export function roadworkNarrow(nf: NF, projectIds: mongoose.Types.ObjectId[] | null, omit?: keyof NF): Record<string, unknown> {
  const p: Record<string, unknown>[] = [];
  if (omit !== "agencyId" && nf.agencyId.length) p.push({ agencyId: { $in: oids(nf.agencyId) } });
  if (projectIds) p.push({ projectId: { $in: projectIds } });
  if (omit !== "roadworkStatus" && nf.roadworkStatus.length) p.push({ status: { $in: nf.roadworkStatus } });
  if (omit !== "workType" && nf.workType.length) p.push({ workType: { $in: nf.workType } });
  if (nf.overdue) p.push({ plannedEnd: { $lt: new Date() }, status: { $nin: ["COMPLETED", "CANCELLED"] } });
  p.push(...dateOverlap("plannedStart", "plannedEnd", nf));
  return andOf(p);
}

export function conflictNarrow(nf: NF, omit?: keyof NF): Record<string, unknown> {
  const p: Record<string, unknown>[] = [{ recordType: omit === "recordType" || !nf.recordType.length ? (omit === "recordType" ? { $in: ["conflict", "opportunity"] } : "conflict") : { $in: nf.recordType } }];
  if (omit !== "agencyId" && nf.agencyId.length) p.push({ agencyIds: { $in: oids(nf.agencyId) } });
  if (omit !== "district" && nf.district.length) p.push({ district: { $in: names(nf.district) } });
  if (omit !== "conflictBand" && nf.conflictBand.length) p.push({ "severity.current.band": { $in: nf.conflictBand } });
  if (omit !== "conflictStatusGroup" && nf.conflictStatusGroup !== "all") p.push({ status: nf.conflictStatusGroup === "resolved" ? { $in: [...CLOSED] } : { $nin: [...CLOSED] } });
  p.push(...dateOverlap("overlapWindow.start", "overlapWindow.end", nf));
  return andOf(p);
}

/** Effective asset types for a layer: the layer's own set, narrowed by assetType and utilityClass (AND across facets). null = nothing can match. */
export function effectiveAssetTypes(layer: "assets" | "utilities", nf: NF, omit?: keyof NF): string[] | null {
  let types: string[] = layer === "assets" ? [...ASSET_LAYER_TYPES] : [...UTILITY_TYPES];
  if (omit !== "assetType" && nf.assetType.length) types = types.filter((t) => nf.assetType.includes(t));
  if (layer === "utilities" && omit !== "utilityClass" && nf.utilityClass.length) types = types.filter((t) => nf.utilityClass.includes(UTILITY_CLASS[t]!));
  return types.length ? types : null;
}

export function assetNarrow(layer: "assets" | "utilities", nf: NF, ownIds: mongoose.Types.ObjectId[], platform: boolean, omit?: keyof NF): Record<string, unknown> {
  const types = effectiveAssetTypes(layer, nf, omit);
  if (!types) return { _id: { $in: [] } };
  const p: Record<string, unknown>[] = [{ assetType: { $in: types } }];
  if (omit !== "agencyId" && nf.agencyId.length) p.push({ agencyId: { $in: oids(nf.agencyId) } });
  if (omit !== "province" && nf.province.length) p.push({ "location.province": { $in: names(nf.province) } });
  if (omit !== "district" && nf.district.length) p.push({ "location.district": { $in: names(nf.district) } });
  if (layer === "assets" && omit !== "condition" && nf.condition.length) p.push({ condition: { $in: nf.condition } });
  if (layer === "assets" && nf.attention) {
    // Attention reasons are disclosed only at FULL tier, so the filter may only match the viewer's own assets.
    const now = new Date(), yearAgo = new Date(now.getTime() - 365 * 86_400_000);
    p.push({ $or: [{ condition: { $in: ["POOR", "CRITICAL"] } }, { nextMaintenanceAt: { $lt: now } }, { lastInspectionAt: { $lt: yearAgo } }, { lastInspectionAt: null, commissionedAt: { $lt: yearAgo } }] });
    if (!platform) p.push({ agencyId: { $in: ownIds } });
  }
  return andOf(p);
}

/** Hazard zones carry no province/district and no dates, so only type, level and agency narrow them. */
export function hazardNarrow(nf: NF, omit?: keyof NF): Record<string, unknown> {
  const p: Record<string, unknown>[] = [];
  if (omit !== "agencyId" && nf.agencyId.length) p.push({ agencyId: { $in: oids(nf.agencyId) } });
  if (omit !== "hazardType" && nf.hazardType.length) p.push({ hazardType: { $in: nf.hazardType } });
  if (omit !== "hazardLevel" && nf.hazardLevel.length) p.push({ level: { $in: nf.hazardLevel } });
  return andOf(p);
}
