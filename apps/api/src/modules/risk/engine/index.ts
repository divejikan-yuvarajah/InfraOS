import {
  RISK_ENGINE_VERSION,
  type RiskAssessmentDto,
  type RiskFactorCategory,
  type RiskIndicatorDto,
} from "@infraos/shared-types";
import { computeInputsHash } from "./hash.js";
import { applyDeduplication } from "./dedupe.js";
import { evaluateDelayIndicators } from "./indicators/delay.js";
import { evaluateProgressIndicators } from "./indicators/progress.js";
import { evaluateBudgetIndicators } from "./indicators/budget.js";
import { evaluateScheduleIndicators } from "./indicators/schedule.js";
import { evaluateCoordinationIndicators } from "./indicators/coordination.js";
import {
  evaluateCategorySufficiency,
  evaluateSourceFreshness,
} from "./sufficiency.js";
import {
  computeCategoryLevel,
  computeOverallLevel,
} from "./severity.js";
import { generateRecommendations } from "./recommendations.js";
import { detectRiskChanges } from "./changes.js";
import type { CategoryResult, RiskInputs, RiskResult } from "./types.js";

const CATEGORIES: RiskFactorCategory[] = [
  "DELAY",
  "PROGRESS",
  "BUDGET",
  "SCHEDULE",
  "COORDINATION",
];

const NON_ASSESSABLE_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

/**
 * Pure and deterministic explainable risk engine entrypoint (§4.1, Steps 119-121).
 *
 * Rules:
 * - No I/O, no network, no database calls, no Math.random(), no Date.now().
 * - Depends strictly on passed-in `inputs` and `now` reference date.
 * - Same inputs + same now + same version => identical inputsHash and output.
 */
export function evaluateRisk(
  inputs: RiskInputs,
  now: Date,
  previous?: RiskAssessmentDto | null,
): RiskResult {
  const project = inputs.project.data;
  const status = project?.status ?? "DRAFT";

  const inputsHash = computeInputsHash(inputs, RISK_ENGINE_VERSION);

  // 1. Applicability check by project status
  if (NON_ASSESSABLE_STATUSES.has(status)) {
    const categories: CategoryResult[] = CATEGORIES.map((cat) => ({
      category: cat,
      level: "NOT_ASSESSABLE",
      index: 0,
      sufficiency: "INSUFFICIENT",
      missing: [`status_${status.toLowerCase()}_not_assessed`],
    }));

    return {
      engineVersion: RISK_ENGINE_VERSION,
      applicable: false,
      notApplicableReason: `Not applicable for status ${status}`,
      overallLevel: "NOT_ASSESSABLE",
      overallIndex: undefined,
      categories,
      indicators: [],
      sourceFreshness: evaluateSourceFreshness(inputs, now),
      missingData: [`status_${status.toLowerCase()}_not_assessed`],
      recommendations: [],
      changes: [],
      inputsHash,
    };
  }

  // 2. Evaluate indicators across categories based on status applicability
  const rawIndicators: RiskIndicatorDto[] = [];

  const isFullAssessment = status === "ACTIVE" || status === "DELAYED";
  const isOnHold = status === "ON_HOLD";
  const isApproved = status === "APPROVED";

  // DELAY: only for ACTIVE and DELAYED
  if (isFullAssessment) {
    rawIndicators.push(...evaluateDelayIndicators(inputs, now));
    rawIndicators.push(...evaluateProgressIndicators(inputs, now));
  }

  // BUDGET, SCHEDULE, and COORDINATION apply to ACTIVE, DELAYED, ON_HOLD, and APPROVED
  if (isFullAssessment || isOnHold || isApproved) {
    rawIndicators.push(...evaluateBudgetIndicators(inputs, now));
    rawIndicators.push(...evaluateScheduleIndicators(inputs, now));
    rawIndicators.push(...evaluateCoordinationIndicators(inputs, now));
  }

  // 3. Deduplication and suppression rules (§4.4)
  const indicators = applyDeduplication(rawIndicators);

  // 4. Source freshness and missing data evaluation
  const sourceFreshness = evaluateSourceFreshness(inputs, now);
  const missingDataCollector = new Set<string>();

  // 5. Category summaries and sufficiency
  const categories: CategoryResult[] = CATEGORIES.map((cat) => {
    // If category is paused/skipped for ON_HOLD or APPROVED
    if (!isFullAssessment && (cat === "DELAY" || cat === "PROGRESS")) {
      const reason = isOnHold ? "on_hold_paused" : "pre_start_not_applicable";
      missingDataCollector.add(reason);
      return {
        category: cat,
        level: "NOT_ASSESSABLE",
        index: 0,
        sufficiency: "INSUFFICIENT",
        missing: [reason],
      };
    }

    const { sufficiency, missing } = evaluateCategorySufficiency(cat, inputs);
    for (const m of missing) missingDataCollector.add(m);

    const catIndicators = indicators.filter((i) => i.category === cat);
    const { level, index } = computeCategoryLevel(catIndicators, sufficiency);

    return {
      category: cat,
      level,
      index,
      sufficiency,
      missing,
    };
  });

  // 6. Overall level and rule-points index aggregation
  const { overallLevel, overallIndex } = computeOverallLevel(categories, indicators);

  // 7. Advisory recommendations
  const recommendations = generateRecommendations(indicators, categories, inputs);

  // 8. Change detection relative to previous assessment
  const { changes, levelChange } = detectRiskChanges(
    indicators,
    previous,
    overallLevel,
  );

  return {
    engineVersion: RISK_ENGINE_VERSION,
    applicable: true,
    overallLevel,
    overallIndex,
    categories,
    indicators,
    sourceFreshness,
    missingData: Array.from(missingDataCollector),
    recommendations,
    changes,
    levelChange,
    inputsHash,
  };
}

export * from "./types.js";
export * from "./catalog.js";
export * from "./math.js";
export * from "./dedupe.js";
export * from "./hash.js";
export * from "./resurface.js";
export * from "./severity.js";
export * from "./sufficiency.js";
export * from "./changes.js";
export * from "./recommendations.js";

