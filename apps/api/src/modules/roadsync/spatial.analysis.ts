/**
 * Step 68 pure spatial analysis. No I/O. Coordinates are [lng, lat]; geometry is projected to a local
 * equirectangular plane in meters (error well under 0.1 % at Sri Lankan distances and corridor scales).
 */
import { DETECTION } from "./roadsync.constants.js";

type Pos = [number, number];
type Pt = [number, number];
type Seg = [Pt, Pt];
export type AnyGeometry = { type: string; coordinates: unknown };
export type SpatialSide = { geometry: AnyGeometry; bufferMeters: number };
export type SpatialRelation = "intersecting" | "footprint_overlap" | "adjacent" | "nearby" | "none";
export type SpatialResult = {
  distanceMeters: number;
  relation: SpatialRelation;
  intersects: boolean;
  footprintOverlap: boolean;
  footprintGapMeters: number;
  sharedLengthMeters: number;
  sharedPctOfA: number | null;
  sharedPctOfB: number | null;
  closestPoints: [Pos, Pos] | null;
};

const EARTH = 6_371_008.8;
const K = (Math.PI / 180) * EARTH;

type Shape = { kind: "Point" | "LineString" | "Polygon"; segs: Seg[]; ring: Pt[] | null; verts: Pt[]; bbox: [number, number, number, number] };
type Projection = { fwd: (p: Pos) => Pt; inv: (p: Pt) => Pos };

function projection(lat0: number): Projection {
  const cx = Math.cos((lat0 * Math.PI) / 180);
  return { fwd: (p) => [p[0] * K * cx, p[1] * K], inv: (q) => [q[0] / (K * cx), q[1] / K] };
}

function flatten(g: AnyGeometry): Pos[] {
  return g.type === "Point" ? [g.coordinates as Pos] : g.type === "LineString" ? (g.coordinates as Pos[]) : ((g.coordinates as Pos[][])[0] ?? []);
}

function shapeOf(g: AnyGeometry, proj: Projection): Shape {
  const kind = g.type as Shape["kind"];
  const pts = flatten(g).map(proj.fwd);
  const ring = kind === "Polygon" ? pts : null;
  const segs: Seg[] = [];
  if (pts.length === 1) segs.push([pts[0]!, pts[0]!]);
  for (let i = 1; i < pts.length; i += 1) segs.push([pts[i - 1]!, pts[i]!]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { kind, segs, ring, verts: pts, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}
function within(a: Pt, b: Pt, p: Pt): boolean {
  return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
}
function segmentsCross([p1, q1]: Seg, [p2, q2]: Seg): boolean {
  const d1 = cross(p2, q2, p1);
  const d2 = cross(p2, q2, q1);
  const d3 = cross(p1, q1, p2);
  const d4 = cross(p1, q1, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && within(p2, q2, p1)) || (d2 === 0 && within(p2, q2, q1)) || (d3 === 0 && within(p1, q1, p2)) || (d4 === 0 && within(p1, q1, q2));
}

function closestOnSeg(p: Pt, [a, b]: Seg): { pt: Pt; d: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const pt: Pt = [a[0] + t * dx, a[1] + t * dy];
  return { pt, d: Math.hypot(p[0] - pt[0], p[1] - pt[1]) };
}

function inRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function segBox(s: Seg): [number, number, number, number] {
  return [Math.min(s[0][0], s[1][0]), Math.min(s[0][1], s[1][1]), Math.max(s[0][0], s[1][0]), Math.max(s[0][1], s[1][1])];
}
function boxGap(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(Math.max(0, a[0]! - b[2]!, b[0]! - a[2]!), Math.max(0, a[1]! - b[3]!, b[1]! - a[3]!));
}

function shapesIntersect(a: Shape, b: Shape): boolean {
  if (boxGap(a.bbox, b.bbox) > 0) return false;
  if (a.ring && inRing(b.verts[0]!, a.ring)) return true;
  if (b.ring && inRing(a.verts[0]!, b.ring)) return true;
  for (const s of a.segs) {
    if (boxGap(segBox(s), b.bbox) > 0) continue;
    for (const t of b.segs) if (segmentsCross(s, t)) return true;
  }
  return false;
}

/** Minimum distance between two non-intersecting shapes, with the closest point on each. */
function minDistance(a: Shape, b: Shape): { d: number; pa: Pt; pb: Pt } {
  let best = { d: Infinity, pa: a.verts[0]!, pb: b.verts[0]! };
  const consider = (p: Pt, onA: boolean, seg: Seg) => {
    const c = closestOnSeg(p, seg);
    if (c.d < best.d) best = onA ? { d: c.d, pa: p, pb: c.pt } : { d: c.d, pa: c.pt, pb: p };
  };
  const boxesB = b.segs.map(segBox);
  for (const s of a.segs) {
    const bs = segBox(s);
    b.segs.forEach((t, i) => {
      // Skip segment pairs whose boxes are already further apart than the best distance found.
      if (boxGap(bs, boxesB[i]!) >= best.d) return;
      consider(s[0], true, t);
      consider(s[1], true, t);
      consider(t[0], false, s);
      consider(t[1], false, s);
    });
  }
  return best;
}

function pointToShape(p: Pt, s: Shape): number {
  if (s.ring && inRing(p, s.ring)) return 0;
  let d = Infinity;
  for (const seg of s.segs) d = Math.min(d, closestOnSeg(p, seg).d);
  return d;
}

function lineLength(s: Shape): number {
  return s.segs.reduce((n, [a, b]) => n + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
}

/** Samples a polyline every `step` meters; the step grows so the sample count stays under the cap. */
function sampleLine(s: Shape, length: number): { points: Pt[]; step: number } {
  const step = Math.max(DETECTION.SAMPLE_STEP_M, length / DETECTION.SHARED_LENGTH_SAMPLE_CAP);
  const points: Pt[] = [];
  let carried = step / 2;
  for (const [a, b] of s.segs) {
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = carried;
    while (at <= segLen) {
      const t = segLen === 0 ? 0 : at / segLen;
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      at += step;
    }
    carried = at - segLen;
  }
  return { points, step };
}

function sharedAlong(a: Shape, b: Shape, threshold: number): { meters: number; pct: number } {
  const length = lineLength(a);
  if (length <= 0) return { meters: 0, pct: 0 };
  const { points, step } = sampleLine(a, length);
  const hits = points.filter((p) => pointToShape(p, b) <= threshold).length;
  const meters = Math.min(length, hits * step);
  return { meters, pct: meters / length };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function analyzeSpatial(a: SpatialSide, b: SpatialSide, radiusMeters: number = DETECTION.PERSIST_RADIUS_M): SpatialResult {
  const lat0 = (meanLat(a.geometry) + meanLat(b.geometry)) / 2;
  const proj = projection(lat0);
  const sa = shapeOf(a.geometry, proj);
  const sb = shapeOf(b.geometry, proj);
  const intersects = shapesIntersect(sa, sb);
  let distance = 0;
  let closest: [Pos, Pos] | null = null;
  if (!intersects) {
    const m = minDistance(sa, sb);
    distance = m.d;
    closest = [proj.inv(m.pa), proj.inv(m.pb)];
  }
  const gap = Math.max(0, distance - a.bufferMeters - b.bufferMeters);
  const footprintOverlap = gap === 0;
  const relation: SpatialRelation = intersects
    ? "intersecting"
    : footprintOverlap
      ? "footprint_overlap"
      : distance <= DETECTION.ADJACENT_DISTANCE_M
        ? "adjacent"
        : distance <= radiusMeters
          ? "nearby"
          : "none";

  let sharedLengthMeters = 0;
  let sharedPctOfA: number | null = null;
  let sharedPctOfB: number | null = null;
  if (relation !== "none" && sa.kind === "LineString" && (sb.kind === "LineString" || sb.kind === "Polygon")) {
    const threshold = Math.max(a.bufferMeters, b.bufferMeters, 10);
    if (distance <= threshold) {
      const ab = sharedAlong(sa, sb, threshold);
      sharedLengthMeters = ab.meters;
      sharedPctOfA = ab.pct;
      if (sb.kind === "LineString") sharedPctOfB = sharedAlong(sb, sa, threshold).pct;
    }
  }
  return {
    distanceMeters: r1(distance),
    relation,
    intersects,
    footprintOverlap,
    footprintGapMeters: r1(gap),
    sharedLengthMeters: Math.round(sharedLengthMeters),
    sharedPctOfA: sharedPctOfA === null ? null : Math.round(sharedPctOfA * 100) / 100,
    sharedPctOfB: sharedPctOfB === null ? null : Math.round(sharedPctOfB * 100) / 100,
    closestPoints: closest,
  };
}

function meanLat(g: AnyGeometry): number {
  const pts = flatten(g);
  return pts.reduce((n, p) => n + p[1], 0) / Math.max(1, pts.length);
}

/** Bounding box [w, s, e, n] of any supported geometry, in degrees. */
export function geometryBbox(g: AnyGeometry): [number, number, number, number] {
  const pts = flatten(g);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Rectangle polygon around a geometry, grown by `meters` on every side. Used as the 2dsphere search area. */
export function searchPolygon(g: AnyGeometry, meters: number): { type: "Polygon"; coordinates: Pos[][] } {
  const [w, s, e, n] = geometryBbox(g);
  const dLat = meters / K;
  const dLng = meters / (K * Math.cos((((s + n) / 2) * Math.PI) / 180));
  const [x0, y0, x1, y1] = [Math.max(-180, w - dLng), Math.max(-90, s - dLat), Math.min(180, e + dLng), Math.min(90, n + dLat)];
  return { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] };
}

/** Douglas-Peucker thinning for transport; keeps the shape within about `toleranceMeters`. */
export function simplifyForTransport<G extends AnyGeometry>(g: G, toleranceMeters = 1): G {
  if (g.type === "Point") return g;
  const proj = projection(meanLat(g));
  const thin = (pts: Pos[], closed: boolean): Pos[] => {
    if (pts.length <= (closed ? 4 : 2)) return pts;
    const xy = pts.map(proj.fwd);
    const keep = new Array<boolean>(pts.length).fill(false);
    keep[0] = true;
    keep[pts.length - 1] = true;
    const stack: [number, number][] = [[0, pts.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      let worst = -1;
      let wd = toleranceMeters;
      for (let k = i + 1; k < j; k += 1) {
        const d = closestOnSeg(xy[k]!, [xy[i]!, xy[j]!]).d;
        if (d > wd) {
          wd = d;
          worst = k;
        }
      }
      if (worst > 0) {
        keep[worst] = true;
        stack.push([i, worst], [worst, j]);
      }
    }
    const out = pts.filter((_, i) => keep[i]);
    return closed && out.length < 4 ? pts : out;
  };
  if (g.type === "LineString") return { ...g, coordinates: thin(g.coordinates as Pos[], false) };
  return { ...g, coordinates: (g.coordinates as Pos[][]).map((r) => thin(r, true)) };
}

// ---------- Steps 70-71 helpers (pure) ----------

/** Total length of a LineString in meters (0 for points and polygons). */
export function lineLengthMeters(g: AnyGeometry): number {
  if (g.type !== "LineString") return 0;
  return lineLength(shapeOf(g, projection(meanLat(g))));
}

/** Point `distance` meters along a LineString (clamped to its ends). */
export function pointAlongLine(g: AnyGeometry, distance: number): Pos {
  const proj = projection(meanLat(g));
  const shape = shapeOf(g, proj);
  let left = Math.max(0, distance);
  for (const [a, b] of shape.segs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len || len === 0) {
      const t = len === 0 ? 0 : left / len;
      return proj.inv([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    left -= len;
  }
  return proj.inv(shape.verts[shape.verts.length - 1]!);
}

/** Distance in meters from a [lng, lat] point to a geometry (0 when inside a polygon). */
export function distanceFromPoint(point: Pos, g: AnyGeometry): number {
  const proj = projection(meanLat(g));
  return pointToShape(proj.fwd(point), shapeOf(g, proj));
}

function crossingPoint([p1, q1]: Seg, [p2, q2]: Seg): Pt | null {
  const d = (q1[0] - p1[0]) * (q2[1] - p2[1]) - (q1[1] - p1[1]) * (q2[0] - p2[0]);
  if (d === 0) return null;
  const t = ((p2[0] - p1[0]) * (q2[1] - p2[1]) - (p2[1] - p1[1]) * (q2[0] - p2[0])) / d;
  const u = ((p2[0] - p1[0]) * (q1[1] - p1[1]) - (p2[1] - p1[1]) * (q1[0] - p1[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p1[0] + t * (q1[0] - p1[0]), p1[1] + t * (q1[1] - p1[1])] : null;
}

/**
 * Where the pair "bites": the first crossing of the two shapes when they intersect, otherwise the midpoint
 * of the closest points. Falls back to the first vertex of `a` for containment or collinear contact.
 */
export function hotspotOf(a: AnyGeometry, b: AnyGeometry, spatial: Pick<SpatialResult, "intersects" | "closestPoints">): Pos {
  const proj = projection((meanLat(a) + meanLat(b)) / 2);
  if (spatial.intersects) {
    const sa = shapeOf(a, proj);
    const sb = shapeOf(b, proj);
    for (const s of sa.segs) for (const t of sb.segs) {
      const hit = crossingPoint(s, t);
      if (hit) return proj.inv(hit);
    }
    return proj.inv(sa.verts[0]!);
  }
  const c = spatial.closestPoints;
  if (c) return [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
  return flatten(a)[0] ?? [0, 0];
}
