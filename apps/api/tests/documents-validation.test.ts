import { describe, expect, it } from "vitest";

import { FileInspector, precheckFile, sanitizeFileName, type Family } from "../src/modules/documents/document-validation.js";
import { escapeRegex, highlightSegments, planText, prefixFilter } from "../src/modules/documents/document-search.js";
import { illegalLink, suggestCategory } from "../src/modules/documents/document-categories.js";
import { DOCX_MIME, docx, exe, jpeg, pdf, pdfWithJs, png, txt, xlsx, XLSX_MIME, zip } from "./helpers/doc-files.js";

/** Runs the same path the upload uses: precheck, then stream the bytes in odd-sized chunks, then finish. */
function run(name: string, mime: string, bytes: Buffer, allowsImages = true) {
  const pre = precheckFile({ fileName: name, mimeType: mime, sizeBytes: bytes.length, allowsImages });
  if (!pre.ok) return pre;
  const inspector = new FileInspector(pre.family as Family, pre.ext);
  for (let i = 0; i < bytes.length; i += 7) inspector.push(bytes.subarray(i, i + 7));
  return inspector.finish();
}
const code = (r: { ok: boolean } & Record<string, unknown>) => (r.ok ? "OK" : r.code);

describe("file validation table (Step 108)", () => {
  it("accepts genuine PDF, DOCX, XLSX, TXT, CSV and images", () => {
    expect(run("a.pdf", "application/pdf", pdf()).ok).toBe(true);
    expect(run("a.docx", DOCX_MIME, docx()).ok).toBe(true);
    expect(run("a.xlsx", XLSX_MIME, xlsx()).ok).toBe(true);
    expect(run("a.txt", "text/plain", txt("සිංහල text ✓")).ok).toBe(true);
    expect(run("a.csv", "text/csv", txt("a,b\n1,2\n")).ok).toBe(true);
    expect(run("a.png", "image/png", png()).ok).toBe(true);
    expect(run("a.jpg", "image/jpeg", jpeg()).ok).toBe(true);
  });
  it("rejects spoofed, hostile and malformed files with the right code", () => {
    expect(code(run("evil.pdf", "application/pdf", exe()))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("page.txt", "text/plain", txt("<!DOCTYPE html><html><script>x</script></html>")))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("pic.svg", "image/svg+xml", txt("<svg/>")))).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(code(run("pic.png", "image/png", txt("<svg xmlns='http://www.w3.org/2000/svg'/>")))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("run.exe", "application/octet-stream", exe()))).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(code(run("macro.docm", DOCX_MIME, docx()))).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(code(run("macro.xlsm", XLSX_MIME, xlsx()))).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(code(run("a.pdf", "text/plain", pdf()))).toBe("FILE_SIGNATURE_MISMATCH"); // declared MIME disagrees with the extension
    expect(code(run("empty.pdf", "application/pdf", Buffer.alloc(0)))).toBe("FILE_EMPTY");
    expect(code(run("nul.txt", "text/plain", Buffer.from("hello\0world")))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("bad.txt", "text/plain", Buffer.from([0x68, 0xff, 0xfe, 0x69])))).toBe("FILE_CORRUPT");
    expect(code(run("trunc.pdf", "application/pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4000, 0x41)])))).toBe("FILE_CORRUPT");
    expect(code(run("photo.png", "image/png", png(), false))).toBe("FILE_TYPE_NOT_ALLOWED"); // images only for some categories
  });
  it("rejects oversize before any bytes, ZIP bombs, wrong containers and macro payloads", () => {
    expect(code(precheckFile({ fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 26 * 1024 * 1024, allowsImages: false }) as never)).toBe("FILE_TOO_LARGE");
    const bomb = zip([{ name: "[Content_Types].xml" }, { name: "word/document.xml", claimUncompressed: 900 * 1024 * 1024, claimCompressed: 1000 }]);
    expect(code(run("bomb.docx", DOCX_MIME, bomb))).toBe("FILE_CORRUPT");
    const many = zip(Array.from({ length: 2100 }, (_, i) => ({ name: i === 0 ? "[Content_Types].xml" : `word/p${i}.xml` })));
    expect(code(run("many.docx", DOCX_MIME, many))).toBe("FILE_CORRUPT");
    expect(code(run("notoffice.docx", DOCX_MIME, zip([{ name: "readme.txt" }])))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("sheet.docx", DOCX_MIME, xlsx()))).toBe("FILE_SIGNATURE_MISMATCH");
    expect(code(run("m.docx", DOCX_MIME, zip([{ name: "[Content_Types].xml" }, { name: "word/vbaProject.bin" }])))).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(code(run("t.docx", DOCX_MIME, zip([{ name: "[Content_Types].xml" }, { name: "word/../../evil" }])))).toBe("FILE_CORRUPT");
  });
  it("flags active-content PDFs (download-only) instead of silently previewing them", () => {
    expect(run("js.pdf", "application/pdf", pdfWithJs())).toMatchObject({ ok: true, activeContent: true });
    expect(run("ok.pdf", "application/pdf", pdf())).toMatchObject({ ok: true, activeContent: false });
  });
  it("sanitises path traversal, RTL overrides and control characters", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("C:\\x\\y\\z.pdf")).toBe("z.pdf");
    expect(sanitizeFileName("rep\u202Efdp.exe")).toBe("repfdp.exe");
    expect(sanitizeFileName("a\u0000b\u0007.txt")).toBe("ab.txt");
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName(`${"x".repeat(400)}.pdf`)).toHaveLength(255);
    expect(sanitizeFileName(`${"x".repeat(400)}.pdf`).endsWith(".pdf")).toBe(true);
    expect(precheckFile({ fileName: "..\\..\\a.pdf", mimeType: "application/pdf", sizeBytes: 5, allowsImages: false })).toMatchObject({ ok: true, fileName: "a.pdf" });
  });
});

describe("search and category helpers (Step 110)", () => {
  it("escapes regex metacharacters and keeps prefix patterns anchored", () => {
    expect(escapeRegex("a.b*c(d)[e]")).toBe("a\\.b\\*c\\(d\\)\\[e\\]");
    const f = prefixFilter(".*(a+)+$") as { $or: { title: RegExp }[] };
    expect(f.$or[0]!.title.source.startsWith("^")).toBe(true);
    expect(f.$or[0]!.title.test("xx")).toBe(false);
    expect(f.$or[0]!.title.test(".*(a+)+$ road")).toBe(true);
  });
  it("plans docNo exact, short prefix and text queries", () => {
    expect(planText("doc-2026-000012")).toMatchObject({ mode: "docNo", filter: { docNo: "DOC-2026-000012" } });
    expect(planText("ab").mode).toBe("prefix");
    expect(planText("   ").mode).toBe("none");
    const t = planText('road -"bridge') as { mode: string; filter: { $text: { $search: string } } };
    expect(t.mode).toBe("text");
    expect(t.filter.$text.$search).toBe('"road" "-bridge"');
  });
  it("returns highlight segments, never HTML", () => {
    expect(highlightSegments("Kandy Road <b>Plan</b>", "road plan")).toEqual([
      { text: "Kandy ", match: false }, { text: "Road", match: true }, { text: " <b>", match: false }, { text: "Plan", match: true }, { text: "</b>", match: false },
    ]);
    expect(highlightSegments("a+b", "a+")).toEqual([{ text: "a+", match: true }, { text: "b", match: false }]);
    expect(highlightSegments(null, "x")).toEqual([]);
  });
  it("enforces link rules and suggests categories without AI", () => {
    expect(illegalLink("INSPECTION_REPORT", { inspectionId: "x" })).toBeNull();
    expect(illegalLink("CONTRACT", { inspectionId: "x" })).toBe("inspectionId");
    expect(illegalLink("PAYMENT_EVIDENCE", { paymentId: "p", contractorId: "c", assetId: "a" })).toBe("assetId");
    expect(illegalLink("OTHER", { contractorId: null })).toBeNull();
    expect(suggestCategory("Signed Contract v2.pdf")).toBe("CONTRACT");
    expect(suggestCategory("x.pdf", { from: "payment" })).toBe("PAYMENT_EVIDENCE");
    expect(suggestCategory("scan.png")).toBe("SITE_EVIDENCE");
  });
});
