import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { CreateWorkRequestBody, WorkRequestListData, WorkRequestRecord } from "./work-requests-view";

type Envelope<T> = { success: true; data: T };

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

/** A response that arrives after sign-out or a user switch is discarded, never rendered. */
function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

export async function fetchWorkRequests(query: string): Promise<WorkRequestListData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<WorkRequestListData>>(`/api/v1/roadsync/work-requests?${query}`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchWorkRequest(id: string): Promise<WorkRequestRecord> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ workRequest: WorkRequestRecord }>>(`/api/v1/roadsync/work-requests/${encodeURIComponent(id)}`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data.workRequest;
}

export async function createWorkRequest(body: CreateWorkRequestBody): Promise<WorkRequestRecord> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ workRequest: WorkRequestRecord }>>("/api/v1/roadsync/work-requests", { method: "POST", authenticated: true, body });
  moved(atEpoch, tokenAtStart);
  return payload.data.workRequest;
}

export type WorkRequestFailureKind = "forbidden" | "not-found" | "conflict" | "invalid" | "auth" | "unavailable";

export function classifyWorkRequestError(error: unknown): WorkRequestFailureKind {
  if (!(error instanceof ApiError)) return "unavailable";
  if (error.status === 401) return "auth";
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  if (error.status === 409) return "conflict";
  if (error.status === 400) return "invalid";
  return "unavailable";
}

export const FAILURE_COPY: Record<WorkRequestFailureKind, string> = {
  forbidden: "Your role is not permitted to do this.",
  "not-found": "This work request or project is not available to you.",
  conflict: "The linked project is not in a state that accepts new work requests.",
  invalid: "The server rejected the details. Check the highlighted fields.",
  auth: "Your session has ended. Sign in again to continue.",
  unavailable: "RoadSync is temporarily unavailable. Try again shortly.",
};
