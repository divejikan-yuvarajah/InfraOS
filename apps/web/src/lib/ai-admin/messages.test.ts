import { describe, expect, it } from "vitest";

import { AI_ADMIN_COPY, aiAdminKeyPaths } from "./messages";

describe("ai-admin i18n parity", () => {
  it("keeps identical key trees across en, si, and ta with no blank values", () => {
    const en = aiAdminKeyPaths(AI_ADMIN_COPY.en).sort();
    expect(aiAdminKeyPaths(AI_ADMIN_COPY.si).sort()).toEqual(en);
    expect(aiAdminKeyPaths(AI_ADMIN_COPY.ta).sort()).toEqual(en);

    const walk = (v: unknown): string[] =>
      typeof v === "string"
        ? [v]
        : v && typeof v === "object"
          ? Object.values(v).flatMap(walk)
          : [];
    for (const l of ["en", "si", "ta"] as const) {
      expect(walk(AI_ADMIN_COPY[l]).every((s) => s.trim().length > 0)).toBe(true);
    }
  });

  it("preserves template placeholders identically across locales", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const flat = (v: unknown, p = ""): [string, string][] =>
      typeof v === "string"
        ? [[p, v]]
        : v && typeof v === "object"
          ? Object.entries(v).flatMap(([k, x]) => flat(x, p ? `${p}.${k}` : k))
          : [];
    const enMap = new Map(flat(AI_ADMIN_COPY.en));
    for (const l of ["si", "ta"] as const) {
      for (const [k, v] of flat(AI_ADMIN_COPY[l])) {
        expect(ph(v), `${l}:${k}`).toBe(ph(enMap.get(k) ?? ""));
      }
    }
  });
});

