import { describe, expect, it } from "vitest";

import { ackSlaDue, apiQuery, impactTone, ringFraction, slaState, stepPath, type HistoryPoint } from "./conflict-records";
import { getConflictCopy, ringText, slaText } from "./conflict-records-copy";

const keysOf = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`)) : [prefix];

describe("steps 72-73 conflict record helpers", () => {
  it("owes an acknowledgement deadline only on open records that are still pending", () => {
    const pending = { ackStatus: "pending", ackDueAt: "2026-06-15T10:00:00Z" };
    expect(ackSlaDue("open", pending)).toBe("2026-06-15T10:00:00Z");
    expect(ackSlaDue("negotiating", pending)).toBe("2026-06-15T10:00:00Z");
    for (const closed of ["resolved", "dismissed", "auto_closed", "withdrawn"]) expect(ackSlaDue(closed, pending)).toBeNull();
    expect(ackSlaDue("open", { ackStatus: "acknowledged", ackDueAt: "2026-06-15T10:00:00Z" })).toBeNull();
    expect(ackSlaDue("open", null)).toBeNull();
  });

  it("computes the SLA clock states", () => {
    const now = Date.parse("2026-06-10T10:00:00Z");
    expect(slaState(null, now)).toEqual({ kind: "none" });
    expect(slaState("2026-06-15T10:00:00Z", now)).toMatchObject({ kind: "later", hours: 120 });
    expect(slaState("2026-06-10T15:00:00Z", now)).toEqual({ kind: "today" });
    expect(slaState("2026-06-08T09:00:00Z", now)).toMatchObject({ kind: "overdue", days: 2 });
  });

  it("depletes the time ring across the final 30 days and tones by urgency", () => {
    expect(ringFraction(45)).toBe(1);
    expect(ringFraction(15)).toBe(0.5);
    expect(ringFraction(null)).toBe(0);
    expect(impactTone({ state: "upcoming", days: 2, dayIndex: null, totalDays: 5 })).toBe("urgent");
    expect(impactTone({ state: "upcoming", days: 9, dayIndex: null, totalDays: 5 })).toBe("soon");
    expect(impactTone({ state: "active", days: 0, dayIndex: 3, totalDays: 14 })).toBe("active");
  });

  it("builds the API query from a preset and lets explicit URL filters win", () => {
    expect(apiQuery(new URLSearchParams("preset=needsMyAck"), 1, 50)).toContain("needsMyAck=true");
    const q = new URLSearchParams(apiQuery(new URLSearchParams("preset=criticalHigh&band=critical"), 2, 20));
    expect(q.get("band")).toBe("critical");
    expect(q.get("page")).toBe("2");
    expect(new URLSearchParams(apiQuery(new URLSearchParams(), 1, 50)).get("status")).toBe("open,acknowledged");
  });

  it("draws a step line that holds each score until the next point", () => {
    const h = [{ at: "2026-06-01T00:00:00Z", score: 60 }, { at: "2026-06-03T00:00:00Z", score: 80 }] as HistoryPoint[];
    const d = stepPath(h, 100, 100, Date.parse("2026-06-05T00:00:00Z"));
    expect(d.startsWith("M0 40.0 H50.0 V20.0")).toBe(true);
    expect(d.endsWith("H100")).toBe(true);
  });

  it("keeps English, Sinhala and Tamil copy structurally identical", () => {
    const en = keysOf(getConflictCopy("en")).sort();
    expect(keysOf(getConflictCopy("si")).sort()).toEqual(en);
    expect(keysOf(getConflictCopy("ta")).sort()).toEqual(en);
  });

  it("composes localized SLA and ring text", () => {
    const copy = getConflictCopy("en");
    expect(slaText(copy, { kind: "overdue", days: 2, hours: 50 })).toBe("Overdue 2 d");
    expect(slaText(copy, { kind: "later", hours: 5 })).toBe("Ack due in 5 h");
    expect(ringText(copy, { state: "upcoming", days: 9, dayIndex: null, totalDays: 4 })).toBe("Starts in 9 d");
    expect(ringText(copy, { state: "active", days: 0, dayIndex: 3, totalDays: 14 })).toBe("Active · day 3/14");
  });
});
