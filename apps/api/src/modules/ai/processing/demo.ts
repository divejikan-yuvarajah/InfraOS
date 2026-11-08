import type mongoose from "mongoose";

import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { aiClient } from "../ai-client.js";
import { ProcessingJob } from "./job.model.js";
import { AiUsageRecord } from "../usage.model.js";

/**
 * Demo reset helper: removes vectors (when the AI service is reachable) and every AI row of the given documents.
 * Counts only; never prints content. Returns how many documents' vectors could NOT be confirmed removed so the caller can warn.
 */
export async function purgeAiForDocuments(ids: mongoose.Types.ObjectId[]): Promise<{ documents: number; vectorsUnconfirmed: number; chunks: number; jobs: number; usage: number }> {
  if (!ids.length) return { documents: 0, vectorsUnconfirmed: 0, chunks: 0, jobs: 0, usage: 0 };
  const withChunks = await DocumentChunk.distinct("documentId", { documentId: { $in: ids } });
  let unconfirmed = 0;
  const client = aiClient();
  for (const id of withChunks) {
    try { await client.deleteDocument(String(id)); } catch { unconfirmed += 1; }
  }
  const [chunks, jobs, usage] = await Promise.all([
    DocumentChunk.deleteMany({ documentId: { $in: ids } }),
    ProcessingJob.deleteMany({ documentId: { $in: ids } }),
    AiUsageRecord.deleteMany({ documentId: { $in: ids } }),
  ]);
  return { documents: withChunks.length, vectorsUnconfirmed: unconfirmed, chunks: chunks.deletedCount, jobs: jobs.deletedCount, usage: usage.deletedCount };
}
