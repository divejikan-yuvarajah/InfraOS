import { SRI_LANKA_PROVINCES as SHARED } from "@infraos/shared-types";
import { describe, expect, it } from "vitest";

import { initialsOf, formatLkr, parseLkrToMinor, fill, percent, daysUntil } from "./format";
import { appliedChips, EMPTY_LIST_STATE, parseListParams, removeChip, serializeListParams, toListRequest, withFilter } from "./list-query";
import { CONTRACTOR_COPY, failureMessage, keyPaths } from "./messages";
import { contractorFormSchema, EMPTY_FORM, splitSpecializations, toPatchBody, toRegisterBody, LIMITS, assignSchema, statusReasonSchema } from "./schema";

describe("district list", () => {
  it("is identical to the shared-types constant the API validates against", async () => {
    const { SRI_LANKA_PROVINCES } = await import("./types");
    expect(SRI_LANKA_PROVINCES).toEqual(SHARED);
  });
});

describe("directory URL state", () => {
  it("round-trips every filter and keeps the default URL clean", () => {
    expect(serializeListParams(EMPTY_LIST_STATE)).toBe("");
    const state = { ...EMPTY_LIST_STATE, q: "alpha", status: ["ACTIVE", "SUSPENDED"] as const, category: "DRAINAGE" as const, district: "Galle", agencyId: "a".repeat(24), riskBand: "WEAK" as const, cert: "30" as const, hasActive: "yes" as const, sort: "risk" as const, page: 3, limit: 50 as const };
    const url = serializeListParams({ ...state, status: [...state.status] });
    expect(parseListParams(new URLSearchParams(url))).toEqual({ ...state, status: [...state.status] });
  });
  it("drops invalid, unknown and out-of-range values", () => {
    const parsed = parseListParams(new URLSearchParams("status=ACTIVE,BOGUS,ACTIVE&category=NOPE&page=-4&limit=7&agency=zzz&sort=hack&risk=X&cert=1&active=maybe&q=" + "x".repeat(300)));
    expect(parsed).toMatchObject({ status: ["ACTIVE"], category: "", page: 1, limit: 20, agencyId: "", sort: "name", riskBand: "", cert: "", hasActive: "", q: "x".repeat(100) });
  });
  it("maps to the server's query names and resets the page on any filter change", () => {
    const next = withFilter({ ...EMPTY_LIST_STATE, page: 4 }, { category: "BUILDING", hasActive: "no" });
    expect(next.page).toBe(1);
    expect(toListRequest(next)).toMatchObject({ category: "BUILDING", hasActiveProjects: "false", page: 1, limit: 20, sort: "name" });
    expect(toListRequest(EMPTY_LIST_STATE)).not.toHaveProperty("status", expect.anything());
  });
  it("applied chips can each be removed", () => {
    const state = withFilter(EMPTY_LIST_STATE, { q: "x", status: ["ACTIVE", "SUSPENDED"], district: "Galle", cert: "expired" });
    const chips = appliedChips(state);
    expect(chips.map((c) => c.key)).toEqual(["q", "status:ACTIVE", "status:SUSPENDED", "district", "cert"]);
    let current = state;
    for (const chip of chips) current = removeChip(current, chip);
    expect(appliedChips(current)).toEqual([]);
  });
});

describe("money and formatting", () => {
  it("formats cents without float drift", () => {
    expect(formatLkr(1_999_999, "en")).toBe("LKR 19,999.99");
    expect(formatLkr(100, "en")).toBe("LKR 1.00");
    expect(formatLkr(5, "en")).toBe("LKR 0.05");
    expect(formatLkr(Number.MAX_SAFE_INTEGER, "en")).toMatch(/^LKR [\d,]+\.\d{2}$/);
    expect(formatLkr(1.5, "en")).toBe("—");
    expect(formatLkr(-1, "en")).toBe("—");
  });
  it("parses typed amounts to integer cents with string arithmetic", () => {
    expect(parseLkrToMinor("19,999.99")).toBe(1_999_999);
    expect(parseLkrToMinor("0.1")).toBe(10);
    expect(parseLkrToMinor("1250")).toBe(125_000);
    expect(parseLkrToMinor("19.999")).toBeNull();
    expect(parseLkrToMinor("-5")).toBeNull();
    expect(parseLkrToMinor("abc")).toBeNull();
    expect(parseLkrToMinor("")).toBeNull();
  });
  it("small helpers", () => {
    expect(initialsOf("Contractor Alpha (Synthetic)")).toBe("CA");
    expect(initialsOf("සමාගම")).not.toBe("?");
    expect(fill("{a} of {b}", { a: 1, b: 2 })).toBe("1 of 2");
    expect(percent(66.7)).toBe("66.7%");
    expect(percent(100)).toBe("100%");
    expect(percent(null)).toBe("—");
    expect(daysUntil("2026-01-11T00:00:00Z", new Date("2026-01-01T00:00:00Z").getTime())).toBe(10);
  });
});

describe("form schema mirrors the server limits", () => {
  const valid = { ...EMPTY_FORM, name: "Alpha Builders", registrationNumber: "reg/001", category: "ROAD_CONSTRUCTION" as const };
  it("accepts a minimal valid form and upper-cases the registration number", () => {
    const out = contractorFormSchema.safeParse(valid);
    expect(out.success).toBe(true);
    expect(out.success && out.data.registrationNumber).toBe("REG/001");
  });
  it("rejects the same inputs the server rejects", () => {
    const bad = (patch: object) => contractorFormSchema.safeParse({ ...valid, ...patch }).success;
    expect(bad({ name: "" })).toBe(false);
    expect(bad({ name: "x".repeat(LIMITS.name + 1) })).toBe(false);
    expect(bad({ registrationNumber: "-bad" })).toBe(false);
    expect(bad({ registrationNumber: "has space" })).toBe(false);
    expect(bad({ email: "nope" })).toBe(false);
    expect(bad({ taxId: "x".repeat(41) })).toBe(false);
    expect(bad({ specializationsText: Array.from({ length: 13 }, (_, i) => `s${i}`).join(",") })).toBe(false);
    expect(bad({ operatingDistricts: Array.from({ length: 26 }, (_, i) => `d${i}`) })).toBe(false);
    expect(bad({ certifications: [{ name: "C", issuer: "", referenceNumber: "", issuedOn: "2026-05-01", expiresOn: "2026-01-01" }] })).toBe(false);
    expect(bad({ certifications: [{ name: "C", issuer: "", referenceNumber: "", issuedOn: "", expiresOn: "2026-01-01" }] })).toBe(true);
    expect(bad({ name: "ctl\u0007" })).toBe(false);
  });
  it("builds API bodies without empty strings and with a clean specialization list", () => {
    expect(splitSpecializations(" a, b ,a,, c ")).toEqual(["a", "b", "c"]);
    const body = toRegisterBody({ ...valid, email: "x@y.invalid", taxId: "T-1", specializationsText: "roads, bridges", certifications: [{ name: "CIDA", issuer: "", referenceNumber: "", issuedOn: "", expiresOn: "2027-01-01" }] });
    expect(body.contact).toEqual({ email: "x@y.invalid" });
    expect(body.business).toEqual({ taxId: "T-1" });
    expect(body.specializations).toEqual(["roads", "bridges"]);
    expect(body.certifications[0]).toEqual({ name: "CIDA", expiresOn: "2027-01-01" });
    expect(body).not.toHaveProperty("confirmNotDuplicate");
    expect(toRegisterBody({ ...valid, confirmNotDuplicate: true, duplicateAcknowledgement: "Different company entirely" })).toMatchObject({ confirmNotDuplicate: true });
    expect(toRegisterBody({ ...valid, confirmNotDuplicate: true, duplicateAcknowledgement: "short" })).not.toHaveProperty("confirmNotDuplicate");
  });
  it("patch bodies carry the concurrency token and only send a changed registration number with its reason", () => {
    const same = toPatchBody(valid, "2026-01-01T00:00:00.000Z", undefined, "REG/001");
    expect(same).toMatchObject({ expectedUpdatedAt: "2026-01-01T00:00:00.000Z" });
    expect(same).not.toHaveProperty("registrationNumber");
    const changed = toPatchBody({ ...valid, registrationNumber: "NEW-1" }, "2026-01-01T00:00:00.000Z", "Corrected a typo in the number", "REG/001");
    expect(changed).toMatchObject({ registrationNumber: "NEW-1", registrationNumberReason: "Corrected a typo in the number" });
  });
  it("reason and assignment schemas", () => {
    expect(statusReasonSchema.safeParse("too short").success).toBe(false);
    expect(statusReasonSchema.safeParse("Long enough reason").success).toBe(true);
    const ok = { projectId: "a".repeat(24), role: "PRIMARY" as const, startDate: "2026-02-01", contractReference: "", contractValue: "1,250.50", notes: "" };
    expect(assignSchema.safeParse(ok).success).toBe(true);
    expect(assignSchema.safeParse({ ...ok, contractValue: "12.345" }).success).toBe(false);
    expect(assignSchema.safeParse({ ...ok, startDate: "" }).success).toBe(false);
  });
});

describe("i18n dictionaries", () => {
  it("English, Sinhala and Tamil have identical key sets (arrays included) and no empty strings", () => {
    const en = keyPaths(CONTRACTOR_COPY.en).sort();
    expect(keyPaths(CONTRACTOR_COPY.si).sort()).toEqual(en);
    expect(keyPaths(CONTRACTOR_COPY.ta).sort()).toEqual(en);
    const empties = (v: unknown): number => (typeof v === "string" ? (v.trim() === "" ? 1 : 0) : v && typeof v === "object" ? Object.values(v).reduce<number>((n, x) => n + empties(x), 0) : 0);
    for (const c of Object.values(CONTRACTOR_COPY)) expect(empties(c)).toBe(0);
  });
  it("placeholders are preserved in every language", () => {
    const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const walk = (a: unknown, b: unknown, path: string): string[] => {
      if (typeof a === "string") return typeof b === "string" && tokens(a) === tokens(b) ? [] : [path];
      if (a && typeof a === "object") return Object.keys(a).flatMap((k) => walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)?.[k], `${path}.${k}`));
      return [];
    };
    expect(walk(CONTRACTOR_COPY.en, CONTRACTOR_COPY.si, "si")).toEqual([]);
    expect(walk(CONTRACTOR_COPY.en, CONTRACTOR_COPY.ta, "ta")).toEqual([]);
  });
  it("Sinhala and Tamil really differ from English where text is translated", () => {
    expect(CONTRACTOR_COPY.si.title).not.toBe(CONTRACTOR_COPY.en.title);
    expect(CONTRACTOR_COPY.ta.statuses.SUSPENDED).not.toBe(CONTRACTOR_COPY.en.statuses.SUSPENDED);
  });
  it("failure messages never echo server text and map known kinds", () => {
    const c = CONTRACTOR_COPY.en;
    expect(failureMessage(401, null, c)).toBe(c.common.signedOut);
    expect(failureMessage(409, "primary_exists", c)).toBe(c.assign.primaryExists);
    expect(failureMessage(409, "stale", c)).toBe(c.form.stale.body);
    expect(failureMessage(500, null, c)).toBe(c.common.errorGeneric);
  });
});
