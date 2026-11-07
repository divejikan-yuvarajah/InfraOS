"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AuthLocale } from "@/lib/auth/types";
import { formatDate, formatDateTime } from "@/lib/contractors/format";
import { expenseAction, failureOf, fetchExpense, fetchPayment, paymentAction } from "@/lib/finance/api";
import { formatLkr } from "@/lib/finance/money";
import type { Copy } from "@/lib/finance/messages";
import { useFinanceKeys } from "@/lib/finance/session";
import type { Expense, Payment } from "@/lib/finance/types";
import { failureText, fill } from "@/lib/finance/view";

import { ApproveDialog, ExpenseFormDialog, MarkPaidDialog, PaymentFormDialog, ReasonDialog, useRefreshFinance } from "./finance-dialogs";
import { ExpenseChip, GateChecklist, MoneyText, PaymentChip, PaymentStepper, RecordingNote } from "./finance-ui";

type Common = { copy: Copy; locale: AuthLocale };

/* ------------------------------------------------------------------ tables */

export function PaymentsTable({ rows, copy, locale, onOpen, showProject, flashId }: Common & { rows: Payment[]; onOpen: (id: string) => void; showProject?: boolean; flashId?: string | null }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="fin-table is-cards" aria-label={copy.payments.title}>
        <thead>
          <tr>
            <th scope="col">{copy.payments.number}</th>{showProject ? <th scope="col">{copy.payments.project}</th> : null}<th scope="col">{copy.payments.contractor}</th><th scope="col">{copy.payments.type}</th>
            <th scope="col" className="fin-right">{copy.payments.amount}</th><th scope="col">{copy.payments.status}</th><th scope="col">{copy.payments.invoice}</th><th scope="col">{copy.payments.date}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={flashId === p.id ? "is-flash" : undefined}>
              <td><button type="button" className="fin-row-btn" onClick={() => onOpen(p.id)}>{p.paymentNo ?? copy.common.unknown}</button></td>
              {showProject ? <td><Link href={`/projects/${p.projectId}/finance`} className="ctr-code">{p.project.code}</Link></td> : null}
              <td>{p.contractor?.name ?? "—"}</td><td>{copy.paymentType[p.paymentType]}</td>
              <td className="fin-right"><MoneyText minor={p.amountMinor} locale={locale} /></td>
              <td><div style={{ display: "grid", gap: "0.3rem" }}><PaymentChip status={p.status} copy={copy} /><PaymentStepper status={p.status} copy={copy} compact /></div></td>
              <td className="ctr-code">{p.invoiceReference ?? "—"}</td><td>{formatDate(p.date, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExpensesTable({ rows, copy, locale, onOpen, showProject }: Common & { rows: Expense[]; onOpen: (id: string) => void; showProject?: boolean }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="fin-table is-cards" aria-label={copy.expenses.title}>
        <thead>
          <tr>
            <th scope="col">{copy.expenses.number}</th>{showProject ? <th scope="col">{copy.payments.project}</th> : null}<th scope="col">{copy.expenses.description}</th><th scope="col">{copy.expenses.category}</th>
            <th scope="col" className="fin-right">{copy.expenses.amount}</th><th scope="col">{copy.expenses.status}</th><th scope="col">{copy.expenses.supportingRef}</th><th scope="col">{copy.expenses.date}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td><button type="button" className="fin-row-btn" onClick={() => onOpen(e.id)}>{e.expenseNo}</button></td>
              {showProject ? <td><Link href={`/projects/${e.projectId}/finance`} className="ctr-code">{e.project.code}</Link></td> : null}
              <td className="ctr-wrap">{e.description}</td><td>{copy.category[e.category]}</td>
              <td className="fin-right"><MoneyText minor={e.amountMinor} locale={locale} /></td><td><ExpenseChip status={e.status} copy={copy} /></td>
              <td className="ctr-code">{e.supportingRef}</td><td>{formatDate(e.expenseDate, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ payment drawer */

type PayDialog = null | "approve" | "reject" | "cancel" | "paid" | "reverse" | "edit";

export function PaymentDrawer({ id, onClose, copy, locale }: Common & { id: string | null; onClose: () => void }) {
  const keys = useFinanceKeys();
  const [dialog, setDialog] = useState<PayDialog>(null);
  const q = useQuery({ queryKey: keys.key("payment", id ?? ""), queryFn: () => fetchPayment(id!), enabled: Boolean(id), retry: false });
  const p = q.data;
  const act = (action: string) => (reason: string) => paymentAction(p!.id, action as "reject", action === "reject" ? { note: reason } : { reason });
  return (
    <Sheet open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{p?.paymentNo ?? copy.payments.title}</SheetTitle><SheetDescription>{p ? `${p.project.code} · ${p.contractor?.name ?? ""}` : copy.common.loading}</SheetDescription></SheetHeader>
        <div className="fin-drawer-body">
          {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
          {q.error ? <div role="alert"><p className="ctr-error">{copy.payments.detailLoadFailed}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
          {p ? (
            <>
              <div className="ctr-row" style={{ justifyContent: "space-between" }}><MoneyText minor={p.amountMinor} locale={locale} /><PaymentChip status={p.status} copy={copy} /></div>
              <PaymentStepper status={p.status} copy={copy} who={{ requested: p.createdBy, approved: p.approvedBy, paid: p.paidBy, reversed: p.reversal?.by ?? null }} />
              {(p.status === "PENDING" || p.status === "APPROVED") && p.gates.length ? <GateChecklist gates={p.gates} copy={copy} locale={locale} /> : null}
              <dl className="fin-kv">
                <dt>{copy.payments.project}</dt><dd><Link href={`/projects/${p.projectId}/finance`}>{p.project.code} {p.project.title}</Link></dd>
                <dt>{copy.payments.contractor}</dt><dd>{p.contractor ? <Link href={`/contractors/${p.contractor.id}`}>{p.contractor.name}</Link> : "—"}</dd>
                <dt>{copy.payments.type}</dt><dd>{copy.paymentType[p.paymentType]}</dd>
                <dt>{copy.payments.invoice}</dt><dd className="ctr-code">{p.invoiceReference ?? copy.common.notProvided}</dd>
                <dt>{copy.payments.date}</dt><dd>{formatDate(p.date, locale)}</dd>
                {p.description ? <><dt>{copy.payments.description}</dt><dd>{p.description}</dd></> : null}
                {p.paymentReference ? <><dt>{copy.payments.paymentRef}</dt><dd className="ctr-code">{p.paymentReference}</dd></> : null}
                {p.paidAt ? <><dt>{copy.payments.paidOn}</dt><dd>{formatDate(p.paidAt, locale)}</dd></> : null}
                {p.decisionNote ? <><dt>{copy.payments.decision}</dt><dd>{p.decisionNote}</dd></> : null}
                {p.cancelReason ? <><dt>{copy.payments.cancel}</dt><dd>{p.cancelReason}</dd></> : null}
                {p.reversal ? <><dt>{copy.payments.reverse}</dt><dd>{p.reversal.reason}</dd></> : null}
              </dl>
              {p.contractCap ? (
                <section aria-label={copy.payments.contractCap}>
                  <p className="ctr-label">{copy.payments.contractCap}</p>
                  {p.contractCap.contractValueMinor === null ? <p className="ctr-small">{copy.workspace.noContractValue}</p> : (
                    <>
                      <div className="fin-bar" role="img" aria-label={fill(copy.payments.capUsed, { used: formatLkr(p.contractCap.cumulativeMinor, locale), cap: formatLkr(p.contractCap.contractValueMinor, locale) })}>
                        <b className={p.contractCap.cumulativeMinor > p.contractCap.contractValueMinor ? "is-spent is-over" : "is-fin"} style={{ width: `${Math.min(100, Number((BigInt(p.contractCap.cumulativeMinor) * BigInt(100)) / BigInt(p.contractCap.contractValueMinor)))}%`, background: p.contractCap.cumulativeMinor > p.contractCap.contractValueMinor ? "var(--infra-maroon)" : undefined }} />
                      </div>
                      <p className="ctr-small">{fill(copy.payments.capUsed, { used: formatLkr(p.contractCap.cumulativeMinor, locale), cap: formatLkr(p.contractCap.contractValueMinor, locale) })}</p>
                    </>
                  )}
                </section>
              ) : null}
              <section aria-label={copy.payments.timeline}>
                <p className="ctr-label">{copy.payments.timeline}</p>
                <ol className="fin-timeline">
                  {p.timeline.map((t, i) => (
                    <li key={`${t.action}-${i}`}>
                      <strong>{(copy.payments.actionNames as Record<string, string>)[t.action] ?? t.action}</strong>
                      <span className="ctr-small">{formatDateTime(t.at, locale)}{t.by ? ` · ${fill(copy.stepper.by, { name: t.by })}` : ""}</span>
                      {t.note ? <span className="ctr-small ctr-wrap">{t.note}</span> : null}
                    </li>
                  ))}
                </ol>
              </section>
              <div className="ctr-row">
                {p.can.approve ? <button type="button" className="ctr-btn is-primary" onClick={() => setDialog("approve")}>{copy.payments.approve}</button> : null}
                {p.can.reject ? <button type="button" className="ctr-btn" onClick={() => setDialog("reject")}>{copy.payments.reject}</button> : null}
                {p.can.markPaid ? <button type="button" className="ctr-btn is-primary" onClick={() => setDialog("paid")}>{copy.payments.markPaid}</button> : null}
                {p.can.edit ? <button type="button" className="ctr-btn" onClick={() => setDialog("edit")}>{copy.payments.edit}</button> : null}
                {p.can.cancel ? <button type="button" className="ctr-btn" onClick={() => setDialog("cancel")}>{copy.payments.cancel}</button> : null}
                {p.can.reverse ? <button type="button" className="ctr-btn is-danger" onClick={() => setDialog("reverse")}>{copy.payments.reverse}</button> : null}
              </div>
              {p.status === "PENDING" && !p.can.approve && !p.can.reject ? <p className="ctr-small">{copy.payments.own}</p> : null}
              <RecordingNote copy={copy} />
              {dialog === "approve" ? <ApproveDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} payment={p} gates={p.gates} /> : null}
              {dialog === "paid" ? <MarkPaidDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} payment={p} /> : null}
              {dialog === "edit" ? <PaymentFormDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} projectId={p.projectId} existing={p} /> : null}
              {dialog === "reject" ? <ReasonDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} title={copy.payments.reject} label={copy.payments.reason} hint={copy.payments.reasonHint} confirm={copy.payments.reject} danger run={act("reject")} errors={copy.payments.errors} success={fill(copy.payments.rejected1, { number: p.paymentNo ?? "" })} /> : null}
              {dialog === "cancel" ? <ReasonDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} title={copy.payments.cancel} label={copy.payments.reason} hint={copy.payments.reasonHint} confirm={copy.payments.cancel} danger run={act("cancel")} errors={copy.payments.errors} success={fill(copy.payments.cancelled1, { number: p.paymentNo ?? "" })} /> : null}
              {dialog === "reverse" ? <ReasonDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} title={copy.payments.reverse} description={p.paymentNo ?? ""} label={copy.payments.reason} hint={copy.payments.reasonHint} confirm={copy.payments.reverse} danger run={act("reverse")} errors={copy.payments.errors} success={fill(copy.payments.reversed1, { number: p.paymentNo ?? "" })} /> : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ expense drawer */

type ExpDialog = null | "edit" | "reject" | "reverse";

export function ExpenseDrawer({ id, onClose, copy, locale }: Common & { id: string | null; onClose: () => void }) {
  const keys = useFinanceKeys();
  const refresh = useRefreshFinance();
  const [dialog, setDialog] = useState<ExpDialog>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: keys.key("expense", id ?? ""), queryFn: () => fetchExpense(id!), enabled: Boolean(id), retry: false });
  const e = q.data;
  const simple = useMutation({
    mutationFn: (action: "submit" | "verify") => expenseAction(e!.id, action),
    onSuccess: (r, action) => { toast.success(fill(action === "submit" ? copy.expenses.submitted : copy.expenses.verified, { number: r.expenseNo })); void refresh(); },
    onError: (err) => { const f = failureOf(err); setError(failureText(f.status, f.kind, copy.expenses.errors, copy, { number: String(f.details.existingExpenseNo ?? "") })); },
  });
  return (
    <Sheet open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{e?.expenseNo ?? copy.expenses.title}</SheetTitle><SheetDescription>{e ? `${e.project.code} · ${copy.category[e.category]}` : copy.common.loading}</SheetDescription></SheetHeader>
        <div className="fin-drawer-body">
          {q.isLoading ? <p className="ctr-small" role="status">{copy.common.loading}</p> : null}
          {q.error ? <div role="alert"><p className="ctr-error">{copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
          {e ? (
            <>
              <div className="ctr-row" style={{ justifyContent: "space-between" }}><MoneyText minor={e.amountMinor} locale={locale} /><ExpenseChip status={e.status} copy={copy} /></div>
              <dl className="fin-kv">
                <dt>{copy.payments.project}</dt><dd><Link href={`/projects/${e.projectId}/finance`}>{e.project.code} {e.project.title}</Link></dd>
                <dt>{copy.expenses.description}</dt><dd>{e.description}</dd>
                <dt>{copy.expenses.date}</dt><dd>{formatDate(e.expenseDate, locale)}</dd>
                <dt>{copy.expenses.supplier}</dt><dd>{e.supplierName ?? copy.common.notProvided}</dd>
                <dt>{copy.expenses.supportingRef}</dt><dd className="ctr-code">{e.supportingRef}</dd>
                {e.contractor ? <><dt>{copy.expenses.contractor}</dt><dd><Link href={`/contractors/${e.contractor.id}`}>{e.contractor.name ?? ""}</Link></dd></> : null}
                <dt>{copy.expenses.createdBy}</dt><dd>{e.createdBy ?? "—"}</dd>
                {e.verifiedBy ? <><dt>{copy.expenses.verifiedBy}</dt><dd>{e.verifiedBy} · {formatDate(e.verifiedAt, locale)}</dd></> : null}
              </dl>
              {e.rejectionReason ? <p className="ctr-note">{fill(copy.expenses.rejectedWhy, { reason: e.rejectionReason })}</p> : null}
              {e.reversal ? <p className="ctr-note">{fill(copy.expenses.reversedBy, { name: e.reversal.by ?? "", reason: e.reversal.reason })}</p> : null}
              {e.status === "PENDING_VERIFICATION" && !e.can.verify ? <p className="ctr-small">{copy.expenses.own}</p> : null}
              {error ? <p className="ctr-error" role="alert">{error}</p> : null}
              <div className="ctr-row">
                {e.can.submit ? <button type="button" className="ctr-btn is-primary" disabled={simple.isPending} onClick={() => { setError(null); simple.mutate("submit"); }}>{copy.expenses.submit}</button> : null}
                {e.can.verify ? <button type="button" className="ctr-btn is-primary" disabled={simple.isPending} onClick={() => { setError(null); simple.mutate("verify"); }}>{copy.expenses.verify}</button> : null}
                {e.can.reject ? <button type="button" className="ctr-btn" onClick={() => setDialog("reject")}>{copy.expenses.reject}</button> : null}
                {e.can.edit ? <button type="button" className="ctr-btn" onClick={() => setDialog("edit")}>{copy.expenses.edit}</button> : null}
                {e.can.reverse ? <button type="button" className="ctr-btn is-danger" onClick={() => setDialog("reverse")}>{copy.expenses.reverse}</button> : null}
              </div>
              {dialog === "edit" ? <ExpenseFormDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} projectId={e.projectId} existing={e} /> : null}
              {dialog === "reject" ? <ReasonDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} title={copy.expenses.reject} label={copy.expenses.reason} hint={copy.expenses.reasonHint} confirm={copy.expenses.reject} danger run={(reason) => expenseAction(e.id, "reject", { reason })} errors={copy.expenses.errors} success={fill(copy.expenses.rejected, { number: e.expenseNo })} /> : null}
              {dialog === "reverse" ? <ReasonDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} title={copy.expenses.reverse} description={e.expenseNo} label={copy.expenses.reason} hint={copy.expenses.reasonHint} confirm={copy.expenses.reverse} danger run={(reason) => expenseAction(e.id, "reverse", { reason })} errors={copy.expenses.errors} success={fill(copy.expenses.reversed, { number: e.expenseNo })} /> : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
