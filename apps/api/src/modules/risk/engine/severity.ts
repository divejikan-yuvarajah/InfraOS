import type {
  RiskIndicatorDto,
  RiskLevel,
  RiskSeverity,
  RiskSufficiency,
} from "@infraos/shared-types";

const LEVEL_RANK: Record<RiskLevel, number> = {
  NOT_ASSESSABLE: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function compareLevels(a: RiskLevel, b: RiskLevel): number {
  return LEVEL_RANK[a] - LEVEL_RANK[b];
}

export function computeCategoryLevel(
  indicators: RiskIndicatorDto[],
  sufficiency: RiskSufficiency,
): { level: RiskLevel; index: number } {
  const index = Math.min(
    100,
    indicators.reduce((sum, ind) => sum + ind.points, 0),
  );

  if (sufficiency === "INSUFFICIENT") {
    return { level: "NOT_ASSESSABLE", index };
  }

  const hasCritical = indicators.some((i) => i.severity === "CRITICAL");
  const hasHigh = indicators.some((i) => i.severity === "HIGH");
  const hasModerate = indicators.some((i) => i.severity === "MODERATE");

  if (hasCritical || index >= 70) {
    return { level: "CRITICAL", index };
  }
  if (hasHigh || index >= 45) {
    return { level: "HIGH", index };
  }
  if (hasModerate || index >= 20) {
    return { level: "MODERATE", index };
  }
  return { level: "LOW", index };
}

export function computeOverallLevel(
  categoryResults: Array<{ level: RiskLevel; sufficiency: RiskSufficiency }>,
  allIndicators: RiskIndicatorDto[],
): { overallLevel: RiskLevel; overallIndex: number | undefined } {
  const assessable = categoryResults.filter(
    (c) => c.level !== "NOT_ASSESSABLE" && c.sufficiency !== "INSUFFICIENT",
  );

  if (assessable.length === 0) {
    return { overallLevel: "NOT_ASSESSABLE", overallIndex: undefined };
  }

  let maxLevel: RiskLevel = "LOW";
  for (const cat of assessable) {
    if (LEVEL_RANK[cat.level] > LEVEL_RANK[maxLevel]) {
      maxLevel = cat.level;
    }
  }

  const overallIndex = Math.min(
    100,
    allIndicators.reduce((sum, ind) => sum + ind.points, 0),
  );

  return { overallLevel: maxLevel, overallIndex };
}

