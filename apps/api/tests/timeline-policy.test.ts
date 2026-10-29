import { describe, expect, it } from "vitest";

import {
  compareTimelineEntries,
  milestoneDateEntries,
  pageTimeline,
  progressReportEntry,
  projectScheduleEntries,
  timelineInstant,
} from "../src/modules/projects/timeline.policy.js";

describe("timeline normalization", () => {
  it("keeps date-only leap days and orders a same-day timestamp after UTC midnight", () => {
    expect(timelineInstant("2024-02-29", "date")).toBe("2024-02-29T00:00:00.000Z");
    expect(timelineInstant("2024-02-30", "date")).toBeNull();
    const project = projectScheduleEntries({
      id: "p1",
      createdAt: new Date("2024-02-28T18:30:00.000Z"),
      startDate: new Date("2024-02-29T00:00:00.000Z"),
      plannedEndDate: new Date("invalid"),
      actualEndDate: null,
    });
    expect(project.map((entry) => entry.titleKey)).toEqual(["project.created", "project.plannedStart"]);
    const early = milestoneDateEntries({
      id: "m2",
      title: "Bridge",
      status: "BLOCKED",
      plannedStart: new Date("2024-02-29T00:00:00.000Z"),
      plannedEnd: new Date("2024-03-02T00:00:00.000Z"),
    });
    const laterId = milestoneDateEntries({
      id: "m1",
      title: "Deck",
      status: "NOT_STARTED",
      plannedStart: new Date("2024-02-29T00:00:00.000Z"),
      plannedEnd: new Date("2024-03-01T00:00:00.000Z"),
    });
    const report = progressReportEntry({
      id: "r1",
      reportedAt: new Date("2024-02-29T02:15:00.000Z"),
      reportedPercent: 100,
      note: "Reported only",
    });
    expect(report?.reportedPercent).toBe(100);
    const page = pageTimeline([...project, ...early, ...laterId, report!], 1, 10, "asc");
    const keys = page.entries.map((entry) => `${entry.eventDate}:${entry.sourceId}:${entry.dateRole}`);
    expect(keys).toEqual([
      "2024-02-28T18:30:00.000Z:p1:created",
      "2024-02-29:p1:plannedStart",
      "2024-02-29:m1:plannedMilestoneStart",
      "2024-02-29:m2:plannedMilestoneStart",
      "2024-02-29T02:15:00.000Z:r1:reported",
      "2024-03-01:m1:plannedMilestoneEnd",
      "2024-03-02:m2:plannedMilestoneEnd",
    ]);
    expect(compareTimelineEntries(page.entries[1], page.entries[2])).toBeLessThan(0);
    const second = pageTimeline(page.entries, 2, 2, "desc");
    expect(second.entries).toHaveLength(2);
    expect(second.hasMore).toBe(true);
    expect(second.entries[0]?.id).not.toBe(page.entries[0]?.id);
  });

  it("omits an unsafe progress percent and does not invent a milestone status time", () => {
    expect(progressReportEntry({ id: "r", reportedAt: new Date("2026-01-01T00:00:00.000Z"), reportedPercent: 100.5, note: "no" })).toBeNull();
    const rows = milestoneDateEntries({
      id: "m",
      title: "Abutment",
      status: "DELAYED",
      plannedStart: new Date("2026-05-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-05-20T00:00:00.000Z"),
      actualStart: new Date("2026-05-03T00:00:00.000Z"),
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === "DELAYED")).toBe(true);
    expect(rows.some((row) => row.dateRole === "actualMilestoneEnd")).toBe(false);
  });
});
