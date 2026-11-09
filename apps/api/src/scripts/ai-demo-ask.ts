import { DEMO_QUESTIONS } from "../database/seeds/demo/demo-ai-corpus.js";

/** Prints the demo-day question list with the behaviour to expect (static; no AI cost, no database). */
console.log("INFRAOS AI demo questions (synthetic corpus: DOC-2026-900027 .. 900031)\n");
DEMO_QUESTIONS.forEach((d, i) => { console.log(`${i + 1}. ${d.q}\n   expect: ${d.expect}\n`); });
console.log("Summaries: Contract summary on the contract (map-reduce is exercised by larger documents). Extraction: Contract key terms on the contract, then review and apply.");
