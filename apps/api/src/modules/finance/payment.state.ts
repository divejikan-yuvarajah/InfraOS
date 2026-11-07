/** Payment state machine. Terminal states have no outgoing edge; every write names the expected current status in its filter. */
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED" | "REVERSED";
export type PaymentAction = "approve" | "reject" | "cancel" | "mark-paid" | "reverse";

const EDGES: Record<PaymentAction, Partial<Record<PaymentStatus, PaymentStatus>>> = {
  approve: { PENDING: "APPROVED" },
  reject: { PENDING: "REJECTED" },
  cancel: { PENDING: "CANCELLED", APPROVED: "CANCELLED" },
  "mark-paid": { APPROVED: "PAID" },
  reverse: { PAID: "REVERSED" },
};

export const PAYMENT_ACTIONS = Object.keys(EDGES) as PaymentAction[];
export const nextPaymentStatus = (from: string, action: PaymentAction): PaymentStatus | null => EDGES[action][from as PaymentStatus] ?? null;
export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = ["REJECTED", "CANCELLED", "REVERSED"];
/** Statuses that count toward the duplicate-invoice guard. */
export const dupActiveFor = (status: PaymentStatus): boolean => !TERMINAL_PAYMENT_STATUSES.includes(status);

/** Amounts by status for the totals the whole module shares. */
export const COMMITTED_STATUSES: readonly PaymentStatus[] = ["APPROVED", "PAID"];

export type ExpenseStatus = "DRAFT" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "REVERSED";
export type ExpenseAction = "submit" | "verify" | "reject" | "reverse";
const EXPENSE_EDGES: Record<ExpenseAction, Partial<Record<ExpenseStatus, ExpenseStatus>>> = {
  submit: { DRAFT: "PENDING_VERIFICATION", REJECTED: "PENDING_VERIFICATION" },
  verify: { PENDING_VERIFICATION: "VERIFIED" },
  reject: { PENDING_VERIFICATION: "REJECTED" },
  reverse: { VERIFIED: "REVERSED" },
};
export const nextExpenseStatus = (from: string, action: ExpenseAction): ExpenseStatus | null => EXPENSE_EDGES[action][from as ExpenseStatus] ?? null;
export const expenseDupActiveFor = (status: ExpenseStatus): boolean => status === "PENDING_VERIFICATION" || status === "VERIFIED";
export const expenseEditable = (status: string): boolean => status === "DRAFT" || status === "REJECTED";
