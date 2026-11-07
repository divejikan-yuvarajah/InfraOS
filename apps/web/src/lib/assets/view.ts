import type { AuthLocale } from "@/lib/auth/types";
import { formatLkr } from "@/lib/finance/money";
import { fill, fmtDate, fmtDateTime, fmtDayLong, fmtMonth } from "@/lib/inspections/view";

import type { AssetCondition, Basis, Health } from "./types";

export { fill, fmtDate, fmtDateTime, fmtDayLong, fmtMonth };
export const money = (minor: number | null | undefined, l: AuthLocale): string => (minor === null || minor === undefined ? "—" : formatLkr(minor, l));

/** Condition ring: how many of five segments are filled. UNKNOWN is empty (never a made-up level). */
export const CONDITION_FILL: Record<AssetCondition, number> = { EXCELLENT: 5, GOOD: 4, FAIR: 3, POOR: 2, CRITICAL: 1, UNKNOWN: 0 };
export const CONDITION_TONE: Record<AssetCondition, "success" | "active" | "pending" | "critical" | "neutral"> = { EXCELLENT: "success", GOOD: "success", FAIR: "pending", POOR: "critical", CRITICAL: "critical", UNKNOWN: "neutral" };
export const BAND_TONE = { GOOD: "success", WATCH: "pending", POOR: "critical", CRITICAL: "critical" } as const;
export const basisTone = (b: Basis): "success" | "pending" | "neutral" => (b === "INSPECTION_VERIFIED" ? "success" : b === "MANUAL_ENTRY" ? "pending" : "neutral");

export const isHealthFull = (h: Health): h is Exclude<Health, { restricted: true }> => !("restricted" in h);

/** Semicircle gauge geometry for a 0-100 score (viewBox 0 0 120 70). */
export function gaugeArc(score: number, r = 52): { track: string; value: string } {
  const pt = (t: number) => `${60 + r * Math.cos(Math.PI * (1 - t))} ${62 - r * Math.sin(Math.PI * (1 - t))}`;
  const arc = (t: number) => `M ${pt(0)} A ${r} ${r} 0 0 1 ${pt(t)}`;
  const t = Math.max(0, Math.min(1, score / 100));
  return { track: arc(0.9999), value: t <= 0 ? "" : arc(Math.min(t, 0.9999)) };
}

/** Donut slices as stroke-dasharray values on a circle of circumference 100. */
export function donutSlices(parts: { key: string; n: number }[]): { key: string; n: number; dash: string; offset: number }[] {
  const total = parts.reduce((s, p) => s + p.n, 0);
  let acc = 0;
  return parts.filter((p) => p.n > 0).map((p) => {
    const len = total ? (p.n / total) * 100 : 0;
    const s = { key: p.key, n: p.n, dash: `${len} ${100 - len}`, offset: 25 - acc };
    acc += len;
    return s;
  });
}

export type AssetFilters = { q: string; assetType: string; condition: string; operationalStatus: string; agencyId: string; district: string; healthBand: string; attention: boolean; dlp: boolean; hasOpenMaintenance: boolean; projectId: string; sort: string; page: number };
export const DEFAULT_ASSET_FILTERS: AssetFilters = { q: "", assetType: "", condition: "", operationalStatus: "", agencyId: "", district: "", healthBand: "", attention: false, dlp: false, hasOpenMaintenance: false, projectId: "", sort: "recent", page: 1 };
export const SORTS = ["recent", "name", "condition", "health", "nextMaintenance"] as const;

export function parseAssetFilters(get: (k: string) => string | null): AssetFilters {
  const sort = get("sort") ?? "";
  return {
    q: (get("q") ?? "").slice(0, 80), assetType: get("assetType") ?? "", condition: get("condition") ?? "", operationalStatus: get("operationalStatus") ?? "", agencyId: get("agencyId") ?? "", district: get("district") ?? "",
    healthBand: get("healthBand") ?? "", attention: get("attention") === "true", dlp: get("dlp") === "true", hasOpenMaintenance: get("hasOpenMaintenance") === "true", projectId: get("projectId") ?? "",
    sort: (SORTS as readonly string[]).includes(sort) ? sort : "recent", page: Math.max(1, Math.min(10_000, Number(get("page")) || 1)),
  };
}
export function assetParams(f: AssetFilters): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string) => { if (v) p.set(k, v); };
  set("q", f.q); set("assetType", f.assetType); set("condition", f.condition); set("operationalStatus", f.operationalStatus); set("agencyId", f.agencyId); set("district", f.district); set("healthBand", f.healthBand); set("projectId", f.projectId);
  if (f.attention) p.set("attention", "true");
  if (f.dlp) p.set("dlp", "true");
  if (f.hasOpenMaintenance) p.set("hasOpenMaintenance", "true");
  if (f.sort !== "recent") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
export const assetApiQuery = (f: AssetFilters, limit?: number): Record<string, string | number | boolean | undefined> => ({
  q: f.q || undefined, assetType: f.assetType || undefined, condition: f.condition || undefined, operationalStatus: f.operationalStatus || undefined, agencyId: f.agencyId || undefined, district: f.district || undefined,
  healthBand: f.healthBand || undefined, projectId: f.projectId || undefined, attention: f.attention || undefined, dlp: f.dlp || undefined, hasOpenMaintenance: f.hasOpenMaintenance || undefined, sort: f.sort, page: f.page, limit,
});
export const activeAssetFilterCount = (f: AssetFilters): number => [f.q, f.assetType, f.condition, f.operationalStatus, f.agencyId, f.district, f.healthBand, f.projectId].filter(Boolean).length + [f.attention, f.dlp, f.hasOpenMaintenance].filter(Boolean).length;

export type MaintFilters = { q: string; status: string; type: string; priority: string; dateFrom: string; dateTo: string; overdue: boolean; mine: boolean; assetId: string; sort: string; page: number };
export const DEFAULT_MAINT_FILTERS: MaintFilters = { q: "", status: "", type: "", priority: "", dateFrom: "", dateTo: "", overdue: false, mine: false, assetId: "", sort: "date_asc", page: 1 };
export function parseMaintFilters(get: (k: string) => string | null): MaintFilters {
  const sort = get("sort") ?? "";
  return { q: (get("q") ?? "").slice(0, 80), status: get("status") ?? "", type: get("type") ?? "", priority: get("priority") ?? "", dateFrom: get("dateFrom") ?? "", dateTo: get("dateTo") ?? "", overdue: get("overdue") === "true", mine: get("mine") === "true", assetId: get("assetId") ?? "", sort: ["date_asc", "date_desc", "priority"].includes(sort) ? sort : "date_asc", page: Math.max(1, Math.min(10_000, Number(get("page")) || 1)) };
}
export function maintParams(f: MaintFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of ["q", "status", "type", "priority", "dateFrom", "dateTo", "assetId"] as const) if (f[k]) p.set(k, f[k]);
  if (f.overdue) p.set("overdue", "true");
  if (f.mine) p.set("mine", "true");
  if (f.sort !== "date_asc") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
export const maintApiQuery = (f: MaintFilters, limit?: number): Record<string, string | number | boolean | undefined> => ({
  q: f.q || undefined, status: f.status || undefined, type: f.type || undefined, priority: f.priority || undefined, dateFrom: f.dateFrom || undefined, dateTo: f.dateTo || undefined, overdue: f.overdue || undefined, mine: f.mine || undefined, assetId: f.assetId || undefined, sort: f.sort, page: f.page, limit,
});
export const activeMaintFilterCount = (f: MaintFilters): number => [f.q, f.status, f.type, f.priority, f.dateFrom, f.dateTo, f.assetId].filter(Boolean).length + [f.overdue, f.mine].filter(Boolean).length;

export const reasonOk = (v: string): boolean => v.trim().length >= 12;
export const MAINT_STEPS = ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"] as const;
