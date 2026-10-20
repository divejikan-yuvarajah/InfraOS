import { describe, expect, it } from "vitest";

import { PUBLIC_HERO } from "./public-content";

describe("public hero copy", () => {
  it("states prototype positioning and avoids official claims", () => {
    const combined = Object.values(PUBLIC_HERO).join(" ").toLowerCase();
    expect(PUBLIC_HERO.prototypeNote.toLowerCase()).toContain("prototype");
    expect(combined).not.toMatch(/government approved|official national|live analytics/);
    expect(combined).not.toMatch(/\d+%/);
  });

  it("mentions ProjectTrace and RoadSync without AI authority wording", () => {
    expect(PUBLIC_HERO.modules).toMatch(/ProjectTrace/i);
    expect(PUBLIC_HERO.modules).toMatch(/RoadSync/i);
    expect(PUBLIC_HERO.modules.toLowerCase()).not.toMatch(
      /ai automatically approves|autonomously approves/,
    );
  });
});
