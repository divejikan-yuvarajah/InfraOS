import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { ConflictCoordination, Decision, HubList, HubSummary, MessagePage, PreviewOut, ProposalType, Room, Suggestions } from "./coordination";

const base = "/api/v1/roadsync/coordination";
type Method = "GET" | "POST" | "PATCH";
async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method, authenticated: true, ...(body !== undefined ? { body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
type Result = { id: string; requestNo: string; status: string; version: number; round: number; warnings?: string[] };
const at = (id: string, tail: string) => `${base}/${encodeURIComponent(id)}/${tail}`;

export const fetchHub = (query: string) => call<HubList>(`${base}?${query}`, "GET");
export const fetchHubSummary = () => call<HubSummary>(`${base}/summary`, "GET");
export const fetchRoom = (id: string) => call<Room>(`${base}/${encodeURIComponent(id)}`, "GET");
export const fetchMessages = (id: string, cursor?: string | null) => call<MessagePage>(`${at(id, "messages")}?limit=30${cursor ? `&cursor=${cursor}` : ""}`, "GET");
export const fetchConflictCoordination = (conflictId: string) => call<ConflictCoordination>(`/api/v1/roadsync/conflicts/${encodeURIComponent(conflictId)}/coordination`, "GET");
export const fetchSuggestions = (conflictId: string) => call<Suggestions>(`/api/v1/roadsync/conflicts/${encodeURIComponent(conflictId)}/coordination/suggestions`, "GET");
export const previewImpact = (body: { conflictId: string; type: ProposalType; proposal: unknown }) => call<PreviewOut>(`${base}/preview-impact`, "POST", body);

export type CreateBody = { type: ProposalType; summary: string; proposal: unknown; participants?: { agencyId: string; mode: "recipient" | "consulted" }[]; deadlineAt?: string; onBehalfOfAgencyId?: string; reason?: string };
export const createRequest = (conflictId: string, body: CreateBody) => call<Result>(`/api/v1/roadsync/conflicts/${encodeURIComponent(conflictId)}/coordination`, "POST", body);
export type RespondBody = { version: number; round: number; decision: Decision; conditions?: { code: string; text?: string }[]; reasonCode?: string; note?: string; counterProposal?: { type: ProposalType; proposal: unknown }; selectedSlot?: string; onBehalfOfAgencyId?: string; reason?: string };
export const respondTo = (id: string, body: RespondBody) => call<Result>(at(id, "respond"), "POST", body);
export const reviseRequest = (id: string, body: { version: number; type: ProposalType; proposal: unknown; note?: string }) => call<Result>(at(id, "revise"), "POST", body);
export const confirmConditions = (id: string, version: number) => call<Result>(at(id, "confirm-conditions"), "POST", { version, agencyIds: "all" });
export const withdrawRequest = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "withdraw"), "POST", body);
export const closeRequest = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "close-no-agreement"), "POST", body);
export const nudgeRequest = (id: string, version: number) => call<Result>(at(id, "nudge"), "POST", { version });
export const escalateRequest = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "escalate"), "POST", body);
export const deescalateRequest = (id: string, body: { version: number; reason: string }) => call<Result>(at(id, "deescalate"), "POST", body);
export const extendDeadline = (id: string, body: { version: number; deadlineAt: string }) => call<Result>(at(id, "deadline"), "PATCH", body);
export const postMessage = (id: string, text: string) => call<Result>(at(id, "messages"), "POST", { text });
export const markThreadRead = (id: string) => call<Result>(at(id, "read"), "POST", {});
