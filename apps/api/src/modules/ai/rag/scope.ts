import mongoose from "mongoose";
import { AI_ALL_SCOPE_LIMIT, AI_SCOPE_MAX_DOCUMENTS, type AiScopeMode } from "@infraos/shared-types";

import { Flow } from "../../contractors/contractor.context.js";
import { documentAccess, documentReadFilter } from "../../documents/document-access.js";
import { isId, type DCtx } from "../../documents/document.common.js";
import { Document } from "../../documents/models/document.model.js";
import { projectReadFilter } from "../../identity/authorization/resource-scope.js";
import { Project } from "../../projects/models/project.model.js";

const oid = (v: string) => new mongoose.Types.ObjectId(v);

export type ScopeInput = { mode: AiScopeMode; documentIds?: string[] | undefined; projectId?: string | undefined };
export type NotReadyReason = "QUEUED" | "PROCESSING" | "FAILED" | "SCANNED" | "UNSUPPORTED" | "NOT_PROCESSED" | "EXCLUDED" | "SENSITIVE";
export type ScopeDoc = {
  id: string; title: string; docNo: string | null; category: string; projectId: string | null; agencyId: string; indexedVersionNo: number; currentVersionNo: number | null;
  facts: { agencyId: string; projectId: string | null; ownerId: string | null; uploadedBy: string | null; status: string | null; visibility: string | null; confidentiality: string | null; category: string | null };
};
export type ResolvedScope = {
  docs: Map<string, ScopeDoc>;
  coverage: { documentsInScope: number; documentsSearched: number; documentsNotAiReady: number; truncatedScope: boolean };
  notReady: { id: string; title: string; docNo: string | null; reasonCode: NotReadyReason }[];
};

const SELECT = "title docNo category projectId agencyId ownerId uploadedBy status visibility confidentiality currentVersionNo extractedTextStatus aiIndex aiProcessingAllowed aiEligibleType";
type Row = {
  _id: mongoose.Types.ObjectId; title?: string; docNo?: string; category?: string; projectId?: mongoose.Types.ObjectId; agencyId?: mongoose.Types.ObjectId; ownerId?: mongoose.Types.ObjectId; uploadedBy?: mongoose.Types.ObjectId;
  status?: string; visibility?: string; confidentiality?: string; currentVersionNo?: number; extractedTextStatus: string; aiProcessingAllowed?: boolean; aiEligibleType?: boolean;
  aiIndex?: { indexedVersionNo?: number | null; errorCode?: string | null } | null;
};

function reasonOf(r: Row): NotReadyReason {
  if (r.confidentiality === "SENSITIVE" && r.aiProcessingAllowed !== true) return "SENSITIVE";
  if (r.aiProcessingAllowed === false) return "EXCLUDED";
  switch (r.extractedTextStatus) {
    case "QUEUED": return "QUEUED";
    case "PROCESSING": return "PROCESSING";
    case "FAILED": return "FAILED";
    case "UNSUPPORTED": return r.aiIndex?.errorCode === "SCANNED_NO_TEXT" ? "SCANNED" : "UNSUPPORTED";
    default: return "NOT_PROCESSED";
  }
}
const isReady = (r: Row): boolean => r.extractedTextStatus === "COMPLETED" && Boolean(r.aiIndex?.indexedVersionNo) && r.aiProcessingAllowed !== false && r.aiIndex?.indexedVersionNo === r.currentVersionNo;

const toDoc = (r: Row): ScopeDoc => ({
  id: String(r._id), title: r.title ?? "", docNo: r.docNo ?? null, category: r.category ?? "OTHER", projectId: r.projectId ? String(r.projectId) : null, agencyId: String(r.agencyId), indexedVersionNo: r.aiIndex!.indexedVersionNo!, currentVersionNo: r.currentVersionNo ?? null,
  facts: { agencyId: String(r.agencyId), projectId: r.projectId ? String(r.projectId) : null, ownerId: r.ownerId ? String(r.ownerId) : null, uploadedBy: r.uploadedBy ? String(r.uploadedBy) : null, status: r.status ?? null, visibility: r.visibility ?? null, confidentiality: r.confidentiality ?? null, category: r.category ?? null },
});

/**
 * Builds the allow-list server-side: the caller's own read filter AND DocTrace AND ACTIVE, split into AI-ready (searched) and not (reported in coverage).
 * An id the caller cannot read is indistinguishable from a missing one (404). Nothing client-supplied bypasses the read filter.
 */
export async function resolveScope(d: DCtx, input: ScopeInput): Promise<ResolvedScope> {
  const base: Record<string, unknown>[] = [documentReadFilter(d.viewer), { origin: "DOCTRACE", status: "ACTIVE" }, { aiEligibleType: true }];
  if (input.mode === "DOCUMENT" || input.mode === "DOCUMENTS") {
    const ids = [...new Set(input.documentIds ?? [])];
    if (!ids.length || ids.length > AI_SCOPE_MAX_DOCUMENTS || (input.mode === "DOCUMENT" && ids.length !== 1) || ids.some((x) => !isId(x))) throw new Flow(400, "VALIDATION_ERROR");
    base.push({ _id: { $in: ids.map(oid) } });
  } else if (input.mode === "PROJECT") {
    if (!input.projectId || !isId(input.projectId)) throw new Flow(400, "VALIDATION_ERROR");
    const project = await Project.findOne({ $and: [projectReadFilter(d.ctx.scope), { _id: input.projectId }] }).select("_id").lean();
    if (!project) throw new Flow(404, "NOT_FOUND");
    base.push({ projectId: oid(input.projectId) });
  }
  const limit = input.mode === "ALL" || input.mode === "PROJECT" ? AI_ALL_SCOPE_LIMIT + 1 : AI_SCOPE_MAX_DOCUMENTS;
  const rows = (await Document.find({ $and: base }).select(SELECT).sort({ updatedAt: -1 }).limit(limit).lean()) as unknown as Row[];

  if ((input.mode === "DOCUMENT" || input.mode === "DOCUMENTS") && new Set(rows.map((r) => String(r._id))).size !== new Set(input.documentIds).size) throw new Flow(404, "NOT_FOUND");

  const truncated = rows.length > AI_ALL_SCOPE_LIMIT && (input.mode === "ALL" || input.mode === "PROJECT");
  const used = truncated ? rows.slice(0, AI_ALL_SCOPE_LIMIT) : rows;
  const docs = new Map<string, ScopeDoc>();
  const notReady: ResolvedScope["notReady"] = [];
  for (const r of used) {
    // Belt and braces: the Mongo filter and the pure policy must agree.
    const doc = r.agencyId ? { agencyId: String(r.agencyId), projectId: r.projectId ? String(r.projectId) : null, ownerId: r.ownerId ? String(r.ownerId) : null, uploadedBy: r.uploadedBy ? String(r.uploadedBy) : null, status: r.status ?? null, visibility: r.visibility ?? null, confidentiality: r.confidentiality ?? null, category: r.category ?? null } : null;
    if (!doc || !documentAccess(d.viewer, doc)) continue;
    if (isReady(r)) docs.set(String(r._id), toDoc(r));
    else notReady.push({ id: String(r._id), title: r.title ?? "", docNo: r.docNo ?? null, reasonCode: reasonOf(r) });
  }
  return { docs, notReady, coverage: { documentsInScope: docs.size + notReady.length, documentsSearched: docs.size, documentsNotAiReady: notReady.length, truncatedScope: truncated } };
}
