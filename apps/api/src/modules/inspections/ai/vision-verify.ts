export type RawVisionOutput = {
  images?: Array<{
    n?: number;
    activityDescription?: string;
    visibleWorkIndicators?: Array<{ label?: string; certainty?: string }>;
    qualityIssues?: string[];
    notes?: string;
  }>;
  overall?: {
    consistencyWithReportedStage?: string;
    rationale?: string;
  };
  potentialDiscrepancies?: Array<{
    statement?: string;
    imageNs?: number[];
    severity?: string;
  }>;
  cannotBeDetermined?: string[];
  questionsForInspector?: string[];
};

export type VerifiedVisionOutput = {
  images: Array<{
    n: number;
    activityDescription: string;
    visibleWorkIndicators: Array<{ label: string; certainty: "CLEAR" | "POSSIBLE" }>;
    qualityIssues: Array<
      | "BLURRY"
      | "DARK"
      | "OVEREXPOSED"
      | "PARTIAL_VIEW"
      | "NO_SCALE_REFERENCE"
      | "OBSTRUCTED"
      | "LOW_RESOLUTION"
      | "OTHER"
    >;
    notes?: string;
  }>;
  overall: {
    consistencyWithReportedStage: "CONSISTENT" | "PARTIALLY_CONSISTENT" | "INCONSISTENT" | "INDETERMINATE";
    rationale: string;
  };
  potentialDiscrepancies: Array<{
    statement: string;
    imageNs: number[];
    severity: "LOW" | "MODERATE" | "HIGH";
  }>;
  cannotBeDetermined: string[];
  questionsForInspector: string[];
  droppedStatements: number;
};

const FORBIDDEN_WORDS = [
  "fraud",
  "fake",
  "falsified",
  "falsify",
  "lying",
  "corrupt",
  "corruption",
  "negligent",
  "negligence",
  "dishonest",
  "scam",
  "phantom",
  "fictitious",
  "cheat",
  "illegal",
  "criminal",
  "forgery",
];

const PEOPLE_ID_PATTERNS = [
  /\bname is\b/i,
  /\bidentified as\b/i,
  /\bworker named\b/i,
  /\bplate (number|no)\b/i,
  /\blicense plate\b/i,
  /\bvehicle reg\b/i,
  /\bnic[:\s]/i,
];

export function verifyVisionOutput(params: {
  raw: RawVisionOutput;
  imageCount: number;
  allowedPercentages: number[]; // claimed progress, previous verified progress, milestone progress values
}): VerifiedVisionOutput {
  const { raw, imageCount, allowedPercentages } = params;
  let droppedStatements = 0;

  const allowedPctSet = new Set(allowedPercentages.map((p) => Math.round(p)));

  function containsForbiddenOrPeople(text: string): boolean {
    const lower = text.toLowerCase();
    for (const w of FORBIDDEN_WORDS) {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      if (regex.test(lower)) return true;
    }
    for (const p of PEOPLE_ID_PATTERNS) {
      if (p.test(text)) return true;
    }
    return false;
  }

  function hasUnverifiedPercentage(text: string): boolean {
    // Find all occurrences of N% or N percent
    const pctRegex = /(\b\d{1,3}(?:\.\d+)?)\s*(?:%|\bpercent\b)/gi;
    let match: RegExpExecArray | null;
    while ((match = pctRegex.exec(text)) !== null) {
      const val = Math.round(parseFloat(match[1]!));
      if (!allowedPctSet.has(val)) {
        return true; // Mentions a percentage not present in the input context
      }
    }
    return false;
  }

  function isStatementSafe(text: string | undefined): boolean {
    if (!text || typeof text !== "string") return false;
    if (containsForbiddenOrPeople(text)) {
      droppedStatements++;
      return false;
    }
    if (hasUnverifiedPercentage(text)) {
      droppedStatements++;
      return false;
    }
    return true;
  }

  // 1. Process images
  const images: VerifiedVisionOutput["images"] = [];
  let imagesWithQualityIssues = 0;

  for (let idx = 1; idx <= imageCount; idx++) {
    const item = raw.images?.find((img) => img.n === idx);
    const n = idx;
    let activity = item?.activityDescription ?? `Photo ${idx} analysis`;
    if (!isStatementSafe(activity)) {
      activity = `Photo ${idx} contains visible physical work elements.`;
    }

    const safeIndicators: Array<{ label: string; certainty: "CLEAR" | "POSSIBLE" }> = [];
    for (const ind of item?.visibleWorkIndicators ?? []) {
      if (ind.label && isStatementSafe(ind.label)) {
        safeIndicators.push({
          label: ind.label.slice(0, 80),
          certainty: ind.certainty === "CLEAR" ? "CLEAR" : "POSSIBLE",
        });
      }
    }

    const VALID_ISSUES = new Set([
      "BLURRY",
      "DARK",
      "OVEREXPOSED",
      "PARTIAL_VIEW",
      "NO_SCALE_REFERENCE",
      "OBSTRUCTED",
      "LOW_RESOLUTION",
      "OTHER",
    ]);
    const safeIssues = (item?.qualityIssues ?? []).filter((q): q is VerifiedVisionOutput["images"][0]["qualityIssues"][number] =>
      VALID_ISSUES.has(q),
    );

    if (safeIssues.length > 0) {
      imagesWithQualityIssues++;
    }

    images.push({
      n,
      activityDescription: activity.slice(0, 400),
      visibleWorkIndicators: safeIndicators,
      qualityIssues: safeIssues,
      notes: item?.notes && isStatementSafe(item.notes) ? item.notes.slice(0, 300) : undefined,
    });
  }

  // 2. Process discrepancies
  const safeDiscrepancies: VerifiedVisionOutput["potentialDiscrepancies"] = [];
  for (const disc of raw.potentialDiscrepancies ?? []) {
    if (disc.statement && isStatementSafe(disc.statement)) {
      const validImageNs = (disc.imageNs ?? []).filter((n) => typeof n === "number" && n >= 1 && n <= imageCount);
      const severity = disc.severity === "HIGH" ? "HIGH" : disc.severity === "MODERATE" ? "MODERATE" : "LOW";
      safeDiscrepancies.push({
        statement: `Potential discrepancy — verify on site: ${disc.statement.slice(0, 260)}`,
        imageNs: validImageNs.length > 0 ? validImageNs : [1],
        severity,
      });
    }
  }

  // 3. Process cannotBeDetermined and questionsForInspector
  const safeCannotBeDetermined = (raw.cannotBeDetermined ?? []).filter(isStatementSafe).map((s) => s.slice(0, 200));
  const safeQuestions = (raw.questionsForInspector ?? []).filter(isStatementSafe).map((s) => s.slice(0, 200));

  // 4. Overall Consistency & Rationale
  let rationale = raw.overall?.rationale ?? "Observations assessed against reported project stage.";
  if (!isStatementSafe(rationale)) {
    rationale = "Visible site observations assessed against the reported project milestone stage.";
  }

  const rawConsistency = raw.overall?.consistencyWithReportedStage;
  let consistency: VerifiedVisionOutput["overall"]["consistencyWithReportedStage"] =
    rawConsistency === "INCONSISTENT"
      ? "INCONSISTENT"
      : rawConsistency === "PARTIALLY_CONSISTENT"
        ? "PARTIALLY_CONSISTENT"
        : rawConsistency === "CONSISTENT"
          ? "CONSISTENT"
          : "INDETERMINATE";

  // Consistency downgrade rules:
  // CONSISTENT is downgraded to INDETERMINATE if:
  // - quality issues affect > half the images
  // - fewer than 2 distinct images
  // - model supplied no cited rationale
  const hasImageCitation = /\b(image|photo)\s*\d+/i.test(rationale);
  if (consistency === "CONSISTENT") {
    if (imagesWithQualityIssues > imageCount / 2 || imageCount < 2 || !hasImageCitation) {
      consistency = "INDETERMINATE";
    }
  }

  return {
    images,
    overall: {
      consistencyWithReportedStage: consistency,
      rationale: rationale.slice(0, 600),
    },
    potentialDiscrepancies: safeDiscrepancies,
    cannotBeDetermined: safeCannotBeDetermined,
    questionsForInspector: safeQuestions,
    droppedStatements,
  };
}

