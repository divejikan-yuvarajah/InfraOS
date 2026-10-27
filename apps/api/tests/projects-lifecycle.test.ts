import { describe, expect, it } from "vitest";

import { PROJECT_STATUSES } from "../src/modules/projects/project.constants.js";
import {
  actionBlock,
  hintActions,
  progressDoesNotComplete,
  submitGaps,
  transitionTarget,
  type LifecycleAction,
} from "../src/modules/projects/lifecycle.policy.js";

const ACTIONS: LifecycleAction[] = ["SUBMIT", "HOLD", "RESUME", "START", "MARK_DELAYED", "COMPLETE", "CANCEL"];

describe("project lifecycle policy", () => {
  it("covers the nine implemented statuses and rejects illegal edges", () => {
    expect(PROJECT_STATUSES).not.toContain("REJECTED");
    expect(transitionTarget("DRAFT", "SUBMIT")).toBe("SUBMITTED");
    expect(transitionTarget("ACTIVE", "HOLD")).toBe("ON_HOLD");
    expect(transitionTarget("ON_HOLD", "RESUME")).toBe("ACTIVE");
    expect(transitionTarget("APPROVED", "START")).toBe("ACTIVE");
    expect(transitionTarget("ACTIVE", "COMPLETE")).toBe("COMPLETED");
    expect(transitionTarget("COMPLETED", "RESUME")).toBeNull();
    expect(transitionTarget("CANCELLED", "START")).toBeNull();
    expect(transitionTarget("SUBMITTED", "SUBMIT")).toBeNull();
    expect(transitionTarget("UNDER_REVIEW", "START")).toBeNull();
    for (const status of PROJECT_STATUSES) {
      const legal = ACTIONS.filter((action) => transitionTarget(status, action));
      expect(legal.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("blocks start and delay for unmapped grants and completion for missing adapters", () => {
    expect(actionBlock("START")).toBe("unmapped_permission");
    expect(actionBlock("MARK_DELAYED")).toBe("unmapped_permission");
    expect(actionBlock("COMPLETE")).toBe("dependency_unavailable");
    expect(actionBlock("CANCEL")).toBe("dependency_unavailable");
    expect(actionBlock("SUBMIT")).toBeNull();
  });

  it("requires dates, geometry, location, and budget before submit", () => {
    expect(submitGaps({ title: "A", projectCode: "INF-ROAD-1", projectType: "ROAD" })).toEqual(
      expect.arrayContaining(["budget", "dates", "geometry", "location"]),
    );
    expect(submitGaps({
      title: "A",
      projectCode: "INF-ROAD-1",
      projectType: "ROAD",
      budget: { amountMinor: 1 },
      startDate: "2027-01-01T00:00:00.000Z",
      plannedEndDate: "2027-02-01T00:00:00.000Z",
      geometry: { type: "Point" },
      location: { district: "Colombo" },
    })).toEqual([]);
  });

  it("does not treat 100 percent progress as completion", () => {
    expect(progressDoesNotComplete(100, "ACTIVE")).toBe(true);
  });

  it("hints only executable grants", () => {
    expect(hintActions("DRAFT", ["project.submit"])).toEqual(["SUBMIT"]);
    expect(hintActions("ACTIVE", ["project.complete", "project.cancel"])).toEqual([]);
    expect(hintActions("ACTIVE", ["project.hold"])).toEqual(["HOLD"]);
  });
});
