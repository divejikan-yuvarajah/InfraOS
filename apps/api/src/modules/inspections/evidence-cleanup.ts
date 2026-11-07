import { Document } from "../documents/models/document.model.js";
import { getEvidenceStorage, storageKeyFor } from "./evidence-storage.js";
import { InspectionEvidence } from "./models/inspection-evidence.model.js";
import { Inspection } from "./models/inspection.model.js";

export const PENDING_MAX_AGE_HOURS = 24;
export const CANCELLED_RETENTION_DAYS = 30;

export type CleanupReport = { mode: "dry-run" | "commit"; orphanedPending: number; cancelledNeverSubmitted: number; filesDeleted: number; rowsRemoved: number };

/**
 * Two safe clean-ups, never scheduled automatically:
 *  1. PENDING_UPLOAD evidence older than 24 h (an upload that never finished).
 *  2. Evidence of CANCELLED inspections that were never submitted, once 30 days have passed.
 * Evidence of anything that was submitted is never touched (accountability). Dry run by default.
 */
export async function cleanupEvidence(commit: boolean, now = new Date()): Promise<CleanupReport> {
  const storage = getEvidenceStorage();
  const stale = await InspectionEvidence.find({ status: "PENDING_UPLOAD", uploadedAt: { $lt: new Date(now.getTime() - PENDING_MAX_AGE_HOURS * 3_600_000) } }).select("inspectionId documentId thumbDocumentId").limit(5000).lean();
  const cancelled = await Inspection.find({ status: "CANCELLED", completedAt: { $lt: new Date(now.getTime() - CANCELLED_RETENTION_DAYS * 86_400_000) }, "submissions.0": { $exists: false } }).select("_id").limit(2000).lean();
  const cancelledEvidence = cancelled.length ? await InspectionEvidence.find({ inspectionId: { $in: cancelled.map((c) => c._id) }, status: { $ne: "REMOVED" } }).select("inspectionId documentId thumbDocumentId").limit(5000).lean() : [];
  const targets = [...stale, ...cancelledEvidence];
  let filesDeleted = 0, rowsRemoved = 0;
  if (commit && storage) {
    for (const t of targets) {
      for (const variant of ["full", "thumb"] as const) { await storage.delete(storageKeyFor(String(t.inspectionId), String(t._id), variant)).catch(() => undefined); filesDeleted += 1; }
      await InspectionEvidence.updateOne({ _id: t._id }, { $set: { status: "REMOVED", removedAt: now, removalReason: "Cleanup of an unfinished upload or a cancelled inspection" } });
      await Inspection.updateOne({ _id: t.inspectionId }, { $pull: { evidence: t.documentId } }, { timestamps: false });
      await Document.deleteMany({ _id: { $in: [t.documentId, t.thumbDocumentId].filter(Boolean) } });
      rowsRemoved += 1;
    }
  }
  return { mode: commit ? "commit" : "dry-run", orphanedPending: stale.length, cancelledNeverSubmitted: cancelledEvidence.length, filesDeleted, rowsRemoved };
}
