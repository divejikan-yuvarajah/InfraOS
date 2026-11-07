import { describe, expect, it, vi } from "vitest";

import { afterFailure, AUTOSAVE_MAX_TRIES, autosaveBackoffMs, clearMirror, mirrorKey, readMirror, shouldOfferRecovery, writeMirror } from "./autosave";
import { addDays, colomboToIso, dayKey, groupByDay, isoToColomboParts, keyMove, monthGrid, startOfWeek, weekdayIndex, windowFor } from "./calendar-math";
import { checkInput, fitWithin } from "./image-pipeline";
import { DEFAULT_FILTERS, parseFilters, toApiQuery, toParams } from "./list-query";
import { INSPECTION_COPY, keyPaths } from "./messages";
import { backoffMs, MAX_ATTEMPTS, UploadQueue } from "./upload-queue";
import { clientGaps, discrepancy, emptyReport, overThreshold } from "./view";

describe("calendar maths (Asia/Colombo)", () => {
  it("day key shifts across the UTC+5:30 boundary", () => {
    expect(dayKey(new Date("2026-11-07T20:00:00Z"))).toBe("2026-11-08");
    expect(dayKey(new Date("2026-11-07T10:00:00Z"))).toBe("2026-11-07");
  });
  it("month grid is always 42 Monday-first cells with correct month flags", () => {
    const grid = monthGrid(new Date("2026-02-15T06:00:00Z"), new Date("2026-02-15T06:00:00Z"));
    expect(grid).toHaveLength(42);
    expect(weekdayIndex(grid[0]!.start)).toBe(0);
    expect(grid.filter((c) => c.inMonth)).toHaveLength(28);
    expect(grid.filter((c) => c.isToday)).toHaveLength(1);
  });
  it("month boundaries: a February that starts on Sunday needs the previous Monday", () => {
    const grid = monthGrid(new Date("2026-02-01T06:00:00Z"));
    expect(grid[0]!.key).toBe("2026-01-26");
  });
  it("API windows stay within 62 days", () => {
    const m = windowFor("month", new Date("2026-12-10T06:00:00Z"));
    expect((m.to.getTime() - m.from.getTime()) / 86_400_000).toBeLessThanOrEqual(62);
    expect(windowFor("agenda", new Date()).to.getTime() - windowFor("agenda", new Date()).from.getTime()).toBe(30 * 86_400_000);
  });
  it("week starts on Monday; arrow keys move by day and week", () => {
    expect(weekdayIndex(startOfWeek(new Date("2026-11-07T06:00:00Z")))).toBe(0);
    const d = new Date("2026-11-07T06:00:00Z");
    expect(keyMove("ArrowRight", d)?.getTime()).toBe(addDays(d, 1).getTime());
    expect(keyMove("ArrowUp", d)?.getTime()).toBe(addDays(d, -7).getTime());
    expect(keyMove("x", d)).toBeNull();
  });
  it("groups rows by Colombo day and round-trips form values", () => {
    const g = groupByDay([{ inspectionDate: "2026-11-07T20:00:00Z" }, { inspectionDate: "2026-11-08T03:00:00Z" }]);
    expect([...g.keys()]).toEqual(["2026-11-08"]);
    const iso = colomboToIso("2026-11-08", "09:30")!;
    expect(isoToColomboParts(iso)).toEqual({ date: "2026-11-08", time: "09:30" });
    expect(colomboToIso("bad", "09:30")).toBeNull();
  });
});

describe("image pipeline maths", () => {
  it("fits the long edge without upscaling", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 0, 320)).toEqual({ width: 1, height: 1 });
  });
  it("rejects unsupported and empty input", () => {
    expect(checkInput({ type: "image/heic", size: 100 })).toEqual({ ok: false, reason: "unsupported_type" });
    expect(checkInput({ type: "image/jpeg", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(checkInput({ type: "image/webp", size: 1000 })).toEqual({ ok: true });
  });
});

describe("upload queue state machine", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it("uploads with limited parallelism and marks done", async () => {
    let running = 0, peak = 0;
    const q = new UploadQueue<null>(async () => { running += 1; peak = Math.max(peak, running); await flush(); running -= 1; });
    for (const id of ["a", "b", "c", "d"]) q.add(id, null);
    await new Promise((r) => setTimeout(r, 20));
    expect(peak).toBeLessThanOrEqual(2);
    expect(q.getSnapshot().every((i) => i.state === "done")).toBe(true);
    q.dispose();
  });
  it("retries transient failures with backoff and fails permanent ones immediately", async () => {
    vi.useFakeTimers();
    let n = 0;
    const q = new UploadQueue<null>(async () => { n += 1; if (n < 3) throw new Error("net"); }, (e) => (e as Error).message === "perm");
    q.add("x", null);
    await vi.advanceTimersByTimeAsync(0);
    expect(q.getSnapshot()[0]!.state).toBe("queued");
    await vi.advanceTimersByTimeAsync(backoffMs(1) + 5);
    await vi.advanceTimersByTimeAsync(backoffMs(2) + 5);
    expect(q.getSnapshot()[0]!.state).toBe("done");
    const p = new UploadQueue<null>(async () => { throw new Error("perm"); }, (e) => (e as Error).message === "perm");
    p.add("y", null);
    await vi.advanceTimersByTimeAsync(0);
    expect(p.getSnapshot()[0]).toMatchObject({ state: "failed", attempts: 1 });
    p.retry("y");
    await vi.advanceTimersByTimeAsync(0);
    expect(p.getSnapshot()[0]!.state).toBe("failed");
    q.dispose(); p.dispose();
    vi.useRealTimers();
  });
  it("gives up after the maximum attempts and supports cancel and remove", async () => {
    vi.useFakeTimers();
    const q = new UploadQueue<null>(async () => { throw new Error("net"); });
    q.add("z", null);
    for (let i = 0; i < MAX_ATTEMPTS + 1; i += 1) await vi.advanceTimersByTimeAsync(20_000);
    expect(q.getSnapshot()[0]).toMatchObject({ state: "failed", attempts: MAX_ATTEMPTS });
    q.remove("z");
    expect(q.getSnapshot()).toHaveLength(0);
    const slow = new UploadQueue<null>((_i, _p, signal) => new Promise((_res, rej) => signal.addEventListener("abort", () => rej(new Error("aborted")))));
    slow.add("s", null);
    await vi.advanceTimersByTimeAsync(0);
    slow.cancel("s");
    await vi.advanceTimersByTimeAsync(0);
    expect(slow.getSnapshot()[0]!.state).toBe("cancelled");
    q.dispose(); slow.dispose();
    vi.useRealTimers();
  });
});

describe("autosave policy and draft mirror", () => {
  it("backoff doubles and is capped; failures decide the next state", () => {
    expect(autosaveBackoffMs(1)).toBe(1500);
    expect(autosaveBackoffMs(3)).toBe(6000);
    expect(autosaveBackoffMs(20)).toBe(30_000);
    expect(afterFailure(409, 1)).toEqual({ state: "conflict", retryInMs: null });
    expect(afterFailure(403, 1).state).toBe("failed");
    expect(afterFailure(0, 2)).toEqual({ state: "retrying", retryInMs: 3000 });
    expect(afterFailure(503, AUTOSAVE_MAX_TRIES).state).toBe("failed");
  });
  it("mirror round-trips, tolerates bad data and a blocked store, and recovery needs a newer base", () => {
    const store = new Map<string, string>();
    const s = { setItem: (k: string, v: string) => void store.set(k, v), getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => void store.delete(k) };
    writeMirror(s, "i1", 4, { a: 1 }, 10);
    expect(readMirror<{ a: number }>(s, "i1")).toEqual({ v: 1, savedAt: 10, baseRevision: 4, draft: { a: 1 } });
    store.set(mirrorKey("i2"), "not json");
    expect(readMirror(s, "i2")).toBeNull();
    clearMirror(s, "i1");
    expect(readMirror(s, "i1")).toBeNull();
    writeMirror({ setItem: () => { throw new Error("blocked"); } }, "i3", 1, {});
    expect(shouldOfferRecovery({ v: 1, savedAt: 1, baseRevision: 5, draft: {} }, 5, true)).toBe(true);
    expect(shouldOfferRecovery({ v: 1, savedAt: 1, baseRevision: 3, draft: {} }, 5, true)).toBe(false);
    expect(shouldOfferRecovery(null, 5, true)).toBe(false);
    expect(shouldOfferRecovery({ v: 1, savedAt: 1, baseRevision: 5, draft: {} }, 5, false)).toBe(false);
  });
});

describe("list query round trip", () => {
  it("parses, drops unknown values and round-trips through the URL", () => {
    const sp = new URLSearchParams("q=bridge&status=SCHEDULED,BOGUS,SUBMITTED&type=QUALITY&priority=nope&overdue=true&sort=date_desc&page=3&projectId=abc");
    const f = parseFilters((k) => sp.get(k));
    expect(f).toMatchObject({ q: "bridge", status: ["SCHEDULED", "SUBMITTED"], type: "QUALITY", priority: "", overdue: true, sort: "date_desc", page: 3, projectId: "" });
    const again = parseFilters((k) => toParams(f).get(k));
    expect(again).toEqual(f);
    expect(toParams(DEFAULT_FILTERS).toString()).toBe("");
    expect(toApiQuery({ ...DEFAULT_FILTERS, dateFrom: "2026-11-01" }).dateFrom).toBe("2026-10-31T18:30:00.000Z");
  });
});

describe("discrepancy and submit gaps (mirror of the server rule)", () => {
  it("exactly 10 points is not over the threshold", () => {
    expect(discrepancy(40, 55)).toBe(-15);
    expect(overThreshold(45, 55)).toBe(false);
    expect(overThreshold(44, 55)).toBe(true);
    expect(overThreshold(null, 55)).toBe(false);
  });
  it("reports each missing item", () => {
    const template = [{ key: "a", mandatory: true }, { key: "b", mandatory: false }];
    const base = { ...emptyReport(), checklist: [{ key: "a", result: "PASS" as const }], measuredProgress: 50, inspectorDeclaration: true };
    const ev = [{ checklistItemKey: null, defectKey: null, status: "ACTIVE" }, { checklistItemKey: null, defectKey: null, status: "ACTIVE" }];
    expect(clientGaps({ type: "PROGRESS_VERIFICATION", template, report: base, evidence: ev, claimed: 50 })).toEqual([]);
    expect(clientGaps({ type: "PROGRESS_VERIFICATION", template, report: { ...base, checklist: [] }, evidence: ev, claimed: 50 })).toContain("checklist_incomplete");
    expect(clientGaps({ type: "PROGRESS_VERIFICATION", template, report: { ...base, measuredProgress: 20 }, evidence: ev, claimed: 50 })).toContain("discrepancy_note_required");
    expect(clientGaps({ type: "QUALITY", template, report: base, evidence: [{ checklistItemKey: null, defectKey: null, status: "PENDING_UPLOAD" }], claimed: null })).toEqual(expect.arrayContaining(["evidence_uploading", "not_enough_evidence"]));
  });
});

describe("i18n parity", () => {
  it("en, si and ta have identical key trees and no empty strings", () => {
    const en = keyPaths(INSPECTION_COPY.en).sort();
    expect(keyPaths(INSPECTION_COPY.si).sort()).toEqual(en);
    expect(keyPaths(INSPECTION_COPY.ta).sort()).toEqual(en);
    const walk = (v: unknown): string[] => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(walk) : []);
    for (const l of ["en", "si", "ta"] as const) expect(walk(INSPECTION_COPY[l]).every((s) => s.trim().length > 0)).toBe(true);
  });
  it("placeholders match between languages", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const flat = (v: unknown, p = ""): [string, string][] => (typeof v === "string" ? [[p, v]] : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => flat(x, p ? `${p}.${k}` : k)) : []);
    const en = new Map(flat(INSPECTION_COPY.en));
    for (const l of ["si", "ta"] as const) for (const [k, v] of flat(INSPECTION_COPY[l])) expect(ph(v), `${l}:${k}`).toBe(ph(en.get(k)!));
  });
  it("checklist labels exist for every server template key", () => {
    const keys = ["work_matches_plan", "quantities_measured", "milestone_status_confirmed", "materials_on_site", "site_access_ok", "surface_finish", "thickness_recorded", "materials_compliant", "drainage_functional", "defects_recorded", "signage_present", "barriers_traffic_management", "ppe_used", "site_hygiene", "incident_log_available", "works_complete", "defects_liability_noted", "as_built_documents_sighted", "site_cleared", "milestone_evidence_sighted", "previous_defects_rechecked", "rework_completed", "site_safe"];
    for (const l of ["en", "si", "ta"] as const) for (const k of keys) expect((INSPECTION_COPY[l].checklist as Record<string, string>)[k], `${l}:${k}`).toBeTruthy();
  });
});
