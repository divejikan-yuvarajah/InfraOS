import { describe, expect, it } from "vitest";

import { PUBLIC_HERO, PUBLIC_PROBLEM, PUBLIC_SOLUTION } from "./public-content";
import { SOLUTION_SECTION_ANCHOR } from "./navigation";

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

  it("points hero CTA copy at the solution section (Step 26)", () => {
    expect(PUBLIC_HERO.ctaPrimaryLabel.toLowerCase()).toContain("infraos");
    expect(SOLUTION_SECTION_ANCHOR).toBe("solution");
    expect(PUBLIC_SOLUTION.intro).toMatch(/RoadSync/i);
    expect(PUBLIC_PROBLEM.cards.length).toBeGreaterThanOrEqual(3);
  });
});
