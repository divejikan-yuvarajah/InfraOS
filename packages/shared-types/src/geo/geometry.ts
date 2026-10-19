/** Longitude, latitude. WGS84. */
export type LngLat = readonly [longitude: number, latitude: number];

export interface GeoPoint {
  type: "Point";
  coordinates: LngLat;
}

export interface GeoLineString {
  type: "LineString";
  coordinates: readonly LngLat[];
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: readonly (readonly LngLat[])[];
}

export type InfraGeometry = GeoPoint | GeoLineString | GeoPolygon;

export const GEOMETRY_TYPES = ["Point", "LineString", "Polygon"] as const;

/** [west, south, east, north] in degrees. */
export type MapBounds = readonly [west: number, south: number, east: number, north: number];

export interface MapViewportQuery {
  bounds: MapBounds;
}

export const MAP_LAYER_KEYS = [
  "projects",
  "workRequests",
  "assets",
  "citizenIssues",
] as const;

export type MapLayerKey = (typeof MAP_LAYER_KEYS)[number];

export interface MapFeatureDto {
  id: string;
  layer: MapLayerKey;
  geometry: InfraGeometry;
  title: string;
  status: string;
}

function isFinitePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

/** Structural wire check. Not a topology or conflict engine. */
export function isInfraGeometry(value: unknown): value is InfraGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type === "Point") return isFinitePair(geometry.coordinates);
  if (!Array.isArray(geometry.coordinates)) return false;
  if (geometry.type === "LineString") {
    return geometry.coordinates.length >= 2 && geometry.coordinates.every(isFinitePair);
  }
  if (geometry.type !== "Polygon") return false;
  return geometry.coordinates.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(isFinitePair),
  );
}
