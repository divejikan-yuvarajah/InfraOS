"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AuthLocale } from "@/lib/auth/types";
import { cancelInspection, fetchInspectors, fetchProjectInspections, reassignInspection, rescheduleInspection, scheduleInspection } from "@/lib/inspections/api";
import { colomboToIso, isoToColomboParts } from "@/lib/inspections/calendar-math";
import type { Copy } from "@/lib/inspections/messages";
import { INSPECTION_PRIORITIES, INSPECTION_TYPES, type InspectionPriority, type InspectionRow, type InspectionType } from "@/lib/inspections/types";
import { fill, fmtDateTime } from "@/lib/inspections/view";
import { fetchMilestones } from "@/lib/projects/milestones-api";
import { fetchProject, fetchProjects } from "@/lib/projects/api";
import type { ProjectSummary } from "@/lib/projects/types";

import { errorText, Field } from "./inspection-ui";

type Base = { open: boolean; onOpenChange: (o: boolean) => void; copy: Copy; locale: AuthLocale };
const reasonOk = (v: string) => v.trim().length >= 12;
const SCHEDULABLE = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"];

export function useRefreshInspections() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["inspections"] }), qc.invalidateQueries({ queryKey: ["finance"] }), qc.invalidateQueries({ queryKey: ["contractors"] })]);
}

const Shell = ({ open, onOpenChange, wide, children }: { open: boolean; onOpenChange: (o: boolean) => void; wide?: boolean; children: React.ReactNode }) => (
  <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} ctr-dialog max-h-[90vh] overflow-y-auto`}>{children}</DialogContent></Dialog>
);

/* ---------------------------------------------------------------- inspector picker with the Workload Lens */

export function InspectorPicker({ projectId, fromIso, duration, value, onChange, copy, locale, excludeId }: { projectId: string; fromIso: string | null; duration: number; value: string; onChange: (id: string) => void; copy: Copy; locale: AuthLocale; excludeId?: string }) {
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["inspections", "inspectors", projectId, fromIso, duration], queryFn: ({ signal }) => fetchInspectors({ projectId, from: fromIso ?? undefined, durationMinutes: duration }, signal), enabled: Boolean(projectId) });
  const list = (query.data?.inspectors ?? []).filter((i) => i.id !== excludeId && i.name.toLowerCase().includes(q.trim().toLowerCase()));
  const max = Math.max(1, ...(query.data?.inspectors ?? []).map((i) => i.upcoming14dCount));
  return (
    <div className="ins" role="group" aria-label={copy.schedule.inspector}>
      <p className="ins-muted">{copy.schedule.inspectorHint}</p>
      <Field label={copy.common.search}>{(id) => <input id={id} className="ctr-input" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
      {query.isPending ? <p role="status" className="ins-muted">{copy.common.loading}</p> : null}
      {query.isError ? <p className="ctr-error" role="alert">{errorText(query.error, copy)}</p> : null}
      {!query.isPending && !list.length ? <p className="ins-muted">{copy.schedule.noInspectors}</p> : null}
      <div className="ins-pick">
        {list.map((i) => (
          <button key={i.id} type="button" className="ins-insp" aria-pressed={value === i.id} data-conflict={i.conflicts.length > 0} onClick={() => onChange(i.id)}>
            <strong>{i.name}</strong>
            <span className="ins-muted">{i.agencyName ?? ""}</span>
            <span className="ins-muted">{fill(copy.schedule.open, { n: i.openCount })} · {fill(copy.schedule.next14, { n: i.upcoming14dCount })} · {i.nextInspectionAt ? fill(copy.schedule.nextAt, { when: fmtDateTime(i.nextInspectionAt, locale) }) : copy.schedule.free}</span>
            <span className="ins-load" aria-hidden="true"><i style={{ width: `${Math.round((i.upcoming14dCount / max) * 100)}%` }} /></span>
            {i.conflicts.map((c, n) => <span key={n} className="ins-warn"><AlertTriangleIcon aria-hidden="true" />{fill(copy.schedule.conflict, { no: c.inspectionNo ?? "", when: fmtDateTime(c.at, locale) })}</span>)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- schedule */

export type ScheduleInitial = { projectId?: string; date?: string; time?: string; type?: InspectionType; followUpOfId?: string; claimed?: number | null; assetId?: string };

export function ScheduleDialog({ open, onOpenChange, copy, locale, initial }: Base & { initial?: ScheduleInitial }) {
  const refresh = useRefreshInspections();
  const router = useRouter();
  const [openedAt] = useState(() => Date.now());
  const [step, setStep] = useState(1);
  const [project, setProject] = useState<{ id: string; code: string; title: string; status: string; progress: number | null } | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<InspectionType>("PROGRESS_VERIFICATION");
  const [purpose, setPurpose] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(120);
  const [priority, setPriority] = useState<InspectionPriority>("NORMAL");
  const [locationNote, setLocationNote] = useState("");
  const [useProjectPoint, setUseProjectPoint] = useState(true);
  const [milestoneIds, setMilestoneIds] = useState<string[]>([]);
  const [followUpOfId, setFollowUpOfId] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the dialog opens so an earlier cancelled draft never leaks into a new request.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setStep(1); setProject(null); setQ(""); setType(initial?.type ?? "PROGRESS_VERIFICATION"); setPurpose(""); setDate(initial?.date ?? ""); setTime(initial?.time ?? "09:00"); setDuration(120);
      setPriority("NORMAL"); setLocationNote(""); setUseProjectPoint(true); setMilestoneIds([]); setFollowUpOfId(initial?.followUpOfId ?? ""); setInspectorId(""); setError(null);
    });
  }, [open, initial?.date, initial?.time, initial?.type, initial?.followUpOfId]);

  const pre = useQuery({ queryKey: ["inspections", "project", initial?.projectId], queryFn: () => fetchProject(initial!.projectId!), enabled: open && Boolean(initial?.projectId) });
  useEffect(() => { if (open && pre.data && !project) queueMicrotask(() => setProject({ id: pre.data.id, code: pre.data.projectCode, title: pre.data.title, status: pre.data.status, progress: pre.data.physicalProgress ?? null })); }, [open, pre.data, project]);

  const projects = useQuery({ queryKey: ["inspections", "projects", q], queryFn: () => fetchProjects({ page: 1, limit: 8, q: q || undefined }), enabled: open && step === 1 && !initial?.projectId });
  const milestones = useQuery({ queryKey: ["inspections", "milestones", project?.id], queryFn: () => fetchMilestones(project!.id), enabled: open && step === 2 && Boolean(project) });
  const concluded = useQuery({ queryKey: ["inspections", "concluded", project?.id], queryFn: () => fetchProjectInspections(project!.id), enabled: open && step === 2 && type === "FOLLOW_UP" && Boolean(project) });

  const iso = colomboToIso(date, time);
  const ends = iso ? isoToColomboParts(new Date(new Date(iso).getTime() + duration * 60_000).toISOString()).time : null;
  const pastHour = iso ? new Date(iso).getTime() < openedAt - 3_600_000 : false;
  const stepOk = step === 1 ? Boolean(project) : step === 2 ? Boolean(iso) && !pastHour && duration >= 15 && duration <= 480 && (type !== "FOLLOW_UP" || Boolean(followUpOfId)) : Boolean(inspectorId);

  const m = useMutation({
    mutationFn: () => scheduleInspection({ projectId: project!.id, ...(type === "ASSET_CONDITION" && initial?.assetId ? { assetId: initial.assetId } : {}), inspectorId, inspectionDate: iso, durationMinutes: duration, inspectionType: type, purpose: purpose.trim() || undefined, priority, locationNote: locationNote.trim() || undefined, useProjectPoint, milestoneIds, ...(type === "FOLLOW_UP" ? { followUpOfId } : {}) }),
    onSuccess: (r) => { toast.success(fill(copy.schedule.success, { no: r.inspectionNo }), { action: { label: copy.schedule.view, onClick: () => router.push(`/inspections/${r.id}`) } }); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });

  return (
    <Shell open={open} onOpenChange={onOpenChange} wide>
      <DialogHeader><DialogTitle>{copy.schedule.title}</DialogTitle><DialogDescription>{copy.schedule.description} ({step}/3: {[copy.schedule.step1, copy.schedule.step2, copy.schedule.step3][step - 1]})</DialogDescription></DialogHeader>
      <div className="ins-progressbar" aria-hidden="true"><i style={{ width: `${(step / 3) * 100}%` }} /></div>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (step < 3) setStep(step + 1); else if (stepOk) m.mutate(); }}>
        {step === 1 ? (
          <>
            {project ? (
              <div className="ins-panel"><strong>{project.code} · {project.title}</strong><span className="ins-muted">{fill(copy.schedule.projectFacts, { status: project.status, pct: project.progress ?? "—" })}</span>
                {!initial?.projectId ? <button type="button" className="ctr-btn" onClick={() => setProject(null)}>{copy.common.clear}</button> : <span className="ins-muted">{copy.schedule.prefilled}</span>}</div>
            ) : (
              <>
                <Field label={copy.schedule.project} hint={copy.schedule.projectSearch}>{(id) => <input id={id} className="ctr-input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}</Field>
                {projects.isPending ? <p role="status" className="ins-muted">{copy.common.loading}</p> : null}
                <div className="ins-proj-list">
                  {(projects.data?.projects ?? []).filter((p: ProjectSummary) => SCHEDULABLE.includes(p.status)).map((p: ProjectSummary) => (
                    <button key={p.id} type="button" className="ins-proj" aria-pressed={false} onClick={() => setProject({ id: p.id, code: p.projectCode, title: p.title, status: p.status, progress: null })}><strong>{p.projectCode}</strong><span className="ins-muted">{p.title} · {p.status}</span></button>
                  ))}
                  {projects.data && !projects.data.projects.some((p: ProjectSummary) => SCHEDULABLE.includes(p.status)) ? <p className="ins-muted">{copy.schedule.projectNone}</p> : null}
                </div>
              </>
            )}
            {project?.progress !== undefined && project?.progress !== null ? <p className="ins-muted">{fill(copy.schedule.claimedNote, { pct: project.progress })}</p> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="ctr-row">
              <Field label={copy.schedule.type}>{(id) => <select id={id} className="ctr-input" value={type} onChange={(e) => setType(e.target.value as InspectionType)}>{INSPECTION_TYPES.filter((t) => t !== "ASSET_CONDITION" || Boolean(initial?.assetId)).map((t) => <option key={t} value={t}>{copy.type[t]}</option>)}</select>}</Field>
              <Field label={copy.schedule.priority}>{(id) => <select id={id} className="ctr-input" value={priority} onChange={(e) => setPriority(e.target.value as InspectionPriority)}>{INSPECTION_PRIORITIES.map((t) => <option key={t} value={t}>{copy.priority[t]}</option>)}</select>}</Field>
            </div>
            <div className="ctr-row">
              <Field label={copy.schedule.date} error={pastHour ? copy.schedule.dateInPast : null}>{(id) => <input id={id} type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
              <Field label={copy.schedule.time}>{(id) => <input id={id} type="time" className="ctr-input" value={time} onChange={(e) => setTime(e.target.value)} required />}</Field>
              <Field label={copy.schedule.duration} hint={ends ? fill(copy.schedule.ends, { time: ends }) : undefined}>{(id) => <input id={id} type="number" min={15} max={480} step={15} className="ctr-input" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} />}</Field>
            </div>
            <Field label={copy.schedule.purpose}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} />}</Field>
            <Field label={copy.schedule.locationNote}>{(id) => <input id={id} className="ctr-input" maxLength={300} value={locationNote} onChange={(e) => setLocationNote(e.target.value)} />}</Field>
            <label className="ins-toggle"><input type="checkbox" checked={useProjectPoint} onChange={(e) => setUseProjectPoint(e.target.checked)} />{copy.schedule.useProjectPoint}</label>
            {type === "FOLLOW_UP" ? (
              <Field label={copy.schedule.followUpOf}>{(id) => (
                <select id={id} className="ctr-input" value={followUpOfId} onChange={(e) => setFollowUpOfId(e.target.value)} required>
                  <option value="">{copy.schedule.followUpPick}</option>
                  {(concluded.data?.rows ?? []).filter((r) => ["VERIFIED", "REJECTED", "CANCELLED"].includes(r.status)).map((r) => <option key={r.id} value={r.id}>{r.inspectionNo} · {copy.status[r.status]}</option>)}
                </select>
              )}</Field>
            ) : null}
            {(milestones.data?.milestones.length ?? 0) > 0 ? (
              <fieldset className="ctr-field"><legend className="ctr-label">{copy.schedule.milestones}</legend>
                {milestones.data!.milestones.slice(0, 20).map((ms) => (
                  <label key={ms.id} className="ins-toggle"><input type="checkbox" checked={milestoneIds.includes(ms.id)} disabled={!milestoneIds.includes(ms.id) && milestoneIds.length >= 10} onChange={(e) => setMilestoneIds(e.target.checked ? [...milestoneIds, ms.id] : milestoneIds.filter((x) => x !== ms.id))} />{ms.title}</label>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}

        {step === 3 && project ? (
          <>
            <InspectorPicker projectId={project.id} fromIso={iso} duration={duration} value={inspectorId} onChange={setInspectorId} copy={copy} locale={locale} />
            <p className="ins-muted">{copy.schedule.conflictWarn}</p>
          </>
        ) : null}

        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ctr-btn" onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}>{step === 1 ? copy.common.cancel : copy.common.back}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={!stepOk || m.isPending}>{step < 3 ? copy.common.next : m.isPending ? copy.schedule.saving : copy.schedule.submit}</button>
        </div>
      </form>
    </Shell>
  );
}
/* ---------------------------------------------------------------- reschedule / reassign / cancel */

export function RescheduleDialog({ row, onClose, copy, locale }: { row: InspectionRow | null; onClose: () => void; copy: Copy; locale: AuthLocale }) {
  const refresh = useRefreshInspections();
  const [date, setDate] = useState(""); const [time, setTime] = useState("09:00"); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (row) queueMicrotask(() => { const p = isoToColomboParts(row.inspectionDate); setDate(p.date); setTime(p.time); setReason(""); setError(null); }); }, [row]);
  const iso = colomboToIso(date, time);
  const m = useMutation({ mutationFn: () => rescheduleInspection(row!.id, { inspectionDate: iso, reason: reason.trim() }), onSuccess: () => { toast.success(copy.dialogs.reschedule.success); void refresh(); onClose(); }, onError: (e) => setError(errorText(e, copy)) });
  return (
    <Shell open={row !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogHeader><DialogTitle>{copy.dialogs.reschedule.title}</DialogTitle><DialogDescription>{fill(copy.dialogs.reschedule.description, { no: row?.inspectionNo ?? "" })}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (iso && reasonOk(reason)) m.mutate(); }}>
        <p className="ins-muted">{row ? fmtDateTime(row.inspectionDate, locale) : ""}</p>
        <div className="ctr-row"><Field label={copy.dialogs.reschedule.newTime}>{(id) => <input id={id} type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field><Field label=" ">{(id) => <input id={id} type="time" className="ctr-input" value={time} onChange={(e) => setTime(e.target.value)} required aria-label={copy.schedule.time} />}</Field></div>
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint} error={reason && !reasonOk(reason) ? copy.common.reasonHint : null}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button><button type="submit" className="ctr-btn is-primary" disabled={!iso || !reasonOk(reason) || m.isPending}>{m.isPending ? copy.common.working : copy.dialogs.reschedule.confirm}</button></div>
      </form>
    </Shell>
  );
}

export function ReassignDialog({ row, onClose, copy, locale }: { row: InspectionRow | null; onClose: () => void; copy: Copy; locale: AuthLocale }) {
  const refresh = useRefreshInspections();
  const [inspectorId, setInspectorId] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (row) queueMicrotask(() => { setInspectorId(""); setReason(""); setError(null); }); }, [row]);
  const m = useMutation({ mutationFn: () => reassignInspection(row!.id, { inspectorId, reason: reason.trim() }), onSuccess: () => { toast.success(copy.dialogs.reassign.success); void refresh(); onClose(); }, onError: (e) => setError(errorText(e, copy)) });
  return (
    <Shell open={row !== null} onOpenChange={(o) => { if (!o) onClose(); }} wide>
      <DialogHeader><DialogTitle>{copy.dialogs.reassign.title}</DialogTitle><DialogDescription>{fill(copy.dialogs.reassign.description, { no: row?.inspectionNo ?? "" })}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (inspectorId && reasonOk(reason)) m.mutate(); }}>
        {row ? (
          <>
            {row.status === "IN_PROGRESS" ? <p className="ins-warn">{copy.dialogs.reassign.impactDraft}</p> : null}
            {row.evidenceCount > 0 ? <p className="ins-muted">{fill(copy.dialogs.reassign.impactEvidence, { n: row.evidenceCount })}</p> : null}
            <InspectorPicker projectId={row.projectId} fromIso={row.inspectionDate} duration={row.durationMinutes} value={inspectorId} onChange={setInspectorId} copy={copy} locale={locale} excludeId={row.inspectorId} />
          </>
        ) : null}
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint} error={reason && !reasonOk(reason) ? copy.common.reasonHint : null}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button><button type="submit" className="ctr-btn is-primary" disabled={!inspectorId || !reasonOk(reason) || m.isPending}>{m.isPending ? copy.common.working : copy.dialogs.reassign.confirm}</button></div>
      </form>
    </Shell>
  );
}

export function CancelDialog({ row, onClose, copy }: { row: InspectionRow | null; onClose: () => void; copy: Copy }) {
  const refresh = useRefreshInspections();
  const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (row) queueMicrotask(() => { setReason(""); setError(null); }); }, [row]);
  const m = useMutation({ mutationFn: () => cancelInspection(row!.id, { reason: reason.trim() }), onSuccess: () => { toast.success(copy.dialogs.cancel.success); void refresh(); onClose(); }, onError: (e) => setError(errorText(e, copy)) });
  return (
    <Shell open={row !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogHeader><DialogTitle>{copy.dialogs.cancel.title}</DialogTitle><DialogDescription>{fill(copy.dialogs.cancel.description, { no: row?.inspectionNo ?? "" })}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (reasonOk(reason)) m.mutate(); }}>
        {row?.status === "IN_PROGRESS" ? <p className="ins-warn">{copy.dialogs.cancel.impactDraft}</p> : null}
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint} error={reason && !reasonOk(reason) ? copy.common.reasonHint : null}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={onClose}>{copy.dialogs.cancel.keep}</button><button type="submit" className="ctr-btn is-danger" disabled={!reasonOk(reason) || m.isPending}>{m.isPending ? copy.common.working : copy.dialogs.cancel.confirm}</button></div>
      </form>
    </Shell>
  );
}

/** Convenience link used by toasts and cards. */
export const InspectionLink = ({ id, children }: { id: string; children: React.ReactNode }) => <Link className="ins-link" href={`/inspections/${id}`}>{children}</Link>;
