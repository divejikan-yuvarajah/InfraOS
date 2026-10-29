import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

export type ProgressReportRecord = {
  id: string;
  reportedPercent: number;
  previousPercent: number;
  note: string;
  reportedAt: string;
  sequence: number;
};

export type ProgressSnapshot = {
  projectId: string;
  status: string;
  physicalProgress: number;
  revision: number;
  latest: ProgressReportRecord | null;
};

export type ProgressHistory = {
  reports: ProgressReportRecord[];
  page: number;
  limit: number;
  total: number;
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

export async function fetchProgress(projectId: string): Promise<ProgressSnapshot> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { progress: ProgressSnapshot } }>(`/api/v1/projects/${projectId}/progress`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.progress;
}

export async function fetchProgressHistory(projectId: string, page = 1): Promise<ProgressHistory> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: ProgressHistory }>(`/api/v1/projects/${projectId}/progress/history?page=${page}&limit=20`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function submitProgress(projectId: string, body: { percentage: number; note: string; revision: number }) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { report: ProgressReportRecord; revision: number; status: string; physicalProgress: number } }>(`/api/v1/projects/${projectId}/progress`, {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
