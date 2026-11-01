import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { CreateWorkRequestBody, WorkRequestListData, WorkRequestRecord } from "./work-requests-view";

export type Envelope<T> = { success: true; data: T };

export function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

/** A response that arrives after sign-out or a user switch is discarded, never rendered. */
export function moved(atEpoch: number, tokenAtStart: string) {
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

/* ---------- Step 67: geometry validation and map ---------- */

export type GeoIssue = { code: string; message: string };
export type GeoValidation = {
  valid: boolean;
  errors?: GeoIssue[];
  warnings: string[];
  geometry?: import("./work-requests-view").GeometryInput;
  derived?: { centroid: [number, number]; bbox: [number, number, number, number]; lengthMeters: number | null; areaSqMeters: number | null; vertexCount: number };
  candidates: { index: number; label: string; type: string; valid: boolean }[];
};

/** Authoritative server check. Stores nothing; accepts a Geometry, Feature or FeatureCollection. */
export async function validateGeo(geojson: unknown): Promise<GeoValidation> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<GeoValidation>>("/api/v1/roadsync/geo/validate", { method: "POST", authenticated: true, body: { geojson } });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export type WorkMapFeature = {
  type: "Feature";
  geometry: import("./work-requests-view").GeometryInput;
  properties: { id: string; workType: string; status: string; priority: string; plannedStart: string; plannedEnd: string; agencyName: string | null; projectTitle: string | null; projectCode: string | null; maxBand?: import("./assessment").Band | null; riskIndex?: number | null };
};
export type WorkMapData = { type: "FeatureCollection"; truncated: boolean; features: WorkMapFeature[] };

export async function fetchWorkRequestMap(query: string): Promise<WorkMapData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<WorkMapData>>(`/api/v1/roadsync/work-requests/map${query ? `?${query}` : ""}`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
