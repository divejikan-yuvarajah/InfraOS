/**
 * Step 67 geometry validation and normalization. Pure functions, no I/O: the server is the single
 * source of truth for geometry shape, Sri Lanka bounds and derived metrics.
 */
type Position = [number, number];
export type WorkGeometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] };

export const SRI_LANKA_BOUNDS = { minLng: 79.4, maxLng: 82.1, minLat: 5.8, maxLat: 9.95 } as const;
export const GEO_LIMITS = {
  maxVertices: 500,
  minLineMeters: 5,
  maxLineMeters: 100_000,
  minAreaSqMeters: 10,
  maxAreaSqMeters: 25_000_000,
} as const;

export type GeoIssue = { code: string; message: string };
export type GeoDerived = {
  centroid: Position;
  bbox: [number, number, number, number];
  lengthMeters: number | null;
  areaSqMeters: number | null;
  vertexCount: number;
};
export type GeoResult =
  | { valid: true; geometry: WorkGeometry; derived: GeoDerived; warnings: string[] }
  | { valid: false; errors: GeoIssue[]; warnings: string[] };

const EARTH_RADIUS = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function inBounds([lng, lat]: Position): boolean {
  const b = SRI_LANKA_BOUNDS;
  return lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat;
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function haversine(a: Position, b: Position): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLength(points: Position[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversine(points[i - 1]!, points[i]!);
  return total;
}

/** Signed spherical ring area in lng/lat order (positive = clockwise). */
function signedRingArea(ring: Position[]): number {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const p1 = ring[i]!;
    const p2 = ring[i + 1]!;
    total += rad(p2[0] - p1[0]) * (2 + Math.sin(rad(p1[1])) + Math.sin(rad(p2[1])));
  }
  return (total * EARTH_RADIUS * EARTH_RADIUS) / 2;
}

function orientation(a: Position, b: Position, c: Position): number {
  const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return Math.abs(v) < 1e-15 ? 0 : v > 0 ? 1 : 2;
}

function onSegment(a: Position, b: Position, c: Position): boolean {
  return Math.min(a[0], c[0]) <= b[0] && b[0] <= Math.max(a[0], c[0]) && Math.min(a[1], c[1]) <= b[1] && b[1] <= Math.max(a[1], c[1]);
}

function segmentsIntersect(p1: Position, q1: Position, p2: Position, q2: Position): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(p1, p2, q1)) || (o2 === 0 && onSegment(p1, q2, q1)) || (o3 === 0 && onSegment(p2, p1, q2)) || (o4 === 0 && onSegment(p2, q1, q2));
}

/** True when any two non-adjacent edges of a closed ring touch or cross. */
export function ringSelfIntersects(ring: Position[]): boolean {
  const n = ring.length - 1;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!)) return true;
    }
  }
  return false;
}

function dedupe(points: Position[]): Position[] {
  return points.filter((p, i) => i === 0 || p[0] !== points[i - 1]![0] || p[1] !== points[i - 1]![1]);
}

function derive(geometry: WorkGeometry): GeoDerived {
  const pts: Position[] = geometry.type === "Point" ? [geometry.coordinates] : geometry.type === "LineString" ? geometry.coordinates : geometry.coordinates[0]!.slice(0, -1);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const centroid: Position = [round6(lngs.reduce((a, b) => a + b, 0) / pts.length), round6(lats.reduce((a, b) => a + b, 0) / pts.length)];
  return {
    centroid,
    bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    lengthMeters: geometry.type === "LineString" ? Math.round(pathLength(geometry.coordinates) * 10) / 10 : geometry.type === "Polygon" ? Math.round(pathLength(geometry.coordinates[0]!) * 10) / 10 : null,
    areaSqMeters: geometry.type === "Polygon" ? Math.round(Math.abs(signedRingArea(geometry.coordinates[0]!))) : null,
    vertexCount: pts.length,
  };
}

/** Validates and normalizes one Point, LineString or Polygon. Never trusts client-side metrics. */
export function validateWorkGeometry(input: unknown): GeoResult {
  const errors: GeoIssue[] = [];
  const warnings: string[] = [];
  const bad = (code: string, message: string): GeoResult => ({ valid: false, errors: [...errors, { code, message }], warnings });
  if (!input || typeof input !== "object") return bad("GEOMETRY_REQUIRED", "A geometry is required.");
  const { type, coordinates } = input as { type?: unknown; coordinates?: unknown };
  if (type !== "Point" && type !== "LineString" && type !== "Polygon") {
    return bad("UNSUPPORTED_TYPE", "Only Point, LineString and Polygon are supported.");
  }

  const checkPoints = (points: unknown[]): Position[] | null => {
    if (points.length > GEO_LIMITS.maxVertices + 1) { errors.push({ code: "TOO_MANY_VERTICES", message: `At most ${GEO_LIMITS.maxVertices} vertices are allowed.` }); return null; }
    if (!points.every(isPosition)) { errors.push({ code: "INVALID_COORDINATES", message: "Every coordinate must be a finite [longitude, latitude] pair." }); return null; }
    const rounded = (points as Position[]).map(([lng, lat]) => [round6(lng), round6(lat)] as Position);
    const outside = rounded.filter((p) => !inBounds(p));
    if (outside.length) {
      const swapped = outside.every(([lng, lat]) => inBounds([lat, lng]));
      errors.push(swapped
        ? { code: "COORDINATES_SWAPPED", message: "Coordinates look like [latitude, longitude]. GeoJSON uses [longitude, latitude]." }
        : { code: "OUTSIDE_SRI_LANKA", message: "Every point must be inside Sri Lanka." });
      return null;
    }
    return rounded;
  };

  if (type === "Point") {
    const pts = checkPoints([coordinates]);
    if (!pts) return { valid: false, errors, warnings };
    const geometry: WorkGeometry = { type, coordinates: pts[0]! };
    return { valid: true, geometry, derived: derive(geometry), warnings };
  }

  if (type === "LineString") {
    if (!Array.isArray(coordinates)) return bad("INVALID_COORDINATES", "A line needs a list of coordinates.");
    const raw = checkPoints(coordinates);
    if (!raw) return { valid: false, errors, warnings };
    const pts = dedupe(raw);
    if (pts.length < raw.length) warnings.push(`${raw.length - pts.length} repeated vertex removed.`);
    if (pts.length < 2) return bad("TOO_FEW_VERTICES", "A line needs at least two different points.");
    const length = pathLength(pts);
    if (length < GEO_LIMITS.minLineMeters) return bad("LINE_TOO_SHORT", `A line must be at least ${GEO_LIMITS.minLineMeters} m long.`);
    if (length > GEO_LIMITS.maxLineMeters) return bad("LINE_TOO_LONG", "A line must be at most 100 km long.");
    const geometry: WorkGeometry = { type, coordinates: pts };
    return { valid: true, geometry, derived: derive(geometry), warnings };
  }

  if (!Array.isArray(coordinates) || coordinates.length === 0 || !Array.isArray(coordinates[0])) return bad("INVALID_COORDINATES", "An area needs one ring of coordinates.");
  if (coordinates.length > 1) return bad("HOLES_NOT_SUPPORTED", "Areas with holes are not supported.");
  const raw = checkPoints(coordinates[0] as unknown[]);
  if (!raw) return { valid: false, errors, warnings };
  let ring = dedupe(raw);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring = [...ring, first];
    warnings.push("The area outline was closed automatically.");
  }
  if (ring.length < 4) return bad("TOO_FEW_VERTICES", "An area needs at least three different corners.");
  if (ringSelfIntersects(ring)) return bad("SELF_INTERSECTION", "The area outline crosses itself. Move the corners so the edges do not cross.");
  const signed = signedRingArea(ring);
  // RFC 7946: exterior rings are counter-clockwise.
  if (signed > 0) ring = [...ring].reverse();
  const area = Math.abs(signed);
  if (area < GEO_LIMITS.minAreaSqMeters) return bad("AREA_TOO_SMALL", `An area must be at least ${GEO_LIMITS.minAreaSqMeters} m².`);
  if (area > GEO_LIMITS.maxAreaSqMeters) return bad("AREA_TOO_LARGE", "An area must be at most 25 km².");
  const geometry: WorkGeometry = { type, coordinates: [ring] };
  return { valid: true, geometry, derived: derive(geometry), warnings };
}

export type GeoCandidate = { index: number; label: string; geometry: unknown };

/**
 * Accepts a GeoJSON Geometry, Feature or FeatureCollection. Several supported features are returned as
 * candidates for the user to choose from; nothing is merged and no external reference is followed.
 */
export function extractCandidates(input: unknown): { candidates: GeoCandidate[]; skipped: number } | { error: GeoIssue } {
  if (!input || typeof input !== "object") return { error: { code: "INVALID_GEOJSON", message: "The file is not GeoJSON." } };
  const value = input as { type?: unknown; geometry?: unknown; features?: unknown; properties?: unknown };
  const supported = (g: unknown) => !!g && typeof g === "object" && ["Point", "LineString", "Polygon"].includes(String((g as { type?: unknown }).type));
  const labelOf = (props: unknown, i: number) => {
    const p = props && typeof props === "object" ? (props as Record<string, unknown>) : {};
    const name = [p.name, p.title, p.referenceNo].find((v) => typeof v === "string" && v.trim());
    return typeof name === "string" ? name.trim().slice(0, 80) : `Feature ${i + 1}`;
  };
  if (value.type === "FeatureCollection") {
    if (!Array.isArray(value.features)) return { error: { code: "INVALID_GEOJSON", message: "The collection has no features list." } };
    if (value.features.length > 1000) return { error: { code: "TOO_MANY_FEATURES", message: "The collection has more than 1,000 features." } };
    const candidates: GeoCandidate[] = [];
    value.features.forEach((f: unknown, i: number) => {
      const g = (f as { geometry?: unknown } | null)?.geometry;
      if (supported(g)) candidates.push({ index: i, label: labelOf((f as { properties?: unknown }).properties, i), geometry: g });
    });
    if (!candidates.length) return { error: { code: "UNSUPPORTED_TYPE", message: "No Point, LineString or Polygon feature was found." } };
    return { candidates: candidates.slice(0, 50), skipped: value.features.length - candidates.length };
  }
  if (value.type === "Feature") {
    if (!supported(value.geometry)) return { error: { code: "UNSUPPORTED_TYPE", message: "Only Point, LineString and Polygon features are supported." } };
    return { candidates: [{ index: 0, label: labelOf(value.properties, 0), geometry: value.geometry }], skipped: 0 };
  }
  if (supported(value)) return { candidates: [{ index: 0, label: String(value.type), geometry: value }], skipped: 0 };
  return { error: { code: "UNSUPPORTED_TYPE", message: "Only Point, LineString and Polygon are supported (not MultiPolygon or GeometryCollection)." } };
}
