import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  baseUrl: undefined as string | undefined, secret: "s".repeat(40), configured: true, processingEnabled: true, jobConcurrency: 1, dailyTokenBudget: 1_000_000, maxTokensPerDoc: 100_000,
  embedModel: "baai/bge-m3" as string | undefined, pricePerMTokensMinor: undefined as number | undefined, timeoutsMs: { health: 2000, extract: 5000, index: 5000, search: 5000, delete: 5000 },
}));
vi.mock("../src/modules/ai/ai.config.js", () => ({ aiConfig: cfg, loadAiConfig: () => cfg }));

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";
import { ProcessingJob } from "../src/modules/ai/processing/job.model.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { contractorWorld, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { startAiStub } from "./helpers/ai-stub.js";
import { startIsolatedMongo, stopIsolatedMongo, clearCoreCollections } from "./helpers/mongo-memory.js";

const app = createApp();
const as = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
});
const oid = () => new mongoose.Types.ObjectId();
const SECRET_TEXT = "CONFIDENTIAL-CLAUSE-TEXT-MUST-NOT-LEAK";

describe("AI processing routes (Step 114)", { timeout: 240_000 }, () => {
  let w: World;
  let stub: Awaited<ReturnType<typeof startAiStub>>;
  let docA: mongoose.Types.ObjectId; // child agency
  let docB: mongoose.Types.ObjectId; // sibling agency
  let docSensitive: mongoose.Types.ObjectId;

  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Document.syncIndexes(), DocumentChunk.syncIndexes(), ProcessingJob.syncIndexes()]);
    stub = await startAiStub(cfg.secret);
    cfg.baseUrl = stub.url;
  }, 300_000);
  afterAll(async () => { await stub.close(); await stopIsolatedMongo(); });
  beforeEach(async () => {
    w = await contractorWorld();
    docA = await mkDoc(w.child._id, "A");
    docB = await mkDoc(w.sibling._id, "B");
    docSensitive = await mkDoc(w.child._id, "S", { confidentiality: "SENSITIVE", aiProcessingAllowed: true, uploadedBy: w.gov.user._id, ownerId: w.gov.user._id });
    stub.reset();
  });
  afterEach(async () => {
    await clearCoreCollections();
    await Promise.all([Document.deleteMany({}), DocumentVersion.collection.deleteMany({}), DocumentChunk.deleteMany({}), ProcessingJob.deleteMany({}), AiUsageRecord.deleteMany({}), AuditLog.collection.deleteMany({})]);
  });

  async function mkDoc(agencyId: unknown, tag: string, over: Record<string, unknown> = {}) {
    const d = await Document.create({
      documentType: "CONTRACT", fileName: `${tag}.pdf`, uploadedBy: w.officer.user._id, ownerId: w.officer.user._id, agencyId, status: "ACTIVE", category: "PROJECT_PLAN", origin: "DOCTRACE", visibility: "INTERNAL",
      aiProcessingAllowed: true, aiEligibleType: true, confidentiality: "STANDARD", mimeType: "application/pdf", sizeBytes: 10, currentVersionNo: 1, title: `Doc ${tag}`,
      extractedTextStatus: "COMPLETED", aiIndex: { indexedVersionNo: 1, chunkCount: 1, embeddingModel: "BAAI/bge-m3", embeddingDimension: 1024, pipelineVersion: "p1", indexedAt: new Date() }, ...over,
    });
    await DocumentVersion.create({ documentId: d._id, versionNo: 1, storageRef: "ref", fileName: `${tag}.pdf`, mimeType: "application/pdf", sizeBytes: 10, contentHash: "c".repeat(64), uploadedBy: w.officer.user._id, status: "CURRENT" });
    await DocumentChunk.create({ documentId: d._id, agencyId, versionNo: 1, chunkIndex: 0, chunkId: `${d._id}:1:0`, content: `${SECRET_TEXT} ${tag}`, charCount: 50, tokenEstimate: 12, contentHash: "a".repeat(64), status: "ACTIVE", pageStart: 2, pageEnd: 3, section: "1. Definitions" });
    return d._id;
  }

  it("requires authentication and the right permission", async () => {
    expect((await request(app).get(`/api/v1/documents/${docA}/ai`)).status).toBe(401);
    expect((await as(w.citizen.token).get(`/documents/${docA}/ai`)).status).toBe(403); // no document.read
    expect((await as(w.inspector.token).post(`/documents/${docA}/ai/reprocess`)).status).toBe(403); // no document.process
    expect((await as(w.officer.token).get("/ai/status")).status).toBe(403); // ai.manage is GOV_ADMIN/SUPER_ADMIN only
    expect((await as(w.officer.token).post("/ai/processing/reindex", { action: "start", confirm: "REINDEX" })).status).toBe(403);
    expect((await as(w.inspector.token).get("/ai/processing/summary")).status).toBe(403);
  });

  it("AI status is scoped: own agency 200, other agency 404, and never carries text or secrets", async () => {
    const ok = await as(w.officer.token).get(`/documents/${docA}/ai`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ eligible: true, extractedTextStatus: "COMPLETED", canReprocess: true });
    const text = JSON.stringify(ok.body);
    expect(text).not.toContain(SECRET_TEXT);
    expect(text).not.toContain(cfg.secret);
    expect(text).not.toMatch(/https?:\/\//);
    expect((await as(w.siblingOfficer.token).get(`/documents/${docA}/ai`)).status).toBe(404);
    expect((await as(w.otherGov.token).get(`/documents/${docA}/ai`)).status).toBe(404);
  });

  it("reprocess queues one job, 409s on an active job, is scope-checked and audited without text", async () => {
    const a = await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`);
    expect(a.status).toBe(202);
    expect(a.body.data.job).toMatchObject({ trigger: "REPROCESS", status: "QUEUED" });
    const again = await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`);
    expect(again.status).toBe(409);
    expect(again.body.error.details).toMatchObject({ reason: "ACTIVE_JOB" });
    expect((await as(w.siblingOfficer.token).post(`/documents/${docA}/ai/reprocess`)).status).toBe(404);
    expect(await ProcessingJob.countDocuments({ documentId: docA })).toBe(1);
    const audit = await AuditLog.findOne({ resourceId: docA, action: "ai.document_reprocess_requested" }).select("+newValue").lean();
    expect(audit?.newValue).toMatchObject({ status: "QUEUED" });
    expect((await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`, { sneaky: 1 })).status).toBe(400);
  });

  it("cancel stops the active job and 409s when there is none", async () => {
    expect((await as(w.officer.token).post(`/documents/${docA}/ai/cancel`)).status).toBe(409);
    await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`);
    const c = await as(w.officer.token).post(`/documents/${docA}/ai/cancel`);
    expect(c.status).toBe(200);
    expect((await ProcessingJob.findOne({ documentId: docA }))!.status).toBe("CANCELLED");
  });

  it("chunk preview needs read AND download, is scope-checked, and truncates text", async () => {
    const ok = await as(w.officer.token).get(`/documents/${docA}/ai/chunks`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.items[0]).toMatchObject({ chunkIndex: 0, pageStart: 2, pageEnd: 3, section: "1. Definitions", status: "ACTIVE" });
    expect(ok.body.data.items[0].text).toContain(SECRET_TEXT);
    expect((await as(w.siblingOfficer.token).get(`/documents/${docA}/ai/chunks`)).status).toBe(404);
    expect((await as(w.citizen.token).get(`/documents/${docA}/ai/chunks`)).status).toBe(403);
    expect((await as(w.inspector.token).get(`/documents/${docA}/ai/chunks`)).status).toBe(404); // has read+download but no project link: out of scope
    expect((await as(w.officer.token).get(`/documents/${docA}/ai/chunks?limit=500`)).status).toBe(400);
    expect((await as(w.officer.token).get(`/documents/${docA}/ai/chunks?page=1&page=2`)).status).toBe(400);
    const audit = await AuditLog.findOne({ resourceId: docA, action: "ai.chunk_preview_viewed" }).select("+newValue").lean();
    expect(audit?.newValue).toMatchObject({ reason: "count:1" });
  });

  it("a SENSITIVE document owned by someone else is invisible to an officer without access (404)", async () => {
    // PROJECT_MANAGER of the same agency has no project link and is not owner/staff.
    expect((await as(w.manager.token).get(`/documents/${docSensitive}/ai`)).status).toBe(404);
    expect((await as(w.manager.token).get(`/documents/${docSensitive}/ai/chunks`)).status).toBe(404);
  });

  it("summary counts only documents in scope and hides budget detail without ai.manage", async () => {
    const off = await as(w.officer.token).get("/ai/processing/summary");
    expect(off.status).toBe(200);
    expect(off.body.data.ready).toBe(2); // docA + docSensitive (same agency); docB is the sibling's
    expect(off.body.data.tokens).toBeNull();
    const gov = await as(w.gov.token).get("/ai/processing/summary");
    expect(gov.body.data.ready).toBe(3);
    expect(gov.body.data.tokens).toMatchObject({ dailyBudget: cfg.dailyTokenBudget, costIsEstimated: false });
    expect(gov.body.data.coveragePercent).toBe(100);
  });

  it("job list shows only jobs of readable documents; bulk reprocess reports out-of-scope ids as NOT_FOUND", async () => {
    await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`);
    await as(w.siblingOfficer.token).post(`/documents/${docB}/ai/reprocess`);
    const mine = await as(w.officer.token).get("/ai/processing/jobs");
    expect(mine.body.data.total).toBe(1);
    expect(mine.body.data.items[0]).toMatchObject({ documentId: String(docA), trigger: "REPROCESS" });
    expect((await as(w.gov.token).get("/ai/processing/jobs")).body.data.total).toBe(2);
    expect((await as(w.officer.token).get("/ai/processing/jobs?status=NOPE")).status).toBe(400);
    const bulk = await as(w.officer.token).post("/ai/processing/reprocess", { ids: [String(docB), String(oid())] });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.results.map((r: { result: string }) => r.result)).toEqual(["NOT_FOUND", "NOT_FOUND"]);
    expect((await as(w.officer.token).post("/ai/processing/reprocess", { ids: [String(docA)], status: "FAILED" })).status).toBe(400);
  });

  it("status route (ai.manage) exposes no URL, secret or key", async () => {
    stub.on("/v1/admin/reindex-plan", () => ({ body: { configuredModel: "baai/bge-m3", dimension: 1024, targetCollection: "infraos_chunks__baai-bge-m3__1024", collections: [{ name: "infraos_chunks__baai-bge-m3__1024", points: 3 }], targetExists: true } }));
    stub.on("/ready", () => ({ body: { status: "ready", checks: { config: true, qdrant: true, embeddingProviderConfigured: true }, embeddingModel: "baai/bge-m3", collectionBase: "infraos_chunks" } }));
    const r = await as(w.gov.token).get("/ai/status");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ state: "HEALTHY", model: "baai/bge-m3", dimension: 1024, circuit: "closed" });
    const text = JSON.stringify(r.body);
    expect(text).not.toContain(cfg.secret);
    expect(text).not.toContain(stub.url);
  });

  it("reindex validates confirmation and only finalizes after enough progress", async () => {
    stub.on("/v1/admin/reindex-plan", () => ({ body: { configuredModel: "other/model", dimension: 768, targetCollection: "infraos_chunks__other-model__768", collections: [{ name: "infraos_chunks__baai-bge-m3__1024", points: 3 }, { name: "infraos_chunks__other-model__768", points: 0 }], targetExists: true } }));
    expect((await as(w.gov.token).post("/ai/processing/reindex", { action: "start", confirm: "FINALIZE" })).status).toBe(400);
    const fin = await as(w.gov.token).post("/ai/processing/reindex", { action: "finalize", confirm: "FINALIZE" });
    expect(fin.status).toBe(409);
    expect(fin.body.error.details).toMatchObject({ reason: "NOT_ENOUGH_PROGRESS" });
    const start = await as(w.gov.token).post("/ai/processing/reindex", { action: "start", confirm: "REINDEX" });
    expect(start.status).toBe(202);
    expect(start.body.data.queued).toBe(3);
    expect(await ProcessingJob.countDocuments({ trigger: "REINDEX" })).toBe(3);
    expect(stub.calls.some((c) => c.path === "/v1/admin/drop-collection")).toBe(false);
  });

  it("diagnostic builds the allow-list server-side and drops unauthorised and stale hits", async () => {
    await DocumentChunk.create({ documentId: docA, agencyId: w.child._id, versionNo: 0 + 1, chunkIndex: 1, chunkId: `${docA}:1:1`, content: "stale", charCount: 5, tokenEstimate: 1, contentHash: "b".repeat(64), status: "STALE" });
    stub.on("/v1/search", (c) => {
      const allowed = (c.json!.allowedDocumentIds as string[]);
      expect(allowed).toContain(String(docA));
      expect(allowed).not.toContain(String(docB)); // another agency's document is never put on the list
      return { body: { hits: [
        { chunkId: `${docB}:1:0`, documentId: String(docB), versionNo: 1, score: 0.99, pageStart: 1, pageEnd: 1 }, // vector store returned something out of scope: must be dropped
        { chunkId: `${docA}:1:1`, documentId: String(docA), versionNo: 1, score: 0.9, pageStart: 1, pageEnd: 1 }, // chunk is STALE in Mongo: dropped
        { chunkId: `${docA}:1:0`, documentId: String(docA), versionNo: 2, score: 0.8, pageStart: 1, pageEnd: 1 }, // wrong version: dropped
        { chunkId: `${docA}:1:0`, documentId: String(docA), versionNo: 1, score: 0.7, pageStart: 2, pageEnd: 3 },
      ], model: "BAAI/bge-m3", dimension: 1024, tokens: 5 } };
    });
    const r = await as(w.officer.token).post("/ai/search/diagnostic", { query: "payment terms", limit: 5 });
    expect(r.status).toBe(200);
    expect(r.body.data.results).toHaveLength(1);
    expect(r.body.data.results[0]).toMatchObject({ documentId: String(docA), chunkId: `${docA}:1:0`, pageStart: 2, pageEnd: 3, docNo: null });
    expect(r.body.data.results[0].snippet.length).toBeLessThanOrEqual(300);
    expect(r.body.data.note).toBe("DIAGNOSTIC_NOT_AN_ANSWER");
    expect(await AiUsageRecord.countDocuments({ inputTokens: 5 })).toBe(1);
    const audit = await AuditLog.findOne({ action: "ai.retrieval_diagnostic_run" }).select("+newValue").lean();
    expect(JSON.stringify(audit)).not.toContain("payment terms");
  });

  it("diagnostic for a user with no indexed documents in scope never calls the service; invalid input is rejected", async () => {
    await Document.updateMany({ agencyId: w.child._id }, { $set: { extractedTextStatus: "NOT_STARTED" } });
    const r = await as(w.officer.token).post("/ai/search/diagnostic", { query: "anything" });
    expect(r.body.data).toMatchObject({ results: [], searched: 0 });
    expect(stub.calls.filter((c) => c.path === "/v1/search")).toHaveLength(0);
    expect((await as(w.officer.token).post("/ai/search/diagnostic", { query: "x".repeat(301) })).status).toBe(400);
    expect((await as(w.officer.token).post("/ai/search/diagnostic", { query: "ok", allowedDocumentIds: [String(docB)] })).status).toBe(400); // client cannot supply ids
    expect((await as(w.inspector.token).post("/ai/search/diagnostic", { query: "ok query" })).status).toBe(403);
  });

  it("degrades honestly when the AI service is down: reprocess still queues, diagnostic reports unavailable", async () => {
    stub.on("/v1/search", () => ({ status: 503, body: { code: "VECTOR_STORE_ERROR", message: "x", retryable: true, requestId: "s" } }));
    const d = await as(w.officer.token).post("/ai/search/diagnostic", { query: "payment terms" });
    expect(d.status).toBe(503);
    expect((await as(w.officer.token).post(`/documents/${docA}/ai/reprocess`)).status).toBe(202);
  });
});
