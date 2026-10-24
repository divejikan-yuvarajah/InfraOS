import { PUBLIC_INFO_SLUGS, PUBLIC_LOCALES, publicHomePath, publicInfoPath } from "@/lib/landing/locales";

import type { AuthAvailability, AuthClientPhase } from "./types";

export type AppPathClass = "public" | "auth" | "private";

export type AuthPublicSnapshot = {
  phase: AuthClientPhase;
  authenticated: boolean;
  bootSettled: boolean;
  /** True only after GET /api/v1/auth/me succeeds for the current memory token. */
  identityConfirmed: boolean;
};

export type PrivateAccessDecision = "loading" | "content" | "retry" | "preview" | "login" | "confirm";

const AUTH_TAILS = new Set(["login", "forgot-password", "reset-password", "verify-email"]);

/** Staff prefixes from the route catalog. Pages other than /dashboard are not built in Step 43. */
const PRIVATE_ROOTS = new Set([
  "dashboard",
  "projects",
  "roadsync",
  "map",
  "contractors",
  "assets",
  "documents",
  "inspections",
  "issues",
  "notifications",
  "reports",
  "profile",
  "settings",
  "admin",
]);

const ERROR_PATHS = ["/403", "/404", "/500", "/maintenance"] as const;

const PUBLIC_NEXT = new Set<string>(ERROR_PATHS);

for (const locale of PUBLIC_LOCALES) {
  PUBLIC_NEXT.add(publicHomePath(locale));
  for (const slug of PUBLIC_INFO_SLUGS) {
    PUBLIC_NEXT.add(publicInfoPath(locale, slug));
  }
}

export const DASHBOARD_PATH = "/dashboard";

export function normalizeAppPath(input: string): string {
  const withoutHash = input.split("#")[0] ?? input;
  const path = (withoutHash.split("?")[0] ?? withoutHash).trim();
  if (!path.startsWith("/")) return "/";
  const collapsed = path.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) return collapsed.slice(0, -1);
  return collapsed;
}

function segmentsOf(path: string): string[] {
  return normalizeAppPath(path).split("/").filter(Boolean);
}

export function isAuthPath(pathname: string): boolean {
  const parts = segmentsOf(pathname);
  if (parts.length === 1) return AUTH_TAILS.has(parts[0] ?? "");
  if (parts.length === 2 && (parts[0] === "si" || parts[0] === "ta")) {
    return AUTH_TAILS.has(parts[1] ?? "");
  }
  return false;
}

export function isLoginPath(pathname: string): boolean {
  const parts = segmentsOf(pathname);
  if (parts.length === 1) return parts[0] === "login";
  if (parts.length === 2 && (parts[0] === "si" || parts[0] === "ta")) return parts[1] === "login";
  return false;
}

export function isPrivatePath(pathname: string): boolean {
  const parts = segmentsOf(pathname);
  if (parts.length === 0) return false;
  const root = parts[0] ?? "";
  if (root === "si" || root === "ta" || root === "public-map") return false;
  return PRIVATE_ROOTS.has(root);
}

/** Unknown and public marketing routes stay public. Private matches a whole path segment. */
export function classifyAppPath(pathname: string): AppPathClass {
  if (isAuthPath(pathname)) return "auth";
  if (isPrivatePath(pathname)) return "private";
  return "public";
}

export function isAllowedNextPath(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  if (isAuthPath(path)) return false;
  if (isPrivatePath(path)) return true;
  return PUBLIC_NEXT.has(path);
}

export function privateAccessDecision(input: {
  availability: AuthAvailability;
  snapshot: AuthPublicSnapshot;
}): PrivateAccessDecision {
  const { snapshot, availability } = input;
  if (
    !snapshot.bootSettled ||
    snapshot.phase === "unknown" ||
    snapshot.phase === "refreshing" ||
    snapshot.phase === "authenticating"
  ) {
    return "loading";
  }
  if (availability !== "live") return "preview";
  if (snapshot.phase === "error") return "retry";
  if (snapshot.authenticated && snapshot.identityConfirmed) return "content";
  if (snapshot.authenticated) return "confirm";
  return "login";
}
