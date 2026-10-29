export type FinancialSummary =
  | {
      availability: "unavailable";
      basis: "recorded_paid_rows";
      currency: "LKR";
      reason: "missing_budget" | "mixed_currency" | "unsafe_amount";
    }
  | {
      availability: "provisional";
      basis: "recorded_paid_rows";
      currency: "LKR";
      budgetMinor: number;
      paidMinor: number;
      remainingMinor: number;
      overrunMinor: number;
      ratioPercent: number;
      provenance: string;
    };

export function financeQueryKey(epoch: string, userId: string, roleKey: string, projectId: string) {
  return ["financial-progress", epoch, userId, roleKey, projectId] as const;
}

export function financialBarFill(ratioPercent: number): number {
  if (!Number.isFinite(ratioPercent) || ratioPercent <= 0) return 0;
  return Math.min(100, ratioPercent);
}

export function showsMoney(summary: FinancialSummary | undefined): summary is Extract<FinancialSummary, { availability: "provisional" }> {
  return summary?.availability === "provisional";
}
