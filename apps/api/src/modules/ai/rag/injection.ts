/**
 * Heuristic prompt-injection screen over retrieved text (English patterns only). Flagged chunks are excluded from the model context and counted.
 * This is one layer among several (random delimiters, no tools, schema validation, grounding verification). It is not a guarantee.
 * Sinhala/Tamil injection phrases are deliberately NOT included: their translations could not be verified (see the Batch 10 report).
 */
const PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules|messages?)/i,
  /\bdisregard\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:previous|prior|above|earlier|preceding|instructions?|rules)/i,
  /\bforget\s+(?:all\s+|everything\s+)(?:you|above|previous)/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+now\b/i,
  /\b(?:new|updated|override)\s+instructions?\s*:/i,
  /<\/?\s*(?:system|assistant|user|instructions?)\s*>/i,
  /\[\/?\s*(?:INST|SYSTEM)\s*\]/i,
  /^\s*(?:system|assistant)\s*:/im,
  /\b(?:ai|assistant|language\s+model|llm|chatbot|the\s+model)\b[\s,:;-]+(?:you\s+(?:must|should|will|have\s+to)|please\s+(?:ignore|reveal|output|say)|do\s+not\s+(?:cite|mention|follow)|ignore|always\s+(?:answer|say|respond))/i,
  /\b(?:reveal|print|show|repeat|output)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions)/i,
  /\banswer\s+only\s+with\b/i,
  /[A-Za-z0-9+/]{240,}={0,2}/,
  /<<<\s*(?:SOURCE|END)/i,
];

export function looksLikeInjection(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
