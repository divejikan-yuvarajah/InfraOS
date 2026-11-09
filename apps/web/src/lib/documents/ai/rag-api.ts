import { call, qs } from "../api";
import type { AiLanguage } from "@infraos/shared-types";
import type { Artifact, ArtifactList, ChunkContext, ExtractionDetail, Interaction, Quality, Scope, ScopePreview, ThreadList } from "./rag-types";

/** Same session guard as the rest of DocTrace. The browser only talks to Express: never to the AI service, a model provider or Qdrant. Question text is only ever sent in a POST body, never in a URL. */
type Q = Record<string, string | number | boolean | undefined | null>;

export const askQuestion = (body: { question: string; scope: Scope; threadId?: string; language?: AiLanguage; regenerate?: boolean }, signal?: AbortSignal) => call<Interaction>("POST", "/ai/qa", body, signal);
export const fetchThreads = (q: Q, signal?: AbortSignal) => call<ThreadList>("GET", `/ai/qa/threads${qs(q)}`, undefined, signal);
export const fetchThread = (threadId: string, signal?: AbortSignal) => call<{ threadId: string; items: Interaction[] }>("GET", `/ai/qa/threads/${threadId}`, undefined, signal);
export const fetchInteraction = (id: string, signal?: AbortSignal) => call<Interaction>("GET", `/ai/interactions/${id}`, undefined, signal);
export const sendFeedback = (id: string, body: { rating: "HELPFUL" | "NOT_HELPFUL"; reason?: string; comment?: string }) => call<{ saved: true }>("POST", `/ai/interactions/${id}/feedback`, body);
export const deleteThread = (threadId: string) => call<{ deleted: number }>("DELETE", `/ai/qa/threads/${threadId}`);
export const deleteAllThreads = () => call<{ deleted: number }>("DELETE", "/ai/qa/threads");
export const fetchScopePreview = (scope: Scope, signal?: AbortSignal) => call<ScopePreview>("GET", `/ai/scope-preview${qs({ mode: scope.mode, documentIds: scope.documentIds?.join(","), projectId: scope.projectId })}`, undefined, signal);
export const fetchChunkContext = (documentId: string, chunkId: string, signal?: AbortSignal) => call<ChunkContext>("GET", `/documents/${documentId}/ai/chunks/${encodeURIComponent(chunkId)}/context`, undefined, signal);
export const fetchQuality = (q: Q, signal?: AbortSignal) => call<Quality>("GET", `/ai/quality${qs(q)}`, undefined, signal);

export const fetchSummaries = (docId: string, signal?: AbortSignal) => call<ArtifactList>("GET", `/documents/${docId}/ai/summaries`, undefined, signal);
export const createSummary = (docId: string, body: { template: string; language: AiLanguage; regenerate?: boolean }) => call<Artifact>("POST", `/documents/${docId}/ai/summaries`, body);
export const fetchSummary = (docId: string, id: string, signal?: AbortSignal) => call<Artifact>("GET", `/documents/${docId}/ai/summaries/${id}`, undefined, signal);

export const fetchExtractions = (docId: string, signal?: AbortSignal) => call<ArtifactList>("GET", `/documents/${docId}/ai/extractions`, undefined, signal);
export const createExtraction = (docId: string, body: { template: string; regenerate?: boolean }) => call<Artifact>("POST", `/documents/${docId}/ai/extractions`, body);
export const fetchExtraction = (docId: string, id: string, signal?: AbortSignal) => call<ExtractionDetail>("GET", `/documents/${docId}/ai/extractions/${id}`, undefined, signal);
export const saveReview = (docId: string, id: string, body: { version: number; decisions: { fieldKey: string; decision: string; editedValue?: string }[] }) => call<ExtractionDetail>("PUT", `/documents/${docId}/ai/extractions/${id}/review`, body);
export const applyMetadata = (docId: string, id: string, fieldKeys: string[]) => call<{ applied: string[]; metadataFields: string[] }>("POST", `/documents/${docId}/ai/extractions/${id}/apply-metadata`, { fieldKeys });
