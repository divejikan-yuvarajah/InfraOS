import { overBy, ratioBp } from "./finance.money.js";
import type { ProgressBasis } from "./payment.gates.js";

/**
 * Budget-vs-progress intelligence (Step 97). Pure and integer-only. Verified progress drives CONFIRMED conclusions; reported progress is
 * always labelled "reported, not verified" and can only produce INDICATIVE ones. Missing budget or evidence is "unavailable", never 0.
 */
export const RULE_VERSION = "f1";
export const T = {
  nearBp: 8000, nearHighBp: 9500, gapMedPp: 10, gapHighPp: 20, aheadOfSpendPp: -20, pendingBacklogDays: 14, unallocatedBp: 3000,
  ceiMinBp: 500,
} as const;

export type Confidence = "CONFIRMED" | "INDICATIVE";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export type IntelInput = {
  budgetMinor: number | null;
  paidMinor: number;
  approvedUnpaidMinor: number;
  pendingMinor: number;
  oldestPendingAt: Date | null;
  verifiedExpensesMinor: number;
  allocations: { category: string; amountMinor: number }[];
  /** Verified, non-reversed expense totals by category. */
  expenseByCategory: Record<string, number>;
  contractOverruns: { assignmentId: string; overByMinor: number }[];
  revisionPending: boolean;
  progress: { valueBp: number | null; basis: ProgressBasis; asOf: Date | null; sourceRef: string | null };
  now: Date;
};

export type Flag = { code: string; severity: Severity; confidence: Confidence; reason: string; params: Record<string, string | number>; formulaKey: string };

export type Intel =
  | { available: false; reason: "missing_budget"; ruleVersion: string; flags: Flag[] }
  | {
      available: true; ruleVersion: string;
      committedMinor: number; exposureMinor: number; remainingMinor: number; overrunMinor: number;
      utilizationBp: number; financialProgressBp: number;
      physicalBp: number | null; basis: ProgressBasis; asOf: string | null; sourceRef: string | null;
      /** Percentage points, one decimal, as integer tenths (gapTenths 125 = 12.5 pp). Null without both sides. */
      gapTenths: number | null;
      cei: { status: "OK"; hundredths: number } | { status: "INSUFFICIENT_EVIDENCE" };
      unallocatedMinor: number; flags: Flag[];
      inputs: Record<string, number | string | null>;
    };

const flagOrder: Record<Severity, number> = { HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };

export function evaluateFinance(i: IntelInput): Intel {
  const flags: Flag[] = [];
  if (i.budgetMinor === null || i.budgetMinor <= 0) {
    if (i.revisionPending) flags.push({ code: "BUDGET_REVISION_PENDING", severity: "INFO", confidence: "CONFIRMED", reason: "A budget revision is waiting for approval.", params: {}, formulaKey: "f1.revisionPending" });
    return { available: false, reason: "missing_budget", ruleVersion: RULE_VERSION, flags };
  }
  const budget = i.budgetMinor;
  const committed = Number(BigInt(i.paidMinor) + BigInt(i.approvedUnpaidMinor));
  const exposure = Number(BigInt(committed) + BigInt(i.pendingMinor));
  const utilizationBp = ratioBp(committed, budget) ?? 0;
  const financialProgressBp = ratioBp(i.paidMinor, budget) ?? 0;
  const remaining = committed > budget ? 0 : budget - committed;
  const overrun = overBy(committed, budget);
  const phys = i.progress.valueBp;
  const verified = i.progress.basis === "VERIFIED_INSPECTION";
  const gapTenths = phys === null ? null : Math.trunc((financialProgressBp - phys) / 10);
  const confidence: Confidence = verified ? "CONFIRMED" : "INDICATIVE";
  const cei = verified && phys !== null && financialProgressBp >= T.ceiMinBp && phys >= T.ceiMinBp
    ? { status: "OK" as const, hundredths: Math.floor((phys * 100) / financialProgressBp) }
    : { status: "INSUFFICIENT_EVIDENCE" as const };
  const allocated = i.allocations.reduce((s, a) => s + BigInt(a.amountMinor), 0n);
  const unallocated = Number(BigInt(budget) - allocated);

  if (committed > budget) flags.push({ code: "OVER_BUDGET_COMMITMENT", severity: "HIGH", confidence: "CONFIRMED", reason: "Approved and paid payments exceed the approved budget.", params: { overByMinor: overrun }, formulaKey: "f1.utilization" });
  else if (utilizationBp >= T.nearHighBp) flags.push({ code: "NEAR_BUDGET", severity: "MEDIUM", confidence: "CONFIRMED", reason: "Committed spend is at or above 95% of the approved budget.", params: { utilizationBp }, formulaKey: "f1.utilization" });
  else if (utilizationBp >= T.nearBp) flags.push({ code: "NEAR_BUDGET", severity: "LOW", confidence: "CONFIRMED", reason: "Committed spend is at or above 80% of the approved budget.", params: { utilizationBp }, formulaKey: "f1.utilization" });

  if (gapTenths !== null && gapTenths >= T.gapMedPp * 10) {
    flags.push({ code: "SPEND_AHEAD_OF_PROGRESS", severity: gapTenths >= T.gapHighPp * 10 ? "HIGH" : "MEDIUM", confidence, reason: verified ? "Paid spend is ahead of verified physical progress." : "Paid spend looks ahead of reported progress (reported, not verified), so this is indicative only.", params: { gapTenths, financialBp: financialProgressBp, physicalBp: phys ?? 0 }, formulaKey: "f1.gap" });
  }
  if (gapTenths !== null && gapTenths <= T.aheadOfSpendPp * 10) {
    flags.push({ code: "PHYSICAL_AHEAD_OF_SPEND", severity: "INFO", confidence, reason: "Physical progress is well ahead of paid spend: there may be unbilled work.", params: { gapTenths }, formulaKey: "f1.gap" });
  }
  if (i.paidMinor > 0 && !verified) flags.push({ code: "PAYMENT_WITHOUT_VERIFIED_PROGRESS", severity: "MEDIUM", confidence: "CONFIRMED", reason: i.progress.basis === "NONE" ? "Payments were made but no physical progress is recorded." : "Payments were made but progress is only reported, not verified.", params: { basis: i.progress.basis }, formulaKey: "f1.basis" });
  if (i.oldestPendingAt && i.pendingMinor > 0 && Math.floor((i.now.getTime() - i.oldestPendingAt.getTime()) / 86_400_000) >= T.pendingBacklogDays) {
    flags.push({ code: "PENDING_PAYMENT_BACKLOG", severity: "LOW", confidence: "CONFIRMED", reason: "A payment request has been waiting more than 14 days.", params: { days: Math.floor((i.now.getTime() - i.oldestPendingAt.getTime()) / 86_400_000) }, formulaKey: "f1.backlog" });
  }
  for (const c of i.contractOverruns) flags.push({ code: "CONTRACT_VALUE_EXCEEDED", severity: "MEDIUM", confidence: "CONFIRMED", reason: "Payments to an assignment exceed its recorded contract value.", params: { overByMinor: c.overByMinor, assignmentId: c.assignmentId }, formulaKey: "f1.contractCap" });
  if (i.allocations.length > 0 && unallocated > 0 && (ratioBp(unallocated, budget) ?? 0) > T.unallocatedBp) {
    flags.push({ code: "LARGE_UNALLOCATED_BUDGET", severity: "INFO", confidence: "CONFIRMED", reason: "More than 30% of the budget is not allocated to a category.", params: { unallocatedMinor: unallocated }, formulaKey: "f1.unallocated" });
  }
  for (const a of i.allocations) {
    const spent = i.expenseByCategory[a.category] ?? 0;
    if (spent > a.amountMinor) flags.push({ code: "CATEGORY_OVERSPEND", severity: "MEDIUM", confidence: "CONFIRMED", reason: "Verified expenses in a category exceed its allocation.", params: { category: a.category, overByMinor: spent - a.amountMinor }, formulaKey: "f1.category" });
  }
  if (i.revisionPending) flags.push({ code: "BUDGET_REVISION_PENDING", severity: "INFO", confidence: "CONFIRMED", reason: "A budget revision is waiting for approval.", params: {}, formulaKey: "f1.revisionPending" });
  flags.sort((a, b) => flagOrder[b.severity] - flagOrder[a.severity]);

  return {
    available: true, ruleVersion: RULE_VERSION, committedMinor: committed, exposureMinor: exposure, remainingMinor: remaining, overrunMinor: overrun,
    utilizationBp, financialProgressBp, physicalBp: phys, basis: i.progress.basis, asOf: i.progress.asOf?.toISOString() ?? null, sourceRef: i.progress.sourceRef,
    gapTenths, cei, unallocatedMinor: unallocated, flags,
    inputs: { budgetMinor: budget, paidMinor: i.paidMinor, approvedUnpaidMinor: i.approvedUnpaidMinor, pendingMinor: i.pendingMinor, verifiedExpensesMinor: i.verifiedExpensesMinor },
  };
}
