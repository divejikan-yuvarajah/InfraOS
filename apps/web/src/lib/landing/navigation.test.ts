import { describe, expect, it } from "vitest";

import { getPublicCopy } from "./messages";
import {
  FEATURES_SECTION_ANCHOR,
  getAvailablePublicNavLinks,
  getPublicNavLinks,
  HERO_OVERVIEW_ANCHOR,
  AUDIENCES_SECTION_ANCHOR,
  HOW_IT_WORKS_SECTION_ANCHOR,
  PROBLEM_SECTION_ANCHOR,
  PUBLIC_PRIMARY_NAV,
  SOLUTION_SECTION_ANCHOR,
} from "./navigation";

describe("public landing navigation", () => {
  it("exposes only available links with real destinations", () => {
    const links = getAvailablePublicNavLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const item of links) {
      expect(item.isAvailable).toBe(true);
      expect(item.href).toMatch(/^(\/|#)/);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("does not link to auth or future section placeholders", () => {
    const hrefs = PUBLIC_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs).not.toContain("/login");
    expect(hrefs).not.toContain("#product");
    expect(hrefs).not.toContain("#lifecycle");
  });

  it("includes Step 25–26 anchors when marked available", () => {
    expect(PUBLIC_PRIMARY_NAV.some((item) => item.href === `#${HERO_OVERVIEW_ANCHOR}`)).toBe(
      true,
    );
    expect(PUBLIC_PRIMARY_NAV.some((item) => item.href === `#${PROBLEM_SECTION_ANCHOR}`)).toBe(
      true,
    );
    expect(PUBLIC_PRIMARY_NAV.some((item) => item.href === `#${SOLUTION_SECTION_ANCHOR}`)).toBe(
      true,
    );
  });

  it("includes Step 27 #features in localized navigation", () => {
    const hrefs = getPublicNavLinks(getPublicCopy("en"), "en").map((item) => item.href);
    expect(hrefs).toContain(`#${FEATURES_SECTION_ANCHOR}`);
  });

  it("includes Step 28 #how-it-works in localized navigation", () => {
    const hrefs = getPublicNavLinks(getPublicCopy("en"), "en").map((item) => item.href);
    expect(hrefs).toContain(`#${HOW_IT_WORKS_SECTION_ANCHOR}`);
  });

  it("includes Step 29 #audiences in localized navigation", () => {
    const hrefs = getPublicNavLinks(getPublicCopy("en"), "en").map((item) => item.href);
    expect(hrefs).toContain(`#${AUDIENCES_SECTION_ANCHOR}`);
  });
});
