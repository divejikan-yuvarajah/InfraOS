"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AI_SCOPE_MAX_DOCUMENTS, type AiScopeMode } from "@infraos/shared-types";

import type { AuthLocale } from "@/lib/auth/types";
import { fetchDocuments } from "@/lib/documents/api";
import { coverageState } from "@/lib/documents/ai/citations";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import type { Scope, ScopePreview } from "@/lib/documents/ai/rag-types";
import { chipKind } from "@/lib/documents/ai/view";
import { getDocCopy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";
import type { DocItem } from "@/lib/documents/types";
import { fill } from "@/lib/documents/view";

import { ProjectPicker } from "../../project-picker";

type Props = { locale: AuthLocale; scope: Scope; onScope: (s: Scope) => void; singleOnly: boolean; preview: ScopePreview | undefined; previewPending: boolean; previewError: boolean };

const REASON: Record<string, string> = { QUEUED: "QUEUED", PROCESSING: "PROCESSING", FAILED: "FAILED", UNSUPPORTED: "UNSUPPORTED", SCANNED: "SCANNED", EXCLUDED: "EXCLUDED", NOT_ELIGIBLE: "UNSUPPORTED", NOT_PROCESSED: "NOT_PROCESSED" };
export const readiness = (d: DocItem): { ready: boolean; reason: string | null } => {
  const k = chipKind(d.ai);
  return k === "READY" || k === "ATTENTION" ? { ready: true, reason: null } : { ready: false, reason: d.ai.sensitive && !d.ai.allowed ? "SENSITIVE" : REASON[k] ?? "NOT_PROCESSED" };
};

export function CoverageMeter({ preview, locale, pending, error }: { preview: ScopePreview | undefined; locale: AuthLocale; pending: boolean; error: boolean }) {
  const copy = getRagCopy(locale);
  const [open, setOpen] = useState(false);
  if (pending) return <div className="ai-cover" role="status">{copy.common.loading}</div>;
  if (error || !preview) return <div className="ai-cover" role="status">{copy.common.error}</div>;
  const c = coverageState(preview);
  return (
    <div className="ai-cover" data-partial={c.partial}>
      <div className="ctr-row" style={{ justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <strong className="dt-tabnum">{c.total === 0 ? copy.scope.none : fill(copy.scope.searching, { n: c.searched, total: c.total })}</strong>
        {c.missing > 0 ? <button type="button" className="ctr-chip-btn" aria-expanded={open} onClick={() => setOpen(!open)}><AlertTriangleIcon aria-hidden="true" />{fill(copy.scope.notSearchable, { m: c.missing })}</button> : null}
      </div>
      <div className="ai-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.percent} aria-label={fill(copy.scope.searching, { n: c.searched, total: c.total })}><i style={{ width: `${c.percent}%` }} /></div>
      {preview.truncatedScope ? <p className="ins-muted" style={{ margin: 0 }}>{copy.scope.truncated}</p> : null}
      {open ? (
        <ul className="ai-notready" aria-label={copy.scope.notReadyList}>
          {preview.notAiReady.map((n) => (
            <li key={n.id}><span>{n.docNo ?? ""} {n.title}</span><span className="ctr-badge" data-tone="neutral">{(copy.scope.reason as Record<string, string>)[n.reasonCode] ?? n.reasonCode}</span><Link className="ins-link" href={`/documents/${n.id}?tab=ai`}>{copy.scope.openAiTab}</Link></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ScopePanel({ locale, scope, onScope, singleOnly, preview, previewPending, previewError }: Props) {
  const copy = getRagCopy(locale);
  const docCopy = getDocCopy(locale);
  const { key } = useDocKeys();
  const [q, setQ] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const showList = scope.mode === "DOCUMENT" || scope.mode === "DOCUMENTS";
  const list = useQuery({ queryKey: key("ai-scope-docs", q), enabled: showList, staleTime: 15_000, retry: false, queryFn: ({ signal }) => fetchDocuments({ q: q || undefined, status: "ACTIVE", origin: "DOCTRACE", sort: q ? "relevance" : "updated", limit: 20 }, signal) });
  const modes: { mode: AiScopeMode; label: string }[] = singleOnly ? [{ mode: "DOCUMENT", label: copy.scope.thisDocument }] : [{ mode: "DOCUMENT", label: copy.scope.thisDocument }, { mode: "DOCUMENTS", label: copy.scope.selected }, { mode: "PROJECT", label: copy.scope.project }, { mode: "ALL", label: copy.scope.all }];
  const chosen = new Set(scope.documentIds ?? []);
  const pick = (d: DocItem) => {
    if (scope.mode === "DOCUMENT") return onScope({ mode: "DOCUMENT", documentIds: [d.id] });
    const next = new Set(chosen);
    if (next.has(d.id)) next.delete(d.id); else if (next.size < AI_SCOPE_MAX_DOCUMENTS) next.add(d.id);
    onScope({ mode: "DOCUMENTS", documentIds: [...next] });
  };
  return (
    <aside className="ai-scope" aria-label={copy.scope.title}>
      <h3 style={{ margin: 0 }}>{copy.scope.title}</h3>
      <div role="radiogroup" aria-label={copy.scope.title} className="ai-modes">
        {modes.map((m) => (
          <button key={m.mode} type="button" role="radio" aria-checked={scope.mode === m.mode} className="ctr-chip-btn" onClick={() => onScope(m.mode === "ALL" ? { mode: "ALL" } : m.mode === "PROJECT" ? { mode: "PROJECT", ...(scope.projectId ? { projectId: scope.projectId } : {}) } : { mode: m.mode, ...(scope.documentIds?.length ? { documentIds: m.mode === "DOCUMENT" ? scope.documentIds.slice(0, 1) : scope.documentIds } : {}) })}>{m.label}</button>
        ))}
      </div>
      {scope.mode === "PROJECT" ? <ProjectPicker id="ai-scope-project" copy={docCopy} value={scope.projectId ?? ""} label={projectLabel} onChange={(id, l) => { setProjectLabel(l); onScope({ mode: "PROJECT", ...(id ? { projectId: id } : {}) }); }} /> : null}
      {showList ? (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="sr-only" htmlFor="ai-scope-search">{copy.scope.search}</label>
          <input id="ai-scope-search" className="ctr-input" value={q} placeholder={copy.scope.search} maxLength={100} onChange={(e) => setQ(e.target.value)} />
          <span className="ins-muted">{scope.mode === "DOCUMENTS" ? `${copy.scope.pickDocs} · ${fill(copy.scope.selectedCount, { n: chosen.size })}` : copy.scope.pickDocs}{scope.mode === "DOCUMENTS" && chosen.size ? <> · <button type="button" className="ins-link" onClick={() => onScope({ mode: "DOCUMENTS" })}>{copy.scope.clear}</button></> : null}</span>
          <ul className="ai-doclist" aria-busy={list.isPending}>
            {list.isError ? <li className="ins-muted">{copy.common.error}</li> : list.data?.items.length === 0 ? <li className="ins-muted">{copy.scope.noDocs}</li> : list.data?.items.map((d) => {
              const r = readiness(d);
              const on = chosen.has(d.id);
              return (
                <li key={d.id} data-disabled={!r.ready}>
                  <label>
                    <input type={scope.mode === "DOCUMENT" ? "radio" : "checkbox"} name="ai-doc" checked={on} disabled={!r.ready || (!on && scope.mode === "DOCUMENTS" && chosen.size >= AI_SCOPE_MAX_DOCUMENTS)} onChange={() => pick(d)} />
                    <FileTextIcon aria-hidden="true" /><span><strong>{d.title}</strong><br /><span className="ins-muted">{d.docNo ?? ""}</span></span>
                  </label>
                  {!r.ready ? <span className="ctr-badge" data-tone="neutral" title={copy.scope.disabled}>{(copy.scope.reason as Record<string, string>)[r.reason!]}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <CoverageMeter preview={preview} locale={locale} pending={previewPending} error={previewError} />
    </aside>
  );
}
