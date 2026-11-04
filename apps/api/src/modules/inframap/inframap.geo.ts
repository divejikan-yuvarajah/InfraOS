import { z } from "zod";

import { validGeometry } from "../../shared/database/geometry.js";

export type Bbox = [number, number, number, number];
export type LayerFeature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };
export type LayerCollection = { type: "FeatureCollection"; truncated: boolean; features: LayerFeature[] };

/** One layer never returns more than this many features; the response says so when it cut. */
export const LAYER_FEATURE_CAP = 250;
/** Widest viewport a client may ask for, in degrees. Sri Lanka is about 2.5 by 4.5; this keeps a world-sized box out. */
export const MAX_BBOX_SPAN_DEG = 10;
const COORDINATE_DECIMALS = 6;

/** `bbox=west,south,east,north` is required, finite, inside lon/lat range, ordered, and not wider than MAX_BBOX_SPAN_DEG. */
export const bboxQuerySchema = z
  .object({
    bbox: z
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
      }),
  })
  .strict();

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
