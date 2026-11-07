"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { addDays, dayKey, dayStart, groupByDay, keyMove, monthGrid, moveAnchor, weekCells, type CalendarView } from "@/lib/inspections/calendar-math";
import type { Copy } from "@/lib/inspections/messages";
import type { InspectionRow } from "@/lib/inspections/types";
import { INSPECTION_STATUSES } from "@/lib/inspections/types";
import { fill, fmtDayLong, fmtMonth, fmtTime, weekdayShort } from "@/lib/inspections/view";

import { PriorityChip, STATUS_ICONS, StatusBadge } from "./inspection-ui";

type Props = {
  rows: InspectionRow[]; view: CalendarView; anchor: Date; locale: AuthLocale; copy: Copy; truncated: boolean; loading: boolean;
  canSchedule: boolean; canReschedule: boolean; onView: (v: CalendarView) => void; onAnchor: (d: Date) => void;
  onSchedule: (day: Date) => void; onReschedule: (row: InspectionRow) => void;
};

function Event({ row, locale, onPick }: { row: InspectionRow; locale: AuthLocale; onPick: (r: InspectionRow) => void }) {
  const Icon = STATUS_ICONS[row.status];
  return (
    <button type="button" className="ins-evt" data-status={row.status} data-overdue={row.overdue} data-prio={row.priority} onClick={(e) => { e.stopPropagation(); onPick(row); }} title={`${row.inspectionNo ?? ""} ${row.projectCode ?? ""}`}>
      <Icon aria-hidden="true" />{fmtTime(row.inspectionDate, locale)} {row.projectCode ?? row.inspectionNo}
    </button>
  );
}

export function InspectionCalendar(p: Props) {
  const { copy, locale } = p;
  const [picked, setPicked] = useState<InspectionRow | null>(null);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [focus, setFocus] = useState<Date>(() => dayStart(p.anchor));
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const byDay = useMemo(() => groupByDay(p.rows), [p.rows]);
  const cells = p.view === "week" ? weekCells(p.anchor) : monthGrid(p.anchor);
  const dow = weekdayShort(locale);
  const title = p.view === "month" ? fmtMonth(p.anchor, locale) : p.view === "week" ? `${fmtDayLong(cells[0]!.start, locale)} – ${fmtDayLong(cells[6]!.start, locale)}` : fmtDayLong(dayStart(p.anchor), locale);

  const onKey = (e: React.KeyboardEvent, day: Date) => {
    const next = keyMove(e.key, day);
    if (next) { e.preventDefault(); setFocus(next); queueMicrotask(() => refs.current.get(dayKey(next))?.focus()); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenDay(day); setPicked(null); }
  };

  const dayCell = (c: { start: Date; key: string; inMonth: boolean; isToday: boolean }) => {
    const list = byDay.get(c.key) ?? [];
    return (
      <button key={c.key} type="button" className="ins-day" data-out={!c.inMonth} data-today={c.isToday} data-focus={dayKey(focus) === c.key} tabIndex={dayKey(focus) === c.key ? 0 : -1}
        ref={(el) => { if (el) refs.current.set(c.key, el); else refs.current.delete(c.key); }}
        aria-label={fill(copy.calendar.dayLabel, { day: fmtDayLong(c.start, locale), n: list.length })}
        onFocus={() => setFocus(c.start)} onKeyDown={(e) => onKey(e, c.start)} onClick={() => { setOpenDay(c.start); setPicked(null); }}>
        <span className="ins-daynum">{Number(c.key.slice(8))}</span>
        {list.slice(0, 3).map((r) => <Event key={r.id} row={r} locale={locale} onPick={(x) => { setPicked(x); setOpenDay(null); }} />)}
        {list.length > 3 ? <span className="ins-more" role="presentation">{fill(copy.calendar.more, { n: list.length - 3 })}</span> : null}
      </button>
    );
  };

  const agenda = groupByDay(p.rows);
  const agendaDays = [...agenda.keys()].sort();

  return (
    <section className="ins-cal" aria-label={copy.overview.viewCalendar}>
      <div className="ins-cal-head">
        <div className="ctr-row">
          <button type="button" className="ctr-btn" onClick={() => p.onAnchor(moveAnchor(p.view, p.anchor, -1))} aria-label={copy.calendar.prev}><ChevronLeftIcon aria-hidden="true" /></button>
          <button type="button" className="ctr-btn" onClick={() => p.onAnchor(new Date())}>{copy.calendar.today}</button>
          <button type="button" className="ctr-btn" onClick={() => p.onAnchor(moveAnchor(p.view, p.anchor, 1))} aria-label={copy.calendar.next}><ChevronRightIcon aria-hidden="true" /></button>
          <strong aria-live="polite">{title}</strong>
        </div>
        <div className="ctr-seg" role="group" aria-label={copy.overview.viewCalendar}>
          {(["month", "week", "agenda"] as const).map((v) => <button key={v} type="button" aria-pressed={p.view === v} onClick={() => p.onView(v)}>{copy.calendar[v]}</button>)}
        </div>
      </div>
      <p className="ins-muted">{copy.calendar.timezone}. {copy.calendar.navHint}</p>
      {p.truncated ? <p className="ins-warn" role="status">{copy.calendar.truncated}</p> : null}
      <div className="ins-legend" aria-label={copy.calendar.legend}>{INSPECTION_STATUSES.map((s) => <span key={s} className="ins-evt" data-status={s} style={{ cursor: "default" }}>{copy.status[s]}</span>)}</div>

      {p.view === "month" ? (
        <>
          <div className="ins-cal-grid" role="grid" aria-busy={p.loading}>
            {dow.map((d) => <div key={d} className="ins-cal-dow" role="columnheader">{d}</div>)}
            {cells.map(dayCell)}
          </div>
          <div className="ins-agenda ins-agenda-only"><AgendaList days={agendaDays.filter((k) => cells.some((c) => c.key === k && c.inMonth))} map={agenda} locale={locale} copy={copy} /></div>
        </>
      ) : null}

      {p.view === "week" ? (
        <div className="ins-week">
          {cells.map((c) => {
            const list = byDay.get(c.key) ?? [];
            return (
              <div key={c.key} className="ins-wcol" data-today={c.isToday}>
                <strong>{dow[(cells.indexOf(c))]} {Number(c.key.slice(8))}</strong>
                {list.map((r) => <Event key={r.id} row={r} locale={locale} onPick={(x) => { setPicked(x); setOpenDay(null); }} />)}
                {p.canSchedule ? <button type="button" className="ctr-btn is-ghost" onClick={() => p.onSchedule(c.start)} aria-label={fill(copy.calendar.newOnDay, { day: fmtDayLong(c.start, locale) })}><PlusIcon aria-hidden="true" /></button> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {p.view === "agenda" ? <div className="ins-agenda">{agendaDays.length ? <AgendaList days={agendaDays} map={agenda} locale={locale} copy={copy} /> : <p className="ins-muted">{copy.calendar.noItems}</p>}</div> : null}

      {openDay ? (
        <div className="ins-panel" role="region" aria-label={fmtDayLong(openDay, locale)}>
          <div className="ins-bar"><strong>{fmtDayLong(openDay, locale)}</strong><button type="button" className="ctr-btn is-ghost" onClick={() => setOpenDay(null)}>{copy.common.close}</button></div>
          {(byDay.get(dayKey(openDay)) ?? []).length ? (byDay.get(dayKey(openDay)) ?? []).map((r) => <Event key={r.id} row={r} locale={locale} onPick={(x) => { setPicked(x); setOpenDay(null); }} />) : <p className="ins-muted">{copy.calendar.noItems}</p>}
          {p.canSchedule ? <button type="button" className="ctr-btn is-primary" onClick={() => p.onSchedule(openDay)}><PlusIcon aria-hidden="true" />{fill(copy.calendar.newOnDay, { day: fmtDayLong(openDay, locale) })}</button> : null}
        </div>
      ) : null}

      {picked ? (
        <div className="ins-panel" role="dialog" aria-label={copy.calendar.quick}>
          <div className="ins-bar"><strong>{picked.inspectionNo} · {picked.projectCode}</strong><button type="button" className="ctr-btn is-ghost" onClick={() => setPicked(null)}>{copy.common.close}</button></div>
          <div className="ctr-row"><StatusBadge status={picked.status} overdue={picked.overdue} copy={copy} /><PriorityChip priority={picked.priority} copy={copy} /></div>
          <p className="ins-muted">{picked.projectTitle} · {copy.type[picked.inspectionType]} · {fmtTime(picked.inspectionDate, locale)} · {picked.inspectorName ?? "—"}</p>
          <div className="ctr-row">
            <Link className="ctr-btn is-primary" href={`/inspections/${picked.id}`}>{copy.calendar.openRecord}</Link>
            {p.canReschedule && (picked.status === "SCHEDULED" || picked.status === "IN_PROGRESS") ? <button type="button" className="ctr-btn" onClick={() => p.onReschedule(picked)}>{copy.overview.reschedule}</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AgendaList({ days, map, locale, copy }: { days: string[]; map: Map<string, InspectionRow[]>; locale: AuthLocale; copy: Copy }) {
  return (
    <>
      {days.map((k) => (
        <div key={k} className="ins-agenda-day">
          <h3>{fmtDayLong(addDays(new Date(`${k}T00:00:00.000+05:30`), 0), locale)}</h3>
          {(map.get(k) ?? []).map((r) => (
            <Link key={r.id} href={`/inspections/${r.id}`} className="ins-agenda-row" data-overdue={r.overdue}>
              <strong>{fmtTime(r.inspectionDate, locale)}</strong>
              <span><strong>{r.projectCode ?? r.inspectionNo}</strong> <span className="ins-muted">{r.projectTitle}</span><br /><span className="ins-muted">{copy.type[r.inspectionType]} · {r.inspectorName ?? "—"}</span></span>
              <StatusBadge status={r.status} overdue={r.overdue} copy={copy} />
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
