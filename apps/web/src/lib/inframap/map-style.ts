import type { StyleSpecification } from "maplibre-gl";

/**
 * OpenStreetMap is the data; tile servers are hosting services. The public tile.openstreetmap.org server is for light
 * dev and demo use only and its usage policy forbids heavy or production-scale use, so a deployment should set
 * NEXT_PUBLIC_MAP_STYLE_URL to a compliant provider or a self-hosted style. No API key is stored in this repository.
 */
const OSM_STYLE: StyleSpecification = {
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

/** Lat/long graticule (every 0.5 degrees) over Sri Lanka's extent, drawn as thin survey-sheet grid lines. */
function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lon = 78.5; lon <= 83.0001; lon += 0.5) {
    features.push({ type: "Feature", properties: { axis: "lon", major: Math.abs(lon % 1) < 1e-6 }, geometry: { type: "LineString", coordinates: [[lon, 4.9], [lon, 10.9]] } });
  }
  for (let lat = 5.0; lat <= 10.8001; lat += 0.5) {
    features.push({ type: "Feature", properties: { axis: "lat", major: Math.abs(lat % 1) < 1e-6 }, geometry: { type: "LineString", coordinates: [[78.4, lat], [83.1, lat]] } });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Self-contained basemap: Sri Lanka district polygons (Natural Earth, public domain, bundled in /public/maps) on a
 * survey-sheet grid. No tile server, no API key, so every map stays usable when external tiles are blocked.
 * `origin` makes the bundled file URL absolute because MapLibre fetches sources from a web worker.
 */
export function buildLocalGridStyle(origin: string): StyleSpecification {
  return {
    version: 8,
    name: "infraos-local-grid",
    sources: {
      districts: { type: "geojson", data: `${origin}/maps/sri-lanka-districts.geojson`, attribution: "Boundaries: Natural Earth (public domain)" },
      grid: { type: "geojson", data: graticule() },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": "#d7e6ee" } },
      { id: "grid-minor", type: "line", source: "grid", filter: ["!=", ["get", "major"], true], paint: { "line-color": "#8fa9b8", "line-opacity": 0.35, "line-width": 0.6, "line-dasharray": [2, 3] } },
      { id: "grid-major", type: "line", source: "grid", filter: ["==", ["get", "major"], true], paint: { "line-color": "#6f8fa3", "line-opacity": 0.55, "line-width": 0.9 } },
      { id: "land", type: "fill", source: "districts", paint: { "fill-color": "#f1efe4", "fill-opacity": 1 } },
      { id: "district-lines", type: "line", source: "districts", paint: { "line-color": "#a9a58f", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1.2], "line-opacity": 0.9 } },
      { id: "coast", type: "line", source: "districts", paint: { "line-color": "#5d7c8c", "line-width": 0.4, "line-opacity": 0.6 } },
    ],
  };
}

export type MapStyleVariant = "liberty" | "positron" | "bright";

/**
 * OpenFreeMap public vector styles (OpenMapTiles schema, OpenStreetMap data, no API key).
 * Required attribution ("OpenFreeMap © OpenMapTiles · Data from OpenStreetMap") is embedded
 * in the style specification and kept visible via MapLibre's AttributionControl.
 * Note: tile requests expose visitor IP addresses to the tile host (important for public portal privacy notices).
 */
export const OPENFREEMAP_STYLES: Record<MapStyleVariant, string> = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  bright: "https://tiles.openfreemap.org/styles/bright",
};

export const OPENFREEMAP_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap";
export const LOCAL_GRID_ATTRIBUTION = "Boundaries: Natural Earth (public domain)";

/** Opt-in online OpenStreetMap raster style (dev/demo only — never production default). */
export const MAP_STYLE: StyleSpecification = OSM_STYLE;

/**
 * One shared basemap resolver for every map in InfraOS. Order of precedence:
 *  1. a valid https NEXT_PUBLIC_MAP_STYLE_URL (MapTiler, Stadia, self-hosted PMTiles, etc.);
 *  2. NEXT_PUBLIC_MAP_BASEMAP=local: forces the bundled Sri Lanka survey-sheet grid immediately;
 *  3. NEXT_PUBLIC_MAP_BASEMAP=osm: dev-only opt-in OpenStreetMap raster tiles;
 *  4. default: OpenFreeMap vector style (positron for dense operational overlays, liberty for exploration).
 * Call attachBasemapFallback() on the MapLibre instance so blocked/offline networks automatically
 * switch to buildLocalGridStyle() without dead spinners.
 */
export function resolveMapStyle(variant: MapStyleVariant = "positron"): StyleSpecification | string {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (url) {
    try {
      if (new URL(url).protocol === "https:") return url;
    } catch {
      /* invalid URL: fall back to the default style */
    }
  }
  const basemap = process.env.NEXT_PUBLIC_MAP_BASEMAP?.trim().toLowerCase();
  if (basemap === "local") {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return buildLocalGridStyle(origin);
  }
  if (basemap === "osm") {
    const glyphs = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
    return { ...OSM_STYLE, glyphs };
  }
  return OPENFREEMAP_STYLES[variant];
}

type FallbackMapLike = {
  on(event: string, fn: (e?: unknown) => void): void;
  setStyle(style: StyleSpecification | string): void;
  isStyleLoaded?: () => boolean | void;
};

/**
 * Resilience safety net: if a remote vector style/tile host fails to load (blocked network, CSP,
 * provider outage, or timeout), automatically switch the MapLibre instance to the bundled
 * Sri Lanka survey-sheet GeoJSON + graticule basemap and notify the caller so an "Offline basemap"
 * badge can be shown. Safe to call on every map; no-op when already using the local grid.
 */
export function attachBasemapFallback(
  map: FallbackMapLike,
  initialStyle: StyleSpecification | string,
  options: { onFallback?: (offline: boolean) => void; timeoutMs?: number } = {},
): () => void {
  if (typeof initialStyle !== "string") {
    if (initialStyle.name === "infraos-local-grid") options.onFallback?.(true);
    return () => undefined;
  }

  let fallenBack = false;
  let loaded = false;
  const trigger = () => {
    if (fallenBack) return;
    fallenBack = true;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    map.setStyle(buildLocalGridStyle(origin));
    options.onFallback?.(true);
  };

  const timer = setTimeout(() => {
    if (!loaded && !map.isStyleLoaded?.()) trigger();
  }, options.timeoutMs ?? 6500);

  map.on("load", () => {
    loaded = true;
    clearTimeout(timer);
  });

  map.on("error", (e) => {
    const err = e as { sourceId?: string; error?: { status?: number; message?: string } } | undefined;
    const sourceId = err?.sourceId;
    // Ignore errors from app-owned GeoJSON overlay sources; fall back on basemap style/tile failures.
    if (sourceId && (sourceId.startsWith("im-") || sourceId === "shapes" || sourceId === "pins" || sourceId === "dossier" || sourceId === "public-features")) {
      return;
    }
    if (!loaded) {
      clearTimeout(timer);
      trigger();
    }
  });

  return () => clearTimeout(timer);
}

export type BasemapChoice = MapStyleVariant | "local";

/** Resolves an explicit user basemap choice from the in-map Google-Maps-style switcher. */
export function resolveBasemapChoice(choice: BasemapChoice): StyleSpecification | string {
  if (choice === "local") {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return buildLocalGridStyle(origin);
  }
  return OPENFREEMAP_STYLES[choice];
}

export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [[79.4, 5.8], [82.1, 9.95]];
/** Tighter bounds around Sri Lanka so panning never drifts out into empty Indian Ocean. */
export const SRI_LANKA_MAX_BOUNDS: [[number, number], [number, number]] = [[79.0, 5.5], [82.4, 10.2]];
