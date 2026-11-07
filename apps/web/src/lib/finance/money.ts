import type { AuthLocale } from "@/lib/auth/types";

/**
 * Integer-only money for the browser. The model is a plain decimal STRING while typing; it becomes integer cents only through string and BigInt
 * arithmetic. No parseFloat, no multiplication by 100, no rounding: input the server would reject is rejected here first.
 */
const INTL: Record<AuthLocale, string> = { en: "en-LK", si: "si-LK", ta: "ta-LK" };
export const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export type AmountParse = { ok: true; minor: number; canonical: string } | { ok: false; reason: "empty" | "format" | "decimals" | "digits" | "zero" | "range" };

/** "1,250,000.5" -> { minor: 125000050, canonical: "1250000.50" }. Accepts thousands separators; rejects negatives, 3+ decimals, > 15 integer digits, zero. */
export function parseAmount(input: string): AmountParse {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };
  const clean = raw.replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(clean) || clean === "." || /^,|,$|,,|\.,|,\./.test(raw)) return { ok: false, reason: "format" };
  const [intPart = "", frac = ""] = clean.split(".");
  if (frac.length > 2) return { ok: false, reason: "decimals" };
  const digits = intPart.replace(/^0+(?=\d)/, "");
  if (digits.length > 15) return { ok: false, reason: "digits" };
  const minor = BigInt(digits || "0") * BigInt(100) + BigInt(frac.padEnd(2, "0") || "0");
  if (minor === BigInt(0)) return { ok: false, reason: "zero" };
  if (minor > MAX_MINOR) return { ok: false, reason: "range" };
  return { ok: true, minor: Number(minor), canonical: `${digits || "0"}.${frac.padEnd(2, "0")}` };
}

/** Cents to the API's decimal string: 125000050 -> "1250000.50". */
export const minorToDecimal = (minor: number): string => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;

const group = (n: number | bigint, locale: AuthLocale) => new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 0 }).format(n);

/** "Rs. 12,450,000.00": whole rupees through Intl, cents from integer arithmetic. */
export function formatLkr(minor: number, locale: AuthLocale): string {
  if (!Number.isSafeInteger(minor) || minor < 0) return "—";
  return `Rs. ${group(Math.floor(minor / 100), locale)}.${String(minor % 100).padStart(2, "0")}`;
}

/** Whole rupees and cents split so the cents can be de-emphasised in the UI. */
export function splitLkr(minor: number, locale: AuthLocale): { prefix: string; whole: string; cents: string } {
  return { prefix: "Rs.", whole: Number.isSafeInteger(minor) && minor >= 0 ? group(Math.floor(minor / 100), locale) : "—", cents: Number.isSafeInteger(minor) && minor >= 0 ? String(minor % 100).padStart(2, "0") : "" };
}

/** "Rs. 12.45 Mn" for KPI tiles. Integer division with two decimals; the exact value belongs in a tooltip. Units are passed in so they can be translated. */
export function formatLkrCompact(minor: number, locale: AuthLocale, units: { k: string; mn: string; bn: string }): string {
  if (!Number.isSafeInteger(minor) || minor < 0) return "—";
  const rupees = BigInt(Math.floor(minor / 100));
  const pick = (div: bigint, unit: string) => { const hundredths = (rupees * BigInt(100)) / div; return `Rs. ${group(hundredths / BigInt(100), locale)}.${String(hundredths % BigInt(100)).padStart(2, "0")} ${unit}`; };
  if (rupees >= BigInt(1000000000)) return pick(BigInt(1000000000), units.bn);
  if (rupees >= BigInt(1000000)) return pick(BigInt(1000000), units.mn);
  if (rupees >= BigInt(100000)) return pick(BigInt(1000), units.k);
  return formatLkr(minor, locale);
}

/** Basis points to a percentage string, integer maths: 8333 -> "83.33%", 5000 -> "50%". Null is "—", never 0. */
export function percentFromBp(bp: number | null | undefined): string {
  if (bp === null || bp === undefined || !Number.isFinite(bp)) return "—";
  const whole = Math.trunc(bp / 100), frac = Math.abs(bp % 100);
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}%`;
}

/** Tenths of a percentage point (125 -> "+12.5 pp"). */
export const ppFromTenths = (t: number | null): string => (t === null ? "—" : `${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.floor(Math.abs(t) / 10)}.${Math.abs(t) % 10} pp`);

export const hundredthsToIndex = (h: number): string => `${Math.floor(h / 100)}.${String(h % 100).padStart(2, "0")}`;
