import mongoose from "mongoose";
import type { AiArtifactWarning } from "@infraos/shared-types";

import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { aiConfig } from "../ai.config.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import type { ContextChunk } from "./context.js";
import { MAX_QUOTE, extractFigures, figureAppearsIn, verifyQuote, type Evidence, type VerifiedCitation } from "./grounding.js";
import { looksLikeInjection } from "./injection.js";
import { redactText } from "./redact.js";
import { normaliseForMatch } from "./text.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
export const KEEP_ARTIFACTS = 3;
export const WORKER_LEASE_MS = 120_000;
export const NOTE_MAX = 1500;

/** One source for the model: n = chunkIndex + 1 (stable for the whole document version). `text` is the redacted text the model will see and verification runs against. */
export type SourceChunk = ContextChunk;

export type LoadedSources = { chunks: SourceChunk[]; flagged: number; redactions: number; total: number; truncatedPages: { from: number | null; to: number | null } };

/** All ACTIVE chunks of the artifact's version in reading order, injection-screened and redacted (config AI_REDACT_CONTEXT). */
export async function loadSources(documentId: mongoose.Types.ObjectId, versionNo: number, meta: { title: string; category: string }): Promise<LoadedSources> {
  const rows = await DocumentChunk.find({ documentId, versionNo, status: "ACTIVE" }).select("+content chunkId chunkIndex pageStart pageEnd section").sort({ chunkIndex: 1 }).lean();
  let flagged = 0;
  let redactions = 0;
  const chunks: SourceChunk[] = [];
  for (const r of rows) {
    const raw = (r as unknown as { content: string }).content ?? "";
    if (looksLikeInjection(raw)) { flagged += 1; continue; }
    const red = aiConfig.chat.redactContext ? redactText(raw) : { text: raw, count: 0 };
    redactions += red.count;
    chunks.push({
      n: r.chunkIndex + 1, chunkId: r.chunkId, documentId: String(documentId), versionNo, chunkIndex: r.chunkIndex, pageStart: r.pageStart ?? null, pageEnd: r.pageEnd ?? null, section: r.section ?? null,
      text: red.text, title: meta.title, category: meta.category, wasNeighbor: false,
    });
  }
  const pages = chunks.flatMap((c) => [c.pageStart, c.pageEnd]).filter((p): p is number => p !== null);
  return { chunks, flagged, redactions, total: rows.length, truncatedPages: { from: pages.length ? Math.min(...pages) : null, to: pages.length ? Math.max(...pages) : null } };
}

/** Consecutive chunks grouped into windows of about `maxChars` (a window always holds at least one chunk). */
export function windowsOf(chunks: SourceChunk[], maxChars = 6000): SourceChunk[][] {
  const out: SourceChunk[][] = [];
  let cur: SourceChunk[] = [];
  let size = 0;
  for (const c of chunks) {
    if (cur.length && size + c.text.length > maxChars) { out.push(cur); cur = []; size = 0; }
    cur.push(c);
    size += c.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** A deterministic verbatim quote: the leading words of a chunk (<= max chars, cut at a word boundary). Used to give un-summarised chunks a verifiable citation. */
export function leadQuote(text: string, max = 200): string {
  const t = normaliseForMatch(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return sp > max / 2 ? cut.slice(0, sp) : cut;
}

export type RawCitation = { n: number; quote: string };
export type CheckedCitation = { n: number; quote: string | null; verified: boolean };

/** Quote-level check of model citations against the chunk text the model saw. Unknown source numbers vanish; unverifiable quotes keep the chunk reference only. */
export function checkCitations(refs: RawCitation[], byN: Map<number, SourceChunk>): { checked: CheckedCitation[]; total: number; verified: number } {
  const seen = new Set<string>();
  const checked: CheckedCitation[] = [];
  let total = 0;
  let verified = 0;
  for (const r of refs) {
    const chunk = byN.get(r.n);
    if (!chunk) continue;
    const key = `${r.n}|${normaliseForMatch(r.quote)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total += 1;
    const ok = verifyQuote(r.quote, chunk.text);
    if (ok) verified += 1;
    checked.push({ n: r.n, quote: ok ? normaliseForMatch(r.quote).slice(0, MAX_QUOTE) : null, verified: ok });
  }
  return { checked, total, verified };
}

/** Figures in `text` that do not appear in any of the cited chunks. */
export function unverifiedFiguresOf(text: string, ns: number[], byN: Map<number, SourceChunk>): string[] {
  const hay = ns.map((n) => byN.get(n)?.text ?? "").join("\n");
  return extractFigures(text).filter((f) => !figureAppearsIn(f, hay)).map((f) => f.raw);
}

export function citationOf(n: number, byN: Map<number, SourceChunk>, best: CheckedCitation | undefined): VerifiedCitation | null {
  const c = byN.get(n);
  return c ? { n, chunkId: c.chunkId, documentId: c.documentId, versionNo: c.versionNo, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, quote: best?.verified ? best.quote : null, quoteVerified: Boolean(best?.verified), wasNeighbor: false } : null;
}

export function evidenceOf(input: { quotesTotal: number; quotesVerified: number; dropped: number; unverified: string[]; everyCitedHasQuote: boolean; hasItems: boolean }): Evidence {
  if (!input.hasItems) return { level: "NONE", unverifiedFigures: [], droppedClaims: input.dropped, quotesVerified: input.quotesVerified, quotesTotal: input.quotesTotal };
  const clean = input.quotesTotal > 0 && input.quotesVerified === input.quotesTotal && input.everyCitedHasQuote && input.unverified.length === 0 && input.dropped === 0;
  return { level: clean ? "VERIFIED" : "PARTIAL", unverifiedFigures: input.unverified, droppedClaims: input.dropped, quotesVerified: input.quotesVerified, quotesTotal: input.quotesTotal };
}

export const costOf = (inTok: number, outTok: number): number | undefined => {
  const { priceInputPerMMinor: pi, priceOutputPerMMinor: po } = aiConfig.chat;
  return pi !== undefined && po !== undefined ? Math.round((inTok * pi + outTok * po) / 1_000_000) : undefined;
};

export const estimateTokens = (chars: number): number => Math.ceil(chars / 4);

// ---------------------------------------------------------------- lifecycle helpers
/** Keeps the newest KEEP_ARTIFACTS non-active artifacts per cache key; older ones are deleted. */
export async function pruneArtifacts(a: Pick<AiArtifactDocument, "documentId" | "versionNo" | "kind" | "template" | "language">): Promise<void> {
  const old = await AiArtifact.find({ documentId: a.documentId, kind: a.kind, template: a.template, language: a.language, status: { $in: ["STALE", "FAILED"] } }).sort({ createdAt: -1 }).skip(KEEP_ARTIFACTS).select("_id").lean();
  if (old.length) await AiArtifact.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

/** New file version: older artifacts are stale (kept, labelled). Archive/delete/restrict/exclude: artifacts are removed (they contain summarised document text). */
export async function markArtifactsStale(documentId: string, belowVersion: number): Promise<number> {
  const r = await AiArtifact.updateMany({ documentId: oid(documentId), versionNo: { $lt: belowVersion }, status: { $in: ["QUEUED", "RUNNING", "READY"] } }, { $set: { status: "STALE" }, $unset: { lockedBy: 1, leaseUntil: 1 }, $inc: { version: 1 } });
  return r.modifiedCount;
}
export async function deleteArtifacts(documentId: string): Promise<number> {
  return (await AiArtifact.deleteMany({ documentId: oid(documentId) })).deletedCount;
}

export const WARNING_FROM = (flagged: number, redactions: number, truncated: boolean, unverified: boolean, removed: boolean): AiArtifactWarning[] => [
  ...(flagged ? (["FLAGGED_CONTENT_EXCLUDED"] as const) : []), ...(redactions ? (["REDACTED"] as const) : []), ...(truncated ? (["TRUNCATED"] as const) : []), ...(unverified ? (["UNVERIFIED_FIGURES"] as const) : []), ...(removed ? (["UNSUPPORTED_REMOVED"] as const) : []),
];
