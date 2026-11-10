import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCATTER_PADDING,
  clamp,
  getAxisTicks,
  getDiagonalLinePath,
  getFinancialAheadPolygonPoints,
  scaleX,
  scaleY,
} from "./chart-math";

describe("Risk Chart Math", () => {
  const width = 500;
  const height = 400;

  it("clamps values between 0 and 100", () => {
    expect(clamp(-10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(45.5)).toBe(45.5);
    expect(clamp(Number.NaN)).toBe(0);
  });

  it("scales X coordinates within SVG bounds", () => {
    const x0 = scaleX(0, width, DEFAULT_SCATTER_PADDING);
    const x50 = scaleX(50, width, DEFAULT_SCATTER_PADDING);
    const x100 = scaleX(100, width, DEFAULT_SCATTER_PADDING);

    expect(x0).toBe(DEFAULT_SCATTER_PADDING.left);
    expect(x100).toBe(width - DEFAULT_SCATTER_PADDING.right);
    expect(x50).toBeCloseTo((x0 + x100) / 2, 1);
  });

  it("scales Y coordinates inverted for SVG orientation", () => {
    const y0 = scaleY(0, height, DEFAULT_SCATTER_PADDING);
    const y100 = scaleY(100, height, DEFAULT_SCATTER_PADDING);

    // 0% is at the bottom (higher Y coord), 100% is at the top (lower Y coord)
    expect(y0).toBe(height - DEFAULT_SCATTER_PADDING.bottom);
    expect(y100).toBe(DEFAULT_SCATTER_PADDING.top);
  });

  it("generates correct diagonal reference line and polygon", () => {
    const diag = getDiagonalLinePath(width, height);
    expect(diag).toMatch(/^M \d+\.\d{2} \d+\.\d{2} L \d+\.\d{2} \d+\.\d{2}$/);

    const poly = getFinancialAheadPolygonPoints(width, height);
    expect(poly.split(" ")).toHaveLength(3);
  });

  it("generates axis ticks at 25% intervals", () => {
    const xTicks = getAxisTicks(width, true);
    expect(xTicks).toHaveLength(5); // 0, 25, 50, 75, 100
    expect(xTicks.map((t) => t.value)).toEqual([0, 25, 50, 75, 100]);

    const yTicks = getAxisTicks(height, false);
    expect(yTicks).toHaveLength(5);
  });
});
