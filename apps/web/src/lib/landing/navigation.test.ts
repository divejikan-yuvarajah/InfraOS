import { describe, expect, it } from "vitest";

import {
  getAvailablePublicNavLinks,
  HERO_OVERVIEW_ANCHOR,
  PUBLIC_PRIMARY_NAV,
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

  it("does not link to auth or future Step 26 anchors yet", () => {
    const hrefs = PUBLIC_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs).not.toContain("/login");
    expect(hrefs).not.toContain("#problem");
    expect(hrefs).not.toContain("#solution");
    expect(hrefs).not.toContain("#features");
  });

  it("targets the hero overview anchor implemented in Step 25", () => {
    expect(PUBLIC_PRIMARY_NAV.some((item) => item.href === `#${HERO_OVERVIEW_ANCHOR}`)).toBe(
      true,
    );
  });
});
