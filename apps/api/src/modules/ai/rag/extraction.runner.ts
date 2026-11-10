import { AI_PROMPT_VERSIONS, extractionTemplate, type EvidenceStrength } from "@infraos/shared-types";

import { Document } from "../../documents/models/document.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiClient } from "../ai-client.js";
import { chatBudgetState } from "../processing/budget.js";
import { AiUsageRecord } from "../usage.model.js";
import { recordGate } from "../governance/ai-gate.js";
import { ArtifactError, Stop, beat, type RunnerDeps } from "./artifact-runner.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import { WARNING_FROM, checkCitations, citationOf, costOf, estimateTokens, evidenceOf, loadSources, pruneArtifacts, type CheckedCitation, type SourceChunk } from "./artifact.common.js";
import { normaliseForMatch, sanitiseModelText } from "./text.js";
import { normaliseValue, type TypedValue } from "./values.js";

const WHOLE_DOCUMENT_CHUNKS = 12;
const MAX_SOURCES = 24;

export type ValueOut = { rawText: string; typed: TypedValue | null; strength: EvidenceStrength; citationNs: number[]; readings?: string[] };
export type FieldOut = { key: string; type: string; repeats: boolean; status: "FOUND" | "NOT_FOUND" | "AMBIGUOUS"; reason: string | null; values: ValueOut[] };

const contains = (haystack: string, needle: string): boolean => normaliseForMatch(haystack).includes(normaliseForMatch(needle));

export async function runExtraction(a: AiArtifactDocument, workerId: string, deps: RunnerDeps = {}): Promise<void> {
  const client = deps.client ?? aiClient();
  const own = { _id: a._id, status: "RUNNING", lockedBy: workerId };
  const tpl = extractionTemplate(a.template);
  if (!tpl) throw new ArtifactError("AI_INVALID_OUTPUT");

  const doc = await Document.findById(a.documentId).select("title category currentVersionNo extractedTextStatus aiIndex status aiProcessingAllowed deletedAt").lean();
  const live = doc && !doc.deletedAt && doc.status === "ACTIVE" && doc.aiProcessingAllowed !== false && doc.extractedTextStatus === "COMPLETED" && doc.currentVersionNo === a.versionNo && doc.aiIndex?.indexedVersionNo === a.versionNo;
  if (!live || !doc) { await AiArtifact.updateOne(own, { $set: { status: "STALE" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } }); return; }

  const src = await loadSources(a.documentId, a.versionNo, { title: doc.title ?? "", category: doc.category ?? "OTHER" });
  if (!src.chunks.length) throw new ArtifactError("SCOPE_EMPTY");
  const byN = new Map(src.chunks.map((c) => [c.n, c]));
  const byChunkId = new Map(src.chunks.map((c) => [c.chunkId, c]));

  // ---- which passages the model sees: the whole document when it is short, otherwise retrieval per field under a single-document allow-list
  let sources: SourceChunk[];
  if (src.chunks.length <= WHOLE_DOCUMENT_CHUNKS) sources = src.chunks;
  else {
    const wanted = new Set<number>();
    for (const f of tpl.fields) {
      await beat(a._id, workerId);
      const res = await client.search({ query: f.query, allowedDocumentIds: [String(a.documentId)], topK: 4 });
      for (const h of res.hits) { const c = byChunkId.get(h.chunkId); if (c && h.versionNo === a.versionNo) wanted.add(c.n); }
    }
    sources = [...wanted].sort((x, y) => x - y).slice(0, MAX_SOURCES).map((n) => byN.get(n)!);
    if (!sources.length) sources = src.chunks.slice(0, WHOLE_DOCUMENT_CHUNKS);
  }
  const estimate = estimateTokens(sources.reduce((n, c) => n + c.text.length, 0)) + 1500;
  if ((await chatBudgetState(new Date(), estimate)).exceeded) throw new ArtifactError("AI_BUDGET_EXCEEDED");

  await beat(a._id, workerId);
  await AiArtifact.updateOne(own, { $set: { "progress.phase": "EXTRACT", "progress.total": 1, "progress.done": 0 } });
  const res = await client.llmExtract({
    language: a.language, template: a.template, fields: tpl.fields.map((f) => ({ key: f.key, type: f.type, repeats: Boolean(f.repeats) })),
    sources: sources.map((c) => ({ n: c.n, title: c.title, category: c.category, text: c.text })), maxOutputTokens: 1800, strong: Boolean(tpl.useStrongModel),
  });
  const usage = { inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens };
  await recordGate({
    actor: { userId: String(a.requestedBy), agencyId: String(a.agencyId) },
    agencyId: String(a.agencyId),
    feature: "extraction",
    tier: Boolean(tpl.useStrongModel) ? "STRONG" : "LOW",
    model: res.model,
    actual: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costMinor: costOf(usage.inputTokens, usage.outputTokens),
      status: "OK",
      purpose: "EXTRACTION",
      documentId: String(a.documentId),
      jobId: String(a._id),
    },
  }).catch(() => undefined);

  // ---- verification + deterministic normalisation. The model's text is never trusted as a value unless it sits inside a verified quote.
  const reported = new Map(res.output.fields.map((f) => [f.key, f]));
  let quotesTotal = 0; let quotesVerified = 0; let dropped = 0;
  const bestQuote = new Map<number, CheckedCitation>();
  const fields: FieldOut[] = tpl.fields.map((def) => {
    const base = { key: def.key, type: def.type, repeats: Boolean(def.repeats) };
    const got = reported.get(def.key);
    if (!got || got.status === "NOT_FOUND" || !got.values.length) return { ...base, status: "NOT_FOUND" as const, reason: "MODEL_NOT_FOUND", values: [] };
    const values: ValueOut[] = [];
    let reason: string | null = null;
    for (const v of got.values) {
      const raw = sanitiseModelText(v.rawText);
      const { checked, total, verified } = checkCitations(v.citations, byN);
      quotesTotal += total; quotesVerified += verified;
      for (const c of checked) if (c.verified && !bestQuote.get(c.n)?.verified) bestQuote.set(c.n, c);
      const ns = [...new Set(checked.map((c) => c.n))].sort((x, y) => x - y);
      const inVerifiedQuote = Boolean(raw) && checked.some((c) => c.verified && c.quote && contains(c.quote, raw));
      const inCitedChunk = Boolean(raw) && ns.some((n) => contains(byN.get(n)!.text, raw));
      if (!raw || (!inVerifiedQuote && !inCitedChunk)) { dropped += 1; reason = reason ?? "VALUE_NOT_IN_SOURCE"; continue; }
      const norm = normaliseValue(def.type, raw);
      if (!inVerifiedQuote) reason = reason ?? "QUOTE_NOT_VERIFIED";
      if (norm.ambiguous) reason = reason ?? "AMBIGUOUS_DATE";
      if (!norm.typed) reason = reason ?? (norm.ambiguous ? "AMBIGUOUS_DATE" : "NOT_NORMALISED");
      values.push({ rawText: raw, typed: norm.typed, strength: inVerifiedQuote ? "STRONG" : "WEAK", citationNs: ns, ...(norm.readings ? { readings: norm.readings } : {}) });
    }
    if (!values.length) return { ...base, status: "NOT_FOUND" as const, reason, values: [] };
    const conflicting = !def.repeats && new Set(values.map((v) => normaliseForMatch(v.rawText).toLowerCase())).size > 1;
    if (conflicting) reason = "CONFLICTING_VALUES";
    const strongAll = values.every((v) => v.strength === "STRONG" && (v.typed !== null || def.type === "STRING"));
    const status = got.status === "AMBIGUOUS" || conflicting || !strongAll ? ("AMBIGUOUS" as const) : ("FOUND" as const);
    return { ...base, status, reason: status === "FOUND" ? null : reason ?? (got.status === "AMBIGUOUS" ? "CONFLICTING_VALUES" : null), values: def.repeats ? values : conflicting ? values : values.slice(0, 1) };
  });

  const citedNs = [...new Set(fields.flatMap((f) => f.values.flatMap((v) => v.citationNs)))].sort((x, y) => x - y);
  const citations = citedNs.map((n) => citationOf(n, byN, bestQuote.get(n))!).map((c) => ({ n: c.n, chunkId: c.chunkId, ...(c.pageStart !== null ? { pageStart: c.pageStart } : {}), ...(c.pageEnd !== null ? { pageEnd: c.pageEnd } : {}), ...(c.section ? { section: c.section } : {}), ...(c.quote ? { quote: c.quote } : {}), quoteVerified: c.quoteVerified }));
  const hasItems = fields.some((f) => f.values.length > 0);
  const evidence = evidenceOf({ quotesTotal, quotesVerified, dropped, unverified: [], everyCitedHasQuote: citations.every((c) => c.quoteVerified), hasItems });

  const done = await AiArtifact.updateOne(own, {
    $set: {
      status: "READY", result: { fields }, citations, evidence, model: res.model, promptVersion: AI_PROMPT_VERSIONS.extract,
      usage: { ...usage, ...(costOf(usage.inputTokens, usage.outputTokens) !== undefined ? { estimatedCostMinor: costOf(usage.inputTokens, usage.outputTokens)! } : {}) },
      "progress.phase": "EXTRACT", "progress.done": 1, "progress.total": 1, review: { status: "IN_REVIEW" },
      warnings: WARNING_FROM(src.flagged, src.redactions, false, false, dropped > 0),
      coverage: { chunksUsed: sources.length, chunksTotal: src.total, truncated: sources.length < src.chunks.length },
    },
    $unset: { lockedBy: 1, leaseUntil: 1, errorCode: 1 }, $inc: { version: 1 },
  });
  if (done.matchedCount !== 1) throw new Stop();
  await pruneArtifacts(a);
  await writeAiAudit(undefined, { action: "ai.extraction_requested", resourceId: a.documentId, agencyId: a.agencyId, actorUserId: String(a.requestedBy), status: "COMPLETED", reason: a.template }).catch(() => undefined);
}
