import { call, qs } from "../api";
import type { AiStatus, BulkReprocessResult, ChunkPreview, DiagnosticResult, DocumentAi, JobList, ProcessingSummary, ReindexResult } from "./types";

/** Same session guard as the rest of DocTrace (epoch + token); the browser only ever talks to Express, never to the AI service. */
type Q = Record<string, string | number | boolean | undefined | null>;

export const fetchDocumentAi = (id: string, signal?: AbortSignal) => call<DocumentAi>("GET", `/documents/${id}/ai`, undefined, signal);
export const reprocessDocument = (id: string) => call<{ job: { id: string } }>("POST", `/documents/${id}/ai/reprocess`, {});
export const cancelDocumentAi = (id: string) => call<{ cancelled: number }>("POST", `/documents/${id}/ai/cancel`, {});
export const fetchChunks = (id: string, q: Q, signal?: AbortSignal) => call<ChunkPreview>("GET", `/documents/${id}/ai/chunks${qs(q)}`, undefined, signal);

export const fetchProcessingSummary = (signal?: AbortSignal) => call<ProcessingSummary>("GET", "/ai/processing/summary", undefined, signal);
export const fetchJobs = (q: Q, signal?: AbortSignal) => call<JobList>("GET", `/ai/processing/jobs${qs(q)}`, undefined, signal);
export const bulkReprocess = (body: { ids: string[] } | { status: "FAILED" }) => call<BulkReprocessResult>("POST", "/ai/processing/reprocess", body);
export const fetchAiStatus = (signal?: AbortSignal) => call<AiStatus>("GET", "/ai/status", undefined, signal);
export const reindex = (body: { action: "start" | "finalize"; confirm: "REINDEX" | "FINALIZE" }) => call<ReindexResult>("POST", "/ai/processing/reindex", body);
export const runDiagnostic = (body: { query: string; projectId?: string; limit?: number }) => call<DiagnosticResult>("POST", "/ai/search/diagnostic", body);
