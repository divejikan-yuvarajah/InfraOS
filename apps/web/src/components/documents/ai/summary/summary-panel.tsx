"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, ClipboardCopyIcon, DownloadIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AI_LANGUAGES, type AiLanguage } from "@infraos/shared-types";

import { Chip } from "@/components/inspections/inspection-ui";
import { ApiError } from "@/lib/api/errors";
import type { AuthLocale } from "@/lib/auth/types";
import { createSummary, fetchSummaries, fetchSummary } from "@/lib/documents/ai/rag-api";
import { getRagCopy, type RagCopy } from "@/lib/documents/ai/rag-messages";
import type { Artifact, ArtifactCitation, Citation, SummaryResult } from "@/lib/documents/ai/rag-types";
import { pollInterval } from "@/lib/documents/ai/view";
import { useDocKeys } from "@/lib/documents/session";
import { fill, fmtDateTime } from "@/lib/documents/view";

import { ErrorState, Shell, Skeletons } from "../../doc-ui";
import { getDocCopy } from "@/lib/documents/messages";
import { SourceViewer } from "../workspace/source-viewer";

type Props = { docId: string; locale: AuthLocale };
const ACTIVE = ["QUEUED", "RUNNING"];

const toCitation = (docId: string, versionNo: number, c: ArtifactCitation): Citation => ({
  n: c.n, chunkId: c.chunkId, documentId: docId, versionNo, sourceStatus: "CURRENT", docNo: null, title: null, category: null, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, quote: c.quote, quoteVerified: c.quoteVerified, wasNeighbor: false,
});

export function summaryAsText(result: SummaryResult, copy: RagCopy): string {
  return result.sections.filter((s) => s.items.length).map((s) => `${(copy.summary.section as Record<string, string>)[s.key] ?? s.key}\n${s.items.map((i) => `- ${i.text}${i.date ? ` (${i.date})` : ""}`).join("\n")}`).join("\n\n");
}

function Progress({ a, copy }: { a: Artifact; copy: RagCopy }) {
  const label = a.status === "QUEUED" ? copy.summary.progress.QUEUED : a.progress.phase === "MAP" ? fill(copy.summary.progress.MAP, { done: a.progress.done, total: a.progress.total }) : copy.summary.progress.REDUCE;
  const pct = a.progress.total ? Math.round((a.progress.done / a.progress.total) * 100) : 0;
  return (
    <div className="ai-pending" role="status" aria-live="polite"><span>{label}</span>{a.progress.phase === "MAP" ? <span className="ai-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}><i style={{ width: `${pct}%` }} /></span> : null}</div>
  );
}

function SummaryView({ a, docId, copy, locale, onCite, selected }: { a: Artifact; docId: string; copy: RagCopy; locale: AuthLocale; onCite: (c: Citation) => void; selected: number | null }) {
  const result = a.result as SummaryResult | null;
  const cites = new Map((a.citations ?? []).map((c) => [c.n, c]));
  if (!result) return null;
  const chips = (ns: number[]) => <span className="ai-cites">{ns.map((n) => { const c = cites.get(n); return c ? <button key={n} type="button" className="ai-cite" aria-pressed={selected === n} aria-label={fill(copy.answer.openSource, { n })} onClick={() => onCite(toCitation(docId, a.versionNo, c))}>{n}</button> : null; })}</span>;
  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      {result.sections.map((s) => (
        <section key={s.key} aria-label={(copy.summary.section as Record<string, string>)[s.key] ?? s.key}>
          <h4 style={{ margin: "0 0 0.3rem" }}>{(copy.summary.section as Record<string, string>)[s.key] ?? s.key}</h4>
          {s.items.length === 0 ? <p className="ins-muted">{copy.summary.noItems}</p> : s.kind === "dates" ? (
            <ul className="ai-dates">{s.items.map((i, k) => <li key={k}><span className="dt-tabnum"><strong>{i.dateIso ?? i.date ?? copy.summary.noDate}</strong></span><span>{i.text}</span>{chips(i.citationNs)}</li>)}</ul>
          ) : s.kind === "text" ? <p>{s.items[0]!.text} {chips(s.items[0]!.citationNs)}</p> : <ul>{s.items.map((i, k) => <li key={k}>{i.text} {chips(i.citationNs)}</li>)}</ul>}
        </section>
      ))}
      <footer className="ins-muted" style={{ display: "grid", gap: "0.2rem" }}>
        {a.coverage?.pagesFrom != null && a.coverage.pagesTo != null ? <span>{fill(copy.summary.coverage, { a: a.coverage.pagesFrom, b: a.coverage.pagesTo })}</span> : null}
        {a.coverage?.chunksTotal ? <span>{fill(copy.summary.coverageChunks, { used: a.coverage.chunksUsed ?? 0, total: a.coverage.chunksTotal })}</span> : null}
        {a.coverage?.truncated ? <span role="status"><AlertTriangleIcon aria-hidden="true" /> {copy.summary.truncated}</span> : null}
        {a.warnings.map((w) => <span key={w}>{(copy.summary.warnings as Record<string, string>)[w] ?? w}</span>)}
        {a.evidence ? <span>{fill(copy.answer.evidence.quotes, { v: a.evidence.quotesVerified, t: a.evidence.quotesTotal })}</span> : null}
        <span>{copy.answer.aiLabel} · {a.model ?? ""} · {a.promptVersion ?? ""} · {fmtDateTime(a.updatedAt, locale)}</span>
      </footer>
    </div>
  );
}

export function SummaryPanel({ docId, locale }: Props) {
  const copy = getRagCopy(locale);
  const docCopy = getDocCopy(locale);
  const { key } = useDocKeys();
  const qc = useQueryClient();
  const [template, setTemplate] = useState<string | null>(null);
  const [language, setLanguage] = useState<AiLanguage>(locale);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<Citation | null>(null);

  const list = useQuery({
    queryKey: key("ai-summaries", docId), queryFn: ({ signal }) => fetchSummaries(docId, signal), retry: false,
    refetchInterval: (q) => pollInterval(q.state.data?.artifacts.some((x) => ACTIVE.includes(x.status)) ? { status: "RUNNING" } : null, q.state.dataUpdateCount, typeof document !== "undefined" && document.hidden),
  });
  const current = list.data?.artifacts.find((a) => a.id === pick) ?? list.data?.artifacts.find((a) => a.template === template && a.language === language && a.status !== "STALE" && a.status !== "FAILED") ?? list.data?.artifacts.find((a) => a.template === template && a.language === language);
  const detail = useQuery({ queryKey: key("ai-summary", docId, current?.id ?? ""), enabled: Boolean(current && (current.status === "READY" || current.status === "STALE")), retry: false, queryFn: ({ signal }) => fetchSummary(docId, current!.id, signal) });
  const gen = useMutation({
    mutationFn: (regenerate: boolean) => createSummary(docId, { template: template!, language, ...(regenerate ? { regenerate: true } : {}) }),
    onSuccess: (a) => { setPick(a.id); void qc.invalidateQueries({ queryKey: key("ai-summaries", docId) }); },
    onError: (e) => { const code = e instanceof ApiError ? e.code ?? "generic" : "generic"; toast.error((copy.answer.errors as Record<string, string>)[code] ?? (code === "NOT_AI_READY" ? copy.summary.notReady : copy.answer.errors.generic)); },
  });

  if (list.isPending) return <Skeletons n={3} />;
  if (list.isError) return <ErrorState error={list.error} copy={docCopy} onRetry={() => void list.refetch()} />;
  const data = list.data;
  const busy = Boolean(current && ACTIVE.includes(current.status));
  const full = detail.data?.status === "READY" || detail.data?.status === "STALE" ? detail.data : null;
  const text = full?.result ? summaryAsText(full.result as SummaryResult, copy) : "";
  const download = () => { const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const el = document.createElement("a"); el.href = url; el.download = "summary.txt"; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

  return (
    <section className="dt-panel" aria-label={copy.summary.title} style={{ display: "grid", gap: "0.8rem" }}>
      <header><h3 style={{ margin: 0 }}>{copy.summary.title}</h3><p className="ins-muted" style={{ margin: 0 }}>{copy.summary.subtitle}</p></header>
      {!data.ready ? <p className="ai-note" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.summary.notReady}</p> : null}
      <div role="radiogroup" aria-label={copy.summary.chooseTemplate} className="ai-templates">
        {data.templates.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={template === t.key} className="ai-template" onClick={() => { setTemplate(t.key); setPick(null); }}>
            <strong>{(copy.summary.template as Record<string, string>)[t.key]}</strong>
            <span className="ins-muted">{(copy.summary.template as Record<string, string>)[`${t.key}_HELP`]}</span>
            {t.suggested ? <span className="ctr-badge" data-tone="success">{copy.summary.suggested}</span> : null}
          </button>
        ))}
      </div>
      <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
        <label className="ctr-field" style={{ minWidth: "9rem" }}><span>{copy.summary.language}</span>
          <select className="ctr-input" value={language} onChange={(e) => { setLanguage(e.target.value as AiLanguage); setPick(null); }}>{AI_LANGUAGES.map((l) => <option key={l} value={l}>{{ en: "English", si: "සිංහල", ta: "தமிழ்" }[l]}</option>)}</select></label>
        <button type="button" className="ctr-btn is-primary" disabled={!template || !data.ready || gen.isPending || busy || Boolean(current && current.status === "READY")} onClick={() => gen.mutate(false)}><SparklesIcon aria-hidden="true" />{gen.isPending ? copy.common.working : copy.summary.generate}</button>
        {current?.status === "READY" || current?.status === "STALE" ? <button type="button" className="ctr-btn" disabled={gen.isPending || busy || !data.ready} onClick={() => setConfirm(true)}><RefreshCwIcon aria-hidden="true" />{copy.summary.regenerate}</button> : null}
      </div>

      {current && busy ? <Progress a={current} copy={copy} /> : null}
      {current?.status === "FAILED" ? (
        <div className="ai-fail" role="alert"><b>{copy.summary.failed}</b><span>{(copy.answer.errors as Record<string, string>)[current.errorCode ?? ""] ?? copy.answer.errors.generic}</span><div><button type="button" className="ctr-btn" disabled={gen.isPending} onClick={() => gen.mutate(false)}>{copy.summary.retry}</button></div></div>
      ) : null}
      {full ? (
        <>
          {full.stale ? <p className="ai-note" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.summary.stale}</p> : null}
          <div className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <Chip tone="neutral">{copy.answer.aiLabel}</Chip>
            <button type="button" className="ctr-btn is-ghost" onClick={() => { void navigator.clipboard.writeText(text).then(() => toast.success(copy.summary.copied)); }}><ClipboardCopyIcon aria-hidden="true" />{copy.summary.copy}</button>
            <button type="button" className="ctr-btn is-ghost" onClick={download}><DownloadIcon aria-hidden="true" />{copy.summary.download}</button>
          </div>
          <div className="ai-split">
            <SummaryView a={full} docId={docId} copy={copy} locale={locale} onCite={setSelected} selected={selected?.n ?? null} />
            {selected ? <SourceViewer citation={selected} citations={[]} locale={locale} onSelect={setSelected} onClose={() => setSelected(null)} /> : null}
          </div>
          <p className="ai-disclaimer">{copy.answer.disclaimer}</p>
        </>
      ) : null}
      {data.artifacts.filter((a) => a.status === "READY" || a.status === "STALE").length > 1 ? (
        <details><summary>{copy.summary.existing}</summary>
          <ul>{data.artifacts.filter((a) => a.status === "READY" || a.status === "STALE").map((a) => <li key={a.id}><button type="button" className="ins-link" onClick={() => { setTemplate(a.template); setLanguage(a.language); setPick(a.id); }}>{(copy.summary.template as Record<string, string>)[a.template]} · {a.language.toUpperCase()} · {fmtDateTime(a.createdAt, locale)}{a.status === "STALE" ? ` · ${copy.answer.sourceStatus.UPDATED}` : ""}</button></li>)}</ul>
        </details>
      ) : null}
      <Shell open={confirm} onOpenChange={setConfirm} title={copy.summary.regenerate} description={copy.summary.regenerateBody}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setConfirm(false)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" onClick={() => { setConfirm(false); gen.mutate(true); }}>{copy.summary.regenerate}</button>
        </div>
      </Shell>
    </section>
  );
}
