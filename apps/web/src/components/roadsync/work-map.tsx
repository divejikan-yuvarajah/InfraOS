"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { DownloadIcon, Trash2Icon, Undo2Icon, UploadIcon } from "lucide-react";

import { validateGeo, type GeoValidation, type WorkMapFeature } from "@/lib/roadsync/api";
import { NEAR_TIME_COLOR, OVERLAP_COLOR, type NearbyOverlay } from "@/lib/roadsync/nearby";
import { parseGeometryText, type GeometryInput, type GeometryKind, type Position } from "@/lib/roadsync/work-requests-view";

/**
 * Steps 68-69 nearby overlay: dashed search area, candidate shapes (halo by time relation), dotted connectors.
 * Layers are created once per map and removed with it on unmount.
 */
function useNearbyOverlay(mapRef: React.RefObject<MlMap | null>, ready: boolean, overlay: NearbyOverlay | null | undefined) {
  const selectRef = useRef(overlay?.onSelect);
  useEffect(() => { selectRef.current = overlay?.onSelect; });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!map.getSource("nearby")) {
      map.addSource("nearby", { type: "geojson", data: EMPTY as never });
      const is = (kind: string) => ["==", ["get", "kind"], kind] as never;
      const cand = ["all", is("candidate"), ["!=", ["geometry-type"], "Point"]] as never;
      map.addLayer({ id: "nearby-area", type: "line", source: "nearby", filter: is("area"), paint: { "line-color": "#0f172a", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.6 } });
      map.addLayer({ id: "nearby-fill", type: "fill", source: "nearby", filter: ["all", is("candidate"), ["==", ["geometry-type"], "Polygon"]] as never, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 } });
      map.addLayer({ id: "nearby-halo", type: "line", source: "nearby", filter: cand, paint: { "line-color": ["match", ["get", "tone"], "overlap", OVERLAP_COLOR, "near", NEAR_TIME_COLOR, "rgba(0,0,0,0)"], "line-width": 11, "line-opacity": 0.45 } });
      map.addLayer({ id: "nearby-casing", type: "line", source: "nearby", filter: cand, paint: { "line-color": "#ffffff", "line-width": 6 } });
      map.addLayer({ id: "nearby-line", type: "line", source: "nearby", filter: cand, paint: { "line-color": ["get", "color"], "line-width": ["match", ["get", "tone"], "overlap", 4.5, 3], "line-opacity": ["match", ["get", "tone"], "other", 0.65, 1] } });
      map.addLayer({ id: "nearby-connector", type: "line", source: "nearby", filter: is("connector"), paint: { "line-color": "#334155", "line-width": 1.5, "line-dasharray": [1, 2] } });
      map.addLayer({ id: "nearby-point", type: "circle", source: "nearby", filter: ["all", is("candidate"), ["==", ["geometry-type"], "Point"]] as never, paint: { "circle-radius": 7, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      map.addLayer({ id: "nearby-selected", type: "line", source: "nearby", filter: ["==", ["get", "key"], ""] as never, paint: { "line-color": "#f59e0b", "line-width": 13, "line-opacity": 0.55 } });
      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ["nearby-line", "nearby-fill", "nearby-point"] })[0];
        const key = hit?.properties?.key;
        if (typeof key === "string") selectRef.current?.(key);
      });
    }
    (map.getSource("nearby") as GeoJSONSource).setData({ type: "FeatureCollection", features: overlay?.features ?? [] } as never);
    map.setFilter("nearby-selected", ["all", ["==", ["get", "key"], overlay?.selectedKey ?? ""], ["==", ["get", "kind"], "candidate"]] as never);
    if (overlay?.selectedKey) {
      const f = (overlay.features as { properties?: { key?: string; kind?: string }; geometry: GeometryInput }[]).find((x) => x.properties?.key === overlay.selectedKey && x.properties?.kind === "candidate");
      const b = f ? boundsOf([f.geometry]) : null;
      if (b) map.fitBounds(b, { padding: 80, maxZoom: 17, duration: 400 });
    }
  }, [overlay, ready, mapRef]);
}

/** Free OpenStreetMap raster tiles: no API key, attribution always visible. */
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
const SRI_LANKA: [[number, number], [number, number]] = [[79.4, 5.8], [82.1, 9.95]];
const ACCENT = "#c2410c";
const EMPTY = { type: "FeatureCollection" as const, features: [] as unknown[] };

function boundsOf(geometries: GeometryInput[]): [[number, number], [number, number]] | null {
  const pts: Position[] = geometries.flatMap((g) => (g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.coordinates[0] ?? []));
  if (!pts.length) return null;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

/** Creates one MapLibre map, adds the shared layers and disposes everything on unmount. */
function useMap(container: React.RefObject<HTMLDivElement | null>, onReady: (map: MlMap) => void) {
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(onReady);
  useEffect(() => { readyRef.current = onReady; });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let observer: ResizeObserver | null = null;
    void import("maplibre-gl").then((ml) => {
      if (cancelled || !container.current) return;
      // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file explicitly.
      if (!ml.getWorkerUrl()) ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      const created = new ml.Map({ container: container.current, style: STYLE, bounds: SRI_LANKA, attributionControl: { compact: false } });
      map = created;
      // Keep the canvas matched to its box when the layout settles or the viewport changes.
      observer = new ResizeObserver(() => created.resize());
      observer.observe(container.current);
      created.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      created.once("style.load", () => {
        const map = created;
        map.addSource("shapes", { type: "geojson", data: EMPTY as never });
        map.addLayer({ id: "shape-fill", type: "fill", source: "shapes", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["coalesce", ["get", "color"], ACCENT], "fill-opacity": 0.18 } });
        map.addLayer({ id: "shape-casing", type: "line", source: "shapes", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#ffffff", "line-width": 7 } });
        map.addLayer({ id: "shape-line", type: "line", source: "shapes", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": ["coalesce", ["get", "color"], ACCENT], "line-width": 4, "line-dasharray": ["case", ["==", ["get", "status"], "DRAFT"], ["literal", [2, 1]], ["literal", [1, 0]]] } });
        map.addLayer({ id: "shape-point", type: "circle", source: "shapes", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 8, "circle-color": ["coalesce", ["get", "color"], ACCENT], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        mapRef.current = map;
        readyRef.current(map);
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [container]);
  return { mapRef, ready };
}

function setShapes(map: MlMap | null, features: unknown[], vertices: Position[] = []) {
  const src = map?.getSource("shapes") as GeoJSONSource | undefined;
  src?.setData({ type: "FeatureCollection", features } as never);
  const v = map?.getSource("vertices") as GeoJSONSource | undefined;
  v?.setData({ type: "FeatureCollection", features: vertices.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } })) } as never);
}

/* ---------- read-only map (detail page and overview) ---------- */

const STATUS_COLOR: Record<string, string> = { DRAFT: "#64748b", SUBMITTED: "#1d4ed8", PLANNED: "#0f766e", APPROVED: "#15803d", ACTIVE: "#c2410c", COMPLETED: "#334155", CANCELLED: "#9ca3af" };

export function WorkMap({ features, height = 320, label, onSelect, overlay }: { features: WorkMapFeature[] | { geometry: GeometryInput }[]; height?: number | string; label: string; onSelect?: (id: string) => void; overlay?: NearbyOverlay | null }) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; });
  const { mapRef, ready } = useMap(container, (map) => {
    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ["shape-fill", "shape-line", "shape-point"] })[0];
      const id = hit?.properties?.id;
      if (typeof id === "string") selectRef.current?.(id);
    });
    for (const layer of ["shape-fill", "shape-line", "shape-point"]) {
      map.on("mouseenter", layer, () => { if (selectRef.current) map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
  });
  useNearbyOverlay(mapRef, ready, overlay);
  useEffect(() => {
    if (!ready) return;
    const list = features.map((f) => {
      const props = "properties" in f ? f.properties : undefined;
      return { type: "Feature", geometry: f.geometry, properties: props ? { id: props.id, status: props.status, color: STATUS_COLOR[props.status] ?? ACCENT } : {} };
    });
    setShapes(mapRef.current, list);
    const b = boundsOf(features.map((f) => f.geometry));
    if (b) mapRef.current?.fitBounds(b, { padding: 48, maxZoom: 17, duration: 0 });
  }, [features, ready, mapRef]);
  return <div ref={container} className="rs-map" style={{ height }} role="region" aria-label={label} />;
}

/* ---------- location picker (create form) ---------- */

function toText(g: GeometryInput): string {
  const pts = g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : (g.coordinates[0] ?? []).slice(0, -1);
  return pts.map((p) => `${p[0]}, ${p[1]}`).join("\n");
}

function fmtMetrics(v: GeoValidation | null): string | null {
  const d = v?.valid ? v.derived : undefined;
  if (!d) return null;
  const parts: string[] = [];
  if (d.areaSqMeters !== null) parts.push(d.areaSqMeters >= 10_000 ? `${(d.areaSqMeters / 10_000).toFixed(2)} ha` : `${d.areaSqMeters.toLocaleString()} m²`);
  else if (d.lengthMeters !== null) parts.push(d.lengthMeters >= 1000 ? `${(d.lengthMeters / 1000).toFixed(2)} km` : `${Math.round(d.lengthMeters)} m`);
  parts.push(`${d.vertexCount} ${d.vertexCount === 1 ? "vertex" : "vertices"}`);
  parts.push(`${d.centroid[1].toFixed(5)}, ${d.centroid[0].toFixed(5)}`);
  return parts.join(" · ");
}

type PickerProps = {
  kind: GeometryKind;
  coordinates: string;
  onChange: (kind: GeometryKind, coordinates: string) => void;
  onValidity?: (valid: boolean | null) => void;
  overlay?: NearbyOverlay | null;
};

/**
 * Click the map to add vertices of the chosen geometry type. The coordinate text stays the single value,
 * so the keyboard path (typing coordinates) and the map always agree. The server check is authoritative.
 */
export function LocationPicker({ kind, coordinates, onChange, onValidity, overlay }: PickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const state = useRef({ kind, coordinates });
  const changeRef = useRef(onChange);
  useEffect(() => { state.current = { kind, coordinates }; changeRef.current = onChange; });
  // A result is shown only for the geometry it was computed for, so stale checks never display.
  const [result, setResult] = useState<{ key: string; value: GeoValidation | null }>({ key: "", value: null });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ geojson: unknown; candidates: GeoValidation["candidates"] } | null>(null);

  const { mapRef, ready } = useMap(container, (map) => {
    map.addSource("vertices", { type: "geojson", data: EMPTY as never });
    map.addLayer({ id: "vertex", type: "circle", source: "vertices", paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": ACCENT, "circle-stroke-width": 2 } });
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", (e) => {
      const { kind: k, coordinates: text } = state.current;
      const line = `${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}`;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      changeRef.current(k, k === "Point" ? line : [...lines, line].join("\n"));
    });
  });

  useNearbyOverlay(mapRef, ready, overlay);
  const parsed = coordinates.trim() ? parseGeometryText(kind, coordinates) : null;
  const geometry = parsed?.ok ? parsed.geometry : null;
  const geoKey = geometry ? JSON.stringify(geometry) : "";
  const check = result.key === geoKey ? result.value : null;
  const checking = Boolean(geoKey) && result.key !== geoKey;

  // Draw the current shape, plus the raw vertices while a line or area is still incomplete.
  useEffect(() => {
    if (!ready) return;
    const pts: Position[] = coordinates.split(/\r?\n/).map((l) => l.split(/[\s,;]+/).filter(Boolean).map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)) as Position[];
    setShapes(mapRef.current, geometry ? [{ type: "Feature", properties: { status: "DRAFT" }, geometry }] : [], kind === "Point" ? [] : pts);
  }, [ready, geoKey, coordinates, kind, geometry, mapRef]);

  // Debounced authoritative check (400 ms after the last edit).
  useEffect(() => {
    onValidity?.(null);
    if (!geoKey) return;
    let live = true;
    const timer = window.setTimeout(() => {
      validateGeo(JSON.parse(geoKey))
        .then((r) => { if (live) { setResult({ key: geoKey, value: r }); onValidity?.(r.valid); } })
        .catch(() => { if (live) setResult({ key: geoKey, value: null }); });
    }, 400);
    return () => { live = false; window.clearTimeout(timer); };
  }, [geoKey, onValidity]);

  function applyGeometry(g: GeometryInput) {
    onChange(g.type, toText(g));
    const b = boundsOf([g]);
    if (b) mapRef.current?.fitBounds(b, { padding: 48, maxZoom: 17 });
  }

  async function importGeoJson(text: string, pick?: number) {
    setImportMsg(null);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setImportMsg("The file is not valid JSON.");
      return;
    }
    if (pick !== undefined && json && typeof json === "object" && Array.isArray((json as { features?: unknown }).features)) {
      json = (json as { features: unknown[] }).features[pick];
    }
    try {
      const r = await validateGeo(json);
      if (r.candidates.length > 1) {
        setPending({ geojson: text, candidates: r.candidates });
        setImportMsg(`The file has ${r.candidates.length} shapes. Choose one.`);
        return;
      }
      setPending(null);
      if (r.valid && r.geometry) {
        applyGeometry(r.geometry);
        setImportMsg("Imported. The shape was checked by the server.");
      } else {
        setImportMsg(r.errors?.map((e) => e.message).join(" ") || "The shape could not be used.");
      }
    } catch {
      setImportMsg("The shape could not be checked right now. Try again shortly.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 900_000) {
      setImportMsg("The file is larger than 900 KB.");
      return;
    }
    await importGeoJson(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportGeoJson() {
    if (!check?.valid || !check.geometry) return;
    const blob = new Blob([JSON.stringify({ type: "Feature", properties: {}, geometry: check.geometry }, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "work-request-location.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }

  const lines = coordinates.split(/\r?\n/).filter((l) => l.trim());
  const metrics = fmtMetrics(check);
  const hint = kind === "Point" ? "Click the map to place the point." : kind === "LineString" ? "Click the map to add each vertex along the corridor, in order." : "Click the map to add each corner. The area closes automatically.";

  return (
    <div className="rs-picker">
      <div className="rs-picker-tools" role="toolbar" aria-label="Map location tools">
        <button type="button" className="rs-btn" onClick={() => onChange(kind, lines.slice(0, -1).join("\n"))} disabled={!lines.length}><Undo2Icon aria-hidden="true" />Undo point</button>
        <button type="button" className="rs-btn" onClick={() => onChange(kind, "")} disabled={!lines.length}><Trash2Icon aria-hidden="true" />Clear</button>
        <button type="button" className="rs-btn" onClick={() => fileRef.current?.click()}><UploadIcon aria-hidden="true" />Import GeoJSON</button>
        <button type="button" className="rs-btn" onClick={exportGeoJson} disabled={!check?.valid}><DownloadIcon aria-hidden="true" />Download GeoJSON</button>
        <input ref={fileRef} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <p className="rs-help">{hint}</p>
      <div ref={container} className="rs-map" style={{ height: 360 }} role="region" aria-label="Location map. Click to add points; you can also type coordinates below." />
      {pending ? (
        <ul className="rs-candidates" aria-label="Shapes in the file">
          {pending.candidates.map((c) => (
            <li key={c.index}>
              <button type="button" className="rs-btn" disabled={!c.valid} onClick={() => void importGeoJson(String(pending.geojson), c.index)}>
                {c.label} · {c.type}{c.valid ? "" : " (not valid)"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {importMsg ? <p className="rs-help" role="status">{importMsg}</p> : null}
      <div className="rs-geo-status" aria-live="polite">
        {!geometry ? null : checking ? (
          <p className="rs-help">Checking the shape…</p>
        ) : check?.valid ? (
          <p className="rs-geo-ok">Geometry valid{metrics ? ` · ${metrics}` : ""}{check.warnings.length ? ` · ${check.warnings.join(" ")}` : ""}</p>
        ) : check ? (
          <ul className="rs-error">{check.errors?.map((e) => <li key={e.code}>{e.message}</li>)}</ul>
        ) : (
          <p className="rs-help">The server check is unavailable right now. The shape is checked again when the draft is saved.</p>
        )}
      </div>
    </div>
  );
}
