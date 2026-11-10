/**
 * Integer money & ratio math using BigInt basis points (bps).
 *
 * 10,000 bps = 100.00%
 * 100 bps = 1.00%
 *
 * Floating-point arithmetic on currency amounts is strictly prohibited.
 */

export const BPS_ONE_HUNDRED_PERCENT = 10000n;
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Start of Asia/Colombo calendar day as a UTC Date instant. */
export function colomboDayStart(date: Date): Date {
  const local = new Date(date.getTime() + COLOMBO_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(start - COLOMBO_OFFSET_MS);
}

/** Difference in whole calendar days between two dates in Asia/Colombo. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const startFrom = colomboDayStart(from).getTime();
  const startTo = colomboDayStart(to).getTime();
  return Math.round((startTo - startFrom) / MS_PER_DAY);
}

/** Converts number | bigint minor units to a validated non-negative BigInt. */
export function toBigIntMinor(val: number | bigint | null | undefined): bigint {
  if (val === null || val === undefined) return 0n;
  if (typeof val === "bigint") return val < 0n ? 0n : val;
  if (typeof val === "number") {
    if (!Number.isFinite(val) || val <= 0) return 0n;
    return BigInt(Math.floor(val));
  }
  return 0n;
}

/** Computes ratio in basis points (10000 = 100%). Returns integer bps. */
export function ratioBps(numerator: bigint | number, denominator: bigint | number): number {
  const num = toBigIntMinor(numerator);
  const den = toBigIntMinor(denominator);
  if (den === 0n) return 0;
  const bps = (num * BPS_ONE_HUNDRED_PERCENT) / den;
  return Number(bps > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : bps);
}

export const calculateRatioBps = ratioBps;

/** Converts basis points to whole or decimal percentage (e.g. 2550 bps -> 25.5%). */
export function bpsToPercentage(bps: number): number {
  return Math.round((bps / 100) * 10) / 10;
}

/** Clamps a number between min and max. */
export function clamp(val: number, min: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}
