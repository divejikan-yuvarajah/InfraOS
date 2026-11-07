"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Shareable list state: every filter lives in the query string and changing any filter (except page) resets the page. Values are plain strings. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (key: string, fallback = ""): string => params.get(key) ?? fallback;
  const set = (patch: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === "") sp.delete(k); else sp.set(k, v); }
    if (!("page" in patch)) sp.delete("page");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { get, set, page: Math.max(1, Math.min(10_000, Number(params.get("page")) || 1)), toString: () => params.toString() };
}

export type PaymentTab = "mine" | "pending" | "approved" | "paid" | "closed" | "reversed" | "all";
export const PAYMENT_TABS: readonly PaymentTab[] = ["mine", "pending", "approved", "paid", "closed", "reversed", "all"];
export const parsePaymentTab = (v: string | null | undefined, hasMine: boolean): PaymentTab => ((PAYMENT_TABS as readonly string[]).includes(v ?? "") ? (v as PaymentTab) : hasMine ? "mine" : "all");

/** Tab to the API's query: status tabs are server-side filters, never client-side hiding. */
export function paymentTabQuery(tab: PaymentTab): Record<string, string | boolean | undefined> {
  switch (tab) {
    case "mine": return { needsMyApproval: true };
    case "pending": return { status: "PENDING" };
    case "approved": return { status: "APPROVED" };
    case "paid": return { status: "PAID" };
    case "closed": return { status: "REJECTED,CANCELLED" };
    case "reversed": return { status: "REVERSED" };
    default: return {};
  }
}

export type ExpenseTab = "needs" | "draft" | "verified" | "rejected" | "reversed" | "all";
export const EXPENSE_TABS: readonly ExpenseTab[] = ["needs", "draft", "verified", "rejected", "reversed", "all"];
export const parseExpenseTab = (v: string | null | undefined, hasNeeds: boolean): ExpenseTab => ((EXPENSE_TABS as readonly string[]).includes(v ?? "") ? (v as ExpenseTab) : hasNeeds ? "needs" : "all");
export function expenseTabQuery(tab: ExpenseTab): Record<string, string | boolean | undefined> {
  switch (tab) {
    case "needs": return { needsMyVerification: true };
    case "draft": return { status: "DRAFT" };
    case "verified": return { status: "VERIFIED" };
    case "rejected": return { status: "REJECTED" };
    case "reversed": return { status: "REVERSED" };
    default: return {};
  }
}
