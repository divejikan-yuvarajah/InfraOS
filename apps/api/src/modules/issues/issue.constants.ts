export const ISSUE_CATEGORIES = ["POTHOLE", "ROAD_DAMAGE", "WATER_LEAK", "DRAINAGE", "STREET_LIGHT", "UTILITY_DAMAGE", "PUBLIC_ASSET_DAMAGE", "OTHER"] as const;
export const ISSUE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_REVIEW",
  "IN_PROGRESS",
  "NEEDS_INFO",
  "RESOLVED",
  "CLOSED",
  "DUPLICATE",
  "REJECTED",
] as const;
export const ISSUE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ASSIGNED", "NEEDS_INFO", "DUPLICATE", "REJECTED"],
  UNDER_REVIEW: ["ASSIGNED", "IN_PROGRESS", "NEEDS_INFO", "DUPLICATE", "REJECTED"],
  ASSIGNED: ["UNDER_REVIEW", "IN_REVIEW", "IN_PROGRESS", "NEEDS_INFO", "RESOLVED", "DUPLICATE", "REJECTED"],
  IN_REVIEW: ["IN_PROGRESS", "NEEDS_INFO", "RESOLVED", "DUPLICATE", "REJECTED"],
  IN_PROGRESS: ["IN_REVIEW", "NEEDS_INFO", "RESOLVED", "CLOSED", "DUPLICATE", "REJECTED"],
  NEEDS_INFO: ["UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "DUPLICATE", "REJECTED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  DUPLICATE: [],
  REJECTED: [],
};

/** Approximate bounding box covering Sri Lanka land + immediate coastline. */
export const SRI_LANKA_COORD_BOUNDS = {
  minLat: 5.85,
  maxLat: 9.90,
  minLng: 79.45,
  maxLng: 81.95,
} as const;

export function isInsideSriLanka(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SRI_LANKA_COORD_BOUNDS.minLat &&
    lat <= SRI_LANKA_COORD_BOUNDS.maxLat &&
    lng >= SRI_LANKA_COORD_BOUNDS.minLng &&
    lng <= SRI_LANKA_COORD_BOUNDS.maxLng
  );
}
