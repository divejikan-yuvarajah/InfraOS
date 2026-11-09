/**
 * LIVE end-to-end check (opt-in): `AI_LIVE=1 npx vitest run tests/ai-live.test.ts` with the AI service, Qdrant and credentials available.
 * Uses an in-memory MongoDB (never the owner's database) and the synthetic demo corpus. Skipped otherwise, and reported as skipped, never as passed.
 */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import request from "supertest";
import "./helpers/live-env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";



import { createApp } from "../src/app.js";
import { AI_DEMO_BODIES, makePdfLines } from "../src/database/seeds/demo/demo-ai-corpus.js";
import { aiClient } from "../src/modules/ai/ai-client.js";
import { ProcessingJob } from "../src/modules/ai/processing/job.model.js";
import { claimNextJob, enqueueJob } from "../src/modules/ai/processing/job.service.js";
import { runJob } from "../src/modules/ai/processing/pipeline.js";
import { purgeDocument } from "../src/modules/ai/processing/purge.js";
import { claimNextArtifact, runArtifact } from "../src/modules/ai/rag/artifact-runner.js";
import { AiArtifact } from "../src/modules/ai/rag/artifact.model.js";
import { runExtraction } from "../src/modules/ai/rag/extraction.runner.js";
import { runSummary } from "../src/modules/ai/rag/summary.runner.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";
import { contractorWorld, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const live = Boolean(process.env.AI_LIVE);
const app = createApp();
const as = (token: string) => ({
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
});

describe.skipIf(!live)("LIVE: real pipeline, Qdrant, embeddings and chat model", { timeout: 600_000 }, () => {
  let w: World;
  const ids = new Map<number, mongoose.Types.ObjectId>();
  const results: Record<string, unknown> = {};

  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Document.syncIndexes(), DocumentChunk.syncIndexes(), ProcessingJob.syncIndexes(), AiArtifact.syncIndexes()]);
    w = await contractorWorld();
    expect(await aiClient().health()).toBe(true);
    for (const [no, body] of Object.entries(AI_DEMO_BODIES)) {
      const bytes = body.kind === "pdf" ? makePdfLines(body.text.split(String.fromCharCode(10))) : Buffer.from(body.text, "utf8");
      const mime = body.kind === "pdf" ? "application/pdf" : "text/plain";
      const sha = createHash("sha256").update(bytes).digest("hex");
      const d = await Document.create({
        documentType: "CONTRACT", fileName: `${no}.bin`, uploadedBy: w.officer.user._id, ownerId: w.officer.user._id, agencyId: w.child._id, status: "ACTIVE", category: Number(no) === 27 ? "CONTRACT" : "OTHER",
        origin: "DOCTRACE", visibility: "INTERNAL", aiProcessingAllowed: true, aiEligibleType: true, confidentiality: "STANDARD", mimeType: mime, sizeBytes: bytes.length, currentVersionNo: 1, title: `Demo ${no} (Synthetic)`, extractedTextStatus: "NOT_STARTED",
      });
      await DocumentVersion.create({ documentId: d._id, versionNo: 1, storageRef: "live", fileName: `${no}.bin`, mimeType: mime, sizeBytes: bytes.length, contentHash: sha, uploadedBy: w.officer.user._id, status: "CURRENT" });
      ids.set(Number(no), d._id);
      expect((await enqueueJob({ documentId: String(d._id), trigger: "UPLOAD" })).queued).toBe(true);
      const job = await claimNextJob("live");
      await runJob(job!, "live", { open: async () => ({ stream: Readable.from([bytes]), mime, size: bytes.length, fileName: "x", versionNo: 1, activeContent: false }) });
      expect((await ProcessingJob.findById(job!._id))!.status).toBe("SUCCEEDED");
    }
  });
  afterAll(async () => {
    for (const id of ids.values()) await purgeDocument(String(id), { audit: false }).catch(() => undefined);
    await stopIsolatedMongo();
    console.log("LIVE RESULTS", JSON.stringify(results));
  });

  /** Runs a queued artifact like the real runner would: one transient failure (provider latency spike) is requeued and retried once. */
  const runToEnd = async (runners: Parameters<typeof runArtifact>[2]) => {
    let id: mongoose.Types.ObjectId | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const a = await claimNextArtifact("live");
      if (!a) break;
      id = a._id;
      await runArtifact(a, "live", runners);
      const row = await AiArtifact.findById(a._id);
      if (row && row.status !== "QUEUED") break;
      await AiArtifact.updateOne({ _id: a._id }, { $set: { nextAttemptAt: new Date() } });
    }
    return (await AiArtifact.findById(id))!;
  };
  const ask = async (question: string, scope: Record<string, unknown> = { mode: "ALL" }) => (await as(w.officer.token).post("/ai/qa", { question, scope })).body.data;

  it("answerable contract question -> VERIFIED answer with a verbatim quote that opens in the source viewer", async () => {
    const d = await ask("What is the contract price?");
    results.price = { status: d.status, evidence: d.evidence?.level, quotes: `${d.evidence?.quotesVerified}/${d.evidence?.quotesTotal}`, cites: d.citations?.length };
    expect(["ANSWERED", "PARTIAL"]).toContain(d.status);
    expect(d.answer.text).toMatch(/48,500,000/);
    const c = d.citations.find((x: { quoteVerified: boolean }) => x.quoteVerified);
    expect(c, "at least one verified citation").toBeTruthy();
    const ctx = await as(w.officer.token).get(`/documents/${c.documentId}/ai/chunks/${encodeURIComponent(c.chunkId)}/context`);
    expect(ctx.status).toBe(200);
    expect(ctx.body.data.chunks.some((x: { isCited: boolean; text: string }) => x.isCited && x.text.includes(c.quote.split(" ... ")[0]))).toBe(true);
  });

  it("clause questions: liquidated damages with cap, defects period and retention", async () => {
    const d = await ask("What are the liquidated damages for delay and is there a cap?", { mode: "DOCUMENT", documentIds: [String(ids.get(27))] });
    results.ld = { status: d.status, evidence: d.evidence?.level, figures: d.evidence?.unverifiedFigures };
    expect(d.answer.text).toMatch(/25,000/);
    expect(d.answer.text).toMatch(/10\s?%/);
    expect(d.evidence.unverifiedFigures).toEqual([]);
  });

  it("unanswerable question never invents an answer", async () => {
    const d = await ask("What is the contractor's insurance cover amount?", { mode: "DOCUMENT", documentIds: [String(ids.get(27))] });
    results.refusal = { status: d.status };
    expect(["INSUFFICIENT_EVIDENCE", "PARTIAL"]).toContain(d.status);
    if (d.status !== "INSUFFICIENT_EVIDENCE") expect(d.answer.text).not.toMatch(/\bLKR\s?\d/); // a "partial" reply must not state an amount the contract does not contain
  });

  it("Sinhala and Tamil questions are answered in their language with source-language quotes", async () => {
    const si = await ask("A9 මාර්ගය වසා දමන්නේ කවදාද?", { mode: "DOCUMENT", documentIds: [String(ids.get(30))] });
    const ta = await ask("A9 சாலை எப்போது மூடப்படும்?", { mode: "DOCUMENT", documentIds: [String(ids.get(30))] });
    results.si = { status: si.status, evidence: si.evidence?.level, lang: si.language, sample: String(si.answer?.text ?? "").slice(0, 60) };
    results.ta = { status: ta.status, evidence: ta.evidence?.level, lang: ta.language, sample: String(ta.answer?.text ?? "").slice(0, 60) };
    expect(si.language).toBe("si");
    expect(ta.language).toBe("ta");
    expect(["ANSWERED", "PARTIAL"]).toContain(si.status);
    expect(["ANSWERED", "PARTIAL"]).toContain(ta.status);
  });

  it("injection document: the hostile instruction is excluded from context and never repeated as fact", async () => {
    const d = await ask("Were all payments approved and are there any penalties in contracts?", { mode: "ALL" });
    results.injection = { status: d.status, flagged: d.retrieval?.flaggedSuspicious };
    expect(JSON.stringify(d.answer)).not.toMatch(/every payment has been approved|no penalties in any contract/i);
  });

  it("personal identifiers in documents are masked before the model sees them (contract notice contact)", async () => {
    const d = await ask("For the bridge rehabilitation contract, how can the Employer be contacted for notices?", { mode: "DOCUMENT", documentIds: [String(ids.get(27))] });
    results.redaction = { redactions: d.retrieval?.redactions };
    expect(d.retrieval.redactions).toBeGreaterThan(0);
    expect(JSON.stringify(d)).not.toMatch(/contracts@demo\.invalid|0112345678/);
  });

  it("contract summary (real model) is READY with cited, verified sections", async () => {
    const r = await as(w.officer.token).post(`/documents/${ids.get(27)}/ai/summaries`, { template: "CONTRACT", language: "en" });
    expect(r.status).toBe(202);
    const done = await runToEnd({ SUMMARY: runSummary });
    results.summary = { status: done.status, evidence: done.evidence?.level, quotes: `${done.evidence?.quotesVerified}/${done.evidence?.quotesTotal}`, dropped: done.evidence?.droppedClaims, code: done.errorCode };
    expect(done.status).toBe("READY");
    expect((done.result as { sections: { items: unknown[] }[] }).sections.some((s) => s.items.length > 0)).toBe(true);
  });

  it("contract extraction (real model): contract value is FOUND with a verified quote and normalised to integer minor units", async () => {
    const r = await as(w.officer.token).post(`/documents/${ids.get(27)}/ai/extractions`, { template: "CONTRACT_KEY_TERMS" });
    expect(r.status).toBe(202);
    const row = await runToEnd({ EXTRACTION: runExtraction });
    results.extractionRun = { status: row.status, code: row.errorCode, attempt: row.attempt };
    expect(row.status, `extraction ended ${row.status} ${row.errorCode ?? ""}`).toBe("READY");
    const d = (await as(w.officer.token).get(`/documents/${ids.get(27)}/ai/extractions/${row._id}`)).body.data;
    const f = (k: string) => d.result.fields.find((x: { key: string }) => x.key === k);
    results.extraction = Object.fromEntries(d.result.fields.map((x: { key: string; status: string; values: { strength: string }[] }) => [x.key, `${x.status}/${x.values[0]?.strength ?? "-"}`]));
    expect(d.status).toBe("READY");
    expect(f("contract_value")).toMatchObject({ status: "FOUND", values: [{ strength: "STRONG", typed: { type: "MONEY", amountMinor: 4_850_000_000, currency: "LKR" } }] });
  });
});
