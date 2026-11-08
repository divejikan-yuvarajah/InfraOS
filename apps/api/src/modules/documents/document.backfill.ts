import { LEGACY_TYPE_TO_CATEGORY, categoryDef, type LegacyDocumentType } from "@infraos/shared-types";

import { MaintenanceEvidence } from "../assets/models/maintenance-evidence.model.js";
import { InspectionEvidence } from "../inspections/models/inspection-evidence.model.js";
import { Project } from "../projects/models/project.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import { Document } from "./models/document.model.js";

export type DocumentBackfillReport = { mode: "dry-run" | "commit"; scanned: number; evidenceRows: number; docTraceRows: number; filesUnavailable: number; updated: number; skippedNoOwner: number };

/**
 * Brings legacy `documents` rows to the Batch 08 shape. Idempotent (only rows without `origin` are touched). Dry run by default.
 * - Rows referenced by inspection/maintenance evidence (or typed SITE_EVIDENCE with stored bytes) become origin INSPECTION_EVIDENCE and stay hidden from the DocTrace library.
 * - Other rows become DocTrace metadata rows: docNo, title, category (from documentType), agencyId (from the project), ACTIVE, STANDARD.
 *   No bytes exist for them, so there is no version row and the UI shows "File not available". Nothing is invented.
 */
export async function backfillDocuments(commit: boolean): Promise<DocumentBackfillReport> {
  const report: DocumentBackfillReport = { mode: commit ? "commit" : "dry-run", scanned: 0, evidenceRows: 0, docTraceRows: 0, filesUnavailable: 0, updated: 0, skippedNoOwner: 0 };
  const [ins, mnt] = await Promise.all([InspectionEvidence.find({}).select("documentId thumbDocumentId").lean(), MaintenanceEvidence.find({}).select("documentId thumbDocumentId").lean()]);
  const evidenceIds = new Set<string>();
  for (const e of [...ins, ...mnt]) for (const id of [e.documentId, (e as { thumbDocumentId?: unknown }).thumbDocumentId]) if (id) evidenceIds.add(String(id));
  const cursor = Document.find({ origin: { $exists: false } }).select("+storageKey projectId documentType fileName uploadedBy agencyId").cursor();
  for await (const d of cursor) {
    report.scanned += 1;
    if (evidenceIds.has(String(d._id)) || (d.documentType === "SITE_EVIDENCE" && d.storageKey)) {
      report.evidenceRows += 1;
      if (commit) { await Document.updateOne({ _id: d._id }, { $set: { origin: "INSPECTION_EVIDENCE", status: "ACTIVE" } }, { timestamps: false }); report.updated += 1; }
      continue;
    }
    let agencyId: typeof d.agencyId | undefined = d.agencyId;
    if (!agencyId && d.projectId) agencyId = (await Project.findById(d.projectId).select("agencyId").lean())?.agencyId as typeof agencyId;
    if (!agencyId) { report.skippedNoOwner += 1; continue; }
    report.docTraceRows += 1; report.filesUnavailable += 1;
    if (!commit) continue;
    const category = LEGACY_TYPE_TO_CATEGORY[d.documentType as LegacyDocumentType] ?? "OTHER";
    const sensitive = categoryDef(category)?.sensitiveByDefault ?? false;
    await Document.updateOne({ _id: d._id }, { $set: {
      docNo: await nextNumber("DOC"), title: d.fileName.slice(0, 200), category, agencyId, ownerId: d.uploadedBy, status: "ACTIVE", origin: "DOCTRACE",
      confidentiality: sensitive ? "SENSITIVE" : "STANDARD", aiProcessingAllowed: !sensitive, aiEligibleType: false, version: 0,
    } }, { timestamps: false });
    report.updated += 1;
  }
  return report;
}
