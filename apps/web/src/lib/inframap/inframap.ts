export const LAYER_KEYS = ["projects", "roadworks", "conflicts"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];

/** west, south, east, north */
export type Bbox = [number, number, number, number];

export type MapFeature = { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
export type LayerData = { type: "FeatureCollection"; truncated: boolean; features: MapFeature[] };

/** Server API path segment for each layer. */
export const LAYER_PATH: Record<LayerKey, string> = { projects: "projects", roadworks: "work-requests", conflicts: "conflicts" };

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
  href: string;
};

/** What the panel and the in-view list show for a feature. Only fields the API actually returned; nothing is invented. */
export function summarize(layer: LayerKey, properties: Record<string, unknown>): FeatureSummary | null {
  const s = text(properties);
  const id = s("id");
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) return null;
  if (layer === "projects") return { layer, id, title: s("title") ?? s("projectCode") ?? id, subtitle: s("projectCode"), status: s("status"), href: `/projects/${id}/overview` };
  if (layer === "roadworks") return { layer, id, title: s("projectTitle") ?? s("workType") ?? id, subtitle: s("projectCode"), status: s("status"), href: `/roadsync/work-requests/${id}` };
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
