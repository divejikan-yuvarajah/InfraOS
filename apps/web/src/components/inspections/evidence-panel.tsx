"use client";

import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, MapPinIcon, ShieldCheckIcon, Trash2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AuthLocale } from "@/lib/auth/types";
import { createEvidence, failureOf, patchEvidence, removeEvidence, uploadEvidenceFile } from "@/lib/inspections/api";
import { checkInput, processImage, type Processed } from "@/lib/inspections/image-pipeline";
import type { Copy } from "@/lib/inspections/messages";
import type { EvidenceItem } from "@/lib/inspections/types";
import { UploadQueue, type UploadItem } from "@/lib/inspections/upload-queue";
import { fill, fmtBytes, fmtDateTime } from "@/lib/inspections/view";

import { AuthedImage, errorText, Field } from "./inspection-ui";

type Meta = { id: string; name: string; processed: Processed; caption: string; checklistItemKey: string; defectKey: string; capturedAt: string; location: { lon: number; lat: number; accuracyM: number } | null; evidenceId: string | null; error: unknown };
type Props = {
  inspectionId: string; evidence: EvidenceItem[]; editable: boolean; copy: Copy; locale: AuthLocale;
  items: { key: string; label: string }[]; defects: { key: string; title: string }[]; onChanged: () => void; onBusyChange?: (busy: boolean) => void;
};

const MAX = 30;
const permanent = (e: unknown) => { const s = failureOf(e).status; return s === 400 || s === 403 || s === 404 || s === 409 || s === 413 || s === 415 || s === 422; };

function useQueue() {
  const [metas] = useState(() => new Map<string, Meta>());
  const [queue] = useState(() => new UploadQueue<string>(async (item, progress, signal) => {
    const m = metas.get(item.meta)!;
    try {
    if (!m.evidenceId) {
      const created = await createEvidence(m.id.split(":")[0]!, {
        ...(m.caption ? { caption: m.caption } : {}), ...(m.checklistItemKey ? { checklistItemKey: m.checklistItemKey } : {}), ...(m.defectKey ? { defectKey: m.defectKey } : {}),
        capturedAt: m.capturedAt, sha256: m.processed.sha256, mimeType: "image/jpeg", width: m.processed.width, height: m.processed.height, sizeBytes: m.processed.full.size,
        thumb: { sizeBytes: m.processed.thumb.size, sha256: m.processed.thumbSha256 }, ...(m.location ? { location: m.location } : {}),
      });
      m.evidenceId = created.evidenceId;
    }
    await uploadEvidenceFile(m.evidenceId, "full", m.processed.full, (f) => progress(f * 0.9), signal);
    await uploadEvidenceFile(m.evidenceId, "thumb", m.processed.thumb, (f) => progress(0.9 + f * 0.1), signal);
    m.error = null;
    } catch (e) { m.error = e; throw e; }
  }, permanent));
  useEffect(() => () => queue.dispose(), [queue]);
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  return { queue, metas, items };
}

export function EvidencePanel(p: Props) {
  const { copy, locale } = p;
  const { queue, metas, items } = useQueue();
  // Refresh the server view whenever another upload finishes.
  const finished = items.filter((i) => i.state === "done").length;
  const seen = useRef(0);
  const { onChanged } = p;
  useEffect(() => { if (finished > seen.current) { seen.current = finished; onChanged(); } }, [finished, onChanged]);
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [defect, setDefect] = useState("");
  const [attach, setAttach] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [busyFiles, setBusyFiles] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const active = p.evidence.filter((e) => e.status !== "REMOVED");
  const busy = items.some((i) => i.state === "queued" || i.state === "uploading") || busyFiles > 0;
  useEffect(() => { p.onBusyChange?.(busy); }, [busy, p]);

  const position = (): Promise<{ lon: number; lat: number; accuracyM: number } | null> => new Promise((resolve) => {
    if (!attach || !("geolocation" in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition((pos) => { setGeoNote(fill(copy.evidence.locationAccuracy, { m: Math.round(pos.coords.accuracy) })); resolve({ lon: pos.coords.longitude, lat: pos.coords.latitude, accuracyM: Math.min(5000, Math.round(pos.coords.accuracy)) }); }, () => { setGeoNote(copy.evidence.locationDenied); resolve(null); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 });
  });

  const addFiles = async (list: FileList | null) => {
    if (!list || !p.editable) return;
    const files = [...list];
    let room = MAX - active.length - items.filter((i) => i.state !== "failed" && i.state !== "cancelled" && i.state !== "done").length;
    const loc = files.length ? await position() : null;
    setBusyFiles((n) => n + files.length);
    for (const file of files) {
      try {
        const check = checkInput(file);
        if (!check.ok) { toast.error(check.reason === "unsupported_type" ? copy.evidence.unsupported : copy.evidence.tooLarge); continue; }
        if (room <= 0) { toast.error(copy.evidence.capReached); break; }
        const processed = await processImage(file);
        const dupe = [...metas.values()].some((m) => m.processed.sha256 === processed.sha256 && m.id.startsWith(`${p.inspectionId}:`)) || false;
        if (dupe) { toast.error(copy.evidence.duplicate); continue; }
        const id = `${p.inspectionId}:${processed.sha256.slice(0, 16)}`;
        metas.set(id, { id, name: file.name, processed, caption: caption.trim(), checklistItemKey: link, defectKey: defect, capturedAt: new Date(Math.min(file.lastModified || Date.now(), Date.now())).toISOString(), location: loc, evidenceId: null, error: null });
        room -= 1;
        queue.add(id, id);
      } catch { toast.error(copy.evidence.tooLarge); } finally { setBusyFiles((n) => n - 1); }
    }
  };

  const pending = items.filter((i) => i.state !== "done");
  const label = (i: UploadItem<string>) => metas.get(i.meta)?.name ?? "";
  const stateText = (i: UploadItem<string>) => i.state === "uploading" ? fill(copy.evidence.uploading, { pct: Math.round(i.progress * 100) }) : i.state === "queued" ? (i.error ? copy.errors.network : copy.evidence.queued) : i.state === "failed" ? copy.evidence.failed : copy.evidence.cancelled;
  const failMsg = (i: UploadItem<string>) => { const err = metas.get(i.meta)?.error; return err && (i.state === "failed" || i.state === "queued") ? ` · ${errorText(err, copy)}` : ""; };

  return (
    <section className="ins" aria-label={copy.evidence.title}>
      {p.editable ? (
        <div className="ins-drop">
          <p className="ins-muted">{copy.evidence.hint}</p>
          <div className="ctr-row">
            <Field label={copy.evidence.caption}>{(id) => <input id={id} className="ctr-input" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />}</Field>
            <Field label={copy.evidence.linkItem}>{(id) => <select id={id} className="ctr-input" value={link} onChange={(e) => setLink(e.target.value)}><option value="">{copy.evidence.noLink}</option>{p.items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>}</Field>
            <Field label={copy.evidence.linkDefect}>{(id) => <select id={id} className="ctr-input" value={defect} onChange={(e) => setDefect(e.target.value)}><option value="">{copy.evidence.noLink}</option>{p.defects.map((d) => <option key={d.key} value={d.key}>{d.title || d.key}</option>)}</select>}</Field>
          </div>
          <label className="ins-toggle"><input type="checkbox" checked={attach} onChange={(e) => { setAttach(e.target.checked); setGeoNote(null); }} />{copy.evidence.attachLocation}</label>
          <p className="ins-muted">{copy.evidence.locationHint} {geoNote}</p>
          <div className="ctr-row">
            <label className="ctr-btn is-primary" style={{ cursor: "pointer" }}><CameraIcon aria-hidden="true" />{copy.evidence.camera}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} /></label>
            <label className="ctr-btn" style={{ cursor: "pointer" }}><ImagePlusIcon aria-hidden="true" />{copy.evidence.gallery}<input type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} /></label>
            <span className="ins-muted">{active.length}/{MAX}{busyFiles ? ` · ${copy.evidence.processing}` : ""}</span>
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="ins-queue" aria-label={copy.evidence.queue} aria-live="polite">
          {pending.map((i) => (
            <div key={i.id} className="ins-q-row" data-state={i.state}>
              <span><strong>{label(i)}</strong> · {stateText(i)}{failMsg(i)}{i.state === "uploading" ? <span className="ins-progressbar"><i style={{ width: `${Math.round(i.progress * 100)}%` }} /></span> : null}</span>
              <span className="ctr-row">
                {i.state === "failed" || i.state === "cancelled" ? <button type="button" className="ctr-btn" onClick={() => queue.retry(i.id)}>{copy.evidence.retry}</button> : null}
                {i.state === "queued" || i.state === "uploading" ? <button type="button" className="ctr-btn is-ghost" onClick={() => queue.cancel(i.id)}>{copy.evidence.cancel}</button> : null}
                {i.state !== "uploading" ? <button type="button" className="ctr-btn is-ghost" onClick={() => { queue.remove(i.id); metas.delete(i.id); }} aria-label={copy.evidence.pendingRemove}><Trash2Icon aria-hidden="true" /></button> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {active.length === 0 ? <p className="ins-muted">{copy.evidence.empty}</p> : (
        <div className="ins-gallery" role="list">
          {active.map((e, idx) => (
            <div key={e.id} className="ins-thumb-wrap" role="listitem">
              <button type="button" className="ins-thumb" onClick={() => setOpen(idx)} aria-label={`${e.caption ?? copy.evidence.title} ${idx + 1}`}><AuthedImage evidenceId={e.id} alt={e.caption ?? ""} copy={copy} /></button>
              <span className="ins-badges">
                {e.checklistItemKey ? <span className="ins-badge">{(p.items.find((i) => i.key === e.checklistItemKey)?.label ?? e.checklistItemKey).slice(0, 18)}</span> : null}
                {e.defectKey ? <span className="ins-badge" data-t="site-away">{(p.defects.find((d) => d.key === e.defectKey)?.title ?? e.defectKey).slice(0, 18)}</span> : null}
                {e.sitePresence ? <span className="ins-badge" data-t={e.sitePresence.status === "ON_SITE" ? "site-on" : e.sitePresence.status === "AWAY" ? "site-away" : "site"}><MapPinIcon aria-hidden="true" />{e.sitePresence.status === "ON_SITE" ? copy.evidence.siteOn : e.sitePresence.status === "NEAR_SITE" ? copy.evidence.siteNear : copy.evidence.siteAway}</span> : null}
                <span className="ins-badge"><ShieldCheckIcon aria-hidden="true" />{copy.evidence.checksum}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <Lightbox index={open} list={active} onIndex={setOpen} copy={copy} locale={locale} editable={p.editable} items={p.items} defects={p.defects} onChanged={p.onChanged} />
    </section>
  );
}

function Lightbox({ index, list, onIndex, copy, locale, editable, items, defects, onChanged }: { index: number | null; list: EvidenceItem[]; onIndex: (i: number | null) => void; copy: Copy; locale: AuthLocale; editable: boolean; items: { key: string; label: string }[]; defects: { key: string; title: string }[]; onChanged: () => void }) {
  const current = index !== null ? list[index] : undefined;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const id = current?.id;
  useEffect(() => { queueMicrotask(() => { setScale(1); setOffset({ x: 0, y: 0 }); setCaption(current?.caption ?? ""); setLink(current?.checklistItemKey ?? ""); setReasonOpen(false); setReason(""); setError(null); }); }, [id, current?.caption, current?.checklistItemKey]);
  const go = (d: number) => { if (index === null || !list.length) return; onIndex((index + d + list.length) % list.length); };
  useEffect(() => {
    if (index === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); else if (e.key === "+") setScale((s) => Math.min(5, s + 0.5)); else if (e.key === "-") setScale((s) => Math.max(1, s - 0.5)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list.length]);
  const touch = useRef<number | null>(null);
  const save = async () => { if (!current) return; try { await patchEvidence(current.id, { caption: caption.trim() || null, checklistItemKey: link || null }); toast.success(copy.evidence.saveCaption); onChanged(); } catch (e) { setError(errorText(e, copy)); } };
  const remove = async () => { if (!current) return; try { await removeEvidence(current.id, reason.trim()); toast.success(copy.evidence.removed); onChanged(); onIndex(null); } catch (e) { setError(errorText(e, copy)); } };
  return (
    <Dialog open={index !== null} onOpenChange={(o) => { if (!o) onIndex(null); }}>
      <DialogContent className="sm:max-w-3xl ctr-dialog max-h-[92vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{copy.evidence.lightbox}{index !== null ? ` ${index + 1}/${list.length}` : ""}</DialogTitle><DialogDescription>{current?.caption ?? ""}</DialogDescription></DialogHeader>
        {current ? (
          <div className="ins-lightbox">
            <div className="ins-stage"
              onWheel={(e) => { e.preventDefault(); setScale((s) => Math.max(1, Math.min(5, s + (e.deltaY < 0 ? 0.25 : -0.25)))); }}
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; (e.target as Element).setPointerCapture?.(e.pointerId); touch.current = e.clientX; }}
              onPointerMove={(e) => { if (drag.current && scale > 1) setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }); }}
              onPointerUp={(e) => { if (scale === 1 && touch.current !== null && Math.abs(e.clientX - touch.current) > 60) go(e.clientX < touch.current ? 1 : -1); drag.current = null; touch.current = null; }}>
              <div style={{ width: "100%", height: "62vh", transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: "transform 120ms" }}><AuthedImage key={current.id} evidenceId={current.id} variant="full" alt={current.caption ?? ""} copy={copy} eager /></div>
            </div>
            <div className="ctr-row">
              <button type="button" className="ctr-btn" onClick={() => go(-1)} aria-label={copy.evidence.prevPhoto}><ChevronLeftIcon aria-hidden="true" /></button>
              <button type="button" className="ctr-btn" onClick={() => go(1)} aria-label={copy.evidence.nextPhoto}><ChevronRightIcon aria-hidden="true" /></button>
              <button type="button" className="ctr-btn" onClick={() => setScale((s) => Math.min(5, s + 0.5))} aria-label={copy.evidence.zoomIn}><ZoomInIcon aria-hidden="true" /></button>
              <button type="button" className="ctr-btn" onClick={() => setScale((s) => Math.max(1, s - 0.5))} aria-label={copy.evidence.zoomOut}><ZoomOutIcon aria-hidden="true" /></button>
              <button type="button" className="ctr-btn is-ghost" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>{copy.evidence.resetZoom}</button>
            </div>
            <dl className="ins-facts">
              <div><dt>{copy.evidence.captured}</dt><dd>{fmtDateTime(current.capturedAt, locale)}</dd></div>
              <div><dt>{copy.evidence.size}</dt><dd>{fmtBytes(current.sizeBytes)}{current.width ? ` · ${current.width}×${current.height}` : ""}</dd></div>
              <div><dt>{copy.evidence.hash}</dt><dd><code>{current.shaPrefix}…</code></dd></div>
              <div><dt>{copy.evidence.location}</dt><dd>{current.sitePresence ? <span className="ins-badge" data-t={current.sitePresence.status === "ON_SITE" ? "site-on" : current.sitePresence.status === "AWAY" ? "site-away" : "site"}><MapPinIcon aria-hidden="true" />{fill(copy.evidence.siteBadge, { m: current.sitePresence.distanceM })}</span> : copy.evidence.noLocation}</dd></div>
            </dl>
            {current.sitePresence ? <p className="ins-muted">{copy.evidence.siteTrust}</p> : null}
            {editable && current.uploadedByMe ? (
              <>
                <Field label={copy.evidence.caption}>{(fid) => <input id={fid} className="ctr-input" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />}</Field>
                <Field label={copy.evidence.linkItem}>{(fid) => <select id={fid} className="ctr-input" value={link} onChange={(e) => setLink(e.target.value)}><option value="">{copy.evidence.noLink}</option>{items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>}</Field>
                {defects.length ? <p className="ins-muted">{copy.evidence.linkDefect}: {defects.find((d) => d.key === current.defectKey)?.title ?? copy.evidence.noLink}</p> : null}
                {error ? <p className="ctr-error" role="alert">{error}</p> : null}
                <div className="ctr-row"><button type="button" className="ctr-btn is-primary" onClick={() => void save()}>{copy.evidence.saveCaption}</button><button type="button" className="ctr-btn is-danger" onClick={() => setReasonOpen(true)}><Trash2Icon aria-hidden="true" />{copy.evidence.remove}</button></div>
                {reasonOpen ? (
                  <div className="ins-panel"><strong>{copy.evidence.removeTitle}</strong>
                    <Field label={copy.evidence.removeReason} hint={copy.evidence.removeHint}>{(fid) => <input id={fid} className="ctr-input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                    <div className="ctr-row"><button type="button" className="ctr-btn" onClick={() => setReasonOpen(false)}>{copy.common.cancel}</button><button type="button" className="ctr-btn is-danger" disabled={reason.trim().length < 5} onClick={() => void remove()}>{copy.evidence.remove}</button></div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export const useEvidenceLabels = (template: { key: string }[], labels: Record<string, string>) => useMemo(() => template.map((t) => ({ key: t.key, label: labels[t.key] ?? t.key })), [template, labels]);
