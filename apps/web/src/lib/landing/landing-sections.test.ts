import { describe, expect, it } from "vitest";

import { getPublicCopy } from "./messages";
import {
  PROBLEM_SECTION_ANCHOR,
  SOLUTION_SECTION_ANCHOR,
  getPublicHomeSectionLinks,
} from "./navigation";
import { PUBLIC_PROBLEM, PUBLIC_SOLUTION } from "./public-content";

describe("public landing sections (Step 26)", () => {
  it("uses unique problem and solution anchor ids", () => {
    expect(PROBLEM_SECTION_ANCHOR).toBe("problem");
    expect(SOLUTION_SECTION_ANCHOR).toBe("solution");
    expect(PROBLEM_SECTION_ANCHOR).not.toBe(SOLUTION_SECTION_ANCHOR);
  });

  it("wires homepage section links to implemented anchors", () => {
    const hrefs = getPublicHomeSectionLinks(getPublicCopy("en")).map((item) => item.href);
    expect(hrefs).toContain(`#${PROBLEM_SECTION_ANCHOR}`);
    expect(hrefs).toContain(`#${SOLUTION_SECTION_ANCHOR}`);
  });

  it("defines four problem cards and a three-step solution flow", () => {
    expect(PUBLIC_PROBLEM.cards).toHaveLength(4);
    expect(PUBLIC_SOLUTION.flowSteps).toHaveLength(3);
    expect(PUBLIC_SOLUTION.flowSteps.map((s) => s.title)).toEqual([
      "Share plan",
      "Detect overlap",
      "Coordinate early",
    ]);
  });

  it("avoids unsupported claims in problem/solution copy", () => {
    const text = [
      PUBLIC_PROBLEM.title,
      PUBLIC_PROBLEM.intro,
      ...PUBLIC_PROBLEM.cards.map((c) => c.body),
      PUBLIC_SOLUTION.intro,
      ...PUBLIC_SOLUTION.flowSteps.map((s) => s.body),
    ]
      .join(" ")
      .toLowerCase();

    expect(text).not.toMatch(/government approved|official national|\d+%/);
    expect(text).toMatch(/roadsync/i);
    expect(text).toMatch(/projecttrace/i);
    expect(PUBLIC_SOLUTION.flowSteps[1]?.body.toLowerCase()).toMatch(/deterministic/);
  });
});
