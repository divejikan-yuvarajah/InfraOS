"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ClockIcon, MinusIcon, PlusIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { fmt, type ClearShift } from "@/lib/roadsync/assessment";
import { fetchWhatIf } from "@/lib/roadsync/assessment-api";
import type { AssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { workRequestQueryKey } from "@/lib/roadsync/work-requests-view";

import { BandPill, ScoreRing, ShiftCurve } from "./risk-visuals";

const DAY_MS = 86_400_000;
const label = (iso: string, days: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short" }).format(new Date(Date.parse(iso) + days * DAY_MS));

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

/**
 * Read-only what-if for ONE request. One sweep is fetched when the card opens; dragging only reads that curve.
 * Nothing is saved and nothing is ever applied automatically.
 */
export function TimeShiftExplorer({ requestId, plannedStart, plannedEnd, copy }: { requestId: string; plannedStart: string; plannedEnd: string; copy: AssessmentCopy }) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const [buffer, setBuffer] = useState(0);
  const [hours, setHours] = useState<"day" | "night" | "24h">("day");
  const debouncedBuffer = useDebounced(buffer, 250);
  const s = copy.shift;

  const query = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "whatif", requestId, debouncedBuffer, hours),
    queryFn: () => fetchWhatIf(requestId, { sweep: true, ...(debouncedBuffer > 0 ? { bufferMeters: debouncedBuffer } : {}), ...(hours !== "day" ? { workingHours: hours } : {}) }),
    enabled: open && Boolean(userId),
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  const min = data ? Math.max(data.range[0], data.earliestShiftDays) : -60;
  const max = data ? data.range[1] : 120;
  const clamped = Math.max(min, Math.min(max, shift));
  const here = data?.curve?.find((c) => c.shiftDays === clamped) ?? null;
  const current = data?.current ?? null;
  const shiftText = clamped === 0 ? s.noShift : clamped < 0 ? fmt(s.earlierLater, { n: -clamped }) : fmt(s.laterBy, { n: clamped });
  const failure = query.error ? (query.error instanceof ApiError && query.error.status === 429 ? copy.states.tooMany : s.failed) : null;

  const chip = (kind: "earlier" | "later", c: ClearShift) => (
    <button key={kind} type="button" className="rs-chip-btn" data-muted={c ? !c.withinFlexibility || undefined : true} disabled={!c} onClick={() => c && setShift(c.shiftDays)}
      aria-label={c ? `${fmt(kind === "earlier" ? s.earlier : s.later, { n: Math.abs(c.shiftDays) })}${c.withinFlexibility ? "" : `, ${fmt(s.outsideFlex, { flex: data?.flexibleDays ?? 0 })}`}` : `${kind}: ${s.none}`}>
      <strong>{c ? fmt(kind === "earlier" ? s.earlier : s.later, { n: Math.abs(c.shiftDays) }) : s.none}</strong>
      {c ? <span>{c.withinFlexibility ? s.withinFlex : fmt(s.outsideFlex, { flex: data?.flexibleDays ?? 0 })}</span> : null}
    </button>
  );

  return (
    <section className="rs-shift" aria-label={s.title}>
      <div className="rs-shift-head">
        <h4><ClockIcon aria-hidden="true" />{s.title}</h4>
        <span className="rs-nb-chip">{s.scenarioOnly}</span>
        <button type="button" className="rs-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? s.hide : s.open}</button>
      </div>
      {open ? (
        query.isPending ? <p className="rs-help" role="status">{s.loading}</p>
        : failure || !data ? <div className="rs-state" role="alert"><p>{failure ?? s.failed}</p><button type="button" className="rs-btn" onClick={() => void query.refetch()}>{copy.states.retry}</button></div>
        : (
          <>
            <div className="rs-shift-slider">
              <label htmlFor={`rs-shift-${requestId}`}>{s.slider}: <strong>{shiftText}</strong></label>
              <input id={`rs-shift-${requestId}`} type="range" min={min} max={max} step={1} value={clamped} onChange={(e) => setShift(Number(e.target.value))} aria-valuetext={shiftText} />
              <p className="rs-help">{s.pastLimit}{data.flexibleDays > 0 ? ` · ${s.flexZone}: ±${data.flexibleDays} d` : ""}</p>
            </div>
            {data.curve ? <ShiftCurve curve={data.curve} shift={clamped} range={data.range} flexDays={data.flexibleDays} earliest={data.earliestShiftDays} copy={copy} onPick={(d) => setShift(Math.max(min, d))} /> : null}
            <div className="rs-shift-pair">
              <div className="rs-shift-card" data-which="current">
                <span className="rs-help">{s.current}</span>
                <ScoreRing score={current?.riskIndex ?? 0} band={current?.maxBand ?? "info"} size={64} label={fmt(copy.gaugeLabel, { value: current?.riskIndex ?? 0, band: copy.bands[current?.maxBand ?? "info"] })} />
                {current?.maxBand ? <BandPill band={current.maxBand} copy={copy} /> : <span className="rs-help">{copy.noRisk}</span>}
              </div>
              <div className="rs-shift-card" data-which="scenario" aria-live="polite">
                <span className="rs-help">{s.scenario}</span>
                <ScoreRing score={here?.riskIndex ?? 0} band={here?.maxBand ?? "info"} size={64} label={fmt(copy.gaugeLabel, { value: here?.riskIndex ?? 0, band: copy.bands[here?.maxBand ?? "info"] })} />
                {here?.maxBand ? <BandPill band={here.maxBand} copy={copy} /> : <span className="rs-help">{copy.noRisk}</span>}
              </div>
              <div className="rs-shift-facts">
                <p><strong>{fmt(s.dates, { from: label(plannedStart, clamped), to: label(plannedEnd, clamped) })}</strong></p>
                <p>{fmt(s.delta, { a: current?.conflictCount ?? 0, b: here?.conflictCount ?? 0 })}</p>
              </div>
            </div>
            <div className="rs-shift-clear">
              <span className="rs-help">{s.nearest}</span>
              <div className="rs-shift-chips">{chip("earlier", data.firstClearShifts?.earlier ?? null)}{chip("later", data.firstClearShifts?.later ?? null)}</div>
            </div>
            <div className="rs-shift-controls">
              <div className="rs-stepper" role="group" aria-label={s.buffer}>
                <span>{s.buffer}</span>
                <button type="button" className="rs-btn" aria-label={`${s.buffer} −`} disabled={buffer <= 0} onClick={() => setBuffer((b) => Math.max(0, b - 5))}><MinusIcon aria-hidden="true" /></button>
                <output aria-live="polite">{buffer}</output>
                <button type="button" className="rs-btn" aria-label={`${s.buffer} +`} disabled={buffer >= 100} onClick={() => setBuffer((b) => Math.min(100, b + 5))}><PlusIcon aria-hidden="true" /></button>
              </div>
              <div className="rs-cseg" role="group" aria-label={s.hours}>
                {(["day", "night", "24h"] as const).map((h) => <button key={h} type="button" className="rs-btn" aria-pressed={hours === h} onClick={() => setHours(h)}>{s.hoursOptions[h]}</button>)}
              </div>
            </div>
            <p className="rs-help">{s.coverage}</p>
            <table className="mc-sr">
              <caption>{s.curve}</caption>
              <thead><tr><th>{s.slider}</th><th>{copy.riskIndex}</th><th>{copy.kinds.conflict}</th></tr></thead>
              <tbody>{(data.curve ?? []).filter((c) => c.shiftDays % 10 === 0).map((c) => <tr key={c.shiftDays}><td>{c.shiftDays}</td><td>{c.riskIndex}</td><td>{c.conflictCount}</td></tr>)}</tbody>
            </table>
          </>
        )
      ) : null}
    </section>
  );
}
