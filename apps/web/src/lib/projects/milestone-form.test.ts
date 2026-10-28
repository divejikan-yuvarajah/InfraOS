import { describe, expect, it } from "vitest";

import { milestoneFormSchema, actionsFor } from "./milestone-form";
import { getMilestoneCopy } from "./milestone-messages";

describe("milestone form", () => {
  it("accepts a planned window and rejects an inverted date and the stored PLANNED token", () => {
    expect(milestoneFormSchema.safeParse({
      title: "Bridge deck",
      description: "Synthetic",
      plannedStart: "2026-11-01",
      plannedEnd: "2026-12-01",
    }).success).toBe(true);
    expect(milestoneFormSchema.safeParse({
      title: "Bridge deck",
      description: "",
      plannedStart: "2026-12-01",
      plannedEnd: "2026-11-01",
    }).success).toBe(false);
    expect(milestoneFormSchema.safeParse({
      title: "Bridge deck",
      description: "",
      plannedStart: "2026-11-01",
      plannedEnd: "2026-12-01",
      status: "PLANNED",
    }).success).toBe(false);
  });

  it("labels stored NOT_STARTED as Planned and offers only legal actions", () => {
    expect(getMilestoneCopy("en").statuses.NOT_STARTED).toBe("Planned");
    expect(getMilestoneCopy("si").statuses.NOT_STARTED).not.toBe("NOT_STARTED");
    expect(actionsFor("NOT_STARTED")).toEqual(["START", "DELAY", "BLOCK"]);
    expect(actionsFor("IN_PROGRESS")).not.toContain("START");
    expect(actionsFor("COMPLETED")).toEqual([]);
    expect(actionsFor("CANCELLED")).toEqual([]);
  });
});
