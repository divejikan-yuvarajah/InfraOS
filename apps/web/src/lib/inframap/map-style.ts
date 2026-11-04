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

/** Free OpenStreetMap raster tiles: no API key, attribution always visible. Used by RoadSync's map as before. */
export const MAP_STYLE: StyleSpecification = OSM_STYLE;

/** InfraMap style: a valid https NEXT_PUBLIC_MAP_STYLE_URL wins, otherwise the OSM raster style above. */
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
  return { ...OSM_STYLE, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf" };
}

export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [[79.4, 5.8], [82.1, 9.95]];
/** Slightly larger than the island so panning never drifts into empty ocean. */
export const SRI_LANKA_MAX_BOUNDS: [[number, number], [number, number]] = [[78.4, 4.9], [83.1, 10.9]];
