import type { AiEvidenceLevel } from "@infraos/shared-types";

import type { ModelAnswer } from "../ai.contracts.js";
import type { ContextChunk } from "./context.js";
import { normaliseForMatch, sanitiseModelText } from "./text.js";

/**
 * Grounding verification. Express never trusts model output: citations must reference chunks that were really sent, quotes must be a verbatim
 * (normalised) substring of the cited chunk, claims without a valid citation are removed, and numbers/dates must appear in the cited text.
 * The user-visible answer text is rebuilt here from the surviving claims (the model's own prose is not rendered).
 */
export const MAX_QUOTE = 240;
const MIN_QUOTE = 6;

export type VerifiedCitation = {
  n: number; chunkId: string; documentId: string; versionNo: number; pageStart: number | null; pageEnd: number | null; section: string | null;
  quote: string | null; quoteVerified: boolean; wasNeighbor: boolean;
};
export type Evidence = { level: AiEvidenceLevel; unverifiedFigures: string[]; droppedClaims: number; quotesVerified: number; quotesTotal: number };
export type GroundedClaim = { text: string; citationNs: number[]; supported: boolean };
export type GroundedAnswer = {
  status: "ANSWERED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE";
  text: string; claims: GroundedClaim[]; citations: VerifiedCitation[]; evidence: Evidence; missingInfo: string[];
};

/** A quote is verified only if it is a contiguous substring of the (already redacted) text the model actually saw. */
export function verifyQuote(quote: string, chunkText: string): boolean {
  const q = normaliseForMatch(quote);
  if (q.length < MIN_QUOTE || q.length > MAX_QUOTE) return false;
  return normaliseForMatch(chunkText).includes(q);
}

// ---------------------------------------------------------------- numeric / date grounding
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const FIGURE_PATTERNS: { kind: "money" | "percent" | "duration" | "date"; re: RegExp }[] = [
  { kind: "money", re: /(?:LKR|Rs\.?|USD|US\$|\$)\s?\d[\d,]*(?:\.\d+)?/gi },
  { kind: "percent", re: /\d+(?:\.\d+)?\s?(?:%|per\s?cent)/gi },
  { kind: "duration", re: /\b\d+\s?(?:calendar\s+|working\s+)?(?:days?|weeks?|months?|years?)\b/gi },
  { kind: "date", re: /\b\d{4}-\d{2}-\d{2}\b/g },
  { kind: "date", re: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
  { kind: "date", re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?,?\\s+\\d{4}\\b`, "gi") },
  { kind: "date", re: new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "gi") },
];

export function extractFigures(text: string): { kind: string; raw: string }[] {
  const out: { kind: string; raw: string }[] = [];
  const seen = new Set<string>();
  for (const { kind, re } of FIGURE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const key = `${kind}:${m[0].toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); out.push({ kind, raw: m[0].trim() }); }
    }
  }
  return out;
}

const digitsOf = (s: string) => s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, "");
const flat = (s: string) => digitsOf(normaliseForMatch(s)).toLowerCase().replace(/(\d)(?:st|nd|rd|th)\b/g, "$1").replace(/[.,]/g, (m, o, str) => (/\d/.test(str[o - 1] ?? "") && /\d/.test(str[o + 1] ?? "") ? m : " ")).replace(/\s+/g, " ");

/** True when the figure is present in the haystack, ignoring thousands separators, ordinal suffixes and spacing. */
export function figureAppearsIn(figure: { kind: string; raw: string }, haystack: string): boolean {
  const hay = flat(haystack);
  const raw = flat(figure.raw);
  if (hay.includes(raw)) return true;
  const num = /\d[\d.]*/.exec(raw)?.[0];
  if (!num) return false;
  const numRe = new RegExp(`(?<![\\d.])${num.replace(/\./g, "\\.")}(?![\\d])`);
  if (figure.kind === "money") return numRe.test(hay);
  if (figure.kind === "percent") return new RegExp(`${numRe.source}\\s?(?:%|per\\s?cent|percent)`).test(hay);
  if (figure.kind === "duration") { const unit = /[a-z]+$/.exec(raw)?.[0]?.replace(/s$/, "") ?? ""; return new RegExp(`${numRe.source}\\s?(?:calendar\\s+|working\\s+)?${unit}`).test(hay); }
  return false;
}

// ---------------------------------------------------------------- main
export function verifyAnswer(output: ModelAnswer, chunks: ContextChunk[]): GroundedAnswer {
  const byN = new Map(chunks.map((c) => [c.n, c]));
  const missingInfo = output.missing_info.map((m) => sanitiseModelText(m).slice(0, 300)).filter(Boolean);
  const none = (): GroundedAnswer => ({ status: "INSUFFICIENT_EVIDENCE", text: "", claims: [], citations: [], missingInfo, evidence: { level: "NONE", unverifiedFigures: [], droppedClaims: 0, quotesVerified: 0, quotesTotal: 0 } });
  if (output.status === "INSUFFICIENT_EVIDENCE") return none(); // the model's refusal is never upgraded

  // 1-2. citations: valid source numbers only; quote verified against the chunk text
  const quotes = new Map<number, { quote: string; verified: boolean }[]>();
  let quotesTotal = 0;
  let quotesVerified = 0;
  const seenQuote = new Set<string>();
  for (const c of output.citations) {
    const chunk = byN.get(c.n);
    if (!chunk) continue;
    const key = `${c.n}|${normaliseForMatch(c.quote)}`;
    if (seenQuote.has(key)) continue;
    seenQuote.add(key);
    quotesTotal += 1;
    const verified = verifyQuote(c.quote, chunk.text);
    if (verified) quotesVerified += 1;
    quotes.set(c.n, [...(quotes.get(c.n) ?? []), { quote: normaliseForMatch(c.quote), verified }]);
  }

  // 3. claims: keep only those with at least one valid citation
  const claims: GroundedClaim[] = [];
  let dropped = 0;
  for (const claim of output.claims) {
    const text = sanitiseModelText(claim.text);
    const ns = [...new Set(claim.citations.filter((n) => byN.has(n)))].sort((a, b) => a - b);
    if (!text || ns.length === 0) { dropped += 1; continue; }
    claims.push({ text, citationNs: ns, supported: true });
  }
  if (claims.length === 0) return { ...none(), evidence: { level: "NONE", unverifiedFigures: [], droppedClaims: dropped, quotesVerified, quotesTotal } };

  // 4. numeric/date grounding per claim against the cited chunks
  const unverified: string[] = [];
  for (const claim of claims) {
    const hay = claim.citationNs.map((n) => byN.get(n)!.text).join("\n");
    for (const fig of extractFigures(claim.text)) if (!figureAppearsIn(fig, hay) && !unverified.includes(fig.raw)) unverified.push(fig.raw);
  }

  // citations shown to the user: one per cited source, preferring a verified quote
  const citedNs = [...new Set(claims.flatMap((c) => c.citationNs))].sort((a, b) => a - b);
  const citations: VerifiedCitation[] = citedNs.map((n) => {
    const chunk = byN.get(n)!;
    const best = (quotes.get(n) ?? []).find((q) => q.verified);
    return {
      n, chunkId: chunk.chunkId, documentId: chunk.documentId, versionNo: chunk.versionNo, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd, section: chunk.section,
      quote: best ? best.quote : null, quoteVerified: Boolean(best), wasNeighbor: chunk.wasNeighbor,
    };
  });

  // 5-6. evidence level and final status
  const everyCitedHasQuote = citations.every((c) => c.quoteVerified);
  const clean = quotesTotal > 0 && quotesVerified === quotesTotal && everyCitedHasQuote && unverified.length === 0 && dropped === 0;
  const level: AiEvidenceLevel = clean ? "VERIFIED" : "PARTIAL";
  const status = clean && output.status === "ANSWERED" ? "ANSWERED" : "PARTIAL";

  // server-built text with inline markers
  const text = claims.map((c) => `${c.text} ${c.citationNs.map((n) => `[${n}]`).join("")}`).join("\n");
  return { status, text, claims, citations, missingInfo, evidence: { level, unverifiedFigures: unverified, droppedClaims: dropped, quotesVerified, quotesTotal } };
}
