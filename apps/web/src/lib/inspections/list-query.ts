import { INSPECTION_PRIORITIES, INSPECTION_STATUSES, INSPECTION_TYPES } from "./types";

/** Shareable list state kept in the URL. Parsing never trusts the string: unknown values are dropped, and every filter is applied by the server. */
export type ListFilters = {
  q: string; status: string[]; type: string; priority: string; inspectorId: string; projectId: string; dateFrom: string; dateTo: string;
  overdue: boolean; mine: boolean; needsReview: boolean; sort: "date_asc" | "date_desc"; page: number;
};
export const DEFAULT_FILTERS: ListFilters = { q: "", status: [], type: "", priority: "", inspectorId: "", projectId: "", dateFrom: "", dateTo: "", overdue: false, mine: false, needsReview: false, sort: "date_asc", page: 1 };

const oneOf = <T extends string>(allowed: readonly T[], v: string | null | undefined): string => (v && (allowed as readonly string[]).includes(v) ? v : "");
const isId = (v: string | null | undefined): string => (v && /^[a-f0-9]{24}$/i.test(v) ? v : "");
const isDay = (v: string | null | undefined): string => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseFilters(get: (k: string) => string | null): ListFilters {
  return {
    q: (get("q") ?? "").slice(0, 80),
    status: (get("status") ?? "").split(",").filter((s) => (INSPECTION_STATUSES as readonly string[]).includes(s)),
    type: oneOf(INSPECTION_TYPES, get("type")), priority: oneOf(INSPECTION_PRIORITIES, get("priority")),
    inspectorId: isId(get("inspectorId")), projectId: isId(get("projectId")), dateFrom: isDay(get("dateFrom")), dateTo: isDay(get("dateTo")),
    overdue: get("overdue") === "true", mine: get("mine") === "true", needsReview: get("needsReview") === "true",
    sort: get("sort") === "date_desc" ? "date_desc" : "date_asc", page: Math.max(1, Math.min(10_000, Number(get("page")) || 1)),
  };
}

/** Filters to the API query (day filters become whole Colombo days). */
export function toApiQuery(f: ListFilters, limit = 20): Record<string, string | number | boolean | undefined> {
  return {
    q: f.q || undefined, status: f.status.length ? f.status.join(",") : undefined, type: f.type || undefined, priority: f.priority || undefined,
    inspectorId: f.inspectorId || undefined, projectId: f.projectId || undefined,
    dateFrom: f.dateFrom ? new Date(`${f.dateFrom}T00:00:00.000+05:30`).toISOString() : undefined, dateTo: f.dateTo ? new Date(`${f.dateTo}T23:59:59.999+05:30`).toISOString() : undefined,
    overdue: f.overdue || undefined, mine: f.mine || undefined, needsReview: f.needsReview || undefined, sort: f.sort, page: f.page, limit,
  };
}

/** Filters to URL params (defaults omitted so URLs stay short). */
export function toParams(f: ListFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.status.length) sp.set("status", f.status.join(","));
  for (const k of ["type", "priority", "inspectorId", "projectId", "dateFrom", "dateTo"] as const) if (f[k]) sp.set(k, f[k]);
  for (const k of ["overdue", "mine", "needsReview"] as const) if (f[k]) sp.set(k, "true");
  if (f.sort !== "date_asc") sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}

export const activeFilterCount = (f: ListFilters): number => [f.q, f.type, f.priority, f.inspectorId, f.projectId, f.dateFrom, f.dateTo].filter(Boolean).length + f.status.length + [f.overdue, f.mine, f.needsReview].filter(Boolean).length;
