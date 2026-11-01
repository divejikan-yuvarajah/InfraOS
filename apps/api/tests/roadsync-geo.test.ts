import { describe, expect, it } from "vitest";

import { validateWorkGeometry } from "../src/modules/roadsync/geo.service.js";

describe("step 67 geometry validation", () => {
  it("accepts a valid line and computes length within tolerance", () => {
    // 0.01 degree of longitude at 6.93 N is about 1,104 m.
    const r = validateWorkGeometry({ type: "LineString", coordinates: [[79.86, 6.93], [79.86, 6.93], [79.87, 6.93]] });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.geometry.coordinates).toHaveLength(2);
    expect(r.warnings).toHaveLength(1);
    expect(r.derived.lengthMeters).toBeGreaterThan(1090);
    expect(r.derived.lengthMeters).toBeLessThan(1120);
  });

  it("closes, re-winds counter-clockwise and measures a polygon", () => {
    const cw = [[79.86, 6.93], [79.86, 6.931], [79.861, 6.931], [79.861, 6.93]];
    const r = validateWorkGeometry({ type: "Polygon", coordinates: [cw] });
    expect(r.valid).toBe(true);
    if (!r.valid || r.geometry.type !== "Polygon") return;
    const ring = r.geometry.coordinates[0]!;
    expect(ring).toHaveLength(5);
    expect(ring[1]).toEqual([79.861, 6.93]);
    // About 110 m x 110 m.
    expect(r.derived.areaSqMeters).toBeGreaterThan(11_000);
    expect(r.derived.areaSqMeters).toBeLessThan(13_000);
  });

  it("rejects holes, too-short lines, tiny areas and too many vertices", () => {
    const sq = [[79.86, 6.93], [79.861, 6.93], [79.861, 6.931], [79.86, 6.931], [79.86, 6.93]];
    const code = (g: unknown) => { const r = validateWorkGeometry(g); return r.valid ? "ok" : r.errors[0]!.code; };
    expect(code({ type: "Polygon", coordinates: [sq, sq] })).toBe("HOLES_NOT_SUPPORTED");
    expect(code({ type: "LineString", coordinates: [[79.86, 6.93], [79.86001, 6.93]] })).toBe("LINE_TOO_SHORT");
    expect(code({ type: "Polygon", coordinates: [[[79.86, 6.93], [79.86001, 6.93], [79.86001, 6.93001], [79.86, 6.93]]] })).toBe("AREA_TOO_SMALL");
    expect(code({ type: "LineString", coordinates: Array.from({ length: 600 }, (_, i) => [79.86 + i * 1e-4, 6.93]) })).toBe("TOO_MANY_VERTICES");
    expect(code({ type: "MultiPolygon", coordinates: [] })).toBe("UNSUPPORTED_TYPE");
  });
});
