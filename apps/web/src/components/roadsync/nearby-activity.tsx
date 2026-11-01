"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2Icon, DropletsIcon, ExternalLinkIcon, LandmarkIcon, RadarIcon, RadioTowerIcon, RefreshCwIcon, RouteIcon, ShapesIcon, XIcon, ZapIcon, type LucideIcon } from "lucide-react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { ApiError } from "@/lib/api/client";
import { fetchDetection, previewNearby, runDetectionScan } from "@/lib/roadsync/nearby-api";
import {
  INFRA_COLOR, isOverlapping, meters, MUTED_COLOR, NEAR_TIME_COLOR, OVERLAP_COLOR, overlayFeatures, RADII, SOURCE_LABEL, spatialLabel, timeRelationLabel,
  type DetectionResult, type NearbyOverlay, type NearbySummary, type NearbyView, type PreviewResult, type SourceCheck, type TemporalFacts,
} from "@/lib/roadsync/nearby";
import { WORK_TYPE_LABELS, workRequestQueryKey, type GeometryInput } from "@/lib/roadsync/work-requests-view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import type { Band, Kind } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";

import { KindPill } from "./risk-visuals";

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => Math.floor((Date.parse(iso) + 5.5 * 3_600_000) / DAY_MS);
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short" }).format(new Date(iso));
const isoDayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));

const INFRA_ICON: Record<string, LucideIcon> = { ROAD: RouteIcon, WATER: DropletsIcon, DRAINAGE: DropletsIcon, ELECTRICITY: ZapIcon, TELECOM: RadioTowerIcon, BRIDGE: LandmarkIcon };
export const InfraIcon = ({ type }: { type: string }) => {
  const Icon = INFRA_ICON[type] ?? ShapesIcon;
  return <Icon aria-hidden="true" />;
};
export const infraLabel = (t: string) => t.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

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

/* ---------- schedule overlap chart (pure SVG, no chart library) ---------- */

export type ChartBar = { key: string; label: string; start: string; end: string; color: string; overlap?: { start: string; end: string } | null; gapDays?: number; flexDays?: number };

export function ScheduleOverlapChart({ self, lanes, compact = false }: { self: ChartBar; lanes: ChartBar[]; compact?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const bars = [self, ...lanes];
  const d0 = Math.min(...bars.map((b) => dayOf(b.start) - (b.flexDays ?? 0))) - (compact ? 2 : 7);
  const d1 = Math.max(...bars.map((b) => dayOf(b.end) + (b.flexDays ?? 0))) + (compact ? 2 : 7);
  const span = Math.max(1, d1 - d0 + 1);
  const W = 640;
  const labelW = compact ? 0 : 130;
  const laneH = compact ? 12 : 30;
  const top = compact ? 2 : 26;
  const H = top + bars.length * laneH + 6;
  const x = (day: number) => labelW + ((day - d0) / span) * (W - labelW - 8);
  const months: { day: number; label: string }[] = [];
  for (let t = new Date(Date.UTC(1970, 0, 1) + d0 * DAY_MS), m = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1); m / DAY_MS <= d1; m = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1)) {
    months.push({ day: m / DAY_MS, label: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(m)) });
  }
  const today = dayOf(new Date().toISOString());
  return (
    <div className={compact ? "rs-nb-chart is-compact" : "rs-nb-chart"}>
      <div className="rs-nb-chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: compact ? undefined : 520 }} role="img" aria-label={`Schedule comparison: ${bars.map((b) => `${b.label} ${dayLabel(b.start)} to ${dayLabel(b.end)}`).join("; ")}`}>
          <defs>
            <pattern id={`h${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={OVERLAP_COLOR} fillOpacity="0.18" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={OVERLAP_COLOR} strokeWidth="2.5" />
            </pattern>
          </defs>
          {!compact ? months.map((m) => (
            <g key={m.day}>
              <line x1={x(m.day)} x2={x(m.day)} y1={top - 4} y2={H - 4} stroke="#e2e8f0" />
              <text x={x(m.day) + 3} y={14} fontSize="10" fill="#64748b">{m.label}</text>
            </g>
          )) : null}
          {today >= d0 && today <= d1 ? (
            <g>
              <line x1={x(today)} x2={x(today)} y1={top - 4} y2={H - 4} stroke="#0f172a" strokeDasharray="3 3" />
              {!compact ? <text x={x(today) + 3} y={H - 8} fontSize="9" fill="#0f172a">Today</text> : null}
            </g>
          ) : null}
          {bars.map((b, i) => {
            const y = top + i * laneH + (compact ? 0 : 4);
            const h = laneH - (compact ? 3 : 10);
            const x0 = x(dayOf(b.start));
            const x1 = x(dayOf(b.end) + 1);
            const flex = b.flexDays ?? 0;
            return (
              <g key={b.key} tabIndex={compact ? undefined : 0} role={compact ? undefined : "img"} aria-label={`${b.label}: ${dayLabel(b.start)} to ${dayLabel(b.end)}`}>
                <title>{`${b.label}: ${dayLabel(b.start)} – ${dayLabel(b.end)}`}</title>
                {!compact ? <text x={4} y={y + h * 0.75} fontSize="11" fill="#0f172a">{b.label.length > 20 ? `${b.label.slice(0, 19)}…` : b.label}</text> : null}
                {flex > 0 ? <rect x={x(dayOf(b.start) - flex)} y={y} width={x(dayOf(b.end) + 1 + flex) - x(dayOf(b.start) - flex)} height={h} rx={h / 2} fill="none" stroke={b.color} strokeDasharray="4 3" opacity="0.55" /> : null}
                <rect x={x0} y={y} width={Math.max(3, x1 - x0)} height={h} rx={h / 2} fill={b.color} />
                {b.overlap ? <rect x={x(dayOf(b.overlap.start))} y={y} width={Math.max(3, x(dayOf(b.overlap.end) + 1) - x(dayOf(b.overlap.start)))} height={h} rx={h / 2} fill={`url(#h${uid})`} stroke={OVERLAP_COLOR} strokeWidth="1" /> : null}
                {b.gapDays ? <text x={x1 + 4} y={y + h * 0.75} fontSize="10" fill={NEAR_TIME_COLOR}>{b.gapDays} d gap</text> : null}
              </g>
            );
          })}
        </svg>
      </div>
      {!compact ? (
        <table className="mc-sr">
          <caption>Schedule comparison</caption>
          <thead><tr><th>Item</th><th>Start</th><th>End</th><th>Overlap with your work</th></tr></thead>
          <tbody>
            {bars.map((b) => <tr key={b.key}><td>{b.label}</td><td>{dayLabel(b.start)}</td><td>{dayLabel(b.end)}</td><td>{b.overlap ? `${isoDayLabel(b.overlap.start)} to ${isoDayLabel(b.overlap.end)}` : b.gapDays ? `None, ${b.gapDays} day gap` : "None"}</td></tr>)}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

type Self = { workType: string | null; plannedStart: string | null; plannedEnd: string | null; geometry: GeometryInput | null };

function chartPair(self: Self, v: NearbyView): { self: ChartBar; lane: ChartBar } | null {
  if (!self.plannedStart || !self.plannedEnd || !v.other.plannedStart || !v.other.plannedEnd) return null;
  const t = v.temporal;
  return {
    self: { key: "self", label: "Your request", start: self.plannedStart, end: self.plannedEnd, color: "#0f172a", overlap: t.overlapStart && t.overlapEnd ? { start: t.overlapStart, end: t.overlapEnd } : null, flexDays: t.shift?.a.effectiveFlex ?? 0 },
    lane: { key: v.key, label: v.other.ref, start: v.other.plannedStart, end: v.other.plannedEnd, color: INFRA_COLOR[v.other.infrastructureType] ?? MUTED_COLOR, overlap: t.overlapStart && t.overlapEnd ? { start: t.overlapStart, end: t.overlapEnd } : null, gapDays: t.relation === "adjacent" ? t.gapDays : undefined },
  };
}

function shiftText(t: TemporalFacts): string | null {
  const a = t.shift?.a;
  if (!a || t.overlapDays === 0 || a.daysToClearBefore === null || a.daysToClearAfter === null) return null;
  const move = `To clear this overlap, move your work at least ${Math.max(0, a.daysToClearBefore)} d earlier or ${Math.max(0, a.daysToClearAfter)} d later.`;
  return a.effectiveFlex === 0 ? `${move} No schedule flexibility is recorded for your request.` : `${move} You have ${a.effectiveFlex} d flexibility: ${a.resolvable ? "enough to clear it" : "not enough to clear it"}.`;
}

const HOURS: Record<string, string> = { same_shift: "Same shift", different_shifts: "Different shifts", overlaps_24h: "24 h work" };

/* ---------- candidate card ---------- */

function MiniBars({ self, v }: { self: Self; v: NearbyView }) {
  const pair = chartPair(self, v);
  return pair ? <ScheduleOverlapChart self={pair.self} lanes={[pair.lane]} compact /> : null;
}

type Severity = { kind: Kind; band: Band };

function Card({ v, self, selected, onOpen, severity }: { v: NearbyView; self: Self; selected: boolean; onOpen: (key: string, el: HTMLButtonElement) => void; severity?: Severity }) {
  const [locale] = useWorkspaceLocale();
  const t = v.temporal;
  const color = INFRA_COLOR[v.other.infrastructureType] ?? MUTED_COLOR;
  const shared = v.spatial.sharedLengthMeters > 0 ? `≈ ${meters(v.spatial.sharedLengthMeters)} shared corridor${v.spatial.sharedPctOfA !== null ? ` (${Math.round(v.spatial.sharedPctOfA * 100)} % of yours)` : ""}` : null;
  return (
    <li>
      <button type="button" className="rs-nb-card" data-selected={selected || undefined} style={{ borderLeftColor: color }} aria-pressed={selected}
        aria-label={`${v.other.ref}, ${v.other.title}. ${spatialLabel(v.spatial)}. ${timeRelationLabel(t)}${t.overlapDays ? `, ${t.overlapDays} days overlap` : ""}. Open comparison.`}
        onClick={(e) => onOpen(v.key, e.currentTarget)}>
        <span className="rs-nb-line1"><span className="rs-nb-icon" style={{ color }}><InfraIcon type={v.other.infrastructureType} /></span><strong>{v.other.title}</strong><code>{v.other.ref}</code><span className="rs-nb-badge">{SOURCE_LABEL[v.other.sourceType]}</span>{severity ? <KindPill kind={severity.kind} band={severity.band} copy={getAssessmentCopy(locale)} /> : null}</span>
        <span className="rs-nb-line2">
          <span className="rs-nb-chip">{v.other.agencyName ?? "Unknown agency"}</span>
          <span>{infraLabel(v.other.infrastructureType)}</span>
          <span className="rs-nb-chip">{infraLabel(v.other.status)}</span>
          {v.stale ? <span className="rs-nb-chip is-warn">Re-scan recommended</span> : null}
        </span>
        <span className="rs-nb-line3">
          <span className="rs-nb-pill" data-rel={v.spatial.relation}><i aria-hidden="true" />{spatialLabel(v.spatial)}</span>
          {shared ? <span>{shared}</span> : null}
        </span>
        <span className="rs-nb-line3">
          <span className="rs-nb-pill" data-rel={isOverlapping(t) ? "overlap" : t.relation === "adjacent" ? "near" : "none"}><i aria-hidden="true" />{timeRelationLabel(t)}</span>
          {t.overlapDays > 0 && t.overlapStart && t.overlapEnd ? <span>Overlap {t.overlapDays} {t.overlapDays === 1 ? "day" : "days"} · {isoDayLabel(t.overlapStart)} – {isoDayLabel(t.overlapEnd)}</span> : null}
          {t.hoursCompatibility && t.overlapDays > 0 ? <span className="rs-nb-chip">{HOURS[t.hoursCompatibility]}</span> : null}
        </span>
        <MiniBars self={self} v={v} />
      </button>
    </li>
  );
}

/* ---------- detail drawer ---------- */

function Drawer({ v, self, onClose }: { v: NearbyView; self: Self; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const t = v.temporal;
  const pair = chartPair(self, v);
  const advice = shiftText(t);
  const href = v.other.sourceType === "work_request" ? `/roadsync/work-requests/${v.other.id}` : v.other.sourceType === "project" ? `/projects/${v.other.id}` : null;
  const fmt = (s: string | null, e: string | null) => (s && e ? `${dayLabel(s)} – ${dayLabel(e)}` : "Not scheduled");
  return (
    <aside ref={ref} tabIndex={-1} className="rs-nb-drawer" role="dialog" aria-label={`Comparison with ${v.other.ref}`}>
      <div className="rs-nb-drawer-head">
        <div><h3>{v.other.title}</h3><p className="rs-help"><code>{v.other.ref}</code> · {SOURCE_LABEL[v.other.sourceType]} · {v.other.agencyName ?? "Unknown agency"}</p></div>
        <button type="button" className="rs-btn" onClick={onClose} aria-label="Close comparison"><XIcon aria-hidden="true" /></button>
      </div>
      <table className="rs-nb-compare">
        <thead><tr><th scope="col"><span className="mc-sr">Measure</span></th><th scope="col">Yours</th><th scope="col">Theirs</th></tr></thead>
        <tbody>
          <tr><th scope="row">Work type</th><td>{self.workType ? WORK_TYPE_LABELS[self.workType as keyof typeof WORK_TYPE_LABELS] ?? self.workType : "—"}</td><td>{v.other.workType ? WORK_TYPE_LABELS[v.other.workType as keyof typeof WORK_TYPE_LABELS] ?? v.other.workType : SOURCE_LABEL[v.other.sourceType]}</td></tr>
          <tr><th scope="row">Infrastructure</th><td>—</td><td>{infraLabel(v.other.infrastructureType)}</td></tr>
          <tr><th scope="row">Dates (Colombo)</th><td>{fmt(self.plannedStart, self.plannedEnd)}</td><td>{fmt(v.other.plannedStart, v.other.plannedEnd)}</td></tr>
          <tr><th scope="row">Working hours</th><td>Not recorded</td><td>{v.other.workingHours ?? "—"}</td></tr>
          <tr><th scope="row">Distance</th><td colSpan={2}>{spatialLabel(v.spatial)} (edge to edge)</td></tr>
          <tr><th scope="row">Shared corridor</th><td colSpan={2}>{v.spatial.sharedLengthMeters > 0 ? `≈ ${meters(v.spatial.sharedLengthMeters)}` : "None measured"}</td></tr>
          <tr><th scope="row">Time relation</th><td colSpan={2}>{timeRelationLabel(t)}{t.overlapDays ? ` · ${t.overlapDays} d` : ""}{t.hoursCompatibility ? ` · ${HOURS[t.hoursCompatibility]}` : ""}</td></tr>
        </tbody>
      </table>
      {pair ? <ScheduleOverlapChart self={pair.self} lanes={[pair.lane]} /> : <p className="rs-help">{t.relation === "permanent" ? "This is a permanent asset with no schedule." : "Enter planned dates to compare schedules."}</p>}
      {advice ? <p className="rs-nb-advice" role="note">{advice}</p> : null}
      {v.other.detailLevel === "redacted" ? <p className="rs-help">Only summary details of other agencies&apos; work are shown.</p> : null}
      {href && v.canOpen ? <Link href={href} className="rs-btn is-primary"><ExternalLinkIcon aria-hidden="true" />Open {SOURCE_LABEL[v.other.sourceType].toLowerCase()}</Link> : <p className="rs-help">You do not have access to open this item.</p>}
    </aside>
  );
}

/* ---------- panel ---------- */

type PanelProps = {
  mode: "preview" | "persisted";
  requestId?: string;
  self: Self;
  canRun?: boolean;
  compact?: boolean;
  /** Tells the parent which overlay to draw on its map. */
  onOverlay?: (overlay: NearbyOverlay | null) => void;
  /** Steps 70-71: severity per candidate id, so both sections show the same pill. */
  severity?: Map<string, Severity>;
};

export function NearbyActivityPanel({ mode, requestId, self, canRun = false, compact = false, onOverlay, severity }: PanelProps) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState(250);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<"overlapDays" | "distance">("overlapDays");
  const [selected, setSelected] = useState<string | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);

  const geoKey = useDebounced(self.geometry ? JSON.stringify(self.geometry) : "", 400);
  const schedKey = useDebounced(self.plannedStart && self.plannedEnd ? `${self.plannedStart}|${self.plannedEnd}` : "", 400);
  const query = useQuery<PreviewResult | DetectionResult>({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "nearby", mode, requestId ?? geoKey, schedKey, radius, showAll, sort),
    queryFn: () => {
      if (mode === "persisted") return fetchDetection(requestId ?? "", `radiusMeters=${radius}&onlyCandidates=${!showAll}&sort=${sort}&limit=50`);
      const [plannedStart, plannedEnd] = schedKey.split("|");
      return previewNearby({ geometry: JSON.parse(geoKey) as GeometryInput, radiusMeters: radius, ...(plannedStart && plannedEnd ? { schedule: { plannedStart, plannedEnd } } : {}) });
    },
    enabled: Boolean(userId) && (mode === "persisted" ? Boolean(requestId) : Boolean(geoKey)),
    retry: false,
    refetchInterval: (q) => (mode === "persisted" && (q.state.data as DetectionResult | undefined)?.detection.status === "running" && q.state.dataUpdateCount < 20 ? 3000 : false),
  });
  const scan = useMutation({
    mutationFn: () => runDetectionScan(requestId ?? ""),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["roadsync", "work-requests"] }),
  });

  const data = query.data;
  const detection = data && "detection" in data ? data.detection : null;
  const all = data?.candidates;
  const views = useMemo(() => {
    const list = [...(all ?? [])].filter((v) => mode === "persisted" || showAll || v.isCandidate);
    if (mode === "preview") list.sort((a, b) => (sort === "distance" ? 0 : b.temporal.overlapDays - a.temporal.overlapDays) || a.spatial.distanceMeters - b.spatial.distanceMeters);
    return list;
  }, [all, mode, showAll, sort]);
  const sources: SourceCheck[] = (data && "sourcesChecked" in data ? data.sourcesChecked : detection?.sourcesChecked) ?? [];
  const failedSources = sources.filter((s) => !s.ok).map((s) => SOURCE_LABEL[s.source]);
  const summary: NearbySummary | null = data?.summary ?? null;
  const selectedView = views.find((v) => v.key === selected) ?? null;

  const overlayKey = `${data ? views.map((v) => v.key).join(",") : ""}|${radius}|${selected}|${geoKey}`;
  const onOverlayRef = useRef(onOverlay);
  useEffect(() => { onOverlayRef.current = onOverlay; });
  useEffect(() => {
    onOverlayRef.current?.(data ? { features: overlayFeatures(views, self.geometry, radius), selectedKey: selected, onSelect: setSelected } : null);
    return () => onOverlayRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey]);

  function openCard(key: string, el: HTMLButtonElement) {
    returnFocus.current = el;
    setSelected(key);
  }
  function closeDrawer() {
    setSelected(null);
    window.setTimeout(() => returnFocus.current?.focus(), 0);
  }
  function onListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.rs-nb-card"));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  const failure = query.error ? (query.error instanceof ApiError && query.error.status === 429 ? "Too many checks. Wait a moment." : "Nearby activity could not be checked right now.") : null;
  const running = detection?.status === "running";
  const scanned = detection?.status === "completed" || detection?.status === "failed";
  const shown = compact ? views.slice(0, 3) : views;

  return (
    <section className={compact ? "rs-nb is-compact" : "rs-nb"} aria-label="Nearby activity and timing">
      <div className="rs-nb-head">
        <h3><RadarIcon aria-hidden="true" />Nearby activity &amp; timing</h3>
        {mode === "persisted" ? (
          <div className="rs-nb-head-actions">
            {detection?.completedAt ? <span className="rs-nb-chip">Scanned {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(detection.completedAt))}</span> : null}
            {canRun ? <button type="button" className="rs-btn" disabled={scan.isPending || running} onClick={() => scan.mutate()}><RefreshCwIcon aria-hidden="true" />{scanned ? "Re-scan" : "Scan now"}</button> : null}
          </div>
        ) : null}
      </div>
      <div className="rs-nb-rule" aria-hidden="true"><i /><i /><i /></div>

      <div className="rs-nb-controls">
        <div role="group" aria-label="Search radius" className="rs-nb-seg">
          {RADII.map((r) => <button key={r} type="button" className="rs-btn" aria-pressed={radius === r} onClick={() => setRadius(r)}>{r} m</button>)}
        </div>
        {!compact ? (
          <>
            <label className="rs-nb-check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Show nearby items with no schedule overlap</label>
            <label className="rs-nb-sort">Sort <select className="rs-input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="overlapDays">Most overlap</option><option value="distance">Closest</option></select></label>
          </>
        ) : null}
      </div>

      <p className="mc-sr" role="status" aria-live="polite">{query.isFetching ? "Scanning corridor" : data ? `${views.length} nearby ${views.length === 1 ? "item" : "items"} found` : ""}</p>

      {mode === "preview" && !self.geometry ? (
        <p className="rs-help">Place a valid location on the map to see nearby activity. Results never block saving.</p>
      ) : query.isPending && query.fetchStatus !== "idle" ? (
        <div className="rs-nb-scan" role="status" aria-label="Scanning corridor"><span className="rs-nb-radar" aria-hidden="true" />Scanning corridor…<div className="rs-skel-row" /><div className="rs-skel-row" /></div>
      ) : failure ? (
        <div className="rs-state" role="alert"><h4>{failure}</h4><button type="button" className="rs-btn" onClick={() => void query.refetch()}><RefreshCwIcon aria-hidden="true" />Retry</button></div>
      ) : running ? (
        <div className="rs-nb-scan" role="status"><span className="rs-nb-radar" aria-hidden="true" />Scanning… results appear automatically.</div>
      ) : mode === "persisted" && detection && (detection.status === "pending" || !detection.completedAt) && detection.status !== "failed" ? (
        <p className="rs-help">This request has not been scanned yet.{canRun ? " Use “Scan now”." : ""}</p>
      ) : data ? (
        <>
          {detection?.status === "failed" ? <div className="mc-alert" role="alert"><p>The last scan failed. Re-scan recommended.</p></div> : null}
          {failedSources.length ? <div className="mc-alert" role="alert"><p>Some sources could not be checked: {failedSources.join(", ")}.</p></div> : null}
          {summary ? (
            <dl className="rs-nb-stats">
              <div><dt>Nearby items</dt><dd>{summary.nearby}</dd></div>
              <div><dt>Overlapping in time</dt><dd>{summary.overlapping}</dd></div>
              <div><dt>Near in time (≤ 7 d)</dt><dd>{summary.nearInTime}</dd></div>
              <div><dt>Agencies involved</dt><dd>{summary.agencies}</dd></div>
              <div><dt>Closest</dt><dd>{summary.closestMeters === null ? "—" : meters(summary.closestMeters)}</dd></div>
            </dl>
          ) : null}
          {views.length === 0 ? (
            <div className="rs-nb-empty">
              <CheckCircle2Icon aria-hidden="true" />
              <h4>{showAll || (summary?.nearby ?? 0) === 0 ? `Clear corridor: no nearby activity found within ${radius} m` : `No schedule overlaps within ${radius} m`}</h4>
              <p className="rs-help">Results reflect submitted requests and registered projects only.{!showAll && (summary?.nearby ?? 0) > 0 ? " Turn on “Show nearby items with no schedule overlap” to see all nearby items." : ""}</p>
            </div>
          ) : (
            <ul className="rs-nb-list" aria-label="Nearby items" onKeyDown={onListKey}>
              {shown.map((v) => <Card key={v.key} v={v} self={self} selected={selected === v.key} onOpen={openCard} severity={v.candidateId ? severity?.get(v.candidateId) : undefined} />)}
            </ul>
          )}
          {compact && views.length > 3 ? <p className="rs-help">Showing 3 of {views.length}. Open the full view on the work request page after saving.</p> : null}
          {data && "truncated" in data && data.truncated ? <p className="rs-help">Showing the nearest {views.length} items only.</p> : null}
        </>
      ) : null}
      {selectedView ? <Drawer v={selectedView} self={self} onClose={closeDrawer} /> : null}
    </section>
  );
}
