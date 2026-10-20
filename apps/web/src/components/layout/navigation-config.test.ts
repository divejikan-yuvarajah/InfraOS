import { describe, expect, it } from "vitest";

import { APP_NAVIGATION, availableNavigation, FUTURE_NAVIGATION_PREVIEW } from "./navigation-config";

describe("application navigation", () => {
  it("exposes only existing routes as available links", () => {
    const live = availableNavigation();
    expect(live.map((item) => item.href)).toEqual(["/"]);
    expect(APP_NAVIGATION.every((item) => item.isAvailable)).toBe(true);
  });

  it("keeps future modules unavailable", () => {
    expect(FUTURE_NAVIGATION_PREVIEW.every((item) => !item.isAvailable && !item.href)).toBe(true);
  });
});
