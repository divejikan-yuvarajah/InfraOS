import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import type { FinancialSummary } from "@/lib/projects/finance-summary";

export type FinancialProgressPayload = {
  summary: FinancialSummary;
  calculatedAt: string;
};

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

export async function fetchFinancialProgress(projectId: string): Promise<FinancialProgressPayload> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: FinancialProgressPayload }>(`/api/v1/projects/${projectId}/financial-progress`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
