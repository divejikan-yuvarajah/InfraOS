/** Pure form helpers (Step 20). Client UX only — Express remains authoritative. */

const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export function trimToUndefined(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Parse a user-entered LKR amount into integer minor units (cents).
 * Blank is undefined. Does not coerce blank to 0.
 */
export function parseLkrToMinorUnits(raw: string | undefined | null): number | undefined {
  const text = trimToUndefined(raw);
  if (text == null) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter a valid LKR amount with at most two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = (fraction + "00").slice(0, 2);
  const minor = Number(whole) * 100 + Number(cents);
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Amount is too large.");
  }
  return minor;
}

export function isSafeFieldPath(path: string, allowed: ReadonlySet<string>): boolean {
  if (!path || path.length > 120) return false;
  const segments = path.split(/[.[\]]/).filter(Boolean);
  if (segments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) return false;
  return allowed.has(path);
}
