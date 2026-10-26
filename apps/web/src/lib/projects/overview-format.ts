import { formatLkrMinor } from "@/lib/data-table/query-state";

export function projectCoreQueryKey(
  epoch: string,
  userId: string,
  roleKey: string,
  id: string,
): readonly ["project", "core", string, string, string, string] {
  return ["project", "core", epoch, userId, roleKey, id];
}

export function projectListQueryKey(
  epoch: string,
  userId: string,
  roleKey: string,
  query: string,
): readonly ["projects", string, string, string, string] {
  return ["projects", epoch, userId, roleKey, query];
}

/** Calendar date from a UTC timestamp. Does not apply the viewer timezone. */
export function utcDateLabel(value: string | null | undefined, missing: string): string {
  if (!value) return missing;
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  return match?.[1] ?? missing;
}

export function utcStampLabel(value: string | null | undefined, missing: string): string {
  if (!value) return missing;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} ${match[2]} UTC` : missing;
}

export function lkrBudgetLabel(amountMinor: number | undefined, missing: string): string {
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return missing;
  return formatLkrMinor(amountMinor);
}

export function geometrySummary(geometry: { type?: string; coordinates?: unknown } | null | undefined, missing: string): string {
  if (!geometry || typeof geometry.type !== "string") return missing;
  const coordinates = geometry.coordinates;
  if (geometry.type === "Point" && Array.isArray(coordinates) && coordinates.length === 2) {
    const [longitude, latitude] = coordinates;
    if (typeof longitude === "number" && typeof latitude === "number") {
      return `Point ${longitude}, ${latitude}`;
    }
  }
  if (geometry.type === "LineString" && Array.isArray(coordinates)) {
    return `LineString, ${coordinates.length} positions`;
  }
  if (geometry.type === "Polygon" && Array.isArray(coordinates)) {
    return `Polygon, ${coordinates.length} rings`;
  }
  return missing;
}

export function safeListReturn(raw: string | null): string {
  if (!raw) return "/projects";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/projects";
  }
  if (decoded.length > 500 || decoded.includes("://") || decoded.startsWith("/")) return "/projects";
  return `/projects?${decoded}`;
}
