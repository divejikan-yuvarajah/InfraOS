/**
 * Sri Lanka's 9 provinces and 25 districts with canonical English names and APPROXIMATE extents.
 * The boxes are generous envelopes for map navigation only (fit-to-place, place search). They are not boundaries,
 * overlap their neighbours, and must never be used for administrative or legal decisions. Nothing finer than a
 * district is included: there is no gazetteer of towns or streets and no geocoding.
 */
export type Bbox4 = [number, number, number, number]; // west, south, east, north

type DistrictDef = { name: string; province: string; bbox: Bbox4 };

const D = (name: string, province: string, bbox: Bbox4): DistrictDef => ({ name, province, bbox });

export const DISTRICTS: readonly DistrictDef[] = [
  D("Colombo", "Western Province", [79.82, 6.77, 80.2, 7.0]),
  D("Gampaha", "Western Province", [79.82, 6.85, 80.25, 7.3]),
  D("Kalutara", "Western Province", [79.9, 6.3, 80.4, 6.8]),
  D("Kandy", "Central Province", [80.35, 7.05, 80.95, 7.5]),
  D("Matale", "Central Province", [80.45, 7.4, 80.95, 7.95]),
  D("Nuwara Eliya", "Central Province", [80.55, 6.8, 81.0, 7.2]),
  D("Galle", "Southern Province", [79.95, 5.95, 80.45, 6.4]),
  D("Matara", "Southern Province", [80.35, 5.92, 80.8, 6.3]),
  D("Hambantota", "Southern Province", [80.6, 6.0, 81.5, 6.5]),
  D("Jaffna", "Northern Province", [79.7, 9.4, 80.4, 9.9]),
  D("Kilinochchi", "Northern Province", [80.1, 9.15, 80.7, 9.6]),
  D("Mannar", "Northern Province", [79.6, 8.6, 80.3, 9.2]),
  D("Vavuniya", "Northern Province", [80.3, 8.5, 80.85, 9.1]),
  D("Mullaitivu", "Northern Province", [80.4, 8.9, 81.0, 9.45]),
  D("Batticaloa", "Eastern Province", [81.3, 7.15, 81.9, 8.25]),
  D("Ampara", "Eastern Province", [81.3, 6.8, 82.0, 7.6]),
  D("Trincomalee", "Eastern Province", [80.8, 8.2, 81.35, 9.1]),
  D("Kurunegala", "North Western Province", [79.95, 7.3, 80.7, 8.0]),
  D("Puttalam", "North Western Province", [79.6, 7.55, 80.35, 8.5]),
  D("Anuradhapura", "North Central Province", [80.0, 8.0, 81.0, 9.0]),
  D("Polonnaruwa", "North Central Province", [80.7, 7.5, 81.3, 8.3]),
  D("Badulla", "Uva Province", [80.75, 6.5, 81.35, 7.3]),
  D("Monaragala", "Uva Province", [80.95, 6.2, 81.75, 7.2]),
  D("Ratnapura", "Sabaragamuwa Province", [80.25, 6.3, 80.95, 6.9]),
  D("Kegalle", "Sabaragamuwa Province", [80.15, 6.95, 80.55, 7.35]),
];

const union = (boxes: Bbox4[]): Bbox4 => [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];

export const PROVINCES: readonly { name: string; bbox: Bbox4; districts: string[] }[] = [...new Set(DISTRICTS.map((d) => d.province))].map((name) => {
  const own = DISTRICTS.filter((d) => d.province === name);
  return { name, bbox: union(own.map((d) => d.bbox)), districts: own.map((d) => d.name) };
});

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name) as [string, ...string[]];
export const PROVINCE_NAMES = PROVINCES.map((p) => p.name) as [string, ...string[]];

export const provinceOfDistrict = (district: string): string | null => DISTRICTS.find((d) => d.name.toLowerCase() === district.toLowerCase())?.province ?? null;

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
/** Name match for place search: exact, prefix, then contains. A province also matches without the word "Province". */
export function searchPlaces(query: string, limit = 5): { kind: "district" | "province"; name: string; province: string | null; bbox: Bbox4; rank: number }[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const rank = (name: string) => { const n = norm(name).replace(/ province$/, ""); return n === q || norm(name) === q ? 1 : n.startsWith(q) ? 2 : n.split(" ").some((w) => w.startsWith(q)) ? 3 : n.includes(q) ? 4 : 0; };
  return [
    ...DISTRICTS.map((d) => ({ kind: "district" as const, name: d.name, province: d.province, bbox: d.bbox, rank: rank(d.name) })),
    ...PROVINCES.map((p) => ({ kind: "province" as const, name: p.name, province: null, bbox: p.bbox, rank: rank(p.name) })),
  ].filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, limit);
}
