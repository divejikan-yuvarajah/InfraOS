"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { featureBounds, summarize, viewportBbox, type Bbox, type LayerData, type LayerKey } from "@/lib/inframap/inframap";
import type { ConflictEvidence } from "@/lib/inframap/inframap-api";
import { ALL_INTERACTIVE_IDS, EMPTY_COLLECTION, ensureLayers, LAYER_DEFS } from "@/lib/inframap/layer-registry";
import { resolveMapStyle, SRI_LANKA_BOUNDS, SRI_LANKA_MAX_BOUNDS } from "@/lib/inframap/map-style";
import { orderCandidates, type Candidate } from "@/lib/inframap/selection-priority";

export type Selection = { layer: LayerKey; id: string };
export type Hover = { layer: LayerKey; id: string; x: number; y: number };
export type Readout = { zoom: number; lng: number | null; lat: number | null };

const HIT_PX = 10; // generous touch target around a tap

type Props = {
  data: Partial<Record<LayerKey, LayerData>>;
  visible: Record<LayerKey, boolean>;
  selected: Selection | null;
  evidence: ConflictEvidence | null;
  resetKey: number;
  retryKey: number;
  label: string;
  onViewport: (bbox: Bbox) => void;
  onPick: (candidates: Candidate[], at: { x: number; y: number }) => void;
  onHover: (hover: Hover | null) => void;
  onReadout: (readout: Readout) => void;
  onTilesFailed: (failed: boolean) => void;
  onFailed: () => void;
};

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function layerOf(renderedId: string): LayerKey | null {
  return LAYER_DEFS.find((d) => d.interactiveLayerIds.includes(renderedId))?.id ?? null;
}
function candidateOf(f: MapGeoJSONFeature): (Candidate & { layer: LayerKey }) | null {
  const layer = layerOf(f.layer.id);
  const info = layer ? summarize(layer, f.properties ?? {}) : null;
  if (!layer || !info) return null;
  const score = typeof f.properties?.score === "number" ? (f.properties.score as number) : null;
  return { layer, id: info.id, title: info.title, score };
}

/**
 * One MapLibre instance for the whole workspace. Sources and layers come from the layer registry and are created once
 * (and again, idempotently, after a style reload); data arrives through `setData`; visibility goes through layout
 * properties; everything is removed on unmount.
 */
export function InframapMap(props: Props) {
  const { data, visible, selected, evidence, resetKey, retryKey, label } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const cb = useRef(props);
  const latest = useRef({ data, visible, selected, evidence });
  useEffect(() => { cb.current = props; latest.current = { data, visible, selected, evidence }; });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let map: MlMap | null = null;
    let frame = 0;
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file.
        if (!ml.getWorkerUrl()) ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        const created = new ml.Map({
          container: box.current, style: resolveMapStyle(), bounds: SRI_LANKA_BOUNDS, maxBounds: SRI_LANKA_MAX_BOUNDS,
          fitBoundsOptions: { padding: 20 }, attributionControl: { compact: window.innerWidth < 640 },
        });
        map = created;
        observer = new ResizeObserver(() => created.resize());
        observer.observe(box.current);
        created.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        created.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");

        const restore = () => {
          ensureLayers(created);
          applyData(created, latest.current.data, latest.current.visible);
          applySelected(created, latest.current.data, latest.current.selected);
          applyEvidence(created, latest.current.evidence);
        };
        // Runs on first load and after any style swap, so layers, icons and data always come back.
        created.on("style.load", () => { restore(); readyRef.current = true; emitViewport(); });

        const emitViewport = () => {
          const b = created.getBounds();
          const next = viewportBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
          if (next) cb.current.onViewport(next);
        };
        const hitsAt = (point: { x: number; y: number }) => {
          const layers = ALL_INTERACTIVE_IDS.filter((id) => created.getLayer(id));
          return created.queryRenderedFeatures([[point.x - HIT_PX, point.y - HIT_PX], [point.x + HIT_PX, point.y + HIT_PX]], { layers });
        };

        created.on("click", (e) => {
          const found = hitsAt(e.point);
          const cluster = found.find((f) => f.layer.id === "im-projects-cluster");
          if (cluster && cluster.properties?.cluster_id !== undefined) {
            const source = created.getSource("im-projects") as GeoJSONSource | undefined;
            void source?.getClusterExpansionZoom(cluster.properties.cluster_id as number).then((zoom) => {
              created.easeTo({ center: (cluster.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.5, duration: reduceMotion() ? 0 : 400 });
            }).catch(() => undefined);
            return;
          }
          const candidates = found.map(candidateOf).filter((c): c is Candidate & { layer: LayerKey } => c !== null);
          cb.current.onPick(orderCandidates(candidates), { x: e.point.x, y: e.point.y });
        });
        created.on("mousemove", (e) => {
          if (frame) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            const top = orderCandidates(hitsAt(e.point).map(candidateOf).filter((c): c is Candidate & { layer: LayerKey } => c !== null))[0];
            const overCluster = !top && hitsAt(e.point).some((f) => f.layer.id === "im-projects-cluster");
            created.getCanvas().style.cursor = top || overCluster ? "pointer" : "";
            cb.current.onHover(top ? { layer: top.layer, id: top.id, x: e.point.x, y: e.point.y } : null);
            const c = created.getCenter();
            cb.current.onReadout({ zoom: created.getZoom(), lng: e.lngLat.lng ?? c.lng, lat: e.lngLat.lat ?? c.lat });
          });
        });
        created.on("mouseout", () => cb.current.onHover(null));
        created.on("zoom", () => cb.current.onReadout({ zoom: created.getZoom(), lng: null, lat: null }));
        created.on("moveend", emitViewport);
        // A failing tile server must not break the data layers: report it and keep drawing on a blank background.
        created.on("error", (e) => {
          const sourceId = (e as { sourceId?: string }).sourceId;
          if (sourceId && !sourceId.startsWith("im-")) cb.current.onTilesFailed(true);
        });
        created.on("sourcedata", (e) => {
          const ev = e as { sourceId?: string; isSourceLoaded?: boolean; tile?: unknown };
          if (ev.sourceId && !ev.sourceId.startsWith("im-") && ev.isSourceLoaded && ev.tile) cb.current.onTilesFailed(false);
        });
        mapRef.current = created;
      } catch {
        if (!cancelled) cb.current.onFailed();
      }
    })();
    return () => {
      cancelled = true;
      readyRef.current = false;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Data, visibility, selection and evidence are pushed into the existing map; nothing is re-created.
  useEffect(() => { if (readyRef.current && mapRef.current) applyData(mapRef.current, data, visible); }, [data, visible]);
  useEffect(() => { if (readyRef.current && mapRef.current) applySelected(mapRef.current, data, selected); }, [data, selected]);
  useEffect(() => { if (readyRef.current && mapRef.current) applyEvidence(mapRef.current, evidence); }, [evidence]);

  // Fly to a newly selected feature (keep the zoom when already closer), then to its evidence when that arrives.
  const flownTo = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !selected) { flownTo.current = null; return; }
    const key = `${selected.layer}:${selected.id}`;
    const feature = data[selected.layer]?.features.find((f) => f.properties.id === selected.id);
    if (flownTo.current === key || !feature) return;
    flownTo.current = key;
    const bounds = featureBounds(feature.geometry);
    if (!bounds) return;
    const duration = reduceMotion() ? 0 : 500;
    if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) map.easeTo({ center: bounds[0], zoom: Math.max(map.getZoom(), 14), duration });
    else map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration });
  }, [selected, data]);
  useEffect(() => {
    const map = mapRef.current;
    const parties = (evidence?.features ?? []).map((f) => featureBounds(f.geometry)).filter((b): b is NonNullable<typeof b> => b !== null);
    if (!map || !readyRef.current || !parties.length) return;
    const west = Math.min(...parties.map((b) => b[0][0])), south = Math.min(...parties.map((b) => b[0][1]));
    const east = Math.max(...parties.map((b) => b[1][0])), north = Math.max(...parties.map((b) => b[1][1]));
    map.fitBounds([[west, south], [east, north]], { padding: 90, maxZoom: 17, duration: reduceMotion() ? 0 : 500 });
  }, [evidence]);

  useEffect(() => { if (resetKey > 0) mapRef.current?.fitBounds(SRI_LANKA_BOUNDS, { padding: 20, duration: reduceMotion() ? 0 : 400 }); }, [resetKey]);
  // Retry for a failed basemap: reloading the style also exercises the style.load restore path.
  useEffect(() => { if (retryKey > 0) mapRef.current?.setStyle(resolveMapStyle()); }, [retryKey]);

  return <div ref={box} className="im-map" role="region" aria-label={label} />;
}

function applyData(map: MlMap, data: Partial<Record<LayerKey, LayerData>>, visible: Record<LayerKey, boolean>) {
  for (const def of LAYER_DEFS) {
    (map.getSource(def.sourceId) as GeoJSONSource | undefined)?.setData((data[def.id] ?? EMPTY_COLLECTION) as never);
    for (const id of def.layerIds) {
      // Evidence belongs to the conflict def but is shown whenever the layer is on and a conflict is selected.
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible[def.id] ? "visible" : "none");
    }
  }
}

function applySelected(map: MlMap, data: Partial<Record<LayerKey, LayerData>>, selected: Selection | null) {
  const picked = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;
  (map.getSource("im-selected") as GeoJSONSource | undefined)?.setData((picked ? { type: "FeatureCollection", features: [picked] } : EMPTY_COLLECTION) as never);
}

function applyEvidence(map: MlMap, evidence: ConflictEvidence | null) {
  // Only the two parties and their connector are drawn; the related and nearby context features are left out.
  const features = (evidence?.features ?? []).filter((f) => ["party", "connector"].includes(String(f.properties.feature)));
  (map.getSource("im-evidence") as GeoJSONSource | undefined)?.setData((features.length ? { type: "FeatureCollection", features } : EMPTY_COLLECTION) as never);
}
