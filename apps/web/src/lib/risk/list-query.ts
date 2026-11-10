import type { RiskListFilters } from "./types";

export function buildRiskQueryString(filters: RiskListFilters): string {
  const params = new URLSearchParams();

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.agencyId?.trim()) params.set("agencyId", filters.agencyId.trim());
  if (filters.projectType?.trim()) params.set("projectType", filters.projectType.trim());
  if (filters.status?.trim()) params.set("status", filters.status.trim());
  if (filters.level?.trim()) params.set("level", filters.level.trim());
  if (filters.category?.trim()) params.set("category", filters.category.trim());
  if (filters.sufficiency?.trim()) params.set("sufficiency", filters.sufficiency.trim());
  if (filters.resolution?.trim()) params.set("resolution", filters.resolution.trim());
  if (filters.stale) params.set("stale", "1");
  if (filters.district?.trim()) params.set("district", filters.district.trim());
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit && filters.limit !== 20) params.set("limit", String(filters.limit));

  return params.toString();
}

export function parseRiskQueryParams(searchParams: URLSearchParams): RiskListFilters {
  return {
    q: searchParams.get("q") ?? undefined,
    agencyId: searchParams.get("agencyId") ?? undefined,
    projectType: searchParams.get("projectType") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    level: searchParams.get("level") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    sufficiency: searchParams.get("sufficiency") ?? undefined,
    resolution: searchParams.get("resolution") ?? undefined,
    stale: searchParams.get("stale") === "1",
    district: searchParams.get("district") ?? undefined,
    sort: (searchParams.get("sort") as any) ?? "level",
    order: (searchParams.get("order") as any) ?? "desc",
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20,
  };
}
