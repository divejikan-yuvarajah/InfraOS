"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CheckCircle2Icon, SendIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { getAdvisorCopy } from "@/lib/roadsync/advisor-copy";
import { clearHandoff, type Handoff } from "@/lib/roadsync/advisor";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { DAY, PROPOSAL_TYPES, TRAFFIC_MEASURES, type Impact, type ProposalType, type Suggestions } from "@/lib/roadsync/coordination";
import { createRequest, fetchSuggestions, previewImpact } from "@/lib/roadsync/coordination-api";
import { getCoordCopy, type CoordCopy } from "@/lib/roadsync/coordination-copy";
import type { Dossier } from "@/lib/roadsync/conflict-records";
import { fetchDossier } from "@/lib/roadsync/conflict-records-api";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { ScoreRing } from "./risk-visuals";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

// ---------- proposal editor (shared by the composer, counter and revise) ----------

export type FormState = {
  targetRequestId: string; newStart: string; newEnd: string; changeDuration: boolean; workingHours: "day" | "night" | "24h";
  leadAgencyId: string; proposedStart: string; proposedEnd: string; scopeNote: string; firstRequestId: string; minGapDays: number;
  measures: string[]; notes: string; questions: string; mode: "onsite" | "online"; locationText: string; slots: string[];
};
export const EMPTY_FORM: FormState = { targetRequestId: "", newStart: "", newEnd: "", changeDuration: false, workingHours: "night", leadAgencyId: "", proposedStart: "", proposedEnd: "", scopeNote: "", firstRequestId: "", minGapDays: 14, measures: [], notes: "", questions: "", mode: "onsite", locationText: "", slots: [""] };

/** Maps an Advisor draft onto the composer form. Dates are day-only here; the composer keeps each request's time of day. */
function prefillForm(d: Handoff["drafts"][number] | undefined): Partial<FormState> {
  const p = d?.proposal;
  if (!d || !p) return {};
  if (d.type === "schedule_shift") return { targetRequestId: String(p.targetRequestId ?? ""), newStart: String(p.newStart ?? "").slice(0, 10) };
  if (d.type === "working_hours") return { targetRequestId: String(p.targetRequestId ?? ""), workingHours: (p.workingHours as FormState["workingHours"]) ?? "night" };
  if (d.type === "sequence_order") return { firstRequestId: String(p.firstRequestId ?? ""), minGapDays: Number(p.minGapDays ?? 14) };
  return {};
}
export type Side = { requestId: string; ref: string; agencyId: string; agencyName: string | null; mine: boolean; start: string | null; end: string | null };
export function sidesOf(d: Dossier): Side[] {
  return [d.parties.a, d.parties.b].filter((p) => p.sourceType === "work_request").map((p) => ({ requestId: p.id, ref: p.ref, agencyId: p.agencyId, agencyName: p.agencyName, mine: p.mine, start: p.plannedStart, end: p.plannedEnd }));
}
const dateOnly = (iso: string) => iso.slice(0, 10);
const atTime = (day: string, like: string) => new Date(`${day}T${like.slice(11, 19)}Z`).toISOString();
const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * DAY).toISOString();

/** Raw API proposal from the form, or null while it is incomplete. The server re-validates everything. */
export function buildProposal(type: ProposalType, f: FormState, sides: Side[]): Record<string, unknown> | null {
  const t = sides.find((s) => s.requestId === f.targetRequestId);
  if (type === "schedule_shift") {
    if (!t?.start || !t.end || !f.newStart) return null;
    const start = atTime(f.newStart, t.start);
    const end = f.changeDuration ? (f.newEnd ? atTime(f.newEnd, t.end) : null) : addDays(start, Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / DAY));
    return end ? { targetRequestId: t.requestId, newStart: start, newEnd: end, ...(f.changeDuration ? { changeDuration: true } : {}) } : null;
  }
  if (type === "working_hours") return t ? { targetRequestId: t.requestId, workingHours: f.workingHours } : null;
  if (type === "joint_works") return f.leadAgencyId && f.proposedStart && f.proposedEnd ? { leadAgencyId: f.leadAgencyId, proposedStart: `${f.proposedStart}T04:00:00.000Z`, proposedEnd: `${f.proposedEnd}T04:00:00.000Z`, scopeNote: f.scopeNote } : null;
  if (type === "sequence_order") return f.firstRequestId ? { firstRequestId: f.firstRequestId, minGapDays: f.minGapDays } : null;
  if (type === "traffic_management") return f.measures.length ? { measures: f.measures, ...(f.notes ? { notes: f.notes } : {}) } : null;
  if (type === "information_request") { const q = f.questions.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5); return q.length ? { questions: q } : null; }
  const slots = f.slots.filter(Boolean).map(slotIso);
  return slots.length && f.locationText ? { mode: f.mode, locationText: f.locationText, slots } : null;
}

export function ImpactCard({ conflictId, type, proposal, copy }: { conflictId: string; type: ProposalType; proposal: Record<string, unknown> | null; copy: CoordCopy }) {
  const [locale] = useWorkspaceLocale();
  const ac = getAssessmentCopy(locale);
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const key = useDebounced(proposal ? JSON.stringify(proposal) : "", 400);
  const q = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "coord-impact", conflictId, type, key), queryFn: () => previewImpact({ conflictId, type, proposal: JSON.parse(key) }), enabled: Boolean(userId) && Boolean(key), retry: false });
  const impact: Impact | null = q.data?.impact ?? null;
  return (
    <aside className="co-sim" aria-label={copy.composer.simulator}>
      <h3>{copy.composer.simulator}</h3>
      <p className="rs-help">{copy.composer.simulatorHelp}</p>
      <div aria-live="polite">
        {!key ? <p className="rs-help">{copy.composer.noPreview}</p>
          : q.isPending ? <p className="rs-help" role="status">…</p>
          : q.isError || !impact ? <p className="rs-help">{q.error instanceof ApiError && q.error.status === 400 ? copy.composer.errors[(((q.error.details as { code?: string }[] | undefined)?.[0]?.code) ?? "").toLowerCase()] ?? copy.composer.previewFailed : copy.composer.previewFailed}</p>
          : !impact.applicable ? <p className="rs-help">{copy.room.noImpact}</p>
          : (
            <>
              <div className="co-sim-rings">
                <ScoreRing score={impact.before.pairScore} band={impact.before.pairBand} size={56} label={`${impact.before.pairScore}`} />
                <span aria-hidden="true">→</span>
                <ScoreRing score={impact.after.pairScore} band={impact.after.pairBand} size={56} label={`${impact.after.pairScore}`} />
              </div>
              <p><span className="co-verdict" data-verdict={impact.verdict}>{copy.composer.verdicts[impact.verdict]}</span></p>
              <ul className="co-sim-list">
                <li>{fmt(copy.room.pairDelta, { from: `${impact.before.pairScore} (${ac.bands[impact.before.pairBand]})`, to: `${impact.after.pairScore} (${ac.bands[impact.after.pairBand]})` })}</li>
                <li>{fmt(copy.room.riskDelta, { from: impact.before.riskIndex, to: impact.after.riskIndex })}</li>
                <li>{fmt(copy.room.conflictsDelta, { from: impact.before.conflictCount, to: impact.after.conflictCount })}</li>
              </ul>
            </>
          )}
      </div>
    </aside>
  );
}

export function ProposalFields({ type, f, set, sides, d, sug, copy }: { type: ProposalType; f: FormState; set: (p: Partial<FormState>) => void; sides: Side[]; d: Dossier; sug: Suggestions | null; copy: CoordCopy }) {
  const c = copy.composer;
  const target = sides.find((s) => s.requestId === f.targetRequestId);
  const delta = target?.start && f.newStart ? Math.round((new Date(atTime(f.newStart, target.start)).getTime() - new Date(target.start).getTime()) / DAY) : null;
  const sideSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="co-field">{label}
      <select className="rs-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />{sides.map((s) => <option key={s.requestId} value={s.requestId}>{s.mine ? c.mine : c.theirs} · {s.ref} · {s.agencyName}</option>)}
      </select>
    </label>
  );
  if (type === "schedule_shift") {
    const mineShift = sug?.shifts.find((s) => s.mine && s.requestId);
    const advice = mineShift && mineShift.shift && "daysToClearAfter" in mineShift.shift ? mineShift.shift : null;
    return (
      <div className="co-form">
        {sug && advice ? <div className="co-quick" aria-label={c.quick}>
          <strong>{c.quick}</strong>
          {advice.daysToClearAfter && mineShift?.requestId ? <button type="button" className="rs-btn" onClick={() => { const s = sides.find((x) => x.requestId === mineShift.requestId)!; set({ targetRequestId: s.requestId, newStart: dateOnly(addDays(s.start!, advice.daysToClearAfter!)) }); }}>{fmt(c.quickShift, { n: advice.daysToClearAfter })}</button> : null}
          {advice.daysToClearBefore && mineShift?.requestId ? <button type="button" className="rs-btn" onClick={() => { const s = sides.find((x) => x.requestId === mineShift.requestId)!; set({ targetRequestId: s.requestId, newStart: dateOnly(addDays(s.start!, -advice.daysToClearBefore!)) }); }}>{fmt(c.quickEarlier, { n: advice.daysToClearBefore })}</button> : null}
        </div> : null}
        {sideSelect(f.targetRequestId, (v) => set({ targetRequestId: v }), c.target)}
        <label className="co-field">{c.newStart}<input className="rs-input" type="date" value={f.newStart} onChange={(e) => set({ newStart: e.target.value })} /></label>
        <label className="co-check"><input type="checkbox" checked={f.changeDuration} onChange={(e) => set({ changeDuration: e.target.checked })} /> {c.changeDuration}</label>
        {f.changeDuration ? <label className="co-field">{c.newEnd}<input className="rs-input" type="date" value={f.newEnd} onChange={(e) => set({ newEnd: e.target.value })} /></label> : null}
        {delta !== null ? <p className="co-delta-read" aria-live="polite">{fmt(c.dayDelta, { n: `${delta > 0 ? "+" : ""}${delta}` })}</p> : null}
      </div>
    );
  }
  if (type === "working_hours") {
    return (
      <div className="co-form">
        <div className="co-quick"><strong>{c.quick}</strong><button type="button" className="rs-btn" onClick={() => set({ workingHours: "night", targetRequestId: f.targetRequestId || sides.find((s) => s.mine)?.requestId || "" })}>{c.quickNight}</button></div>
        {sideSelect(f.targetRequestId, (v) => set({ targetRequestId: v }), c.target)}
        <fieldset className="co-field"><legend>{c.hoursLabel}</legend>{(["day", "night", "24h"] as const).map((h) => <label key={h} className="co-check"><input type="radio" name="hours" checked={f.workingHours === h} onChange={() => set({ workingHours: h })} /> {copy.hours[h]}</label>)}</fieldset>
      </div>
    );
  }
  if (type === "joint_works") {
    const agencies = d.affected.filter((a) => a.active && !a.excluded);
    return (
      <div className="co-form">
        {sug?.jointWorks?.sharedTrenchMeters ? <p className="rs-help">{fmt(c.sharedTrench, { m: Math.round(sug.jointWorks.sharedTrenchMeters) })}</p> : null}
        <label className="co-field">{c.lead}<select className="rs-input" value={f.leadAgencyId} onChange={(e) => set({ leadAgencyId: e.target.value })}><option value="" />{agencies.map((a) => <option key={a.agencyId} value={a.agencyId}>{a.agencyName}</option>)}</select></label>
        <label className="co-field">{copy.fields.jointStart}<input className="rs-input" type="date" value={f.proposedStart} onChange={(e) => set({ proposedStart: e.target.value })} /></label>
        <label className="co-field">{copy.fields.jointEnd}<input className="rs-input" type="date" value={f.proposedEnd} onChange={(e) => set({ proposedEnd: e.target.value })} /></label>
        <label className="co-field">{c.scopeNote}<textarea className="rs-input" rows={2} maxLength={300} value={f.scopeNote} onChange={(e) => set({ scopeNote: e.target.value })} /></label>
      </div>
    );
  }
  if (type === "sequence_order") {
    return (
      <div className="co-form">
        {sideSelect(f.firstRequestId, (v) => set({ firstRequestId: v }), c.firstRequest)}
        <div className="co-quick"><strong>{c.quick}</strong>{(sug?.sequenceGaps ?? [7, 14, 30]).map((g) => <button key={g} type="button" className="rs-btn" aria-pressed={f.minGapDays === g} onClick={() => set({ minGapDays: g })}>{fmt(c.quickSeq, { n: g })}</button>)}</div>
        <label className="co-field">{c.minGap}<input className="rs-input" type="number" min={0} max={60} value={f.minGapDays} onChange={(e) => set({ minGapDays: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} /></label>
      </div>
    );
  }
  if (type === "traffic_management") {
    return (
      <div className="co-form">
        <fieldset className="co-field"><legend>{c.measures}</legend>{TRAFFIC_MEASURES.map((m) => <label key={m} className="co-check"><input type="checkbox" checked={f.measures.includes(m)} onChange={(e) => set({ measures: e.target.checked ? [...f.measures, m] : f.measures.filter((x) => x !== m) })} /> {copy.measures[m]}</label>)}</fieldset>
        <label className="co-field">{c.notes}<textarea className="rs-input" rows={2} maxLength={300} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
      </div>
    );
  }
  if (type === "information_request") return <div className="co-form"><label className="co-field">{c.questions}<textarea className="rs-input" rows={5} value={f.questions} onChange={(e) => set({ questions: e.target.value })} /></label></div>;
  return (
    <div className="co-form">
      <div className="co-quick"><strong>{c.quick}</strong><button type="button" className="rs-btn" onClick={() => set({ slots: (sug?.meetingSlots ?? []).map((s) => new Date(new Date(s).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16)) })}>{c.quickMeet}</button></div>
      <fieldset className="co-field"><legend>{c.meetingMode}</legend>{(["onsite", "online"] as const).map((m) => <label key={m} className="co-check"><input type="radio" name="mode" checked={f.mode === m} onChange={() => set({ mode: m })} /> {m === "onsite" ? copy.diff.onsite : copy.diff.online}</label>)}</fieldset>
      <label className="co-field">{c.location}<input className="rs-input" maxLength={150} value={f.locationText} onChange={(e) => set({ locationText: e.target.value })} /></label>
      <fieldset className="co-field"><legend>{c.slots}</legend>{f.slots.map((s, i) => <input key={i} className="rs-input" type="datetime-local" value={s} aria-label={`${c.slots} ${i + 1}`} onChange={(e) => set({ slots: f.slots.map((x, j) => (j === i ? e.target.value : x)) })} />)}
        {f.slots.length < 3 ? <button type="button" className="rs-btn" onClick={() => set({ slots: [...f.slots, ""] })}>+</button> : null}</fieldset>
    </div>
  );
}

export const slotIso = (local: string) => new Date(new Date(`${local}:00Z`).getTime() - 5.5 * 3_600_000).toISOString();

// ---------- the composer ----------

export function CoordinationComposer({ conflictId, prefill }: { conflictId: string; prefill?: Handoff | null }) {
  const [locale] = useWorkspaceLocale();
  const copy = getCoordCopy(locale);
  const c = copy.composer;
  const router = useRouter();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const dossier = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-dossier", conflictId), queryFn: () => fetchDossier(conflictId), enabled: Boolean(userId), retry: false });
  const sugQ = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "coord-suggestions", conflictId), queryFn: () => fetchSuggestions(conflictId), enabled: Boolean(userId), retry: false });
  const d = dossier.data;
  const first = prefill?.drafts[0];
  const initType = first && (PROPOSAL_TYPES as readonly string[]).includes(first.type) ? (first.type as ProposalType) : null;
  const [step, setStep] = useState(initType ? 2 : 1);
  const [type, setType] = useState<ProposalType | null>(initType);
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_FORM, ...prefillForm(first) }));
  const [consulted, setConsulted] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [deadline, setDeadline] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const sides = useMemo(() => (d ? sidesOf(d) : []), [d]);
  const sug = sugQ.data ?? null;
  const set = (p: Partial<FormState>) => { setForm((cur) => ({ ...cur, ...p })); setDirty(true); };

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const band = d?.severity.band ?? "medium";
  const defaultDays = d?.recordType === "opportunity" ? 10 : ({ critical: 2, high: 4, medium: 7, low: 7, info: 7 } as const)[band];
  const [seed] = useState(() => Date.now());
  const defaultDeadline = new Date(seed + defaultDays * DAY).toISOString().slice(0, 16);
  const deadlineValue = deadline || defaultDeadline;
  const startWarn = d?.overlapWindow?.start && new Date(deadlineValue).getTime() > new Date(d.overlapWindow.start).getTime() - 3 * DAY;
  const raw = useMemo(() => {
    if (!type) return null;
    return buildProposal(type, form, sides);
  }, [type, form, sides]);

  const mine = d?.affected.find((a) => a.agencyId === d.myAgency?.agencyId);
  const canInitiate = Boolean(d && (d.canAct.dismiss || (mine?.required && mine.active)));
  const required = d?.affected.filter((a) => a.active && !a.excluded && a.required && a.agencyId !== d.myAgency?.agencyId) ?? [];
  const optional = d?.affected.filter((a) => a.active && !a.excluded && !a.required && a.agencyId !== d.myAgency?.agencyId) ?? [];
  const typeEnabled = (t: ProposalType) => t !== "joint_works" || Boolean(d && (d.recordType === "opportunity" || d.severity.classes.includes("joint_works_opportunity" as never)));

  const send = useMutation({
    mutationFn: () => createRequest(conflictId, { type: type!, summary: summary.trim(), proposal: raw, participants: consulted.map((agencyId) => ({ agencyId, mode: "consulted" as const })), deadlineAt: new Date(deadlineValue).toISOString() }),
    onSuccess: (r) => { clearHandoff(); setDirty(false); setConfirm(false); router.push(`/roadsync/coordination/${r.id}?created=${encodeURIComponent(r.requestNo)}`); },
    onError: (e) => { setConfirm(false); const code = e instanceof ApiError ? (((e.details as { code?: string }[] | undefined)?.[0]?.code ?? "") as string).toLowerCase() : ""; setError(c.errors[code] ?? (e instanceof ApiError && e.status === 403 ? c.errors.forbidden : c.errors.failed)); },
  });
  const stepValid = step === 1 ? Boolean(type) : step === 2 ? Boolean(raw) : step === 3 ? summary.trim().length > 0 && Boolean(deadlineValue) : true;

  if (!userId || dossier.isPending) return <StaffWorkspaceShell title={c.title} wide><p className="rs-help" role="status">{copy.room.loading}</p></StaffWorkspaceShell>;
  if (dossier.isError || !d) return <StaffWorkspaceShell title={c.title} wide><div className="rs-state" role="alert"><p>{copy.room.notFound}</p><Link className="rs-btn" href="/roadsync/conflicts">{copy.room.back}</Link></div></StaffWorkspaceShell>;

  return (
    <StaffWorkspaceShell title={c.title} description={`${d.conflictNo}`} wide>
      <div className="co-composer">
        <Link className="co-back" href={`/roadsync/conflicts/${conflictId}`}>← {copy.room.openConflict}</Link>
        {prefill ? <p className="rz-toast" role="note">{fmt(getAdvisorCopy(locale).banner, { recNo: prefill.banner.recNo })}</p> : null}
        <ol className="co-steps" aria-label={fmt(c.step, { n: step })}>{c.steps.map((s, i) => <li key={s} aria-current={step === i + 1 ? "step" : undefined} data-done={step > i + 1}>{i + 1}. {s}</li>)}</ol>
        {!canInitiate ? <p className="rs-notice" role="alert">{c.errors.forbidden}</p> : null}
        {error ? <p className="rs-errsum" role="alert">{error}</p> : null}
        <div className="co-composer-grid">
          <section className="co-panel">
            {step === 1 ? (
              <div className="co-types" role="radiogroup" aria-label={c.steps[0]}>
                {PROPOSAL_TYPES.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={type === t} disabled={!typeEnabled(t)} title={!typeEnabled(t) ? copy.typeDisabled[t] : undefined} className="co-type" onClick={() => { setType(t); setDirty(true); }}>
                    <strong>{copy.types[t]}</strong><span>{copy.typeHelp[t]}</span>{!typeEnabled(t) ? <small>{copy.typeDisabled[t]}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 2 && type ? <ProposalFields type={type} f={form} set={set} sides={sides} d={d} sug={sug} copy={copy} /> : null}
            {step === 3 ? (
              <div className="co-form">
                <div><strong>{c.recipients}</strong><ul className="co-chips-list">{required.map((a) => <li key={a.agencyId} className="rs-nb-chip">{a.agencyName}</li>)}</ul></div>
                {optional.length ? <fieldset className="co-field"><legend>{c.consulted}</legend>{optional.map((a) => <label key={a.agencyId} className="co-check"><input type="checkbox" checked={consulted.includes(a.agencyId)} onChange={(e) => { setConsulted(e.target.checked ? [...consulted, a.agencyId] : consulted.filter((x) => x !== a.agencyId)); setDirty(true); }} /> {a.agencyName}</label>)}</fieldset> : null}
                <label className="co-field">{c.deadline} <small>({c.deadlineDefault})</small><input className="rs-input" type="datetime-local" value={deadlineValue} onChange={(e) => { setDeadline(e.target.value); setDirty(true); }} /></label>
                {startWarn ? <p className="rs-notice" role="note">{copy.clock.warn}</p> : null}
                <label className="co-field">{c.summary}<textarea className="rs-input" rows={4} maxLength={1000} value={summary} onChange={(e) => { setSummary(e.target.value); setDirty(true); }} /><small>{fmt(c.summaryHelp, { n: summary.length })}</small></label>
                <p className="rs-help">{copy.visibleToAll}</p>
              </div>
            ) : null}
            {step === 4 ? (
              <div className="co-form">
                <h3>{c.review}</h3>
                <p><strong>{type ? copy.types[type] : ""}</strong> · {d.conflictNo}</p>
                <p>{summary}</p>
                <p className="rs-help">{copy.visibleToAll}</p>
                <ul className="co-chips-list">{[...required.map((a) => a.agencyName), ...optional.filter((a) => consulted.includes(a.agencyId)).map((a) => a.agencyName)].map((n) => <li key={n} className="rs-nb-chip">{n}</li>)}</ul>
              </div>
            ) : null}
            <div className="co-nav">
              <button type="button" className="rs-btn" disabled={step === 1} onClick={() => setStep(step - 1)}>{c.back}</button>
              {step < 4 ? <button type="button" className="rs-btn is-primary" disabled={!stepValid} onClick={() => setStep(step + 1)}>{c.next}</button>
                : <button type="button" className="rs-btn is-primary" disabled={!canInitiate || send.isPending} onClick={() => setConfirm(true)}><SendIcon aria-hidden="true" /> {send.isPending ? c.sending : c.send}</button>}
            </div>
          </section>
          {type && step >= 2 ? <ImpactCard conflictId={conflictId} type={type} proposal={raw} copy={copy} /> : null}
        </div>
        <Dialog.Root open={confirm} onOpenChange={setConfirm}>
          <Dialog.Portal>
            <Dialog.Overlay className="co-overlay" />
            <Dialog.Content className="co-dialog">
              <Dialog.Title>{c.sendConfirm}</Dialog.Title>
              <Dialog.Description>{fmt(c.sendBody, { n: required.length + consulted.length })}</Dialog.Description>
              <div className="co-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{c.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={send.isPending} onClick={() => send.mutate()}><CheckCircle2Icon aria-hidden="true" /> {c.send}</button></div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </StaffWorkspaceShell>
  );
}
