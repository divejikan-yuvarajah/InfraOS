import mongoose from "mongoose";
import { AI_PIPELINE_VERSION, type AiErrorCode, type AiIneligibleReason, type AiJobStage, type AiJobTrigger, type AiStageStatus, type AiWarningCode } from "@infraos/shared-types";

import { aiConfig } from "../ai.config.js";
import { Document } from "../../documents/models/document.model.js";
import { DocumentVersion } from "../../documents/models/document-version.model.js";
import { isEligibleForAi, type AiEligibility } from "./eligibility.js";
import { ProcessingJob, type ProcessingJobDocument } from "./job.model.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;
export const LEASE_MS = 90_000;
export const KEEP_JOBS_PER_DOCUMENT = 20;
export const STAGES_ORDER: AiJobStage[] = ["EXTRACT", "CHUNK", "EMBED", "INDEX"];

/** Permanent errors that mean "this file cannot be searched" (UNSUPPORTED) rather than "something broke" (FAILED). */
export const UNSUPPORTED_CODES: readonly AiErrorCode[] = ["UNSUPPORTED_FORMAT", "SCANNED_NO_TEXT", "EMPTY_TEXT"];

export type AiDocFacts = {
  _id: mongoose.Types.ObjectId; agencyId: mongoose.Types.ObjectId; projectId?: mongoose.Types.ObjectId | null; category?: string | null; currentVersionNo?: number | null;
  mimeType?: string | null; extractedTextStatus: string; aiIndex?: { indexedVersionNo?: number | null } | null; pipeline: string | undefined;
};

/** Loads what eligibility needs. Returns null for a missing document. `hasFile` means the current version still has stored bytes. */
export async function loadAiDocument(documentId: string): Promise<{ doc: AiDocFacts; eligibility: AiEligibility } | null> {
  const doc = await Document.findOne({ _id: oid(documentId) })
    .select("agencyId projectId category origin status deletedAt aiProcessingAllowed aiEligibleType confidentiality currentVersionNo mimeType extractedTextStatus aiIndex").lean();
  if (!doc) return null;
  const hasFile = doc.currentVersionNo
    ? (await DocumentVersion.countDocuments({ documentId: doc._id, versionNo: doc.currentVersionNo, status: { $ne: "REMOVED" }, storageRef: { $exists: true } })) > 0
    : false;
  const eligibility = isEligibleForAi({ ...doc, hasFile }, { aiEnabled: aiConfig.processingEnabled });
  return { doc: { ...(doc as unknown as AiDocFacts), pipeline: doc.aiIndex?.pipelineVersion ?? undefined }, eligibility };
}

export type EnqueueResult =
  | { queued: true; job: ProcessingJobDocument }
  | { queued: false; reason: AiIneligibleReason | "NOT_FOUND" | "ACTIVE_JOB" | "STALE_VERSION"; job?: ProcessingJobDocument };

const newStages = () => (["EXTRACT", "CHUNK", "EMBED", "INDEX"] as const).map((key) => ({ key, status: "PENDING" as AiStageStatus }));

export async function enqueueJob(input: { documentId: string; versionNo?: number; trigger: AiJobTrigger; requestedBy?: string; runAt?: Date }): Promise<EnqueueResult> {
  const facts = await loadAiDocument(input.documentId);
  if (!facts) return { queued: false, reason: "NOT_FOUND" };
  const { doc, eligibility } = facts;
  const versionNo = input.versionNo ?? doc.currentVersionNo ?? 0;
  if (!eligibility.eligible) return { queued: false, reason: eligibility.reasonCode };
  if (!versionNo || versionNo !== doc.currentVersionNo) return { queued: false, reason: "STALE_VERSION" };
  try {
    const job = await ProcessingJob.create({
      documentId: doc._id, versionNo, agencyId: doc.agencyId, ...(doc.projectId ? { projectId: doc.projectId } : {}), trigger: input.trigger, status: "QUEUED", stage: "PENDING", stages: newStages(),
      attempt: 0, maxAttempts: 3, nextAttemptAt: input.runAt ?? new Date(), pipelineVersion: AI_PIPELINE_VERSION, ...(aiConfig.embedModel ? { embeddingModel: aiConfig.embedModel } : {}),
      ...(input.requestedBy ? { requestedBy: oid(input.requestedBy) } : {}),
    });
    // Same-version re-processing of an AI-ready document keeps COMPLETED (the old index stays searchable until the new one swaps in).
    const stillIndexed = doc.extractedTextStatus === "COMPLETED" && doc.aiIndex?.indexedVersionNo === versionNo;
    if (!stillIndexed) await Document.updateOne({ _id: doc._id, currentVersionNo: versionNo }, { $set: { extractedTextStatus: "QUEUED" } }, { timestamps: false });
    return { queued: true, job: job.toObject() as ProcessingJobDocument };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const active = await ProcessingJob.findOne({ documentId: doc._id, versionNo, status: { $in: ["QUEUED", "RUNNING", "DEFERRED"] } }).lean();
      return { queued: false, reason: "ACTIVE_JOB", ...(active ? { job: active as ProcessingJobDocument } : {}) };
    }
    throw error;
  }
}

/** Cancels every active job of a document (QUEUED/DEFERRED immediately; RUNNING jobs notice at their next stage boundary). */
export async function cancelActiveJobs(documentId: string): Promise<number> {
  const r = await ProcessingJob.updateMany(
    { documentId: oid(documentId), status: { $in: ["QUEUED", "RUNNING", "DEFERRED"] } },
    { $set: { status: "CANCELLED", finishedAt: new Date() }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } },
  );
  return r.modifiedCount;
}

/** Atomic lease claim. Two runners can never hold the same job. */
export async function claimNextJob(workerId: string, now = new Date(), leaseMs = LEASE_MS): Promise<ProcessingJobDocument | null> {
  const job = await ProcessingJob.findOneAndUpdate(
    { status: { $in: ["QUEUED", "DEFERRED"] }, nextAttemptAt: { $lte: now } },
    { $set: { status: "RUNNING", lockedBy: workerId, leaseUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempt: 1, version: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true },
  ).lean();
  if (!job) return null;
  if (!job.startedAt) await ProcessingJob.updateOne({ _id: job._id }, { $set: { startedAt: now } });
  return job as ProcessingJobDocument;
}

/** Crash safety: RUNNING jobs whose lease expired go back to QUEUED (or FAILED once attempts are exhausted). */
export async function requeueExpiredLeases(now = new Date()): Promise<{ requeued: number; failed: number }> {
  const expired = { status: "RUNNING", leaseUntil: { $lt: now } };
  const failed = await ProcessingJob.updateMany({ ...expired, $expr: { $gte: ["$attempt", "$maxAttempts"] } },
    { $set: { status: "FAILED", errorCode: "AI_SERVICE_TIMEOUT", errorMessageKey: "ai.error.AI_SERVICE_TIMEOUT", finishedAt: now }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  const requeued = await ProcessingJob.updateMany(expired, { $set: { status: "QUEUED", nextAttemptAt: now }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  return { requeued: requeued.modifiedCount, failed: failed.modifiedCount };
}

/** Extends the lease; false means the job was cancelled or taken over and the runner must stop. */
export async function heartbeat(jobId: mongoose.Types.ObjectId, workerId: string, now = new Date(), leaseMs = LEASE_MS): Promise<boolean> {
  const r = await ProcessingJob.updateOne({ _id: jobId, status: "RUNNING", lockedBy: workerId }, { $set: { leaseUntil: new Date(now.getTime() + leaseMs) } });
  return r.matchedCount === 1;
}

export async function setStage(jobId: mongoose.Types.ObjectId, key: AiJobStage, status: AiStageStatus, errorCode?: AiErrorCode): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { "stages.$[s].status": status };
  if (status === "RUNNING") { set["stages.$[s].startedAt"] = now; set.stage = key; }
  if (status === "DONE" || status === "FAILED" || status === "SKIPPED") set["stages.$[s].finishedAt"] = now;
  if (errorCode) set["stages.$[s].errorCode"] = errorCode;
  await ProcessingJob.updateOne({ _id: jobId }, { $set: set }, { arrayFilters: [{ "s.key": key }] });
}

export async function addStats(jobId: mongoose.Types.ObjectId, stats: Partial<Record<"pages" | "chars" | "chunks" | "duplicatesDropped" | "embedded" | "tokens", number>> & { truncated?: boolean }, warnings?: AiWarningCode[]): Promise<void> {
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stats)) set[`stats.${k}`] = v;
  const update: Record<string, unknown> = { $set: set };
  if (warnings?.length) update.$addToSet = { warnings: { $each: warnings } };
  await ProcessingJob.updateOne({ _id: jobId }, update);
}

export async function pruneOldJobs(documentId: mongoose.Types.ObjectId): Promise<void> {
  const old = await ProcessingJob.find({ documentId, status: { $nin: ["QUEUED", "RUNNING", "DEFERRED"] } }).sort({ createdAt: -1 }).skip(KEEP_JOBS_PER_DOCUMENT).select("_id").lean();
  if (old.length) await ProcessingJob.deleteMany({ _id: { $in: old.map((j) => j._id) } });
}

/** True while the runner still owns the job and nobody cancelled it. */
export async function stillOwned(jobId: mongoose.Types.ObjectId, workerId: string): Promise<boolean> {
  return (await ProcessingJob.exists({ _id: jobId, status: "RUNNING", lockedBy: workerId })) !== null;
}
