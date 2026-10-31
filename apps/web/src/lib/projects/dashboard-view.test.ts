import { describe, expect, it } from "vitest";

import { getDashboardCopy } from "./dashboard-messages";
import { attentionItems, donutSegments, dashboardCards, dashboardIsEmpty, dashboardIsPartial, dashboardLinks, dashboardQueryKey, dashboardScope, statusRows, visibleDashboard, type DashboardPayload } from "./dashboard-view";

function payload(overrides: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    asOf: "2026-07-02T03:00:00.000Z",
    timezone: "Asia/Colombo",
    scope: "agency",
    coverage: { projects: "complete", milestones: "complete", reviews: "unavailable", finance: "withheld" },
    counts: {
      total: 2,
      byStatus: { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, REJECTED: 0, APPROVED: 0, ACTIVE: 1, ON_HOLD: 1, DELAYED: 0, COMPLETED: 0, CANCELLED: 0 },
      active: 1,
      onHold: 1,
      delayed: 0,
    },
    recentProjects: [{ id: "p1", projectCode: "INF-DASH-6401", title: "Road", status: "ACTIVE", updatedAt: "2026-07-02T03:00:00.000Z" }],
    physical: { reportedAt100StillNotCompleted: 1, completedByStatus: 0, meaning: "physical_progress_does_not_set_status" },
    milestones: { overdue: 1, dueWithin14Days: 0, items: [], meaning: "planned_not_completed" },
    reviews: null,
    finance: null,
    assignedToYou: 1,
    availableWidgets: ["counts", "status", "recent", "physical", "milestones"],
    ...overrides,
  };
}

describe("project dashboard view", () => {
  it("builds factual cards and a text table for the same counts", () => {
    const cards = dashboardCards(payload());
    expect(cards.map((card) => [card.id, card.value])).toEqual([
      ["total", 2],
      ["active", 1],
      ["onHold", 1],
      ["delayed", 0],
      ["reportedOpen", 1],
      ["reviews", null],
    ]);
    const active = statusRows(payload()).find((row) => row.status === "ACTIVE");
    expect(active?.count).toBe(1);
    expect(statusRows(payload()).find((row) => row.status === "COMPLETED")?.count).toBe(0);
  });

  it("drops a loaded dashboard when the sign-in, user, or role changes", () => {
    const first = dashboardScope("1", "user-a", "PROJECT_MANAGER");
    const loaded = payload();
    expect(visibleDashboard(loaded, first, first, true)?.counts.total).toBe(2);
    expect(visibleDashboard(loaded, first, dashboardScope("1", "user-b", "PROJECT_MANAGER"), true)).toBeNull();
    expect(visibleDashboard(loaded, first, dashboardScope("2", "user-a", "PROJECT_MANAGER"), true)).toBeNull();
    expect(visibleDashboard(loaded, first, dashboardScope("1", "user-a", "GOV_ADMIN"), true)).toBeNull();
    expect(visibleDashboard(loaded, first, first, false)).toBeNull();
    expect(dashboardQueryKey("1", "user-a", "PROJECT_MANAGER")).not.toEqual(dashboardQueryKey("1", "user-b", "PROJECT_MANAGER"));
  });

  it("separates an empty scope, a partial source, and withheld widgets", () => {
    expect(dashboardIsEmpty(payload({ counts: { ...payload().counts, total: 0, active: 0, onHold: 0 }, recentProjects: [] }))).toBe(true);
    expect(dashboardIsPartial(payload())).toBe(false);
    expect(dashboardIsPartial(payload({ coverage: { projects: "complete", milestones: "unavailable", reviews: "unavailable", finance: "unavailable" }, milestones: null }))).toBe(true);
    const reviewer = payload({ reviews: { pending: 1, items: [] }, finance: { storedPaidCount: 1, storedPaidAmountMinor: 2500, currency: "LKR", provenance: "stored_record_provisional_not_bank_settlement" } });
    expect(dashboardCards(reviewer).find((card) => card.id === "reviews")?.value).toBe(1);
    expect(dashboardLinks("AGENCY_OFFICER", payload()).map((link) => link.id)).toEqual(["projects", "overview", "timeline", "activity"]);
    expect(dashboardLinks("INSPECTOR", reviewer).map((link) => link.id)).toEqual(["projects", "reviews", "overview"]);
    expect(dashboardLinks("GOV_ADMIN", reviewer).some((link) => link.href === "/projects/reviews")).toBe(true);
  });

  it("keeps English, Sinhala, and Tamil labels and marks the drafts", () => {
    for (const locale of ["en", "si", "ta"] as const) {
      const copy = getDashboardCopy(locale);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.nativeReview.toLowerCase()).toMatch(/review|සමාලෝචන|மதிப்பாய்வு/);
      expect(copy.retry.length).toBeGreaterThan(0);
      expect(copy.projects).not.toEqual(copy.reviewQueue);
    }
  });
});

describe("attention and donut helpers", () => {
  it("lists only real, non-zero items and links to real views", () => {
    const items = attentionItems(
      payload({
        counts: { ...payload().counts, delayed: 2 },
        reviews: { pending: 3, items: [] },
        milestones: {
          overdue: 1,
          dueWithin14Days: 0,
          items: [{ id: "m1", projectId: "p9", projectCode: "X", projectTitle: "T", title: "M", status: "IN_PROGRESS", plannedEnd: "2026-01-01T00:00:00.000Z", classification: "overdue", meaning: "planned_not_completed" }],
          meaning: "planned_not_completed",
        },
      }),
    );
    expect(items.map((i) => [i.id, i.count, i.href])).toEqual([
      ["delayed", 2, "/projects?status=DELAYED"],
      ["reviews", 3, "/projects/reviews"],
      ["overdue", 1, "/projects/p9"],
      ["reportedOpen", 1, null],
    ]);
  });
  it("is empty when nothing needs attention and hides unavailable sources", () => {
    const quiet = payload({ milestones: null, reviews: null, physical: { reportedAt100StillNotCompleted: 0, completedByStatus: 0, meaning: "physical_progress_does_not_set_status" } });
    expect(attentionItems(quiet)).toEqual([]);
  });
  it("builds donut fractions that sum to one, and none for zero projects", () => {
    const segs = donutSegments(payload());
    expect(segs.map((s) => s.status)).toEqual(["ACTIVE", "ON_HOLD"]);
    expect(segs.reduce((n, s) => n + s.fraction, 0)).toBeCloseTo(1);
    const none = payload({ counts: { ...payload().counts, byStatus: { ...payload().counts.byStatus, ACTIVE: 0, ON_HOLD: 0 } } });
    expect(donutSegments(none)).toEqual([]);
  });
});
