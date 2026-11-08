"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, FilterIcon, LayoutGridIcon, MoreHorizontalIcon, PlusIcon, RefreshCwIcon, TableIcon, UploadCloudIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_GROUPS, DOCUMENT_FILE_TYPES } from "@infraos/shared-types";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import type { AuthLocale } from "@/lib/auth/types";
import { bulkReprocess } from "@/lib/documents/ai/api";
import { getAiCopy, type AiCopy } from "@/lib/documents/ai/messages";
import { bulkAction, downloadRegisterCsv, fetchDocuments, fetchSummary } from "@/lib/documents/api";
import { getDocCopy, type Copy } from "@/lib/documents/messages";
import { hintArchivedView, hintExport, hintUpload, useDocKeys } from "@/lib/documents/session";
import type { DocItem } from "@/lib/documents/types";
import { activeFilterCount, AI_STATUSES, DEFAULT_FILTERS, filterParams, fill, fmtDate, fmtMonth, fmtNumber, formatSize, loadViews, MAX_VIEWS, parseFilters, saveViews, SORTS, toApiQuery, type DocFilters, type SavedView } from "@/lib/documents/view";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { Highlighted, AiStatusChip, CategoryChip, ConfidentialityChip, EmptyState, ErrorState, errorText, Field, FileTypeIcon, Shell, Skeletons, StatusChip, VersionBadge } from "./doc-ui";
import { ArchiveDialog, copyDocLink, DeleteDialog, DocumentPreviewDrawer, downloadDoc, ReplaceDialog, RestoreAction, useRefreshDocs } from "./document-parts";
import { ProjectPicker } from "./project-picker";

type Common = { copy: Copy; locale: AuthLocale };
const aiStatusLabel = (s: string, a: AiCopy): string => ({ NOT_STARTED: a.chip.notProcessed, QUEUED: a.chip.queued, PROCESSING: a.jobStatus.RUNNING, COMPLETED: a.chip.ready, FAILED: a.chip.failed, UNSUPPORTED: a.chip.unsupported } as Record<string, string>)[s] ?? s;
const PAGE_SIZES = [10, 25, 50];

function Kpi({ label, value, hint, active, onClick }: { label: string; value: number | undefined; hint: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ctr-card" aria-pressed={active} onClick={onClick} aria-label={`${label}: ${value ?? "—"}. ${hint}`}>
      <span className="ctr-card-label">{label}</span><span className="ctr-card-value dt-tabnum">{value ?? "—"}</span><span className="ctr-card-hint">{hint}</span>
    </button>
  );
}

function BarList({ rows, max }: { rows: { label: string; n: number; text?: string }[]; max: number }) {
  return <div className="dt-bars">{rows.map((r) => <div key={r.label} className="dt-bar-row"><span title={r.label}>{r.label}</span><span className="dt-bar-track" aria-hidden="true"><i style={{ width: `${(r.n / Math.max(1, max)) * 100}%` }} /></span><b className="dt-tabnum">{r.text ?? r.n}</b></div>)}</div>;
}

function RowMenu({ doc, copy, onPreview, onReplace, onArchive, onDelete }: { doc: DocItem; copy: Copy; onPreview: () => void; onReplace: () => void; onArchive: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const p = doc.permissions;
  const item = (label: string, fn: () => void) => <button type="button" role="menuitem" onClick={() => { setOpen(false); fn(); }}>{label}</button>;
  const evidence = doc.origin !== "DOCTRACE";
  return (
    <div className="ins-menu" ref={ref}>
      <button type="button" className="ctr-btn is-ghost" aria-haspopup="menu" aria-expanded={open} aria-label={`${copy.dashboard.table.rowMenu}: ${doc.title}`} onClick={() => setOpen(!open)}><MoreHorizontalIcon aria-hidden="true" /></button>
      {open ? (
        <div className="ins-menu-list" role="menu">
          <Link role="menuitem" className="ctr-btn is-ghost" href={`/documents/${doc.id}`} style={{ justifyContent: "flex-start" }}>{copy.dashboard.menu.open}</Link>
          {!evidence && doc.fileAvailable ? item(copy.dashboard.menu.preview, onPreview) : null}
          {!evidence && doc.fileAvailable && p.canDownload ? item(copy.dashboard.menu.download, () => void downloadDoc(doc.id, doc.fileName).catch((e) => toast.error(errorText(e, copy)))) : null}
          {p.canReplace ? item(copy.dashboard.menu.replace, onReplace) : null}
          {p.canEdit ? <Link role="menuitem" className="ctr-btn is-ghost" href={`/documents/${doc.id}?edit=1`} style={{ justifyContent: "flex-start" }}>{copy.dashboard.menu.edit}</Link> : null}
          {p.canArchive ? item(copy.dashboard.menu.archive, onArchive) : null}
          {p.canRestore ? <div role="none"><RestoreAction doc={doc} copy={copy} className="ctr-btn is-ghost" /></div> : null}
          {p.canDelete ? item(copy.dashboard.menu.delete, onDelete) : null}
          {item(copy.dashboard.menu.copyLink, () => void copyDocLink(doc.id, copy))}
        </div>
      ) : null}
    </div>
  );
}

type RowHandlers = { onPreview: (d: DocItem) => void; onReplace: (d: DocItem) => void; onArchive: (d: DocItem) => void; onDelete: (d: DocItem) => void; selected: Set<string>; toggle: (id: string) => void };

function DocTable({ rows, copy, locale, h, allSelected, toggleAll }: Common & { rows: DocItem[]; h: RowHandlers; allSelected: boolean; toggleAll: () => void }) {
  return (
    <div className="ins-only-wide" style={{ overflowX: "auto" }}>
      <table className="ins-table">
        <thead><tr>
          <th scope="col"><input type="checkbox" aria-label={copy.dashboard.table.selectAll} checked={allSelected} onChange={toggleAll} /></th>
          {[copy.dashboard.table.title, copy.dashboard.table.category, copy.dashboard.table.project, copy.dashboard.table.agency, copy.dashboard.table.version, copy.dashboard.table.size, copy.dashboard.table.uploaded, copy.dashboard.table.status, copy.dashboard.table.ai].map((x) => <th key={x} scope="col">{x}</th>)}
          <th scope="col"><span className="sr-only">{copy.dashboard.table.rowMenu}</span></th>
        </tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} aria-selected={h.selected.has(d.id)}>
              <td><input type="checkbox" aria-label={fill(copy.dashboard.table.select, { title: d.title })} checked={h.selected.has(d.id)} onChange={() => h.toggle(d.id)} /></td>
              <td>
                <div className="dt-title-cell"><FileTypeIcon mime={d.mimeType} name={d.fileName} />
                  <div><Link className="ins-link" href={`/documents/${d.id}`}><Highlighted segments={d.highlights?.title} fallback={d.title} /></Link><br /><span className="ins-muted">{d.docNo ?? "—"}{d.reference ? ` · ${d.reference}` : ""}</span>
                    {!d.fileAvailable ? <><br /><span className="ins-muted">{copy.dashboard.fileNotAvailable}</span></> : null}</div></div>
              </td>
              <td><CategoryChip category={d.category} copy={copy} />{d.origin !== "DOCTRACE" ? <> <span className="ins-prio" data-p="LOW">{copy.dashboard.evidenceBadge}</span></> : null}</td>
              <td>{d.project ? <Link className="ins-link" href={`/projects/${d.project.id}`}>{d.project.code ?? d.project.title}</Link> : <span className="ins-muted">{copy.dashboard.table.noProject}</span>}</td>
              <td>{d.agencyName ?? "—"}</td>
              <td><VersionBadge n={d.currentVersionNo} /></td>
              <td className="dt-tabnum">{formatSize(d.sizeBytes, locale)}</td>
              <td className="dt-tabnum">{fmtDate(d.createdAt, locale)}<br /><span className="ins-muted">{d.ownerName ?? ""}</span></td>
              <td><span className="ctr-row" style={{ flexWrap: "wrap", gap: "0.25rem" }}><StatusChip status={d.status} copy={copy} /><ConfidentialityChip value={d.confidentiality} copy={copy} /></span></td>
              <td><AiStatusChip ai={d.ai} docId={d.id} /></td>
              <td><RowMenu doc={d} copy={copy} onPreview={() => h.onPreview(d)} onReplace={() => h.onReplace(d)} onArchive={() => h.onArchive(d)} onDelete={() => h.onDelete(d)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cards serve both the Grid layout and the phone layout (the table is hidden below 56rem). */
function DocCards({ rows, copy, locale, h, className }: Common & { rows: DocItem[]; h: RowHandlers; className: string }) {
  return (
    <div className={className}>
      {rows.map((d) => (
        <article key={d.id} className="dt-card">
          <input className="dt-sel" type="checkbox" aria-label={fill(copy.dashboard.table.select, { title: d.title })} checked={h.selected.has(d.id)} onChange={() => h.toggle(d.id)} />
          <FileTypeIcon mime={d.mimeType} name={d.fileName} large />
          <div style={{ minWidth: 0 }}><Link className="ins-link" href={`/documents/${d.id}`}><Highlighted segments={d.highlights?.title} fallback={d.title} /></Link><br /><span className="ins-muted">{d.docNo ?? "—"} · <VersionBadge n={d.currentVersionNo} /> · {formatSize(d.sizeBytes, locale)}</span></div>
          <div className="ctr-row" style={{ flexWrap: "wrap", gap: "0.3rem" }}><CategoryChip category={d.category} copy={copy} /><StatusChip status={d.status} copy={copy} /><ConfidentialityChip value={d.confidentiality} copy={copy} /><AiStatusChip ai={d.ai} docId={d.id} /></div>
          <div className="ctr-row" style={{ justifyContent: "space-between" }}>
            <span className="ins-muted">{d.project?.code ?? copy.dashboard.table.noProject} · {fmtDate(d.createdAt, locale)}</span>
            <RowMenu doc={d} copy={copy} onPreview={() => h.onPreview(d)} onReplace={() => h.onReplace(d)} onArchive={() => h.onArchive(d)} onDelete={() => h.onDelete(d)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function BulkDialogs({ copy, ids, mode, onClose, onDone }: { copy: Copy; ids: string[]; mode: "ARCHIVE" | "ADD_TAG" | "CHANGE_CATEGORY" | null; onClose: () => void; onDone: () => void }) {
  const refresh = useRefreshDocs();
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const m = useMutation({
    mutationFn: () => bulkAction({ ids, action: mode, ...(mode === "ARCHIVE" ? { reason: reason.trim() } : mode === "ADD_TAG" ? { tag: tag.trim() } : { category }) }),
    onSuccess: async (r) => { toast[r.failed ? "warning" : "success"](fill(copy.dashboard.bulk.result, { ok: r.succeeded, failed: r.failed })); await refresh(); setReason(""); setTag(""); setCategory(""); onDone(); onClose(); },
    onError: (e) => toast.error(errorText(e, copy)),
  });
  const ok = mode === "ARCHIVE" ? reason.trim().length >= 12 : mode === "ADD_TAG" ? tag.trim().length > 0 : Boolean(category);
  return (
    <Shell open={mode !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={mode === "ARCHIVE" ? copy.dashboard.bulk.archiveTitle : mode === "ADD_TAG" ? copy.dashboard.bulk.addTag : copy.dashboard.bulk.categoryTitle} description={fill(copy.dashboard.bulk.selected, { n: ids.length })}>
      <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        {mode === "ARCHIVE" ? <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}</Field> : null}
        {mode === "ADD_TAG" ? <Field label={copy.dashboard.bulk.tagLabel}>{(id) => <input id={id} className="ctr-input" value={tag} maxLength={40} onChange={(e) => setTag(e.target.value)} />}</Field> : null}
        {mode === "CHANGE_CATEGORY" ? <Field label={copy.dashboard.filters.category}>{(id) => <select id={id} className="ctr-input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{copy.common.choose}</option>{DOCUMENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{(copy.category as Record<string, string>)[c.key]}</option>)}</select>}</Field> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button><button type="submit" className="ctr-btn is-primary" disabled={!ok || m.isPending}>{m.isPending ? copy.common.working : copy.dashboard.bulk.apply}</button></div>
      </form>
    </Shell>
  );
}

export function DocTraceDashboard() {
  const [locale] = useWorkspaceLocale();
  const copy = getDocCopy(locale);
  const aiCopy = getAiCopy(locale);
  const { key, roleKey, userId } = useDocKeys();
  const url = useUrlParams();
  const filters = useMemo(() => parseFilters((k) => url.get(k) || null), [url]);
  const [layout, setLayout] = useState<"table" | "grid">("table");
  const [searchText, setSearchText] = useState(filters.q);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [replace, setReplace] = useState<DocItem | null>(null);
  const [archive, setArchive] = useState<DocItem | null>(null);
  const [del, setDel] = useState<DocItem | null>(null);
  const [bulk, setBulk] = useState<"ARCHIVE" | "ADD_TAG" | "CHANGE_CATEGORY" | null>(null);
  const [selection, setSelection] = useState<{ scope: string; ids: Set<string> }>({ scope: "", ids: new Set() });
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [viewsOpen, setViewsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [projectLabel, setProjectLabel] = useState("");

  const set = useCallback((patch: Partial<DocFilters>) => url.set(filterParams({ ...filters, ...patch, page: "page" in patch ? patch.page ?? 1 : 1 })), [url, filters]);
  const apiQuery = useMemo(() => toApiQuery(filters), [filters]);
  const queryString = url.toString();
  const scope = queryString;

  const summary = useQuery({ queryKey: key("summary"), queryFn: ({ signal }) => fetchSummary(signal), staleTime: 30_000 });
  const list = useQuery({ queryKey: key("list", JSON.stringify(apiQuery)), queryFn: ({ signal }) => fetchDocuments(apiQuery, signal), placeholderData: keepPreviousData });
  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const pages = list.data?.meta.pages ?? 1;
  const selected = selection.scope === scope ? selection.ids : new Set<string>();
  const refresh = () => { void summary.refetch(); void list.refetch(); };
  const reprocessSel = useMutation({
    mutationFn: (ids: string[]) => bulkReprocess({ ids }),
    onSuccess: async (r) => { toast[r.queued ? "success" : "warning"](fill(aiCopy.bulk.result, { n: r.queued, m: r.results.length - r.queued })); clearSelection(); await refresh(); },
    onError: (e) => toast.error(errorText(e, copy)),
  });
  const exportCsv = useMutation({ mutationFn: () => downloadRegisterCsv(apiQuery as never), onSuccess: () => toast.success(copy.dashboard.exported), onError: (e) => toast.error(errorText(e, copy)) });

  // Keyboard: "/" focuses search, Escape clears it. Search text is debounced into the URL.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && t && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { const t = setTimeout(() => { if (searchText.trim() !== filters.q) set({ q: searchText.trim() }); }, 350); return () => clearTimeout(t); }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { queueMicrotask(() => setViews(loadViews(userId))); }, [userId]);

  const toggle = (id: string) => setSelection((s) => { const ids = new Set(s.scope === scope ? s.ids : []); if (ids.has(id)) ids.delete(id); else ids.add(id); return { scope, ids }; });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelection({ scope, ids: allSelected ? new Set() : new Set(rows.map((r) => r.id)) });
  const clearSelection = () => setSelection({ scope, ids: new Set() });
  const handlers: RowHandlers = { onPreview: (d) => setDrawer(d.id), onReplace: setReplace, onArchive: setArchive, onDelete: setDel, selected, toggle };

  const drawerIndex = drawer ? rows.findIndex((r) => r.id === drawer) : -1;
  const drawerDoc = drawerIndex >= 0 ? rows[drawerIndex] : null;
  const closeDrawer = useCallback(() => setDrawer(null), [setDrawer]);
  const catFacet = new Map((list.data?.facets.category ?? []).map((f) => [f.key, f.count]));
  const applied = activeFilterCount(filters);
  const canUpload = hintUpload(roleKey);
  const label = (k: string, d: Record<string, string>) => d[k] ?? k;

  const chips: { id: string; text: string; clear: () => void }[] = [];
  if (filters.q) chips.push({ id: "q", text: `“${filters.q}”`, clear: () => { setSearchText(""); set({ q: "" }); } });
  for (const c of filters.category) chips.push({ id: `c${c}`, text: label(c, copy.category), clear: () => set({ category: filters.category.filter((x) => x !== c) }) });
  if (filters.group) chips.push({ id: "g", text: label(filters.group, copy.group), clear: () => set({ group: "" }) });
  if (filters.projectId) chips.push({ id: "p", text: projectLabel || copy.dashboard.filters.project, clear: () => { setProjectLabel(""); set({ projectId: "" }); } });
  for (const f of filters.fileType) chips.push({ id: `f${f}`, text: label(f, copy.fileType), clear: () => set({ fileType: filters.fileType.filter((x) => x !== f) }) });
  if (filters.aiStatus) chips.push({ id: "ai", text: `${aiCopy.filter.aiStatus}: ${aiStatusLabel(filters.aiStatus, aiCopy)}`, clear: () => set({ aiStatus: "" }) });
  for (const s of filters.status) chips.push({ id: `s${s}`, text: label(s, copy.status), clear: () => set({ status: filters.status.filter((x) => x !== s) }) });
  if (filters.tag) chips.push({ id: "t", text: `#${filters.tag}`, clear: () => set({ tag: "" }) });
  if (filters.from) chips.push({ id: "from", text: `${copy.dashboard.filters.dateFrom}: ${filters.from}`, clear: () => set({ from: "" }) });
  if (filters.to) chips.push({ id: "to", text: `${copy.dashboard.filters.dateTo}: ${filters.to}`, clear: () => set({ to: "" }) });
  for (const [on, id, text] of [[filters.mine, "mine", copy.dashboard.filters.mine], [filters.sensitive, "sensitive", copy.dashboard.filters.sensitive], [filters.archived, "archived", copy.dashboard.filters.archived], [filters.evidence, "evidence", copy.dashboard.filters.evidence], [filters.drafts, "drafts", copy.dashboard.kpi.drafts], [filters.expiring, "expiring", copy.dashboard.kpi.expiring], [filters.awaiting, "awaiting", copy.dashboard.kpi.awaiting], [filters.thisMonth, "thisMonth", copy.dashboard.kpi.added]] as [boolean, keyof DocFilters, string][]) {
    if (on) chips.push({ id, text, clear: () => set({ [id]: false } as Partial<DocFilters>) });
  }

  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    if (views.length >= MAX_VIEWS && !views.some((v) => v.name === name)) { toast.error(copy.dashboard.filters.viewsFull); return; }
    const next = [...views.filter((v) => v.name !== name), { name, query: queryString }];
    if (saveViews(userId, next)) { setViews(next); setViewName(""); toast.success(copy.dashboard.filters.viewSaved); } else toast.error(copy.errors.generic);
  };
  const delView = (name: string) => { const next = views.filter((v) => v.name !== name); saveViews(userId, next); setViews(next); };

  const rail = DOCUMENT_CATEGORY_GROUPS.map((g) => ({ g, cats: DOCUMENT_CATEGORIES.filter((c) => c.group === g) }));
  const sum = summary.data;
  const maxCat = Math.max(1, ...(sum?.byCategory ?? []).map((c) => c.count));
  const maxMonth = Math.max(1, ...(sum?.uploadsPerMonth ?? []).map((m) => m.count));
  const maxBytes = Math.max(1, ...(sum?.storageByCategory ?? []).map((c) => c.bytes));

  return (
    <StaffWorkspaceShell title={copy.dashboard.title} description={copy.dashboard.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title }]} scope={copy.dashboard.scope} asOf={null} actions={<div className="ctr-row">
        <button type="button" className="ctr-btn" onClick={refresh}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>
        {hintExport(roleKey) ? <button type="button" className="ctr-btn" disabled={exportCsv.isPending || !total} onClick={() => exportCsv.mutate()}><DownloadIcon aria-hidden="true" />{copy.dashboard.exportCsv}</button> : null}
        <div className="ctr-seg" role="group" aria-label={copy.dashboard.views}>
          <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}><TableIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} /> {copy.dashboard.viewTable}</button>
          <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGridIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} /> {copy.dashboard.viewGrid}</button>
        </div>
        {canUpload ? <Link className="ctr-btn" href="/documents/processing">{aiCopy.nav.processing}</Link> : null}
        {canUpload ? <Link className="ctr-btn is-primary" href="/documents/upload"><PlusIcon aria-hidden="true" />{copy.dashboard.upload}</Link> : null}
      </div>} />}>
      <div className="ins dt">
        {/* Insight strip: real numbers only; every tile filters the library. */}
        <div className="dt-strip" role="group" aria-label={copy.dashboard.title} aria-live="polite">
          <Kpi label={copy.dashboard.kpi.total} value={sum?.totalActive} hint={copy.dashboard.kpi.hint} onClick={() => url.set({ ...filterParams(DEFAULT_FILTERS) })} />
          <Kpi label={copy.dashboard.kpi.added} value={sum?.addedThisMonth} hint={copy.dashboard.kpi.hint} active={filters.thisMonth} onClick={() => set({ thisMonth: !filters.thisMonth })} />
          <Kpi label={copy.dashboard.kpi.drafts} value={sum?.drafts} hint={copy.dashboard.kpi.hint} active={filters.drafts} onClick={() => set({ drafts: !filters.drafts })} />
          <Kpi label={copy.dashboard.kpi.expiring} value={sum?.expiringIn30Days} hint={copy.dashboard.kpi.hint} active={filters.expiring} onClick={() => set({ expiring: !filters.expiring })} />
          <Kpi label={copy.dashboard.kpi.sensitive} value={sum?.sensitive} hint={copy.dashboard.kpi.hint} active={filters.sensitive} onClick={() => set({ sensitive: !filters.sensitive })} />
          <Kpi label={copy.dashboard.kpi.awaiting} value={sum?.awaitingFiles} hint={copy.dashboard.kpi.awaitingHint} active={filters.awaiting} onClick={() => set({ awaiting: !filters.awaiting })} />
        </div>
        {summary.isError ? <ErrorState error={summary.error} copy={copy} onRetry={() => void summary.refetch()} /> : null}

        <div className="dt-charts">
          <section className="dt-panel" aria-label={copy.dashboard.charts.byCategory}><h3>{copy.dashboard.charts.byCategory}</h3>
            {sum?.byCategory.length ? <BarList max={maxCat} rows={sum.byCategory.slice(0, 7).map((c) => ({ label: label(c.key, copy.category), n: c.count }))} /> : <p className="ins-muted">{copy.dashboard.charts.empty}</p>}</section>
          <section className="dt-panel" aria-label={copy.dashboard.charts.uploads}><h3>{copy.dashboard.charts.uploads}</h3>
            <div className="dt-spark" role="img" aria-label={(sum?.uploadsPerMonth ?? []).map((m) => `${fmtMonth(m.month, locale)}: ${m.count}`).join(", ")}>
              {(sum?.uploadsPerMonth ?? []).map((m) => <div key={m.month}><span className="dt-tabnum">{m.count}</span><i style={{ height: `${(m.count / maxMonth) * 70}%` }} /><span>{fmtMonth(m.month, locale)}</span></div>)}
            </div></section>
          <section className="dt-panel" aria-label={copy.dashboard.charts.storage}><h3>{copy.dashboard.charts.storage}</h3>
            {sum?.storageByCategory.length ? <BarList max={maxBytes} rows={sum.storageByCategory.slice(0, 6).map((c) => ({ label: label(c.key, copy.category), n: c.bytes, text: formatSize(c.bytes, locale) }))} /> : <p className="ins-muted">{copy.dashboard.charts.empty}</p>}
            <p className="ins-muted" style={{ margin: 0, fontSize: "0.75rem" }}>{copy.dashboard.charts.storageNote}</p></section>
        </div>

        {/* Category rail by group, with facet counts under the current filters. */}
        <nav className="dt-rail" aria-label={copy.dashboard.filters.category}>
          <button type="button" className="dt-pill" aria-pressed={!filters.category.length && !filters.group} onClick={() => set({ category: [], group: "" })}>{copy.common.all}</button>
          {rail.map(({ g, cats: gc }) => (
            <span key={g} className="dt-rail-group" role="group" aria-label={label(g, copy.group)}><b>{label(g, copy.group)}</b>
              {gc.map((c) => { const n = catFacet.get(c.key) ?? 0; const on = filters.category.includes(c.key); return <button key={c.key} type="button" className="dt-pill" aria-pressed={on} onClick={() => set({ category: on ? filters.category.filter((x) => x !== c.key) : [...filters.category, c.key] })}>{label(c.key, copy.category)} <small className="dt-tabnum">{fmtNumber(n, locale)}</small></button>; })}
            </span>
          ))}
        </nav>

        <div className="dt-filters" data-collapsed={!moreOpen}>
          <Field label={copy.dashboard.filters.search} hint={copy.dashboard.filters.searchHint} wide>{(id) => <input id={id} ref={searchRef} type="search" className="ctr-input" value={searchText} maxLength={200} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearchText(""); set({ q: "" }); } }} />}</Field>
          <Field label={copy.dashboard.filters.sort}>{(id) => <select id={id} className="ctr-input" value={filters.sort} onChange={(e) => set({ sort: e.target.value as DocFilters["sort"] })}>{SORTS.map((s) => <option key={s} value={s}>{(copy.dashboard.sort as Record<string, string>)[s]}</option>)}</select>}</Field>
          <button type="button" className="ctr-btn dt-sheet-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}><FilterIcon aria-hidden="true" />{moreOpen ? copy.dashboard.filters.lessFilters : copy.dashboard.filters.moreFilters}</button>
          <div className="dt-more ctr-row" style={{ flexWrap: "wrap", gap: "0.6rem", alignItems: "end", flex: "1 1 100%" }}>
            <Field label={copy.dashboard.filters.project}>{(id) => <ProjectPicker id={id} copy={copy} value={filters.projectId} label={projectLabel} onChange={(pid, l) => { setProjectLabel(l); set({ projectId: pid }); }} />}</Field>
            <Field label={copy.dashboard.filters.fileType}>{(id) => <select id={id} className="ctr-input" value={filters.fileType[0] ?? ""} onChange={(e) => set({ fileType: e.target.value ? [e.target.value] : [] })}><option value="">{copy.common.all}</option>{DOCUMENT_FILE_TYPES.map((f) => <option key={f} value={f}>{(copy.fileType as Record<string, string>)[f]}</option>)}</select>}</Field>
            <Field label={aiCopy.filter.aiStatus}>{(id) => <select id={id} className="ctr-input" value={filters.aiStatus} onChange={(e) => set({ aiStatus: e.target.value })}><option value="">{aiCopy.filter.any}</option>{AI_STATUSES.map((s) => <option key={s} value={s}>{aiStatusLabel(s, aiCopy)}</option>)}</select>}</Field>
            <Field label={copy.dashboard.filters.status}>{(id) => <select id={id} className="ctr-input" value={filters.status[0] ?? ""} onChange={(e) => set({ status: e.target.value ? [e.target.value] : [], archived: false, drafts: false })}><option value="">{copy.status.ACTIVE}</option>{(["DRAFT", "SUPERSEDED", ...(hintArchivedView(roleKey) ? ["ARCHIVED"] : [])] as const).map((s) => <option key={s} value={s}>{copy.status[s as "DRAFT"]}</option>)}</select>}</Field>
            <Field label={copy.dashboard.filters.dateFrom}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.from} onChange={(e) => set({ from: e.target.value })} />}</Field>
            <Field label={copy.dashboard.filters.dateTo}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.to} onChange={(e) => set({ to: e.target.value })} />}</Field>
            <Field label={copy.dashboard.filters.tags}>{(id) => <input id={id} className="ctr-input" value={filters.tag} maxLength={40} onChange={(e) => set({ tag: e.target.value.toLowerCase() })} />}</Field>
          </div>
          <div className="dt-more ctr-row" style={{ flexWrap: "wrap", gap: "0.4rem" }} role="group" aria-label={copy.dashboard.filters.applied}>
            {([["mine", copy.dashboard.filters.mine], ["sensitive", copy.dashboard.filters.sensitive], ...(hintArchivedView(roleKey) ? [["archived", copy.dashboard.filters.archived]] : []), ["evidence", copy.dashboard.filters.evidence]] as [keyof DocFilters, string][]).map(([k, text]) => (
              <button key={k} type="button" className="dt-pill" aria-pressed={Boolean(filters[k])} onClick={() => set({ [k]: !filters[k], ...(k === "archived" ? { status: [] } : {}) } as Partial<DocFilters>)}>{text}</button>
            ))}
            <div className="ins-menu" style={{ marginLeft: "auto" }}>
              <button type="button" className="ctr-btn" aria-haspopup="true" aria-expanded={viewsOpen} onClick={() => setViewsOpen(!viewsOpen)}>{copy.dashboard.filters.savedViews} ({views.length})</button>
              {viewsOpen ? (
                <div className="ins-menu-list" style={{ minWidth: "16rem", padding: "0.6rem", gap: "0.4rem" }}>
                  {views.length ? views.map((v) => <div key={v.name} className="ctr-row" style={{ justifyContent: "space-between" }}><button type="button" onClick={() => { setViewsOpen(false); url.set(Object.fromEntries([...Object.keys(filterParams(DEFAULT_FILTERS)).map((k) => [k, null] as const), ...new URLSearchParams(v.query)])); }}>{v.name}</button><button type="button" aria-label={`${copy.dashboard.filters.deleteView}: ${v.name}`} onClick={() => delView(v.name)}><XIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} /></button></div>) : <p className="ins-muted" style={{ margin: 0 }}>{copy.dashboard.filters.noViews}</p>}
                  <div className="ctr-row"><input className="ctr-input" aria-label={copy.dashboard.filters.viewName} placeholder={copy.dashboard.filters.viewName} value={viewName} maxLength={40} onChange={(e) => setViewName(e.target.value)} /><button type="button" className="ctr-btn" disabled={!viewName.trim()} onClick={saveView}>{copy.dashboard.filters.saveView}</button></div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {filters.evidence ? <p className="ctr-note">{copy.dashboard.filters.evidenceNote}</p> : null}
        {chips.length ? (
          <div className="dt-chips" role="list" aria-label={copy.dashboard.filters.applied}>
            {chips.map((c) => <span key={c.id} role="listitem" className="dt-chip-x">{c.text}<button type="button" aria-label={`${copy.common.clear}: ${c.text}`} onClick={c.clear}><XIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} /></button></span>)}
            <button type="button" className="ctr-btn is-ghost" onClick={() => { setSearchText(""); setProjectLabel(""); url.set(Object.fromEntries(Object.keys(filterParams(DEFAULT_FILTERS)).map((k) => [k, null]))); }}>{copy.dashboard.filters.clearAll}</button>
          </div>
        ) : null}

        <div className="ctr-row" style={{ justifyContent: "space-between" }} aria-live="polite">
          <span className="ins-muted">{fill(copy.dashboard.results, { n: fmtNumber(total, locale) })}{applied ? ` · ${applied}` : ""}</span>
        </div>
        {selected.size ? (
          <div className="dt-bulkbar" role="region" aria-label={fill(copy.dashboard.bulk.selected, { n: selected.size })}>
            <strong>{fill(copy.dashboard.bulk.selected, { n: selected.size })}</strong>
            <button type="button" className="ctr-btn" onClick={() => setBulk("ARCHIVE")}>{copy.dashboard.bulk.archive}</button>
            <button type="button" className="ctr-btn" onClick={() => setBulk("ADD_TAG")}>{copy.dashboard.bulk.addTag}</button>
            <button type="button" className="ctr-btn" onClick={() => setBulk("CHANGE_CATEGORY")}>{copy.dashboard.bulk.changeCategory}</button>
            {canUpload ? <button type="button" className="ctr-btn" disabled={selected.size > 50 || reprocessSel.isPending} title={selected.size > 50 ? aiCopy.center.bulk.body : aiCopy.panel.reprocessWhy} onClick={() => reprocessSel.mutate([...selected])}>{reprocessSel.isPending ? aiCopy.common.working : aiCopy.bulk.reprocess}</button> : null}
            <button type="button" className="ctr-btn is-ghost" style={{ color: "#fff" }} onClick={clearSelection}>{copy.dashboard.bulk.clearSelection}</button>
          </div>
        ) : null}

        {list.isPending ? <Skeletons n={5} /> : list.isError ? <ErrorState error={list.error} copy={copy} onRetry={() => void list.refetch()} /> : !rows.length ? (
          <EmptyState title={applied ? copy.dashboard.empty.noMatchTitle : copy.dashboard.empty.noneTitle} body={applied ? copy.dashboard.empty.noMatchBody : copy.dashboard.empty.noneBody}
            action={applied ? <button type="button" className="ctr-btn" onClick={() => { setSearchText(""); url.set(Object.fromEntries(Object.keys(filterParams(DEFAULT_FILTERS)).map((k) => [k, null]))); }}>{copy.dashboard.filters.clearAll}</button> : canUpload ? <Link className="ctr-btn is-primary" href="/documents/upload">{copy.dashboard.upload}</Link> : undefined} />
        ) : (
          <div style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
            {layout === "table" ? <DocTable rows={rows} copy={copy} locale={locale} h={handlers} allSelected={allSelected} toggleAll={toggleAll} /> : <DocCards rows={rows} copy={copy} locale={locale} h={handlers} className="dt-grid" />}
            {layout === "table" ? <DocCards rows={rows} copy={copy} locale={locale} h={handlers} className="ins-cards ins-only-narrow dt-grid" /> : null}
            <div className="dt-pager">
              <label className="ctr-row" style={{ gap: "0.4rem" }}><span className="ins-muted">{copy.dashboard.table.rowMenu}</span><select className="ctr-input" style={{ width: "5rem" }} aria-label="Page size" value={filters.limit} onChange={(e) => url.set({ ...filterParams(filters), limit: e.target.value === "25" ? null : e.target.value, page: null })}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <div className="ctr-row">
                <button type="button" className="ctr-btn" disabled={filters.page <= 1} onClick={() => url.set({ page: String(filters.page - 1) })}>{copy.common.prev}</button>
                <span className="ins-muted dt-tabnum">{fill(copy.common.page, { n: filters.page, total: pages })}</span>
                <button type="button" className="ctr-btn" disabled={filters.page >= pages} onClick={() => url.set({ page: String(filters.page + 1) })}>{copy.common.next}</button>
              </div>
            </div>
          </div>
        )}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>

      {canUpload ? <Link className="ctr-btn is-primary dt-fab" href="/documents/upload" aria-label={copy.dashboard.upload}><UploadCloudIcon aria-hidden="true" />{copy.common.upload}</Link> : null}
      {drawerDoc ? <DocumentPreviewDrawer doc={drawerDoc} copy={copy} locale={locale} onClose={closeDrawer} onPrev={drawerIndex > 0 ? () => setDrawer(rows[drawerIndex - 1]!.id) : undefined} onNext={drawerIndex < rows.length - 1 ? () => setDrawer(rows[drawerIndex + 1]!.id) : undefined} onReplace={() => { setReplace(drawerDoc); setDrawer(null); }} /> : null}
      {replace ? <ReplaceDialog open onOpenChange={(o) => { if (!o) setReplace(null); }} copy={copy} doc={replace} allowsImages={Boolean(DOCUMENT_CATEGORIES.find((c) => c.key === replace.category)?.allowsImages)} /> : null}
      {archive ? <ArchiveDialog open onOpenChange={(o) => { if (!o) setArchive(null); }} copy={copy} doc={archive} /> : null}
      {del ? <DeleteDialog open onOpenChange={(o) => { if (!o) setDel(null); }} copy={copy} doc={del} /> : null}
      <BulkDialogs copy={copy} ids={[...selected]} mode={bulk} onClose={() => setBulk(null)} onDone={clearSelection} />
    </StaffWorkspaceShell>
  );
}
