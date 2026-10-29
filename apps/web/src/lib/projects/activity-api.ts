import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { ActivityFilter, ActivityViewItem } from "./activity-view";

export type ProjectActivity = {
  projectId: string;
  projectStatus: string;
  physicalProgress: number;
  progressMeaning: "reported_not_verified";
  activities: ActivityViewItem[];
  pageSize: number;
  nextCursor: string | null;
  hasMore: boolean;
  coverage: "supported_events_only" | "partial_source_coverage";
  sourceAvailability: { audit: "available"; progress: "available" };
};

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

export async function fetchProjectActivity(projectId: string, category: ActivityFilter, cursor?: string): Promise<ProjectActivity> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ category, limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const payload = await apiClient<{ success: true; data: ProjectActivity }>(`/api/v1/projects/${projectId}/activity?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data;
}
