"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BAND_COLOR, fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import type { Preview } from "@/lib/roadsync/advisor";
import { previewSchedule } from "@/lib/roadsync/advisor-api";
import { getAdvisorCopy } from "@/lib/roadsync/advisor-copy";
import "@/styles/mission-control-roadsync-advisor.css";

import { useRoadsyncKeys } from "./resolution-tab";

type Props = {
  geometry: unknown; startUtc: string | null; endUtc: string | null; workingHours: string; isEmergency: boolean; workType: string; priority: string;
  /** Applies new dates to the form. Called ONLY from a user click or Enter. */
  onUse: (startUtc: string, endUtc: string) => void;
};
const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY) + 1;

/** Advisory only: never blocks Next or Submit, and never edits the form unless the user clicks "Use these dates". */
export function ScheduleAdvisor({ geometry, startUtc, endUtc, workingHours, isEmergency, workType, priority, onUse }: Props) {
  const [locale] = useWorkspaceLocale();
  const copy = getAdvisorCopy(locale);
  const ac = getAssessmentCopy(locale);
  const keys = useRoadsyncKeys();
  const ready = Boolean(geometry && startUtc && endUtc && new Date(endUtc) >= new Date(startUtc));
  const body = useMemo(() => (ready ? { geometry, schedule: { plannedStart: startUtc, plannedEnd: endUtc, workingHours, flexibleDays: 0, isEmergency }, subject: { ...(workType ? { workType } : {}), ...(priority ? { priority } : {}), isEmergency } } : null), [ready, geometry, startUtc, endUtc, workingHours, isEmergency, workType, priority]);
  const raw = body ? JSON.stringify(body) : "";
  // Debounce 500 ms, latest wins (react-query cancels superseded keys).
  const [settled, setSettled] = useState("");
  useEffect(() => { const t = setTimeout(() => setSettled(raw), 500); return () => clearTimeout(t); }, [raw]);
  const q = useQuery<Preview>({ queryKey: keys.key("wizard-advisor", settled), queryFn: () => previewSchedule(JSON.parse(settled)), enabled: Boolean(settled) && Boolean(keys.userId) && settled === raw, retry: false, staleTime: 60_000 });
  const [cursor, setCursor] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ start: string; end: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const p = q.data;
  const total = p ? p.windows.reduce((n, w) => n + days(w.from, w.to), 0) : 0;
  const firstDay = p?.windows[0]?.from ?? null;
  const dayDate = (i: number) => (firstDay ? new Date(Date.parse(`${firstDay}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10) : "");
  const windowAt = (i: number) => { let n = 0; for (const w of p?.windows ?? []) { const len = days(w.from, w.to); if (i < n + len) return w; n += len; } return null; };
  const chosen = cursor === null ? null : windowAt(cursor);
  const shiftOf = (date: string) => startUtc ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startUtc.slice(0, 10)}T00:00:00Z`)) / DAY) : 0;

  const apply = () => {
    if (cursor === null || !startUtc || !endUtc) return;
    const shift = shiftOf(dayDate(cursor));
    setUndo({ start: startUtc, end: endUtc });
    onUse(new Date(Date.parse(startUtc) + shift * DAY).toISOString(), new Date(Date.parse(endUtc) + shift * DAY).toISOString());
    setNote(copy.wizard.applied); setCursor(null);
  };
  const key = (e: KeyboardEvent) => {
    if (!total) return;
    const step = e.shiftKey ? 7 : 1;
    if (e.key === "ArrowRight") { e.preventDefault(); setCursor((c) => Math.min(total - 1, (c ?? 0) + step)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setCursor((c) => Math.max(0, (c ?? 0) - step)); }
    else if (e.key === "Enter") { e.preventDefault(); apply(); }
    else if (e.key === "Escape") setCursor(null);
  };

  const later = p?.nearestClear.later, earlier = p?.nearestClear.earlier;
  const best = p?.bestForDisruption;
  return (
    <section className="sa" aria-label={copy.wizard.title}>
      <h3 className="ad-h">{copy.wizard.title}</h3>
      <p className="rs-help">{copy.wizard.advisory}</p>
      {!ready ? <p className="rs-help">{copy.wizard.hint}</p>
        : q.isError ? <p className="rz-warn" role="status">{copy.wizard.error}</p>
          : !p ? <p className="rs-help" role="status"><Loader2Icon aria-hidden="true" className="animate-spin rz-inline" /> {copy.wizard.loading}</p> : (
            <>
              {p.none ? <p className="rz-toast" role="status"><CheckCircle2Icon aria-hidden="true" className="rz-inline" /> {copy.wizard.none}</p>
                : <p role="status">{best ? (best.offsetDays > 0 ? fmt(copy.wizard.summaryLater, { n: best.offsetDays }) : fmt(copy.wizard.summaryEarlier, { n: Math.abs(best.offsetDays) })) : (later || earlier ? "" : copy.wizard.none)}</p>}
              {p.agenciesToCoordinate.length ? <p className="rs-help">{copy.wizard.agencies}: {p.agenciesToCoordinate.join(", ")}</p> : null}
              <div className="sa-ribbon" role="slider" tabIndex={0} aria-label={copy.wizard.ribbon} aria-valuemin={0} aria-valuemax={Math.max(0, total - 1)} aria-valuenow={cursor ?? 0} aria-valuetext={chosen ? fmt(copy.wizard.window, { from: chosen.from, to: chosen.to }) : copy.wizard.hint} onKeyDown={key}>
                {(() => { let at = 0; return p.windows.map((w) => { const len = days(w.from, w.to); const start = at; at += len; return (
                  <button key={w.from} type="button" tabIndex={-1} className="sa-seg" data-free={w.maxBand === null} data-band={w.maxBand ?? "none"} style={{ ["--w" as string]: len, ["--c" as string]: w.maxBand ? BAND_COLOR[w.maxBand] : "#3E9B7A" }} aria-pressed={chosen === w}
                    aria-label={`${fmt(copy.wizard.window, { from: w.from, to: w.to })}: ${w.maxBand ? `${copy.wizard.band} ${ac.bands[w.maxBand]}` : copy.wizard.free}`} onClick={() => setCursor(start)} />); }); })()}
              </div>
              <ul className="sa-legend"><li><i className="dc-key" data-shape="hatch" style={{ ["--k" as string]: "#3E9B7A" }} aria-hidden="true" />{copy.wizard.free}</li><li><i className="dc-key" style={{ ["--k" as string]: BAND_COLOR.high }} aria-hidden="true" />{copy.wizard.conflict}</li></ul>
              {chosen ? <p>{fmt(copy.wizard.window, { from: chosen.from, to: chosen.to })} · {chosen.maxBand ? `${copy.wizard.band}: ${ac.bands[chosen.maxBand]}` : copy.wizard.free} <button type="button" className="rs-btn is-primary" onClick={apply}>{copy.wizard.use}</button></p> : null}
              <details><summary>{copy.map.table}</summary><table className="sl-table"><tbody>{p.windows.map((w) => <tr key={w.from}><th scope="row">{fmt(copy.wizard.window, { from: w.from, to: w.to })}</th><td>{w.maxBand ? ac.bands[w.maxBand] : copy.wizard.free}</td></tr>)}</tbody></table></details>
            </>
          )}
      {note ? <p className="rz-toast" role="status">{note} {undo ? <button type="button" className="rz-link" onClick={() => { onUse(undo.start, undo.end); setUndo(null); setNote(null); }}>{copy.wizard.undo}</button> : null}</p> : null}
    </section>
  );
}
