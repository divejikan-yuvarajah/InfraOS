import { EventEmitter } from "node:events";

import { logger } from "../../shared/logger.js";

/**
 * Batch 09 seam. Typed, in-process, emitted only AFTER a transaction has committed. Batch 08 registers NO subscribers (debug log only).
 * Batch 09 will subscribe to: queue text extraction on `version_ready`, drop vectors on `archived`/`deleted`/`restricted`, and re-queue on `restored`.
 * Payloads carry ids and a few flags only, never file names, content or storage references.
 */
export type DocumentEventMap = {
  "document.version_ready": { documentId: string; versionNo: number; agencyId: string; aiProcessingAllowed: boolean; aiEligibleType: boolean };
  "document.archived": { documentId: string; agencyId: string };
  "document.restored": { documentId: string; agencyId: string };
  "document.deleted": { documentId: string; agencyId: string; versionNos: number[] };
  "document.restricted": { documentId: string; agencyId: string; confidentiality: string; aiProcessingAllowed: boolean };
};

const bus = new EventEmitter();

export function emitDocumentEvent<K extends keyof DocumentEventMap>(name: K, payload: DocumentEventMap[K]): void {
  logger.debug({ event: name, documentId: (payload as { documentId: string }).documentId }, "document event");
  try { bus.emit(name, payload); } catch (error) { logger.warn({ event: name, err: error instanceof Error ? error.message : "listener failed" }, "document event listener failed"); }
}

/** For Batch 09. Not used by Batch 08. */
export function onDocumentEvent<K extends keyof DocumentEventMap>(name: K, listener: (payload: DocumentEventMap[K]) => void): () => void {
  bus.on(name, listener);
  return () => bus.off(name, listener);
}
