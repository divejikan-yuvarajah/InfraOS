import { ApiError, apiClient } from "@/lib/api/client";

import {
  clearAuthSession,
  confirmAuthenticatedIdentity,
  getAuthEpoch,
  getAuthSnapshot,
  getMemoryAccessToken,
  setAuthError,
  setRefreshing,
} from "./state";

type MePayload = {
  data?: {
    user?: {
      id?: string;
    };
  };
};

let inflight: Promise<"ok" | "unauthorized" | "unavailable"> | null = null;

function sessionMoved(atEpoch: number, tokenAtStart: string): boolean {
  return getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart;
}

/** One follow-up after a newer sign-in replaces the token this check started with. */
function followNewerSignIn(
  depth: number,
): Promise<"ok" | "unauthorized" | "unavailable"> {
  const snapshot = getAuthSnapshot();
  if (
    depth < 1 &&
    getMemoryAccessToken() &&
    snapshot.phase === "authenticated" &&
    !snapshot.identityConfirmed
  ) {
    return runConfirm(depth + 1);
  }
  return Promise.resolve("unauthorized");
}

async function runConfirm(depth = 0): Promise<"ok" | "unauthorized" | "unavailable"> {
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) return "unauthorized";
  const atEpoch = getAuthEpoch();
  setRefreshing();
  try {
    const payload = await apiClient<MePayload>("/api/v1/auth/me", {
      method: "GET",
      authenticated: true,
    });
    if (sessionMoved(atEpoch, tokenAtStart)) return followNewerSignIn(depth);
    if (!payload.data?.user?.id) {
      setAuthError();
      return "unavailable";
    }
    confirmAuthenticatedIdentity();
    return "ok";
  } catch (error) {
    if (sessionMoved(atEpoch, tokenAtStart)) return followNewerSignIn(depth);
    if (error instanceof ApiError && error.status === 401 && !getMemoryAccessToken()) {
      clearAuthSession();
      return "unauthorized";
    }
    setAuthError();
    return "unavailable";
  }
}

/** One in-flight GET /auth/me. A 401 may refresh once inside apiClient. */
export function confirmSessionWithMe(): Promise<"ok" | "unauthorized" | "unavailable"> {
  if (!inflight) {
    inflight = runConfirm().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
