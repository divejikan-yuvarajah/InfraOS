import { getAuthAvailability } from "./availability";
import {
  applyAuthenticated,
  clearAuthSession,
  getAuthEpoch,
  getMemoryAccessToken,
  markAuthBootSettled,
  setAuthError,
  setRefreshing,
} from "./state";
import { resolveAuthTransport } from "./transport";
import type { AuthFailureCode, AuthLoginResult, AuthTransport } from "./types";

let inflight: Promise<AuthLoginResult> | null = null;
let bootStarted = false;
let bootPromise: Promise<AuthLoginResult | null> | null = null;

function keepsSession(code: AuthFailureCode): boolean {
  return code === "UNAVAILABLE" || code === "NETWORK" || code === "RATE_LIMITED" || code === "NOT_LIVE";
}

const NOT_LIVE: AuthLoginResult = {
  ok: false,
  code: "NOT_LIVE",
  message:
    "Sign-in is not live yet. Step 39 will connect this form to the authentication service.",
};

export function refreshAuthSessionSingleFlight(
  transport?: AuthTransport,
): Promise<AuthLoginResult> {
  if (!inflight) {
    inflight = performRefresh(transport).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function performRefresh(transport?: AuthTransport): Promise<AuthLoginResult> {
  const refresh = resolveAuthTransport(transport).refresh;
  if (!refresh) return NOT_LIVE;
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  setRefreshing();
  const result = await refresh();
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    return {
      ok: false,
      code: "SESSION_EXPIRED",
      message: "Your session has ended. Sign in again.",
    };
  }
  if (result.ok) {
    applyAuthenticated(result.session, atEpoch);
    return result;
  }
  if (keepsSession(result.code)) {
    setAuthError();
    return result;
  }
  clearAuthSession();
  return result;
}

/** One refresh attempt when the app boots. No-op unless live mode is enabled. */
export function bootstrapAuthFromRefresh(): Promise<AuthLoginResult | null> {
  if (bootStarted && bootPromise) return bootPromise;
  bootStarted = true;
  if (getAuthAvailability() !== "live") {
    markAuthBootSettled();
    bootPromise = Promise.resolve(null);
    return bootPromise;
  }
  bootPromise = refreshAuthSessionSingleFlight().finally(() => {
    markAuthBootSettled();
  });
  return bootPromise;
}

export function resetAuthRefreshForTests(): void {
  inflight = null;
  bootStarted = false;
  bootPromise = null;
}
