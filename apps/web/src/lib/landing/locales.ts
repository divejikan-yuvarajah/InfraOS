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

export function localeFromHeader(value: string | null): PublicLocale {
  if (value && isPublicLocale(value)) return value;
  return "en";
}
