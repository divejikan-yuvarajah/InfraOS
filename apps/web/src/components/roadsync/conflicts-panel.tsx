"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2Icon, GaugeIcon, InfoIcon, RefreshCwIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import {
  CLASS_ORDER, OPPORTUNITY_COLOR, conflictOverlayFeatures, fmt, groupByBand,
  type AssessmentItem, type Band, type ClassCode, type Kind, type ProfileBin,
} from "@/lib/roadsync/assessment";
import { fetchAssessment, fetchAssessmentMap, fetchRules, runAssessmentNow } from "@/lib/roadsync/assessment-api";
import { factorSentence, getAssessmentCopy, type AssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { INFRA_COLOR, MUTED_COLOR, SOURCE_LABEL, type NearbyOverlay } from "@/lib/roadsync/nearby";
import type { RecordRow } from "@/lib/roadsync/conflict-records";
import { fetchRequestRecords } from "@/lib/roadsync/conflict-records-api";
import { WORK_TYPE_LABELS, workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { ConflictLens, type LensSelf } from "./conflict-lens";
import { RecordChip } from "./conflict-record-chip";
import { InfraIcon, infraLabel } from "./nearby-activity";
import { BandBar, CorridorStrip, KindPill, RiskGauge, ScoreRing, SeverityDNA } from "./risk-visuals";
import { TimeShiftExplorer } from "./time-shift-explorer";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

/** Shared by the Conflicts section and the hero chip so both read one cache entry. */
export function useAssessment(requestId: string, enabled: boolean) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const key = workRequestQueryKey(epoch, userId, roleKey, "assessment", requestId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchAssessment(requestId),
    enabled: enabled && Boolean(userId),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const status = q.state.data?.summary.status;
      return (status === "running" || status === "pending") && q.state.dataUpdateCount < 20 ? 3000 : false;
    },
  });
  return { query, key, epoch, userId, roleKey };
}

type Filters = { bands: Band[]; kind: Kind; classes: ClassCode[]; sort: "severity" | "distance" | "overlap" | "startDate" };
const DEFAULT_FILTERS: Filters = { bands: [], kind: "conflict", classes: [], sort: "severity" };

const SORTERS: Record<Filters["sort"], (a: AssessmentItem, b: AssessmentItem) => number> = {
  severity: (a, b) => b.assessment.effective.score - a.assessment.effective.score,
  distance: (a, b) => a.spatial.distanceMeters - b.spatial.distanceMeters,
  overlap: (a, b) => b.temporal.overlapDays - a.temporal.overlapDays,
  startDate: (a, b) => (a.other.plannedStart ?? "9").localeCompare(b.other.plannedStart ?? "9"),
};

const HOURS_KEY: Record<string, string> = { different_shifts: "differentShifts" };

function factorText(copy: AssessmentCopy, item: AssessmentItem, key: string): string | null {
  const f = item.assessment.factors.find((x) => x.key === key);
  return f && f.points > 0 ? factorSentence(copy, f) : null;
}

function ConflictCard({ item, copy, selected, onOpen, onHover, record }: { item: AssessmentItem; copy: AssessmentCopy; record?: RecordRow | null; selected: boolean; onOpen: (id: string, el: HTMLButtonElement) => void; onHover: (id: string | null) => void }) {
  const a = item.assessment;
  const color = INFRA_COLOR[item.other.infrastructureType] ?? MUTED_COLOR;
  const spatial = factorText(copy, item, "spatial");
  const temporal = factorText(copy, item, "temporal");
  const shared = factorText(copy, item, "sharedCorridor");
  const shift = item.temporal.shift?.a;
  const hint = a.kind === "opportunity"
    ? fmt(item.temporal.overlapDays > 0 ? copy.card.opportunity : copy.card.opportunityNear, { meters: a.estimatedSharedTrenchMeters ?? 0, agency: item.other.agencyName ?? copy.card.agencyUnknown, days: item.temporal.overlapDays })
    : shift && item.temporal.overlapDays > 0 && shift.daysToClearBefore !== null && shift.daysToClearAfter !== null
      ? fmt(shift.resolvable ? copy.card.resolvable : copy.card.notResolvable, { before: Math.max(0, shift.daysToClearBefore), after: Math.max(0, shift.daysToClearAfter), flex: shift.effectiveFlex })
      : null;
  const shown = a.classes.slice(0, 2);
  return (
    <li>
      <button type="button" className="rs-cc" data-band={a.kind === "conflict" ? a.effective.band : undefined} data-kind={a.kind} data-selected={selected || undefined} aria-pressed={selected} style={{ borderLeftColor: a.kind === "opportunity" ? OPPORTUNITY_COLOR : color }}
        aria-label={fmt(copy.card.open, { ref: item.other.ref })}
        onClick={(e) => onOpen(item.candidateId, e.currentTarget)} onMouseEnter={() => onHover(item.candidateId)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(item.candidateId)} onBlur={() => onHover(null)}>
        <span className="rs-nb-line1">
          <span className="rs-nb-icon" style={{ color }}><InfraIcon type={item.other.infrastructureType} /></span>
          <strong>{item.other.title}</strong><code>{item.other.ref}</code>
          <span className="rs-nb-badge">{SOURCE_LABEL[item.other.sourceType]}</span>
        </span>
        <span className="rs-nb-line2">
          <span className="rs-nb-chip">{item.other.agencyName ?? copy.card.agencyUnknown}</span>
          <span>{item.other.workType ? WORK_TYPE_LABELS[item.other.workType as keyof typeof WORK_TYPE_LABELS] ?? infraLabel(item.other.workType) : infraLabel(item.other.infrastructureType)}</span>
          <span className="rs-nb-chip">{infraLabel(item.other.status)}</span>
          {item.stale ? <span className="rs-nb-chip is-warn">{copy.card.stale}</span> : null}
          {a.overridden ? <span className="rs-nb-chip is-warn">{copy.card.overridden}</span> : null}
        </span>
        <span className="rs-cc-meta">
          <ScoreRing score={a.effective.score} band={a.effective.band} size={34} label={String(a.effective.score)} />
          <KindPill kind={a.kind} band={a.effective.band} copy={copy} />
          {shown.map((c) => <span key={c} className="rs-nb-chip">{copy.classes[c]}</span>)}
          {a.classes.length > shown.length ? <span className="rs-nb-chip">{fmt(copy.card.more, { n: a.classes.length - shown.length })}</span> : null}
          <SeverityDNA factors={a.factors} copy={copy} />
        </span>
        <span className="rs-nb-line3">
          {spatial ? <span>{spatial}</span> : null}
          {temporal ? <span>{temporal}</span> : null}
          {shared ? <span>{shared}</span> : null}
          {item.temporal.hoursCompatibility === "different_shifts" ? <span className="rs-nb-chip">{copy.card[HOURS_KEY.different_shifts as "differentShifts"]}</span> : null}
        </span>
        {hint ? <span className="rs-cc-hint">{hint}</span> : null}
      </button>
      {item.conflictRecord ? <RecordChip link={item.conflictRecord} row={record ?? null} /> : null}
    </li>
  );
}

function RulesPopover({ copy, onClose }: { copy: AssessmentCopy; onClose: () => void }) {
  const rules = useQuery({ queryKey: ["roadsync", "assessment-rules"], queryFn: fetchRules, staleTime: 3_600_000, retry: false });
  const d = rules.data;
  return (
    <div className="rs-pop" role="dialog" aria-label={copy.how.title}>
      <div className="rs-pop-head"><h4>{copy.how.title}</h4><button type="button" className="rs-btn" onClick={onClose} aria-label={copy.how.close}><XIcon aria-hidden="true" /></button></div>
      {rules.isPending ? <p className="rs-help">{copy.how.loading}</p> : !d ? <p className="rs-help">{copy.how.failed}</p> : (
        <>
          <p className="rs-help">{copy.how.intro}</p>
          <h5>{copy.how.components}</h5>
          <div className="rs-dna rs-dna-legend" role="img" aria-label={d.components.map((c) => `${copy.component[c.key]} ${c.max}`).join(", ")}>
            {d.components.map((c) => <i key={c.key} style={{ flexGrow: c.max }} title={`${copy.component[c.key]} ${c.max}`}>{c.max}</i>)}
          </div>
          <ul className="rs-pop-list">{d.components.map((c) => <li key={c.key}><strong>{copy.component[c.key] ?? c.key}</strong> {c.max}</li>)}</ul>
          <h5>{copy.how.bands}</h5>
          <ul className="rs-pop-list">{d.bands.map((b) => <li key={b.code}><strong>{copy.bands[b.code]}</strong> {b.min}–{b.max}</li>)}</ul>
          <h5>{copy.how.floors}</h5>
          <ul className="rs-pop-list">{d.floors.map((f) => <li key={f.code}>{copy.factor.floor?.[f.code] ?? f.code} ({f.min})</li>)}</ul>
          <p className="rs-help">{fmt(copy.how.windows, { min: d.windows.conflictMinScore, seq: d.windows.sequenceDays, joint: d.windows.jointWorksDays })}</p>
          <p className="rs-help">{fmt(copy.rule, { version: d.version })}</p>
        </>
      )}
    </div>
  );
}

export function ConflictsPanel({ requestId, self, canRun, national, onOverlay }: { requestId: string; self: LensSelf; canRun: boolean; national: boolean; onOverlay: (overlay: NearbyOverlay | null) => void }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAssessmentCopy(locale);
  const queryClient = useQueryClient();
  const { query, key } = useAssessment(requestId, true);
  const records = useQuery({ queryKey: [...key, "records"], queryFn: () => fetchRequestRecords(requestId), enabled: Boolean(query.data), retry: false });
  const recordById = useMemo(() => new Map((records.data?.items ?? []).map((r) => [r.id, r])), [records.data]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const lastAssessed = useRef<string | null>(null);

  const data = query.data;
  const summary = data?.summary ?? null;
  const items = data?.items;
  const assessedAt = summary?.assessedAt ?? null;
  const ready = summary?.status === "completed";

  const map = useQuery({
    queryKey: [...key, "map", assessedAt],
    queryFn: () => fetchAssessmentMap(requestId),
    enabled: ready,
    retry: false,
  });
  const run = useMutation({
    mutationFn: () => runAssessmentNow(requestId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  // "Updated just now" + live-region announcement when another agency's change refreshes this assessment.
  useEffect(() => {
    if (!assessedAt) return undefined;
    const changed = lastAssessed.current !== null && lastAssessed.current !== assessedAt;
    lastAssessed.current = assessedAt;
    if (!changed) return undefined;
    setToast(true);
    const t = window.setTimeout(() => setToast(false), 4000);
    return () => window.clearTimeout(t);
  }, [assessedAt]);
  const announce = useMemo(() => {
    if (!summary || summary.status !== "completed") return "";
    return summary.counts.conflicts > 0 ? fmt(copy.states.announce, { n: summary.counts.conflicts, band: copy.bands[summary.maxBand ?? "info"] }) : copy.states.announceNone;
  }, [summary, copy]);

  const visible = useMemo(() => {
    const list = (items ?? []).filter((i) =>
      i.assessment.kind === filters.kind &&
      (filters.kind !== "conflict" || filters.bands.length === 0 || filters.bands.includes(i.assessment.effective.band)) &&
      (filters.classes.length === 0 || filters.classes.some((c) => i.assessment.classes.includes(c))));
    return list.sort((a, b) => SORTERS[filters.sort](a, b) || b.assessment.effective.score - a.assessment.effective.score);
  }, [items, filters]);
  const selectedItem = useMemo(() => (items ?? []).find((i) => i.candidateId === selected) ?? null, [items, selected]);
  const conflictScores = useMemo(() => (items ?? []).filter((i) => i.assessment.kind === "conflict").map((i) => ({ id: i.candidateId, score: i.assessment.effective.score })), [items]);

  const bins: ProfileBin[] | null = summary?.corridorProfile ?? null;
  const scrubBin = scrub !== null && bins ? bins[scrub] ?? null : null;
  const mapFeatures = map.data?.features;
  const onSelect = useCallback((id: string) => setSelected(id), []);
  useEffect(() => {
    if (!mapFeatures || !ready) { onOverlay(null); return; }
    onOverlay({ mode: "conflicts", features: conflictOverlayFeatures(mapFeatures, self.geometry, scrubBin), selectedKey: selected, hoverKey: hover, onSelect });
    return () => onOverlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFeatures, ready, selected, hover, scrubBin, self.geometry, onSelect]);

  const toggleBand = (b: Band) => setFilters((f) => ({ ...f, kind: "conflict", bands: f.bands.includes(b) ? f.bands.filter((x) => x !== b) : [...f.bands, b] }));
  const toggleClass = (c: ClassCode) => setFilters((f) => ({ ...f, classes: f.classes.includes(c) ? f.classes.filter((x) => x !== c) : [...f.classes, c] }));
  const active = filters.bands.length + filters.classes.length;
  const failure = query.error ? (query.error instanceof ApiError && query.error.status === 429 ? copy.states.tooMany : copy.states.error) : null;
  const needsTrafficNote = (items ?? []).some((i) => i.assessment.incompleteInputs.includes("trafficImpact"));

  function openCard(id: string, el: HTMLButtonElement) {
    returnFocus.current = el;
    setSelected(id);
  }
  function closeLens() {
    setSelected(null);
    window.setTimeout(() => returnFocus.current?.focus(), 0);
  }
  function onListKey(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.rs-cc"));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  const groups = filters.kind === "conflict" ? groupByBand(visible) : null;
  const line = self.geometry?.type === "LineString";
  const hotspots = (items ?? []).filter((i) => i.assessment.kind === "conflict").slice(0, 5);
  const empty = ready && (summary?.counts.conflicts ?? 0) === 0 && (summary?.counts.opportunities ?? 0) === 0 && (summary?.counts.advisories ?? 0) === 0;

  return (
    <section className="rs-conf" aria-label={copy.heading}>
      <div className="rs-nb-head">
        <h3><GaugeIcon aria-hidden="true" />{copy.heading}</h3>
        <div className="rs-nb-head-actions">
          {assessedAt ? <span className="rs-nb-chip">{fmt(copy.states.assessedAt, { when: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(assessedAt)) })}</span> : null}
          {toast ? <span className="rs-nb-chip is-warn" role="status">{copy.states.updated}</span> : null}
          <button type="button" className="rs-btn" aria-expanded={rulesOpen} onClick={() => setRulesOpen((v) => !v)}><InfoIcon aria-hidden="true" />{copy.how.title}</button>
          {canRun ? <button type="button" className="rs-btn" disabled={run.isPending || summary?.status === "running"} onClick={() => run.mutate()}><RefreshCwIcon aria-hidden="true" />{ready ? copy.states.retry : copy.states.run}</button> : null}
        </div>
      </div>
      <div className="rs-nb-rule" aria-hidden="true"><i /><i /><i /></div>
      {rulesOpen ? <RulesPopover copy={copy} onClose={() => setRulesOpen(false)} /> : null}
      <p className="mc-sr" role="status" aria-live="polite">{announce}</p>

      {query.isPending ? (
        <div className="rs-nb-scan" role="status" aria-label={copy.states.loading}><span className="rs-nb-radar" aria-hidden="true" />{copy.states.loading}<div className="rs-skel-row" /><div className="rs-skel-row" /></div>
      ) : failure ? (
        <div className="rs-state" role="alert"><h4>{failure}</h4><button type="button" className="rs-btn" onClick={() => void query.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.states.retry}</button></div>
      ) : summary?.status === "running" ? (
        <div className="rs-nb-scan" role="status"><span className="rs-nb-radar" aria-hidden="true" />{copy.states.running}</div>
      ) : summary?.status === "failed" ? (
        <div className="rs-state" role="alert"><h4>{copy.states.failed}</h4>{canRun ? <button type="button" className="rs-btn" onClick={() => run.mutate()}><RefreshCwIcon aria-hidden="true" />{copy.states.retry}</button> : null}</div>
      ) : !ready || !summary ? (
        <p className="rs-help">{copy.states.pending}{canRun ? ` ${copy.states.run}.` : ""}</p>
      ) : (
        <>
          {summary.ruleStale || summary.anyStale ? <div className="mc-alert" role="note"><p>{copy.states.stale}</p></div> : null}
          {needsTrafficNote ? <p className="rs-help"><InfoIcon aria-hidden="true" style={{ width: "0.9rem", verticalAlign: "-0.15em" }} /> {copy.states.traffic}</p> : null}

          <div className="rs-strip-top">
            <RiskGauge value={summary.riskIndex} band={summary.maxBand} copy={copy} ruleVersion={summary.ruleVersion} />
            <div className="rs-strip-controls">
              <BandBar counts={summary.counts.byBand} active={filters.bands} onToggle={toggleBand} copy={copy} />
              <div className="rs-cseg" role="group" aria-label={copy.filters.kind}>
                {(["conflict", "opportunity", "advisory"] as const).map((k) => (
                  <button key={k} type="button" className="rs-btn" aria-pressed={filters.kind === k} onClick={() => setFilters((f) => ({ ...f, kind: k, bands: k === "conflict" ? f.bands : [] }))}>
                    {copy.kinds[k]} · {summary.counts[k === "conflict" ? "conflicts" : k === "opportunity" ? "opportunities" : "advisories"]}
                  </button>
                ))}
              </div>
              <button type="button" className="rs-btn rs-cfilters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}><SlidersHorizontalIcon aria-hidden="true" />{fmt(copy.filters.withCount, { n: active })}</button>
              <div className="rs-cfilters" data-open={filtersOpen || undefined}>
                <div className="rs-classchips" role="group" aria-label={copy.filters.classes}>
                  {CLASS_ORDER.filter((c) => (summary.counts.byClass[c] ?? 0) > 0).map((c) => (
                    <button key={c} type="button" className="rs-chip-btn" aria-pressed={filters.classes.includes(c)} onClick={() => toggleClass(c)}>{copy.classes[c]} <b>{summary.counts.byClass[c]}</b></button>
                  ))}
                </div>
                <label className="rs-nb-sort">{copy.filters.sort}
                  <select className="rs-input" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))}>
                    {(Object.keys(copy.filters.sorts) as Filters["sort"][]).map((s) => <option key={s} value={s}>{copy.filters.sorts[s]}</option>)}
                  </select>
                </label>
                {active > 0 ? <button type="button" className="rs-btn" onClick={() => setFilters((f) => ({ ...f, bands: [], classes: [] }))}>{copy.filters.clear}</button> : null}
              </div>
            </div>
          </div>

          <div className="rs-profile">
            <h4>{line ? copy.profile.title : copy.profile.pointOnly}</h4>
            {line && bins && bins.length > 0 ? (
              <CorridorStrip bins={bins} active={scrub} onActive={setScrub} copy={copy}
                onPick={(bin) => { const id = bin.topCandidateIds[0]; if (id) setSelected(id); }} />
            ) : !line ? (
              <>
                <p className="rs-help">{copy.profile.pointOnlyBody}</p>
                <ul className="rs-hotspots">
                  {hotspots.map((h) => <li key={h.candidateId}><button type="button" className="rs-chip-btn" onClick={() => setSelected(h.candidateId)}>{h.other.ref} · {copy.bands[h.assessment.effective.band]} · {h.assessment.effective.score}</button></li>)}
                </ul>
              </>
            ) : null}
          </div>

          {empty ? (
            <div className="rs-nb-empty">
              <CheckCircle2Icon aria-hidden="true" />
              <h4>{copy.states.emptyTitle}</h4>
              <p className="rs-help">{copy.states.emptyBody}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="rs-nb-empty">
              <h4>{copy.states.filteredEmpty}</h4>
              {active > 0 ? <button type="button" className="rs-btn" onClick={() => setFilters((f) => ({ ...f, bands: [], classes: [] }))}>{copy.filters.clear}</button> : null}
            </div>
          ) : groups ? (
            <div className="rs-groups" onKeyDown={onListKey}>
              {groups.map((g) => (
                <details key={g.band} open className="rs-group" data-band={g.band}>
                  <summary><span className="rs-group-head"><KindPill kind="conflict" band={g.band} copy={copy} /><span className="rs-help">{fmt(copy.groupItems, { n: g.items.length })}</span></span></summary>
                  <ul className="rs-nb-list">{g.items.map((i) => <ConflictCard key={i.candidateId} item={i} copy={copy} record={recordById.get(i.conflictRecord?.id ?? "")} selected={selected === i.candidateId} onOpen={openCard} onHover={setHover} />)}</ul>
                </details>
              ))}
            </div>
          ) : (
            <ul className="rs-nb-list" onKeyDown={onListKey}>{visible.map((i) => <ConflictCard key={i.candidateId} item={i} copy={copy} record={recordById.get(i.conflictRecord?.id ?? "")} selected={selected === i.candidateId} onOpen={openCard} onHover={setHover} />)}</ul>
          )}
          {data && data.total > (items?.length ?? 0) ? <p className="rs-help">{(items?.length ?? 0)} / {data.total}</p> : null}
          <table className="mc-sr">
            <caption>{copy.heading}</caption>
            <thead><tr><th>{copy.hiddenTable.item}</th><th>{copy.hiddenTable.agency}</th><th>{copy.hiddenTable.band}</th><th>{copy.hiddenTable.score}</th></tr></thead>
            <tbody>{(items ?? []).map((i) => <tr key={i.candidateId}><td>{i.other.ref}</td><td>{i.other.agencyName}</td><td>{copy.bands[i.assessment.effective.band]}</td><td>{i.assessment.effective.score}</td></tr>)}</tbody>
          </table>

          {self.plannedStart && self.plannedEnd && canRun ? <TimeShiftExplorer requestId={requestId} plannedStart={self.plannedStart} plannedEnd={self.plannedEnd} copy={copy} /> : null}
        </>
      )}
      {selectedItem ? (
        <ConflictLens item={selectedItem} recordHref={selectedItem.conflictRecord ? `/roadsync/conflicts/${selectedItem.conflictRecord.id}` : null} self={self} copy={copy} allConflictScores={conflictScores} national={national} onClose={closeLens}
          onLocate={(id) => setSelected(id)} onChanged={() => void queryClient.invalidateQueries({ queryKey: key })} />
      ) : null}
    </section>
  );
}
