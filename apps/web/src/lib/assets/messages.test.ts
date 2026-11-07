import { describe, expect, it } from "vitest";

import { ASSET_COPY, keyPaths } from "./messages";

describe("asset copy parity", () => {
  const base = keyPaths(ASSET_COPY.en).sort();
  it.each(["si", "ta"] as const)("%s has exactly the English key tree and no empty strings", (loc) => {
    expect(keyPaths(ASSET_COPY[loc]).sort()).toEqual(base);
    const empty = base.filter((p) => !p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ASSET_COPY[loc]));
    expect(empty).toEqual([]);
  });
});
