import { describe, expect, it } from "vitest";

import { dependencyStatusAllowed, prerequisiteReachesDependent } from "../src/modules/projects/dependency.policy.js";

describe("dependency graph policy", () => {
  it("rejects a self path, a two-node return, and a three-node return", () => {
    expect(prerequisiteReachesDependent("a", "a", [])).toBe("cycle");
    expect(prerequisiteReachesDependent("b", "a", [{ from: "b", to: "a" }])).toBe("cycle");
    expect(prerequisiteReachesDependent("c", "a", [
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ])).toBe("cycle");
    expect(prerequisiteReachesDependent("b", "a", [])).toBe("clear");
  });

  it("fails closed when the active edge cap is exceeded", () => {
    const edges = Array.from({ length: 201 }, (_, index) => ({ from: `n${index}`, to: `n${index + 1}` }));
    expect(prerequisiteReachesDependent("b", "a", edges)).toBe("too_large");
  });

  it("allows only draft, approved, and active dependents", () => {
    expect(dependencyStatusAllowed("ACTIVE")).toBe(true);
    expect(dependencyStatusAllowed("COMPLETED")).toBe(false);
    expect(dependencyStatusAllowed("CANCELLED")).toBe(false);
    expect(dependencyStatusAllowed("SUBMITTED")).toBe(false);
  });
});
