import crypto from "node:crypto";

export const MAX_ISSUE_PHOTOS = 4;
export const MAX_ISSUE_PHOTO_BYTES = 5 * 1024 * 1024;

export type ValidatedPhoto = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  buffer: Buffer;
  fileName: string;
  exifStripped: boolean;
};

/** Detect image mime by magic bytes; never trust file extension or client Content-Type. */
export function detectImageMime(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Strip APP1 (EXIF/GPS/XMP) and COM segments from JPEG without adding native image dependencies.
 * If JPEG markers are malformed, returns null so caller rejects cleanly.
 */
function stripJpegExif(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let pos = 2;
  while (pos + 1 < buf.length) {
    if (buf[pos] !== 0xff) return null;
    while (pos < buf.length && buf[pos] === 0xff) pos += 1;
    if (pos >= buf.length) break;
    const marker = buf[pos]!;
    pos += 1;
    // Standalone markers (TEM, RST0..RST7, SOI, EOI)
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      out.push(Buffer.from([0xff, marker]));
      if (marker === 0xd9) break;
      continue;
    }
    if (pos + 1 >= buf.length) return null;
    const segLen = buf.readUInt16BE(pos);
    if (segLen < 2 || pos + segLen > buf.length) return null;
    // Start of Scan (DA): keep remainder of stream untouched
    if (marker === 0xda) {
      out.push(Buffer.from([0xff, marker]));
      out.push(buf.subarray(pos));
      return Buffer.concat(out);
    }
    // Strip APP1..APP13 (EXIF, XMP, IPTC, ICC comments) & COM; keep APP0 (JFIF) + SOF/DHT/DQT
    const stripSegment = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!stripSegment) {
      out.push(Buffer.from([0xff, marker]));
      out.push(buf.subarray(pos, pos + segLen));
    }
    pos += segLen;
  }
  return Buffer.concat(out);
}

/** Strip ancillary tEXt/zTXt/iTXt/eXIf metadata chunks from PNG. */
function stripPngMetadata(buf: Buffer): Buffer | null {
  const sig = buf.subarray(0, 8);
  const out: Buffer[] = [sig];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const total = 12 + len;
    if (pos + total > buf.length) return null;
    const isMeta = type === "eXIf" || type === "tEXt" || type === "zTXt" || type === "iTXt";
    if (!isMeta) {
      out.push(buf.subarray(pos, pos + total));
    }
    pos += total;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

/** Validate base64 photo payload, enforce magic bytes & size, and strip EXIF/metadata. */
export function validateAndStripIssuePhoto(input: { base64: string; fileName?: string }): ValidatedPhoto | null {
  const rawBase64 = input.base64.includes(",") ? input.base64.split(",").pop() ?? "" : input.base64;
  const buf = Buffer.from(rawBase64, "base64");
  if (buf.length === 0 || buf.length > MAX_ISSUE_PHOTO_BYTES) return null;

  const mime = detectImageMime(buf);
  if (!mime) return null;

  let cleaned: Buffer | null = buf;
  if (mime === "image/jpeg") cleaned = stripJpegExif(buf);
  else if (mime === "image/png") cleaned = stripPngMetadata(buf);

  if (!cleaned) return null;
  const safeName = (input.fileName ?? "photo").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "photo";
  return {
    mimeType: mime,
    buffer: cleaned,
    fileName: safeName,
    exifStripped: true,
  };
}

export function randomIssuePhotoKey(issueId: string): string {
  return `iss/${issueId}/${crypto.randomBytes(16).toString("hex")}`;
}
