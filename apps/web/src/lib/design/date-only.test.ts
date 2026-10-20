import { describe, expect, it } from "vitest";

import { formatDateOnly, isDateOnlyString, parseDateOnly } from "./date-only";

describe("date-only policy (Step 19)", () => {
  it("round-trips local calendar dates", () => {
    const date = new Date(2026, 5, 15, 12, 0, 0);
    const wire = formatDateOnly(date);
    expect(wire).toBe("2026-06-15");
    expect(isDateOnlyString(wire)).toBe(true);
    const parsed = parseDateOnly(wire);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(5);
    expect(parsed?.getDate()).toBe(15);
  });

  it("rejects invalid strings", () => {
    expect(isDateOnlyString("2026-13-01")).toBe(false);
    expect(isDateOnlyString("06-15-2026")).toBe(false);
    expect(parseDateOnly("not-a-date")).toBeUndefined();
  });
});
