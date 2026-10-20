import { describe, expect, it } from "vitest";

import { PUBLIC_LOCALES } from "./locales";
import { getPublicCopy } from "./messages";
import {
  PREVIEW_SCHEDULES,
  PREVIEW_SECTION_ANCHOR,
  isValidDateOnly,
  rangesOverlap,
  sharedDateWindow,
  sharesCorridorSegment,
} from "./preview-data";

describe("public landing GIS preview (Step 30)", () => {
  it("uses a stable preview anchor", () => {
    expect(PREVIEW_SECTION_ANCHOR).toBe("preview");
  });

  it("uses overlapping date-only sample ranges", () => {
    for (const range of Object.values(PREVIEW_SCHEDULES)) {
      expect(isValidDateOnly(range.startDate)).toBe(true);
      expect(isValidDateOnly(range.endDate)).toBe(true);
      expect(range.startDate <= range.endDate).toBe(true);
    }
    expect(rangesOverlap(PREVIEW_SCHEDULES.road, PREVIEW_SCHEDULES.water)).toBe(true);
    const shared = sharedDateWindow(PREVIEW_SCHEDULES.road, PREVIEW_SCHEDULES.water);
    expect(shared).toEqual({ startDate: "2026-03-10", endDate: "2026-03-20" });
    expect(sharesCorridorSegment()).toBe(true);
  });

  it("includes an illustrative disclaimer in every locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      const preview = getPublicCopy(locale).preview;
      expect(preview.disclaimer.length).toBeGreaterThan(12);
      expect(preview.figureDescription.length).toBeGreaterThan(20);
      const blob = `${preview.disclaimer} ${preview.intro} ${preview.statusNote}`.toLowerCase();
      expect(blob).toMatch(/illustrative|prototype|not live|ආදර්ශ|සජීවී|எடுத்துக்காட்டு|நேரடி/);
      expect(blob).not.toMatch(/live government data is shown|official conflict alert/);
    }
  });
});
