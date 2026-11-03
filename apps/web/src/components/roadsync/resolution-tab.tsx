"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangleIcon, BanIcon, CheckCircle2Icon, CircleDotIcon, ClockIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { fmt } from "@/lib/roadsync/assessment";
import {
  applyAmendment, approveStep, cancelAmendment, cancelResolution, commitmentAction, confirmParty, contestResolution, createResolution, fetchConflictResolution, fetchResolutionSuggestions,
  preflightAmendment, previewResolutionImpact, reassessResolution, rejectStep, reopenResolved, submitAmendment,
} from "@/lib/roadsync/resolution-api";
import {
  JUSTIFICATION_MIN, MITIGATION_CODES, NO_ACTION_CODES, RAIL, REASON_MIN, isClosed, railIndex, toIso, toLocalInput,
  type AmendmentView, type ApprovalView, type ChangeInput, type ConflictResolution, type CreateResolutionBody, type DateSpan, type ImpactPreview, type ResolutionSuggestions, type ResolutionType, type ResolutionView, type ThirdParty, type WorkingHours,
} from "@/lib/roadsync/resolution";
import { getResolutionCopy, type ResolutionCopy } from "@/lib/roadsync/resolution-copy";
import { getSimCopy } from "@/lib/roadsync/simulator-copy";
import { getAdvisorCopy } from "@/lib/roadsync/advisor-copy";
import { clearHandoff, useHandoff, type Handoff } from "@/lib/roadsync/advisor";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";
import type { AuthLocale } from "@/lib/auth/types";

import { ConfirmDialog } from "./work-request-dialogs";
import "@/styles/mission-control-roadsync-resolution.css";

/** Readable names for work requests, taken from the already-authorized dossier parties; falls back to an id suffix. */
export type PartyLabel = { id: string; ref: string; agencyName: string | null };
const labelOf = (parties: PartyLabel[], id: string) => { const p = parties.find((x) => x.id === id); return p ? `${p.ref}${p.agencyName ? ` · ${p.agencyName}` : ""}` : `…${id.slice(-6)}`; };

export function useRoadsyncKeys() {
  const roleKey = useSyncExternalStore(subscribeAuth, () => getMemorySession()?.user.roleKey ?? "", () => "");
  const userId = useSyncExternalStore(subscribeAuth, () => getMemorySession()?.user.id ?? "", () => "");
  const epoch = useSyncExternalStore(subscribeAuth, () => String(getAuthEpoch()), () => "");
  return { roleKey, userId, epoch, key: (scope: string, id: string) => workRequestQueryKey(epoch, userId, roleKey, scope, id) };
}

export const whenFmt = (locale: string, v: string | null) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(v)) : "—");
const dayFmt = (locale: string, v: string | null) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(v)) : "—");

/** Maps a failed write to one honest sentence. A 409 means stale data: the caller refreshes. */
export function failText(error: unknown, copy: ResolutionCopy): { text: string; stale: boolean } {
  if (error instanceof ApiError && error.status === 409) return { text: copy.stale, stale: true };
  if (error instanceof ApiError && error.status === 403) return { text: copy.forbidden, stale: false };
  if (error instanceof ApiError && error.status === 404) return { text: copy.notFound, stale: false };
  return { text: copy.failed, stale: false };
}

type Dlg =
  | { kind: "cancel" } | { kind: "contest" } | { kind: "reopen" } | { kind: "confirm" } | { kind: "reassess" }
  | { kind: "approve"; step: ApprovalView; am: AmendmentView | null } | { kind: "reject"; step: ApprovalView; am: AmendmentView | null }
  | { kind: "waive"; id: string } | { kind: "cancelAm"; am: AmendmentView } | { kind: "submitAm"; am: AmendmentView } | { kind: "applyAm"; am: AmendmentView } | null;

/** Reopen is offered only when the server says `canReopen` (national, resolved record); the server re-checks on write. */
export function ResolutionTab({ conflictId, locale, parties }: { conflictId: string; locale: AuthLocale; parties: PartyLabel[] }) {
  const copy = getResolutionCopy(locale);
  const qc = useQueryClient();
  const keys = useRoadsyncKeys();
  const [toast, setToast] = useState<string | null>(null);
  const handoff = useHandoff("resolution", conflictId);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [busy, setBusy] = useState(false);
  const key = keys.key("conflict-resolution", conflictId);
  const q = useQuery({ queryKey: key, queryFn: () => fetchConflictResolution(conflictId), enabled: Boolean(keys.userId), retry: false, refetchOnWindowFocus: true });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: keys.key("conflict-dossier", conflictId) });
    void qc.invalidateQueries({ queryKey: keys.key("conflict-history", conflictId) });
    void qc.invalidateQueries({ queryKey: keys.key("approvals", "queue") });
  };
  /** One runner for every write: server decides; UI only reports and refreshes. */
  const run = async (fn: () => Promise<unknown>, ok = copy.done) => {
    setBusy(true);
    try { await fn(); setToast(ok); setDlg(null); } catch (error) { const f = failText(error, copy); setToast(f.text); if (f.stale) setDlg(null); } finally { setBusy(false); refresh(); }
  };

  if (q.isPending) return <p className="rs-help" role="status">{copy.loading}</p>;
  if (q.isError) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    return <div className="rz-state" role="alert"><AlertTriangleIcon aria-hidden="true" /><p>{status === 403 ? copy.forbidden : status === 404 ? copy.notFound : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div>;
  }
  const data: ConflictResolution = q.data;
  const res = data.resolution;

  return (
    <div className="rz">
      {handoff ? <p className="rz-toast" role="note">{fmt(getAdvisorCopy(locale).banner, { recNo: handoff.banner.recNo })}</p> : null}
      <p className="rs-help">{copy.demoNote}</p>
      <Link className="rs-btn" href={`/roadsync/conflicts/${conflictId}/lab`}>{getSimCopy(locale).open}</Link>
      {toast ? <p className="rz-toast" role="status">{toast}</p> : null}
      {res && isClosed(res.status) && data.canStart ? <StartForm key={handoff ? "p" : "n"} prefill={handoff} conflictId={conflictId} copy={copy} parties={parties} onCreated={(m) => { clearHandoff(); setToast(m); refresh(); }} /> : null}
      {res ? <Workspace res={res} copy={copy} locale={locale} busy={busy} setDlg={setDlg} run={run} /> : data.canStart ? <StartForm key={handoff ? "p" : "n"} prefill={handoff} conflictId={conflictId} copy={copy} parties={parties} onCreated={(m) => { clearHandoff(); setToast(m); refresh(); }} /> : <p className="rz-empty">{data.recordStatus === "resolved" || data.recordStatus === "dismissed" ? copy.start.closedRecord : copy.start.unavailable}</p>}
      {data.canReopen ? <button type="button" className="rs-btn" onClick={() => setDlg({ kind: "reopen" })}>{copy.actions.reopen}</button> : null}
      <section className="rz-sec"><h3>{copy.sec.past}</h3>
        {data.history.length === 0 ? <p className="rs-help">{copy.f.noPast}</p> : (
          <ul className="rz-past">{data.history.map((h) => <li key={h.id}><code>{h.resolutionNo}</code><span className="rs-nb-chip">{copy.types[h.type]}</span><span className="rz-chip" data-status={h.status}>{copy.status[h.status]}</span>{h.outcome ? <span className="rs-help">{copy.outcome[h.outcome] ?? h.outcome}</span> : null}<span className="rs-help">{dayFmt(locale, h.closedAt)}</span></li>)}</ul>
        )}
      </section>
      {dlg ? <Dialogs dlg={dlg} res={res} recordVersion={data.recordVersion} national={data.national} conflictId={conflictId} copy={copy} busy={busy} onClose={() => setDlg(null)} run={run} /> : null}
    </div>
  );
}

// ---------- dialogs: every one re-checks on the server; the UI only collects input ----------
function Dialogs({ dlg, res, recordVersion, national, conflictId, copy, busy, onClose, run }: { dlg: NonNullable<Dlg>; res: ResolutionView | null; recordVersion: number; national: boolean; conflictId: string; copy: ResolutionCopy; busy: boolean; onClose: () => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const v = res?.version ?? 1;
  const reasonSpec = (label: string) => ({ label, help: copy.dlg.reasonLabel.replace("{n}", String(REASON_MIN)), min: REASON_MIN });
  const common = { keepLabel: copy.close, pending: busy, onClose };
  if (dlg.kind === "cancel" && res) return <ConfirmDialog {...common} title={copy.dlg.cancelTitle} body={res.resolutionNo} confirmLabel={copy.actions.cancel} tone="danger" reason={reasonSpec(copy.f.reason)} onConfirm={(reason) => void run(() => cancelResolution(res.id, { version: v, reason }))} />;
  if (dlg.kind === "contest" && res) return <ConfirmDialog {...common} title={copy.dlg.contestTitle} body={res.resolutionNo} confirmLabel={copy.actions.contest} tone="danger" reason={reasonSpec(copy.f.reason)} onConfirm={(reason) => void run(() => contestResolution(res.id, { version: v, reason }))} />;
  if (dlg.kind === "reopen") return <ConfirmDialog {...common} title={copy.dlg.reopenTitle} body={copy.dlg.reopenTitle} confirmLabel={copy.actions.reopen} reason={reasonSpec(copy.f.reason)} onConfirm={(reason) => void run(() => reopenResolved(conflictId, { version: recordVersion, reason }))} />;
  if (dlg.kind === "confirm" && res) return <ConfirmDialog {...common} title={copy.actions.confirm} body={copy.dlg.confirmParty} confirmLabel={copy.actions.confirm} onConfirm={() => void run(() => confirmParty(res.id, { version: v }))} />;
  if (dlg.kind === "reassess" && res) return <ConfirmDialog {...common} title={copy.actions.reassess} body={res.resolutionNo} confirmLabel={copy.actions.reassess} onConfirm={() => void run(() => reassessResolution(res.id))} />;
  if (dlg.kind === "waive" && res) { const id = dlg.id; return <ConfirmDialog {...common} title={copy.dlg.waiveTitle} body={copy.dlg.waiveTitle} confirmLabel={copy.actions.waive} reason={reasonSpec(copy.f.reason)} onConfirm={(reason) => void run(() => commitmentAction(res.id, id, { action: "waive", reason }))} />; }
  if ((dlg.kind === "approve" || dlg.kind === "reject") && res) {
    const { step, am } = dlg;
    // National acts on behalf of the owning agency for agency-level steps; the server requires and records the reason.
    const onBehalf = national && step.agencyId ? { onBehalfOfAgencyId: step.agencyId } : {};
    const behalfNeeded = Object.keys(onBehalf).length > 0;
    if (dlg.kind === "reject") return <ConfirmDialog {...common} title={copy.dlg.rejectTitle} body={am?.amendmentNo ?? res.resolutionNo} confirmLabel={copy.actions.reject} tone="danger" reason={{ label: copy.dlg.rejectNote.replace("{n}", String(REASON_MIN)), help: behalfNeeded ? copy.start.behalfNote : copy.dlg.reasonLabel.replace("{n}", String(REASON_MIN)), min: REASON_MIN }} onConfirm={(t) => void run(() => rejectStep(res.id, step.id, { version: v, note: t, ...onBehalf, ...(behalfNeeded ? { reason: t } : {}) }))} />;
    return behalfNeeded
      ? <ConfirmDialog {...common} title={copy.dlg.confirmApprove} body={am?.amendmentNo ?? res.resolutionNo} confirmLabel={copy.actions.approve} reason={reasonSpec(copy.start.behalfNote)} onConfirm={(t) => void run(() => approveStep(res.id, step.id, { version: v, ...onBehalf, reason: t }))} />
      : <ConfirmDialog {...common} title={copy.dlg.confirmApprove} body={am?.amendmentNo ?? res.resolutionNo} confirmLabel={copy.actions.approve} onConfirm={() => void run(() => approveStep(res.id, step.id, { version: v }))} />;
  }
  if ((dlg.kind === "cancelAm" || dlg.kind === "submitAm" || dlg.kind === "applyAm") && res) {
    const am = dlg.am;
    const behalf = national || !am.mine;
    const spec = behalf ? reasonSpec(copy.start.behalfNote) : undefined;
    const withB = (t: string) => (behalf ? { onBehalfOfAgencyId: am.agencyId, reason: t } : {});
    if (dlg.kind === "cancelAm") return <ConfirmDialog {...common} title={copy.actions.cancelAm} body={am.amendmentNo} confirmLabel={copy.actions.cancelAm} tone="danger" onConfirm={() => void run(() => cancelAmendment(res.id, am.id))} />;
    if (dlg.kind === "submitAm") return <ConfirmDialog {...common} title={copy.actions.submitAm} body={am.amendmentNo} confirmLabel={copy.actions.submitAm} {...(spec ? { reason: spec } : {})} onConfirm={(t) => void run(() => submitAmendment(res.id, am.id, withB(t)))} />;
    return <ConfirmDialog {...common} title={copy.actions.applyAm} body={am.amendmentNo} confirmLabel={copy.actions.applyAm} {...(spec ? { reason: spec } : {})} onConfirm={(t) => void run(() => applyAmendment(res.id, am.id, withB(t)))} />;
  }
  return null;
}

// ---------- workspace ----------
function Workspace({ res, copy, locale, busy, setDlg, run }: { res: ResolutionView; copy: ResolutionCopy; locale: AuthLocale; busy: boolean; setDlg: (d: Dlg) => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const allowed = new Set(res.allowed);
  const closed = isClosed(res.status);
  const planAm = res.amendments;
  const stepBy = (am: AmendmentView) => res.approvals.find((s) => s.amendmentId === am.id && s.status === "pending") ?? null;
  const resLevel = res.approvals.filter((s) => !s.amendmentId);
  const resStepPending = resLevel.find((s) => s.status === "pending" && (s.step === "national" || s.step === "national_second")) ?? null;
  return (
    <>
      <header className="rz-head">
        <div className="rz-head-main">
          <code>{res.resolutionNo}</code><span className="rs-nb-chip">{copy.types[res.type]}</span><span className="rz-chip" data-status={res.status}>{copy.status[res.status]}</span>
          {res.contested ? <span className="rz-chip" data-status="contested"><AlertTriangleIcon aria-hidden="true" />{copy.f.contested}</span> : null}
        </div>
        <p className="rs-help">{fmt(copy.f.initiator, { agency: res.initiator.agencyName ?? "—" })}{res.initiator.onBehalf ? ` · ${copy.f.onBehalf}` : ""} · {whenFmt(locale, res.createdAt)}</p>
        {res.contested ? <p className="rz-warn" role="note">{copy.f.contestedBody}{res.contested.reason ? ` ${res.contested.reason}` : ""}</p> : null}
        <Rail status={res.status} copy={copy} />
        {closed ? <p className="rs-help">{copy.f.readOnlyClosed}</p> : null}
        <div className="rz-actions" role="group" aria-label={copy.tab}>
          {allowed.has("confirm") ? <button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => setDlg({ kind: "confirm" })}>{copy.actions.confirm}</button> : null}
          {resStepPending && allowed.has("approve") ? <><button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => setDlg({ kind: "approve", step: resStepPending, am: null })}>{copy.actions.approve}</button><button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "reject", step: resStepPending, am: null })}>{copy.actions.reject}</button></> : null}
          {allowed.has("reassess") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "reassess" })}>{copy.actions.reassess}</button> : null}
          {allowed.has("contest") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "contest" })}>{copy.actions.contest}</button> : null}
          {allowed.has("cancel") ? <button type="button" className="rs-btn is-danger" disabled={busy} onClick={() => setDlg({ kind: "cancel" })}>{copy.actions.cancel}</button> : null}
        </div>
        {res.status === "needs_followup" && (allowed.has("add_amendment") || allowed.has("accept_residual_risk")) ? <p className="rz-warn" role="note">{allowed.has("add_amendment") ? copy.actionNote.add_amendment : ""} {allowed.has("accept_residual_risk") ? copy.actionNote.accept_residual_risk : ""}</p> : null}
      </header>

      <PlanCard res={res} copy={copy} locale={locale} />

      {res.type === "amendment" || res.type === "directive" || res.type === "opportunity" || planAm.length > 0 ? (
        <section className="rz-sec"><h3>{copy.sec.amendments}</h3>
          {planAm.length === 0 ? <p className="rs-help">{copy.f.noAmendments}</p> : <ul className="rz-list">{planAm.map((a) => (
            <AmendmentCard key={a.id} a={a} res={res} step={stepBy(a)} copy={copy} locale={locale} busy={busy} setDlg={setDlg} />
          ))}</ul>}
        </section>
      ) : null}

      <section className="rz-sec"><h3>{copy.sec.approvals}</h3>
        {res.approvals.length === 0 ? <p className="rs-help">{copy.f.noApprovals}</p> : <ol className="rz-steps">{res.approvals.map((s) => <ApprovalRow key={s.id} s={s} copy={copy} locale={locale} />)}</ol>}
      </section>

      <section className="rz-sec"><h3>{copy.sec.commitments}</h3>
        {res.commitments.length === 0 ? <p className="rs-help">{copy.f.noCommitments}</p> : <ul className="rz-list">{res.commitments.map((c) => (
          <li key={c.id} className="rz-row">
            <span><strong>{copy.mitigations[c.code] ?? c.code}</strong> <span className="rs-help">{c.agencyName ?? ""}{c.text ? ` · ${c.text}` : ""}</span></span>
            <span className="rz-chip" data-status={c.status === "done" ? "resolved" : c.status === "waived" ? "cancelled" : "pending_approval"}>{copy.commit[c.status] ?? c.status}</span>
            {c.status === "pending" && !closed ? <span className="rz-row-actions">
              {allowed.has("complete_commitment") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => void run(() => commitmentAction(res.id, c.id, { action: "done" }))}>{copy.actions.complete}</button> : null}
              {allowed.has("waive_commitment") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "waive", id: c.id })}>{copy.actions.waive}</button> : null}
            </span> : null}
          </li>
        ))}</ul>}
      </section>

      {res.verification ? (
        <section className="rz-sec"><h3>{copy.sec.verification}</h3>
          <p className="rz-verify" data-result={res.verification.result}><ShieldCheckIcon aria-hidden="true" />{copy.verify[res.verification.result] ?? res.verification.result}</p>
          <p className="rs-help">{copy.f.requested}: {whenFmt(locale, res.verification.requestedAt)} · {copy.f.assessed}: {whenFmt(locale, res.verification.assessedAt)}</p>
        </section>
      ) : null}
      {res.outcome ? <section className="rz-sec"><h3>{copy.sec.outcome}</h3><p className="rz-verify" data-result="cleared"><CheckCircle2Icon aria-hidden="true" />{copy.outcome[res.outcome.code] ?? res.outcome.code} · {whenFmt(locale, res.outcome.resolvedAt)}</p></section> : null}
    </>
  );
}

function Rail({ status, copy }: { status: ResolutionView["status"]; copy: ResolutionCopy }) {
  const at = railIndex(status);
  if (status === "cancelled") return <p className="rz-rail-off"><BanIcon aria-hidden="true" />{copy.railOff}</p>;
  return (
    <ol className="rz-rail" aria-label={copy.rail}>
      {RAIL.map((s, i) => (
        <li key={s} data-state={i < at ? "done" : i === at ? "now" : "todo"} {...(i === at ? { "aria-current": "step" as const } : {})}>
          <span className="rz-dot" aria-hidden="true">{i < at ? <CheckCircle2Icon /> : i === at ? <CircleDotIcon /> : null}</span>
          <span className="rz-rail-label">{s === "verifying" && status === "needs_followup" ? copy.status.needs_followup : copy.status[s]}</span>
          <span className="sr-only">{fmt(copy.railStep, { n: i + 1, t: RAIL.length, label: copy.status[s] ?? s })}</span>
        </li>
      ))}
    </ol>
  );
}

function DateDiff({ before, after, copy, locale, shift }: { before: DateSpan; after: DateSpan; copy: ResolutionCopy; locale: string; shift?: number }) {
  return (
    <div className="rz-diff">
      <div><span className="rs-help">{copy.f.from}</span><strong>{dayFmt(locale, before.plannedStart)} → {dayFmt(locale, before.plannedEnd)}</strong></div>
      <div><span className="rs-help">{copy.f.to}</span><strong>{dayFmt(locale, after.plannedStart)} → {dayFmt(locale, after.plannedEnd)}</strong></div>
      {shift !== undefined ? <span className="rs-nb-chip">{shift === 0 ? copy.f.shiftNone : fmt(copy.f.shift, { n: shift > 0 ? `+${shift}` : shift })}</span> : null}
    </div>
  );
}

function ImpactLine({ t, copy }: { t: ThirdParty | undefined | null; copy: ResolutionCopy }) {
  if (!t) return <p className="rs-help">{copy.f.impactNone}</p>;
  return <p className="rz-impact" data-bad={t.newConflicts > 0 || t.worsened > 0}>{fmt(copy.f.impactLine, { n: t.newConflicts, w: t.worsened, c: t.cleared })}</p>;
}

function PlanCard({ res, copy, locale }: { res: ResolutionView; copy: ResolutionCopy; locale: string }) {
  const p = res.plan;
  const any = p.noAction || p.riskAcceptance || p.directive || p.opportunity;
  if (!any) return null;
  return (
    <section className="rz-sec"><h3>{copy.sec.plan}</h3>
      {p.noAction ? <p><strong>{copy.noAction[p.noAction.reasonCode] ?? p.noAction.reasonCode}</strong>{p.noAction.note ? <span className="rs-help"> · {p.noAction.note}</span> : null}</p> : null}
      {p.riskAcceptance ? <div><p><strong>{fmt(copy.f.band, { band: p.riskAcceptance.acceptedBand, score: p.riskAcceptance.acceptedScore })}</strong></p>
        {p.riskAcceptance.justification ? <p>{p.riskAcceptance.justification}</p> : null}
        <ul className="rz-chips">{p.riskAcceptance.mitigations.map((m, i) => <li key={`${m.code}-${i}`} className="rs-nb-chip">{copy.mitigations[m.code] ?? m.code}{m.text ? `: ${m.text}` : ""}</li>)}</ul></div> : null}
      {p.directive ? <div><p><strong>{copy.f.deadline}:</strong> {whenFmt(locale, p.directive.deadlineAt)} {p.directive.overdue ? <span className="rz-chip" data-status="contested">{copy.f.overdue}</span> : null}</p>{p.directive.justification ? <p>{p.directive.justification}</p> : null}</div> : null}
      {p.opportunity ? <p>{copy.types.opportunity}{p.opportunity.note ? ` · ${p.opportunity.note}` : ""}</p> : null}
      {!res.plan.riskAcceptance?.justification && !res.plan.directive?.justification && res.type !== "no_action" && res.type !== "opportunity" && (p.riskAcceptance || p.directive) ? <p className="rs-help">{copy.f.notParty}</p> : null}
    </section>
  );
}

function AmendmentCard({ a, res, step, copy, locale, busy, setDlg }: { a: AmendmentView; res: ResolutionView; step: ApprovalView | null; copy: ResolutionCopy; locale: string; busy: boolean; setDlg: (d: Dlg) => void }) {
  const [checks, setChecks] = useState<{ code: string; ok: boolean }[] | null>(null);
  const [checking, setChecking] = useState(false);
  const can = new Set(a.allowed);
  const preflight = async () => { setChecking(true); try { setChecks((await preflightAmendment(res.id, a.id)).checks); } catch { setChecks([]); } finally { setChecking(false); } };
  return (
    <li className="rz-card" data-status={a.status}>
      <div className="rz-card-top"><code>{a.amendmentNo}</code><strong>{a.agencyName ?? "—"}</strong><span className="rz-chip" data-status={a.status}>{copy.amStatus[a.status] ?? a.status}</span>{a.mandated ? <span className="rs-nb-chip">{copy.types.directive}</span> : null}</div>
      {a.changes.schedule ? <DateDiff before={a.changes.schedule.before} after={a.changes.schedule.after} copy={copy} locale={locale} shift={a.changes.schedule.shiftDays} /> : null}
      {a.changes.workingHours ? <p className="rs-help">{copy.hours[a.changes.workingHours] ?? a.changes.workingHours}</p> : null}
      <ImpactLine t={a.impact?.thirdParty} copy={copy} />
      {a.status === "stale" ? <p className="rz-warn" role="note">{copy.amStatus.stale}</p> : null}
      {checks ? <ul className="rz-checks" aria-label={copy.actions.preflight}>{checks.map((c) => <li key={c.code} data-ok={c.ok}>{c.ok ? <CheckCircle2Icon aria-hidden="true" /> : <AlertTriangleIcon aria-hidden="true" />}{c.code.replace(/_/g, " ")} · {c.ok ? copy.checks.passed : copy.checks.failed}</li>)}</ul> : null}
      {a.appliedAt ? <p className="rs-help">{whenFmt(locale, a.appliedAt)}</p> : null}
      <div className="rz-row-actions">
        {can.has("submit") ? <button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => setDlg({ kind: "submitAm", am: a })}>{copy.actions.submitAm}</button> : null}
        {step && can.has("approve") ? <button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => setDlg({ kind: "approve", step, am: a })}>{copy.actions.approve}</button> : null}
        {step && can.has("reject") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "reject", step, am: a })}>{copy.actions.reject}</button> : null}
        {a.status === "approved" ? <button type="button" className="rs-btn" disabled={checking} onClick={() => void preflight()}>{checking ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}{copy.actions.preflight}</button> : null}
        {can.has("apply") ? <button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => setDlg({ kind: "applyAm", am: a })}>{copy.actions.applyAm}</button> : null}
        {can.has("cancel") ? <button type="button" className="rs-btn" disabled={busy} onClick={() => setDlg({ kind: "cancelAm", am: a })}>{copy.actions.cancelAm}</button> : null}
      </div>
    </li>
  );
}

function ApprovalRow({ s, copy, locale }: { s: ApprovalView; copy: ResolutionCopy; locale: string }) {
  return (
    <li className="rz-step" data-status={s.status} data-overdue={s.overdue}>
      <span className="rz-step-name"><strong>{copy.steps[s.step] ?? s.step}</strong>{s.agencyName ? <span className="rs-help"> · {s.agencyName}</span> : null}{s.byMe ? <span className="rs-help"> · {copy.f.byMe}</span> : null}</span>
      <span className="rz-chip" data-status={s.status === "approved" ? "resolved" : s.status === "rejected" ? "cancelled" : "pending_approval"}>{copy.stepStatus[s.status] ?? s.status}</span>
      {s.status === "pending" ? <span className="rs-help"><ClockIcon aria-hidden="true" /> {fmt(copy.f.dueIn, { when: whenFmt(locale, s.dueAt) })}{s.overdue ? ` · ${copy.f.overdue}` : ""}</span> : <span className="rs-help">{whenFmt(locale, s.at)}</span>}
      {s.soloApproval ? <span className="rs-nb-chip">{copy.f.solo}</span> : null}
      {s.routedNoSecondAdmin ? <span className="rs-nb-chip">{copy.f.noSecond}</span> : null}
      {s.note ? <span className="rz-note">{s.note}</span> : null}
    </li>
  );
}

// ---------- start form ----------
function StartForm({ conflictId, copy, parties, onCreated, prefill }: { conflictId: string; copy: ResolutionCopy; parties: PartyLabel[]; prefill?: Handoff | null; onCreated: (m: string) => void }) {
  const keys = useRoadsyncKeys();
  const sg = useQuery({ queryKey: keys.key("resolution-suggestions", conflictId), queryFn: () => fetchResolutionSuggestions(conflictId), enabled: Boolean(keys.userId), retry: false });
  const [type, setType] = useState<ResolutionType | null>(prefill?.drafts[0]?.manual ? "amendment" : null);
  if (sg.isPending) return <p className="rs-help" role="status">{copy.loading}</p>;
  if (sg.isError || !sg.data) return <div className="rz-state" role="alert"><p>{copy.error}</p><button type="button" className="rs-btn" onClick={() => void sg.refetch()}>{copy.retry}</button></div>;
  const s = sg.data;
  const available: ResolutionType[] = [];
  if (s.paths.agreedTerms || s.paths.manual) available.push("amendment");
  if (s.paths.directive) available.push("directive");
  if (s.paths.riskAcceptance) available.push("risk_acceptance");
  if (s.paths.noAction) available.push("no_action");
  if (s.paths.opportunity) available.push("opportunity");
  if (!s.open || available.length === 0) return <p className="rz-empty">{s.open ? copy.start.unavailable : copy.start.closedRecord}</p>;
  return (
    <section className="rz-sec"><h3>{copy.start.title}</h3>
      <div className="rz-pick" role="radiogroup" aria-label={copy.start.pick}>
        {available.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className="rz-pickcard" data-on={type === t} onClick={() => setType(t)}>
            <strong>{copy.types[t]}</strong><span className="rs-help">{copy.typeHelp[t]}</span>
          </button>
        ))}
      </div>
      {type ? <StartBody key={type} type={type} s={s} conflictId={conflictId} copy={copy} parties={parties} onCreated={onCreated} prefill={prefill ?? null} /> : null}
    </section>
  );
}

function ChangeFields({ targets, parties, copy, value, onChange, idp }: { targets: ResolutionSuggestions["targets"]; parties: PartyLabel[]; copy: ResolutionCopy; value: { target: string; start: string; end: string; hours: "" | WorkingHours }; onChange: (v: { target: string; start: string; end: string; hours: "" | WorkingHours }) => void; idp: string }) {
  return (
    <div className="rz-fields">
      <div className="rs-field"><label className="rs-label" htmlFor={`${idp}-t`}>{copy.start.target}</label>
        <select id={`${idp}-t`} className="rs-input" value={value.target} onChange={(e) => onChange({ ...value, target: e.target.value })}>{targets.map((t) => <option key={t.requestId} value={t.requestId}>{labelOf(parties, t.requestId)}</option>)}</select></div>
      <div className="rs-field"><label className="rs-label" htmlFor={`${idp}-s`}>{copy.start.newStart}</label><input id={`${idp}-s`} className="rs-input" type="datetime-local" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} /></div>
      <div className="rs-field"><label className="rs-label" htmlFor={`${idp}-e`}>{copy.start.newEnd}</label><input id={`${idp}-e`} className="rs-input" type="datetime-local" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} /></div>
      <div className="rs-field"><label className="rs-label" htmlFor={`${idp}-h`}>{copy.start.hoursLabel}</label>
        <select id={`${idp}-h`} className="rs-input" value={value.hours} onChange={(e) => onChange({ ...value, hours: e.target.value as "" | WorkingHours })}><option value="">{copy.start.keepHours}</option>{(["day", "night", "24h"] as const).map((h) => <option key={h} value={h}>{copy.hours[h]}</option>)}</select></div>
    </div>
  );
}

type ChangeState = { target: string; start: string; end: string; hours: "" | WorkingHours };
const toChange = (c: ChangeState): ChangeInput | null => {
  const hasDates = c.start && c.end;
  if (!hasDates && !c.hours) return null;
  return { targetRequestId: c.target, ...(hasDates ? { schedule: { plannedStart: toIso(c.start), plannedEnd: toIso(c.end) } } : {}), ...(c.hours ? { workingHours: c.hours } : {}) };
};

function StartBody({ type, s, conflictId, copy, parties, onCreated, prefill }: { type: ResolutionType; s: ResolutionSuggestions; conflictId: string; copy: ResolutionCopy; parties: PartyLabel[]; prefill: Handoff | null; onCreated: (m: string) => void }) {
  // Manual amendments may only change the viewer's own requests; directives (national) may target any side.
  const targets = type === "directive" ? s.targets : s.targets.filter((t) => t.mine);
  const mineTarget = targets[0];
  const manual = prefill?.drafts[0]?.manual as { targetRequestId?: string; schedule?: { plannedStart: string; plannedEnd: string }; workingHours?: WorkingHours } | undefined;
  const [mode, setMode] = useState<"agreed" | "manual">(manual || !s.paths.agreedTerms ? "manual" : "agreed");
  const [agreedId, setAgreedId] = useState(s.agreed[0]?.coordinationRequestId ?? "");
  const [change, setChange] = useState<ChangeState>({ target: manual?.targetRequestId ?? mineTarget?.requestId ?? "", start: manual?.schedule ? toLocalInput(manual.schedule.plannedStart) : "", end: manual?.schedule ? toLocalInput(manual.schedule.plannedEnd) : "", hours: manual?.workingHours ?? "" });
  const [reasonCode, setReasonCode] = useState<string>(NO_ACTION_CODES[0]);
  const [note, setNote] = useState("");
  const [just, setJust] = useState("");
  const [mits, setMits] = useState<string[]>([]);
  const [days, setDays] = useState(String(s.limits.directiveDefaultDays));
  const [lead, setLead] = useState("");
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const jmin = s.limits.justificationMin || JUSTIFICATION_MIN;

  const change1 = toChange(change);
  const datesBad = Boolean(change.start && change.end && new Date(change.end) < new Date(change.start)) || Boolean((change.start && !change.end) || (!change.start && change.end));
  const needsChange = (type === "amendment" && mode === "manual") || type === "directive";

  const doPreview = async () => {
    if (!change1) return void setErr(copy.start.needChange);
    setWorking(true); setErr(null);
    try { setPreview(await previewResolutionImpact(conflictId, [change1])); } catch (e) { setErr(failText(e, copy).text); } finally { setWorking(false); }
  };
  const valid = (() => {
    if (needsChange && (!change1 || datesBad)) return false;
    if (type === "amendment" && mode === "agreed" && !agreedId) return false;
    if ((type === "directive" || type === "risk_acceptance") && just.trim().length < jmin) return false;
    if (type === "risk_acceptance" && mits.length === 0) return false;
    return true;
  })();
  const submit = async () => {
    setWorking(true); setErr(null);
    let body: CreateResolutionBody;
    if (type === "amendment") body = mode === "agreed" ? { type, source: { coordinationRequestId: agreedId } } : { type, manual: change1 as ChangeInput };
    else if (type === "directive") { const d = Math.min(s.limits.directiveMaxDays, Math.max(1, Number(days) || s.limits.directiveDefaultDays)); body = { type, directive: { justification: just.trim(), deadlineAt: new Date(Date.now() + d * 86_400_000).toISOString(), targets: [change1 as ChangeInput] } }; }
    else if (type === "risk_acceptance") body = { type, riskAcceptance: { justification: just.trim(), mitigations: mits.map((code) => ({ code })) } };
    else if (type === "no_action") body = { type, noAction: { reasonCode, ...(note.trim() ? { note: note.trim() } : {}) } };
    else body = { type, opportunity: { ...(lead.trim() ? { leadAgencyId: lead.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) } };
    try { await createResolution(conflictId, body); onCreated(copy.done); } catch (e) { setErr(failText(e, copy).text); } finally { setWorking(false); }
  };

  return (
    <div className="rz-form">
      {type === "amendment" && s.paths.agreedTerms && s.paths.manual ? (
        <div className="rz-seg" role="radiogroup" aria-label={copy.types.amendment}>
          <button type="button" role="radio" aria-checked={mode === "agreed"} className="rs-btn" data-on={mode === "agreed"} onClick={() => setMode("agreed")}>{copy.start.agreed}</button>
          <button type="button" role="radio" aria-checked={mode === "manual"} className="rs-btn" data-on={mode === "manual"} onClick={() => setMode("manual")}>{copy.start.manual}</button>
        </div>
      ) : null}
      {type === "amendment" && mode === "agreed" ? (
        <div className="rs-field"><label className="rs-label" htmlFor="rz-agreed">{copy.start.agreed}</label>
          <select id="rz-agreed" className="rs-input" value={agreedId} onChange={(e) => setAgreedId(e.target.value)}>{s.agreed.map((a) => <option key={a.coordinationRequestId} value={a.coordinationRequestId}>{a.requestNo}</option>)}</select></div>
      ) : null}
      {needsChange ? <ChangeFields targets={targets} parties={parties} copy={copy} value={change} onChange={setChange} idp="rz-ch" /> : null}
      {datesBad ? <p className="rz-warn" role="alert">{copy.start.datesInvalid}</p> : null}
      {needsChange ? <button type="button" className="rs-btn" disabled={working || !change1 || datesBad} onClick={() => void doPreview()}>{working ? copy.start.previewing : copy.start.preview}</button> : null}
      {preview ? (
        <div className="rz-preview" role="status"><strong>{copy.start.previewTitle}</strong>
          {preview.items.map((i) => <p key={i.targetRequestId} className="rs-help">{fmt(copy.f.shift, { n: i.shiftDays })}</p>)}
          <p className="rs-help">{copy.start.combined}</p><ImpactLine t={preview.combined} copy={copy} /></div>
      ) : null}
      {type === "directive" ? <div className="rs-field"><label className="rs-label" htmlFor="rz-days">{fmt(copy.start.directiveDays, { d: s.limits.directiveDefaultDays, m: s.limits.directiveMaxDays })}</label><input id="rz-days" className="rs-input" type="number" min={1} max={s.limits.directiveMaxDays} value={days} onChange={(e) => setDays(e.target.value)} /></div> : null}
      {type === "directive" || type === "risk_acceptance" ? (
        <div className="rs-field"><label className="rs-label" htmlFor="rz-just">{copy.f.justification}</label><textarea id="rz-just" className="rs-input" rows={4} maxLength={1000} value={just} onChange={(e) => setJust(e.target.value)} aria-describedby="rz-just-h" />
          <p id="rz-just-h" className="rs-help">{fmt(copy.start.justificationShort, { n: jmin })} ({just.trim().length}/{jmin})</p></div>
      ) : null}
      {type === "risk_acceptance" ? (
        <fieldset className="rz-mits"><legend>{copy.start.mitigationsPick}</legend>
          {MITIGATION_CODES.map((m) => <label key={m} className="rz-check"><input type="checkbox" checked={mits.includes(m)} onChange={(e) => setMits((cur) => (e.target.checked ? [...cur, m].slice(0, 8) : cur.filter((x) => x !== m)))} />{copy.mitigations[m]}</label>)}
        </fieldset>
      ) : null}
      {type === "no_action" ? <div className="rs-field"><label className="rs-label" htmlFor="rz-na">{copy.start.why}</label><select id="rz-na" className="rs-input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>{NO_ACTION_CODES.map((c) => <option key={c} value={c}>{copy.noAction[c]}</option>)}</select></div> : null}
      {type === "opportunity" ? <div className="rs-field"><label className="rs-label" htmlFor="rz-lead">{copy.start.leadAgency}</label><input id="rz-lead" className="rs-input" value={lead} maxLength={24} onChange={(e) => setLead(e.target.value)} /></div> : null}
      {type === "no_action" || type === "opportunity" ? <div className="rs-field"><label className="rs-label" htmlFor="rz-note">{copy.f.note}</label><input id="rz-note" className="rs-input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div> : null}
      {err ? <p className="rz-warn" role="alert">{err}</p> : null}
      <div className="rz-actions"><button type="button" className="rs-btn is-primary" disabled={!valid || working} aria-busy={working} onClick={() => void submit()}>{working ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}{copy.start.create}</button></div>
      <p className="rs-help">{copy.demoNote}</p>
    </div>
  );
}
