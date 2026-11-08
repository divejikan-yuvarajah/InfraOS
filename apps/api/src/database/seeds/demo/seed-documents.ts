import { createHash } from "node:crypto";

import mongoose from "mongoose";
import { categoryDef } from "@infraos/shared-types";

import { Asset } from "../../../modules/assets/models/asset.model.js";
import { aiEligibleFor, legacyTypeFor } from "../../../modules/documents/document-categories.js";
import { backfillDocuments } from "../../../modules/documents/document.backfill.js";
import { Document } from "../../../modules/documents/models/document.model.js";
import { DocumentVersion } from "../../../modules/documents/models/document-version.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { getDocumentStorage } from "../../../modules/inspections/evidence-storage.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import { ctxId, type DemoContext } from "./context.js";

type Id = mongoose.Types.ObjectId;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** A tiny but structurally valid one-page PDF (real xref offsets) with a visible line of text. */
export function makePdf(line: string): Buffer {
  const safe = line.replace(/[()\\]/g, "");
  const stream = `BT /F1 14 Tf 40 700 Td (${safe}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

type Spec = {
  no: number; project?: "INF-ROAD-001" | "INF-BRIDGE-001" | "INF-WATER-001"; agency?: string; category: string; title: string; kind: "pdf" | "txt" | "png"; versions?: number;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; sensitive?: boolean; visibility?: "INTERNAL" | "PROJECT_TEAM" | "PUBLIC"; link?: "contractor" | "payment" | "inspection" | "asset"; tags?: string[]; reference?: string; expiresInDays?: number; description?: string;
};

const SPECS: Spec[] = [
  { no: 1, project: "INF-ROAD-001", category: "PROJECT_PLAN", title: "Road Upgrade Project Plan (Synthetic)", kind: "pdf", versions: 3, visibility: "PROJECT_TEAM", tags: ["plan", "road"], reference: "PLAN-RDA-001", description: "Three revisions of the project plan (Synthetic)." },
  { no: 2, project: "INF-ROAD-001", category: "ENGINEERING_DRAWING", title: "Road Cross-Section Drawing (Synthetic)", kind: "png", visibility: "PROJECT_TEAM", tags: ["drawing"] },
  { no: 3, project: "INF-ROAD-001", category: "CONTRACT", title: "Civil Works Contract (Synthetic)", kind: "pdf", sensitive: true, link: "contractor", tags: ["contract"], reference: "CNT-2026-ALPHA", description: "Restricted: contract terms (Synthetic)." },
  { no: 4, project: "INF-ROAD-001", category: "BOQ", title: "Bill of Quantities Summary (Synthetic)", kind: "txt", link: "contractor", tags: ["boq"] },
  { no: 5, project: "INF-ROAD-001", category: "PAYMENT_EVIDENCE", title: "Interim Payment Voucher (Synthetic)", kind: "pdf", link: "payment", tags: ["payment"] },
  { no: 6, project: "INF-ROAD-001", category: "INSPECTION_REPORT", title: "Site Inspection Report (Synthetic)", kind: "pdf", link: "inspection", visibility: "PROJECT_TEAM", tags: ["inspection"] },
  { no: 7, project: "INF-ROAD-001", category: "PROGRESS_REPORT", title: "Quarterly Progress Report - Draft (Synthetic)", kind: "pdf", status: "DRAFT", tags: ["progress"] },
  { no: 8, project: "INF-BRIDGE-001", category: "ENGINEERING_DRAWING", title: "Bridge Structural Notes (Synthetic)", kind: "pdf", visibility: "PROJECT_TEAM", tags: ["bridge", "design"] },
  { no: 9, project: "INF-BRIDGE-001", category: "ASSET_HANDOVER_RECORD", title: "Bridge Handover Record (Synthetic)", kind: "pdf", link: "asset", tags: ["handover"] },
  { no: 10, project: "INF-BRIDGE-001", category: "MAINTENANCE_DOCUMENT", title: "Bearing Maintenance Log - Superseded (Synthetic)", kind: "txt", status: "ARCHIVED", tags: ["maintenance"] },
  { no: 11, project: "INF-WATER-001", category: "APPROVAL_DOCUMENT", title: "Environmental Approval Letter (Synthetic)", kind: "pdf", expiresInDays: 20, tags: ["approval"], reference: "ENV-APP-77" },
  { no: 12, project: "INF-WATER-001", category: "TENDER", title: "Pipe Supply Tender Notice (Synthetic)", kind: "txt", tags: ["tender"] },
  { no: 13, agency: "DEMO_RDA", category: "GOVERNMENT_CORRESPONDENCE", title: "Ministry Circular on Road Safety (Synthetic)", kind: "txt", visibility: "PROJECT_TEAM", tags: ["circular"] },
];

function bytesFor(s: Spec, v: number): { bytes: Buffer; mime: string; ext: string } {
  const label = `${s.title} - version ${v}`;
  if (s.kind === "png") return { bytes: Buffer.concat([PNG, Buffer.from(`synthetic-${s.no}-${v}`)]), mime: "image/png", ext: "png" };
  if (s.kind === "txt") return { bytes: Buffer.from(`${label}\nSynthetic demo content for DocTrace. Not official data.\n`, "utf8"), mime: "text/plain", ext: "txt" };
  return { bytes: makePdf(label), mime: "application/pdf", ext: "pdf" };
}

/**
 * Synthetic DocTrace documents with tiny REAL files stored through the real provider, so preview and download work in the demo.
 * Numbers live in the reserved DOC-2026-9000nn range (idempotent, never consume the real counter). Legacy metadata-only rows and evidence rows are
 * brought to the Batch 08 shape by the same backfill the operators run. Reset removes the blobs (see reset-demo).
 */
export async function seedDemoDocuments(context: DemoContext): Promise<{ documents: number; versions: number; legacyBackfilled: number }> {
  const legacy = await backfillDocuments(true);
  const storage = getDocumentStorage();
  if (!storage) return { documents: 0, versions: 0, legacyBackfilled: legacy.updated };
  const officer = ctxId(context.users as unknown as Map<string, Id>, "AGENCY_OFFICER");
  const pm = ctxId(context.users as unknown as Map<string, Id>, "PROJECT_MANAGER");
  const alpha = context.contractors.get("SYNTH/ALPHA-001");
  let versions = 0;
  let documents = 0;
  for (const s of SPECS) {
    const projectId = s.project ? context.projects.get(s.project) : undefined;
    const project = projectId ? await Project.findById(projectId).select("agencyId").lean() : null;
    const agencyId = (project?.agencyId as Id | undefined) ?? (s.agency ? context.agencies.get(s.agency) : undefined);
    if (!agencyId) continue;
    const links: Record<string, Id> = {};
    if (s.link === "contractor" && alpha) links.contractorId = alpha;
    if (s.link === "payment" && projectId) { const p = await ProjectPayment.findOne({ projectId }).select("_id").lean(); if (p) links.paymentId = p._id as Id; }
    if (s.link === "inspection" && projectId) { const i = await Inspection.findOne({ projectId, status: { $ne: "CANCELLED" } }).select("_id").lean(); if (i) links.inspectionId = i._id as Id; }
    if (s.link === "asset") { const a = await Asset.findOne(projectId ? { sourceProjectId: projectId } : { name: "Demo Riverside Bridge Asset" }).select("_id").lean(); if (a) links.assetId = a._id as Id; }
    const docNo = `DOC-2026-${String(900000 + s.no)}`;
    const existing = await Document.findOne({ docNo }).select("_id").lean();
    const docId = (existing?._id as Id | undefined) ?? new mongoose.Types.ObjectId();
    const total = s.versions ?? 1;
    const verDocs: { _id: Id; no: number }[] = [];
    for (let v = 1; v <= total; v += 1) {
      const f = bytesFor(s, v);
      const ref = `doc/${docId}/v${v}/seed-${s.no}-v${v}`;
      await storage.put(ref, f.bytes, f.mime);
      const hash = createHash("sha256").update(f.bytes).digest("hex");
      const ver = await DocumentVersion.findOneAndUpdate({ documentId: docId, versionNo: v }, { $set: { storageRef: ref, fileName: `${s.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60)}.${f.ext}`, mimeType: f.mime, sizeBytes: f.bytes.length, contentHash: hash, uploadedBy: officer, ...(v > 1 ? { changeNote: `Revision ${v} with updated figures (Synthetic)` } : {}), activeContent: false, status: v === total ? "CURRENT" : "SUPERSEDED" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      verDocs.push({ _id: ver._id as Id, no: v });
      versions += 1;
    }
    const cur = bytesFor(s, total);
    const cat = categoryDef(s.category)!;
    const sensitive = Boolean(s.sensitive);
    const curVer = verDocs[verDocs.length - 1]!;
    const hash = createHash("sha256").update(cur.bytes).digest("hex");
    const status = s.status ?? "ACTIVE";
    await Document.findOneAndUpdate({ _id: docId }, { $set: {
      docNo, ...(projectId ? { projectId } : {}), agencyId, documentType: legacyTypeFor(s.category), category: s.category, title: s.title, ...(s.description ? { description: s.description } : {}),
      fileName: `${s.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60)}.${cur.ext}`, mimeType: cur.mime, sizeBytes: cur.bytes.length, contentHash: hash, uploadedBy: officer, ownerId: s.no % 2 ? officer : pm, uploadedByAgencyId: agencyId,
      currentVersionNo: total, currentVersionId: curVer._id, status, visibility: sensitive ? "INTERNAL" : s.visibility ?? cat.defaultVisibility, confidentiality: sensitive ? "SENSITIVE" : "STANDARD",
      aiProcessingAllowed: !sensitive, aiEligibleType: aiEligibleFor(cur.mime), origin: "DOCTRACE", tags: s.tags ?? [], ...(s.reference ? { reference: s.reference } : {}),
      documentDate: d("2026-05-15T04:00:00.000Z"), ...(s.expiresInDays ? { expiresAt: new Date(Date.now() + s.expiresInDays * 86_400_000) } : {}), ...links, extractedTextStatus: "NOT_STARTED", version: 0,
      ...(status === "ARCHIVED" ? { archivedAt: d("2026-08-01T04:00:00.000Z"), archivedBy: officer, archiveReason: "Replaced by the current maintenance schedule (Synthetic)" } : {}),
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    documents += 1;
  }
  return { documents, versions, legacyBackfilled: legacy.updated };
}

export const DEMO_DOCUMENT_COUNT = SPECS.length;
