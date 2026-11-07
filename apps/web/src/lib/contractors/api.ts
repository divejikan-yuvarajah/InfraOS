import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { Assignment, AssignmentList, ContractorList, ContractorProfile, ContractorSummary, DuplicateResult, Performance, ProjectContractors, Timeline } from "./types";
import type { ContractorListState } from "./list-query";
import { toListRequest } from "./list-query";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** One request with the session guard: a result that arrives after sign-out or a user switch is discarded, never shown. */
async function call<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1${path}`, { method, authenticated: true, ...(body !== undefined ? { body } : {}), ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

const query = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const fetchContractors = (state: ContractorListState, signal?: AbortSignal) => call<ContractorList>("GET", `/contractors${query(toListRequest(state))}`, undefined, signal);
export const fetchSummary = () => call<ContractorSummary>("GET", "/contractors/summary");
export const fetchProfile = (id: string) => call<ContractorProfile>("GET", `/contractors/${id}`);
export const fetchPerformance = (id: string) => call<Performance>("GET", `/contractors/${id}/performance`);
export const fetchTimeline = (id: string, cursor?: string) => call<Timeline>("GET", `/contractors/${id}/timeline${query({ cursor, limit: 20 })}`);
export const fetchAssignments = (id: string, view: "active" | "completed" | "all", page = 1) => call<AssignmentList>("GET", `/contractors/${id}/assignments${query({ view, page, limit: 50 })}`);
export const fetchProjectContractors = (projectId: string) => call<ProjectContractors>("GET", `/projects/${projectId}/contractors`);

export const checkDuplicates = (input: { registrationNumber?: string; name?: string; taxId?: string; email?: string; excludeId?: string }, signal?: AbortSignal) =>
  call<DuplicateResult>("GET", `/contractors/duplicate-check${query(input)}`, undefined, signal);

export const registerContractor = (body: unknown) => call<{ id: string }>("POST", "/contractors", body);
export const updateContractor = (id: string, body: unknown) => call<{ id: string }>("PATCH", `/contractors/${id}`, body);
export const changeStatus = (id: string, body: { status: string; reason?: string; acknowledgeImpact?: boolean; expectedUpdatedAt?: string }) => call<{ id: string; status: string }>("POST", `/contractors/${id}/status`, body);
export const addCertification = (id: string, body: unknown) => call<{ id: string }>("POST", `/contractors/${id}/certifications`, body);
export const updateCertification = (id: string, certId: string, body: unknown) => call<{ id: string }>("PATCH", `/contractors/${id}/certifications/${certId}`, body);
export const revokeCertification = (id: string, certId: string, reason: string) => call<{ id: string }>("DELETE", `/contractors/${id}/certifications/${certId}`, { reason });
export const addDocumentRef = (id: string, body: unknown) => call<{ id: string }>("POST", `/contractors/${id}/documents`, body);
export const removeDocumentRef = (id: string, refId: string) => call<{ id: string }>("DELETE", `/contractors/${id}/documents/${refId}`);

export const assignContractor = (projectId: string, body: unknown) => call<{ id: string }>("POST", `/projects/${projectId}/contractors`, body);
export const endAssignment = (projectId: string, assignmentId: string, body: unknown) => call<{ id: string }>("POST", `/projects/${projectId}/contractors/${assignmentId}/end`, body);
export const reassignContractor = (projectId: string, assignmentId: string, body: unknown) => call<{ id: string; previousId: string }>("POST", `/projects/${projectId}/contractors/${assignmentId}/reassign`, body);

/** What the server said about a failed write, reduced to what the UI branches on. Never contains secrets. */
export type FailureInfo = { status: number; code: string | null; kind: string | null; details: Record<string, unknown> };
export function failureOf(error: unknown): FailureInfo {
  if (error instanceof ApiError) {
    const d = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
    return { status: error.status, code: error.code ?? null, kind: typeof d.kind === "string" ? d.kind : null, details: d };
  }
  return { status: 0, code: null, kind: null, details: {} };
}
export type { Assignment };
