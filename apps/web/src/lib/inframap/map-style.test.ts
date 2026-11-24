import type { StyleSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachBasemapFallback, OPENFREEMAP_STYLES, resolveMapStyle } from "./map-style";

const saved = {
  url: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  basemap: process.env.NEXT_PUBLIC_MAP_BASEMAP,
};

describe("resolveMapStyle", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    delete process.env.NEXT_PUBLIC_MAP_BASEMAP;
  });
  afterEach(() => {
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    else process.env.NEXT_PUBLIC_MAP_STYLE_URL = saved.url;
    if (saved.basemap === undefined) delete process.env.NEXT_PUBLIC_MAP_BASEMAP;
    else process.env.NEXT_PUBLIC_MAP_BASEMAP = saved.basemap;
  });

  it("defaults to OpenFreeMap vector styles (positron for dense overlays, liberty for exploration)", () => {
    expect(resolveMapStyle()).toBe(OPENFREEMAP_STYLES.positron);
    expect(resolveMapStyle("liberty")).toBe(OPENFREEMAP_STYLES.liberty);
    expect(resolveMapStyle("bright")).toBe(OPENFREEMAP_STYLES.bright);
  });

  it("supports forced local-grid basemap with bundled Sri Lanka GeoJSON and graticule", () => {
    process.env.NEXT_PUBLIC_MAP_BASEMAP = "local";
    const style = resolveMapStyle() as StyleSpecification;
    expect(style.name).toBe("infraos-local-grid");
    const kinds = Object.values(style.sources).map((s) => s.type);
    expect(kinds).not.toContain("raster");
    expect(style.layers.map((l) => l.id)).toEqual(expect.arrayContaining(["sea", "land", "district-lines", "grid-major"]));
  });

  it("keeps OpenStreetMap raster tiles strictly opt-in", () => {
    process.env.NEXT_PUBLIC_MAP_BASEMAP = "osm";
    const style = resolveMapStyle() as StyleSpecification;
    expect(Object.values(style.sources).map((s) => s.type)).toContain("raster");
  });

  it("lets a valid https style URL win, and ignores a non-https one", () => {
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "https://tiles.example.test/style.json";
    expect(resolveMapStyle()).toBe("https://tiles.example.test/style.json");
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "http://insecure.example.test/style.json";
    expect(resolveMapStyle()).toBe(OPENFREEMAP_STYLES.positron);
  });

  it("automatically falls back to the local grid when the remote basemap errors before load", () => {
    const handlers: Record<string, (e?: unknown) => void> = {};
    const setStyle = vi.fn();
    const onFallback = vi.fn();
    const cleanup = attachBasemapFallback(
      { on: (ev, fn) => { handlers[ev] = fn; }, setStyle, isStyleLoaded: () => false },
      OPENFREEMAP_STYLES.positron,
      { onFallback, timeoutMs: 5000 },
    );
    handlers.error?.({ error: { message: "Failed to fetch" } });
    expect(setStyle).toHaveBeenCalledTimes(1);
    expect((setStyle.mock.calls[0]?.[0] as StyleSpecification).name).toBe("infraos-local-grid");
    expect(onFallback).toHaveBeenCalledWith(true);
    cleanup();
  });
});
