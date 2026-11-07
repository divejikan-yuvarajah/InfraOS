import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import type { ContractorFinance, ExpenseList, GatePreview, Impact, Ledger, PaymentDetail, PaymentList, PortfolioList, ProjectFinance, Revisions, Summary, Expense } from "./types";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}
function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
}

type Method = "GET" | "POST" | "PATCH";
/** One request with the session guard: a result that arrives after sign-out or a user switch is discarded. Amounts are never logged. */
async function call<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1/finance${path}`, { method, authenticated: true, ...(body !== undefined ? { body } : {}), ...(signal ? { signal } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const fetchSummary = (q: Record<string, string | undefined>, signal?: AbortSignal) => call<Summary>("GET", `/summary${qs(q)}`, undefined, signal);
export const fetchPortfolio = (q: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) => call<PortfolioList>("GET", `/projects${qs(q)}`, undefined, signal);
export const fetchProjectFinance = (id: string) => call<ProjectFinance>("GET", `/projects/${id}`);
export const fetchLedger = (id: string, cursor?: string, type?: string) => call<Ledger>("GET", `/projects/${id}/ledger${qs({ cursor, type, limit: 25 })}`);
export const fetchRevisions = (id: string) => call<Revisions>("GET", `/projects/${id}/budget/revisions`);
export const previewRevision = (id: string, body: unknown, signal?: AbortSignal) => call<Impact>("POST", `/projects/${id}/budget/revisions/preview`, body, signal);
export const requestRevision = (id: string, body: unknown) => call<{ id: string; sequence: number }>("POST", `/projects/${id}/budget/revisions`, body);
export const decideRevision = (id: string, revId: string, action: "approve" | "reject" | "cancel", body: unknown = {}) => call<{ id: string; status: string }>("POST", `/projects/${id}/budget/revisions/${revId}/${action}`, body);

export const fetchExpenses = (q: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) => call<ExpenseList>("GET", `/expenses${qs(q)}`, undefined, signal);
export const fetchExpense = (id: string) => call<Expense>("GET", `/expenses/${id}`);
export const createExpense = (projectId: string, body: unknown) => call<{ id: string; expenseNo: string; warnings: string[] }>("POST", `/projects/${projectId}/expenses`, body);
export const updateExpense = (id: string, body: unknown) => call<{ id: string }>("PATCH", `/expenses/${id}`, body);
export const expenseAction = (id: string, action: "submit" | "verify" | "reject" | "reverse", body: unknown = {}) => call<{ id: string; status: string; expenseNo: string }>("POST", `/expenses/${id}/${action}`, body);

export const fetchPayments = (q: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) => call<PaymentList>("GET", `/payments${qs(q)}`, undefined, signal);
export const fetchPayment = (id: string) => call<PaymentDetail>("GET", `/payments/${id}`);
export const previewGates = (q: Record<string, string | undefined>, signal?: AbortSignal) => call<GatePreview>("GET", `/payments/preview-gates${qs(q)}`, undefined, signal);
export const requestPayment = (projectId: string, body: unknown) => call<{ id: string; paymentNo: string }>("POST", `/projects/${projectId}/payments`, body);
export const updatePayment = (id: string, body: unknown) => call<{ id: string }>("PATCH", `/payments/${id}`, body);
export const paymentAction = (id: string, action: "approve" | "reject" | "cancel" | "mark-paid" | "reverse", body: unknown = {}) => call<{ id: string; paymentNo: string | null; status: string }>("POST", `/payments/${id}/${action}`, body);
export const fetchContractorFinance = (id: string) => call<ContractorFinance>("GET", `/contractors/${id}/summary`);

/** Downloads a server-generated CSV with the bearer token and hands it to the browser as a file. The server prefixes formula-like cells. */
export async function downloadCsv(kind: "payments" | "expenses", filters: Record<string, string | undefined>): Promise<number> {
  const { atEpoch, tokenAtStart } = guard();
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/v1/finance/export/${kind}.csv${qs(filters)}`, { headers: { Authorization: `Bearer ${tokenAtStart}`, Accept: "text/csv" }, credentials: "omit" });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("export failed", res.status, {});
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${kind}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Number(res.headers.get("X-Row-Count") ?? 0);
}

export type FailureInfo = { status: number; kind: string | null; details: Record<string, unknown> };
export function failureOf(error: unknown): FailureInfo {
  if (error instanceof ApiError) {
    const d = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
    return { status: error.status, kind: typeof d.kind === "string" ? d.kind : null, details: d };
  }
  return { status: 0, kind: null, details: {} };
}
