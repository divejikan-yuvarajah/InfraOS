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

export type ExposureItem = { id: string; layer: LayerKey; point: [number, number] | null; geometry: MapFeature["geometry"] | null; name?: string; title?: string; projectCode?: string; status?: string; workType?: string; assetType?: string; agencyName?: string | null; tier?: string; isDemo?: boolean };
export type ExposureZone = { id: string; name: string; hazardType: string; level: string; isDemo: boolean; point: [number, number] | null; geometry: MapFeature["geometry"] | null; source: { kind: string; organisation: string; datasetName: string; dataDate: string | null } };
export type ExposureBucket = { total: number; items: ExposureItem[]; hidden?: number };
export type ExposureData =
  | { mode: "zones"; generatedAt: string; zones: ExposureZone[]; worstLevel: string | null }
  | { mode: "records"; generatedAt: string; records: { projects: ExposureBucket | null; roadworks: ExposureBucket | null; assets: ExposureBucket | null; utilities: ExposureBucket | null } };

/** Hazard exposure for the selected feature (which zones it overlaps) or zone (which in-scope records it covers). */
export async function fetchExposure(layer: LayerKey, id: string, signal?: AbortSignal): Promise<ExposureData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<ExposureData>>(`/api/v1/inframap/exposure?layer=${layer}&id=${encodeURIComponent(id)}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export const NEARBY_RADII = [50, 100, 250, 500] as const;
export type NearbyItem = { id: string; layer: LayerKey; name: string; assetType?: string; hazardType?: string; level?: string; agencyName?: string | null; tier?: string; isDemo?: boolean; point: [number, number] | null };
export type NearbyData = { generatedAt: string; radiusM: number; approximate: boolean; envelope: { type: "Polygon"; coordinates: number[][][] }; restrictedHidden: number; layers: Partial<Record<"assets" | "utilities" | "risks", { total: number; items: NearbyItem[] } | null>> };

export async function fetchNearby(featureLayer: LayerKey, featureId: string, radiusM: number, signal?: AbortSignal): Promise<NearbyData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<NearbyData>>(`/api/v1/inframap/nearby?featureLayer=${featureLayer}&featureId=${encodeURIComponent(featureId)}&radiusM=${radiusM}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type FeatureDetail = { kind: string; properties: Record<string, unknown>; maintenance?: { maintenanceType: string; status: string; scheduledDate: string | null; completedDate: string | null }[]; reasons?: string[] };
export async function fetchFeatureDetail(layer: "assets" | "utilities" | "risks", id: string, signal?: AbortSignal): Promise<FeatureDetail> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<FeatureDetail>>(`/api/v1/inframap/features/${layer}/${encodeURIComponent(id)}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
