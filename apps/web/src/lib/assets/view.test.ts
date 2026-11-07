import { describe, expect, it } from "vitest";

import { isPrivatePath, classifyAppPath } from "@/lib/auth/route-access";

import { assetApiQuery, assetParams, CONDITION_FILL, DEFAULT_ASSET_FILTERS, donutSlices, fill, gaugeArc, maintApiQuery, maintParams, parseAssetFilters, parseMaintFilters, reasonOk } from "./view";

describe("asset view helpers", () => {
  it("never fills the ring for an unknown condition", () => {
    expect(CONDITION_FILL.UNKNOWN).toBe(0);
    expect(CONDITION_FILL.EXCELLENT).toBe(5);
  });
  it("round-trips list filters through the URL and drops defaults", () => {
    const f = { ...DEFAULT_ASSET_FILTERS, assetType: "BRIDGE", attention: true, sort: "health", page: 3 };
    const params = assetParams(f);
    expect(params.toString()).toBe("assetType=BRIDGE&attention=true&sort=health&page=3");
    expect(parseAssetFilters((k) => params.get(k))).toEqual(f);
    expect(assetParams(DEFAULT_ASSET_FILTERS).toString()).toBe("");
    expect(assetApiQuery(DEFAULT_ASSET_FILTERS, 20)).toMatchObject({ sort: "recent", page: 1, limit: 20, q: undefined });
  });
  it("sanitises hostile URL values", () => {
    const f = parseAssetFilters((k) => ({ sort: "drop table", page: "-5", q: "x".repeat(500) })[k as "sort" | "page" | "q"] ?? null);
    expect(f.sort).toBe("recent");
    expect(f.page).toBe(1);
    expect(f.q.length).toBe(80);
  });
  it("round-trips maintenance filters", () => {
    const p = maintParams({ ...parseMaintFilters(() => null), status: "REQUESTED", overdue: true });
    expect(p.toString()).toBe("status=REQUESTED&overdue=true");
    expect(maintApiQuery(parseMaintFilters((k) => p.get(k)))).toMatchObject({ status: "REQUESTED", overdue: true, sort: "date_asc" });
  });
  it("builds gauge arcs and donut slices that sum to the whole", () => {
    expect(gaugeArc(0).value).toBe("");
    expect(gaugeArc(60).value).toContain("A 52 52");
    const slices = donutSlices([{ key: "a", n: 1 }, { key: "b", n: 3 }, { key: "c", n: 0 }]);
    expect(slices).toHaveLength(2);
    expect(slices.map((s) => Number(s.dash.split(" ")[0]))).toEqual([25, 75]);
  });
  it("fills templates and enforces the reason length", () => {
    expect(fill("{n} of {total}", { n: 2, total: 5 })).toBe("2 of 5");
    expect(reasonOk("short")).toBe(false);
    expect(reasonOk("a long enough reason")).toBe(true);
  });
  it("treats maintenance and insights as signed-in areas, not public", () => {
    expect(isPrivatePath("/maintenance")).toBe(true);
    expect(isPrivatePath("/insights/coordination")).toBe(true);
    expect(isPrivatePath("/assets/conversions")).toBe(true);
    expect(classifyAppPath("/maintenance")).toBe("private");
  });
});
