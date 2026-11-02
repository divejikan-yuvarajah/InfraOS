import { describe, expect, it } from "vitest";

import { clockState, diffLines, hubQuery, type Proposal } from "./coordination";
import { clockText, coordNoticeText, getCoordCopy } from "./coordination-copy";

const keysOf = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" ? (Array.isArray(o) ? [prefix] : Object.entries(o).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`))) : [prefix];

describe("steps 74-75 coordination helpers", () => {
  it("computes the deadline clock states", () => {
    const now = Date.parse("2026-06-10T10:00:00Z");
    expect(clockState("2026-06-12T14:00:00Z", false, now)).toMatchObject({ kind: "ok", days: 2, hours: 4 });
    expect(clockState("2026-06-10T15:00:00Z", false, now)).toMatchObject({ kind: "today" });
    expect(clockState("2026-06-08T09:00:00Z", false, now)).toMatchObject({ kind: "overdue", days: 2 });
    expect(clockState("2026-06-12T14:00:00Z", true, now).kind).toBe("closed");
  });

  it("composes clock text per state", () => {
    const copy = getCoordCopy("en");
    expect(clockText(copy, { kind: "ok", days: 1, hours: 4 })).toBe("Respond in 1 d 4 h");
    expect(clockText(copy, { kind: "today", days: 0, hours: 5 })).toBe("Due today");
    expect(clockText(copy, { kind: "overdue", days: 1, hours: 30 })).toBe("Overdue 1 d");
  });

  it("describes a schedule shift as dated lines with a day delta", () => {
    const p: Proposal = { type: "schedule_shift", before: { start: "2026-02-12T04:00:00.000Z", end: "2026-02-22T04:00:00.000Z" }, after: { start: "2026-03-03T04:00:00.000Z", end: "2026-03-13T04:00:00.000Z" } };
    const lines = diffLines(p);
    expect(lines[0]).toMatchObject({ field: "start", deltaDays: 19 });
    expect(lines[1]).toMatchObject({ field: "end", deltaDays: 19 });
  });

  it("builds the hub query from a preset and lets explicit filters win", () => {
    expect(new URLSearchParams(hubQuery(new URLSearchParams("preset=needs"), 1, 50)).get("needsMyResponse")).toBe("true");
    const q = new URLSearchParams(hubQuery(new URLSearchParams("preset=sent&status=agreed"), 2, 20));
    expect(q.get("role")).toBe("initiator");
    expect(q.get("status")).toBe("agreed");
    expect(q.get("page")).toBe("2");
  });

  it("composes a localized bell sentence from key + params only", () => {
    const text = coordNoticeText(getCoordCopy("en"), "roadsync.coordination.request_received", { initiator: "Agency A", conflictNo: "RSC-2026-000001", type: "schedule_shift" });
    expect(text).toBe("Agency A proposed a schedule shift on RSC-2026-000001");
  });

  it("keeps English, Sinhala and Tamil copy structurally identical", () => {
    const en = keysOf(getCoordCopy("en")).sort();
    expect(keysOf(getCoordCopy("si")).sort()).toEqual(en);
    expect(keysOf(getCoordCopy("ta")).sort()).toEqual(en);
  });
});
