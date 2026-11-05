import { apiClient } from "@/lib/api/client";
import { guard, moved, type Envelope } from "@/lib/roadsync/api";

import { ufParams, type UF } from "./filters-state";
import { bboxParam, LAYER_PATH, type Bbox, type LayerData, type LayerKey, type LayersInfo, type MapFeature } from "./inframap";

export type FetchOptions = { zoom: number | null; limit: number; fields?: "min" | "full" };

/** One bounded layer read. A response that arrives after sign-out or a user switch is discarded. */
export async function fetchLayer(layer: LayerKey, bbox: Bbox, uf: UF, opts: FetchOptions, signal?: AbortSignal): Promise<LayerData> {
  const { atEpoch, tokenAtStart } = guard();
  const zoom = opts.zoom === null ? "" : `&zoom=${Math.floor(opts.zoom)}`;
  const payload = await apiClient<Envelope<LayerData>>(`/api/v1/inframap/${LAYER_PATH[layer]}?bbox=${encodeURIComponent(bboxParam(bbox))}${zoom}&limit=${opts.limit}&fields=${opts.fields ?? "min"}${ufParams(uf, layer)}`, {
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

export type RelatedRef = { layer: LayerKey; id: string; title: string; status: string | null; relation: string };
/** Nearby lens around a dropped pin (coordinates, no record involved). */
export async function fetchNearbyAt(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<NearbyData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<NearbyData>>(`/api/v1/inframap/nearby?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&radiusM=${radiusM}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type FeatureDetail = {
  kind: string; properties: Record<string, unknown>;
  maintenance?: { maintenanceType: string; status: string; scheduledDate: string | null; completedDate: string | null }[]; reasons?: string[];
  related?: RelatedRef[]; links?: { record: string | null }; exposure?: { mode: string; zones?: number; worstLevel?: string | null; projects?: number | null; roadworks?: number | null; assets?: number | null; utilities?: number | null } | null;
  provenance?: string | null; geometry?: { type: string; coordinates: unknown } | null;
  actions?: { canOpenRecord: boolean; canShowNearby: boolean; canExposure: boolean; canZoom: boolean };
};
export async function fetchFeatureDetail(layer: LayerKey, id: string, signal?: AbortSignal): Promise<FeatureDetail> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<FeatureDetail>>(`/api/v1/inframap/features/${layer}/${encodeURIComponent(id)}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type GeometryHint = { kind: "point"; coordinates: [number, number] } | { kind: "bbox"; bbox: Bbox };
export type SearchItem = { id: string; layer: string; title: string; subtitle: string | null; status: string | null; badge: string | null; geometryHint: GeometryHint | null; noLocation?: boolean; matchedField: string; rank: number };
export type SearchGroup = { layer: string; items: SearchItem[]; hasMore: boolean };
export type SearchData = { groups: SearchGroup[]; took: number; truncated: boolean };

/** Server-side, permission-safe search. `scope=view` restricts to the box; the unified filters apply ("search within filters"). */
export async function fetchSearch(p: { q: string; scope: "view" | "all"; bbox: Bbox | null; uf: UF; layers?: string[] }, signal?: AbortSignal): Promise<SearchData> {
  const { atEpoch, tokenAtStart } = guard();
  const bbox = p.scope === "view" && p.bbox ? `&bbox=${encodeURIComponent(bboxParam(p.bbox))}` : "";
  const layers = p.layers?.length ? `&layers=${p.layers.join(",")}` : "";
  const payload = await apiClient<Envelope<SearchData>>(`/api/v1/inframap/search?q=${encodeURIComponent(p.q)}&scope=${p.scope}${bbox}${layers}${ufParams(p.uf)}`, { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type Count = { value: string; count: number };
export type FacetsData = {
  generatedAt: string;
  projects?: { projectStatus: Count[]; projectType: Count[] }; roadworks?: { roadworkStatus: Count[]; workType: Count[] };
  conflicts?: { conflictBand: Count[]; conflictStatusGroup: Count[] }; assets?: { assetType: Count[]; condition: Count[] };
  utilities?: { utilityClass: Count[] }; risks?: { hazardType: Count[]; hazardLevel: Count[] };
  global: { agencies: (Count & { label: string })[]; provinces: Count[]; districts: Count[] };
};

/** Option counts under the current filters (each facet excludes its own filter). Absent layers are forbidden for the viewer. */
export async function fetchFacets(bbox: Bbox | null, uf: UF, signal?: AbortSignal): Promise<FacetsData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<FacetsData>>(`/api/v1/inframap/facets?${bbox ? `bbox=${encodeURIComponent(bboxParam(bbox))}` : ""}${ufParams(uf)}`.replace("?&", "?").replace(/\?$/, ""), { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type HealthLayer = { layer: LayerKey; total: number; withGeometry: number; withoutGeometry: number; completenessPct: number | null; latestUpdatedAt: string | null; demoCount: number; restrictedHidden?: number; neverInspected?: number; overdueMaintenance?: number };
export type HealthData = { generatedAt: string; layers: HealthLayer[]; unmappedProjects: { total: number; items: { id: string; projectCode: string; title: string }[] } };
export async function fetchHealth(signal?: AbortSignal): Promise<HealthData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<HealthData>>("/api/v1/inframap/health", { method: "GET", authenticated: true, ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
