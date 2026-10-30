import { describe, expect, it } from "vitest";

import { getNoticeCopy, noticeTitle } from "./notice-messages";
import { noticeHref, noticePageState, noticePagesForScope, noticeQueryKey, noticeScope, rememberNoticePage, visibleNotices, type NoticeItem } from "./notice-view";

function row(id: string, title = "Secret review road"): NoticeItem {
  return {
    id,
    type: "APPROVAL",
    titleKey: "project.submitted",
    isRead: false,
    createdAt: "2026-07-02T03:00:00.000Z",
    readAt: null,
    project: { id: "project-a", projectCode: "INF-NOTE-6501", title, status: "SUBMITTED" },
  };
}

describe("notice view", () => {
  it("drops pages and counters when the signed-in person or epoch changes", () => {
    const first = noticeScope("1", "user-a", "GOV_ADMIN");
    const loaded = rememberNoticePage(noticePageState(first), first, [row("n1")], "cursor-2");
    expect(visibleNotices(loaded, first, true, [row("n2")]).map((item) => item.id)).toEqual(["n1", "n2"]);
    const second = noticeScope("1", "user-b", "GOV_ADMIN");
    expect(visibleNotices(noticePagesForScope(loaded, second), second, true, [row("n3")]).map((item) => item.id)).toEqual(["n3"]);
    expect(visibleNotices(loaded, second, true, [row("n3")])).toEqual([]);
    expect(visibleNotices(loaded, first, false, [row("n2")])).toEqual([]);
    expect(noticeQueryKey("1", "user-a", "GOV_ADMIN", "unread", "")).not.toEqual(noticeQueryKey("2", "user-a", "GOV_ADMIN", "unread", ""));
  });

  it("links only a project the response still includes", () => {
    expect(noticeHref(row("n1"))).toBe("/projects/project-a");
    expect(noticeHref({ ...row("n2"), project: null })).toBeNull();
    for (const locale of ["en", "si", "ta"] as const) {
      const copy = getNoticeCopy(locale);
      expect(noticeTitle(copy, "project.submitted").length).toBeGreaterThan(0);
      expect(copy.nativeReview.toLowerCase()).toMatch(/review|සමාලෝචන|மதிப்பாய்வு/);
    }
  });
});
