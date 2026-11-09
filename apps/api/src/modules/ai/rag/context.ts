/** Context assembly: priority order = ranked chunks, then neighbours of the top few (to repair clause splits), capped by chunk count and characters. */
export type ChunkLite = {
  chunkId: string; documentId: string; versionNo: number; chunkIndex: number; pageStart: number | null; pageEnd: number | null; section: string | null;
  text: string; title: string; category: string;
};
export type ContextChunk = ChunkLite & { n: number; wasNeighbor: boolean };

export function assembleContext(input: { ranked: ChunkLite[]; neighbours: ChunkLite[]; maxChunks: number; maxChars: number }): ContextChunk[] {
  const chosen: { c: ChunkLite; neighbor: boolean }[] = [];
  const seen = new Set<string>();
  let chars = 0;
  const add = (c: ChunkLite, neighbor: boolean): void => {
    if (seen.has(c.chunkId)) return;
    if (chosen.length > 0 && chars + c.text.length > input.maxChars) return;
    seen.add(c.chunkId);
    chars += c.text.length;
    chosen.push({ c, neighbor });
  };
  for (const c of input.ranked.slice(0, input.maxChunks)) add(c, false);
  for (const c of input.neighbours) add(c, true);

  // Reading order: documents in order of their best-ranked chunk, then chunk position.
  const docOrder = new Map<string, number>();
  for (const { c } of chosen) if (!docOrder.has(c.documentId)) docOrder.set(c.documentId, docOrder.size);
  chosen.sort((a, b) => docOrder.get(a.c.documentId)! - docOrder.get(b.c.documentId)! || a.c.versionNo - b.c.versionNo || a.c.chunkIndex - b.c.chunkIndex);
  return chosen.map(({ c, neighbor }, i) => ({ ...c, n: i + 1, wasNeighbor: neighbor }));
}

/** Pairs (document, chunkIndex) to fetch as ±1 neighbours of the top `top` ranked chunks. */
export function neighbourKeys(ranked: ChunkLite[], top = 3): { documentId: string; versionNo: number; chunkIndex: number }[] {
  const out: { documentId: string; versionNo: number; chunkIndex: number }[] = [];
  for (const r of ranked.slice(0, top)) for (const d of [-1, 1]) if (r.chunkIndex + d >= 0) out.push({ documentId: r.documentId, versionNo: r.versionNo, chunkIndex: r.chunkIndex + d });
  return out;
}
