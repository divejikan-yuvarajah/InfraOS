import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { ProjectDetailPayload, ProjectListPayload, ProjectSummary } from "./types";

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

export async function fetchProjects(query: { page: number; limit: number; q?: string }): Promise<ProjectListPayload["data"]> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.q) params.set("q", query.q);
  const payload = await apiClient<ProjectListPayload>(`/api/v1/projects?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchProject(id: string) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ProjectDetailPayload>(`/api/v1/projects/${id}`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data.project;
}

export type { ProjectSummary };
