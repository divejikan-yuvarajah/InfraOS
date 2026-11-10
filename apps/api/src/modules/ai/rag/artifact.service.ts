import mongoose from "mongoose";
import { EXTRACTION_TEMPLATES, SUMMARY_TEMPLATES, extractionTemplate, summaryTemplate, suggestedExtractionTemplates, suggestedSummaryTemplates, type AiArtifactKind, type AiLanguage } from "@infraos/shared-types";

import { docContext, loadDocument, needPerm, type DCtx, type DocRow } from "../../documents/document.common.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiConfig } from "../ai.config.js";
import { chatBudgetState } from "../processing/budget.js";
import { checkGate } from "../governance/ai-gate.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import { estimateTokens } from "./artifact.common.js";
import { RagFlow } from "./http.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
type Actor = NonNullable<Express.Request["actor"]>;
const ACTIVE = ["QUEUED", "RUNNING", "READY"];

export function aiReadiness(doc: DocRow): { ready: boolean; reasonCode: string | null } {
  if ((doc.origin ?? "DOCTRACE") !== "DOCTRACE") return { ready: false, reasonCode: "NOT_DOCTRACE" };
  if (doc.status !== "ACTIVE") return { ready: false, reasonCode: "ARCHIVED" };
  if (doc.aiProcessingAllowed === false) return { ready: false, reasonCode: "EXCLUDED" };
  if (doc.extractedTextStatus !== "COMPLETED" || doc.aiIndex?.indexedVersionNo !== doc.currentVersionNo) return { ready: false, reasonCode: "NOT_AI_READY" };
  return { ready: true, reasonCode: null };
}

export function artifactDto(a: AiArtifactDocument, currentVersionNo: number | null, opts: { result?: boolean } = {}) {
  return {
    id: String(a._id), kind: a.kind, documentId: String(a.documentId), versionNo: a.versionNo, template: a.template, language: a.language, status: a.status,
    stale: a.status === "STALE" || (currentVersionNo !== null && a.versionNo !== currentVersionNo),
    progress: { phase: a.progress?.phase ?? null, done: a.progress?.done ?? 0, total: a.progress?.total ?? 0 },
    ...(opts.result ? { result: a.result ?? null, citations: (a.citations ?? []).map((c) => ({ n: c.n, chunkId: c.chunkId, pageStart: c.pageStart ?? null, pageEnd: c.pageEnd ?? null, section: c.section ?? null, quote: c.quote ?? null, quoteVerified: Boolean(c.quoteVerified) })) } : {}),
    evidence: a.evidence ?? null, coverage: a.coverage ?? null, warnings: [...(a.warnings ?? [])], model: a.model ?? null, promptVersion: a.promptVersion ?? null,
    usage: { inputTokens: a.usage?.inputTokens ?? 0, outputTokens: a.usage?.outputTokens ?? 0 }, errorCode: a.errorCode ?? null, attempt: a.attempt ?? 0,
    createdAt: a.createdAt.toISOString(), updatedAt: ((a as unknown as { updatedAt?: Date }).updatedAt ?? a.createdAt).toISOString(),
  };
}

const templateOf = (kind: AiArtifactKind, key: string): boolean => (kind === "SUMMARY" ? Boolean(summaryTemplate(key)) : Boolean(extractionTemplate(key)));

async function loadReadable(actor: Actor, rawId: string): Promise<{ d: DCtx; doc: DocRow }> {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const doc = await loadDocument(d, rawId); // out of scope = 404
  return { d, doc };
}

export async function listArtifacts(actor: Actor, rawId: string, kind: AiArtifactKind) {
  const { doc } = await loadReadable(actor, rawId);
  const ready = aiReadiness(doc);
  const rows = await AiArtifact.find({ documentId: doc._id, kind, status: { $in: ["QUEUED", "RUNNING", "READY", "FAILED", "STALE"] } }).sort({ createdAt: -1 }).limit(30);
  const category = doc.category ?? "OTHER";
  const suggested = new Set<string>(kind === "SUMMARY" ? suggestedSummaryTemplates(category) : suggestedExtractionTemplates(category));
  const templates = kind === "SUMMARY"
    ? SUMMARY_TEMPLATES.map((t) => ({ key: t.key, suggested: suggested.has(t.key), sections: t.sections.map((s) => ({ key: s.key, kind: s.kind })) }))
    : EXTRACTION_TEMPLATES.map((t) => ({ key: t.key, suggested: suggested.has(t.key), fields: t.fields.map((f) => ({ key: f.key, type: f.type, repeats: Boolean(f.repeats), metadata: f.metadata ?? null })) }));
  return { data: { ready: ready.ready, reasonCode: ready.reasonCode, currentVersionNo: doc.currentVersionNo ?? null, templates, artifacts: rows.map((r) => artifactDto(r, doc.currentVersionNo ?? null)) } };
}

export async function getArtifact(actor: Actor, rawId: string, artifactId: string, kind: AiArtifactKind) {
  const { doc } = await loadReadable(actor, rawId);
  if (!/^[a-f0-9]{24}$/.test(artifactId)) throw new RagFlow(404, "NOT_FOUND");
  const row = await AiArtifact.findOne({ _id: oid(artifactId), documentId: doc._id, kind });
  if (!row) throw new RagFlow(404, "NOT_FOUND");
  return { doc, row };
}

/** Creates (or returns the cached) artifact for (document, version, kind, template, language). Cache sharing is safe: access is re-authorised on every request. */
export async function requestArtifact(actor: Actor, rawId: string, input: { kind: AiArtifactKind; template: string; language: AiLanguage; regenerate?: boolean | undefined }, requestId: string) {
  const { doc } = await loadReadable(actor, rawId);
  if (!templateOf(input.kind, input.template)) throw new RagFlow(400, "VALIDATION_ERROR");
  if (!aiConfig.configured || !aiConfig.processingEnabled || !aiConfig.chat.model) throw new RagFlow(503, "AI_UNAVAILABLE", { reason: "NOT_CONFIGURED" });
  const ready = aiReadiness(doc);
  if (!ready.ready || !doc.currentVersionNo) throw new RagFlow(409, "NOT_AI_READY", { reason: ready.reasonCode });
  const versionNo = doc.currentVersionNo;
  const key = { documentId: doc._id, versionNo, kind: input.kind, template: input.template, language: input.language };

  const active = await AiArtifact.findOne({ ...key, status: { $in: ACTIVE } });
  if (active && !input.regenerate) return { status: active.status === "READY" ? 200 : 202, artifact: active, doc };
  if (active && active.status !== "READY") throw new RagFlow(409, "AI_ARTIFACT_ACTIVE", { artifactId: String(active._id) });

  // caps and budget are enforced BEFORE starting; a refusal is explicit, never a silent partial result
  const sum = await DocumentChunk.aggregate<{ t: number }>([{ $match: { documentId: doc._id, versionNo, status: "ACTIVE" } }, { $group: { _id: null, t: { $sum: "$tokenEstimate" } } }]);
  const tokens = sum[0]?.t ?? estimateTokens(0);
  if (tokens > aiConfig.chat.summaryMaxInputTokens) throw new RagFlow(422, "AI_TOO_LARGE", { estimatedTokens: tokens, limit: aiConfig.chat.summaryMaxInputTokens });
  
  const gate = await checkGate({
    actor,
    agencyId: String(doc.agencyId),
    feature: input.kind === "SUMMARY" ? "summary" : "extraction",
    estimate: { inputTokens: tokens, outputTokens: 1500 },
  });
  if (!gate.allow) {
    if (gate.deny.code === "AI_BUDGET_EXCEEDED") throw new RagFlow(429, "AI_BUDGET_EXCEEDED", { resetsAt: gate.deny.resetsAt?.toISOString() });
    if (gate.deny.code === "AI_RATE_LIMITED") throw new RagFlow(429, "AI_RATE_LIMITED", { retryAfterSeconds: gate.deny.retryAfterSeconds });
    throw new RagFlow(503, "AI_UNAVAILABLE", { reason: gate.deny.code });
  }

  if (active) await AiArtifact.updateOne({ _id: active._id, status: "READY" }, { $set: { status: "STALE" }, $inc: { version: 1 } });
  try {
    const row = await AiArtifact.create({ ...key, agencyId: doc.agencyId, status: "QUEUED", requestedBy: oid(actor.userId), nextAttemptAt: new Date(), attempt: 0, progress: { done: 0, total: 0, mapResults: [] } });
    await writeAiAudit(undefined, { action: input.kind === "SUMMARY" ? "ai.summary_requested" : "ai.extraction_requested", resourceId: doc._id, agencyId: String(doc.agencyId), actorUserId: actor.userId, status: "QUEUED", reason: input.template, requestId }).catch(() => undefined);
    return { status: 202, artifact: row, doc };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) { // a concurrent request created it first
      const existing = await AiArtifact.findOne({ ...key, status: { $in: ACTIVE } });
      if (existing) return { status: 202, artifact: existing, doc };
    }
    throw error;
  }
}
