import type { RiskIndicatorDto } from "@infraos/shared-types";

/**
 * Enforces risk indicator deduplication rules (§4.4):
 * 1. Each underlying fact belongs to exactly one indicator.
 * 2. If DL1 (Past planned end) is CRITICAL (> 60 days overdue), DL2 (Schedule variance)
 *    is suppressed to INFO (0 points) to avoid double-penalizing the same project lateness.
 * 3. In case of identical fingerprints, keep the highest-severity indicator.
 */
export function applyDeduplication(
  indicators: RiskIndicatorDto[],
): RiskIndicatorDto[] {
  // Check if DL1 is CRITICAL
  const dl1IsCritical = indicators.some(
    (ind) => ind.code === "DL1" && ind.severity === "CRITICAL",
  );

  const deduplicatedByFingerprint = new Map<string, RiskIndicatorDto>();

  for (const indicator of indicators) {
    let finalIndicator = indicator;

    // Dedupe Rule 1: Suppress DL2 if DL1 is CRITICAL
    if (indicator.code === "DL2" && dl1IsCritical) {
      finalIndicator = {
        ...indicator,
        severity: "INFO",
        points: 0,
        calc: indicator.calc
          ? {
              ...indicator.calc,
              steps: [
                ...indicator.calc.steps,
                "Suppressed to INFO (0 pts) because DL1 is already CRITICAL (dedupe rule).",
              ],
            }
          : undefined,
      };
    }

    // Keep highest severity if duplicate fingerprint exists
    const existing = deduplicatedByFingerprint.get(finalIndicator.fingerprint);
    if (!existing || finalIndicator.points > existing.points) {
      deduplicatedByFingerprint.set(finalIndicator.fingerprint, finalIndicator);
    }
  }

  return Array.from(deduplicatedByFingerprint.values());
}

