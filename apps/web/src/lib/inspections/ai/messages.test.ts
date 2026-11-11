import { describe, expect, it } from "vitest";

import { INSPECTION_AI_EN } from "./messages-en";
import { INSPECTION_AI_SI } from "./messages-si";
import { INSPECTION_AI_TA } from "./messages-ta";

function keyPathsWithArrays(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => keyPathsWithArrays(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("inspection AI dictionary key parity", () => {
  it("matches every key and array length across en, si, and ta", () => {
    const enKeys = keyPathsWithArrays(INSPECTION_AI_EN).sort();
    const siKeys = keyPathsWithArrays(INSPECTION_AI_SI).sort();
    const taKeys = keyPathsWithArrays(INSPECTION_AI_TA).sort();
    expect(siKeys).toEqual(enKeys);
    expect(taKeys).toEqual(enKeys);
  });
});

