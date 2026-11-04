import type { Bbox } from "./inframap";
import { MAX_BBOX_SPAN_DEG } from "./inframap";

/**
 * Pure helpers for the single viewport data pipeline: the bbox actually requested is the viewport grown by 25 %, rounded
 * OUTWARD to a grid that depends on zoom, so small pans reuse cached results and fall inside the last fetched box.
 */
export const PAD_RATIO = 0.25;

export const zoomBucket = (zoom: number): number => Math.max(0, Math.min(22, Math.floor(zoom)));

/** Grid cell in degrees: about half a tile at the given zoom, doubled on constrained devices. */
export const gridFor = (zoom: number, multiplier = 1): number => (360 / 2 ** (zoomBucket(zoom) + 1)) * multiplier;

const r6 = (n: number) => Number(n.toFixed(6));

export function padBbox([w, s, e, n]: Bbox, ratio = PAD_RATIO): Bbox {
  const dx = (e - w) * ratio, dy = (n - s) * ratio;
  return [w - dx, s - dy, e + dx, n + dy];
}

/** Rounds outward (floor west/south, ceil east/north) so the quantised box always contains the original. */
export function quantizeBbox([w, s, e, n]: Bbox, zoom: number, multiplier = 1): Bbox {
  const g = gridFor(zoom, multiplier);
  return [r6(Math.floor(w / g) * g), r6(Math.floor(s / g) * g), r6(Math.ceil(e / g) * g), r6(Math.ceil(n / g) * g)];
}

/** Clamped to valid lon/lat and to the widest viewport the API accepts, shrunk around the centre if needed. */
export function clampBbox([w, s, e, n]: Bbox): Bbox {
  let W = Math.max(-180, w), E = Math.min(180, e), S = Math.max(-90, s), N = Math.min(90, n);
  if (E - W > MAX_BBOX_SPAN_DEG) { const c = (W + E) / 2; W = c - MAX_BBOX_SPAN_DEG / 2; E = c + MAX_BBOX_SPAN_DEG / 2; }
  if (N - S > MAX_BBOX_SPAN_DEG) { const c = (S + N) / 2; S = c - MAX_BBOX_SPAN_DEG / 2; N = c + MAX_BBOX_SPAN_DEG / 2; }
  return [r6(W), r6(S), r6(E), r6(N)];
}

export const containsBbox = (outer: Bbox, inner: Bbox): boolean => inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

export const fetchBboxFor = (viewport: Bbox, zoom: number, multiplier = 1): Bbox => clampBbox(quantizeBbox(padBbox(viewport), zoom, multiplier));

/**
 * Should the pipeline refetch for this viewport? Only when there is no fetched box yet, the zoom bucket changed, or the
 * viewport left the last fetched padded box. Filters are part of the query key, so they refetch on their own.
 */
export function needsRefetch(last: { bbox: Bbox; zoom: number } | null, viewport: Bbox, zoom: number): boolean {
  return !last || zoomBucket(last.zoom) !== zoomBucket(zoom) || !containsBbox(last.bbox, viewport);
}

export type DeviceProfile = { limit: number; gridMultiplier: number; lowPower: boolean };
/** Lighter requests on phones, save-data connections and low-core devices. */
export function deviceProfile(env: { width: number; saveData?: boolean; cores?: number }): DeviceProfile {
  const constrained = env.width < 640 || env.saveData === true || (env.cores !== undefined && env.cores <= 4);
  return { limit: constrained ? 300 : 500, gridMultiplier: constrained ? 2 : 1, lowPower: env.saveData === true || (env.cores !== undefined && env.cores <= 4) };
}
