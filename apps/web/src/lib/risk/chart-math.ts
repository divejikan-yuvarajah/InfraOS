export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_SCATTER_PADDING: ChartPadding = {
  top: 24,
  right: 24,
  bottom: 48,
  left: 56,
};

export function clamp(val: number, min = 0, max = 100): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Projects a physical percentage (0..100) onto SVG X coordinate.
 */
export function scaleX(
  pct: number,
  width: number,
  padding: ChartPadding = DEFAULT_SCATTER_PADDING,
): number {
  const innerWidth = width - padding.left - padding.right;
  const clamped = clamp(pct, 0, 100);
  return padding.left + (clamped / 100) * innerWidth;
}

/**
 * Projects a financial percentage (0..100) onto SVG Y coordinate (inverted for SVG coords).
 */
export function scaleY(
  pct: number,
  height: number,
  padding: ChartPadding = DEFAULT_SCATTER_PADDING,
): number {
  const innerHeight = height - padding.top - padding.bottom;
  const clamped = clamp(pct, 0, 100);
  return padding.top + (1 - clamped / 100) * innerHeight;
}

/**
 * Computes SVG path for the diagonal parity reference line (x=y).
 */
export function getDiagonalLinePath(
  width: number,
  height: number,
  padding: ChartPadding = DEFAULT_SCATTER_PADDING,
): string {
  const x0 = scaleX(0, width, padding);
  const y0 = scaleY(0, height, padding);
  const x100 = scaleX(100, width, padding);
  const y100 = scaleY(100, height, padding);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x100.toFixed(2)} ${y100.toFixed(2)}`;
}

/**
 * Computes SVG polygon points for the shaded "Financial Ahead" zone where Fin% > Phys%.
 * Polygon: (0,0) -> (0,100) -> (100,100) -> (0,0)
 */
export function getFinancialAheadPolygonPoints(
  width: number,
  height: number,
  padding: ChartPadding = DEFAULT_SCATTER_PADDING,
): string {
  const p0_0 = `${scaleX(0, width, padding).toFixed(2)},${scaleY(0, height, padding).toFixed(2)}`;
  const p0_100 = `${scaleX(0, width, padding).toFixed(2)},${scaleY(100, height, padding).toFixed(2)}`;
  const p100_100 = `${scaleX(100, width, padding).toFixed(2)},${scaleY(100, height, padding).toFixed(2)}`;
  return `${p0_0} ${p0_100} ${p100_100}`;
}

export interface GridTick {
  value: number;
  coord: number;
}

export function getAxisTicks(
  size: number,
  isX: boolean,
  padding: ChartPadding = DEFAULT_SCATTER_PADDING,
  step = 25,
): GridTick[] {
  const ticks: GridTick[] = [];
  for (let val = 0; val <= 100; val += step) {
    ticks.push({
      value: val,
      coord: isX ? scaleX(val, size, padding) : scaleY(val, size, padding),
    });
  }
  return ticks;
}
