"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, CrownIcon, FeatherIcon, InfoIcon, Loader2Icon, MergeIcon, RefreshCwIcon, ScaleIcon, ShieldCheckIcon, ThumbsDownIcon, ThumbsUpIcon, XIcon, ZapIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import type { AuthLocale } from "@/lib/auth/types";
import { BAND_COLOR, fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { fetchDossier } from "@/lib/roadsync/conflict-records-api";
import { COMPONENTS, DISMISS_REASONS, MIX_KEYS, MIX_PRESETS, WEIGHTS, mixedScore, paretoFrontier, rankByMix, stashHandoff, type Archetype, type DismissReason, type HandoffTarget, type Mix, type Move, type Plan } from "@/lib/roadsync/advisor";
import { fetchAdvice, fetchHandoff, sendFeedback } from "@/lib/roadsync/advisor-api";
import { getAdvisorCopy, type AdvisorCopy } from "@/lib/roadsync/advisor-copy";
import "@/styles/mission-control-roadsync-advisor.css";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

const ICONS: Record<Archetype, typeof ZapIcon> = { fastest: ZapIcon, leastDisruption: FeatherIcon, lowestRisk: ShieldCheckIcon, fairShare: ScaleIcon, jointWorks: MergeIcon };
const MIX_KEY = "infraos.roadsync.advisor.mix";
const mixListeners = new Set<() => void>();
let mixMemory: string | null = null;
const readMix = () => { try { return window.localStorage.getItem(MIX_KEY) ?? mixMemory; } catch { return mixMemory; } };
function writeMix(m: Mix | null) { mixMemory = m ? JSON.stringify(m) : null; try { if (m) window.localStorage.setItem(MIX_KEY, JSON.stringify(m)); else window.localStorage.removeItem(MIX_KEY); } catch { /* storage unavailable: kept in memory */ } mixListeners.forEach((l) => l()); }
function useMix(): Mix | null {
  const raw = useSyncExternalStore((cb) => { mixListeners.add(cb); return () => { mixListeners.delete(cb); }; }, readMix, () => null);
  return useMemo(() => { try { const v = raw ? (JSON.parse(raw) as Mix) : null; return v && MIX_KEYS.every((k) => Number.isFinite(v[k])) ? v : null; } catch { return null; } }, [raw]);
}
const dayFmt = (locale: string, v: string | null) => (v ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Asia/Colombo" }).format(new Date(v)) : "—");

export function AdvisorPanel({ conflictId, locale }: { conflictId: string; locale: AuthLocale }) {
  const copy = getAdvisorCopy(locale);
  const ac = getAssessmentCopy(locale);
  const keys = useRoadsyncKeys();
  const qc = useQueryClient();
  const router = useRouter();
  const mix = useMix();
  const key = keys.key("advisor", conflictId);
  const q = useQuery({ queryKey: key, queryFn: () => fetchAdvice(conflictId), enabled: Boolean(keys.userId), retry: false, refetchOnWindowFocus: false });
  const dossier = useQuery({ queryKey: keys.key("conflict-dossier", conflictId), queryFn: () => fetchDossier(conflictId), enabled: Boolean(keys.userId), retry: false });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const adv = q.data;
  const labels = useMemo(() => new Map((dossier.data ? [dossier.data.parties.a, dossier.data.parties.b] : []).map((p) => [p.id, p.ref])), [dossier.data]);
  const agency = (id: string) => adv?.agencies[id] ?? id.slice(-6);
  const canAct = Boolean(adv?.allowedActions.includes("feedback"));
  const ordered = useMemo(() => rankByMix(adv?.plans ?? [], mix), [adv?.plans, mix]);
  const live = ordered[0] && mix ? fmt(copy.mixer.ranking, { name: ordered[0].archetypes[0] ? copy.archetype[ordered[0].archetypes[0]] ?? "" : fmt(copy.plan.rank, { n: 1 }) }) : "";

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) setToast(ok); } catch (e) { setToast(e instanceof ApiError && e.status === 403 ? copy.forbidden : copy.failed); } finally { setBusy(false); void qc.invalidateQueries({ queryKey: key }); }
  };
  const refresh = () => void run(async () => { qc.setQueryData(key, await fetchAdvice(conflictId, true)); });
  const feedback = (planKey: string, action: "helpful" | "not_helpful" | "dismissed" | "restored", reasonCode?: DismissReason) => run(async () => { await sendFeedback(adv!.recNo!, { planKey, action, ...(reasonCode ? { reasonCode } : {}) }); setSheet(null); }, copy.saved);
  const hand = async (plan: Plan, target: HandoffTarget) => {
    setHandoffNote(null);
    try {
      const h = await fetchHandoff(adv!.recNo!, plan.planKey, target);
      if (target !== "simulator" && h.drafts.length === 0) return void setHandoffNote(h.notEligible.map((n) => fmt(copy.drawer.notEligible, { reason: copy.drawer.reasons[n.reason] ?? n.reason })).join(" · ") || copy.failed);
      stashHandoff(h, conflictId);
      router.push(target === "coordination" ? `/roadsync/conflicts/${conflictId}/coordination/new` : target === "resolution" ? `/roadsync/conflicts/${conflictId}?tab=resolution` : `/roadsync/conflicts/${conflictId}/lab`);
    } catch { setHandoffNote(copy.failed); }
  };

  if (q.isPending) return <div className="ad"><div className="dc-skel" role="status" aria-label={copy.loading}><i /><i /><i /></div><p className="rs-help">{copy.loading}</p></div>;
  if (q.isError || !adv) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    return <div className="ad"><div className="rz-state" role="alert"><p>{status === 403 || status === 404 ? copy.forbidden : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div></div>;
  }
  const drawerPlan = adv.plans.find((p) => p.planKey === drawer) ?? null;
  const moveText = (m: Move) => {
    const req = labels.get(m.requestId) ?? `…${m.requestId.slice(-6)}`;
    const body = m.kind === "shift_request" ? fmt(copy.move.shift_request, { request: req, days: `${(m.shiftDays ?? 0) > 0 ? "+" : ""}${m.shiftDays ?? 0}`, start: dayFmt(locale, m.newStart), end: dayFmt(locale, m.newEnd) })
      : m.kind === "sequence_pair" ? fmt(copy.move.sequence_pair, { request: req, gap: m.gapDays ?? 0, start: dayFmt(locale, m.newStart), end: dayFmt(locale, m.newEnd) })
        : fmt(copy.move.set_hours, { request: req, hours: copy.hours[m.workingHours ?? "day"] ?? m.workingHours ?? "" });
    return m.propose ? `${fmt(copy.move.ask, { agency: agency(m.agencyId) })}${body}` : body;
  };

  return (
    <div className="ad">
      <p className="ad-ribbon" role="note"><InfoIcon aria-hidden="true" />{copy.ribbon}
        <Dialog.Root><Dialog.Trigger asChild><button type="button" className="rz-link">{copy.how.title}</button></Dialog.Trigger>
          <Dialog.Portal><Dialog.Overlay className="rs-overlay" /><Dialog.Content className="rs-dialog"><Dialog.Title>{copy.how.title}</Dialog.Title><Dialog.Description>{copy.how.body}</Dialog.Description>
            <ul className="ad-weights">{COMPONENTS.map((c) => <li key={c}>{copy.plan.components}: <b>{c}</b> — {fmt(copy.plan.weight, { w: WEIGHTS[c] })}</li>)}</ul>
            <div className="rs-dialog-actions"><Dialog.Close className="rs-btn">{copy.drawer.close}</Dialog.Close></div></Dialog.Content></Dialog.Portal></Dialog.Root></p>
      {toast ? <p className="rz-toast" role="status">{toast}</p> : null}
      <p className="sr-only" aria-live="polite">{live}</p>

      <header className="ad-head">
        <div><span className="ad-no">{adv.recNo ?? ""}</span><span className="rs-help"> {fmt(copy.header.analysed, { when: whenFmt(locale, adv.generatedAt) })}{adv.cached ? ` · ${copy.header.cached}` : ""}</span></div>
        <div className="ad-chips">
          {adv.confidence ? <ConfidenceMeter tier={adv.confidence} copy={copy} /> : null}
          {adv.coverage.assumptions ? <span className="rs-nb-chip">{fmt(copy.header.assumptions, { n: adv.coverage.assumptions })}</span> : null}
          <span className="rs-nb-chip">{copy.header.storedOnly}</span>
          {adv.coverage.truncated ? <span className="rz-chip" data-status="pending_approval"><AlertTriangleIcon aria-hidden="true" />{copy.header.truncated}</span> : null}
          {canAct ? <button type="button" className="rs-btn" disabled={busy} onClick={refresh}>{busy ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <RefreshCwIcon aria-hidden="true" />}{copy.header.reanalyse}</button> : null}
        </div>
        <p className="rs-help">{copy.header.flex}</p>
        {adv.readOnly ? <p className="rz-warn" role="note">{copy.header.readOnly}</p> : !canAct ? <p className="rz-warn" role="note">{copy.header.viewerOnly}</p> : null}
      </header>

      {adv.coordination.map((c, i) => (
        <section key={i} className="ad-coord" aria-label={copy.coordinate.title}>
          <h3 className="ad-h"><ClockIcon aria-hidden="true" />{copy.coordinate.title}</h3>
          <p>{c.urgency.daysToImpact !== null ? <span className="rz-chip" data-status={c.urgency.urgent ? "cancelled" : "pending_approval"}>{fmt(copy.coordinate.urgent, { n: c.urgency.daysToImpact })}</span> : null} {c.reasons.map((r) => <span key={r} className="rs-nb-chip">{copy.coordinate.reasons[r] ?? r}</span>)}</p>
          {c.suggestedLead ? <p><CrownIcon aria-hidden="true" className="rz-inline" /> {copy.coordinate.lead}: <b>{agency(c.suggestedLead.agencyId)}</b></p> : null}
          <ul className="rz-chips">{c.participants.map((p) => <li key={p.agencyId} className="rs-nb-chip" data-mine={p.role === "required"}>{agency(p.agencyId)} · {copy.coordinate[p.role]}</li>)}</ul>
          <p className="rs-help">{copy.coordinate.slots}</p>
          {canAct ? <Link className="rs-btn is-primary" href={`/roadsync/conflicts/${conflictId}/coordination/new`}>{copy.coordinate.cta}</Link> : null}
        </section>
      ))}

      {adv.plans.length === 0 && adv.dismissed.length === 0 ? (
        <div className="rz-state"><InfoIcon aria-hidden="true" /><p>{copy.states.empty}</p><p className="rs-help">{copy.states.emptyHint}</p><Link className="rs-btn" href={`/roadsync/conflicts/${conflictId}/lab`}>{getAdvisorCopy(locale).drawer.forLab}</Link></div>
      ) : (
        <div className="ad-layout">
          <div className="ad-main">
            <Mixer copy={copy} mix={mix} />
            <ol className="ad-plans" aria-label={copy.title}>
              {ordered.map((p, i) => <PlanCard key={p.planKey} p={p} n={i + 1} copy={copy} mix={mix} selected={selected === p.planKey} moveText={moveText} agency={agency} canAct={canAct} onSelect={() => setSelected(p.planKey)} onDetails={() => setDrawer(p.planKey)} onFeedback={(a) => void feedback(p.planKey, a)} onDismiss={() => setSheet(p.planKey)} onHand={(t) => void hand(p, t)} />)}
            </ol>
            {handoffNote ? <p className="rz-warn" role="alert">{handoffNote}</p> : null}
          </div>
          <aside className="ad-side"><TradeoffMap plans={ordered} selected={selected} onSelect={setSelected} copy={copy} locale={locale} /></aside>
        </div>
      )}

      {adv.opportunities.map((o, i) => (
        <section key={i} className="ad-opp"><h3 className="ad-h"><MergeIcon aria-hidden="true" />{copy.opp.title}</h3>
          <p className="ad-opp-n">{o.sharedTrenchMeters !== null ? fmt(copy.opp.trench, { km: Math.round(o.sharedTrenchMeters / 100) / 10 }) : copy.opp.title}</p>
          {o.leadAgencyId ? <p>{fmt(copy.opp.lead, { agency: agency(o.leadAgencyId) })}</p> : null}
          {canAct ? <Link className="rs-btn is-primary" href={`/roadsync/conflicts/${conflictId}/coordination/new`}>{copy.opp.cta}</Link> : null}
          <p className="rs-help">{copy.opp.caption}</p></section>
      ))}

      <details className="ad-why"><summary>{copy.whyNot.title} ({adv.excluded.length})</summary>
        {adv.excluded.length === 0 ? <p className="rs-help">{copy.whyNot.none}</p> : <ul>{adv.excluded.map((e, i) => <li key={i}><b>{e.mine ? copy.whyNot.ownRequest : copy.whyNot.otherRequest}</b> — {copy.whyNot.codes[e.code] ?? e.code}</li>)}</ul>}</details>

      <details className="ad-why"><summary>{copy.log.title} ({adv.dismissed.length})</summary>
        {adv.dismissed.length === 0 ? <p className="rs-help">{copy.log.empty}</p> : <ul>{adv.dismissed.map((d) => <li key={d.planKey}>{fmt(copy.log.dismissed, { reason: copy.log.reasons[d.reasonCode ?? "other"] ?? "" })} · {copy.plan.score.replace("{s}", String(d.score))} · {whenFmt(locale, d.at)} {canAct ? <button type="button" className="rz-link" onClick={() => void feedback(d.planKey, "restored")}>{copy.log.restore}</button> : null}</li>)}</ul>}</details>

      <Dialog.Root open={Boolean(drawerPlan)} onOpenChange={(o) => { if (!o) setDrawer(null); }}>
        <Dialog.Portal><Dialog.Overlay className="rs-overlay" />
          <Dialog.Content className="ad-drawer">
            {drawerPlan ? <PlanDrawer p={drawerPlan} copy={copy} ac={ac.bands} moveText={moveText} agency={agency} canAct={canAct} onHand={(t) => void hand(drawerPlan, t)} note={handoffNote} locale={locale} /> : null}
            <Dialog.Close className="rs-btn ad-close"><XIcon aria-hidden="true" />{copy.drawer.close}</Dialog.Close>
          </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={Boolean(sheet)} onOpenChange={(o) => { if (!o) setSheet(null); }}>
        <Dialog.Portal><Dialog.Overlay className="rs-overlay" /><Dialog.Content className="rs-dialog"><Dialog.Title>{copy.log.sheet}</Dialog.Title><Dialog.Description className="sr-only">{copy.log.sheet}</Dialog.Description>
          <div className="ad-reasons">{DISMISS_REASONS.map((r) => <button key={r} type="button" className="rs-btn" disabled={busy} onClick={() => void feedback(sheet!, "dismissed", r)}>{copy.log.reasons[r]}</button>)}</div>
          <div className="rs-dialog-actions"><Dialog.Close className="rs-btn">{copy.drawer.close}</Dialog.Close></div></Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function ConfidenceMeter({ tier, copy }: { tier: "high" | "medium" | "low"; copy: AdvisorCopy }) {
  const at = tier === "high" ? 3 : tier === "medium" ? 2 : 1;
  return (
    <span className="ad-conf" role="img" aria-label={`${copy.confidence.label}: ${copy.confidence[tier]}. ${copy.confidence.note}`} data-tier={tier}>
      {[1, 2, 3].map((n) => <i key={n} data-on={n <= at} />)}
      {tier === "high" ? <CheckCircle2Icon aria-hidden="true" /> : <AlertTriangleIcon aria-hidden="true" />}{copy.confidence.label}: {copy.confidence[tier]}
    </span>
  );
}

function Mixer({ copy, mix }: { copy: AdvisorCopy; mix: Mix | null }) {
  const value = mix ?? MIX_PRESETS.balanced;
  return (
    <section className="ad-mixer" aria-label={copy.mixer.title}>
      <h3 className="ad-h">{copy.mixer.title}</h3><p className="rs-help">{copy.mixer.help}</p>
      <div className="ad-presets" role="group" aria-label={copy.mixer.title}>{(Object.keys(MIX_PRESETS) as (keyof typeof MIX_PRESETS)[]).map((k) => <button key={k} type="button" className="rs-btn" aria-pressed={mix !== null && MIX_KEYS.every((m) => mix[m] === MIX_PRESETS[k][m])} onClick={() => writeMix(MIX_PRESETS[k])}>{copy.mixer.presets[k]}</button>)}</div>
      <div className="ad-sliders">{MIX_KEYS.map((k) => <label key={k}>{copy.mixer[k]} <b>{value[k]}</b><input type="range" min={0} max={100} step={5} value={value[k]} onChange={(e) => writeMix({ ...value, [k]: Number(e.target.value) })} /></label>)}</div>
      <div className="rz-actions"><button type="button" className="rs-btn" disabled={mix === null} onClick={() => writeMix(null)}>{copy.mixer.reset}</button></div>
      <details><summary>{copy.mixer.formula}</summary><p className="rs-help">{copy.mixer.formulaBody}</p></details>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return <svg className="ad-ring" viewBox="0 0 56 56" role="img" aria-label={String(score)}><circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" /><circle cx="28" cy="28" r={r} fill="none" stroke="#0e7490" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 28 28)" className="dc-draw" /><text x="28" y="33" textAnchor="middle" className="ad-ring-n">{Math.round(score)}</text></svg>;
}

function PlanCard({ p, n, copy, mix, selected, moveText, agency, canAct, onSelect, onDetails, onFeedback, onDismiss, onHand }: { p: Plan; n: number; copy: AdvisorCopy; mix: Mix | null; selected: boolean; moveText: (m: Move) => string; agency: (id: string) => string; canAct: boolean; onSelect: () => void; onDetails: () => void; onFeedback: (a: "helpful" | "not_helpful") => void; onDismiss: () => void; onHand: (t: HandoffTarget) => void }) {
  const m = p.metrics;
  return (
    <li className="ad-card" data-selected={selected} onClick={onSelect}>
      <div className="ad-card-top">
        <ScoreRing score={mix ? mixedScore(p, mix) : p.score} />
        <div><strong>{fmt(copy.plan.rank, { n })}</strong> <span className="rs-help">{mix ? fmt(copy.mixer.mixed, { s: mixedScore(p, mix) }) : fmt(copy.plan.score, { s: p.score })}</span>
          <div className="ad-tags">{p.archetypes.map((a) => { const I = ICONS[a]; return <span key={a} className="ad-tag" data-a={a} title={copy.archetypeHelp[a]}><I aria-hidden="true" />{copy.archetype[a]}</span>; })}</div></div>
        <ConfidenceMeter tier={p.confidence.tier} copy={copy} />
      </div>
      <h4 className="ad-h4">{copy.plan.changes}</h4>
      <ul className="ad-moves">{p.moves.map((mv, i) => <li key={i} data-propose={mv.propose}>{moveText(mv)}</li>)}</ul>
      <p className="ad-impact">
        <span className="rz-chip" data-status="resolved">{fmt(copy.plan.risk, { a: m.riskBefore, b: m.riskAfter })}</span>
        <span className="rs-nb-chip">{fmt(copy.plan.clears, { c: m.clearedFocus, f: m.focusCount })}</span>
        <span className="rs-nb-chip" data-bad={m.newConflicts > 0}>{fmt(copy.plan.newC, { n: m.newConflicts })}</span>
        <span className="rs-nb-chip">{fmt(copy.plan.shift, { n: m.totalShiftDays })}</span>
        <span className="rs-nb-chip">{p.approvals.required ? copy.plan.approval : copy.plan.noApproval}</span>
      </p>
      <p className="rs-help"><ClockIcon aria-hidden="true" className="rz-inline" /> {m.fitsBeforeStart === null ? fmt(copy.plan.estimate, { n: m.estimateDays }) : m.fitsBeforeStart ? copy.plan.fits : copy.plan.late} · {fmt(copy.plan.steps, { n: m.steps })} · {copy.plan.coordinate}: {m.agenciesToCoordinate.map(agency).join(", ")}</p>
      <ul className="ad-bars" aria-label={copy.plan.components}>{COMPONENTS.map((c) => <li key={c} title={`${c} · ${fmt(copy.plan.weight, { w: WEIGHTS[c] })}`}><i style={{ width: `${p.components[c]}%` }} /></li>)}</ul>
      <div className="rz-row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rs-btn" onClick={onDetails}>{copy.plan.details}</button>
        {canAct ? <>
          <button type="button" className="rs-btn" onClick={() => onFeedback("helpful")} aria-label={copy.plan.helpful}><ThumbsUpIcon aria-hidden="true" /></button>
          <button type="button" className="rs-btn" onClick={() => onFeedback("not_helpful")} aria-label={copy.plan.notHelpful}><ThumbsDownIcon aria-hidden="true" /></button>
          <button type="button" className="rs-btn" onClick={onDismiss}>{copy.plan.dismiss}</button>
          <button type="button" className="rs-btn is-primary" onClick={() => onHand("coordination")}>{copy.drawer.forCoordination}</button></> : null}
      </div>
    </li>
  );
}

function PlanDrawer({ p, copy, ac, moveText, agency, canAct, onHand, note, locale }: { p: Plan; copy: AdvisorCopy; ac: Record<string, string>; moveText: (m: Move) => string; agency: (id: string) => string; canAct: boolean; onHand: (t: HandoffTarget) => void; note: string | null; locale: string }) {
  const maxShift = Math.max(1, ...p.metrics.perAgencyShiftDays.map((x) => x.shiftDays));
  return (
    <div className="ad-drawer-body">
      <Dialog.Title>{copy.drawer.title}</Dialog.Title><Dialog.Description className="sr-only">{copy.drawer.title}</Dialog.Description>
      <h4 className="ad-h4">{copy.plan.components}</h4>
      <table className="sl-table"><tbody>{COMPONENTS.map((c) => <tr key={c}><th scope="row">{c}</th><td>{p.components[c]}</td><td>{fmt(copy.plan.weight, { w: WEIGHTS[c] })}</td></tr>)}</tbody></table>
      <h4 className="ad-h4">{copy.drawer.focus}</h4>
      <ul className="ad-focus">{p.focusDiff.map((f) => <li key={f.pairKey} data-diff={f.diff}><span className="rz-chip" data-status={f.diff === "cleared" || f.diff === "improved" ? "resolved" : f.diff === "worsened" || f.diff === "new" ? "cancelled" : "draft"}>{copy.drawer.diff[f.diff]}</span> <span className="sl-band" style={{ ["--c" as string]: BAND_COLOR[f.before.band] }}>{ac[f.before.band]} {f.before.score}</span> → <span className="sl-band" style={{ ["--c" as string]: BAND_COLOR[f.after.band] }}>{ac[f.after.band]} {f.after.score}</span></li>)}</ul>
      <h4 className="ad-h4">{copy.drawer.burden}</h4>
      <ul className="ad-burden">{p.metrics.perAgencyShiftDays.map((x) => <li key={x.agencyId}><span>{agency(x.agencyId)}</span><span className="dc-wf-bar" aria-hidden="true"><i style={{ width: `${(x.shiftDays / maxShift) * 100}%` }} /></span><b>{fmt(copy.drawer.days, { n: x.shiftDays })}</b></li>)}</ul>
      <h4 className="ad-h4">{copy.drawer.feasibility}</h4>
      <ul>{p.moves.map((m, i) => <li key={i}>{m.mine ? copy.drawer.own : copy.drawer.assumption}: {moveText(m)}</li>)}</ul>
      <h4 className="ad-h4">{copy.drawer.timeline}</h4>
      <p>{fmt(copy.drawer.respond, { n: Math.max(1, p.metrics.estimateDays - 4) })} · {fmt(copy.drawer.approve, { n: p.approvals.required ? 6 : 3 })}</p>
      {p.approvals.reasons.length ? <ul className="rz-chips">{p.approvals.reasons.map((r) => <li key={r} className="rs-nb-chip">{copy.approvalReasons[r] ?? r.replace(/_/g, " ")}</li>)}</ul> : null}
      <h4 className="ad-h4">{copy.plan.conf}</h4>
      <ConfidenceMeter tier={p.confidence.tier} copy={copy} />
      <ul>{p.confidence.points.map((x) => <li key={x.code}>{copy.confidence.points[x.code] ?? x.code} ({x.points})</li>)}</ul>
      {canAct ? <><h4 className="ad-h4">{copy.drawer.handoff}</h4>
        <div className="rz-row-actions"><button type="button" className="rs-btn is-primary" onClick={() => onHand("coordination")}>{copy.drawer.forCoordination}</button><button type="button" className="rs-btn" onClick={() => onHand("resolution")}>{copy.drawer.forResolution}</button><button type="button" className="rs-btn" onClick={() => onHand("simulator")}>{copy.drawer.forLab}</button></div>
        {note ? <p className="rz-warn" role="alert">{note}</p> : null}</> : null}
      <span className="sr-only">{locale}</span>
    </div>
  );
}

function TradeoffMap({ plans, selected, onSelect, copy, locale }: { plans: Plan[]; selected: string | null; onSelect: (k: string) => void; copy: AdvisorCopy; locale: string }): ReactNode {
  if (plans.length === 0) return null;
  const W = 320, H = 240, M = 36;
  const maxX = Math.max(1, ...plans.map((p) => p.metrics.totalShiftDays)), maxY = Math.max(1, ...plans.map((p) => p.metrics.riskReduction));
  const x = (v: number) => M + (v / maxX) * (W - M - 14), y = (v: number) => H - M - (v / maxY) * (H - M - 14);
  const front = paretoFrontier(plans);
  const step = front.flatMap((p, i) => (i === 0 ? [`M${x(p.metrics.totalShiftDays)},${y(p.metrics.riskReduction)}`] : [`H${x(p.metrics.totalShiftDays)}`, `V${y(p.metrics.riskReduction)}`])).join(" ");
  const order = [...plans].sort((a, b) => b.score - a.score);
  return (
    <section className="ad-map" aria-label={copy.map.title}>
      <h3 className="ad-h">{copy.map.title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={copy.map.title}>
        <line x1={M} y1={H - M} x2={W - 8} y2={H - M} stroke="#94a3b8" /><line x1={M} y1={8} x2={M} y2={H - M} stroke="#94a3b8" />
        <text x={W / 2} y={H - 6} textAnchor="middle" className="dc-axis">{copy.map.x}</text><text x="10" y={H / 2} transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle" className="dc-axis">{copy.map.y}</text>
        {front.length > 1 ? <path d={step} fill="none" stroke="#c2760a" strokeWidth="2" strokeDasharray="5 3"><title>{copy.map.frontier}</title></path> : null}
        {order.map((p, i) => { const I = p.archetypes[0] ? p.archetypes[0] : null; return (
          <g key={p.planKey} tabIndex={0} role="button" aria-pressed={selected === p.planKey} aria-label={fmt(copy.map.pick, { n: i + 1, a: p.metrics.totalShiftDays, r: p.metrics.riskReduction })} className="ad-pt" onClick={() => onSelect(p.planKey)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.planKey); } }}>
            <circle cx={x(p.metrics.totalShiftDays)} cy={y(p.metrics.riskReduction)} r={7 + p.metrics.agenciesToCoordinate.length * 2} fill="#0e7490" opacity={selected === p.planKey ? 0.95 : 0.55} stroke={p.approvals.required ? "#8d153a" : "#fff"} strokeWidth="2.5" strokeDasharray={p.approvals.required ? "4 2" : undefined} />
            <text x={x(p.metrics.totalShiftDays)} y={y(p.metrics.riskReduction) + 4} textAnchor="middle" className="ad-pt-n">{I ? copy.archetype[I]!.charAt(0) : i + 1}</text></g>); })}
      </svg>
      <p className="rs-help">{copy.map.size}</p>
      <details><summary>{copy.map.table}</summary><table className="sl-table"><thead><tr><th scope="col">#</th><th scope="col">{copy.map.x}</th><th scope="col">{copy.map.y}</th></tr></thead><tbody>{order.map((p, i) => <tr key={p.planKey}><th scope="row">{i + 1}</th><td>{p.metrics.totalShiftDays}</td><td>{p.metrics.riskReduction}</td></tr>)}</tbody></table></details>
      <span className="sr-only">{locale}</span>
    </section>
  );
}

export function AdvisorPage({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAdvisorCopy(locale);
  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <p className="rs-help">{copy.demoNote}</p>
      <div className="rz-actions"><Link className="rs-btn" href={`/roadsync/conflicts/${id}`}>{copy.header.back}</Link></div>
      <AdvisorPanel conflictId={id} locale={locale} />
    </StaffWorkspaceShell>
  );
}
