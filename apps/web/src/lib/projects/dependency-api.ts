import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { DependencyLinkView } from "./dependency-view";

export type DependencyList = {
  projectId: string;
  graphRevision: number;
  links: DependencyLinkView[];
  page: number;
  limit: number;
  total: number;
  scheduling: "informational";
};

export type DependencyCandidate = {
  projectId: string;
  projectCode: string;
  title: string;
  projectStatus: string;
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

export async function fetchProjectDependencies(projectId: string): Promise<DependencyList> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: DependencyList }>(`/api/v1/projects/${projectId}/dependencies`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function searchDependencyCandidates(projectId: string, q: string): Promise<DependencyCandidate[]> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ q });
  const payload = await apiClient<{ success: true; data: { candidates: DependencyCandidate[] } }>(`/api/v1/projects/${projectId}/dependencies/candidates?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.candidates;
}

export async function addProjectDependency(projectId: string, prerequisiteProjectId: string, graphRevision: number) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { link: DependencyLinkView; graphRevision: number } }>(`/api/v1/projects/${projectId}/dependencies`, {
    method: "POST",
    authenticated: true,
    body: { prerequisiteProjectId, graphRevision },
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function removeProjectDependency(projectId: string, dependencyId: string, graphRevision: number) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { removedId: string; graphRevision: number } }>(`/api/v1/projects/${projectId}/dependencies/${dependencyId}`, {
    method: "DELETE",
    authenticated: true,
    body: { graphRevision },
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
