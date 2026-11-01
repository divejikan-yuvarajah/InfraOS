import { describe, expect, it } from "vitest";

import { analyzeSchedules, colomboDay, type ScheduleSide } from "../src/modules/roadsync/schedule.analysis.js";
import { analyzeSpatial } from "../src/modules/roadsync/spatial.analysis.js";
import { pairRef } from "../src/modules/roadsync/detection.service.js";

const line = (coordinates: number[][]) => ({ type: "LineString", coordinates });
const side = (geometry: { type: string; coordinates: unknown }, bufferMeters = 0) => ({ geometry, bufferMeters });
// 0.0001 deg latitude is about 11.12 m; 0.0001 deg longitude at 6.93 N is about 11.04 m.
const A = line([[79.86, 6.93], [79.87, 6.93]]);

describe("step 68 spatial analysis", () => {
  it("crossing lines intersect at distance 0", () => {
    const r = analyzeSpatial(side(A), side(line([[79.865, 6.925], [79.865, 6.935]])));
    expect(r.relation).toBe("intersecting");
    expect(r.distanceMeters).toBe(0);
  });
  it("parallel lines about 29 m apart with 15 m + 15 m buffers have overlapping footprints", () => {
    const r = analyzeSpatial(side(A, 15), side(line([[79.86, 6.93026], [79.87, 6.93026]]), 15));
    expect(r.relation).toBe("footprint_overlap");
    expect(r.intersects).toBe(false);
  });
  it("lines about 120 m apart are nearby, with closest points", () => {
    const r = analyzeSpatial(side(A), side(line([[79.86, 6.93108], [79.87, 6.93108]])));
    expect(r.relation).toBe("nearby");
    expect(r.distanceMeters).toBeGreaterThan(118);
    expect(r.distanceMeters).toBeLessThan(122);
    expect(r.closestPoints).toHaveLength(2);
  });
  it("point to polygon edge distance is within 1 m", () => {
    const polygon = { type: "Polygon", coordinates: [[[79.86, 6.93], [79.861, 6.93], [79.861, 6.931], [79.86, 6.931], [79.86, 6.93]]] };
    const r = analyzeSpatial(side({ type: "Point", coordinates: [79.861 + 20 / 110_400, 6.9305] }), side(polygon));
    expect(Math.abs(r.distanceMeters - 20)).toBeLessThan(1);
    expect(analyzeSpatial(side({ type: "Point", coordinates: [79.8605, 6.9305] }), side(polygon)).relation).toBe("intersecting");
  });
  it("measures an approximate shared corridor for collinear overlapping segments", () => {
    // Overlap is 0.001 deg (about 110 m); the 10 m minimum footprint adds about 10 m.
    const r = analyzeSpatial(side(line([[79.86, 6.93], [79.862, 6.93]])), side(line([[79.861, 6.93], [79.863, 6.93]])));
    expect(r.sharedLengthMeters).toBeGreaterThan(100);
    expect(r.sharedLengthMeters).toBeLessThan(125);
    expect(r.sharedPctOfA).toBeGreaterThan(0.45);
  });
  it("far apart items have no relation", () => {
    expect(analyzeSpatial(side(A), side(line([[79.86, 6.94], [79.87, 6.94]]))).relation).toBe("none");
  });
});

const sched = (start: string, end: string, extra: Partial<ScheduleSide> = {}): ScheduleSide => ({
  start: new Date(`${start}T09:00:00+05:30`), end: new Date(`${end}T17:00:00+05:30`), workingHours: "day", flexibleDays: 0, isEmergency: false, ...extra,
});

describe("step 69 schedule analysis", () => {
  it("counts inclusive overlap days and percentages, with hand-computed shift advice", () => {
    const r = analyzeSchedules(sched("2026-01-10", "2026-01-20", { flexibleDays: 10 }), sched("2026-01-15", "2026-01-25"));
    expect(r.relation).toBe("partial_overlap");
    expect(r.overlapDays).toBe(6);
    expect([r.overlapStart, r.overlapEnd]).toEqual(["2026-01-15", "2026-01-20"]);
    expect(r.overlapPctOfA).toBe(0.55);
    expect(r.shift!.a).toMatchObject({ daysToClearAfter: 16, daysToClearBefore: 6, effectiveFlex: 10, resolvable: true });
    expect(r.shift!.b).toMatchObject({ daysToClearAfter: 6, daysToClearBefore: 16, effectiveFlex: 0, resolvable: false });
  });
  it("detects containment side, identical ranges and adjacency", () => {
    expect(analyzeSchedules(sched("2026-01-01", "2026-01-31"), sched("2026-01-10", "2026-01-12"))).toMatchObject({ relation: "contained", containedBy: "a" });
    expect(analyzeSchedules(sched("2026-01-10", "2026-01-12"), sched("2026-01-01", "2026-01-31"))).toMatchObject({ relation: "contained", containedBy: "b" });
    expect(analyzeSchedules(sched("2026-01-10", "2026-01-12"), sched("2026-01-10", "2026-01-12")).relation).toBe("identical");
    expect(analyzeSchedules(sched("2026-01-01", "2026-01-10"), sched("2026-01-14", "2026-01-20"))).toMatchObject({ relation: "adjacent", gapDays: 4, overlapDays: 0 });
    expect(analyzeSchedules(sched("2026-01-01", "2026-01-10"), sched("2026-01-18", "2026-01-20")).relation).toBe("none");
  });
  it("handles leap-year month boundaries and Colombo dates", () => {
    expect(analyzeSchedules(sched("2028-02-28", "2028-03-01"), sched("2028-03-01", "2028-03-03")).overlapDays).toBe(1);
    // 19:00 UTC on 11 Jan is already 12 Jan in Colombo.
    expect(colomboDay(new Date("2026-01-11T19:00:00Z"))).toBe(colomboDay(new Date("2026-01-12T05:00:00+05:30")));
  });
  it("reports different shifts without dropping the pair, and zero flexibility for emergencies", () => {
    const r = analyzeSchedules(sched("2026-01-10", "2026-01-20", { flexibleDays: 30, isEmergency: true }), sched("2026-01-15", "2026-01-25", { workingHours: "night" }));
    expect(r.hoursCompatibility).toBe("different_shifts");
    expect(r.relation).toBe("partial_overlap");
    expect(r.shift!.a.effectiveFlex).toBe(0);
  });
});

describe("pair reference", () => {
  it("orders work request pairs canonically", () => {
    expect(pairRef("b", "a")).toEqual({ a: "a", b: "b", swapped: true });
    expect(pairRef("a", "b")).toEqual({ a: "a", b: "b", swapped: false });
  });
});
