import mongoose from "mongoose";

import { logger } from "../../../shared/logger.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { Document } from "../../documents/models/document.model.js";
import { aiClient, type AiClient } from "../ai-client.js";
import { aiConfig } from "../ai.config.js";
import { enqueueJob, loadAiDocument, requeueExpiredLeases } from "./job.service.js";
import { purgeDocument } from "./purge.js";

export const RECONCILE_LIMIT = 200;
let lastReconcile: { at: Date; enqueued: number; purged: number; requeued: number } | null = null;
export const lastReconcileSummary = () => lastReconcile;

/**
 * Self-healing sweep (startup + every 10 minutes), bounded to 200 documents per pass. Logs counts only.
 *  1. expired leases go back to the queue,
 *  2. eligible documents whose current version is not indexed and that have no active job get a RECONCILE job (covers lost in-process events),
 *  3. unfinished purges (STALE chunk rows left because the vector store could not be reached) are retried.
 * Permanently failed/unsupported documents are NOT retried automatically; that is a manual Reprocess.
 */
export async function reconcile(deps: { client?: AiClient; limit?: number } = {}): Promise<{ enqueued: number; purged: number; requeued: number }> {
  const limit = deps.limit ?? RECONCILE_LIMIT;
  const client = deps.client ?? aiClient();
  const { requeued } = await requeueExpiredLeases();
  let enqueued = 0;
  let purged = 0;

  if (aiConfig.processingEnabled) {
    const orphans = await Document.find({
      origin: "DOCTRACE", status: "ACTIVE", deletedAt: { $exists: false }, aiEligibleType: true, aiProcessingAllowed: { $ne: false },
      $or: [
        { extractedTextStatus: { $in: ["NOT_STARTED", "QUEUED", "PROCESSING"] } },
        { extractedTextStatus: "COMPLETED", $expr: { $ne: ["$aiIndex.indexedVersionNo", "$currentVersionNo"] } },
      ],
    }).select("_id currentVersionNo").sort({ updatedAt: 1 }).limit(limit).lean();
    for (const d of orphans) {
      if (!d.currentVersionNo) continue;
      const r = await enqueueJob({ documentId: String(d._id), versionNo: d.currentVersionNo, trigger: "RECONCILE" }).catch(() => null);
      if (r?.queued) enqueued += 1;
    }
  }

  const stale = await DocumentChunk.distinct("documentId", { status: "STALE" });
  for (const id of stale.slice(0, limit) as mongoose.Types.ObjectId[]) {
    const facts = await loadAiDocument(String(id));
    const keep = facts?.eligibility.eligible ? facts.doc.aiIndex?.indexedVersionNo ?? null : null;
    if (keep) {
      try {
        await client.deleteDocument(String(id), keep);
        await DocumentChunk.deleteMany({ documentId: id, status: "STALE" });
        purged += 1;
      } catch { /* retried next sweep */ }
    } else {
      const r = await purgeDocument(String(id), { client, audit: false });
      if (r.purged) purged += 1;
    }
  }
  lastReconcile = { at: new Date(), enqueued, purged, requeued };
  logger.info({ enqueued, purged, requeued }, "ai reconcile sweep");
  return { enqueued, purged, requeued };
}
