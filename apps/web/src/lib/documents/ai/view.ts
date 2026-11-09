import type { AiJobStage, AiStageStatus } from "@infraos/shared-types";

import type { AiJob, JobStage } from "./types";

/** The AI fields every DocTrace list/detail item carries. */
export type ListAi = { extractedTextStatus: string; allowed: boolean; eligibleType: boolean; sensitive?: boolean; errorCode?: string | null; warningCount?: number; truncated?: boolean; indexedAt?: string | null };

export type ChipKind = "NOT_PROCESSED" | "QUEUED" | "PROCESSING" | "READY" | "ATTENTION" | "FAILED" | "UNSUPPORTED" | "SCANNED" | "EXCLUDED" | "NOT_ELIGIBLE";

/** Derives the chip from server state only. Never claims "AI-ready" unless the server says COMPLETED. */
export function chipKind(ai: ListAi): ChipKind {
  if (!ai.eligibleType) return "NOT_ELIGIBLE";
  if (!ai.allowed) return "EXCLUDED";
  switch (ai.extractedTextStatus) {
    case "QUEUED": return "QUEUED";
    case "PROCESSING": return "PROCESSING";
    case "COMPLETED": return (ai.warningCount ?? 0) > 0 || ai.truncated ? "ATTENTION" : "READY";
    case "FAILED": return "FAILED";
    case "UNSUPPORTED": return ai.errorCode === "SCANNED_NO_TEXT" ? "SCANNED" : "UNSUPPORTED";
    default: return "NOT_PROCESSED";
  }
}

export const ACTIVE_JOB = ["QUEUED", "RUNNING", "DEFERRED"] as const;
export const isActiveJob = (job: Pick<AiJob, "status"> | null | undefined): boolean => Boolean(job && (ACTIVE_JOB as readonly string[]).includes(job.status));

export const PIPELINE_STAGES: AiJobStage[] = ["EXTRACT", "CHUNK", "EMBED", "INDEX"];

/** Per-stage state for the stepper. With no job, nothing is shown as done (a finished document is shown as done by the caller). */
export function stageStates(job: Pick<AiJob, "stages" | "status"> | null, indexed = false): { key: AiJobStage; status: AiStageStatus }[] {
  if (!job) return PIPELINE_STAGES.map((key) => ({ key, status: indexed ? "DONE" : "PENDING" }));
  const by = new Map<string, JobStage>(job.stages.map((s) => [s.key, s]));
  return PIPELINE_STAGES.map((key) => {
    const st = by.get(key)?.status ?? "PENDING";
    if (job.status === "SUCCEEDED") return { key, status: "DONE" as const };
    if ((job.status === "SKIPPED" || job.status === "CANCELLED") && st !== "DONE") return { key, status: "SKIPPED" as const };
    return { key, status: st };
  });
}

/** React Query refetchInterval: 3 s for the first minute while a job is active, then 15 s, never while the tab is hidden, stop when terminal. */
export function pollInterval(job: Pick<AiJob, "status"> | null | undefined, pollsSoFar: number, hidden: boolean): number | false {
  if (hidden || !isActiveJob(job)) return false;
  return pollsSoFar < 20 ? 3000 : 15000;
}

export function jobDurationSeconds(job: Pick<AiJob, "startedAt" | "finishedAt">): number | null {
  if (!job.startedAt || !job.finishedAt) return null;
  const s = (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;
  return Number.isFinite(s) && s >= 0 ? Math.round(s) : null;
}

/** Whether Reprocess must be offered: eligible, permitted and nothing already running. The server re-checks all of it. */
export const canQueue = (d: { canReprocess: boolean }): boolean => d.canReprocess;

export const percent = (used: number, total: number): number => (total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0);
