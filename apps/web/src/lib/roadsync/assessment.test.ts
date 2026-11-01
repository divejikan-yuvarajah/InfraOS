import { describe, expect, it } from "vitest";

import { BANDS_DESC, clampToBand, conflictOverlayFeatures, fmt, groupByBand, pointAtChainage, riskIndexOf, type AssessmentItem } from "./assessment";
import { factorSentence, getAssessmentCopy, mitigationSentence } from "./assessment-copy";

/** Every key path of a nested copy object, so a missing translation is a test failure, not a blank label. */
function paths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

describe("assessment copy", () => {
  const en = getAssessmentCopy("en");
  it("has the same keys and placeholders in English, Sinhala and Tamil", () => {
    for (const locale of ["si", "ta"] as const) {
      const other = getAssessmentCopy(locale);
      expect(paths(other).sort()).toEqual(paths(en).sort());
      const placeholders = (c: unknown) => paths(c).map((p) => `${p}=${[...String(p.split(".").reduce((o, k) => (o as Record<string, unknown>)[k], c)).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",")}`).sort();
      expect(placeholders(other)).toEqual(placeholders(en));
    }
  });

  it("composes a sentence from a server factor key, code and params, and falls back safely", () => {
    expect(factorSentence(en, { key: "spatial", code: "adjacent", params: { distanceMeters: 18 } })).toBe("Adjacent, 18 m apart");
    expect(factorSentence(en, { key: "temporal", code: "sequence", params: { gapDays: 60 } })).toContain("60 d");
    expect(factorSentence(en, { key: "floor", code: "F1", params: {} })).toContain("F1");
    expect(factorSentence(en, { key: "priorityEmergency", code: "other_agency", params: { involvesOtherAgency: true } })).toMatch(/private/);
    expect(factorSentence(en, { key: "spatial", code: "unknown-code", params: {} })).toBe(en.factor.spatial!.none);
    expect(factorSentence(getAssessmentCopy("si"), { key: "spatial", code: "intersecting", params: {} }).length).toBeGreaterThan(0);
    expect(mitigationSentence(en, { key: "different_shifts", points: -8, params: {} })).toContain("shifts");
  });
});

describe("assessment helpers", () => {
  const item = (id: string, band: AssessmentItem["assessment"]["effective"]["band"], score: number) => ({ candidateId: id, assessment: { effective: { band, score } } }) as unknown as AssessmentItem;

  it("fills placeholders as plain text only", () => {
    expect(fmt("{a} and {b}", { a: 1, b: "<b>x</b>" })).toBe("1 and <b>x</b>");
    expect(fmt("{missing}!", {})).toBe("!");
  });

  it("groups by band from critical to info and omits empty bands", () => {
    const groups = groupByBand([item("a", "low", 30), item("b", "critical", 85), item("c", "low", 25)]);
    expect(groups.map((g) => g.band)).toEqual(["critical", "low"]);
    expect(groups[1]!.items).toHaveLength(2);
    expect(BANDS_DESC[0]).toBe("critical");
  });

  it("mirrors the server Risk Index and clamps an override into its band", () => {
    expect(riskIndexOf([60, 40])).toBe(76);
    expect(riskIndexOf([])).toBe(0);
    expect(clampToBand(85, "low")).toBe(39);
    expect(clampToBand(10, "high")).toBe(60);
    expect(clampToBand(45, "medium")).toBe(45);
  });

  it("places the corridor scrub marker along the line and clamps at the ends", () => {
    const line: [number, number][] = [[79.86, 6.93], [79.87, 6.93]];
    const mid = pointAtChainage(line, 555);
    expect(mid[0]).toBeGreaterThan(79.864);
    expect(mid[0]).toBeLessThan(79.866);
    expect(pointAtChainage(line, 99999)).toEqual(line[1]);
    const features = conflictOverlayFeatures([], { type: "LineString", coordinates: line }, { fromM: 0, toM: 100, score: 50, topCandidateIds: [] }) as { properties: { feature: string } }[];
    expect(features.map((f) => f.properties.feature)).toEqual(["scrub"]);
    expect(conflictOverlayFeatures([], { type: "Point", coordinates: [79.86, 6.93] }, { fromM: 0, toM: 100, score: 50, topCandidateIds: [] })).toEqual([]);
  });
});
