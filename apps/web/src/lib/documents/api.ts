import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import type { ActivityList, BulkResult, CategoryList, DocDetail, DocItem, DocList, DocSummary, ProjectDocs, StreamResult, UploadInit, UploadTicket, VersionList } from "./types";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}
function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
}

export type Method = "GET" | "POST" | "PATCH" | "DELETE";
/** One request with the session guard: a result arriving after sign-out or a user switch is discarded. Titles, notes and file names are never logged. */
export async function call<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1${path}`, { method, authenticated: true, ...(body !== undefined ? { body } : {}), ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

type Q = Record<string, string | number | boolean | undefined | null>;
export const qs = (params: Q): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export type Failure = { status: number; reason: string | null; field: string | null; fileError: string | null; existing: { id: string; docNo: string | null; title: string } | null; references: { type: string; id: string }[]; details: Record<string, unknown> };
export function failureOf(error: unknown): Failure {
  if (error instanceof ApiError) {
    const d = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
    return {
      status: error.status, reason: typeof d.reason === "string" ? d.reason : null, field: typeof d.field === "string" ? d.field : null, fileError: typeof d.fileError === "string" ? d.fileError : null,
      existing: d.existing && typeof d.existing === "object" ? (d.existing as Failure["existing"]) : null, references: Array.isArray(d.references) ? (d.references as Failure["references"]) : [], details: d,
    };
  }
  return { status: 0, reason: null, field: null, fileError: null, existing: null, references: [], details: {} };
}

export const fetchDocuments = (q: Q, signal?: AbortSignal) => call<DocList>("GET", `/documents${qs(q)}`, undefined, signal);
export const fetchSummary = (signal?: AbortSignal) => call<DocSummary>("GET", "/documents/summary", undefined, signal);
export const fetchCategories = (signal?: AbortSignal) => call<CategoryList>("GET", "/documents/categories", undefined, signal);
export const fetchDocument = (id: string, signal?: AbortSignal) => call<DocDetail>("GET", `/documents/${id}`, undefined, signal);
export const patchDocument = (id: string, body: unknown) => call<DocItem>("PATCH", `/documents/${id}`, body);
export const setDocStatus = (id: string, body: unknown) => call<DocItem>("POST", `/documents/${id}/status`, body);
export const archiveDocument = (id: string, reason: string) => call<DocItem>("POST", `/documents/${id}/archive`, { reason });
export const restoreDocument = (id: string) => call<DocItem>("POST", `/documents/${id}/restore`, {});
export const restrictDocument = (id: string, body: unknown) => call<DocItem>("POST", `/documents/${id}/restrict`, body);
export const deleteDocument = (id: string, body: { reason: string; confirm: string }) => call<{ deleted: true }>("DELETE", `/documents/${id}`, body);
export const fetchVersions = (id: string, signal?: AbortSignal) => call<VersionList>("GET", `/documents/${id}/versions`, undefined, signal);
export const restoreVersion = (id: string, n: number, changeNote: string) => call<{ versionNo: number }>("POST", `/documents/${id}/versions/${n}/restore`, { changeNote });
export const removeVersion = (id: string, n: number, reason: string) => call<{ removed: true }>("DELETE", `/documents/${id}/versions/${n}`, { reason });
export const fetchActivity = (id: string, q: Q) => call<ActivityList>("GET", `/documents/${id}/activity${qs(q)}`);
export const bulkAction = (body: unknown) => call<BulkResult>("POST", "/documents/bulk", body);
export const fetchProjectDocs = (projectId: string, q: Q, signal?: AbortSignal) => call<ProjectDocs>("GET", `/projects/${projectId}/documents${qs(q)}`, undefined, signal);

/** Registry export with the bearer token, handed to the browser as a file. The server neutralises formula-like cells. */
export async function downloadRegisterCsv(filters: Q): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/documents/export.csv${qs(filters)}`, { headers: { Authorization: `Bearer ${tokenAtStart}`, Accept: "text/csv" }, credentials: "omit" });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("export failed", res.status);
  saveBlob(await res.blob(), "document-register.csv");
}

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Bytes always come through the authenticated API. The result is a Blob the caller turns into a short-lived object URL (revoked on unmount). */
export async function fetchFileBlob(id: string, mode: "download" | "preview", version?: number, signal?: AbortSignal): Promise<{ blob: Blob; mime: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/documents/${id}/${mode}${qs({ version })}`, { headers: { Authorization: `Bearer ${tokenAtStart}` }, credentials: "omit", ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) {
    let details: unknown;
    try { details = (await res.json())?.error?.details; } catch { /* no body */ }
    throw new ApiError("file unavailable", res.status, { details });
  }
  return { blob: await res.blob(), mime: res.headers.get("Content-Type") ?? "application/octet-stream" };
}

/* ---- upload protocol: init -> stream (XHR for real progress) -> commit | abort ---- */
export const initUpload = (body: UploadInit) => call<UploadTicket>("POST", "/documents/uploads", body);
export const initVersionUpload = (id: string, body: { fileName: string; mimeType: string; sizeBytes: number; changeNote: string }) => call<UploadTicket>("POST", `/documents/${id}/versions`, body);
export const commitUpload = (commitPath: string, allowDuplicate: boolean) => call<{ id: string; docNo: string | null; versionNo: number }>("POST", commitPath, { allowDuplicate });
export const abortUpload = (ticket: string) => call<{ aborted: true }>("POST", `/documents/uploads/${ticket}/abort`, {});

export function streamBytes(path: string, file: Blob, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<StreamResult> {
  const { atEpoch, tokenAtStart } = guard();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${getPublicApiBaseUrl()}/api/v1${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${tokenAtStart}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new ApiError("network error", 0));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.onload = () => {
      try { moved(atEpoch, tokenAtStart); } catch (e) { reject(e); return; }
      let body: { data?: StreamResult; error?: { code?: string; details?: unknown } } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.data) { onProgress(1); resolve(body.data); return; }
      reject(new ApiError("upload failed", xhr.status, { code: body.error?.code, details: body.error?.details }));
    };
    if (signal) { if (signal.aborted) { reject(new DOMException("aborted", "AbortError")); return; } signal.addEventListener("abort", () => xhr.abort(), { once: true }); }
    xhr.send(file);
  });
}
