import { AI_RAG_ERROR_CODES, AI_QA_STATUSES, EXTRACTION_TEMPLATES, SUMMARY_TEMPLATES, SUGGESTED_QUESTION_KEYS, DIFF_STATES } from "@infraos/shared-types";
import { describe, expect, it } from "vitest";

import { keyPaths } from "../messages";
import { answerAsText, coverageState, formatValue, groupFields, pageLabel, splitAnswer, statusTone, strongMatchKeys } from "./citations";
import { RAG_COPY } from "./rag-messages";
import type { ExtractField } from "./rag-types";

describe("document AI messages", () => {
  it("en, si and ta share one key tree, no value is empty and placeholders match", () => {
    const base = keyPaths(RAG_COPY.en).sort();
    expect(keyPaths(RAG_COPY.si).sort()).toEqual(base);
    expect(keyPaths(RAG_COPY.ta).sort()).toEqual(base);
    const flat = (c: unknown, p = ""): [string, string][] => (typeof c === "string" ? [[p, c]] : Object.entries(c as object).flatMap(([k, v]) => flat(v, `${p}.${k}`)));
    const en = new Map(flat(RAG_COPY.en));
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const l of ["si", "ta"] as const) for (const [k, v] of flat(RAG_COPY[l])) { expect(v.trim(), `${l}${k}`).not.toBe(""); expect(ph(v), `${l}${k}`).toBe(ph(en.get(k)!)); }
  });
  it("labels every status, error code, template, field, section, suggested question and diff state in every language", () => {
    for (const l of ["en", "si", "ta"] as const) {
      const c = RAG_COPY[l];
      for (const s of AI_QA_STATUSES) expect((c.answer.status as Record<string, string>)[s], `${l}.status.${s}`).toBeTruthy();
      for (const e of AI_RAG_ERROR_CODES.filter((x) => !x.startsWith("LLM_") && x !== "NOT_AI_READY" && x !== "AI_TOO_LARGE")) expect((c.answer.errors as Record<string, string>)[e], `${l}.errors.${e}`).toBeTruthy();
      for (const t of SUMMARY_TEMPLATES) { expect((c.summary.template as Record<string, string>)[t.key]).toBeTruthy(); expect((c.summary.template as Record<string, string>)[`${t.key}_HELP`]).toBeTruthy(); for (const s of t.sections) expect((c.summary.section as Record<string, string>)[s.key], `${l}.section.${s.key}`).toBeTruthy(); }
      for (const t of EXTRACTION_TEMPLATES) { expect((c.extract.template as Record<string, string>)[t.key]).toBeTruthy(); for (const f of t.fields) expect((c.extract.field as Record<string, string>)[f.key], `${l}.field.${f.key}`).toBeTruthy(); }
      for (const k of Object.values(SUGGESTED_QUESTION_KEYS).flat()) expect((c.suggested as Record<string, string>)[k], `${l}.suggested.${k}`).toBeTruthy();
      for (const d of DIFF_STATES) expect((c.extract.diff as Record<string, string>)[d]).toBeTruthy();
    }
  });
});

describe("citation helpers", () => {
  it("splits server-built answer text into text and citation markers, treating everything else as inert text", () => {
    expect(splitAnswer("Damages are LKR 25,000 per day. [1][3]")).toEqual([{ type: "text", text: "Damages are LKR 25,000 per day. " }, { type: "cite", ns: [1, 3] }]);
    expect(splitAnswer("No markers here")).toEqual([{ type: "text", text: "No markers here" }]);
    expect(splitAnswer("[2] leading and [x] odd [12345] long")).toEqual([{ type: "cite", ns: [2] }, { type: "text", text: " leading and [x] odd [12345] long" }]);
    expect(splitAnswer("<img src=x onerror=1> [1]")[0]).toEqual({ type: "text", text: "<img src=x onerror=1> " }); // never parsed as markup
  });
  it("page labels never invent pages", () => {
    expect(pageLabel({ pageStart: null, pageEnd: null })).toEqual({ kind: "none" });
    expect(pageLabel({ pageStart: 4, pageEnd: 4 })).toEqual({ kind: "one", n: 4 });
    expect(pageLabel({ pageStart: 4, pageEnd: 6 })).toEqual({ kind: "range", a: 4, b: 6 });
  });
  it("coverage state drives the partial-coverage notice", () => {
    expect(coverageState({ documentsInScope: 17, documentsSearched: 14, documentsNotAiReady: 3, truncatedScope: false })).toEqual({ searched: 14, total: 17, missing: 3, percent: 82, partial: true });
    expect(coverageState({ documentsInScope: 5, documentsSearched: 5, documentsNotAiReady: 0, truncatedScope: false }).partial).toBe(false);
    expect(coverageState({ documentsInScope: 500, documentsSearched: 500, documentsNotAiReady: 0, truncatedScope: true }).partial).toBe(true);
    expect(coverageState(null)).toMatchObject({ total: 0, partial: false });
  });
  it("status tones and plain-text export", () => {
    expect(statusTone("ANSWERED")).toBe("success");
    expect(statusTone("PARTIAL")).toBe("pending");
    expect(statusTone("FAILED")).toBe("critical");
    const text = answerAsText("Answer [1]", [{ n: 1, chunkId: "c", documentId: "d", versionNo: 1, sourceStatus: "CURRENT", docNo: "DOC-1", title: "Contract", category: null, pageStart: 2, pageEnd: 3, section: "4.2", quote: "LKR 25,000", quoteVerified: true, wasNeighbor: false }]);
    expect(text).toBe('Answer [1]\n\n[1] DOC-1 Contract, p.2-3, 4.2 — "LKR 25,000"');
  });
});

describe("extraction helpers", () => {
  const field = (key: string, status: ExtractField["status"], strengths: ("STRONG" | "WEAK")[]): ExtractField => ({ key, type: "STRING", repeats: false, status, reason: null, values: strengths.map((s) => ({ rawText: "x", typed: null, strength: s, citationNs: [1] })) });
  it("formats typed values from server integers (no model arithmetic)", () => {
    expect(formatValue({ rawText: "LKR 25,000", typed: { type: "MONEY", amountMinor: 2_500_000, currency: "LKR" }, strength: "STRONG", citationNs: [1] }, "en")).toMatch(/25,000\.00/);
    expect(formatValue({ rawText: "31 December 2026", typed: { type: "DATE", iso: "2026-12-31" }, strength: "STRONG", citationNs: [1] }, "en")).toBe("December 31, 2026");
    expect(formatValue({ rawText: "5%", typed: { type: "PERCENT", value: "5" }, strength: "STRONG", citationNs: [1] }, "en")).toBe("5%");
    expect(formatValue({ rawText: "365 calendar days", typed: { type: "DURATION", value: 365, unit: "DAY" }, strength: "STRONG", citationNs: [1] }, "en")).toBe("365 days");
    expect(formatValue({ rawText: "as written", typed: null, strength: "WEAK", citationNs: [] }, "en")).toBe("as written");
  });
  it("accept-all-strong only offers found, all-strong, undecided fields that do not contradict the record", () => {
    const fields = [field("a", "FOUND", ["STRONG"]), field("b", "FOUND", ["STRONG", "WEAK"]), field("c", "AMBIGUOUS", ["STRONG"]), field("d", "FOUND", ["STRONG"]), field("e", "FOUND", ["STRONG"]), field("f", "NOT_FOUND", [])];
    expect(strongMatchKeys(fields, { d: { state: "DIFFERS" }, a: { state: "MATCH" } }, { e: { decision: "ACCEPTED" } })).toEqual(["a"]);
    expect(strongMatchKeys(fields, {}, { e: { decision: "PENDING" } })).toEqual(["a", "d", "e"]);
  });
  it("groups fields found / ambiguous / missing in that order and drops empty groups", () => {
    const g = groupFields([field("m", "NOT_FOUND", []), field("f", "FOUND", ["STRONG"]), field("a", "AMBIGUOUS", ["WEAK"])], undefined);
    expect(g.map((x) => x.group)).toEqual(["found", "ambiguous", "missing"]);
    expect(groupFields([field("f", "FOUND", ["STRONG"])], undefined).map((x) => x.group)).toEqual(["found"]);
  });
});
