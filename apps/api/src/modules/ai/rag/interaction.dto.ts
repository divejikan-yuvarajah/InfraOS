import mongoose from "mongoose";
import type { AiSourceStatus } from "@infraos/shared-types";

import { documentAccess } from "../../documents/document-access.js";
import type { DCtx } from "../../documents/document.common.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { Document } from "../../documents/models/document.model.js";
import { redactText } from "./redact.js";
import { truncate } from "./text.js";
import type { AiInteractionDocument } from "./interaction.model.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));

/**
 * Interaction -> API DTO. Every citation is RE-AUTHORISED now (read access, ACTIVE, not AI-excluded, version unchanged). Anyone who lost access sees
 * only "no longer accessible": no title, document number, pages, section or quote. Question/answer text is returned only to the author (callers enforce).
 */
export type CitationDto = {
  n: number; chunkId: string; documentId: string; versionNo: number; sourceStatus: AiSourceStatus; docNo: string | null; title: string | null; category: string | null;
  pageStart: number | null; pageEnd: number | null; section: string | null; quote: string | null; quoteVerified: boolean; wasNeighbor: boolean; excerpt?: string | null;
};

export async function buildInteractionDto(d: DCtx, row: AiInteractionDocument, opts: { excerpts?: boolean } = {}) {
  const ids = [...new Set(row.citations.map((c) => String(c.documentId)))];
  const docs = ids.length
    ? await Document.find({ _id: { $in: ids.map(oid) } }).select("title docNo category agencyId projectId ownerId uploadedBy status visibility confidentiality deletedAt currentVersionNo aiProcessingAllowed aiIndex extractedTextStatus").lean()
    : [];
  const byId = new Map(docs.map((x) => [String(x._id), x]));
  const excerptFor = new Map<string, string>();
  if (opts.excerpts && row.status === "PASSAGES_ONLY") {
    const chunks = await DocumentChunk.find({ chunkId: { $in: row.citations.map((c) => c.chunkId) }, status: "ACTIVE" }).select("+content chunkId").lean();
    for (const c of chunks) excerptFor.set(c.chunkId, truncate(redactText((c as unknown as { content?: string }).content ?? "").text, 400));
  }

  const citations: CitationDto[] = row.citations.map((c) => {
    const doc = byId.get(String(c.documentId));
    const accessible = Boolean(doc && !doc.deletedAt && doc.agencyId && doc.aiProcessingAllowed !== false && documentAccess(d.viewer, {
      agencyId: String(doc.agencyId), projectId: doc.projectId ? String(doc.projectId) : null, ownerId: doc.ownerId ? String(doc.ownerId) : null, uploadedBy: doc.uploadedBy ? String(doc.uploadedBy) : null,
      status: doc.status ?? null, visibility: doc.visibility ?? null, confidentiality: doc.confidentiality ?? null, category: doc.category ?? null,
    }));
    if (!accessible || !doc) return { n: c.n, chunkId: c.chunkId, documentId: String(c.documentId), versionNo: c.versionNo, sourceStatus: "NO_LONGER_ACCESSIBLE", docNo: null, title: null, category: null, pageStart: null, pageEnd: null, section: null, quote: null, quoteVerified: false, wasNeighbor: c.wasNeighbor ?? false };
    const archived = doc.status === "ARCHIVED";
    const updated = !archived && (doc.currentVersionNo !== c.versionNo || doc.aiIndex?.indexedVersionNo !== c.versionNo);
    const sourceStatus: AiSourceStatus = archived ? "ARCHIVED" : updated ? "UPDATED" : "CURRENT";
    return {
      n: c.n, chunkId: c.chunkId, documentId: String(c.documentId), versionNo: c.versionNo, sourceStatus, docNo: doc.docNo ?? null, title: doc.title ?? null, category: doc.category ?? null,
      pageStart: c.pageStart ?? null, pageEnd: c.pageEnd ?? null, section: c.section ?? null,
      quote: archived ? null : c.quote ?? null, quoteVerified: archived ? false : c.quoteVerified, wasNeighbor: c.wasNeighbor ?? false,
      ...(opts.excerpts && row.status === "PASSAGES_ONLY" && !archived ? { excerpt: excerptFor.get(c.chunkId) ?? null } : {}),
    };
  });

  const cost = row.usage?.estimatedCostMinor;
  return {
    id: String(row._id), threadId: row.threadId, createdAt: row.createdAt.toISOString(), question: row.question ?? row.message ?? "", language: row.language, status: row.status,
    scope: row.scope ? { mode: row.scope.mode, documentIds: (row.scope.documentIds ?? []).map(String), projectId: row.scope.projectId ? String(row.scope.projectId) : null } : { mode: "ALL" as const, documentIds: [], projectId: null },
    answer: row.answer ? { text: row.answer.text ?? "", claims: (row.answer.claims ?? []).map((c) => ({ text: c.text, citationNs: c.citationNs ?? [], supported: Boolean(c.supported) })), missingInfo: [...(row.answer.missingInfo ?? [])] } : null,
    citations,
    evidence: row.evidence ? { level: row.evidence.level, unverifiedFigures: [...(row.evidence.unverifiedFigures ?? [])], droppedClaims: row.evidence.droppedClaims ?? 0, quotesVerified: row.evidence.quotesVerified ?? 0, quotesTotal: row.evidence.quotesTotal ?? 0 } : null,
    coverage: row.coverage ?? null,
    retrieval: row.retrieval ? { candidates: row.retrieval.candidates ?? 0, used: row.retrieval.used ?? 0, flaggedSuspicious: row.retrieval.flaggedSuspicious ?? 0, droppedStale: row.retrieval.droppedStale ?? 0, redactions: row.retrieval.redactions ?? 0 } : null,
    model: row.model ?? null, promptVersion: row.promptVersion ?? null, usage: { inputTokens: row.usage?.inputTokens ?? 0, outputTokens: row.usage?.outputTokens ?? 0, estimatedCostMinor: cost ?? null },
    latencyMs: row.latencyMs ?? null, errorCode: row.errorCode ?? null, feedback: row.feedback ? { rating: row.feedback.rating, reason: row.feedback.reason ?? null } : null,
    sourcesChanged: citations.some((c) => c.sourceStatus === "UPDATED"),
  };
}
export type InteractionDto = Awaited<ReturnType<typeof buildInteractionDto>>;
