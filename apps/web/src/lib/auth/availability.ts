import type { AuthAvailability } from "./types";

/**
 * Step 38: login UI and client boundary only.
 * Live API login is enabled in Step 39 via NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1.
 */
export function getAuthAvailability(): AuthAvailability {
  if (process.env.NODE_ENV === "production") {
    return "preview";
  }
  if (process.env.NEXT_PUBLIC_AUTH_FIXTURE === "1") {
    return "fixture";
  }
  if (process.env.NEXT_PUBLIC_AUTH_LOGIN_ENABLED === "1") {
    return "live";
  }
  return "preview";
}

export function isLoginLive(): boolean {
  return getAuthAvailability() === "live";
}
