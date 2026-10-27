import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { ProjectCreateRequest } from "./create-transform";
import type { ProjectPatchRequest } from "./edit-transform";
import type { ProjectDetail, ProjectDetailPayload, ProjectListPayload, ProjectSummary, ReviewDetailPayload, ReviewQueuePayload } from "./types";

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

export async function fetchProjects(query: {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  type?: string;
  agencyId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<ProjectListPayload["data"]> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (query.agencyId) params.set("agencyId", query.agencyId);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
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

export async function createProject(body: ProjectCreateRequest): Promise<{ project: ProjectDetail; epoch: number; token: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ProjectDetailPayload>("/api/v1/projects", {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return { project: payload.data.project, epoch: atEpoch, token: tokenAtStart };
}

export async function patchProject(
  id: string,
  body: ProjectPatchRequest,
): Promise<{ project: ProjectDetail; epoch: number; token: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ProjectDetailPayload>(`/api/v1/projects/${id}`, {
    method: "PATCH",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return { project: payload.data.project, epoch: atEpoch, token: tokenAtStart };
}

export async function transitionProject(
  id: string,
  body: { action: "SUBMIT" | "HOLD" | "RESUME" | "REOPEN"; revision: number; reason?: string },
): Promise<{ project: ProjectDetail; epoch: number; token: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ProjectDetailPayload>(`/api/v1/projects/${id}/transition`, {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return { project: payload.data.project, epoch: atEpoch, token: tokenAtStart };
}

export async function fetchReviewQueue(query: {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  agencyId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<ReviewQueuePayload["data"]> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.agencyId) params.set("agencyId", query.agencyId);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  const payload = await apiClient<ReviewQueuePayload>(`/api/v1/projects/review-queue?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchReview(id: string) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ReviewDetailPayload>(`/api/v1/projects/${id}/review`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function submitReview(
  id: string,
  body: { action: "BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES"; revision: number; reason?: string },
): Promise<{ project: ProjectDetail; epoch: number; token: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<ProjectDetailPayload>(`/api/v1/projects/${id}/review`, {
    method: "POST",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return { project: payload.data.project, epoch: atEpoch, token: tokenAtStart };
}

export type { ProjectSummary };
