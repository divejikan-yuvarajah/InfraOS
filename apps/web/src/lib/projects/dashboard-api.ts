import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { DashboardPayload } from "./dashboard-view";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

export async function fetchProjectDashboard(): Promise<DashboardPayload> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: DashboardPayload }>("/api/v1/projects/dashboard", {
    method: "GET",
    authenticated: true,
  });
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data;
}
