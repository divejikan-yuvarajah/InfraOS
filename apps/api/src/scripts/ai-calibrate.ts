import { randomBytes } from "node:crypto";

import { AI_DEMO_BODIES, makePdfLines } from "../database/seeds/demo/demo-ai-corpus.js";
import { aiConfig } from "../modules/ai/ai.config.js";
import { aiClient } from "../modules/ai/ai-client.js";
import { recommendMinScore } from "../modules/ai/rag/calibrate.js";

/**
 * Retrieval calibration over the synthetic demo corpus. STANDALONE: it needs no database. The demo documents are pushed through the real
 * extract -> chunk -> embed -> index pipeline under throwaway ids, a labelled question set is scored with the real search, and everything is deleted again.
 * Prints the score distribution of answerable vs unanswerable questions and a recommended RAG_MIN_SCORE. Never writes env.
 * The labelled set is small and synthetic: treat the number as a starting point. SKIPPED (not faked) when the service is not live.
 */
const ANSWERABLE = [
  "What is the contract price?", "What are the liquidated damages for delay?", "How long is the defects liability period?", "What percentage is retained from each payment?",
  "Within how many days must invoices be paid?", "Which inspection finding is rated HIGH?", "What caused the delay of the pier construction?", "When will the A9 access road be closed for resurfacing?",
  "What is the performance security?", "When is the re-inspection scheduled?",
  "A9 මාර්ගය වසා දමන්නේ කවදාද?", "A9 சாலை எப்போது மூடப்படும்?",
];
const UNANSWERABLE = [
  "What is the contractor's insurance cover amount?", "Who is the Minister of Transport?", "What is the weather forecast for Colombo?", "What is the contractor's bank account number?",
  "How many employees does the Employer have?", "What is the price of steel per tonne today?",
];

async function main(): Promise<void> {
  if (!aiConfig.configured) { console.log("SKIPPED: AI_BASE_URL / AI_INTERNAL_SECRET are not configured."); return; }
  const ai = aiClient();
  if (!(await ai.health())) { console.log("SKIPPED: the AI service is not reachable."); return; }
  const ids: string[] = [];
  try {
    for (const body of Object.values(AI_DEMO_BODIES)) {
      const id = randomBytes(12).toString("hex");
      ids.push(id);
      const bytes = body.kind === "pdf" ? makePdfLines(body.text.split(String.fromCharCode(10))) : Buffer.from(body.text, "utf8");
      const ex = await ai.extractChunk({ documentId: id, versionNo: 1, mimeType: body.kind === "pdf" ? "application/pdf" : "text/plain", bytes });
      await ai.index({ documentId: id, versionNo: 1, projectId: null, agencyId: randomBytes(12).toString("hex"), category: "OTHER", chunks: ex.chunks.map((c) => ({ chunkId: c.chunkId, chunkIndex: c.chunkIndex, text: c.text, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, contentHash: c.contentHash })) });
    }
    const best = async (q: string): Promise<number> => {
      const r = await ai.search({ query: q, allowedDocumentIds: ids, topK: 10 });
      return r.hits.length ? Math.max(...r.hits.map((h) => h.score)) : 0;
    };
    const a: number[] = []; const u: number[] = [];
    console.log(`INFRAOS retrieval calibration over ${ids.length} synthetic demo documents (standalone)`);
    for (const q of ANSWERABLE) { const s = await best(q); a.push(s); console.log(`answerable    ${s.toFixed(3)}  ${q}`); }
    for (const q of UNANSWERABLE) { const s = await best(q); u.push(s); console.log(`unanswerable  ${s.toFixed(3)}  ${q}`); }
    const rec = recommendMinScore(a, u);
    console.log(`answerable min=${rec.answerableMin?.toFixed(3)}  unanswerable max=${rec.unanswerableMax?.toFixed(3)}  separable=${rec.separable}`);
    console.log(`Recommended RAG_MIN_SCORE=${rec.recommended ?? "n/a"}  (${rec.note}). Configured now: ${aiConfig.rag.minScore}. Not written anywhere.`);
  } finally {
    for (const id of ids) { try { await ai.deleteDocument(id); } catch { console.warn("cleanup: a throwaway document could not be deleted"); } }
  }
}

main().catch((error: unknown) => { console.error("INFRAOS retrieval calibration: FAIL"); console.error(error instanceof Error ? error.name : "failed"); process.exitCode = 1; });
