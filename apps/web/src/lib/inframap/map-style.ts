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

/** Opt-in online OpenStreetMap raster style (see resolveMapStyle). */
export const MAP_STYLE: StyleSpecification = OSM_STYLE;

/**
 * One basemap for every map. Order of precedence:
 *  1. a valid https NEXT_PUBLIC_MAP_STYLE_URL (a compliant hosted style);
 *  2. NEXT_PUBLIC_MAP_BASEMAP=osm: opt-in OpenStreetMap raster tiles (online enhancement, needs network);
 *  3. default: the self-contained local grid, which never depends on an external tile server.
 */
export function resolveMapStyle(): StyleSpecification | string {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (url) {
    try {
      if (new URL(url).protocol === "https:") return url;
    } catch {
      /* invalid URL: fall back to the default style */
    }
  }
  // Glyphs are needed only for cluster counts. A failed glyph request hides the numbers; markers still draw.
  const glyphs = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
  if (process.env.NEXT_PUBLIC_MAP_BASEMAP?.trim().toLowerCase() === "osm") return { ...OSM_STYLE, glyphs };
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return { ...buildLocalGridStyle(origin), glyphs };
}

export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [[79.4, 5.8], [82.1, 9.95]];
/** Slightly larger than the island so panning never drifts into empty ocean. */
export const SRI_LANKA_MAX_BOUNDS: [[number, number], [number, number]] = [[78.4, 4.9], [83.1, 10.9]];
