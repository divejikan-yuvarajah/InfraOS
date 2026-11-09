import { createHash } from "node:crypto";

import { DocumentChunk } from "./models/document-chunk.model.js";
import { Document } from "./models/document.model.js";

export const LEGACY_CHUNK_INDEX = "documentId_1_chunkIndex_1";
export type ChunkMigrationReport = { mode: "dry-run" | "commit"; legacyRows: number; backfilled: number; orphanRows: number; legacyIndexPresent: boolean; legacyIndexDropped: boolean };

/**
 * Batch 09 migration for `documentChunks`. Dry run by default.
 *   1. Backfills legacy rows (no chunkId) as STALE version-1 chunks (no vectors exist for them, so they are never searchable). Rows whose document is missing/ownerless are only counted.
 *   2. Drops the legacy unique index { documentId, chunkIndex } and creates the Batch 09 indexes. Refuses to drop it while ownerless legacy rows remain.
 * Counts only; never content.
 */
export async function migrateDocumentChunks(commit: boolean): Promise<ChunkMigrationReport> {
  const coll = DocumentChunk.collection;
  const report: ChunkMigrationReport = { mode: commit ? "commit" : "dry-run", legacyRows: 0, backfilled: 0, orphanRows: 0, legacyIndexPresent: false, legacyIndexDropped: false };
  const indexes = await coll.indexes().catch(() => []);
  report.legacyIndexPresent = indexes.some((i) => i.name === LEGACY_CHUNK_INDEX);

  for await (const row of coll.find({ chunkId: { $exists: false } }, { projection: { documentId: 1, chunkIndex: 1, content: 1 } })) {
    report.legacyRows += 1;
    const doc = await Document.findById(row.documentId).select("agencyId").lean();
    if (!doc?.agencyId) { report.orphanRows += 1; continue; }
    if (!commit) continue;
    const content = typeof row.content === "string" ? row.content : "";
    await coll.updateOne({ _id: row._id }, { $set: {
      agencyId: doc.agencyId, versionNo: 1, chunkId: `${String(row.documentId)}:1:${Number(row.chunkIndex)}`, charCount: content.length, tokenEstimate: Math.ceil(content.length / 4),
      contentHash: createHash("sha256").update(content).digest("hex"), status: "STALE",
    } });
    report.backfilled += 1;
  }
  if (commit) {
    if (report.orphanRows > 0) throw new Error(`${report.orphanRows} legacy chunk rows have no owning agency; resolve them before dropping the legacy index`);
    if (report.legacyIndexPresent) { await coll.dropIndex(LEGACY_CHUNK_INDEX); report.legacyIndexDropped = true; }
    await DocumentChunk.createIndexes();
  }
  return report;
}
