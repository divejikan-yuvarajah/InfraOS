import { describe, expect, it } from "vitest";

import { CONTAINER_MAX, MOTION_MS, Z_INDEX } from "./design-tokens";

describe("design tokens (Step 18)", () => {
  it("z-index ladder avoids arbitrary huge values", () => {
    const values = Object.values(Z_INDEX);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
    expect(Z_INDEX.toast).toBeGreaterThan(Z_INDEX.modal);
    expect(Z_INDEX.dropdown).toBeGreaterThan(Z_INDEX.sticky);
  });

  it("motion durations are restrained", () => {
    expect(MOTION_MS.fast).toBeGreaterThanOrEqual(120);
    expect(MOTION_MS.slow).toBeLessThanOrEqual(360);
  });

  it("container widths use rem for predictability", () => {
    for (const value of Object.values(CONTAINER_MAX)) {
      expect(value.endsWith("rem") || value === "100%").toBe(true);
    }
  });
});
