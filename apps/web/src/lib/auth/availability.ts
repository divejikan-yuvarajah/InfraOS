import type { AuthAvailability } from "./types";

/**
 * Production authentication is opt-in and remains preview-only by default.
 * NEXT_PUBLIC_* values are public build-time flags, never credentials.
 * A live deployment additionally needs a reachable API, CORS/cookie checks,
 * production secrets, and the owner-approved release checklist.
 */
function hasProductionApiOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "::1" &&
      !url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function getAuthAvailability(): AuthAvailability {
  const requestedLive = process.env.NEXT_PUBLIC_AUTH_LOGIN_ENABLED === "1";
  if (process.env.NODE_ENV === "production") {
    return requestedLive && hasProductionApiOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
      ? "live"
      : "preview";
  }
  if (process.env.NEXT_PUBLIC_AUTH_FIXTURE === "1") {
    return "fixture";
  }
  return requestedLive ? "live" : "preview";
}

export function isLoginLive(): boolean {
  return getAuthAvailability() === "live";
}
