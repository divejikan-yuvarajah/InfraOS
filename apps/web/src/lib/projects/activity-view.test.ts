import { describe, expect, it } from "vitest";

import { activityPageState, activityPagesForScope, activityScope, canLinkActivity, formatActivityWhen, rememberActivityPage, visibleActivityItems, type ActivityViewItem } from "./activity-view";

function row(id: string): ActivityViewItem {
  return {
    id,
    kind: "PROJECT_UPDATED",
    category: "project",
    occurredAt: "2026-08-01T00:00:00.000Z",
    source: "audit",
    titleKey: "activity.projectUpdated",
    actor: { label: "Authorized staff", identityVisible: false },
    detail: null,
  };
}

describe("activity view", () => {
  it("limits the activity link to the timeline audience", () => {
    expect(canLinkActivity("PROJECT_MANAGER")).toBe(true);
    expect(canLinkActivity("INSPECTOR")).toBe(false);
    expect(canLinkActivity("CONTRACTOR")).toBe(false);
    expect(canLinkActivity("CITIZEN")).toBe(false);
  });

  it("formats the stored instant in Asia/Colombo", () => {
    expect(formatActivityWhen("2026-07-01T18:30:00.000Z", "en")).toContain("2026");
  });

  it("does not keep an earlier user's pages after a session or project change", () => {
    const first = activityScope("1", "user-a", "PROJECT_MANAGER", "project-a");
    const loaded = rememberActivityPage(activityPageState(first), first, [row("audit:older")], "cursor-2");
    const shown = visibleActivityItems(loaded, first, true, [row("audit:newer")]);
    expect(shown.map((item) => item.id)).toEqual(["audit:older", "audit:newer"]);

    const second = activityScope("1", "user-b", "PROJECT_MANAGER", "project-a");
    const switched = activityPagesForScope(loaded, second);
    expect(visibleActivityItems(switched, second, true, [row("audit:b")]).map((item) => item.id)).toEqual(["audit:b"]);
    expect(visibleActivityItems(loaded, second, true, [row("audit:b")])).toEqual([]);

    const epoch = activityScope("2", "user-a", "PROJECT_MANAGER", "project-a");
    expect(visibleActivityItems(activityPagesForScope(loaded, epoch), epoch, true, [row("audit:epoch")]).map((item) => item.id)).toEqual(["audit:epoch"]);

    const otherProject = activityScope("1", "user-a", "PROJECT_MANAGER", "project-b");
    expect(activityPagesForScope(loaded, otherProject).pages).toEqual([]);
    expect(visibleActivityItems(loaded, first, false, [row("audit:newer")])).toEqual([]);
  });

  it("keeps Load more rows for the same sign-in and drops them when the filter cursor is cleared", () => {
    const scope = activityScope("1", "user-a", "PROJECT_MANAGER", "project-a");
    const first = rememberActivityPage(activityPageState(scope), scope, [row("audit:1")], "cursor-2");
    const second = rememberActivityPage(first, scope, [row("audit:1"), row("audit:2")], "cursor-3");
    expect(visibleActivityItems(second, scope, true, [row("audit:3")])).toHaveLength(3);
    const cleared = activityPageState(scope);
    expect(visibleActivityItems(cleared, scope, true, [row("audit:filtered")]).map((item) => item.id)).toEqual(["audit:filtered"]);
  });
});
