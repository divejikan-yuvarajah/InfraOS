"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { addAsset, changeAssetStatus, fetchAssets, patchAsset, recordAssessment, requestMaintenance } from "@/lib/assets/api";
import type { Copy } from "@/lib/assets/messages";
import {
  ASSET_TYPES, ISSUE_SEVERITIES, KNOWN_CONDITIONS, MAINTENANCE_PRIORITIES, MAINTENANCE_TYPES, OPERATIONAL_STATUSES,
  type AssetDetail, type AssetType, type Issue, type KnownCondition, type MaintenancePriority, type MaintenanceType, type OperationalStatus,
} from "@/lib/assets/types";
import { fill, reasonOk } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { colomboToIso, isoToColomboParts } from "@/lib/inspections/calendar-math";

import { errorText, Field, Shell } from "./asset-ui";

type Base = { open: boolean; onOpenChange: (o: boolean) => void; copy: Copy; locale: AuthLocale };

export function useRefreshAssets() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["assets"] }), qc.invalidateQueries({ queryKey: ["inspections"] })]);
}
const todayParts = () => isoToColomboParts(new Date().toISOString()).date;
const Actions = ({ copy, onCancel, disabled, pending, label }: { copy: Copy; onCancel: () => void; disabled: boolean; pending: boolean; label: string }) => (
  <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
    <button type="button" className="ctr-btn" onClick={onCancel}>{copy.common.cancel}</button>
    <button type="submit" className="ctr-btn is-primary" disabled={disabled || pending}>{pending ? copy.common.working : label}</button>
  </div>
);

/* ------------------------------------------------------------------ assessment */

type IssueDraft = { key: string; title: string; severity: Issue["severity"]; status: "OPEN" | "RESOLVED"; carried: boolean };

export function AssessmentDialog({ open, onOpenChange, copy, asset }: Base & { asset: AssetDetail }) {
  const refresh = useRefreshAssets();
  const [date, setDate] = useState("");
  const [condition, setCondition] = useState<KnownCondition>("GOOD");
  const [observations, setObservations] = useState("");
  const [issues, setIssues] = useState<IssueDraft[]>([]);
  const [refs, setRefs] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const completed = asset.maintenance.filter((m) => m.status === "COMPLETED");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setDate(todayParts()); setCondition(asset.condition.value === "UNKNOWN" ? "GOOD" : asset.condition.value); setObservations(""); setReason(""); setRefs([]); setError(null);
      // Every open issue of the latest assessment must be carried forward explicitly (still open, or resolved).
      setIssues(asset.openIssues.map((i) => ({ key: i.key, title: i.title, severity: i.severity, status: "OPEN", carried: true })));
    });
  }, [open, asset.condition.value, asset.openIssues]);

  const iso = colomboToIso(date, "12:00");
  const future = date > todayParts();
  const ok = Boolean(iso) && !future && observations.trim().length >= 20 && reasonOk(reason) && issues.every((i) => i.title.trim().length > 0);
  const m = useMutation({
    mutationFn: () => recordAssessment(asset.id, { assessedAt: iso, condition, observations: observations.trim(), issues: issues.map((i) => ({ key: i.key, title: i.title.trim(), severity: i.severity, status: i.status })), maintenanceRefs: refs, reason: reason.trim() }),
    onSuccess: (r) => { toast.success(copy.conditionPanel.record.success); if (r.suggestion === "older_assessment_stored") toast.message(copy.conditionPanel.record.olderStored); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const r = copy.conditionPanel.record;
  const nextKey = () => { let n = issues.length + 1; while (issues.some((i) => i.key === `issue_${n}`)) n += 1; return `issue_${n}`; };

  return (
    <Shell open={open} onOpenChange={onOpenChange} title={r.title} description={r.description} wide>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        <div className="ctr-row">
          <Field label={r.date} error={future ? copy.errors.completedDate : null}>{(id) => <input id={id} type="date" className="ctr-input" max={todayParts()} value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
          <Field label={r.condition}>{(id) => <select id={id} className="ctr-input" value={condition} onChange={(e) => setCondition(e.target.value as KnownCondition)}>{KNOWN_CONDITIONS.map((c) => <option key={c} value={c}>{copy.condition[c]}</option>)}</select>}</Field>
        </div>
        <Field label={r.observations} hint={r.obsHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={2000} value={observations} onChange={(e) => setObservations(e.target.value)} required />}</Field>
        <fieldset className="ctr-field"><legend className="ctr-label">{r.issues}</legend>
          {issues.some((i) => i.carried) ? <p className="ins-muted">{r.carryForward}</p> : null}
          {issues.map((i, n) => (
            <div key={i.key} className="ast-asset-card">
              {i.carried ? <strong>{i.title} <span className="ins-muted">· {copy.conditionPanel.severity[i.severity]}</span></strong> : (
                <div className="ctr-row">
                  <Field label={r.issueTitle} wide>{(id) => <input id={id} className="ctr-input" maxLength={160} value={i.title} onChange={(e) => setIssues(issues.map((x, k) => (k === n ? { ...x, title: e.target.value } : x)))} />}</Field>
                  <Field label={r.severity}>{(id) => <select id={id} className="ctr-input" value={i.severity} onChange={(e) => setIssues(issues.map((x, k) => (k === n ? { ...x, severity: e.target.value as Issue["severity"] } : x)))}>{ISSUE_SEVERITIES.map((s) => <option key={s} value={s}>{copy.conditionPanel.severity[s]}</option>)}</select>}</Field>
                  <button type="button" className="ctr-btn is-ghost" aria-label={copy.wizard.removeAsset} onClick={() => setIssues(issues.filter((_, k) => k !== n))}><Trash2Icon aria-hidden="true" /></button>
                </div>
              )}
              {i.carried ? (
                <div className="ctr-seg" role="group" aria-label={i.title}>
                  <button type="button" aria-pressed={i.status === "OPEN"} onClick={() => setIssues(issues.map((x, k) => (k === n ? { ...x, status: "OPEN" } : x)))}>{r.stillOpen}</button>
                  <button type="button" aria-pressed={i.status === "RESOLVED"} onClick={() => setIssues(issues.map((x, k) => (k === n ? { ...x, status: "RESOLVED" } : x)))}>{r.resolved}</button>
                </div>
              ) : null}
            </div>
          ))}
          {issues.length < 20 ? <button type="button" className="ctr-btn" onClick={() => setIssues([...issues, { key: nextKey(), title: "", severity: "MINOR", status: "OPEN", carried: false }])}><PlusIcon aria-hidden="true" />{r.addIssue}</button> : null}
        </fieldset>
        {completed.length ? (
          <fieldset className="ctr-field"><legend className="ctr-label">{r.maintenanceRefs}</legend>
            {completed.slice(0, 10).map((c) => <label key={c.id} className="ins-toggle"><input type="checkbox" checked={refs.includes(c.id)} onChange={(e) => setRefs(e.target.checked ? [...refs, c.id] : refs.filter((x) => x !== c.id))} />{c.maintenanceNo} · {c.title}</label>)}
          </fieldset>
        ) : null}
        <Field label={r.reason} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={r.confirm} />
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ status */

export function StatusDialog({ open, onOpenChange, copy, asset }: Base & { asset: AssetDetail }) {
  const refresh = useRefreshAssets();
  const [status, setStatus] = useState<OperationalStatus>(asset.operationalStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) queueMicrotask(() => { setStatus(asset.operationalStatus); setReason(""); setError(null); }); }, [open, asset.operationalStatus]);
  const needsReason = status === "OUT_OF_SERVICE" || status === "DECOMMISSIONED";
  const ok = status !== asset.operationalStatus && (!needsReason || reasonOk(reason));
  const m = useMutation({
    mutationFn: () => changeAssetStatus(asset.id, { version: asset.version, status, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: () => { toast.success(copy.passport.status.success); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const s = copy.passport.status;
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={s.title} description={s.description}>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        <Field label={s.newStatus}>{(id) => <select id={id} className="ctr-input" value={status} onChange={(e) => setStatus(e.target.value as OperationalStatus)}>{OPERATIONAL_STATUSES.map((o) => <option key={o} value={o}>{copy.opStatus[o]}</option>)}</select>}</Field>
        {status === "DECOMMISSIONED" && asset.maintenance.some((x) => ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS"].includes(x.status)) ? <p className="ctr-error" role="status">{s.openMaintenance}</p> : null}
        <Field label={s.reason} hint={needsReason ? copy.common.reasonHint : undefined}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required={needsReason} />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={s.confirm} />
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ edit */

export function EditDialog({ open, onOpenChange, copy, asset }: Base & { asset: AssetDetail }) {
  const refresh = useRefreshAssets();
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [life, setLife] = useState(asset.designLifeYears?.toString() ?? "");
  const [interval, setIntervalDays] = useState(String(asset.monitoringIntervalDays));
  const [dlp, setDlp] = useState(asset.defectsLiabilityEndsOn ? asset.defectsLiabilityEndsOn.slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => { setName(asset.name); setDescription(asset.description ?? ""); setLife(asset.designLifeYears?.toString() ?? ""); setIntervalDays(String(asset.monitoringIntervalDays)); setDlp(asset.defectsLiabilityEndsOn ? asset.defectsLiabilityEndsOn.slice(0, 10) : ""); setError(null); });
  }, [open, asset]);
  const lifeN = life ? Number(life) : undefined;
  const intN = Number(interval);
  const ok = name.trim().length > 1 && Number.isInteger(intN) && intN >= 30 && intN <= 1825 && (lifeN === undefined || (Number.isInteger(lifeN) && lifeN >= 1 && lifeN <= 150));
  const m = useMutation({
    mutationFn: () => patchAsset(asset.id, {
      version: asset.version, name: name.trim(), description: description.trim() || undefined, monitoringIntervalDays: intN, ...(lifeN !== undefined ? { designLifeYears: lifeN } : {}),
      defectsLiabilityEndsOn: dlp ? colomboToIso(dlp, "00:00") : null,
    }),
    onSuccess: () => { toast.success(copy.passport.edit.success); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const e = copy.passport.edit;
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={e.title}>
      <form className="ctr-dialog" onSubmit={(ev) => { ev.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        <Field label={e.name}>{(id) => <input id={id} className="ctr-input" maxLength={200} value={name} onChange={(x) => setName(x.target.value)} required />}</Field>
        <Field label={e.description}>{(id) => <textarea id={id} className="ctr-input" maxLength={2000} value={description} onChange={(x) => setDescription(x.target.value)} />}</Field>
        <div className="ctr-row">
          <Field label={e.designLife}>{(id) => <input id={id} type="number" min={1} max={150} className="ctr-input" value={life} onChange={(x) => setLife(x.target.value)} />}</Field>
          <Field label={e.interval}>{(id) => <input id={id} type="number" min={30} max={1825} className="ctr-input" value={interval} onChange={(x) => setIntervalDays(x.target.value)} />}</Field>
          <Field label={e.dlpEnds}>{(id) => <input id={id} type="date" className="ctr-input" value={dlp} onChange={(x) => setDlp(x.target.value)} />}</Field>
        </div>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={e.save} />
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ maintenance request / plan */

type PickedAsset = { id: string; assetNo: string | null; name: string; version?: number } | null;
type TaskDraft = { key: string; title: string };

export function RequestMaintenanceDialog({ open, onOpenChange, copy, asset, canPlan, openIssues, initialDate }: Base & { asset?: { id: string; assetNo: string | null; name: string }; canPlan: boolean; openIssues?: Issue[]; initialDate?: string }) {
  const refresh = useRefreshAssets();
  const [picked, setPicked] = useState<PickedAsset>(null);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<MaintenanceType>("CORRECTIVE");
  const [priority, setPriority] = useState<MaintenancePriority>("NORMAL");
  const [date, setDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [recur, setRecur] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [plan, setPlan] = useState(false);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = asset ?? picked;

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => { setPicked(null); setQ(""); setTitle(""); setDescription(""); setType("CORRECTIVE"); setPriority("NORMAL"); setDate(initialDate ?? ""); setEstimate(""); setRecur(""); setTasks([]); setLinked([]); setPlan(false); setAck(false); setError(null); });
  }, [open, initialDate]);

  const results = useQuery({ queryKey: ["assets", "picker", q], queryFn: () => fetchAssets({ q: q || undefined, limit: 8, sort: "name" }), enabled: open && !asset });
  const iso = date ? colomboToIso(date, "09:00") : null;
  const amountOk = estimate.trim() === "" || /^\d{1,12}(\.\d{1,2})?$/.test(estimate.trim());
  const recurN = recur ? Number(recur) : undefined;
  const recurOk = recurN === undefined || (Number.isInteger(recurN) && recurN >= 30 && recurN <= 1825);
  const ok = Boolean(target) && title.trim().length > 2 && Boolean(iso) && amountOk && recurOk && tasks.every((t) => t.title.trim()) && (type !== "EMERGENCY" || !plan || ack);
  const m = useMutation({
    mutationFn: () => requestMaintenance(target!.id, {
      title: title.trim(), description: description.trim() || undefined, maintenanceType: type, priority, scheduledDate: iso, ...(estimate.trim() ? { estimatedCost: estimate.trim() } : {}), ...(recurN !== undefined && (type === "PREVENTIVE" || type === "ROUTINE") ? { recurrenceDays: recurN } : {}),
      linkedIssueKeys: linked, tasks: tasks.map((t) => ({ key: t.key, title: t.title.trim() })), plan, ...(ack ? { acknowledgeEmergency: true } : {}),
    }),
    onSuccess: (r) => { toast.success(fill(plan ? copy.maint.dialogs.planned : copy.maint.dialogs.requested, { no: r.maintenanceNo })); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const d = copy.maint.dialogs;
  const nextKey = () => { let n = tasks.length + 1; while (tasks.some((t) => t.key === `task_${n}`)) n += 1; return `task_${n}`; };

  return (
    <Shell open={open} onOpenChange={onOpenChange} title={plan ? d.planTitle : d.requestTitle} wide>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        {asset ? <div className="ins-panel"><strong>{asset.name}</strong><span className="ins-muted">{asset.assetNo ?? "—"}</span></div> : picked ? (
          <div className="ins-panel"><strong>{picked.name}</strong><span className="ins-muted">{picked.assetNo ?? "—"}</span><button type="button" className="ctr-btn" onClick={() => setPicked(null)}>{copy.common.clear}</button></div>
        ) : (
          <>
            <Field label={d.asset} hint={d.searchAssets}>{(id) => <input id={id} className="ctr-input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}</Field>
            <div className="ins-proj-list">{(results.data?.rows ?? []).filter((r) => r.operationalStatus !== "DECOMMISSIONED").map((r) => <button key={r.id} type="button" className="ins-proj" onClick={() => setPicked({ id: r.id, assetNo: r.assetNo, name: r.name })}><strong>{r.name}</strong><span className="ins-muted">{r.assetNo ?? "—"} · {copy.assetType[r.assetType]}</span></button>)}</div>
          </>
        )}
        <Field label={d.jobTitle}>{(id) => <input id={id} className="ctr-input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label={d.description}>{(id) => <textarea id={id} className="ctr-input" maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="ctr-row">
          <Field label={d.type}>{(id) => <select id={id} className="ctr-input" value={type} onChange={(e) => setType(e.target.value as MaintenanceType)}>{MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{copy.mtype[t]}</option>)}</select>}</Field>
          <Field label={d.priority}>{(id) => <select id={id} className="ctr-input" value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)}>{MAINTENANCE_PRIORITIES.map((t) => <option key={t} value={t}>{copy.mpriority[t]}</option>)}</select>}</Field>
          <Field label={d.date}>{(id) => <input id={id} type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
        </div>
        <div className="ctr-row">
          <Field label={d.estimate} error={amountOk ? null : copy.errors.validation}>{(id) => <input id={id} inputMode="decimal" className="ctr-input" value={estimate} onChange={(e) => setEstimate(e.target.value)} />}</Field>
          {type === "PREVENTIVE" || type === "ROUTINE" ? <Field label={d.recurrence} hint={d.recurrenceHint} error={recurOk ? null : copy.errors.validation}>{(id) => <input id={id} type="number" min={30} max={1825} className="ctr-input" value={recur} onChange={(e) => setRecur(e.target.value)} />}</Field> : null}
        </div>
        <fieldset className="ctr-field"><legend className="ctr-label">{d.tasks}</legend>
          {tasks.map((t, n) => (
            <div key={t.key} className="ctr-row">
              <input aria-label={`${d.tasks} ${n + 1}`} className="ctr-input" maxLength={160} value={t.title} onChange={(e) => setTasks(tasks.map((x, k) => (k === n ? { ...x, title: e.target.value } : x)))} style={{ flex: 1 }} />
              <button type="button" className="ctr-btn is-ghost" aria-label={copy.wizard.removeAsset} onClick={() => setTasks(tasks.filter((_, k) => k !== n))}><Trash2Icon aria-hidden="true" /></button>
            </div>
          ))}
          {tasks.length < 20 ? <button type="button" className="ctr-btn" onClick={() => setTasks([...tasks, { key: nextKey(), title: "" }])}><PlusIcon aria-hidden="true" />{d.addTask}</button> : null}
        </fieldset>
        {openIssues && openIssues.length ? (
          <fieldset className="ctr-field"><legend className="ctr-label">{d.linkIssues}</legend>
            {openIssues.map((i) => <label key={i.key} className="ins-toggle"><input type="checkbox" checked={linked.includes(i.key)} onChange={(e) => setLinked(e.target.checked ? [...linked, i.key] : linked.filter((x) => x !== i.key))} />{i.title} · {copy.conditionPanel.severity[i.severity]}</label>)}
          </fieldset>
        ) : null}
        {canPlan ? <label className="ins-toggle"><input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} />{d.plan}</label> : null}
        {plan && type === "EMERGENCY" ? <label className="ins-toggle"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{copy.maint.actions.emergency}</label> : null}
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={plan ? d.submitPlan : d.submitRequest} />
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ add asset to an approved conversion's project */

export function AddAssetDialog({ open, onOpenChange, copy, projectId }: Base & { projectId: string }) {
  const refresh = useRefreshAssets();
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("ROAD");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) queueMicrotask(() => { setName(""); setType("ROAD"); setReason(""); setError(null); }); }, [open]);
  const ok = name.trim().length > 1 && reasonOk(reason);
  const m = useMutation({
    mutationFn: () => addAsset({ projectId, asset: { key: "added_1", assetType: type, name: name.trim(), geometrySource: "NONE" }, reason: reason.trim() }),
    onSuccess: () => { toast.success(copy.passport.edit.success); void refresh(); onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={copy.dashboard.addAsset}>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        <Field label={copy.wizard.name}>{(id) => <input id={id} className="ctr-input" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label={copy.wizard.type}>{(id) => <select id={id} className="ctr-input" value={type} onChange={(e) => setType(e.target.value as AssetType)}>{ASSET_TYPES.map((t) => <option key={t} value={t}>{copy.assetType[t]}</option>)}</select>}</Field>
        <Field label={copy.common.reasonLabel} hint={copy.common.reasonHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required />}</Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <Actions copy={copy} onCancel={() => onOpenChange(false)} disabled={!ok} pending={m.isPending} label={copy.common.save} />
      </form>
    </Shell>
  );
}
