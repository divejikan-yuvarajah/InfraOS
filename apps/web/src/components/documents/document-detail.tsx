"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, PencilIcon, ReplaceIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { categoryDef, DOCUMENT_LANGUAGES } from "@infraos/shared-types";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { failureOf, fetchActivity, fetchDocument, fetchVersions, patchDocument, setDocStatus } from "@/lib/documents/api";
import { getDocCopy, type Copy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";
import type { DocDetail, Visibility } from "@/lib/documents/types";
import { fill, fmtDate, fmtDateTime, formatSize } from "@/lib/documents/view";
import { useUrlParams } from "@/lib/finance/url-state";
import { getAiCopy } from "@/lib/documents/ai/messages";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { AiStatusChip, CategoryChip, Chip, ConfidentialityChip, EmptyState, ErrorState, errorText, Field, FileTypeIcon, Skeletons, StatusChip, VersionBadge } from "./doc-ui";
import { ArchiveDialog, copyDocLink, DeleteDialog, downloadDoc, PreviewPane, ReplaceDialog, RestoreAction, RestrictDialog, useRefreshDocs, VersionActionDialog } from "./document-parts";
import { AiProcessingPanel } from "./ai/ai-processing-panel";
import { CategoryPicker, TagsInput } from "./form-parts";

const TABS = ["overview", "preview", "ai", "versions", "links", "activity", "access"] as const;
type Tab = (typeof TABS)[number];
const meta = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000), reference: z.string().trim().max(100), tags: z.array(z.string()).max(15),
  language: z.enum([...DOCUMENT_LANGUAGES, ""] as [string, ...string[]]), documentDate: z.string(), expiresAt: z.string(),
});

function OverviewTab({ doc, copy, locale, startEditing }: { doc: DocDetail; copy: Copy; locale: Parameters<typeof formatSize>[1]; startEditing: boolean }) {
  const refresh = useRefreshDocs();
  const [editing, setEditing] = useState(startEditing && doc.permissions.canEdit);
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const initial = useMemo(() => ({ title: doc.title, description: doc.description ?? "", reference: doc.reference ?? "", tags: doc.tags, language: doc.language ?? "", documentDate: day(doc.documentDate), expiresAt: day(doc.expiresAt), category: doc.category, visibility: doc.visibility as Visibility }), [doc]);
  const [f, setF] = useState(initial);
  const [stale, setStale] = useState(false);
  const parsed = meta.safeParse(f);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const save = useMutation({
    mutationFn: () => patchDocument(doc.id, {
      version: doc.version, title: f.title.trim(), description: f.description.trim() || null, reference: f.reference.trim() || null, tags: f.tags, language: f.language || null, documentDate: f.documentDate || null, expiresAt: f.expiresAt || null,
      visibility: f.visibility, ...(f.category !== doc.category ? { category: f.category } : {}),
    }),
    onSuccess: async () => { toast.success(copy.detail.editing.saved); setEditing(false); setStale(false); await refresh(); },
    onError: (e) => { if (failureOf(e).status === 409) setStale(true); toast.error(errorText(e, copy)); },
  });
  const status = useMutation({
    mutationFn: (s: "DRAFT" | "ACTIVE") => setDocStatus(doc.id, { version: doc.version, status: s }),
    onSuccess: async () => { await refresh(); }, onError: (e) => { if (failureOf(e).status === 409) setStale(true); toast.error(errorText(e, copy)); },
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const sensitive = doc.confidentiality === "SENSITIVE";
  return (
    <section className="dt-panel" aria-label={copy.detail.tabs.overview}>
      {stale ? <div className="ctr-note" role="alert">{copy.detail.editing.stale} <button type="button" className="ctr-btn" onClick={() => { setStale(false); setEditing(false); void refresh(); }}>{copy.detail.editing.reload}</button></div> : null}
      {editing ? (
        <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); if (!dirty) { toast.info(copy.detail.editing.noChanges); return; } save.mutate(); }}>
          <Field label={copy.detail.fields.title} error={parsed.success || f.title.trim() ? null : copy.common.required}>{(id) => <input id={id} className="ctr-input" maxLength={200} value={f.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
          <div><span className="ctr-label">{copy.detail.fields.category}</span><CategoryPicker value={f.category} onChange={(k) => set({ category: k })} copy={copy} /></div>
          <Field label={copy.detail.fields.description}>{(id) => <textarea id={id} className="ctr-input" maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
          <Field label={copy.detail.fields.tags} hint={copy.wizard.classify.tagsHint}>{(id) => <TagsInput id={id} value={f.tags} onChange={(t) => set({ tags: t })} copy={copy} />}</Field>
          <div className="ctr-row" style={{ flexWrap: "wrap", alignItems: "start" }}>
            <Field label={copy.detail.fields.reference}>{(id) => <input id={id} className="ctr-input" maxLength={100} value={f.reference} onChange={(e) => set({ reference: e.target.value })} />}</Field>
            <Field label={copy.detail.fields.documentDate}>{(id) => <input id={id} type="date" className="ctr-input" value={f.documentDate} onChange={(e) => set({ documentDate: e.target.value })} />}</Field>
            <Field label={copy.detail.fields.expiresAt}>{(id) => <input id={id} type="date" className="ctr-input" value={f.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />}</Field>
            <Field label={copy.detail.fields.language}>{(id) => <select id={id} className="ctr-input" value={f.language} onChange={(e) => set({ language: e.target.value })}><option value="">{copy.common.none}</option>{DOCUMENT_LANGUAGES.map((l) => <option key={l} value={l}>{copy.wizard.language[l]}</option>)}</select>}</Field>
            <Field label={copy.detail.fields.visibility} hint={(copy.visibility as Record<string, string>)[`${f.visibility}_HELP`]} wide>{(id) => <select id={id} className="ctr-input" value={f.visibility} onChange={(e) => set({ visibility: e.target.value as Visibility })}>{(["INTERNAL", "PROJECT_TEAM", ...(sensitive ? [] : ["PUBLIC"])] as Visibility[]).map((v) => <option key={v} value={v}>{copy.visibility[v]}</option>)}</select>}</Field>
          </div>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => { setF(initial); setEditing(false); }}>{copy.common.cancel}</button>
            <button type="submit" className="ctr-btn is-primary" disabled={!parsed.success || !dirty || save.isPending}>{save.isPending ? copy.common.working : copy.detail.editing.save}</button>
          </div>
        </form>
      ) : (
        <>
          <dl className="ctr-facts">
            <dt>{copy.detail.fields.docNo}</dt><dd>{doc.docNo ?? "—"}</dd>
            <dt>{copy.detail.fields.title}</dt><dd>{doc.title}</dd>
            <dt>{copy.detail.fields.description}</dt><dd>{doc.description ?? "—"}</dd>
            <dt>{copy.detail.fields.category}</dt><dd><CategoryChip category={doc.category} copy={copy} /></dd>
            <dt>{copy.detail.fields.tags}</dt><dd>{doc.tags.length ? doc.tags.map((t) => `#${t}`).join(" ") : "—"}</dd>
            <dt>{copy.detail.fields.reference}</dt><dd>{doc.reference ?? "—"}</dd>
            <dt>{copy.detail.fields.documentDate}</dt><dd>{fmtDate(doc.documentDate, locale)}</dd>
            <dt>{copy.detail.fields.expiresAt}</dt><dd>{fmtDate(doc.expiresAt, locale)}</dd>
            <dt>{copy.detail.fields.language}</dt><dd>{doc.language ? copy.wizard.language[doc.language as "en"] : "—"}</dd>
            <dt>{copy.detail.fields.visibility}</dt><dd>{copy.visibility[doc.visibility]}</dd>
            <dt>{copy.detail.fields.owner}</dt><dd>{doc.ownerName ?? "—"}</dd>
            <dt>{copy.detail.fields.agency}</dt><dd>{doc.agencyName ?? "—"}</dd>
            <dt>{copy.detail.fields.project}</dt><dd>{doc.project ? <Link className="ins-link" href={`/projects/${doc.project.id}`}>{`${doc.project.code ?? ""} ${doc.project.title}`.trim()}</Link> : copy.dashboard.table.noProject}</dd>
            <dt>{copy.detail.fields.fileName}</dt><dd>{doc.fileName}</dd>
            <dt>{copy.detail.fields.size}</dt><dd className="dt-tabnum">{formatSize(doc.sizeBytes, locale)}</dd>
            <dt>{copy.detail.fields.hash}</dt><dd className="dt-tabnum" style={{ fontFamily: "monospace" }}>{doc.contentHash ? doc.contentHash.slice(0, 16) : "—"}</dd>
            <dt>{copy.detail.fields.created}</dt><dd>{fmtDateTime(doc.createdAt, locale)}</dd>
            <dt>{copy.detail.fields.updated}</dt><dd>{fmtDateTime(doc.updatedAt, locale)}</dd>
            <dt>{copy.detail.fields.aiStatus}</dt><dd><AiStatusChip ai={doc.ai} copy={copy} /></dd>
          </dl>
          {doc.permissions.canEdit ? (
            <div className="ctr-row" style={{ flexWrap: "wrap" }}>
              <button type="button" className="ctr-btn" onClick={() => setEditing(true)}><PencilIcon aria-hidden="true" />{copy.detail.actions.edit}</button>
              {doc.status === "ACTIVE" ? <button type="button" className="ctr-btn" disabled={status.isPending} onClick={() => status.mutate("DRAFT")}>{copy.detail.statusActions.toDraft}</button> : null}
              {doc.status === "DRAFT" || doc.status === "SUPERSEDED" ? <button type="button" className="ctr-btn" disabled={status.isPending} onClick={() => status.mutate("ACTIVE")}>{copy.detail.statusActions.toActive}</button> : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function VersionsTab({ doc, copy, locale }: { doc: DocDetail; copy: Copy; locale: Parameters<typeof formatSize>[1] }) {
  const { key } = useDocKeys();
  const q = useQuery({ queryKey: key("versions", doc.id), queryFn: ({ signal }) => fetchVersions(doc.id, signal) });
  const [act, setAct] = useState<{ mode: "restore" | "remove"; n: number } | null>(null);
  const [replace, setReplace] = useState(false);
  if (q.isPending) return <Skeletons n={3} />;
  if (q.isError) return <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} />;
  const { versions, permissions } = q.data;
  return (
    <section className="dt-panel" aria-label={copy.detail.versions.title}>
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{copy.detail.versions.title}</h3>
        {doc.permissions.canReplace ? <button type="button" className="ctr-btn is-primary" onClick={() => setReplace(true)}><ReplaceIcon aria-hidden="true" />{copy.detail.actions.replace}</button> : null}
      </div>
      {!versions.length ? <p className="ins-muted">{copy.detail.versions.noFile}</p> : (
        <ol className="dt-vers">
          {versions.map((v) => (
            <li key={v.versionNo} className="dt-ver-card" data-current={v.current} data-status={v.status}>
              <div className="ctr-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                <VersionBadge n={v.versionNo} />
                <Chip tone={v.current ? "success" : v.status === "REMOVED" ? "critical" : "neutral"}>{v.current ? copy.detail.versions.current : v.status === "REMOVED" ? copy.detail.versions.removed : copy.detail.versions.superseded}</Chip>
                {v.restoredFromVersionNo ? <span className="ins-muted">{fill(copy.detail.versions.restoredFrom, { n: v.restoredFromVersionNo })}</span> : null}
                {v.activeContent ? <Chip tone="pending">{copy.detail.versions.activeContentNote}</Chip> : null}
              </div>
              <span className="dt-file-name">{v.fileName}</span>
              <span className="ins-muted dt-tabnum">{formatSize(v.sizeBytes, locale)} · {fmtDateTime(v.createdAt, locale)} · {v.uploadedBy ?? "—"} · {v.contentHash.slice(0, 10)}</span>
              {v.changeNote ? <p style={{ margin: 0 }}><strong>{copy.detail.versions.changeNote}:</strong> {v.changeNote}</p> : null}
              <div className="ctr-row" style={{ flexWrap: "wrap" }}>
                {v.status !== "REMOVED" && doc.permissions.canDownload ? <button type="button" className="ctr-btn" onClick={() => void downloadDoc(doc.id, v.fileName, v.versionNo).catch((e) => toast.error(errorText(e, copy)))}><DownloadIcon aria-hidden="true" />{copy.detail.versions.download}</button> : null}
                {v.status !== "REMOVED" && !v.current && permissions.canRestore ? <button type="button" className="ctr-btn" onClick={() => setAct({ mode: "restore", n: v.versionNo })}>{copy.detail.versions.restore}</button> : null}
                {v.status !== "REMOVED" && !v.current && permissions.canRemove ? <button type="button" className="ctr-btn" onClick={() => setAct({ mode: "remove", n: v.versionNo })}>{copy.detail.versions.remove}</button> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {replace ? <ReplaceDialog open onOpenChange={(o) => { if (!o) setReplace(false); }} copy={copy} doc={doc} allowsImages={Boolean(categoryDef(doc.category)?.allowsImages)} /> : null}
      {act ? <VersionActionDialog open onOpenChange={(o) => { if (!o) setAct(null); }} copy={copy} mode={act.mode} docId={doc.id} n={act.n} /> : null}
    </section>
  );
}

function LinksTab({ doc, copy }: { doc: DocDetail; copy: Copy }) {
  const refresh = useRefreshDocs();
  const allowed = (categoryDef(doc.category)?.links ?? []) as string[];
  const [type, setType] = useState(allowed[0] ?? "");
  const [value, setValue] = useState("");
  const m = useMutation({
    mutationFn: (links: Record<string, string | null>) => patchDocument(doc.id, { version: doc.version, links }),
    onSuccess: async () => { toast.success(copy.detail.links.linksSaved); setValue(""); await refresh(); }, onError: (e) => toast.error(errorText(e, copy)),
  });
  const label = (t: string) => (copy.detail.links as Record<string, string>)[t.replace("Id", "")] ?? t;
  return (
    <section className="dt-panel" aria-label={copy.detail.links.title}>
      <h3>{copy.detail.links.title}</h3>
      {doc.project ? <p style={{ margin: 0 }}><strong>{copy.detail.links.project}:</strong> <Link className="ins-link" href={`/projects/${doc.project.id}`}>{`${doc.project.code ?? ""} ${doc.project.title}`.trim()}</Link></p> : null}
      {!doc.linkDetails.length ? <p className="ins-muted">{copy.detail.links.none}</p> : (
        <ul className="dt-files">
          {doc.linkDetails.map((l) => (
            <li key={`${l.type}${l.id}`} className="dt-file" style={{ gridTemplateColumns: "1fr auto" }}>
              <div><strong>{label(l.type)}</strong><br />{l.accessible && l.label ? <span>{l.label}</span> : <span className="ctr-restricted">{copy.detail.links.restricted}</span>}</div>
              {doc.permissions.canEdit ? <button type="button" className="ctr-btn" disabled={m.isPending} onClick={() => m.mutate({ [l.type]: null })}>{copy.detail.links.remove}</button> : null}
            </li>
          ))}
        </ul>
      )}
      {doc.permissions.canEdit && allowed.length ? (
        <form className="ctr-row" style={{ flexWrap: "wrap", alignItems: "end" }} onSubmit={(e) => { e.preventDefault(); if (type && /^[a-f0-9]{24}$/i.test(value.trim())) m.mutate({ [type]: value.trim() }); }}>
          <Field label={copy.detail.links.type}>{(id) => <select id={id} className="ctr-input" value={type} onChange={(e) => setType(e.target.value)}>{allowed.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>}</Field>
          <Field label={copy.detail.links.idLabel} hint={copy.wizard.link.linkNote}>{(id) => <input id={id} className="ctr-input" autoComplete="off" maxLength={24} pattern="[A-Fa-f0-9]{24}" value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending || !/^[a-f0-9]{24}$/i.test(value.trim())}>{copy.detail.links.add}</button>
        </form>
      ) : null}
    </section>
  );
}

function ActivityTab({ doc, copy, locale }: { doc: DocDetail; copy: Copy; locale: Parameters<typeof formatSize>[1] }) {
  const { key } = useDocKeys();
  const [filter, setFilter] = useState("");
  const q = useInfiniteQuery({
    queryKey: key("activity", doc.id), initialPageParam: "" as string, placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => fetchActivity(doc.id, { limit: 20, cursor: pageParam || undefined }), getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (q.isPending) return <Skeletons n={3} />;
  if (q.isError) return <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} />;
  const actions = copy.detail.activity.actions as Record<string, string>;
  const rows = q.data.pages.flatMap((p) => p.items).filter((r) => !filter || r.action === filter);
  return (
    <section className="dt-panel" aria-label={copy.detail.activity.title}>
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{copy.detail.activity.title}</h3>
        <Field label={copy.detail.activity.filter}>{(id) => <select id={id} className="ctr-input" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">{copy.detail.activity.allActions}</option>{Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
      </div>
      {!rows.length ? <p className="ins-muted">{copy.detail.activity.none}</p> : (
        <ul className="ctr-tl">
          {rows.map((r) => (
            <li key={r.id} className="ctr-tl-item">
              <strong>{actions[r.action] ?? r.action}</strong>
              <span className="ins-muted">{fmtDateTime(r.at, locale)} · {r.actor ?? "—"}{r.from || r.to ? ` · ${fill(copy.detail.activity.statusChange, { from: r.from ? (copy.status as Record<string, string>)[r.from] ?? r.from : "—", to: r.to ? (copy.status as Record<string, string>)[r.to] ?? r.to : "—" })}` : ""}</span>
              {r.reason ? <span>{r.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage ? <button type="button" className="ctr-btn" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{q.isFetchingNextPage ? copy.common.working : copy.detail.activity.loadMore}</button> : null}
    </section>
  );
}

function AccessTab({ doc, copy }: { doc: DocDetail; copy: Copy }) {
  return (
    <section className="dt-panel" aria-label={copy.detail.access.title}>
      <h3>{copy.detail.access.title}</h3>
      <p style={{ margin: 0 }}>{copy.detail.access.intro}</p>
      <dl className="ctr-facts">
        <dt>{copy.detail.access.visibility}</dt><dd>{copy.visibility[doc.visibility]}<br /><span className="ins-muted">{(copy.visibility as Record<string, string>)[`${doc.visibility}_HELP`]}</span></dd>
        <dt>{copy.detail.access.confidentiality}</dt><dd>{copy.confidentiality[doc.confidentiality]}{doc.confidentiality === "SENSITIVE" ? <><br /><span className="ins-muted">{copy.confidentiality.sensitiveHint}</span></> : null}</dd>
        <dt>{copy.detail.access.audience}</dt><dd><ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{doc.access.audience.map((r) => <li key={r}>{(copy.role as Record<string, string>)[r] ?? r}</li>)}</ul></dd>
      </dl>
      <p className="ctr-note">{copy.detail.access.note} {copy.detail.access.anonymous}</p>
    </section>
  );
}

export function DocumentDetail({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getDocCopy(locale);
  const { key, roleKey } = useDocKeys();
  const url = useUrlParams();
  const router = useRouter();
  const q = useQuery({ queryKey: key("detail", id), queryFn: ({ signal }) => fetchDocument(id, signal), retry: (n, e) => failureOf(e).status >= 500 && n < 1 });
  const tabParam = url.get("tab") as Tab;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam) ? tabParam : "overview";
  const [dlg, setDlg] = useState<"archive" | "delete" | "restrict" | "replace" | null>(null);
  const [more, setMore] = useState(false);
  const doc = q.data;
  const p = doc?.permissions;
  const title = doc?.title ?? copy.nav.title;
  const goTab = (t: Tab) => url.set({ tab: t === "overview" ? null : t });

  return (
    <StaffWorkspaceShell title={title} description={doc?.docNo ?? undefined} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title, href: "/documents" }, { label: doc?.docNo ?? title }]} scope={copy.dashboard.scope} asOf={null} />}>
      <div className="ins dt">
        {q.isPending ? <Skeletons n={4} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : doc && p ? (
          <>
            <header className="dt-hero">
              <div className="dt-title-cell"><FileTypeIcon mime={doc.mimeType} name={doc.fileName} /><div><h2>{doc.title}</h2><span className="ins-muted">{doc.docNo ?? "—"}</span></div></div>
              <div className="dt-hero-row">
                <CategoryChip category={doc.category} copy={copy} /><StatusChip status={doc.status} copy={copy} /><ConfidentialityChip value={doc.confidentiality} copy={copy} /><AiStatusChip ai={doc.ai} copy={copy} /><VersionBadge n={doc.currentVersionNo} />
                {doc.origin !== "DOCTRACE" ? <Chip tone="neutral">{copy.dashboard.evidenceBadge}</Chip> : null}
              </div>
              <div className="dt-hero-row ins-muted">
                {doc.project ? <Link className="ins-link" href={`/projects/${doc.project.id}`}>{doc.project.code ?? doc.project.title}</Link> : <span>{copy.dashboard.table.noProject}</span>}<span>·</span><span>{doc.agencyName ?? "—"}</span>
                {doc.linkDetails.filter((l) => l.accessible && l.label).map((l) => <span key={l.id}>· {l.label}</span>)}
              </div>
              {!doc.fileAvailable ? <div className="ctr-note" role="status"><strong>{copy.detail.noFile}</strong> {copy.detail.noFileBody}</div> : null}
              <div className="dt-actions">
                {doc.fileAvailable ? <button type="button" className="ctr-btn" onClick={() => goTab("preview")}>{copy.detail.actions.preview}</button> : null}
                {doc.fileAvailable && p.canDownload ? <button type="button" className="ctr-btn" onClick={() => void downloadDoc(doc.id, doc.fileName).catch((e) => toast.error(errorText(e, copy)))}><DownloadIcon aria-hidden="true" />{copy.detail.actions.download}</button> : null}
                {p.canReplace ? <button type="button" className="ctr-btn" onClick={() => setDlg("replace")}><ReplaceIcon aria-hidden="true" />{copy.detail.actions.replace}</button> : null}
                {p.canEdit ? <button type="button" className="ctr-btn" onClick={() => { goTab("overview"); url.set({ edit: "1", tab: null }); }}><PencilIcon aria-hidden="true" />{copy.detail.actions.edit}</button> : null}
                {p.canArchive ? <button type="button" className="ctr-btn" onClick={() => setDlg("archive")}>{copy.detail.actions.archive}</button> : null}
                {p.canRestore ? <RestoreAction doc={doc} copy={copy} /> : null}
                <div className="ins-menu">
                  <button type="button" className="ctr-btn" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(!more)}>{copy.detail.actions.more}</button>
                  {more ? (
                    <div className="ins-menu-list" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMore(false); void copyDocLink(doc.id, copy); }}>{copy.common.copyLink}</button>
                      {p.canRestrict ? <button type="button" role="menuitem" onClick={() => { setMore(false); setDlg("restrict"); }}><ShieldAlertIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} /> {copy.detail.actions.restrict}</button> : null}
                      {p.canDelete ? <button type="button" role="menuitem" onClick={() => { setMore(false); setDlg("delete"); }}>{copy.detail.actions.delete}</button> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div role="tablist" aria-label={copy.nav.title} className="ctr-tabs">
              {TABS.map((t) => <button key={t} id={`dt-tab-${t}`} type="button" role="tab" aria-selected={tab === t} aria-controls={`dt-panel-${t}`} className="ctr-tab" onClick={() => goTab(t)}>{t === "ai" ? getAiCopy(locale).panel.title : copy.detail.tabs[t]}</button>)}
            </div>
            <div role="tabpanel" id={`dt-panel-${tab}`} aria-labelledby={`dt-tab-${tab}`}>
              {tab === "overview" ? <OverviewTab key={`${doc.id}:${doc.version}`} doc={doc} copy={copy} locale={locale} startEditing={url.get("edit") === "1"} /> : null}
              {tab === "preview" ? <PreviewPane doc={doc} copy={copy} mime={doc.mimeType} activeContent={doc.currentVersion?.activeContent} {...(Number(url.get("page")) > 0 ? { page: Number(url.get("page")) } : {})} /> : null}
              {tab === "ai" && doc.origin === "DOCTRACE" ? <AiProcessingPanel doc={doc} locale={locale} {...(p.canRestrict ? { onRestrict: () => setDlg("restrict") } : {})} onOpenPage={(n) => url.set({ tab: "preview", page: String(n) })} /> : null}
              {tab === "ai" && doc.origin !== "DOCTRACE" ? <EmptyState title={getAiCopy(locale).reason.NOT_DOCTRACE} body={getAiCopy(locale).reasonHelp.NOT_DOCTRACE} /> : null}
              {tab === "versions" ? <VersionsTab doc={doc} copy={copy} locale={locale} /> : null}
              {tab === "links" ? <LinksTab doc={doc} copy={copy} /> : null}
              {tab === "activity" ? <ActivityTab doc={doc} copy={copy} locale={locale} /> : null}
              {tab === "access" ? <AccessTab doc={doc} copy={copy} /> : null}
            </div>

            {p.canArchive || p.canRestore || p.canDelete || p.canRestrict ? (
              <section className="dt-panel dt-danger" aria-label={copy.detail.danger.title}>
                <h3>{copy.detail.danger.title}</h3>
                <div className="ctr-row" style={{ flexWrap: "wrap" }}>
                  {p.canArchive ? <div><strong>{copy.detail.danger.archiveTitle}</strong><p className="ins-muted" style={{ margin: "0.2rem 0" }}>{copy.detail.danger.archiveBody}</p><button type="button" className="ctr-btn" onClick={() => setDlg("archive")}>{copy.detail.actions.archive}</button></div> : null}
                  {p.canRestore ? <div><strong>{copy.detail.danger.restoreTitle}</strong><p className="ins-muted" style={{ margin: "0.2rem 0" }}>{copy.detail.danger.restoreBody}</p><RestoreAction doc={doc} copy={copy} /></div> : null}
                  {p.canRestrict ? <div><strong>{copy.detail.danger.restrictTitle}</strong><p className="ins-muted" style={{ margin: "0.2rem 0" }}>{copy.detail.danger.restrictBody}</p><button type="button" className="ctr-btn" onClick={() => setDlg("restrict")}>{copy.detail.actions.restrict}</button></div> : null}
                  {p.canDelete || doc.status === "ARCHIVED" ? <div><strong>{copy.detail.danger.deleteTitle}</strong><p className="ins-muted" style={{ margin: "0.2rem 0" }}>{doc.status === "ARCHIVED" ? copy.detail.danger.deleteBody : copy.detail.danger.deleteOnlyArchived}</p>{p.canDelete ? <button type="button" className="ctr-btn" onClick={() => setDlg("delete")}>{copy.detail.actions.delete}</button> : null}</div> : null}
                </div>
              </section>
            ) : null}

            <div className="dt-sticky" role="group" aria-label={copy.detail.actions.more}>
              {doc.fileAvailable && p.canDownload ? <button type="button" className="ctr-btn" onClick={() => void downloadDoc(doc.id, doc.fileName).catch((e) => toast.error(errorText(e, copy)))}>{copy.detail.actions.download}</button> : null}
              {p.canReplace ? <button type="button" className="ctr-btn" onClick={() => setDlg("replace")}>{copy.detail.actions.replace}</button> : null}
              {p.canEdit ? <button type="button" className="ctr-btn" onClick={() => url.set({ edit: "1", tab: null })}>{copy.detail.actions.edit}</button> : null}
            </div>

            {dlg === "archive" ? <ArchiveDialog open onOpenChange={(o) => { if (!o) setDlg(null); }} copy={copy} doc={doc} /> : null}
            {dlg === "delete" ? <DeleteDialog open onOpenChange={(o) => { if (!o) setDlg(null); }} copy={copy} doc={doc} onDone={() => router.push("/documents")} /> : null}
            {dlg === "restrict" ? <RestrictDialog open onOpenChange={(o) => { if (!o) setDlg(null); }} copy={copy} doc={doc} isGovAdmin={roleKey === "GOV_ADMIN"} /> : null}
            {dlg === "replace" ? <ReplaceDialog open onOpenChange={(o) => { if (!o) setDlg(null); }} copy={copy} doc={doc} allowsImages={Boolean(categoryDef(doc.category)?.allowsImages)} /> : null}
          </>
        ) : <EmptyState title={copy.common.notFound} />}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>
    </StaffWorkspaceShell>
  );
}
