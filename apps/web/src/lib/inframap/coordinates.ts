/**
 * Coordinate input for the search box: "7.2906, 80.6337", "7.29N 80.63E", "7.29 N, 80.63 E", or a space/semicolon separated
 * pair. Pure and client-side; there is no external geocoder. A pair is only a coordinate if both numbers are plausible
 * latitude/longitude, and the result says whether it is inside Sri Lanka (with a margin). Without hemisphere letters the
 * first number is the latitude; "80.63, 7.29" is not guessed.
 */
export type ParsedCoordinates = { lat: number; lng: number; insideSriLanka: boolean };
export const SL_BOUNDS = { west: 79.4, south: 5.8, east: 82.1, north: 9.95 } as const;
const MARGIN = 0.5;

type Token = { value: number; hemi: "N" | "S" | "E" | "W" | null };
const TOKEN = /^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?\s*$/i;
const token = (s: string): Token | null => {
  const m = TOKEN.exec(s);
  return m ? { value: Number(m[1]), hemi: (m[2]?.toUpperCase() as Token["hemi"]) ?? null } : null;
};

export function parseCoordinates(input: string): ParsedCoordinates | null {
  const text = input.trim();
  if (text.length < 3 || text.length > 40) return null;
  const parts = text.split(/\s*[,;]\s*|\s+(?=-?\d)/).filter(Boolean);
  if (parts.length !== 2) return null;
  const a = token(parts[0]!), b = token(parts[1]!);
  if (!a || !b) return null;
  const isLat = (t: Token) => t.hemi === "N" || t.hemi === "S";
  const isLng = (t: Token) => t.hemi === "E" || t.hemi === "W";
  let latT: Token, lngT: Token;
  if (isLng(a) || isLat(b)) { lngT = a; latT = b; }
  else { latT = a; lngT = b; }
  if (isLng(latT) || isLat(lngT)) return null; // two latitudes or two longitudes
  const lat = latT.hemi === "S" ? -Math.abs(latT.value) : latT.value;
  const lng = lngT.hemi === "W" ? -Math.abs(lngT.value) : lngT.value;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, insideSriLanka: lat >= SL_BOUNDS.south - MARGIN && lat <= SL_BOUNDS.north + MARGIN && lng >= SL_BOUNDS.west - MARGIN && lng <= SL_BOUNDS.east + MARGIN };
}
