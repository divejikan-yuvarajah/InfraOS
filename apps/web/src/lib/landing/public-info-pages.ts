import type { PublicInfoSlug } from "./locales";
import { publicHomePath, type PublicLocale } from "./locales";
import { publicInfoPath } from "./locales";

export type PublicInfoPageKey = PublicInfoSlug;

export function publicHomeAnchor(locale: PublicLocale, anchor: string): string {
  const id = anchor.startsWith("#") ? anchor : `#${anchor}`;
  return `${publicHomePath(locale)}${id}`;
}

export function footerLinkHref(
  locale: PublicLocale,
  kind:
    | "about"
    | "coordination"
    | "faq"
    | "contact"
    | "accessibility"
    | "privacy"
    | "photoCredits",
): string {
  switch (kind) {
    case "about":
      return publicInfoPath(locale, "about");
    case "contact":
      return publicInfoPath(locale, "contact");
    case "accessibility":
      return publicInfoPath(locale, "accessibility");
    case "privacy":
      return publicInfoPath(locale, "privacy");
    case "coordination":
      return publicInfoPath(locale, "how-it-works");
    case "faq":
      return publicInfoPath(locale, "faq");
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
