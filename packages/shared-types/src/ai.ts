/** Phase 10 Batch 09 — AI document processing enums shared by API and web. No behaviour here. */

export const AI_JOB_TRIGGERS = ["UPLOAD", "REPLACE", "REPROCESS", "REINDEX", "RECONCILE", "RESTORE"] as const;
export type AiJobTrigger = (typeof AI_JOB_TRIGGERS)[number];

export const AI_JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "DEFERRED", "CANCELLED", "SKIPPED"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];
/** Statuses that hold the one-active-job slot for a document version. */
export const AI_ACTIVE_JOB_STATUSES = ["QUEUED", "RUNNING", "DEFERRED"] as const;

export const AI_JOB_STAGES = ["PENDING", "EXTRACT", "CHUNK", "EMBED", "INDEX", "DONE"] as const;
export type AiJobStage = (typeof AI_JOB_STAGES)[number];

export const AI_STAGE_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED", "SKIPPED"] as const;
export type AiStageStatus = (typeof AI_STAGE_STATUSES)[number];

export const AI_CHUNK_STATUSES = ["STAGED", "ACTIVE", "STALE"] as const;
export type AiChunkStatus = (typeof AI_CHUNK_STATUSES)[number];

export const AI_PERMANENT_ERROR_CODES = [
  "UNSUPPORTED_FORMAT",
  "ENCRYPTED_PDF",
  "SCANNED_NO_TEXT",
  "EMPTY_TEXT",
  "CORRUPT_FILE",
  "TOO_LARGE",
  "DIMENSION_MISMATCH",
] as const;
export const AI_TRANSIENT_ERROR_CODES = [
  "AI_SERVICE_UNAVAILABLE",
  "AI_SERVICE_TIMEOUT",
  "EMBEDDING_PROVIDER_ERROR",
  "EMBEDDING_RATE_LIMITED",
  "VECTOR_STORE_ERROR",
] as const;
export const AI_ERROR_CODES = [
  ...AI_PERMANENT_ERROR_CODES,
  ...AI_TRANSIENT_ERROR_CODES,
  "FILE_UNAVAILABLE",
  "NOT_ELIGIBLE",
  "BUDGET_EXCEEDED",
  "INTERNAL_ERROR",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_WARNING_CODES = [
  "TRUNCATED_PAGES",
  "TRUNCATED_CHUNKS",
  "TRUNCATED_CHARS",
  "PARTIAL_TEXT",
  "LOW_TEXT_QUALITY",
  "ENCODING_GUESSED",
  "DUPLICATES_DROPPED",
] as const;
export type AiWarningCode = (typeof AI_WARNING_CODES)[number];

export const AI_INELIGIBLE_REASONS = ["NOT_ELIGIBLE_TYPE", "EXCLUDED", "SENSITIVE", "ARCHIVED", "DRAFT", "NO_FILE", "NOT_DOCTRACE", "AI_DISABLED"] as const;
export type AiIneligibleReason = (typeof AI_INELIGIBLE_REASONS)[number];

export const AI_USAGE_KINDS = ["EMBEDDING", "CHAT", "VISION"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];
export const AI_USAGE_STATUSES = ["OK", "ERROR", "RATE_LIMITED"] as const;
export type AiUsageStatus = (typeof AI_USAGE_STATUSES)[number];

export const AI_AUDIT_ACTIONS = [
  "ai.document_processing_queued",
  "ai.document_processing_completed",
  "ai.document_processing_failed",
  "ai.document_processing_cancelled",
  "ai.document_reprocess_requested",
  "ai.document_index_purged",
  "ai.reindex_started",
  "ai.retrieval_diagnostic_run",
] as const;
export type AiAuditAction = (typeof AI_AUDIT_ACTIONS)[number];

/** Bump when extraction or chunking logic changes (mirrors apps/ai-service PIPELINE_VERSION). */
export const AI_PIPELINE_VERSION = "p1";
