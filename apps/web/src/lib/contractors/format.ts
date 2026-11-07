import type { AuthLocale } from "@/lib/auth/types";

const INTL: Record<AuthLocale, string> = { en: "en-LK", si: "si-LK", ta: "ta-LK" };

/**
 * LKR amounts are integer cents. The whole-rupee part is formatted by Intl and the cents are appended from integer
 * arithmetic, so no float division ever decides a digit (1 999 999 cents is always 19,999.99).
 */
export function formatLkr(amountMinor: number, locale: AuthLocale): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return "—";
  const rupees = Math.floor(amountMinor / 100);
  const cents = String(amountMinor % 100).padStart(2, "0");
  const whole = new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 0, useGrouping: true }).format(rupees);
  return `LKR ${whole}.${cents}`;
}

/** "19,999.99" or "19999.99" to cents using string arithmetic only. Returns null for anything that is not a plain non-negative amount. */
export function parseLkrToMinor(input: string): number | null {
  const clean = input.trim().replace(/,/g, "");
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatDate(iso: string | null | undefined, locale: AuthLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL[locale], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function formatDateTime(iso: string | null | undefined, locale: AuthLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL[locale], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
}

export function relativeTime(iso: string | null | undefined, locale: AuthLocale, now = Date.now()): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return "";
  const rtf = new Intl.RelativeTimeFormat(INTL[locale], { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs < 365 * 86_400_000) return rtf.format(Math.round(diff / (30 * 86_400_000)), "month");
  return rtf.format(Math.round(diff / (365 * 86_400_000)), "year");
}

export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - now) / 86_400_000);
}

export const initialsOf = (name: string): string => {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const letters = (parts.length > 1 ? [parts[0], parts[1]] : [parts[0]]).map((p) => (p ? Array.from(p)[0] ?? "" : "")).join("");
  return letters.toUpperCase() || "?";
};

export const fill = (template: string, params: Record<string, string | number | null | undefined>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));

export const percent = (value: number | null): string => (value === null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}%`);
