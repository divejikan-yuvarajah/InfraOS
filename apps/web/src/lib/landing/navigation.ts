/**
 * Public marketing navigation — only links to verified routes or in-page anchors
 * that exist in the current checkpoint. Extend when Steps 26+ add sections.
 * Staff sign-in is omitted until an authentication route exists.
 */

import { publicHomePath, type PublicLocale } from "./locales";
import type { PublicLandingCopy } from "./messages";

export type PublicNavLink = {
  label: string;
  href: string;
  /** When false, link is omitted from rendered nav (reserved for future steps). */
  isAvailable: boolean;
};

/** In-page anchors — keep in sync with landing section `id`s. */
export const HERO_OVERVIEW_ANCHOR = "hero-overview";
export const PROBLEM_SECTION_ANCHOR = "problem";
export const SOLUTION_SECTION_ANCHOR = "solution";
export const FEATURES_SECTION_ANCHOR = "features";
export const HOW_IT_WORKS_SECTION_ANCHOR = "how-it-works";
export const AUDIENCES_SECTION_ANCHOR = "audiences";

export const PUBLIC_PRIMARY_NAV: readonly PublicNavLink[] = [
  { label: "Home", href: "/", isAvailable: true },
  {
    label: "The coordination gap",
    href: `#${PROBLEM_SECTION_ANCHOR}`,
    isAvailable: true,
  },
  {
    label: "How INFRAOS works",
    href: `#${SOLUTION_SECTION_ANCHOR}`,
    isAvailable: true,
  },
  {
    label: "Platform functions",
    href: `#${FEATURES_SECTION_ANCHOR}`,
    isAvailable: true,
  },
  {
    label: "Project lifecycle",
    href: `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
    isAvailable: true,
  },
  {
    label: "Who it helps",
    href: `#${AUDIENCES_SECTION_ANCHOR}`,
    isAvailable: true,
  },
  {
    label: "Coordination example",
    href: `#${HERO_OVERVIEW_ANCHOR}`,
    isAvailable: true,
  },
] as const;

export function getPublicNavLinks(
  copy: PublicLandingCopy,
  locale: PublicLocale,
): PublicNavLink[] {
  return [
    { label: copy.nav.home, href: publicHomePath(locale), isAvailable: true },
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
    { label: copy.nav.example, href: `#${HERO_OVERVIEW_ANCHOR}`, isAvailable: true },
  ];
}

/** Civic Atlas header: four destinations. Other anchors stay on the page and in the full link list. */
export function getPublicHeaderNavLinks(
  copy: PublicLandingCopy,
  locale: PublicLocale,
): PublicNavLink[] {
  const all = getPublicNavLinks(copy, locale);
  const keep = new Set([
    `#${SOLUTION_SECTION_ANCHOR}`,
    `#${FEATURES_SECTION_ANCHOR}`,
    `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
    `#${AUDIENCES_SECTION_ANCHOR}`,
  ]);
  return all.filter((item) => keep.has(item.href));
}

export function getAvailablePublicNavLinks(): PublicNavLink[] {
  return PUBLIC_PRIMARY_NAV.filter((item) => item.isAvailable);
}

/** In-page anchors must include the locale home path when rendered off the homepage. */
export function resolvePublicNavHref(locale: PublicLocale, href: string): string {
  if (href.startsWith("#")) return `${publicHomePath(locale)}${href}`;
  return href;
}
