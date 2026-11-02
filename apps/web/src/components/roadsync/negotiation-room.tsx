"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CopyIcon, FlagIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { CONDITION_CODES, DECLINE_REASONS, isActive, type Action, type Decision, type Room, type RoundView } from "@/lib/roadsync/coordination";
import { closeRequest, confirmConditions, deescalateRequest, escalateRequest, extendDeadline, fetchMessages, fetchRoom, fetchSuggestions, markThreadRead, nudgeRequest, postMessage, respondTo, reviseRequest, withdrawRequest, type RespondBody } from "@/lib/roadsync/coordination-api";
import { getCoordCopy } from "@/lib/roadsync/coordination-copy";
import { fetchDossier } from "@/lib/roadsync/conflict-records-api";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { useNow } from "./conflict-primitives";
import { buildProposal, EMPTY_FORM, ImpactCard, ProposalFields, sidesOf, type FormState } from "./coordination-composer";
import { AgreementMeter, DeadlineClock, ProposalDiff, StanceChip, StanceDisc, StatusChip } from "./coordination-primitives";
import { ScheduleOverlapChart } from "./nearby-activity";
import { BandPill, ScoreRing } from "./risk-visuals";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
type DialogKind = { kind: "respond" } | { kind: "revise" } | { kind: "reason"; action: "withdraw" | "close" | "escalate" | "deescalate" } | { kind: "extend" } | null;
const COMPATIBLE: string[] = ["schedule_shift", "working_hours", "sequence_order"];

export function NegotiationRoom({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getCoordCopy(locale);
  const ac = getAssessmentCopy(locale);
  const qc = useQueryClient();
  const search = useSearchParams();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const now = useNow();
  const [tab, setTab] = useState<"thread" | "participants" | "timeline" | "terms" | "conflict">("thread");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [toast, setToast] = useState<string | null>(search.get("created") ? fmt(copy.composer.success, { no: search.get("created") }) : null);
  const [live, setLive] = useState("");
  const [seen, setSeen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const key = workRequestQueryKey(epoch, userId, roleKey, "coord-room", id);
  const q = useQuery({ queryKey: key, queryFn: () => fetchRoom(id), enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });
  const r = q.data;
  const prevRound = useRef<number | null>(null);
  useEffect(() => { if (r) { if (prevRound.current !== null && prevRound.current !== r.round) setLive(fmt(copy.round, { n: r.round, max: r.maxRounds })); if (r.status === "agreed" && prevRound.current !== null) setLive(copy.room.seal); prevRound.current = r.round; } }, [r, copy]);

  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["roadsync"] }); void q.refetch(); }, [qc, q]);
  const failure = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) { setToast(copy.hub.stale); refresh(); }
    else if (error instanceof ApiError && error.status === 403) setToast(copy.hub.forbidden);
    else setToast(copy.hub.failed);
  };
  const done = (msg?: string) => () => { setDialog(null); if (msg) setLive(msg); refresh(); };
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: done(), onError: failure });
  const doAction = (a: Action) => {
    if (!r) return;
    if (a === "respond" || a === "counter") setDialog({ kind: "respond" });
    else if (a === "revise") setDialog({ kind: "revise" });
    else if (a === "confirm_conditions") run.mutate(() => confirmConditions(id, r.version));
    else if (a === "nudge") run.mutate(() => nudgeRequest(id, r.version));
    else if (a === "extend_deadline") setDialog({ kind: "extend" });
    else if (a === "withdraw") setDialog({ kind: "reason", action: "withdraw" });
    else if (a === "close_no_agreement") setDialog({ kind: "reason", action: "close" });
    else if (a === "escalate") setDialog({ kind: "reason", action: "escalate" });
    else if (a === "deescalate") setDialog({ kind: "reason", action: "deescalate" });
    else if (a === "message") setTab("thread");
  };

  if (!userId || q.isPending) return <StaffWorkspaceShell title={copy.title} wide><p className="rs-help" role="status">{copy.room.loading}</p></StaffWorkspaceShell>;
  if (q.isError || !r) {
    const missing = q.error instanceof ApiError && q.error.status === 404;
    return <StaffWorkspaceShell title={copy.title} wide><div className="rs-state" role="alert"><p>{missing ? copy.room.notFound : copy.room.error}</p>{missing ? null : <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" /> {copy.hub.retry}</button>}<Link className="rs-btn" href="/roadsync/coordination">{copy.room.back}</Link></div></StaffWorkspaceShell>;
  }
  const active = isActive(r.status);
  const finalRound = active && r.round >= r.maxRounds;
  const overdue = active && r.deadline.state === "overdue";
  const delta = r.diffSinceLastSeen;
  const sinceChips = delta && !seen ? [delta.newRounds ? fmt(copy.room.sinceRounds, { n: delta.newRounds }) : null, delta.newResponses ? fmt(copy.room.sinceResponses, { n: delta.newResponses }) : null, delta.newMessages ? fmt(copy.room.sinceMessages, { n: delta.newMessages }) : null].filter(Boolean) as string[] : [];
  const actions = r.allowedActions.filter((a) => a !== "message" && !(a === "counter"));
  const lastWarn = r.warnings.includes("deadline_close_to_start");

  return (
    <StaffWorkspaceShell title={r.requestNo} description={copy.title} wide>
      <div className="co-room">
        <Link className="co-back" href="/roadsync/coordination">← {copy.room.back}</Link>
        {sinceChips.length ? <div className="co-since" role="status"><strong>{copy.room.since}</strong>{sinceChips.map((c) => <span key={c} className="rs-nb-chip">{c}</span>)}<button type="button" className="rs-btn" onClick={() => setSeen(true)}>{copy.room.markSeen}</button></div> : null}
        {!active ? <p className="rs-notice" role="note">{copy.terminal}</p> : null}
        {finalRound ? <p className="rs-notice" role="note">{copy.finalRound}</p> : null}
        {overdue ? <p className="rs-notice" role="alert">{copy.overdueBanner}</p> : null}
        {r.allowedActions.length === 0 ? <p className="rs-help">{copy.room.viewerOnly}</p> : null}

        <header className="co-hero" data-escalated={r.escalated ? "true" : undefined}>
          <div className="co-hero-id">
            <code className="co-no">{r.requestNo}</code>
            <button type="button" className="rs-btn" aria-label={copy.room.copy} onClick={() => { void navigator.clipboard?.writeText(r.requestNo).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }}><CopyIcon aria-hidden="true" />{copied ? <span className="sr-only">✓</span> : null}</button>
            <span className="rs-nb-chip">{copy.types[r.type]}</span>
            <Link className="rs-nb-chip" href={`/roadsync/conflicts/${r.conflictId}`}><code>{r.conflictNo}</code></Link>
            {r.severity ? <><ScoreRing score={r.severity.score} band={r.severity.band} size={40} label={`${r.severity.score}`} /><BandPill band={r.severity.band} copy={ac} /></> : null}
            <StatusChip status={r.status} escalated={Boolean(r.escalated)} copy={copy} />
            <span className="rs-nb-chip">{fmt(copy.round, { n: r.round, max: r.maxRounds })}</span>
          </div>
          <div className="co-hero-meter"><AgreementMeter participants={r.participants} copy={copy} large /><DeadlineClock at={r.deadline.at} closed={!active} now={now} copy={copy} locale={locale} warn={lastWarn} /></div>
          <div className="co-actions" role="toolbar" aria-label={copy.room.actions.respond}>
            {r.allowedActions.includes("respond") ? <button type="button" className="rs-btn is-primary" onClick={() => doAction("respond")}>{copy.room.actions.respond}</button> : null}
            {actions.filter((a) => a !== "respond").map((a) => <button key={a} type="button" className="rs-btn" onClick={() => doAction(a)}>{a === "escalate" ? <FlagIcon aria-hidden="true" /> : null}{copy.room.actions[a]}</button>)}
          </div>
        </header>

        <div className="co-cols">
          <section className="co-table" aria-label={copy.room.ladder}>
            {r.status === "agreed" && r.agreedTerms ? <SealPanel r={r} copy={copy} locale={locale} /> : null}
            <h2>{copy.room.ladder}</h2>
            <ol className="co-ladder">
              {[...r.rounds].reverse().map((rd) => <Rung key={rd.n} r={r} round={rd} current={rd.n === r.round && active} open={expanded === rd.n || (expanded === null && rd.n === r.round)} onToggle={() => setExpanded(expanded === rd.n ? -1 : rd.n)} copy={copy} locale={locale} />)}
            </ol>
            <h2>{copy.room.stanceBoard}</h2>
            <div className="co-board">
              {r.participants.map((p) => (
                <div key={p.agencyId} className="co-board-col" data-mine={p.mine || undefined}>
                  <StanceDisc stance={p.stance} consulted={p.role === "consulted"} name={p.agencyName} label={`${p.agencyName ?? ""}: ${copy.stance[p.stance]}`} />
                  <strong>{p.agencyName}</strong>
                  <span className="rs-help">{copy.roles[p.role]}{p.required ? "" : ""}</span>
                  <StanceChip stance={p.stance} copy={copy} />
                  {p.lastDecisionAt ? <small>{copy.room.lastDecision}: {new Date(p.lastDecisionAt).toLocaleString(locale)}</small> : null}
                  {p.dueAt && p.stance === "pending" ? <small>{copy.room.due}: {new Date(p.dueAt).toLocaleString(locale)}</small> : null}
                </div>
              ))}
            </div>
          </section>
          <section className="co-tabs-wrap">
            <div role="tablist" className="co-tablist" aria-label={copy.title}>
              {(["thread", "participants", "timeline", "terms", "conflict"] as const).map((t) => <button key={t} id={`co-tab-${t}`} role="tab" type="button" aria-selected={tab === t} aria-controls={`co-panel-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>{copy.room.tabs[t]}</button>)}
            </div>
            <div role="tabpanel" id={`co-panel-${tab}`} aria-labelledby={`co-tab-${tab}`} className="co-panel">
              {tab === "thread" ? <Thread id={id} r={r} copy={copy} locale={locale} onError={failure} /> : null}
              {tab === "participants" ? <Participants r={r} copy={copy} locale={locale} /> : null}
              {tab === "timeline" ? <Timeline r={r} copy={copy} locale={locale} /> : null}
              {tab === "terms" ? <Terms r={r} copy={copy} locale={locale} /> : null}
              {tab === "conflict" ? <div><p><code>{r.conflictNo}</code> {r.severity ? <BandPill band={r.severity.band} copy={ac} /> : null}</p><p>{copy.integrations.stateLabel[r.status === "agreed" ? "agreed" : "negotiating"]}</p><Link className="rs-btn" href={`/roadsync/conflicts/${r.conflictId}`}>{copy.room.openConflict}</Link></div> : null}
            </div>
          </section>
        </div>

        {dialog?.kind === "respond" ? <RespondDialog r={r} copy={copy} onClose={() => setDialog(null)} onDone={done(copy.respond.sent)} onError={failure} national={roleKey === "SUPER_ADMIN"} /> : null}
        {dialog?.kind === "revise" ? <ReviseDialog r={r} copy={copy} onClose={() => setDialog(null)} onDone={done()} onError={failure} /> : null}
        {dialog?.kind === "reason" ? <ReasonDialog copy={copy} title={copy.room.actions[({ withdraw: "withdraw", close: "close_no_agreement", escalate: "escalate", deescalate: "deescalate" } as const)[dialog.action]]} onClose={() => setDialog(null)}
          onSend={(reason) => run.mutate(() => ({ withdraw: withdrawRequest, close: closeRequest, escalate: escalateRequest, deescalate: deescalateRequest })[dialog.action](id, { version: r.version, reason }))} busy={run.isPending} /> : null}
        {dialog?.kind === "extend" ? <ExtendDialog copy={copy} onClose={() => setDialog(null)} busy={run.isPending} onSend={(days) => run.mutate(() => extendDeadline(id, { version: r.version, deadlineAt: new Date(new Date(r.deadline.at ?? Date.now()).getTime() + days * 86_400_000).toISOString() }))} /> : null}
        {toast ? <div className="co-toast" role="status">{toast} <button type="button" onClick={() => setToast(null)} aria-label={copy.filters.close}><XIcon aria-hidden="true" /></button></div> : null}
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </StaffWorkspaceShell>
  );
}

// ---------- ladder ----------

function Rung({ r, round, current, open, onToggle, copy, locale }: { r: Room; round: RoundView; current: boolean; open: boolean; onToggle: () => void; copy: ReturnType<typeof getCoordCopy>; locale: string }) {
  const ac = getAssessmentCopy(locale as never);
  const imp = round.impact && "applicable" in (round.impact as object) && (round.impact as { applicable: boolean }).applicable ? (round.impact as { before: { riskIndex: number; pairScore: number; pairBand: keyof typeof ac.bands; conflictCount: number }; after: { riskIndex: number; pairScore: number; pairBand: keyof typeof ac.bands; conflictCount: number } }) : null;
  const slots = round.proposal.type === "site_meeting" ? (round.proposal.after.slots as string[]) : null;
  const chart = round.proposal.type === "schedule_shift" && round.proposal.before.start ? { self: { key: "now", label: copy.diff.before, start: String(round.proposal.before.start), end: String(round.proposal.before.end), color: "#64748b" }, lane: { key: "new", label: copy.diff.after, start: String(round.proposal.after.start), end: String(round.proposal.after.end), color: "#0B1F3A" } } : null;
  const agencyName = (agencyId: string) => r.participants.find((p) => p.agencyId === agencyId)?.agencyName ?? null;
  return (
    <li className="co-rung" data-current={current || undefined}>
      <div className="co-rung-head">
        <StanceDisc stance="proposer" name={round.proposedBy.agencyName} size={32} label={round.proposedBy.agencyName ?? ""} />
        <div><strong>{fmt(copy.round, { n: round.n, max: r.maxRounds })}</strong> · {round.proposedBy.agencyName}{round.proposedBy.name ? ` (${round.proposedBy.name})` : ""} · <span className="rs-nb-chip">{copy.types[round.proposal.type]}</span></div>
        {imp ? <span className="co-impact-chip" title={fmt(copy.room.riskDelta, { from: imp.before.riskIndex, to: imp.after.riskIndex })}>{fmt(copy.room.riskDelta, { from: imp.before.riskIndex, to: imp.after.riskIndex })} {imp.after.riskIndex < imp.before.riskIndex ? "▼" : imp.after.riskIndex > imp.before.riskIndex ? "▲" : ""}</span> : null}
        <button type="button" className="rs-btn" aria-expanded={open} onClick={onToggle}>{copy.room.proposal}</button>
      </div>
      {round.note ? <p className="co-note"><small>{copy.room.note}: </small>{round.note}</p> : null}
      {open ? (
        <div className="co-rung-body">
          <ProposalDiff proposal={round.proposal} copy={copy} locale={locale} agencyName={agencyName} />
          {imp ? <p className="rs-help">{fmt(copy.room.pairDelta, { from: `${imp.before.pairScore} (${ac.bands[imp.before.pairBand]})`, to: `${imp.after.pairScore} (${ac.bands[imp.after.pairBand]})` })} · {fmt(copy.room.conflictsDelta, { from: imp.before.conflictCount, to: imp.after.conflictCount })}</p> : <p className="rs-help">{copy.room.noImpact}</p>}
          {chart ? <ScheduleOverlapChart self={chart.self} lanes={[chart.lane]} compact /> : null}
          {slots ? <ul className="co-slots" aria-label={copy.composer.slots}>{slots.map((s) => { const who = round.responses.filter((x) => x.selectedSlot === s); const picked = r.status === "agreed" && r.agreedTerms?.round === round.n && who.length > 0; return <li key={s} data-picked={picked || undefined}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(s))}{who.map((x) => <StanceDisc key={x.agencyId} stance="accepted" name={x.agencyName} size={22} label={x.agencyName ?? ""} />)}</li>; })}</ul> : null}
        </div>
      ) : null}
      <ul className="co-responses">
        {round.responses.map((x) => (
          <li key={x.agencyId}>
            <StanceChip stance={x.decision === "accepted" ? "accepted" : x.decision === "accepted_with_conditions" ? "conditional" : x.decision === "counter_proposed" ? "countered" : x.decision === "needs_info" ? "needs_info" : "declined"} copy={copy} />
            <span>{x.agencyName}{x.onBehalf ? ` (${copy.room.onBehalf})` : ""}</span>
            {x.conditions.map((c, i) => <span key={i} className="rs-nb-chip">{copy.conditions[c.code] ?? c.code}{c.text ? `: ${c.text}` : ""}</span>)}
            {x.reasonCode ? <span className="rs-nb-chip">{copy.declineReasons[x.reasonCode] ?? x.reasonCode}</span> : null}
            {x.note ? <span className="co-note">{x.note}</span> : null}
            {x.counterRound ? <span className="rs-nb-chip">↪ {fmt(copy.round, { n: x.counterRound, max: r.maxRounds })}</span> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

function SealPanel({ r, copy, locale }: { r: Room; copy: ReturnType<typeof getCoordCopy>; locale: string }) {
  const t = r.agreedTerms!;
  return (
    <section className="co-seal" aria-label={copy.room.seal}>
      <svg className="co-seal-svg" viewBox="0 0 100 100" role="img" aria-label={copy.room.seal}>
        <circle className="co-seal-ring" cx="50" cy="50" r="44" fill="none" strokeWidth="4" />
        {Array.from({ length: 8 }, (_, i) => <ellipse key={i} className="co-seal-petal" cx="50" cy="26" rx="7" ry="15" transform={`rotate(${i * 45} 50 50)`} fill="none" strokeWidth="2.5" />)}
        <path className="co-seal-check" d="M34 52 L46 64 L68 38" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div><h2>{copy.room.seal}</h2><p className="rs-help">{copy.room.acceptedBy}: {t.acceptedBy.map((a) => a.agencyName).join(", ")} · {t.agreedAt ? new Date(t.agreedAt).toLocaleString(locale) : ""}</p></div>
    </section>
  );
}

// ---------- tabs ----------

function Thread({ id, r, copy, locale, onError }: { id: string; r: Room; copy: ReturnType<typeof getCoordCopy>; locale: string; onError: (e: unknown) => void }) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const key = workRequestQueryKey(epoch, userId, roleKey, "coord-thread", id);
  const q = useQuery({ queryKey: key, queryFn: () => fetchMessages(id), enabled: Boolean(userId), retry: false, refetchInterval: 15_000 });
  if (!q.data) return <p className="rs-help" role="status">{copy.room.loading}</p>;
  return <ThreadBody key={id} id={id} r={r} page={q.data} queryKey={key} copy={copy} locale={locale} onError={onError} />;
}

/** Mounted once the first page is in, so the "new messages" divider is fixed from the read marker at that moment. */
function ThreadBody({ id, r, page, queryKey, copy, locale, onError }: { id: string; r: Room; page: Awaited<ReturnType<typeof fetchMessages>>; queryKey: readonly unknown[]; copy: ReturnType<typeof getCoordCopy>; locale: string; onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [extra, setExtra] = useState<Awaited<ReturnType<typeof fetchMessages>>["items"]>([]);
  const [cursor, setCursor] = useState<string | null>(page.nextCursor);
  const [firstUnread] = useState(() => page.items.find((m) => !m.mine && (!page.lastSeenMessageId || m.id > page.lastSeenMessageId))?.id ?? null);
  useEffect(() => { void markThreadRead(id).catch(() => undefined); }, [id]);
  const items = [...page.items, ...extra];
  const send = useMutation({ mutationFn: () => postMessage(id, text.trim()), onSuccess: () => { setText(""); void qc.invalidateQueries({ queryKey }); }, onError });
  const more = useMutation({ mutationFn: () => fetchMessages(id, cursor), onSuccess: (p) => { setExtra((cur) => [...cur, ...p.items]); setCursor(p.nextCursor); } });
  const canPost = r.allowedActions.includes("message");
  return (
    <div className="co-thread">
      <p className="rs-help">{copy.thread.visible}</p>
      {items.length === 0 ? <p className="rs-help">{copy.thread.empty}</p> : (
        <ol className="co-messages">
          {items.map((m) => (
            <li key={m.id} data-mine={m.mine || undefined}>
              {m.id === firstUnread ? <p className="co-divider" role="separator">{copy.thread.unread}</p> : null}
              <small>{m.agencyName}{m.name ? ` · ${m.name}` : ""} · {m.at ? new Date(m.at).toLocaleString(locale) : ""}</small>
              <p>{m.text}</p>
            </li>
          ))}
        </ol>
      )}
      {cursor ? <button type="button" className="rs-btn" disabled={more.isPending} onClick={() => more.mutate()}>{copy.thread.loadMore}</button> : null}
      {canPost ? <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}><textarea className="rs-input" rows={3} maxLength={1000} value={text} placeholder={copy.thread.placeholder} aria-label={copy.thread.placeholder} onChange={(e) => setText(e.target.value)} /><button type="submit" className="rs-btn is-primary" disabled={!text.trim() || send.isPending}>{copy.thread.send}</button></form> : <p className="rs-help">{isActive(r.status) ? copy.room.viewerOnly : copy.thread.terminal}</p>}
    </div>
  );
}

function Participants({ r, copy, locale }: { r: Room; copy: ReturnType<typeof getCoordCopy>; locale: string }) {
  return (
    <div>
      <ul className="co-plist">{r.participants.map((p) => <li key={p.agencyId}><StanceDisc stance={p.stance} consulted={p.role === "consulted"} name={p.agencyName} size={30} label={p.agencyName ?? ""} /><span><strong>{p.agencyName}</strong><small>{copy.roles[p.role]} · {copy.stance[p.stance]}</small></span></li>)}</ul>
      <h3>{copy.room.nudges}</h3>
      {r.nudges.length === 0 ? <p className="rs-help">{copy.room.noNudges}</p> : <ul>{r.nudges.map((n, i) => <li key={i}>{n.agencyName} · {n.at ? new Date(n.at).toLocaleString(locale) : ""}</li>)}</ul>}
    </div>
  );
}

function Timeline({ r, copy, locale }: { r: Room; copy: ReturnType<typeof getCoordCopy>; locale: string }) {
  const actor = (e: Room["events"][number]) => (e.actor.kind === "system" ? copy.events.actorSystem : e.actor.name ?? fmt(copy.events.actorAgency, { agency: e.actor.agencyName ?? "—" }));
  return <ol className="co-events">{[...r.events].reverse().map((e) => <li key={e.id}><strong>{copy.events[e.type] ?? e.type}</strong>{typeof e.data.decision === "string" ? ` · ${copy.decisionDone[e.data.decision] ?? e.data.decision}` : ""}<small>{actor(e)} · {new Date(e.at).toLocaleString(locale)}</small></li>)}</ol>;
}

function Terms({ r, copy, locale }: { r: Room; copy: ReturnType<typeof getCoordCopy>; locale: string }) {
  const t = r.agreedTerms;
  const proposal = t?.proposal ?? r.rounds.at(-1)?.proposal;
  const conditions = t?.conditions ?? r.rounds.at(-1)?.responses.flatMap((x) => x.conditions.map((c) => ({ agencyName: x.agencyName, code: c.code, text: c.text }))) ?? [];
  if (!proposal) return <p className="rs-help">{copy.room.noTerms}</p>;
  return (
    <div>
      <h3>{t ? copy.room.agreedTerms : copy.room.currentProposal}</h3>
      <ProposalDiff proposal={proposal} copy={copy} locale={locale} />
      <h4>{copy.room.termsConditions}</h4>
      {conditions.length ? <ul>{conditions.map((c, i) => <li key={i}>{c.agencyName}: {copy.conditions[c.code] ?? c.code}{c.text ? ` — ${c.text}` : ""}</li>)}</ul> : <p className="rs-help">—</p>}
      {t ? <p className="rs-help">{copy.room.acceptedBy}: {t.acceptedBy.map((a) => `${a.agencyName} (${a.at ? new Date(a.at).toLocaleString(locale) : ""})`).join(", ")}</p> : null}
    </div>
  );
}

// ---------- dialogs ----------

function ReasonDialog({ copy, title, onClose, onSend, busy }: { copy: ReturnType<typeof getCoordCopy>; title: string; onClose: () => void; onSend: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal><Dialog.Overlay className="co-overlay" />
        <Dialog.Content className="co-dialog"><Dialog.Title>{title}</Dialog.Title><Dialog.Description className="sr-only">{title}</Dialog.Description>
          <label className="co-field">{copy.room.reasonLabel}<textarea className="rs-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="co-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{copy.room.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={reason.trim().length < 10 || busy} onClick={() => onSend(reason.trim())}>{copy.room.confirm}</button></div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  );
}

function ExtendDialog({ copy, onClose, onSend, busy }: { copy: ReturnType<typeof getCoordCopy>; onClose: () => void; onSend: (days: number) => void; busy: boolean }) {
  const [days, setDays] = useState(3);
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal><Dialog.Overlay className="co-overlay" />
        <Dialog.Content className="co-dialog"><Dialog.Title>{copy.room.actions.extend_deadline}</Dialog.Title><Dialog.Description className="sr-only">{copy.room.extendBy}</Dialog.Description>
          <label className="co-field">{copy.room.extendBy}<input className="rs-input" type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} /></label>
          <div className="co-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{copy.room.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={busy} onClick={() => onSend(days)}>{copy.room.confirm}</button></div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  );
}

function useConflictContext(conflictId: string, enabled: boolean) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const d = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-dossier", conflictId), queryFn: () => fetchDossier(conflictId), enabled: enabled && Boolean(userId), retry: false });
  const s = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "coord-suggestions", conflictId), queryFn: () => fetchSuggestions(conflictId), enabled: enabled && Boolean(userId), retry: false });
  return { dossier: d.data ?? null, sug: s.data ?? null };
}

function RespondDialog({ r, copy, onClose, onDone, onError, national }: { r: Room; copy: ReturnType<typeof getCoordCopy>; onClose: () => void; onDone: () => void; onError: (e: unknown) => void; national: boolean }) {
  const [decision, setDecision] = useState<Decision>("accepted");
  const [conds, setConds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState("");
  const [agency, setAgency] = useState("");
  const [why, setWhy] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const current = r.rounds[r.round - 1]!;
  const slots = current.proposal.type === "site_meeting" ? (current.proposal.after.slots as string[]) : null;
  const counterType = COMPATIBLE.includes(current.proposal.type) ? (current.proposal.type === "working_hours" ? "working_hours" : "schedule_shift") : current.proposal.type;
  const ctx = useConflictContext(r.conflictId, decision === "counter_proposed");
  const sides = useMemo(() => (ctx.dossier ? sidesOf(ctx.dossier) : []), [ctx.dossier]);
  const counterRaw = decision === "counter_proposed" ? buildProposal(counterType, form, sides) : null;
  const allowed = r.allowedActions;
  const decisions = (["accepted", "accepted_with_conditions", "counter_proposed", "needs_info", "declined"] as const).filter((x) => x !== "counter_proposed" || allowed.includes("counter"));
  const send = useMutation({
    mutationFn: () => {
      const body: RespondBody = { version: r.version, round: r.round, decision, ...(national ? { onBehalfOfAgencyId: agency, reason: why } : {}) };
      if (decision === "accepted_with_conditions") body.conditions = conds.map((code) => ({ code, ...(code === "other" ? { text: otherText.trim() } : {}) }));
      if (decision === "declined") { body.reasonCode = reasonCode; if (note.trim()) body.note = note.trim(); }
      if ((decision === "needs_info" || decision === "counter_proposed") && note.trim()) body.note = note.trim();
      if (slots && (decision === "accepted" || decision === "accepted_with_conditions")) body.selectedSlot = slot;
      if (decision === "counter_proposed") body.counterProposal = { type: counterType, proposal: counterRaw };
      return respondTo(r.id, body);
    },
    onSuccess: onDone, onError,
  });
  const valid = (decision !== "accepted_with_conditions" || (conds.length > 0 && conds.length <= 5 && (!conds.includes("other") || otherText.trim().length > 0)))
    && (decision !== "declined" || (reasonCode !== "" && (reasonCode !== "other" || note.trim().length > 0)))
    && (decision !== "needs_info" || note.trim().length > 0) && (decision !== "counter_proposed" || Boolean(counterRaw))
    && (!slots || !["accepted", "accepted_with_conditions"].includes(decision) || slot !== "") && (!national || (agency !== "" && why.trim().length >= 10));
  const rc = copy.respond;
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal><Dialog.Overlay className="co-overlay" />
        <Dialog.Content className="co-dialog co-dialog-wide"><Dialog.Title>{fmt(rc.title, { no: r.requestNo })}</Dialog.Title><Dialog.Description className="sr-only">{rc.decision}</Dialog.Description>
          <fieldset className="co-field"><legend>{rc.decision}</legend>
            <div className="co-seg-btns" role="radiogroup">{decisions.map((x) => <button key={x} type="button" role="radio" aria-checked={decision === x} onClick={() => setDecision(x)}>{copy.decisions[x]}</button>)}</div>
          </fieldset>
          {national ? <><label className="co-field">{rc.onBehalfAgency}<select className="rs-input" value={agency} onChange={(e) => setAgency(e.target.value)}><option value="" />{r.participants.filter((p) => p.stance !== "proposer").map((p) => <option key={p.agencyId} value={p.agencyId}>{p.agencyName}</option>)}</select></label>
            <label className="co-field">{rc.onBehalfReason}<textarea className="rs-input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></label></> : null}
          {slots && (decision === "accepted" || decision === "accepted_with_conditions") ? <fieldset className="co-field"><legend>{rc.slotPick}</legend>{slots.map((s) => <label key={s} className="co-check"><input type="radio" name="slot" checked={slot === s} onChange={() => setSlot(s)} /> {new Date(s).toLocaleString()}</label>)}</fieldset> : null}
          {decision === "accepted_with_conditions" ? <fieldset className="co-field"><legend>{rc.conditions}</legend>
            <div className="co-chips-pick">{CONDITION_CODES.map((c) => <button key={c} type="button" aria-pressed={conds.includes(c)} className="rs-nb-chip" onClick={() => setConds(conds.includes(c) ? conds.filter((x) => x !== c) : conds.length < 5 ? [...conds, c] : conds)}>{copy.conditions[c]}</button>)}</div>
            {conds.includes("other") ? <input className="rs-input" maxLength={200} value={otherText} placeholder={rc.other} aria-label={rc.other} onChange={(e) => setOtherText(e.target.value)} /> : null}</fieldset> : null}
          {decision === "declined" ? <label className="co-field">{rc.reason}<select className="rs-input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}><option value="" />{DECLINE_REASONS.map((c) => <option key={c} value={c}>{copy.declineReasons[c]}</option>)}</select></label> : null}
          {decision === "counter_proposed" && ctx.dossier ? <div><h3>{rc.counter}</h3><p className="rs-help">{rc.counterHelp}</p>
            <ProposalFields type={counterType} f={form} set={(p) => setForm((c) => ({ ...c, ...p }))} sides={sides} d={ctx.dossier} sug={ctx.sug} copy={copy} /><ImpactCard conflictId={r.conflictId} type={counterType} proposal={counterRaw} copy={copy} /></div> : null}
          {["declined", "needs_info", "counter_proposed", "accepted_with_conditions", "accepted"].includes(decision) ? <label className="co-field">{rc.note}<textarea className="rs-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /><small>{copy.visibleToAll}</small></label> : null}
          <div className="co-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{copy.room.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={!valid || send.isPending} onClick={() => send.mutate()}>{rc.send}</button></div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviseDialog({ r, copy, onClose, onDone, onError }: { r: Room; copy: ReturnType<typeof getCoordCopy>; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const current = r.rounds[r.round - 1]!;
  const type = current.proposal.type;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [note, setNote] = useState("");
  const ctx = useConflictContext(r.conflictId, true);
  const sides = useMemo(() => (ctx.dossier ? sidesOf(ctx.dossier) : []), [ctx.dossier]);
  const raw = buildProposal(type, form, sides);
  const send = useMutation({ mutationFn: () => reviseRequest(r.id, { version: r.version, type, proposal: raw, ...(note.trim() ? { note: note.trim() } : {}) }), onSuccess: onDone, onError });
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal><Dialog.Overlay className="co-overlay" />
        <Dialog.Content className="co-dialog co-dialog-wide"><Dialog.Title>{copy.room.actions.revise}</Dialog.Title><Dialog.Description className="sr-only">{copy.types[type]}</Dialog.Description>
          {ctx.dossier ? <><ProposalFields type={type} f={form} set={(p) => setForm((c) => ({ ...c, ...p }))} sides={sides} d={ctx.dossier} sug={ctx.sug} copy={copy} /><ImpactCard conflictId={r.conflictId} type={type} proposal={raw} copy={copy} /></> : <p className="rs-help">{copy.room.loading}</p>}
          <label className="co-field">{copy.respond.note}<textarea className="rs-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="co-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{copy.room.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={!raw || send.isPending} onClick={() => send.mutate()}>{copy.composer.send}</button></div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  );
}
