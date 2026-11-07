/** Wire types for the finance API (Steps 95-97). Money is always integer LKR cents. */
export const CATEGORIES = ["CIVIL_WORKS", "MATERIALS", "LABOUR", "EQUIPMENT", "DESIGN_SUPERVISION", "UTILITY_RELOCATION", "CONTINGENCY", "ADMIN_OVERHEAD", "OTHER"] as const;
export const PAYMENT_TYPES = ["ADVANCE", "INTERIM", "FINAL", "RETENTION", "OTHER"] as const;
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED", "REVERSED"] as const;
export const EXPENSE_STATUSES = ["DRAFT", "PENDING_VERIFICATION", "VERIFIED", "REJECTED", "REVERSED"] as const;
export const FLAG_CODES = ["OVER_BUDGET_COMMITMENT", "NEAR_BUDGET", "SPEND_AHEAD_OF_PROGRESS", "PAYMENT_WITHOUT_VERIFIED_PROGRESS", "PENDING_PAYMENT_BACKLOG", "CONTRACT_VALUE_EXCEEDED", "LARGE_UNALLOCATED_BUDGET", "PHYSICAL_AHEAD_OF_SPEND", "BUDGET_REVISION_PENDING", "CATEGORY_OVERSPEND"] as const;
export const GATE_KEYS = ["PROJECT_ELIGIBLE", "CONTRACTOR_ELIGIBLE", "BUDGET_HEADROOM", "CONTRACT_CAP", "DUPLICATE_INVOICE", "PROGRESS_SUPPORT", "MAKER_CHECKER"] as const;

export type Category = (typeof CATEGORIES)[number];
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type FlagCode = (typeof FLAG_CODES)[number];
export type GateKey = (typeof GATE_KEYS)[number];
export type Basis = "VERIFIED_INSPECTION" | "REPORTED_UNVERIFIED" | "NONE";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH";
export type Confidence = "CONFIRMED" | "INDICATIVE";

export type Gate = { key: GateKey; status: "PASS" | "WARN" | "BLOCK" | "SKIPPED"; message: string; values: Record<string, string | number | null> };
export type Flag = { code: FlagCode; severity: Severity; confidence: Confidence; reason: string; params: Record<string, string | number>; formulaKey: string };

export type Intelligence =
  | { available: false; reason: "missing_budget"; ruleVersion: string; flags: Flag[] }
  | {
      available: true; ruleVersion: string; committedMinor: number; exposureMinor: number; remainingMinor: number; overrunMinor: number; utilizationBp: number; financialProgressBp: number;
      physicalBp: number | null; basis: Basis; asOf: string | null; sourceRef: string | null; gapTenths: number | null; cei: { status: "OK"; hundredths: number } | { status: "INSUFFICIENT_EVIDENCE" };
      unallocatedMinor: number; flags: Flag[]; inputs: Record<string, number | string | null>;
    };

export type FlagLite = { code: FlagCode; severity: Severity; confidence: Confidence };
export type PortfolioRow = {
  id: string; code: string; title: string; status: string; agencyId: string; contractor: string | null; budgetMinor: number; paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number; committedMinor: number;
  utilizationBp: number | null; financialBp: number | null; physicalBp: number | null; basis: Basis; gapTenths: number | null; flags: FlagLite[];
};
export type PortfolioList = { rows: PortfolioRow[]; total: number; page: number; limit: number; truncated: boolean; cap: number };
export type Summary = {
  scope: string; projects: number; truncated: boolean;
  totals: { budgetMinor: number; committedMinor: number; paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number; remainingMinor: number; utilizationBp: number | null };
  counts: { overBudget: number; nearBudget: number; flagged: number };
  inbox: { payments: number | null; expenses: number | null; revisions: number | null; revisionProjects: { projectId: string; code: string; sequence: number }[] };
  recent: { kind: "payment" | "expense"; id: string; number: string | null; projectCode: string; amountMinor: number; status: string; at: string }[];
  topFlags: { projectId: string; code: string; title: string; flag: { code: FlagCode; severity: Severity; confidence: Confidence; params: Record<string, string | number> } }[];
};

export type ProjectFinance = {
  project: { id: string; code: string; title: string; status: string };
  totals: { budgetMinor: number; paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number; verifiedExpensesMinor: number };
  allocations: { category: Category; amountMinor: number; spentMinor: number }[]; expensesByCategory: Record<string, number>; intelligence: Intelligence;
  strip: { assignmentId: string; contractorId: string; contractor: string | null; role: string; status: string; contractValueMinor: number | null; committedMinor: number }[];
  actions: { paymentsToApprove: number | null; expensesToVerify: number | null }; revisionPending: boolean;
  series: { cumulativePaid: { at: string; paidMinor: number; bp: number | null }[]; reported: { at: string; pct: number }[]; verified: { at: string; pct: number }[] };
  can: { revise: boolean; requestPayment: boolean; addExpense: boolean };
};

export type Revision = {
  id: string; sequence: number; kind: "INITIAL" | "REVISION"; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"; previousTotalMinor: number; newTotalMinor: number; deltaMinor: number;
  allocations: { category: Category; amountMinor: number }[]; reason: string | null; requestedBy: string | null; requestedAt: string; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null; canDecide: boolean; canCancel: boolean;
};
export type Revisions = { currentTotalMinor: number; revisions: Revision[]; expensesByCategory: Record<string, number> };
export type Impact = {
  currentTotalMinor: number; proposedTotalMinor: number; committedMinor: number; paidMinor: number; approvedUnpaidMinor: number; pendingMinor: number; newUtilizationBp: number | null;
  newRemainingMinor: number; allocatedMinor: number; unallocatedMinor: number; blocking: { code: string; belowByMinor?: number }[];
};

export type ExpenseCan = { edit: boolean; submit: boolean; verify: boolean; reject: boolean; reverse: boolean };
export type Expense = {
  id: string; expenseNo: string; projectId: string; project: { code: string; title: string }; category: Category; description: string; expenseDate: string; amountMinor: number; currency: string;
  contractor: { id: string; name: string | null } | null; assignmentId: string | null; supplierName: string | null; supportingRef: string; documentCount: number; status: ExpenseStatus;
  submittedAt: string | null; verifiedBy: string | null; verifiedAt: string | null; rejectionReason: string | null; reversal: { by: string | null; at: string; reason: string } | null; createdBy: string | null; createdAt: string | null; can: ExpenseCan;
};
export type ExpenseList = { rows: Expense[]; total: number; page: number; limit: number; counts: Record<string, number>; needsMyVerification: number | null };

export type PaymentCan = { edit: boolean; approve: boolean; reject: boolean; cancel: boolean; markPaid: boolean; reverse: boolean };
export type Payment = {
  id: string; paymentNo: string | null; projectId: string; project: { code: string; title: string; status: string }; contractor: { id: string; name: string; status: string } | null; assignmentId: string | null;
  paymentType: PaymentType; status: PaymentStatus; amountMinor: number; currency: string; invoiceReference: string | null; description: string | null; date: string; requestedAt: string | null; decidedAt: string | null;
  decisionNote: string | null; paidAt: string | null; paymentReference: string | null; cancelReason: string | null; reversal: { by: string | null; at: string; reason: string } | null;
  createdBy: string | null; approvedBy: string | null; paidBy: string | null; can: PaymentCan;
};
export type PaymentDetail = Payment & { gates: Gate[]; contractCap: { contractValueMinor: number | null; cumulativeMinor: number } | null; timeline: { action: string; at: string; by: string | null; status: string | null; note: string | null }[] };
export type PaymentList = { rows: Payment[]; total: number; page: number; limit: number; counts: Record<string, number>; needsMyApproval: number | null };
export type GatePreview = { gates: Gate[]; canSubmit: boolean; hasWarnings: boolean };

export type LedgerEvent = { key: string; type: "budget" | "expense" | "payment"; event: string; at: string; number: string | null; amountMinor: number; status: string; runningCommittedMinor: number; runningPaidMinor: number; runningSpentMinor: number; reversalOf?: string };
export type Ledger = { events: LedgerEvent[]; nextCursor: string | null };
export type ContractorFinance = { paidMinor: number; pendingMinor: number; approvedUnpaidMinor: number; projects: number; overCapAssignments: number; paidWithoutVerifiedProgress: number; basedOn: string };
