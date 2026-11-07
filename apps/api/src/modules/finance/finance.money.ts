/**
 * Integer-only money helpers. LKR cents everywhere; no float ever touches an amount. User text is parsed with string and BigInt arithmetic.
 */
export const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

/** "1250000.50" to 125000050. Plain decimal only: up to 15 integer digits and 2 decimals, positive. Extra decimals are rejected, never rounded. */
export function parseAmountToMinor(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const m = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const minor = BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  if (minor <= 0n || minor > MAX_MINOR) return null;
  return Number(minor);
}

export const isSafeMinor = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/** Exact sum; returns null if it would leave the safe integer range. */
export function sumMinor(values: readonly number[]): number | null {
  let t = 0n;
  for (const v of values) { if (!isSafeMinor(v)) return null; t += BigInt(v); }
  return t > MAX_MINOR ? null : Number(t);
}

/** floor(part * 10000 / whole): basis points, integer math. Null when whole is 0 or the result is unsafe. */
export function ratioBp(part: number, whole: number): number | null {
  if (!isSafeMinor(part) || !isSafeMinor(whole) || whole === 0) return null;
  const bp = (BigInt(part) * 10000n) / BigInt(whole);
  return bp > MAX_MINOR ? null : Number(bp);
}

/** Cents above `whole` (0 when within). */
export const overBy = (value: number, whole: number): number => (value > whole ? Number(BigInt(value) - BigInt(whole)) : 0);

/** Progress percentage (may be decimal, from a progress report) to integer basis points of a percent: 45.5 -> 4550. */
export const pctToBp = (pct: number): number => Math.max(0, Math.min(10000, Math.round(pct * 100)));
