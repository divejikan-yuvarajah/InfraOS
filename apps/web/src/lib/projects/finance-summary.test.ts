import { describe, expect, it } from "vitest";

import { financeQueryKey, financialBarFill, financialForBar, showsMoney, type FinancialSummary } from "./finance-summary";

const provisional: FinancialSummary = {
  availability: "provisional",
  basis: "recorded_paid_rows",
  currency: "LKR",
  budgetMinor: 10000,
  paidMinor: 15000,
  remainingMinor: 0,
  overrunMinor: 5000,
  ratioPercent: 150,
  provenance: "recorded rows only",
};

describe("financial summary display", () => {
  it("caps the bar at 100 and keeps overrun figures only for a provisional summary", () => {
    expect(financialBarFill(150)).toBe(100);
    expect(financialBarFill(40)).toBe(40);
    expect(financialBarFill(Number.NaN)).toBe(0);
    expect(showsMoney(provisional)).toBe(true);
    expect(showsMoney({ availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "missing_budget" })).toBe(false);
    expect(financeQueryKey("1", "user-a", "PROJECT_MANAGER", "p1")).not.toEqual(financeQueryKey("2", "user-b", "INSPECTOR", "p1"));
  });
});

describe("financial side of the dual bar", () => {
  it("uses only the API ratio, keeping an overrun above 100", () => {
    expect(financialForBar(provisional, null)).toEqual({ value: 150, withheld: false });
  });
  it("is withheld on 403 and unavailable on other failures or unavailable summaries", () => {
    expect(financialForBar(undefined, 403)).toEqual({ value: null, withheld: true });
    expect(financialForBar(undefined, 503)).toEqual({ value: null, withheld: false });
    expect(financialForBar({ availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "missing_budget" }, null)).toEqual({ value: null, withheld: false });
    expect(financialForBar(undefined, null)).toEqual({ value: null, withheld: false });
  });
});
