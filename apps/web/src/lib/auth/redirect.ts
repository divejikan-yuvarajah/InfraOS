import { isAllowedNextPath, normalizeAppPath } from "./route-access";

const DROPPED_QUERY_KEYS = new Set([
  "token",
  "password",
  "accesstoken",
  "refreshtoken",
  "code",
  "secret",
]);

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasDanger(value: string): boolean {
  if (value.startsWith("//") || value.startsWith("\\") || value.startsWith("/\\")) return true;
  if (/[\u0000-\u001F\u007F]/.test(value)) return true;
  if (value.includes("\\") || value.includes("@") || value.includes("://")) return true;
  if (value.includes("..")) return true;
  return false;
}

function safeQuery(query: string): string | null {
  if (!query) return "";
  if (hasDanger(query)) return null;
  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (DROPPED_QUERY_KEYS.has(key.toLowerCase())) continue;
    if (hasDanger(key) || hasDanger(value)) return null;
    kept.append(key, value);
  }
  const serialized = kept.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Same-origin relative paths on the public and staff allowlist.
 * Fragments are removed so a reset token in `#token=` cannot ride along in `next`.
 */
export function sanitizeNextParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || hasDanger(trimmed)) return null;

  let current = trimmed;
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeOnce(current);
    if (hasDanger(decoded)) return null;
    current = decoded;
  }

  const withoutHash = current.split("#")[0] ?? current;
  const [pathPart, queryPart] = withoutHash.split("?");
  const path = normalizeAppPath(pathPart ?? "");
  if (!isAllowedNextPath(path)) return null;
  const query = safeQuery(queryPart ?? "");
  if (query === null) return null;
  return `${path}${query}`;
}

export function loginHrefForPrivatePath(pathname: string, search = ""): string {
  const query = search.startsWith("?") || search.length === 0 ? search : `?${search}`;
  const safe = sanitizeNextParam(`${pathname}${query}`.split("#")[0] ?? pathname);
  if (!safe) return "/login";
  return `/login?next=${encodeURIComponent(safe)}`;
}

export function loginPathForLocale(locale: "en" | "si" | "ta"): string {
  if (locale === "en") return "/login";
  return `/${locale}/login`;
}

export function forgotPasswordPathForLocale(locale: "en" | "si" | "ta"): string {
  if (locale === "en") return "/forgot-password";
  return `/${locale}/forgot-password`;
}

export function resetPasswordPathForLocale(locale: "en" | "si" | "ta"): string {
  if (locale === "en") return "/reset-password";
  return `/${locale}/reset-password`;
}
