import type {
  RiskAssessmentDto,
  RiskEvidenceRefDto,
  RiskIndicatorDto,
} from "@infraos/shared-types";

export interface ViewerPermissions {
  canReadFinance: boolean;
  canReadContractor: boolean;
  agencyId?: string | null;
  isPlatformScope: boolean;
}

/**
 * Tiers sensitive evidence in a risk assessment (§4.8):
 * - Amounts (budget, spent, committed, EAC, transactions) are redacted if viewer lacks finance permissions.
 * - Contractor names are redacted if viewer lacks contractor read permissions.
 * - Non-sensitive percentages, rule points, levels, and counts are preserved.
 */
export function tierAssessmentEvidence(
  assessment: RiskAssessmentDto,
  viewer: ViewerPermissions,
): RiskAssessmentDto {
  if (viewer.canReadFinance && viewer.canReadContractor) {
    return assessment;
  }

  const tieredIndicators: RiskIndicatorDto[] = (assessment.indicators ?? []).map(
    (ind) => {
      let inputs = ind.inputs ? { ...ind.inputs } : undefined;
      let evidence = [...ind.evidence];
      let calc = ind.calc ? { ...ind.calc, steps: [...ind.calc.steps] } : undefined;

      // 1. Finance Tiering
      if (!viewer.canReadFinance) {
        if (ind.category === "BUDGET" || ind.code.startsWith("BG")) {
          if (inputs) {
            if ("budgetMinor" in inputs) inputs.budgetMinor = undefined;
            if ("spentMinor" in inputs) inputs.spentMinor = undefined;
            if ("committedMinor" in inputs) inputs.committedMinor = undefined;
            if ("eacMinor" in inputs) inputs.eacMinor = undefined;
            if ("largestSingleTransactionMinor" in inputs) {
              inputs.largestSingleTransactionMinor = undefined;
            }
            if ("last30DaysSpendMinor" in inputs) {
              inputs.last30DaysSpendMinor = undefined;
            }
            inputs.redacted = true;
          }

          evidence = evidence.map((e): RiskEvidenceRefDto => {
            if (e.kind === "finance") {
              return {
                ...e,
                value: "[REDACTED]",
                unit: e.unit?.includes("LKR") ? "[REDACTED]" : e.unit,
              };
            }
            return e;
          });

          if (calc) {
            calc.steps = calc.steps.map((step) => {
              if (step.includes("LKR") || step.includes("spent") || step.includes("budget")) {
                return "[Financial amounts redacted without finance permissions]";
              }
              return step;
            });
          }
        }
      }

      // 2. Contractor Tiering
      if (!viewer.canReadContractor) {
        if (ind.code === "DL4" || ind.code === "CO3") {
          if (inputs && "contractorName" in inputs) {
            inputs.contractorName = "Assigned contractor (redacted)";
          }
          evidence = evidence.map((e): RiskEvidenceRefDto => {
            if (e.kind === "contractor") {
              return {
                ...e,
                ref: {
                  ...e.ref,
                  label: "Assigned contractor (redacted)",
                },
              };
            }
            return e;
          });
        }
      }

      return {
        ...ind,
        inputs,
        evidence,
        calc,
      };
    },
  );

  return {
    ...assessment,
    indicators: tieredIndicators,
  };
}

