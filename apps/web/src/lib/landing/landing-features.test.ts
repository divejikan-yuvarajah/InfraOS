import { describe, expect, it } from "vitest";

import { PUBLIC_LOCALES } from "./locales";
import { getPublicCopy } from "./messages";
import { FEATURES_SECTION_ANCHOR, getPublicHomeSectionLinks } from "./navigation";

describe("public landing features (Step 27)", () => {
  it("defines a unique #features anchor wired in navigation for every locale", () => {
    expect(FEATURES_SECTION_ANCHOR).toBe("features");
    for (const locale of PUBLIC_LOCALES) {
      const copy = getPublicCopy(locale);
      const hrefs = getPublicHomeSectionLinks(copy).map((link) => link.href);
      expect(hrefs).toContain(`#${FEATURES_SECTION_ANCHOR}`);
      if (locale !== "en") {
        expect(copy.nav.features).not.toBe(getPublicCopy("en").nav.features);
      }
    }
  });

  it("lists five feature topics with explicit demonstration vs planned status", () => {
    for (const locale of PUBLIC_LOCALES) {
      const { features } = getPublicCopy(locale);
      expect(features.items).toHaveLength(5);
      const ids = features.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(5);
      expect(features.items.some((item) => item.status === "demonstration")).toBe(true);
      expect(features.items.some((item) => item.status === "planned")).toBe(true);
      expect(features.items.map((item) => item.moduleName)).toEqual([
        "ProjectTrace",
        "RoadSync",
        "InfraMap",
        "Inspections & assets",
        "Public information",
      ]);
    }
  });

  it("does not add fake product links or live-service claims", () => {
    for (const locale of PUBLIC_LOCALES) {
      const text = JSON.stringify(getPublicCopy(locale).features).toLowerCase();
      expect(text).not.toMatch(/\/login|\/public-projects|\/public-map|\/report-issue/);
      expect(text).not.toMatch(/government approved|million lkr|\d+%/);
      expect(text).not.toMatch(/currently available on this public website/);
      expect(text).toMatch(/deterministic|projecttrace|roadsync/i);
    }
  });
});
