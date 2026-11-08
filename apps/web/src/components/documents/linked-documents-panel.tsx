"use client";

import { useQuery } from "@tanstack/react-query";
import { UploadCloudIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { failureOf, fetchDocuments, fetchProjectDocs } from "@/lib/documents/api";
import { getDocCopy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";
import type { DocItem } from "@/lib/documents/types";
import { fill, fmtDate, formatSize } from "@/lib/documents/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { CategoryChip, EmptyState, ErrorState, FileTypeIcon, Skeletons, StatusChip } from "./doc-ui";
import { DocumentPreviewDrawer } from "./document-parts";
import { UploadDialog } from "./upload-wizard";

export type LinkedEntity = { type: "project" | "contractor" | "inspection" | "asset" | "payment"; id: string; label?: string; category?: string };

/**
 * Compact documents list for a project or another entity page. Uses the same API and the same permission filter as the library;
 * the upload button pre-fills the project, category and link. Entities are only offered where their pages exist.
 */
export function LinkedDocumentsPanel({ entity }: { entity: LinkedEntity }) {
  const [locale] = useWorkspaceLocale();
  const copy = getDocCopy(locale);
  const { key } = useDocKeys();
  const [open, setOpen] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [category, setCategory] = useState("");
  const q = useQuery({
    queryKey: key("linked", entity.type, entity.id, category),
    queryFn: async ({ signal }) => {
      if (entity.type === "project") return fetchProjectDocs(entity.id, { limit: 8, category }, signal);
      const f = await fetchDocuments({ [`${entity.type}Id`]: entity.id, limit: 8, category }, signal);
      return { items: f.items, total: f.meta.total, byCategory: f.facets.category, canUpload: false };
    },
  });
  const items: DocItem[] = q.data?.items ?? [];
  if (q.isError && failureOf(q.error).status === 403) return null; // no document.read: the panel simply is not offered
  const idx = items.findIndex((d) => d.id === open);
  const prefill = entity.type === "project" ? { projectId: entity.id, projectLabel: entity.label ?? "" } : { links: { [`${entity.type}Id`]: entity.id } };
  const href = entity.type === "project" ? `/documents?projectId=${entity.id}` : entity.type === "contractor" ? `/documents?contractorId=${entity.id}` : "/documents";
  return (
    <section className="ins dt-panel" aria-label={copy.panel.title}>
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{copy.panel.title}{q.data ? <span className="ins-muted"> · {fill(copy.panel.total, { n: q.data.total })}</span> : null}</h3>
        <div className="ctr-row">
          {q.data?.canUpload ? <button type="button" className="ctr-btn" onClick={() => setUpload(true)}><UploadCloudIcon aria-hidden="true" />{copy.panel.upload}</button> : null}
          <Link className="ctr-btn is-ghost" href={href}>{copy.panel.openInDocTrace}</Link>
        </div>
      </div>
      {q.data?.byCategory.length ? (
        <div className="ctr-row" style={{ flexWrap: "wrap", gap: "0.3rem" }} role="group" aria-label={copy.dashboard.filters.category}>
          <button type="button" className="dt-pill" aria-pressed={!category} onClick={() => setCategory("")}>{copy.common.all}</button>
          {q.data.byCategory.map((c) => <button key={c.key} type="button" className="dt-pill" aria-pressed={category === c.key} onClick={() => setCategory(category === c.key ? "" : c.key)}>{(copy.category as Record<string, string>)[c.key] ?? c.key} <small>{c.count}</small></button>)}
        </div>
      ) : null}
      {q.isPending ? <Skeletons n={2} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : !items.length ? <EmptyState title={copy.panel.empty} /> : (
        <ul className="dt-files">
          {items.map((d) => (
            <li key={d.id} className="dt-file" style={{ gridTemplateColumns: "auto 1fr auto" }}>
              <FileTypeIcon mime={d.mimeType} name={d.fileName} />
              <div style={{ minWidth: 0 }}><Link className="ins-link" href={`/documents/${d.id}`}>{d.title}</Link><br /><span className="ins-muted">{d.docNo ?? "—"} · <CategoryChip category={d.category} copy={copy} /> · {formatSize(d.sizeBytes, locale)} · {fmtDate(d.createdAt, locale)}</span></div>
              <div className="ctr-row"><StatusChip status={d.status} copy={copy} />{d.fileAvailable && d.origin === "DOCTRACE" ? <button type="button" className="ctr-btn" onClick={() => setOpen(d.id)}>{copy.common.preview}</button> : null}</div>
            </li>
          ))}
        </ul>
      )}
      {q.data && q.data.total > items.length ? <Link className="ins-link" href={href}>{copy.panel.viewAll}</Link> : null}
      {open && idx >= 0 ? <DocumentPreviewDrawer doc={items[idx]!} copy={copy} locale={locale} onClose={() => setOpen(null)} onPrev={idx > 0 ? () => setOpen(items[idx - 1]!.id) : undefined} onNext={idx < items.length - 1 ? () => setOpen(items[idx + 1]!.id) : undefined} /> : null}
      <UploadDialog open={upload} onOpenChange={setUpload} prefill={prefill} />
    </section>
  );
}
