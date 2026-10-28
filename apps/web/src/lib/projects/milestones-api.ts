import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

export type MilestoneRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "BLOCKED" | "CANCELLED";
  revision: number;
};

export type MilestoneList = {
  milestones: MilestoneRecord[];
  page: number;
  limit: number;
  total: number;
  counts: {
    notStarted: number;
    inProgress: number;
    delayed: number;
    blocked: number;
    completed: number;
    cancelled: number;
  };
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

export async function fetchMilestones(projectId: string): Promise<MilestoneList> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: MilestoneList }>(`/api/v1/projects/${projectId}/milestones`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function createMilestone(projectId: string, body: { title: string; description?: string; plannedStart: string; plannedEnd: string }) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { milestone: MilestoneRecord } }>(`/api/v1/projects/${projectId}/milestones`, {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.milestone;
}

export async function patchMilestone(projectId: string, milestoneId: string, body: { revision: number; title?: string; description?: string; plannedStart?: string; plannedEnd?: string; progress?: number }) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { milestone: MilestoneRecord } }>(`/api/v1/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PATCH",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.milestone;
}

export async function transitionMilestone(projectId: string, milestoneId: string, body: { action: string; revision: number }) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { milestone: MilestoneRecord } }>(`/api/v1/projects/${projectId}/milestones/${milestoneId}/transition`, {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.milestone;
}
