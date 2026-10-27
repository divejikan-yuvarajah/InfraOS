import { beforeEach, describe, expect, it, vi } from "vitest";

import { classifyAppPath } from "@/lib/auth/route-access";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: vi.fn() };
});

vi.mock("@/lib/auth/state", () => ({
  getAuthEpoch: vi.fn(() => 7),
  getMemoryAccessToken: vi.fn(() => "token-review"),
}));

import { apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { fetchReviewQueue, submitReview } from "./api";
import { STAFF_CANVAS, STAFF_FOCUS_ORANGE, STAFF_SURFACE, contrastRatio } from "./contrast";
import { reviewDetailQueryKey, reviewQueueQueryKey } from "./overview-format";
import { getReviewCopy, reviewFailureMessage } from "./review-messages";
import { parseReviewQueue, serializeReviewQueue } from "./review-query";

describe("project review presentation", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
    vi.mocked(getAuthEpoch).mockReturnValue(7);
    vi.mocked(getMemoryAccessToken).mockReturnValue("token-review");
  });

  it("keeps the review routes private and names reject and return", () => {
    expect(classifyAppPath("/projects/reviews")).toBe("private");
    expect(classifyAppPath("/projects/abc/review")).toBe("private");
    const copy = getReviewCopy("en");
    expect(copy.confirmReject).toMatch(/reason is stored/);
    expect(copy.confirmReturn).toMatch(/draft/);
    expect(getReviewCopy("si").reject).not.toBe(copy.reject);
    expect(getReviewCopy("ta").returnForChanges).not.toBe(copy.returnForChanges);
    expect(getReviewCopy("si").beginReview).not.toBe(copy.beginReview);
    expect(getReviewCopy("ta").approve).not.toBe(copy.approve);
    expect(getReviewCopy("si").nativeReview).toMatch(/ව/);
    expect(reviewFailureMessage(409, copy)).toBe(copy.conflict);
    expect(reviewFailureMessage(403, copy)).toBe(copy.forbidden);
  });

  it("keeps queue address state and separates caches by subject", () => {
    const parsed = parseReviewQueue(new URLSearchParams("q=road&status=SUBMITTED&sortBy=title&sortDir=asc&page=2&limit=25"));
    expect(parsed).toMatchObject({ q: "road", status: "SUBMITTED", sortBy: "title", sortDir: "asc", page: 2, limit: 25 });
    expect(parseReviewQueue(new URLSearchParams("status=DRAFT")).status).toBe("");
    expect(serializeReviewQueue(parsed)).toContain("status=SUBMITTED");
    expect(reviewQueueQueryKey("1", "user-a", "GOV_ADMIN", "q=a")).not.toEqual(reviewQueueQueryKey("2", "user-a", "GOV_ADMIN", "q=a"));
    expect(reviewDetailQueryKey("1", "user-a", "GOV_ADMIN", "p")).not.toEqual(reviewDetailQueryKey("1", "user-b", "GOV_ADMIN", "p"));
  });

  it("uses a staff focus colour that clears the non-text contrast threshold", () => {
    expect(contrastRatio(STAFF_FOCUS_ORANGE, STAFF_CANVAS)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(STAFF_FOCUS_ORANGE, STAFF_SURFACE)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#ff5b00", STAFF_CANVAS)).toBeLessThan(3);
  });

  it("posts only the action and revision", async () => {
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: { project: { id: "p1", status: "UNDER_REVIEW" } } });
    const result = await submitReview("p1", { action: "BEGIN_REVIEW", revision: 3 });
    expect(result.epoch).toBe(7);
    expect(apiClient).toHaveBeenCalledWith("/api/v1/projects/p1/review", expect.objectContaining({
      method: "POST",
      body: { action: "BEGIN_REVIEW", revision: 3 },
    }));
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: { project: { id: "p1", status: "REJECTED" } } });
    await submitReview("p1", { action: "REJECT", revision: 4, reason: "Missing drainage clearance." });
    expect(apiClient).toHaveBeenLastCalledWith("/api/v1/projects/p1/review", expect.objectContaining({
      body: { action: "REJECT", revision: 4, reason: "Missing drainage clearance." },
    }));
    vi.mocked(getMemoryAccessToken).mockReturnValue(null);
    await expect(fetchReviewQueue({ page: 1, limit: 10 })).rejects.toBeInstanceOf(ApiError);
  });
});
