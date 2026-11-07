"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { ApiError } from "@/lib/api/client";
import { downloadCsv, fetchPortfolio, fetchSummary } from "@/lib/finance/api";
import { formatLkr, percentFromBp, ppFromTenths } from "@/lib/finance/money";
import { getFinanceCopy, type Copy } from "@/lib/finance/messages";
import { canHintFinance, useFinanceKeys } from "@/lib/finance/session";
import { FLAG_CODES, type PortfolioRow } from "@/lib/finance/types";
import { useUrlParams } from "@/lib/finance/url-state";
import { DATE_PRESETS, fill, flagText, presetRange } from "@/lib/finance/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel } from "@/lib/projects/dashboard-view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/site-plan-projects.css";

import { SpendQuadrant } from "./spend-quadrant";
import { Chip, DualBar, MoneyText, PaymentChip, ExpenseChip, RecordingNote, SeverityChip } from "./finance-ui";
import type { PaymentStatus, ExpenseStatus } from "@/lib/finance/types";

const PROJECT_STATUSES = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"] as const;
const SORTS = ["code", "budget", "utilization", "gap"] as const;
type Common = { copy: Copy; locale: AuthLocale };

function Kpi({ label, hint, minor, bp, locale, copy, onClick, aria }: Common & { label: string; hint: string; minor: number | null; bp?: number | null; onClick?: () => void; aria: string }) {
  return (
    <button type="button" className="fin-kpi" onClick={onClick} aria-label={`${label}: ${minor === null ? copy.money.unavailable : formatLkr(minor, locale)}. ${aria}`}>
      <span className="fin-kpi-label">{label}</span>
      <span className="fin-kpi-value"><MoneyText minor={minor} locale={locale} compact copy={copy} /></span>
      {bp !== undefined ? <span className="fin-kpi-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (bp ?? 0) / 100)}%` }} /></span> : null}
      <span className="fin-kpi-hint">{hint}</span>
    </button>
  );
}

function ProjectDrawer({ row, copy, locale, onClose }: Common & { row: PortfolioRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{row?.code ?? copy.dashboard.drawer.title}</SheetTitle><SheetDescription>{row?.title}</SheetDescription></SheetHeader>
        {row ? (
          <div className="fin-drawer-body">
            <dl className="fin-kv">
              <dt>{copy.dashboard.table.budget}</dt><dd><MoneyText minor={row.budgetMinor} locale={locale} /></dd>
              <dt>{copy.dashboard.table.committed}</dt><dd><MoneyText minor={row.committedMinor} locale={locale} /></dd>
              <dt>{copy.dashboard.table.paid}</dt><dd><MoneyText minor={row.paidMinor} locale={locale} /></dd>
              <dt>{copy.kpi.pending}</dt><dd><MoneyText minor={row.pendingMinor} locale={locale} /></dd>
              <dt>{copy.dashboard.table.utilization}</dt><dd>{percentFromBp(row.utilizationBp)}</dd>
              <dt>{copy.intel.gap}</dt><dd>{row.gapTenths === null ? copy.intel.notEnough : ppFromTenths(row.gapTenths)}</dd>
              {row.contractor ? <><dt>{copy.dashboard.table.contractor}</dt><dd>{row.contractor}</dd></> : null}
            </dl>
            <DualBar financialBp={row.financialBp} physicalBp={row.physicalBp} basis={row.basis} copy={copy} />
            <div className="ctr-chips">
              {row.flags.length === 0 ? <span className="ctr-small">{copy.flags.none}</span> : row.flags.map((f) => <Chip key={f.code} tone={f.severity === "HIGH" ? "critical" : f.severity === "MEDIUM" ? "pending" : "neutral"}>{flagText(copy, { code: f.code, params: {} }, locale).label} · {copy.flags.confidence[f.confidence]}</Chip>)}
            </div>
            <Link className="ctr-btn is-primary" href={`/projects/${row.id}/finance`}>{copy.common.openFinance}</Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function FinanceDashboard() {
  const url = useUrlParams();
  const keys = useFinanceKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getFinanceCopy(locale);
  const dash = getDashboardCopy(locale);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [search, setSearch] = useState(url.get("q"));
  const canManage = keys.roleKey === "SUPER_ADMIN" || keys.roleKey === "GOV_ADMIN";

  const from = url.get("from"), to = url.get("to"), agency = url.get("agency");
  const summary = useQuery({ queryKey: keys.key("summary", from, to, agency), queryFn: ({ signal }) => fetchSummary({ dateFrom: from || undefined, dateTo: to || undefined, agencyId: agency || undefined }, signal), retry: false });
  const agencies = useQuery({ queryKey: keys.key("agencies"), queryFn: () => fetchAgencies({ page: 1 }), enabled: canManage, retry: false, staleTime: 60_000 });
  const status = url.get("status"), flag = url.get("flag"), basis = url.get("basis"), sort = (SORTS as readonly string[]).includes(url.get("sort")) ? url.get("sort") : "code", over = url.get("over") === "1", page = url.page;
  const request = { q: url.get("q") || undefined, agencyId: agency || undefined, status: status || undefined, flag: flag || undefined, overBudget: over || undefined, basis: basis || undefined, sort, page, limit: 20 };
  const table = useQuery({ queryKey: keys.key("portfolio", JSON.stringify(request)), queryFn: ({ signal }) => fetchPortfolio(request, signal), retry: false, placeholderData: (p) => p });
  // The quadrant plots the filtered portfolio (first 50 rows by the current sort), never invented points.
  const plot = useQuery({ queryKey: keys.key("portfolio-plot", JSON.stringify({ ...request, page: 1, limit: 50 })), queryFn: ({ signal }) => fetchPortfolio({ ...request, page: 1, limit: 50 }, signal), retry: false, placeholderData: (p) => p });
  const exp = useMutation({ mutationFn: (k: "payments" | "expenses") => downloadCsv(k, { dateFrom: from || undefined, dateTo: to || undefined, agencyId: k === "payments" ? agency || undefined : undefined }), onSuccess: (n) => toast.success(fill(copy.dashboard.exported, { n })), onError: () => toast.error(copy.dashboard.exportFailed) });
  const s = summary.data;
  const rows = table.data?.rows ?? [];
  const selectedRow = (plot.data?.rows ?? rows).find((r) => r.id === selected) ?? null;
  const pages = Math.max(1, Math.ceil((table.data?.total ?? 0) / 20));
  const statusLabel = (v: string) => dashboardStatusLabel(v, dash);
  const inboxTotal = (s?.inbox.payments ?? 0) + (s?.inbox.expenses ?? 0) + (s?.inbox.revisions ?? 0);
  const hasApprover = s ? s.inbox.payments !== null || s.inbox.expenses !== null || s.inbox.revisions !== null : false;
  const err = (e: unknown) => (e instanceof ApiError ? (e.status === 403 ? copy.common.forbidden : copy.common.unavailable) : e ? copy.common.unavailable : null);
  const preset = (p: (typeof DATE_PRESETS)[number]) => { const r = presetRange(p); url.set({ from: r.dateFrom ?? null, to: r.dateTo ?? null }); };
  const activePreset = DATE_PRESETS.find((p) => { const r = presetRange(p); return (r.dateFrom ?? "") === from && (r.dateTo ?? "") === to; });

  return (
    <StaffWorkspaceShell
      title={copy.dashboard.title}
      description={copy.subtitle}
      wide
      context={
        <ContextBar crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title }]} scope={s ? (s.scope === "platform" ? copy.scope.platform : copy.scope.agencies) : null}
          actions={canHintFinance(keys.roleKey) ? (
            <Popover>
              <PopoverTrigger asChild><button type="button" className="ctr-btn"><DownloadIcon aria-hidden="true" />{copy.dashboard.export}</button></PopoverTrigger>
              <PopoverContent align="end" className="w-56">
                <div className="ctr-menu" role="menu">
                  <button type="button" role="menuitem" disabled={exp.isPending} onClick={() => exp.mutate("payments")}>{copy.dashboard.exportPayments}</button>
                  <button type="button" role="menuitem" disabled={exp.isPending} onClick={() => exp.mutate("expenses")}>{copy.dashboard.exportExpenses}</button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null} />
      }
    >
      <div className="ctr" style={{ paddingBottom: hasApprover && inboxTotal > 0 ? "4.5rem" : undefined }}>
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}
        <RecordingNote copy={copy} />

        <form className="sp-surface ctr-filters" aria-label={copy.dashboard.dateRange} onSubmit={(e) => e.preventDefault()}>
          <div className="ctr-filter-row">
            <div className="ctr-field" role="group" aria-label={copy.dashboard.dateRange} style={{ flex: "2 1 18rem" }}>
              <span className="ctr-label">{copy.dashboard.dateRange}</span>
              <div className="fin-tabs">
                {DATE_PRESETS.map((p) => <button key={p} type="button" aria-pressed={activePreset === p} onClick={() => preset(p)}>{copy.dashboard.presets[p]}</button>)}
              </div>
            </div>
            <div className="ctr-field"><label htmlFor="fd-from">{copy.dashboard.from}</label><input id="fd-from" type="date" className="ctr-input" value={from} onChange={(e) => url.set({ from: e.target.value })} /></div>
            <div className="ctr-field"><label htmlFor="fd-to">{copy.dashboard.to}</label><input id="fd-to" type="date" className="ctr-input" value={to} onChange={(e) => url.set({ to: e.target.value })} /></div>
            {canManage ? (
              <div className="ctr-field"><label htmlFor="fd-agency">{copy.dashboard.agency}</label>
                <select id="fd-agency" className="ctr-input" value={agency} onChange={(e) => url.set({ agency: e.target.value })}><option value="">{copy.common.any}</option>{(agencies.data?.agencies ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            ) : null}
          </div>
        </form>

        {hasApprover && s ? (
          <section className="sp-surface ctr-panel" aria-label={copy.dashboard.inbox.title}>
            <h2>{copy.dashboard.inbox.title}</h2>
            {inboxTotal === 0 ? <p className="ctr-small">{copy.dashboard.inbox.none}</p> : (
              <div className="ctr-row">
                {s.inbox.payments ? <Link className="ctr-btn" href="/finance/payments?tab=mine">{fill(copy.dashboard.inbox.payments, { n: s.inbox.payments })} · {copy.dashboard.inbox.review}</Link> : null}
                {s.inbox.expenses ? <Link className="ctr-btn" href="/finance/expenses?tab=needs">{fill(copy.dashboard.inbox.expenses, { n: s.inbox.expenses })} · {copy.dashboard.inbox.review}</Link> : null}
                {s.inbox.revisionProjects.map((r) => <Link key={r.projectId} className="ctr-btn" href={`/projects/${r.projectId}/finance?tab=budget`}>{r.code} #{r.sequence} · {copy.dashboard.inbox.review}</Link>)}
                {s.inbox.revisions && s.inbox.revisions > s.inbox.revisionProjects.length ? <span className="ctr-small">{fill(copy.dashboard.inbox.revisions, { n: s.inbox.revisions })}</span> : null}
              </div>
            )}
            <p className="ctr-small">{copy.dashboard.inbox.own}</p>
          </section>
        ) : null}

        {summary.error ? <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{err(summary.error)}</p><div><button type="button" className="ctr-btn" onClick={() => void summary.refetch()}>{copy.common.retry}</button></div></div> : null}
        <section className="fin-kpis" aria-label={copy.title} aria-live="polite">
          {summary.isLoading ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="fin-kpi" aria-hidden="true"><span className="ctr-skel" style={{ height: "1rem", width: "60%" }} /><span className="ctr-skel" style={{ height: "1.5rem", width: "80%" }} /></div>) : s ? (
            <>
              <Kpi copy={copy} locale={locale} label={copy.kpi.budget} hint={copy.kpi.budgetHint} minor={s.totals.budgetMinor} aria={copy.kpi.filter} onClick={() => url.set({ sort: "budget" })} />
              <Kpi copy={copy} locale={locale} label={copy.kpi.committed} hint={`${copy.kpi.committedHint} · ${percentFromBp(s.totals.utilizationBp)}`} minor={s.totals.committedMinor} bp={s.totals.utilizationBp} aria={copy.kpi.filter} onClick={() => url.set({ sort: "utilization" })} />
              <Link href="/finance/payments?tab=paid" className="fin-kpi" style={{ textDecoration: "none" }}><span className="fin-kpi-label">{copy.kpi.paid}</span><span className="fin-kpi-value"><MoneyText minor={s.totals.paidMinor} locale={locale} compact copy={copy} /></span><span className="fin-kpi-hint">{copy.kpi.paidHint}</span></Link>
              <Link href="/finance/payments?tab=pending" className="fin-kpi" style={{ textDecoration: "none" }}><span className="fin-kpi-label">{copy.kpi.pending}</span><span className="fin-kpi-value"><MoneyText minor={s.totals.pendingMinor} locale={locale} compact copy={copy} /></span><span className="fin-kpi-hint">{copy.kpi.pendingHint}</span></Link>
              <Kpi copy={copy} locale={locale} label={copy.kpi.remaining} hint={copy.kpi.remainingHint} minor={s.totals.remainingMinor} aria={copy.kpi.filter} onClick={() => url.set({ over: "1" })} />
            </>
          ) : null}
        </section>
        {s?.truncated ? <p className="ctr-small">{fill(copy.dashboard.table.truncated, { n: 500 })}</p> : null}

        <section className="sp-surface ctr-panel" aria-label={copy.dashboard.quadrant.title}>
          <div className="ctr-bar"><h2>{copy.dashboard.quadrant.title}</h2>
            <button type="button" className="ctr-btn" onClick={() => setView(view === "chart" ? "table" : "chart")}>{view === "chart" ? copy.dashboard.quadrant.toTable : copy.dashboard.quadrant.toChart}</button></div>
          {plot.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : view === "chart" ? <SpendQuadrant rows={plot.data?.rows ?? []} copy={copy} onSelect={setSelected} selectedId={selected} /> : <p className="ctr-small">{copy.dashboard.table.title}: {plot.data?.total ?? 0}</p>}
        </section>

        <section className="sp-surface ctr-panel" aria-label={copy.dashboard.table.title}>
          <h2>{copy.dashboard.table.title}</h2>
          <form className="ctr-filter-row" onSubmit={(e) => { e.preventDefault(); url.set({ q: search }); }} aria-label={copy.dashboard.table.title}>
            <div className="ctr-field is-wide"><label htmlFor="pt-q">{copy.dashboard.table.search}</label><input id="pt-q" className="ctr-input" value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)} onBlur={() => url.set({ q: search })} /></div>
            <div className="ctr-field"><label htmlFor="pt-st">{copy.dashboard.table.status}</label><select id="pt-st" className="ctr-input" value={status} onChange={(e) => url.set({ status: e.target.value })}><option value="">{copy.common.any}</option>{PROJECT_STATUSES.map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}</select></div>
            <div className="ctr-field"><label htmlFor="pt-fl">{copy.dashboard.table.flag}</label><select id="pt-fl" className="ctr-input" value={flag} onChange={(e) => url.set({ flag: e.target.value })}><option value="">{copy.common.any}</option>{FLAG_CODES.map((c) => <option key={c} value={c}>{copy.flags.code[c].label}</option>)}</select></div>
            <div className="ctr-field"><label htmlFor="pt-ba">{copy.dashboard.table.basis}</label><select id="pt-ba" className="ctr-input" value={basis} onChange={(e) => url.set({ basis: e.target.value })}><option value="">{copy.common.any}</option>{(["VERIFIED_INSPECTION", "REPORTED_UNVERIFIED", "NONE"] as const).map((b) => <option key={b} value={b}>{copy.basis[b]}</option>)}</select></div>
            <div className="ctr-field"><label htmlFor="pt-so">{copy.dashboard.table.sort}</label><select id="pt-so" className="ctr-input" value={sort} onChange={(e) => url.set({ sort: e.target.value })}>{SORTS.map((v) => <option key={v} value={v}>{v === "code" ? copy.dashboard.table.sortCode : v === "budget" ? copy.dashboard.table.sortBudget : v === "utilization" ? copy.dashboard.table.sortUtilization : copy.dashboard.table.sortGap}</option>)}</select></div>
            <label className="ctr-check"><input type="checkbox" checked={over} onChange={(e) => url.set({ over: e.target.checked ? "1" : null })} />{copy.dashboard.table.overBudget}</label>
            <button type="button" className="ctr-btn" onClick={() => { setSearch(""); url.set({ q: null, status: null, flag: null, basis: null, sort: null, over: null }); }}>{copy.common.clearAll}</button>
          </form>
          <p className="ctr-small" role="status" aria-live="polite">{table.data ? fill(copy.dashboard.table.count, { n: table.data.total }) : " "}</p>
          {table.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
          {table.error ? <div role="alert"><p className="ctr-error">{err(table.error)}</p><button type="button" className="ctr-btn" onClick={() => void table.refetch()}>{copy.common.retry}</button></div> : null}
          {table.data && rows.length === 0 ? <p className="ctr-small">{copy.dashboard.table.empty}</p> : null}
          {rows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="fin-table is-cards" aria-label={copy.dashboard.table.title}>
                <thead><tr><th scope="col">{copy.dashboard.table.project}</th><th scope="col">{copy.dashboard.table.contractor}</th><th scope="col" className="fin-right">{copy.dashboard.table.budget}</th><th scope="col" className="fin-right">{copy.dashboard.table.committed}</th><th scope="col" className="fin-right">{copy.dashboard.table.paid}</th><th scope="col">{copy.dashboard.table.utilization}</th><th scope="col">{copy.dashboard.table.progress}</th><th scope="col">{copy.dashboard.table.flags}</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/projects/${r.id}/finance`} style={{ fontWeight: 700 }}><span className="ctr-code">{r.code}</span> {r.title}</Link><div className="ctr-small">{statusLabel(r.status)}</div></td>
                      <td>{r.contractor ?? "—"}</td>
                      <td className="fin-right"><MoneyText minor={r.budgetMinor} locale={locale} compact copy={copy} /></td><td className="fin-right"><MoneyText minor={r.committedMinor} locale={locale} compact copy={copy} /></td><td className="fin-right"><MoneyText minor={r.paidMinor} locale={locale} compact copy={copy} /></td>
                      <td><span className="fin-bar" style={{ width: "6rem" }} role="img" aria-label={percentFromBp(r.utilizationBp)}><b className="is-fin" style={{ width: `${Math.min(100, (r.utilizationBp ?? 0) / 100)}%`, background: (r.utilizationBp ?? 0) > 10000 ? "var(--infra-maroon)" : undefined }} /></span> <span className="ctr-num ctr-small">{percentFromBp(r.utilizationBp)}</span></td>
                      <td><DualBar financialBp={r.financialBp} physicalBp={r.physicalBp} basis={r.basis} copy={copy} /></td>
                      <td><div className="ctr-chips">{r.flags.slice(0, 2).map((f) => <Chip key={f.code} tone={f.severity === "HIGH" ? "critical" : f.severity === "MEDIUM" ? "pending" : "neutral"}>{copy.flags.code[f.code].label}</Chip>)}{r.flags.length > 2 ? <span className="ctr-tag">{fill(copy.dashboard.table.moreFlags, { n: r.flags.length - 2 })}</span> : null}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {pages > 1 ? (
            <div className="ctr-row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="ctr-btn" disabled={page <= 1} onClick={() => url.set({ page: String(page - 1) })}>{copy.common.previous}</button>
              <span className="ctr-small">{copy.common.page} {page} {copy.common.of} {pages}</span>
              <button type="button" className="ctr-btn" disabled={page >= pages} onClick={() => url.set({ page: String(page + 1) })}>{copy.common.next}</button>
            </div>
          ) : null}
        </section>

        <div className="ctr-cols">
          <section className="sp-surface ctr-panel" aria-label={copy.dashboard.topFlags.title}>
            <h2>{copy.dashboard.topFlags.title}</h2>
            {s && s.topFlags.length === 0 ? <p className="ctr-small">{copy.flags.none}</p> : null}
            {s?.topFlags.map((t) => {
              const f = flagText(copy, { code: t.flag.code, params: t.flag.params }, locale);
              return (
                <div key={`${t.projectId}-${t.flag.code}`} className="ctr-match">
                  <SeverityChip severity={t.flag.severity} copy={copy} /><Link href={`/projects/${t.projectId}/finance`} style={{ fontWeight: 700 }}>{t.code}</Link><span>{f.label}</span><Chip tone={t.flag.confidence === "CONFIRMED" ? "success" : "pending"}>{copy.flags.confidence[t.flag.confidence]}</Chip>
                  <span className="ctr-small" style={{ flexBasis: "100%" }}>{f.reason}</span>
                </div>
              );
            })}
          </section>
          <section className="sp-surface ctr-panel" aria-label={copy.dashboard.recent.title}>
            <h2>{copy.dashboard.recent.title}</h2>
            {s && s.recent.length === 0 ? <p className="ctr-small">{copy.dashboard.recent.empty}</p> : null}
            {s?.recent.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="ctr-match">
                <span className="ctr-code">{r.number ?? r.id.slice(-6)}</span><span>{r.projectCode}</span><MoneyText minor={r.amountMinor} locale={locale} />
                {r.kind === "payment" ? <PaymentChip status={r.status as PaymentStatus} copy={copy} /> : <ExpenseChip status={r.status as ExpenseStatus} copy={copy} />}
                <Link className="ctr-btn is-ghost" href={r.kind === "payment" ? "/finance/payments?tab=all" : "/finance/expenses?tab=all"}>{copy.common.view}</Link>
              </div>
            ))}
          </section>
        </div>
      </div>
      {hasApprover && inboxTotal > 0 ? <div className="fin-sticky-bar"><Link className="ctr-btn is-primary" href={s?.inbox.payments ? "/finance/payments?tab=mine" : s?.inbox.expenses ? "/finance/expenses?tab=needs" : `/projects/${s?.inbox.revisionProjects[0]?.projectId ?? ""}/finance?tab=budget`}>{fill(copy.dashboard.reviewBar, { n: inboxTotal })}</Link></div> : null}
      <ProjectDrawer row={selectedRow} copy={copy} locale={locale} onClose={() => setSelected(null)} />
    </StaffWorkspaceShell>
  );
}

