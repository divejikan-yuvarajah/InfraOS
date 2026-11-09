"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AI_JOB_STATUSES, AI_JOB_TRIGGERS } from "@infraos/shared-types";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { bulkReprocess, cancelDocumentAi, fetchAiStatus, fetchJobs, fetchProcessingSummary, reindex, reprocessDocument, runDiagnostic } from "@/lib/documents/ai/api";
import { getAiCopy, type AiCopy } from "@/lib/documents/ai/messages";
import type { AiStatus, JobRow } from "@/lib/documents/ai/types";
import { isActiveJob, jobDurationSeconds, percent } from "@/lib/documents/ai/view";
import { failureOf } from "@/lib/documents/api";
import { getDocCopy } from "@/lib/documents/messages";
import { hintUpload, useDocKeys } from "@/lib/documents/session";
import { fill, fmtDateTime, fmtNumber } from "@/lib/documents/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { EmptyState, ErrorState, errorText, Field, Shell, Skeletons } from "../doc-ui";
import { durationLabel, ServiceBanner } from "./ai-ui";
import { QualityPanel } from "./quality-panel";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";

const canManageHint = (role: string) => role === "GOV_ADMIN" || role === "SUPER_ADMIN";

function Insight({ label, value, hint, href, active, onClick }: { label: string; value: string; hint?: string; href?: string; active?: boolean; onClick?: () => void }) {
  const body = <><span className="ctr-card-label">{label}</span><span className="ctr-card-value dt-tabnum">{value}</span>{hint ? <span className="ctr-card-hint">{hint}</span> : null}</>;
  if (href) return <Link className="ctr-card" href={href} aria-label={`${label}: ${value}`}>{body}</Link>;
  if (onClick) return <button type="button" className="ctr-card" aria-pressed={active} onClick={onClick} aria-label={`${label}: ${value}`}>{body}</button>;
  return <div className="ctr-card" role="group" aria-label={`${label}: ${value}`}>{body}</div>;
}

function ServiceCard({ a, status, error }: { a: AiCopy; status: AiStatus | undefined; error: boolean }) {
  if (error || !status) return null;
  const tone = status.state === "HEALTHY" ? "success" : status.state === "DEGRADED" ? "pending" : "critical";
  return (
    <section className="dt-panel" aria-label={a.center.service.title} style={{ display: "grid", gap: "0.5rem" }}>
      <h3 style={{ margin: 0 }}><DatabaseIcon aria-hidden="true" style={{ width: "1rem", height: "1rem", verticalAlign: "-0.15em" }} /> {a.center.service.title}</h3>
      <div className="ai-stats">
        <div className="ai-stat"><span>{a.center.service.state}</span><b><span className="ctr-badge" data-tone={tone}>{a.center.service[status.state]}</span></b></div>
        <div className="ai-stat"><span>{a.center.service.model}</span><b>{status.model ?? a.common.none}</b></div>
        <div className="ai-stat"><span>{a.center.service.dimension}</span><b>{status.dimension ?? a.common.none}</b></div>
        <div className="ai-stat"><span>{a.center.service.collection}</span><b style={{ fontSize: "0.8rem" }}>{status.collection ?? a.common.none}</b></div>
        <div className="ai-stat"><span>{a.center.service.circuit}</span><b>{status.circuit === "open" ? a.center.service.open : a.center.service.closed}</b></div>
        <div className="ai-stat"><span>{a.center.service.queue}</span><b className="dt-tabnum">{["QUEUED", "RUNNING", "DEFERRED", "FAILED"].map((k) => `${(a.jobStatus as Record<string, string>)[k]} ${status.queue[k] ?? 0}`).join(" · ")}</b></div>
      </div>
    </section>
  );
}

function UsageCard({ a, locale, t }: { a: AiCopy; locale: Parameters<typeof fmtNumber>[1]; t: NonNullable<import("@/lib/documents/ai/types").ProcessingSummary["tokens"]> }) {
  const pct = percent(t.usedToday, t.dailyBudget);
  return (
    <section className="dt-panel" aria-label={a.center.usage.title} style={{ display: "grid", gap: "0.4rem" }}>
      <h3 style={{ margin: 0 }}>{a.center.usage.title}</h3>
      <div className="ai-meter" role="progressbar" aria-label={a.aria.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-high={pct >= 90}><i style={{ width: `${pct}%` }} /></div>
      <span className="dt-tabnum">{fill(a.center.usage.of, { used: fmtNumber(t.usedToday, locale), budget: fmtNumber(t.dailyBudget, locale) })} ({pct}%)</span>
      <span className="ins-muted">{t.estimatedCostMinor !== null && t.costIsEstimated ? `${a.center.usage.cost}: ≈ ${(t.estimatedCostMinor / 100).toFixed(2)} USD` : a.center.usage.tokensOnly}</span>
    </section>
  );
}

function RetrievalCheck({ a, locale }: { a: AiCopy; locale: Parameters<typeof fmtNumber>[1] }) {
  const copy = getDocCopy(locale ?? "en");
  const [text, setText] = useState("");
  const m = useMutation({ mutationFn: (query: string) => runDiagnostic({ query, limit: 5 }), onError: (e) => toast.error(failureOf(e).status === 503 ? a.center.retrieval.failed : errorText(e, copy)) });
  const ok = text.trim().length >= 2;
  return (
    <section className="dt-panel" aria-label={a.center.retrieval.title} style={{ display: "grid", gap: "0.6rem" }}>
      <h3 style={{ margin: 0 }}>{a.center.retrieval.title}</h3>
      <span className="ai-diag-label" role="note"><SearchIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} />{a.center.retrieval.label}</span>
      <form className="ctr-row" style={{ flexWrap: "wrap", alignItems: "end", gap: "0.5rem" }} onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(text.trim()); }}>
        <Field label={a.center.retrieval.query}>{(id) => <input id={id} className="ctr-input" value={text} maxLength={300} placeholder={a.center.retrieval.placeholder} onChange={(e) => setText(e.target.value)} />}</Field>
        <button type="submit" className="ctr-btn is-primary" disabled={!ok || m.isPending}>{m.isPending ? a.center.retrieval.running : a.center.retrieval.run}</button>
      </form>
      <div aria-live="polite">
        {m.isError ? <p role="alert">{a.center.retrieval.failed}</p> : null}
        {m.data ? (
          m.data.searched === 0 ? <p className="ins-muted">{a.center.retrieval.noIndexed}</p> : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <p className="ins-muted" style={{ margin: 0 }}>{fill(a.center.retrieval.searched, { n: m.data.searched })}</p>
              {m.data.results.length === 0 ? <p>{a.center.retrieval.empty}</p> : m.data.results.map((r) => (
                <article key={r.chunkId} className="ai-result">
                  <header>
                    <Link className="ins-link" href={`/documents/${r.documentId}?tab=ai`} aria-label={fill(a.center.retrieval.openDoc, { doc: r.docNo ?? r.title ?? "" })}>{r.docNo ?? "—"} {r.title ?? ""}</Link>
                    <span className="ins-muted dt-tabnum">{fill(a.center.retrieval.score, { s: r.score.toFixed(3) })}</span>
                    <span className="ins-muted">{r.pageStart === null ? a.panel.noPage : r.pageEnd !== null && r.pageEnd !== r.pageStart ? fill(a.panel.sourcePages, { a: r.pageStart, b: r.pageEnd }) : fill(a.panel.sourcePage, { n: r.pageStart })}{r.section ? ` · ${r.section}` : ""}</span>
                  </header>
                  <p style={{ margin: 0, overflowWrap: "anywhere" }}>{r.snippet}</p>
                </article>
              ))}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}

function ReindexDialog({ a, open, onClose, status }: { a: AiCopy; open: boolean; onClose: () => void; status: AiStatus | undefined }) {
  const copy = getDocCopy("en");
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const done = () => { void qc.invalidateQueries({ queryKey: ["documents"] }); setTyped(""); };
  const start = useMutation({ mutationFn: () => reindex({ action: "start", confirm: "REINDEX" }), onSuccess: (r) => { toast.success(fill(a.center.reindex.started, { n: r.queued ?? 0 })); done(); }, onError: (e) => toast.error(failureOf(e).reason === "NOTHING_TO_REINDEX" ? a.center.reindex.nothing : errorText(e, copy)) });
  const fin = useMutation({ mutationFn: () => reindex({ action: "finalize", confirm: "FINALIZE" }), onSuccess: () => { toast.success(a.center.reindex.finalized); done(); onClose(); }, onError: (e) => toast.error(failureOf(e).reason === "NOT_ENOUGH_PROGRESS" ? a.center.reindex.notReady : errorText(e, copy)) });
  const r = status?.reindex;
  return (
    <Shell open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={a.center.reindex.title} description={a.center.reindex.description} wide>
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div className="ai-stats">
          <div className="ai-stat"><span>{a.center.reindex.current}</span><b>{status?.model ?? a.common.none}</b></div>
          <div className="ai-stat"><span>{a.center.reindex.dimension}</span><b>{status?.dimension ?? a.common.none}</b></div>
        </div>
        {r ? <p className="dt-tabnum" role="status">{fill(a.center.reindex.progress, { done: r.migrated, total: r.total, p: r.percent })}</p> : null}
        {r && r.pending > 0 ? <p className="ins-muted">{fill(a.center.reindex.impact, { n: r.pending })}</p> : null}
        <p className="ins-muted">{a.center.reindex.rollback}</p>
        <Field label={r && r.pending === 0 ? a.center.reindex.typeFinal : a.center.reindex.typeStart}>{(id) => <input id={id} className="ctr-input" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />}</Field>
        <div className="ctr-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{a.common.close}</button>
          <button type="button" className="ctr-btn" disabled={typed !== "FINALIZE" || fin.isPending || !r || r.percent < 95} title={a.center.reindex.notReady} onClick={() => fin.mutate()}>{fin.isPending ? a.common.working : a.center.reindex.finalize}</button>
          <button type="button" className="ctr-btn is-primary" disabled={typed !== "REINDEX" || start.isPending || (r ? r.pending === 0 : false)} onClick={() => start.mutate()}>{start.isPending ? a.common.working : a.center.reindex.start}</button>
        </div>
      </div>
    </Shell>
  );
}

function BulkFailedDialog({ a, open, onClose }: { a: AiCopy; open: boolean; onClose: () => void }) {
  const copy = getDocCopy("en");
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => bulkReprocess({ status: "FAILED" }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["documents"] }), onError: (e) => toast.error(errorText(e, copy)) });
  return (
    <Shell open={open} onOpenChange={(o) => { if (!o) { m.reset(); onClose(); } }} title={a.center.bulk.title} description={a.center.bulk.body}>
      {m.data ? (
        <div style={{ display: "grid", gap: "0.5rem" }} aria-live="polite">
          <strong>{fill(a.center.bulk.queued, { n: m.data.queued })}</strong>
          <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>{m.data.results.map((r) => <li key={r.documentId}>{fill(a.center.bulk.item, { doc: r.docNo ?? r.documentId.slice(-6), result: (a.center.bulk.result as Record<string, string>)[r.result] ?? r.result })}</li>)}</ul>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={() => { m.reset(); onClose(); }}>{a.center.bulk.close}</button></div>
        </div>
      ) : (
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{a.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? a.common.working : a.center.bulk.run}</button>
        </div>
      )}
    </Shell>
  );
}

type Filters = { status: string; trigger: string; from: string; to: string; q: string; page: number };
const EMPTY: Filters = { status: "", trigger: "", from: "", to: "", q: "", page: 1 };

function JobsTable({ a, locale, rows, canAct, onReprocess, onCancel, busy }: { a: AiCopy; locale: Parameters<typeof fmtNumber>[1]; rows: JobRow[]; canAct: boolean; onReprocess: (r: JobRow) => void; onCancel: (r: JobRow) => void; busy: boolean }) {
  const err = (j: JobRow) => (j.errorCode ? (a.error as Record<string, string>)[j.errorCode] ?? j.errorCode : "");
  const actions = (j: JobRow) => (
    <span className="ctr-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
      <Link className="ctr-btn is-ghost" href={`/documents/${j.documentId}?tab=ai`}>{a.center.jobs.open}</Link>
      {canAct && isActiveJob(j) ? <button type="button" className="ctr-btn is-ghost" disabled={busy} onClick={() => onCancel(j)}>{a.center.jobs.cancel}</button> : null}
      {canAct && !isActiveJob(j) ? <button type="button" className="ctr-btn is-ghost" disabled={busy} onClick={() => onReprocess(j)}>{a.center.jobs.reprocess}</button> : null}
    </span>
  );
  return (
    <>
      <div className="ins-tablewrap ai-table">
        <table className="ins-table dt">
          <thead><tr>{[a.center.jobs.document, a.center.jobs.status, a.center.jobs.stage, a.center.jobs.attempt, a.center.jobs.trigger, a.center.jobs.started, a.center.jobs.duration, a.center.jobs.error, a.center.jobs.actions].map((x) => <th key={x} scope="col">{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id}>
                <td><Link className="ins-link" href={`/documents/${j.documentId}?tab=ai`}>{j.docNo ?? "—"}</Link><br /><span className="ins-muted">{j.title ?? ""}</span></td>
                <td>{a.jobStatus[j.status]}</td><td>{a.stage[j.stage]}</td><td className="dt-tabnum">{j.attempt}/{j.maxAttempts}</td><td>{a.trigger[j.trigger]}</td>
                <td className="dt-tabnum">{fmtDateTime(j.startedAt ?? j.createdAt, locale)}</td><td className="dt-tabnum">{durationLabel(a, jobDurationSeconds(j))}</td><td>{err(j) || a.common.none}</td><td>{actions(j)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ai-cards">
        {rows.map((j) => (
          <article key={j.id} className="ai-card">
            <Link className="ins-link" href={`/documents/${j.documentId}?tab=ai`}>{j.docNo ?? "—"} {j.title ?? ""}</Link>
            <span><strong>{a.jobStatus[j.status]}</strong> · {a.stage[j.stage]} · {j.attempt}/{j.maxAttempts}</span>
            <span className="ins-muted">{a.trigger[j.trigger]} · {fmtDateTime(j.startedAt ?? j.createdAt, locale)}{err(j) ? ` · ${err(j)}` : ""}</span>
            {actions(j)}
          </article>
        ))}
      </div>
    </>
  );
}

export function ProcessingCenter() {
  const [locale] = useWorkspaceLocale();
  const a = getAiCopy(locale);
  const copy = getDocCopy(locale);
  const { key, roleKey } = useDocKeys();
  const qc = useQueryClient();
  const [f, setF] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [dlg, setDlg] = useState<"reindex" | "bulk" | null>(null);
  const allowed = hintUpload(roleKey);
  const manage = canManageHint(roleKey);

  const summary = useQuery({ queryKey: key("ai-summary"), enabled: allowed, queryFn: ({ signal }) => fetchProcessingSummary(signal), refetchInterval: (q) => (typeof document !== "undefined" && document.hidden ? false : (q.state.data?.queued ?? 0) + (q.state.data?.processing ?? 0) > 0 ? 5000 : 30000), retry: (n, e) => failureOf(e).status >= 500 && n < 1 });
  const status = useQuery({ queryKey: key("ai-status"), enabled: allowed && manage, queryFn: ({ signal }) => fetchAiStatus(signal), refetchInterval: 20000, retry: false });
  const jobsKey = key("ai-jobs", f.status, f.trigger, f.from, f.to, f.q, f.page);
  const jobs = useQuery({
    queryKey: jobsKey, enabled: allowed, placeholderData: keepPreviousData, retry: (n, e) => failureOf(e).status >= 500 && n < 1,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 10000),
    queryFn: ({ signal }) => fetchJobs({ status: f.status, trigger: f.trigger, from: f.from, to: f.to, q: f.q, page: f.page, limit: 15 }, signal),
  });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["documents"] })]);
  const re = useMutation({ mutationFn: (r: JobRow) => reprocessDocument(r.documentId), onSuccess: async () => { toast.success(a.panel.reprocessQueued); await refresh(); }, onError: (e) => toast.error(failureOf(e).reason === "ACTIVE_JOB" ? a.panel.activeJob : errorText(e, copy)) });
  const ca = useMutation({ mutationFn: (r: JobRow) => cancelDocumentAi(r.documentId), onSuccess: async () => { toast.success(a.panel.cancelled); await refresh(); }, onError: (e) => toast.error(errorText(e, copy)) });

  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch, page: "page" in patch ? patch.page ?? 1 : 1 }));
  const s = summary.data;
  const serviceDown = s ? (!s.service.configured ? "unconfigured" : !s.service.available ? "down" : null) : null;
  const pages = jobs.data ? Math.max(1, Math.ceil(jobs.data.total / jobs.data.limit)) : 1;
  const activeFilters = [f.status, f.trigger, f.from, f.to, f.q].filter(Boolean).length;

  return (
    <StaffWorkspaceShell title={a.center.title} description={a.center.subtitle} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title, href: "/documents" }, { label: a.center.title }]} scope={a.center.scope} asOf={null} />}>
      <div className="ins dt">
        {!allowed ? <EmptyState title={copy.common.forbiddenTitle} body={copy.common.forbiddenBody} /> : (
          <>
            <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <span className="ctr-badge" data-tone={s ? (s.service.available ? "success" : "critical") : "neutral"}>{a.center.availability}: {s ? (!s.service.configured ? a.center.notConfigured : s.service.available ? a.center.available : a.center.unavailable) : a.common.loading}</span>
              </div>
              <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="ctr-btn" onClick={() => { void summary.refetch(); void jobs.refetch(); void status.refetch(); }}><RefreshCwIcon aria-hidden="true" />{a.center.refresh}</button>
                {s && s.ready > 0 ? <Link className="ctr-btn" href="/documents/ai">{getRagCopy(locale).nav.workspace}</Link> : null}
                <button type="button" className="ctr-btn" onClick={() => setDlg("bulk")}>{a.center.bulk.reprocessFailed}</button>
                {manage ? <button type="button" className="ctr-btn" onClick={() => setDlg("reindex")}>{a.center.reindex.open}</button> : null}
              </div>
            </div>

            {serviceDown ? <ServiceBanner aiCopy={a} kind={serviceDown} /> : null}

            {summary.isPending ? <Skeletons n={2} /> : summary.isError ? <ErrorState error={summary.error} copy={copy} onRetry={() => void summary.refetch()} /> : s ? (
              <>
                <div className="dt-strip" role="group" aria-label={a.center.title}>
                  <Insight label={a.center.insights.ready} value={fmtNumber(s.ready, locale)} href="/documents?aiStatus=COMPLETED" />
                  <Insight label={a.center.insights.inProgress} value={fmtNumber(s.queued + s.processing, locale)} active={f.status === "ACTIVE"} onClick={() => set({ status: f.status === "ACTIVE" ? "" : "ACTIVE" })} />
                  <Insight label={a.center.insights.failed} value={fmtNumber(s.failed, locale)} active={f.status === "FAILED"} onClick={() => set({ status: f.status === "FAILED" ? "" : "FAILED" })} />
                  <Insight label={a.center.insights.unsupported} value={fmtNumber(s.unsupported, locale)} href="/documents?aiStatus=UNSUPPORTED" />
                  <Insight label={a.center.insights.excluded} value={fmtNumber(s.excluded + s.notEligible, locale)} />
                  <Insight label={a.center.insights.outdated} value={fmtNumber(s.outdated, locale)} />
                  <Insight label={a.center.insights.coverage} value={s.coveragePercent === null ? a.common.none : `${s.coveragePercent}%`} hint={a.center.insights.hint} />
                </div>
                <div className="dt-charts">
                  {manage ? <ServiceCard a={a} status={status.data} error={status.isError} /> : null}
                  {s.tokens ? <UsageCard a={a} locale={locale} t={s.tokens} /> : null}
                </div>
              </>
            ) : null}

            <section className="dt-panel" aria-label={a.center.jobs.title} style={{ display: "grid", gap: "0.7rem" }}>
              <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{a.center.jobs.title}</h3>
                <button type="button" className="ctr-btn dt-sheet-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>{a.center.filters.filters}{activeFilters ? ` (${activeFilters})` : ""}</button>
              </div>
              <div className="dt-filters" data-collapsed={!showFilters}>
                <Field label={a.center.filters.text}>{(id) => <input id={id} className="ctr-input" value={f.q} maxLength={100} onChange={(e) => set({ q: e.target.value })} />}</Field>
                <div className="dt-more ctr-row" style={{ flexWrap: "wrap", gap: "0.6rem", alignItems: "end", flex: "1 1 100%" }}>
                  <Field label={a.center.filters.status}>{(id) => <select id={id} className="ctr-input" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">{a.center.filters.any}</option>{AI_JOB_STATUSES.map((x) => <option key={x} value={x}>{a.jobStatus[x]}</option>)}</select>}</Field>
                  <Field label={a.center.filters.trigger}>{(id) => <select id={id} className="ctr-input" value={f.trigger} onChange={(e) => set({ trigger: e.target.value })}><option value="">{a.center.filters.any}</option>{AI_JOB_TRIGGERS.map((x) => <option key={x} value={x}>{a.trigger[x]}</option>)}</select>}</Field>
                  <Field label={a.center.filters.from}>{(id) => <input id={id} type="date" className="ctr-input" value={f.from} onChange={(e) => set({ from: e.target.value })} />}</Field>
                  <Field label={a.center.filters.to}>{(id) => <input id={id} type="date" className="ctr-input" value={f.to} onChange={(e) => set({ to: e.target.value })} />}</Field>
                  {activeFilters ? <button type="button" className="ctr-btn is-ghost" onClick={() => setF(EMPTY)}>{a.center.filters.clear}</button> : null}
                </div>
              </div>
              {jobs.isPending ? <Skeletons n={3} /> : jobs.isError ? <ErrorState error={jobs.error} copy={copy} onRetry={() => void jobs.refetch()} /> : jobs.data.items.length === 0 ? <EmptyState title={a.center.jobs.empty} /> : (
                <>
                  <JobsTable a={a} locale={locale} rows={jobs.data.items} canAct={allowed} busy={re.isPending || ca.isPending} onReprocess={(r) => re.mutate(r)} onCancel={(r) => ca.mutate(r)} />
                  <div className="ctr-row" style={{ justifyContent: "space-between" }}>
                    <button type="button" className="ctr-btn" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1 })}>{a.common.prev}</button>
                    <span className="ins-muted dt-tabnum">{fill(a.common.page, { n: f.page, total: pages })}</span>
                    <button type="button" className="ctr-btn" disabled={f.page >= pages} onClick={() => set({ page: f.page + 1 })}>{a.common.next}</button>
                  </div>
                </>
              )}
            </section>

            {manage ? <QualityPanel locale={locale} /> : null}
            <RetrievalCheck a={a} locale={locale} />
            <BulkFailedDialog a={a} open={dlg === "bulk"} onClose={() => setDlg(null)} />
            {manage ? <ReindexDialog a={a} open={dlg === "reindex"} onClose={() => setDlg(null)} status={status.data} /> : null}
          </>
        )}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>
    </StaffWorkspaceShell>
  );
}
