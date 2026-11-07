"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignContractor, changeStatus, endAssignment, failureOf, fetchContractors, reassignContractor } from "@/lib/contractors/api";
import { formatDate, parseLkrToMinor } from "@/lib/contractors/format";
import { EMPTY_LIST_STATE } from "@/lib/contractors/list-query";
import { failureMessage, type Copy } from "@/lib/contractors/messages";
import { assignSchema, statusReasonSchema } from "@/lib/contractors/schema";
import { useContractorKeys } from "@/lib/contractors/session";
import type { Assignment, ImpactRow } from "@/lib/contractors/types";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProjects } from "@/lib/projects/api";
import { fetchMilestones } from "@/lib/projects/milestones-api";

import { RoleBadge } from "./contractor-badges";

type Common = { open: boolean; onOpenChange: (open: boolean) => void; copy: Copy; locale: AuthLocale };
const today = () => new Date().toISOString().slice(0, 10);
const ASSIGNABLE_BLOCKED = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="ctr-small" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="ctr-error" role="alert" id={`${id}-err`}>{error}</p> : null}
    </div>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["contractors"] });
}

/* ---------------------------------------------------------------- status */

export type StatusTarget = "SUSPENDED" | "INACTIVE" | "ARCHIVED" | "ACTIVE";

/**
 * Suspend, inactivate, archive or reactivate. The first submit asks the server; when active work would be affected the server
 * answers with the impact list and the dialog asks for acknowledgement before sending the same request again.
 */
function StatusDialogBody({ onOpenChange, copy, contractor, target, onDone }: Common & { contractor: { id: string; name: string; updatedAt?: string | null }; target: StatusTarget; onDone?: () => void }) {
  const invalidate = useInvalidate();
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [impact, setImpact] = useState<{ rows: ImpactRow[]; hidden: number; blocked: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsReason = target !== "ACTIVE";
  const rid = useId();
  const reasonCheck = needsReason ? statusReasonSchema.safeParse(reason) : { success: true as const };

  const mutation = useMutation({
    mutationFn: () => changeStatus(contractor.id, { status: target, ...(needsReason ? { reason: reason.trim() } : {}), ...(ack ? { acknowledgeImpact: true } : {}) }),
    onSuccess: () => { toast.success(copy.statusDialog.done); void invalidate(); onOpenChange(false); onDone?.(); },
    onError: (e) => {
      const f = failureOf(e);
      if (f.status === 409 && (f.kind === "impact_ack_required" || f.kind === "active_assignments")) {
        setImpact({ rows: (f.details.impact as ImpactRow[]) ?? [], hidden: Number(f.details.hiddenCount ?? 0), blocked: f.kind === "active_assignments" });
        setError(null);
        return;
      }
      setError(failureMessage(f.status, f.kind, copy));
    },
  });

  const canSubmit = reasonCheck.success && !mutation.isPending && !impact?.blocked && (!impact || impact.rows.length + impact.hidden === 0 || ack);
  return (
    <>
        <DialogHeader>
          <DialogTitle>{copy.statusDialog.title[target]}</DialogTitle>
          <DialogDescription>{contractor.name} — {copy.statusDialog.body[target]}</DialogDescription>
        </DialogHeader>
        <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }}>
          {needsReason ? (
            <Field id={`${rid}-r`} label={copy.statusDialog.reason} hint={copy.statusDialog.reasonHint} error={reason && !reasonCheck.success ? copy.form.errors.reasonShort : null}>
              <textarea id={`${rid}-r`} className="ctr-input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(reason) && !reasonCheck.success} aria-describedby={`${rid}-r-hint`} />
            </Field>
          ) : null}
          {impact ? (
            <section aria-live="polite">
              <p className="ctr-label">{copy.statusDialog.impact}</p>
              {impact.rows.length ? (
                <ul className="ctr-impact">{impact.rows.map((r) => <li key={r.assignmentId}><strong className="ctr-code">{r.projectCode}</strong> {r.projectTitle} ({copy.roles[r.role as "PRIMARY" | "ADDITIONAL"] ?? r.role})</li>)}</ul>
              ) : <p className="ctr-small">{copy.statusDialog.impactNone}</p>}
              {impact.hidden > 0 ? <p className="ctr-small">{copy.statusDialog.hidden.replace("{n}", String(impact.hidden))}</p> : null}
              {impact.blocked ? <p className="ctr-error" role="alert">{copy.statusDialog.archiveBlocked}</p> : (
                <label className="ctr-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{copy.statusDialog.ack}</label>
              )}
            </section>
          ) : null}
          {error ? <p className="ctr-error" role="alert">{error}</p> : null}
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
            <button type="submit" className={target === "ACTIVE" ? "ctr-btn is-primary" : "ctr-btn is-danger"} disabled={!canSubmit}>{mutation.isPending ? copy.statusDialog.working : copy.statusDialog.confirm}</button>
          </div>
        </form>
    </>
  );
}

/* ---------------------------------------------------------------- pickers */

function ContractorPicker({ copy, value, onChange, exclude }: { copy: Copy; value: { id: string; name: string } | null; onChange: (v: { id: string; name: string }) => void; exclude?: string }) {
  const keys = useContractorKeys();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useQuery({ queryKey: keys.key("pick", debounced), queryFn: () => fetchContractors({ ...EMPTY_LIST_STATE, q: debounced, status: ["ACTIVE"], limit: 10 }), retry: false });
  const rows = (list.data?.rows ?? []).filter((r) => r.id !== exclude);
  const id = useId();
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{copy.assign.chooseContractor}</label>
      <input id={id} className="ctr-input" placeholder={copy.assign.searchContractor} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ctr-list-pick" role="group" aria-label={copy.assign.chooseContractor} aria-live="polite">
        {list.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
        {!list.isLoading && !rows.length ? <p className="ctr-small">{copy.assign.noContractors}</p> : null}
        {rows.map((r) => (
          <button key={r.id} type="button" className="ctr-pick" aria-pressed={value?.id === r.id} onClick={() => onChange({ id: r.id, name: r.name })}>
            <strong>{r.name}</strong><span className="ctr-code ctr-muted">{r.registrationNumber}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectPicker({ copy, value, onChange }: { copy: Copy; value: { id: string; label: string } | null; onChange: (v: { id: string; label: string }) => void }) {
  const keys = useContractorKeys();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useQuery({ queryKey: keys.key("pick-project", debounced), queryFn: () => fetchProjects({ page: 1, limit: 20, ...(debounced ? { q: debounced } : {}) }), retry: false });
  const rows = (list.data?.projects ?? []).filter((p) => !ASSIGNABLE_BLOCKED.has(p.status));
  const id = useId();
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{copy.assign.project}</label>
      <input id={id} className="ctr-input" placeholder={copy.assign.projectHint} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ctr-list-pick" role="group" aria-label={copy.assign.project} aria-live="polite">
        {list.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
        {!list.isLoading && !rows.length ? <p className="ctr-small">{copy.assign.noProjects}</p> : null}
        {rows.map((p) => (
          <button key={p.id} type="button" className="ctr-pick" aria-pressed={value?.id === p.id} onClick={() => onChange({ id: p.id, label: `${p.projectCode} ${p.title}` })}>
            <span className="ctr-code">{p.projectCode}</span><strong>{p.title}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- assign */

/** Assign from a contractor (pick a project) or from a project (pick a contractor). A second PRIMARY switches to the reassign wizard. */
function AssignDialogBody({ onOpenChange, copy, contractor, project, onNeedReassign }: Pick<Common, "onOpenChange" | "copy"> & {
  contractor?: { id: string; name: string }; project?: { id: string; label: string }; onNeedReassign?: (projectId: string, assignmentId: string) => void;
}) {
  const invalidate = useInvalidate();
  const [pickedProject, setPickedProject] = useState<{ id: string; label: string } | null>(project ?? null);
  const [pickedContractor, setPickedContractor] = useState<{ id: string; name: string } | null>(contractor ?? null);
  const [role, setRole] = useState<"PRIMARY" | "ADDITIONAL">("PRIMARY");
  const [startDate, setStartDate] = useState(today());
  const [reference, setReference] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ projectId: string; assignmentId: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const rid = useId();


  const parsed = assignSchema.safeParse({ projectId: pickedProject?.id ?? "", role, startDate, contractReference: reference, contractValue: value, notes });
  const fieldError = (name: string) => {
    if (!touched || parsed.success) return null;
    const issue = parsed.error.issues.find((i) => i.path[0] === name);
    return issue ? copy.form.errors[issue.message as keyof typeof copy.form.errors] ?? copy.form.errors.required : null;
  };
  const minor = value.trim() ? parseLkrToMinor(value) : undefined;

  const mutation = useMutation({
    mutationFn: () => assignContractor(pickedProject!.id, {
      contractorId: pickedContractor!.id, role, startDate, ...(reference.trim() ? { contractReference: reference.trim() } : {}),
      ...(minor !== undefined && minor !== null ? { contractValueMinor: minor } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
    }),
    onSuccess: () => { toast.success(copy.assign.done); void invalidate(); onOpenChange(false); },
    onError: (e) => {
      const f = failureOf(e);
      if (f.kind === "primary_exists") { setConflict({ projectId: pickedProject!.id, assignmentId: String(f.details.assignmentId ?? "") }); setError(copy.assign.primaryExists); return; }
      setError(failureMessage(f.status, f.kind, copy));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!parsed.success || !pickedContractor || (value.trim() && minor === null)) return;
    mutation.mutate();
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{copy.assign.title}</DialogTitle>
          <DialogDescription>{contractor ? contractor.name : project?.label ?? copy.assign.forProject}</DialogDescription>
        </DialogHeader>
        <form className="ctr-dialog" onSubmit={submit} noValidate>
          {!project ? <ProjectPicker copy={copy} value={pickedProject} onChange={setPickedProject} /> : null}
          {touched && !pickedProject ? <p className="ctr-error" role="alert">{copy.form.errors.required}</p> : null}
          {!contractor ? <ContractorPicker copy={copy} value={pickedContractor} onChange={setPickedContractor} /> : null}
          {touched && !pickedContractor ? <p className="ctr-error" role="alert">{copy.form.errors.required}</p> : null}
          <fieldset className="ctr-field" style={{ border: 0, padding: 0 }}>
            <legend className="ctr-label">{copy.assign.role}</legend>
            <label className="ctr-check"><input type="radio" name={`${rid}-role`} checked={role === "PRIMARY"} onChange={() => setRole("PRIMARY")} />{copy.assign.rolePrimary}</label>
            <label className="ctr-check"><input type="radio" name={`${rid}-role`} checked={role === "ADDITIONAL"} onChange={() => setRole("ADDITIONAL")} />{copy.assign.roleAdditional}</label>
          </fieldset>
          <div className="ctr-grid2">
            <Field id={`${rid}-d`} label={copy.assign.startDate} error={fieldError("startDate")}><input id={`${rid}-d`} type="date" className="ctr-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field id={`${rid}-c`} label={copy.assign.contractReference} error={fieldError("contractReference")}><input id={`${rid}-c`} className="ctr-input" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </div>
          <Field id={`${rid}-v`} label={copy.assign.contractValue} error={value.trim() && minor === null ? copy.form.errors.money : null}>
            <input id={`${rid}-v`} inputMode="decimal" className="ctr-input ctr-num" placeholder="1,250.00" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field id={`${rid}-n`} label={copy.assign.notes}><textarea id={`${rid}-n`} className="ctr-input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          {error ? <p className="ctr-error" role="alert">{error}</p> : null}
          {conflict && onNeedReassign && conflict.assignmentId ? (
            <button type="button" className="ctr-btn" onClick={() => { onOpenChange(false); onNeedReassign(conflict.projectId, conflict.assignmentId); }}>{copy.assign.openReassign}</button>
          ) : null}
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
            <button type="submit" className="ctr-btn is-primary" disabled={mutation.isPending}>{mutation.isPending ? copy.assign.working : copy.assign.confirm}</button>
          </div>
        </form>
    </>
  );
}

/* ---------------------------------------------------------------- end */

function EndAssignmentDialogBody({ onOpenChange, copy, locale, projectId, assignment, additional }: Common & { projectId: string; assignment: Assignment; additional: Assignment[] }) {
  const invalidate = useInvalidate();
  const [status, setStatus] = useState<"ENDED" | "TERMINATED">("ENDED");
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");
  const [promote, setPromote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const rid = useId();
  const reasonOk = statusReasonSchema.safeParse(reason).success;
  const mutation = useMutation({
    mutationFn: () => endAssignment(projectId, assignment.id, { status, endDate, endReason: reason.trim(), ...(promote ? { promoteAssignmentId: promote } : {}) }),
    onSuccess: () => { toast.success(copy.end.done); void invalidate(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureMessage(f.status, f.kind, copy)); },
  });
  return (
    <>
        <DialogHeader>
          <DialogTitle>{copy.end.title}</DialogTitle>
          <DialogDescription>{assignment.contractor?.name} · {assignment.project.code} · {copy.roles[assignment.role]} · {formatDate(assignment.startDate, locale)}</DialogDescription>
        </DialogHeader>
        <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setError(null); if (reasonOk && endDate) mutation.mutate(); }}>
          <fieldset className="ctr-field" style={{ border: 0, padding: 0 }}>
            <legend className="ctr-label">{copy.end.status}</legend>
            <label className="ctr-check"><input type="radio" name={`${rid}-s`} checked={status === "ENDED"} onChange={() => setStatus("ENDED")} />{copy.end.ended}</label>
            <label className="ctr-check"><input type="radio" name={`${rid}-s`} checked={status === "TERMINATED"} onChange={() => setStatus("TERMINATED")} />{copy.end.terminated}</label>
          </fieldset>
          <Field id={`${rid}-d`} label={copy.end.endDate}><input id={`${rid}-d`} type="date" className="ctr-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field id={`${rid}-r`} label={copy.end.reason} hint={copy.statusDialog.reasonHint} error={touched && !reasonOk ? copy.form.errors.reasonShort : null}>
            <textarea id={`${rid}-r`} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !reasonOk} />
          </Field>
          {assignment.role === "PRIMARY" && additional.length ? (
            <Field id={`${rid}-p`} label={copy.end.promote}>
              <select id={`${rid}-p`} className="ctr-input" value={promote} onChange={(e) => setPromote(e.target.value)}>
                <option value="">{copy.end.promoteNone}</option>
                {additional.map((a) => <option key={a.id} value={a.id}>{a.contractor?.name}</option>)}
              </select>
            </Field>
          ) : null}
          {error ? <p className="ctr-error" role="alert">{error}</p> : null}
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
            <button type="submit" className="ctr-btn is-danger" disabled={mutation.isPending}>{mutation.isPending ? copy.end.working : copy.end.confirm}</button>
          </div>
        </form>
    </>
  );
}

/* ---------------------------------------------------------------- reassign */

/** Four steps: choose the assignment, choose the replacement (with an impact preview), give the reason and date, confirm. One server transaction. */
function ReassignWizardBody({ open, onOpenChange, copy, locale, projectId, assignments, initialAssignmentId }: Common & { projectId: string; assignments: Assignment[]; initialAssignmentId?: string }) {
  const invalidate = useInvalidate();
  const [step, setStep] = useState(0);
  const [assignmentId, setAssignmentId] = useState(() => initialAssignmentId ?? assignments.find((a) => a.status === "ACTIVE" && a.role === "PRIMARY")?.id ?? assignments.find((a) => a.status === "ACTIVE")?.id ?? "");
  const [next, setNext] = useState<{ id: string; name: string } | null>(null);
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = useMemo(() => assignments.filter((a) => a.status === "ACTIVE"), [assignments]);
  const current = active.find((a) => a.id === assignmentId);

  const keys = useContractorKeys();
  const milestones = useQuery({ queryKey: keys.key("milestones", projectId), queryFn: () => fetchMilestones(projectId), enabled: open && step >= 1, retry: false });
  const openMilestones = milestones.data ? milestones.data.counts.notStarted + milestones.data.counts.inProgress + milestones.data.counts.delayed + milestones.data.counts.blocked : null;
  const reasonOk = statusReasonSchema.safeParse(reason).success;
  const dateOk = Boolean(date) && (!current?.startDate || date >= current.startDate.slice(0, 10));

  const mutation = useMutation({
    mutationFn: () => reassignContractor(projectId, assignmentId, { newContractorId: next!.id, effectiveDate: date, reason: reason.trim() }),
    onSuccess: () => { toast.success(copy.reassign.done); void invalidate(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(f.kind === "same_contractor" ? copy.reassign.same : failureMessage(f.status, f.kind, copy)); },
  });

  const canNext = step === 0 ? Boolean(current) : step === 1 ? Boolean(next) : step === 2 ? reasonOk && dateOk : true;
  return (
    <>
        <DialogHeader>
          <DialogTitle>{copy.reassign.title}</DialogTitle>
          <DialogDescription>{copy.reassign.preservedHistory}</DialogDescription>
        </DialogHeader>
        <ol className="ctr-wizard-steps" aria-label={copy.reassign.title}>
          {copy.reassign.steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={i < step ? "is-done" : undefined}>{i + 1}. {label}</li>)}
        </ol>
        {step === 0 ? (
          <div className="ctr-list-pick" role="group" aria-label={copy.reassign.current}>
            {active.map((a) => (
              <button key={a.id} type="button" className="ctr-pick" aria-pressed={a.id === assignmentId} onClick={() => setAssignmentId(a.id)}>
                <strong>{a.contractor?.name}</strong><RoleBadge role={a.role} copy={copy} /><span className="ctr-muted">{formatDate(a.startDate, locale)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {step === 1 ? (
          <>
            <ContractorPicker copy={copy} value={next} onChange={setNext} exclude={current?.contractor?.id} />
            <section aria-label={copy.reassign.impact} className="ctr-dup">
              <h3>{copy.reassign.impact}</h3>
              <p className="ctr-small">{copy.reassign.impactBody}</p>
              <p className="ctr-small">{copy.reassign.openMilestones}: <strong className="ctr-num">{milestones.isLoading ? copy.common.loading : openMilestones ?? copy.reassign.unknown}</strong></p>
              <p className="ctr-small">{copy.reassign.projectPointer}</p>
            </section>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Field id="reassign-date" label={copy.reassign.effective} error={!dateOk ? copy.form.errors.date : null}><input id="reassign-date" type="date" className="ctr-input" value={date} min={current?.startDate?.slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field id="reassign-reason" label={copy.reassign.reason} hint={copy.statusDialog.reasonHint} error={reason && !reasonOk ? copy.form.errors.reasonShort : null}>
              <textarea id="reassign-reason" className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        ) : null}
        {step === 3 ? (
          <dl className="ctr-summary" aria-label={copy.reassign.summary}>
            <dt>{copy.reassign.current}</dt><dd>{current?.contractor?.name} ({current ? copy.roles[current.role] : ""})</dd>
            <dt>{copy.reassign.replacement}</dt><dd>{next?.name}</dd>
            <dt>{copy.reassign.effective}</dt><dd>{formatDate(date, locale)}</dd>
            <dt>{copy.reassign.reason}</dt><dd>{reason}</dd>
            <dt>{copy.reassign.impact}</dt><dd>{copy.reassign.startsAt.replace("{date}", formatDate(date, locale))}. {copy.reassign.projectPointer}</dd>
          </dl>
        ) : null}
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ctr-btn" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}>{step === 0 ? copy.common.cancel : copy.common.back}</button>
          {step < 3 ? (
            <button type="button" className="ctr-btn is-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{copy.common.next}</button>
          ) : (
            <button type="button" className="ctr-btn is-danger" disabled={mutation.isPending || !next} onClick={() => { setError(null); mutation.mutate(); }}>{mutation.isPending ? copy.reassign.working : copy.reassign.confirm}</button>
          )}
        </div>
    </>
  );
}


/* ------------------------------------------------------------ dialog shells: the body mounts only while open, so every open starts clean */

type StatusProps = Common & { contractor: { id: string; name: string; updatedAt?: string | null }; target: StatusTarget; onDone?: () => void };
export function StatusDialog(props: StatusProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="sm:max-w-lg ctr-dialog"><StatusDialogBody {...props} /></DialogContent></Dialog>;
}

type AssignProps = Common & { contractor?: { id: string; name: string }; project?: { id: string; label: string }; onNeedReassign?: (projectId: string, assignmentId: string) => void };
export function AssignDialog(props: AssignProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="sm:max-w-lg ctr-dialog"><AssignDialogBody onOpenChange={props.onOpenChange} copy={props.copy} contractor={props.contractor} project={props.project} onNeedReassign={props.onNeedReassign} /></DialogContent></Dialog>;
}

type EndProps = Common & { projectId: string; assignment: Assignment; additional: Assignment[] };
export function EndAssignmentDialog(props: EndProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="sm:max-w-lg ctr-dialog"><EndAssignmentDialogBody {...props} /></DialogContent></Dialog>;
}

type ReassignProps = Common & { projectId: string; assignments: Assignment[]; initialAssignmentId?: string };
export function ReassignWizard(props: ReassignProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="sm:max-w-xl ctr-dialog"><ReassignWizardBody {...props} /></DialogContent></Dialog>;
}
