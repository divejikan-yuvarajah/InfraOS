import { normaliseForMatch } from "./text.js";

/** Deterministic normalisation of text the model copied from a document. Ambiguity is reported, never guessed. */
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthIndex = (name: string): number => {
  const n = name.toLowerCase().replace(/\.$/, "");
  const i = MONTH_NAMES.findIndex((m) => m === n || m.startsWith(n) && n.length >= 3);
  return i < 0 ? -1 : i + 1;
};
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function validDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

export type DateParse = { kind: "DATE"; iso: string } | { kind: "AMBIGUOUS"; readings: string[] } | { kind: "NONE" };

export function parseDate(raw: string): DateParse {
  const s = normaliseForMatch(raw).replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1");
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (m) { const iso = validDate(+m[1]!, +m[2]!, +m[3]!); return iso ? { kind: "DATE", iso } : { kind: "NONE" }; }
  m = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(s);
  if (m && monthIndex(m[2]!) > 0) { const iso = validDate(+m[3]!, monthIndex(m[2]!), +m[1]!); return iso ? { kind: "DATE", iso } : { kind: "NONE" }; }
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(s);
  if (m && monthIndex(m[1]!) > 0) { const iso = validDate(+m[3]!, monthIndex(m[1]!), +m[2]!); return iso ? { kind: "DATE", iso } : { kind: "NONE" }; }
  m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(s);
  if (m) {
    const a = +m[1]!; const b = +m[2]!; const y = +m[3]!;
    const dmy = validDate(y, b, a); // DD/MM/YYYY (the local convention)
    const mdy = validDate(y, a, b);
    if (dmy && mdy && dmy !== mdy) return { kind: "AMBIGUOUS", readings: [dmy, mdy] };
    const only = dmy ?? mdy;
    return only ? { kind: "DATE", iso: only } : { kind: "NONE" };
  }
  return { kind: "NONE" };
}

export type MoneyParse = { kind: "MONEY"; amountMinor: number; currency: "LKR" | "USD" } | { kind: "NONE" };
const CURRENCY = /(LKR|Rs\.?|රු\.?|USD|US\$|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)/gi;
/** Only an unambiguous single amount with an explicit currency is parsed; words such as "million" or several amounts keep the raw text. */
export function parseMoney(raw: string): MoneyParse {
  const s = normaliseForMatch(raw);
  if (/\b(?:million|billion|mn|bn|lakh|crore)\b/i.test(s)) return { kind: "NONE" };
  const found = [...s.matchAll(CURRENCY)];
  if (found.length !== 1) return { kind: "NONE" };
  const cur = /usd|us\$|\$/i.test(found[0]![1]!) ? "USD" : "LKR";
  const [whole, frac = ""] = found[0]![2]!.replace(/,/g, "").split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(minor) ? { kind: "MONEY", amountMinor: minor, currency: cur } : { kind: "NONE" };
}

export type PercentParse = { kind: "PERCENT"; value: string } | { kind: "NONE" };
export function parsePercent(raw: string): PercentParse {
  const found = [...normaliseForMatch(raw).matchAll(/(\d+(?:\.\d+)?)\s?(?:%|per\s?cent|percent)/gi)];
  return found.length === 1 ? { kind: "PERCENT", value: found[0]![1]! } : { kind: "NONE" };
}

export type DurationParse = { kind: "DURATION"; value: number; unit: "DAY" | "WEEK" | "MONTH" | "YEAR" } | { kind: "NONE" };
export function parseDuration(raw: string): DurationParse {
  const found = [...normaliseForMatch(raw).matchAll(/(\d+)\s?(?:calendar\s+|working\s+)?(day|week|month|year)s?\b/gi)];
  return found.length === 1 ? { kind: "DURATION", value: Number(found[0]![1]), unit: found[0]![2]!.toUpperCase() as "DAY" | "WEEK" | "MONTH" | "YEAR" } : { kind: "NONE" };
}

export type TypedValue =
  | { type: "STRING"; text: string } | { type: "DATE"; iso: string } | { type: "MONEY"; amountMinor: number; currency: string } | { type: "PERCENT"; value: string }
  | { type: "DURATION"; value: number; unit: string };
export type Normalised = { typed: TypedValue | null; ambiguous: boolean; readings?: string[] };

/** Typed value for one field. `typed:null` means the text could not be parsed unambiguously (the raw text is kept for review). */
export function normaliseValue(type: string, raw: string): Normalised {
  const text = normaliseForMatch(raw);
  switch (type) {
    case "DATE": { const d = parseDate(text); return d.kind === "DATE" ? { typed: { type: "DATE", iso: d.iso }, ambiguous: false } : d.kind === "AMBIGUOUS" ? { typed: null, ambiguous: true, readings: d.readings } : { typed: null, ambiguous: false }; }
    case "MONEY": { const m = parseMoney(text); return m.kind === "MONEY" ? { typed: { type: "MONEY", amountMinor: m.amountMinor, currency: m.currency }, ambiguous: false } : { typed: null, ambiguous: false }; }
    case "PERCENT": { const p = parsePercent(text); return p.kind === "PERCENT" ? { typed: { type: "PERCENT", value: p.value }, ambiguous: false } : { typed: null, ambiguous: false }; }
    case "DURATION": { const d = parseDuration(text); return d.kind === "DURATION" ? { typed: { type: "DURATION", value: d.value, unit: d.unit }, ambiguous: false } : { typed: null, ambiguous: false }; }
    default: return { typed: { type: "STRING", text }, ambiguous: false };
  }
}
