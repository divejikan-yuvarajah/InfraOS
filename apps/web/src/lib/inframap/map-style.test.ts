import type { StyleSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveMapStyle } from "./map-style";

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

  it("defaults to the self-contained local grid with no raster tile source", () => {
    const style = resolveMapStyle() as StyleSpecification;
    expect(style.name).toBe("infraos-local-grid");
    const kinds = Object.values(style.sources).map((s) => s.type);
    expect(kinds).not.toContain("raster");
    expect(style.layers.map((l) => l.id)).toEqual(expect.arrayContaining(["sea", "land", "district-lines", "grid-major"]));
  });

  it("keeps OpenStreetMap tiles strictly opt-in", () => {
    process.env.NEXT_PUBLIC_MAP_BASEMAP = "osm";
    const style = resolveMapStyle() as StyleSpecification;
    expect(Object.values(style.sources).map((s) => s.type)).toContain("raster");
  });

  it("lets a valid https style URL win, and ignores a non-https one", () => {
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "https://tiles.example.test/style.json";
    expect(resolveMapStyle()).toBe("https://tiles.example.test/style.json");
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "http://insecure.example.test/style.json";
    expect((resolveMapStyle() as StyleSpecification).name).toBe("infraos-local-grid");
  });
});
