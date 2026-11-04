import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { Archive, AuditList, BatchVerifyRow, ChangeInput, Chronicle, ConflictResolution, CreateResolutionBody, ImpactPreview, QueueList, ResolutionSuggestions, ResolutionView, VerifyOut } from "./resolution";

export { downloadFile } from "./conflict-records-api";

const base = "/api/v1/roadsync";
type Method = "GET" | "POST";
async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method, authenticated: true, ...(body !== undefined ? { body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
export type Behalf = { onBehalfOfAgencyId?: string; reason?: string };
type Result = { id?: string; resolutionNo?: string; status?: string; version: number };
const enc = encodeURIComponent;
const res = (id: string, tail = "") => `${base}/resolutions/${enc(id)}${tail}`;
const conflict = (id: string, tail: string) => `${base}/conflicts/${enc(id)}/${tail}`;

export const fetchConflictResolution = (conflictId: string) => call<ConflictResolution>(conflict(conflictId, "resolution"), "GET");
export const fetchResolutionSuggestions = (conflictId: string) => call<ResolutionSuggestions>(conflict(conflictId, "resolution/suggestions"), "GET");
export const fetchResolution = (id: string) => call<ResolutionView>(res(id), "GET");
export const previewResolutionImpact = (conflictId: string, changes: ChangeInput[]) => call<ImpactPreview>(`${base}/resolutions/preview-impact`, "POST", { conflictId, changes });
export const createResolution = (conflictId: string, body: CreateResolutionBody) => call<Result>(conflict(conflictId, "resolution"), "POST", body);
export const reopenResolved = (conflictId: string, body: { version: number; reason: string }) => call<Result>(conflict(conflictId, "reopen-resolved"), "POST", body);

export const submitAmendment = (id: string, aid: string, behalf: Behalf = {}) => call<Result>(res(id, `/amendments/${enc(aid)}/submit`), "POST", behalf);
export const applyAmendment = (id: string, aid: string, behalf: Behalf = {}) => call<Result>(res(id, `/amendments/${enc(aid)}/apply`), "POST", behalf);
export const cancelAmendment = (id: string, aid: string) => call<Result>(res(id, `/amendments/${enc(aid)}/cancel`), "POST", {});
export const preflightAmendment = (id: string, aid: string) => call<{ ok: boolean; checks: { code: string; ok: boolean }[] }>(res(id, `/amendments/${enc(aid)}/preflight`), "GET");
export const approveStep = (id: string, sid: string, body: { version: number; note?: string } & Behalf) => call<Result>(res(id, `/approvals/${enc(sid)}/approve`), "POST", body);
export const rejectStep = (id: string, sid: string, body: { version: number; note: string } & Behalf) => call<Result>(res(id, `/approvals/${enc(sid)}/reject`), "POST", body);
export const confirmParty = (id: string, body: { version: number; note?: string } & Behalf) => call<Result>(res(id, "/confirm"), "POST", body);
export const commitmentAction = (id: string, cid: string, body: { action: "done" | "waive"; reason?: string }) => call<Result>(res(id, `/commitments/${enc(cid)}`), "POST", body);
export const reassessResolution = (id: string) => call<Result>(res(id, "/reassess"), "POST", {});
export const cancelResolution = (id: string, body: { version: number; reason: string }) => call<Result>(res(id, "/cancel"), "POST", body);
export const contestResolution = (id: string, body: { version: number; reason: string }) => call<Result>(res(id, "/contest"), "POST", body);

export const fetchApprovals = (query: string) => call<QueueList>(`${base}/approvals?${query}`, "GET");
export const fetchApprovalsSummary = () => call<{ pending: number; overdue: number }>(`${base}/approvals/summary`, "GET");

export const fetchChronicle = (conflictId: string, query: string) => call<Chronicle>(`${conflict(conflictId, "history")}?${query}`, "GET");
export const fetchAudit = (query: string) => call<AuditList>(`${base}/audit?${query}`, "GET");
export const verifyAuditBatch = (conflictIds: string[]) => call<{ results: BatchVerifyRow[] }>(`${base}/audit/verify-batch`, "POST", { conflictIds });
export const verifyChronicle = (conflictId: string) => call<VerifyOut>(conflict(conflictId, "history/verify"), "GET");
export const chronicleCsvPath = (conflictId: string) => conflict(conflictId, "history/export.csv");
export const evidencePackPath = (conflictId: string) => conflict(conflictId, "history/export.json");
export const fetchArchive = (query: string) => call<Archive>(`${base}/history?${query}`, "GET");
export const archiveCsvPath = (query: string) => `${base}/history/export.csv?${query}`;
