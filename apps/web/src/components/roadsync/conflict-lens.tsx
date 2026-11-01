"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, MapPinIcon, ShieldAlertIcon, XIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { BAND_COLOR, BANDS_DESC, clampToBand, fmt, riskIndexOf, type AssessmentItem, type Band, type Factor } from "@/lib/roadsync/assessment";
import { clearOverride, saveOverride } from "@/lib/roadsync/assessment-api";
import { factorSentence, mitigationSentence, type AssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { INFRA_COLOR, MUTED_COLOR, SOURCE_LABEL } from "@/lib/roadsync/nearby";
import { WORK_TYPE_LABELS, type GeometryInput, type Position } from "@/lib/roadsync/work-requests-view";

import { ScheduleOverlapChart, type ChartBar } from "./nearby-activity";
import { BandPill, KindPill, ScoreRing } from "./risk-visuals";

export type LensSelf = { workType: string | null; plannedStart: string | null; plannedEnd: string | null; geometry: GeometryInput | null };

const COMPONENT_COLOR: Record<string, string> = { spatial: "#2563eb", sharedCorridor: "#0891b2", temporal: "#7c3aed", hazard: "#d9632b", trafficCompounding: "#ca8a04", priorityEmergency: "#be123c", floor: "#8D153A" };

type Row = { id: string; label: string; sentence: string; points: number; max: number; from: number; to: number; kind: "component" | "mitigation" | "floor" | "final" };

/** Horizontal waterfall rows: each component adds points, mitigation subtracts, a floor jumps, then the final score. */
function buildRows(copy: AssessmentCopy, factors: Factor[], mitigations: { key: string; points: number; params: Record<string, unknown> }[], final: number): Row[] {
  const rows: Row[] = [];
  let run = 0;
  for (const f of factors.filter((x) => x.key !== "floor")) {
    rows.push({ id: f.key, label: copy.component[f.key] ?? f.key, sentence: factorSentence(copy, f), points: f.points, max: f.max, from: run, to: run + f.points, kind: "component" });
    run += f.points;
  }
  for (const m of mitigations) {
    rows.push({ id: m.key, label: copy.lens.mitigation, sentence: mitigationSentence(copy, m), points: m.points, max: 0, from: run, to: run + m.points, kind: "mitigation" });
    run += m.points;
  }
  const floor = factors.find((f) => f.key === "floor");
  if (floor) {
    rows.push({ id: "floor", label: copy.component.floor ?? "floor", sentence: factorSentence(copy, floor), points: floor.points, max: floor.max, from: run, to: run + floor.points, kind: "floor" });
    run += floor.points;
  }
  rows.push({ id: "final", label: copy.lens.final, sentence: "", points: final, max: 100, from: 0, to: final, kind: "final" });
  return rows;
}

/** Small schematic of both shapes and the hotspot. No second map instance: it stays light and printable. */
function MiniShapes({ self, other, hotspot, connector, label }: { self: GeometryInput | null; other: GeometryInput; hotspot: Position; connector: [Position, Position] | null; label: string }) {
  const shapes = [self, other].filter((g): g is GeometryInput => Boolean(g));
  const pts = shapes.flatMap((g) => (g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.coordinates[0] ?? [])).concat([hotspot]);
  const [w, s, e, n] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  const lat = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const W = 300;
  const H = 150;
  const scale = Math.min((W - 24) / Math.max(1e-9, (e - w) * lat), (H - 24) / Math.max(1e-9, n - s));
  const px = (p: Position): [number, number] => [12 + ((p[0] - w) * lat) * scale + ((W - 24) - (e - w) * lat * scale) / 2, H - 12 - (p[1] - s) * scale - ((H - 24) - (n - s) * scale) / 2];
  const draw = (g: GeometryInput, color: string) => {
    if (g.type === "Point") return <circle cx={px(g.coordinates)[0]} cy={px(g.coordinates)[1]} r="5" fill={color} stroke="#fff" strokeWidth="2" />;
    const list = (g.type === "LineString" ? g.coordinates : g.coordinates[0] ?? []).map(px).map((p) => p.join(",")).join(" ");
    return g.type === "Polygon" ? <polygon points={list} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" /> : <polyline points={list} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />;
  };
  const [hx, hy] = px(hotspot);
  return (
    <svg className="rs-mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <rect width={W} height={H} rx="10" fill="#f8fafc" />
      {self ? draw(self, "#0f172a") : null}
      {draw(other, MUTED_COLOR)}
      {connector ? <line x1={px(connector[0])[0]} y1={px(connector[0])[1]} x2={px(connector[1])[0]} y2={px(connector[1])[1]} stroke="#334155" strokeDasharray="2 3" /> : null}
      <circle cx={hx} cy={hy} r="9" fill="#8D153A" fillOpacity="0.25" />
      <circle cx={hx} cy={hy} r="4.5" fill="#8D153A" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function ConflictLens({
  item, self, copy, allConflictScores, national, onClose, onLocate, onChanged,
}: {
  item: AssessmentItem;
  self: LensSelf;
  copy: AssessmentCopy;
  /** Effective scores of every conflict-kind pair, to preview an override's effect on the Risk Index. */
  allConflictScores: { id: string; score: number }[];
  national: boolean;
  onClose: () => void;
  onLocate: (candidateId: string) => void;
  onChanged: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const a = item.assessment;
  const [editing, setEditing] = useState(false);
  const [band, setBand] = useState<Band>(a.override?.band ?? a.effective.band);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => saveOverride(item.candidateId, { band, reason: reason.trim() }),
    onSuccess: () => { setNotice(copy.lens.overrideSaved); setEditing(false); setReason(""); onChanged(); },
    onError: (e) => setNotice(e instanceof ApiError && e.status === 403 ? copy.lens.overrideFailed : copy.lens.overrideFailed),
  });
  const clear = useMutation({
    mutationFn: () => clearOverride(item.candidateId),
    onSuccess: () => { setNotice(copy.lens.overrideCleared); onChanged(); },
    onError: () => setNotice(copy.lens.overrideFailed),
  });

  const rows = buildRows(copy, a.factors, a.mitigations, a.score);
  const newScore = clampToBand(a.score, band);
  const before = riskIndexOf(allConflictScores.map((s) => s.score));
  const after = riskIndexOf(allConflictScores.map((s) => (s.id === item.candidateId ? newScore : s.score)));
  const href = item.other.sourceType === "work_request" ? `/roadsync/work-requests/${item.other.id}` : item.other.sourceType === "project" ? `/projects/${item.other.id}` : null;
  const kindLabel = SOURCE_LABEL[item.other.sourceType].toLowerCase();
  const names = (list: string[]) => list.map((k) => copy.lens.inputNames[k] ?? k).join(", ");
  const bars = (): { self: ChartBar; lane: ChartBar } | null => {
    if (!self.plannedStart || !self.plannedEnd || !item.other.plannedStart || !item.other.plannedEnd) return null;
    const t = item.temporal;
    const overlap = t.overlapStart && t.overlapEnd ? { start: t.overlapStart, end: t.overlapEnd } : null;
    return {
      self: { key: "self", label: copy.lens.yours, start: self.plannedStart, end: self.plannedEnd, color: "#0f172a", overlap, flexDays: t.shift?.a.effectiveFlex ?? 0 },
      lane: { key: item.key, label: item.other.ref, start: item.other.plannedStart, end: item.other.plannedEnd, color: INFRA_COLOR[item.other.infrastructureType] ?? MUTED_COLOR, overlap, gapDays: t.relation === "adjacent" ? t.gapDays : undefined },
    };
  };
  const chart = bars();
  const workLabel = (t: string | null) => (t ? WORK_TYPE_LABELS[t as keyof typeof WORK_TYPE_LABELS] ?? t : "—");
  const shift = item.temporal.shift?.a;
  const lens = copy.lens;

  return (
    <aside ref={ref} tabIndex={-1} className="rs-nb-drawer rs-lens" role="dialog" aria-label={`${lens.title}: ${item.other.ref}`}>
      <div className="rs-nb-drawer-head">
        <div className="rs-lens-title">
          <ScoreRing score={a.effective.score} band={a.effective.band} size={56} label={`${a.effective.score}`} />
          <div>
            <h3>{item.other.title}</h3>
            <p className="rs-help"><code>{item.other.ref}</code> · {SOURCE_LABEL[item.other.sourceType]} · {item.other.agencyName ?? copy.card.agencyUnknown}</p>
            <div className="rs-lens-pills">
              <KindPill kind={a.kind} band={a.effective.band} copy={copy} />
              {a.classes.map((c) => <span key={c} className="rs-nb-chip">{copy.classes[c]}</span>)}
            </div>
          </div>
        </div>
        <button type="button" className="rs-btn" onClick={onClose} aria-label={lens.close}><XIcon aria-hidden="true" /></button>
      </div>

      {a.overridden ? (
        <div className="rs-nb-advice" role="note">
          <strong>{lens.overriddenBy}</strong>
          {a.override ? <span> · {lens.overrideReason}: {a.override.reason}</span> : null}
          <span> · {fmt(lens.computedBand, { band: copy.bands[a.band], score: a.score })}</span>
          {a.overrideStale ? <span> · {lens.overrideStale}</span> : null}
        </div>
      ) : null}

      <section aria-label={lens.waterfall}>
        <h4>{lens.waterfall}</h4>
        <ol className="rs-wf">
          {rows.slice(0, 12).map((r, i) => (
            <li key={r.id} data-kind={r.kind} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <div className="rs-wf-text">
                <strong>{r.label}</strong>
                {r.sentence ? <span>{r.sentence}</span> : null}
              </div>
              <div className="rs-wf-track" aria-hidden="true">
                <i style={{ left: `${Math.min(r.from, r.to)}%`, width: `${Math.max(1, Math.abs(r.to - r.from))}%`, background: r.kind === "final" ? BAND_COLOR[a.band] : COMPONENT_COLOR[r.id] ?? "#64748b" }} />
              </div>
              <span className="rs-wf-pts">{r.kind === "final" ? r.points : `${r.points > 0 ? "+" : ""}${r.points}${r.max ? ` / ${r.max}` : ""}`}</span>
            </li>
          ))}
        </ol>
        <table className="mc-sr">
          <caption>{lens.waterfallTable}</caption>
          <thead><tr><th>{lens.waterfallTable}</th><th>{lens.points}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{r.label}{r.sentence ? `: ${r.sentence}` : ""}</td><td>{r.points}</td></tr>)}</tbody>
        </table>
        {a.incompleteInputs.length ? <p className="rs-help">{fmt(lens.incomplete, { items: names(a.incompleteInputs) })}</p> : null}
        {a.inputsAssumed.length ? <p className="rs-help">{fmt(lens.assumed, { items: names(a.inputsAssumed) })}</p> : null}
        {a.sequence ? <p className="rs-help">{fmt(a.sequence.direction === "self_then_other" ? lens.sequenceSelfFirst : lens.sequenceOtherFirst, { gap: a.sequence.gapDays })}</p> : null}
      </section>

      <section aria-label={lens.hotspot}>
        <h4>{lens.hotspot}</h4>
        <MiniShapes self={self.geometry} other={item.other.geometry} hotspot={a.hotspot.coordinates} connector={item.spatial.closestPoints} label={lens.hotspot} />
      </section>

      <section aria-label={lens.schedule}>
        <h4>{lens.schedule}</h4>
        <table className="rs-nb-compare">
          <thead><tr><th scope="col"><span className="mc-sr">·</span></th><th scope="col">{lens.yours}</th><th scope="col">{lens.theirs}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{copy.component.hazard}</th><td>{workLabel(self.workType)}</td><td>{workLabel(item.other.workType) === "—" ? SOURCE_LABEL[item.other.sourceType] : workLabel(item.other.workType)}</td></tr>
          </tbody>
        </table>
        {chart ? <ScheduleOverlapChart self={chart.self} lanes={[chart.lane]} /> : null}
        {shift && item.temporal.overlapDays > 0 && shift.daysToClearBefore !== null && shift.daysToClearAfter !== null ? (
          <p className="rs-nb-advice" role="note">{fmt(shift.resolvable ? copy.card.resolvable : copy.card.notResolvable, { before: Math.max(0, shift.daysToClearBefore), after: Math.max(0, shift.daysToClearAfter), flex: shift.effectiveFlex })}</p>
        ) : null}
        {item.other.detailLevel === "redacted" ? <p className="rs-help">{lens.redacted}</p> : null}
      </section>

      <div className="rs-lens-actions">
        <button type="button" className="rs-btn" onClick={() => onLocate(item.candidateId)}><MapPinIcon aria-hidden="true" />{lens.locate}</button>
        {href && item.canOpen ? <Link href={href} className="rs-btn is-primary"><ExternalLinkIcon aria-hidden="true" />{fmt(lens.open, { kind: kindLabel })}</Link> : <p className="rs-help">{lens.noAccess}</p>}
      </div>

      {national ? (
        <section className="rs-override" aria-label={lens.override}>
          <h4><ShieldAlertIcon aria-hidden="true" />{lens.override}</h4>
          <p className="rs-help">{lens.overrideHelp}</p>
          {!editing ? (
            <div className="rs-lens-actions">
              <button type="button" className="rs-btn" onClick={() => setEditing(true)}>{lens.override}</button>
              {a.overridden ? <button type="button" className="rs-btn" disabled={clear.isPending} onClick={() => clear.mutate()}>{lens.overrideClear}</button> : null}
            </div>
          ) : (
            <form className="rs-override-form" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 10) save.mutate(); }}>
              <label>{lens.overrideBand}
                <select className="rs-input" value={band} onChange={(e) => setBand(e.target.value as Band)}>
                  {BANDS_DESC.map((b) => <option key={b} value={b}>{copy.bands[b]}</option>)}
                </select>
              </label>
              <label>{lens.overrideReasonLabel}
                <textarea className="rs-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={reason.length > 0 && reason.trim().length < 10} />
              </label>
              <p className="rs-help" aria-live="polite"><BandPill band={band} copy={copy} /> {fmt(lens.overrideEffect, { band: copy.bands[band], score: newScore, before, after })}</p>
              <div className="rs-lens-actions">
                <button type="submit" className="rs-btn is-primary" disabled={reason.trim().length < 10 || save.isPending}>{lens.overrideSave}</button>
                <button type="button" className="rs-btn" onClick={() => setEditing(false)}>{lens.cancel}</button>
              </div>
            </form>
          )}
          {notice ? <p className="rs-help" role="status">{notice}</p> : null}
        </section>
      ) : null}
    </aside>
  );
}
