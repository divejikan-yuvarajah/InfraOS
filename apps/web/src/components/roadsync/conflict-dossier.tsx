"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CheckIcon, CopyIcon, CrownIcon, DownloadIcon, EyeIcon, LockIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BAND_COLOR, BAND_RANGE, BANDS_ASC, fmt } from "@/lib/roadsync/assessment";
import { factorSentence, getAssessmentCopy, mitigationSentence } from "@/lib/roadsync/assessment-copy";
import { IMPLEMENTED_LIFECYCLE, SIDE_EXITS, stepPath, type Dossier, type FactorView, type HistoryPoint } from "@/lib/roadsync/conflict-records";
import { acknowledgeRecord, addAffectedAgency, addRecordNote, deleteRecordNote, dismissRecord, downloadFile, evidencePath, excludeAffectedAgency, fetchDossier, fetchRecordMap, reopenRecord, restoreAffectedAgency, setLeadAgency, setWatching } from "@/lib/roadsync/conflict-records-api";
import { getConflictCopy, type ConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { ConflictMap } from "./conflict-map";
import { AckSegments, SlaChip, StatusPill, TimeRing, useNow } from "./conflict-primitives";
import { ScheduleOverlapChart } from "./nearby-activity";
import { BandPill, ScoreRing, SeverityDNA } from "./risk-visuals";
import { StakeholderConstellation } from "./stakeholder-constellation";
import { CoordinationTab } from "./dossier-coordination";
import { HistoryTab } from "./history-tab";
import { ResolutionTab } from "./resolution-tab";
import { AdvisorPanel } from "./advisor-tab";
import { fetchCachedAdvisor } from "@/lib/roadsync/advisor-api";
import { getAdvisorCopy } from "@/lib/roadsync/advisor-copy";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";
import { fetchConflictCoordination } from "@/lib/roadsync/coordination-api";
import { getCoordCopy } from "@/lib/roadsync/coordination-copy";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
type Tab = "overview" | "stakeholders" | "coordination" | "resolution" | "advisor" | "history" | "timeline" | "notes" | "related" | "evidence";
const TABS: Tab[] = ["overview", "stakeholders", "coordination", "resolution", "advisor", "history", "timeline", "notes", "related", "evidence"];
type DialogKind = { kind: "ack" } | { kind: "dismiss" } | { kind: "reopen" } | { kind: "lead"; agencyId: string } | { kind: "exclude"; agencyId: string } | { kind: "add" } | null;

export function ConflictDossier({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getConflictCopy(locale);
  const cc = getCoordCopy(locale);
  const rc = getResolutionCopy(locale);
  const ac = getAssessmentCopy(locale);
  const qc = useQueryClient();
  const router = useRouter();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const now = useNow();
  const [tab, setTab] = useState<Tab>(() => { const t = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab"); return t === "resolution" || t === "history" || t === "advisor" ? t : "overview"; });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [seenHidden, setSeenHidden] = useState(false);
  const [related, setRelated] = useState(true);
  const [copied, setCopied] = useState(false);

  const key = workRequestQueryKey(epoch, userId, roleKey, "conflict-dossier", id);
  const q = useQuery({ queryKey: key, queryFn: () => fetchDossier(id), enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });
  const map = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-map", id), queryFn: () => fetchRecordMap(id), enabled: Boolean(userId) && Boolean(q.data), retry: false });
  const d = q.data;
  const coord = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-coordination", id), queryFn: () => fetchConflictCoordination(id), enabled: Boolean(userId) && Boolean(d), retry: false, refetchOnWindowFocus: true });
  const advCache = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "advisor-cached", id), queryFn: () => fetchCachedAdvisor(id), enabled: Boolean(userId) && Boolean(d), retry: false });
  const [stanceMode, setStanceMode] = useState(false);

  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["roadsync"] }); void q.refetch(); }, [qc, q]);
  const failure = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) { setToast(copy.states.stale); refresh(); }
    else if (error instanceof ApiError && error.status === 403) setToast(copy.states.forbidden);
    else setToast(copy.states.failed);
  };
  const done = (message?: string) => () => { setDialog(null); if (message) setLive(message); refresh(); };
  const ack = useMutation({ mutationFn: (note: string) => acknowledgeRecord(id, { version: d!.version, ...(note ? { note } : {}) }), onSuccess: done(fmt(copy.states.ackLive, { no: d?.conflictNo ?? "" })), onError: failure });
  const dismiss = useMutation({ mutationFn: (reason: string) => dismissRecord(id, { version: d!.version, reason }), onSuccess: done(), onError: failure });
  const reopen = useMutation({ mutationFn: (reason: string) => reopenRecord(id, { version: d!.version, reason }), onSuccess: done(), onError: failure });
  const lead = useMutation({ mutationFn: (agencyId: string) => setLeadAgency(id, { version: d!.version, agencyId }), onSuccess: done(), onError: failure });
  const add = useMutation({ mutationFn: (v: { agencyId: string; reason: string }) => addAffectedAgency(id, { version: d!.version, ...v }), onSuccess: done(), onError: failure });
  const exclude = useMutation({ mutationFn: (v: { agencyId: string; reason: string }) => excludeAffectedAgency(id, v.agencyId, { version: d!.version, reason: v.reason }), onSuccess: done(), onError: failure });
  const restore = useMutation({ mutationFn: (agencyId: string) => restoreAffectedAgency(id, agencyId, { version: d!.version }), onSuccess: done(), onError: failure });
  const watch = useMutation({ mutationFn: () => setWatching(id, !d!.watching), onSuccess: refresh, onError: failure });

  const mapFeatures = useMemo(() => ((map.data?.features ?? []) as { properties: { feature?: string } }[]).filter((f) => related || f.properties.feature !== "related"), [map.data, related]) as never[];

  if (!userId || q.isPending) return <StaffWorkspaceShell title={copy.title} wide><p className="rs-help" role="status">{copy.dossier.loading}</p></StaffWorkspaceShell>;
  if (q.isError || !d) {
    const missing = q.error instanceof ApiError && q.error.status === 404;
    return <StaffWorkspaceShell title={copy.title} wide><div className="rs-state" role="alert"><p>{missing ? copy.dossier.notFound : copy.dossier.error}</p>{missing ? null : <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" /> {copy.states.retry}</button>}<Link className="rs-btn" href="/roadsync/conflicts">{copy.dossier.back}</Link></div></StaffWorkspaceShell>;
  }

  const myAgency = d.affected.find((a) => d.myAgency?.agencyId === a.agencyId);
  const sentenceLead = d.lead ? (d.lead.source === "national" ? fmt(copy.lead.national, { agency: d.lead.agencyName ?? "—" }) : fmt(copy.lead.suggested, { agency: d.lead.agencyName ?? "—", reason: copy.reasons[d.lead.reasonCode] ?? "" })) : copy.lead.none;
  const delta = d.diffSinceLastSeen;
  const sinceChips = delta && !seenHidden ? [
    delta.newEvents ? fmt(copy.dossier.sinceEvents, { n: delta.newEvents }) : null,
    delta.severityDelta ? fmt(copy.dossier.sinceSeverity, { from: delta.severityDelta.from.score, to: delta.severityDelta.to.score }) : null,
    delta.agenciesAdded ? fmt(copy.dossier.sinceAgencies, { n: delta.agenciesAdded }) : null,
    delta.statusChanged ? fmt(copy.dossier.sinceStatus, { from: copy.status[delta.statusChanged.from], to: copy.status[delta.statusChanged.to] }) : null,
  ].filter(Boolean) as string[] : [];
  const copyNo = () => { void navigator.clipboard?.writeText(d.conflictNo).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); };
  const permalink = () => { void navigator.clipboard?.writeText(window.location.href); };

  return (
    <StaffWorkspaceShell title={d.conflictNo} description={copy.title} wide>
      <div className="cr-dossier">
        <Link className="cr-back" href="/roadsync/conflicts">← {copy.dossier.back}</Link>
        {sinceChips.length ? <div className="cr-since" role="status"><strong>{copy.dossier.since}</strong>{sinceChips.map((c) => <span key={c} className="rs-nb-chip">{c}</span>)}<button type="button" className="rs-btn" onClick={() => setSeenHidden(true)}>{copy.dossier.markSeen}</button></div> : null}

        <header className="cr-hero" data-band={d.severity.band}>
          <div className="cr-hero-id">
            <code className="cr-no-lg">{d.conflictNo}</code>
            <button type="button" className="rs-btn" onClick={copyNo} aria-label={copy.dossier.copy}>{copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}<span className="sr-only">{copied ? copy.dossier.copied : copy.dossier.copy}</span></button>
            <StatusPill status={d.status} copy={copy} belowThreshold={d.belowThreshold} />
            {d.internal ? <span className="rs-nb-chip">{copy.internalChip}</span> : null}
          </div>
          <div className="cr-hero-sev">
            <ScoreRing score={d.severity.score} band={d.severity.band} size={72} label={`${d.severity.score} ${ac.bands[d.severity.band]}`} />
            <div>
              {d.recordType === "conflict" ? <BandPill band={d.severity.band} copy={ac} /> : <span className="rs-sev" data-kind="opportunity"><span>{copy.recordType.opportunity}</span></span>}
              <div className="cr-chips">{d.severity.classes.map((c) => <span key={c} className="rs-nb-chip">{ac.classes[c]}</span>)}</div>
            </div>
            <TimeRing t={d.timeToImpact} copy={copy} size={48} />
          </div>
          <div className="cr-hero-meta">
            <p>{fmt(copy.dossier.ackSummary, d.ackProgress)}</p><AckSegments row={d} copy={copy} />
            {myAgency && myAgency.ack.status === "pending" ? <SlaChip due={myAgency.ackDueAt} now={now} copy={copy} locale={locale} /> : null}
            <p className="cr-lead"><CrownIcon aria-hidden="true" /> {sentenceLead}</p>
            {coord.data && coord.data.coordination.activeCount > 0 ? <Link className="rs-nb-chip" href={`/roadsync/coordination?preset=all&conflictId=${id}`}>{coord.data.items.filter((x) => x.myParticipation?.mustRespond).length > 0 ? fmt(cc.integrations.activeChip, { active: coord.data.coordination.activeCount, needs: coord.data.items.filter((x) => x.myParticipation?.mustRespond).length }) : fmt(cc.integrations.activeChipNone, { active: coord.data.coordination.activeCount })}</Link> : null}
          </div>
          <div className="cr-hero-actions">
            {d.canAct.acknowledge ? <button type="button" className="rs-btn is-primary" onClick={() => setDialog({ kind: "ack" })}>{copy.dossier.acknowledge}</button> : null}
            {d.canAct.dismiss ? <button type="button" className="rs-btn" onClick={() => setDialog({ kind: "dismiss" })}>{copy.dossier.dismiss}</button> : null}
            {d.canAct.reopen ? <button type="button" className="rs-btn" onClick={() => setDialog({ kind: "reopen" })}>{copy.dossier.reopen}</button> : null}
            <button type="button" className="rs-btn" aria-pressed={d.watching} onClick={() => watch.mutate()}><EyeIcon aria-hidden="true" /> {d.watching ? copy.dossier.unwatch : copy.dossier.watch}</button>
            <button type="button" className="rs-btn" onClick={() => void downloadFile(evidencePath(id), `${d.conflictNo}.geojson`).catch(() => setToast(copy.states.failed))}><DownloadIcon aria-hidden="true" /> {copy.dossier.evidence}</button>
            <button type="button" className="rs-btn" onClick={permalink}>{copy.dossier.permalink}</button>
          </div>
        </header>

        <Lifecycle d={d} copy={copy} locale={locale} />

        <div className="cr-cols">
          <aside className="cr-mapcard">
            {map.data ? <ConflictMap mode="dossier" features={mapFeatures} label={copy.map.aria} onSelect={(rid) => router.push(`/roadsync/conflicts/${rid}`)} /> : <p className="rs-help">{map.isError ? copy.dossier.noMap : copy.states.loading}</p>}
            <label className="cr-toggle"><input type="checkbox" checked={related} onChange={(e) => setRelated(e.target.checked)} /> {copy.dossier.mapToggle}</label>
          </aside>
          <section className="cr-tabs">
            <div role="tablist" className="cr-tablist" aria-label={copy.title}>
              {TABS.map((t) => <button key={t} id={`cr-tab-${t}`} role="tab" type="button" aria-selected={tab === t} aria-controls={`cr-panel-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}
                onKeyDown={(e) => { const i = TABS.indexOf(t); const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length] : null; if (next) { e.preventDefault(); setTab(next); document.getElementById(`cr-tab-${next}`)?.focus(); } }}>{t === "coordination" ? <>{cc.integrations.tab}{coord.data && coord.data.coordination.activeCount > 0 ? <span className="cr-tabcount"> ({coord.data.coordination.activeCount})</span> : null}</> : t === "advisor" ? <>{getAdvisorCopy(locale).tab}{advCache.data?.available ? <span className="cr-tabcount"> ({advCache.data.count})</span> : null}</> : t === "resolution" ? rc.tab : t === "history" ? rc.historyTab : copy.dossier.tabs[t]}</button>)}
            </div>
            <div role="tabpanel" id={`cr-panel-${tab}`} aria-labelledby={`cr-tab-${tab}`} className="cr-panel">
              {tab === "overview" ? <Overview d={d} copy={copy} /> : null}
              {tab === "coordination" ? <CoordinationTab d={d} data={coord.data ?? null} loading={coord.isPending} copy={cc} locale={locale} /> : null}
              {tab === "advisor" ? <AdvisorPanel conflictId={id} locale={locale} /> : null}
              {tab === "resolution" ? <ResolutionTab conflictId={id} locale={locale} parties={[d.parties.a, d.parties.b].map((p) => ({ id: p.id, ref: p.ref, agencyName: p.agencyName }))} /> : null}
              {tab === "history" ? <HistoryTab conflictId={id} conflictNo={d.conflictNo} locale={locale} /> : null}
              {tab === "stakeholders" ? <><label className="cr-toggle"><input type="checkbox" checked={stanceMode && Boolean(coord.data?.items[0])} disabled={!coord.data?.items[0]} onChange={(e) => setStanceMode(e.target.checked)} /> {cc.integrations.stanceMode}</label>{stanceMode && coord.data?.items[0] ? <p className="rs-help">{cc.integrations.stanceLegend}</p> : null}<StakeholderConstellation stances={stanceMode && coord.data?.items[0] ? Object.fromEntries(coord.data.items[0].participants.map((p) => [p.agencyId, { stance: p.stance, label: cc.stance[p.stance] }])) : null} d={d} copy={copy} locale={locale} now={now} bandLabel={ac.bands[d.severity.band]} canManage={d.canAct.manageAgencies}
                handlers={{ onSetLead: (agencyId) => setDialog({ kind: "lead", agencyId }), onExclude: (agencyId) => setDialog({ kind: "exclude", agencyId }), onRestore: (agencyId) => restore.mutate(agencyId), onAdd: () => setDialog({ kind: "add" }) }} /></> : null}
              {tab === "timeline" ? <Timeline d={d} copy={copy} locale={locale} /> : null}
              {tab === "notes" ? <Notes d={d} copy={copy} national={d.canAct.dismiss || d.canAct.reopen} onChanged={refresh} onError={failure} /> : null}
              {tab === "related" ? <Related d={d} copy={copy} /> : null}
              {tab === "evidence" ? <Evidence d={d} copy={copy} onDownload={() => void downloadFile(evidencePath(id), `${d.conflictNo}.geojson`).catch(() => setToast(copy.states.failed))} /> : null}
            </div>
          </section>
        </div>

        <ActionDialog dialog={dialog} copy={copy} agencyName={myAgency?.agencyName ?? d.parties.a.agencyName ?? ""} busy={ack.isPending || dismiss.isPending || reopen.isPending || lead.isPending || add.isPending || exclude.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(v) => {
            if (!dialog) return;
            if (dialog.kind === "ack") ack.mutate(v.text);
            else if (dialog.kind === "dismiss") dismiss.mutate(v.text);
            else if (dialog.kind === "reopen") reopen.mutate(v.text);
            else if (dialog.kind === "lead") lead.mutate(dialog.agencyId);
            else if (dialog.kind === "exclude") exclude.mutate({ agencyId: dialog.agencyId, reason: v.text });
            else if (dialog.kind === "add") add.mutate({ agencyId: v.agencyId, reason: v.text });
          }} />
        {toast ? <div className="cr-toast" role="status">{toast} <button type="button" onClick={() => setToast(null)} aria-label={copy.filters.close}><XIcon aria-hidden="true" /></button></div> : null}
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </StaffWorkspaceShell>
  );
}

/** Data-driven: Steps 74-77 add stages by extending IMPLEMENTED_LIFECYCLE, not by rewriting this markup. */
function Lifecycle({ d, copy, locale }: { d: Dossier; copy: ConflictCopy; locale: string }) {
  const when = d.statusChangedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(d.statusChangedAt)) : "";
  const stage = (s: (typeof IMPLEMENTED_LIFECYCLE)[number] | (typeof SIDE_EXITS)[number], exit = false) => (
    <li key={s} className="cr-stage" data-current={d.status === s} data-exit={exit}>
      <span aria-hidden="true" className="cr-stage-dot" />
      <span>{copy.status[s]}</span>
      {d.status === s ? <small>{copy.lifecycle.current}{when ? ` · ${when}` : ""}</small> : null}
    </li>
  );
  return <nav className="cr-lifecycle" aria-label={copy.lifecycle.title}><ol>{IMPLEMENTED_LIFECYCLE.map((s) => stage(s))}</ol><ol className="cr-exits">{SIDE_EXITS.map((s) => stage(s, true))}</ol></nav>;
}

function Overview({ d, copy }: { d: Dossier; copy: ConflictCopy }) {
  const [locale] = useWorkspaceLocale();
  const ac = getAssessmentCopy(locale);
  const a = d.assessment;
  const { a: pa, b: pb } = d.parties;
  const yours = pa.mine && !pb.mine ? [pa, pb] : pb.mine && !pa.mine ? [pb, pa] : [pa, pb];
  const personal = (pa.mine && !pb.mine) || (pb.mine && !pa.mine);
  const t = d.temporal;
  const overlap = t?.overlapStart && t.overlapEnd ? { start: t.overlapStart, end: t.overlapEnd } : null;
  const factors = (a?.factors ?? []) as FactorView[];
  const total = a ? factors.reduce((n, f) => n + f.points, 0) + a.mitigations.reduce((n, m) => n + m.points, 0) : 0;
  return (
    <div className="cr-overview">
      {d.recordType === "opportunity" ? (
        <div className="cr-dig" role="note"><h3>{copy.dossier.digOnce}</h3><p>{fmt(copy.dossier.digOnceBody, { meters: Math.round(a?.estimatedSharedTrenchMeters ?? 0) })}</p></div>
      ) : (
        <section aria-label={copy.dossier.why}>
          <h3>{copy.dossier.why}</h3>
          {d.severityDetail.current.overridden ? <p className="rs-notice">{copy.dossier.overrideNote}</p> : null}
          {a ? (
            <>
              <SeverityDNA factors={factors} copy={ac} />
              <table className="cr-waterfall"><caption className="sr-only">{ac.lens.waterfallTable}</caption><tbody>
                {factors.filter((f) => f.key !== "floor").map((f) => <tr key={f.key}><th scope="row">{ac.component[f.key] ?? f.key}<small>{factorSentence(ac, f)}</small></th><td><span className="cr-bar" style={{ width: `${(f.points / Math.max(f.max, 1)) * 100}%` }} />{f.points}/{f.max}</td></tr>)}
                {a.mitigations.map((m) => <tr key={m.key}><th scope="row">{ac.lens.mitigation}<small>{mitigationSentence(ac, m as never)}</small></th><td>{m.points}</td></tr>)}
                {a.floorApplied ? <tr><th scope="row">{fmt(copy.dossier.floor, a.floorApplied)}</th><td>{a.floorApplied.min}</td></tr> : null}
                <tr className="cr-total"><th scope="row">{ac.lens.final}</th><td>{d.severity.score}{total !== d.severity.score && !a.floorApplied ? ` (${total})` : ""}</td></tr>
              </tbody></table>
              <p className="rs-help">{fmt(copy.dossier.ruleVersion, { version: a.ruleVersion })}</p>
            </>
          ) : null}
        </section>
      )}
      <section>
        <h3>{personal ? `${copy.dossier.yours} / ${copy.dossier.theirs}` : `${copy.dossier.partyA} / ${copy.dossier.partyB}`}</h3>
        <div className="cr-compare">
          {yours.map((p, i) => (
            <div key={p.id} className="cr-pv-party" data-mine={p.mine}>
              <span className="rs-help">{personal ? (i === 0 ? copy.dossier.yours : copy.dossier.theirs) : i === 0 ? copy.dossier.partyA : copy.dossier.partyB}</span>
              <code>{p.ref}</code><strong>{p.title}</strong><span>{p.agencyName ?? "—"} · {p.infrastructureType.toLowerCase()}</span>
              <span className="rs-help">{p.plannedStart?.slice(0, 10)} → {p.plannedEnd?.slice(0, 10)}</span>
              {p.canOpen ? <Link href={p.sourceType === "work_request" ? `/roadsync/work-requests/${p.id}` : `/projects/${p.id}`}>{fmt(copy.dossier.openItem, { ref: p.ref })}</Link> : <span className="rs-help">{copy.dossier.cannotOpen}</span>}
            </div>
          ))}
        </div>
        {!pa.mine || !pb.mine ? <p className="rs-help">{copy.dossier.redacted}</p> : null}
      </section>
      {yours[0].plannedStart && yours[0].plannedEnd && yours[1].plannedStart && yours[1].plannedEnd ? (
        <section><h3>{copy.dossier.schedule}</h3>
          <ScheduleOverlapChart self={{ key: "a", label: yours[0].ref, start: yours[0].plannedStart, end: yours[0].plannedEnd, color: "#0B1F3A", overlap }} lanes={[{ key: "b", label: yours[1].ref, start: yours[1].plannedStart, end: yours[1].plannedEnd, color: "#C2760A", overlap }]} />
        </section>
      ) : null}
    </div>
  );
}

function Timeline({ d, copy, locale }: { d: Dossier; copy: ConflictCopy; locale: string }) {
  const ac = getAssessmentCopy(locale as never);
  const h = d.severityDetail.history;
  const W = 520;
  const H = 120;
  const [nowT] = useState(() => Date.now());
  const t0 = h.length ? new Date(h[0]!.at).getTime() : nowT;
  const span = Math.max(nowT - t0, 1);
  const x = (p: HistoryPoint) => ((new Date(p.at).getTime() - t0) / span) * W;
  const y = (s: number) => H - (s / 100) * H;
  const summary = h.map((p) => fmt(copy.timeline.point, { score: p.score, band: ac.bands[p.band], version: p.ruleVersion, reason: copy.timeline.reason[p.reason] })).join("; ");
  const when = (v: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(v));
  const actor = (e: Dossier["events"][number]) => e.actor.kind === "system" ? copy.events.actorSystem : e.actor.name ? e.actor.name : fmt(copy.events.actorAgency, { agency: e.actor.agencyName ?? "—" });
  const detail = (e: Dossier["events"][number]) => {
    const data = e.data as { from?: { score: number }; to?: { score: number }; agencies?: number };
    if (e.type === "severity_changed" && data.from && data.to) return fmt(copy.events.detailSeverity, { from: data.from.score, to: data.to.score });
    if (e.type === "detected" && data.agencies) return fmt(copy.events.detailAgencies, { n: data.agencies });
    return "";
  };
  return (
    <div className="cr-timeline">
      <h3>{copy.timeline.sparkline}</h3>
      <svg className="cr-spark" viewBox={`-6 -6 ${W + 12} ${H + 12}`} role="img" aria-label={fmt(copy.timeline.sparkAria, { text: summary })}>
        {BANDS_ASC.filter((b) => b !== "info").map((b) => <rect key={b} x="0" width={W} y={y(BAND_RANGE[b][1])} height={y(BAND_RANGE[b][0]) - y(BAND_RANGE[b][1])} fill={BAND_COLOR[b]} opacity="0.12" />)}
        <path d={stepPath(h, W, H, nowT)} fill="none" stroke="#0f172a" strokeWidth="2" />
        {h.map((p, i) => (p.reason === "override" || p.reason === "override_cleared" ? <rect key={i} x={x(p) - 5} y={y(p.score) - 5} width="10" height="10" transform={`rotate(45 ${x(p)} ${y(p.score)})`} fill={BAND_COLOR[p.band]} stroke="#fff"><title>{fmt(copy.timeline.point, { score: p.score, band: ac.bands[p.band], version: p.ruleVersion, reason: copy.timeline.reason[p.reason] })}</title></rect>
          : p.reason === "detected" ? <rect key={i} x={x(p) - 4} y={y(p.score) - 4} width="8" height="8" fill={BAND_COLOR[p.band]} stroke="#fff"><title>{fmt(copy.timeline.point, { score: p.score, band: ac.bands[p.band], version: p.ruleVersion, reason: copy.timeline.reason[p.reason] })}</title></rect>
          : <circle key={i} cx={x(p)} cy={y(p.score)} r="5" fill={BAND_COLOR[p.band]} stroke="#fff"><title>{fmt(copy.timeline.point, { score: p.score, band: ac.bands[p.band], version: p.ruleVersion, reason: copy.timeline.reason[p.reason] })}</title></circle>))}
      </svg>
      <table className="sr-only"><caption>{copy.timeline.sparkline}</caption><tbody>{h.map((p, i) => <tr key={i}><td>{when(p.at)}</td><td>{p.score}</td><td>{ac.bands[p.band]}</td><td>{copy.timeline.reason[p.reason]}</td></tr>)}</tbody></table>
      <h3>{copy.timeline.title}</h3>
      {d.events.length === 0 ? <p className="rs-help">{copy.timeline.noEvents}</p> : (
        <ol className="cr-events">{[...d.events].reverse().map((e) => (
          <li key={e.id} data-type={e.type}><span className="cr-ev-dot" aria-hidden="true" /><div><strong>{copy.events[e.type] ?? e.type}</strong> {detail(e)}<small title={when(e.at)}>{actor(e)} · {when(e.at)}</small></div></li>
        ))}</ol>
      )}
    </div>
  );
}

function Notes({ d, copy, national, onChanged, onError }: { d: Dossier; copy: ConflictCopy; national: boolean; onChanged: () => void; onError: (e: unknown) => void }) {
  const [text, setText] = useState("");
  const [agency, setAgency] = useState("");
  const myAgencyName = d.affected.find((a) => a.agencyId === d.myAgency?.agencyId)?.agencyName ?? d.parties.a.agencyName ?? "";
  const add = useMutation({ mutationFn: () => addRecordNote(d.id, text.trim()), onSuccess: () => { setText(""); onChanged(); }, onError });
  const del = useMutation({ mutationFn: (noteId: string) => deleteRecordNote(d.id, noteId), onSuccess: onChanged, onError });
  const agencies = [...new Map(d.notes.map((n) => [n.agencyId, n.agencyName])).entries()];
  const shown = d.notes.filter((n) => !agency || n.agencyId === agency);
  return (
    <div className="cr-notes">
      <p className="cr-private"><LockIcon aria-hidden="true" /> {fmt(copy.notes.private, { agency: national ? copy.notes.all : myAgencyName })}</p>
      {national && agencies.length > 0 ? <label>{copy.notes.filter} <select className="rs-input" value={agency} onChange={(e) => setAgency(e.target.value)}><option value="">{copy.notes.all}</option>{agencies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label> : null}
      {d.canAct.note ? <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(); }}><textarea className="rs-input" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.notes.placeholder} aria-label={copy.notes.placeholder} /><button type="submit" className="rs-btn is-primary" disabled={!text.trim() || add.isPending}>{copy.notes.add}</button></form> : null}
      {shown.length === 0 ? <p className="rs-help">{copy.notes.empty}</p> : <ul>{shown.map((n) => (
        <li key={n.id} className="cr-note"><p>{n.text}</p><small>{n.agencyName} · {n.authorName} · {new Date(n.createdAt).toLocaleString()}</small>{n.mine ? <button type="button" className="rs-btn" onClick={() => del.mutate(n.id)} aria-label={copy.notes.delete}><Trash2Icon aria-hidden="true" /></button> : null}</li>
      ))}</ul>}
    </div>
  );
}

function Related({ d, copy }: { d: Dossier; copy: ConflictCopy }) {
  const [locale] = useWorkspaceLocale();
  const ac = getAssessmentCopy(locale);
  if (!d.related.length) return <p className="rs-help">{copy.related.empty}</p>;
  return <ul className="cr-related">{d.related.map((r) => (
    <li key={r.id}><Link href={`/roadsync/conflicts/${r.id}`} className="cr-card"><span className="cr-row-top"><BandPill band={r.severity.band} copy={ac} /><code className="cr-no">{r.conflictNo}</code><StatusPill status={r.status} copy={copy} /></span><span>{r.parties.a.ref} ↔ {r.parties.b.ref}</span></Link></li>
  ))}</ul>;
}

function Evidence({ d, copy, onDownload }: { d: Dossier; copy: ConflictCopy; onDownload: () => void }) {
  const [locale] = useWorkspaceLocale();
  const ac = getAssessmentCopy(locale);
  const at = d.severityDetail.atDetection;
  const now = d.severityDetail.current;
  const nowAgencies = d.affected.filter((x) => x.active && !x.excluded).length;
  const delta = (n: number, o: number) => (n === o ? "" : fmt(copy.evidence.delta, { n: `${n > o ? "+" : ""}${n - o}` }));
  const rows: [string, string, string, string][] = [
    [copy.evidence.score, String(at.score), String(now.score), delta(now.score, at.score)],
    [copy.evidence.band, ac.bands[at.band], ac.bands[now.band], at.band === now.band ? "" : "▲▼"],
    [copy.evidence.classes, at.classes.map((c) => ac.classes[c]).join(", "), now.classes.map((c) => ac.classes[c]).join(", "), ""],
    [copy.evidence.ruleVersion, at.ruleVersion, d.assessment?.ruleVersion ?? at.ruleVersion, ""],
    [copy.evidence.dates, `${d.overlapWindow?.start?.slice(0, 10) ?? "—"} → ${d.overlapWindow?.end?.slice(0, 10) ?? "—"}`, `${d.overlapWindow?.start?.slice(0, 10) ?? "—"} → ${d.overlapWindow?.end?.slice(0, 10) ?? "—"}`, ""],
    [copy.evidence.agencies, String(at.agencyCount), String(nowAgencies), delta(nowAgencies, at.agencyCount)],
  ];
  return (
    <div className="cr-evidence">
      <h3>{copy.evidence.title}</h3>
      <table className="cr-diff"><thead><tr><th>{copy.evidence.metric}</th><th>{copy.evidence.atDetection}</th><th>{copy.evidence.now}</th><th /></tr></thead><tbody>{rows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3] ? <span className="rs-nb-chip">{r[3]}</span> : null}</td></tr>)}</tbody></table>
      <h4>{copy.evidence.factors}</h4>
      <ul>{at.factorsSnapshot.filter((f) => f.key !== "floor").map((f) => <li key={f.key}>{ac.component[f.key] ?? f.key}: {f.points}/{f.max} — {factorSentence(ac, f)}</li>)}</ul>
      <button type="button" className="rs-btn" onClick={onDownload}><DownloadIcon aria-hidden="true" /> {copy.evidence.download}</button>
    </div>
  );
}

function ActionDialog({ dialog, copy, agencyName, busy, onClose, onConfirm }: { dialog: DialogKind; copy: ConflictCopy; agencyName: string; busy: boolean; onClose: () => void; onConfirm: (v: { text: string; agencyId: string }) => void }) {
  const [text, setText] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [q, setQ] = useState("");
  const agencies = useQuery({ queryKey: ["roadsync", "agency-picker", q], queryFn: () => fetchAgencies({ q, status: "ACTIVE" }), enabled: dialog?.kind === "add", retry: false });
  if (!dialog) return null;
  const d = copy.dossier;
  const title = dialog.kind === "ack" ? d.ackTitle : dialog.kind === "dismiss" ? d.dismissTitle : dialog.kind === "reopen" ? d.reopenTitle : dialog.kind === "lead" ? d.leadTitle : dialog.kind === "exclude" ? d.excludeTitle : d.addAgencyTitle;
  const needsReason = dialog.kind === "dismiss" || dialog.kind === "reopen" || dialog.kind === "exclude" || dialog.kind === "add";
  const valid = (!needsReason || text.trim().length >= 10) && (dialog.kind !== "add" || Boolean(agencyId));
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) { setText(""); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cr-overlay" />
        <Dialog.Content className="cr-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{dialog.kind === "ack" ? fmt(d.ackBody, { agency: agencyName }) : dialog.kind === "dismiss" ? d.dismissBody : ""}</Dialog.Description>
          {dialog.kind === "add" ? <><label>{d.chooseAgency}<input className="rs-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={d.chooseAgency} /></label>
            <select className="rs-input" size={5} value={agencyId} onChange={(e) => setAgencyId(e.target.value)} aria-label={d.chooseAgency}>{(agencies.data?.agencies ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></> : null}
          {dialog.kind === "ack" || needsReason ? <label>{dialog.kind === "ack" ? d.ackNote : d.reasonLabel}<textarea className="rs-input" rows={3} maxLength={dialog.kind === "ack" ? 300 : 500} value={text} onChange={(e) => setText(e.target.value)} /></label> : null}
          <div className="cr-dialog-actions"><Dialog.Close asChild><button type="button" className="rs-btn">{d.cancel}</button></Dialog.Close><button type="button" className="rs-btn is-primary" disabled={!valid || busy} onClick={() => onConfirm({ text: text.trim(), agencyId })}>{d.confirm}</button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

