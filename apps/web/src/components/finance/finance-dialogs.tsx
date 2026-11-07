"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProjectContractors } from "@/lib/contractors/api";
import { createExpense, expenseAction, failureOf, paymentAction, previewGates, previewRevision, requestPayment, requestRevision, updateExpense, updatePayment, decideRevision } from "@/lib/finance/api";
import { formatLkr, minorToDecimal, parseAmount, percentFromBp } from "@/lib/finance/money";
import type { Copy } from "@/lib/finance/messages";
import { useFinanceKeys } from "@/lib/finance/session";
import { CATEGORIES, PAYMENT_TYPES, type Category, type Expense, type Gate, type Payment, type PaymentType } from "@/lib/finance/types";
import { failureText, fill } from "@/lib/finance/view";

import { GateChecklist, MoneyInput } from "./finance-ui";

type Common = { open: boolean; onOpenChange: (o: boolean) => void; copy: Copy; locale: AuthLocale };
const today = () => new Date().toISOString().slice(0, 10);
const reasonOk = (v: string) => v.trim().length >= 12;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="ctr-small">{hint}</p> : null}
      {error ? <p className="ctr-error" role="alert">{error}</p> : null}
    </div>
  );
}

/** Invalidate everything finance shows, plus the legacy recorded-payments summary on the project page and the contractor finance card. */
export function useRefreshFinance() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["finance"] }), qc.invalidateQueries({ queryKey: ["financial-progress"] }), qc.invalidateQueries({ queryKey: ["contractors"] })]);
}

const shell = (props: Common, body: React.ReactNode, wide = false) => (
  <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} ctr-dialog max-h-[90vh] overflow-y-auto`}>{body}</DialogContent></Dialog>
);

/* ------------------------------------------------------------------ reason dialog (reject, cancel, reverse, expense decisions) */

type ReasonProps = Common & { title: string; description?: string; label: string; hint?: string; confirm: string; danger?: boolean; run: (reason: string) => Promise<unknown>; errors: Record<string, string>; success: string; vars?: Record<string, string> };
function ReasonBody({ onOpenChange, copy, title, description, label, hint, confirm, danger, run, errors, success, vars }: ReasonProps) {
  const refresh = useRefreshFinance();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const m = useMutation({
    mutationFn: () => run(reason.trim()),
    onSuccess: () => { toast.success(success); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, errors, copy, { ...vars, ...(typeof f.details.existingPaymentNo === "string" ? { number: f.details.existingPaymentNo } : {}) })); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (reasonOk(reason)) m.mutate(); }}>
        <Field id={id} label={label} hint={hint} error={reason && !reasonOk(reason) ? copy.payments.reasonHint : null}>
          <textarea id={id} className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(reason) && !reasonOk(reason)} />
        </Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className={danger ? "ctr-btn is-danger" : "ctr-btn is-primary"} disabled={!reasonOk(reason) || m.isPending}>{m.isPending ? copy.common.working : confirm}</button>
        </div>
      </form>
    </>
  );
}
export function ReasonDialog(props: ReasonProps) { return shell(props, <ReasonBody {...props} />); }

/* ------------------------------------------------------------------ approve payment */

function ApproveBody({ onOpenChange, copy, locale, payment, gates }: Omit<Common, "open"> & { payment: Payment; gates: Gate[] }) {
  const refresh = useRefreshFinance();
  const warns = gates.filter((g) => g.status === "WARN");
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => paymentAction(payment.id, "approve", { ...(note.trim().length >= 12 ? { note: note.trim() } : {}), ...(warns.length ? { acknowledgeWarnings: ack } : {}) }),
    onSuccess: (r) => { toast.success(fill(copy.payments.approved1, { number: r.paymentNo ?? "" })); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, copy.payments.errors, copy)); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{copy.payments.approveDialog.title}</DialogTitle><DialogDescription>{payment.paymentNo} · {formatLkr(payment.amountMinor, locale)}</DialogDescription></DialogHeader>
      <GateChecklist gates={gates} copy={copy} locale={locale} />
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); m.mutate(); }}>
        {warns.length ? <label className="ctr-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{copy.payments.approveDialog.ack}</label> : null}
        <Field id="approve-note" label={copy.payments.approveDialog.note}><textarea id="approve-note" className="ctr-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {note && !reasonOk(note) ? <p className="ctr-error">{copy.payments.reasonHint}</p> : null}
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending || (warns.length > 0 && !ack) || gates.some((g) => g.status === "BLOCK") || (note.length > 0 && !reasonOk(note))}>{m.isPending ? copy.common.working : copy.payments.approve}</button>
        </div>
      </form>
    </>
  );
}
export function ApproveDialog(props: Common & { payment: Payment; gates: Gate[] }) { return shell(props, <ApproveBody onOpenChange={props.onOpenChange} copy={props.copy} locale={props.locale} payment={props.payment} gates={props.gates} />, true); }

/* ------------------------------------------------------------------ mark as paid */

function PaidBody({ onOpenChange, copy, locale, payment }: Omit<Common, "open"> & { payment: Payment }) {
  const refresh = useRefreshFinance();
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => paymentAction(payment.id, "mark-paid", { paidAt, paymentReference: reference.trim() }),
    onSuccess: (r) => { toast.success(fill(copy.payments.paid1, { number: r.paymentNo ?? "" })); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, copy.payments.errors, copy)); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{copy.payments.markPaidDialog.title}</DialogTitle><DialogDescription>{payment.paymentNo} · {formatLkr(payment.amountMinor, locale)}</DialogDescription></DialogHeader>
      <p className="fin-note" role="note">{copy.payments.markPaidDialog.note}</p>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (reference.trim() && paidAt) m.mutate(); }}>
        <Field id="paid-at" label={copy.payments.markPaidDialog.paidAt}><input id="paid-at" type="date" className="ctr-input" max={today()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <Field id="paid-ref" label={copy.payments.markPaidDialog.reference} hint={copy.payments.markPaidDialog.referenceHint}><input id="paid-ref" className="ctr-input" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" /></Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={!reference.trim() || !paidAt || m.isPending}>{m.isPending ? copy.common.working : copy.payments.markPaid}</button>
        </div>
      </form>
    </>
  );
}
export function MarkPaidDialog(props: Common & { payment: Payment }) { return shell(props, <PaidBody onOpenChange={props.onOpenChange} copy={props.copy} locale={props.locale} payment={props.payment} />); }

/* ------------------------------------------------------------------ budget revision request with live impact preview */

type AllocRow = { category: Category; amount: string };
function RevisionBody({ onOpenChange, copy, locale, projectId, currentTotalMinor }: Omit<Common, "open"> & { projectId: string; currentTotalMinor: number }) {
  const refresh = useRefreshFinance();
  const keys = useFinanceKeys();
  const [total, setTotal] = useState(minorToDecimal(currentTotalMinor));
  const [rows, setRows] = useState<AllocRow[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debounced, setDebounced] = useState<string>("");
  const t = parseAmount(total);
  const parsedRows = rows.map((r) => ({ category: r.category, p: parseAmount(r.amount) }));
  const rowsOk = parsedRows.every((r) => r.p.ok);
  const allocSum = parsedRows.reduce((s, r) => s + (r.p.ok ? BigInt(r.p.minor) : BigInt(0)), BigInt(0));
  const body = t.ok && rowsOk ? { newTotal: t.canonical, allocations: parsedRows.map((r) => ({ category: r.category, amount: (r.p as { canonical: string }).canonical })), reason: reasonOk(reason) ? reason.trim() : "Preview of a proposed budget revision" } : null;
  const signature = body ? JSON.stringify(body) : "";
  useEffect(() => { const id = setTimeout(() => setDebounced(signature), 350); return () => clearTimeout(id); }, [signature]);
  const preview = useQuery({ queryKey: keys.key("revpreview", projectId, debounced), queryFn: ({ signal }) => previewRevision(projectId, JSON.parse(debounced), signal), enabled: debounced !== "", retry: false });
  const unallocated = t.ok ? BigInt(t.minor) - allocSum : null;
  const blocking = preview.data?.blocking ?? [];
  const dup = new Set(rows.map((r) => r.category)).size !== rows.length;
  const canSubmit = Boolean(body) && reasonOk(reason) && !dup && blocking.length === 0 && (unallocated === null || unallocated >= BigInt(0)) && rows.length <= 15;
  const m = useMutation({
    mutationFn: () => requestRevision(projectId, body),
    onSuccess: () => { toast.success(copy.budget.dialog.submitted); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, { ...copy.budget.errors, BELOW_COMMITMENTS: copy.budget.impact.BELOW_COMMITMENTS }, copy, { amount: typeof (f.details.impact as { blocking?: { belowByMinor?: number }[] } | undefined)?.blocking?.[0]?.belowByMinor === "number" ? formatLkr((f.details.impact as { blocking: { belowByMinor: number }[] }).blocking[0]!.belowByMinor, locale) : "" })); },
  });
  const used = new Set(rows.map((r) => r.category));
  const free = CATEGORIES.filter((c) => !used.has(c));
  return (
    <>
      <DialogHeader><DialogTitle>{copy.budget.dialog.title}</DialogTitle><DialogDescription>{copy.budget.current}: {formatLkr(currentTotalMinor, locale)}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setError(null); if (canSubmit) m.mutate(); }}>
        <MoneyInput label={copy.budget.dialog.newTotal} value={total} onChange={setTotal} required copy={{ required: copy.common.required, money: copy.common.badAmount }} />
        <fieldset className="ctr-field" style={{ border: 0, padding: 0 }}>
          <legend className="ctr-label">{copy.budget.dialog.allocations}</legend>
          {rows.map((r, i) => (
            <div key={r.category} className="fin-alloc-row">
              <Field id={`alloc-c-${i}`} label={copy.budget.category}>
                <select id={`alloc-c-${i}`} className="ctr-input" value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value as Category } : x)))}>
                  {[r.category, ...free].map((c) => <option key={c} value={c}>{copy.category[c]}</option>)}
                </select>
              </Field>
              <MoneyInput label={copy.budget.allocated} value={r.amount} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: v } : x)))} copy={{ required: copy.common.required, money: copy.common.badAmount }} />
              <button type="button" className="ctr-btn is-ghost" aria-label={`${copy.common.remove} ${copy.category[r.category]}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2Icon aria-hidden="true" /></button>
            </div>
          ))}
          <div><button type="button" className="ctr-btn" disabled={!free.length || rows.length >= 15} onClick={() => setRows([...rows, { category: free[0]!, amount: "" }])}><PlusIcon aria-hidden="true" />{copy.budget.dialog.addAllocation}</button></div>
          {unallocated !== null ? <p className={unallocated < BigInt(0) ? "ctr-error" : "ctr-small"} role="status" aria-live="polite">{fill(copy.budget.dialog.unallocatedLive, { amount: unallocated < BigInt(0) ? `−${formatLkr(Number(-unallocated), locale)}` : formatLkr(Number(unallocated), locale) })}</p> : null}
        </fieldset>
        <section className="fin-gates" aria-label={copy.budget.impact.title} aria-live="polite">
          <h3>{copy.budget.impact.title}</h3>
          {preview.isFetching && !preview.data ? <p className="ctr-small">{copy.budget.impact.loading}</p> : null}
          {preview.data ? (
            <dl className="fin-impact">
              <dt>{copy.budget.impact.current}</dt><dd>{formatLkr(preview.data.currentTotalMinor, locale)}</dd>
              <dt>{copy.budget.impact.proposed}</dt><dd>{formatLkr(preview.data.proposedTotalMinor, locale)}</dd>
              <dt>{copy.budget.impact.committed}</dt><dd>{formatLkr(preview.data.committedMinor, locale)}</dd>
              <dt>{copy.budget.impact.paid}</dt><dd>{formatLkr(preview.data.paidMinor, locale)}</dd>
              <dt>{copy.budget.impact.utilization}</dt><dd>{percentFromBp(preview.data.newUtilizationBp)}</dd>
              <dt>{copy.budget.impact.remaining}</dt><dd>{formatLkr(preview.data.newRemainingMinor, locale)}</dd>
            </dl>
          ) : !preview.isFetching ? <p className="ctr-small">—</p> : null}
          {blocking.map((b) => <p key={b.code} className="ctr-error" role="alert">{(copy.budget.impact as Record<string, string>)[b.code] ? fill((copy.budget.impact as Record<string, string>)[b.code]!, { amount: formatLkr(b.belowByMinor ?? 0, locale) }) : copy.budget.impact.blocked}</p>)}
          {preview.data && !blocking.length ? <p className="ctr-small">{copy.budget.impact.ok}</p> : null}
        </section>
        <Field id="rev-reason" label={copy.budget.dialog.reason} hint={copy.budget.dialog.reasonHint} error={reason && !reasonOk(reason) ? copy.payments.reasonHint : null}><textarea id="rev-reason" className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={!canSubmit || m.isPending}>{m.isPending ? copy.common.working : copy.budget.dialog.submit}</button>
        </div>
      </form>
    </>
  );
}
export function RevisionDialog(props: Common & { projectId: string; currentTotalMinor: number }) { return shell(props, <RevisionBody onOpenChange={props.onOpenChange} copy={props.copy} locale={props.locale} projectId={props.projectId} currentTotalMinor={props.currentTotalMinor} />, true); }

/** Approve / reject / cancel a pending revision. Reject needs a note; the server also enforces maker-checker. */
export function RevisionDecisionDialog(props: Common & { projectId: string; revisionId: string; mode: "reject"; sequence: number }) {
  return (
    <ReasonDialog {...props} title={props.copy.budget.reject} label={props.copy.budget.note} hint={props.copy.budget.noteHint} confirm={props.copy.budget.reject} danger errors={props.copy.budget.errors} success={props.copy.budget.rejected}
      run={(note) => decideRevision(props.projectId, props.revisionId, "reject", { note })} />
  );
}

/* ------------------------------------------------------------------ payment request / edit */

type ProjectContractor = { id: string; name: string; assignmentId: string };
function PaymentFormBody({ onOpenChange, copy, locale, projectId, existing }: Omit<Common, "open"> & { projectId: string; existing?: Payment }) {
  const refresh = useRefreshFinance();
  const keys = useFinanceKeys();
  const [contractorId, setContractorId] = useState(existing?.contractor?.id ?? "");
  const [type, setType] = useState<PaymentType>(existing?.paymentType ?? "INTERIM");
  const [amount, setAmount] = useState(existing ? minorToDecimal(existing.amountMinor) : "");
  const [invoice, setInvoice] = useState(existing?.invoiceReference ?? "");
  const [date, setDate] = useState(existing ? existing.date.slice(0, 10) : today());
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [debounced, setDebounced] = useState("");

  const contractors = useQuery({ queryKey: keys.key("project-contractors", projectId), queryFn: () => fetchProjectContractors(projectId), retry: false });
  const options: ProjectContractor[] = (contractors.data?.rows ?? []).filter((r) => r.status === "ACTIVE" && r.contractor && r.contractor.status === "ACTIVE").map((r) => ({ id: r.contractor!.id, name: r.contractor!.name, assignmentId: r.id }));
  const unique = [...new Map(options.map((o) => [o.id, o])).values()];
  const a = parseAmount(amount);
  const live = contractorId && a.ok ? JSON.stringify({ projectId, contractorId, paymentType: type, amount: a.canonical, ...(invoice.trim() ? { invoiceReference: invoice.trim() } : {}), ...(unique.find((o) => o.id === contractorId) ? { assignmentId: unique.find((o) => o.id === contractorId)!.assignmentId } : {}) }) : "";
  useEffect(() => { const id = setTimeout(() => setDebounced(live), 350); return () => clearTimeout(id); }, [live]);
  const gates = useQuery({ queryKey: keys.key("gates", debounced), queryFn: ({ signal }) => previewGates(JSON.parse(debounced), signal), enabled: debounced !== "", retry: false });
  const blocked = gates.data ? !gates.data.canSubmit : false;
  const valid = Boolean(contractorId) && a.ok && invoice.trim().length > 0 && Boolean(date);
  const m = useMutation({
    mutationFn: () => {
      const body = { paymentType: type, amount: (a as { canonical: string }).canonical, invoiceReference: invoice.trim(), date, ...(description.trim() ? { description: description.trim() } : {}) };
      return existing ? updatePayment(existing.id, body) : requestPayment(projectId, { ...body, contractorId, ...(unique.find((o) => o.id === contractorId) ? { assignmentId: unique.find((o) => o.id === contractorId)!.assignmentId } : {}) });
    },
    onSuccess: (r) => { toast.success(existing ? copy.payments.updated1 : fill(copy.payments.requested1, { number: (r as { paymentNo?: string }).paymentNo ?? "" })); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind, copy.payments.errors, copy, { number: String(f.details.existingPaymentNo ?? "") })); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{existing ? copy.payments.form.editTitle : copy.payments.form.title}</DialogTitle><DialogDescription>{copy.recordingOnly}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setError(null); if (valid && !blocked) m.mutate(); }}>
        {!existing ? (
          <Field id="pay-contractor" label={copy.payments.form.contractor} hint={copy.payments.form.contractorHint} error={touched && !contractorId ? copy.expenses.errors.contractorInvalid : null}>
            <select id="pay-contractor" className="ctr-input" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              <option value="">—</option>
              {unique.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {contractors.data && unique.length === 0 ? <p className="ctr-error" role="status">{copy.payments.form.noContractors}</p> : null}
          </Field>
        ) : null}
        <div className="ctr-grid2">
          <Field id="pay-type" label={copy.payments.form.paymentType}><select id="pay-type" className="ctr-input" value={type} onChange={(e) => setType(e.target.value as PaymentType)}>{PAYMENT_TYPES.map((p) => <option key={p} value={p}>{copy.paymentType[p]}</option>)}</select></Field>
          <MoneyInput label={copy.payments.form.amount} value={amount} onChange={setAmount} required copy={{ required: copy.common.required, money: copy.common.badAmount }} />
          <Field id="pay-invoice" label={copy.payments.form.invoice} error={touched && !invoice.trim() ? copy.common.required : null}><input id="pay-invoice" className="ctr-input" maxLength={80} value={invoice} onChange={(e) => setInvoice(e.target.value)} autoComplete="off" /></Field>
          <Field id="pay-date" label={copy.payments.form.date}><input id="pay-date" type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field id="pay-desc" label={copy.payments.form.description}><textarea id="pay-desc" className="ctr-input" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {gates.data ? <GateChecklist gates={gates.data.gates} copy={copy} locale={locale} loading={gates.isFetching} /> : gates.isFetching ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
        {blocked ? <p className="ctr-error" role="alert">{copy.gates.submitBlocked}</p> : gates.data?.hasWarnings ? <p className="ctr-small">{copy.gates.submitWarn}</p> : null}
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending || blocked}>{m.isPending ? copy.common.working : existing ? copy.common.save : copy.payments.form.submit}</button>
        </div>
      </form>
    </>
  );
}
export function PaymentFormDialog(props: Common & { projectId: string; existing?: Payment }) { return shell(props, <PaymentFormBody onOpenChange={props.onOpenChange} copy={props.copy} locale={props.locale} projectId={props.projectId} existing={props.existing} />, true); }

/* ------------------------------------------------------------------ expense form */

function ExpenseFormBody({ onOpenChange, copy, projectId, existing }: Omit<Common, "open" | "locale"> & { projectId: string; existing?: Expense }) {
  const refresh = useRefreshFinance();
  const keys = useFinanceKeys();
  const [category, setCategory] = useState<Category>(existing?.category ?? "MATERIALS");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [date, setDate] = useState(existing ? existing.expenseDate.slice(0, 10) : today());
  const [amount, setAmount] = useState(existing ? minorToDecimal(existing.amountMinor) : "");
  const [supplier, setSupplier] = useState(existing?.supplierName ?? "");
  const [ref, setRef] = useState(existing?.supportingRef ?? "");
  const [contractorId, setContractorId] = useState(existing?.contractor?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const contractors = useQuery({ queryKey: keys.key("project-contractors", projectId), queryFn: () => fetchProjectContractors(projectId), retry: false });
  const list = [...new Map((contractors.data?.rows ?? []).filter((r) => r.contractor).map((r) => [r.contractor!.id, r.contractor!.name])).entries()];
  const a = parseAmount(amount);
  const valid = description.trim().length > 0 && ref.trim().length > 0 && a.ok && Boolean(date);
  const m = useMutation({
    mutationFn: () => {
      const body = { category, description: description.trim(), expenseDate: date, amount: (a as { canonical: string }).canonical, supportingRef: ref.trim(), ...(supplier.trim() ? { supplierName: supplier.trim() } : {}), ...(contractorId ? { contractorId } : {}) };
      return existing ? updateExpense(existing.id, body) : createExpense(projectId, body);
    },
    onSuccess: (r) => { const w = (r as { warnings?: string[] }).warnings ?? []; toast.success(existing ? copy.expenses.updated : fill(copy.expenses.created, { number: (r as { expenseNo?: string }).expenseNo ?? "" })); for (const x of w) toast.message((copy.expenses.warnings as Record<string, string>)[x] ?? x); void refresh(); onOpenChange(false); },
    onError: (e) => { const f = failureOf(e); setError(failureText(f.status, f.kind === "VALIDATION_ERROR" ? null : f.kind, copy.expenses.errors, copy, { number: String(f.details.existingExpenseNo ?? "") }) ); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{existing ? copy.expenses.form.editTitle : copy.expenses.form.title}</DialogTitle><DialogDescription>{copy.expenses.form.documentsNote}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setError(null); if (valid) m.mutate(); }}>
        <div className="ctr-grid2">
          <Field id="exp-cat" label={copy.expenses.category}><select id="exp-cat" className="ctr-input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c} value={c}>{copy.category[c]}</option>)}</select></Field>
          <Field id="exp-date" label={copy.expenses.date}><input id="exp-date" type="date" className="ctr-input" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <MoneyInput label={copy.expenses.amount} value={amount} onChange={setAmount} required copy={{ required: copy.common.required, money: copy.common.badAmount }} />
          <Field id="exp-ref" label={copy.expenses.supportingRef} error={touched && !ref.trim() ? copy.common.required : null}><input id="exp-ref" className="ctr-input" maxLength={80} value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" /></Field>
          <Field id="exp-sup" label={copy.expenses.supplier}><input id="exp-sup" className="ctr-input" maxLength={120} value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
          <Field id="exp-con" label={copy.expenses.contractor} hint={copy.expenses.form.contractorHint}><select id="exp-con" className="ctr-input" value={contractorId} onChange={(e) => setContractorId(e.target.value)}><option value="">{copy.expenses.form.noContractor}</option>{list.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
        </div>
        <Field id="exp-desc" label={copy.expenses.description} error={touched && !description.trim() ? copy.common.required : null}><textarea id="exp-desc" className="ctr-input" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending}>{m.isPending ? copy.common.working : copy.expenses.save}</button>
        </div>
      </form>
    </>
  );
}
export function ExpenseFormDialog(props: Common & { projectId: string; existing?: Expense }) { return shell(props, <ExpenseFormBody onOpenChange={props.onOpenChange} copy={props.copy} projectId={props.projectId} existing={props.existing} />, true); }

export { expenseAction, paymentAction };
