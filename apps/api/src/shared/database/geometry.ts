import { Schema } from "mongoose";

type Position = [number, number];
export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] };

function position(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

/** Basic bounded GeoJSON structure. Spatial indexes/topology are Step 14. */
export function validGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== "object") return false;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if (type === "Point") return position(coordinates);
  if (!Array.isArray(coordinates) || coordinates.length > 10_000) return false;
  if (type === "LineString") return coordinates.length >= 2 && Array.from(coordinates).every(position);
  if (type !== "Polygon" || coordinates.length < 1 || coordinates.length > 100) return false;
  let count = 0;
  return Array.from(coordinates).every((ring: unknown) => {
    if (!Array.isArray(ring) || ring.length < 4 || !Array.from(ring).every(position)) return false;
    count += ring.length;
    const first = ring[0] as Position;
    const last = ring[ring.length - 1] as Position;
    return count <= 10_000 && first[0] === last[0] && first[1] === last[1];
  });
}

export const geometrySchema = new Schema<Geometry>({
  type: { type: String, required: true, enum: ["Point", "LineString", "Polygon"] },
  // Coordinates have different nesting depths; validation covers the entire union.
  coordinates: { type: Schema.Types.Mixed, required: true },
}, { _id: false, strict: "throw" });

export const geometryField = (required = false) => ({
  type: geometrySchema,
  required,
  validate: { validator: validGeometry, message: "Invalid GeoJSON geometry" },
});
