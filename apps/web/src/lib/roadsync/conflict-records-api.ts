import { apiClient } from "@/lib/api/client";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import { guard, moved, type Envelope } from "./api";
import type { BulkResult, Dossier, RecordList, RecordSummary } from "./conflict-records";

const base = "/api/v1/roadsync/conflicts";
type Method = "GET" | "POST" | "DELETE";

async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method, authenticated: true, ...(body !== undefined ? { body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export const fetchRecords = (query: string) => call<RecordList>(`${base}?${query}`, "GET");
export const fetchRecordSummary = () => call<RecordSummary>(`${base}/summary`, "GET");
export const fetchDossier = (id: string) => call<Dossier>(`${base}/${encodeURIComponent(id)}`, "GET");
export const fetchRecordMap = (id: string) => call<{ type: "FeatureCollection"; features: unknown[] }>(`${base}/${encodeURIComponent(id)}/map`, "GET");
export const fetchRequestRecords = (requestId: string) => call<RecordList>(`/api/v1/roadsync/work-requests/${encodeURIComponent(requestId)}/conflicts`, "GET");

type Result = { id: string; status: string; version: number };
const at = (id: string, tail: string) => `${base}/${encodeURIComponent(id)}/${tail}`;
export const acknowledgeRecord = (id: string, body: { version: number; note?: string }) => call<Result>(at(id, "acknowledge"), "POST", body);
export const acknowledgeBulk = (ids: string[]) => call<{ results: BulkResult[] }>(`${base}/acknowledge-bulk`, "POST", { ids });
export const dismissRecord = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "dismiss"), "POST", body);
export const reopenRecord = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "reopen"), "POST", body);
export const setLeadAgency = (id: string, body: { version: number; agencyId: string }) => call<Result>(at(id, "lead"), "POST", body);
export const addAffectedAgency = (id: string, body: { version: number; agencyId: string; reason: string }) => call<Result>(at(id, "agencies"), "POST", body);
export const excludeAffectedAgency = (id: string, agencyId: string, body: { version: number; reason: string }) => call<Result>(at(id, `agencies/${encodeURIComponent(agencyId)}`), "DELETE", body);
export const restoreAffectedAgency = (id: string, agencyId: string, body: { version: number }) => call<Result>(at(id, `agencies/${encodeURIComponent(agencyId)}/restore`), "POST", body);
export const setWatching = (id: string, on: boolean) => call<Result>(at(id, "watch"), on ? "POST" : "DELETE");
export const addRecordNote = (id: string, text: string) => call<Result>(at(id, "notes"), "POST", { text });
export const deleteRecordNote = (id: string, noteId: string) => call<Result>(at(id, `notes/${encodeURIComponent(noteId)}`), "DELETE");

/** Authenticated file download (CSV / GeoJSON). The access token never goes into a URL. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  const response = await fetch(`${getPublicApiBaseUrl() ?? ""}${path}`, { headers: { Authorization: `Bearer ${tokenAtStart}` }, credentials: "omit" });
  moved(atEpoch, tokenAtStart);
  if (!response.ok) throw new Error("download failed");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export const exportCsvPath = (query: string) => `${base}/export.csv?${query}`;
export const evidencePath = (id: string) => `${base}/${encodeURIComponent(id)}/evidence.geojson`;
