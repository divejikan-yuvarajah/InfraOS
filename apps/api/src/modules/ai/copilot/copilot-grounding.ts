import type {
  CopilotClaimDto,
  CopilotEvidenceSummaryDto,
  CopilotFact,
  CopilotSourceDto,
} from "@infraos/shared-types";
import { extractFigures, figureAppearsIn } from "../rag/grounding.js";

const FRAUD_DENYLIST = /\b(fraud|fraudulent|corrupt|corruption|bribe|bribery|theft|stolen|stole|criminal|embezzle|embezzlement|guilty|cheat|cheating|scam)\b/i;

export type ExecutedFactRef = {
  n: number;
  fact: CopilotFact;
  tool: string;
  link?: string;
};

export type GroundingInput = {
  rawAnswer?: string | null;
  rawClaims?: Array<{ text: string; sourceRefs?: number[] }>;
  rawMissingInfo?: string[];
  executedFacts: ExecutedFactRef[];
};

export type GroundedCopilotAnswer = {
  status: "ANSWERED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE";
  text: string;
  claims: CopilotClaimDto[];
  sources: CopilotSourceDto[];
  evidence: CopilotEvidenceSummaryDto;
  missingInfo: string[];
};

/**
 * Strips HTML, Markdown links, and scripts from generated text to prevent rendering attacks.
 */
function sanitizeClaimText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[[^\]]*\]\(https?:\/\/[^)]+\)/gi, "") // strip markdown links and image exfiltration
    .replace(/https?:\/\/\S+/gi, "") // strip raw external URLs
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pure server-side grounding verification for Copilot answers.
 * Guarantees that every claim is anchored in tool-retrieved facts.
 */
export function verifyCopilotAnswer(input: GroundingInput): GroundedCopilotAnswer {
  const missingInfo = (input.rawMissingInfo ?? [])
    .map((m) => sanitizeClaimText(m).slice(0, 300))
    .filter(Boolean);

  const factsByN = new Map<number, ExecutedFactRef>();
  for (const ef of input.executedFacts) {
    factsByN.set(ef.n, ef);
  }

  // If no claims were structured by the model, treat rawAnswer as a candidate claim
  let candidateClaims = input.rawClaims ?? [];
  if (candidateClaims.length === 0 && input.rawAnswer) {
    const sentences = input.rawAnswer
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    // If facts exist, attach all executed fact numbers as candidate references
    const allNs = Array.from(factsByN.keys());
    candidateClaims = sentences.map((text) => ({ text, sourceRefs: allNs }));
  }

  const validClaims: CopilotClaimDto[] = [];
  const unverifiedFigures: string[] = [];
  let droppedClaims = 0;
  const usedSourceNs = new Set<number>();

  for (const rawClaim of candidateClaims) {
    const text = sanitizeClaimText(rawClaim.text);
    if (!text || text.length < 5) {
      droppedClaims++;
      continue;
    }

    // 1. Screen fraud / accusatory denylist
    if (FRAUD_DENYLIST.test(text)) {
      droppedClaims++;
      continue;
    }

    // 2. Validate cited source refs
    const validRefs = (rawClaim.sourceRefs ?? []).filter((n) => factsByN.has(n));
    if (validRefs.length === 0) {
      droppedClaims++;
      continue;
    }

    // 3. Numeric & date grounding verification
    const combinedFactText = validRefs
      .map((n) => {
        const f = factsByN.get(n)!.fact;
        return `${f.label} ${String(f.value)} ${f.unit || ""}`;
      })
      .join(" ");

    const figures = extractFigures(text);
    let claimFiguresVerified = true;

    for (const fig of figures) {
      if (!figureAppearsIn(fig, combinedFactText)) {
        claimFiguresVerified = false;
        unverifiedFigures.push(fig.raw);
      }
    }

    if (!claimFiguresVerified) {
      droppedClaims++;
      continue;
    }

    // 4. Claim accepted
    validClaims.push({
      text,
      sourceRefs: validRefs,
      supported: true,
    });

    for (const n of validRefs) {
      usedSourceNs.add(n);
    }
  }

  // If zero claims survived -> INSUFFICIENT_EVIDENCE
  if (validClaims.length === 0) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      text: "Based on the verified project records available, there is insufficient evidence to formulate a complete answer.",
      claims: [],
      sources: [],
      evidence: {
        level: "NONE",
        unverifiedFigures,
        droppedClaims,
      },
      missingInfo,
    };
  }

  // Build reconstructed text with [n] citation markers
  const textParts: string[] = [];
  for (const claim of validClaims) {
    const markers = claim.sourceRefs.map((n) => `[${n}]`).join(" ");
    textParts.push(`${claim.text} ${markers}`);
  }
  const finalText = textParts.join(" ");

  // Build sources array, guaranteeing internal routes only
  const sources: CopilotSourceDto[] = [];
  const sortedSourceNs = Array.from(usedSourceNs).sort((a, b) => a - b);

  for (const n of sortedSourceNs) {
    const ef = factsByN.get(n)!;
    const fact = ef.fact;
    let link = ef.link || "/";
    // HARD RULE: links only to internal routes - never external URLs
    if (link.startsWith("http://") || link.startsWith("https://")) {
      link = "/";
    }

    sources.push({
      n,
      type: fact.ref?.type || ef.tool,
      recordId: fact.ref?.id,
      label: fact.ref?.label || fact.label,
      link,
      asOf: fact.asOf,
      tool: ef.tool,
    });
  }

  const evidenceLevel = droppedClaims === 0 ? "VERIFIED" : "PARTIAL";
  const status = droppedClaims === 0 ? "ANSWERED" : "PARTIAL";

  return {
    status,
    text: finalText,
    claims: validClaims,
    sources,
    evidence: {
      level: evidenceLevel,
      unverifiedFigures,
      droppedClaims,
    },
    missingInfo,
  };
}
