import { createHash } from "node:crypto";
import type { RiskInputs } from "./types.js";

/**
 * Recursively canonicalizes an arbitrary value for stable hashing:
 * - Object keys are sorted alphabetically.
 * - Date objects are converted to YYYY-MM-DD strings.
 * - BigInts are converted to strings.
 * - undefined values are omitted from objects.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    // Check for NaN or Infinity
    if (!Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined) {
        sortedObj[key] = canonicalize(val);
      }
    }
    return sortedObj;
  }

  return String(value);
}

/**
 * Computes deterministic SHA-256 inputsHash from canonicalized inputs and engine version.
 */
export function computeInputsHash(
  inputs: RiskInputs,
  engineVersion: string,
): string {
  const canonical = canonicalize(inputs);
  const payload = JSON.stringify({
    v: engineVersion,
    inputs: canonical,
  });

  return createHash("sha256").update(payload).digest("hex");
}

