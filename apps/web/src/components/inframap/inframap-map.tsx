"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MAP_STYLE, SRI_LANKA_BOUNDS, WORK_STATUS_COLOR } from "@/components/roadsync/work-map";
import { BAND_COLOR } from "@/lib/roadsync/assessment";
import {
  CLOSED_CONFLICT_STATUSES, LAYER_KEYS, PROJECT_STATUS_COLOR, viewportBbox,
  type Bbox, type LayerData, type LayerKey,
} from "@/lib/inframap/inframap";

export type Selection = { layer: LayerKey; id: string };

const EMPTY = { type: "FeatureCollection" as const, features: [] as unknown[] };
const HIT_PX = 10; // generous touch target around a tap
const AMBER = "#f59e0b";

/** Layer ids per data layer, bottom to top inside a layer. Visibility is toggled on these, never by rebuilding the map. */
const LAYER_IDS: Record<LayerKey, string[]> = {
  projects: ["im-projects-fill", "im-projects-line", "im-projects-point"],
  roadworks: ["im-roadworks-fill", "im-roadworks-casing", "im-roadworks-line", "im-roadworks-point"],
  conflicts: ["im-conflicts-circle"],
};
/** Click priority: the smallest, most important marks win over the shapes beneath them. */
const PICK_ORDER: LayerKey[] = ["conflicts", "roadworks", "projects"];

const byStatus = (colors: Record<string, string>, fallback: string) =>
  ["match", ["get", "status"], ...Object.entries(colors).flatMap(([k, v]) => [k, v]), fallback] as never;
const BAND_MATCH = ["match", ["get", "band"], ...Object.entries(BAND_COLOR).flatMap(([k, v]) => [k, v]), "#64748b"] as never;

type Props = {
  data: Partial<Record<LayerKey, LayerData>>;
  visible: Record<LayerKey, boolean>;
  selected: Selection | null;
  resetKey: number;
  label: string;
  onViewport: (bbox: Bbox) => void;
  onSelect: (selection: Selection | null) => void;
  onFailed: () => void;
};

/**
 * One MapLibre instance for the whole workspace. Sources and layers are created once; data arrives through
 * `setData`, layers are shown or hidden through layout properties, and everything is removed on unmount.
 */
export function InframapMap({ data, visible, selected, resetKey, label, onViewport, onSelect, onFailed }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const cb = useRef({ onViewport, onSelect, onFailed });
  const latest = useRef({ data, visible, selected });
  useEffect(() => { cb.current = { onViewport, onSelect, onFailed }; latest.current = { data, visible, selected }; });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let map: MlMap | null = null;
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file.
        if (!ml.getWorkerUrl()) ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        const created = new ml.Map({ container: box.current, style: MAP_STYLE, bounds: SRI_LANKA_BOUNDS, fitBoundsOptions: { padding: 20 }, attributionControl: { compact: false } });
        map = created;
        observer = new ResizeObserver(() => created.resize());
        observer.observe(box.current);
        created.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        created.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
        created.once("style.load", () => {
          for (const key of [...LAYER_KEYS, "selected"] as const) created.addSource(`im-${key}`, { type: "geojson", data: EMPTY as never });
          const point = ["==", ["geometry-type"], "Point"] as never;
          const shape = ["!=", ["geometry-type"], "Point"] as never;
          created.addLayer({ id: "im-projects-fill", type: "fill", source: "im-projects", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": byStatus(PROJECT_STATUS_COLOR, "#64748b"), "fill-opacity": 0.16 } });
          created.addLayer({ id: "im-projects-line", type: "line", source: "im-projects", filter: shape, paint: { "line-color": byStatus(PROJECT_STATUS_COLOR, "#64748b"), "line-width": 3, "line-dasharray": [3, 1.5] } });
          created.addLayer({ id: "im-projects-point", type: "circle", source: "im-projects", filter: point, paint: { "circle-radius": 6, "circle-color": byStatus(PROJECT_STATUS_COLOR, "#64748b"), "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
          created.addLayer({ id: "im-roadworks-fill", type: "fill", source: "im-roadworks", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": byStatus(WORK_STATUS_COLOR, "#c2410c"), "fill-opacity": 0.2 } });
          created.addLayer({ id: "im-roadworks-casing", type: "line", source: "im-roadworks", filter: shape, paint: { "line-color": "#ffffff", "line-width": 7 } });
          created.addLayer({ id: "im-roadworks-line", type: "line", source: "im-roadworks", filter: shape, paint: { "line-color": byStatus(WORK_STATUS_COLOR, "#c2410c"), "line-width": 4 } });
          created.addLayer({ id: "im-roadworks-point", type: "circle", source: "im-roadworks", filter: point, paint: { "circle-radius": 7, "circle-color": byStatus(WORK_STATUS_COLOR, "#c2410c"), "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
          const closed = ["in", ["get", "status"], ["literal", [...CLOSED_CONFLICT_STATUSES]]] as never;
          created.addLayer({ id: "im-conflicts-circle", type: "circle", source: "im-conflicts", paint: {
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "score"], 0], 0, 7, 100, 15] as never,
            "circle-color": BAND_MATCH, "circle-opacity": ["case", closed, 0.4, 0.92] as never,
            "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-stroke-opacity": ["case", closed, 0.5, 1] as never,
          } });
          created.addLayer({ id: "im-selected-fill", type: "fill", source: "im-selected", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": AMBER, "fill-opacity": 0.2 } });
          created.addLayer({ id: "im-selected-line", type: "line", source: "im-selected", filter: shape, paint: { "line-color": AMBER, "line-width": 12, "line-opacity": 0.55 } });
          created.addLayer({ id: "im-selected-point", type: "circle", source: "im-selected", filter: point, paint: { "circle-radius": 18, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": AMBER, "circle-stroke-width": 4 } });
          created.on("click", (e) => {
            const found = created.queryRenderedFeatures([[e.point.x - HIT_PX, e.point.y - HIT_PX], [e.point.x + HIT_PX, e.point.y + HIT_PX]], { layers: Object.values(LAYER_IDS).flat() });
            for (const key of PICK_ORDER) {
              const hit = found.find((f) => LAYER_IDS[key].includes(f.layer.id) && typeof f.properties?.id === "string");
              if (hit) { cb.current.onSelect({ layer: key, id: hit.properties.id as string }); return; }
            }
            cb.current.onSelect(null);
          });
          for (const id of Object.values(LAYER_IDS).flat()) {
            created.on("mouseenter", id, () => { created.getCanvas().style.cursor = "pointer"; });
            created.on("mouseleave", id, () => { created.getCanvas().style.cursor = ""; });
          }
          const emit = () => {
            const b = created.getBounds();
            const next = viewportBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
            if (next) cb.current.onViewport(next);
          };
          created.on("moveend", emit);
          mapRef.current = created;
          readyRef.current = true;
          // Push whatever the workspace already holds, then report the first viewport.
          applyData(created, latest.current.data, latest.current.visible);
          applySelected(created, latest.current.data, latest.current.selected);
          emit();
        });
      } catch {
        if (!cancelled) cb.current.onFailed();
      }
    })();
    return () => {
      cancelled = true;
      readyRef.current = false;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Data, visibility and selection are pushed into the existing map; nothing is re-created.
  useEffect(() => { if (readyRef.current && mapRef.current) applyData(mapRef.current, data, visible); }, [data, visible]);
  useEffect(() => { if (readyRef.current && mapRef.current) applySelected(mapRef.current, data, selected); }, [data, selected]);

  // "Sri Lanka view".
  useEffect(() => { if (resetKey > 0) mapRef.current?.fitBounds(SRI_LANKA_BOUNDS, { padding: 20 }); }, [resetKey]);

  return <div ref={box} className="im-map" role="region" aria-label={label} />;
}

function applyData(map: MlMap, data: Partial<Record<LayerKey, LayerData>>, visible: Record<LayerKey, boolean>) {
  for (const key of LAYER_KEYS) {
    (map.getSource(`im-${key}`) as GeoJSONSource | undefined)?.setData((data[key] ?? EMPTY) as never);
    for (const id of LAYER_IDS[key]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible[key] ? "visible" : "none");
  }
}

function applySelected(map: MlMap, data: Partial<Record<LayerKey, LayerData>>, selected: Selection | null) {
  const picked = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;
  (map.getSource("im-selected") as GeoJSONSource | undefined)?.setData((picked ? { type: "FeatureCollection", features: [picked] } : EMPTY) as never);
}
