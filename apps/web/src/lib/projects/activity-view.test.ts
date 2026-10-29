import { describe, expect, it } from "vitest";

import { canLinkActivity, formatActivityWhen } from "./activity-view";

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
});
