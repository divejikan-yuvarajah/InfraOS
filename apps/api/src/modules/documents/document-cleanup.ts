import mongoose from "mongoose";

import { getDocumentStorage } from "../inspections/evidence-storage.js";
import { DocumentUpload } from "./models/document-upload.model.js";
import { DocumentVersion } from "./models/document-version.model.js";

export const UPLOAD_MAX_AGE_HOURS = 24;
export type DocumentCleanupReport = { mode: "dry-run" | "commit"; staleTickets: number; unreferencedBlobs: number; blobsDeleted: number };

/**
 * Removes upload tickets that never committed (older than 24 h) with their blobs, and blobs in the `documents` bucket that no version
 * or live ticket references. Never scheduled automatically. Dry run by default.
 */
export async function cleanupDocumentUploads(commit: boolean, now = new Date()): Promise<DocumentCleanupReport> {
  const storage = getDocumentStorage();
  const cutoff = new Date(now.getTime() - UPLOAD_MAX_AGE_HOURS * 3_600_000);
  const stale = await DocumentUpload.find({ status: { $ne: "COMMITTED" }, createdAt: { $lt: cutoff } }).select("+storageRef").limit(5000).lean();
  let blobsDeleted = 0;
  if (commit && storage) {
    for (const t of stale) {
      if (t.storageRef) { await storage.delete(t.storageRef).catch(() => undefined); blobsDeleted += 1; }
      await DocumentUpload.deleteOne({ _id: t._id });
    }
  }
  const db = mongoose.connection.db;
  let unreferenced = 0;
  if (db && storage) {
    const files = await db.collection("documents.files").find({ uploadDate: { $lt: cutoff } }, { projection: { filename: 1 } }).limit(5000).toArray();
    const names = files.map((f) => String(f.filename));
    const [versions, tickets] = await Promise.all([
      DocumentVersion.find({ storageRef: { $in: names } }).select("+storageRef").lean(),
      DocumentUpload.find({ storageRef: { $in: names }, status: { $in: ["PENDING", "STORED"] } }).select("+storageRef").lean(),
    ]);
    const used = new Set([...versions, ...tickets].map((r) => r.storageRef));
    for (const n of names.filter((x) => !used.has(x))) {
      unreferenced += 1;
      if (commit) { await storage.delete(n).catch(() => undefined); blobsDeleted += 1; }
    }
  }
  return { mode: commit ? "commit" : "dry-run", staleTickets: stale.length, unreferencedBlobs: unreferenced, blobsDeleted };
}
