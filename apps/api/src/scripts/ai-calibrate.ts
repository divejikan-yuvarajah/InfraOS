import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { assertDemoSeedEnvironment, seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";
import { aiConfig } from "../modules/ai/ai.config.js";
import { aiClient } from "../modules/ai/ai-client.js";
import { recommendMinScore } from "../modules/ai/rag/calibrate.js";
import { Document } from "../modules/documents/models/document.model.js";

/**
 * Retrieval calibration over the synthetic demo corpus: runs a small labelled question set through the real search and prints the score
 * distribution of answerable vs unanswerable questions plus a recommended RAG_MIN_SCORE. Never writes env. SKIPPED (not faked) without a live setup.
 * The labelled set is small and synthetic: treat the number as a starting point, not a guarantee.
 */
const ANSWERABLE = [
  "What is the contract price?", "What are the liquidated damages for delay?", "How long is the defects liability period?", "What percentage is retained from each payment?",
  "Within how many days must invoices be paid?", "Which inspection finding is rated HIGH?", "What caused the delay of the pier construction?", "When will the A9 access road be closed for resurfacing?",
  "What is the performance security?", "When is the re-inspection scheduled?",
];
const UNANSWERABLE = [
  "What is the contractor's insurance cover amount?", "Who is the Minister of Transport?", "What is the weather forecast for Colombo?", "What is the contractor's bank account number?",
  "How many employees does the Employer have?", "What is the price of steel per tonne today?",
];

async function main(): Promise<void> {
  assertDemoSeedEnvironment(seedEnvFromProcess(env));
  if (!aiConfig.configured) { console.log("SKIPPED: AI_BASE_URL / AI_INTERNAL_SECRET are not configured."); return; }
  const ai = aiClient();
  if (!(await ai.health())) { console.log("SKIPPED: the AI service is not reachable."); return; }
  await connectDatabase(env);
  try {
    const docs = await Document.find({ docNo: /^DOC-2026-9000\d\d$/, extractedTextStatus: "COMPLETED", status: "ACTIVE" }).select("_id").lean();
    if (!docs.length) { console.log("SKIPPED: no AI-ready demo documents. Run `npm run db:seed:demo` then `npm run ai:demo-process`."); return; }
    const allowed = docs.map((d) => String(d._id));
    const best = async (q: string): Promise<number> => {
      const r = await ai.search({ query: q, allowedDocumentIds: allowed, topK: 10 });
      return r.hits.length ? Math.max(...r.hits.map((h) => h.score)) : 0;
    };
    const a: number[] = []; const u: number[] = [];
    console.log(`INFRAOS retrieval calibration over ${allowed.length} demo documents`);
    for (const q of ANSWERABLE) { const s = await best(q); a.push(s); console.log(`answerable    ${s.toFixed(3)}  ${q}`); }
    for (const q of UNANSWERABLE) { const s = await best(q); u.push(s); console.log(`unanswerable  ${s.toFixed(3)}  ${q}`); }
    const rec = recommendMinScore(a, u);
    console.log(`answerable min=${rec.answerableMin?.toFixed(3)}  unanswerable max=${rec.unanswerableMax?.toFixed(3)}  separable=${rec.separable}`);
    console.log(`Recommended RAG_MIN_SCORE=${rec.recommended ?? "n/a"}  (${rec.note}). Configured now: ${aiConfig.rag.minScore}. Not written anywhere.`);
  } finally { await disconnectDatabase(); }
}

main().catch((error: unknown) => { console.error("INFRAOS retrieval calibration: FAIL"); console.error(error instanceof Error ? error.name : "failed"); process.exitCode = 1; });
