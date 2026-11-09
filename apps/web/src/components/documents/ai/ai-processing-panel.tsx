"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, FileTextIcon, RefreshCwIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AiWarningCode } from "@infraos/shared-types";

import type { AuthLocale } from "@/lib/auth/types";
import { failureOf } from "@/lib/documents/api";
import { cancelDocumentAi, fetchChunks, fetchDocumentAi, reprocessDocument } from "@/lib/documents/ai/api";
import { getAiCopy } from "@/lib/documents/ai/messages";
import type { AiJob } from "@/lib/documents/ai/types";
import { isActiveJob, jobDurationSeconds, pollInterval } from "@/lib/documents/ai/view";
import { useDocKeys } from "@/lib/documents/session";
import { fill, fmtDateTime, fmtNumber } from "@/lib/documents/view";
import { getDocCopy } from "@/lib/documents/messages";
import type { DocDetail } from "@/lib/documents/types";

import { EmptyState, ErrorState, errorText, Shell, Skeletons } from "../doc-ui";
import { AiChip, durationLabel, PipelineStepper, ServiceBanner, WarningList } from "./ai-ui";

type Props = { doc: DocDetail; locale: AuthLocale; onRestrict?: () => void; onOpenPage: (page: number) => void };

function JobHistory({ jobs, locale }: { jobs: AiJob[]; locale: AuthLocale }) {
  const a = getAiCopy(locale);
  if (!jobs.length) return <p className="ins-muted">{a.panel.jobEmpty}</p>;
  return (
    <div className="ins-tablewrap">
      <table className="ins-table dt">
        <thead><tr>{[a.panel.col.when, a.panel.col.trigger, a.panel.col.status, a.panel.col.attempt, a.panel.col.duration, a.panel.col.by].map((x) => <th key={x} scope="col">{x}</th>)}</tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="dt-tabnum">{fmtDateTime(j.createdAt, locale)}</td><td>{a.trigger[j.trigger]}</td>
              <td>{a.jobStatus[j.status]}{j.errorCode ? <span className="ins-muted"> · {(a.error as Record<string, string>)[j.errorCode] ?? j.errorCode}</span> : null}</td>
              <td className="dt-tabnum">{j.attempt}/{j.maxAttempts}</td><td className="dt-tabnum">{durationLabel(a, jobDurationSeconds(j))}</td><td>{j.byUser ? j.requestedBy ?? "—" : a.panel.system}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChunkPreview({ doc, locale, enabled, onOpenPage }: { doc: DocDetail; locale: AuthLocale; enabled: boolean; onOpenPage: (n: number) => void }) {
  const a = getAiCopy(locale);
  const { key } = useDocKeys();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: key("ai-chunks", doc.id, page), enabled, queryFn: ({ signal }) => fetchChunks(doc.id, { page, limit: 5 }, signal), retry: false });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;
  const previewable = doc.mimeType === "application/pdf";
  return (
    <section className="dt-panel" aria-label={a.panel.chunkTitle} style={{ display: "grid", gap: "0.6rem" }}>
      <h3>{a.panel.chunkTitle}</h3>
      <p className="ins-muted" style={{ margin: 0 }}>{enabled ? a.panel.chunkHint : a.panel.chunkHidden}</p>
      {!enabled ? null : q.isPending ? <Skeletons n={2} /> : q.isError ? <ErrorState error={q.error} copy={getDocCopy(locale)} onRetry={() => void q.refetch()} /> : q.data.items.length === 0 ? <p className="ins-muted">{a.panel.chunkEmpty}</p> : (
        <>
          {q.data.items.map((c) => (
            <article key={c.chunkIndex} className="ai-chunk">
              <header>
                <strong>{fill(a.panel.chunkIndex, { n: c.chunkIndex + 1 })}</strong>
                <span className="ctr-badge" data-tone="neutral"><FileTextIcon aria-hidden="true" />{c.pageStart === null ? a.panel.noPage : c.pageEnd !== null && c.pageEnd !== c.pageStart ? fill(a.panel.sourcePages, { a: c.pageStart, b: c.pageEnd }) : fill(a.panel.sourcePage, { n: c.pageStart })}</span>
                {c.section ? <span className="ctr-badge" data-tone="active" title={a.panel.sectionLabel}>{c.section}</span> : null}
                {previewable && c.pageStart !== null ? <button type="button" className="ctr-btn is-ghost" onClick={() => onOpenPage(c.pageStart!)}>{fill(a.panel.openPage, { n: c.pageStart })}</button> : null}
              </header>
              <p>{c.text}</p>
            </article>
          ))}
          {pages > 1 ? (
            <div className="ctr-row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="ctr-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>{a.common.prev}</button>
              <span className="ins-muted dt-tabnum">{fill(a.common.page, { n: page, total: pages })}</span>
              <button type="button" className="ctr-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>{a.common.next}</button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** "AI processing" tab: eligibility, live pipeline, result, warnings, failure, history and the source-linked text preview. */
export function AiProcessingPanel({ doc, locale, onRestrict, onOpenPage }: Props) {
  const a = getAiCopy(locale);
  const copy = getDocCopy(locale);
  const { key } = useDocKeys();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: key("ai", doc.id), queryFn: ({ signal }) => fetchDocumentAi(doc.id, signal), retry: (n, e) => failureOf(e).status >= 500 && n < 1,
    refetchInterval: (query) => pollInterval(query.state.data?.currentJob, query.state.dataUpdateCount, typeof document !== "undefined" && document.hidden),
    refetchIntervalInBackground: false,
  });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["documents"] })]);
  const reprocess = useMutation({
    mutationFn: () => reprocessDocument(doc.id),
    onSuccess: async () => { toast.success(a.panel.reprocessQueued); setConfirm(false); await refresh(); },
    onError: (e) => { setConfirm(false); toast.error(failureOf(e).reason === "ACTIVE_JOB" ? a.panel.activeJob : errorText(e, copy)); void refresh(); },
  });
  const cancel = useMutation({
    mutationFn: () => cancelDocumentAi(doc.id),
    onSuccess: async () => { toast.success(a.panel.cancelled); await refresh(); },
    onError: (e) => toast.error(errorText(e, copy)),
  });

  if (q.isPending) return <Skeletons n={3} />;
  if (q.isError) return <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const job = d.currentJob ?? d.lastJob;
  const idx = d.aiIndex;
  const warnings: AiWarningCode[] = [...new Set([...(idx?.warnings ?? []), ...(job?.warnings ?? [])])];
  const failed = d.extractedTextStatus === "FAILED" || d.extractedTextStatus === "UNSUPPORTED" || (job?.status === "FAILED");
  const failCode = (idx?.errorCode ?? job?.errorCode) ?? null;
  const active = isActiveJob(d.currentJob);
  const indexed = d.extractedTextStatus === "COMPLETED";
  const aiForChip = { ...doc.ai, extractedTextStatus: d.extractedTextStatus, errorCode: failCode, warningCount: warnings.length, truncated: Boolean(idx?.truncated), indexedAt: idx?.indexedAt ?? null };

  return (
    <section className="dt-panel" aria-label={a.panel.title} style={{ display: "grid", gap: "0.9rem" }}>
      <header style={{ display: "grid", gap: "0.3rem" }}>
        <h3 style={{ margin: 0 }}>{a.panel.title}</h3>
        <p className="ins-muted" style={{ margin: 0 }}>{a.panel.subtitle}</p>
        <div className="ctr-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}><AiChip ai={aiForChip} aiCopy={a} locale={locale} stage={d.currentJob?.stage} />{idx?.outdated ? <span className="ctr-badge" data-tone="pending"><AlertTriangleIcon aria-hidden="true" />{a.panel.outdated}</span> : null}</div>
      </header>

      {d.service.configured && !d.service.available ? <ServiceBanner aiCopy={a} kind="down" /> : !d.service.configured ? <ServiceBanner aiCopy={a} kind="unconfigured" /> : null}
      {d.currentJob && !d.service.available ? <p className="ins-muted" role="status">{a.panel.waitingService}</p> : null}

      <div className="ctr-note" role="note">
        <strong>{d.eligible ? a.eligible.yes : a.eligible.no}</strong>
        {!d.eligible && d.reasonCode ? <span> {a.reason[d.reasonCode]}. {a.reasonHelp[d.reasonCode]}</span> : null}
        {!d.eligible && onRestrict && (d.reasonCode === "EXCLUDED" || d.reasonCode === "SENSITIVE") ? <div><button type="button" className="ctr-btn" onClick={onRestrict}><ShieldAlertIcon aria-hidden="true" />{copy.detail.actions.restrict}</button></div> : null}
      </div>

      <div><h4 style={{ margin: "0 0 0.4rem" }}>{a.panel.pipeline}</h4><PipelineStepper job={job ?? null} indexed={indexed && !active} aiCopy={a} /></div>
      {d.currentJob ? <p className="ins-muted dt-tabnum" style={{ margin: 0 }}>{fill(a.panel.attempt, { n: d.currentJob.attempt || 1, max: d.currentJob.maxAttempts })}{d.currentJob.status !== "RUNNING" && d.currentJob.nextAttemptAt ? ` · ${fill(a.panel.nextTry, { when: fmtDateTime(d.currentJob.nextAttemptAt, locale) })}` : ""}{d.currentJob.errorCode ? ` · ${(a.error as Record<string, string>)[d.currentJob.errorCode] ?? ""}` : ""}</p> : null}

      {failed ? (
        <div className="ai-fail" role="alert">
          <b><XIcon aria-hidden="true" />{a.panel.failedTitle}</b>
          <span>{failCode ? (a.error as Record<string, string>)[failCode] ?? a.error.INTERNAL_ERROR : a.error.INTERNAL_ERROR}</span>
        </div>
      ) : null}

      <div><h4 style={{ margin: "0 0 0.4rem" }}>{a.panel.stats}</h4>
        <div className="ai-stats">
          {[
            [a.panel.pages, idx?.pageCount != null ? fmtNumber(idx.pageCount, locale) : a.common.none], [a.panel.chunks, idx ? fmtNumber(idx.chunkCount, locale) : a.common.none],
            [a.panel.tokens, job && job.stats.tokens ? fmtNumber(job.stats.tokens, locale) : a.common.none], [a.panel.model, idx?.embeddingModel ?? a.common.none], [a.panel.dimension, idx?.embeddingDimension ? fmtNumber(idx.embeddingDimension, locale) : a.common.none],
            [a.panel.indexedAt, idx?.indexedAt ? fmtDateTime(idx.indexedAt, locale) : a.panel.notIndexed], [a.panel.pipelineVersion, idx?.pipelineVersion ?? d.pipelineVersion], [a.panel.version, idx?.indexedVersionNo ? `v${idx.indexedVersionNo}` : a.common.none],
          ].map(([l, v]) => <div key={l} className="ai-stat"><span>{l}</span><b>{v}</b></div>)}
        </div>
      </div>

      {warnings.length ? <div><h4 style={{ margin: "0 0 0.4rem" }}>{a.panel.warnings}</h4><WarningList warnings={warnings} aiCopy={a} /></div> : null}

      <div className="ctr-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" className="ctr-btn is-primary" disabled={!d.canReprocess || reprocess.isPending} onClick={() => setConfirm(true)} title={d.canReprocess ? a.panel.reprocessWhy : active ? a.panel.activeJob : a.panel.cannotReprocess}>
          <RefreshCwIcon aria-hidden="true" />{reprocess.isPending ? a.common.working : a.panel.reprocess}
        </button>
        {d.canCancel ? <button type="button" className="ctr-btn" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? a.common.working : a.panel.cancel}</button> : null}
        {!d.canReprocess ? <span className="ins-muted" role="status">{active ? a.panel.activeJob : a.panel.cannotReprocess}</span> : null}
      </div>
      {!d.service.available && d.canReprocess ? <p className="ins-muted">{a.panel.serviceDown}</p> : null}

      <div><h4 style={{ margin: "0 0 0.4rem" }}>{a.panel.history}</h4>{d.jobs.length ? <JobHistory jobs={d.jobs} locale={locale} /> : <EmptyState title={a.panel.jobEmpty} />}</div>

      <ChunkPreview doc={doc} locale={locale} enabled={d.canViewChunks && indexed} onOpenPage={onOpenPage} />

      <Shell open={confirm} onOpenChange={setConfirm} title={a.panel.reprocess} description={a.panel.reprocessWhy}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setConfirm(false)}>{a.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" disabled={reprocess.isPending} onClick={() => reprocess.mutate()}>{reprocess.isPending ? a.common.working : a.panel.reprocess}</button>
        </div>
      </Shell>
    </section>
  );
}
