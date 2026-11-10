import mongoose from "mongoose";
import type { RiskNarrativeDto } from "@infraos/shared-types";
import { logger } from "../../shared/logger.js";
import { aiClient } from "../ai/ai-client.js";
import { aiConfig } from "../ai/ai.config.js";
import { checkGate, recordGate } from "../ai/governance/ai-gate.js";
import { extractFigures, figureAppearsIn } from "../ai/rag/grounding.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { RiskAssessment } from "./models/risk-assessment.model.js";
import { RiskAccessError } from "./risk-inputs.service.js";
import { projectReadFilter, resolveRiskScope } from "./risk-scope.js";
import { writeRiskAudit } from "./risk.audit.js";

export const BLAME_FRAUD_DENYLIST: RegExp[] = [
  /\bcorrupt(?:ion)?\b/i,
  /\bfraud(?:ulent)?\b/i,
  /\bbribe(?:ry)?\b/i,
  /\bcollusion\b/i,
  /\bculpab(?:le|ility)\b/i,
  /\bguilty\b/i,
  /\bmisconduct\b/i,
  /\bmalpractice\b/i,
  /\bembezzle(?:ment)?\b/i,
  /\bextort(?:ion)?\b/i,
  /\bkickback\b/i,
  /\bswindle\b/i,
  /\btheft\b/i,
  /\bcrime\b/i,
  /\bcriminal\b/i,
  /\bculprit\b/i,
];

export function containsProhibitedTerminology(text: string): boolean {
  return BLAME_FRAUD_DENYLIST.some((re) => re.test(text));
}

export interface GenerateNarrativeOptions {
  language?: "en" | "si" | "ta";
  regenerate?: boolean;
}

/**
 * Builds a minimised, de-identified input payload from the stored assessment (§4.9).
 * Contains strictly numeric facts, indicator codes, severities, and dates.
 * NO names, free text, or document bodies.
 */
export function buildDeidentifiedNarrativeInput(
  projectCode: string,
  assessment: any,
) {
  const deidentifiedCategories = (assessment.categories ?? []).map((c: any) => ({
    category: c.category,
    level: c.level,
    index: c.index,
    sufficiency: c.sufficiency,
    missing: c.missing ?? [],
  }));

  const deidentifiedIndicators = (assessment.indicators ?? []).map((i: any) => ({
    code: i.code,
    category: i.category,
    severity: i.severity,
    points: i.points,
    basis: i.basis,
    evidence: (i.evidence ?? []).map((e: any) => ({
      kind: e.kind,
      value: e.value,
      unit: e.unit,
      asOf: e.asOf,
    })),
  }));

  return {
    projectCode,
    overallLevel: assessment.overallLevel,
    overallIndex: assessment.overallIndex,
    categories: deidentifiedCategories,
    indicators: deidentifiedIndicators,
  };
}

/**
 * Verifies that all figures in the narrative text exist in the source input data,
 * and that no prohibited blame/fraud words are present (§4.9).
 */
export function verifyNarrativeContent(
  text: string,
  allowedPayload: Record<string, unknown>,
): { verified: boolean; reason?: string } {
  // 1. Prohibited blame/fraud terminology check
  if (containsProhibitedTerminology(text)) {
    return {
      verified: false,
      reason: "Contains prohibited blame, fraud, or accusatory terminology",
    };
  }

  // 2. Numeric / figure grounding verification
  const figures = extractFigures(text);
  const haystack = JSON.stringify(allowedPayload);

  for (const fig of figures) {
    if (!figureAppearsIn(fig, haystack)) {
      return {
        verified: false,
        reason: `Figure '${fig.raw}' (${fig.kind}) is not grounded in assessment evidence`,
      };
    }
  }

  return { verified: true };
}

/**
 * Generates an optional plain-language AI explanation of the calculated risk indicators (§4.9).
 * Explains, NEVER computes.
 */
export async function generateRiskNarrative(
  actor: AuthenticatedActor,
  projectId: string,
  assessmentId: string,
  options?: GenerateNarrativeOptions,
): Promise<RiskNarrativeDto> {
  // 1. Authorization & scope check
  const scope = await resolveRiskScope(actor);
  const projectObjId = new mongoose.Types.ObjectId(projectId);

  const project = await Project.findOne({
    $and: [projectReadFilter(scope), { _id: projectObjId }],
  })
    .select("projectCode agencyId")
    .lean();

  if (!project) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found or outside authorized scope");
  }

  // 2. Find assessment
  const assessment = await RiskAssessment.findOne({
    _id: new mongoose.Types.ObjectId(assessmentId),
    projectId: projectObjId,
  });

  if (!assessment) {
    throw new RiskAccessError(404, "NOT_FOUND", "Risk assessment not found");
  }

  // 3. Return existing narrative if present and not regenerating
  if (assessment.narrative?.verified && !options?.regenerate) {
    return {
      text: assessment.narrative.text,
      model: assessment.narrative.model,
      promptVersion: assessment.narrative.promptVersion,
      language: assessment.narrative.language,
      generatedAt:
        assessment.narrative.generatedAt instanceof Date
          ? assessment.narrative.generatedAt.toISOString()
          : String(assessment.narrative.generatedAt),
      verified: Boolean(assessment.narrative.verified),
    };
  }

  // 4. Verify AI service is configured and check central governance gate
  if (!aiConfig.configured) {
    throw new RiskAccessError(
      503,
      "AI_SERVICE_UNAVAILABLE",
      "AI narrative service is not configured (missing OpenRouter / LLM credentials)",
    );
  }

  const gate = await checkGate({
    actor,
    agencyId: project.agencyId ? String(project.agencyId) : undefined,
    feature: "riskNarrative",
    estimate: { inputTokens: 1000, outputTokens: 1500, costUnits: 2 },
  });
  if (!gate.allow) {
    if (gate.deny.code === "AI_RATE_LIMITED") {
      throw new RiskAccessError(429, "AI_RATE_LIMITED", gate.deny.message ?? "Rate limit reached");
    }
    if (gate.deny.code === "AI_BUDGET_EXCEEDED") {
      throw new RiskAccessError(429, "AI_BUDGET_EXCEEDED", gate.deny.message ?? "Budget exceeded");
    }
    throw new RiskAccessError(503, "AI_SERVICE_UNAVAILABLE", gate.deny.message ?? "AI service unavailable");
  }

  const language = options?.language ?? "en";
  const inputPayload = buildDeidentifiedNarrativeInput(project.projectCode, assessment);

  try {
    const client = aiClient();
    const response = await client.riskNarrative({
      language,
      projectCode: project.projectCode,
      overallLevel: assessment.overallLevel,
      overallIndex: assessment.overallIndex ?? undefined,
      categories: inputPayload.categories,
      indicators: inputPayload.indicators,
      maxOutputTokens: 1500,
    });

    const output = response.output;
    const combinedText = [
      output.summary,
      ...output.categories.map((c) => c.text),
      ...(output.questionsToAsk.length > 0
        ? [`Key Questions: ${output.questionsToAsk.join("; ")}`]
        : []),
    ].join("\n\n");

    // 5. Verification: numeric grounding + denylist
    const verification = verifyNarrativeContent(combinedText, inputPayload);
    if (!verification.verified) {
      logger.warn(
        { projectId, assessmentId, reason: verification.reason },
        "AI risk narrative discarded due to verification failure",
      );
      throw new RiskAccessError(
        422,
        "NARRATIVE_VERIFICATION_FAILED",
        `AI narrative verification failed: ${verification.reason}`,
      );
    }

    const narrative: RiskNarrativeDto = {
      text: combinedText,
      model: response.model,
      promptVersion: response.promptVersion,
      language,
      generatedAt: new Date().toISOString(),
      verified: true,
    };

    // 6. The single permitted post-creation write to RiskAssessment
    assessment.narrative = narrative as any;
    await assessment.save();

    await recordGate({
      actor,
      agencyId: project.agencyId ? String(project.agencyId) : undefined,
      feature: "riskNarrative",
      tier: "LOW",
      model: response.model,
      actual: {
        inputTokens: response.usage?.inputTokens ?? 800,
        outputTokens: response.usage?.outputTokens ?? 600,
        status: "OK",
        purpose: "RISK_NARRATIVE",
      },
    }).catch(() => undefined);

    await writeRiskAudit(undefined, {
      action: "risk.narrative_generated",
      resourceId: assessment._id,
      actorUserId: actor.userId,
      agencyId: project.agencyId,
      status: "GENERATED",
      reason: `model:${response.model},lang:${language}`,
    });

    return narrative;
  } catch (err) {
    if (err instanceof RiskAccessError) throw err;
    logger.warn({ projectId, assessmentId, err }, "AI risk narrative generation call failed");
    throw new RiskAccessError(
      503,
      "AI_SERVICE_UNAVAILABLE",
      "Failed to communicate with AI explanation service",
    );
  }
}
