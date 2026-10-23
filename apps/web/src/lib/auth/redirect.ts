const SAFE_INTERNAL_PREFIXES = [
  "/",
  "/about",
  "/how-it-works",
  "/faq",
  "/contact",
  "/privacy",
  "/accessibility",
  "/si",
  "/ta",
  "/login",
] as const;

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Same-origin relative paths only. Rejects open redirects and protocol-relative URLs. */
export function sanitizeNextParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  const decoded = decodeOnce(trimmed);
  if (
    decoded.includes("://") ||
    decoded.includes("\\") ||
    decoded.includes("\0") ||
    decoded.includes("@")
  ) {
    return null;
  }
  const pathOnly = decoded.split(/[?#]/)[0] ?? decoded;
  const allowed = SAFE_INTERNAL_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  return allowed ? decoded : null;
}

export function loginPathForLocale(locale: "en" | "si" | "ta"): string {
  if (locale === "en") return "/login";
  return `/${locale}/login`;
}
