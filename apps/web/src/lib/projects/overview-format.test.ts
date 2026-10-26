import { describe, expect, it } from "vitest";

import { formatLkrMinor } from "@/lib/data-table/query-state";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { geometrySummary, lkrBudgetLabel, projectCoreQueryKey, projectListQueryKey, safeListReturn, utcDateLabel, utcStampLabel } from "@/lib/projects/overview-format";

describe("project overview formatting", () => {
  it("keeps the UTC calendar date and formats exact LKR cents", () => {
    expect(utcDateLabel("2026-10-26T00:00:00.000Z", "Not provided")).toBe("2026-10-26");
    expect(utcStampLabel("2026-10-26T00:05:00.000Z", "Not provided")).toBe("2026-10-26 00:05 UTC");
    expect(utcDateLabel(null, "Not provided")).toBe("Not provided");
    expect(lkrBudgetLabel(10, "missing")).toBe(formatLkrMinor(10));
    expect(lkrBudgetLabel(10, "missing")).toMatch(/\.10$/);
    expect(lkrBudgetLabel(1, "missing")).toMatch(/\.01$/);
    expect(lkrBudgetLabel(undefined, "missing")).toBe("missing");
  });

  it("summarizes geometry and drops an unsafe list return", () => {
    expect(geometrySummary({ type: "Point", coordinates: [79.86, 6.93] }, "Not provided")).toBe("Point 79.86, 6.93");
    expect(geometrySummary({ type: "LineString", coordinates: [[0, 0], [1, 1]] }, "Not provided")).toBe("LineString, 2 positions");
    expect(geometrySummary({ type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 0]]] }, "Not provided")).toBe("Polygon, 1 rings");
    expect(geometrySummary(null, "Not provided")).toBe("Not provided");
    const restored = safeListReturn("page=2&q=road&status=DRAFT");
    expect(restored.startsWith("/projects?")).toBe(true);
    expect(restored).toContain("page=2");
    expect(restored).toContain("q=road");
    expect(restored).toContain("status=DRAFT");
    expect(safeListReturn("https://evil.example")).toBe("/projects");
    expect(safeListReturn("%2F%2Fevil.example")).toBe("/projects");
  });

  it("uses one project-core key per auth epoch and distinct 403 and 404 copy", () => {
    expect(projectCoreQueryKey("4", "user-a", "AGENCY_OFFICER", "abc")).toEqual(["project", "core", "4", "user-a", "AGENCY_OFFICER", "abc"]);
    expect(projectCoreQueryKey("4", "user-b", "AGENCY_OFFICER", "abc")).not.toEqual(projectCoreQueryKey("4", "user-a", "AGENCY_OFFICER", "abc"));
    expect(projectListQueryKey("4", "user-a", "AGENCY_OFFICER", "page=1")).not.toEqual(projectListQueryKey("4", "user-b", "AGENCY_OFFICER", "page=1"));
    for (const locale of ["en", "si", "ta"] as const) {
      const copy = getProjectCopy(locale);
      expect(copy.nativeReview.length).toBeGreaterThan(0);
      expect(copy.notProvided).not.toBe(copy.forbidden);
      expect(projectReadMessage(403, copy)).toBe(copy.forbidden);
      expect(projectReadMessage(404, copy)).toBe(copy.notFound);
      expect(projectReadMessage(503, copy)).toBe(copy.unavailable);
    }
  });
});
