/**
 * Bottom-sheet snap points: peek (about 96 px), half (50 %) and full (92 %) of the viewport height.
 * Pure so the drag and snap rules are unit-tested; the component only feeds it pointer data.
 */
export const PEEK_PX = 96;
export type Snap = "peek" | "half" | "full";
export type SnapName = Snap | "closed";
export const SNAP_ORDER: readonly Snap[] = ["peek", "half", "full"];

export function snapHeights(viewportHeight: number): Record<Snap, number> {
  return { peek: Math.min(PEEK_PX, Math.round(viewportHeight * 0.3)), half: Math.round(viewportHeight * 0.5), full: Math.round(viewportHeight * 0.92) };
}

/**
 * Picks the snap point for a release. A slow release goes to the nearest height; a fast flick (|v| >= 0.5 px/ms) moves one
 * step from the highest snap the sheet has already reached, in the direction of the flick (positive = up).
 */
export function snapTo(height: number, velocityPxPerMs: number, viewportHeight: number): Snap {
  const heights = snapHeights(viewportHeight);
  const nearest = SNAP_ORDER.reduce((best, n) => (Math.abs(heights[n] - height) < Math.abs(heights[best] - height) ? n : best), "peek" as Snap);
  if (Math.abs(velocityPxPerMs) < 0.5) return nearest;
  const reachedIndex = SNAP_ORDER.reduce((best, n, i) => (heights[n] <= height ? i : best), 0);
  if (velocityPxPerMs > 0) return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, reachedIndex + 1)]!;
  return height > heights[SNAP_ORDER[reachedIndex]!] ? SNAP_ORDER[reachedIndex]! : SNAP_ORDER[Math.max(0, reachedIndex - 1)]!;
}

/** Map padding (px) so the selected feature stays visible above an open sheet. */
export const mapPaddingForSheet = (snap: SnapName, viewportHeight: number): number => (snap === "closed" ? 0 : Math.min(snapHeights(viewportHeight)[snap], Math.round(viewportHeight * 0.6)));
