import type { ConflictOverlay, PreviewAssessment, PreviewItemAssessment } from "./assessment";
import type { GeometryInput } from "./work-requests-view";

/** Steps 68-69: mirrors the API projection. Facts are from the viewer's own request (self = a) vs the other item (b). */
export type SpatialFacts = {
  distanceMeters: number;
  relation: "intersecting" | "footprint_overlap" | "adjacent" | "nearby" | "none";
  intersects: boolean;
  footprintGapMeters: number;
  sharedLengthMeters: number;
  sharedPctOfA: number | null;
  sharedPctOfB: number | null;
  closestPoints: [[number, number], [number, number]] | null;
};
export type ShiftAdvice = { daysToClearAfter: number | null; daysToClearBefore: number | null; effectiveFlex: number; resolvable: boolean | null };
export type TemporalFacts = {
  applicable: boolean;
  relation: "identical" | "contained" | "partial_overlap" | "adjacent" | "none" | "permanent" | "unknown";
  containedBy: "a" | "b" | null;
  overlapDays: number;
  overlapStart: string | null;
  overlapEnd: string | null;
  gapDays: number;
  overlapPctOfA: number | null;
  overlapPctOfB: number | null;
  hoursCompatibility: "same_shift" | "different_shifts" | "overlaps_24h" | null;
  shift: { a: ShiftAdvice; b: ShiftAdvice } | null;
};
export type NearbyOther = {
  sourceType: "work_request" | "project" | "asset";
  id: string;
  ref: string;
  title: string;
  agencyId: string;
  agencyName: string | null;
  infrastructureType: string;
  workType: string | null;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  workingHours: string | null;
  geometry: GeometryInput;
  detailLevel: "full" | "redacted";
  canOpen: boolean;
};
export type NearbyView = { key: string; candidateId: string | null; other: NearbyOther; spatial: SpatialFacts; temporal: TemporalFacts; isCandidate: boolean; canOpen: boolean; stale: boolean; assessment?: PreviewItemAssessment };
export type NearbySummary = { nearby: number; candidates: number; overlapping: number; nearInTime: number; agencies: number; closestMeters: number | null; assessment?: PreviewAssessment };
export type SourceCheck = { source: "work_request" | "project" | "asset"; ok: boolean; error?: string };
export type DetectionState = {
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  counts?: { nearby: number; candidates: number; agencies: number; truncated: boolean };
  sourcesChecked?: SourceCheck[];
};

export type PreviewResult = { summary: NearbySummary; candidates: NearbyView[]; sourcesChecked: SourceCheck[]; truncated: boolean };
export type DetectionResult = { detection: DetectionState; summary: NearbySummary; candidates: NearbyView[]; total: number };

export const RADII = [50, 100, 250, 500] as const;
export const SOURCE_LABEL: Record<NearbyOther["sourceType"], string> = { work_request: "Work request", project: "Project", asset: "Asset" };
export const INFRA_COLOR: Record<string, string> = {
  ROAD: "#475569", WATER: "#0369a1", ELECTRICITY: "#b45309", TELECOM: "#7c3aed", DRAINAGE: "#0f766e", BRIDGE: "#be123c", BUILDING: "#4d7c0f", PUBLIC_FACILITY: "#a21caf", MULTI_INFRASTRUCTURE: "#334155", OTHER: "#64748b",
};
export const OVERLAP_COLOR = "#8D153A";
export const NEAR_TIME_COLOR = "#0E9AA7";
export const MUTED_COLOR = "#64748b";

/** Distance label like "38 m" or "1.2 km". */
export const meters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function timeRelationLabel(t: TemporalFacts): string {
  switch (t.relation) {
    case "identical": return "Same dates";
    case "contained": return t.containedBy === "a" ? "Within your dates" : "Spans your dates";
    case "partial_overlap": return "Overlapping dates";
    case "adjacent": return `Near in time (${t.gapDays} d gap)`;
    case "permanent": return "Permanent asset";
    case "unknown": return "Dates not entered";
    default: return "Not overlapping";
  }
}
export const isOverlapping = (t: TemporalFacts) => t.overlapDays > 0;

export function spatialLabel(s: SpatialFacts): string {
  switch (s.relation) {
    case "intersecting": return "Intersecting";
    case "footprint_overlap": return "Footprints overlap";
    case "adjacent": return `Adjacent · ${meters(s.distanceMeters)}`;
    default: return `${meters(s.distanceMeters)} away`;
  }
}

const K = (Math.PI / 180) * 6_371_008.8;

/** Dashed search-area rectangle (bounding box grown by `radius` m). It is a bounding area, not a buffer outline. */
export function searchArea(geometry: GeometryInput, radius: number) {
  const pts = geometry.type === "Point" ? [geometry.coordinates] : geometry.type === "LineString" ? geometry.coordinates : (geometry.coordinates[0] ?? []);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [w, s, e, n] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  const dLat = radius / K;
  const dLng = radius / (K * Math.cos((((s + n) / 2) * Math.PI) / 180));
  const ring = [[w - dLng, s - dLat], [e + dLng, s - dLat], [e + dLng, n + dLat], [w - dLng, n + dLat], [w - dLng, s - dLat]];
  return { type: "Feature", properties: { kind: "area" }, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** One overlay prop for both layers sets: nearby (Steps 68-69) and conflicts (Steps 70-71). */
export type NearbyOverlay = { mode?: "nearby"; features: unknown[]; selectedKey: string | null; hoverKey?: string | null; onSelect?: (key: string) => void } | ConflictOverlay;

/** GeoJSON for the map overlay: search area, candidate shapes, and dotted connectors to the closest points. */
export function overlayFeatures(views: NearbyView[], self: GeometryInput | null, radius: number): unknown[] {
  const out: unknown[] = self ? [searchArea(self, radius)] : [];
  for (const v of views.slice(0, 200)) {
    const t = v.temporal;
    const tone = isOverlapping(t) ? "overlap" : t.relation === "adjacent" ? "near" : "other";
    out.push({ type: "Feature", geometry: v.other.geometry, properties: { kind: "candidate", key: v.key, tone, color: INFRA_COLOR[v.other.infrastructureType] ?? MUTED_COLOR, label: `${v.other.ref} · ${meters(v.spatial.distanceMeters)}` } });
    if (v.spatial.closestPoints && v.spatial.distanceMeters > 0) out.push({ type: "Feature", geometry: { type: "LineString", coordinates: v.spatial.closestPoints }, properties: { kind: "connector", key: v.key } });
  }
  return out;
}
