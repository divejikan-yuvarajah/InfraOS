import { describe, expect, it } from "vitest";

import { WORKSPACE_NAV, navCurrent } from "@/components/auth/workspace-nav";

import { bboxParam, countOf, MAX_BBOX_SPAN_DEG, summarize, viewportBbox, type LayerData } from "./inframap";
import { getInframapCopy } from "./inframap-copy";

const ID = "6aeb5136a8f6af4a68058868";

describe("steps 81-84 InfraMap helpers", () => {
  it("turns a map viewport into a box the API accepts", () => {
    expect(viewportBbox(79.4, 5.8, 82.1, 9.95)).toEqual([79.4, 5.8, 82.1, 9.95]);
    for (const bad of [[Number.NaN, 1, 2, 3], [80, 6, 79, 7], [80, 7, 81, 6], [0, 0, 0, 1]] as [number, number, number, number][]) expect(viewportBbox(...bad)).toBeNull();
    const wide = viewportBbox(-179, -80, 179, 80)!;
    expect(wide[2] - wide[0]).toBeLessThanOrEqual(MAX_BBOX_SPAN_DEG);
    expect(wide[3] - wide[1]).toBeLessThanOrEqual(MAX_BBOX_SPAN_DEG);
    expect(viewportBbox(-200, -100, 200, 100)).not.toBeNull();
    const clamped = viewportBbox(-200, 5, -190, 6);
    expect(clamped).toBeNull();
  });

  it("builds a short, stable request parameter", () => {
    expect(bboxParam([79.4, 5.8, 82.1, 9.95])).toBe("79.400,5.800,82.100,9.950");
    expect(bboxParam([79.40001, 5.80001, 82.10001, 9.95001])).toBe(bboxParam([79.4, 5.8, 82.1, 9.95]));
  });

  it("summarises features with real fields and the right deep link, and refuses anything without a valid id", () => {
    expect(summarize("projects", { id: ID, title: "Galle Road", projectCode: "INF-RD-1", status: "ACTIVE" })).toEqual({ layer: "projects", id: ID, title: "Galle Road", subtitle: "INF-RD-1", status: "ACTIVE", href: `/projects/${ID}/overview` });
    expect(summarize("roadworks", { id: ID, projectTitle: "Water main", workType: "PIPELINE_INSTALLATION", status: "SUBMITTED" })?.href).toBe(`/roadsync/work-requests/${ID}`);
    expect(summarize("conflicts", { id: ID, conflictNo: "RSC-2026-000001", score: 73, status: "open" })).toMatchObject({ title: "RSC-2026-000001", subtitle: "73", href: `/roadsync/conflicts/${ID}` });
    expect(summarize("conflicts", { id: ID })?.title).toBe(ID);
    for (const id of [undefined, "", "abc", `${ID}/../x`, "6aeb5136a8f6af4a6805886g", 12]) expect(summarize("projects", { id }), String(id)).toBeNull();
  });

  it("counts only what has loaded", () => {
    const layer: LayerData = { type: "FeatureCollection", truncated: false, features: [] };
    expect(countOf(undefined)).toBeNull();
    expect(countOf(layer)).toBe(0);
  });

  it("has en, si and ta copy with no empty strings and the layer names in every language", () => {
    const walk = (o: unknown, path = ""): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => walk(v, `${path}${k}.`)) : typeof o === "string" && o.trim() === "" ? [path] : []);
    for (const locale of ["en", "si", "ta"] as const) {
      const copy = getInframapCopy(locale);
      expect(walk(copy), locale).toEqual([]);
      expect(Object.keys(copy.layers).sort()).toEqual(["assets", "conflicts", "projects", "risks", "roadworks", "utilities"]);
      expect(Object.keys(copy.panel.open).sort()).toEqual(["conflicts", "projects", "risks", "roadworks"]);
    }
    expect(getInframapCopy("si").layers.projects).not.toBe(getInframapCopy("en").layers.projects);
    expect(getInframapCopy("ta").states.count).toContain("{n}");
  });

  it("is reachable from the staff navigation", () => {
    const items = WORKSPACE_NAV.flatMap((g) => g.items);
    expect(items.some((i) => i.href === "/inframap" && i.label === "InfraMap")).toBe(true);
    expect(navCurrent("/inframap", "/inframap")).toBe(true);
    expect(navCurrent("/roadsync/conflicts", "/inframap")).toBe(false);
  });
});
