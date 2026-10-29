import { describe, expect, it } from "vitest";

import { getTimelineCopy } from "./timeline-messages";
import {
  formatTimelineWhen,
  canLinkTimeline,
  groupByHeading,
  groupTimeline,
  onTimelineKey,
  plannedRanges,
  timelineQueryKey,
  visibleWhenRestricted,
  type TimelineViewEntry,
} from "./timeline-view";

const entries: TimelineViewEntry[] = [
  { id: "p", sourceKind: "project", sourceId: "p", eventDate: "2026-06-01", precision: "date", category: "planned", titleKey: "project.plannedStart", dateRole: "plannedStart" },
  { id: "m1s", sourceKind: "milestone", sourceId: "m1", eventDate: "2026-07-01", precision: "date", category: "planned", titleKey: "milestone.plannedStart", dateRole: "plannedMilestoneStart", label: "Deck", status: "NOT_STARTED" },
  { id: "r", sourceKind: "progressReport", sourceId: "r", eventDate: "2026-07-01T18:30:00.000Z", precision: "timestamp", category: "recorded", titleKey: "progress.reported", dateRole: "reported", reportedPercent: 40, note: "secret note" },
  { id: "m1e", sourceKind: "milestone", sourceId: "m1", eventDate: "2026-08-01", precision: "date", category: "planned", titleKey: "milestone.plannedEnd", dateRole: "plannedMilestoneEnd", label: "Deck", status: "NOT_STARTED" },
];

describe("timeline view", () => {
  it("groups by Colombo day, filters sources, and builds planned ranges", () => {
    expect(groupTimeline(entries, "milestone")).toHaveLength(2);
    expect(groupTimeline(entries, "progress").some((entry) => entry.note)).toBe(true);
    const headings = groupByHeading(entries);
    expect(headings.map((group) => group.heading)).toEqual(["2026-06-01", "2026-07-01", "2026-07-02", "2026-08-01"]);
    expect(headings[1]?.entries.map((entry) => entry.id)).toEqual(["m1s"]);
    expect(headings[2]?.entries.map((entry) => entry.id)).toEqual(["r"]);
    expect(plannedRanges(entries)).toEqual([{ id: "m1", label: "Deck", start: "2026-07-01", end: "2026-08-01", status: "NOT_STARTED" }]);
    expect(formatTimelineWhen("2024-02-29", "date", "en")).toContain("2024");
    expect(formatTimelineWhen("2026-07-01T18:30:00.000Z", "timestamp", "si")).not.toBe("2026-07-01T18:30:00.000Z");
    expect(getTimelineCopy("ta").title).not.toBe(getTimelineCopy("en").title);
    expect(getTimelineCopy("en").provenance).toContain("not inspection verification");
  });

  it("drops restricted sources, moves keyboard focus, and isolates the query key", () => {
    expect(entries.filter((entry) => visibleWhenRestricted(entry, "restricted", "visible")).some((entry) => entry.label === "Deck")).toBe(false);
    expect(entries.filter((entry) => visibleWhenRestricted(entry, "visible", "restricted")).some((entry) => entry.note)).toBe(false);
    expect(onTimelineKey("ArrowDown", 0, 3)).toBe(1);
    expect(onTimelineKey("ArrowUp", 0, 3)).toBe(0);
    expect(onTimelineKey("End", 1, 3)).toBe(2);
    expect(onTimelineKey("Home", 2, 3)).toBe(0);
    expect(canLinkTimeline("PROJECT_MANAGER")).toBe(true);
    expect(canLinkTimeline("CONTRACTOR")).toBe(false);
    expect(canLinkTimeline("INSPECTOR")).toBe(false);
    expect(canLinkTimeline("CITIZEN")).toBe(false);
    expect(timelineQueryKey("1", "user-a", "PROJECT_MANAGER", "p1", "all", "asc", 1)).not.toEqual(
      timelineQueryKey("2", "user-b", "INSPECTOR", "p1", "milestone", "desc", 2),
    );
  });
});
