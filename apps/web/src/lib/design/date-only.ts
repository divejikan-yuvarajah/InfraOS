/**
 * Calendar date-only wire format (local civil date, not UTC midnight).
 * API timestamps with timezone are handled separately in feature steps.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateOnlyString = string;

export function isDateOnlyString(value: string): value is DateOnlyString {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Format a local Date as YYYY-MM-DD (no timezone shift). */
export function formatDateOnly(date: Date): DateOnlyString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD to local Date at noon to avoid DST edge cases in display. */
export function parseDateOnly(value: DateOnlyString): Date | undefined {
  if (!isDateOnlyString(value)) return undefined;
  const [, y, m, d] = DATE_ONLY_PATTERN.exec(value)!;
  return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
}
