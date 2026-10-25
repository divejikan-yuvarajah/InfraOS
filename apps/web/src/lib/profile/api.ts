import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { ProfileEnvelope, SelfProfile } from "./types";

function sessionMoved(atEpoch: number, tokenAtStart: string | null): boolean {
  return getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart;
}

export async function fetchSelfProfile(): Promise<SelfProfile> {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) {
    throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  }
  const payload = await apiClient<ProfileEnvelope>("/api/v1/profile/me", {
    method: "GET",
    authenticated: true,
  });
  if (sessionMoved(atEpoch, tokenAtStart)) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data.profile;
}

export async function updateSelfProfile(input: {
  firstName: string;
  lastName: string;
  revision: number;
}): Promise<SelfProfile> {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) {
    throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  }
  const payload = await apiClient<ProfileEnvelope>("/api/v1/profile/me", {
    method: "PATCH",
    authenticated: true,
    body: input,
  });
  if (sessionMoved(atEpoch, tokenAtStart)) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data.profile;
}
