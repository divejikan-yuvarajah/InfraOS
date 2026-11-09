import { tokenize } from "./text.js";

/** Hybrid rerank weights live here, in one place (reported for owner approval). */
export const RERANK = { dense: 0.7, lexical: 0.3, exactBonus: 0.05, bm25K1: 1.2, bm25B: 0.75 } as const;

export type Candidate = { chunkId: string; documentId: string; chunkIndex: number; dense: number; text: string };
export type Ranked<T extends Candidate> = T & { lexical: number; finalScore: number };

/** BM25-lite over the candidate set (idf from the candidates themselves; no extra index). Returns scores normalised to 0..1. */
export function lexicalScores(query: string, texts: string[]): number[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !texts.length) return texts.map(() => 0);
  const docs = texts.map((t) => tokenize(t));
  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const raw = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of q) {
      const f = tf.get(term) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
      score += idf * ((f * (RERANK.bm25K1 + 1)) / (f + RERANK.bm25K1 * (1 - RERANK.bm25B + RERANK.bm25B * (d.length / avg))));
    }
    return score;
  });
  const max = Math.max(...raw);
  return raw.map((s) => (max > 0 ? s / max : 0));
}

/** Query tokens that carry a digit (clause numbers, amounts, years): an exact hit earns a small bonus. */
export function exactTokens(query: string): string[] {
  return [...new Set(tokenize(query).filter((t) => /\d/.test(t)))];
}

export function rerank<T extends Candidate>(query: string, items: T[], opts: { perDocCap?: number } = {}): Ranked<T>[] {
  if (!items.length) return [];
  const lex = lexicalScores(query, items.map((i) => i.text));
  const dense = items.map((i) => i.dense);
  const lo = Math.min(...dense);
  const hi = Math.max(...dense);
  const exact = exactTokens(query);
  const ranked = items.map((item, i) => {
    const denseNorm = hi > lo ? (dense[i]! - lo) / (hi - lo) : 1;
    const toks = new Set(tokenize(item.text));
    const bonus = exact.length && exact.some((t) => toks.has(t)) ? RERANK.exactBonus : 0;
    return { ...item, lexical: lex[i]!, finalScore: RERANK.dense * denseNorm + RERANK.lexical * lex[i]! + bonus };
  });
  // Deterministic: ties broken by dense score, then document id, then chunk position.
  ranked.sort((a, b) => b.finalScore - a.finalScore || b.dense - a.dense || a.documentId.localeCompare(b.documentId) || a.chunkIndex - b.chunkIndex);
  if (!opts.perDocCap) return ranked;
  const perDoc = new Map<string, number>();
  return ranked.filter((r) => {
    const n = perDoc.get(r.documentId) ?? 0;
    perDoc.set(r.documentId, n + 1);
    return n < opts.perDocCap!;
  });
}
