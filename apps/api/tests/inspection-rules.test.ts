import { describe, expect, it } from "vitest";

import { checklistFor } from "../src/modules/inspections/inspection-checklists.js";
import { INSPECTION_STATUSES, INSPECTION_TYPES } from "../src/modules/inspections/inspection.constants.js";
import {
  calendarWindowOk, canTransition, colomboDayStart, discrepancyPp, haversineM, isOverdue, makerCheckerOk, overlaps, overThreshold, rejectAllowed,
  scheduleDateOk, sitePresence, sniffImage, startWindowOpen, submitGaps, TRANSITIONS, type Action,
} from "../src/modules/inspections/inspection.rules.js";

const NOW = new Date("2026-11-07T06:00:00Z");

describe("workflow transitions", () => {
  it("allows the documented legal paths and refuses sample illegal ones", () => {
    expect(canTransition("START", "SCHEDULED")).toBe(true);
    expect(canTransition("START", "IN_PROGRESS")).toBe(false);
    expect(canTransition("SUBMIT", "REQUIRES_REVIEW")).toBe(true);
    expect(canTransition("APPROVE", "SUBMITTED")).toBe(true);
    expect(canTransition("APPROVE", "REQUIRES_REVIEW")).toBe(false);
    expect(canTransition("CANCEL", "SUBMITTED")).toBe(false);
  });
  it("terminal statuses allow no action", () => {
    for (const status of ["VERIFIED", "REJECTED", "CANCELLED"] as const) for (const a of Object.keys(TRANSITIONS) as Action[]) expect(canTransition(a, status)).toBe(false);
  });
  it("covers every status in the enum", () => { expect(INSPECTION_STATUSES).toHaveLength(7); });
  it("reject from REQUIRES_REVIEW only at the submission cap", () => {
    expect(rejectAllowed("SUBMITTED", 1)).toBe(true);
    expect(rejectAllowed("REQUIRES_REVIEW", 3)).toBe(false);
    expect(rejectAllowed("REQUIRES_REVIEW", 6)).toBe(true);
  });
  it("maker-checker: reviewer differs from submitter and inspector", () => {
    expect(makerCheckerOk("a", "a", "a")).toBe(false);
    expect(makerCheckerOk("b", "a", "a")).toBe(true);
    expect(makerCheckerOk("a", "b", "a")).toBe(false);
  });
});

describe("dates", () => {
  it("overdue is derived for open statuses only", () => {
    const past = new Date("2026-11-06T06:00:00Z");
    expect(isOverdue("SCHEDULED", past, 120, NOW)).toBe(true);
    expect(isOverdue("VERIFIED", past, 120, NOW)).toBe(false);
    expect(isOverdue("SCHEDULED", new Date("2026-11-07T05:00:00Z"), 120, NOW)).toBe(false);
  });
  it("start window opens 24 h before", () => {
    expect(startWindowOpen(new Date("2026-11-08T05:00:00Z"), NOW)).toBe(true);
    expect(startWindowOpen(new Date("2026-11-09T06:00:00Z"), NOW)).toBe(false);
  });
  it("schedule date may not be more than an hour in the past", () => {
    expect(scheduleDateOk(new Date("2026-11-07T05:30:00Z"), NOW)).toBe(true);
    expect(scheduleDateOk(new Date("2026-11-07T04:00:00Z"), NOW)).toBe(false);
  });
  it("Colombo day start handles the UTC+5:30 boundary", () => {
    expect(colomboDayStart(new Date("2026-11-07T20:00:00Z")).toISOString()).toBe("2026-11-07T18:30:00.000Z");
    expect(colomboDayStart(new Date("2026-11-07T10:00:00Z")).toISOString()).toBe("2026-11-06T18:30:00.000Z");
  });
  it("calendar window is capped at 62 days", () => {
    expect(calendarWindowOk(new Date("2026-11-01"), new Date("2026-12-01"))).toBe(true);
    expect(calendarWindowOk(new Date("2026-11-01"), new Date("2027-02-01"))).toBe(false);
    expect(calendarWindowOk(new Date("2026-11-05"), new Date("2026-11-01"))).toBe(false);
  });
  it("overlap detection", () => {
    expect(overlaps(new Date("2026-11-08T09:00:00Z"), 120, new Date("2026-11-08T10:00:00Z"), 60)).toBe(true);
    expect(overlaps(new Date("2026-11-08T09:00:00Z"), 60, new Date("2026-11-08T10:00:00Z"), 60)).toBe(false);
  });
});

describe("discrepancy", () => {
  it("computes verified minus claimed and flags only above 10 pp", () => {
    expect(discrepancyPp(40, 55)).toBe(-15);
    expect(discrepancyPp(40, null)).toBeNull();
    expect(overThreshold(40, 55)).toBe(true);
    expect(overThreshold(45, 55)).toBe(false);
    expect(overThreshold(44, 55)).toBe(true);
    expect(overThreshold(40, null)).toBe(false);
  });
});

describe("submit completeness", () => {
  const full = (type: (typeof INSPECTION_TYPES)[number]) => checklistFor(type).map((i) => ({ key: i.key, result: "PASS", note: "" }));
  const ok = { checklist: full("PROGRESS_VERIFICATION"), defects: [], measuredProgress: 50, inspectorDeclaration: true };
  const photos = [{}, {}];
  it("a complete report has no gaps", () => { expect(submitGaps("PROGRESS_VERIFICATION", ok, photos, 50)).toEqual([]); });
  it("flags missing checklist answers", () => {
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, checklist: [] }, photos, 50)).toContain("checklist_incomplete");
  });
  it("FAIL needs a note and a linked photo", () => {
    const checklist = ok.checklist.map((c, i) => (i === 0 ? { ...c, result: "FAIL" } : c));
    const gaps = submitGaps("PROGRESS_VERIFICATION", { ...ok, checklist }, photos, 50);
    expect(gaps).toContain("fail_without_note");
    expect(gaps).toContain("fail_item_without_photo");
    const fixed = checklist.map((c, i) => (i === 0 ? { ...c, note: "cracked" } : c));
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, checklist: fixed }, [{ checklistItemKey: fixed[0]!.key }, {}], 50)).toEqual([]);
  });
  it("critical defects need a photo", () => {
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, defects: [{ key: "d1", severity: "CRITICAL" }] }, photos, 50)).toContain("critical_defect_without_photo");
  });
  it("evidence minimum depends on type", () => {
    expect(submitGaps("PROGRESS_VERIFICATION", ok, [{}], 50)).toContain("not_enough_evidence");
    expect(submitGaps("QUALITY", { checklist: full("QUALITY"), defects: [], inspectorDeclaration: true }, [{}], null)).toEqual([]);
  });
  it("measured progress and discrepancy note rules", () => {
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, measuredProgress: null }, photos, 50)).toContain("measured_progress_required");
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, measuredProgress: 30 }, photos, 55)).toContain("discrepancy_note_required");
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, measuredProgress: 30, discrepancyNote: "less work done" }, photos, 55)).toEqual([]);
  });
  it("declaration is required", () => {
    expect(submitGaps("PROGRESS_VERIFICATION", { ...ok, inspectorDeclaration: false }, photos, 50)).toContain("declaration_required");
  });
});

describe("site presence", () => {
  it("haversine is roughly right", () => {
    expect(Math.round(haversineM([79.86, 6.93], [79.86, 6.94]))).toBeGreaterThan(1050);
    expect(Math.round(haversineM([79.86, 6.93], [79.86, 6.93]))).toBe(0);
  });
  it("classifies on/near/away against the site point and falls back to geometry", () => {
    expect(sitePresence([79.86, 6.93], [79.8601, 6.93], null)?.status).toBe("ON_SITE");
    expect(sitePresence([79.86, 6.93], [79.865, 6.93], null)?.status).toBe("NEAR_SITE");
    expect(sitePresence([79.86, 6.93], [80.5, 7.5], null)?.status).toBe("AWAY");
    const line = { type: "LineString", coordinates: [[79.8601, 6.93], [79.87, 6.94]] };
    expect(sitePresence([79.86, 6.93], null, line)?.basis).toBe("project_geometry");
    expect(sitePresence([79.86, 6.93], null, null)).toBeNull();
  });
});

describe("magic bytes", () => {
  it("accepts real jpeg/png/webp and rejects forged or truncated data", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]))).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("checklist templates", () => {
  it("have unique keys and at least one mandatory item per type", () => {
    for (const t of INSPECTION_TYPES) {
      const items = checklistFor(t);
      expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
      expect(items.some((i) => i.mandatory)).toBe(true);
    }
  });
});
