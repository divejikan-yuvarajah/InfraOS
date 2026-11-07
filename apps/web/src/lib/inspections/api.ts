import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import type {
  CalendarPayload, ContractorOutcomes, InspectionDetail, InspectionList, InspectorOption, MyWork, ProjectInspections, Report, Summary, VerifiedSeries, ChecklistItem,
} from "./types";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}
function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** One request with the session guard: a result that arrives after sign-out or a user switch is discarded. Captions, notes and locations are never logged. */
async function call<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1${path}`, { method, authenticated: true, ...(body !== undefined ? { body } : {}), ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};
type Q = Record<string, string | number | boolean | undefined | null>;

export const fetchInspections = (q: Q, signal?: AbortSignal) => call<InspectionList>("GET", `/inspections${qs(q)}`, undefined, signal);
export const fetchCalendar = (q: Q, signal?: AbortSignal) => call<CalendarPayload>("GET", `/inspections/calendar${qs(q)}`, undefined, signal);
export const fetchSummary = (q: Q = {}, signal?: AbortSignal) => call<Summary>("GET", `/inspections/summary${qs(q)}`, undefined, signal);
export const fetchMyWork = (signal?: AbortSignal) => call<MyWork>("GET", "/inspections/my", undefined, signal);
export const fetchInspectors = (q: Q, signal?: AbortSignal) => call<{ inspectors: InspectorOption[] }>("GET", `/inspections/inspectors${qs(q)}`, undefined, signal);
export const fetchChecklist = (type: string) => call<{ type: string; version: string; items: ChecklistItem[] }>("GET", `/inspections/checklist/${type}`);
export const fetchInspection = (id: string, signal?: AbortSignal) => call<InspectionDetail>("GET", `/inspections/${id}`, undefined, signal);
export const fetchProjectInspections = (projectId: string) => call<ProjectInspections>("GET", `/projects/${projectId}/inspections`);
export const fetchVerifiedSeries = (projectId: string) => call<VerifiedSeries>("GET", `/projects/${projectId}/verified-progress`);
export const fetchContractorOutcomes = (id: string) => call<ContractorOutcomes>("GET", `/contractors/${id}/inspection-outcomes`);

export const scheduleInspection = (body: unknown) => call<{ id: string; inspectionNo: string }>("POST", "/inspections", body);
export const editInspection = (id: string, body: unknown) => call<{ updated: boolean }>("PATCH", `/inspections/${id}`, body);
export const rescheduleInspection = (id: string, body: unknown) => call<{ rescheduled: boolean }>("POST", `/inspections/${id}/reschedule`, body);
export const reassignInspection = (id: string, body: unknown) => call<{ reassigned: boolean }>("POST", `/inspections/${id}/assign`, body);
export const cancelInspection = (id: string, body: unknown) => call<{ cancelled: boolean }>("POST", `/inspections/${id}/cancel`, body);
export const startInspection = (id: string) => call<{ started: boolean }>("POST", `/inspections/${id}/start`, {});
export const saveReport = (id: string, body: Omit<Report, "checklistVersion">) => call<{ revision: number; savedAt: string }>("PUT", `/inspections/${id}/report`, body);
export const submitInspection = (id: string, revision: number) => call<{ submitted: boolean }>("POST", `/inspections/${id}/submit`, { revision });
export const decideInspection = (id: string, body: unknown) => call<{ status: string; verificationId: string | null; verifiedPercent: number | null }>("POST", `/inspections/${id}/decision`, body);

export const createEvidence = (id: string, body: unknown) => call<{ evidenceId: string; sitePresence: unknown }>("POST", `/inspections/${id}/evidence`, body);
export const patchEvidence = (evidenceId: string, body: unknown) => call<{ updated: boolean }>("PATCH", `/inspections/evidence/${evidenceId}`, body);
export const removeEvidence = (evidenceId: string, reason: string) => call<{ removed: boolean }>("DELETE", `/inspections/evidence/${evidenceId}`, { reason });

/** Uploads raw image bytes with progress. XMLHttpRequest is used only because fetch cannot report upload progress. */
export function uploadEvidenceFile(evidenceId: string, variant: "full" | "thumb", blob: Blob, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  const base = getPublicApiBaseUrl();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${base}/api/v1/inspections/evidence/${evidenceId}/file?variant=${variant}`);
    xhr.setRequestHeader("Authorization", `Bearer ${tokenAtStart}`);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new ApiError("network error", 0, { code: "NETWORK" }));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.onload = () => {
      try { moved(atEpoch, tokenAtStart); } catch (e) { reject(e); return; }
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(1); resolve(); return; }
      let details: unknown = {};
      try { details = (JSON.parse(xhr.responseText) as { error?: { details?: unknown } }).error?.details ?? {}; } catch { /* not JSON */ }
      reject(new ApiError("upload failed", xhr.status, { details }));
    };
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/** Fetches a protected evidence file with the bearer token. The browser never receives a public or presigned URL. */
export async function fetchEvidenceBlob(evidenceId: string, variant: "full" | "thumb", signal?: AbortSignal): Promise<Blob> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/inspections/evidence/${evidenceId}/file?variant=${variant}`, { headers: { Authorization: `Bearer ${tokenAtStart}` }, credentials: "omit", ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("file unavailable", res.status);
  return res.blob();
}

export type FailureInfo = { status: number; reason: string | null; field: string | null; gaps: string[]; details: Record<string, unknown> };
export function failureOf(error: unknown): FailureInfo {
  if (error instanceof ApiError) {
    const d = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
    return { status: error.status, reason: typeof d.reason === "string" ? d.reason : typeof d.current === "string" ? d.current : null, field: typeof d.field === "string" ? d.field : null, gaps: Array.isArray(d.gaps) ? (d.gaps as string[]) : [], details: d };
  }
  return { status: 0, reason: null, field: null, gaps: [], details: {} };
}
