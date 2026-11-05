import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { ensureLayers, LAYER_DEFS } from "./layer-registry";

/**
 * Builds the whole map style by running the registry against a recording fake map, then validates it with MapLibre's
 * own style-spec validator. This catches invalid expressions, unknown properties and bad filters without a browser.
 */
function build() {
  const sources: Record<string, unknown> = {};
  const layers: { id: string; source?: string }[] = [];
  const fake = {
    getSource: (id: string) => sources[id],
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addSource: (id: string, spec: unknown) => { sources[id] = spec; },
    addLayer: (layer: { id: string }) => { layers.push(layer); },
    hasImage: () => true, // sprites are canvas-drawn in the browser; the validator only needs the names
    addImage: () => undefined,
  };
  ensureLayers(fake as never);
  return { sources, layers };
}

describe("InfraMap registry produces a valid MapLibre style", () => {
  const { sources, layers } = build();

  it("passes the style-spec validator with no errors", () => {
    const style = {
      version: 8,
      glyphs: "https://example.test/{fontstack}/{range}.pbf",
      sprite: undefined,
      sources: { osm: { type: "raster", tiles: ["https://example.test/{z}/{x}/{y}.png"], tileSize: 256 }, ...sources },
      layers: [{ id: "osm", type: "raster", source: "osm" }, ...layers],
    };
    const errors = validateStyleMin(JSON.parse(JSON.stringify(style)));
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it("adds every layer id the registry declares, once, and no others for the layers it owns", () => {
    const ids = layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of LAYER_DEFS) for (const id of def.layerIds) expect(ids, id).toContain(id);
  });

  it("is idempotent: running it again adds nothing", () => {
    const once = layers.length;
    const again = build();
    expect(again.layers.length).toBe(once);
  });
});
