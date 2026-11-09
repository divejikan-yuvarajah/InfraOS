import type {
  RiskAssessmentDto,
  RiskChangeDto,
  RiskIndicatorDto,
  RiskLevel,
  RiskSeverity,
} from "@infraos/shared-types";

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function detectRiskChanges(
  currentIndicators: RiskIndicatorDto[],
  previousAssessment: RiskAssessmentDto | null | undefined,
  currentLevel: RiskLevel,
): { changes: RiskChangeDto[]; levelChange?: { from: RiskLevel; to: RiskLevel } } {
  if (!previousAssessment) {
    const changes: RiskChangeDto[] = currentIndicators
      .filter((i) => i.severity !== "INFO")
      .map((i) => ({
        type: "NEW",
        code: i.code,
        fingerprint: i.fingerprint,
        to: i.severity,
      }));
    return { changes };
  }

  const prevMap = new Map<string, RiskIndicatorDto>();
  for (const ind of previousAssessment.indicators ?? []) {
    prevMap.set(ind.fingerprint, ind);
  }

  const currentMap = new Map<string, RiskIndicatorDto>();
  for (const ind of currentIndicators) {
    currentMap.set(ind.fingerprint, ind);
  }

  const changes: RiskChangeDto[] = [];

  // Check current indicators against previous
  for (const curr of currentIndicators) {
    if (curr.severity === "INFO") continue;
    const prev = prevMap.get(curr.fingerprint);
    if (!prev || prev.severity === "INFO") {
      changes.push({
        type: "NEW",
        code: curr.code,
        fingerprint: curr.fingerprint,
        to: curr.severity,
      });
    } else {
      const prevRank = SEVERITY_RANK[prev.severity];
      const currRank = SEVERITY_RANK[curr.severity];
      if (currRank > prevRank) {
        changes.push({
          type: "ESCALATED",
          code: curr.code,
          fingerprint: curr.fingerprint,
          from: prev.severity,
          to: curr.severity,
        });
      } else if (currRank < prevRank) {
        changes.push({
          type: "DEESCALATED",
          code: curr.code,
          fingerprint: curr.fingerprint,
          from: prev.severity,
          to: curr.severity,
        });
      }
    }
  }

  // Check cleared indicators
  for (const prev of previousAssessment.indicators ?? []) {
    if (prev.severity === "INFO") continue;
    if (!currentMap.has(prev.fingerprint)) {
      changes.push({
        type: "CLEARED",
        code: prev.code,
        fingerprint: prev.fingerprint,
        from: prev.severity,
      });
    }
  }

  let levelChange: { from: RiskLevel; to: RiskLevel } | undefined;
  if (
    previousAssessment.overallLevel &&
    previousAssessment.overallLevel !== currentLevel
  ) {
    levelChange = {
      from: previousAssessment.overallLevel,
      to: currentLevel,
    };
  }

  return { changes, levelChange };
}

