import type { LayerKey } from "./inframap";

/**
 * Workspace filter state: ONE object for every layer, with the same names the API accepts (see the server's unified filter
 * contract). Values inside a facet are OR, different facets are AND, and a filter that does not apply to a layer never
 * hides it (the server ignores it). Only the keys that apply to a layer go into that layer's request and cache key, so
 * changing a roadwork filter never refetches projects.
 */
export type UF = {
  agencyId: string[]; province: string[]; district: string[]; dateFrom: string; dateTo: string;
  projectStatus: string[]; projectType: string[];
  roadworkStatus: string[]; workType: string[]; overdue: boolean;
  conflictBand: string[]; conflictStatusGroup: "" | "open" | "resolved";
  assetType: string[]; condition: string[]; attention: boolean;
  utilityClass: string[];
  hazardType: string[]; hazardLevel: string[]; riskBand: string[];
};

export const EMPTY_UF: UF = {
  agencyId: [], province: [], district: [], dateFrom: "", dateTo: "", projectStatus: [], projectType: [], roadworkStatus: [], workType: [], overdue: false,
  conflictBand: [], conflictStatusGroup: "", assetType: [], condition: [], attention: false, utilityClass: [], hazardType: [], hazardLevel: [], riskBand: [],
};

export type ListKey = { [K in keyof UF]: UF[K] extends string[] ? K : never }[keyof UF];
export const LIST_KEYS: readonly ListKey[] = ["agencyId", "province", "district", "projectStatus", "projectType", "roadworkStatus", "workType", "conflictBand", "assetType", "condition", "utilityClass", "hazardType", "hazardLevel", "riskBand"];

const GLOBAL_KEYS = ["agencyId", "province", "district"] as const;
const DATE_KEYS = ["dateFrom", "dateTo"] as const;
export const LAYER_FILTER_KEYS: Record<LayerKey, readonly (keyof UF)[]> = {
  projects: [...GLOBAL_KEYS, ...DATE_KEYS, "projectStatus", "projectType"],
  roadworks: [...GLOBAL_KEYS, ...DATE_KEYS, "roadworkStatus", "workType", "overdue"],
  conflicts: [...GLOBAL_KEYS.filter((k) => k !== "province"), ...DATE_KEYS, "conflictBand", "conflictStatusGroup"],
  assets: [...GLOBAL_KEYS, "assetType", "condition", "attention"],
  utilities: [...GLOBAL_KEYS, "assetType", "utilityClass"],
  risks: ["agencyId", "hazardType", "hazardLevel", "riskBand"],
};

export const MAX_MULTI = 12;
const isActive = (v: UF[keyof UF]) => (Array.isArray(v) ? v.length > 0 : v === true || (typeof v === "string" && v !== ""));

/** `&key=a,b` for the keys that apply to the layer, in a stable order (also used as the cache key). */
export function ufParams(uf: UF, layer?: LayerKey): string {
  const keys = layer ? LAYER_FILTER_KEYS[layer] : (Object.keys(uf) as (keyof UF)[]);
  return [...keys].sort().filter((k) => isActive(uf[k])).map((k) => {
    const v = uf[k];
    return `&${k}=${encodeURIComponent(Array.isArray(v) ? v.slice(0, MAX_MULTI).join(",") : v === true ? "1" : String(v))}`;
  }).join("");
}

export type ActiveFilter = { key: keyof UF; value: string };
/** Flat list for the applied-filter chips: one entry per selected value (a date range is one chip per bound). */
export function activeFilters(uf: UF): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const k of LIST_KEYS) for (const v of uf[k]) out.push({ key: k, value: v });
  for (const k of ["dateFrom", "dateTo"] as const) if (uf[k]) out.push({ key: k, value: uf[k] });
  if (uf.overdue) out.push({ key: "overdue", value: "1" });
  if (uf.attention) out.push({ key: "attention", value: "1" });
  if (uf.conflictStatusGroup) out.push({ key: "conflictStatusGroup", value: uf.conflictStatusGroup });
  return out;
}
export const activeFilterCount = (uf: UF): number => activeFilters(uf).length;

export function removeFilter(uf: UF, f: ActiveFilter): UF {
  const cur = uf[f.key];
  if (Array.isArray(cur)) {
    const next = { ...uf, [f.key]: cur.filter((v) => v !== f.value) } as UF;
    // Clearing the last province also clears districts that depended on it is NOT done: districts stay valid on their own.
    return next;
  }
  return { ...uf, [f.key]: typeof cur === "boolean" ? false : "" } as UF;
}

/** Toggles one value of a multi-value facet, capped at MAX_MULTI. */
export function toggleValue(uf: UF, key: ListKey, value: string): UF {
  const cur = uf[key];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].slice(-MAX_MULTI);
  return { ...uf, [key]: next };
}

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
export type DatePreset = "thisMonth" | "next30" | "next90";
/** Quick date presets, computed from a supplied "today" so they are testable. */
export function datePreset(preset: DatePreset, today: Date): { dateFrom: string; dateTo: string } {
  const y = today.getUTCFullYear(), m = today.getUTCMonth();
  if (preset === "thisMonth") return { dateFrom: isoDay(new Date(Date.UTC(y, m, 1))), dateTo: isoDay(new Date(Date.UTC(y, m + 1, 0))) };
  const days = preset === "next30" ? 30 : 90;
  return { dateFrom: isoDay(today), dateTo: isoDay(new Date(today.getTime() + days * 86_400_000)) };
}

/** Deterministic one-click presets: which layers to show and which filters to set. Everything else is left as it was. */
export type FilterPreset = { id: string; layers: readonly LayerKey[]; filters: Partial<UF> };
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { id: "activeWork", layers: ["roadworks", "projects"], filters: { roadworkStatus: ["ACTIVE", "APPROVED"], projectStatus: ["ACTIVE"] } },
  { id: "overdueRoadworks", layers: ["roadworks"], filters: { overdue: true } },
  { id: "criticalConflicts", layers: ["conflicts"], filters: { conflictBand: ["critical", "high"], conflictStatusGroup: "open" } },
  { id: "attentionAssets", layers: ["assets"], filters: { attention: true } },
  { id: "highRisk", layers: ["risks", "roadworks"], filters: { hazardLevel: ["HIGH", "VERY_HIGH"], riskBand: ["HIGH"] } },
  { id: "unmapped", layers: ["projects"], filters: {} },
];

/** A preset replaces the filters it names and leaves the rest alone; it never touches the viewport or the selection. */
export const applyPreset = (uf: UF, preset: FilterPreset): UF => ({ ...EMPTY_UF, ...uf, ...preset.filters });
