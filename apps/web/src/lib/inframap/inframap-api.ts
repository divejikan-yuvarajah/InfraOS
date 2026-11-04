import { apiClient } from "@/lib/api/client";
import { guard, moved, type Envelope } from "@/lib/roadsync/api";

import { bboxParam, filtersParam, LAYER_PATH, type Bbox, type LayerData, type LayerFilters, type LayerKey, type LayersInfo, type MapFeature } from "./inframap";

/** One bounded layer read. A response that arrives after sign-out or a user switch is discarded. */
export async function fetchLayer(layer: LayerKey, bbox: Bbox, filters: LayerFilters, signal?: AbortSignal): Promise<LayerData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<LayerData>>(`/api/v1/inframap/${LAYER_PATH[layer]}?bbox=${encodeURIComponent(bboxParam(bbox))}${filtersParam(filters)}`, {
    method: "GET",
    authenticated: true,
    ...(signal ? { signal } : {}),
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

/** Which layers this user may load, plus the in-scope projects without a map location. */
export async function fetchLayers(signal?: AbortSignal): Promise<LayersInfo> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<LayersInfo>>("/api/v1/inframap/layers", { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type ConflictEvidence = { type: "FeatureCollection"; features: MapFeature[] };

/** Evidence geometry for one selected conflict, from RoadSync's own endpoint (its redaction applies). */
export async function fetchConflictEvidence(id: string, signal?: AbortSignal): Promise<ConflictEvidence> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<ConflictEvidence>>(`/api/v1/roadsync/conflicts/${encodeURIComponent(id)}/map`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
