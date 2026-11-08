import { createHash } from "node:crypto";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { DocumentChunk } from "../modules/documents/models/document-chunk.model.js";
import { Document } from "../modules/documents/models/document.model.js";

/**
 * Batch 09 migration for `documentChunks`. Dry run by default; pass --commit to write.
 *   1. Backfills legacy rows (no chunkId) as STALE version-1 chunks — they have no vectors, so they are never searchable.
 *      Rows whose document is missing/ownerless are only counted (never guessed).
 *   2. Drops the legacy unique index { documentId, chunkIndex } and creates the Batch 09 indexes.
 * Point it only at a development or disposable database. Prints counts only, never row content.
 */
const LEGACY_INDEX = "documentId_1_chunkIndex_1";

async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  const coll = DocumentChunk.collection;
  const report = { mode: commit ? "commit" : "dry-run", legacyRows: 0, backfilled: 0, orphanRows: 0, legacyIndexPresent: false, legacyIndexDropped: false };

  const indexes = await coll.indexes().catch(() => []);
  report.legacyIndexPresent = indexes.some((i) => i.name === LEGACY_INDEX);

  const cursor = coll.find({ chunkId: { $exists: false } }, { projection: { documentId: 1, chunkIndex: 1, content: 1 } });
  for await (const row of cursor) {
    report.legacyRows += 1;
    const doc = await Document.findById(row.documentId).select("agencyId projectId").lean();
    if (!doc?.agencyId) { report.orphanRows += 1; continue; }
    if (!commit) continue;
    const content = typeof row.content === "string" ? row.content : "";
    await coll.updateOne({ _id: row._id }, { $set: {
      agencyId: doc.agencyId,
      versionNo: 1,
      chunkId: `${String(row.documentId)}:1:${Number(row.chunkIndex)}`,
      charCount: content.length,
      tokenEstimate: Math.ceil(content.length / 4),
      contentHash: createHash("sha256").update(content).digest("hex"),
      status: "STALE",
    } });
    report.backfilled += 1;
  }

  if (commit) {
    if (report.orphanRows > 0) throw new Error(`${report.orphanRows} legacy chunk rows have no owning agency; resolve them before dropping the legacy index`);
    if (report.legacyIndexPresent) { await coll.dropIndex(LEGACY_INDEX); report.legacyIndexDropped = true; }
    await DocumentChunk.createIndexes();
  }
  console.log(`INFRAOS documentChunks migration (${report.mode}): PASS`);
  console.log(JSON.stringify(report, null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS documentChunks migration: FAIL");
  console.error(error instanceof Error ? error.message : "migration failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
