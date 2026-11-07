/** Client-side evidence pipeline: decode, orient, resize, re-encode (this strips EXIF), thumbnail, SHA-256. Pure sizing maths is exported for tests. */
export const FULL_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 320;
export const FULL_QUALITY = 0.8;
export const THUMB_QUALITY = 0.7;
export const FULL_MAX_BYTES = 4 * 1024 * 1024;
export const THUMB_MAX_BYTES = 150 * 1024;
export const ACCEPTED_INPUT = ["image/jpeg", "image/png", "image/webp"];

/** Fits (w, h) inside `maxEdge` on the long edge, never upscaling, always at least 1 px. */
export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export type InputCheck = { ok: true } | { ok: false; reason: "unsupported_type" | "too_large_input" | "empty" };
export function checkInput(file: { type: string; size: number }): InputCheck {
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (!ACCEPTED_INPUT.includes(file.type)) return { ok: false, reason: "unsupported_type" };
  if (file.size > 40 * 1024 * 1024) return { ok: false, reason: "too_large_input" };
  return { ok: true };
}

export type Processed = { full: Blob; thumb: Blob; width: number; height: number; sha256: string; thumbSha256: string; mimeType: "image/jpeg" };

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

async function render(bitmap: ImageBitmap, edge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  let q = quality;
  let blob = await toBlob(canvas, q);
  // Step quality down until the file fits the budget; never ship an oversized image.
  const budget = edge === THUMB_MAX_EDGE ? THUMB_MAX_BYTES : FULL_MAX_BYTES;
  while (blob.size > budget && q > 0.3) { q -= 0.1; blob = await toBlob(canvas, q); }
  if (blob.size > budget) throw new Error("image too large");
  return { blob, width, height };
}

/** `imageOrientation: "from-image"` applies EXIF rotation while decoding, so the re-encoded JPEG is upright and carries no metadata. */
export async function processImage(file: File): Promise<Processed> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await render(bitmap, FULL_MAX_EDGE, FULL_QUALITY);
    const thumb = await render(bitmap, THUMB_MAX_EDGE, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, sha256: await sha256Hex(full.blob), thumbSha256: await sha256Hex(thumb.blob), mimeType: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}
