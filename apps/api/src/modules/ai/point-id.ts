import { createHash } from "node:crypto";

/** Must match apps/ai-service/app/vectorstore/qdrant_store.py (uuid5 over the same namespace) so Mongo can reference Qdrant point ids. */
const NAMESPACE = "6f1b6b0e-6a43-5c64-9a0e-3f1c2d9a7b11";

export function pointId(chunkId: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(ns).update(chunkId, "utf8").digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
