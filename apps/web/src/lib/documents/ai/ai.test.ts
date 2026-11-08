import { describe, expect, it } from "vitest";

import { keyPaths } from "../messages";
import { AI_COPY } from "./messages";
import { chipKind, jobDurationSeconds, pollInterval, stageStates, percent } from "./view";

describe("AI processing messages", () => {
  it("en, si and ta share one key tree, no value is empty and placeholders match", () => {
    const base = keyPaths(AI_COPY.en).sort();
    expect(keyPaths(AI_COPY.si).sort()).toEqual(base);
    expect(keyPaths(AI_COPY.ta).sort()).toEqual(base);
    const flat = (c: unknown, p = ""): [string, string][] => (typeof c === "string" ? [[p, c]] : Object.entries(c as object).flatMap(([k, v]) => flat(v, `${p}.${k}`)));
    const en = new Map(flat(AI_COPY.en));
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const l of ["si", "ta"] as const) for (const [k, v] of flat(AI_COPY[l])) { expect(v.trim(), `${l}${k}`).not.toBe(""); expect(ph(v), `${l}${k}`).toBe(ph(en.get(k)!)); }
  });
  it("covers every error, warning, reason and job status the API can return", async () => {
    const shared = await import("@infraos/shared-types");
    for (const l of ["en", "si", "ta"] as const) {
      for (const c of shared.AI_ERROR_CODES) expect((AI_COPY[l].error as Record<string, string>)[c], `${l}.error.${c}`).toBeTruthy();
      for (const c of shared.AI_WARNING_CODES) { expect((AI_COPY[l].warning as Record<string, string>)[c], `${l}.warning.${c}`).toBeTruthy(); expect((AI_COPY[l].warningHelp as Record<string, string>)[c]).toBeTruthy(); }
      for (const c of shared.AI_INELIGIBLE_REASONS) { expect((AI_COPY[l].reason as Record<string, string>)[c], `${l}.reason.${c}`).toBeTruthy(); expect((AI_COPY[l].reasonHelp as Record<string, string>)[c]).toBeTruthy(); }
      for (const c of shared.AI_JOB_STATUSES) expect((AI_COPY[l].jobStatus as Record<string, string>)[c], `${l}.jobStatus.${c}`).toBeTruthy();
      for (const c of shared.AI_JOB_TRIGGERS) expect((AI_COPY[l].trigger as Record<string, string>)[c], `${l}.trigger.${c}`).toBeTruthy();
    }
  });
});

describe("chip derivation", () => {
  const base = { allowed: true, eligibleType: true };
  it.each([
    [{ ...base, extractedTextStatus: "NOT_STARTED" }, "NOT_PROCESSED"],
    [{ ...base, extractedTextStatus: "QUEUED" }, "QUEUED"],
    [{ ...base, extractedTextStatus: "PROCESSING" }, "PROCESSING"],
    [{ ...base, extractedTextStatus: "COMPLETED" }, "READY"],
    [{ ...base, extractedTextStatus: "COMPLETED", warningCount: 2 }, "ATTENTION"],
    [{ ...base, extractedTextStatus: "COMPLETED", truncated: true }, "ATTENTION"],
    [{ ...base, extractedTextStatus: "FAILED" }, "FAILED"],
    [{ ...base, extractedTextStatus: "UNSUPPORTED" }, "UNSUPPORTED"],
    [{ ...base, extractedTextStatus: "UNSUPPORTED", errorCode: "SCANNED_NO_TEXT" }, "SCANNED"],
    [{ allowed: false, eligibleType: true, extractedTextStatus: "NOT_STARTED" }, "EXCLUDED"],
    [{ allowed: true, eligibleType: false, extractedTextStatus: "NOT_STARTED" }, "NOT_ELIGIBLE"],
    [{ allowed: false, eligibleType: false, extractedTextStatus: "COMPLETED" }, "NOT_ELIGIBLE"],
  ] as const)("%j -> %s", (ai, kind) => expect(chipKind(ai)).toBe(kind));
  it("a document the server says is not COMPLETED is never AI-ready", () => {
    for (const s of ["NOT_STARTED", "QUEUED", "PROCESSING", "FAILED", "UNSUPPORTED"]) expect(chipKind({ allowed: true, eligibleType: true, extractedTextStatus: s })).not.toBe("READY");
  });
});

describe("stepper and polling helpers", () => {
  const stage = (key: string, status: string) => ({ key, status, startedAt: null, finishedAt: null, errorCode: null }) as never;
  it("maps job stages and terminal states", () => {
    const run = { status: "RUNNING", stages: [stage("EXTRACT", "DONE"), stage("CHUNK", "RUNNING"), stage("EMBED", "PENDING"), stage("INDEX", "PENDING")] } as never;
    expect(stageStates(run).map((s) => s.status)).toEqual(["DONE", "RUNNING", "PENDING", "PENDING"]);
    expect(stageStates({ status: "SUCCEEDED", stages: [] } as never).every((s) => s.status === "DONE")).toBe(true);
    expect(stageStates({ status: "CANCELLED", stages: [stage("EXTRACT", "DONE")] } as never).map((s) => s.status)).toEqual(["DONE", "SKIPPED", "SKIPPED", "SKIPPED"]);
    expect(stageStates(null).every((s) => s.status === "PENDING")).toBe(true);
    expect(stageStates(null, true).every((s) => s.status === "DONE")).toBe(true);
  });
  it("polls every 3 s, backs off to 15 s, pauses when hidden and stops when terminal", () => {
    expect(pollInterval({ status: "RUNNING" }, 0, false)).toBe(3000);
    expect(pollInterval({ status: "QUEUED" }, 19, false)).toBe(3000);
    expect(pollInterval({ status: "QUEUED" }, 20, false)).toBe(15000);
    expect(pollInterval({ status: "RUNNING" }, 0, true)).toBe(false);
    for (const s of ["SUCCEEDED", "FAILED", "CANCELLED", "SKIPPED"]) expect(pollInterval({ status: s as never }, 0, false)).toBe(false);
    expect(pollInterval(null, 0, false)).toBe(false);
  });
  it("durations and percentages are safe", () => {
    expect(jobDurationSeconds({ startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:01:05Z" })).toBe(65);
    expect(jobDurationSeconds({ startedAt: null, finishedAt: null })).toBeNull();
    expect(percent(50, 200)).toBe(25);
    expect(percent(5, 0)).toBe(0);
    expect(percent(500, 100)).toBe(100);
  });
});
