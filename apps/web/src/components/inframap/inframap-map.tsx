"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useRef, type MutableRefObject } from "react";

import { clampOpacity, layerFactor, OPACITY_PROPS, scaleOpacity } from "@/lib/inframap/focus";
import { featureBounds, summarize, viewportBbox, type Bbox, type LayerData, type LayerKey, type MapFeature } from "@/lib/inframap/inframap";
import type { ConflictEvidence } from "@/lib/inframap/inframap-api";
import { ALL_INTERACTIVE_IDS, EMPTY_COLLECTION, ensureLayers, LAYER_BY_ID, LAYER_DEFS } from "@/lib/inframap/layer-registry";
import { resolveMapStyle, SRI_LANKA_BOUNDS, SRI_LANKA_MAX_BOUNDS } from "@/lib/inframap/map-style";
import { orderCandidates, type Candidate } from "@/lib/inframap/selection-priority";

export type Selection = { layer: LayerKey; id: string };
export type Hover = { layer: LayerKey; id: string; x: number; y: number };
export type Readout = { zoom: number; lng: number | null; lat: number | null };
/** One-shot camera move: a point (with a minimum zoom) or a bounding box. */
export type CameraRequest = { key: number; point?: [number, number]; zoom?: number; exactZoom?: number; bounds?: [[number, number], [number, number]]; maxZoom?: number };
export type MapPadding = { top: number; right: number; bottom: number; left: number };
export type CaptureFn = () => Promise<string | null>;

const HIT_PX = 10; // generous touch target around a tap
const LONG_PRESS_MS = 600;

type Props = {
  data: Partial<Record<LayerKey, LayerData>>;
  visible: Record<LayerKey, boolean>;
  opacity: Record<LayerKey, number>;
  order: readonly LayerKey[];
  selectedFeature: MapFeature | null;
  evidence: ConflictEvidence | null;
  attention: boolean;
  focus: LayerKey | null;
  exposed: MapFeature[] | null;
  lens: { type: "Polygon"; coordinates: number[][][] } | null;
  pin: [number, number] | null;
  camera: CameraRequest | null;
  padding: MapPadding;
  initialView: { center: [number, number]; zoom: number } | null;
  resetKey: number;
  retryKey: number;
  label: string;
  captureRef: MutableRefObject<CaptureFn | null>;
  onViewport: (bbox: Bbox, zoom: number) => void;
  onPick: (candidates: Candidate[], at: { x: number; y: number }) => void;
  onHover: (hover: Hover | null) => void;
  onReadout: (readout: Readout) => void;
  onLongPress: (lngLat: [number, number]) => void;
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
  // Conflicts rank by score; within risks a project marker outranks a (usually huge) hazard polygon.
  const score = typeof f.properties?.score === "number" ? (f.properties.score as number) : layer === "risks" ? (f.properties?.kind === "project" ? 1 : 0) : null;
  return { layer, id: info.id, title: info.title, score };
}

type Visual = { attention: boolean; focus: LayerKey | null; opacity: Record<LayerKey, number>; order: readonly LayerKey[] };

/**
 * One MapLibre instance for the whole workspace. Sources and layers come from the layer registry and are created once
 * (and again, idempotently, after a style reload); data arrives through `setData`; visibility, opacity, order and Focus go
 * through layout/paint properties; everything is removed on unmount.
 */
export function InframapMap(props: Props) {
  const { data, visible, opacity, order, selectedFeature, evidence, attention, focus, exposed, lens, pin, camera, padding, resetKey, retryKey, label } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const cb = useRef(props);
  const latest = useRef({ data, visible, selectedFeature, evidence, exposed, lens, pin, padding, visual: { attention, focus, opacity, order } as Visual });
  const bases = useRef(new Map<string, unknown>());
  useEffect(() => {
    cb.current = props;
    latest.current = { data, visible, selectedFeature, evidence, exposed, lens, pin, padding, visual: { attention, focus, opacity, order } };
  });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let map: MlMap | null = null;
    let frame = 0;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file.
        if (!ml.getWorkerUrl()) ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        const init = cb.current.initialView;
        const created = new ml.Map({
          container: box.current, style: resolveMapStyle(), maxBounds: SRI_LANKA_MAX_BOUNDS,
          ...(init ? { center: init.center, zoom: init.zoom } : { bounds: SRI_LANKA_BOUNDS, fitBoundsOptions: { padding: 20 } }),
          attributionControl: { compact: window.innerWidth < 640 },
          // Retina drawing is capped at 2x: a 3x phone gets no visible gain for twice the pixels.
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        });
        map = created;
        observer = new ResizeObserver(() => created.resize());
        observer.observe(box.current);
        created.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        created.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");

        const restore = () => {
          const l = latest.current;
          ensureLayers(created);
          bases.current.clear(); // new layers start at their registry paint values
          applyData(created, l.data, l.visible);
          applySelected(created, l.selectedFeature);
          applyEvidence(created, l.evidence);
          applyOverlays(created, l.exposed, l.lens, l.pin);
          applyVisual(created, l.visual, bases.current);
          applyOrder(created, l.visual.order);
          created.setPadding(l.padding);
        };
        const emitViewport = () => {
          const b = created.getBounds();
          const next = viewportBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
          if (next) cb.current.onViewport(next, created.getZoom());
        };
        // Runs on first load and after any style swap, so layers, icons, opacity, order, highlight and data always come back.
        created.on("style.load", () => { restore(); readyRef.current = true; emitViewport(); });

        const hitsAt = (point: { x: number; y: number }) => {
          const layers = ALL_INTERACTIVE_IDS.filter((id) => created.getLayer(id));
          return created.queryRenderedFeatures([[point.x - HIT_PX, point.y - HIT_PX], [point.x + HIT_PX, point.y + HIT_PX]], { layers });
        };

        created.on("click", (e) => {
          const found = hitsAt(e.point);
          const cluster = found.find((f) => f.layer.id.endsWith("-cluster"));
          if (cluster && cluster.properties?.cluster_id !== undefined) {
            const source = created.getSource(cluster.layer.source as string) as GeoJSONSource | undefined;
            void source?.getClusterExpansionZoom(cluster.properties.cluster_id as number).then((zoom) => {
              created.easeTo({ center: (cluster.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.5, duration: reduceMotion() ? 0 : 400 });
            }).catch(() => undefined);
            return;
          }
          const candidates = found.map(candidateOf).filter((c): c is Candidate & { layer: LayerKey } => c !== null);
          cb.current.onPick(orderCandidates(candidates), { x: e.point.x, y: e.point.y });
        });
        // Hover is mouse-only: touch devices select on tap and have no hover affordance.
        created.on("mousemove", (e) => {
          if (frame) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            const found = hitsAt(e.point);
            const top = orderCandidates(found.map(candidateOf).filter((c): c is Candidate & { layer: LayerKey } => c !== null))[0];
            created.getCanvas().style.cursor = top || found.some((f) => f.layer.id.endsWith("-cluster")) ? "pointer" : "";
            cb.current.onHover(top ? { layer: top.layer, id: top.id, x: e.point.x, y: e.point.y } : null);
            cb.current.onReadout({ zoom: created.getZoom(), lng: e.lngLat.lng, lat: e.lngLat.lat });
          });
        });
        created.on("mouseout", () => cb.current.onHover(null));
        created.on("zoom", () => cb.current.onReadout({ zoom: created.getZoom(), lng: null, lat: null }));
        created.on("moveend", emitViewport);

        // Long press (touch) drops a coordinate pin; any movement or lift cancels it.
        const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        created.on("touchstart", (e) => {
          cancelPress();
          if (e.points && e.points.length > 1) return;
          pressTimer = setTimeout(() => { pressTimer = null; cb.current.onLongPress([e.lngLat.lng, e.lngLat.lat]); }, LONG_PRESS_MS);
        });
        for (const ev of ["touchmove", "touchend", "touchcancel", "dragstart", "zoomstart"] as const) created.on(ev, cancelPress);

        // A failing tile server must not break the data layers: report it and keep drawing on a blank background.
        created.on("error", (e) => {
          const sourceId = (e as { sourceId?: string }).sourceId;
          if (sourceId && !sourceId.startsWith("im-")) cb.current.onTilesFailed(true);
        });
        created.on("sourcedata", (e) => {
          const ev = e as { sourceId?: string; isSourceLoaded?: boolean; tile?: unknown };
          if (ev.sourceId && !ev.sourceId.startsWith("im-") && ev.isSourceLoaded && ev.tile) cb.current.onTilesFailed(false);
        });

        // Snapshot for the Map Brief: read the canvas inside the render event so no drawing buffer has to be preserved.
        cb.current.captureRef.current = () => new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 2000);
          created.once("render", () => {
            try { const url = created.getCanvas().toDataURL("image/png"); clearTimeout(timeout); resolve(url); } catch { clearTimeout(timeout); resolve(null); }
          });
          created.triggerRepaint();
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
      if (pressTimer) clearTimeout(pressTimer);
      observer?.disconnect();
      cb.current.captureRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Data, visibility, selection, evidence, overlays and visual state are pushed into the existing map; nothing is re-created.
  useEffect(() => { if (readyRef.current && mapRef.current) applyData(mapRef.current, data, visible); }, [data, visible]);
  useEffect(() => { if (readyRef.current && mapRef.current) applySelected(mapRef.current, selectedFeature); }, [selectedFeature]);
  useEffect(() => { if (readyRef.current && mapRef.current) applyEvidence(mapRef.current, evidence); }, [evidence]);
  useEffect(() => { if (readyRef.current && mapRef.current) applyOverlays(mapRef.current, exposed, lens, pin); }, [exposed, lens, pin]);
  // Attention, opacity and Focus compose over each layer's base paint; order is applied last and only moves layers.
  useEffect(() => { if (readyRef.current && mapRef.current) applyVisual(mapRef.current, { attention, focus, opacity, order }, bases.current); }, [attention, focus, opacity, order, visible, data]);
  useEffect(() => { if (readyRef.current && mapRef.current) applyOrder(mapRef.current, order); }, [order]);
  // Padding keeps the selected feature clear of the drawer or sheet; closing restores it.
  useEffect(() => { if (readyRef.current && mapRef.current) mapRef.current.setPadding(padding); }, [padding]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !camera) return;
    const duration = reduceMotion() ? 0 : 500;
    if (camera.bounds) map.fitBounds(camera.bounds, { padding: 60, maxZoom: camera.maxZoom ?? 17, duration });
    else if (camera.point) map.easeTo({ center: camera.point, zoom: camera.exactZoom ?? Math.max(map.getZoom(), camera.zoom ?? 14), duration });
  }, [camera]);
  // Evidence for a selected conflict: fit both conflicting works.
  useEffect(() => {
    const map = mapRef.current;
    const parts = (evidence?.features ?? []).map((f) => featureBounds(f.geometry)).filter((b): b is NonNullable<typeof b> => b !== null);
    if (!map || !readyRef.current || !parts.length) return;
    const west = Math.min(...parts.map((b) => b[0][0])), south = Math.min(...parts.map((b) => b[0][1]));
    const east = Math.max(...parts.map((b) => b[1][0])), north = Math.max(...parts.map((b) => b[1][1]));
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
    for (const id of def.layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible[def.id] ? "visible" : "none");
  }
}

function applySelected(map: MlMap, feature: MapFeature | null) {
  (map.getSource("im-selected") as GeoJSONSource | undefined)?.setData((feature ? { type: "FeatureCollection", features: [feature] } : EMPTY_COLLECTION) as never);
}

function applyEvidence(map: MlMap, evidence: ConflictEvidence | null) {
  // Only the two parties and their connector are drawn; the related and nearby context features are left out.
  const features = (evidence?.features ?? []).filter((f) => ["party", "connector"].includes(String(f.properties.feature)));
  (map.getSource("im-evidence") as GeoJSONSource | undefined)?.setData((features.length ? { type: "FeatureCollection", features } : EMPTY_COLLECTION) as never);
}

function applyOverlays(map: MlMap, exposed: MapFeature[] | null, lens: { type: "Polygon"; coordinates: number[][][] } | null, pin: [number, number] | null) {
  (map.getSource("im-exposed") as GeoJSONSource | undefined)?.setData((exposed?.length ? { type: "FeatureCollection", features: exposed } : EMPTY_COLLECTION) as never);
  (map.getSource("im-lens") as GeoJSONSource | undefined)?.setData((lens ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: lens }] } : EMPTY_COLLECTION) as never);
  (map.getSource("im-pin") as GeoJSONSource | undefined)?.setData((pin ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pin } }] } : EMPTY_COLLECTION) as never);
}

/** Needs-Attention base, then layer opacity and Focus multiplied on top of each layer's captured base paint value. */
function applyVisual(map: MlMap, v: Visual, bases: Map<string, unknown>) {
  const attentionBase = (id: string, prop: string): unknown => {
    if (!v.attention) return undefined;
    if (id === "im-assets-point" && prop === "icon-opacity") return ["case", ["==", ["get", "needsAttention"], true], 1, 0.25];
    if (id === "im-assets-attn" && prop === "circle-stroke-opacity") return ["case", ["==", ["get", "needsAttention"], true], 0.9, 0];
    return undefined;
  };
  for (const def of LAYER_DEFS) {
    const factor = layerFactor(def.id, v.focus, clampOpacity(v.opacity[def.id] ?? 1));
    for (const id of def.layerIds) {
      const type = map.getLayer(id)?.type;
      for (const prop of (type ? OPACITY_PROPS[type] : undefined) ?? []) {
        const key = `${id}\u0000${prop}`;
        if (!bases.has(key)) bases.set(key, map.getPaintProperty(id, prop as never));
        const base = attentionBase(id, prop) ?? bases.get(key);
        map.setPaintProperty(id, prop as never, scaleOpacity(base, factor) as never);
      }
    }
  }
}

/** Reorders layers inside the allowed bounds: conflicts (hotspots) stay above, point markers stay above hotspots, highlights stay on top. */
function applyOrder(map: MlMap, order: readonly LayerKey[]) {
  const baseAnchor = LAYER_BY_ID.conflicts.layerIds.find((id) => map.getLayer(id));
  const topAnchor = "im-exposed-fill";
  if (baseAnchor) {
    for (const k of order) {
      if (k === "conflicts") continue;
      const top = new Set(LAYER_BY_ID[k].topLayerIds);
      for (const id of LAYER_BY_ID[k].layerIds) if (!top.has(id) && map.getLayer(id)) map.moveLayer(id, baseAnchor);
    }
  }
  if (map.getLayer(topAnchor)) for (const k of order) for (const id of LAYER_BY_ID[k].topLayerIds) if (map.getLayer(id)) map.moveLayer(id, topAnchor);
}
