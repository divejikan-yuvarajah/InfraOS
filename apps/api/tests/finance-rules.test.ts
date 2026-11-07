import { describe, expect, it } from "vitest";

import { evaluateFinance, T, type IntelInput } from "../src/modules/finance/finance-intelligence.rules.js";
import { isSafeMinor, overBy, parseAmountToMinor, ratioBp, sumMinor } from "../src/modules/finance/finance.money.js";
import { blocked, evaluateGates, warnings, type GateInput } from "../src/modules/finance/payment.gates.js";
import { dupActiveFor, expenseDupActiveFor, expenseEditable, nextExpenseStatus, nextPaymentStatus, type ExpenseStatus, type PaymentAction, type PaymentStatus } from "../src/modules/finance/payment.state.js";
import { Counter, nextNumber } from "../src/shared/database/counter.js";

describe("money helpers", () => {
  it("parses decimal strings to cents without floats and rejects instead of rounding", () => {
    expect(parseAmountToMinor("1250000.50")).toBe(125_000_050);
    expect(parseAmountToMinor("0.10")).toBe(10);
    expect(parseAmountToMinor("0.3")).toBe(30);
    expect(parseAmountToMinor("19999.99")).toBe(1_999_999);
    expect(parseAmountToMinor("1.005")).toBeNull();
    expect(parseAmountToMinor("0")).toBeNull();
    expect(parseAmountToMinor("-5")).toBeNull();
    expect(parseAmountToMinor("1,250")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor(12.5)).toBeNull();
    expect(parseAmountToMinor("1234567890123456")).toBeNull(); // 16 digits
    expect(parseAmountToMinor("99999999999999.99")).toBeNull(); // beyond the safe integer range once in cents
    expect(parseAmountToMinor("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER); // the largest representable amount
    expect(parseAmountToMinor("90071992547409.92")).toBeNull();
  });
  it("sums exactly and keeps ratios in integer basis points", () => {
    expect(sumMinor([10, 20])).toBe(30);
    expect(sumMinor([Number.MAX_SAFE_INTEGER, 1])).toBeNull();
    expect(sumMinor([1.5])).toBeNull();
    expect(isSafeMinor(-1)).toBe(false);
    expect(ratioBp(1, 3)).toBe(3333);
    expect(ratioBp(5, 0)).toBeNull();
    expect(ratioBp(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(10000);
    expect(overBy(150, 100)).toBe(50);
    expect(overBy(50, 100)).toBe(0);
  });
});

const base: GateInput = {
  paymentType: "INTERIM", amountMinor: 1_000, projectStatus: "ACTIVE", contractor: { status: "ACTIVE" }, hasAssignment: true,
  budgetMinor: 10_000, paidMinor: 2_000, approvedUnpaidMinor: 1_000, alreadyCountedMinor: 0, contractValueMinor: 8_000, assignmentCumulativeMinor: 3_000,
  duplicateInvoice: false, progress: { valueBp: 5000, basis: "VERIFIED_INSPECTION" }, actorIsRequester: false,
};
const status = (i: Partial<GateInput>, key: string) => evaluateGates({ ...base, ...i }).find((g) => g.key === key)!.status;

describe("payment gates", () => {
  it("all pass for a healthy request", () => {
    const g = evaluateGates(base);
    expect(blocked(g)).toEqual([]);
    expect(warnings(g)).toEqual([]);
  });
  it("project eligibility, including ON_HOLD by type", () => {
    for (const s of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "CANCELLED"]) expect(status({ projectStatus: s }, "PROJECT_ELIGIBLE")).toBe("BLOCK");
    expect(status({ projectStatus: "ON_HOLD" }, "PROJECT_ELIGIBLE")).toBe("BLOCK");
    expect(status({ projectStatus: "ON_HOLD", paymentType: "FINAL" }, "PROJECT_ELIGIBLE")).toBe("PASS");
    expect(status({ projectStatus: "COMPLETED" }, "PROJECT_ELIGIBLE")).toBe("PASS");
  });
  it("contractor eligibility", () => {
    for (const s of ["SUSPENDED", "ARCHIVED", "INACTIVE"]) expect(status({ contractor: { status: s } }, "CONTRACTOR_ELIGIBLE")).toBe("BLOCK");
    expect(status({ hasAssignment: false }, "CONTRACTOR_ELIGIBLE")).toBe("BLOCK");
    expect(status({ contractor: null }, "CONTRACTOR_ELIGIBLE")).toBe("BLOCK");
  });
  it("budget headroom is exact at the boundary and ignores the payment's own prior count at approval", () => {
    expect(status({ amountMinor: 7_000 }, "BUDGET_HEADROOM")).toBe("PASS"); // 2000 + 1000 + 7000 = 10000
    expect(status({ amountMinor: 7_001 }, "BUDGET_HEADROOM")).toBe("BLOCK");
    expect(status({ amountMinor: 7_000, alreadyCountedMinor: 7_000, approvedUnpaidMinor: 8_000 }, "BUDGET_HEADROOM")).toBe("PASS"); // re-evaluated at approval: own amount not counted twice
    expect(status({ amountMinor: 7_001, alreadyCountedMinor: 7_001, approvedUnpaidMinor: 8_001 }, "BUDGET_HEADROOM")).toBe("BLOCK");
    expect(status({ budgetMinor: 0 }, "BUDGET_HEADROOM")).toBe("BLOCK");
  });
  it("contract cap warns, never blocks, and is skipped without a contract value", () => {
    expect(status({ amountMinor: 5_000 }, "CONTRACT_CAP")).toBe("PASS"); // 3000 + 5000 = 8000
    expect(status({ amountMinor: 5_001 }, "CONTRACT_CAP")).toBe("WARN");
    expect(status({ contractValueMinor: null }, "CONTRACT_CAP")).toBe("SKIPPED");
  });
  it("duplicate invoice and maker-checker block", () => {
    expect(status({ duplicateInvoice: true }, "DUPLICATE_INVOICE")).toBe("BLOCK");
    expect(status({ actorIsRequester: true }, "MAKER_CHECKER")).toBe("BLOCK");
    expect(status({ actorIsRequester: null }, "MAKER_CHECKER")).toBe("SKIPPED");
  });
  it("progress support: only interim/final, 10-point tolerance, basis wording, final completeness", () => {
    expect(status({ paymentType: "ADVANCE" }, "PROGRESS_SUPPORT")).toBe("SKIPPED");
    expect(status({ amountMinor: 2_000 }, "PROGRESS_SUPPORT")).toBe("PASS"); // (2000+1000+2000)/10000 = 50% vs 50%
    expect(status({ amountMinor: 3_100 }, "PROGRESS_SUPPORT")).toBe("WARN"); // 61%
    const reported = evaluateGates({ ...base, amountMinor: 3_100, progress: { valueBp: 5000, basis: "REPORTED_UNVERIFIED" } }).find((g) => g.key === "PROGRESS_SUPPORT")!;
    expect(reported.message).toMatch(/not verified/);
    expect(status({ progress: { valueBp: null, basis: "NONE" } }, "PROGRESS_SUPPORT")).toBe("WARN");
    expect(status({ paymentType: "FINAL", amountMinor: 100, progress: { valueBp: 9000, basis: "VERIFIED_INSPECTION" }, paidMinor: 8_000, approvedUnpaidMinor: 0 }, "PROGRESS_SUPPORT")).toBe("WARN");
    expect(status({ paymentType: "FINAL", amountMinor: 100, projectStatus: "COMPLETED", progress: { valueBp: 9000, basis: "VERIFIED_INSPECTION" }, paidMinor: 8_000, approvedUnpaidMinor: 0 }, "PROGRESS_SUPPORT")).toBe("PASS");
  });
});

describe("state machines", () => {
  const legal: [PaymentStatus, PaymentAction, PaymentStatus][] = [["PENDING", "approve", "APPROVED"], ["PENDING", "reject", "REJECTED"], ["PENDING", "cancel", "CANCELLED"], ["APPROVED", "cancel", "CANCELLED"], ["APPROVED", "mark-paid", "PAID"], ["PAID", "reverse", "REVERSED"]];
  it("allows exactly the documented payment transitions", () => {
    for (const [from, action, to] of legal) expect(nextPaymentStatus(from, action)).toBe(to);
    const all: PaymentStatus[] = ["PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED", "REVERSED"];
    const actions: PaymentAction[] = ["approve", "reject", "cancel", "mark-paid", "reverse"];
    let count = 0;
    for (const f of all) for (const a of actions) if (nextPaymentStatus(f, a)) count += 1;
    expect(count).toBe(legal.length);
    expect(nextPaymentStatus("PAID", "cancel")).toBeNull();
    expect(nextPaymentStatus("APPROVED", "approve")).toBeNull();
    for (const t of ["REJECTED", "CANCELLED", "REVERSED"] as const) for (const a of actions) expect(nextPaymentStatus(t, a)).toBeNull();
  });
  it("duplicate guard coverage follows the status", () => {
    expect(dupActiveFor("PENDING")).toBe(true);
    expect(dupActiveFor("PAID")).toBe(true);
    for (const s of ["REJECTED", "CANCELLED", "REVERSED"] as const) expect(dupActiveFor(s)).toBe(false);
  });
  it("expense transitions", () => {
    expect(nextExpenseStatus("DRAFT", "submit")).toBe("PENDING_VERIFICATION");
    expect(nextExpenseStatus("REJECTED", "submit")).toBe("PENDING_VERIFICATION");
    expect(nextExpenseStatus("PENDING_VERIFICATION", "verify")).toBe("VERIFIED");
    expect(nextExpenseStatus("PENDING_VERIFICATION", "reject")).toBe("REJECTED");
    expect(nextExpenseStatus("VERIFIED", "reverse")).toBe("REVERSED");
    for (const s of ["VERIFIED", "REVERSED"] as ExpenseStatus[]) expect(nextExpenseStatus(s, "submit")).toBeNull();
    expect(nextExpenseStatus("DRAFT", "verify")).toBeNull();
    expect(expenseDupActiveFor("VERIFIED")).toBe(true);
    expect(expenseDupActiveFor("DRAFT")).toBe(false);
    expect(expenseEditable("VERIFIED")).toBe(false);
    expect(expenseEditable("REJECTED")).toBe(true);
  });
});

const now = new Date("2026-06-01T00:00:00Z");
const intel = (p: Partial<IntelInput> = {}): IntelInput => ({
  budgetMinor: 100_000, paidMinor: 0, approvedUnpaidMinor: 0, pendingMinor: 0, oldestPendingAt: null, verifiedExpensesMinor: 0, allocations: [], expenseByCategory: {}, contractOverruns: [],
  revisionPending: false, progress: { valueBp: null, basis: "NONE", asOf: null, sourceRef: null }, now, ...p,
});
const flags = (p: Partial<IntelInput>) => { const r = evaluateFinance(intel(p)); return r.flags.map((f) => `${f.code}:${f.severity}:${f.confidence}`); };

describe("finance intelligence", () => {
  it("zero or missing budget is unavailable, never 0%", () => {
    expect(evaluateFinance(intel({ budgetMinor: 0 }))).toMatchObject({ available: false, reason: "missing_budget" });
    expect(evaluateFinance(intel({ budgetMinor: null, revisionPending: true })).flags.map((f) => f.code)).toEqual(["BUDGET_REVISION_PENDING"]);
  });
  it("integer maths: utilization, financial progress, remaining, overrun, big values", () => {
    const r = evaluateFinance(intel({ paidMinor: 25_000, approvedUnpaidMinor: 10_000, pendingMinor: 5_000 }));
    expect(r).toMatchObject({ available: true, committedMinor: 35_000, exposureMinor: 40_000, utilizationBp: 3500, financialProgressBp: 2500, remainingMinor: 65_000, overrunMinor: 0 });
    const big = evaluateFinance(intel({ budgetMinor: Number.MAX_SAFE_INTEGER, paidMinor: Number.MAX_SAFE_INTEGER }));
    expect(big).toMatchObject({ available: true, utilizationBp: 10000 });
    expect(evaluateFinance(intel({ paidMinor: 120_000 }))).toMatchObject({ overrunMinor: 20_000, remainingMinor: 0 });
  });
  it("budget flags and thresholds", () => {
    expect(flags({ paidMinor: 100_001 })).toContain("OVER_BUDGET_COMMITMENT:HIGH:CONFIRMED");
    expect(flags({ approvedUnpaidMinor: 95_000 }).some((f) => f.startsWith("NEAR_BUDGET:MEDIUM"))).toBe(true);
    expect(flags({ approvedUnpaidMinor: 80_000 }).some((f) => f.startsWith("NEAR_BUDGET:LOW"))).toBe(true);
    expect(flags({ approvedUnpaidMinor: 79_999 }).some((f) => f.startsWith("NEAR_BUDGET"))).toBe(false);
  });
  it("spend ahead of progress is CONFIRMED only on verified basis and INDICATIVE otherwise", () => {
    const verified = { valueBp: 2000, basis: "VERIFIED_INSPECTION" as const, asOf: now, sourceRef: "i1" };
    const reported = { ...verified, basis: "REPORTED_UNVERIFIED" as const };
    expect(flags({ paidMinor: 35_000, progress: verified })).toContain("SPEND_AHEAD_OF_PROGRESS:MEDIUM:CONFIRMED");
    expect(flags({ paidMinor: 45_000, progress: verified })).toContain("SPEND_AHEAD_OF_PROGRESS:HIGH:CONFIRMED");
    expect(flags({ paidMinor: 35_000, progress: reported })).toContain("SPEND_AHEAD_OF_PROGRESS:MEDIUM:INDICATIVE");
    expect(flags({ paidMinor: 29_999, progress: verified }).some((f) => f.startsWith("SPEND_AHEAD"))).toBe(false);
    expect(flags({ paidMinor: 35_000, progress: reported }).some((f) => f.startsWith("PAYMENT_WITHOUT_VERIFIED_PROGRESS"))).toBe(true);
    expect(flags({ paidMinor: 35_000, progress: verified }).some((f) => f.startsWith("PAYMENT_WITHOUT_VERIFIED_PROGRESS"))).toBe(false);
    expect(flags({ paidMinor: 1_000 }).some((f) => f.startsWith("PAYMENT_WITHOUT_VERIFIED_PROGRESS"))).toBe(true); // no progress at all
    expect(flags({ paidMinor: 0 }).some((f) => f.startsWith("PAYMENT_WITHOUT_VERIFIED_PROGRESS"))).toBe(false);
  });
  it("physical ahead of spend, gap value and no gap without progress", () => {
    const p = { valueBp: 6000, basis: "VERIFIED_INSPECTION" as const, asOf: now, sourceRef: "i1" };
    const r = evaluateFinance(intel({ paidMinor: 10_000, progress: p }));
    expect(r).toMatchObject({ gapTenths: -500 });
    expect(r.flags.map((f) => f.code)).toContain("PHYSICAL_AHEAD_OF_SPEND");
    expect(evaluateFinance(intel({ paidMinor: 10_000 }))).toMatchObject({ gapTenths: null });
  });
  it("cost-efficiency index only on verified basis with at least 5% on both sides", () => {
    const v = (bp: number) => ({ valueBp: bp, basis: "VERIFIED_INSPECTION" as const, asOf: now, sourceRef: "i" });
    expect(evaluateFinance(intel({ paidMinor: 50_000, progress: v(4000) }))).toMatchObject({ cei: { status: "OK", hundredths: 80 } });
    expect(evaluateFinance(intel({ paidMinor: 4_000, progress: v(4000) }))).toMatchObject({ cei: { status: "INSUFFICIENT_EVIDENCE" } });
    expect(evaluateFinance(intel({ paidMinor: 50_000, progress: { ...v(4000), basis: "REPORTED_UNVERIFIED" } }))).toMatchObject({ cei: { status: "INSUFFICIENT_EVIDENCE" } });
    expect(evaluateFinance(intel({ paidMinor: 50_000, progress: v(T.ceiMinBp - 1) }))).toMatchObject({ cei: { status: "INSUFFICIENT_EVIDENCE" } });
  });
  it("backlog, contract overrun, unallocated, category overspend and pending revision", () => {
    expect(flags({ pendingMinor: 5, oldestPendingAt: new Date("2026-05-10T00:00:00Z") })).toContain("PENDING_PAYMENT_BACKLOG:LOW:CONFIRMED");
    expect(flags({ pendingMinor: 5, oldestPendingAt: new Date("2026-05-25T00:00:00Z") }).some((f) => f.startsWith("PENDING_PAYMENT_BACKLOG"))).toBe(false);
    expect(flags({ contractOverruns: [{ assignmentId: "a", overByMinor: 10 }] }).some((f) => f.startsWith("CONTRACT_VALUE_EXCEEDED"))).toBe(true);
    expect(flags({ allocations: [{ category: "MATERIALS", amountMinor: 50_000 }] }).some((f) => f.startsWith("LARGE_UNALLOCATED_BUDGET"))).toBe(true);
    expect(flags({ allocations: [{ category: "MATERIALS", amountMinor: 80_000 }] }).some((f) => f.startsWith("LARGE_UNALLOCATED_BUDGET"))).toBe(false);
    expect(flags({ allocations: [{ category: "MATERIALS", amountMinor: 50_000 }], expenseByCategory: { MATERIALS: 50_001 } }).some((f) => f.startsWith("CATEGORY_OVERSPEND"))).toBe(true);
    expect(flags({ revisionPending: true })).toContain("BUDGET_REVISION_PENDING:INFO:CONFIRMED");
  });
  it("flags sort most severe first and carry a formula key", () => {
    const r = evaluateFinance(intel({ paidMinor: 120_000, revisionPending: true }));
    expect(r.flags[0]!.severity).toBe("HIGH");
    expect(r.flags.every((f) => f.formulaKey.startsWith("f1."))).toBe(true);
  });
});

describe("counter", () => {
  it("is exported for atomic numbering", () => {
    expect(typeof nextNumber).toBe("function");
    expect(Counter.collection.name).toBe("counters");
  });
});
