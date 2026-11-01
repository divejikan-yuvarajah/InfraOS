"use client";

import { useEffect, useRef, useState } from "react";
import { EyeIcon, FlameIcon, InfoIcon, LinkIcon, OctagonAlertIcon, ShieldCheckIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";

import { BAND_COLOR, BAND_RANGE, BANDS_ASC, BANDS_DESC, fmt, type Band, type Factor, type Kind, type ProfileBin, type WhatIfOutcome } from "@/lib/roadsync/assessment";
import type { AssessmentCopy } from "@/lib/roadsync/assessment-copy";

/** Severity is never colour-only: every band has an icon, a label and (critical) a stripe pattern in CSS. */
export const BAND_ICON: Record<Band, LucideIcon> = { info: InfoIcon, low: ShieldCheckIcon, medium: TriangleAlertIcon, high: OctagonAlertIcon, critical: FlameIcon };
export const bandOfScore = (score: number): Band => BANDS_ASC.find((b) => score <= BAND_RANGE[b][1]) ?? "critical";

export function BandPill({ band, copy }: { band: Band; copy: AssessmentCopy }) {
  const Icon = BAND_ICON[band];
  return <span className="rs-sev" data-band={band}><Icon aria-hidden="true" /><span>{copy.bands[band]}</span></span>;
}

export function KindPill({ kind, band, copy }: { kind: Kind; band: Band; copy: AssessmentCopy }) {
  if (kind === "conflict") return <BandPill band={band} copy={copy} />;
  const Icon = kind === "opportunity" ? LinkIcon : EyeIcon;
  return <span className="rs-sev" data-kind={kind}><Icon aria-hidden="true" /><span>{copy.kindOne[kind]}</span></span>;
}

/** Small ring + number, used on the hero, the list rows and the lens header. */
export function ScoreRing({ score, band, size = 44, label }: { score: number; band: Band; size?: number; label?: string }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg className="rs-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? String(score)}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BAND_COLOR[band]} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.34} fontWeight="700" fill="#0f172a">{score}</text>
    </svg>
  );
}

export function RiskChip({ value, band, copy }: { value: number; band: Band | null; copy: AssessmentCopy }) {
  const shown = band ?? "info";
  return (
    <span className="rs-riskchip" data-band={shown}>
      <ScoreRing score={value} band={shown} size={30} label={fmt(copy.gaugeLabel, { value, band: copy.bands[shown] })} />
      <span>{band ? copy.bands[band] : copy.noRisk}</span>
    </span>
  );
}

/* ---------- gauge ---------- */

const GAUGE = { cx: 120, cy: 118, r: 92, start: -110, span: 220 };
const polar = (angle: number, r = GAUGE.r): [number, number] => [GAUGE.cx + r * Math.sin((angle * Math.PI) / 180), GAUGE.cy - r * Math.cos((angle * Math.PI) / 180)];
const angleOf = (v: number) => GAUGE.start + (Math.max(0, Math.min(100, v)) / 100) * GAUGE.span;
function arc(from: number, to: number): string {
  const [x1, y1] = polar(angleOf(from));
  const [x2, y2] = polar(angleOf(to));
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${GAUGE.r} ${GAUGE.r} 0 ${(to - from) * 2.2 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function RiskGauge({ value, band, copy, ruleVersion }: { value: number; band: Band | null; copy: AssessmentCopy; ruleVersion: string | null }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setShown(value));
    return () => window.cancelAnimationFrame(t);
  }, [value]);
  const label = fmt(copy.gaugeLabel, { value, band: copy.bands[band ?? "info"] });
  return (
    <figure className="rs-gauge" aria-label={label}>
      <svg viewBox="0 0 240 150" role="img" aria-label={label}>
        {BANDS_ASC.map((b) => <path key={b} d={arc(BAND_RANGE[b][0], BAND_RANGE[b][1] + 1)} fill="none" stroke={BAND_COLOR[b]} strokeWidth="16" strokeLinecap="butt" opacity={band === b ? 1 : 0.38} />)}
        <g className="rs-gauge-needle" style={{ transform: `rotate(${angleOf(shown) - 0}deg)`, transformOrigin: `${GAUGE.cx}px ${GAUGE.cy}px` }}>
          <line x1={GAUGE.cx} y1={GAUGE.cy} x2={GAUGE.cx} y2={GAUGE.cy - GAUGE.r + 6} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx={GAUGE.cx} cy={GAUGE.cy} r="7" fill="#0f172a" />
        <text x={GAUGE.cx} y={GAUGE.cy + 4} textAnchor="middle" dominantBaseline="hanging" fontSize="30" fontWeight="800" fill="#0f172a" className="rs-gauge-num">{value}</text>
      </svg>
      <figcaption>
        <span className="rs-gauge-label">{copy.riskIndex}</span>
        {band ? <BandPill band={band} copy={copy} /> : <span className="rs-help">{copy.noRisk}</span>}
        {ruleVersion ? <span className="rs-help">{fmt(copy.rule, { version: ruleVersion })}</span> : null}
      </figcaption>
    </figure>
  );
}

/* ---------- band distribution ---------- */

export function BandBar({ counts, active, onToggle, copy }: { counts: Record<Band, number>; active: Band[]; onToggle: (b: Band) => void; copy: AssessmentCopy }) {
  const total = BANDS_DESC.reduce((n, b) => n + counts[b], 0);
  return (
    <div className="rs-bandbar" role="group" aria-label={copy.filters.band}>
      {BANDS_DESC.map((b) => {
        const Icon = BAND_ICON[b];
        return (
          <button key={b} type="button" className="rs-bandseg" data-band={b} aria-pressed={active.includes(b)} disabled={counts[b] === 0} style={{ flexGrow: total === 0 ? 1 : Math.max(counts[b], 0.7) }} onClick={() => onToggle(b)}>
            <Icon aria-hidden="true" />
            <strong>{counts[b]}</strong>
            <span>{copy.bands[b]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- severity DNA ---------- */

const DNA_COLOR: Record<string, string> = { spatial: "#2563eb", sharedCorridor: "#0891b2", temporal: "#7c3aed", hazard: "#d9632b", trafficCompounding: "#ca8a04", priorityEmergency: "#be123c" };

/** Micro stacked bar: how much of the score each component contributed. Text alternative lists the points. */
export function SeverityDNA({ factors, copy }: { factors: Factor[]; copy: AssessmentCopy }) {
  const parts = factors.filter((f) => f.key !== "floor" && f.points > 0);
  const total = parts.reduce((n, f) => n + f.points, 0) || 1;
  const text = parts.map((f) => `${copy.component[f.key] ?? f.key} ${f.points}`).join(", ");
  return (
    <span className="rs-dna" role="img" aria-label={`${copy.card.dna}: ${text}`} title={text}>
      {parts.map((f) => <i key={f.key} style={{ flexGrow: f.points / total, background: DNA_COLOR[f.key] ?? "#64748b" }} />)}
    </span>
  );
}

/* ---------- corridor profile strip ---------- */

export function CorridorStrip({ bins, active, onActive, onPick, copy }: { bins: ProfileBin[]; active: number | null; onActive: (index: number | null) => void; onPick: (bin: ProfileBin) => void; copy: AssessmentCopy }) {
  const ref = useRef<HTMLDivElement>(null);
  const n = bins.length;
  const at = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - box.left) / box.width) * n)));
  };
  const bin = active === null ? null : bins[active] ?? null;
  const text = bin ? fmt(copy.profile.hover, { from: bin.fromM, to: bin.toM, band: copy.bands[bandOfScore(bin.score)], n: bin.topCandidateIds.length }) : copy.profile.help;
  function onKey(e: React.KeyboardEvent) {
    const cur = active ?? 0;
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? cur + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next !== null) { e.preventDefault(); onActive(Math.max(0, Math.min(n - 1, next))); }
    else if (e.key === "Enter" && bin) { e.preventDefault(); onPick(bin); }
    else if (e.key === "Escape") onActive(null);
  }
  return (
    <div className="rs-strip">
      <div
        ref={ref}
        className="rs-strip-track"
        role="slider"
        tabIndex={0}
        aria-label={copy.profile.scrub}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={active ?? 0}
        aria-valuetext={text}
        onKeyDown={onKey}
        onPointerMove={(e) => onActive(at(e.clientX))}
        onPointerLeave={() => onActive(null)}
        onClick={(e) => { const b = bins[at(e.clientX)]; if (b) onPick(b); }}
      >
        {bins.map((b, i) => (
          <i key={b.fromM} className="rs-strip-bin" data-active={active === i || undefined} style={{ background: b.score > 0 ? BAND_COLOR[bandOfScore(b.score)] : "#e2e8f0", opacity: b.score > 0 ? 1 : 0.7 }} />
        ))}
        {active !== null ? <b className="rs-strip-handle" aria-hidden="true" style={{ left: `${((active + 0.5) / n) * 100}%` }} /> : null}
      </div>
      <p className="rs-help" aria-live="polite">{text}</p>
      <table className="mc-sr">
        <caption>{copy.profile.tableCaption}</caption>
        <thead><tr><th>{copy.profile.colStretch}</th><th>{copy.profile.colScore}</th><th>{copy.profile.colBand}</th></tr></thead>
        <tbody>{bins.filter((b) => b.score > 0).map((b) => <tr key={b.fromM}><td>{b.fromM}–{b.toM}</td><td>{b.score}</td><td>{copy.bands[bandOfScore(b.score)]}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------- what-if curve ---------- */

export function ShiftCurve({ curve, shift, range, flexDays, earliest, copy, onPick }: { curve: ({ shiftDays: number } & WhatIfOutcome)[]; shift: number; range: [number, number]; flexDays: number; earliest: number; copy: AssessmentCopy; onPick: (shiftDays: number) => void }) {
  const W = 560;
  const H = 120;
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const span = range[1] - range[0];
  const x = (s: number) => pad.l + ((s - range[0]) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = curve.map((c, i) => `${i ? "L" : "M"} ${x(c.shiftDays).toFixed(1)} ${y(c.riskIndex).toFixed(1)}`).join(" ");
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const s = Math.round(range[0] + ((px - pad.l) / (W - pad.l - pad.r)) * span);
    onPick(Math.max(range[0], Math.min(range[1], s)));
  };
  return (
    <svg className="rs-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={copy.shift.curve} onPointerDown={pick}>
      {BANDS_ASC.map((b) => <rect key={b} x={pad.l} width={W - pad.l - pad.r} y={y(BAND_RANGE[b][1] + 1)} height={y(BAND_RANGE[b][0]) - y(BAND_RANGE[b][1] + 1)} fill={BAND_COLOR[b]} opacity="0.1" />)}
      {earliest > range[0] ? <rect x={x(range[0])} width={x(earliest) - x(range[0])} y={pad.t} height={H - pad.t - pad.b} fill="url(#rs-hatch)" /> : null}
      <defs><pattern id="rs-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="2" opacity="0.35" /></pattern></defs>
      {flexDays > 0 ? <rect x={x(-flexDays)} width={x(flexDays) - x(-flexDays)} y={pad.t} height={H - pad.t - pad.b} fill="#E0A526" opacity="0.25" /> : null}
      <line x1={x(0)} x2={x(0)} y1={pad.t} y2={H - pad.b} stroke="#0f172a" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="#0f172a" strokeWidth="2" />
      <line x1={x(shift)} x2={x(shift)} y1={pad.t} y2={H - pad.b} stroke="#c2410c" strokeWidth="2" />
      {[0, 50, 100].map((v) => <text key={v} x={pad.l - 4} y={y(v) + 3} fontSize="9" textAnchor="end" fill="#64748b">{v}</text>)}
      {[range[0], 0, range[1]].map((s) => <text key={s} x={x(s)} y={H - 6} fontSize="9" textAnchor="middle" fill="#64748b">{s}</text>)}
    </svg>
  );
}
