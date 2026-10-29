import { describe, expect, it } from "vitest";

import { canEditDependencies, dependencyFailure, dependencyQueryKey, directionSentence } from "./dependency-view";

describe("dependency view", () => {
  it("states direction and keeps the cache key scoped to the session", () => {
    expect(directionSentence("INF-DEP-6202", "Bridge")).toContain("depends on INF-DEP-6202");
    expect(directionSentence("INF-DEP-6202", "Bridge")).toContain("does not change dates");
    expect(dependencyQueryKey("1", "user", "PROJECT_MANAGER", "a")).not.toEqual(dependencyQueryKey("2", "user", "PROJECT_MANAGER", "a"));
    expect(canEditDependencies("PROJECT_MANAGER")).toBe(true);
    expect(canEditDependencies("CONTRACTOR")).toBe(false);
    expect(canEditDependencies("SUPER_ADMIN")).toBe(false);
  });

  it("maps conflict and hidden-target responses", () => {
    expect(dependencyFailure(409)).toBe("conflict");
    expect(dependencyFailure(404)).toBe("missing");
    expect(dependencyFailure(403)).toBe("denied");
  });
});
