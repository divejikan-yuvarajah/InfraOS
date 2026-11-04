import { describe, expect, it } from "vitest";

import { featureBounds, filtersParam, searchLoaded, type LayerData } from "./inframap";
import { getInframapCopy } from "./inframap-copy";
import { LAYER_BY_ID, LAYER_DEFS } from "./layer-registry";
import { orderCandidates } from "./selection-priority";

const ID = (n: number) => `6aeb5136a8f6af4a680588${String(n).padStart(2, "0")}`;

describe("InfraMap selection priority", () => {
  it("orders conflicts over roadworks over projects, worst conflict first, and drops duplicates", () => {
    const ordered = orderCandidates([
      { layer: "projects", id: ID(1), title: "Project" },
      { layer: "conflicts", id: ID(2), title: "RSC-2", score: 40 },
      { layer: "roadworks", id: ID(3), title: "Work" },
      { layer: "conflicts", id: ID(4), title: "RSC-4", score: 90 },
      { layer: "roadworks", id: ID(3), title: "Work" },
    ]);
    expect(ordered.map((c) => c.id)).toEqual([ID(4), ID(2), ID(3), ID(1)]);
    expect(orderCandidates([])).toEqual([]);
  });
});

describe("InfraMap geometry, filters and search helpers", () => {
  it("computes bounds for points, lines and polygons and rejects unusable geometry", () => {
    expect(featureBounds({ coordinates: [79.86, 6.93] })).toEqual([[79.86, 6.93], [79.86, 6.93]]);
    expect(featureBounds({ coordinates: [[79.85, 6.92], [79.88, 6.94]] })).toEqual([[79.85, 6.92], [79.88, 6.94]]);
    expect(featureBounds({ coordinates: [[[79, 6], [80, 6], [80, 7], [79, 6]]] })).toEqual([[79, 6], [80, 7]]);
    for (const bad of [null, undefined, {}, { coordinates: [] }, { coordinates: ["a", "b"] }, { coordinates: [200, 0] }]) expect(featureBounds(bad as never), JSON.stringify(bad)).toBeNull();
  });

  it("serialises only active filters, in a stable order", () => {
    expect(filtersParam({})).toBe("");
    expect(filtersParam({ status: undefined, overdue: "1" })).toBe("&overdue=1");
    expect(filtersParam({ status: "ACTIVE", overdue: "1" })).toBe(filtersParam({ overdue: "1", status: "ACTIVE" }));
  });

  it("searches only loaded features of enabled layers", () => {
    const point = { type: "Point", coordinates: [79.9, 6.9] };
    const data: Partial<Record<"projects" | "roadworks" | "conflicts", LayerData>> = {
      projects: { type: "FeatureCollection", truncated: false, features: [{ type: "Feature", geometry: point, properties: { id: ID(1), title: "Galle Road widening", projectCode: "INF-1", district: "Colombo", agencyName: "RDA" } }] },
      roadworks: { type: "FeatureCollection", truncated: false, features: [{ type: "Feature", geometry: point, properties: { id: ID(2), workType: "PIPELINE_INSTALLATION", projectTitle: "Water main", status: "SUBMITTED" } }] },
      conflicts: { type: "FeatureCollection", truncated: false, features: [{ type: "Feature", geometry: point, properties: { id: ID(3), conflictNo: "RSC-2026-000001", status: "open" } }] },
    };
    const on = { projects: true, roadworks: true, conflicts: true };
    expect(searchLoaded(data, on, "galle").map((h) => h.layer)).toEqual(["projects"]);
    expect(searchLoaded(data, on, "pipeline installation").map((h) => h.layer)).toEqual(["roadworks"]);
    expect(searchLoaded(data, on, "RSC-2026").map((h) => h.id)).toEqual([ID(3)]);
    expect(searchLoaded(data, on, "colombo")).toHaveLength(1);
    expect(searchLoaded(data, { ...on, projects: false }, "galle")).toEqual([]);
    expect(searchLoaded(data, on, "g")).toEqual([]);
    expect(searchLoaded(data, on, "zzz")).toEqual([]);
  });
});

describe("InfraMap layer registry and copy", () => {
  it("defines every layer once, in draw order, with its own map layers and filters", () => {
    expect(LAYER_DEFS.map((d) => d.id)).toEqual(["projects", "roadworks", "conflicts"]);
    expect(LAYER_DEFS.map((d) => d.z)).toEqual([...LAYER_DEFS.map((d) => d.z)].sort((a, b) => a - b));
    const ids = LAYER_DEFS.flatMap((d) => d.layerIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of LAYER_DEFS) {
      expect(LAYER_BY_ID[d.id]).toBe(d);
      expect(d.permissionLayerId).toBe(d.id);
      for (const hit of d.interactiveLayerIds) expect(d.layerIds).toContain(hit);
      expect(d.legend.length).toBeGreaterThan(0);
    }
  });

  it("translates the new strings in Sinhala and Tamil", () => {
    const en = getInframapCopy("en");
    for (const locale of ["si", "ta"] as const) {
      const c = getInframapCopy(locale);
      expect(c.toolbar.refresh).not.toBe(en.toolbar.refresh);
      expect(c.more.locked).not.toBe(en.more.locked);
      expect(c.conflict.noGeometry).not.toBe(en.conflict.noGeometry);
      expect(c.more.noLocation).toContain("{n}");
      expect(c.more.truncatedBar).toContain("{n}");
    }
  });
});
