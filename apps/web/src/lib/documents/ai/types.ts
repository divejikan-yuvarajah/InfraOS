import type { AiErrorCode, AiIneligibleReason, AiJobStage, AiJobStatus, AiJobTrigger, AiStageStatus, AiWarningCode } from "@infraos/shared-types";

export type JobStage = { key: AiJobStage; status: AiStageStatus; startedAt: string | null; finishedAt: string | null; errorCode: AiErrorCode | null };
export type JobStats = { pages: number; chars: number; chunks: number; duplicatesDropped: number; embedded: number; tokens: number; truncated: boolean };
export type AiJob = {
  id: string; documentId: string; versionNo: number; trigger: AiJobTrigger; status: AiJobStatus; stage: AiJobStage; stages: JobStage[]; attempt: number; maxAttempts: number;
  nextAttemptAt: string | null; errorCode: AiErrorCode | null; errorMessageKey: string | null; warnings: AiWarningCode[]; stats: JobStats; pipelineVersion: string; embeddingModel: string | null;
  requestedBy: string | null; byUser: boolean; startedAt: string | null; finishedAt: string | null; createdAt: string | null;
};
export type AiIndexInfo = {
  indexedVersionNo: number | null; chunkCount: number; pageCount: number | null; embeddingModel: string | null; embeddingDimension: number | null; pipelineVersion: string | null; indexedAt: string | null;
  errorCode: AiErrorCode | null; warnings: AiWarningCode[]; truncated: boolean; outdated: boolean;
};
export type ServiceState = { configured: boolean; available: boolean };
export type DocumentAi = {
  documentId: string; docNo: string | null; eligible: boolean; reasonCode: AiIneligibleReason | null; extractedTextStatus: string; aiIndex: AiIndexInfo | null; currentJob: AiJob | null; lastJob: AiJob | null;
  jobs: AiJob[]; canReprocess: boolean; canCancel: boolean; canViewChunks: boolean; pipelineVersion: string; service: ServiceState;
};
export type ChunkPreview = { total: number; page: number; limit: number; indexedVersionNo: number | null; items: { chunkIndex: number; pageStart: number | null; pageEnd: number | null; section: string | null; status: string; charCount: number; text: string }[] };
export type ProcessingSummary = {
  total: number; eligible: number; ready: number; queued: number; processing: number; failed: number; unsupported: number; notStarted: number; excluded: number; notEligible: number; outdated: number;
  coveragePercent: number | null; tokens: { usedToday: number; dailyBudget: number; estimatedCostMinor: number | null; costIsEstimated: boolean } | null; pipelineVersion: string; service: ServiceState;
};
export type JobRow = AiJob & { docNo: string | null; title: string | null };
export type JobList = { total: number; page: number; limit: number; items: JobRow[] };
export type BulkReprocessResult = { queued: number; results: { documentId: string; docNo: string | null; result: string }[] };
export type AiStatus = {
  configured: boolean; processingEnabled: boolean; circuit: "closed" | "open"; state: "HEALTHY" | "DEGRADED" | "UNAVAILABLE"; checks: { config: boolean; qdrant: boolean; embeddingProviderConfigured: boolean } | null;
  model: string | null; dimension: number | null; collection: string | null; collections: { name: string; points: number }[]; pipelineVersion: string;
  budget: { usedToday: number; dailyBudget: number; remaining: number; resetsAt: string | null; estimatedCostMinor: number | null; costIsEstimated: boolean };
  queue: Record<string, number>; reindex: { total: number; migrated: number; pending: number; percent: number }; lastReconcile: { at: string; enqueued: number; purged: number; requeued: number } | null;
};
export type DiagnosticResult = { results: { documentId: string; docNo: string | null; title: string | null; chunkId: string; pageStart: number | null; pageEnd: number | null; section: string | null; score: number; snippet: string }[]; searched: number; note: string };
export type ReindexResult = { queued?: number; pending?: number; dropped?: number; percent?: number; targetCollection?: string | null };
