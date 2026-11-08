import { DOCUMENT_FILE_TYPE_TABLE, DOCUMENT_LIMITS, fileExtension, type DocumentErrorCode } from "@infraos/shared-types";

/** Environment-aware cap. `DOCUMENT_MAX_FILE_MB` can only lower the shared default (GridFS shares the Atlas cluster, free tiers are small). */
export function maxFileBytes(): number {
  const mb = Number(process.env.DOCUMENT_MAX_FILE_MB);
  return Number.isFinite(mb) && mb > 0 ? Math.min(DOCUMENT_LIMITS.maxFileBytes, Math.floor(mb * 1024 * 1024)) : DOCUMENT_LIMITS.maxFileBytes;
}

const BIDI = /[‎‏‪-‮⁦-⁩؜]/g;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** Display-only name. Path parts, control characters and RTL-override characters are removed; NFC; at most 255 characters keeping the extension. */
export function sanitizeFileName(raw: string): string {
  let name = String(raw ?? "").normalize("NFC").replace(CONTROL, "").replace(BIDI, "");
  name = name.split(/[\\/]/).pop() ?? "";
  name = name.replace(/[<>:"|?*]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!name) return "file";
  if (name.length > 255) {
    const ext = fileExtension(name);
    const keep = ext ? ext.length + 1 : 0;
    name = name.slice(0, 255 - keep) + (ext ? `.${ext}` : "");
  }
  return name;
}

export type Family = "pdf" | "docx" | "xlsx" | "csv" | "txt" | "image";
export type Precheck = { ok: true; family: Family; ext: string; mime: string; fileName: string } | { ok: false; code: DocumentErrorCode };

const canonicalMime = (ext: string): string => {
  const row = DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === ext);
  return row ? row.mimes[0] : "application/octet-stream";
};
export const normaliseMime = (m: string): string => String(m ?? "").split(";")[0]!.trim().toLowerCase();

/** Cheap checks before any bytes are accepted: extension allowlist, declared MIME agrees with the extension, size, and image-only-for-some-categories. */
export function precheckFile(input: { fileName: string; mimeType: string; sizeBytes: number; allowsImages: boolean }): Precheck {
  const fileName = sanitizeFileName(input.fileName);
  const ext = fileExtension(fileName);
  const row = DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === ext);
  if (!row) return { ok: false, code: "FILE_TYPE_NOT_ALLOWED" };
  if (!(row.mimes as readonly string[]).includes(normaliseMime(input.mimeType))) return { ok: false, code: "FILE_SIGNATURE_MISMATCH" };
  if (row.family === "image" && !input.allowsImages) return { ok: false, code: "FILE_TYPE_NOT_ALLOWED" };
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) return { ok: false, code: "FILE_EMPTY" };
  if (input.sizeBytes > maxFileBytes()) return { ok: false, code: "FILE_TOO_LARGE" };
  return { ok: true, family: row.family, ext, mime: canonicalMime(ext), fileName };
}

const HEAD = 1024 * 1024;
const TAIL = 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;
const MAX_ZIP_UNCOMPRESSED = 300 * 1024 * 1024;
const MAX_ZIP_RATIO = 100;

export type InspectResult = { ok: true; sizeBytes: number; activeContent: boolean } | { ok: false; code: DocumentErrorCode };

/**
 * Streaming inspector: feed every chunk once, then call finish(). Never holds more than ~2 MB (first and last megabyte) so uploads are never fully
 * buffered. Verifies the real magic bytes against the extension, UTF-8 and NUL rules for text, and guards DOCX/XLSX against ZIP bombs by reading the
 * central directory only (nothing is ever extracted).
 */
export class FileInspector {
  private size = 0;
  private head: Buffer = Buffer.alloc(0);
  private tail: Buffer = Buffer.alloc(0);
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private textError: DocumentErrorCode | null = null;
  constructor(private readonly family: Family, private readonly ext: string) {}

  push(chunk: Buffer): void {
    this.size += chunk.length;
    if (this.head.length < HEAD) this.head = Buffer.concat([this.head, chunk.subarray(0, HEAD - this.head.length)]);
    this.tail = this.tail.length + chunk.length > TAIL * 2 ? Buffer.concat([this.tail, chunk]).subarray(-TAIL) : Buffer.concat([this.tail, chunk]);
    if ((this.family === "txt" || this.family === "csv") && !this.textError) {
      if (chunk.includes(0)) { this.textError = "FILE_SIGNATURE_MISMATCH"; return; }
      try { this.decoder.decode(chunk, { stream: true }); } catch { this.textError = "FILE_CORRUPT"; }
    }
  }

  finish(): InspectResult {
    const size = this.size;
    if (size === 0) return { ok: false, code: "FILE_EMPTY" };
    const tail = this.tail.subarray(-TAIL);
    const h = this.head;
    const fail = (code: DocumentErrorCode): InspectResult => ({ ok: false, code });
    switch (this.family) {
      case "pdf": {
        if (h.subarray(0, 5).toString("latin1") !== "%PDF-") return fail("FILE_SIGNATURE_MISMATCH");
        if (!tail.toString("latin1").includes("%%EOF") && size > 2048) return fail("FILE_CORRUPT");
        const scan = h.toString("latin1") + (size > HEAD ? tail.toString("latin1") : "");
        return { ok: true, sizeBytes: size, activeContent: /\/(JavaScript|JS|Launch)\b/.test(scan) };
      }
      case "image": {
        const png = h.length >= 8 && h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const jpg = h.length >= 3 && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
        const webp = h.length >= 12 && h.subarray(0, 4).toString("latin1") === "RIFF" && h.subarray(8, 12).toString("latin1") === "WEBP";
        const ok = this.ext === "png" ? png : this.ext === "webp" ? webp : jpg;
        return ok ? { ok: true, sizeBytes: size, activeContent: false } : fail("FILE_SIGNATURE_MISMATCH");
      }
      case "txt":
      case "csv": {
        if (this.textError) return fail(this.textError);
        try { this.decoder.decode(); } catch { return fail("FILE_CORRUPT"); }
        const start = h.subarray(0, 512).toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();
        if (/^(<!doctype|<html|<svg|<\?xml|<script|<head|<body|<iframe|%pdf-|mz)/.test(start) || h[0] === 0x4d && h[1] === 0x5a || h[0] === 0x7f && h[1] === 0x45) return fail("FILE_SIGNATURE_MISMATCH");
        return { ok: true, sizeBytes: size, activeContent: false };
      }
      case "docx":
      case "xlsx":
        return this.zipOffice(size, tail, h);
    }
  }

  private zipOffice(size: number, tail: Buffer, h: Buffer): InspectResult {
    const fail = (code: DocumentErrorCode): InspectResult => ({ ok: false, code });
    if (h.length < 4 || h.readUInt32LE(0) !== 0x04034b50) return fail("FILE_SIGNATURE_MISMATCH");
    let eocd = -1;
    for (let i = tail.length - 22; i >= Math.max(0, tail.length - 22 - 65_535); i -= 1) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return fail("FILE_CORRUPT");
    const entries = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (entries === 0xffff || cdOffset === 0xffffffff || entries === 0) return fail("FILE_CORRUPT");
    if (entries > MAX_ZIP_ENTRIES) return fail("FILE_CORRUPT");
    const tailStart = size - tail.length;
    if (cdOffset < tailStart || cdOffset + cdSize > size) return fail("FILE_CORRUPT");
    let p = cdOffset - tailStart;
    let total = 0;
    let hasTypes = false;
    let hasRoot = false;
    const root = this.family === "docx" ? "word/" : "xl/";
    const other = this.family === "docx" ? "xl/" : "word/";
    for (let n = 0; n < entries; n += 1) {
      if (p + 46 > tail.length || tail.readUInt32LE(p) !== 0x02014b50) return fail("FILE_CORRUPT");
      const comp = tail.readUInt32LE(p + 20);
      const uncomp = tail.readUInt32LE(p + 24);
      const nameLen = tail.readUInt16LE(p + 28);
      const extra = tail.readUInt16LE(p + 30);
      const comment = tail.readUInt16LE(p + 32);
      if (p + 46 + nameLen > tail.length) return fail("FILE_CORRUPT");
      const name = tail.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      if (name.includes("..") || name.startsWith("/") || name.includes("\\")) return fail("FILE_CORRUPT");
      if (/vbaProject\.bin$/i.test(name)) return fail("FILE_TYPE_NOT_ALLOWED");
      total += uncomp;
      if (total > MAX_ZIP_UNCOMPRESSED) return fail("FILE_CORRUPT");
      if (uncomp > 1024 * 1024 && (comp === 0 || uncomp / comp > MAX_ZIP_RATIO)) return fail("FILE_CORRUPT");
      if (name === "[Content_Types].xml") hasTypes = true;
      if (name.startsWith(root)) hasRoot = true;
      if (name.startsWith(other)) return fail("FILE_SIGNATURE_MISMATCH");
      p += 46 + nameLen + extra + comment;
    }
    if (!hasTypes || !hasRoot) return fail("FILE_SIGNATURE_MISMATCH");
    return { ok: true, sizeBytes: size, activeContent: false };
  }
}

/** Whether the version may be shown inline. Active-content PDFs and DOCX/XLSX are download-only. */
export function previewable(mime: string, activeContent: boolean): boolean {
  if (activeContent) return false;
  return ["application/pdf", "text/plain", "text/csv", "image/png", "image/jpeg", "image/webp"].includes(mime);
}
