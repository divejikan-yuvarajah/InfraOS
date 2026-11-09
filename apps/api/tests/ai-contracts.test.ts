import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AI_AUDIT_ACTIONS } from "@infraos/shared-types";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { deleteResponse, dropCollectionResponse, extractChunkResponse, indexRequest, indexResponse, reindexPlanResponse, searchRequest, searchResponse, serviceError } from "../src/modules/ai/ai.contracts.js";
import { LEGACY_CHUNK_INDEX, migrateDocumentChunks } from "../src/modules/documents/chunk-migration.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const fixture = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, "../../ai-service/tests/fixtures", `${name}.json`), "utf8"));

describe("service contracts: the same JSON fixtures pydantic validates must pass the zod mirrors", () => {
  it.each([
    ["extract-chunk.response", extractChunkResponse], ["index.request", indexRequest], ["index.response", indexResponse], ["search.request", searchRequest],
    ["search.response", searchResponse], ["delete.response", deleteResponse], ["reindex-plan.response", reindexPlanResponse], ["drop-collection.response", dropCollectionResponse], ["error", serviceError],
  ] as const)("%s", (name, schema) => { expect(schema.safeParse(fixture(name)).success).toBe(true); });
  it("rejects malformed payloads (bad ids, empty allow-list, negative counts)", () => {
    expect(searchRequest.safeParse({ query: "x", allowedDocumentIds: [] }).success).toBe(false);
    expect(searchRequest.safeParse({ query: "x", allowedDocumentIds: ["nope"] }).success).toBe(false);
    expect(indexResponse.safeParse({ embedded: -1, skipped: 0, tokens: 0, model: "m", dimension: 1024, collection: "c" }).success).toBe(false);
  });
});

describe("migration, indexes and audit allowlist", { timeout: 120_000 }, () => {
  beforeAll(async () => { await startIsolatedMongo(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });

  it("dry run reports and writes nothing; commit backfills legacy rows as STALE and swaps the unique index", async () => {
    await mongoose.connection.db!.createCollection("documentChunks").catch(() => undefined);
    await DocumentChunk.collection.createIndex({ documentId: 1, chunkIndex: 1 }, { unique: true, name: LEGACY_CHUNK_INDEX });
    const agencyId = new mongoose.Types.ObjectId();
    const doc = await Document.create({ documentType: "CONTRACT", fileName: "a.pdf", uploadedBy: new mongoose.Types.ObjectId(), agencyId, status: "ACTIVE" });
    await DocumentChunk.collection.insertMany([
      { documentId: doc._id, projectId: new mongoose.Types.ObjectId(), chunkIndex: 0, content: "legacy text", createdAt: new Date(), updatedAt: new Date() },
      { documentId: new mongoose.Types.ObjectId(), chunkIndex: 0, content: "orphan", createdAt: new Date(), updatedAt: new Date() },
    ]);
    const dry = await migrateDocumentChunks(false);
    expect(dry).toMatchObject({ mode: "dry-run", legacyRows: 2, backfilled: 0, orphanRows: 1, legacyIndexPresent: true, legacyIndexDropped: false });
    expect(await DocumentChunk.collection.countDocuments({ chunkId: { $exists: true } })).toBe(0);
    await expect(migrateDocumentChunks(true)).rejects.toThrow(/no owning agency/); // never drops the legacy index while rows are unresolved
    expect(await DocumentChunk.collection.countDocuments({ chunkId: { $exists: true } })).toBe(1); // the resolvable row was backfilled before the refusal
    await DocumentChunk.collection.deleteOne({ content: "orphan" });
    const done = await migrateDocumentChunks(true);
    expect(done).toMatchObject({ backfilled: 0, orphanRows: 0, legacyIndexDropped: true });
    expect(await DocumentChunk.findOne({ documentId: doc._id }).lean()).toMatchObject({ status: "STALE", versionNo: 1, chunkId: `${doc._id}:1:0` });
    const names = (await DocumentChunk.collection.indexes()).map((i) => i.name);
    expect(names).not.toContain(LEGACY_CHUNK_INDEX);
    expect(names).toEqual(expect.arrayContaining(["documentId_1_versionNo_1_chunkIndex_1", "agencyId_1_documentId_1_status_1", "documentId_1_status_1", "chunkId_1"]));
    expect((await migrateDocumentChunks(true)).legacyRows).toBe(0); // idempotent
  });

  it("the audit schema accepts every Batch 09 action with allowlisted snapshot keys only", async () => {
    for (const action of AI_AUDIT_ACTIONS) {
      await expect(AuditLog.create({ action, resourceType: "DOCUMENT", resourceId: new mongoose.Types.ObjectId(), newValue: { status: "COMPLETED", reason: "count:3" } })).resolves.toBeTruthy();
    }
    await expect(AuditLog.create({ action: "ai.document_processing_completed", resourceType: "DOCUMENT", resourceId: new mongoose.Types.ObjectId(), newValue: { text: "leak" } as never })).rejects.toThrow();
  });
});
