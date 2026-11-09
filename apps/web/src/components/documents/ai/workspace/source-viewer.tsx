"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, LockIcon, XIcon } from "lucide-react";
import Link from "next/link";

import type { AuthLocale } from "@/lib/auth/types";
import { failureOf } from "@/lib/documents/api";
import { fetchChunkContext } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import type { Citation } from "@/lib/documents/ai/rag-types";
import { useDocKeys } from "@/lib/documents/session";
import { fill } from "@/lib/documents/view";

import { Skeletons } from "../../doc-ui";
import { PageText } from "./answer-card";

type Props = { citation: Citation | null; citations: Citation[]; locale: AuthLocale; onSelect: (c: Citation) => void; onClose?: () => void };

/** The cited chunk with its neighbours, re-fetched through the permissioned context route. Highlights the verified quote. Never invents page numbers. */
export function SourceViewer({ citation, citations, locale, onSelect, onClose }: Props) {
  const copy = getRagCopy(locale);
  const { key } = useDocKeys();
  const gone = citation?.sourceStatus === "NO_LONGER_ACCESSIBLE";
  const q = useQuery({
    queryKey: key("ai-source", citation?.documentId ?? "", citation?.chunkId ?? ""), enabled: Boolean(citation) && !gone, retry: false, staleTime: 30_000,
    queryFn: ({ signal }) => fetchChunkContext(citation!.documentId, citation!.chunkId, signal),
  });
  const idx = citation ? citations.findIndex((c) => c.n === citation.n) : -1;
  const prev = idx > 0 ? citations[idx - 1] : undefined;
  const next = idx >= 0 && idx < citations.length - 1 ? citations[idx + 1] : undefined;

  return (
    <aside className="ai-viewer" aria-label={copy.viewer.title}>
      <header className="ctr-row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{copy.viewer.title}</h3>
        <span className="ctr-row" style={{ gap: "0.25rem" }}>
          <button type="button" className="ctr-btn is-ghost" disabled={!prev} aria-label={copy.viewer.previous} onClick={() => prev && onSelect(prev)}><ChevronLeftIcon aria-hidden="true" /></button>
          <button type="button" className="ctr-btn is-ghost" disabled={!next} aria-label={copy.viewer.next} onClick={() => next && onSelect(next)}><ChevronRightIcon aria-hidden="true" /></button>
          {onClose ? <button type="button" className="ctr-btn is-ghost" aria-label={copy.viewer.close} onClick={onClose}><XIcon aria-hidden="true" /></button> : null}
        </span>
      </header>
      {!citation ? <p className="ins-muted">{copy.viewer.empty}</p> : gone ? (
        <div className="ai-note" role="status"><LockIcon aria-hidden="true" />{copy.viewer.unavailable}</div>
      ) : q.isPending ? <Skeletons n={2} /> : q.isError ? (
        <div className="ai-note" role="status"><LockIcon aria-hidden="true" />{failureOf(q.error).status === 404 || failureOf(q.error).status === 403 ? copy.viewer.unavailable : copy.common.error}</div>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <div><strong>{q.data.docNo ?? ""} {q.data.title ?? ""}</strong><br /><span className="ins-muted">{q.data.category ?? ""} · {fill(copy.answer.version, { n: q.data.versionNo })}</span></div>
          {q.data.chunks.map((c) => (
            <section key={c.chunkId} className="ai-ctx" data-cited={c.isCited} aria-label={c.isCited ? copy.viewer.cited : undefined}>
              <header className="ins-muted"><PageText c={c} copy={copy} />{c.section ? ` · ${copy.answer.section}: ${c.section}` : ""}{c.isCited ? ` · ${copy.viewer.cited}` : ""}</header>
              <p>{c.isCited && citation.quote && citation.quoteVerified && c.text.includes(citation.quote) ? <Highlight text={c.text} quote={citation.quote} /> : c.text}</p>
            </section>
          ))}
          {!q.data.chunks.some((c) => c.pageStart !== null) ? <p className="ins-muted">{copy.viewer.noPageNote}</p> : null}
          <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            {q.data.previewable && citation.pageStart !== null ? <Link className="ctr-btn" href={`/documents/${citation.documentId}?tab=preview&page=${citation.pageStart}`}><ExternalLinkIcon aria-hidden="true" />{fill(copy.viewer.openAtPage, { n: citation.pageStart })}</Link> : null}
            <Link className="ctr-btn is-ghost" href={`/documents/${citation.documentId}`}>{copy.viewer.openDocument}</Link>
          </div>
          <p className="ins-muted">{copy.viewer.redacted}</p>
        </div>
      )}
    </aside>
  );
}

function Highlight({ text, quote }: { text: string; quote: string }) {
  const i = text.indexOf(quote);
  return <>{text.slice(0, i)}<mark className="dt-mark">{quote}</mark>{text.slice(i + quote.length)}</>;
}
