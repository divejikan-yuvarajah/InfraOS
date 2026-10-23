import { getAuthAvailability } from "./availability";
import { applyAuthenticated, clearAuthSession, getAuthEpoch, setRefreshing } from "./state";
import { resolveAuthTransport } from "./transport";
import type { AuthLoginResult, AuthTransport } from "./types";

let inflight: Promise<AuthLoginResult> | null = null;
let bootStarted = false;

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
  setRefreshing();
  const result = await refresh();
  if (getAuthEpoch() !== atEpoch) {
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
  clearAuthSession();
  return result;
}

/** One refresh attempt when the app boots. No-op unless live mode is enabled. */
export function bootstrapAuthFromRefresh(): Promise<AuthLoginResult | null> {
  if (bootStarted) return Promise.resolve(null);
  bootStarted = true;
  if (getAuthAvailability() !== "live") return Promise.resolve(null);
  return refreshAuthSessionSingleFlight();
}

export function resetAuthRefreshForTests(): void {
  inflight = null;
  bootStarted = false;
}
