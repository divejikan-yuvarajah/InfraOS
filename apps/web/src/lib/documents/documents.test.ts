import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_GROUPS } from "@infraos/shared-types";
import { describe, expect, it } from "vitest";

import { DOC_COPY, keyPaths } from "./messages";
import { checkClientFile, DEFAULT_FILTERS, familyOfName, filterParams, fmtDate, formatSize, mimeForName, parseFilters, toApiQuery } from "./view";

describe("DocTrace messages", () => {
  it("en, si and ta share one key tree and no value is empty", () => {
    const base = keyPaths(DOC_COPY.en).sort();
    expect(keyPaths(DOC_COPY.si).sort()).toEqual(base);
    expect(keyPaths(DOC_COPY.ta).sort()).toEqual(base);
    const empties = (c: unknown, p = ""): string[] => (typeof c === "string" ? (c.trim() ? [] : [p]) : Object.entries(c as object).flatMap(([k, v]) => empties(v, `${p}.${k}`)));
    for (const l of ["en", "si", "ta"] as const) expect(empties(DOC_COPY[l])).toEqual([]);
  });
  it("every registry category and group has a label in every language", () => {
    for (const l of ["en", "si", "ta"] as const) {
      for (const c of DOCUMENT_CATEGORIES) expect((DOC_COPY[l].category as Record<string, string>)[c.key], `${l}.${c.key}`).toBeTruthy();
      for (const g of DOCUMENT_CATEGORY_GROUPS) expect((DOC_COPY[l].group as Record<string, string>)[g], `${l}.${g}`).toBeTruthy();
    }
  });
  it("keeps placeholders identical across languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const flat = (c: unknown, p = ""): [string, string][] => (typeof c === "string" ? [[p, c]] : Object.entries(c as object).flatMap(([k, v]) => flat(v, `${p}.${k}`)));
    const en = new Map(flat(DOC_COPY.en));
    for (const l of ["si", "ta"] as const) for (const [k, v] of flat(DOC_COPY[l])) expect(ph(v), `${l}${k}`).toBe(ph(en.get(k)!));
  });
});

describe("DocTrace view helpers", () => {
  it("formats sizes and dates with Intl", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatSize(null)).toBe("—");
    expect(fmtDate("2026-05-15T04:00:00.000Z", "en")).toMatch(/2026/);
    expect(fmtDate("nope")).toBe("—");
  });
  it("mirrors the server file rules for instant feedback", () => {
    expect(checkClientFile({ name: "a.pdf", size: 10, type: "application/pdf" }, false)).toBeNull();
    expect(checkClientFile({ name: "a.exe", size: 10, type: "" }, true)).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(checkClientFile({ name: "a.png", size: 10, type: "image/png" }, false)).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(checkClientFile({ name: "a.png", size: 10, type: "image/png" }, true)).toBeNull();
    expect(checkClientFile({ name: "a.pdf", size: 0, type: "application/pdf" }, false)).toBe("FILE_EMPTY");
    expect(checkClientFile({ name: "a.pdf", size: 26 * 1024 * 1024, type: "application/pdf" }, false)).toBe("FILE_TOO_LARGE");
    expect(checkClientFile({ name: "a.pdf", size: 5, type: "text/plain" }, false)).toBe("FILE_SIGNATURE_MISMATCH");
    expect(familyOfName("x.DOCX")).toBe("docx");
    expect(mimeForName("a.csv", "")).toBe("text/csv");
  });
  it("round-trips filters through the URL and maps quick filters to server flags", () => {
    const f = { ...DEFAULT_FILTERS, q: "road", category: ["CONTRACT", "BOQ"], mine: true, archived: true, expiring: true, page: 3 };
    const params = filterParams(f);
    const back = parseFilters((k) => (k === "page" ? "3" : params[k] ?? null));
    expect(back).toMatchObject({ q: "road", category: ["CONTRACT", "BOQ"], mine: true, archived: true, expiring: true, page: 3 });
    expect(toApiQuery(f)).toMatchObject({ q: "road", category: "CONTRACT,BOQ", uploadedBy: "me", status: "ARCHIVED", expiring: "30", sort: "relevance" });
    expect(toApiQuery({ ...DEFAULT_FILTERS, awaiting: true })).toMatchObject({ hasFile: false });
    expect(parseFilters((k) => (k === "sort" ? "bogus" : k === "limit" ? "7" : null))).toMatchObject({ sort: "newest", limit: 25 });
  });
});
