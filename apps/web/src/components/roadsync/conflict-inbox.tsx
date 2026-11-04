"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDownIcon, ChevronRightIcon, CrownIcon, DownloadIcon, EyeIcon, FilterIcon, KeyboardIcon, RefreshCwIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BANDS_DESC, CLASS_ORDER, fmt, type Band } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { ackSlaDue, apiQuery, csvOf, FILTER_KEYS, presetOf, type Preset, type RecordRow } from "@/lib/roadsync/conflict-records";
import { acknowledgeBulk, acknowledgeRecord, downloadFile, exportCsvPath, fetchRecords, fetchRecordSummary, setWatching } from "@/lib/roadsync/conflict-records-api";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { getCoordCopy } from "@/lib/roadsync/coordination-copy";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { ConflictMap } from "./conflict-map";
import { AckSegments, SlaChip, StatusPill, TimeRing, useNow } from "./conflict-primitives";
import { BandPill, ScoreRing } from "./risk-visuals";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const PAGE = 50;
const RAIL: Preset[] = ["needsMyAck", "overdue", "criticalHigh", "soon", "opportunities", "watching", "mine"];
const NATIONAL_RAIL: Preset[] = ["unassigned", "dismissed", "autoClosed", "all"];
type ToggleKey = "status" | "band" | "class" | "recordType";

export function ConflictInbox() {
  return (
    <Suspense fallback={null}>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const [locale] = useWorkspaceLocale();
  const copy = getConflictCopy(locale);
  const ac = getAssessmentCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const national = roleKey === "SUPER_ADMIN";
  const now = useNow();

  const view = (params.get("view") as "inbox" | "board" | "map" | null) ?? "inbox";
  const preset = presetOf(params);
  const query = apiQuery(params, 1, PAGE);
  const listKey = workRequestQueryKey(epoch, userId, roleKey, "conflict-records", query);
  const list = useQuery({ queryKey: listKey, queryFn: () => fetchRecords(query), enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });
  const summary = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-summary"), queryFn: fetchRecordSummary, enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });

  const rows = useMemo(() => (preset === "unassigned" ? (list.data?.items ?? []).filter((r) => !r.lead) : list.data?.items ?? []), [list.data, preset]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const listRef = useRef<HTMLDivElement | null>(null);
  const focusRow = rows[Math.min(active, Math.max(rows.length - 1, 0))] ?? null;

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedSearch) setParams({ q: debouncedSearch || null });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the cursor and selection when the filters change (render-phase update, no effect needed).
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) { setSeenQuery(query); setActive(0); setSelected(new Set()); }
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    const n = summary.data?.needsMyAck;
    if (n === undefined) return;
    if (lastCount.current !== null && lastCount.current !== n) { setToast(copy.states.updated); setLive(fmt(copy.states.live, { n })); }
    lastCount.current = n;
  }, [summary.data?.needsMyAck, copy]);

  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["roadsync"] }); void list.refetch(); void summary.refetch(); }, [qc, list, summary]);

  const failure = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) { setToast(copy.states.stale); refresh(); } else if (error instanceof ApiError && error.status === 403) setToast(copy.states.forbidden);
    else setToast(copy.states.failed);
  };
  const ack = useMutation({ mutationFn: (r: RecordRow) => acknowledgeRecord(r.id, { version: r.version }), onSuccess: (_d, r) => { setLive(fmt(copy.states.ackLive, { no: r.conflictNo })); refresh(); }, onError: failure });
  const bulk = useMutation({
    mutationFn: (ids: string[]) => acknowledgeBulk(ids),
    onSuccess: ({ results }) => {
      const count = (k: string) => results.filter((r) => r.result === k).length;
      setToast(fmt(copy.bulk.summary, { ok: count("ok"), already: count("already"), failed: results.length - count("ok") - count("already") }));
      setSelected(new Set());
      refresh();
    },
    onError: failure,
  });
  const watch = useMutation({ mutationFn: (r: RecordRow) => setWatching(r.id, !r.watching), onSuccess: refresh, onError: failure });
  const canAck = (r: RecordRow) => Boolean(r.myAgency && r.myAgency.ackStatus === "pending" && ["open", "acknowledged"].includes(r.status));

  const open = (r: RecordRow) => router.push(`/roadsync/conflicts/${r.id}`);
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    const key = e.key.toLowerCase();
    if (key === "j" || key === "arrowdown") { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    else if (key === "k" || key === "arrowup") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (key === "enter" && focusRow) open(focusRow);
    else if (key === "a" && focusRow && canAck(focusRow)) ack.mutate(focusRow);
    else if (key === "w" && focusRow) watch.mutate(focusRow);
    else if (key === "x" && focusRow) setSelected((s) => { const n = new Set(s); if (n.has(focusRow.id)) n.delete(focusRow.id); else n.add(focusRow.id); return n; });
    else if (e.key === "?") setHelpOpen((v) => !v);
  };
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const s = summary.data;
  const tiles: { preset: Preset; value: number | undefined; alarm?: boolean }[] = [
    { preset: "needsMyAck", value: s?.needsMyAck },
    { preset: "overdue", value: s?.overdue, alarm: (s?.overdue ?? 0) > 0 },
    { preset: "criticalHigh", value: s?.criticalHigh },
    { preset: "soon", value: s?.startingIn14d },
    { preset: "opportunities", value: s?.opportunities },
  ];
  const toggle = (key: ToggleKey, value: string) => {
    const cur = csvOf(params, key);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setParams({ [key]: next.join(",") || null, preset: preset ? null : params.get("preset") });
  };
  const activeFilterCount = FILTER_KEYS.filter((k) => k !== "sort" && params.get(k)).length;
  const clearAll = () => { setSearch(""); router.replace(pathname, { scroll: false }); };
  const mapFeatures = useMemo(() => rows.map((r) => ({ type: "Feature" as const, geometry: r.hotspot, properties: { id: r.id, band: r.severity.band, recordType: r.recordType, conflictNo: r.conflictNo } })), [rows]);

  const rail = (
    <nav className="cr-rail" aria-label={copy.filters.presets}>
      <ul>
        {[...RAIL, ...(national ? NATIONAL_RAIL : [])].map((p) => (
          <li key={p}><button type="button" className="cr-preset" aria-current={preset === p ? "true" : undefined} onClick={() => setParams({ preset: p, status: null, band: null, class: null, recordType: null, startsWithinDays: null })}>{copy.presets[p]}</button></li>
        ))}
      </ul>
      <fieldset className="cr-fs"><legend>{copy.filters.search}</legend><input className="rs-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={copy.filters.search} maxLength={60} /></fieldset>
      <fieldset className="cr-fs"><legend>{copy.filters.status}</legend>{(["open", "acknowledged", "dismissed", "auto_closed"] as const).map((v) => <label key={v}><input type="checkbox" checked={csvOf(params, "status").includes(v)} onChange={() => toggle("status", v)} /> {copy.status[v]}</label>)}</fieldset>
      <fieldset className="cr-fs"><legend>{copy.filters.band}</legend>{BANDS_DESC.filter((b) => b !== "info").map((v) => <label key={v}><input type="checkbox" checked={csvOf(params, "band").includes(v)} onChange={() => toggle("band", v)} /> {ac.bands[v]}</label>)}</fieldset>
      <fieldset className="cr-fs"><legend>{copy.filters.classes}</legend>{CLASS_ORDER.map((v) => <label key={v}><input type="checkbox" checked={csvOf(params, "class").includes(v)} onChange={() => toggle("class", v)} /> {ac.classes[v]}</label>)}</fieldset>
      <fieldset className="cr-fs"><legend>{copy.filters.recordType}</legend>{(["conflict", "opportunity"] as const).map((v) => <label key={v}><input type="checkbox" checked={csvOf(params, "recordType").includes(v)} onChange={() => toggle("recordType", v)} /> {copy.recordType[v]}</label>)}
        <label><input type="checkbox" checked={params.get("internal") === "true"} onChange={(e) => setParams({ internal: e.target.checked ? "true" : null })} /> {copy.filters.internal}</label></fieldset>
      <button type="button" className="rs-btn" onClick={clearAll}>{copy.filters.clear}</button>
    </nav>
  );

  const body = !userId || list.isPending ? <div className="cr-skeleton" role="status"><span className="sr-only">{copy.states.loading}</span>{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
    : list.isError ? <div className="rs-state" role="alert"><p>{list.error instanceof ApiError && list.error.status === 403 ? copy.states.forbidden : copy.states.error}</p><button type="button" className="rs-btn" onClick={() => void list.refetch()}><RefreshCwIcon aria-hidden="true" /> {copy.states.retry}</button></div>
    : rows.length === 0 ? <div className="rs-state"><ShieldCheckIcon className="cr-empty-icon" aria-hidden="true" /><h3>{activeFilterCount ? copy.states.filteredEmpty : copy.states.emptyTitle}</h3><p>{copy.states.emptyBody}</p>{activeFilterCount ? <button type="button" className="rs-btn" onClick={clearAll}>{copy.filters.clear}</button> : null}</div>
    : null;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <div className="cr-bridge">
        <header className="cr-band">
          <p className="rs-help">{copy.demoNote}</p>
          <div className="cr-band-actions">
            <div className="cr-switch" role="group" aria-label={copy.title}>
              {(["inbox", "board", "map"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setParams({ view: v === "inbox" ? null : v })}>{copy.views[v]}</button>)}
            </div>
            <button type="button" className="rs-btn" onClick={() => void downloadFile(exportCsvPath(query), "roadsync-conflicts.csv").catch(() => setToast(copy.states.failed))}><DownloadIcon aria-hidden="true" /> {copy.exportCsv}</button>
            <button type="button" className="rs-btn" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}><KeyboardIcon aria-hidden="true" /><span className="sr-only">{copy.shortcuts.title}</span></button>
          </div>
        </header>

        <div className="cr-mission">
          {tiles.map((t) => (
            <button key={t.preset} type="button" className="cr-tile" data-alarm={t.alarm ? "true" : undefined} aria-pressed={preset === t.preset} onClick={() => setParams({ preset: t.preset, status: null, band: null, class: null, recordType: null, startsWithinDays: null })}>
              <strong>{t.value ?? "–"}</strong><span>{copy.mission[t.preset as keyof typeof copy.mission]}</span>
            </button>
          ))}
        </div>
        {helpOpen ? <div className="cr-help" role="dialog" aria-label={copy.shortcuts.title}><strong>{copy.shortcuts.title}</strong><ul>{Object.entries(copy.shortcuts).filter(([k]) => k !== "title").map(([k, v]) => <li key={k}>{v}</li>)}</ul></div> : null}
        {s?.capped ? <p className="rs-help">{copy.states.capped}</p> : null}

        <button type="button" className="rs-btn cr-filter-toggle" onClick={() => setFiltersOpen(true)}><FilterIcon aria-hidden="true" /> {fmt(copy.filters.withCount, { n: activeFilterCount })}</button>
        {filtersOpen ? <div className="cr-sheet" role="dialog" aria-modal="true" aria-label={copy.filters.title}><button type="button" className="rs-btn" onClick={() => setFiltersOpen(false)}><XIcon aria-hidden="true" /> {copy.filters.close}</button>{rail}</div> : null}

        <div className="cr-layout" data-view={view}>
          <aside className="cr-rail-wrap">{rail}</aside>
          <section className="cr-main" aria-busy={list.isFetching}>
            {body ?? (view === "map" ? (
              <div className="cr-mapview">
                <ConflictMap mode="pins" features={mapFeatures} label={copy.map.aria} selectedId={focusRow?.id} onSelect={(id) => setActive(Math.max(0, rows.findIndex((r) => r.id === id)))} />
                {focusRow ? <aside className="cr-sidecard"><Preview row={focusRow} copy={copy} ac={ac} locale={locale} now={now} canAck={canAck(focusRow)} onAck={() => ack.mutate(focusRow)} onWatch={() => watch.mutate(focusRow)} compact /></aside> : null}
              </div>
            ) : view === "board" ? (
              <Board rows={rows} copy={copy} ac={ac} locale={locale} now={now} onOpen={open} />
            ) : (
              <div className="cr-split">
                <div ref={listRef} className="cr-list" role="listbox" tabIndex={0} aria-label={copy.nav} aria-multiselectable="true" aria-activedescendant={focusRow ? `cr-row-${focusRow.id}` : undefined} onKeyDown={onKey}>
                  {rows.map((r, i) => (
                    <Row key={r.id} row={r} index={i} active={focusRow?.id === r.id} selected={selected.has(r.id)} copy={copy} ac={ac} locale={locale} now={now}
                      onFocus={() => setActive(i)} onOpen={() => open(r)} onSelect={(on) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(r.id); else n.delete(r.id); return n; })} />
                  ))}
                </div>
                <aside className="cr-preview" aria-label={copy.row.preview}>
                  {focusRow ? <Preview row={focusRow} copy={copy} ac={ac} locale={locale} now={now} canAck={canAck(focusRow)} onAck={() => ack.mutate(focusRow)} onWatch={() => watch.mutate(focusRow)} /> : <p className="rs-help">{copy.states.noPreview}</p>}
                </aside>
              </div>
            ))}
          </section>
        </div>

        {selected.size > 0 ? (
          <div className="cr-bulk" role="region" aria-label={copy.bulk.acknowledge}>
            <span>{selected.size}</span>
            <button type="button" className="rs-btn is-primary" disabled={bulk.isPending} onClick={() => bulk.mutate([...selected].slice(0, 25))}>{fmt(copy.bulk.acknowledge, { n: Math.min(selected.size, 25) })}</button>
            {selected.size > 25 ? <span className="rs-help">{copy.bulk.max}</span> : null}
            <button type="button" className="rs-btn" onClick={() => setSelected(new Set())}>{copy.bulk.clear}</button>
          </div>
        ) : null}
        {toast ? <div className="cr-toast" role="status" onAnimationEnd={() => undefined}>{toast} <button type="button" onClick={() => setToast(null)} aria-label={copy.filters.close}><XIcon aria-hidden="true" /></button></div> : null}
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </StaffWorkspaceShell>
  );
}

function PartyLine({ row, copy }: { row: RecordRow; copy: ReturnType<typeof getConflictCopy> }) {
  const { a, b } = row.parties;
  return (
    <span className="cr-parties">
      <span className="cr-party"><code>{a.ref}</code><span className="rs-nb-chip" data-mine={a.mine}>{a.agencyName ?? "—"}</span></span>
      <span aria-hidden="true">{copy.row.vs}</span>
      <span className="cr-party"><code>{b.ref}</code><span className="rs-nb-chip" data-mine={b.mine}>{b.agencyName ?? "—"}</span></span>
    </span>
  );
}

function Row({ row, index, active, selected, copy, ac, locale, now, onFocus, onOpen, onSelect }: { row: RecordRow; index: number; active: boolean; selected: boolean; copy: ReturnType<typeof getConflictCopy>; ac: ReturnType<typeof getAssessmentCopy>; locale: string; now: number; onFocus: () => void; onOpen: () => void; onSelect: (on: boolean) => void }) {
  const classes = row.severity.classes;
  return (
    <div id={`cr-row-${row.id}`} role="option" aria-selected={selected} data-active={active} data-band={row.severity.band} data-kind={row.recordType} className="cr-row" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }} onClick={onFocus}>
      <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={fmt(copy.row.select, { no: row.conflictNo })} />
      <div className="cr-row-main">
        <div className="cr-row-top">
          {row.recordType === "conflict" ? <BandPill band={row.severity.band} copy={ac} /> : <span className="rs-sev" data-kind="opportunity"><span>{copy.recordType.opportunity}</span></span>}
          <code className="cr-no">{row.conflictNo}</code>
          <StatusPill status={row.status} copy={copy} belowThreshold={row.belowThreshold} />
          {row.internal ? <span className="rs-nb-chip">{copy.internalChip}</span> : null}
          {row.coordination && row.coordination.activeCount > 0 ? <Link className="rs-nb-chip" href={`/roadsync/coordination?preset=all&conflictId=${row.id}`} onClick={(e) => e.stopPropagation()}>{getCoordCopy(locale as never).integrations.stateLabel[row.coordination.state] ?? ""}</Link> : null}
          {classes.slice(0, 2).map((c) => <span key={c} className="rs-nb-chip">{ac.classes[c]}</span>)}
          {classes.length > 2 ? <span className="rs-nb-chip">{fmt(copy.row.more, { n: classes.length - 2 })}</span> : null}
          {row.lead && row.myAgency?.agencyId === row.lead.agencyId ? <CrownIcon className="cr-crown" aria-label={copy.lead.crown} /> : null}
          {row.unseenChanges > 0 ? <span className="cr-unseen" title={fmt(copy.row.unseen, { n: row.unseenChanges })}>{row.unseenChanges}<span className="sr-only"> {fmt(copy.row.unseen, { n: row.unseenChanges })}</span></span> : null}
        </div>
        <PartyLine row={row} copy={copy} />
        <div className="cr-row-bottom"><AckSegments row={row} copy={copy} /><SlaChip due={ackSlaDue(row.status, row.myAgency)} now={now} copy={copy} locale={locale} /></div>
      </div>
      <TimeRing t={row.timeToImpact} copy={copy} size={38} />
      <button type="button" className="rs-btn cr-open" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={`${copy.row.open} ${row.conflictNo}`}><ChevronRightIcon aria-hidden="true" /></button>
    </div>
  );
}

function Preview({ row, copy, ac, locale, now, canAck, onAck, onWatch, compact }: { row: RecordRow; copy: ReturnType<typeof getConflictCopy>; ac: ReturnType<typeof getAssessmentCopy>; locale: string; now: number; canAck: boolean; onAck: () => void; onWatch: () => void; compact?: boolean }) {
  const lead = row.lead ? (row.lead.source === "national" ? fmt(copy.lead.national, { agency: row.lead.agencyName ?? "—" }) : fmt(copy.lead.suggested, { agency: row.lead.agencyName ?? "—", reason: copy.reasons[row.lead.reasonCode] ?? "" })) : copy.lead.none;
  return (
    <div className="cr-pv">
      <div className="cr-pv-head"><ScoreRing score={row.severity.score} band={row.severity.band} size={54} label={`${row.severity.score} ${ac.bands[row.severity.band]}`} /><div><code>{row.conflictNo}</code><StatusPill status={row.status} copy={copy} belowThreshold={row.belowThreshold} /></div></div>
      <div className="cr-pv-parties">
        {([row.parties.a, row.parties.b]).map((p) => (
          <div key={p.id} className="cr-pv-party" data-mine={p.mine}><code>{p.ref}</code><strong>{p.title}</strong><span>{p.agencyName ?? "—"}</span><span className="rs-help">{p.plannedStart?.slice(0, 10)} → {p.plannedEnd?.slice(0, 10)}</span></div>
        ))}
      </div>
      <p className="rs-help">{lead}</p>
      <AckSegments row={row} copy={copy} />
      <div className="cr-pv-row"><TimeRing t={row.timeToImpact} copy={copy} /><SlaChip due={ackSlaDue(row.status, row.myAgency)} now={now} copy={copy} locale={locale} /></div>
      {compact ? null : <p className="rs-help">{row.hotspot.coordinates[1].toFixed(4)}, {row.hotspot.coordinates[0].toFixed(4)}</p>}
      <div className="cr-pv-actions">
        {canAck ? <button type="button" className="rs-btn is-primary" onClick={onAck}>{copy.row.acknowledge}</button> : null}
        <Link className="rs-btn" href={`/roadsync/conflicts/${row.id}`}>{copy.row.open}</Link>
        <button type="button" className="rs-btn" aria-pressed={row.watching} onClick={onWatch}><EyeIcon aria-hidden="true" /> {row.watching ? copy.row.unwatch : copy.row.watch}</button>
      </div>
    </div>
  );
}

function Board({ rows, copy, ac, locale, now, onOpen }: { rows: RecordRow[]; copy: ReturnType<typeof getConflictCopy>; ac: ReturnType<typeof getAssessmentCopy>; locale: string; now: number; onOpen: (r: RecordRow) => void }) {
  const [closed, setClosed] = useState<Set<Band>>(new Set());
  const lanes: Band[] = ["critical", "high", "medium", "low"];
  return (
    <div className="cr-board">
      {lanes.map((band) => {
        const cards = rows.filter((r) => r.severity.band === band).sort((x, y) => (x.overlapWindow?.start ?? "9").localeCompare(y.overlapWindow?.start ?? "9"));
        const collapsed = closed.has(band);
        return (
          <section key={band} className="cr-lane" data-band={band}>
            <h3><button type="button" aria-expanded={!collapsed} onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(band)) n.delete(band); else n.add(band); return n; })}>{collapsed ? <ChevronRightIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}{fmt(copy.board.lane, { band: ac.bands[band], n: cards.length })}</button></h3>
            {collapsed ? null : cards.length === 0 ? <p className="rs-help">{copy.board.empty}</p> : cards.map((r) => (
              <button key={r.id} type="button" className="cr-card" onClick={() => onOpen(r)}>
                <span className="cr-row-top"><code className="cr-no">{r.conflictNo}</code><StatusPill status={r.status} copy={copy} /></span>
                <PartyLine row={r} copy={copy} />
                <span className="cr-row-bottom"><AckSegments row={r} copy={copy} /><TimeRing t={r.timeToImpact} copy={copy} size={32} /><SlaChip due={ackSlaDue(r.status, r.myAgency)} now={now} copy={copy} locale={locale} /></span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

