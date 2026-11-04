"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { BAND_COLOR } from "@/lib/roadsync/assessment";

type Feature = { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };

const STYLE: StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
const SRI_LANKA: [[number, number], [number, number]] = [[79.4, 5.8], [82.1, 9.95]];
const band = ["match", ["get", "band"], "info", BAND_COLOR.info, "low", BAND_COLOR.low, "medium", BAND_COLOR.medium, "high", BAND_COLOR.high, "critical", BAND_COLOR.critical, "#64748b"] as never;

function coordsOf(f: Feature): [number, number][] {
  const c = f.geometry.coordinates as unknown;
  if (f.geometry.type === "Point") return [c as [number, number]];
  if (f.geometry.type === "LineString") return c as [number, number][];
  if (f.geometry.type === "Polygon") return (c as [number, number][][])[0] ?? [];
  return [];
}

/**
 * One MapLibre map for the inbox (clustered band pins) and the dossier (parties, hotspot, nearby, related).
 * Layers are created once and the whole map is removed on unmount. Text is never injected as HTML.
 */
export function ConflictMap({ features, mode, onSelect, label, selectedId }: { features: Feature[]; mode: "pins" | "dossier"; onSelect?: (id: string) => void; label: string; selectedId?: string | null }) {
  const box = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { selectRef.current = onSelect; });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file (same as the work map).
        if (!maplibre.getWorkerUrl()) maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        const map = new maplibre.Map({ container: box.current, style: STYLE, bounds: SRI_LANKA, fitBoundsOptions: { padding: 20 }, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (mode === "pins") {
            map.addSource("pins", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 12 });
            map.addLayer({ id: "pin-cluster", type: "circle", source: "pins", filter: ["has", "point_count"], paint: { "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28], "circle-color": "#0B1F3A", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
            map.addLayer({ id: "pin-count", type: "symbol", source: "pins", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#fff" } });
            map.addLayer({ id: "pin-pulse", type: "circle", source: "pins", filter: ["all", ["!", ["has", "point_count"]], ["in", ["get", "band"], ["literal", ["critical", "high"]]]] as never, paint: { "circle-radius": 16, "circle-color": band, "circle-opacity": 0.28 } });
            map.addLayer({ id: "pin", type: "circle", source: "pins", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 8, "circle-color": ["match", ["get", "recordType"], "opportunity", "#1B6B3A", band], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
            map.addLayer({ id: "pin-selected", type: "circle", source: "pins", filter: ["==", ["get", "id"], ""] as never, paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f59e0b", "circle-stroke-width": 3 } });
            map.on("click", "pin", (e) => { const id = e.features?.[0]?.properties?.id; if (typeof id === "string") selectRef.current?.(id); });
            map.on("click", "pin-cluster", (e) => { map.easeTo({ center: e.lngLat, zoom: map.getZoom() + 2 }); });
          } else {
            map.addSource("dossier", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            const is = (f: string) => ["==", ["get", "feature"], f] as never;
            map.addLayer({ id: "d-party-casing", type: "line", source: "dossier", filter: ["all", is("party"), ["!=", ["geometry-type"], "Point"]] as never, paint: { "line-color": "#fff", "line-width": 8 } });
            map.addLayer({ id: "d-party", type: "line", source: "dossier", filter: ["all", is("party"), ["!=", ["geometry-type"], "Point"]] as never, paint: { "line-color": ["match", ["get", "side"], "a", "#0B1F3A", "#C2760A"], "line-width": 5 } });
            map.addLayer({ id: "d-party-point", type: "circle", source: "dossier", filter: ["all", is("party"), ["==", ["geometry-type"], "Point"]] as never, paint: { "circle-radius": 7, "circle-color": ["match", ["get", "side"], "a", "#0B1F3A", "#C2760A"], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
            map.addLayer({ id: "d-nearby", type: "line", source: "dossier", filter: is("nearby"), paint: { "line-color": "#64748b", "line-width": 3, "line-dasharray": [1, 2] } });
            map.addLayer({ id: "d-connector", type: "line", source: "dossier", filter: is("connector"), paint: { "line-color": "#334155", "line-width": 1.5, "line-dasharray": [1, 2] } });
            map.addLayer({ id: "d-related", type: "circle", source: "dossier", filter: is("related"), paint: { "circle-radius": 6, "circle-color": band, "circle-stroke-color": "#fff", "circle-stroke-width": 2, "circle-opacity": 0.8 } });
            map.addLayer({ id: "d-pulse", type: "circle", source: "dossier", filter: is("hotspot"), paint: { "circle-radius": 18, "circle-color": band, "circle-opacity": 0.3 } });
            map.addLayer({ id: "d-hotspot", type: "circle", source: "dossier", filter: is("hotspot"), paint: { "circle-radius": 9, "circle-color": band, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
            map.on("click", "d-related", (e) => { const id = e.features?.[0]?.properties?.id; if (typeof id === "string") selectRef.current?.(id); });
          }
          setReady(true);
        });
        map.on("error", () => undefined);
        observer = new ResizeObserver(() => map.resize());
        observer.observe(box.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(mode === "pins" ? "pins" : "dossier") as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features } as never);
    const pts = features.flatMap(coordsOf);
    if (pts.length) {
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      const b: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      map.fitBounds(b, { padding: 60, maxZoom: mode === "pins" ? 13 : 17, duration: 0 });
    }
  }, [features, ready, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map && mode === "pins" && map.getLayer("pin-selected")) map.setFilter("pin-selected", ["==", ["get", "id"], selectedId ?? ""] as never);
  }, [selectedId, ready, mode]);

  if (failed) return <p className="rs-help" role="status">{label}</p>;
  return <div ref={box} className="cr-map" role="region" aria-label={label} />;
}
