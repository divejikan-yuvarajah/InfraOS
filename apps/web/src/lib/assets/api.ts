import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import type {
  AssetDetail, AssetList, AssetSummary, ConversionDetail, ConversionList, ConversionPreview, ConvertibleProjects, Insights, MaintCalendar, MaintDetail, MaintList, MaintSummary, Timeline,
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

type Method = "GET" | "POST" | "PATCH" | "DELETE";
/** One request with the session guard: a result that arrives after sign-out or a user switch is discarded. Notes, costs and names are never logged. */
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

/* assets */
export const fetchAssets = (q: Q, signal?: AbortSignal) => call<AssetList>("GET", `/assets${qs(q)}`, undefined, signal);
export const fetchAssetSummary = (signal?: AbortSignal) => call<AssetSummary>("GET", "/assets/summary", undefined, signal);
export const fetchAsset = (id: string, signal?: AbortSignal) => call<AssetDetail>("GET", `/assets/${id}`, undefined, signal);
export const fetchTimeline = (id: string, q: Q) => call<Timeline>("GET", `/assets/${id}/timeline${qs(q)}`);
export const patchAsset = (id: string, body: unknown) => call<{ updated: boolean }>("PATCH", `/assets/${id}`, body);
export const changeAssetStatus = (id: string, body: unknown) => call<{ status: string }>("POST", `/assets/${id}/status`, body);
export const addAsset = (body: unknown) => call<{ id: string; assetNo: string | null }>("POST", "/assets", body);
export const recordAssessment = (id: string, body: unknown) => call<{ id: string; condition: string }>("POST", `/assets/${id}/assessments`, body);

/** Downloads the server-generated CSV with the bearer token and hands it to the browser as a file. The server neutralises formula-like cells. */
export async function downloadAssetsCsv(filters: Q): Promise<number> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/assets/export.csv${qs(filters)}`, { headers: { Authorization: `Bearer ${tokenAtStart}`, Accept: "text/csv" }, credentials: "omit" });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("export failed", res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = "assets.csv"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Number(res.headers.get("X-Row-Count") ?? 0);
}

/* conversions */
export const fetchConvertibleProjects = (q: Q) => call<ConvertibleProjects>("GET", `/assets/conversions/projects${qs(q)}`);
export const previewConversion = (q: Q, signal?: AbortSignal) => call<ConversionPreview>("GET", `/assets/conversions/preview${qs(q)}`, undefined, signal);
export const requestConversion = (body: unknown) => call<{ id: string; conversionNo: string }>("POST", "/assets/conversions", body);
export const fetchConversions = (q: Q, signal?: AbortSignal) => call<ConversionList>("GET", `/assets/conversions${qs(q)}`, undefined, signal);
export const fetchConversion = (id: string) => call<ConversionDetail>("GET", `/assets/conversions/${id}`);
export const cancelConversion = (id: string) => call<{ cancelled: boolean }>("POST", `/assets/conversions/${id}/cancel`, {});
export const approveConversion = (id: string, body: unknown = {}) => call<{ status: string; assets: { id: string; assetNo: string | null; name: string }[] }>("POST", `/assets/conversions/${id}/approve`, body);
export const rejectConversion = (id: string, body: unknown) => call<{ status: string }>("POST", `/assets/conversions/${id}/reject`, body);

/* maintenance */
export const fetchMaintenance = (q: Q, signal?: AbortSignal) => call<MaintList>("GET", `/maintenance${qs(q)}`, undefined, signal);
export const fetchMaintCalendar = (q: Q, signal?: AbortSignal) => call<MaintCalendar>("GET", `/maintenance/calendar${qs(q)}`, undefined, signal);
export const fetchMaintSummary = (signal?: AbortSignal) => call<MaintSummary>("GET", "/maintenance/summary", undefined, signal);
export const fetchMaintDetail = (id: string, signal?: AbortSignal) => call<MaintDetail>("GET", `/maintenance/${id}`, undefined, signal);
export const requestMaintenance = (assetId: string, body: unknown) => call<{ id: string; maintenanceNo: string; status: string }>("POST", `/assets/${assetId}/maintenance`, body);
export const patchMaintenance = (id: string, body: unknown) => call<{ updated: boolean }>("PATCH", `/maintenance/${id}`, body);
export const maintAction = (id: string, action: "approve" | "reject" | "schedule" | "start" | "complete" | "cancel", body: unknown = {}) => call<{ id: string; status: string; suggestAssessment?: boolean }>("POST", `/maintenance/${id}/${action}`, body);
export const toggleTask = (id: string, key: string, body: unknown) => call<{ key: string; done: boolean }>("PATCH", `/maintenance/${id}/tasks/${key}`, body);
export const createMaintEvidence = (id: string, body: unknown) => call<{ evidenceId: string }>("POST", `/maintenance/${id}/evidence`, body);
export const removeMaintEvidence = (evidenceId: string, reason: string) => call<{ removed: boolean }>("DELETE", `/maintenance/evidence/${evidenceId}`, { reason });

export function uploadMaintFile(evidenceId: string, variant: "full" | "thumb", blob: Blob, onProgress: (fraction: number) => void): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${getPublicApiBaseUrl()}/api/v1/maintenance/evidence/${evidenceId}/file?variant=${variant}`);
    xhr.setRequestHeader("Authorization", `Bearer ${tokenAtStart}`);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new ApiError("network error", 0, { code: "NETWORK" }));
    xhr.onload = () => {
      try { moved(atEpoch, tokenAtStart); } catch (e) { reject(e); return; }
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(1); resolve(); return; }
      let details: unknown = {};
      try { details = (JSON.parse(xhr.responseText) as { error?: { details?: unknown } }).error?.details ?? {}; } catch { /* not JSON */ }
      reject(new ApiError("upload failed", xhr.status, { details }));
    };
    xhr.send(blob);
  });
}
/** Protected maintenance photo, fetched with the bearer token. The browser never receives a public or presigned URL. */
export async function fetchMaintBlob(evidenceId: string, variant: "full" | "thumb", signal?: AbortSignal): Promise<Blob> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/maintenance/evidence/${evidenceId}/file?variant=${variant}`, { headers: { Authorization: `Bearer ${tokenAtStart}` }, credentials: "omit", ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("file unavailable", res.status);
  return res.blob();
}

/* insights */
export const fetchInsights = (q: Q, signal?: AbortSignal) => call<Insights>("GET", `/insights/coordination${qs(q)}`, undefined, signal);

export type FailureInfo = { status: number; reason: string | null; field: string | null; details: Record<string, unknown> };
export function failureOf(error: unknown): FailureInfo {
  if (error instanceof ApiError) {
    const d = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
    return { status: error.status, reason: typeof d.reason === "string" ? d.reason : typeof d.current === "string" ? d.current : null, field: typeof d.field === "string" ? d.field : null, details: d };
  }
  return { status: 0, reason: null, field: null, details: {} };
}
