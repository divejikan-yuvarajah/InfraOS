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
    { label: copy.nav.example, href: `#${HERO_OVERVIEW_ANCHOR}`, isAvailable: true },
  ];
}

export function getAvailablePublicNavLinks(): PublicNavLink[] {
  return PUBLIC_PRIMARY_NAV.filter((item) => item.isAvailable);
}
