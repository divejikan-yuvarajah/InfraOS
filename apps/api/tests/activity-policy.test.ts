import { describe, expect, it } from "vitest";

import {
  classifyActivityAction,
  compareActivity,
  decodeActivityCursor,
  encodeActivityCursor,
  pageActivities,
  type ActivityItem,
} from "../src/modules/projects/activity.policy.js";

function item(id: string, occurredAt: string): ActivityItem {
  return {
    id,
    kind: "PROJECT_UPDATED",
    category: "project",
    occurredAt,
    source: "audit",
    titleKey: "activity.projectUpdated",
    actor: { label: "Authorized staff", identityVisible: false },
    detail: null,
  };
}

describe("activity policy", () => {
  it("omits unknown actions and keeps the supported taxonomy", () => {
    expect(classifyActivityAction("project.created")?.kind).toBe("PROJECT_CREATED");
    expect(classifyActivityAction("project.dependency_linked")?.category).toBe("dependency");
    expect(classifyActivityAction("finance.paid")).toBeNull();
    expect(classifyActivityAction("milestone.planned")).toBeNull();
  });

  it("orders equal timestamps by id and pages without repeats", () => {
    const newer = item("audit:bbbbbbbbbbbbbbbbbbbbbbb2", "2026-07-01T00:00:00.000Z");
    const olderId = item("audit:aaaaaaaaaaaaaaaaaaaaaaaa", "2026-07-01T00:00:00.000Z");
    const olderTime = item("audit:cccccccccccccccccccccccc", "2026-06-01T00:00:00.000Z");
    const ordered = [olderTime, newer, olderId].sort(compareActivity);
    expect(ordered.map((entry) => entry.id)).toEqual([newer.id, olderId.id, olderTime.id]);
    const first = pageActivities(ordered, null, 1);
    expect(first.activities.map((entry) => entry.id)).toEqual([newer.id]);
    expect(first.hasMore).toBe(true);
    const cursor = decodeActivityCursor(first.nextCursor ?? "");
    expect(cursor).not.toBeNull();
    const second = pageActivities(ordered, cursor, 1);
    expect(second.activities.map((entry) => entry.id)).toEqual([olderId.id]);
    expect(decodeActivityCursor(encodeActivityCursor(newer))?.id).toBe(newer.id);
    expect(decodeActivityCursor(Buffer.from(JSON.stringify({ t: newer.occurredAt, id: newer.id, $gt: 1 }), "utf8").toString("base64url"))).toBeNull();
  });
});
