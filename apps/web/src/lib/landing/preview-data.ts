/**
 * Conceptual Step 30 illustration only.
 * Not a geospatial query, RoadSync result, or government record.
 */

export const PREVIEW_SECTION_ANCHOR = "preview";

export type PreviewWorkId = "road" | "water";

export type PreviewDateRange = {
  startDate: string;
  endDate: string;
};

/** Date-only ISO ranges. Both must overlap by construction. */
export const PREVIEW_SCHEDULES: Record<PreviewWorkId, PreviewDateRange> = {
  road: { startDate: "2026-03-02", endDate: "2026-03-20" },
  water: { startDate: "2026-03-10", endDate: "2026-03-28" },
};

/** Conceptual x positions. Water lies on the same corridor line as the road. */
export const PREVIEW_CORRIDOR = {
  y: 100,
  road: { x1: 48, x2: 592 },
  water: { x1: 280, x2: 440 },
} as const;

export function sharesCorridorSegment(): boolean {
  const { road, water, y } = PREVIEW_CORRIDOR;
  return road.x1 < water.x1 && water.x2 < road.x2 && y === PREVIEW_CORRIDOR.y;
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function rangesOverlap(a: PreviewDateRange, b: PreviewDateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function sharedDateWindow(
  a: PreviewDateRange,
  b: PreviewDateRange,
): PreviewDateRange | null {
  if (!rangesOverlap(a, b)) return null;
  return {
    startDate: a.startDate > b.startDate ? a.startDate : b.startDate,
    endDate: a.endDate < b.endDate ? a.endDate : b.endDate,
  };
}
