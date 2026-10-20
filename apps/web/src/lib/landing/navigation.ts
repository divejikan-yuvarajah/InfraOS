/**
 * Public marketing navigation — verified routes and in-page anchors on the homepage.
 */

import { publicHomePath, publicInfoPath, type PublicLocale } from "./locales";
import type { PublicLandingCopy } from "./messages";

export type PublicNavLink = {
  label: string;
  href: string;
  isAvailable: boolean;
};

/** In-page anchors — keep in sync with landing section `id`s. */
export const HERO_OVERVIEW_ANCHOR = "hero-overview";
export const PROBLEM_SECTION_ANCHOR = "problem";
export const SOLUTION_SECTION_ANCHOR = "solution";
export const FEATURES_SECTION_ANCHOR = "features";
export const HOW_IT_WORKS_SECTION_ANCHOR = "how-it-works";
export const AUDIENCES_SECTION_ANCHOR = "audiences";
export const TRANSPARENCY_SECTION_ANCHOR = "transparency";

export const PUBLIC_PRIMARY_NAV: readonly PublicNavLink[] = [
  { label: "Home", href: "/", isAvailable: true },
  { label: "About", href: "/about", isAvailable: true },
  { label: "How it works", href: "/how-it-works", isAvailable: true },
  { label: "FAQ", href: "/faq", isAvailable: true },
  { label: "Contact", href: "/contact", isAvailable: true },
] as const;

/** Full homepage section links (footer / secondary). */
export function getPublicHomeSectionLinks(copy: PublicLandingCopy): PublicNavLink[] {
  return [
    { label: copy.nav.problem, href: `#${PROBLEM_SECTION_ANCHOR}`, isAvailable: true },
    { label: copy.nav.solution, href: `#${SOLUTION_SECTION_ANCHOR}`, isAvailable: true },
    { label: copy.nav.features, href: `#${FEATURES_SECTION_ANCHOR}`, isAvailable: true },
    {
      label: copy.nav.lifecycle,
      href: `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
      isAvailable: true,
    },
    {
      label: copy.nav.audiences,
      href: `#${AUDIENCES_SECTION_ANCHOR}`,
      isAvailable: true,
    },
  ];
}

export function getPublicNavLinks(
  copy: PublicLandingCopy,
  locale: PublicLocale,
): PublicNavLink[] {
  return [
    { label: copy.nav.home, href: publicHomePath(locale), isAvailable: true },
    { label: copy.nav.about, href: publicInfoPath(locale, "about"), isAvailable: true },
    {
      label: copy.nav.howItWorks,
      href: publicInfoPath(locale, "how-it-works"),
      isAvailable: true,
    },
    { label: copy.nav.faq, href: publicInfoPath(locale, "faq"), isAvailable: true },
    { label: copy.nav.contact, href: publicInfoPath(locale, "contact"), isAvailable: true },
  ];
}

/** Primary header navigation (Section 12 IA). */
/** ~4 primary destinations; footer/home sections expose the rest. */
export function getPublicHeaderNavLinks(
  copy: PublicLandingCopy,
  locale: PublicLocale,
): PublicNavLink[] {
  return [
    { label: copy.nav.home, href: publicHomePath(locale), isAvailable: true },
    {
      label: copy.nav.coordination,
      href: `#${SOLUTION_SECTION_ANCHOR}`,
      isAvailable: true,
    },
    {
      label: copy.nav.howItWorks,
      href: publicInfoPath(locale, "how-it-works"),
      isAvailable: true,
    },
    { label: copy.nav.about, href: publicInfoPath(locale, "about"), isAvailable: true },
  ];
}

export function getAvailablePublicNavLinks(): PublicNavLink[] {
  return PUBLIC_PRIMARY_NAV.filter((item) => item.isAvailable);
}

/** In-page anchors must include the locale home path when rendered off the homepage. */
export function resolvePublicNavHref(locale: PublicLocale, href: string): string {
  if (href.startsWith("#")) return `${publicHomePath(locale)}${href}`;
  if (href.startsWith("/") && locale !== "en") {
    const path = href === "/" ? publicHomePath(locale) : `/${locale}${href}`;
    return path;
  }
  return href;
}
