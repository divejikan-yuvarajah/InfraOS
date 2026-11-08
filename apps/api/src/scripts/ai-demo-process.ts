import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { assertDemoSeedEnvironment, seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";
import { aiConfig } from "../modules/ai/ai.config.js";
import { aiClient } from "../modules/ai/ai-client.js";
import { Document } from "../modules/documents/models/document.model.js";
import { ProcessingJob } from "../modules/ai/processing/job.model.js";
import { enqueueJob } from "../modules/ai/processing/job.service.js";
import { startJobRunner } from "../modules/ai/processing/job-runner.js";

/**
 * Processes the seeded eligible demo documents through the REAL pipeline (FastAPI -> OpenRouter embeddings -> Qdrant).
 * Nothing is faked: if the AI service is not configured or reachable it says so and exits without touching any document.
 * Prints counts only. Daily token budget and per-document caps still apply. Demo/dev databases only.
 */
async function main(): Promise<void> {
  assertDemoSeedEnvironment(seedEnvFromProcess(env));
  if (!aiConfig.configured) { console.log("SKIPPED: AI_BASE_URL / AI_INTERNAL_SECRET are not configured."); return; }
  if (!(await aiClient().health())) { console.log("SKIPPED: the AI service is not reachable (start it, then re-run)."); return; }
  await connectDatabase(env);
  try {
    const docs = await Document.find({ docNo: /^DOC-2026-9000\d\d$/, status: "ACTIVE", aiEligibleType: true, aiProcessingAllowed: { $ne: false }, extractedTextStatus: { $in: ["NOT_STARTED", "FAILED"] } }).select("_id").lean();
    let queued = 0;
    for (const d of docs) if ((await enqueueJob({ documentId: String(d._id), trigger: "REPROCESS" })).queued) queued += 1;
    console.log(`queued ${queued} of ${docs.length} eligible demo document(s)`);
    const runner = startJobRunner({ autoStart: false, concurrency: Math.max(1, aiConfig.jobConcurrency) });
    const deadline = Date.now() + 10 * 60_000;
    for (;;) {
      await runner.tick();
      const open = await ProcessingJob.countDocuments({ status: { $in: ["QUEUED", "RUNNING"] }, nextAttemptAt: { $lte: new Date(Date.now() + 1) } });
      if (open === 0 || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    await runner.stop();
    const states = await Document.aggregate<{ _id: string; n: number }>([{ $match: { docNo: /^DOC-2026-9000\d\d$/ } }, { $group: { _id: "$extractedTextStatus", n: { $sum: 1 } } }]);
    console.log(`INFRAOS demo AI processing: ${states.map((s) => `${s._id}=${s.n}`).join(" ")}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS demo AI processing: FAIL");
  console.error(error instanceof Error ? error.message : "failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
