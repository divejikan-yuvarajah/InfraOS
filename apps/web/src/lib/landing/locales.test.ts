import { describe, expect, it } from "vitest";

import { isPublicInfoSlug, localeFromPathname, publicPathForLocale } from "./locales";

describe("public locale path helpers", () => {
  it("detects locale from pathname including supporting pages", () => {
    expect(localeFromPathname("/")).toBe("en");
    expect(localeFromPathname("/si/about")).toBe("si");
    expect(localeFromPathname("/ta/privacy")).toBe("ta");
    expect(localeFromPathname("/accessibility")).toBe("en");
  });

  it("validates info slugs", () => {
    expect(isPublicInfoSlug("about")).toBe(true);
    expect(isPublicInfoSlug("login")).toBe(false);
  });

  it("maps pathname to target locale paths", () => {
    expect(publicPathForLocale("/privacy", "si")).toBe("/si/privacy");
  });
});
