"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { abortUpload, archiveDocument, commitUpload, deleteDocument, failureOf, fetchFileBlob, initVersionUpload, removeVersion, restoreDocument, restoreVersion, restrictDocument, saveBlob, streamBytes } from "@/lib/documents/api";
import type { Copy } from "@/lib/documents/messages";
import type { DocDetail, DocItem, StreamResult } from "@/lib/documents/types";
import { checkClientFile, fill, formatSize, isPreviewMime, mimeForName } from "@/lib/documents/view";
import { useDocKeys } from "@/lib/documents/session";

import { AiStatusChip, CategoryChip, ConfidentialityChip, errorText, FileTypeIcon, Field, reasonOk, Shell, StatusChip, VersionBadge } from "./doc-ui";

export function useRefreshDocs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["documents"] });
}

export async function downloadDoc(id: string, name: string, version?: number): Promise<void> {
  const { blob } = await fetchFileBlob(id, "download", version);
  saveBlob(blob, name);
}
export async function copyDocLink(id: string, copy: Copy): Promise<void> {
  try { await navigator.clipboard.writeText(`${window.location.origin}/documents/${id}`); toast.success(copy.common.linkCopied); } catch { toast.error(copy.errors.generic); }
}

/** Authenticated object URL, not a static asset, so next/image does not apply. */
function PreviewImage({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

type PreviewData = { kind: "image" | "pdf"; url: string } | { kind: "text"; text: string };

/** Authenticated blob preview. PDF/image render from a short-lived object URL (revoked on unmount); text is shown in a <pre>. DOCX/XLSX never hit the server for preview. */
export function PreviewPane({ doc, version, copy, mime, activeContent, page }: { doc: Pick<DocItem, "id" | "fileAvailable" | "fileName">; version?: number; copy: Copy; mime: string | null; activeContent?: boolean; page?: number }) {
  const { key } = useDocKeys();
  const can = doc.fileAvailable && isPreviewMime(mime) && !activeContent;
  const q = useQuery({
    queryKey: key("preview", doc.id, version ?? 0), enabled: can, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }): Promise<PreviewData> => {
      const { blob, mime: m } = await fetchFileBlob(doc.id, "preview", version, signal);
      if (m.startsWith("text/")) return { kind: "text", text: (await blob.text()).slice(0, 200_000) };
      return { kind: m === "application/pdf" ? "pdf" : "image", url: URL.createObjectURL(blob) };
    },
  });
  const url = q.data && q.data.kind !== "text" ? q.data.url : null;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!doc.fileAvailable) return <div className="dt-preview"><div className="dt-preview-msg"><strong>{copy.detail.noFile}</strong><span className="ins-muted">{copy.drawer.fileUnavailable}</span></div></div>;
  if (!can) return (
    <div className="dt-preview"><div className="dt-preview-msg">
      <FileTypeIcon mime={mime} name={doc.fileName} large />
      <span>{activeContent ? copy.drawer.activeContent : copy.drawer.downloadToView}</span>
      <button type="button" className="ctr-btn" onClick={() => void downloadDoc(doc.id, doc.fileName, version).catch((e) => toast.error(errorText(e, copy)))}><DownloadIcon aria-hidden="true" />{copy.common.download}</button>
    </div></div>
  );
  return (
    <div className="dt-preview" aria-live="polite">
      {q.isPending ? <div className="dt-preview-msg" role="status">{copy.drawer.loadingPreview}</div> : null}
      {q.isError ? <div className="dt-preview-msg"><span>{failureOf(q.error).status === 404 ? copy.drawer.fileUnavailable : copy.drawer.previewFailed}</span><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {q.data?.kind === "image" ? <PreviewImage src={q.data.url} alt={doc.fileName} /> : null}
      {q.data?.kind === "pdf" ? <iframe title={doc.fileName} src={page ? `${q.data.url}#page=${page}` : q.data.url} /> : null}
      {q.data?.kind === "text" ? <pre tabIndex={0}>{q.data.text}</pre> : null}
    </div>
  );
}

/** Right-hand drawer on desktop, full-screen sheet on mobile. Escape closes it; focus returns to the opener. */
export function DocumentPreviewDrawer({ doc, copy, locale, onClose, onPrev, onNext, onReplace }: { doc: DocItem; copy: Copy; locale: Parameters<typeof formatSize>[1]; onClose: () => void; onPrev?: () => void; onNext?: () => void; onReplace?: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  // Mount-only: focus the close button, close on Escape, and hand focus back to whatever opened the drawer.
  useEffect(() => {
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", k);
    const el = opener.current;
    return () => { document.removeEventListener("keydown", k); (el as HTMLElement | null)?.focus?.(); };
  }, []);
  return (
    <>
      <div className="dt-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="dt-drawer" role="dialog" aria-modal="true" aria-label={doc.title}>
        <div className="dt-drawer-head">
          <div className="ctr-row" style={{ justifyContent: "space-between" }}>
            <div className="ctr-row">
              <button type="button" className="ctr-btn is-ghost" onClick={onPrev} disabled={!onPrev} aria-label={copy.drawer.previous}>‹</button>
              <button type="button" className="ctr-btn is-ghost" onClick={onNext} disabled={!onNext} aria-label={copy.drawer.next}>›</button>
            </div>
            <button type="button" ref={closeRef} className="ctr-btn" onClick={onClose}>{copy.common.close}</button>
          </div>
          <strong style={{ overflowWrap: "anywhere" }}>{doc.title}</strong>
          <div className="ctr-row" style={{ flexWrap: "wrap" }}>
            <span className="ins-muted">{doc.docNo ?? "—"}</span><VersionBadge n={doc.currentVersionNo} /><StatusChip status={doc.status} copy={copy} /><ConfidentialityChip value={doc.confidentiality} copy={copy} /><AiStatusChip ai={doc.ai} docId={doc.id} />
          </div>
        </div>
        <div className="dt-drawer-body">
          <PreviewPane doc={doc} copy={copy} mime={doc.mimeType} />
          <dl className="ctr-facts">
            <dt>{copy.detail.fields.category}</dt><dd><CategoryChip category={doc.category} copy={copy} /></dd>
            <dt>{copy.detail.fields.project}</dt><dd>{doc.project ? `${doc.project.code ?? ""} ${doc.project.title}`.trim() : copy.dashboard.table.noProject}</dd>
            <dt>{copy.detail.fields.agency}</dt><dd>{doc.agencyName ?? "—"}</dd>
            <dt>{copy.detail.fields.size}</dt><dd>{formatSize(doc.sizeBytes, locale)}</dd>
            <dt>{copy.detail.fields.tags}</dt><dd>{doc.tags.length ? doc.tags.join(", ") : "—"}</dd>
          </dl>
        </div>
        <div className="dt-drawer-foot">
          <Link className="ctr-btn is-primary" href={`/documents/${doc.id}`}><ExternalLinkIcon aria-hidden="true" />{copy.drawer.openDetails}</Link>
          {doc.fileAvailable && doc.permissions.canDownload ? <button type="button" className="ctr-btn" onClick={() => void downloadDoc(doc.id, doc.fileName).catch((e) => toast.error(errorText(e, copy)))}><DownloadIcon aria-hidden="true" />{copy.common.download}</button> : null}
          {doc.permissions.canReplace && onReplace ? <button type="button" className="ctr-btn" onClick={onReplace}>{copy.dashboard.menu.replace}</button> : null}
        </div>
      </aside>
    </>
  );
}

type Base = { open: boolean; onOpenChange: (o: boolean) => void; copy: Copy };
const Actions = ({ copy, onCancel, disabled, pending, label, danger }: { copy: Copy; onCancel: () => void; disabled: boolean; pending: boolean; label: string; danger?: boolean }) => (
  <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
    <button type="button" className="ctr-btn" onClick={onCancel}>{copy.common.cancel}</button>
    <button type="submit" className={`ctr-btn ${danger ? "" : "is-primary"}`} style={danger ? { background: "var(--infra-maroon)", color: "#fff" } : undefined} disabled={disabled || pending}>{pending ? copy.common.working : label}</button>
  </div>
);

export function ArchiveDialog({ open, onOpenChange, copy, doc, onDone }: Base & { doc: Pick<DocItem, "id" | "title">; onDone?: () => void }) {
  const refresh = useRefreshDocs();
  const [reason, setReason] = useState("");
  const m = useMutation({ mutationFn: () => archiveDocument(doc.id, reason.trim()), onSuccess: async () => { toast.success(copy.detail.danger.archived); await refresh(); onOpenChange(false); setReason(""); onDone?.(); }, onError: (e) => toast.error(errorText(e, copy)) });
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={copy.detail.danger.archiveTitle} description={copy.detail.danger.archiveBody}>
      <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!reasonOk(reason)} pending={m.isPending} label={copy.detail.danger.archiveConfirm} />
      </form>
    </Shell>
  );
}

export function RestoreAction({ doc, copy, onDone, className }: { doc: Pick<DocItem, "id">; copy: Copy; onDone?: () => void; className?: string }) {
  const refresh = useRefreshDocs();
  const m = useMutation({ mutationFn: () => restoreDocument(doc.id), onSuccess: async () => { toast.success(copy.detail.danger.restoredDone); await refresh(); onDone?.(); }, onError: (e) => toast.error(errorText(e, copy)) });
  return <button type="button" className={className ?? "ctr-btn"} disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? copy.common.working : copy.detail.actions.restore}</button>;
}

export function DeleteDialog({ open, onOpenChange, copy, doc, onDone }: Base & { doc: Pick<DocItem, "id" | "docNo" | "status">; onDone?: () => void }) {
  const refresh = useRefreshDocs();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [blocked, setBlocked] = useState<{ type: string; id: string }[]>([]);
  const expected = doc.docNo ?? "DELETE";
  const m = useMutation({
    mutationFn: () => deleteDocument(doc.id, { reason: reason.trim(), confirm: confirm.trim() }),
    onSuccess: async () => { toast.success(copy.detail.danger.deleted); await refresh(); onOpenChange(false); onDone?.(); },
    onError: (e) => { const f = failureOf(e); setBlocked(f.references); toast.error(errorText(e, copy)); },
  });
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={copy.detail.danger.deleteTitle} description={copy.detail.danger.deleteBody}>
      {doc.status !== "ARCHIVED" ? <p className="ctr-note">{copy.detail.danger.deleteOnlyArchived}</p> : (
        <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
          <Field label={fill(copy.detail.danger.deleteType, { docNo: expected })}>{(id) => <input id={id} className="ctr-input" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
          {blocked.length ? <div className="ctr-note" role="alert">{copy.detail.danger.blockedBy}<ul>{blocked.map((b) => <li key={`${b.type}${b.id}`}>{b.type.replace(/_/g, " ").toLowerCase()} · {b.id.slice(-6)}</li>)}</ul></div> : null}
          <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!reasonOk(reason) || confirm.trim().toUpperCase() !== expected.toUpperCase()} pending={m.isPending} label={copy.detail.danger.deleteConfirm} danger />
        </form>
      )}
    </Shell>
  );
}

export function RestrictDialog({ open, onOpenChange, copy, doc, isGovAdmin }: Base & { doc: Pick<DocItem, "id" | "version" | "confidentiality" | "ai">; isGovAdmin: boolean }) {
  const refresh = useRefreshDocs();
  const [conf, setConf] = useState(doc.confidentiality);
  const [ai, setAi] = useState(doc.ai.allowed);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => restrictDocument(doc.id, { version: doc.version, confidentiality: conf, aiProcessingAllowed: ai, reason: reason.trim() }),
    onSuccess: async () => { toast.success(copy.detail.danger.restricted); await refresh(); onOpenChange(false); setReason(""); }, onError: (e) => toast.error(errorText(e, copy)),
  });
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={copy.detail.danger.restrictTitle} description={copy.detail.danger.restrictBody}>
      <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="ctr-seg" role="group" aria-label={copy.detail.fields.confidentiality}>
          <button type="button" aria-pressed={conf === "STANDARD"} onClick={() => setConf("STANDARD")}>{copy.detail.danger.markStandard}</button>
          <button type="button" aria-pressed={conf === "SENSITIVE"} onClick={() => { setConf("SENSITIVE"); setAi(false); }}>{copy.detail.danger.markSensitive}</button>
        </div>
        <label className="ctr-row" style={{ gap: "0.5rem" }}>
          <input type="checkbox" checked={!ai} onChange={(e) => setAi(!e.target.checked)} /> {copy.detail.danger.excludeAi}
        </label>
        {conf === "SENSITIVE" && isGovAdmin ? <label className="ctr-row" style={{ gap: "0.5rem" }}><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} /> {copy.detail.danger.allowAi}</label> : null}
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!reasonOk(reason)} pending={m.isPending} label={copy.common.save} />
      </form>
    </Shell>
  );
}

/** Replace flow: init -> stream with real progress -> commit. The old file stays in the history as a superseded version. */
export function ReplaceDialog({ open, onOpenChange, copy, doc, allowsImages }: Base & { doc: Pick<DocItem, "id" | "currentVersionNo">; allowsImages: boolean }) {
  const refresh = useRefreshDocs();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState(0);
  const [dup, setDup] = useState<{ ticket: string; commitPath: string; result: StreamResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const reset = () => { setFile(null); setNote(""); setProgress(0); setDup(null); setError(null); setBusy(false); };
  const close = (o: boolean) => { if (!o) { abort.current?.abort(); reset(); } onOpenChange(o); };
  const clientError = file ? checkClientFile(file, allowsImages) : null;

  const finish = async (commitPath: string, allowDuplicate: boolean) => {
    await commitUpload(commitPath, allowDuplicate);
    toast.success(copy.detail.versions.replaced);
    await refresh();
    close(false);
  };
  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null); setProgress(0);
    abort.current = new AbortController();
    let ticket = "";
    try {
      const init = await initVersionUpload(doc.id, { fileName: file.name, mimeType: mimeForName(file.name, file.type), sizeBytes: file.size, changeNote: note.trim() });
      ticket = init.ticket;
      const commitPath = `/documents/${doc.id}/versions/${init.ticket}/commit`;
      const res = await streamBytes(`/documents/${doc.id}/versions/${init.ticket}/content`, file, setProgress, abort.current.signal);
      if (res.duplicate) { setDup({ ticket, commitPath, result: res }); setBusy(false); return; }
      await finish(commitPath, false);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") { if (ticket) void abortUpload(ticket).catch(() => undefined); } else setError(errorText(e, copy));
      setBusy(false);
    }
  };
  return (
    <Shell open={open} onOpenChange={close} title={copy.detail.versions.replaceTitle} description={copy.detail.versions.replaceBody}>
      <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Field label={copy.detail.versions.choose} error={clientError ? (copy.errors as Record<string, string>)[clientError] : null}>{(id) => <input id={id} type="file" className="ctr-input" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDup(null); setError(null); }} />}</Field>
        <Field label={copy.detail.versions.changeNote} hint={copy.detail.versions.noteHint}>{(id) => <textarea id={id} className="ctr-input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}</Field>
        {busy ? <div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={copy.detail.versions.uploading} className="ctr-progress"><i style={{ width: `${progress * 100}%` }} /></div> : null}
        {dup ? <div className="ctr-note" role="alert">{copy.detail.versions.duplicateSame}<div className="ctr-row" style={{ marginTop: "0.4rem" }}><button type="button" className="ctr-btn" disabled={busy} onClick={() => { setBusy(true); void finish(dup.commitPath, true).catch((e) => { setError(errorText(e, copy)); setBusy(false); }); }}>{copy.dashboard.menu.replace}</button></div></div> : null}
        {error ? <p role="alert" className="ctr-error">{error}</p> : null}
        <Actions copy={copy} onCancel={() => close(false)} disabled={!file || Boolean(clientError) || note.trim().length < 5 || Boolean(dup)} pending={busy} label={copy.detail.versions.upload} />
      </form>
    </Shell>
  );
}

export function VersionActionDialog({ open, onOpenChange, copy, mode, docId, n }: Base & { mode: "restore" | "remove"; docId: string; n: number }) {
  const refresh = useRefreshDocs();
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (mode === "restore") {
        await restoreVersion(docId, n, text.trim());
      } else {
        await removeVersion(docId, n, text.trim());
      }
    },
    onSuccess: async () => { toast.success(mode === "restore" ? copy.detail.versions.restored : copy.detail.versions.removedDone); await refresh(); onOpenChange(false); setText(""); },
    onError: (e) => toast.error(errorText(e, copy)),
  });
  const ok = mode === "restore" ? text.trim().length >= 5 : reasonOk(text);
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={fill(mode === "restore" ? copy.detail.versions.restoreTitle : copy.detail.versions.removeTitle, { n })} description={mode === "restore" ? copy.detail.versions.restoreBody : copy.detail.versions.removeBody}>
      <form className="ctr-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label={mode === "restore" ? copy.detail.versions.changeNote : copy.common.reasonLabel} hint={mode === "restore" ? copy.detail.versions.noteHint : copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />}</Field>
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={mode === "restore" ? copy.detail.versions.restore : copy.detail.versions.confirmRemove} danger={mode === "remove"} />
      </form>
    </Shell>
  );
}

export type { DocDetail };
