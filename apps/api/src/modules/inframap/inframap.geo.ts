import { z } from "zod";


import { validGeometry } from "../../shared/database/geometry.js";

export type Bbox = [number, number, number, number];
export type LayerFeature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };
export type LayerCollection = { type: "FeatureCollection"; truncated: boolean; features: LayerFeature[]; generatedAt?: string; restrictedHidden?: number; hasDemo?: boolean; total?: number; totalIsEstimate?: boolean };

/** One layer never returns more than this many features; the response says so when it cut. */
export const LAYER_FEATURE_CAP = 500;
/** Widest viewport a client may ask for, in degrees. Sri Lanka is about 2.5 by 4.5; this keeps a world-sized box out. */
export const MAX_BBOX_SPAN_DEG = 10;
const COORDINATE_DECIMALS = 6;

export const bboxField = z
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

function round(value: unknown, decimals = COORDINATE_DECIMALS): unknown {
  if (typeof value === "number") return Number(value.toFixed(decimals));
  if (Array.isArray(value)) return value.map((v) => round(v, decimals));
  return value;
}

/** Transport copy of a stored geometry: structurally valid GeoJSON with coordinates rounded to about 10 cm, or null. */
export function transportGeometry(geometry: unknown): { type: string; coordinates: unknown } | null {
  if (!validGeometry(geometry)) return null;
  const { type, coordinates } = geometry as { type: string; coordinates: unknown };
  return { type, coordinates: round(coordinates) };
}

type Pos = number[];
function perpendicular(p: Pos, a: Pos, b: Pos): number {
  const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!);
  const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / len));
  return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
}
/** Douglas-Peucker on one coordinate list; always keeps the first and last vertex. Iterative, so a 10 000-vertex line cannot overflow the stack. */
export function simplifyLine(points: Pos[], tolerance: number): Pos[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let far = -1, max = tolerance;
    for (let i = lo + 1; i < hi; i += 1) { const d = perpendicular(points[i]!, points[lo]!, points[hi]!); if (d > max) { max = d; far = i; } }
    if (far >= 0) { keep[far] = true; stack.push([lo, far], [far, hi]); }
  }
  return points.filter((_, i) => keep[i]);
}

/** Roughly 1.5 screen pixels at the given zoom, in degrees. */
export const toleranceForZoom = (zoom: number): number => (1.5 * 360) / (256 * 2 ** zoom);

export type ShapeOptions = { zoom: number | null };
const BELOW_POINT_ZOOM = 7;

/**
 * Zoom-aware transport geometry. Coordinates are rounded to 6 decimals (about 10 cm), or 5 below zoom 12; lines and
 * rings are simplified with a pixel-scaled tolerance; very large polygons collapse to a representative point below
 * zoom 7 (the full ring is served by the detail endpoint for the selected feature). Stored data is never altered.
 */
export function shapedGeometry(geometry: unknown, opts: ShapeOptions): { type: string; coordinates: unknown } | null {
  if (!validGeometry(geometry)) return null;
  const g = geometry as { type: string; coordinates: unknown };
  const zoom = opts.zoom;
  if (zoom === null) return transportGeometry(g);
  const decimals = zoom < 12 ? 5 : COORDINATE_DECIMALS;
  const tol = toleranceForZoom(zoom);
  if (g.type === "Point") return { type: "Point", coordinates: round(g.coordinates, decimals) };
  if (g.type === "LineString") {
    const line = simplifyLine(g.coordinates as Pos[], tol);
    return { type: "LineString", coordinates: round(line.length >= 2 ? line : (g.coordinates as Pos[]).slice(0, 2), decimals) };
  }
  const bounds = geometryBounds(g);
  if (zoom < BELOW_POINT_ZOOM && bounds) return { type: "Point", coordinates: round([(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], decimals) };
  const rings = (g.coordinates as Pos[][]).map((ring) => {
    const simple = simplifyLine(ring, tol);
    return simple.length >= 4 ? simple : ring;
  });
  return { type: "Polygon", coordinates: round(rings, decimals) };
}

/**
 * `fields=min` keeps only what rendering, hover and the overlap chooser need. Everything else comes from the detail
 * endpoint, so list payloads stay small. Each entry lists the properties dropped from the minimal response.
 */
export const MIN_DROP: Record<string, readonly string[]> = {
  projects: ["startDate", "plannedEndDate", "district", "province"],
  roadworks: ["plannedStart", "plannedEnd", "priority", "riskIndex"],
  conflicts: ["overlapStart", "overlapEnd", "resolutionState", "district"],
  assets: ["roadName", "lastInspectionAt", "nextMaintenanceAt", "healthScore", "attentionReasons", "sourceProjectId", "sourceProjectTitle", "district", "province"],
  utilities: ["roadName", "lastInspectionAt", "nextMaintenanceAt", "healthScore", "attentionReasons", "sourceProjectId", "sourceProjectTitle", "district", "province"],
  risks: ["description", "source", "latestAssessedAt", "modelVersion", "agencyName"],
};

export type CollectionOptions = { limit?: number; zoom?: number | null; fields?: "min" | "full"; layer?: string };

/** Builds the response. Features with a missing or invalid geometry are dropped instead of failing the whole layer. */
export function layerCollection(items: { geometry: unknown; properties: Record<string, unknown> }[], truncated: boolean, opts: CollectionOptions = {}): LayerCollection {
  const limit = opts.limit ?? LAYER_FEATURE_CAP;
  const drop = opts.fields === "full" || !opts.layer ? [] : MIN_DROP[opts.layer] ?? [];
  const features: LayerFeature[] = [];
  for (const item of items.slice(0, limit)) {
    const geometry = shapedGeometry(item.geometry, { zoom: opts.zoom ?? null });
    if (!geometry) continue;
    const properties = drop.length ? Object.fromEntries(Object.entries(item.properties).filter(([k]) => !drop.includes(k))) : item.properties;
    features.push({ type: "Feature", geometry, properties });
  }
  return { type: "FeatureCollection", truncated: truncated || items.length > limit, features };
}
