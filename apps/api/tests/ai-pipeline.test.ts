import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  baseUrl: undefined as string | undefined, secret: "s".repeat(40), configured: true, processingEnabled: true, jobConcurrency: 1, dailyTokenBudget: 1_000_000, maxTokensPerDoc: 100_000,
  embedModel: "baai/bge-m3" as string | undefined, pricePerMTokensMinor: undefined as number | undefined, timeoutsMs: { health: 2000, extract: 5000, index: 5000, search: 5000, delete: 5000 },
}));
vi.mock("../src/modules/ai/ai.config.js", () => ({ aiConfig: cfg, loadAiConfig: () => cfg }));

import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";
import { emitDocumentEvent } from "../src/modules/documents/document-events.js";
import { AiClientError, CircuitBreaker, createAiClient } from "../src/modules/ai/ai-client.js";
import type { AiConfig } from "../src/modules/ai/ai.config.js";
import { registerAiProcessingSubscribers, unregisterAiProcessingSubscribers } from "../src/modules/ai/ai-processing.subscriber.js";
import { pointId } from "../src/modules/ai/point-id.js";
import { colomboDayStart, nextColomboMidnight } from "../src/modules/ai/processing/budget.js";
import { isEligibleForAi } from "../src/modules/ai/processing/eligibility.js";
import { ProcessingJob } from "../src/modules/ai/processing/job.model.js";
import { claimNextJob, enqueueJob, requeueExpiredLeases } from "../src/modules/ai/processing/job.service.js";
import { runJob } from "../src/modules/ai/processing/pipeline.js";
import { purgeDocument } from "../src/modules/ai/processing/purge.js";
import { reconcile } from "../src/modules/ai/processing/reconciler.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { extractReply, indexReply, startAiStub, svcError } from "./helpers/ai-stub.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const oid = () => new mongoose.Types.ObjectId();
const TEXT = Buffer.from("Synthetic contract text for the pipeline test.");
const SHA = createHash("sha256").update(TEXT).digest("hex");

describe("pure helpers", () => {
  const base = { origin: "DOCTRACE", status: "ACTIVE", aiProcessingAllowed: true, aiEligibleType: true, confidentiality: "STANDARD", hasFile: true };
  it.each([
    [{}, true, undefined],
    [{ origin: "INSPECTION_EVIDENCE" }, false, "NOT_DOCTRACE"],
    [{ status: "ARCHIVED" }, false, "ARCHIVED"],
    [{ deletedAt: new Date() }, false, "ARCHIVED"],
    [{ status: "DRAFT" }, false, "DRAFT"],
    [{ aiProcessingAllowed: false }, false, "EXCLUDED"],
    [{ confidentiality: "SENSITIVE", aiProcessingAllowed: false }, false, "SENSITIVE"],
    [{ confidentiality: "SENSITIVE", aiProcessingAllowed: true }, true, undefined],
    [{ aiEligibleType: false }, false, "NOT_ELIGIBLE_TYPE"],
    [{ hasFile: false }, false, "NO_FILE"],
  ])("isEligibleForAi %j", (patch, eligible, reason) => {
    const r = isEligibleForAi({ ...base, ...patch });
    expect(r.eligible).toBe(eligible);
    if (!r.eligible) expect(r.reasonCode).toBe(reason);
  });
  it("AI disabled makes everything ineligible", () => { expect(isEligibleForAi(base, { aiEnabled: false })).toEqual({ eligible: false, reasonCode: "AI_DISABLED" }); });
  it("point ids match the Python service (uuid5, same namespace)", () => { expect(pointId("aaaaaaaaaaaaaaaaaaaaaaaa:1:0")).toBe("1120a889-bba5-5bb8-aaea-b39c652814e9"); });
  it("Asia/Colombo day boundaries", () => {
    expect(colomboDayStart(new Date("2026-03-01T20:00:00Z")).toISOString()).toBe("2026-03-01T18:30:00.000Z"); // 01:30 on the 2nd in Colombo -> day started 1st 18:30Z
    expect(colomboDayStart(new Date("2026-03-01T10:00:00Z")).toISOString()).toBe("2026-02-28T18:30:00.000Z");
    expect(nextColomboMidnight(new Date("2026-03-01T10:00:00Z")).toISOString()).toBe("2026-03-01T18:30:00.000Z");
  });
});

describe("ai client", () => {
  let stub: Awaited<ReturnType<typeof startAiStub>>;
  beforeAll(async () => { stub = await startAiStub(cfg.secret); cfg.baseUrl = stub.url; });
  afterAll(async () => { await stub.close(); });
  beforeEach(() => stub.reset());
  const make = (breaker?: CircuitBreaker) => createAiClient({ config: cfg as unknown as AiConfig, sleep: async () => undefined, ...(breaker ? { breaker } : {}) });

  it("signs JSON and multipart requests; the stub verifies the HMAC", async () => {
    stub.on("/v1/delete", () => ({ body: { removed: 2 } }));
    stub.on("/v1/extract-chunk", (c) => extractReply(c, 1));
    const c = make();
    expect(await c.deleteDocument("a".repeat(24))).toEqual({ removed: 2 });
    const ex = await c.extractChunk({ documentId: "a".repeat(24), versionNo: 1, mimeType: "text/plain", bytes: TEXT });
    expect(ex.chunks).toHaveLength(1);
    expect(stub.calls.filter((x) => x.path !== "/health").every((x) => x.signatureOk && x.headers["x-infraos-request-id"])).toBe(true);
    expect(stub.calls.find((x) => x.path === "/v1/extract-chunk")!.json!.fileSha256).toBe(SHA);
  });
  it("maps service errors to classified codes and never trips the breaker on caller errors", async () => {
    stub.on("/v1/extract-chunk", () => svcError("SCANNED_NO_TEXT", 422, false));
    const c = make();
    await expect(c.extractChunk({ documentId: "a".repeat(24), versionNo: 1, mimeType: "application/pdf", bytes: TEXT })).rejects.toMatchObject({ code: "SCANNED_NO_TEXT", retryable: false });
    expect(c.breaker.state).toBe("closed");
  });
  it("rejects a response that fails contract validation", async () => {
    stub.on("/v1/delete", () => ({ body: { nope: true } }));
    await expect(make().deleteDocument("a".repeat(24))).rejects.toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
  });
  it("opens the circuit after 5 transient failures and short-circuits without calling the service", async () => {
    stub.on("/v1/delete", () => svcError("VECTOR_STORE_ERROR", 502, true));
    let t = 1_000;
    const c = make(new CircuitBreaker(5, 60_000, () => t));
    for (let i = 0; i < 5; i++) await expect(c.deleteDocument("a".repeat(24))).rejects.toBeInstanceOf(AiClientError);
    const before = stub.calls.length;
    await expect(c.deleteDocument("a".repeat(24))).rejects.toMatchObject({ circuitOpen: true });
    expect(stub.calls.length).toBe(before);
    t += 61_000;
    stub.on("/v1/delete", () => ({ body: { removed: 0 } }));
    expect(await c.deleteDocument("a".repeat(24))).toEqual({ removed: 0 });
  });
  it("is unavailable (not a crash) when unconfigured", async () => {
    const c = createAiClient({ config: { ...cfg, baseUrl: undefined } as unknown as AiConfig });
    await expect(c.ready()).rejects.toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
    expect(await c.health()).toBe(false);
  });
});

describe("processing jobs, pipeline, purge and reconciler", { timeout: 120_000 }, () => {
  let stub: Awaited<ReturnType<typeof startAiStub>>;
  const client = () => createAiClient({ config: cfg as unknown as AiConfig, sleep: async () => undefined });
  beforeAll(async () => {
    await startIsolatedMongo();
    await Promise.all([Document.syncIndexes(), DocumentVersion.syncIndexes(), DocumentChunk.syncIndexes(), ProcessingJob.syncIndexes(), AiUsageRecord.syncIndexes()]);
    stub = await startAiStub(cfg.secret);
    cfg.baseUrl = stub.url;
  }, 300_000);
  afterAll(async () => { await stub.close(); await stopIsolatedMongo(); });
  beforeEach(() => {
    stub.reset();
    stub.on("/v1/extract-chunk", (c) => extractReply(c));
    stub.on("/v1/index", (c) => indexReply(c));
    stub.on("/v1/delete", () => ({ body: { removed: 3 } }));
    cfg.dailyTokenBudget = 1_000_000;
    cfg.processingEnabled = true;
  });
  afterEach(async () => {
    unregisterAiProcessingSubscribers();
    await Promise.all([Document.deleteMany({}), DocumentVersion.collection.deleteMany({}), DocumentChunk.deleteMany({}), ProcessingJob.deleteMany({}), AiUsageRecord.deleteMany({}), AuditLog.collection.deleteMany({})]);
  });

  async function makeDoc(over: Record<string, unknown> = {}, versionOver: Record<string, unknown> = {}) {
    const agencyId = oid();
    const doc = await Document.create({
      documentType: "CONTRACT", fileName: "a.txt", uploadedBy: oid(), agencyId, status: "ACTIVE", category: "PROJECT_PLAN", origin: "DOCTRACE", aiProcessingAllowed: true, aiEligibleType: true,
      confidentiality: "STANDARD", mimeType: "text/plain", sizeBytes: TEXT.length, currentVersionNo: 1, extractedTextStatus: "NOT_STARTED", ...over,
    });
    await DocumentVersion.create({ documentId: doc._id, versionNo: 1, storageRef: "stub-ref", fileName: "a.txt", mimeType: "text/plain", sizeBytes: TEXT.length, contentHash: SHA, uploadedBy: oid(), status: "CURRENT", ...versionOver });
    return doc;
  }
  const open = async (_id: string, versionNo: number | null) => ({ stream: Readable.from([TEXT]), mime: "text/plain", size: TEXT.length, fileName: "a.txt", versionNo: versionNo ?? 1, activeContent: false });
  async function claimAndRun(extra: { now?: () => Date } = {}) {
    const job = await claimNextJob("w1");
    expect(job).not.toBeNull();
    await runJob(job!, "w1", { client: client(), open, ...extra });
    return ProcessingJob.findById(job!._id).lean();
  }

  it("enqueues once per document version (unique active job) and marks the document QUEUED", async () => {
    const d = await makeDoc();
    const a = await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const b = await enqueueJob({ documentId: String(d._id), trigger: "REPROCESS" });
    expect(a.queued).toBe(true);
    expect(b).toMatchObject({ queued: false, reason: "ACTIVE_JOB" });
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("QUEUED");
    expect(await ProcessingJob.countDocuments({ documentId: d._id })).toBe(1);
  });
  it("refuses ineligible documents with a reason", async () => {
    const sens = await makeDoc({ confidentiality: "SENSITIVE", aiProcessingAllowed: false });
    expect(await enqueueJob({ documentId: String(sens._id), trigger: "UPLOAD" })).toMatchObject({ queued: false, reason: "SENSITIVE" });
    const img = await makeDoc({ aiEligibleType: false });
    expect(await enqueueJob({ documentId: String(img._id), trigger: "UPLOAD" })).toMatchObject({ queued: false, reason: "NOT_ELIGIBLE_TYPE" });
    const noFile = await makeDoc({}, { status: "REMOVED" });
    expect(await enqueueJob({ documentId: String(noFile._id), trigger: "UPLOAD" })).toMatchObject({ queued: false, reason: "NO_FILE" });
  });
  it("claim is atomic: only one of many concurrent claimers gets the job", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => claimNextJob(`w${i}`)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await ProcessingJob.findOne({ documentId: d._id }))!.attempt).toBe(1);
  });
  it("requeues expired leases and fails jobs whose attempts are exhausted", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    expect(await claimNextJob("dead-worker")).not.toBeNull();
    await ProcessingJob.updateOne({ documentId: d._id }, { $set: { leaseUntil: new Date(Date.now() - 600_000) } }); // the worker died; its lease expired
    expect(await requeueExpiredLeases()).toEqual({ requeued: 1, failed: 0 });
    expect((await ProcessingJob.findOne({ documentId: d._id }))!.status).toBe("QUEUED");
    await ProcessingJob.updateOne({ documentId: d._id }, { $set: { status: "RUNNING", lockedBy: "x", leaseUntil: new Date(0), attempt: 3 } });
    expect(await requeueExpiredLeases()).toEqual({ requeued: 0, failed: 1 });
  });

  it("runs the full pipeline: chunks ACTIVE with point ids, document AI-ready, usage + audit written", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const job = await claimAndRun();
    expect(job!.status).toBe("SUCCEEDED");
    expect(job!.stages.map((s) => s.status)).toEqual(["DONE", "DONE", "DONE", "DONE"]);
    const doc = await Document.findById(d._id).lean();
    expect(doc!.extractedTextStatus).toBe("COMPLETED");
    expect(doc!.aiIndex).toMatchObject({ indexedVersionNo: 1, chunkCount: 3, embeddingDimension: 1024 });
    const chunks = await DocumentChunk.find({ documentId: d._id }).sort({ chunkIndex: 1 }).lean();
    expect(chunks.map((c) => c.status)).toEqual(["ACTIVE", "ACTIVE", "ACTIVE"]);
    expect(chunks[0]!.embeddingReference).toBe(pointId(`${d._id}:1:0`));
    expect((await DocumentChunk.findOne({ documentId: d._id }).select("+content"))!.content).toContain("Contractor");
    expect(await AiUsageRecord.countDocuments({ documentId: d._id, kind: "EMBEDDING", inputTokens: 111 })).toBe(1);
    expect(await AuditLog.countDocuments({ resourceId: d._id, action: "ai.document_processing_completed" })).toBe(1);
    const idx = stub.calls.find((c) => c.path === "/v1/index")!;
    expect(idx.signatureOk).toBe(true);
  });
  it("classifies SCANNED_NO_TEXT as permanent: UNSUPPORTED, no retry, staged rows removed", async () => {
    stub.on("/v1/extract-chunk", () => svcError("SCANNED_NO_TEXT", 422, false));
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const job = await claimAndRun();
    expect(job).toMatchObject({ status: "FAILED", errorCode: "SCANNED_NO_TEXT", errorMessageKey: "ai.error.SCANNED_NO_TEXT" });
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("UNSUPPORTED");
    expect(await DocumentChunk.countDocuments({ documentId: d._id })).toBe(0);
    expect(stub.calls.filter((c) => c.path === "/v1/extract-chunk")).toHaveLength(1);
    expect(await AuditLog.countDocuments({ resourceId: d._id, action: "ai.document_processing_failed" })).toBe(1);
  });
  it("retries transient failures with backoff, then fails after max attempts", async () => {
    stub.on("/v1/index", () => svcError("EMBEDDING_PROVIDER_ERROR", 502, true));
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const t0 = Date.now();
    let job = await claimAndRun();
    expect(job).toMatchObject({ status: "QUEUED", attempt: 1, errorCode: "EMBEDDING_PROVIDER_ERROR" });
    expect(job!.nextAttemptAt.getTime() - t0).toBeGreaterThanOrEqual(29_000);
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("PROCESSING");
    await ProcessingJob.updateOne({ _id: job!._id }, { $set: { nextAttemptAt: new Date() } });
    job = await claimAndRun();
    expect(job).toMatchObject({ status: "QUEUED", attempt: 2 });
    await ProcessingJob.updateOne({ _id: job!._id }, { $set: { nextAttemptAt: new Date() } });
    job = await claimAndRun();
    expect(job).toMatchObject({ status: "FAILED", attempt: 3, errorCode: "EMBEDDING_PROVIDER_ERROR" });
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("FAILED");
  });
  it("defers (does not fail) when the daily token budget is exhausted, without consuming an attempt", async () => {
    cfg.dailyTokenBudget = 100;
    const d = await makeDoc();
    await AiUsageRecord.create({ kind: "EMBEDDING", agencyId: d.agencyId!, provider: "openrouter", model: "m", inputTokens: 500, status: "OK" });
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    const job = await claimAndRun();
    expect(job).toMatchObject({ status: "DEFERRED", attempt: 0, errorCode: "BUDGET_EXCEEDED" });
    expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(stub.calls.filter((c) => c.path === "/v1/extract-chunk")).toHaveLength(0);
  });
  it("SKIPS a job whose version was superseded and leaves no staged rows", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    await Document.updateOne({ _id: d._id }, { $set: { currentVersionNo: 2 } });
    const job = await claimAndRun();
    expect(job!.status).toBe("SKIPPED");
    expect(await DocumentChunk.countDocuments({ documentId: d._id })).toBe(0);
  });
  it("rejects stored bytes whose hash no longer matches the version record", async () => {
    const d = await makeDoc({}, { contentHash: "f".repeat(64) });
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    expect(await claimAndRun()).toMatchObject({ status: "FAILED", errorCode: "CORRUPT_FILE" });
    expect(stub.calls.filter((c) => c.path === "/v1/extract-chunk")).toHaveLength(0);
  });
  it("replacing a version swaps indexes: old chunks are gone, new ones ACTIVE", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    await claimAndRun();
    await DocumentVersion.create({ documentId: d._id, versionNo: 2, storageRef: "stub-ref-2", fileName: "a.txt", mimeType: "text/plain", sizeBytes: TEXT.length, contentHash: SHA, uploadedBy: oid(), status: "CURRENT" });
    await Document.updateOne({ _id: d._id }, { $set: { currentVersionNo: 2 } });
    await enqueueJob({ documentId: String(d._id), trigger: "REPLACE" });
    expect((await claimAndRun())!.status).toBe("SUCCEEDED");
    const rows = await DocumentChunk.find({ documentId: d._id }).lean();
    expect(new Set(rows.map((r) => r.versionNo))).toEqual(new Set([2]));
    expect(rows.every((r) => r.status === "ACTIVE")).toBe(true);
    expect((await Document.findById(d._id))!.aiIndex!.indexedVersionNo).toBe(2);
  });

  it("archive event purges vectors and chunks; a failed purge leaves STALE rows that the reconciler retries", async () => {
    const d = await makeDoc();
    await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" });
    await claimAndRun();
    stub.on("/v1/delete", () => svcError("VECTOR_STORE_ERROR", 502, true));
    const r = await purgeDocument(String(d._id), { client: client() });
    expect(r).toEqual({ purged: false, pending: true });
    expect((await DocumentChunk.find({ documentId: d._id }).lean()).every((c) => c.status === "STALE")).toBe(true);
    const doc = await Document.findById(d._id).lean();
    expect(doc!.extractedTextStatus).toBe("NOT_STARTED");
    expect(doc!.aiIndex).toBeUndefined();
    await Document.updateOne({ _id: d._id }, { $set: { status: "ARCHIVED" } });
    stub.on("/v1/delete", () => ({ body: { removed: 3 } }));
    const sweep = await reconcile({ client: client() });
    expect(sweep.purged).toBe(1);
    expect(await DocumentChunk.countDocuments({ documentId: d._id })).toBe(0);
  });
  it("document events: restricted purges, restored re-enqueues, version_ready enqueues", async () => {
    registerAiProcessingSubscribers();
    const d = await makeDoc();
    emitDocumentEvent("document.version_ready", { documentId: String(d._id), versionNo: 1, agencyId: String(d.agencyId), aiProcessingAllowed: true, aiEligibleType: true });
    await vi.waitFor(async () => expect(await ProcessingJob.countDocuments({ documentId: d._id, trigger: "UPLOAD" })).toBe(1), { timeout: 5000 });
    await claimAndRun();
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("COMPLETED");
    await Document.updateOne({ _id: d._id }, { $set: { aiProcessingAllowed: false } });
    emitDocumentEvent("document.restricted", { documentId: String(d._id), agencyId: String(d.agencyId), confidentiality: "STANDARD", aiProcessingAllowed: false });
    await vi.waitFor(async () => expect(await DocumentChunk.countDocuments({ documentId: d._id })).toBe(0), { timeout: 5000 });
    expect((await Document.findById(d._id))!.extractedTextStatus).toBe("NOT_STARTED");
    await Document.updateOne({ _id: d._id }, { $set: { aiProcessingAllowed: true } });
    emitDocumentEvent("document.restored", { documentId: String(d._id), agencyId: String(d.agencyId) });
    await vi.waitFor(async () => expect(await ProcessingJob.countDocuments({ documentId: d._id, trigger: "RESTORE" })).toBe(1), { timeout: 5000 });
  });
  it("reconciler enqueues orphans (lost events) but never touches ineligible or already-failed documents", async () => {
    const orphan = await makeDoc();
    const failed = await makeDoc({ extractedTextStatus: "FAILED" });
    const excluded = await makeDoc({ aiProcessingAllowed: false });
    const out = await reconcile({ client: client() });
    expect(out.enqueued).toBe(1);
    expect(await ProcessingJob.countDocuments({ documentId: orphan._id, trigger: "RECONCILE" })).toBe(1);
    expect(await ProcessingJob.countDocuments({ documentId: { $in: [failed._id, excluded._id] } })).toBe(0);
    expect((await reconcile({ client: client() })).enqueued).toBe(0); // idempotent: the active job dedupes
  });
});
