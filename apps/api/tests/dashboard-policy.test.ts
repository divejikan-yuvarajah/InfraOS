import { describe, expect, it } from "vitest";

import { colomboDayStart, milestoneCoverage, milestoneWindow } from "../src/modules/projects/dashboard.policy.js";

describe("dashboard date boundary", () => {
  it("treats Asia/Colombo midnight as the overdue boundary", () => {
    const asOf = new Date("2026-07-02T03:00:00.000Z");
    const { dayStart, dueEnd } = milestoneWindow(asOf);
    expect(colomboDayStart(asOf).toISOString()).toBe("2026-07-01T18:30:00.000Z");
    expect(dayStart.toISOString()).toBe("2026-07-01T18:30:00.000Z");
    expect(dueEnd.toISOString()).toBe("2026-07-15T18:30:00.000Z");
    const stillPrevious = new Date("2026-07-01T18:29:59.000Z");
    expect(colomboDayStart(stillPrevious).toISOString()).toBe("2026-06-30T18:30:00.000Z");
  });

  it("withholds milestone coverage above the scope cap and keeps a verified empty scope", () => {
    expect(milestoneCoverage(0)).toBe("complete");
    expect(milestoneCoverage(500)).toBe("complete");
    expect(milestoneCoverage(501)).toBe("unavailable");
  });
});
