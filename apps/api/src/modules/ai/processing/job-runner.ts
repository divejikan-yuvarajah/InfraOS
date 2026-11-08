import { randomUUID } from "node:crypto";

import { logger } from "../../../shared/logger.js";
import { aiConfig } from "../ai.config.js";
import { ProcessingJob } from "./job.model.js";
import { claimNextJob, heartbeat, requeueExpiredLeases } from "./job.service.js";
import { runJob, type PipelineDeps } from "./pipeline.js";
import { reconcile } from "./reconciler.js";

const TICK_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const RECONCILE_MS = 10 * 60_000;

export type JobRunner = { tick(): Promise<void>; stop(): Promise<void>; workerId: string };

/**
 * In-process durable job runner (Render keeps the API alive). Claims jobs with an atomic lease, heartbeats while running and requeues expired leases.
 * Started from the server bootstrap only; tests drive `tick()` directly.
 */
export function startJobRunner(opts: { deps?: PipelineDeps; concurrency?: number; autoStart?: boolean } = {}): JobRunner {
  const workerId = `api-${process.pid}-${randomUUID().slice(0, 8)}`;
  const concurrency = opts.concurrency ?? aiConfig.jobConcurrency;
  const running = new Map<string, Promise<void>>();
  let stopping = false;

  async function tick(): Promise<void> {
    if (stopping) return;
    await requeueExpiredLeases().catch(() => undefined);
    while (!stopping && running.size < concurrency) {
      const job = await claimNextJob(workerId);
      if (!job) return;
      const key = String(job._id);
      const beat = setInterval(() => { void heartbeat(job._id, workerId).catch(() => undefined); }, HEARTBEAT_MS);
      const p = runJob(job, workerId, opts.deps).catch((error: unknown) => logger.error({ jobId: key, err: error instanceof Error ? error.name : "unknown" }, "ai job crashed"))
        .finally(() => { clearInterval(beat); running.delete(key); });
      running.set(key, p);
    }
  }

  let timer: NodeJS.Timeout | undefined;
  let sweep: NodeJS.Timeout | undefined;
  if (opts.autoStart !== false) {
    timer = setInterval(() => { void tick().catch(() => undefined); }, TICK_MS);
    timer.unref();
    sweep = setInterval(() => { void reconcile().catch(() => undefined); }, RECONCILE_MS);
    sweep.unref();
    void reconcile().catch(() => undefined); // startup sweep
    logger.info({ workerId, concurrency }, "ai job runner started");
  }

  return {
    workerId,
    tick,
    async stop(): Promise<void> {
      stopping = true;
      if (timer) clearInterval(timer);
      if (sweep) clearInterval(sweep);
      await Promise.race([Promise.allSettled([...running.values()]), new Promise((r) => setTimeout(r, 8_000))]);
      // Release anything still held so another instance (or the next start) can pick it up without waiting for the lease to expire.
      await ProcessingJob.updateMany({ status: "RUNNING", lockedBy: workerId }, { $set: { status: "QUEUED", nextAttemptAt: new Date() }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { attempt: -1, version: 1 } }).catch(() => undefined);
    },
  };
}
