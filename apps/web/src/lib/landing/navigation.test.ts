import { describe, expect, it } from "vitest";

import { getPublicCopy } from "./messages";
import {
  getAvailablePublicNavLinks,
  getPublicHeaderNavLinks,
  getPublicNavLinks,
  resolvePublicNavHref,
} from "./navigation";
import { publicInfoPath } from "./locales";

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

  it("does not link to auth placeholders", () => {
    const hrefs = getAvailablePublicNavLinks().map((item) => item.href);
    expect(hrefs).not.toContain("/login");
  });

  it("includes dedicated public pages in localized navigation", () => {
    const hrefs = getPublicNavLinks(getPublicCopy("en"), "en").map((item) => item.href);
    expect(hrefs).toContain("/about");
    expect(hrefs).toContain("/how-it-works");
    expect(hrefs).toContain("/faq");
    expect(hrefs).toContain("/contact");
  });

  it("localizes dedicated page paths for Sinhala", () => {
    const hrefs = getPublicNavLinks(getPublicCopy("si"), "si").map((item) => item.href);
    expect(hrefs).toContain("/si/about");
    expect(hrefs).toContain("/si/how-it-works");
  });

  it("header nav uses four primary destinations", () => {
    const header = getPublicHeaderNavLinks(getPublicCopy("en"), "en");
    expect(header).toHaveLength(4);
    expect(header.map((l) => l.href)).toEqual([
      "/",
      "#solution",
      publicInfoPath("en", "how-it-works"),
      publicInfoPath("en", "about"),
    ]);
  });

  it("prefixes in-page anchors with locale home when resolving off-home links", () => {
    expect(resolvePublicNavHref("si", "#problem")).toBe("/si#problem");
    expect(resolvePublicNavHref("en", "/about")).toBe("/about");
    expect(resolvePublicNavHref("si", "/about")).toBe("/si/about");
  });
});
