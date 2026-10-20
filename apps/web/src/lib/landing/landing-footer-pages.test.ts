import { describe, expect, it } from "vitest";

import {
  PUBLIC_INFO_SLUGS,
  PUBLIC_LOCALES,
  publicInfoPath,
  publicPathForLocale,
} from "./locales";
import { footerLinkHref } from "./public-info-pages";
import { getPublicCopy } from "./messages";

describe("Step 32 footer and public information routes", () => {
  it("defines about, accessibility, and privacy paths for each locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      expect(publicInfoPath(locale, "about")).toMatch(
        locale === "en" ? /^\/about$/ : new RegExp(`^\\/${locale}\\/about$`),
      );
      expect(publicInfoPath(locale, "privacy")).toContain("privacy");
    }
  });

  it("preserves supporting page when switching locale via path helper", () => {
    expect(publicPathForLocale("/si/about", "ta")).toBe("/ta/about");
    expect(publicPathForLocale("/about", "si")).toBe("/si/about");
    expect(publicPathForLocale("/ta/privacy", "en")).toBe("/privacy");
    expect(publicPathForLocale("/si", "en")).toBe("/");
  });

  it("wires footer links to verified destinations", () => {
    for (const locale of PUBLIC_LOCALES) {
      expect(footerLinkHref(locale, "about")).toBe(publicInfoPath(locale, "about"));
      expect(footerLinkHref(locale, "faq")).toBe(publicInfoPath(locale, "faq"));
      expect(footerLinkHref(locale, "coordination")).toBe(publicInfoPath(locale, "how-it-works"));
      expect(footerLinkHref(locale, "photoCredits")).toBe("/landing/photo-credits.html");
    }
  });

  it("keeps info page dictionary parity and avoids fake certification claims", () => {
    for (const locale of PUBLIC_LOCALES) {
      for (const slug of PUBLIC_INFO_SLUGS) {
        const page = getPublicCopy(locale).infoPages[slug];
        expect(page.title.length).toBeGreaterThan(3);
        expect(page.sections.length).toBeGreaterThan(0);
        const combined = `${page.intro} ${page.sections.map((s) => s.body).join(" ")}`;
        expect(combined).not.toMatch(/WCAG certified|government approved|we collect no information/i);
      }
    }
  });

  it("documents owner review for privacy deployment unknowns in English", () => {
    const privacy = getPublicCopy("en").infoPages.privacy;
    expect(privacy.sections.some((s) => s.id === "owner")).toBe(true);
    expect(privacy.sections.find((s) => s.id === "owner")?.body).toMatch(
      /NEEDS_OWNER_REVIEW/,
    );
  });
});
