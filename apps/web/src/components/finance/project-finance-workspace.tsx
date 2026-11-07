"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, InfoIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { formatDate, formatDateTime } from "@/lib/contractors/format";
import { decideRevision, downloadCsv, failureOf, fetchExpenses, fetchLedger, fetchPayments, fetchProjectFinance, fetchRevisions } from "@/lib/finance/api";
import { formatLkr, hundredthsToIndex, percentFromBp, ppFromTenths } from "@/lib/finance/money";
import { getFinanceCopy, type Copy } from "@/lib/finance/messages";
import { useFinanceKeys } from "@/lib/finance/session";
import { EXPENSE_STATUSES, PAYMENT_STATUSES, type Intelligence, type ProjectFinance, type Revision } from "@/lib/finance/types";
import { failureText, fill, intelAvailable } from "@/lib/finance/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/site-plan-projects.css";

import { ExpenseFormDialog, PaymentFormDialog, RevisionDecisionDialog, RevisionDialog, useRefreshFinance } from "./finance-dialogs";
import { ExpenseDrawer, ExpensesTable, PaymentDrawer, PaymentsTable } from "./finance-drawers";
import { BasisBadge, Chip, DualBar, FlagCard, MoneyText, RecordingNote, RevisionChip, UtilizationRing } from "./finance-ui";

const TABS = ["overview", "budget", "expenses", "payments", "ledger"] as const;
type Tab = (typeof TABS)[number];
type Common = { copy: Copy; locale: AuthLocale };

function Formula({ text, copy }: { text: string; copy: Copy }) {
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" className="ctr-info-btn" aria-label={copy.intel.howCalculated}><InfoIcon aria-hidden="true" width={16} height={16} /></button></PopoverTrigger>
      <PopoverContent align="end" className="w-72"><p className="ctr-small"><strong>{copy.intel.howCalculated}</strong></p><p className="ctr-small">{text}</p></PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ chart: cumulative paid vs reported and verified progress */

function TimelineChart({ series, copy }: { series: ProjectFinance["series"]; copy: Copy }) {
  const pts = [
    ...series.cumulativePaid.map((p) => ({ t: new Date(p.at).getTime(), v: (p.bp ?? 0) / 100, k: "paid" as const })),
    ...series.reported.map((p) => ({ t: new Date(p.at).getTime(), v: p.pct, k: "reported" as const })),
    ...series.verified.map((p) => ({ t: new Date(p.at).getTime(), v: p.pct, k: "verified" as const })),
  ];
  if (pts.length < 2) return <p className="ctr-small">{copy.workspace.timeline.empty}</p>;
  const W = 420, H = 160, P = 26;
  const t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t));
  const x = (t: number) => P + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - P - (Math.min(100, v) / 100) * (H - P * 2);
  const paid = pts.filter((p) => p.k === "paid").sort((a, b) => a.t - b.t);
  const step = paid.length ? `M ${x(paid[0]!.t)} ${y(0)} ` + paid.map((p, i) => `L ${x(p.t)} ${y(paid[i - 1]?.v ?? 0)} L ${x(p.t)} ${y(p.v)}`).join(" ") : "";
  const rep = pts.filter((p) => p.k === "reported").sort((a, b) => a.t - b.t);
  return (
    <svg className="ctr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={copy.workspace.timeline.aria}>
      <line x1={P} y1={y(0)} x2={W - P} y2={y(0)} stroke="currentColor" opacity="0.3" /><line x1={P} y1={y(100)} x2={W - P} y2={y(100)} stroke="currentColor" opacity="0.12" />
      <text x={2} y={y(100) + 4}>100%</text><text x={2} y={y(0)}>0%</text>
      {step ? <path d={step} fill="none" stroke="var(--infra-text)" strokeWidth="2" /> : null}
      {rep.length > 1 ? <polyline points={rep.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} fill="none" stroke="var(--infra-green)" strokeWidth="1.5" strokeDasharray="4 3" /> : null}
      {rep.map((p, i) => <circle key={`r${i}`} cx={x(p.t)} cy={y(p.v)} r="3.5" fill="#fff" stroke="var(--infra-green)" strokeWidth="2"><title>{`${copy.workspace.timeline.reported}: ${p.v}%`}</title></circle>)}
      {pts.filter((p) => p.k === "verified").map((p, i) => <rect key={`v${i}`} x={x(p.t) - 4} y={y(p.v) - 4} width="8" height="8" transform={`rotate(45 ${x(p.t)} ${y(p.v)})`} fill="var(--infra-green)"><title>{`${copy.workspace.timeline.verified}: ${p.v}%`}</title></rect>)}
    </svg>
  );
}

/* ------------------------------------------------------------------ overview */

function OverviewTab({ data, copy, locale }: Common & { data: ProjectFinance }) {
  const i: Intelligence = data.intelligence;
  return (
    <div className="ctr">
      <section className="sp-surface ctr-panel" aria-label={copy.intel.title}>
        <div className="ctr-bar"><h2>{copy.intel.title}</h2><span className="ctr-small">{copy.intel.ruleVersion.replace("{v}", i.ruleVersion)}</span></div>
        {!intelAvailable(i) ? <p className="ctr-small">{copy.intel.notAvailable}</p> : (
          <>
            <div className="ctr-grid2">
              <div><p className="ctr-label">{copy.intel.utilization} <Formula text={copy.intel.formula.utilization} copy={copy} /></p><p className="fin-kpi-value ctr-num">{percentFromBp(i.utilizationBp)}</p></div>
              <div><p className="ctr-label">{copy.intel.gap} <Formula text={copy.intel.formula.gap} copy={copy} /></p><p className="fin-kpi-value ctr-num">{i.gapTenths === null ? copy.intel.notEnough : ppFromTenths(i.gapTenths)}</p></div>
              <div><p className="ctr-label">{copy.intel.cei} <Formula text={copy.intel.formula.cei} copy={copy} /></p><p className="fin-kpi-value ctr-num">{i.cei.status === "OK" ? hundredthsToIndex(i.cei.hundredths) : copy.intel.notEnough}</p></div>
              <div><p className="ctr-label">{copy.intel.exposure} <Formula text={copy.intel.formula.exposure} copy={copy} /></p><p className="fin-kpi-value"><MoneyText minor={i.exposureMinor} locale={locale} /></p></div>
            </div>
            <div className="ctr-row"><BasisBadge basis={i.basis} copy={copy} />{i.asOf ? <span className="ctr-small">{fill(copy.intel.asOf, { date: formatDate(i.asOf, locale) })}</span> : null}<Formula text={copy.intel.formula.physical} copy={copy} /></div>
            <div className="ctr-grid2">{i.flags.length ? i.flags.map((f) => <FlagCard key={`${f.code}-${JSON.stringify(f.params)}`} flag={f} copy={copy} locale={locale} basis={i.basis} />) : <p className="ctr-small">{copy.flags.none}</p>}</div>
          </>
        )}
      </section>
      <div className="ctr-cols">
        <section className="sp-surface ctr-panel" aria-label={copy.workspace.timeline.title}>
          <h3>{copy.workspace.timeline.title}</h3>
          <TimelineChart series={data.series} copy={copy} />
          <p className="fin-legend"><span><i className="is-solid" />{copy.workspace.timeline.paid}</span><span><i />{copy.workspace.timeline.reported}</span><span>◆ {copy.workspace.timeline.verified}</span></p>
        </section>
        <section className="sp-surface ctr-panel" aria-label={copy.workspace.categories.title}>
          <h3>{copy.workspace.categories.title}</h3>
          {data.allocations.length === 0 ? <p className="ctr-small">{copy.workspace.categories.none}</p> : data.allocations.map((a) => {
            const pct = a.amountMinor > 0 ? Math.min(100, Math.round((a.spentMinor * 100) / a.amountMinor)) : 0;
            const over = a.spentMinor > a.amountMinor;
            return (
              <div key={a.category} className="fin-cat">
                <span>{copy.category[a.category]}</span>
                <i className="fin-bar" role="img" aria-label={`${copy.category[a.category]}: ${formatLkr(a.spentMinor, locale)} / ${formatLkr(a.amountMinor, locale)}`}><b className={over ? "is-over" : "is-spent"} style={{ width: `${pct}%` }} /></i>
                <span className="ctr-small ctr-num">{over ? fill(copy.workspace.categories.over, { amount: formatLkr(a.spentMinor - a.amountMinor, locale) }) : `${formatLkr(a.spentMinor, locale)} / ${formatLkr(a.amountMinor, locale)}`}</span>
              </div>
            );
          })}
        </section>
      </div>
      <section className="sp-surface ctr-panel" aria-label={copy.workspace.contractors}>
        <h3>{copy.workspace.contractors}</h3>
        {data.strip.length === 0 ? <p className="ctr-small">{copy.common.none}</p> : data.strip.map((s) => (
          <div key={s.assignmentId} className="ctr-match">
            <Link href={`/contractors/${s.contractorId}`} style={{ fontWeight: 700 }}>{s.contractor ?? copy.common.unknown}</Link>
            <span className="ctr-small">{s.contractValueMinor !== null ? `${copy.workspace.contractValue}: ` : copy.workspace.noContractValue}</span>
            {s.contractValueMinor !== null ? <MoneyText minor={s.contractValueMinor} locale={locale} /> : null}
            <span className="ctr-small">{copy.workspace.committedToContract}: <MoneyText minor={s.committedMinor} locale={locale} /></span>
            {s.contractValueMinor ? <i className="fin-bar" style={{ width: "8rem" }} role="img" aria-label={`${copy.workspace.capUsage} ${Math.min(999, Math.round((s.committedMinor * 100) / s.contractValueMinor))}%`}><b className="is-fin" style={{ width: `${Math.min(100, (s.committedMinor * 100) / s.contractValueMinor)}%`, background: s.committedMinor > s.contractValueMinor ? "var(--infra-maroon)" : undefined }} /></i> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ budget */

function BudgetTab({ data, copy, locale, projectId }: Common & { data: ProjectFinance; projectId: string }) {
  const keys = useFinanceKeys();
  const refresh = useRefreshFinance();
  const [revise, setRevise] = useState(false);
  const [reject, setReject] = useState<Revision | null>(null);
  const [cancel, setCancel] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: keys.key("revisions", projectId), queryFn: () => fetchRevisions(projectId), retry: false });
  const approve = useMutation({
    mutationFn: (id: string) => decideRevision(projectId, id, "approve"),
    onSuccess: () => { toast.success(copy.budget.approved); void refresh(); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, { ...copy.budget.errors, BELOW_COMMITMENTS: copy.budget.impact.BELOW_COMMITMENTS }, copy, { amount: "" })); },
  });
  const cancelM = useMutation({
    mutationFn: (id: string) => decideRevision(projectId, id, "cancel"),
    onSuccess: () => { toast.success(copy.budget.cancelled); void refresh(); setCancel(null); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, copy.budget.errors, copy)); },
  });
  const revs = q.data?.revisions ?? [];
  const pending = revs.find((r) => r.status === "PENDING_APPROVAL");
  const unallocated = data.totals.budgetMinor - data.allocations.reduce((s, a) => s + a.amountMinor, 0);
  return (
    <div className="ctr">
      <section className="sp-surface ctr-panel" aria-label={copy.budget.current}>
        <div className="ctr-bar"><div><p className="ctr-label">{copy.budget.current}</p><p className="fin-kpi-value"><MoneyText minor={data.totals.budgetMinor} locale={locale} /></p></div>
          {data.can.revise ? <button type="button" className="ctr-btn is-primary" disabled={Boolean(pending)} onClick={() => setRevise(true)}>{copy.budget.request}</button> : null}</div>
        <h3>{copy.budget.allocations}</h3>
        {data.allocations.length === 0 ? <p className="ctr-small">{copy.workspace.categories.none}</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" aria-label={copy.budget.allocations}>
              <thead><tr><th scope="col">{copy.budget.category}</th><th scope="col" className="fin-right">{copy.budget.allocated}</th><th scope="col" className="fin-right">{copy.budget.spent}</th><th scope="col" className="fin-right">{copy.budget.remaining}</th></tr></thead>
              <tbody>
                {data.allocations.map((a) => (
                  <tr key={a.category}><td>{copy.category[a.category]}</td><td className="fin-right"><MoneyText minor={a.amountMinor} locale={locale} /></td><td className="fin-right"><MoneyText minor={a.spentMinor} locale={locale} /></td>
                    <td className="fin-right">{a.spentMinor > a.amountMinor ? <Chip tone="critical">{fill(copy.workspace.categories.over, { amount: formatLkr(a.spentMinor - a.amountMinor, locale) })}</Chip> : <MoneyText minor={a.amountMinor - a.spentMinor} locale={locale} />}</td></tr>
                ))}
                <tr><td><em>{copy.budget.unallocated}</em></td><td className="fin-right"><MoneyText minor={Math.max(0, unallocated)} locale={locale} /></td><td /><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pending ? (
        <section className="sp-surface ctr-panel" aria-label={copy.budget.pending}>
          <h3>{copy.budget.pending} #{pending.sequence}</h3>
          <p>{fill(copy.budget.by, { name: pending.requestedBy ?? "" })}: <MoneyText minor={pending.previousTotalMinor} locale={locale} /> → <MoneyText minor={pending.newTotalMinor} locale={locale} /></p>
          {pending.reason ? <p className="ctr-small">{pending.reason}</p> : null}
          {error ? <p className="ctr-error" role="alert">{error}</p> : null}
          <div className="ctr-row">
            {pending.canDecide ? <button type="button" className="ctr-btn is-primary" disabled={approve.isPending} onClick={() => { setError(null); approve.mutate(pending.id); }}>{copy.budget.approve}</button> : null}
            {pending.canDecide ? <button type="button" className="ctr-btn" onClick={() => setReject(pending)}>{copy.budget.reject}</button> : null}
            {pending.canCancel ? <button type="button" className="ctr-btn" onClick={() => setCancel(pending)}>{copy.budget.cancel}</button> : null}
          </div>
        </section>
      ) : null}
      <section className="sp-surface ctr-panel" aria-label={copy.budget.history}>
        <h3>{copy.budget.history}</h3>
        {q.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
        {q.data && revs.length === 0 ? <p className="ctr-small">{copy.budget.noHistory}</p> : null}
        <ol className="fin-timeline">
          {revs.map((r) => (
            <li key={r.id}>
              <span className="ctr-row"><strong>#{r.sequence} {copy.budget.kinds[r.kind]}</strong><RevisionChip status={r.status} copy={copy} /><span className="ctr-num">{r.deltaMinor === 0 ? "±0" : `${r.deltaMinor > 0 ? "+" : "−"}${formatLkr(Math.abs(r.deltaMinor), locale)}`}</span></span>
              <span className="ctr-small"><MoneyText minor={r.previousTotalMinor} locale={locale} /> → <MoneyText minor={r.newTotalMinor} locale={locale} /></span>
              {r.reason ? <span className="ctr-small ctr-wrap">{r.reason}</span> : null}
              <span className="ctr-small">{r.requestedBy ? fill(copy.budget.by, { name: r.requestedBy }) : ""} · {formatDateTime(r.requestedAt, locale)}{r.decidedBy ? ` · ${fill(copy.budget.decidedBy, { name: r.decidedBy })}` : ""}</span>
              {r.decisionNote ? <span className="ctr-small ctr-wrap">{r.decisionNote}</span> : null}
            </li>
          ))}
        </ol>
      </section>
      {revise ? <RevisionDialog open onOpenChange={setRevise} copy={copy} locale={locale} projectId={projectId} currentTotalMinor={data.totals.budgetMinor} /> : null}
      {reject ? <RevisionDecisionDialog open onOpenChange={(o) => { if (!o) setReject(null); }} copy={copy} locale={locale} projectId={projectId} revisionId={reject.id} mode="reject" sequence={reject.sequence} /> : null}
      {cancel ? <ReasonDialogCancel copy={copy} locale={locale} onClose={() => setCancel(null)} onConfirm={() => cancelM.mutate(cancel.id)} pending={cancelM.isPending} /> : null}
    </div>
  );
}

function ReasonDialogCancel({ copy, onClose, onConfirm, pending }: Common & { onClose: () => void; onConfirm: () => void; pending: boolean }) {
  return (
    <div role="alertdialog" aria-label={copy.budget.cancel} className="sp-surface ctr-panel">
      <p>{copy.budget.cancel}?</p>
      <div className="ctr-row"><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button><button type="button" className="ctr-btn is-danger" disabled={pending} onClick={onConfirm}>{pending ? copy.common.working : copy.budget.cancel}</button></div>
    </div>
  );
}

/* ------------------------------------------------------------------ expenses / payments / ledger tabs */

function ExpensesTab({ projectId, data, copy, locale }: Common & { projectId: string; data: ProjectFinance }) {
  const keys = useFinanceKeys();
  const [status, setStatus] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const q = useQuery({ queryKey: keys.key("expenses", projectId, status), queryFn: ({ signal }) => fetchExpenses({ projectId, status: status || undefined, limit: 50 }, signal), retry: false });
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.expenses.title}>
      <div className="ctr-bar"><h2>{copy.expenses.title}</h2>{data.can.addExpense ? <button type="button" className="ctr-btn is-primary" onClick={() => setAdd(true)}><PlusIcon aria-hidden="true" />{copy.expenses.add}</button> : null}</div>
      <div className="fin-tabs" role="group" aria-label={copy.expenses.filters.status}>
        <button type="button" aria-pressed={status === ""} onClick={() => setStatus("")}>{copy.expenses.tabs.all}</button>
        {EXPENSE_STATUSES.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{copy.expenseStatus[s]}{q.data?.counts[s] ? ` (${q.data.counts[s]})` : ""}</button>)}
      </div>
      {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{q.error instanceof ApiError && q.error.status === 403 ? copy.common.forbidden : copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {q.data && q.data.rows.length === 0 ? <p className="ctr-small">{status ? copy.expenses.noMatch : copy.expenses.empty}</p> : null}
      {q.data?.rows.length ? <ExpensesTable rows={q.data.rows} copy={copy} locale={locale} onOpen={setOpen} /> : null}
      <ExpenseDrawer id={open} onClose={() => setOpen(null)} copy={copy} locale={locale} />
      {add ? <ExpenseFormDialog open onOpenChange={setAdd} copy={copy} locale={locale} projectId={projectId} /> : null}
    </section>
  );
}

function PaymentsTab({ projectId, data, copy, locale }: Common & { projectId: string; data: ProjectFinance }) {
  const keys = useFinanceKeys();
  const [status, setStatus] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const q = useQuery({ queryKey: keys.key("payments", projectId, status), queryFn: ({ signal }) => fetchPayments({ projectId, status: status || undefined, limit: 50 }, signal), retry: false });
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.payments.title}>
      <div className="ctr-bar"><h2>{copy.payments.title}</h2>{data.can.requestPayment ? <button type="button" className="ctr-btn is-primary" onClick={() => setAdd(true)}><PlusIcon aria-hidden="true" />{copy.payments.request}</button> : null}</div>
      <RecordingNote copy={copy} />
      <div className="fin-tabs" role="group" aria-label={copy.payments.filters.status}>
        <button type="button" aria-pressed={status === ""} onClick={() => setStatus("")}>{copy.payments.tabs.all}</button>
        {PAYMENT_STATUSES.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{copy.paymentStatus[s]}{q.data?.counts[s] ? ` (${q.data.counts[s]})` : ""}</button>)}
      </div>
      {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{q.error instanceof ApiError && q.error.status === 403 ? copy.common.forbidden : copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {q.data && q.data.rows.length === 0 ? <p className="ctr-small">{status ? copy.payments.noMatch : copy.payments.empty}</p> : null}
      {q.data?.rows.length ? <PaymentsTable rows={q.data.rows} copy={copy} locale={locale} onOpen={setOpen} /> : null}
      <PaymentDrawer id={open} onClose={() => setOpen(null)} copy={copy} locale={locale} />
      {add ? <PaymentFormDialog open onOpenChange={setAdd} copy={copy} locale={locale} projectId={projectId} /> : null}
    </section>
  );
}

function LedgerTab({ projectId, copy, locale }: Common & { projectId: string }) {
  const keys = useFinanceKeys();
  const [type, setType] = useState<string>("");
  const q = useInfiniteQuery({ queryKey: keys.key("ledger", projectId, type), queryFn: ({ pageParam }) => fetchLedger(projectId, pageParam || undefined, type || undefined), initialPageParam: "", getNextPageParam: (l) => l.nextCursor ?? undefined, retry: false });
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];
  const exp = useMutation({ mutationFn: () => downloadCsv("payments", { projectId }), onSuccess: (n) => toast.success(fill(copy.dashboard.exported, { n })), onError: () => toast.error(copy.dashboard.exportFailed) });
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.ledger.title}>
      <div className="ctr-bar"><h2>{copy.ledger.title}</h2><button type="button" className="ctr-btn" disabled={exp.isPending} onClick={() => exp.mutate()}><DownloadIcon aria-hidden="true" />{copy.ledger.export}</button></div>
      <p className="ctr-small">{copy.ledger.note}</p>
      <div className="fin-tabs" role="group" aria-label={copy.ledger.filter}>
        {([["", copy.ledger.all], ["budget", copy.ledger.budget], ["expense", copy.ledger.expense], ["payment", copy.ledger.payment]] as const).map(([v, label]) => <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}>{label}</button>)}
      </div>
      {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {!q.isLoading && !q.error && events.length === 0 ? <p className="ctr-small">{copy.ledger.empty}</p> : null}
      <ol className="fin-timeline">
        {events.map((e) => (
          <li key={e.key}>
            <span className="ctr-row"><strong>{(copy.ledger.events as Record<string, string>)[e.event] ?? e.event}</strong>{e.number ? <span className="ctr-code">{e.number}</span> : null}<MoneyText minor={e.amountMinor} locale={locale} />{e.reversalOf ? <Chip>{fill(copy.ledger.reversalOf, { number: e.reversalOf })}</Chip> : null}</span>
            <span className="ctr-small">{formatDateTime(e.at, locale)}</span>
            <span className="fin-led-balance"><span>{copy.ledger.committed}: <MoneyText minor={e.runningCommittedMinor} locale={locale} /></span><span>{copy.ledger.paid}: <MoneyText minor={e.runningPaidMinor} locale={locale} /></span><span>{copy.ledger.spent}: <MoneyText minor={e.runningSpentMinor} locale={locale} /></span></span>
          </li>
        ))}
      </ol>
      {q.hasNextPage ? <div><button type="button" className="ctr-btn" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{copy.ledger.loadMore}</button></div> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ workspace */

export function ProjectFinanceWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const keys = useFinanceKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getFinanceCopy(locale);
  const requested = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "overview";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const [addPay, setAddPay] = useState(false);
  const [addExp, setAddExp] = useState(false);
  const [revise, setRevise] = useState(false);
  const q = useQuery({ queryKey: keys.key("project", projectId), queryFn: () => fetchProjectFinance(projectId), retry: false });
  const d = q.data;
  const i = d?.intelligence;
  const error = q.error instanceof ApiError ? (q.error.status === 403 ? copy.workspace.noAccess : q.error.status === 404 ? copy.common.notFound : copy.workspace.loadFailed) : q.error ? copy.workspace.loadFailed : null;
  const topFlags = i?.flags.filter((f) => f.severity === "HIGH" || f.severity === "MEDIUM").slice(0, 3) ?? [];
  const primary = tab === "payments" && d?.can.requestPayment ? { label: copy.payments.request, run: () => setAddPay(true) } : tab === "expenses" && d?.can.addExpense ? { label: copy.expenses.add, run: () => setAddExp(true) } : tab === "budget" && d?.can.revise ? { label: copy.budget.request, run: () => setRevise(true) } : null;

  return (
    <StaffWorkspaceShell title={d ? `${d.project.code} · ${copy.title}` : copy.title} wide context={<ContextBar crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title, href: "/finance" }, { label: d?.project.code ?? "…" }]} />}>
      <div className="ctr" style={{ paddingBottom: primary ? "4.5rem" : undefined }}>
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}
        <div className="ctr-row"><Link href={`/projects/${projectId}/overview`} className="ctr-small">← {copy.workspace.back}</Link></div>
        {q.isLoading ? <div className="sp-surface fin-head" aria-busy="true"><span className="ctr-skel" style={{ height: "4rem", width: "100%" }} /></div> : null}
        {error ? <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{error}</p><div><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div></div> : null}
        {d && i ? (
          <>
            <header className="sp-surface fin-head fin-sticky">
              <div><p className="ctr-code">{d.project.code}</p><h2 style={{ margin: 0, fontSize: "1.15rem" }}>{d.project.title}</h2></div>
              <div className="fin-head-figs">
                <div className="fin-fig"><span>{copy.kpi.budget}</span><span><MoneyText minor={d.totals.budgetMinor} locale={locale} compact copy={copy} /></span></div>
                <div className="fin-fig"><span>{copy.kpi.committed}</span><span><MoneyText minor={intelAvailable(i) ? i.committedMinor : null} locale={locale} compact copy={copy} /></span></div>
                <div className="fin-fig"><span>{copy.kpi.paid}</span><span><MoneyText minor={d.totals.paidMinor} locale={locale} compact copy={copy} /></span></div>
                <div className="fin-fig"><span>{copy.kpi.remaining}</span><span><MoneyText minor={intelAvailable(i) ? i.remainingMinor : null} locale={locale} compact copy={copy} /></span></div>
              </div>
              <UtilizationRing bp={intelAvailable(i) ? i.utilizationBp : null} copy={copy} />
              {intelAvailable(i) ? <DualBar financialBp={i.financialProgressBp} physicalBp={i.physicalBp} basis={i.basis} copy={copy} /> : null}
            </header>
            {topFlags.length ? <div className="ctr-grid2" role="region" aria-label={copy.flags.title}>{topFlags.map((f) => <FlagCard key={f.code} flag={f} copy={copy} locale={locale} basis={intelAvailable(i) ? i.basis : undefined} />)}</div> : null}
            <div role="tablist" aria-label={copy.title} className="ctr-tabs">
              {TABS.map((t) => <button key={t} type="button" role="tab" className="ctr-tab" aria-selected={tab === t} aria-controls={`fin-panel-${t}`} id={`fin-tab-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>{copy.workspace.tabs[t]}</button>)}
            </div>
            <div role="tabpanel" id={`fin-panel-${tab}`} aria-labelledby={`fin-tab-${tab}`} tabIndex={0}>
              {tab === "overview" ? <OverviewTab data={d} copy={copy} locale={locale} /> : null}
              {tab === "budget" ? <BudgetTab data={d} copy={copy} locale={locale} projectId={projectId} /> : null}
              {tab === "expenses" ? <ExpensesTab data={d} copy={copy} locale={locale} projectId={projectId} /> : null}
              {tab === "payments" ? <PaymentsTab data={d} copy={copy} locale={locale} projectId={projectId} /> : null}
              {tab === "ledger" ? <LedgerTab copy={copy} locale={locale} projectId={projectId} /> : null}
            </div>
            <RecordingNote copy={copy} />
            {primary ? <div className="fin-sticky-bar"><button type="button" className="ctr-btn is-primary" onClick={primary.run}>{primary.label}</button></div> : null}
            {addPay ? <PaymentFormDialog open onOpenChange={setAddPay} copy={copy} locale={locale} projectId={projectId} /> : null}
            {addExp ? <ExpenseFormDialog open onOpenChange={setAddExp} copy={copy} locale={locale} projectId={projectId} /> : null}
            {revise ? <RevisionDialog open onOpenChange={setRevise} copy={copy} locale={locale} projectId={projectId} currentTotalMinor={d.totals.budgetMinor} /> : null}
          </>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

