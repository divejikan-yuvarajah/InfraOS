"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangleIcon, ArrowDownRightIcon, ArrowUpRightIcon, CheckCircle2Icon, DownloadIcon, InfoIcon, Loader2Icon, MinusIcon, PrinterIcon, RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { Popover } from "radix-ui";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BAND_COLOR, fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { customReady, dashQuery, drillHref, filtersOf, formatKpi, kmOf, UP_IS_GOOD, type AgenciesOut, type DashFilters, type Kpi, type Overview, type RangeKey, type Scorecard } from "@/lib/roadsync/dashboard";
import { dashboardCsvPath, downloadFile, fetchCalendar, fetchDashAgencies, fetchDashMap, fetchOverview } from "@/lib/roadsync/dashboard-api";
import { getDashCopy, signalText, type DashCopy } from "@/lib/roadsync/dashboard-copy";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";
import "@/styles/mission-control-roadsync-dashboard.css";

import { useNow } from "./conflict-primitives";
import { AgingBars, BubbleMap, CalendarStrip, CompareBars, Donut, ExposureChart, FlowChart, FunnelChart, HealthGauge, Sparkline } from "./dashboard-charts";
import { useRoadsyncKeys } from "./resolution-tab";

const WIDGET_KEY = "infraos.roadsync.dashboard.widgets";
const WIDGETS = ["attention", "signals", "kpis", "health", "funnel", "flow", "aging", "map", "calendar", "scorecards", "outcomes", "lists"] as const;
type WidgetId = (typeof WIDGETS)[number];
const RANGE_OPTS: RangeKey[] = ["7d", "30d", "90d", "12m", "custom"];
const STALE_MS = 5 * 60_000;

/** Widget visibility lives in localStorage behind a tiny external store; a storage failure falls back to memory. */
let memoryRaw: string | null = null;
let storageBroken = false;
const hiddenListeners = new Set<() => void>();
const readRaw = () => {
  if (storageBroken && memoryRaw !== null) return memoryRaw;
  try { const raw = window.localStorage.getItem(WIDGET_KEY); if (raw !== null) memoryRaw = raw; } catch { storageBroken = true; }
  return memoryRaw ?? "[]";
};
function writeHidden(v: WidgetId[]) {
  memoryRaw = JSON.stringify(v);
  try { window.localStorage.setItem(WIDGET_KEY, memoryRaw); } catch { storageBroken = true; /* storage unavailable: keep the choice in memory */ }
  hiddenListeners.forEach((l) => l());
}
function useHidden(): WidgetId[] {
  const raw = useSyncExternalStore((cb) => { hiddenListeners.add(cb); window.addEventListener("storage", cb); return () => { hiddenListeners.delete(cb); window.removeEventListener("storage", cb); }; }, readRaw, () => "[]");
  return useMemo(() => { try { const v = JSON.parse(raw) as unknown; return Array.isArray(v) ? v.filter((x): x is WidgetId => (WIDGETS as readonly string[]).includes(String(x))) : []; } catch { return []; } }, [raw]);
}

const reducedSubscribe = (cb: () => void) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
function useCountUp(target: number | null): number | null {
  const reduced = useSyncExternalStore(reducedSubscribe, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null || reduced) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 600); setV(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return target === null ? null : reduced ? target : v;
}

export function CommandCenter() {
  const [locale] = useWorkspaceLocale();
  const copy = getDashCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const keys = useRoadsyncKeys();
  const now = useNow();
  const f = useMemo(() => filtersOf(new URLSearchParams(params.toString())), [params]);
  const qs = dashQuery(f);
  const ready = Boolean(keys.userId) && customReady(f);
  const hidden = useHidden();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const common = { enabled: ready, retry: false, refetchOnWindowFocus: true, staleTime: 60_000 } as const;
  const ov = useQuery({ queryKey: keys.key("dash-overview", qs), queryFn: () => fetchOverview(qs), ...common, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const map = useQuery({ queryKey: keys.key("dash-map", qs), queryFn: () => fetchDashMap(qs), ...common, enabled: ready && !hidden.includes("map") });
  const cal = useQuery({ queryKey: keys.key("dash-calendar", qs), queryFn: () => fetchCalendar(qs), ...common, enabled: ready && !hidden.includes("calendar") });
  const ag = useQuery({ queryKey: keys.key("dash-agencies", qs), queryFn: () => fetchDashAgencies(qs), ...common, enabled: ready && !hidden.includes("scorecards") });
  const data = ov.data;
  const national = data?.scope.level === "national";
  const status = ov.error instanceof ApiError ? ov.error.status : 0;

  const live = data ? `${fmt(copy.updated.live, { n: (data.byBand.critical ?? 0) + (data.byBand.high ?? 0) })} ${new Date(data.generatedAt).toLocaleTimeString(locale)}` : "";

  const setFilters = (patch: Partial<DashFilters>) => {
    const next = { ...f, ...patch };
    const u = new URLSearchParams();
    if (next.range !== "30d") u.set("range", next.range);
    if (next.range === "custom") { if (next.from) u.set("from", next.from); if (next.to) u.set("to", next.to); }
    if (next.compare) u.set("compare", "true");
    if (next.agencyId) u.set("agencyId", next.agencyId);
    if (next.district) u.set("district", next.district);
    router.replace(`${pathname}${u.size ? `?${u}` : ""}`, { scroll: false });
  };
  const refresh = async () => {
    setBusy(true);
    try { if (national) qc.setQueryData(keys.key("dash-overview", qs), await fetchOverview(qs, true)); else await ov.refetch(); void map.refetch(); void cal.refetch(); void ag.refetch(); } catch { setFailed(true); } finally { setBusy(false); }
  };
  const toggle = (id: WidgetId) => { writeHidden(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]); };
  const show = (id: WidgetId) => !hidden.includes(id);
  const ageMin = data ? Math.max(0, Math.floor((now - new Date(data.generatedAt).getTime()) / 60_000)) : 0;
  const stale = Boolean(data?.cached && now - new Date(data.generatedAt).getTime() > STALE_MS);

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <div className="dc">
        <header className="dc-band">
          <div className="dc-band-top">
            <div><span className="dc-scope">{data ? copy.scope[data.scope.level] : "…"}</span><p className="rs-help">{copy.demoNote}</p></div>
            <div className="dc-band-actions">
              <span className="dc-updated" role="status">{data ? (ageMin < 1 ? copy.updated.now : fmt(copy.updated.min, { n: ageMin })) : ""}</span>
              <button type="button" className="rs-btn" onClick={() => void refresh()} disabled={busy || !ready}>{busy ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <RefreshCwIcon aria-hidden="true" />}{copy.updated.refresh}</button>
              <button type="button" className="rs-btn" disabled={!data} onClick={() => void downloadFile(dashboardCsvPath(qs), "roadsync-dashboard.csv").catch(() => setFailed(true))}><DownloadIcon aria-hidden="true" />{copy.actions.export}</button>
              <Link className="rs-btn" href={`/roadsync/dashboard/brief?${qs}`}><PrinterIcon aria-hidden="true" />{copy.actions.brief}</Link>
              <Customize copy={copy} hidden={hidden} toggle={toggle} reset={() => writeHidden([])} />
            </div>
          </div>
          <div className="dc-controls">
            <div className="dc-seg-ctl" role="group" aria-label={copy.range.label}>{RANGE_OPTS.map((r) => <button key={r} type="button" aria-pressed={f.range === r} onClick={() => setFilters({ range: r })}>{copy.range[r]}</button>)}</div>
            {f.range === "custom" ? <div className="dc-dates"><label>{copy.range.from}<input type="date" value={f.from} max={f.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} /></label><label>{copy.range.to}<input type="date" value={f.to} min={f.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} /></label></div> : null}
            <label className="dc-check"><input type="checkbox" checked={f.compare} onChange={(e) => setFilters({ compare: e.target.checked })} />{copy.range.compare}</label>
            {national ? <NationalFilters copy={copy} f={f} agencies={ag.data?.level === "national" ? ag.data.items : []} districts={data?.topLists.districts.map((d) => d.district) ?? []} set={setFilters} /> : null}
          </div>
          <nav className="dc-chips" aria-label={copy.title}>{WIDGETS.filter(show).map((w) => <a key={w} href={`#dc-${w}`}>{copy.widgets[w]}</a>)}</nav>
        </header>

        {stale ? <p className="dc-stale" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.updated.stale} <button type="button" className="rz-link" onClick={() => void refresh()}>{copy.updated.refresh}</button></p> : null}
        {failed ? <p className="dc-stale" role="status">{copy.states.error}</p> : null}
        <p className="sr-only" aria-live="polite">{live}</p>
        {!customReady(f) ? <p className="rz-empty" role="status">{copy.range.customHelp}</p> : ov.isError && status === 403 ? <p className="rz-empty" role="alert">{copy.states.forbidden}</p> : (
          <>
            {show("attention") ? <Widget id="attention" title={copy.widgets.attention} q={ov} copy={copy} bare>{(d) => <Attention d={d} copy={copy} />}</Widget> : null}
            {show("signals") ? <Widget id="signals" title={copy.widgets.signals} q={ov} copy={copy}>{(d) => <Signals d={d} copy={copy} national={d.scope.level === "national"} />}</Widget> : null}
            {show("kpis") ? <Widget id="kpis" title={copy.widgets.kpis} q={ov} copy={copy} bare>{(d) => <KpiRibbon d={d} copy={copy} locale={locale} compare={f.compare} />}</Widget> : null}
            <div className="dc-grid">
              {show("health") ? <Widget id="health" title={copy.widgets.health} q={ov} copy={copy} cls="dc-span-5">{(d) => <HealthWidget d={d} copy={copy} />}</Widget> : null}
              {show("funnel") ? <Widget id="funnel" title={copy.widgets.funnel} q={ov} copy={copy} cls="dc-span-7">{(d) => <><FunnelChart stages={d.funnel} copy={copy} onPick={(k) => router.push(funnelHref(k))} /><p className="rs-help">{copy.funnel.note}</p></>}</Widget> : null}
              {show("flow") ? <Widget id="flow" title={copy.widgets.flow} q={ov} copy={copy} cls="dc-span-12">{(d) => (d.newInRange === 0 && d.resolvedInRange === 0 && d.exposure.openConflicts === 0 ? <Empty copy={copy} /> : <div className="dc-two"><FlowChart points={d.trends} copy={copy} locale={locale} /><ExposureChart points={d.trends} copy={copy} locale={locale} /></div>)}</Widget> : null}
              {show("aging") ? <Widget id="aging" title={copy.widgets.aging} q={ov} copy={copy} cls="dc-span-6">{(d) => (d.exposure.openConflicts === 0 ? <p className="rs-help">{copy.aging.empty}</p> : <><AgingBars buckets={d.backlogAging.buckets} copy={copy} onPick={(_, band) => router.push(drillHref({ page: "conflicts", query: { status: "open,acknowledged,awaiting_response,negotiating,escalated", band } }))} />{d.backlogAging.oldest ? <p className="rs-help">{fmt(copy.aging.oldest, { no: d.backlogAging.oldest.conflictNo, d: d.backlogAging.oldest.ageDays })}</p> : null}</>)}</Widget> : null}
              {show("map") ? <Widget id="map" title={copy.widgets.map} q={map} copy={copy} cls="dc-span-6">{(m) => <><p className="dc-asof">{copy.map.asOf}</p><BubbleMap bins={m.bins} copy={copy} onOpen={(no) => router.push(drillHref({ page: "conflicts", query: { q: no } }))} /><Link className="rs-btn" href="/roadsync/conflicts?preset=all&status=open,acknowledged,awaiting_response,negotiating,escalated">{copy.map.openMap}</Link></>}</Widget> : null}
              {show("calendar") ? <Widget id="calendar" title={copy.widgets.calendar} q={cal} copy={copy} cls="dc-span-12">{(c) => <><p className="rs-help">{copy.calendar.subtitle}</p><CalendarStrip days={c.days} copy={copy} locale={locale} onPick={(day) => router.push(drillHref({ page: "conflicts", query: { status: "open,acknowledged,awaiting_response,negotiating,escalated", startsWithinDays: String(Math.max(1, c.days.indexOf(day) + 1)) } }))} /><p className="rs-help">{copy.calendar.legend}</p></>}</Widget> : null}
              {show("scorecards") ? <Widget id="scorecards" title={copy.widgets.scorecards} q={ag} copy={copy} cls="dc-span-12">{(a) => <Scorecards a={a} copy={copy} locale={locale} onAgency={(id) => setFilters({ agencyId: id })} />}</Widget> : null}
              {show("outcomes") ? <Widget id="outcomes" title={copy.widgets.outcomes} q={ov} copy={copy} cls="dc-span-12">{(d) => <Outcomes d={d} copy={copy} locale={locale} />}</Widget> : null}
              {show("lists") ? <Widget id="lists" title={copy.widgets.lists} q={ov} copy={copy} cls="dc-span-12">{(d) => <Lists d={d} copy={copy} locale={locale} national={d.scope.level === "national"} onDistrict={(x) => setFilters({ district: x })} />}</Widget> : null}
            </div>
          </>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

function funnelHref(stage: string): string {
  const open = "open,acknowledged,awaiting_response,negotiating,escalated";
  if (stage === "acknowledged") return drillHref({ page: "conflicts", query: { status: "acknowledged,awaiting_response,negotiating,escalated" } });
  if (stage === "coordination") return drillHref({ page: "coordination", query: { tab: "all" } });
  if (stage === "agreed") return drillHref({ page: "coordination", query: { status: "agreed" } });
  if (stage === "resolved") return drillHref({ page: "history", query: {} });
  return drillHref({ page: "conflicts", query: { status: open, recordType: "conflict" } });
}

/** One widget = one section: skeleton, per-widget error with Retry, never blanks the page. */
function Widget<T>({ id, title, q, copy, children, cls = "", bare }: { id: string; title: string; q: { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown }; copy: DashCopy; children: (d: T) => ReactNode; cls?: string; bare?: boolean }) {
  return (
    <section id={`dc-${id}`} className={`dc-w ${bare ? "is-bare" : ""} ${cls}`} aria-labelledby={`dc-${id}-h`}>
      <h2 id={`dc-${id}-h`} className={bare ? "sr-only" : "dc-h"}>{title}</h2>
      {q.isPending ? <div className="dc-skel" role="status" aria-label={copy.states.loading}><i /><i /><i /></div>
        : q.isError || !q.data ? <div className="rz-state" role="alert"><p>{copy.states.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.states.retry}</button></div>
        : children(q.data)}
    </section>
  );
}
const Empty = ({ copy }: { copy: DashCopy }) => <div className="rz-state"><InfoIcon aria-hidden="true" /><p>{copy.states.empty}</p><p className="rs-help">{copy.states.emptyHint}</p></div>;

function Customize({ copy, hidden, toggle, reset }: { copy: DashCopy; hidden: WidgetId[]; toggle: (w: WidgetId) => void; reset: () => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild><button type="button" className="rs-btn"><SlidersHorizontalIcon aria-hidden="true" />{copy.actions.customize}</button></Popover.Trigger>
      <Popover.Portal><Popover.Content className="dc-pop-menu" align="end" sideOffset={6}>
        <strong>{copy.customize.title}</strong>
        {WIDGETS.map((w) => <label key={w} className="dc-check"><input type="checkbox" checked={!hidden.includes(w)} onChange={() => toggle(w)} />{copy.widgets[w]}</label>)}
        <button type="button" className="rs-btn" onClick={reset}>{copy.customize.reset}</button>
        <Popover.Close className="rs-btn">{copy.actions.close}</Popover.Close>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  );
}

function NationalFilters({ copy, f, agencies, districts, set }: { copy: DashCopy; f: DashFilters; agencies: Scorecard[]; districts: string[]; set: (p: Partial<DashFilters>) => void }) {
  return (
    <>
      <label className="dc-sel">{copy.filters.agency}<select value={f.agencyId} onChange={(e) => set({ agencyId: e.target.value })}><option value="">{copy.filters.allAgencies}</option>{agencies.map((a) => <option key={a.agencyId} value={a.agencyId}>{a.agencyName ?? a.agencyId.slice(-6)}</option>)}</select></label>
      <label className="dc-sel">{copy.filters.district}<select value={f.district} onChange={(e) => set({ district: e.target.value })}><option value="">{copy.filters.allDistricts}</option>{[...new Set([...districts, ...(f.district ? [f.district] : [])])].map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
    </>
  );
}

function Attention({ d, copy }: { d: Overview; copy: DashCopy }) {
  const a = d.attention;
  const tiles = [
    { k: "needsMyAck", n: a.needsMyAck, href: "/roadsync/conflicts?preset=needsMyAck" },
    { k: "needsMyResponse", n: a.needsMyResponse, href: "/roadsync/coordination?preset=needs" },
    { k: "needsMyApproval", n: a.needsMyApproval, href: "/roadsync/approvals?tab=mine" },
    { k: "overdue", n: a.overdueTotal, href: "/roadsync/conflicts?preset=overdue", sub: fmt(copy.attention.overdueBreakdown, { a: a.overdue.acks, r: a.overdue.responses, p: a.overdue.approvals }) },
    { k: "startingSoon", n: a.startingSoon, href: "/roadsync/conflicts?preset=soon" },
  ];
  return (
    <ul className="dc-attn">{tiles.map((t) => <AttnTile key={t.k} label={copy.attention[t.k as "overdue"]} n={t.n} href={t.href} sub={t.sub} clear={copy.attention.allClear} />)}</ul>
  );
}
function AttnTile({ label, n, href, sub, clear }: { label: string; n: number; href: string; sub?: string | undefined; clear: string }) {
  const v = useCountUp(n);
  return (
    <li><Link href={href} className="dc-tile" data-zero={n === 0}>
      <span className="dc-tile-l">{label}</span>
      {n === 0 ? <span className="dc-tile-ok"><CheckCircle2Icon aria-hidden="true" />{clear}</span> : <strong className="dc-tile-n">{v}</strong>}
      {sub && n > 0 ? <span className="rs-help">{sub}</span> : null}
    </Link></li>
  );
}

function Signals({ d, copy, national }: { d: Overview; copy: DashCopy; national: boolean }) {
  const [all, setAll] = useState(false);
  if (!d.signals.length) return <p className="rs-help"><CheckCircle2Icon aria-hidden="true" className="rz-inline" /> {copy.noSignals}</p>;
  const list = all ? d.signals : d.signals.slice(0, 3);
  return (
    <>
      <ul className="dc-signals">{list.map((s) => <li key={`${s.code}${s.params.agencyId ?? ""}`} data-sev={s.severity}><span className="dc-sev"><AlertTriangleIcon aria-hidden="true" />{copy.severity[s.severity]}</span><span>{signalText(copy, s, national)}</span><Link className="rs-btn" href={drillHref(s.drilldown)}>{copy.actions.view}</Link></li>)}</ul>
      {d.signals.length > 3 ? <button type="button" className="rz-link" aria-expanded={all} onClick={() => setAll(!all)}>{all ? copy.actions.showLess : fmt(copy.actions.showAll, { n: d.signals.length })}</button> : null}
    </>
  );
}

function DeltaText({ k, copy, days }: { k: Kpi; copy: DashCopy; days: number }) {
  if (k.delta === undefined) return null;
  if (k.delta === null) return <span className="dc-delta" data-d="none"><MinusIcon aria-hidden="true" />{copy.delta.noBaseline}</span>;
  const up = k.delta.abs > 0, flat = k.delta.abs === 0;
  const good = flat ? null : (UP_IS_GOOD[k.key] ?? true) === up;
  const dir = flat ? copy.delta.flat : up ? copy.delta.up : copy.delta.down;
  const text = k.delta.pct === null ? fmt(copy.delta.abs, { abs: Math.abs(k.delta.abs), dir, vsText: fmt(copy.range.previous, { n: days }) }) : fmt(copy.delta.vs, { pct: Math.abs(k.delta.pct), dir, vsText: fmt(copy.range.previous, { n: days }) });
  return <span className="dc-delta" data-d={good === null ? "flat" : good ? "good" : "bad"}>{flat ? <MinusIcon aria-hidden="true" /> : up ? <ArrowUpRightIcon aria-hidden="true" /> : <ArrowDownRightIcon aria-hidden="true" />}{text}{good === null ? "" : ` · ${good ? copy.delta.good : copy.delta.bad}`}</span>;
}

function KpiRibbon({ d, copy, locale, compare }: { d: Overview; copy: DashCopy; locale: string; compare: boolean }) {
  return <ul className="dc-kpis">{d.kpis.map((k) => <KpiCard key={k.key} k={k} d={d} copy={copy} locale={locale} compare={compare} />)}</ul>;
}
function KpiCard({ k, d, copy, locale, compare }: { k: Kpi; d: Overview; copy: DashCopy; locale: string; compare: boolean }) {
  const counted = useCountUp(k.unit === "count" ? k.value : null);
  const shown = k.unit === "count" ? (counted === null ? "—" : formatKpi({ value: counted, unit: k.unit }, locale)) : formatKpi(k, locale);
  const name = copy.kpi[k.key] ?? k.key;
  return (
    <li className="dc-kpi">
      <div className="dc-kpi-top"><Link href={drillHref(k.drilldown)} className="dc-kpi-name">{name}</Link>
        <Popover.Root><Popover.Trigger asChild><button type="button" className="dc-info" aria-label={`${copy.actions.copyDef}: ${name}`}><InfoIcon aria-hidden="true" /></button></Popover.Trigger>
          <Popover.Portal><Popover.Content className="dc-pop-menu" sideOffset={6}>
            <strong>{name}</strong><p>{copy.def[k.key]}</p>
            {k.numerator !== null || k.denominator !== null ? <p className="rs-help">{copy.defParts.numerator}: {k.numerator ?? "—"} · {copy.defParts.denominator}: {k.denominator ?? "—"}</p> : null}
            <p className="rs-help">{copy.defParts.scope}: {d.scope.level === "national" ? copy.defParts.scopeNational : copy.defParts.scopeAgency}</p>
            <p className="rs-help">{fmt(copy.defParts.periodNote, { from: d.range.start.slice(0, 10), to: d.range.end.slice(0, 10) })}</p>
            {k.sampled ? <p className="rs-help">{copy.defParts.sampled}</p> : null}
            {k.value === null ? <p className="rs-help">{copy.defParts.noData}</p> : null}
            <Popover.Close className="rs-btn">{copy.actions.close}</Popover.Close>
          </Popover.Content></Popover.Portal></Popover.Root>
      </div>
      <Link href={drillHref(k.drilldown)} className="dc-kpi-val" aria-label={`${name}: ${shown}`}>{shown}</Link>
      <div className="dc-kpi-foot">{k.spark ? <Sparkline values={k.spark} label={name} /> : <span />}{compare ? <DeltaText k={k} copy={copy} days={d.range.days} /> : null}</div>
    </li>
  );
}

function HealthWidget({ d, copy }: { d: Overview; copy: DashCopy }) {
  const h = d.health;
  return (
    <div className="dc-health">
      <HealthGauge health={h} copy={copy} />
      {h.insufficientData && h.score === null ? <p className="rs-help">{fmt(copy.health.insufficient, { n: 5 })} ({fmt(copy.health.cases, { n: h.cases })})</p> : <p className="rs-help">{fmt(copy.health.cases, { n: h.cases })}</p>}
      <h3 className="dc-h3">{copy.health.waterfall}</h3>
      <ul className="dc-wf">{h.components.map((c) => (
        <li key={c.key} data-excluded={c.excluded}>
          <span>{copy.health.component[c.key]}</span>
          <span className="dc-wf-bar" aria-hidden="true"><i style={{ width: `${c.excluded ? 100 : c.value ?? 0}%` }} /></span>
          <span className="dc-wf-v">{c.excluded ? copy.health.excluded : `${c.value}% · ${fmt(copy.health.weight, { w: c.weight })} · ${fmt(copy.health.contribution, { c: c.contribution })}`}</span>
        </li>
      ))}</ul>
    </div>
  );
}

function Outcomes({ d, copy, locale }: { d: Overview; copy: DashCopy; locale: string }) {
  const rc = getResolutionCopy(locale as never);
  const items = Object.entries(d.outcomes.byOutcome).map(([key, n]) => ({ key, label: rc.outcome[key] ?? key, n }));
  const dig = d.digOnce;
  return (
    <div className="dc-two">
      <div>
        <Donut items={items} copy={copy} label={copy.outcomes.title} />
        <ul className="dc-facts">
          <li>{copy.outcomes.verification}: <b>{d.outcomes.verification.rate === null ? "—" : `${d.outcomes.verification.rate}%`}</b> <span className="rs-help">{fmt(copy.outcomes.verificationOf, { c: d.outcomes.verification.cleared, t: d.outcomes.verification.total })}</span></li>
          <li>{copy.outcomes.shift}: <b>{d.outcomes.meanShiftDays === null ? "—" : fmt(copy.outcomes.shiftDays, { d: d.outcomes.meanShiftDays })}</b> <span className="rs-help">{fmt(copy.outcomes.amendments, { n: d.outcomes.amendmentsApplied })}</span></li>
          <li>{copy.outcomes.national}: <b>{d.outcomes.nationalApprovalShare === null ? "—" : `${d.outcomes.nationalApprovalShare}%`}</b></li>
        </ul>
      </div>
      <div className="dc-dig">
        <h3 className="dc-h3">{copy.digOnce.title}</h3>
        <p className="dc-dig-n">≈ {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kmOf(dig.realizedMeters))} km <span>{copy.digOnce.realized}</span></p>
        <p className="rs-help">{dig.realized ? fmt(copy.digOnce.count, { n: dig.realized }) : copy.digOnce.none}</p>
        {dig.openCount ? <p>{fmt(copy.digOnce.open, { n: dig.openCount, km: kmOf(dig.openMeters) })}</p> : null}
        <Link className="rs-btn is-primary" href="/roadsync/conflicts?preset=opportunities">{copy.digOnce.cta}</Link>
        <p className="rs-help">{copy.digOnce.caption}</p>
      </div>
    </div>
  );
}

function Lists({ d, copy, locale, national, onDistrict }: { d: Overview; copy: DashCopy; locale: string; national: boolean; onDistrict: (x: string) => void }) {
  const ac = getAssessmentCopy(locale as never);
  return (
    <div className="dc-two">
      <div><h3 className="dc-h3">{copy.lists.districts}</h3>
        {d.topLists.districts.length === 0 ? <p className="rs-help">{copy.lists.none}</p> : <ol className="dc-rank">{d.topLists.districts.map((x) => <li key={x.district}>{national ? <button type="button" className="rz-link" onClick={() => onDistrict(x.district)}>{x.district}</button> : <span>{x.district}</span>}<span className="rs-help">{x.open} · {fmt(copy.lists.exposure, { e: x.exposure })}</span></li>)}</ol>}</div>
      <div><h3 className="dc-h3">{copy.lists.longest}</h3>
        {d.topLists.longestOpen.length === 0 ? <p className="rs-help">{copy.lists.none}</p> : <ol className="dc-rank">{d.topLists.longestOpen.map((x) => <li key={x.id}><Link href={`/roadsync/conflicts/${x.id}`}><code>{x.conflictNo}</code></Link><span className="dc-band-dot" style={{ background: BAND_COLOR[x.band] }} aria-hidden="true" /><span className="rs-help">{ac.bands[x.band]} · {fmt(copy.lists.days, { n: x.ageDays })} · {x.status}</span></li>)}</ol>}</div>
    </div>
  );
}

const CARD_COLS = ["cases", "open", "overdueAcks", "overdueResponses", "agreementRate", "medianAckHours", "medianResponseHours", "avgRounds", "resolved", "commitmentCompletion", "healthScore"] as const;
const pctKeys = ["agreementRate", "commitmentCompletion"];
const cell = (k: string, v: number | null) => (v === null ? "—" : pctKeys.includes(k) ? `${v}%` : String(v));

function Scorecards({ a, copy, locale, onAgency }: { a: AgenciesOut; copy: DashCopy; locale: string; onAgency: (id: string) => void }) {
  const [sort, setSort] = useState<(typeof CARD_COLS)[number]>("healthScore");
  const [pick, setPick] = useState<string[]>([]);
  const gradeOf = copy.health.grade;
  if (a.level === "agency") {
    const m = a.benchmark?.medians;
    return (
      <div>
        <h3 className="dc-h3">{copy.scorecards.mine}</h3>
        {a.own.cases === 0 ? <p className="rs-help">{copy.scorecards.insufficient}</p> : (
          <ul className="dc-own">{(["healthScore", "agreementRate", "medianAckHours", "medianResponseHours", "avgRounds", "commitmentCompletion"] as const).map((k) => {
            const v = a.own[k]; const med = m?.[k] ?? null;
            const max = Math.max(1, v ?? 0, med ?? 0) * 1.1;
            return <li key={k}><span>{copy.scorecards[k]}</span><div className="dc-range" aria-hidden="true">{med !== null ? <i className="dc-mk-med" style={{ left: `${(med / max) * 100}%` }} /> : null}{v !== null ? <i className="dc-mk-you" style={{ left: `${(v / max) * 100}%` }} /> : null}</div><span className="dc-own-v">{copy.scorecards.yours}: <b>{cell(k, v)}</b>{med !== null ? <> · {copy.scorecards.median}: <b>{cell(k, med)}</b></> : null}</span></li>;
          })}</ul>
        )}
        <p className="rs-help">{a.benchmark ? fmt(copy.scorecards.benchmarkCohort, { n: a.benchmark.cohort }) : copy.scorecards.benchmarkUnavailable}</p>
        <p className="rs-help">{copy.scorecards.note}</p>
      </div>
    );
  }
  const rows = [...a.items].sort((x, y) => ((y[sort] ?? -1) as number) - ((x[sort] ?? -1) as number) || (x.agencyName ?? "").localeCompare(y.agencyName ?? ""));
  const chosen = rows.filter((r) => pick.includes(r.agencyId));
  const mx = (k: (typeof CARD_COLS)[number]) => Math.max(1, ...rows.map((r) => (r[k] as number | null) ?? 0));
  return (
    <div>
      <label className="dc-sel">{copy.scorecards.sortBy}<select value={sort} onChange={(e) => setSort(e.target.value as (typeof CARD_COLS)[number])}>{CARD_COLS.map((k) => <option key={k} value={k}>{copy.scorecards[k]}</option>)}</select></label>
      <div className="dc-tscroll"><table className="dc-table-sc">
        <thead><tr><th scope="col">{copy.scorecards.compare}</th><th scope="col">{copy.scorecards.agency}</th>{CARD_COLS.map((k) => <th key={k} scope="col"><button type="button" className="rz-link" aria-pressed={sort === k} onClick={() => setSort(k)}>{copy.scorecards[k]}</button></th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.agencyId}>
            <td><input type="checkbox" aria-label={fmt(copy.scorecards.select, { name: r.agencyName ?? "" })} checked={pick.includes(r.agencyId)} disabled={!pick.includes(r.agencyId) && pick.length >= 3} onChange={(e) => setPick(e.target.checked ? [...pick, r.agencyId] : pick.filter((x) => x !== r.agencyId))} /></td>
            <th scope="row"><button type="button" className="rz-link" onClick={() => onAgency(r.agencyId)} title={copy.scorecards.open2}>{r.agencyName ?? "—"}</button></th>
            {CARD_COLS.map((k) => <td key={k}>{k === "healthScore" ? <span className="dc-grade-chip" data-grade={r.grade ?? "none"}>{r.healthScore ?? "—"}{r.grade ? ` · ${gradeOf[r.grade]}` : ""}</span> : cell(k, r[k] as number | null)}</td>)}
          </tr>
        ))}</tbody>
      </table></div>
      {chosen.length >= 2 ? <CompareBars rows={chosen.map((r) => ({ id: r.agencyId, name: r.agencyName ?? "—", values: Object.fromEntries(CARD_COLS.map((k) => [k, r[k] as number | null])) }))} metrics={(["healthScore", "agreementRate", "medianAckHours", "medianResponseHours", "resolved"] as const).map((k) => ({ key: k, label: copy.scorecards[k], max: pctKeys.includes(k) || k === "healthScore" ? 100 : mx(k), fmt: (v: number | null) => cell(k, v) }))} /> : null}
      <p className="rs-help">{a.benchmark ? fmt(copy.scorecards.benchmarkCohort, { n: a.benchmark.cohort }) : copy.scorecards.benchmarkUnavailable}</p>
      <span className="sr-only">{locale}</span>
    </div>
  );
}
