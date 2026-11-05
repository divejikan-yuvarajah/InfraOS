import type { ListKey } from "./filters-state";

/**
 * Static option lists that mirror the API's closed enums, used for the filter panel (counts come from /facets and may be
 * zero) and to validate values that arrive in a shared link. Provinces and districts are the 9 and 25 canonical names; the
 * API holds the approximate extents, this copy only carries the names and the province-to-district dependency.
 */
export const PROVINCE_DISTRICTS: readonly { name: string; districts: readonly string[] }[] = [
  { name: "Western Province", districts: ["Colombo", "Gampaha", "Kalutara"] },
  { name: "Central Province", districts: ["Kandy", "Matale", "Nuwara Eliya"] },
  { name: "Southern Province", districts: ["Galle", "Matara", "Hambantota"] },
  { name: "Northern Province", districts: ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"] },
  { name: "Eastern Province", districts: ["Batticaloa", "Ampara", "Trincomalee"] },
  { name: "North Western Province", districts: ["Kurunegala", "Puttalam"] },
  { name: "North Central Province", districts: ["Anuradhapura", "Polonnaruwa"] },
  { name: "Uva Province", districts: ["Badulla", "Monaragala"] },
  { name: "Sabaragamuwa Province", districts: ["Ratnapura", "Kegalle"] },
];
export const PROVINCE_NAMES = PROVINCE_DISTRICTS.map((p) => p.name);
export const DISTRICT_NAMES = PROVINCE_DISTRICTS.flatMap((p) => p.districts);

export const OPTIONS: Record<Exclude<ListKey, "agencyId" | "province" | "district">, readonly string[]> = {
  projectStatus: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED"],
  projectType: ["ROAD", "WATER", "ELECTRICITY", "TELECOM", "DRAINAGE", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "MULTI_INFRASTRUCTURE", "OTHER"],
  roadworkStatus: ["DRAFT", "SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"],
  workType: ["ROAD_RESURFACING", "ROAD_EXCAVATION", "PIPELINE_INSTALLATION", "ELECTRIC_CABLE_WORK", "TELECOM_CABLE_WORK", "DRAINAGE_WORK", "UTILITY_REPAIR", "BRIDGE_WORK", "OTHER"],
  conflictBand: ["info", "low", "medium", "high", "critical"],
  assetType: ["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"],
  condition: ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"],
  utilityClass: ["water", "drainage", "electricity", "telecom"],
  hazardType: ["FLOOD", "LANDSLIDE", "COASTAL", "INFRASTRUCTURE_DAMAGE", "OTHER"],
  hazardLevel: ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"],
  riskBand: ["LOW", "MEDIUM", "HIGH"],
};

export const isObjectId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
/** Whether a value may appear in a shared link for this facet. Unknown values are dropped, never passed on. */
export function validValue(key: ListKey, value: string): boolean {
  if (key === "agencyId") return isObjectId(value);
  if (key === "province") return PROVINCE_NAMES.includes(value);
  if (key === "district") return DISTRICT_NAMES.includes(value);
  return OPTIONS[key].includes(value);
}
export const districtsOf = (provinces: readonly string[]): string[] =>
  PROVINCE_DISTRICTS.filter((p) => provinces.length === 0 || provinces.includes(p.name)).flatMap((p) => [...p.districts]);
