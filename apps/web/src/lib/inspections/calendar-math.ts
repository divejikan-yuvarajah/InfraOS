/** Calendar maths in Asia/Colombo (UTC+5:30, no daylight saving). All instants stay real UTC `Date`s; only day boundaries are shifted. */
const OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export type CalendarView = "month" | "week" | "agenda";
export type Cell = { start: Date; key: string; inMonth: boolean; isToday: boolean };

const shifted = (d: Date) => new Date(d.getTime() + OFFSET_MS);
/** yyyy-mm-dd of the Colombo calendar day containing `d`. */
export const dayKey = (d: Date): string => shifted(d).toISOString().slice(0, 10);
export const dayStart = (d: Date): Date => { const s = shifted(d); s.setUTCHours(0, 0, 0, 0); return new Date(s.getTime() - OFFSET_MS); };
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
/** Monday-first weekday index (0 = Monday) of the Colombo day. */
export const weekdayIndex = (d: Date): number => (shifted(d).getUTCDay() + 6) % 7;
export const startOfWeek = (d: Date): Date => addDays(dayStart(d), -weekdayIndex(d));
export const monthOf = (d: Date): { year: number; month: number } => { const s = shifted(d); return { year: s.getUTCFullYear(), month: s.getUTCMonth() }; };
export const firstOfMonth = (year: number, month: number): Date => new Date(Date.UTC(year, month, 1) - OFFSET_MS);
export const shiftMonth = (d: Date, delta: number): Date => { const { year, month } = monthOf(d); return firstOfMonth(year, month + delta); };

/** Six Monday-first weeks covering the month, always 42 cells so the grid never jumps in height. */
export function monthGrid(anchor: Date, now: Date = new Date()): Cell[] {
  const { year, month } = monthOf(anchor);
  const first = firstOfMonth(year, month);
  const gridStart = startOfWeek(first);
  const today = dayKey(now);
  return Array.from({ length: 42 }, (_, i) => {
    const start = addDays(gridStart, i);
    return { start, key: dayKey(start), inMonth: monthOf(start).month === month, isToday: dayKey(start) === today };
  });
}
export function weekCells(anchor: Date, now: Date = new Date()): Cell[] {
  const start = startOfWeek(anchor);
  const today = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => { const s = addDays(start, i); return { start: s, key: dayKey(s), inMonth: true, isToday: dayKey(s) === today }; });
}

/** The API window (≤ 62 days) that covers what the view shows. */
export function windowFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "month") { const g = monthGrid(anchor); return { from: g[0]!.start, to: addDays(g[41]!.start, 1) }; }
  if (view === "week") { const s = startOfWeek(anchor); return { from: s, to: addDays(s, 7) }; }
  const s = dayStart(anchor);
  return { from: s, to: addDays(s, 30) };
}

export function groupByDay<T extends { inspectionDate: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of [...rows].sort((a, b) => a.inspectionDate.localeCompare(b.inspectionDate))) {
    const k = dayKey(new Date(r.inspectionDate));
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return map;
}

export const moveAnchor = (view: CalendarView, anchor: Date, dir: -1 | 1): Date => (view === "month" ? shiftMonth(anchor, dir) : addDays(anchor, dir * (view === "week" ? 7 : 30)));

/** Arrow-key navigation on the day grid: ±1 day, ±7 days. */
export function keyMove(key: string, day: Date): Date | null {
  switch (key) {
    case "ArrowLeft": return addDays(day, -1);
    case "ArrowRight": return addDays(day, 1);
    case "ArrowUp": return addDays(day, -7);
    case "ArrowDown": return addDays(day, 7);
    default: return null;
  }
}

/** yyyy-mm-dd + HH:mm in Colombo local time to a UTC ISO instant (for the schedule form). */
export function colomboToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const t = new Date(`${date}T${time}:00.000Z`).getTime() - OFFSET_MS;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export const isoToColomboParts = (iso: string): { date: string; time: string } => { const s = shifted(new Date(iso)).toISOString(); return { date: s.slice(0, 10), time: s.slice(11, 16) }; };
