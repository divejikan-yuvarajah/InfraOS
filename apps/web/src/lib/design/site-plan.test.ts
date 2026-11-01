import { describe, expect, it } from "vitest";

import { INFRAOS_ACCESSIBLE_TEXT, INFRAOS_NEUTRALS } from "./brand-tokens";
import { contrastRatio } from "./contrast";
import { coverageHonesty, dualProgress, lifecycleRail, PROJECT_MAIN_PATH, statusNode } from "./site-plan";

describe("route-line status language", () => {
  it("gives every project and work status a distinct shape for critical/hold/done", () => {
    expect(statusNode("project", "DELAYED")).toEqual({ shape: "diamond", tone: "critical" });
    expect(statusNode("project", "ON_HOLD").shape).toBe("half");
    expect(statusNode("project", "COMPLETED").shape).toBe("check");
    expect(statusNode("work", "DRAFT").shape).toBe("dash");
    expect(statusNode("project", "UNKNOWN")).toEqual({ shape: "dash", tone: "neutral" });
  });
});

describe("lifecycle rail", () => {
  it("marks earlier main-path steps done and the current one current", () => {
    const rail = lifecycleRail("APPROVED");
    expect(rail.steps.map((s) => s.state)).toEqual(["done", "done", "done", "current", "upcoming", "upcoming"]);
    expect(rail.branch).toBeNull();
  });
  it("shows off-path states as a branch, not a step", () => {
    const rail = lifecycleRail("DELAYED");
    expect(rail.branch).toBe("DELAYED");
    expect(rail.steps.find((s) => s.state === "current")?.status).toBe("ACTIVE");
    expect(rail.steps).toHaveLength(PROJECT_MAIN_PATH.length);
    const rejected = lifecycleRail("REJECTED");
    expect(rejected.terminated).toBe(true);
    // Rejection can follow Submitted or Under review: only Submitted is claimed.
    expect(rejected.steps.map((s) => s.state)).toEqual(["done", "done", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });
  it("claims no progress for cancelled projects", () => {
    const rail = lifecycleRail("CANCELLED");
    expect(rail.steps.every((s) => s.state === "upcoming")).toBe(true);
    expect(rail.branch).toBe("CANCELLED");
  });
});

describe("dual progress honesty", () => {
  it("labels physical as reported and financial as provisional, clamped", () => {
    const [p, f] = dualProgress(100, 140);
    expect(p.label).toBe("Reported 100%");
    expect(p.honesty).toBe("reported");
    expect(f.label).toBe("Provisional 100%");
    expect(f.honesty).toBe("provisional");
  });
  it("never invents a value for missing data", () => {
    const [p, f] = dualProgress(null, Number.NaN);
    expect(p.value).toBeNull();
    expect(p.honesty).toBe("unavailable");
    expect(f.value).toBeNull();
  });
  it("maps coverage to chips", () => {
    expect(coverageHonesty("complete")).toBeNull();
    expect(coverageHonesty("withheld")).toBe("withheld");
    expect(coverageHonesty("unavailable")).toBe("unavailable");
  });
});

describe("Site Plan contrast (measured, WCAG AA 4.5:1 for text)", () => {
  const canvas = "#faf8f4"; // --sp-canvas
  const pairs: [string, string, string][] = [
    ["text on warm canvas", INFRAOS_NEUTRALS.text, canvas],
    ["secondary text on warm canvas", "#475569", canvas],
    ["muted text on white", "#64748b", INFRAOS_NEUTRALS.surface],
    ["orange text on orange tint", INFRAOS_ACCESSIBLE_TEXT.onLight.orange, "#fff3ea"],
    ["yellow text on yellow tint", "#6c5311", "#fff8e6"],
    ["green text on green tint", "#166b30", "#ecfdf3"],
    ["critical text on critical tint", "#8c1f28", "#fdecee"],
  ];
  for (const [name, fg, bg] of pairs) {
    it(name, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
