export const LAYER_KEYS = ["projects", "roadworks", "conflicts", "assets", "utilities", "risks"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];

/** west, south, east, north */
export type Bbox = [number, number, number, number];

export type MapFeature = { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
export type LayerData = { type: "FeatureCollection"; truncated: boolean; features: MapFeature[]; restrictedHidden?: number; hasDemo?: boolean; total?: number; totalIsEstimate?: boolean };

/** Server API path segment for each layer. */
export const LAYER_PATH: Record<LayerKey, string> = { projects: "projects", roadworks: "roadworks", conflicts: "conflicts", assets: "assets", utilities: "utilities", risks: "risks" };

/** The API refuses a viewport wider than this many degrees, so the client never asks for one. */
export const MAX_BBOX_SPAN_DEG = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A viewport the API will accept: inside lon/lat range and at most MAX_BBOX_SPAN_DEG wide, shrunk around its centre if needed. */
export function viewportBbox(west: number, south: number, east: number, north: number): Bbox | null {
  if (![west, south, east, north].every(Number.isFinite)) return null;
  let w = clamp(west, -180, 180), e = clamp(east, -180, 180), s = clamp(south, -90, 90), n = clamp(north, -90, 90);
  if (w >= e || s >= n) return null;
  if (e - w > MAX_BBOX_SPAN_DEG) { const c = (w + e) / 2; w = c - MAX_BBOX_SPAN_DEG / 2; e = c + MAX_BBOX_SPAN_DEG / 2; }
  if (n - s > MAX_BBOX_SPAN_DEG) { const c = (s + n) / 2; s = c - MAX_BBOX_SPAN_DEG / 2; n = c + MAX_BBOX_SPAN_DEG / 2; }
  return [w, s, e, n];
}

/** Rounded so that tiny pans share a cache entry and the query string stays short. */
export const bboxParam = (b: Bbox): string => b.map((v) => v.toFixed(3)).join(",");

export type PropString = (key: string) => string | null;
const text = (p: Record<string, unknown>): PropString => (key) => (typeof p[key] === "string" && p[key] ? (p[key] as string) : null);
const num = (p: Record<string, unknown>, key: string): number | null => (typeof p[key] === "number" && Number.isFinite(p[key]) ? (p[key] as number) : null);

export type FeatureSummary = {
  layer: LayerKey;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  /** null when no detail page exists for this kind of record (assets, utilities, hazard zones). */
  href: string | null;
};

/** What the panel and the in-view list show for a feature. Only fields the API actually returned; nothing is invented. */
export function summarize(layer: LayerKey, properties: Record<string, unknown>): FeatureSummary | null {
  const s = text(properties);
  const id = s("id");
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) return null;
  if (layer === "projects") return { layer, id, title: s("title") ?? s("projectCode") ?? id, subtitle: s("projectCode"), status: s("status"), href: `/projects/${id}/overview` };
  if (layer === "roadworks") return { layer, id, title: s("projectTitle") ?? s("workType") ?? id, subtitle: s("projectCode"), status: s("status"), href: `/roadsync/work-requests/${id}` };
  if (layer === "assets" || layer === "utilities") return { layer, id, title: s("name") ?? id, subtitle: s("assetType"), status: s("condition"), href: null };
  if (layer === "risks") return s("kind") === "project"
    ? { layer, id, title: s("title") ?? s("projectCode") ?? id, subtitle: s("projectCode"), status: s("riskBand"), href: `/projects/${id}/overview` }
    : { layer, id, title: s("name") ?? id, subtitle: s("hazardType"), status: s("level"), href: null };
  const score = num(properties, "score");
  return { layer, id, title: s("conflictNo") ?? id, subtitle: score === null ? null : String(score), status: s("status"), href: `/roadsync/conflicts/${id}` };
}

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  DRAFT: "#94a3b8", SUBMITTED: "#1d4ed8", UNDER_REVIEW: "#7c3aed", REJECTED: "#9f1239", APPROVED: "#0f766e",
  ACTIVE: "#15803d", ON_HOLD: "#64748b", DELAYED: "#b45309", COMPLETED: "#334155", CANCELLED: "#9ca3af",
};

/** Conflict records that are no longer being worked are drawn dimmed. */
export const CLOSED_CONFLICT_STATUSES = ["resolved", "dismissed", "auto_closed", "withdrawn"] as const;

/** Count of features per layer for the toolbar; unknown until the layer has loaded. */
export const countOf = (data: LayerData | undefined): number | null => (data ? data.features.length : null);

export type LayerFilters = Record<string, string | undefined>;
export type Filters = Record<LayerKey, LayerFilters>;
export const NO_FILTERS: Filters = { projects: {}, roadworks: {}, conflicts: {}, assets: {}, utilities: {}, risks: {} };

/** `&k=v` for the active filters only, keys sorted so identical filters share a cache entry. */
export const filtersParam = (filters: LayerFilters): string =>
  Object.keys(filters).sort().filter((k) => filters[k]).map((k) => `&${encodeURIComponent(k)}=${encodeURIComponent(filters[k] as string)}`).join("");

export type LayerAvailability = { id: LayerKey; available: boolean; reason?: "forbidden" | "unavailable" };
export type MissingProject = { id: string; projectCode: string; title: string };
export type LayersInfo = { layers: LayerAvailability[]; projectsWithoutLocation: { total: number; items: MissingProject[] } };

type Position = number[];
function positions(coordinates: unknown, out: Position[] = []): Position[] {
  if (Array.isArray(coordinates) && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") out.push(coordinates as Position);
  else if (Array.isArray(coordinates)) for (const part of coordinates) positions(part, out);
  return out;
}

/** [[west, south], [east, north]] of a GeoJSON geometry, or null when it holds no finite lon/lat pair. */
export function featureBounds(geometry: { coordinates?: unknown } | null | undefined): [[number, number], [number, number]] | null {
  const pts = positions(geometry?.coordinates).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]!) <= 180 && Math.abs(p[1]!) <= 90);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]!), ys = pts.map((p) => p[1]!);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

export type SearchHit = FeatureSummary & { geometry: MapFeature["geometry"] };
const HAYSTACK_KEYS = ["title", "name", "projectCode", "conflictNo", "workType", "projectTitle", "district", "agencyName", "assetType", "hazardType"] as const;

/** Case-insensitive search over the features already loaded for the enabled layers. Not a server search. */
export function searchLoaded(data: Partial<Record<LayerKey, LayerData>>, enabled: Record<LayerKey, boolean>, query: string, limit = 24): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const layer of LAYER_KEYS) {
    if (!enabled[layer]) continue;
    for (const feature of data[layer]?.features ?? []) {
      const p = feature.properties;
      const hay = HAYSTACK_KEYS.map((k) => (typeof p[k] === "string" ? (p[k] as string) : "")).join(" ").replace(/_/g, " ").toLowerCase();
      if (!hay.includes(q)) continue;
      const info = summarize(layer, p);
      if (info) hits.push({ ...info, geometry: feature.geometry });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
