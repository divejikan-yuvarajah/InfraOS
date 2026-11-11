import { describe, expect, it } from "vitest";

import { INSPECTION_AI_EN } from "./messages-en";
import { INSPECTION_AI_SI } from "./messages-si";
import { INSPECTION_AI_TA } from "./messages-ta";

function keyPathsWithArrays(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => keyPathsWithArrays(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function flattenStrings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => flattenStrings(v, `${prefix}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => flattenStrings(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("inspection AI dictionary key parity", () => {
  it("matches every key and array length across en, si, and ta with no blank values", () => {
    const enKeys = keyPathsWithArrays(INSPECTION_AI_EN).sort();
    const siKeys = keyPathsWithArrays(INSPECTION_AI_SI).sort();
    const taKeys = keyPathsWithArrays(INSPECTION_AI_TA).sort();
    expect(siKeys).toEqual(enKeys);
    expect(taKeys).toEqual(enKeys);

    for (const dict of [INSPECTION_AI_EN, INSPECTION_AI_SI, INSPECTION_AI_TA]) {
      expect(flattenStrings(dict).every(([, v]) => v.trim().length > 0)).toBe(true);
    }
  });

  it("preserves template placeholders identically across locales", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const enMap = new Map(flattenStrings(INSPECTION_AI_EN));
    for (const [label, dict] of [
      ["si", INSPECTION_AI_SI],
      ["ta", INSPECTION_AI_TA],
    ] as const) {
      for (const [k, v] of flattenStrings(dict)) {
        expect(ph(v), `${label}:${k}`).toBe(ph(enMap.get(k) ?? ""));
      }
    }
  });
});
