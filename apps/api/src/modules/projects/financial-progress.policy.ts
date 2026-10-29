const PROVENANCE = "Sum of stored payment rows marked PAID, in LKR cents. This is not a bank confirmation or a disbursement approval.";

export type FinancialReason = "missing_budget" | "mixed_currency" | "unsafe_amount";

export type PaidRow = { amountMinor: number; currency: string };

export type FinancialCalculation =
  | {
      availability: "unavailable";
      basis: "recorded_paid_rows";
      currency: "LKR";
      reason: FinancialReason;
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

function safeMinor(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function summarizeRecordedPayments(budgetMinor: number | null | undefined, paidRows: PaidRow[]): FinancialCalculation {
  if (typeof budgetMinor !== "number" || !safeMinor(budgetMinor) || budgetMinor === 0) {
    return { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "missing_budget" };
  }
  if (paidRows.some((row) => row.currency !== "LKR")) {
    return { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "mixed_currency" };
  }
  if (paidRows.some((row) => !safeMinor(row.amountMinor))) {
    return { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "unsafe_amount" };
  }
  let paid = 0n;
  for (const row of paidRows) paid += BigInt(row.amountMinor);
  const budget = BigInt(budgetMinor);
  if (paid > BigInt(Number.MAX_SAFE_INTEGER) || budget > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "unsafe_amount" };
  }
  const paidMinor = Number(paid);
  const remainingMinor = paid > budget ? 0 : Number(budget - paid);
  const overrunMinor = paid > budget ? Number(paid - budget) : 0;
  const hundredths = (paid * 10000n) / budget;
  if (hundredths > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "unsafe_amount" };
  }
  return {
    availability: "provisional",
    basis: "recorded_paid_rows",
    currency: "LKR",
    budgetMinor,
    paidMinor,
    remainingMinor,
    overrunMinor,
    ratioPercent: Number(hundredths) / 100,
    provenance: PROVENANCE,
  };
}
