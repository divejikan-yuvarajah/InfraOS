import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { TimelineGroup, TimelineViewEntry } from "./timeline-view";

export type ProjectTimeline = {
  projectId: string;
  entries: TimelineViewEntry[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  historyCapped: boolean;
  sourceAvailability: {
    milestone: "visible" | "restricted" | "unavailable";
    progress: "visible" | "restricted" | "unavailable";
  };
  current: {
    projectStatus: string;
    physicalProgress: number;
    meaning: "reported_not_verified";
  };
  dependencies: {
    status: "visible" | "unavailable" | "not_implemented";
    scheduling?: "informational";
    links?: Array<{
      id: string;
      direction: "depends_on";
      scheduling: "informational";
      prerequisite:
        | { visibility: "visible"; projectCode: string; title: string; projectStatus: string }
        | { visibility: "restricted" };
    }>;
  };
  provenance: string;
};

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

export async function fetchProjectTimeline(projectId: string, group: TimelineGroup, sort: "asc" | "desc", page: number): Promise<ProjectTimeline> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ kind: group, sort, page: String(page), limit: "30" });
  const payload = await apiClient<{ success: true; data: { timeline: ProjectTimeline } }>(`/api/v1/projects/${projectId}/timeline?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data.timeline;
}
