import { describe, expect, it } from "vitest";

import {
  formatContextSummary,
  isSafeInternalLink,
  splitCitationSegments,
} from "./view";
import { COPILOT_EN } from "./messages-en";

describe("copilot view helpers", () => {
  it("splits numeric citations cleanly without interpreting markdown links", () => {
    const out = splitCitationSegments(
      "Reported progress is 45% [1] vs verified 30% [2, 3]. See [ignored](https://evil.test).",
    );
    expect(out).toEqual([
      { kind: "text", value: "Reported progress is 45% " },
      { kind: "cite", nums: [1] },
      { kind: "text", value: " vs verified 30% " },
      { kind: "cite", nums: [2, 3] },
      { kind: "text", value: ". See [ignored](https://evil.test)." },
    ]);
  });

  it("allows strictly safe internal links and rejects external or protocol-relative URLs", () => {
    expect(isSafeInternalLink("/projects/123/risk")).toBe(true);
    expect(isSafeInternalLink("/inspections/abc?tab=review")).toBe(true);
    expect(isSafeInternalLink("https://evil.example/steal")).toBe(false);
    expect(isSafeInternalLink("http://localhost:3000/projects")).toBe(false);
    expect(isSafeInternalLink("//evil.example/steal")).toBe(false);
    expect(isSafeInternalLink("/\\evil.example")).toBe(false);
    expect(isSafeInternalLink("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalLink("/projects\n//evil")).toBe(false);
    expect(isSafeInternalLink("")).toBe(false);
    expect(isSafeInternalLink(null)).toBe(false);
  });

  it("formats context summary with short record suffix", () => {
    expect(
      formatContextSummary(
        { type: "PROJECT", route: "/projects/65f1a2b3c4d5e6f7a8b9c0d1", recordId: "65f1a2b3c4d5e6f7a8b9c0d1" },
        COPILOT_EN,
      ),
    ).toBe("Project · #b9c0d1");
    expect(formatContextSummary({ type: "DASHBOARD", route: "/dashboard" }, COPILOT_EN)).toBe("Portfolio");
  });
});
