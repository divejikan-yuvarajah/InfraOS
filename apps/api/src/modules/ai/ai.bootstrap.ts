import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import { aiConfig } from "./ai.config.js";
import { registerAiProcessingSubscribers, unregisterAiProcessingSubscribers } from "./ai-processing.subscriber.js";
import { startArtifactRunner } from "./rag/artifact-runner.js";
import { runExtraction } from "./rag/extraction.runner.js";
import { runSummary } from "./rag/summary.runner.js";
import { startJobRunner, type JobRunner } from "./processing/job-runner.js";

let runner: JobRunner | undefined;
let artifacts: ReturnType<typeof startArtifactRunner> | undefined;

/**
 * Called from the server bootstrap only (never in tests or serverless handlers). Event subscribers are always registered so purges work even
 * when processing is off; the job runner and reconciler start only when AI is configured and enabled. An unconfigured AI service never blocks boot.
 */
export function startAiBackground(): void {
  if (env.NODE_ENV === "test" || mongoose.connection.readyState !== 1) return;
  registerAiProcessingSubscribers();
  if (!aiConfig.configured || !aiConfig.processingEnabled) {
    logger.info({ configured: aiConfig.configured, enabled: aiConfig.processingEnabled }, "ai processing inactive");
    return;
  }
  runner = startJobRunner();
  if (aiConfig.chat.model) artifacts = startArtifactRunner({ SUMMARY: runSummary, EXTRACTION: runExtraction });
}

export async function stopAiBackground(): Promise<void> {
  unregisterAiProcessingSubscribers();
  await runner?.stop();
  await artifacts?.stop();
  runner = undefined;
  artifacts = undefined;
}
