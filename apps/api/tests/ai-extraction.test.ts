import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  baseUrl: undefined as string | undefined, secret: "s".repeat(40), configured: true, processingEnabled: true, jobConcurrency: 1, dailyTokenBudget: 1_000_000, maxTokensPerDoc: 100_000,
  embedModel: "baai/bge-m3" as string | undefined, pricePerMTokensMinor: undefined as number | undefined,
  timeoutsMs: { health: 2000, extract: 5000, index: 5000, search: 5000, delete: 5000, answer: 5000, map: 5000, reduce: 5000, extractLlm: 5000 },
  chat: { model: "test/chat" as string | undefined, strongModel: undefined as string | undefined, dailyTokenBudget: 1_000_000, qaMaxOutputTokens: 800, summaryMaxInputTokens: 200_000, redactContext: true, interactionTtlDays: 90, priceInputPerMMinor: 10 as number | undefined, priceOutputPerMMinor: 40 as number | undefined },
  rag: { topK: 24, contextChunks: 8, contextMaxChars: 12_000, minScore: 0.45, perDocCap: 4, requestsPer10Min: 20 },
}));
vi.mock("../src/modules/ai/ai.config.js", () => ({ aiConfig: cfg, loadAiConfig: () => cfg }));

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { createAiClient } from "../src/modules/ai/ai-client.js";
import type { AiConfig } from "../src/modules/ai/ai.config.js";
import { claimNextArtifact, runArtifact } from "../src/modules/ai/rag/artifact-runner.js";
import { AiArtifact } from "../src/modules/ai/rag/artifact.model.js";
import { diffField, type DiffRecords } from "../src/modules/ai/rag/extraction-diff.js";
import { runExtraction } from "../src/modules/ai/rag/extraction.runner.js";
import { AiUsageRecord } from "../src/modules/ai/usage.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { startAiStub, type StubCall } from "./helpers/ai-stub.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const as = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  put: (p: string, b: unknown = {}) => request(app).put(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
});
const meta = { usage: { inputTokens: 400, outputTokens: 120 }, model: "google/gemini-3.1-flash-lite", structuredMode: "json_schema", promptVersion: "extract.v1" };

const T0 = "Contract No. CN/2026/014 between the Employer and Acme Builders (Pvt) Ltd. The Contract Price is LKR 25,000. Retention of 5% applies to every payment.";
const T1 = "The Works shall be completed by 31 December 2026. This Agreement is dated 03/04/2026 and signed at Colombo.";

describe("Structured extraction (Step 118)", { timeout: 240_000 }, () => {
  let w: World; let stub: Awaited<ReturnType<typeof startAiStub>>; let doc: mongoose.Types.ObjectId; let project: mongoose.Types.ObjectId;
  let lastExtract: StubCall | null = null;
  let fieldsOut: () => unknown[];
  const client = () => createAiClient({ config: cfg as unknown as AiConfig, sleep: async () => undefined });
  const base = `/documents`;

  async function setup() {
    w = await contractorWorld();
    const p = await makeProject(w.child._id, { title: "Western Road Rehab", budget: { amountMinor: 2_500_000, currency: "LKR" }, startDate: new Date("2026-01-31T00:00:00.000Z"), plannedEndDate: new Date("2026-11-30T00:00:00.000Z") });
    project = p._id;
    const c = await Contractor.create({ name: "Acme Builders (Pvt) Ltd", registrationNumber: "REG-001", riskLevel: "LOW", status: "ACTIVE" } as never).catch(() => null);
    if (c) await ContractorAssignment.create({ projectId: project, contractorId: c._id, agencyId: w.child._id, role: "PRIMARY", status: "ACTIVE", startDate: new Date("2026-01-31"), assignedBy: w.gov.user._id } as never).catch(() => undefined);
    const d = await Document.create({
      documentType: "CONTRACT", fileName: "c.pdf", uploadedBy: w.officer.user._id, ownerId: w.officer.user._id, agencyId: w.child._id, projectId: project, status: "ACTIVE", category: "CONTRACT", origin: "DOCTRACE", visibility: "INTERNAL",
      aiProcessingAllowed: true, aiEligibleType: true, confidentiality: "STANDARD", mimeType: "application/pdf", sizeBytes: 10, currentVersionNo: 1, title: "Road Contract (Synthetic)", extractedTextStatus: "COMPLETED",
      aiIndex: { indexedVersionNo: 1, chunkCount: 2, embeddingModel: "m", embeddingDimension: 8, pipelineVersion: "p1", indexedAt: new Date() },
    });
    doc = d._id;
    for (const [i, text] of [T0, T1].entries()) await DocumentChunk.create({ documentId: doc, agencyId: w.child._id, projectId: project, versionNo: 1, chunkIndex: i, chunkId: `${doc}:1:${i}`, content: text, charCount: text.length, tokenEstimate: 40, contentHash: "a".repeat(64), status: "ACTIVE", pageStart: i + 1, pageEnd: i + 1 });
  }
  const val = (rawText: string, n: number, quote: string) => ({ rawText, citations: [{ n, quote }] });
  const good = () => [
    { key: "contract_number", status: "FOUND", values: [val("CN/2026/014", 1, "Contract No. CN/2026/014 between the Employer")] },
    { key: "contractor_name", status: "FOUND", values: [val("Acme Builders (Pvt) Ltd", 1, "the Employer and Acme Builders (Pvt) Ltd")] },
    { key: "contract_value", status: "FOUND", values: [val("LKR 25,000", 1, "The Contract Price is LKR 25,000")] },
    { key: "retention_percent", status: "FOUND", values: [val("5%", 1, "Retention of 5% applies")] },
    { key: "completion_date", status: "FOUND", values: [val("31 December 2026", 2, "completed by 31 December 2026")] },
    { key: "contract_date", status: "FOUND", values: [val("03/04/2026", 2, "This Agreement is dated 03/04/2026")] },
    { key: "performance_security", status: "FOUND", values: [val("a bond of LKR 5,000,000", 1, "The Contract Price is LKR 25,000")] }, // value is not in the cited text: must be dropped
    { key: "payment_terms", status: "FOUND", values: [val("every payment", 1, "an invented quote that is not in the document")] }, // value is in the chunk, quote is not verbatim: weak
  ];
  async function generate(token = w.officer.token) {
    const r = await as(token).post(`${base}/${doc}/ai/extractions`, { template: "CONTRACT_KEY_TERMS" });
    expect(r.status).toBe(202);
    const a = await claimNextArtifact("w1");
    await runArtifact(a!, "w1", { EXTRACTION: runExtraction }, { client: client() });
    return String(a!._id);
  }
  const read = async (id: string, token = w.officer.token) => (await as(token).get(`${base}/${doc}/ai/extractions/${id}`)).body.data;
  const field = (d: { result: { fields: { key: string }[] } }, key: string) => d.result.fields.find((f) => f.key === key) as { status: string; reason: string | null; values: { rawText: string; strength: string; typed: unknown; readings?: string[] }[] };

  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Document.syncIndexes(), DocumentChunk.syncIndexes(), AiArtifact.syncIndexes()]);
    stub = await startAiStub(cfg.secret);
    cfg.baseUrl = stub.url;
  }, 300_000);
  afterAll(async () => { await stub.close(); await stopIsolatedMongo(); });
  beforeEach(async () => {
    await setup();
    stub.reset(); lastExtract = null; fieldsOut = good;
    stub.on("/v1/llm/extract", (c) => { lastExtract = c; return { body: { output: { fields: fieldsOut() }, ...meta } }; });
  });
  afterEach(async () => {
    await clearCoreCollections();
    await Promise.all([Document.deleteMany({}), DocumentChunk.deleteMany({}), AiArtifact.deleteMany({}), AiUsageRecord.deleteMany({}), AuditLog.collection.deleteMany({}), Project.deleteMany({}), Contractor.deleteMany({}), ContractorAssignment.deleteMany({})]);
  });

  it("values are accepted only with a verified quote; normalisation is deterministic; ambiguity and weak evidence are explicit", async () => {
    const id = await generate();
    const d = await read(id);
    expect(d.status).toBe("READY");
    expect(field(d, "contract_value")).toMatchObject({ status: "FOUND", values: [{ rawText: "LKR 25,000", strength: "STRONG", typed: { type: "MONEY", amountMinor: 2_500_000, currency: "LKR" } }] });
    expect(field(d, "retention_percent")).toMatchObject({ status: "FOUND", values: [{ typed: { type: "PERCENT", value: "5" } }] });
    expect(field(d, "completion_date")).toMatchObject({ status: "FOUND", values: [{ typed: { type: "DATE", iso: "2026-12-31" } }] });
    expect(field(d, "contract_date")).toMatchObject({ status: "AMBIGUOUS", reason: "AMBIGUOUS_DATE", values: [{ typed: null, readings: ["2026-04-03", "2026-03-04"] }] });
    expect(field(d, "performance_security")).toMatchObject({ status: "NOT_FOUND", reason: "VALUE_NOT_IN_SOURCE", values: [] });
    expect(field(d, "payment_terms")).toMatchObject({ status: "AMBIGUOUS", reason: "QUOTE_NOT_VERIFIED", values: [{ strength: "WEAK" }] });
    expect(field(d, "defects_liability_period")).toMatchObject({ status: "NOT_FOUND" });
    expect(JSON.stringify(d)).not.toMatch(/confidence|\d+\s?%\s?(?:sure|confident)/i); // strength labels only, never made-up percentages
    expect(d.evidence.level).toBe("PARTIAL");
    expect(await AiUsageRecord.countDocuments({ kind: "CHAT", purpose: "EXTRACTION", documentId: doc })).toBe(1);
    expect(JSON.stringify(lastExtract!.json)).not.toContain("c.pdf");
  });

  it("diff against records is read-only and permission-tiered: match, differs, no record, not comparable", async () => {
    const id = await generate();
    const d = await read(id);
    expect(d.diffs.contract_value).toMatchObject({ state: "MATCH", current: "LKR 25,000.00", record: { type: "PROJECT" } });
    expect(d.diffs.commencement_date.state).toBe("NOT_COMPARABLE"); // nothing was extracted for this field, so there is nothing to compare
    expect(d.diffs.completion_date).toMatchObject({ state: "DIFFERS", current: "2026-11-30" }); // 31 Dec vs the project's planned end 30 Nov
    expect(d.diffs.payment_terms.state).toBe("NOT_COMPARABLE");
    expect(d.recordLinks.project).toMatchObject({ type: "PROJECT", id: String(project) });
    // pure engine: no finance/contractor permission -> not comparable and no value leaked
    const recs: DiffRecords = { project: { id: "p", title: "T", startDate: null, plannedEndDate: null, budgetMinor: 100, agencyName: "A" }, contractor: { id: "c", name: "Acme" }, canFinance: false, canContractor: false };
    expect(diffField("contract_value", { type: "MONEY", amountMinor: 100, currency: "LKR" }, recs)).toEqual({ state: "NOT_COMPARABLE", current: null, record: null });
    expect(diffField("contractor_name", { type: "STRING", text: "Acme" }, recs)).toEqual({ state: "NOT_COMPARABLE", current: null, record: null });
    expect(diffField("project_name", { type: "STRING", text: "T" }, { ...recs, project: null })).toEqual({ state: "NO_RECORD", current: null, record: null });
    expect(diffField("contract_value", { type: "MONEY", amountMinor: 999, currency: "LKR" }, { ...recs, canFinance: true }).state).toBe("DIFFERS");
    expect(diffField("project_name", { type: "STRING", text: "t  (the)" }, recs).state).toBe("DIFFERS");
  });

  it("review needs document.update, validates typed edits with the same parsers, uses OCC and tracks progress", async () => {
    const id = await generate();
    const url = `${base}/${doc}/ai/extractions/${id}/review`;
    const v0 = (await read(id)).version as number;
    expect((await as(w.inspector.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "ACCEPTED" }] })).status).toBe(403);
    expect((await as(w.siblingOfficer.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "ACCEPTED" }] })).status).toBe(404);
    expect((await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "nope", decision: "ACCEPTED" }] })).status).toBe(400);
    expect((await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "defects_liability_period", decision: "ACCEPTED" }] })).status).toBe(400); // nothing to accept
    expect((await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "EDITED", editedValue: "a lot" }] })).status).toBe(400);
    expect((await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "ACCEPTED", editedValue: "LKR 1" }] })).status).toBe(400);
    expect((await as(w.officer.token).put(url, { version: v0, extra: 1, decisions: [] })).status).toBe(400);
    const ok = await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "ACCEPTED" }, { fieldKey: "contract_date", decision: "EDITED", editedValue: "2026-04-03" }, { fieldKey: "payment_terms", decision: "REJECTED" }] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.review.decisions).toMatchObject({ contract_value: { decision: "ACCEPTED" }, contract_date: { decision: "EDITED", editedValue: "2026-04-03" }, payment_terms: { decision: "REJECTED" } });
    expect(ok.body.data.review.decided).toBe(3);
    expect(ok.body.data.review.status).toBe("IN_REVIEW");
    expect(ok.body.data.diffs.contract_value.state).toBe("MATCH");
    expect((await as(w.officer.token).put(url, { version: v0, decisions: [{ fieldKey: "contract_value", decision: "REJECTED" }] })).status).toBe(409); // stale
    expect(await AuditLog.countDocuments({ action: "ai.extraction_reviewed" })).toBe(1);
    const reviewAudit = await AuditLog.findOne({ action: "ai.extraction_reviewed" }).select("+newValue").lean();
    expect(JSON.stringify(reviewAudit!.newValue)).toBe(JSON.stringify({ status: "IN_REVIEW", reason: "decided:3", agencyId: reviewAudit!.newValue!.agencyId }));
    // everything decided -> REVIEWED
    const cur = (await read(id)).version as number;
    const all = (await read(id)).result.fields.filter((f: { status: string }) => f.status !== "NOT_FOUND").map((f: { key: string }) => ({ fieldKey: f.key, decision: "REJECTED" }));
    expect((await as(w.officer.token).put(url, { version: cur, decisions: all })).body.data.review.status).toBe("REVIEWED");
  });

  it("apply writes ONLY DocTrace metadata (reference, dates, title) through the document PATCH flow; project/contractor records are untouched", async () => {
    const id = await generate();
    const url = `${base}/${doc}/ai/extractions/${id}`;
    const projectBefore = JSON.stringify(await Project.findById(project).lean());
    const contractorsBefore = JSON.stringify(await Contractor.find({}).lean());
    expect((await as(w.officer.token).post(`${url}/apply-metadata`, { fieldKeys: ["contract_number"] })).status).toBe(400); // not accepted yet
    const v = (await read(id)).version as number;
    await as(w.officer.token).put(`${url}/review`, { version: v, decisions: [{ fieldKey: "contract_number", decision: "ACCEPTED" }, { fieldKey: "completion_date", decision: "ACCEPTED" }, { fieldKey: "contract_date", decision: "ACCEPTED" }, { fieldKey: "contract_value", decision: "ACCEPTED" }] });
    const preview = (await read(id)).metadataPreview as { fieldKey: string; metadataField: string; before: string | null; after: string }[];
    expect(preview.map((p) => p.fieldKey).sort()).toEqual(["completion_date", "contract_number"]); // the ambiguous date has no typed value and is never offered; contract_value has no metadata target
    expect(preview.find((p) => p.fieldKey === "contract_number")).toMatchObject({ metadataField: "reference", before: null, after: "CN/2026/014" });
    expect((await as(w.officer.token).post(`${url}/apply-metadata`, { fieldKeys: ["contract_value"] })).status).toBe(400); // no metadata mapping
    expect((await as(w.officer.token).post(`${url}/apply-metadata`, { fieldKeys: ["contract_date"] })).status).toBe(400); // ambiguous date cannot be applied
    expect((await as(w.inspector.token).post(`${url}/apply-metadata`, { fieldKeys: ["contract_number"] })).status).toBe(403);
    const r = await as(w.officer.token).post(`${url}/apply-metadata`, { fieldKeys: ["contract_number", "completion_date"] });
    expect(r.status).toBe(200);
    expect(r.body.data.metadataFields.sort()).toEqual(["expiresAt", "reference"]);
    const after = await Document.findById(doc).lean();
    expect(after!.reference).toBe("CN/2026/014");
    expect(after!.expiresAt!.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(JSON.stringify(await Project.findById(project).lean())).toBe(projectBefore);
    expect(JSON.stringify(await Contractor.find({}).lean())).toBe(contractorsBefore);
    const audit = await AuditLog.findOne({ action: "ai.extraction_applied_to_metadata" }).select("+newValue").lean();
    expect(audit?.newValue).toMatchObject({ status: "APPLIED", reason: "contract_number,completion_date" });
  });

  it("generation is cached, scope-checked and permissioned like summaries; templates are validated", async () => {
    const a = await as(w.officer.token).post(`${base}/${doc}/ai/extractions`, { template: "CONTRACT_KEY_TERMS" });
    const b = await as(w.officer.token).post(`${base}/${doc}/ai/extractions`, { template: "CONTRACT_KEY_TERMS" });
    expect(b.body.data.id).toBe(a.body.data.id);
    expect((await as(w.officer.token).post(`${base}/${doc}/ai/extractions`, { template: "BOGUS" })).status).toBe(400);
    expect((await as(w.citizen.token).post(`${base}/${doc}/ai/extractions`, { template: "MILESTONES" })).status).toBe(403);
    expect((await as(w.siblingOfficer.token).post(`${base}/${doc}/ai/extractions`, { template: "MILESTONES" })).status).toBe(404);
    const list = await as(w.officer.token).get(`${base}/${doc}/ai/extractions`);
    expect(list.body.data.templates.find((t: { key: string }) => t.key === "CONTRACT_KEY_TERMS")).toMatchObject({ suggested: true });
  });

  it("long documents use retrieval under a single-document allow-list; the model call carries only that document's passages", async () => {
    for (let i = 2; i < 16; i++) await DocumentChunk.create({ documentId: doc, agencyId: w.child._id, projectId: project, versionNo: 1, chunkIndex: i, chunkId: `${doc}:1:${i}`, content: `Filler section ${i} about site logistics.`, charCount: 40, tokenEstimate: 10, contentHash: "a".repeat(64), status: "ACTIVE" });
    stub.on("/v1/search", (c) => { expect(c.json!.allowedDocumentIds).toEqual([String(doc)]); return { body: { hits: [{ chunkId: `${doc}:1:0`, documentId: String(doc), versionNo: 1, score: 0.8, pageStart: 1, pageEnd: 1 }, { chunkId: `${doc}:1:1`, documentId: String(doc), versionNo: 1, score: 0.7, pageStart: 2, pageEnd: 2 }], model: "m", dimension: 8, tokens: 3 } }; });
    const id = await generate();
    expect((await read(id)).status).toBe("READY");
    expect(stub.calls.filter((c) => c.path === "/v1/search").length).toBeGreaterThanOrEqual(11);
    expect((lastExtract!.json!.sources as { n: number }[]).map((s) => s.n)).toEqual([1, 2]);
  });
});
