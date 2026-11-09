import { randomUUID } from "node:crypto";
import type mongoose from "mongoose";

import { logger } from "../../../shared/logger.js";
import { AiClientError, type AiClient } from "../ai-client.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import { WORKER_LEASE_MS } from "./artifact.common.js";

export const MAX_ARTIFACT_ATTEMPTS = 2;
const RETRY_DELAY_MS = 30_000;

/** Atomic lease claim (same pattern as the Batch 09 job runner). Expired RUNNING artifacts return to the queue or fail once attempts are used up. */
export async function claimNextArtifact(workerId: string, now = new Date()): Promise<AiArtifactDocument | null> {
  const expired = { status: "RUNNING", leaseUntil: { $lt: now } };
  await AiArtifact.updateMany({ ...expired, attempt: { $gte: MAX_ARTIFACT_ATTEMPTS } }, { $set: { status: "FAILED", errorCode: "AI_TIMEOUT" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  await AiArtifact.updateMany(expired, { $set: { status: "QUEUED", nextAttemptAt: now }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  const row = await AiArtifact.findOneAndUpdate(
    { status: "QUEUED", $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
    { $set: { status: "RUNNING", lockedBy: workerId, leaseUntil: new Date(now.getTime() + WORKER_LEASE_MS) }, $inc: { attempt: 1, version: 1 } },
    { sort: { createdAt: 1 }, new: true },
  ).lean();
  return (row as AiArtifactDocument | null) ?? null;
}

export class Stop extends Error {}

/** Extends the lease. A false result means the artifact was cancelled, invalidated or taken over: the runner must stop touching it. */
export async function beat(id: mongoose.Types.ObjectId, workerId: string): Promise<void> {
  const r = await AiArtifact.updateOne({ _id: id, status: "RUNNING", lockedBy: workerId }, { $set: { leaseUntil: new Date(Date.now() + WORKER_LEASE_MS) } });
  if (r.matchedCount !== 1) throw new Stop();
}

/** Transient failures go back to the queue (progress is kept, so the run resumes); permanent ones, or exhausted attempts, fail with a stable code. */
export async function failArtifact(a: AiArtifactDocument, workerId: string, error: unknown, now = new Date()): Promise<void> {
  const own = { _id: a._id, status: "RUNNING", lockedBy: workerId };
  let code = "AI_UNAVAILABLE";
  let retryable = true;
  if (error instanceof AiClientError) {
    const llm = error.llm;
    code = llm === "LLM_INVALID_OUTPUT" ? "AI_INVALID_OUTPUT" : llm === "LLM_CONTEXT_TOO_LONG" ? "AI_TOO_LARGE" : error.code === "AI_SERVICE_TIMEOUT" ? "AI_TIMEOUT" : llm === "LLM_RATE_LIMITED" ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE";
    retryable = error.retryable && code !== "AI_TOO_LARGE";
  } else if (error instanceof ArtifactError) { code = error.code; retryable = false; } else { code = "AI_UNAVAILABLE"; }
  logger.warn({ artifactId: String(a._id), code, retryable, attempt: a.attempt }, "ai artifact failed");
  if (retryable && a.attempt < MAX_ARTIFACT_ATTEMPTS) {
    await AiArtifact.updateOne(own, { $set: { status: "QUEUED", nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS), errorCode: code }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
    return;
  }
  await AiArtifact.updateOne(own, { $set: { status: "FAILED", errorCode: code }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
}

/** A permanent, user-explainable failure (budget, size, nothing to summarise). */
export class ArtifactError extends Error { constructor(readonly code: string) { super(code); } }

export type RunnerDeps = { client?: AiClient; maxFinalNotes?: number };
export type ArtifactRunners = Partial<Record<"SUMMARY" | "EXTRACTION", (a: AiArtifactDocument, workerId: string, deps: RunnerDeps) => Promise<void>>>;

export async function runArtifact(a: AiArtifactDocument, workerId: string, runners: ArtifactRunners, deps: RunnerDeps = {}): Promise<void> {
  const run = runners[a.kind as "SUMMARY" | "EXTRACTION"];
  try {
    if (!run) throw new ArtifactError("AI_UNAVAILABLE");
    await run(a, workerId, deps);
  } catch (error) {
    if (error instanceof Stop) return;
    await failArtifact(a, workerId, error).catch(() => undefined);
  }
}

/** In-process loop, started from the server bootstrap only. Tests drive `tick()` or `runArtifact` directly. */
export function startArtifactRunner(runners: ArtifactRunners, opts: { autoStart?: boolean; deps?: RunnerDeps } = {}) {
  const workerId = `art-${process.pid}-${randomUUID().slice(0, 8)}`;
  let busy = false;
  let stopping = false;
  async function tick(): Promise<void> {
    if (busy || stopping) return;
    busy = true;
    try {
      for (;;) {
        const a = await claimNextArtifact(workerId);
        if (!a || stopping) return;
        await runArtifact(a, workerId, runners, opts.deps);
      }
    } finally { busy = false; }
  }
  const timer = opts.autoStart === false ? undefined : setInterval(() => { void tick().catch(() => undefined); }, 5000);
  timer?.unref();
  return {
    workerId, tick,
    async stop(): Promise<void> {
      stopping = true;
      if (timer) clearInterval(timer);
      await AiArtifact.updateMany({ status: "RUNNING", lockedBy: workerId }, { $set: { status: "QUEUED", nextAttemptAt: new Date() }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { attempt: -1, version: 1 } }).catch(() => undefined);
    },
  };
}
