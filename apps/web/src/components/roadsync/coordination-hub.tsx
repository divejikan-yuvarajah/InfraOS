"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BellRingIcon, RefreshCwIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { hubQuery, PROPOSAL_TYPES, type HubRow } from "@/lib/roadsync/coordination";
import { fetchHub, fetchHubSummary, nudgeRequest } from "@/lib/roadsync/coordination-api";
import { getCoordCopy } from "@/lib/roadsync/coordination-copy";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { AgreementMeter, AvatarStack, DeadlineClock, StatusChip } from "./coordination-primitives";
import { useNow } from "./conflict-primitives";
import { BandPill } from "./risk-visuals";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

export function CoordinationHub() {
  return <Suspense fallback={null}><Hub /></Suspense>;
}

const TABS = ["needs", "sent", "all"] as const;

function Hub() {
  const [locale] = useWorkspaceLocale();
  const copy = getCoordCopy(locale);
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
  const preset = params.get("preset") ?? "needs";
  const query = hubQuery(params.get("preset") ? params : new URLSearchParams({ ...Object.fromEntries(params), preset: "needs" }), 1, 50);
  const list = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "coord-hub", query), queryFn: () => fetchHub(query), enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });
  const summary = useQuery({ queryKey: workRequestQueryKey(epoch, userId, roleKey, "coord-summary"), queryFn: fetchHubSummary, enabled: Boolean(userId), retry: false, refetchOnWindowFocus: true });
  const rows = list.data?.items ?? [];
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debounced = useDebounced(search, 300);
  const [filters, setFilters] = useState(false);
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) { setSeenQuery(query); setActive(0); }
  const focus = rows[Math.min(active, Math.max(rows.length - 1, 0))] ?? null;
  const listRef = useRef<HTMLDivElement | null>(null);

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);
  useEffect(() => { if ((params.get("q") ?? "") !== debounced) setParams({ q: debounced || null }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["roadsync"] }); void list.refetch(); void summary.refetch(); }, [qc, list, summary]);
  const lastNeeds = useRef<number | null>(null);
  useEffect(() => {
    const n = summary.data?.needsMyResponse;
    if (n === undefined) return;
    if (lastNeeds.current !== null && lastNeeds.current !== n) { setToast(copy.hub.updated); setLive(fmt(copy.hub.live, { n })); }
    lastNeeds.current = n;
  }, [summary.data?.needsMyResponse, copy]);
  const nudge = useMutation({
    mutationFn: (r: HubRow) => nudgeRequest(r.id, r.version),
    onSuccess: refresh,
    onError: (e) => { if (e instanceof ApiError && e.status === 409) { setToast(copy.hub.stale); refresh(); } else setToast(copy.hub.failed); },
  });
  const canNudge = (r: HubRow) => r.myParticipation?.stance === "proposer" && ["awaiting_response", "negotiating"].includes(r.status) && r.participants.some((p) => p.required && p.stance === "pending");

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const k = e.key.toLowerCase();
    if (k === "j" || k === "arrowdown") { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    else if (k === "k" || k === "arrowup") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (k === "enter" && focus) router.push(`/roadsync/coordination/${focus.id}`);
    else if (e.key === "?") setToast(copy.hub.shortcuts);
  };
  useEffect(() => { listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" }); }, [active]);

  const s = summary.data;
  const tiles: { key: keyof typeof copy.mission; preset: string; value: number | undefined; alarm?: boolean }[] = [
    { key: "needs", preset: "needs", value: s?.needsMyResponse }, { key: "overdue", preset: "overdue", value: s?.overdueForMe, alarm: (s?.overdueForMe ?? 0) > 0 },
    { key: "awaiting", preset: "awaiting", value: s?.awaitingOthers }, { key: "negotiating", preset: "negotiating", value: s?.negotiating },
    { key: "escalated", preset: "escalated", value: s?.escalated }, { key: "agreed", preset: "agreed", value: s?.agreed30d },
  ];
  const pick = (p: string) => setParams({ preset: p, status: null, type: null, overdue: null });
  const filterCount = ["status", "type", "q"].filter((k) => params.get(k)).length;
  const clear = () => { setSearch(""); router.replace(pathname, { scroll: false }); };
  const toggleCsv = (key: "status" | "type", v: string) => { const cur = (params.get(key) ?? "").split(",").filter(Boolean); const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; setParams({ [key]: next.join(",") || null }); };
  const csvHas = (key: string, v: string) => (params.get(key) ?? "").split(",").includes(v);

  const filterPanel = (
    <div className="co-filters">
      <fieldset><legend>{copy.filters.search}</legend><input className="rs-input" type="search" value={search} maxLength={40} onChange={(e) => setSearch(e.target.value)} aria-label={copy.filters.search} /></fieldset>
      <fieldset><legend>{copy.filters.status}</legend>{(["awaiting_response", "negotiating", "agreed", "no_agreement", "withdrawn"] as const).map((v) => <label key={v}><input type="checkbox" checked={csvHas("status", v)} onChange={() => toggleCsv("status", v)} /> {copy.status[v]}</label>)}</fieldset>
      <fieldset><legend>{copy.filters.type}</legend>{PROPOSAL_TYPES.map((v) => <label key={v}><input type="checkbox" checked={csvHas("type", v)} onChange={() => toggleCsv("type", v)} /> {copy.types[v]}</label>)}</fieldset>
      <button type="button" className="rs-btn" onClick={clear}>{copy.filters.clear}</button>
    </div>
  );

  const body = !userId || list.isPending ? <div className="co-skeleton" role="status"><span className="sr-only">{copy.hub.loading}</span>{Array.from({ length: 5 }, (_, i) => <span key={i} />)}</div>
    : list.isError ? <div className="rs-state" role="alert"><p>{list.error instanceof ApiError && list.error.status === 403 ? copy.hub.forbidden : copy.hub.error}</p><button type="button" className="rs-btn" onClick={() => void list.refetch()}><RefreshCwIcon aria-hidden="true" /> {copy.hub.retry}</button></div>
    : rows.length === 0 ? <div className="rs-state"><ShieldCheckIcon className="co-empty" aria-hidden="true" /><h3>{filterCount ? copy.hub.filteredEmpty : copy.hub.emptyTitle}</h3><p>{copy.hub.emptyBody}</p>{filterCount ? <button type="button" className="rs-btn" onClick={clear}>{copy.filters.clear}</button> : null}</div>
    : null;

  return (
    <StaffWorkspaceShell title={copy.hubTitle} description={copy.subtitle} wide>
      <div className="co-hub">
        <header className="co-band"><p className="rs-help">{copy.demoNote}</p></header>
        <div className="co-mission">
          {tiles.map((t) => (
            <button key={t.key} type="button" className="co-tile" data-alarm={t.alarm || undefined} aria-pressed={preset === t.preset} onClick={() => pick(t.preset)}><strong>{t.value ?? "–"}</strong><span>{copy.mission[t.key]}</span></button>
          ))}
        </div>
        <div className="co-tabs" role="tablist" aria-label={copy.hubTitle}>
          {[...TABS, ...(national ? (["allAgencies", "escalated"] as const) : [])].map((t) => {
            const p = t === "allAgencies" ? "all" : t;
            return <button key={t} role="tab" type="button" aria-selected={preset === p && (t !== "all" || !national)} onClick={() => pick(p)}>{copy.tabs[t as keyof typeof copy.tabs]}</button>;
          })}
          <button type="button" className="rs-btn co-filter-toggle" onClick={() => setFilters(true)}>{fmt(copy.filters.withCount, { n: filterCount })}</button>
        </div>
        {filters ? <div className="co-sheet" role="dialog" aria-modal="true" aria-label={copy.filters.title}><button type="button" className="rs-btn" onClick={() => setFilters(false)}><XIcon aria-hidden="true" /> {copy.filters.close}</button>{filterPanel}</div> : null}
        <div className="co-layout">
          <aside className="co-rail">{filterPanel}</aside>
          <section aria-busy={list.isFetching}>
            {body ?? (
              <div className="co-split">
                <div ref={listRef} className="co-list" role="listbox" tabIndex={0} aria-label={copy.nav} aria-activedescendant={focus ? `co-row-${focus.id}` : undefined} onKeyDown={onKey}>
                  {rows.map((r, i) => (
                    <div key={r.id} id={`co-row-${r.id}`} role="option" aria-selected={focus?.id === r.id} data-active={focus?.id === r.id} className="co-row" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} onClick={() => setActive(i)}>
                      <div className="co-row-main">
                        <div className="co-row-top">
                          <code>{r.requestNo}</code>
                          <Link href={`/roadsync/conflicts/${r.conflictId}`} className="rs-nb-chip"><code>{r.conflictNo}</code></Link>
                          {r.severity ? <BandPill band={r.severity.band} copy={ac} /> : null}
                          <StatusChip status={r.status} escalated={r.escalated} copy={copy} />
                          <span className="rs-nb-chip">{copy.types[r.type]}</span>
                          <span className="rs-nb-chip">{fmt(copy.round, { n: r.round, max: r.maxRounds })}</span>
                          {r.unreadMessages > 0 ? <span className="co-unread" title={fmt(copy.hub.unread, { n: r.unreadMessages })}>{r.unreadMessages}<span className="sr-only"> {fmt(copy.hub.unread, { n: r.unreadMessages })}</span></span> : null}
                        </div>
                        <div className="co-row-bottom"><AgreementMeter participants={r.participants} copy={copy} /><AvatarStack participants={r.participants} copy={copy} /><DeadlineClock at={r.deadline.at} closed={r.deadline.state === "closed"} now={now} copy={copy} locale={locale} /></div>
                      </div>
                      <div className="co-row-actions">
                        {canNudge(r) ? <button type="button" className="rs-btn" onClick={(e) => { e.stopPropagation(); nudge.mutate(r); }}><BellRingIcon aria-hidden="true" /> {copy.hub.nudge}</button> : null}
                        <Link href={`/roadsync/coordination/${r.id}`} className="rs-btn">{copy.hub.open}</Link>
                      </div>
                    </div>
                  ))}
                </div>
                <aside className="co-preview" aria-label={copy.hub.latest}>
                  {focus ? (
                    <div className="co-pv">
                      <code>{focus.requestNo}</code>
                      <StatusChip status={focus.status} escalated={focus.escalated} copy={copy} />
                      <p>{copy.types[focus.type]} · {fmt(copy.round, { n: focus.round, max: focus.maxRounds })}</p>
                      <p className="rs-help">{focus.initiator.agencyName}</p>
                      <AgreementMeter participants={focus.participants} copy={copy} large />
                      <DeadlineClock at={focus.deadline.at} closed={focus.deadline.state === "closed"} now={now} copy={copy} locale={locale} />
                      {focus.myParticipation ? <p className="rs-help">{copy.roles[focus.myParticipation.role]} · {copy.stance[focus.myParticipation.stance]}</p> : null}
                      <Link href={`/roadsync/coordination/${focus.id}`} className="rs-btn is-primary">{copy.hub.open}</Link>
                    </div>
                  ) : <p className="rs-help">{copy.hub.select}</p>}
                </aside>
              </div>
            )}
          </section>
        </div>
        {toast ? <div className="co-toast" role="status">{toast} <button type="button" onClick={() => setToast(null)} aria-label={copy.filters.close}><XIcon aria-hidden="true" /></button></div> : null}
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </StaffWorkspaceShell>
  );
}
