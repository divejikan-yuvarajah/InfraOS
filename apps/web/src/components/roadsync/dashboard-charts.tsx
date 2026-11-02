"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertOctagonIcon, AlertTriangleIcon, CheckCircle2Icon, ClockIcon, ShieldAlertIcon, ThumbsUpIcon } from "lucide-react";

import { BAND_COLOR, fmt, type Band } from "@/lib/roadsync/assessment";
import { BAND_ORDER, type CalDay, type FunnelStage, type Health, type MapBin, type TrendPoint } from "@/lib/roadsync/dashboard";
import type { DashCopy } from "@/lib/roadsync/dashboard-copy";

/** Hand-built SVG/CSS charts. No chart library. Series are told apart by shape or pattern as well as colour. */

const NAVY = "#0b1f3a";
const TEAL = "#0e7490";
const fmtDay = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function Sparkline({ values, label, w = 96, h = 28 }: { values: (number | null)[]; label: string; w?: number; h?: number }) {
  const pts = values.map((v, i) => (v === null ? null : { i, v }));
  const real = pts.filter((p): p is { i: number; v: number } => p !== null);
  if (real.length < 2) return <span className="dc-spark-empty" aria-hidden="true">—</span>;
  const lo = Math.min(...real.map((p) => p.v)), hi = Math.max(...real.map((p) => p.v));
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => (hi === lo ? h / 2 : h - 3 - ((v - lo) / (hi - lo)) * (h - 6));
  const d = real.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = real[real.length - 1]!;
  return (
    <svg className="dc-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${label}: ${real[0]!.v} → ${last.v}`}>
      <path d={d} fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dc-draw" />
      <rect x={x(last.i) - 3} y={y(last.v) - 3} width="6" height="6" fill={TEAL} transform={`rotate(45 ${x(last.i)} ${y(last.v)})`} />
    </svg>
  );
}

// ---------- gauge ----------
const GRADE_ICON = { excellent: ThumbsUpIcon, good: CheckCircle2Icon, needs_attention: AlertTriangleIcon, at_risk: AlertOctagonIcon } as const;
const GRADE_COLOR = { excellent: "#16603a", good: "#3E9B7A", needs_attention: "#c2760a", at_risk: "#8d153a" } as const;
const polar = (cx: number, cy: number, r: number, deg: number) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const; };
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => { const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };

/** 220-degree arc, four grade segments, a value sweep and a needle. Text and icon repeat the grade. */
export function HealthGauge({ health, copy }: { health: Health; copy: DashCopy }) {
  const start = -110, span = 220, cx = 110, cy = 110, r = 84;
  const at = (v: number) => start + (span * v) / 100;
  const segs = [{ from: 0, to: 50, g: "at_risk" }, { from: 50, to: 70, g: "needs_attention" }, { from: 70, to: 85, g: "good" }, { from: 85, to: 100, g: "excellent" }] as const;
  const score = health.score;
  const Icon = health.grade ? GRADE_ICON[health.grade] : ShieldAlertIcon;
  const [nx, ny] = polar(cx, cy, r - 14, score === null ? start : at(score));
  return (
    <figure className="dc-gauge">
      <svg viewBox="0 0 220 170" role="img" aria-label={score === null ? fmt(copy.health.insufficient, { n: 5 }) : fmt(copy.health.scoreOf, { s: score, g: health.grade ? copy.health.grade[health.grade] : "" })}>
        <defs><pattern id="dc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="#fff" opacity="0.5" /></pattern></defs>
        {segs.map((s) => <path key={s.g} d={arc(cx, cy, r, at(s.from) + 1, at(s.to) - 1)} fill="none" stroke={GRADE_COLOR[s.g]} strokeWidth="14" opacity={score !== null && score >= s.from && score <= s.to ? 1 : 0.35} />)}
        <path d={arc(cx, cy, r + 12, start, start + span)} fill="none" stroke="#cbd5e1" strokeWidth="1" />
        {score !== null ? <path d={arc(cx, cy, r - 12, start, at(score))} fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" className="dc-draw" /> : null}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={NAVY} strokeWidth="3" strokeLinecap="round" /><circle cx={cx} cy={cy} r="6" fill={NAVY} />
        <text x={cx} y={cy + 40} textAnchor="middle" className="dc-gauge-num">{score ?? "—"}</text>
      </svg>
      <figcaption className="dc-gauge-cap">
        <span className="dc-grade" data-grade={health.grade ?? "none"}><Icon aria-hidden="true" />{health.grade ? copy.health.grade[health.grade] : copy.states.insufficient}</span>
        <span className="rs-help">{copy.health.caption}</span>
      </figcaption>
    </figure>
  );
}

// ---------- funnel ----------
export function FunnelChart({ stages, copy, onPick }: { stages: FunnelStage[]; copy: DashCopy; onPick: (key: string) => void }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="dc-funnel" aria-label={copy.funnel.title}>
      {stages.map((s, i) => (
        <li key={s.key} data-bottleneck={s.bottleneck}>
          {i > 0 ? <span className="dc-fconn" title={s.stepDays === null ? copy.funnel.noData : fmt(copy.funnel.step, { d: s.stepDays })}><ClockIcon aria-hidden="true" />{s.stepDays === null ? "—" : fmt(copy.funnel.step, { d: s.stepDays })}</span> : null}
          <button type="button" className="dc-fstage" onClick={() => onPick(s.key)} aria-label={`${copy.funnel.stage[s.key]}: ${s.count}`}>
            <span className="dc-fbar" style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }} />
            <span className="dc-fname">{copy.funnel.stage[s.key] ?? s.key}</span>
            <strong className="dc-fcount">{s.count}</strong>
            <span className="rs-help">{s.ofPrevious === null || i === 0 ? "" : fmt(copy.funnel.ofPrevious, { p: s.ofPrevious })}{s.medianDays === null || i === 0 ? "" : ` · ${fmt(copy.funnel.median, { d: s.medianDays })}`}</span>
            {s.bottleneck ? <span className="dc-tag"><AlertTriangleIcon aria-hidden="true" />{copy.funnel.bottleneck}</span> : null}
          </button>
        </li>
      ))}
    </ol>
  );
}

// ---------- time-series with a shared crosshair ----------
function useCrosshair(n: number) {
  const [i, setI] = useState<number | null>(null);
  const keys = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); setI((c) => Math.min(n - 1, (c ?? -1) + 1)); } else if (e.key === "ArrowLeft") { e.preventDefault(); setI((c) => Math.max(0, (c ?? n) - 1)); } else if (e.key === "Escape") setI(null); };
  return { i, setI, keys };
}
const W = 640, H = 210, ML = 34, MB = 26, MT = 10, MR = 10;

export function FlowChart({ points, copy, locale }: { points: TrendPoint[]; copy: DashCopy; locale: string }) {
  const { i, setI, keys } = useCrosshair(points.length);
  const id = useId();
  const nets = points.map((p) => p.created - p.resolved);
  const hi = Math.max(1, ...points.flatMap((p) => [p.created, p.resolved]));
  const lo = Math.min(0, ...nets);
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo || 1)) * (H - MT - MB);
  const gw = (W - ML - MR) / Math.max(1, points.length);
  const bw = Math.max(3, Math.min(14, gw * 0.34));
  const gx = (k: number) => ML + gw * k + gw / 2;
  const net = nets.map((v, k) => `${k === 0 ? "M" : "L"}${gx(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <ChartShell title={copy.flow.title} summary={fmt(copy.flow.summary, { n: points.reduce((a, p) => a + p.created, 0), r: points.reduce((a, p) => a + p.resolved, 0), d: points.length })} copy={copy}
      legend={[{ shape: "sq", label: copy.flow.created, color: NAVY }, { shape: "hatch", label: copy.flow.resolved, color: TEAL }, { shape: "line", label: copy.flow.net, color: "#c2760a" }]}
      table={{ head: [copy.flow.date, copy.flow.created, copy.flow.resolved, copy.flow.net], rows: points.map((p) => [fmtDay(p.date, locale), p.created, p.resolved, p.created - p.resolved]) }}
      tip={i === null ? null : { title: fmtDay(points[i]!.date, locale), rows: [[copy.flow.created, points[i]!.created], [copy.flow.resolved, points[i]!.resolved], [copy.flow.net, nets[i]!]] }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={copy.flow.title} onMouseLeave={() => setI(null)}>
        <defs><pattern id={`${id}h`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff" /><rect width="2.5" height="5" fill={TEAL} /></pattern></defs>
        <line x1={ML} x2={W - MR} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth="1" />
        <text x={ML - 6} y={MT + 8} textAnchor="end" className="dc-axis">{hi}</text><text x={ML - 6} y={y(0) + 4} textAnchor="end" className="dc-axis">0</text>
        {points.map((p, k) => (
          <g key={p.date} tabIndex={0} role="img" aria-label={`${fmtDay(p.date, locale)}: ${copy.flow.created} ${p.created}, ${copy.flow.resolved} ${p.resolved}`} className="dc-pt" data-on={i === k} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} onKeyDown={keys}>
            <rect x={gx(k) - gw / 2} y={MT} width={gw} height={H - MT - MB} fill="transparent" />
            <rect x={gx(k) - bw - 1} y={y(p.created)} width={bw} height={Math.max(0, y(0) - y(p.created))} fill={NAVY} />
            <rect x={gx(k) + 1} y={y(p.resolved)} width={bw} height={Math.max(0, y(0) - y(p.resolved))} fill={`url(#${id}h)`} stroke={TEAL} strokeWidth="1" />
            {points.length <= 31 && k % Math.ceil(points.length / 8) === 0 ? <text x={gx(k)} y={H - 8} textAnchor="middle" className="dc-axis">{fmtDay(p.date, locale)}</text> : null}
          </g>
        ))}
        <path d={net} fill="none" stroke="#c2760a" strokeWidth="2" strokeDasharray="5 3" />
        {points.map((p, k) => <path key={`n${p.date}`} d={`M${gx(k) - 3.5},${y(nets[k]!)} l3.5,-3.5 l3.5,3.5 l-3.5,3.5 z`} fill="#c2760a" />)}
        {i !== null ? <line x1={gx(i)} x2={gx(i)} y1={MT} y2={H - MB} stroke={NAVY} strokeWidth="1" strokeDasharray="3 3" /> : null}
      </svg>
    </ChartShell>
  );
}

export function ExposureChart({ points, copy, locale }: { points: TrendPoint[]; copy: DashCopy; locale: string }) {
  const { i, setI, keys } = useCrosshair(points.length);
  const hi = Math.max(1, ...points.map((p) => p.exposure));
  const y = (v: number) => MT + (1 - v / hi) * (H - MT - MB);
  const gx = (k: number) => ML + ((W - ML - MR) * k) / Math.max(1, points.length - 1);
  const line = points.map((p, k) => `${k === 0 ? "M" : "L"}${gx(k).toFixed(1)},${y(p.exposure).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <ChartShell title={copy.flow.exposureTitle} summary={last ? fmt(copy.flow.exposureSummary, { e: last.exposure, o: last.open }) : ""} copy={copy} help={copy.flow.exposureHelp}
      legend={[{ shape: "area", label: copy.flow.exposure, color: TEAL }, { shape: "dot", label: copy.flow.open, color: NAVY }]}
      table={{ head: [copy.flow.date, copy.flow.exposure, copy.flow.open], rows: points.map((p) => [fmtDay(p.date, locale), p.exposure, p.open]) }}
      tip={i === null ? null : { title: fmtDay(points[i]!.date, locale), rows: [[copy.flow.exposure, points[i]!.exposure], [copy.flow.open, points[i]!.open]] }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={copy.flow.exposureTitle} onMouseLeave={() => setI(null)}>
        <text x={ML - 6} y={MT + 8} textAnchor="end" className="dc-axis">{hi}</text><text x={ML - 6} y={H - MB + 4} textAnchor="end" className="dc-axis">0</text>
        <line x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} stroke="#94a3b8" />
        {points.length > 1 ? <path d={`${line} L${gx(points.length - 1)},${H - MB} L${gx(0)},${H - MB} Z`} fill={TEAL} opacity="0.16" /> : null}
        <path d={line} fill="none" stroke={TEAL} strokeWidth="2.5" className="dc-draw" />
        {points.map((p, k) => (
          <g key={p.date} tabIndex={0} role="img" aria-label={`${fmtDay(p.date, locale)}: ${copy.flow.exposure} ${p.exposure}, ${copy.flow.open} ${p.open}`} className="dc-pt" data-on={i === k} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} onKeyDown={keys}>
            <rect x={gx(k) - 8} y={MT} width="16" height={H - MT - MB} fill="transparent" />
            <circle cx={gx(k)} cy={y(p.exposure)} r={i === k ? 5 : 2.5} fill={NAVY} />
          </g>
        ))}
        {i !== null ? <line x1={gx(i)} x2={gx(i)} y1={MT} y2={H - MB} stroke={NAVY} strokeDasharray="3 3" /> : null}
      </svg>
    </ChartShell>
  );
}

type Legend = { shape: "sq" | "hatch" | "line" | "area" | "dot"; label: string; color: string };
function ChartShell({ title, summary, copy, children, legend, table, tip, help }: { title: string; summary: string; copy: DashCopy; children: ReactNode; legend: Legend[]; table: { head: string[]; rows: (string | number)[][] }; tip: { title: string; rows: (string | number)[][] } | null; help?: string }) {
  return (
    <figure className="dc-chart">
      <figcaption><strong>{title}</strong><span className="sr-only">{summary}</span></figcaption>
      <div className="dc-chart-body">{children}{tip ? <div className="dc-tip" role="status"><strong>{tip.title}</strong>{tip.rows.map((r) => <span key={String(r[0])}>{r[0]}: <b>{r[1]}</b></span>)}</div> : null}</div>
      <ul className="dc-legend">{legend.map((l) => <li key={l.label}><i className="dc-key" data-shape={l.shape} style={{ ["--k" as string]: l.color }} aria-hidden="true" />{l.label}</li>)}</ul>
      {help ? <p className="rs-help">{help}</p> : null}
      <details className="dc-table"><summary>{copy.flow.hiddenTable}</summary>
        <table><thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody></table></details>
    </figure>
  );
}

// ---------- aging ----------
export function AgingBars({ buckets, copy, onPick }: { buckets: { fromDays: number; toDays: number | null; count: number; byBand: Record<string, number> }[]; copy: DashCopy; onPick: (b: { fromDays: number; toDays: number | null }, band: Band) => void }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const label = (b: { fromDays: number; toDays: number | null }) => (b.toDays === null ? fmt(copy.aging.bucketOpen, { from: b.fromDays }) : fmt(copy.aging.bucket, { from: b.fromDays, to: b.toDays }));
  return (
    <ul className="dc-aging" aria-label={copy.aging.title}>
      {buckets.map((b) => (
        <li key={b.fromDays}>
          <span className="dc-aging-l">{label(b)}</span>
          <span className="dc-aging-track" style={{ width: `${(b.count / max) * 100}%` }}>
            {BAND_ORDER.filter((band) => b.byBand[band]).map((band) => <button key={band} type="button" className="dc-seg" data-band={band} style={{ flex: b.byBand[band], ["--c" as string]: BAND_COLOR[band] }} onClick={() => onPick(b, band)} aria-label={`${label(b)}: ${band} ${b.byBand[band]}`}>{b.byBand[band]}</button>)}
          </span>
          <strong>{b.count}</strong>
        </li>
      ))}
    </ul>
  );
}

// ---------- donut ----------
const PAL = ["#0b1f3a", "#0e7490", "#c2760a", "#16603a", "#8d153a"];
export function Donut({ items, copy, label }: { items: { key: string; label: string; n: number }[]; copy: DashCopy; label: string }) {
  const total = items.reduce((a, b) => a + b.n, 0);
  if (!total) return <p className="rs-help">{copy.outcomes.empty}</p>;
  const r = 38, c = 2 * Math.PI * r;
  const starts = items.map((_, k) => items.slice(0, k).reduce((a, b) => a + (b.n / total) * c, 0));
  return (
    <div className="dc-donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${total}`}>
        <defs>{PAL.map((col, k) => <pattern key={k} id={`dc-dp${k}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(${k * 36})`}><rect width="6" height="6" fill={col} /><rect width={k % 2 ? 2 : 0} height="6" fill="#fff" opacity="0.55" /></pattern>)}</defs>
        {items.map((it, k) => { const len = (it.n / total) * c; return <circle key={it.key} cx="50" cy="50" r={r} fill="none" stroke={`url(#dc-dp${k % PAL.length})`} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-starts[k]!} transform="rotate(-90 50 50)" />; })}
        <text x="50" y="55" textAnchor="middle" className="dc-donut-n">{total}</text>
      </svg>
      <ul>{items.map((it, k) => <li key={it.key}><i className="dc-swatch" style={{ ["--k" as string]: PAL[k % PAL.length] }} data-alt={k % 2} aria-hidden="true" />{it.label}: <b>{it.n}</b> ({Math.round((it.n / total) * 100)}%)</li>)}</ul>
    </div>
  );
}

// ---------- calendar heat strip ----------
export function CalendarStrip({ days, copy, locale, onPick }: { days: CalDay[]; copy: DashCopy; locale: string; onPick: (d: CalDay) => void }) {
  const [focus, setFocus] = useState(0);
  const max = Math.max(1, ...days.map((d) => d.activeCount));
  const first = new Date(`${days[0]?.date ?? "1970-01-01"}T00:00:00Z`).getUTCDay();
  const move = (e: KeyboardEvent, k: number) => {
    const next = e.key === "ArrowRight" ? k + 1 : e.key === "ArrowLeft" ? k - 1 : e.key === "ArrowDown" ? k + 7 : e.key === "ArrowUp" ? k - 7 : null;
    if (next === null || next < 0 || next >= days.length) return;
    e.preventDefault(); setFocus(next); document.getElementById(`dc-cal-${next}`)?.focus();
  };
  const dow = Array.from({ length: 7 }, (_, k) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + k))));
  return (
    <div role="grid" aria-label={copy.calendar.title} className="dc-cal">
      <div role="row" className="dc-cal-head">{dow.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
      <div className="dc-cal-grid" role="rowgroup">
        {Array.from({ length: first }, (_, k) => <span key={`b${k}`} className="dc-cal-blank" role="gridcell" aria-hidden="true" />)}
        {days.map((d, k) => (
          <button key={d.date} id={`dc-cal-${k}`} role="gridcell" type="button" tabIndex={focus === k ? 0 : -1} className="dc-day" data-today={k === 0} data-band={d.maxBand ?? "none"} style={{ ["--a" as string]: d.activeCount / max }} onKeyDown={(e) => move(e, k)} onFocus={() => setFocus(k)} onClick={() => onPick(d)}
            aria-label={`${fmtDay(d.date, locale)}${k === 0 ? `, ${copy.calendar.today}` : ""}: ${d.activeCount ? fmt(copy.calendar.active, { n: d.activeCount }) : copy.calendar.none}${d.starts ? `, ${fmt(copy.calendar.starts, { n: d.starts })}` : ""}${d.uncoordinated ? `, ${fmt(copy.calendar.uncoordinated, { n: d.uncoordinated })}` : ""}`}>
            <span className="dc-day-n">{new Date(`${d.date}T00:00:00Z`).getUTCDate()}</span>
            {d.starts ? <i className="dc-dot" aria-hidden="true" /> : null}
            {d.uncoordinated ? <b className="dc-bang" aria-hidden="true">!</b> : null}
            {d.activeCount ? <span className="dc-day-c">{d.activeCount}</span> : null}
            <span className="dc-day-tip" aria-hidden="true">{d.topConflictNos.join(" · ")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- corridor pulse (relative-position bubble map, no basemap) ----------
export function BubbleMap({ bins, copy, onOpen }: { bins: MapBin[]; copy: DashCopy; onOpen: (conflictNo: string) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!bins.length) return <p className="rs-help">{copy.map.empty}</p>;
  const lngs = bins.map((b) => b.center[0]), lats = bins.map((b) => b.center[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max(0.05, (Math.max(...lngs) - Math.min(...lngs)) * kx), spanY = Math.max(0.05, Math.max(...lats) - Math.min(...lats));
  const sc = Math.min(560 / spanX, 300 / spanY);
  const px = (lng: number) => 40 + (lng - Math.min(...lngs)) * kx * sc, py = (lat: number) => 340 - (lat - Math.min(...lats)) * sc;
  const maxN = Math.max(...bins.map((b) => b.count));
  const selected = sel === null ? null : bins[sel];
  return (
    <div className="dc-map">
      <svg viewBox="0 0 640 380" role="group" aria-label={copy.map.title}>
        <defs>
          <pattern id="dc-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e2e8f0" strokeWidth="1" /></pattern>
          <pattern id="dc-ring" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="#fff" opacity="0.6" /></pattern>
        </defs>
        <rect width="640" height="380" fill="url(#dc-grid)" rx="10" />
        {bins.map((b, k) => {
          const rad = 7 + Math.sqrt(b.count / maxN) * 17;
          const col = BAND_COLOR[b.maxBand];
          return (
            <g key={k} transform={`translate(${px(b.center[0]).toFixed(1)} ${py(b.center[1]).toFixed(1)})`} tabIndex={0} role="button" aria-pressed={sel === k} aria-label={`${fmt(copy.map.cell, { n: b.count })}, ${b.maxBand}: ${b.topConflictNos.join(", ")}`} className="dc-bub" onClick={() => setSel(sel === k ? null : k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(sel === k ? null : k); } }}>
              {b.maxBand === "critical" ? <circle r={rad + 6} fill={col} opacity="0.25" className="dc-pulse" /> : null}
              <circle r={rad} fill={col} opacity="0.85" stroke="#fff" strokeWidth="2" />
              {b.maxBand === "high" || b.maxBand === "medium" ? <circle r={rad} fill="url(#dc-ring)" /> : null}
              {b.maxBand === "low" || b.maxBand === "info" ? <circle r={rad - 4} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="2 3" /> : null}
              <text y="4" textAnchor="middle" className="dc-bub-n">{b.count}</text>
            </g>
          );
        })}
      </svg>
      {selected ? (
        <div className="dc-pop" role="dialog" aria-label={fmt(copy.map.cluster, { lat: selected.center[1], lng: selected.center[0] })}>
          <strong>{fmt(copy.map.cell, { n: selected.count })}</strong>
          <ul>{selected.topConflictNos.map((no) => <li key={no}><code>{no}</code><button type="button" className="rs-btn" onClick={() => onOpen(no)}>{copy.actions.open}</button></li>)}</ul>
        </div>
      ) : null}
      <p className="rs-help">{copy.map.note}</p>
    </div>
  );
}

/** Up to three agencies side by side as small-multiple bars (no radar needed). */
export function CompareBars({ metrics, rows }: { metrics: { key: string; label: string; max: number; fmt: (v: number | null) => string }[]; rows: { id: string; name: string; values: Record<string, number | null> }[] }) {
  return (
    <div className="dc-compare">
      {metrics.map((m) => (
        <div key={m.key} className="dc-cmp-row"><span className="dc-cmp-l">{m.label}</span>
          <div>{rows.map((r, k) => { const v = r.values[m.key] ?? null; return <div key={r.id} className="dc-cmp-bar"><i style={{ width: `${v === null ? 0 : Math.min(100, (v / (m.max || 1)) * 100)}%`, ["--k" as string]: PAL[k] }} data-alt={k % 2} /><span>{r.name}: <b>{m.fmt(v)}</b></span></div>; })}</div>
        </div>
      ))}
    </div>
  );
}
