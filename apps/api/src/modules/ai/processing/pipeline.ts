import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import mongoose from "mongoose";
import { AI_PERMANENT_ERROR_CODES, AI_WARNING_CODES, type AiErrorCode, type AiWarningCode } from "@infraos/shared-types";

import { logger } from "../../../shared/logger.js";
import { notifyDocument } from "../../documents/document.common.js";
import { openDocumentStream } from "../../documents/document-files.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { Document } from "../../documents/models/document.model.js";
import { DocumentVersion } from "../../documents/models/document-version.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiConfig } from "../ai.config.js";
import { AiClientError, aiClient, type AiClient } from "../ai-client.js";
import { MAX_CHUNKS, type ExtractChunkResponse } from "../ai.contracts.js";
import { pointId } from "../point-id.js";
import { AiUsageRecord } from "../usage.model.js";
import { budgetState } from "./budget.js";
import { ProcessingJob, type ProcessingJobDocument } from "./job.model.js";
import { RETRY_DELAYS_MS, UNSUPPORTED_CODES, addStats, heartbeat, loadAiDocument, pruneOldJobs, setStage } from "./job.service.js";
import { purgeDocument } from "./purge.js";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const PERMANENT = new Set<string>([...AI_PERMANENT_ERROR_CODES, "FILE_UNAVAILABLE", "NOT_ELIGIBLE"]);
const WARNING_SET = new Set<string>(AI_WARNING_CODES);

export class StageError extends Error {
  constructor(readonly code: AiErrorCode, readonly permanent: boolean) { super(code); }
}
class Stop extends Error {} // the job was cancelled or taken over; leave all state to whoever did that

export type PipelineDeps = { client?: AiClient; open?: typeof openDocumentStream; now?: () => Date };

async function readAll(stream: Readable, max: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += b.length;
    if (size > max) { stream.destroy(); throw new StageError("TOO_LARGE", true); }
    parts.push(b);
  }
  return Buffer.concat(parts);
}

function classify(error: unknown): StageError {
  if (error instanceof StageError) return error;
  if (error instanceof AiClientError) return new StageError(error.code, PERMANENT.has(error.code) || (!error.retryable && error.code !== "AI_SERVICE_UNAVAILABLE"));
  return new StageError("INTERNAL_ERROR", false); // unexpected fault: retry a bounded number of times
}

/** Runs one claimed job to a terminal or retry state. Never throws. */
export async function runJob(job: ProcessingJobDocument, workerId: string, deps: PipelineDeps = {}): Promise<void> {
  const client = deps.client ?? aiClient();
  const open = deps.open ?? openDocumentStream;
  const now = deps.now ?? (() => new Date());
  const documentId = String(job.documentId);
  const guard = async (): Promise<void> => { if (!(await heartbeat(job._id, workerId, now()))) throw new Stop(); };
  try {
    // ---- version-supersede / eligibility guard ----
    const facts = await loadAiDocument(documentId);
    if (!facts || !facts.eligibility.eligible || facts.doc.currentVersionNo !== job.versionNo) {
      await ProcessingJob.updateOne({ _id: job._id, status: "RUNNING", lockedBy: workerId }, { $set: { status: "SKIPPED", finishedAt: now(), ...(facts && !facts.eligibility.eligible ? { errorMessageKey: `ai.ineligible.${facts.eligibility.reasonCode}` } : {}) }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
      await DocumentChunk.deleteMany({ documentId: job.documentId, versionNo: job.versionNo, status: "STAGED" });
      return;
    }
    const doc = facts.doc;
    const stillIndexed = doc.aiIndex?.indexedVersionNo === job.versionNo && doc.extractedTextStatus === "COMPLETED";

    // ---- daily token budget: DEFERRED, never failed ----
    const budget = await budgetState(now());
    if (budget.exceeded) {
      await ProcessingJob.updateOne({ _id: job._id, status: "RUNNING", lockedBy: workerId }, { $set: { status: "DEFERRED", nextAttemptAt: budget.resetsAt, errorCode: "BUDGET_EXCEEDED", errorMessageKey: "ai.error.BUDGET_EXCEEDED" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { attempt: -1, version: 1 } });
      return;
    }
    if (!stillIndexed) await Document.updateOne({ _id: doc._id, currentVersionNo: job.versionNo }, { $set: { extractedTextStatus: "PROCESSING" } }, { timestamps: false });

    // ---- EXTRACT + CHUNK ----
    await setStage(job._id, "EXTRACT", "RUNNING");
    await client.wake();
    await guard();
    const opened = await open(documentId, job.versionNo, { internal: true });
    if (!opened) throw new StageError("FILE_UNAVAILABLE", true);
    const bytes = await readAll(opened.stream, MAX_FILE_BYTES);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const version = await DocumentVersion.findOne({ documentId: job.documentId, versionNo: job.versionNo }).select("contentHash mimeType").lean();
    if (!version || version.contentHash !== sha) throw new StageError("CORRUPT_FILE", true); // stored bytes no longer match the recorded hash
    const ex = await client.extractChunk({ documentId, versionNo: job.versionNo, mimeType: version.mimeType, bytes });
    validateExtraction(ex, documentId, job.versionNo, sha);
    await setStage(job._id, "EXTRACT", "DONE");
    await setStage(job._id, "CHUNK", "DONE");
    const warnings = ex.warnings.filter((w): w is AiWarningCode => WARNING_SET.has(w));
    await addStats(job._id, { pages: ex.stats.pages, chars: ex.stats.chars, chunks: ex.chunks.length, duplicatesDropped: ex.stats.duplicatesDropped, truncated: ex.stats.truncated }, warnings);

    const estimate = ex.chunks.reduce((n, c) => n + c.tokenEstimate, 0);
    if (estimate > aiConfig.maxTokensPerDoc) throw new StageError("TOO_LARGE", true);
    if ((await budgetState(now(), estimate)).exceeded) {
      await ProcessingJob.updateOne({ _id: job._id, status: "RUNNING", lockedBy: workerId }, { $set: { status: "DEFERRED", nextAttemptAt: budget.resetsAt, errorCode: "BUDGET_EXCEEDED", errorMessageKey: "ai.error.BUDGET_EXCEEDED" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { attempt: -1, version: 1 } });
      return;
    }
    await guard();

    // ---- persist chunks (upsert by chunkId: same-version re-processing keeps its ACTIVE rows searchable until the swap) ----
    await DocumentChunk.bulkWrite(ex.chunks.map((c) => ({
      updateOne: {
        filter: { chunkId: c.chunkId },
        update: {
          $set: { documentId: job.documentId, agencyId: job.agencyId, versionNo: job.versionNo, chunkIndex: c.chunkIndex, content: c.text, charCount: c.charCount, tokenEstimate: c.tokenEstimate, contentHash: c.contentHash,
            ...(c.pageStart !== null ? { pageStart: c.pageStart } : {}), ...(c.pageEnd !== null ? { pageEnd: c.pageEnd } : {}), ...(c.section ? { section: c.section } : {}), ...(job.projectId ? { projectId: job.projectId } : {}) },
          $unset: { ...(c.pageStart === null ? { pageStart: 1 } : {}), ...(c.pageEnd === null ? { pageEnd: 1 } : {}), ...(c.section ? {} : { section: 1 }) },
          $setOnInsert: { status: "STAGED" },
        },
        upsert: true,
      },
    })), { ordered: false });
    await DocumentChunk.deleteMany({ documentId: job.documentId, versionNo: job.versionNo, chunkId: { $nin: ex.chunks.map((c) => c.chunkId) } });

    // ---- EMBED + INDEX ----
    await setStage(job._id, "EMBED", "RUNNING");
    await guard();
    const idx = await client.index({
      documentId, versionNo: job.versionNo, projectId: job.projectId ? String(job.projectId) : null, agencyId: String(job.agencyId), category: doc.category ?? "OTHER",
      chunks: ex.chunks.map((c) => ({ chunkId: c.chunkId, chunkIndex: c.chunkIndex, text: c.text, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, contentHash: c.contentHash })),
    });
    await setStage(job._id, "EMBED", "DONE");
    await setStage(job._id, "INDEX", "DONE");
    await guard();

    await finalize(job, workerId, doc._id, ex, idx, warnings, now());
    await pruneOldJobs(job.documentId);
  } catch (error) {
    if (error instanceof Stop) return;
    await handleFailure(job, workerId, classify(error), error, now());
  }
}

function validateExtraction(ex: ExtractChunkResponse, documentId: string, versionNo: number, sha: string): void {
  if (ex.fileSha256 !== sha) throw new StageError("INTERNAL_ERROR", true);
  if (!ex.chunks.length || ex.chunks.length > MAX_CHUNKS) throw new StageError("TOO_LARGE", true);
  ex.chunks.forEach((c, i) => { if (c.chunkIndex !== i || c.chunkId !== `${documentId}:${versionNo}:${i}`) throw new StageError("INTERNAL_ERROR", true); });
}

class SkippedDuringFinalize extends Error {}

async function finalize(job: ProcessingJobDocument, workerId: string, docId: mongoose.Types.ObjectId, ex: ExtractChunkResponse, idx: { model: string; dimension: number; tokens: number; embedded: number }, warnings: AiWarningCode[], at: Date): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ids = ex.chunks.map((c) => c.chunkId);
      const upd = await Document.updateOne({ _id: docId, currentVersionNo: job.versionNo, status: "ACTIVE" },
        { $set: { extractedTextStatus: "COMPLETED", ...(ex.pageCount !== null ? { pageCount: ex.pageCount } : {}), aiIndex: { indexedVersionNo: job.versionNo, chunkCount: ids.length, pageCount: ex.pageCount ?? 0, embeddingModel: idx.model, embeddingDimension: idx.dimension, pipelineVersion: ex.pipelineVersion, indexedAt: at, lastJobId: job._id, warnings, truncated: ex.stats.truncated } } },
        { session, timestamps: false });
      if (upd.matchedCount !== 1) throw new SkippedDuringFinalize();
      await DocumentChunk.bulkWrite(ex.chunks.map((c) => ({
        updateOne: { filter: { chunkId: c.chunkId }, update: { $set: { status: "ACTIVE", embeddingModel: idx.model, embeddingDimension: idx.dimension, embeddingReference: pointId(c.chunkId), indexedAt: at } } },
      })), { session, ordered: false });
      await DocumentChunk.deleteMany({ documentId: docId, $or: [{ versionNo: { $ne: job.versionNo } }, { versionNo: job.versionNo, chunkId: { $nin: ids } }] }, { session });
      const done = await ProcessingJob.updateOne({ _id: job._id, status: "RUNNING", lockedBy: workerId },
        { $set: { status: "SUCCEEDED", stage: "DONE", finishedAt: at, embeddingModel: idx.model, "stats.embedded": idx.embedded, "stats.tokens": idx.tokens }, $unset: { lockedBy: 1, leaseUntil: 1, errorCode: 1, errorMessageKey: 1 }, $inc: { version: 1 } }, { session });
      if (done.matchedCount !== 1) throw new SkippedDuringFinalize(); // cancelled while indexing
      const price = aiConfig.pricePerMTokensMinor;
      await AiUsageRecord.create([{ kind: "EMBEDDING", agencyId: job.agencyId, ...(job.requestedBy ? { userId: job.requestedBy } : {}), documentId: docId, jobId: job._id, provider: "openrouter", model: idx.model,
        inputTokens: idx.tokens, outputTokens: 0, requestCount: Math.max(1, Math.ceil(ex.chunks.length / 64)), status: "OK", ...(price !== undefined ? { estimatedCostMinor: Math.round((idx.tokens * price) / 1_000_000) } : {}) }], { session });
      await writeAiAudit(session, { action: "ai.document_processing_completed", resourceId: docId, agencyId: job.agencyId, actorUserId: job.requestedBy ? String(job.requestedBy) : null, status: "COMPLETED" });
    });
  } catch (error) {
    if (error instanceof SkippedDuringFinalize) {
      // Superseded or cancelled between indexing and commit: drop whatever this run staged.
      await purgeIfStale(job, docId);
      return;
    }
    throw error;
  } finally { await session.endSession(); }
}

async function purgeIfStale(job: ProcessingJobDocument, docId: mongoose.Types.ObjectId): Promise<void> {
  const cur = await Document.findById(docId).select("currentVersionNo status").lean();
  await ProcessingJob.updateOne({ _id: job._id, status: "RUNNING" }, { $set: { status: "SKIPPED", finishedAt: new Date() }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  if (!cur || cur.currentVersionNo !== job.versionNo || cur.status !== "ACTIVE") await purgeDocument(String(docId), { agencyId: String(job.agencyId), audit: false });
}

async function handleFailure(job: ProcessingJobDocument, workerId: string, err: StageError, cause: unknown, at: Date): Promise<void> {
  const circuit = cause instanceof AiClientError && cause.circuitOpen;
  logger.warn({ jobId: String(job._id), code: err.code, permanent: err.permanent, attempt: job.attempt, circuit }, "ai job stage failed");
  const owned = { _id: job._id, status: "RUNNING", lockedBy: workerId };
  await markStageFailed(job, err.code);
  if (circuit) { // the service is known to be down: wait without consuming an attempt
    await ProcessingJob.updateOne(owned, { $set: { status: "QUEUED", nextAttemptAt: new Date(at.getTime() + 60_000), errorCode: err.code, errorMessageKey: `ai.error.${err.code}` }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { attempt: -1, version: 1 } });
    return;
  }
  if (!err.permanent && job.attempt < job.maxAttempts) {
    const delay = RETRY_DELAYS_MS[Math.min(job.attempt - 1, RETRY_DELAYS_MS.length - 1)]!;
    await ProcessingJob.updateOne(owned, { $set: { status: "QUEUED", nextAttemptAt: new Date(at.getTime() + delay), errorCode: err.code, errorMessageKey: `ai.error.${err.code}` }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
    return;
  }
  const res = await ProcessingJob.updateOne(owned, { $set: { status: "FAILED", finishedAt: at, errorCode: err.code, errorMessageKey: `ai.error.${err.code}` }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  if (res.matchedCount !== 1) return; // cancelled meanwhile
  const unsupported = UNSUPPORTED_CODES.includes(err.code);
  const doc = await Document.findById(job.documentId).select("aiIndex extractedTextStatus uploadedBy currentVersionNo").lean();
  if (doc && doc.currentVersionNo === job.versionNo) {
    const stillIndexed = doc.aiIndex?.indexedVersionNo === job.versionNo && doc.extractedTextStatus === "COMPLETED";
    await Document.updateOne({ _id: job.documentId }, { $set: { ...(stillIndexed ? {} : { extractedTextStatus: unsupported ? "UNSUPPORTED" : "FAILED" }), "aiIndex.errorCode": err.code, "aiIndex.lastJobId": job._id } }, { timestamps: false });
  }
  await DocumentChunk.deleteMany({ documentId: job.documentId, versionNo: job.versionNo, status: "STAGED" });
  await writeAiAudit(undefined, { action: "ai.document_processing_failed", resourceId: job.documentId, agencyId: job.agencyId, actorUserId: job.requestedBy ? String(job.requestedBy) : null, status: unsupported ? "UNSUPPORTED" : "FAILED", reason: err.code }).catch(() => undefined);
  if (doc?.uploadedBy) {
    await notifyDocument([job.requestedBy ?? doc.uploadedBy], { title: unsupported ? "Document cannot be searched" : "Document processing failed", message: `AI processing ended with ${err.code}. Open the document's AI tab for details.`, documentId: job.documentId, eventKey: `aif:${String(job._id).slice(-12)}` });
  }
}
async function markStageFailed(job: ProcessingJobDocument, code: AiErrorCode): Promise<void> {
  const fresh = await ProcessingJob.findById(job._id).select("stage").lean();
  if (fresh && fresh.stage !== "PENDING" && fresh.stage !== "DONE") await setStage(job._id, fresh.stage, "FAILED", code).catch(() => undefined);
}

