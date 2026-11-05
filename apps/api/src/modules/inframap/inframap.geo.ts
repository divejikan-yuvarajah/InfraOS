import { z } from "zod";

import { ASSET_CONDITIONS } from "../assets/asset.constants.js";
import { HAZARD_LEVELS, HAZARD_TYPES } from "../risk/hazard.constants.js";
import { ASSET_LAYER_TYPES, UTILITY_TYPES } from "./inframap.access.js";

import { validGeometry } from "../../shared/database/geometry.js";

export type Bbox = [number, number, number, number];
export type LayerFeature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };
export type LayerCollection = { type: "FeatureCollection"; truncated: boolean; features: LayerFeature[]; generatedAt?: string; restrictedHidden?: number; hasDemo?: boolean };

/** One layer never returns more than this many features; the response says so when it cut. */
export const LAYER_FEATURE_CAP = 250;
/** Widest viewport a client may ask for, in degrees. Sri Lanka is about 2.5 by 4.5; this keeps a world-sized box out. */
export const MAX_BBOX_SPAN_DEG = 10;
const COORDINATE_DECIMALS = 6;

const bboxField = z
  .string()
  .max(120)
  .transform((value, ctx) => {
        const n = value.split(",").map((part) => (part.trim() === "" ? Number.NaN : Number(part)));
        const [west, south, east, north] = n;
        if (
          n.length !== 4 || n.some((x) => !Number.isFinite(x)) ||
          west! >= east! || south! >= north! ||
          Math.abs(west!) > 180 || Math.abs(east!) > 180 || Math.abs(south!) > 90 || Math.abs(north!) > 90 ||
          east! - west! > MAX_BBOX_SPAN_DEG || north! - south! > MAX_BBOX_SPAN_DEG
        ) {
          ctx.addIssue({ code: "custom", message: "bbox" });
          return z.NEVER;
        }
        return n as Bbox;
      });

/** `bbox=west,south,east,north` is required, finite, inside lon/lat range, ordered, and not wider than MAX_BBOX_SPAN_DEG. */
export const bboxQuerySchema = z.object({ bbox: bboxField }).strict();

export const PROJECT_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED"] as const;
export const PROJECT_TYPES = ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "MULTI_INFRASTRUCTURE", "OTHER"] as const;
export const WORK_STATUSES = ["DRAFT", "SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const BANDS = ["info", "low", "medium", "high", "critical"] as const;

/** Per-layer filters are closed enums or "1"; anything else is a 400. Applied on the server so the browser never receives rows it filtered out. */
export const layerQuerySchemas = {
  projects: z.object({ bbox: bboxField, status: z.enum(PROJECT_STATUSES).optional(), projectType: z.enum(PROJECT_TYPES).optional() }).strict(),
  roadworks: z.object({ bbox: bboxField, status: z.enum(WORK_STATUSES).optional(), overdue: z.literal("1").optional() }).strict(),
  conflicts: z.object({ bbox: bboxField, band: z.enum(BANDS).optional(), group: z.enum(["open", "closed"]).optional() }).strict(),
  assets: z.object({ bbox: bboxField, assetType: z.enum(ASSET_LAYER_TYPES).optional(), condition: z.enum(ASSET_CONDITIONS).optional(), attention: z.literal("1").optional() }).strict(),
  utilities: z.object({ bbox: bboxField, assetType: z.enum(UTILITY_TYPES).optional() }).strict(),
  risks: z.object({ bbox: bboxField, hazardType: z.enum(HAZARD_TYPES).optional(), level: z.enum(HAZARD_LEVELS).optional(), kind: z.enum(["hazard", "project"]).optional(), projectLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional() }).strict(),
};

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const FOCAL_LAYERS = ["projects", "roadworks", "conflicts", "assets", "utilities", "risks"] as const;
export const NEARBY_RADII = ["50", "100", "250", "500"] as const;
/** Exposure for one feature (feature to zones) or one zone (zone to records). No client geometry is ever accepted. */
export const exposureQuerySchema = z.object({ layer: z.enum(FOCAL_LAYERS), id: objectId }).strict();
export const nearbyQuerySchema = z.object({
  featureLayer: z.enum(FOCAL_LAYERS), featureId: objectId, radiusM: z.enum(NEARBY_RADII),
  layers: z.string().max(40).optional().transform((v) => (v ? v.split(",") : ["assets", "utilities", "risks"])).pipe(z.array(z.enum(["assets", "utilities", "risks"])).min(1).max(3)),
}).strict();
export const featureParamsSchema = z.object({ layer: z.enum(["assets", "utilities", "risks"]), id: objectId }).strict();

const R_LAT = 111_320;
/** Approximate envelope: the geometry's bbox grown by radiusM on every side (metres to degrees at the bbox latitude). */
export function envelopeAround(bounds: [number, number, number, number], radiusM: number): [number, number, number, number] {
  const [w, s, e, n] = bounds;
  const dLat = radiusM / R_LAT;
  const dLon = radiusM / (R_LAT * Math.max(0.2, Math.cos((((s + n) / 2) * Math.PI) / 180)));
  return [w - dLon, s - dLat, e + dLon, n + dLat];
}
export function geometryBounds(geometry: { coordinates?: unknown } | null | undefined): [number, number, number, number] | null {
  const pts: number[][] = [];
  const walk = (c: unknown) => { if (Array.isArray(c) && typeof c[0] === "number") pts.push(c as number[]); else if (Array.isArray(c)) c.forEach(walk); };
  walk(geometry?.coordinates);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]!), ys = pts.map((p) => p[1]!);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Derived, never stored: a roadwork whose planned end has passed while it is still open. */
export function isOverdueWork(status: unknown, plannedEnd: unknown, now = new Date()): boolean {
  if (status === "COMPLETED" || status === "CANCELLED" || !plannedEnd) return false;
  const end = new Date(plannedEnd as string | number | Date).getTime();
  return Number.isFinite(end) && end < now.getTime();
}

export function viewportPolygon([west, south, east, north]: Bbox) {
  return { type: "Polygon" as const, coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] };
}

function round(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toFixed(COORDINATE_DECIMALS));
  if (Array.isArray(value)) return value.map(round);
  return value;
}

/** Transport copy of a stored geometry: structurally valid GeoJSON with coordinates rounded to about 10 cm, or null. */
export function transportGeometry(geometry: unknown): { type: string; coordinates: unknown } | null {
  if (!validGeometry(geometry)) return null;
  const { type, coordinates } = geometry as { type: string; coordinates: unknown };
  return { type, coordinates: round(coordinates) };
}

/** Builds the response. Features with a missing or invalid geometry are dropped instead of failing the whole layer. */
export function layerCollection(items: { geometry: unknown; properties: Record<string, unknown> }[], truncated: boolean): LayerCollection {
  const features: LayerFeature[] = [];
  for (const item of items.slice(0, LAYER_FEATURE_CAP)) {
    const geometry = transportGeometry(item.geometry);
    if (geometry) features.push({ type: "Feature", geometry, properties: item.properties });
  }
  return { type: "FeatureCollection", truncated: truncated || items.length > LAYER_FEATURE_CAP, features };
}
