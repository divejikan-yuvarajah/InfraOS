/** Public landing locales only. Not used by operational screens. */

export const PUBLIC_LOCALES = ["en", "si", "ta"] as const;

export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export const PUBLIC_LOCALE_LABELS: Record<PublicLocale, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};

/** Sinhala and Tamil public copy is an AI draft until native-speaker review. */
export const PUBLIC_TRANSLATION_STATUS = "unverified-draft" as const;

export function isPublicLocale(value: string): value is PublicLocale {
  return (PUBLIC_LOCALES as readonly string[]).includes(value);
}

export function localeFromPathname(pathname: string): PublicLocale {
  if (pathname === "/si" || pathname.startsWith("/si/")) return "si";
  if (pathname === "/ta" || pathname.startsWith("/ta/")) return "ta";
  return "en";
}

/** English stays at `/` so existing anchors and links keep working. */
export function publicHomePath(locale: PublicLocale): string {
  if (locale === "en") return "/";
  return `/${locale}`;
}

/** Supporting public information pages (Step 32). */
export const PUBLIC_INFO_SLUGS = ["about", "accessibility", "privacy"] as const;

export type PublicInfoSlug = (typeof PUBLIC_INFO_SLUGS)[number];

export function isPublicInfoSlug(value: string): value is PublicInfoSlug {
  return (PUBLIC_INFO_SLUGS as readonly string[]).includes(value);
}

export function publicInfoPath(locale: PublicLocale, slug: PublicInfoSlug): string {
  const home = publicHomePath(locale);
  if (home === "/") return `/${slug}`;
  return `${home}/${slug}`;
}

/** Preserve subpath when switching locale (e.g. `/si/about` → `/ta/about`). */
export function publicPathForLocale(pathname: string, targetLocale: PublicLocale): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  let suffix = normalized;
  if (normalized === "/si" || normalized.startsWith("/si/")) {
    suffix = normalized.slice(3) || "/";
  } else if (normalized === "/ta" || normalized.startsWith("/ta/")) {
    suffix = normalized.slice(3) || "/";
  }
  if (suffix === "/" || suffix === "") return publicHomePath(targetLocale);
  const slug = suffix.replace(/^\//, "");
  if (isPublicInfoSlug(slug)) return publicInfoPath(targetLocale, slug);
  return publicHomePath(targetLocale);
}

export function localeFromHeader(value: string | null): PublicLocale {
  if (value && isPublicLocale(value)) return value;
  return "en";
}
