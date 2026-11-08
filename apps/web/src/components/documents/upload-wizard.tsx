"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckCircle2Icon, UploadCloudIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categoryDef, DOCUMENT_LANGUAGES, DOCUMENT_LIMITS, suggestCategory } from "@infraos/shared-types";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContextBar } from "@/components/site-plan/site-plan";
import { abortUpload, commitUpload, failureOf, initUpload, streamBytes } from "@/lib/documents/api";
import { getDocCopy, type Copy } from "@/lib/documents/messages";
import { hintUpload, useDocKeys } from "@/lib/documents/session";
import type { Confidentiality, UploadInit, Visibility } from "@/lib/documents/types";
import { checkClientFile, fill, formatSize, mimeForName } from "@/lib/documents/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { EmptyState, errorText, Field, FileTypeIcon } from "./doc-ui";
import { useRefreshDocs } from "./document-parts";
import { CategoryPicker, TagsInput } from "./form-parts";
import { ProjectPicker } from "./project-picker";

type FileState = "ready" | "uploading" | "duplicate" | "done" | "error" | "cancelled" | "skipped";
type Item = {
  uid: string; file: File; clientError: string | null; category: string; title: string; description: string; tags: string[]; documentDate: string; reference: string; language: string;
  confidentiality: Confidentiality; visibility: Visibility; status: "ACTIVE" | "DRAFT";
  state: FileState; progress: number; message: string | null; docId: string | null; docNo: string | null; dup: { id: string; docNo: string | null; title: string } | null; ticket: string | null;
};
type Prefill = { projectId?: string; projectLabel?: string; category?: string; links?: Record<string, string> };
const LINK_KEYS = ["contractorId", "inspectionId", "paymentId", "expenseId", "assetId", "milestoneId"] as const;
const STEPS = ["files", "classify", "link", "review"] as const;
const stem = (n: string) => n.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200);
let uidn = 0;

/** The Link step never invents scope: ids are validated server-side (same project/agency), and the owning agency is derived there, never sent. */
export function UploadWizard({ prefill, copy, locale, onFinished, canSensitive }: { prefill?: Prefill; copy: Copy; locale: Parameters<typeof formatSize>[1]; onFinished?: () => void; canSensitive: boolean }) {
  const refresh = useRefreshDocs();
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [projectId, setProjectId] = useState(prefill?.projectId ?? "");
  const [projectLabel, setProjectLabel] = useState(prefill?.projectLabel ?? "");
  const [links, setLinks] = useState<Record<string, string>>(prefill?.links ?? {});
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const patch = useCallback((uid: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.uid === uid ? { ...i, ...p } : i))), []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = [...list];
    setNotice(null);
    setItems((cur) => {
      const room = DOCUMENT_LIMITS.maxBatchFiles - cur.length;
      if (incoming.length > room) setNotice(copy.wizard.files.max);
      const add = incoming.slice(0, Math.max(0, room)).map((file): Item => {
        const cat = prefill?.category ?? suggestCategory(file.name);
        const def = categoryDef(cat);
        return {
          uid: `f${(uidn += 1)}`, file, clientError: checkClientFile(file, true), category: cat, title: stem(file.name), description: "", tags: [], documentDate: "", reference: "", language: "unknown",
          confidentiality: def?.sensitiveByDefault ? "SENSITIVE" : "STANDARD", visibility: def?.defaultVisibility ?? "INTERNAL", status: "ACTIVE", state: "ready", progress: 0, message: null, docId: null, docNo: null, dup: null, ticket: null,
        };
      });
      return [...cur, ...add];
    });
  }, [copy.wizard.files.max, prefill?.category]);

  // Paste support while the Files step is showing.
  useEffect(() => {
    if (step !== 0) return;
    const h = (e: ClipboardEvent) => { if (e.clipboardData?.files.length) addFiles(e.clipboardData.files); };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
  }, [step, addFiles]);
  // Warn before leaving while bytes are in flight.
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [running]);

  const valid = items.filter((i) => !i.clientError);
  const move = (uid: string, d: -1 | 1) => setItems((cur) => { const i = cur.findIndex((x) => x.uid === uid); const j = i + d; if (i < 0 || j < 0 || j >= cur.length) return cur; const n = [...cur]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const needsProject = valid.some((i) => categoryDef(i.category)?.requiresProject);
  const stepOk = [valid.length > 0, valid.every((i) => Boolean(i.category) && i.title.trim().length > 0), !needsProject || Boolean(projectId), true][step] ?? false;
  const allowedLinks = (cat: string) => (categoryDef(cat)?.links ?? []) as readonly string[];
  const anyLinkKeys = LINK_KEYS.filter((k) => valid.some((i) => allowedLinks(i.category).includes(k)));

  const applyAll = (src: Item) => setItems((cur) => cur.map((i) => (i.uid === src.uid || i.clientError ? i : { ...i, category: src.category, description: src.description, tags: src.tags, documentDate: src.documentDate, reference: src.reference, language: src.language, confidentiality: src.confidentiality, visibility: src.visibility, status: src.status })));

  const bodyFor = (i: Item): UploadInit => ({
    fileName: i.file.name, mimeType: mimeForName(i.file.name, i.file.type), sizeBytes: i.file.size, category: i.category, title: i.title.trim() || undefined, description: i.description.trim() || undefined, tags: i.tags,
    ...(i.documentDate ? { documentDate: i.documentDate } : {}), ...(i.reference.trim() ? { reference: i.reference.trim() } : {}), language: i.language, visibility: i.visibility, confidentiality: i.confidentiality, status: i.status,
    ...(projectId ? { projectId } : {}), links: Object.fromEntries(LINK_KEYS.filter((k) => links[k]?.trim() && allowedLinks(i.category).includes(k)).map((k) => [k, links[k]!.trim()])),
  });

  const uploadOne = async (i: Item, allowDuplicate = false, resume?: { ticket: string }) => {
    const ctl = new AbortController();
    aborts.current.set(i.uid, ctl);
    patch(i.uid, { state: "uploading", message: null, ...(resume ? {} : { progress: 0, dup: null }) });
    let ticket = resume?.ticket ?? "";
    try {
      if (!resume) {
        const init = await initUpload(bodyFor(i));
        ticket = init.ticket;
        patch(i.uid, { ticket });
        const res = await streamBytes(init.upload.path, i.file, (p) => patch(i.uid, { progress: p }), ctl.signal);
        if (res.duplicate && !allowDuplicate) { patch(i.uid, { state: "duplicate", dup: res.duplicate, progress: 1 }); return; }
      }
      const done = await commitUpload(`/documents/uploads/${ticket}/commit`, allowDuplicate);
      patch(i.uid, { state: "done", docId: done.id, docNo: done.docNo, progress: 1, dup: null });
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") { patch(i.uid, { state: "cancelled", message: copy.wizard.review.cancelled }); if (ticket) void abortUpload(ticket).catch(() => undefined); return; }
      const f = failureOf(e);
      if (f.fileError === "FILE_DUPLICATE_WARNING" && f.existing) { patch(i.uid, { state: "duplicate", dup: f.existing }); return; }
      patch(i.uid, { state: "error", message: errorText(e, copy) });
    } finally { aborts.current.delete(i.uid); }
  };

  const startAll = async (only?: (i: Item) => boolean) => {
    setRunning(true); setFinished(false);
    const queue = items.filter((i) => !i.clientError && (only ? only(i) : i.state === "ready"));
    for (const i of queue) await uploadOne(i);
    setRunning(false); setFinished(true);
    await refresh();
  };
  const uploadAnyway = async (i: Item) => { setRunning(true); await uploadOne(i, true, i.ticket ? { ticket: i.ticket } : undefined); setRunning(false); setFinished(true); await refresh(); };
  const cancel = (i: Item) => { if (i.state === "uploading") aborts.current.get(i.uid)?.abort(); else if (i.state === "duplicate" && i.ticket) { void abortUpload(i.ticket).catch(() => undefined); patch(i.uid, { state: "skipped", dup: null }); } };

  const counts = useMemo(() => ({ ok: items.filter((i) => i.state === "done").length, failed: items.filter((i) => i.state === "error" || i.state === "cancelled").length }), [items]);
  const uploading = step === 3 && items.some((i) => i.state !== "ready" && !i.clientError);

  return (
    <div className="ins dt">
      <ol className="dt-steps" aria-label={copy.wizard.title}>
        {STEPS.map((s, i) => <li key={s} className="dt-step" aria-current={i === step ? "step" : undefined} data-done={i < step}><b>{i + 1}</b>{copy.wizard.steps[s]}</li>)}
      </ol>

      {step === 0 ? (
        <section aria-labelledby="dt-files-h">
          <div className="dt-drop" data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
            <UploadCloudIcon aria-hidden="true" />
            <strong id="dt-files-h">{copy.wizard.files.drop}</strong>
            <button type="button" className="ctr-btn is-primary" onClick={() => inputRef.current?.click()}>{copy.wizard.files.choose}</button>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <span className="ins-muted">{copy.wizard.files.hint} {copy.wizard.files.paste}</span>
          </div>
          {notice ? <p role="alert" className="ctr-error">{notice}</p> : null}
          {items.length ? (
            <ul className="dt-files" style={{ marginTop: "0.8rem" }}>
              {items.map((i, idx) => (
                <li key={i.uid} className="dt-file" data-state={i.clientError ? "error" : "ready"}>
                  <FileTypeIcon mime={i.file.type || null} name={i.file.name} />
                  <div><span className="dt-file-name">{i.file.name}</span><br /><span className="ins-muted">{formatSize(i.file.size, locale)}</span>
                    {i.clientError ? <><br /><span role="alert" className="ctr-error">{copy.wizard.files.rejected}: {(copy.errors as Record<string, string>)[i.clientError]}</span></> : null}</div>
                  <div className="ctr-row">
                    <button type="button" className="ctr-btn is-ghost" aria-label={`${copy.wizard.files.moveUp}: ${i.file.name}`} disabled={idx === 0} onClick={() => move(i.uid, -1)}><ArrowUpIcon aria-hidden="true" /></button>
                    <button type="button" className="ctr-btn is-ghost" aria-label={`${copy.wizard.files.moveDown}: ${i.file.name}`} disabled={idx === items.length - 1} onClick={() => move(i.uid, 1)}><ArrowDownIcon aria-hidden="true" /></button>
                    <button type="button" className="ctr-btn is-ghost" aria-label={fill(copy.wizard.files.remove, { name: i.file.name })} onClick={() => setItems((c) => c.filter((x) => x.uid !== i.uid))}><XCircleIcon aria-hidden="true" /></button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section style={{ display: "grid", gap: "0.8rem" }}>
          {valid.map((i) => {
            const set = (p: Partial<Item>) => patch(i.uid, p);
            const sensitive = i.confidentiality === "SENSITIVE";
            return (
              <div key={i.uid} className="dt-class">
                <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div className="dt-title-cell"><FileTypeIcon mime={i.file.type || null} name={i.file.name} /><strong className="dt-file-name">{i.file.name}</strong></div>
                  {valid.length > 1 ? <button type="button" className="ctr-btn" onClick={() => applyAll(i)}>{copy.wizard.classify.applyAll}</button> : null}
                </div>
                <div><span className="ctr-label">{copy.wizard.classify.category}</span><CategoryPicker value={i.category} onChange={(k) => { const d = categoryDef(k); set({ category: k, visibility: d?.defaultVisibility ?? i.visibility }); }} copy={copy} suggested={suggestCategory(i.file.name, undefined)} /></div>
                <div className="ctr-row" style={{ flexWrap: "wrap", alignItems: "start" }}>
                  <Field label={copy.wizard.classify.title} wide error={i.title.trim() ? null : copy.common.required}>{(id) => <input id={id} className="ctr-input" maxLength={200} value={i.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
                  <Field label={copy.wizard.classify.reference}>{(id) => <input id={id} className="ctr-input" maxLength={100} value={i.reference} onChange={(e) => set({ reference: e.target.value })} />}</Field>
                  <Field label={copy.wizard.classify.documentDate}>{(id) => <input id={id} type="date" className="ctr-input" value={i.documentDate} onChange={(e) => set({ documentDate: e.target.value })} />}</Field>
                </div>
                <Field label={copy.wizard.classify.description}>{(id) => <textarea id={id} className="ctr-input" maxLength={2000} value={i.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
                <Field label={copy.wizard.classify.tags} hint={copy.wizard.classify.tagsHint}>{(id) => <TagsInput id={id} value={i.tags} onChange={(t) => set({ tags: t })} copy={copy} />}</Field>
                <div className="ctr-row" style={{ flexWrap: "wrap", alignItems: "start" }}>
                  <Field label={copy.wizard.classify.language}>{(id) => <select id={id} className="ctr-input" value={i.language} onChange={(e) => set({ language: e.target.value })}>{DOCUMENT_LANGUAGES.map((l) => <option key={l} value={l}>{copy.wizard.language[l]}</option>)}</select>}</Field>
                  <Field label={copy.wizard.classify.initialStatus}>{(id) => <select id={id} className="ctr-input" value={i.status} onChange={(e) => set({ status: e.target.value as Item["status"] })}><option value="ACTIVE">{copy.wizard.classify.asActive}</option><option value="DRAFT">{copy.wizard.classify.asDraft}</option></select>}</Field>
                  {canSensitive ? <Field label={copy.wizard.classify.confidentiality} hint={sensitive ? copy.confidentiality.sensitiveHint : undefined}>{(id) => <select id={id} className="ctr-input" value={i.confidentiality} onChange={(e) => set({ confidentiality: e.target.value as Confidentiality, ...(e.target.value === "SENSITIVE" && i.visibility === "PUBLIC" ? { visibility: "INTERNAL" as Visibility } : {}) })}><option value="STANDARD">{copy.confidentiality.STANDARD}</option><option value="SENSITIVE">{copy.confidentiality.SENSITIVE}</option></select>}</Field> : null}
                  <Field label={copy.wizard.classify.visibility} hint={(copy.visibility as Record<string, string>)[`${i.visibility}_HELP`]} wide>{(id) => <select id={id} className="ctr-input" value={i.visibility} onChange={(e) => set({ visibility: e.target.value as Visibility })}>{(["INTERNAL", "PROJECT_TEAM", ...(sensitive ? [] : ["PUBLIC"])] as Visibility[]).map((v) => <option key={v} value={v}>{copy.visibility[v]}</option>)}</select>}</Field>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="dt-class">
          <Field label={copy.wizard.link.project} hint={copy.wizard.link.projectHint} error={needsProject && !projectId ? copy.wizard.link.projectRequired : null}>{(id) => <ProjectPicker id={id} copy={copy} value={projectId} label={projectLabel} onChange={(pid, l) => { setProjectId(pid); setProjectLabel(l); if (!pid) setLinks({}); }} />}</Field>
          <p className="ins-muted" style={{ margin: 0 }}>{copy.wizard.link.agency}: {copy.wizard.link.agencyAuto}</p>
          {projectId && anyLinkKeys.length ? (
            <div className="ctr-row" style={{ flexWrap: "wrap", alignItems: "start" }}>
              {anyLinkKeys.map((k) => <Field key={k} label={copy.wizard.link[k.replace("Id", "") as "contractor"]} hint={copy.wizard.link.idPlaceholder}>{(id) => <input id={id} className="ctr-input" inputMode="text" autoComplete="off" pattern="[A-Fa-f0-9]{24}" maxLength={24} value={links[k] ?? ""} onChange={(e) => setLinks({ ...links, [k]: e.target.value.trim() })} />}</Field>)}
            </div>
          ) : null}
          {projectId ? <p className="ctr-note">{copy.wizard.link.linkNote}</p> : null}
          {valid.map((i) => <p key={i.uid} className="ins-muted" style={{ margin: 0 }}>{i.file.name}: {(copy.category as Record<string, string>)[i.category]} · {allowedLinks(i.category).length ? allowedLinks(i.category).map((k) => copy.wizard.link[k.replace("Id", "") as "contractor"]).join(", ") : copy.wizard.link.notAllowed}</p>)}
        </section>
      ) : null}

      {step === 3 ? (
        <section style={{ display: "grid", gap: "0.8rem" }} aria-live="polite">
          <ul className="dt-files">
            {items.filter((i) => !i.clientError).map((i) => (
              <li key={i.uid} className="dt-file" data-state={i.state === "error" || i.state === "cancelled" ? "error" : i.state === "done" ? "done" : "ready"}>
                <FileTypeIcon mime={i.file.type || null} name={i.file.name} />
                <div>
                  <span className="dt-file-name">{i.title || i.file.name}</span><br />
                  <span className="ins-muted">{i.file.name} · {formatSize(i.file.size, locale)} · {(copy.category as Record<string, string>)[i.category]}</span>
                  {i.state === "uploading" ? <div className="ctr-progress" role="progressbar" aria-label={`${copy.wizard.review.uploading} ${i.file.name}`} aria-valuenow={Math.round(i.progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${i.progress * 100}%` }} /></div> : null}
                  {i.state === "duplicate" && i.dup ? (
                    <div className="ctr-note" role="alert" style={{ marginTop: "0.4rem" }}>{copy.wizard.review.duplicate} <strong>{i.dup.docNo ?? ""} {i.dup.title}</strong>
                      <div className="ctr-row" style={{ marginTop: "0.4rem", flexWrap: "wrap" }}>
                        <button type="button" className="ctr-btn" onClick={() => void uploadAnyway(i)}>{copy.wizard.review.uploadAnyway}</button>
                        <button type="button" className="ctr-btn" onClick={() => cancel(i)}>{copy.common.skip}</button>
                        <Link className="ctr-btn is-ghost" href={`/documents/${i.dup.id}`} target="_blank" rel="noreferrer">{copy.wizard.review.openExisting}</Link>
                      </div></div>
                  ) : null}
                  {i.message ? <p role="alert" className="ctr-error" style={{ margin: "0.3rem 0 0" }}>{i.message}</p> : null}
                </div>
                <div className="ctr-row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {i.state === "ready" ? <span className="ins-muted">{copy.wizard.review.waiting}</span> : null}
                  {i.state === "uploading" ? <><span className="ins-muted">{copy.wizard.review.uploading}</span><button type="button" className="ctr-btn" onClick={() => cancel(i)}>{copy.wizard.review.cancel}</button></> : null}
                  {i.state === "done" && i.docId ? <><CheckCircle2Icon aria-hidden="true" style={{ color: "var(--infra-green)" }} /><Link className="ctr-btn" href={`/documents/${i.docId}`}>{copy.wizard.review.openDocument} {i.docNo ?? ""}</Link></> : null}
                  {i.state === "error" || i.state === "cancelled" ? <button type="button" className="ctr-btn" onClick={() => { setRunning(true); void uploadOne(i).then(() => { setRunning(false); setFinished(true); return refresh(); }); }}>{copy.wizard.review.retry}</button> : null}
                </div>
              </li>
            ))}
          </ul>
          {finished && !running ? (
            <div className="ctr-note" role="status"><strong>{copy.wizard.review.doneTitle}</strong> {fill(copy.wizard.review.doneBody, { ok: counts.ok, failed: counts.failed })} {counts.failed ? copy.wizard.review.partial : ""}
              <div className="ctr-row" style={{ marginTop: "0.5rem", flexWrap: "wrap" }}>
                {counts.failed ? <button type="button" className="ctr-btn is-primary" onClick={() => void startAll((i) => i.state === "error" || i.state === "cancelled")}>{copy.wizard.review.retryFailed}</button> : null}
                <button type="button" className="ctr-btn" onClick={() => { setItems([]); setStep(0); setFinished(false); }}>{copy.wizard.review.newUpload}</button>
                <button type="button" className="ctr-btn" onClick={() => onFinished?.()}>{copy.wizard.review.goToLibrary}</button>
              </div></div>
          ) : null}
        </section>
      ) : null}

      <div className="ctr-row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="ctr-btn" disabled={step === 0 || running || uploading} onClick={() => setStep(step - 1)}>{copy.wizard.back}</button>
        {step < 3 ? <button type="button" className="ctr-btn is-primary" disabled={!stepOk} onClick={() => setStep(step + 1)}>{copy.wizard.next}</button>
          : <button type="button" className="ctr-btn is-primary" disabled={running || !items.some((i) => i.state === "ready" && !i.clientError)} onClick={() => void startAll()}>{running ? copy.wizard.review.uploading : fill(copy.wizard.review.start, { n: items.filter((i) => i.state === "ready" && !i.clientError).length })}</button>}
      </div>
      {step === 1 && !stepOk ? <p className="ins-muted" role="status">{copy.wizard.classify.needsCategory}</p> : null}
      {step === 0 && !valid.length ? <p className="ins-muted">{copy.wizard.files.none}</p> : null}
    </div>
  );
}

function prefillFrom(params: URLSearchParams): Prefill {
  const links: Record<string, string> = {};
  for (const k of LINK_KEYS) { const v = params.get(k); if (v && /^[a-f0-9]{24}$/i.test(v)) links[k] = v; }
  return { ...(params.get("projectId") ? { projectId: params.get("projectId")!, projectLabel: params.get("projectLabel") ?? "" } : {}), ...(params.get("category") && categoryDef(params.get("category")!) ? { category: params.get("category")! } : {}), links };
}

export function UploadWizardPage() {
  const [locale] = useWorkspaceLocale();
  const copy = getDocCopy(locale);
  const { roleKey } = useDocKeys();
  const router = useRouter();
  const params = useSearchParams();
  const prefill = useMemo(() => prefillFrom(new URLSearchParams(params.toString())), [params]);
  return (
    <StaffWorkspaceShell title={copy.wizard.title} description={copy.dashboard.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title, href: "/documents" }, { label: copy.wizard.title }]} scope={copy.dashboard.scope} asOf={null} />}>
      {roleKey && !hintUpload(roleKey) ? <EmptyState title={copy.common.forbiddenTitle} body={copy.common.forbiddenBody} /> : <UploadWizard prefill={prefill} copy={copy} locale={locale} canSensitive={["GOV_ADMIN", "AGENCY_OFFICER"].includes(roleKey)} onFinished={() => router.push("/documents")} />}
    </StaffWorkspaceShell>
  );
}

/** Same wizard as a modal, for project and entity panels (pre-fills project, category and links). */
export function UploadDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: Prefill }) {
  const [locale] = useWorkspaceLocale();
  const copy = getDocCopy(locale);
  const { roleKey } = useDocKeys();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl ctr-dialog max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{copy.wizard.title}</DialogTitle><DialogDescription className="sr-only">{copy.wizard.title}</DialogDescription></DialogHeader>
        {open ? <UploadWizard prefill={prefill} copy={copy} locale={locale} canSensitive={["GOV_ADMIN", "AGENCY_OFFICER"].includes(roleKey)} onFinished={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
