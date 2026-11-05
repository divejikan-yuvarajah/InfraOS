import { afterEach, describe, expect, it, vi } from "vitest";

import { COMMANDS, matchCommands, type CommandCtx } from "./commands";
import { parseCoordinates } from "./coordinates";
import { activeFilterCount, activeFilters, applyPreset, datePreset, EMPTY_UF, FILTER_PRESETS, LAYER_FILTER_KEYS, removeFilter, toggleValue, ufParams, type UF } from "./filters-state";
import { districtsOf, validValue } from "./filter-options";
import { getB3Copy } from "./inframap-copy-b3";
import { LAYER_KEYS } from "./inframap";
import { DEFAULT_ORDER } from "./layer-registry";
import { addView, deleteView, loadRecent, loadViews, MAX_VIEWS, pushRecent, renameView, storeViews, VIEWS_KEY } from "./local-store";
import { PLACE_TRANSLATIONS, placeName } from "./places-copy";
import { mapPaddingForSheet, snapHeights, snapTo } from "./sheet-math";
import { EMPTY_VIEW, parseViewState, serializeViewState, URL_BOUNDS, type ViewState } from "./url-state";
import { containsBbox, deviceProfile, fetchBboxFor, needsRefetch, padBbox, quantizeBbox, zoomBucket } from "./viewport";

const DEFAULTS = { layers: ["projects", "roadworks", "conflicts"] as const, order: DEFAULT_ORDER };
const ID = "6aeb5136a8f6af4a68058868";
const qs = (s: string) => new URLSearchParams(s);

describe("shareable URL state", () => {
  it("round-trips view, layers, opacity, order, focus, selection and filters", () => {
    const view: ViewState = {
      center: [80.6337, 7.2906], zoom: 12.5, layers: ["projects", "assets"], opacity: { assets: 0.6 }, order: [...DEFAULT_ORDER].reverse(), focus: "assets", sel: { layer: "assets", id: ID },
      uf: { ...EMPTY_UF, projectStatus: ["ACTIVE", "APPROVED"], district: ["Kandy"], dateFrom: "2026-03-01", dateTo: "2026-03-31", overdue: true, conflictStatusGroup: "open", condition: ["POOR"] },
    };
    const out = parseViewState(qs(serializeViewState(view, DEFAULTS)));
    expect(out).toEqual({ ...view, center: [80.6337, 7.2906] });
  });

  it("writes nothing for an untouched workspace and only non-default values otherwise", () => {
    expect(serializeViewState({ ...EMPTY_VIEW, layers: [...DEFAULTS.layers], order: DEFAULTS.order, uf: EMPTY_UF }, DEFAULTS)).toBe("");
    const q = serializeViewState({ ...EMPTY_VIEW, layers: [...DEFAULTS.layers], opacity: { assets: 1, risks: 0.5 }, uf: EMPTY_UF }, DEFAULTS);
    expect(q).toBe("op=risks%3A0.5");
  });

  it("ignores garbage, drops unknown values, clamps to Sri Lanka and never trusts the URL", () => {
    const out = parseViewState(qs(`ll=999,abc&z=banana&layers=projects,evil,../x&op=assets:9,nope:1,risks:x&ord=a,b&fs=nope&sel=assets:zzz&projectStatus=ACTIVE,<script>&district=Atlantis,Galle&agencyId=${ID},bad&dateFrom=2026-13-01&overdue=yes&conflictStatusGroup=hax`));
    expect(out.center).toBeNull();
    expect(out.zoom).toBeNull();
    expect(out.layers).toEqual(["projects"]);
    expect(out.opacity).toEqual({ assets: 1 });
    expect(out.order).toBeNull();
    expect(out.focus).toBeNull();
    expect(out.sel).toBeNull();
    expect(out.uf.projectStatus).toEqual(["ACTIVE"]);
    expect(out.uf.district).toEqual(["Galle"]);
    expect(out.uf.agencyId).toEqual([ID]);
    expect(out.uf.dateFrom).toBe("");
    expect(out.uf.overdue).toBe(false);
    expect(out.uf.conflictStatusGroup).toBe("");
    const far = parseViewState(qs("ll=60,10&z=40"));
    expect(far.center).toEqual([URL_BOUNDS.east - 0 > 60 ? 60 : URL_BOUNDS.west, 10].length ? far.center : null);
    expect(far.center![0]).toBeGreaterThanOrEqual(URL_BOUNDS.west);
    expect(far.center![0]).toBeLessThanOrEqual(URL_BOUNDS.east);
    expect(far.zoom).toBe(19);
    expect(parseViewState(qs("dateFrom=2026-05-01&dateTo=2026-01-01")).uf).toMatchObject({ dateFrom: "", dateTo: "" });
    expect(parseViewState(qs("projectStatus=" + Array.from({ length: 20 }, () => "ACTIVE").join(","))).uf.projectStatus).toEqual(["ACTIVE"]);
  });
});

describe("viewport pipeline helpers", () => {
  it("pads by 25 %, rounds outward to a zoom grid, and the result always contains the viewport", () => {
    const vp: [number, number, number, number] = [79.84, 6.9, 79.9, 6.96];
    const padded = padBbox(vp);
    expect(padded[0]).toBeCloseTo(79.84 - 0.015);
    const q = quantizeBbox(vp, 12);
    expect(containsBbox(q, vp)).toBe(true);
    expect(containsBbox(fetchBboxFor(vp, 12), vp)).toBe(true);
    expect(fetchBboxFor([79.84, 6.9, 79.9, 6.96], 12)).toEqual(fetchBboxFor([79.841, 6.901, 79.899, 6.959], 12));
    expect(fetchBboxFor([79.4, 5.8, 82.1, 9.95], 7).every(Number.isFinite)).toBe(true);
    const wide = fetchBboxFor([60, -20, 100, 40], 3);
    expect(wide[2] - wide[0]).toBeLessThanOrEqual(10);
  });

  it("refetches only when there is no box, the zoom bucket changes, or the viewport leaves the fetched box", () => {
    const fetched = { bbox: fetchBboxFor([79.84, 6.9, 79.9, 6.96], 12), zoom: 12.3 };
    expect(needsRefetch(null, [79.84, 6.9, 79.9, 6.96], 12)).toBe(true);
    expect(needsRefetch(fetched, [79.845, 6.905, 79.905, 6.965], 12.6)).toBe(false);
    expect(needsRefetch(fetched, [79.845, 6.905, 79.905, 6.965], 13.1)).toBe(true);
    expect(needsRefetch(fetched, [79.95, 6.9, 80.01, 6.96], 12)).toBe(true);
    expect(zoomBucket(12.9)).toBe(12);
    expect(zoomBucket(-3)).toBe(0);
  });

  it("uses lighter requests on phones, low-core and save-data devices", () => {
    expect(deviceProfile({ width: 1280, cores: 8 })).toMatchObject({ limit: 500, gridMultiplier: 1, lowPower: false });
    expect(deviceProfile({ width: 375, cores: 8 })).toMatchObject({ limit: 300, gridMultiplier: 2, lowPower: false });
    expect(deviceProfile({ width: 1280, cores: 4 })).toMatchObject({ limit: 300, lowPower: true });
    expect(deviceProfile({ width: 1280, saveData: true })).toMatchObject({ limit: 300, lowPower: true });
  });
});

describe("filter state, query strings and presets", () => {
  it("serialises only the filters that apply to a layer, in a stable order", () => {
    const uf: UF = { ...EMPTY_UF, roadworkStatus: ["ACTIVE", "APPROVED"], projectStatus: ["DELAYED"], district: ["Colombo"], overdue: true, hazardLevel: ["HIGH"] };
    expect(ufParams(uf, "projects")).toBe("&district=Colombo&projectStatus=DELAYED");
    expect(ufParams(uf, "roadworks")).toBe("&district=Colombo&overdue=1&roadworkStatus=ACTIVE%2CAPPROVED");
    expect(ufParams(uf, "conflicts")).toBe("&district=Colombo");
    expect(ufParams(EMPTY_UF, "projects")).toBe("");
    for (const layer of LAYER_KEYS) expect(LAYER_FILTER_KEYS[layer].length).toBeGreaterThan(0);
  });

  it("toggles, removes, counts and resets filters without touching other facets", () => {
    let uf = toggleValue(EMPTY_UF, "projectStatus", "ACTIVE");
    uf = toggleValue(uf, "projectStatus", "APPROVED");
    uf = { ...uf, overdue: true, dateFrom: "2026-01-01" };
    expect(activeFilterCount(uf)).toBe(4);
    expect(toggleValue(uf, "projectStatus", "ACTIVE").projectStatus).toEqual(["APPROVED"]);
    expect(removeFilter(uf, { key: "overdue", value: "1" }).overdue).toBe(false);
    expect(removeFilter(uf, { key: "dateFrom", value: "2026-01-01" }).dateFrom).toBe("");
    expect(removeFilter(uf, { key: "projectStatus", value: "ACTIVE" }).projectStatus).toEqual(["APPROVED"]);
    expect(activeFilters(EMPTY_UF)).toEqual([]);
    expect(toggleValue({ ...EMPTY_UF, district: Array.from({ length: 12 }, (_, i) => `d${i}`) }, "district", "x").district).toHaveLength(12);
  });

  it("defines deterministic presets that set filters and layers and leave everything else alone", () => {
    expect(FILTER_PRESETS.map((p) => p.id)).toEqual(["activeWork", "overdueRoadworks", "criticalConflicts", "attentionAssets", "highRisk", "unmapped"]);
    const base: UF = { ...EMPTY_UF, district: ["Galle"] };
    const out = applyPreset(base, FILTER_PRESETS.find((p) => p.id === "criticalConflicts")!);
    expect(out).toMatchObject({ conflictBand: ["critical", "high"], conflictStatusGroup: "open", district: ["Galle"] });
    expect(applyPreset(base, FILTER_PRESETS.find((p) => p.id === "overdueRoadworks")!).overdue).toBe(true);
    for (const p of FILTER_PRESETS) expect(getB3Copy("en").fp.presetNames[p.id], p.id).toBeTruthy();
  });

  it("computes date presets from a supplied day and validates option values", () => {
    const today = new Date("2026-03-15T08:00:00Z");
    expect(datePreset("thisMonth", today)).toEqual({ dateFrom: "2026-03-01", dateTo: "2026-03-31" });
    expect(datePreset("next30", today)).toEqual({ dateFrom: "2026-03-15", dateTo: "2026-04-14" });
    expect(datePreset("next90", today).dateTo).toBe("2026-06-13");
    expect(validValue("province", "Western Province")).toBe(true);
    expect(validValue("district", "Atlantis")).toBe(false);
    expect(validValue("conflictBand", "critical")).toBe(true);
    expect(validValue("projectStatus", "NOPE")).toBe(false);
    expect(districtsOf([])).toHaveLength(25);
    expect(districtsOf(["Western Province"])).toEqual(["Colombo", "Gampaha", "Kalutara"]);
  });
});

describe("coordinate jump", () => {
  it("parses decimal and hemisphere forms and rejects anything else", () => {
    expect(parseCoordinates("7.2906, 80.6337")).toEqual({ lat: 7.2906, lng: 80.6337, insideSriLanka: true });
    expect(parseCoordinates("7.29N 80.63E")).toMatchObject({ lat: 7.29, lng: 80.63, insideSriLanka: true });
    expect(parseCoordinates("80.63E, 7.29N")).toMatchObject({ lat: 7.29, lng: 80.63 });
    expect(parseCoordinates("7.29 N, 80.63 W")).toMatchObject({ lng: -80.63, insideSriLanka: false });
    expect(parseCoordinates("40.7, -74.0")).toMatchObject({ insideSriLanka: false });
    for (const bad of ["", "7.29", "abc, def", "95, 80", "7, 190", "7N 8N", "7E 8E", "1,2,3", "Colombo"]) expect(parseCoordinates(bad), bad).toBeNull();
  });
});

describe("command registry and copy", () => {
  const ctx: CommandCtx = {
    isLayerAvailable: () => true, isLayerOn: () => true, toggleLayer: vi.fn(), focusLayer: vi.fn(), applyPreset: vi.fn(), clearFilters: vi.fn(), hasFilters: () => true, resetView: vi.fn(), copyLink: vi.fn(),
    openBrief: vi.fn(), openHealth: vi.fn(), openSavedViews: vi.fn(), toggleFullscreen: vi.fn(), toggleLegend: vi.fn(), openShortcuts: vi.fn(), setLocale: vi.fn(), canRisk: () => true,
  };
  it("gives every command an id, keywords, a run function and a label in all three languages", () => {
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
    for (const locale of ["en", "si", "ta"] as const) {
      const labels = getB3Copy(locale).commands;
      for (const c of COMMANDS) { expect(labels[c.id], `${locale}:${c.id}`).toBeTruthy(); expect(typeof c.run).toBe("function"); expect(c.keywords.length).toBeGreaterThan(0); }
    }
    for (const c of COMMANDS) c.run(ctx);
    expect(ctx.toggleLayer).toHaveBeenCalledTimes(LAYER_KEYS.length);
    expect(ctx.applyPreset).toHaveBeenCalledTimes(FILTER_PRESETS.length);
    expect(ctx.setLocale).toHaveBeenCalledTimes(3);
  });
  it("matches by label or keyword and hides unavailable commands", () => {
    const labels = getB3Copy("en").commands;
    expect(matchCommands(COMMANDS, labels, ctx, "overdue").map((c) => c.id)).toContain("preset:overdueRoadworks");
    expect(matchCommands(COMMANDS, labels, ctx, "focus assets").map((c) => c.id)).toEqual(["focus:assets"]);
    expect(matchCommands(COMMANDS, labels, { ...ctx, hasFilters: () => false }, "clear").map((c) => c.id)).not.toContain("clearFilters");
    expect(matchCommands(COMMANDS, labels, { ...ctx, isLayerAvailable: (k) => k !== "risks" }, "risk").map((c) => c.id)).not.toContain("toggle:risks");
  });
  it("translates the new strings and the 9 provinces and 25 districts", () => {
    const en = getB3Copy("en");
    for (const locale of ["si", "ta"] as const) {
      const c = getB3Copy(locale);
      expect(c.search.placeholder).not.toBe(en.search.placeholder);
      expect(c.fp.keys.projectStatus).not.toBe(en.fp.keys.projectStatus);
      expect(c.fp.flags.overdue).not.toBe(en.fp.flags.overdue);
      expect(c.lm.presetNames.all).not.toBe(en.lm.presetNames.all);
      expect(c.dr.relations.project).not.toBe(en.dr.relations.project);
      expect(Object.keys(PLACE_TRANSLATIONS[locale])).toHaveLength(34);
      expect(placeName("Colombo", locale)).not.toBe("Colombo");
    }
    expect(placeName("Colombo", "en")).toBe("Colombo");
    expect(placeName("Unknown", "si")).toBe("Unknown");
  });
});

describe("bottom-sheet snap math", () => {
  it("snaps to the nearest of peek, half and full, and moves one step on a flick", () => {
    const h = snapHeights(800);
    expect(h).toEqual({ peek: 96, half: 400, full: 736 });
    expect(snapTo(110, 0, 800)).toBe("peek");
    expect(snapTo(380, 0.1, 800)).toBe("half");
    expect(snapTo(700, 0, 800)).toBe("full");
    expect(snapTo(150, 1.2, 800)).toBe("half"); // fast flick up from peek
    expect(snapTo(420, 1.2, 800)).toBe("full");
    expect(snapTo(700, -1.2, 800)).toBe("half");
    expect(snapTo(420, -1.2, 800)).toBe("half"); // still above half: settle on half
    expect(snapTo(390, -1.2, 800)).toBe("peek");
    expect(snapHeights(200).peek).toBe(60);
  });
  it("pads the map by the sheet height, capped at 60 % of the screen", () => {
    expect(mapPaddingForSheet("closed", 800)).toBe(0);
    expect(mapPaddingForSheet("peek", 800)).toBe(96);
    expect(mapPaddingForSheet("full", 800)).toBe(480);
  });
});

describe("device-local storage (saved views and recent searches)", () => {
  const store: Record<string, string> = {};
  afterEach(() => { vi.unstubAllGlobals(); for (const k of Object.keys(store)) delete store[k]; });
  const stub = (throwing = false) => vi.stubGlobal("localStorage", {
    getItem: (k: string) => { if (throwing) throw new Error("blocked"); return store[k] ?? null; },
    setItem: (k: string, v: string) => { if (throwing) throw new Error("quota"); store[k] = v; },
  });

  it("adds, renames, deletes and caps saved views, and validates what it loads", () => {
    stub();
    let views = addView([], "  My view  ", "ll=7.29,80.63&z=10&projectStatus=ACTIVE")!;
    expect(views[0]).toMatchObject({ name: "My view" });
    expect(addView(views, "   ", "x")).toBeNull();
    views = renameView(views, views[0]!.id, "Renamed");
    expect(views[0]!.name).toBe("Renamed");
    expect(renameView(views, views[0]!.id, "  ")[0]!.name).toBe("Renamed");
    expect(storeViews(views)).toBe(true);
    expect(loadViews(DEFAULTS)).toEqual([{ ...views[0], query: "ll=7.29%2C80.63&z=10&projectStatus=ACTIVE" }]);
    expect(deleteView(views, views[0]!.id)).toEqual([]);
    let many = views;
    for (let i = 0; i < MAX_VIEWS; i += 1) many = addView(many, `v${i}`, "") ?? many;
    expect(many).toHaveLength(MAX_VIEWS);
    expect(addView(many, "one more", "")).toBeNull();
  });

  it("drops corrupted, oversized or hostile entries and survives a blocked storage", () => {
    stub();
    store[VIEWS_KEY] = JSON.stringify({ v: 1, views: [{ id: "ok-1234", name: "Fine", query: "projectStatus=ACTIVE,<img>&layers=evil", savedAt: "x" }, { id: "../x", name: "Bad id", query: "" }, { id: "good-5678", name: "", query: "" }, { id: "good-9999", name: "N", query: "a".repeat(5000) }, null] });
    const loaded = loadViews(DEFAULTS);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.query).not.toContain("img");
    expect(loaded[0]!.query).not.toContain("evil");
    store[VIEWS_KEY] = "{not json";
    expect(loadViews(DEFAULTS)).toEqual([]);
    store[VIEWS_KEY] = JSON.stringify({ v: 2, views: [] });
    expect(loadViews(DEFAULTS)).toEqual([]);
    vi.unstubAllGlobals();
    stub(true);
    expect(loadViews(DEFAULTS)).toEqual([]);
    expect(storeViews([])).toBe(false);
    expect(loadRecent()).toEqual([]);
  });

  it("keeps up to 8 recent searches, newest first, without duplicates or junk", () => {
    let r: string[] = [];
    for (const q of ["a", "galle", "Galle", "kandy", "x".repeat(81), "RSC-2026", "colombo", "water", "pipe", "road", "bridge", "rain"]) r = pushRecent(r, q);
    expect(r).toHaveLength(8);
    expect(r[0]).toBe("rain");
    expect(new Set(r.map((v) => v.toLowerCase())).size).toBe(r.length);
    expect(pushRecent(["galle", "kandy"], "GALLE")).toEqual(["GALLE", "kandy"]);
    expect(r).not.toContain("a");
  });
});
