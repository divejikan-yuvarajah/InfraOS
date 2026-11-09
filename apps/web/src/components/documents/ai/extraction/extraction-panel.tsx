"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckIcon, ClipboardCopyIcon, PencilIcon, ScanSearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/inspections/inspection-ui";
import { ApiError } from "@/lib/api/errors";
import type { AuthLocale } from "@/lib/auth/types";
import { formatValue, groupFields, strongMatchKeys } from "@/lib/documents/ai/citations";
import { applyMetadata, createExtraction, fetchExtraction, fetchExtractions, saveReview } from "@/lib/documents/ai/rag-api";
import { getRagCopy, type RagCopy } from "@/lib/documents/ai/rag-messages";
import type { Citation, ExtractField, ExtractionDetail } from "@/lib/documents/ai/rag-types";
import { pollInterval } from "@/lib/documents/ai/view";
import { getDocCopy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";
import { fill } from "@/lib/documents/view";

import { ErrorState, Field, Shell, Skeletons } from "../../doc-ui";
import { SourceViewer } from "../workspace/source-viewer";

const ACTIVE = ["QUEUED", "RUNNING"];
const DIFF_TONE = { MATCH: "success", DIFFERS: "critical", NO_RECORD: "neutral", NOT_COMPARABLE: "neutral" } as const;
const STRENGTH_TONE = { STRONG: "success", WEAK: "pending", NONE: "neutral" } as const;
const STATUS_TONE = { FOUND: "success", AMBIGUOUS: "pending", NOT_FOUND: "neutral" } as const;

type Props = { docId: string; locale: AuthLocale };

function errText(e: unknown, copy: RagCopy): string {
  const code = e instanceof ApiError ? e.code ?? "generic" : "generic";
  if (e instanceof ApiError && e.status === 409 && code === "CONFLICT") return copy.extract.stale;
  return (copy.answer.errors as Record<string, string>)[code] ?? (code === "NOT_AI_READY" ? copy.extract.notReady : copy.answer.errors.generic);
}

function FieldRow({ f, d, copy, locale, canReview, onDecide, onCite, onEdit }: { f: ExtractField; d: ExtractionDetail; copy: RagCopy; locale: AuthLocale; canReview: boolean; onDecide: (key: string, decision: "ACCEPTED" | "REJECTED" | "PENDING") => void; onCite: (n: number) => void; onEdit: (f: ExtractField) => void }) {
  const dec = d.review.decisions[f.key];
  const diff = d.diffs[f.key];
  const label = (copy.extract.field as Record<string, string>)[f.key] ?? f.key;
  const shown = dec?.decision === "EDITED" && dec.editedValue ? [dec.editedValue] : f.values.map((v) => formatValue(v, locale));
  const best = f.values[0]?.strength ?? "NONE";
  const cites = [...new Set(f.values.flatMap((v) => v.citationNs))];
  const link = diff?.record ? `/${diff.record.type === "PROJECT" ? "projects" : "contractors"}/${diff.record.id}` : null;
  return (
    <tr data-decision={dec?.decision ?? "PENDING"}>
      <th scope="row">{label}</th>
      <td>
        {shown.length ? <ul className="ai-values">{shown.map((s, i) => <li key={i}>{s}{f.values[i]?.readings ? <span className="ins-muted"> — {fill(copy.extract.readings, { a: f.values[i]!.readings![0]!, b: f.values[i]!.readings![1]! })}</span> : null}</li>)}</ul> : <span className="ins-muted">{copy.common.none}</span>}
        {f.reason ? <span className="ins-muted ai-reason">{(copy.extract.reason as Record<string, string>)[f.reason] ?? ""}</span> : null}
      </td>
      <td>
        <span className="ctr-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
          <Chip tone={STATUS_TONE[f.status]}>{copy.extract.status[f.status]}</Chip>
          {f.values.length ? <Chip tone={STRENGTH_TONE[best]}>{copy.extract.strength[best]}</Chip> : null}
          <span className="ai-cites">{cites.map((n) => <button key={n} type="button" className="ai-cite" aria-label={fill(copy.answer.openSource, { n })} onClick={() => onCite(n)}>{n}</button>)}</span>
        </span>
      </td>
      <td>
        {diff ? <span style={{ display: "grid", gap: "0.15rem" }}><Chip tone={DIFF_TONE[diff.state]}>{copy.extract.diff[diff.state]}</Chip>{diff.current ? <span className="ins-muted dt-tabnum">{diff.current}</span> : null}
          {link && diff.record ? <Link className="ins-link" href={link}>{fill(copy.extract.openRecord, { type: copy.extract.record[diff.record.type] })}</Link> : null}</span> : null}
      </td>
      <td>
        <span className="ctr-row" style={{ gap: "0.25rem", flexWrap: "wrap" }}>
          <span className="ctr-badge" data-tone={dec && dec.decision !== "PENDING" ? "active" : "neutral"}>{copy.extract.decided[(dec?.decision ?? "PENDING") as keyof typeof copy.extract.decided]}</span>
          {canReview ? (
            <>
              <button type="button" className="ctr-btn is-ghost" disabled={f.values.length === 0} onClick={() => onDecide(f.key, "ACCEPTED")}><CheckIcon aria-hidden="true" />{copy.extract.accept}</button>
              <button type="button" className="ctr-btn is-ghost" onClick={() => onEdit(f)}><PencilIcon aria-hidden="true" />{copy.extract.edit}</button>
              <button type="button" className="ctr-btn is-ghost" onClick={() => onDecide(f.key, "REJECTED")}><XIcon aria-hidden="true" />{copy.extract.reject}</button>
              {dec && dec.decision !== "PENDING" ? <button type="button" className="ctr-btn is-ghost" onClick={() => onDecide(f.key, "PENDING")}>{copy.extract.reset}</button> : null}
            </>
          ) : null}
          {f.values.length ? <button type="button" className="ctr-btn is-ghost" aria-label={`${copy.extract.copy}: ${label}`} onClick={() => void navigator.clipboard.writeText(shown.join("; ")).then(() => toast.success(copy.extract.copied))}><ClipboardCopyIcon aria-hidden="true" /></button> : null}
        </span>
      </td>
    </tr>
  );
}

export function ExtractionPanel({ docId, locale }: Props) {
  const copy = getRagCopy(locale);
  const docCopy = getDocCopy(locale);
  const { key } = useDocKeys();
  const qc = useQueryClient();
  const [template, setTemplate] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [selected, setSelected] = useState<Citation | null>(null);
  const [editing, setEditing] = useState<ExtractField | null>(null);
  const [editText, setEditText] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [strongOpen, setStrongOpen] = useState(false);
  const [rerun, setRerun] = useState(false);

  const list = useQuery({
    queryKey: key("ai-extractions", docId), queryFn: ({ signal }) => fetchExtractions(docId, signal), retry: false,
    refetchInterval: (q) => pollInterval(q.state.data?.artifacts.some((x) => ACTIVE.includes(x.status)) ? { status: "RUNNING" } : null, q.state.dataUpdateCount, typeof document !== "undefined" && document.hidden),
  });
  const current = list.data?.artifacts.find((a) => a.id === pick) ?? list.data?.artifacts.find((a) => a.template === template && a.status !== "FAILED" && a.status !== "STALE") ?? list.data?.artifacts.find((a) => a.template === template);
  const detailKey = key("ai-extraction", docId, current?.id ?? "");
  const detail = useQuery({ queryKey: detailKey, enabled: Boolean(current && (current.status === "READY" || current.status === "STALE")), retry: false, queryFn: ({ signal }) => fetchExtraction(docId, current!.id, signal) });
  const run = useMutation({
    mutationFn: (regenerate: boolean) => createExtraction(docId, { template: template!, ...(regenerate ? { regenerate: true } : {}) }),
    onSuccess: (a) => { setPick(a.id); void qc.invalidateQueries({ queryKey: key("ai-extractions", docId) }); },
    onError: (e) => toast.error(errText(e, copy)),
  });
  const review = useMutation({
    mutationFn: (decisions: { fieldKey: string; decision: string; editedValue?: string }[]) => saveReview(docId, current!.id, { version: detail.data!.version, decisions }),
    onSuccess: (d) => { qc.setQueryData(detailKey, d); toast.success(copy.extract.saved); setEditing(null); },
    onError: (e) => { toast.error(errText(e, copy)); void detail.refetch(); },
  });
  const apply = useMutation({
    mutationFn: (keys: string[]) => applyMetadata(docId, current!.id, keys),
    onSuccess: async () => { toast.success(copy.extract.apply.done); setApplyOpen(false); await qc.invalidateQueries({ queryKey: ["documents"] }); await detail.refetch(); },
    onError: (e) => toast.error(errText(e, copy)),
  });

  if (list.isPending) return <Skeletons n={3} />;
  if (list.isError) return <ErrorState error={list.error} copy={docCopy} onRetry={() => void list.refetch()} />;
  const data = list.data;
  const busy = Boolean(current && ACTIVE.includes(current.status));
  const d = detail.data && (detail.data.status === "READY" || detail.data.status === "STALE") ? detail.data : null;
  const fields = d?.result?.fields ?? [];
  const tpl = data.templates.find((t) => t.key === template);
  const strong = d ? strongMatchKeys(fields, d.diffs, d.review.decisions) : [];
  const decide = (k: string, decision: "ACCEPTED" | "REJECTED" | "PENDING") => review.mutate([{ fieldKey: k, decision }]);
  const openCite = (n: number) => { const c = d?.citations?.find((x) => x.n === n); if (c && d) setSelected({ n, chunkId: c.chunkId, documentId: docId, versionNo: d.versionNo, sourceStatus: "CURRENT", docNo: null, title: null, category: null, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, quote: c.quote, quoteVerified: c.quoteVerified, wasNeighbor: false }); };
  const applicable = d?.metadataPreview ?? [];

  return (
    <section className="dt-panel" aria-label={copy.extract.title} style={{ display: "grid", gap: "0.8rem" }}>
      <header><h3 style={{ margin: 0 }}>{copy.extract.title}</h3><p className="ins-muted" style={{ margin: 0 }}>{copy.extract.subtitle}</p></header>
      <p className="ai-note" role="note"><AlertTriangleIcon aria-hidden="true" />{copy.extract.banner}</p>
      {!data.ready ? <p className="ai-note" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.extract.notReady}</p> : null}
      <div role="radiogroup" aria-label={copy.extract.chooseTemplate} className="ai-templates">
        {data.templates.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={template === t.key} className="ai-template" onClick={() => { setTemplate(t.key); setPick(null); }}>
            <strong>{(copy.extract.template as Record<string, string>)[t.key]}</strong>
            <span className="ins-muted">{t.fields?.map((f) => (copy.extract.field as Record<string, string>)[f.key]).slice(0, 4).join(", ")}…</span>
            {t.suggested ? <span className="ctr-badge" data-tone="success">{copy.summary.suggested}</span> : null}
          </button>
        ))}
      </div>
      <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="ctr-btn is-primary" disabled={!template || !data.ready || run.isPending || busy || Boolean(current && current.status === "READY")} onClick={() => run.mutate(false)}><ScanSearchIcon aria-hidden="true" />{run.isPending ? copy.common.working : copy.extract.run}</button>
        {current?.status === "READY" || current?.status === "STALE" ? <button type="button" className="ctr-btn" disabled={run.isPending || busy || !data.ready} onClick={() => setRerun(true)}>{copy.extract.runAgain}</button> : null}
      </div>
      {tpl ? null : null}

      {current && busy ? <div className="ai-pending" role="status" aria-live="polite"><span>{copy.extract.progress}</span></div> : null}
      {current?.status === "FAILED" ? <div className="ai-fail" role="alert"><b>{copy.extract.failed}</b><span>{(copy.answer.errors as Record<string, string>)[current.errorCode ?? ""] ?? copy.answer.errors.generic}</span><div><button type="button" className="ctr-btn" onClick={() => run.mutate(false)}>{copy.extract.retry}</button></div></div> : null}

      {d ? (
        <>
          {d.stale ? <p className="ai-note" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.summary.stale}</p> : null}
          {!d.canReview ? <p className="ins-muted" role="note">{copy.extract.readOnly}</p> : null}
          <div className="ctr-row" style={{ justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ minWidth: "12rem", flex: "1 1 12rem" }}>
              <strong className="dt-tabnum">{d.review.status === "REVIEWED" ? copy.extract.reviewed : fill(copy.extract.reviewProgress, { d: d.review.decided, t: d.review.total })}</strong>
              <div className="ai-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.review.total ? Math.round((d.review.decided / d.review.total) * 100) : 0} aria-label={fill(copy.extract.reviewProgress, { d: d.review.decided, t: d.review.total })}><i style={{ width: `${d.review.total ? (d.review.decided / d.review.total) * 100 : 0}%` }} /></div>
            </div>
            {d.canReview ? (
              <span className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <button type="button" className="ctr-btn" disabled={!strong.length || review.isPending} title={strong.length ? copy.extract.acceptStrongBody : copy.extract.acceptNone} onClick={() => setStrongOpen(true)}>{copy.extract.acceptStrong}</button>
                <button type="button" className="ctr-btn is-primary" disabled={!applicable.length || apply.isPending} title={applicable.length ? undefined : copy.extract.apply.empty} onClick={() => setApplyOpen(true)}>{copy.extract.apply.button}</button>
              </span>
            ) : null}
          </div>
          <div className="ai-split">
            <div style={{ display: "grid", gap: "0.8rem", minWidth: 0 }}>
              {groupFields(fields, tpl).map((g) => (
                <div key={g.group}>
                  <h4 style={{ margin: "0 0 0.3rem" }}>{(copy.extract.group as Record<string, string>)[g.group]}</h4>
                  <div className="ins-tablewrap">
                    <table className="ins-table dt ai-extract-table">
                      <thead><tr>{[copy.extract.column.field, copy.extract.column.value, copy.extract.column.evidence, copy.extract.column.record, copy.extract.column.actions].map((x) => <th key={x} scope="col">{x}</th>)}</tr></thead>
                      <tbody>{g.fields.map((f) => <FieldRow key={f.key} f={f} d={d} copy={copy} locale={locale} canReview={d.canReview && !review.isPending} onDecide={decide} onCite={openCite} onEdit={(fl) => { setEditing(fl); setEditText(d.review.decisions[fl.key]?.editedValue ?? fl.values[0]?.rawText ?? ""); }} />)}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            {selected ? <SourceViewer citation={selected} citations={[]} locale={locale} onSelect={setSelected} onClose={() => setSelected(null)} /> : null}
          </div>
          <p className="ai-disclaimer">{copy.answer.disclaimer}</p>
        </>
      ) : null}

      <Shell open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} title={copy.extract.editTitle} description={copy.extract.editHelp}>
        {editing ? (
          <form style={{ display: "grid", gap: "0.6rem" }} onSubmit={(e) => { e.preventDefault(); if (editText.trim()) review.mutate([{ fieldKey: editing.key, decision: "EDITED", editedValue: editText.trim() }]); }}>
            <Field label={(copy.extract.field as Record<string, string>)[editing.key] ?? editing.key}>{(id) => <input id={id} className="ctr-input" value={editText} maxLength={1500} autoFocus onChange={(e) => setEditText(e.target.value)} />}</Field>
            {review.isError ? <p role="alert" className="ins-muted">{copy.extract.invalid}</p> : null}
            <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="ctr-btn" onClick={() => setEditing(null)}>{copy.common.cancel}</button>
              <button type="submit" className="ctr-btn is-primary" disabled={!editText.trim() || review.isPending}>{review.isPending ? copy.common.working : copy.extract.save}</button>
            </div>
          </form>
        ) : null}
      </Shell>
      <Shell open={strongOpen} onOpenChange={setStrongOpen} title={copy.extract.acceptStrong} description={copy.extract.acceptStrongBody}>
        <p className="dt-tabnum">{strong.map((k) => (copy.extract.field as Record<string, string>)[k] ?? k).join(", ")}</p>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setStrongOpen(false)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" disabled={review.isPending} onClick={() => { setStrongOpen(false); review.mutate(strong.map((k) => ({ fieldKey: k, decision: "ACCEPTED" }))); }}>{copy.extract.accept}</button>
        </div>
      </Shell>
      <Shell open={applyOpen} onOpenChange={setApplyOpen} title={copy.extract.apply.title} description={copy.extract.apply.body} wide>
        {applicable.length === 0 ? <p className="ins-muted">{copy.extract.apply.empty}</p> : (
          <table className="ins-table dt"><thead><tr>{[copy.extract.column.field, copy.extract.apply.before, copy.extract.apply.after].map((x) => <th key={x} scope="col">{x}</th>)}</tr></thead>
            <tbody>{applicable.map((p) => <tr key={p.fieldKey}><th scope="row">{(copy.extract.apply.field as Record<string, string>)[p.metadataField] ?? p.metadataField}</th><td>{p.before ?? copy.extract.apply.none}</td><td><strong>{p.after}</strong></td></tr>)}</tbody></table>
        )}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setApplyOpen(false)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" disabled={!applicable.length || apply.isPending} onClick={() => apply.mutate(applicable.map((p) => p.fieldKey))}>{apply.isPending ? copy.common.working : copy.extract.apply.confirm}</button>
        </div>
      </Shell>
      <Shell open={rerun} onOpenChange={setRerun} title={copy.extract.runAgain} description={copy.extract.runAgainBody}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setRerun(false)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" onClick={() => { setRerun(false); run.mutate(true); }}>{copy.extract.runAgain}</button>
        </div>
      </Shell>
    </section>
  );
}
