import mongoose from "mongoose";

import { logger } from "../../../shared/logger.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { Document } from "../../documents/models/document.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiClient, type AiClient } from "../ai-client.js";
import { deleteArtifacts } from "../rag/artifact.common.js";
import { cancelActiveJobs } from "./job.service.js";

const oid = (v: string) => new mongoose.Types.ObjectId(v);

/**
 * Removes a document from the AI index (archive, delete, restrict, exclude). Order matters for crash safety:
 *   1. cancel active jobs, 2. mark every chunk STALE (never searchable), 3. reset the document's AI state, 4. delete the vectors, 5. only then delete the chunk rows.
 * If step 4 fails the STALE rows stay behind as a durable marker; the reconciler retries until the vector store confirms.
 */
export async function purgeDocument(documentId: string, opts: { agencyId?: string | null; actorUserId?: string | null; client?: AiClient; audit?: boolean } = {}): Promise<{ purged: boolean; pending: boolean }> {
  const id = oid(documentId);
  await cancelActiveJobs(documentId);
  await deleteArtifacts(documentId).catch(() => undefined); // summaries/extractions contain document text: removed on archive, delete, restrict and AI exclusion
  const hadChunks = (await DocumentChunk.exists({ documentId: id })) !== null;
  const doc = await Document.findById(id).select("aiIndex extractedTextStatus agencyId").lean();
  const hadState = Boolean(doc?.aiIndex) || (doc ? doc.extractedTextStatus !== "NOT_STARTED" : false);
  if (!hadChunks && !hadState) return { purged: false, pending: false };

  await DocumentChunk.updateMany({ documentId: id }, { $set: { status: "STALE" } });
  if (doc) await Document.updateOne({ _id: id }, { $set: { extractedTextStatus: "NOT_STARTED" }, $unset: { aiIndex: 1 } }, { timestamps: false });

  const client = opts.client ?? aiClient();
  let confirmed = false;
  try {
    await client.deleteDocument(documentId);
    confirmed = true;
  } catch (error) {
    logger.warn({ documentId, code: (error as { code?: string }).code ?? "unknown" }, "ai purge deferred to reconciler");
  }
  if (confirmed) await DocumentChunk.deleteMany({ documentId: id });
  if (opts.audit !== false) {
    await writeAiAudit(undefined, { action: "ai.document_index_purged", resourceId: id, agencyId: opts.agencyId ?? (doc?.agencyId ? String(doc.agencyId) : null), actorUserId: opts.actorUserId ?? null, status: confirmed ? "COMPLETED" : "PENDING" })
      .catch(() => undefined);
  }
  return { purged: confirmed, pending: !confirmed };
}
