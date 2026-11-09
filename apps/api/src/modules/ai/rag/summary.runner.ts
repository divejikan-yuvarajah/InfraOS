import mongoose from "mongoose";
import { AI_PROMPT_VERSIONS, summaryTemplate } from "@infraos/shared-types";

import { Document } from "../../documents/models/document.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiConfig } from "../ai.config.js";
import { aiClient } from "../ai-client.js";
import type { LlmNote, SummarySection } from "../ai.contracts.js";
import { chatBudgetState } from "../processing/budget.js";
import { AiUsageRecord } from "../usage.model.js";
import { ArtifactError, Stop, beat, type RunnerDeps } from "./artifact-runner.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import {
  NOTE_MAX, WARNING_FROM, checkCitations, citationOf, costOf, estimateTokens, evidenceOf, leadQuote, loadSources, pruneArtifacts, unverifiedFiguresOf, windowsOf, type CheckedCitation, type SourceChunk,
} from "./artifact.common.js";
import { parseDate } from "./values.js";
import { sanitiseModelText } from "./text.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
const REDUCE_BATCH = 150;
const MAX_NOTES_FOR_FINAL = 400;

type Usage = { inputTokens: number; outputTokens: number };

/** Notes whose citations all failed quote verification are dropped; surviving citations keep the verified quote (or an empty one = chunk-level only). */
function cleanNotes(notes: LlmNote[], byN: Map<number, SourceChunk>): LlmNote[] {
  const out: LlmNote[] = [];
  for (const n of notes) {
    const { checked } = checkCitations(n.citations, byN);
    if (!checked.length || !n.text.trim()) continue;
    out.push({ text: n.text.slice(0, NOTE_MAX), citations: checked.map((c) => ({ n: c.n, quote: c.quote ?? "" })) });
  }
  return out;
}

/** A source chunk as notes without any model call (used for short documents so a summary is one LLM call). The quote is a verbatim lead of the piece. */
export function chunkAsNotes(chunks: SourceChunk[]): LlmNote[] {
  const notes: LlmNote[] = [];
  for (const c of chunks) {
    for (let i = 0; i < c.text.length; i += NOTE_MAX) {
      const piece = c.text.slice(i, i + NOTE_MAX).trim();
      if (piece) notes.push({ text: piece, citations: [{ n: c.n, quote: leadQuote(piece) }] });
    }
  }
  return notes;
}

export async function runSummary(a: AiArtifactDocument, workerId: string, deps: RunnerDeps = {}): Promise<void> {
  const maxFinalNotes = deps.maxFinalNotes ?? MAX_NOTES_FOR_FINAL;
  const client = deps.client ?? aiClient();
  const cfg = aiConfig;
  const own = { _id: a._id, status: "RUNNING", lockedBy: workerId };
  const tpl = summaryTemplate(a.template);
  if (!tpl) throw new ArtifactError("AI_INVALID_OUTPUT");

  const doc = await Document.findById(a.documentId).select("title category currentVersionNo extractedTextStatus aiIndex status aiProcessingAllowed deletedAt").lean();
  const live = doc && !doc.deletedAt && doc.status === "ACTIVE" && doc.aiProcessingAllowed !== false && doc.extractedTextStatus === "COMPLETED" && doc.currentVersionNo === a.versionNo && doc.aiIndex?.indexedVersionNo === a.versionNo;
  if (!live || !doc) { await AiArtifact.updateOne(own, { $set: { status: "STALE" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } }); return; }

  const src = await loadSources(a.documentId, a.versionNo, { title: doc.title ?? "", category: doc.category ?? "OTHER" });
  if (!src.chunks.length) throw new ArtifactError("SCOPE_EMPTY");
  const byN = new Map(src.chunks.map((c) => [c.n, c]));
  const totalChars = src.chunks.reduce((n, c) => n + c.text.length, 0);
  const wins = windowsOf(src.chunks);

  // caps and budget BEFORE any spend: never silently partial
  const estimate = estimateTokens(totalChars) + wins.length * 600;
  if (estimateTokens(totalChars) > cfg.chat.summaryMaxInputTokens) throw new ArtifactError("AI_TOO_LARGE");
  if ((await chatBudgetState(new Date(), estimate)).exceeded) throw new ArtifactError("AI_BUDGET_EXCEEDED");

  const usage: Usage = { inputTokens: a.usage?.inputTokens ?? 0, outputTokens: a.usage?.outputTokens ?? 0 };
  let model = a.model ?? cfg.chat.model ?? "";
  const record = async (purpose: "SUMMARY_MAP" | "SUMMARY_REDUCE", u: Usage, m: string): Promise<void> => {
    usage.inputTokens += u.inputTokens; usage.outputTokens += u.outputTokens; model = m;
    await AiUsageRecord.create({ kind: "CHAT", purpose, agencyId: a.agencyId, userId: a.requestedBy, documentId: a.documentId, provider: "openrouter", model: m, inputTokens: u.inputTokens, outputTokens: u.outputTokens, status: "OK", ...(costOf(u.inputTokens, u.outputTokens) !== undefined ? { estimatedCostMinor: costOf(u.inputTokens, u.outputTokens)! } : {}) }).catch(() => undefined);
  };

  // ---- MAP (resumable: finished windows are never repeated)
  let notes: LlmNote[];
  if (wins.length <= 1) {
    notes = chunkAsNotes(src.chunks); // a short document needs a single model call
  } else {
    const done = (a.progress?.mapResults ?? []) as { i: number; notes: LlmNote[] }[];
    const results = new Map(done.map((d) => [d.i, d.notes]));
    await AiArtifact.updateOne(own, { $set: { "progress.phase": "MAP", "progress.total": wins.length, "progress.done": results.size } });
    for (const [i, win] of wins.entries()) {
      if (results.has(i)) continue;
      await beat(a._id, workerId);
      if ((await chatBudgetState(new Date())).exceeded) throw new ArtifactError("AI_BUDGET_EXCEEDED");
      const res = await client.summarizeMap({ language: a.language, template: a.template, windowIndex: i, windowCount: wins.length, sources: win.map((c) => ({ n: c.n, title: c.title, category: c.category, text: c.text })), maxOutputTokens: 900 });
      await record("SUMMARY_MAP", res.usage, res.model);
      const cleaned = cleanNotes(res.output.notes, byN);
      results.set(i, cleaned);
      const w = await AiArtifact.updateOne(own, { $push: { "progress.mapResults": { i, notes: cleaned } }, $set: { "progress.done": results.size, usage, model } });
      if (w.matchedCount !== 1) throw new Stop();
    }
    notes = [...results.entries()].sort((x, y) => x[0] - y[0]).flatMap(([, v]) => v);
  }
  if (!notes.length) throw new ArtifactError("AI_INVALID_OUTPUT");

  // ---- hierarchical REDUCE (at most two notes-rounds), then truncate honestly if still too large
  let truncated = false;
  await AiArtifact.updateOne(own, { $set: { "progress.phase": "REDUCE" } });
  for (let round = 0; round < 2 && notes.length > maxFinalNotes; round++) {
    const merged: LlmNote[] = [];
    for (let i = 0; i < notes.length; i += REDUCE_BATCH) {
      await beat(a._id, workerId);
      const res = await client.summarizeReduce({ language: a.language, template: a.template, mode: "notes", sectionKeys: [], notes: notes.slice(i, i + REDUCE_BATCH), maxOutputTokens: 1400 });
      await record("SUMMARY_REDUCE", res.usage, res.model);
      merged.push(...cleanNotes(res.output.notes ?? [], byN));
    }
    notes = merged;
  }
  if (notes.length > maxFinalNotes) { notes = notes.slice(0, maxFinalNotes); truncated = true; }

  // ---- FINAL reduce into the template sections
  await beat(a._id, workerId);
  const keys = tpl.sections.map((s) => s.key);
  const fin = await client.summarizeReduce({ language: a.language, template: a.template, mode: "final", sectionKeys: keys, notes, maxOutputTokens: tpl.maxOutputTokens, strong: Boolean(tpl.useStrongModel) });
  await record("SUMMARY_REDUCE", fin.usage, fin.model);

  // ---- verify every item: citations must be real sources, quotes verbatim, figures present in the cited text
  const reported = new Map((fin.output.sections ?? []).map((s: SummarySection) => [s.key, s]));
  let quotesTotal = 0; let quotesVerified = 0; let dropped = 0;
  const unverified: string[] = [];
  const bestQuote = new Map<number, CheckedCitation>();
  const sections = tpl.sections.map((def) => {
    const items = (reported.get(def.key)?.items ?? []).flatMap((it) => {
      const text = sanitiseModelText(it.text);
      const { checked, total, verified } = checkCitations(it.citations, byN);
      const ns = [...new Set(checked.map((c) => c.n))].sort((x, y) => x - y);
      if (!text || !ns.length) { dropped += 1; return []; }
      quotesTotal += total; quotesVerified += verified;
      for (const c of checked) if (c.verified && !bestQuote.get(c.n)?.verified) bestQuote.set(c.n, c);
      for (const f of unverifiedFiguresOf(text, ns, byN)) if (!unverified.includes(f)) unverified.push(f);
      const dateRaw = it.date && it.date.trim() ? sanitiseModelText(it.date) : null;
      const parsed = dateRaw ? parseDate(dateRaw) : null;
      return [{ text, date: dateRaw, dateIso: parsed?.kind === "DATE" ? parsed.iso : null, citationNs: ns }];
    });
    return { key: def.key, kind: def.kind, items: def.kind === "text" ? items.slice(0, 1) : items };
  });
  const citedNs = [...new Set(sections.flatMap((s) => s.items.flatMap((i) => i.citationNs)))].sort((x, y) => x - y);
  const citations = citedNs.map((n) => citationOf(n, byN, bestQuote.get(n))!).map((c) => ({ n: c.n, chunkId: c.chunkId, ...(c.pageStart !== null ? { pageStart: c.pageStart } : {}), ...(c.pageEnd !== null ? { pageEnd: c.pageEnd } : {}), ...(c.section ? { section: c.section } : {}), ...(c.quote ? { quote: c.quote } : {}), quoteVerified: c.quoteVerified }));
  const hasItems = sections.some((s) => s.items.length > 0);
  if (!hasItems) throw new ArtifactError("AI_INVALID_OUTPUT");
  const evidence = evidenceOf({ quotesTotal, quotesVerified, dropped, unverified, everyCitedHasQuote: citations.every((c) => c.quoteVerified), hasItems });

  const res = await AiArtifact.updateOne(own, {
    $set: {
      status: "READY", result: { sections }, citations, evidence, usage: { ...usage, ...(costOf(usage.inputTokens, usage.outputTokens) !== undefined ? { estimatedCostMinor: costOf(usage.inputTokens, usage.outputTokens)! } : {}) }, model, promptVersion: AI_PROMPT_VERSIONS.summaryReduce, "progress.phase": "REDUCE", "progress.done": wins.length || 1, "progress.total": wins.length || 1,
      warnings: WARNING_FROM(src.flagged, src.redactions, truncated, unverified.length > 0, dropped > 0),
      coverage: { ...(src.truncatedPages.from !== null ? { pagesFrom: src.truncatedPages.from } : {}), ...(src.truncatedPages.to !== null ? { pagesTo: src.truncatedPages.to } : {}), chunksUsed: truncated ? Math.min(src.chunks.length, notes.length) : src.chunks.length, chunksTotal: src.total, truncated },
    },
    $unset: { lockedBy: 1, leaseUntil: 1, errorCode: 1, "progress.mapResults": 1 }, $inc: { version: 1 },
  });
  if (res.matchedCount !== 1) throw new Stop();
  await pruneArtifacts(a);
  await writeAiAudit(undefined, { action: "ai.summary_completed", resourceId: a.documentId, agencyId: a.agencyId, actorUserId: String(a.requestedBy), status: "COMPLETED", reason: a.template }).catch(() => undefined);
}

export { oid };
