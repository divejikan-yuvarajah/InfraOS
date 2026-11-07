"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { downloadCsv, fetchExpenses } from "@/lib/finance/api";
import { getFinanceCopy } from "@/lib/finance/messages";
import { canHintFinance, useFinanceKeys } from "@/lib/finance/session";
import { CATEGORIES } from "@/lib/finance/types";
import { EXPENSE_TABS, expenseTabQuery, parseExpenseTab, useUrlParams } from "@/lib/finance/url-state";
import { fill } from "@/lib/finance/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/site-plan-projects.css";
import "@/styles/contractors.css";
import "@/styles/finance.css";

import { ExpenseDrawer, ExpensesTable } from "./finance-drawers";

/** Cross-project expense register: same pattern as the payment queue, with a "Needs verification" tab that excludes the viewer's own submissions. */
export function ExpenseRegister() {
  const url = useUrlParams();
  const keys = useFinanceKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getFinanceCopy(locale);
  const [open, setOpen] = useState<string | null>(null);
  const tab = parseExpenseTab(url.get("tab") || null, true);
  const [search, setSearch] = useState(url.get("q"));
  const category = url.get("category"), from = url.get("from"), to = url.get("to"), page = url.page, limit = 20;
  const request = { ...expenseTabQuery(tab), category: category || undefined, dateFrom: from || undefined, dateTo: to || undefined, q: url.get("q") || undefined, page, limit };
  const q = useQuery({ queryKey: keys.key("register", JSON.stringify(request)), queryFn: ({ signal }) => fetchExpenses(request, signal), retry: false, placeholderData: (p) => p });
  const exp = useMutation({ mutationFn: () => downloadCsv("expenses", { ...(category ? { category } : {}), ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}), ...(url.get("q") ? { q: url.get("q") } : {}) }), onSuccess: (n) => toast.success(fill(copy.dashboard.exported, { n })), onError: () => toast.error(copy.dashboard.exportFailed) });
  const counts = q.data?.counts ?? {};
  const count = (t: (typeof EXPENSE_TABS)[number]) => t === "needs" ? q.data?.needsMyVerification : t === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t === "draft" ? "DRAFT" : t.toUpperCase()];
  const error = q.error instanceof ApiError ? (q.error.status === 403 ? copy.common.forbidden : copy.common.unavailable) : q.error ? copy.common.unavailable : null;
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / limit));
  return (
    <StaffWorkspaceShell title={copy.expenses.register} wide context={<ContextBar crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title, href: "/finance" }, { label: copy.expenses.register }]} actions={canHintFinance(keys.roleKey) ? <button type="button" className="ctr-btn" disabled={exp.isPending} onClick={() => exp.mutate()}><DownloadIcon aria-hidden="true" />{copy.dashboard.exportExpenses}</button> : null} />}>
      <div className="ctr">
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}
        <div className="fin-tabs" role="group" aria-label={copy.expenses.status}>
          {EXPENSE_TABS.filter((t) => t !== "needs" || q.data?.needsMyVerification !== null).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => url.set({ tab: t })}>{copy.expenses.tabs[t]}{count(t) ? ` (${count(t)})` : ""}</button>)}
        </div>
        <form className="sp-surface ctr-filters" onSubmit={(e) => { e.preventDefault(); url.set({ q: search }); }} aria-label={copy.expenses.register}>
          <div className="ctr-filter-row">
            <div className="ctr-field is-wide"><label htmlFor="er-q">{copy.expenses.filters.search}</label><input id="er-q" className="ctr-input" value={search} maxLength={60} onChange={(e) => setSearch(e.target.value)} onBlur={() => url.set({ q: search })} /></div>
            <div className="ctr-field"><label htmlFor="er-cat">{copy.expenses.filters.category}</label><select id="er-cat" className="ctr-input" value={category} onChange={(e) => url.set({ category: e.target.value })}><option value="">{copy.common.any}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{copy.category[c]}</option>)}</select></div>
            <div className="ctr-field"><label htmlFor="er-from">{copy.expenses.filters.dateFrom}</label><input id="er-from" type="date" className="ctr-input" value={from} onChange={(e) => url.set({ from: e.target.value })} /></div>
            <div className="ctr-field"><label htmlFor="er-to">{copy.expenses.filters.dateTo}</label><input id="er-to" type="date" className="ctr-input" value={to} onChange={(e) => url.set({ to: e.target.value })} /></div>
            <button type="button" className="ctr-btn" onClick={() => { setSearch(""); url.set({ q: null, category: null, from: null, to: null }); }}>{copy.common.clearAll}</button>
          </div>
        </form>
        <p className="ctr-small" role="status" aria-live="polite">{q.data ? fill(copy.dashboard.table.count, { n: q.data.total }) : " "}</p>
        {q.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
        {error ? <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{error}</p><div><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div></div> : null}
        {q.data && q.data.rows.length === 0 ? <div className="sp-surface ctr-panel" role="status"><p>{tab === "all" && !category && !from && !to && !url.get("q") ? copy.expenses.empty : copy.expenses.noMatch}</p></div> : null}
        {q.data?.rows.length ? <div className="sp-surface ctr-panel"><ExpensesTable rows={q.data.rows} copy={copy} locale={locale} onOpen={setOpen} showProject /></div> : null}
        {pages > 1 ? (
          <div className="ctr-row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="ctr-btn" disabled={page <= 1} onClick={() => url.set({ page: String(page - 1) })}>{copy.common.previous}</button>
            <span className="ctr-small">{copy.common.page} {page} {copy.common.of} {pages}</span>
            <button type="button" className="ctr-btn" disabled={page >= pages} onClick={() => url.set({ page: String(page + 1) })}>{copy.common.next}</button>
          </div>
        ) : null}
      </div>
      <ExpenseDrawer id={open} onClose={() => setOpen(null)} copy={copy} locale={locale} />
    </StaffWorkspaceShell>
  );
}
