import { describe, expect, it } from "vitest";

import { classifyAppPath } from "@/lib/auth/route-access";

import { groupCanonical } from "@/components/finance/finance-ui";
import { formatLkr, formatLkrCompact, hundredthsToIndex, minorToDecimal, parseAmount, percentFromBp, ppFromTenths, splitLkr } from "./money";
import { FINANCE_COPY, keyPaths } from "./messages";
import { expenseTabQuery, paymentTabQuery, parseExpenseTab, parsePaymentTab } from "./url-state";
import { failureText, fill, flagText, gateText, presetRange, quadrantPoints, spendingAhead, stepsFor } from "./view";
import type { Gate, PortfolioRow } from "./types";

describe("amount parsing: strings to integer cents, never floats, never rounded", () => {
  it("accepts plain decimals and thousands separators", () => {
    expect(parseAmount("1,250,000.5")).toEqual({ ok: true, minor: 125_000_050, canonical: "1250000.50" });
    expect(parseAmount("0.10")).toMatchObject({ ok: true, minor: 10 });
    expect(parseAmount(".5")).toMatchObject({ ok: true, minor: 50 });
    expect(parseAmount("19999.99")).toMatchObject({ ok: true, minor: 1_999_999, canonical: "19999.99" });
    expect(parseAmount("007")).toMatchObject({ ok: true, minor: 700, canonical: "7.00" });
  });
  it("avoids the 0.1 + 0.2 and 1.005 traps by rejecting instead of rounding", () => {
    expect(parseAmount("0.3")).toMatchObject({ minor: 30 });
    expect(parseAmount("1.005")).toEqual({ ok: false, reason: "decimals" });
    expect(parseAmount("0.001")).toEqual({ ok: false, reason: "decimals" });
  });
  it("rejects empty, negative, zero, junk, too many digits and unsafe sizes", () => {
    expect(parseAmount("")).toEqual({ ok: false, reason: "empty" });
    expect(parseAmount("-5")).toMatchObject({ ok: false });
    expect(parseAmount("0")).toEqual({ ok: false, reason: "zero" });
    expect(parseAmount("0.00")).toEqual({ ok: false, reason: "zero" });
    expect(parseAmount("abc")).toMatchObject({ ok: false });
    expect(parseAmount("1.2.3")).toMatchObject({ ok: false });
    expect(parseAmount("1,,2")).toMatchObject({ ok: false });
    expect(parseAmount("1234567890123456")).toEqual({ ok: false, reason: "digits" });
    expect(parseAmount("99999999999999.99")).toEqual({ ok: false, reason: "range" });
    expect(parseAmount("90071992547409.91")).toMatchObject({ ok: true, minor: Number.MAX_SAFE_INTEGER });
    expect(parseAmount("90071992547409.92")).toEqual({ ok: false, reason: "range" });
  });
  it("round-trips through the API decimal string and display grouping", () => {
    expect(minorToDecimal(1_999_999)).toBe("19999.99");
    expect(minorToDecimal(5)).toBe("0.05");
    expect(groupCanonical("1250000.50")).toBe("1,250,000.50");
    const p = parseAmount(groupCanonical("1250000.50"));
    expect(p).toMatchObject({ ok: true, minor: 125_000_050 });
  });
});

describe("money formatting", () => {
  it("formats exact cents and compact KPI forms from integers", () => {
    expect(formatLkr(1_999_999, "en")).toBe("Rs. 19,999.99");
    expect(formatLkr(5, "en")).toBe("Rs. 0.05");
    expect(formatLkr(-1, "en")).toBe("—");
    expect(formatLkr(1.5, "en")).toBe("—");
    expect(splitLkr(125_000_050, "en")).toEqual({ prefix: "Rs.", whole: "1,250,000", cents: "50" });
    const units = { k: "K", mn: "Mn", bn: "Bn" };
    expect(formatLkrCompact(1_245_000_000, "en", units)).toBe("Rs. 12.45 Mn");
    expect(formatLkrCompact(150_000_000_000, "en", units)).toBe("Rs. 1.50 Bn");
    expect(formatLkrCompact(25_000_000, "en", units)).toBe("Rs. 250.00 K");
    expect(formatLkrCompact(9_999, "en", units)).toBe("Rs. 99.99");
  });
  it("percentages and indices come from integers; missing is a dash, never 0", () => {
    expect(percentFromBp(8333)).toBe("83.33%");
    expect(percentFromBp(5000)).toBe("50%");
    expect(percentFromBp(5050)).toBe("50.5%");
    expect(percentFromBp(null)).toBe("—");
    expect(ppFromTenths(125)).toBe("+12.5 pp");
    expect(ppFromTenths(-500)).toBe("−50.0 pp");
    expect(ppFromTenths(null)).toBe("—");
    expect(hundredthsToIndex(80)).toBe("0.80");
    expect(hundredthsToIndex(125)).toBe("1.25");
  });
});

const row = (patch: Partial<PortfolioRow>): PortfolioRow => ({ id: "1", code: "INF-ROAD-1", title: "T", status: "ACTIVE", agencyId: "a", contractor: null, budgetMinor: 100, paidMinor: 10, approvedUnpaidMinor: 0, pendingMinor: 0, committedMinor: 10, utilizationBp: 1000, financialBp: 1000, physicalBp: 3000, basis: "VERIFIED_INSPECTION", gapTenths: -200, flags: [], ...patch });

describe("quadrant data mapping", () => {
  it("plots only projects that have a progress figure and a financial figure", () => {
    const pts = quadrantPoints([row({ id: "a" }), row({ id: "b", physicalBp: null, basis: "NONE" }), row({ id: "c", financialBp: null }), row({ id: "d", basis: "NONE", physicalBp: 2000 })]);
    expect(pts.map((p) => p.id)).toEqual(["a"]);
    expect(pts[0]).toMatchObject({ x: 30, y: 10, basis: "VERIFIED_INSPECTION", severity: "NONE" });
  });
  it("keeps basis and severity, clamps to 100, and flags the spending-ahead zone", () => {
    const [p] = quadrantPoints([row({ physicalBp: 2000, financialBp: 15000, basis: "REPORTED_UNVERIFIED", flags: [{ code: "SPEND_AHEAD_OF_PROGRESS", severity: "HIGH", confidence: "INDICATIVE" }] })]);
    expect(p).toMatchObject({ x: 20, y: 100, basis: "REPORTED_UNVERIFIED", severity: "HIGH" });
    expect(spendingAhead({ x: 20, y: 30 })).toBe(true);
    expect(spendingAhead({ x: 20, y: 29.9 })).toBe(false);
    expect(spendingAhead({ x: 50, y: 10 })).toBe(false);
  });
});

describe("payment stepper model", () => {
  it("marks progress and renders terminal branches explicitly", () => {
    const state = (s: string) => stepsFor(s).map((x) => `${x.key}:${x.state}`).join(",");
    expect(state("PENDING")).toBe("requested:current,approved:todo,paid:todo");
    expect(state("APPROVED")).toBe("requested:done,approved:current,paid:todo");
    expect(state("PAID")).toBe("requested:done,approved:done,paid:done");
    expect(state("REJECTED")).toContain("rejected:branch");
    expect(state("CANCELLED")).toContain("cancelled:branch");
    expect(state("REVERSED")).toContain("reversed:branch");
  });
});

describe("translated gate, flag and error text", () => {
  const en = FINANCE_COPY.en;
  const gate = (key: Gate["key"], status: Gate["status"], values: Gate["values"] = {}): Gate => ({ key, status, message: "server english", values });
  it("words gates from numbers and the basis, not from server prose", () => {
    expect(gateText(en, gate("BUDGET_HEADROOM", "BLOCK", { overByMinor: 100 }), "en")).toBe("This would exceed the approved budget by Rs. 1.00. Resolve it with an approved budget revision.");
    expect(gateText(en, gate("PROGRESS_SUPPORT", "WARN", { basis: "REPORTED_UNVERIFIED" }), "en")).toContain("Reported, not verified");
    expect(gateText(en, gate("CONTRACT_CAP", "SKIPPED"), "en")).toBe("No contract value is recorded for this assignment.");
    expect(gateText(FINANCE_COPY.si, gate("MAKER_CHECKER", "BLOCK"), "si")).not.toBe(gateText(en, gate("MAKER_CHECKER", "BLOCK"), "en"));
  });
  it("words flags with real numbers and labels indicative ones through the basis", () => {
    expect(flagText(en, { code: "OVER_BUDGET_COMMITMENT", params: { overByMinor: 2_000_000 } }, "en").reason).toBe("Approved and paid payments exceed the budget by Rs. 20,000.00.");
    expect(flagText(en, { code: "NEAR_BUDGET", params: { utilizationBp: 9550 } }, "en").reason).toBe("Committed spend is 95.5% of the approved budget.");
    expect(flagText(en, { code: "SPEND_AHEAD_OF_PROGRESS", params: { gapTenths: 250 } }, "en").reason).toBe("Paid spend is 25.0 pp ahead of physical progress.");
    expect(flagText(en, { code: "PAYMENT_WITHOUT_VERIFIED_PROGRESS", params: { basis: "NONE" } }, "en").reason).toContain("No progress recorded");
  });
  it("errors never echo server text and fall back safely", () => {
    const table = en.payments.errors;
    expect(failureText(409, "warnings_ack_required", table, en)).toBe(table.warnings_ack_required);
    expect(failureText(409, "duplicate_recent", table, en, { number: "PAY-1" })).toContain("PAY-1");
    expect(failureText(403, "maker_checker", table, en)).toBe(table.maker_checker);
    expect(failureText(403, null, table, en)).toBe(en.common.forbidden);
    expect(failureText(404, null, table, en)).toBe(en.common.notFound);
    expect(failureText(401, null, table, en)).toBe(en.common.signedOut);
    expect(failureText(500, "unknown_kind", table, en)).toBe(en.common.errorGeneric);
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and ");
  });
});

describe("URL tab state maps to server filters", () => {
  it("payment tabs", () => {
    expect(paymentTabQuery("mine")).toEqual({ needsMyApproval: true });
    expect(paymentTabQuery("closed")).toEqual({ status: "REJECTED,CANCELLED" });
    expect(paymentTabQuery("all")).toEqual({});
    expect(parsePaymentTab("paid", true)).toBe("paid");
    expect(parsePaymentTab("hack", true)).toBe("mine");
    expect(parsePaymentTab(null, false)).toBe("all");
  });
  it("expense tabs", () => {
    expect(expenseTabQuery("needs")).toEqual({ needsMyVerification: true });
    expect(expenseTabQuery("draft")).toEqual({ status: "DRAFT" });
    expect(parseExpenseTab("zzz", false)).toBe("all");
  });
  it("date presets are inclusive UTC bounds", () => {
    const now = new Date("2026-05-17T10:00:00Z");
    expect(presetRange("month", now)).toEqual({ dateFrom: "2026-05-01", dateTo: "2026-05-17" });
    expect(presetRange("quarter", now)).toEqual({ dateFrom: "2026-04-01", dateTo: "2026-05-17" });
    expect(presetRange("year", now)).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-05-17" });
    expect(presetRange("all", now)).toEqual({});
  });
});

describe("finance route access and i18n parity", () => {
  it("/finance and its children are private staff routes", () => {
    for (const path of ["/finance", "/finance/payments", "/finance/expenses", "/projects/abc/finance"]) expect(classifyAppPath(path)).toBe("private");
  });
  it("English, Sinhala and Tamil have identical keys and no empty strings", () => {
    const en = keyPaths(FINANCE_COPY.en).sort();
    expect(keyPaths(FINANCE_COPY.si).sort()).toEqual(en);
    expect(keyPaths(FINANCE_COPY.ta).sort()).toEqual(en);
    const empties = (v: unknown): number => (typeof v === "string" ? (v.trim() === "" ? 1 : 0) : v && typeof v === "object" ? Object.values(v).reduce<number>((n, x) => n + empties(x), 0) : 0);
    for (const c of Object.values(FINANCE_COPY)) expect(empties(c)).toBe(0);
  });
  it("placeholders survive translation and the notice about recording is present everywhere", () => {
    const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const walk = (a: unknown, b: unknown, path: string): string[] => {
      if (typeof a === "string") return typeof b === "string" && tokens(a) === tokens(b) ? [] : [path];
      if (a && typeof a === "object") return Object.keys(a).flatMap((k) => walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)?.[k], `${path}.${k}`));
      return [];
    };
    expect(walk(FINANCE_COPY.en, FINANCE_COPY.si, "si")).toEqual([]);
    expect(walk(FINANCE_COPY.en, FINANCE_COPY.ta, "ta")).toEqual([]);
    for (const c of Object.values(FINANCE_COPY)) expect(c.recordingOnly.length).toBeGreaterThan(20);
    expect(FINANCE_COPY.si.recordingOnly).not.toBe(FINANCE_COPY.en.recordingOnly);
  });
});
