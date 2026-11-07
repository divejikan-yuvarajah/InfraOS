"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CameraIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createMaintEvidence, fetchMaintBlob, fetchMaintDetail, maintAction, removeMaintEvidence, toggleTask, uploadMaintFile } from "@/lib/assets/api";
import type { Copy } from "@/lib/assets/messages";
import { useAssetKeys } from "@/lib/assets/session";
import { MAINTENANCE_STATUSES, type MaintDetail, type MaintEvidence, type MaintRow } from "@/lib/assets/types";
import { fill, fmtDate, MAINT_STEPS, money, reasonOk } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { checkInput, processImage } from "@/lib/inspections/image-pipeline";
import { addDays, colomboToIso, dayKey, monthGrid, startOfWeek, weekCells, type CalendarView } from "@/lib/inspections/calendar-math";
import { useAuthedImage } from "@/lib/inspections/use-authed-image";
import { fmtDayLong, fmtMonth, weekdayShort } from "@/lib/inspections/view";

import { useRefreshAssets } from "./asset-dialogs";
import { Chip, EmptyState, errorText, ErrorState, Field, MaintStatusChip, PriorityChip, Shell, Skeletons } from "./asset-ui";

type Common = { copy: Copy; locale: AuthLocale };

/* ------------------------------------------------------------------ stepper */

export function MaintStepper({ status, copy }: { status: MaintDetail["status"]; copy: Copy }) {
  const idx = MAINT_STEPS.indexOf(status as (typeof MAINT_STEPS)[number]);
  const names: Record<string, string> = { REQUESTED: copy.maint.stepper.requested, PLANNED: copy.maint.stepper.planned, SCHEDULED: copy.maint.stepper.scheduled, IN_PROGRESS: copy.maint.stepper.inProgress, COMPLETED: copy.maint.stepper.completed };
  if (status === "REJECTED" || status === "CANCELLED") return <ol className="ast-mstep" aria-label={copy.mstatus[status]}><li data-s="stopped">{status === "REJECTED" ? copy.maint.stepper.rejected : copy.maint.stepper.cancelled}</li></ol>;
  return <ol className="ast-mstep">{MAINT_STEPS.map((s, i) => <li key={s} data-s={i < idx ? "done" : i === idx ? "current" : ""} aria-current={i === idx ? "step" : undefined}>{names[s]}</li>)}</ol>;
}

/* ------------------------------------------------------------------ calendar */

export function MaintCalendar({ rows, view, anchor, copy, locale, loading, truncated, canRequest, onView, onAnchor, onOpen, onNew }: Common & {
  rows: MaintRow[]; view: CalendarView; anchor: Date; loading: boolean; truncated: boolean; canRequest: boolean; onView: (v: CalendarView) => void; onAnchor: (d: Date) => void; onOpen: (id: string) => void; onNew: (day: Date) => void;
}) {
  const c = copy.maint.calendar;
  const byDay = new Map<string, MaintRow[]>();
  for (const r of [...rows].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))) { const k = dayKey(new Date(r.scheduledDate)); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const cells = view === "month" ? monthGrid(anchor) : view === "week" ? weekCells(anchor) : [];
  const step = (dir: -1 | 1) => onAnchor(view === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 15) : addDays(anchor, dir * (view === "week" ? 7 : 30)));
  const title = view === "month" ? fmtMonth(anchor, locale) : view === "week" ? `${fmtDayLong(startOfWeek(anchor), locale)} +7` : fmtDayLong(anchor, locale);
  const chip = (r: MaintRow) => (
    <button key={r.id} type="button" className="ins-evt" data-overdue={r.overdue} onClick={() => onOpen(r.id)} aria-label={`${r.maintenanceNo ?? ""} ${r.title ?? ""} ${copy.mstatus[r.status]}`}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
    </button>
  );
  return (
    <section className="ins-panel" aria-busy={loading} aria-label={copy.maint.tabs.calendar}>
      <div className="ins-bar">
        <div className="ctr-row"><button type="button" className="ctr-btn" onClick={() => step(-1)}>{c.prev}</button><button type="button" className="ctr-btn" onClick={() => onAnchor(new Date())}>{c.today}</button><button type="button" className="ctr-btn" onClick={() => step(1)}>{c.next}</button><strong aria-live="polite">{title}</strong></div>
        <div className="ctr-seg" role="group" aria-label={copy.maint.tabs.calendar}>{(["month", "week", "agenda"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)}>{c[v]}</button>)}</div>
      </div>
      {truncated ? <p className="ins-muted" role="status">{copy.common.more}</p> : null}
      {view === "agenda" ? (
        [...byDay.entries()].length === 0 ? <p className="ins-muted">{c.noItems}</p> : (
          <div style={{ display: "grid", gap: "0.6rem" }}>{[...byDay.entries()].map(([k, list]) => (
            <div key={k}><strong>{fmtDayLong(new Date(`${k}T00:00:00+05:30`), locale)}</strong>
              {list.map((r) => <button key={r.id} type="button" className="ins-agenda-row" style={{ gridTemplateColumns: "1fr auto", width: "100%", textAlign: "left" }} onClick={() => onOpen(r.id)}><span><strong>{r.title}</strong><br /><span className="ins-muted">{r.assetName ?? ""} · {copy.mtype[r.maintenanceType]}</span></span><MaintStatusChip status={r.status} overdue={r.overdue} copy={copy} /></button>)}
            </div>
          ))}</div>
        )
      ) : (
        <div role="grid" aria-label={title} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px" }}>
          {weekdayShort(locale).map((d) => <div key={d} role="columnheader" className="ins-muted" style={{ textAlign: "center", fontWeight: 700 }}>{d}</div>)}
          {cells.map((cell) => {
            const list = byDay.get(cell.key) ?? [];
            return (
              <div key={cell.key} role="gridcell" className="ins-day" data-today={cell.isToday} data-out={view === "month" && !cell.inMonth} style={{ minHeight: view === "week" ? "9rem" : "5.5rem", padding: "0.25rem", border: "1px solid var(--infra-border)", background: "#fff", display: "grid", alignContent: "start", gap: "2px" }}>
                <div className="ctr-row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontWeight: cell.isToday ? 800 : 500, opacity: view === "month" && !cell.inMonth ? 0.45 : 1 }}>{Number(cell.key.slice(8))}</span>
                  {canRequest ? <button type="button" className="ctr-btn is-ghost" style={{ minHeight: "1.5rem", padding: "0 0.3rem" }} aria-label={fill(c.newOnDay, { day: cell.key })} onClick={() => onNew(cell.start)}>+</button> : null}
                </div>
                {list.slice(0, view === "week" ? 8 : 2).map(chip)}
                {list.length > (view === "week" ? 8 : 2) ? <span className="ins-muted">{fill(c.more, { n: list.length - (view === "week" ? 8 : 2) })}</span> : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="ins-muted">{c.timezone}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ evidence */

function Thumb({ ev, copy, onRemove }: { ev: MaintEvidence; copy: Copy; onRemove?: () => void }) {
  const [node, setNode] = useState<Element | null>(null);
  const img = useAuthedImage(ev.id, ev.hasThumb ? "thumb" : "full", false, node, fetchMaintBlob);
  return (
    <figure className="ast-thumb" style={{ margin: 0 }}>
      <span className="box" ref={setNode}>{img.state === "ready" && img.url ? <span role="img" aria-label={ev.caption ?? copy.maint.drawer.evidence} style={{ display: "block", width: "100%", height: "100%", backgroundImage: `url(${img.url})`, backgroundSize: "cover", backgroundPosition: "center" }} /> : img.state === "error" ? <button type="button" className="ctr-btn is-ghost" onClick={img.retry}>{copy.common.retry}</button> : <span className="ins-skel" style={{ width: "100%", height: "100%" }} />}</span>
      {onRemove ? <button type="button" className="ctr-btn is-ghost" onClick={onRemove} aria-label={copy.maint.evidence.remove}><Trash2Icon aria-hidden="true" />{copy.maint.evidence.remove}</button> : null}
    </figure>
  );
}

function EvidenceSection({ detail, copy }: { detail: MaintDetail; copy: Copy }) {
  const refresh = useRefreshAssets();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; pct: number }[]>([]);
  const [removing, setRemoving] = useState<MaintEvidence | null>(null);
  const [reason, setReason] = useState("");
  const e = copy.maint.evidence;
  const active = detail.evidence.filter((x) => x.status === "ACTIVE");
  const canAdd = detail.can.manageEvidence && detail.status === "IN_PROGRESS";

  async function addFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (active.length + busy.length >= 20) { toast.error(e.cap); break; }
      const check = checkInput(file);
      if (!check.ok) { toast.error(e.unsupported); continue; }
      setBusy((b) => [...b, { name: file.name, pct: 0 }]);
      try {
        const p = await processImage(file);
        const created = await createMaintEvidence(detail.id, { capturedAt: new Date().toISOString(), sha256: p.sha256, mimeType: p.mimeType, width: p.width, height: p.height, sizeBytes: p.full.size, thumb: { sizeBytes: p.thumb.size, sha256: p.thumbSha256 } });
        await uploadMaintFile(created.evidenceId, "thumb", p.thumb, () => undefined);
        await uploadMaintFile(created.evidenceId, "full", p.full, (f) => setBusy((b) => b.map((x) => (x.name === file.name ? { ...x, pct: Math.round(f * 100) } : x))));
        void refresh();
      } catch (err) { toast.error(errorText(err, copy)); }
      setBusy((b) => b.filter((x) => x.name !== file.name));
    }
    if (input.current) input.current.value = "";
  }
  const remove = useMutation({ mutationFn: () => removeMaintEvidence(removing!.id, reason.trim()), onSuccess: () => { toast.success(e.removed); setRemoving(null); setReason(""); void refresh(); }, onError: (err) => toast.error(errorText(err, copy)) });

  return (
    <section style={{ display: "grid", gap: "0.5rem" }}>
      <h3 className="ins-h">{copy.maint.drawer.evidence}</h3>
      {active.length === 0 && busy.length === 0 ? <p className="ins-muted">{copy.maint.drawer.noEvidence}</p> : null}
      <div className="ast-thumbs">
        {active.map((ev) => <Thumb key={ev.id} ev={ev} copy={copy} {...(canAdd && ev.uploadedByMe ? { onRemove: () => setRemoving(ev) } : {})} />)}
        {busy.map((b) => <div key={b.name} className="ast-thumb"><span className="box"><span className="ins-muted">{fill(e.uploading, { pct: b.pct })}</span></span></div>)}
      </div>
      {canAdd ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(ev) => void addFiles(ev.target.files)} />
          <button type="button" className="ctr-btn" onClick={() => input.current?.click()}><CameraIcon aria-hidden="true" />{e.add}</button>
          <p className="ins-muted">{e.hint}</p>
        </>
      ) : detail.can.manageEvidence ? <p className="ins-muted">{e.onlyInProgress}</p> : null}
      <Shell open={removing !== null} onOpenChange={(o) => { if (!o) { setRemoving(null); setReason(""); } }} title={e.remove}>
        <form className="ctr-dialog" onSubmit={(ev) => { ev.preventDefault(); if (reason.trim().length >= 5) remove.mutate(); }}>
          <Field label={e.removeReason} hint={e.removeHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={300} value={reason} onChange={(x) => setReason(x.target.value)} required />}</Field>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={() => setRemoving(null)}>{copy.common.cancel}</button><button type="submit" className="ctr-btn is-danger" disabled={reason.trim().length < 5 || remove.isPending}>{e.remove}</button></div>
        </form>
      </Shell>
    </section>
  );
}

/* ------------------------------------------------------------------ action dialogs */

export type Act = "approve" | "reject" | "schedule" | "start" | "complete" | "cancel";

export function ActionDialog({ act, detail, copy, onClose, onDone }: { act: Act; detail: MaintDetail; copy: Copy; onClose: () => void; onDone: (r: { assetId: string | null; completed: boolean }) => void }) {
  const refresh = useRefreshAssets();
  const d = copy.maint.dialogs;
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [date, setDate] = useState(act === "schedule" ? detail.scheduledDate.slice(0, 10) : "");
  const [team, setTeam] = useState(detail.assignedTeam ?? "");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<"RESOLVED" | "PARTIAL" | "NOT_RESOLVED">("RESOLVED");
  const [cost, setCost] = useState("");
  const [tasks, setTasks] = useState(detail.tasks.map((t) => ({ key: t.key, title: t.title, done: t.done, skippedNote: t.skippedNote ?? "" })));
  const [error, setError] = useState<string | null>(null);
  const today = dayKey(new Date());

  const needsAck = act === "approve" && detail.can.emergencySelfApproval;
  const costOk = cost.trim() === "" || /^\d{1,12}(\.\d{1,2})?$/.test(cost.trim());
  const tasksOk = tasks.every((t) => t.done || t.skippedNote.trim().length >= 3);
  const ok = act === "approve" ? (note.trim() === "" || reasonOk(note)) && (!needsAck || ack)
    : act === "reject" || act === "cancel" ? reasonOk(note)
    : act === "schedule" ? Boolean(date)
    : act === "start" ? true
    : Boolean(date) && date <= today && notes.trim().length >= 20 && costOk && tasksOk;

  const m = useMutation({
    mutationFn: () => {
      switch (act) {
        case "approve": return maintAction(detail.id, "approve", { ...(note.trim() ? { note: note.trim() } : {}), ...(needsAck && ack ? { acknowledgeEmergency: true } : {}) });
        case "reject": return maintAction(detail.id, "reject", { note: note.trim() });
        case "cancel": return maintAction(detail.id, "cancel", { reason: note.trim() });
        case "schedule": return maintAction(detail.id, "schedule", { scheduledDate: colomboToIso(date, "09:00"), ...(team.trim() ? { assignedTeam: team.trim() } : {}) });
        case "start": return maintAction(detail.id, "start", {});
        default: return maintAction(detail.id, "complete", { completedDate: colomboToIso(date, "12:00"), completionNotes: notes.trim(), outcome, ...(cost.trim() ? { cost: cost.trim() } : {}), tasks: tasks.map((t) => ({ key: t.key, done: t.done, ...(!t.done ? { skippedNote: t.skippedNote.trim() } : {}) })) });
      }
    },
    onSuccess: () => {
      toast.success({ approve: d.approved, reject: d.rejected, cancel: d.cancelled, schedule: d.scheduled, start: d.started, complete: d.completed }[act]);
      void refresh();
      onDone({ assetId: detail.asset?.id ?? null, completed: act === "complete" });
    },
    onError: (e) => setError(errorText(e, copy)),
  });
  const title = { approve: d.approveTitle, reject: d.rejectTitle, cancel: d.cancelTitle, schedule: d.scheduleTitle, start: d.startTitle, complete: d.completeTitle }[act];
  const body = { approve: d.approveBody, reject: d.rejectBody, cancel: d.cancelBody, start: d.startBody, schedule: undefined, complete: undefined }[act];
  const label = { approve: copy.maint.actions.approve, reject: copy.maint.actions.reject, cancel: copy.maint.actions.cancel, schedule: copy.maint.actions.schedule, start: copy.maint.actions.start, complete: copy.maint.actions.complete }[act];

  return (
    <Shell open onOpenChange={(o) => { if (!o) onClose(); }} title={title} {...(body ? { description: body } : {})} wide={act === "complete"}>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        {act === "approve" || act === "reject" || act === "cancel" ? <Field label={act === "cancel" ? copy.common.reasonLabel : d.note} hint={act === "approve" ? undefined : copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} required={act !== "approve"} />}</Field> : null}
        {needsAck ? <label className="ins-toggle"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{copy.maint.actions.emergency}</label> : null}
        {act === "schedule" ? (
          <div className="ctr-row">
            <Field label={d.scheduledDate}>{(id) => <input id={id} type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
            <Field label={d.team}>{(id) => <input id={id} className="ctr-input" maxLength={120} value={team} onChange={(e) => setTeam(e.target.value)} />}</Field>
          </div>
        ) : null}
        {act === "complete" ? (
          <>
            <div className="ctr-row">
              <Field label={d.completedDate} error={date > today ? copy.errors.completedDate : null}>{(id) => <input id={id} type="date" className="ctr-input" max={today} value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
              <Field label={d.outcome}>{(id) => <select id={id} className="ctr-input" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>{(["RESOLVED", "PARTIAL", "NOT_RESOLVED"] as const).map((o) => <option key={o} value={o}>{copy.maint.outcome[o]}</option>)}</select>}</Field>
              <Field label={d.actualCost} error={costOk ? null : copy.errors.validation}>{(id) => <input id={id} inputMode="decimal" className="ctr-input" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
            </div>
            <Field label={d.notes} hint={d.notesHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} required />}</Field>
            {tasks.length ? (
              <fieldset className="ctr-field"><legend className="ctr-label">{d.taskCheck}</legend>
                {tasks.map((t, i) => (
                  <div key={t.key} style={{ display: "grid", gap: "0.25rem" }}>
                    <label className="ins-toggle"><input type="checkbox" checked={t.done} onChange={(e) => setTasks(tasks.map((x, k) => (k === i ? { ...x, done: e.target.checked } : x)))} />{t.title}</label>
                    {!t.done ? <input aria-label={`${d.skipNote}: ${t.title}`} placeholder={d.skipNote} className="ctr-input" maxLength={300} value={t.skippedNote} onChange={(e) => setTasks(tasks.map((x, k) => (k === i ? { ...x, skippedNote: e.target.value } : x)))} /> : null}
                  </div>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
          <button type="submit" className={`ctr-btn ${act === "reject" || act === "cancel" ? "is-danger" : "is-primary"}`} disabled={!ok || m.isPending}>{m.isPending ? copy.common.working : label}</button>
        </div>
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ drawer */

export function MaintDrawer({ id, copy, locale, onClose, onAct, onEdit }: Common & { id: string; onClose: () => void; onAct: (a: Act, d: MaintDetail) => void; onEdit?: (d: MaintDetail) => void }) {
  const { key } = useAssetKeys();
  const refresh = useRefreshAssets();
  const q = useQuery({ queryKey: key("maint", id), queryFn: ({ signal }) => fetchMaintDetail(id, signal) });
  const t = useMutation({ mutationFn: (p: { key: string; done: boolean }) => toggleTask(id, p.key, { done: p.done }), onSuccess: () => void refresh(), onError: (e) => toast.error(errorText(e, copy)) });
  const dr = copy.maint.drawer;
  const m = q.data;
  const act = (a: Act, label: string, primary?: boolean, danger?: boolean) => <button key={a} type="button" className={`ctr-btn${primary ? " is-primary" : ""}${danger ? " is-danger" : ""}`} onClick={() => onAct(a, m!)}>{label}</button>;
  return (
    <>
      <div className="ast-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ast-sheet ins" role="dialog" aria-modal="true" aria-label={m?.title ?? copy.maint.title}>
        <div className="ctr-row" style={{ justifyContent: "space-between" }}><strong>{m?.maintenanceNo ?? copy.maint.title}</strong><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.close}</button></div>
        {q.isPending ? <Skeletons n={3} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : m ? (
          <>
            <h2 className="ins-h" style={{ fontSize: "1.2rem" }}>{m.title}</h2>
            <div className="ctr-row"><MaintStatusChip status={m.status} overdue={m.overdue} copy={copy} /><PriorityChip priority={m.priority} copy={copy} /><Chip tone="neutral">{copy.mtype[m.maintenanceType]}</Chip></div>
            <MaintStepper status={m.status} copy={copy} />
            {m.repeatFailures.flagged ? <div className="ast-flag" data-sev="MEDIUM">{fill(copy.maintPanel.repeat, { n: m.repeatFailures.count })}</div> : null}
            {m.asset ? <p><span className="ins-muted">{dr.asset}: </span><Link className="ins-link" href={`/assets/${m.asset.id}`}>{m.asset.assetNo} · {m.asset.name}</Link></p> : null}
            {m.description ? <p>{m.description}</p> : null}
            <dl className="ast-kv">
              <div><dt>{copy.common.date}</dt><dd>{fmtDate(m.completedDate ?? m.scheduledDate, locale)}</dd></div>
              <div><dt>{dr.team}</dt><dd>{m.assignedTeam ?? "—"}</dd></div>
              <div><dt>{dr.contractor}</dt><dd>{m.contractor?.name ?? "—"}</dd></div>
              <div><dt>{dr.agency}</dt><dd>{m.responsibleAgency?.name ?? "—"}</dd></div>
              <div><dt>{dr.costs}: {dr.estimated}</dt><dd>{money(m.estimatedCostMinor, locale)}</dd></div>
              <div><dt>{dr.costs}: {dr.actual}</dt><dd>{money(m.actualCostMinor, locale)}</dd></div>
            </dl>
            <p className="ins-muted">{m.requestedAt && m.requestedByName ? fill(dr.requestedBy, { date: fmtDate(m.requestedAt, locale), name: m.requestedByName }) : ""}{m.decidedByName ? ` · ${fill(dr.decidedBy, { name: m.decidedByName })}` : ""}{m.recurrenceDays ? ` · ${fill(dr.recurrence, { n: m.recurrenceDays })}` : ""}</p>
            {m.decisionNote ? <p>{m.decisionNote}</p> : null}
            {m.emergencyAcknowledged ? <p className="ins-muted">{dr.emergency}</p> : null}
            <section><h3 className="ins-h">{dr.tasks}</h3>
              {m.tasks.length === 0 ? <p className="ins-muted">{dr.noTasks}</p> : <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.3rem" }}>{m.tasks.map((x) => (
                <li key={x.key}><label className="ins-toggle"><input type="checkbox" checked={x.done} disabled={m.status !== "IN_PROGRESS" || !m.can.complete || t.isPending} onChange={(e) => t.mutate({ key: x.key, done: e.target.checked })} />{x.title}</label>{x.skippedNote ? <span className="ins-muted"> {fill(dr.skipped, { note: x.skippedNote })}</span> : null}</li>
              ))}</ul>}
            </section>
            {m.status === "COMPLETED" ? <section><h3 className="ins-h">{dr.notes}</h3><p>{m.completionNotes}</p>{m.outcome ? <p className="ins-muted">{dr.outcome}: {copy.maint.outcome[m.outcome as keyof typeof copy.maint.outcome] ?? m.outcome}</p> : null}</section> : null}
            {m.status === "CANCELLED" && m.cancelReason ? <p>{m.cancelReason}</p> : null}
            <EvidenceSection detail={m} copy={copy} />
            {m.can.approveBlockedReason === "own_request" ? <p className="ins-muted" role="note">{copy.maint.actions.blockedOwn}</p> : null}
            <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
              {m.can.edit && onEdit ? <button type="button" className="ctr-btn" onClick={() => onEdit(m)}>{copy.maint.actions.edit}</button> : null}
              {m.can.cancel ? act("cancel", copy.maint.actions.cancel, false, true) : null}
              {m.can.reject ? act("reject", copy.maint.actions.reject, false, true) : null}
              {m.can.approve ? act("approve", copy.maint.actions.approve, true) : null}
              {m.can.schedule ? act("schedule", copy.maint.actions.schedule, true) : null}
              {m.can.start ? act("start", copy.maint.actions.start, true) : null}
              {m.can.complete ? act("complete", copy.maint.actions.complete, true) : null}
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}

export const STATUS_OPTIONS = MAINTENANCE_STATUSES;
export { EmptyState };
