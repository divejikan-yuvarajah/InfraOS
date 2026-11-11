import { describe, expect, it } from "vitest";

import { getCopilotCopy } from "./messages";
import { formatElapsed, isTerminalCopilotStatus, pollDelayMs, stepLabel } from "./poll";
import { isSafeInternalLink, splitCitationSegments } from "./view";

describe("copilot poll, step mapping and citation helpers", () => {
  const en = getCopilotCopy("en");

  it("computes bounded backoff and pauses when hidden", () => {
    expect(pollDelayMs(0, true)).toBe(600);
    expect(pollDelayMs(5_999, true)).toBe(600);
    expect(pollDelayMs(6_000, true)).toBe(900);
    expect(pollDelayMs(25_000, true)).toBe(1_200);
    expect(pollDelayMs(90_000, true)).toBe(false);
    expect(pollDelayMs(2_000, false)).toBe(false);
  });

  it("detects terminal turn statuses cleanly", () => {
    expect(isTerminalCopilotStatus("RUNNING")).toBe(false);
    expect(isTerminalCopilotStatus("ANSWERED")).toBe(true);
    expect(isTerminalCopilotStatus("PARTIAL")).toBe(true);
    expect(isTerminalCopilotStatus("INSUFFICIENT_EVIDENCE")).toBe(true);
    expect(isTerminalCopilotStatus("FAILED")).toBe(true);
    expect(isTerminalCopilotStatus("CANCELLED")).toBe(true);
    expect(isTerminalCopilotStatus("BLOCKED_BY_POLICY")).toBe(true);
  });

  it("maps step label keys and tool names cleanly", () => {
    expect(
      stepLabel(
        {
          at: "2026-11-11T00:00:00Z",
          kind: "TOOL",
          tool: "get_project_risk",
          status: "OK",
          labelKey: "copilot.step.get_project_risk",
          durationMs: 120,
        },
        en,
      ),
    ).toBe(en.steps["copilot.step.get_project_risk"]);

    expect(
      stepLabel(
        {
          at: "2026-11-11T00:00:00Z",
          kind: "TOOL",
          tool: "get_project_finance_summary",
          status: "DENIED",
          labelKey: "copilot.step.permission_denied",
          durationMs: 12,
        },
        en,
      ),
    ).toBe(en.steps["copilot.step.permission_denied"]);
  });

  it("formats elapsed counters and splits citations without parsing HTML/URLs", () => {
    expect(formatElapsed(8400, en)).toBe("8s");
    expect(formatElapsed(65000, en)).toBe("1m 5s");

    expect(splitCitationSegments("Progress is 45% [1] with open defects [2, 3].")).toEqual([
      { kind: "text", value: "Progress is 45% " },
      { kind: "cite", nums: [1] },
      { kind: "text", value: " with open defects " },
      { kind: "cite", nums: [2, 3] },
      { kind: "text", value: "." },
    ]);

    expect(isSafeInternalLink("/projects/123/overview")).toBe(true);
    expect(isSafeInternalLink("https://evil.example")).toBe(false);
    expect(isSafeInternalLink("//evil.example")).toBe(false);
  });
});

