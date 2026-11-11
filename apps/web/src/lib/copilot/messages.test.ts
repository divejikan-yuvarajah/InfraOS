import { describe, expect, it } from "vitest";

import { aiAdminKeyPaths } from "@/lib/ai-admin/messages";

import { COPILOT_EN } from "./messages-en";
import { COPILOT_SI } from "./messages-si";
import { COPILOT_TA } from "./messages-ta";

function flattenStrings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => flattenStrings(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("copilot dictionary key parity", () => {
  it("matches every key across en, si, and ta with no blank values", () => {
    const enKeys = aiAdminKeyPaths(COPILOT_EN).sort();
    const siKeys = aiAdminKeyPaths(COPILOT_SI).sort();
    const taKeys = aiAdminKeyPaths(COPILOT_TA).sort();
    expect(siKeys).toEqual(enKeys);
    expect(taKeys).toEqual(enKeys);

    for (const dict of [COPILOT_EN, COPILOT_SI, COPILOT_TA]) {
      const entries = flattenStrings(dict);
      expect(entries.every(([, val]) => val.trim().length > 0)).toBe(true);
    }
  });

  it("preserves template placeholders identically across locales", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const enMap = new Map(flattenStrings(COPILOT_EN));
    for (const [label, dict] of [
      ["si", COPILOT_SI],
      ["ta", COPILOT_TA],
    ] as const) {
      for (const [k, v] of flattenStrings(dict)) {
        expect(ph(v), `${label}:${k}`).toBe(ph(enMap.get(k) ?? ""));
      }
    }
  });
});
