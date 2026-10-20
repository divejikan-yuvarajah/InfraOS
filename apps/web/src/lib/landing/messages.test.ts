import { describe, expect, it } from "vitest";

import { PUBLIC_LOCALES, publicHomePath } from "./locales";
import { getPublicCopy, publicCopyKeys } from "./messages";

describe("public landing locales", () => {
  it("keeps the same message keys in English, Sinhala and Tamil", () => {
    const englishKeys = publicCopyKeys(getPublicCopy("en"));
    for (const locale of PUBLIC_LOCALES) {
      expect(publicCopyKeys(getPublicCopy(locale))).toEqual(englishKeys);
    }
  });

  it("does not leave Sinhala or Tamil titles in English", () => {
    const english = getPublicCopy("en");
    expect(getPublicCopy("si").hero.title).not.toBe(english.hero.title);
    expect(getPublicCopy("ta").hero.title).not.toBe(english.hero.title);
    expect(getPublicCopy("si").nav.problem).not.toBe(english.nav.problem);
    expect(getPublicCopy("ta").nav.solution).not.toBe(english.nav.solution);
  });

  it("keeps English at / and does not invent a login route", () => {
    expect(publicHomePath("en")).toBe("/");
    expect(publicHomePath("si")).toBe("/si");
    expect(publicHomePath("ta")).toBe("/ta");
    const hrefs = PUBLIC_LOCALES.flatMap((locale) => [
      publicHomePath(locale),
      ...Object.values(getPublicCopy(locale).nav),
    ]);
    expect(hrefs.join(" ")).not.toMatch(/\/login/);
  });

  it("labels the platform as a university demonstration in every locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      const copy = getPublicCopy(locale);
      expect(copy.footerDisclosure.length).toBeGreaterThan(20);
      expect(copy.demoBanner.length).toBeGreaterThan(10);
      expect(`${copy.hero.prototypeNote} ${copy.footerDisclosure} ${copy.metaDescription}`).not.toMatch(
        /official national portal|government approved/i,
      );
    }
  });
});
