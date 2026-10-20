import { FAQ_SECTION_ANCHOR } from "./faq-items";
import { HOW_IT_WORKS_SECTION_ANCHOR } from "./navigation";
import type { PublicInfoSlug } from "./locales";
import { publicHomePath, type PublicLocale } from "./locales";
import { publicInfoPath } from "./locales";

export type PublicInfoPageKey = PublicInfoSlug;

export function publicHomeAnchor(locale: PublicLocale, anchor: string): string {
  const id = anchor.startsWith("#") ? anchor : `#${anchor}`;
  return `${publicHomePath(locale)}${id}`;
}

export const FOOTER_COORDINATION_ANCHOR = HOW_IT_WORKS_SECTION_ANCHOR;
export const FOOTER_FAQ_ANCHOR = FAQ_SECTION_ANCHOR;

export function footerLinkHref(
  locale: PublicLocale,
  kind: "about" | "coordination" | "faq" | "accessibility" | "privacy" | "photoCredits",
): string {
  switch (kind) {
    case "about":
      return publicInfoPath(locale, "about");
    case "accessibility":
      return publicInfoPath(locale, "accessibility");
    case "privacy":
      return publicInfoPath(locale, "privacy");
    case "coordination":
      return publicHomeAnchor(locale, FOOTER_COORDINATION_ANCHOR);
    case "faq":
      return publicHomeAnchor(locale, FOOTER_FAQ_ANCHOR);
    case "photoCredits":
      return "/landing/photo-credits.html";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function publicInfoPageMetadataSlug(page: PublicInfoPageKey): PublicInfoSlug {
  return page;
}
