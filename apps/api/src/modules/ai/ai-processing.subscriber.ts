import { logger } from "../../shared/logger.js";
import { onDocumentEvent } from "../documents/document-events.js";
import { aiConfig } from "./ai.config.js";
import { enqueueJob, loadAiDocument } from "./processing/job.service.js";
import { purgeDocument } from "./processing/purge.js";

/**
 * Batch 08 `document-events` subscribers. Events fire only after a transaction committed; a lost event is repaired by the reconciler.
 *   version_ready -> enqueue (UPLOAD/REPLACE)         archived/deleted -> purge
 *   restricted    -> re-evaluate (purge or enqueue)    restored         -> enqueue (RESTORE)
 */
const safe = (what: string, fn: () => Promise<unknown>): void => {
  void fn().catch((error: unknown) => logger.warn({ what, err: error instanceof Error ? error.name : "unknown" }, "ai document event handler failed"));
};

export async function syncDocumentAi(documentId: string, trigger: "RECONCILE" | "RESTORE"): Promise<void> {
  const facts = await loadAiDocument(documentId);
  if (!facts) return;
  if (facts.eligibility.eligible) await enqueueJob({ documentId, trigger });
  else await purgeDocument(documentId, { agencyId: String(facts.doc.agencyId) });
}

let registered: (() => void)[] = [];
export function registerAiProcessingSubscribers(): () => void {
  unregisterAiProcessingSubscribers();
  registered = [
    onDocumentEvent("document.version_ready", (e) => safe("version_ready", async () => {
      if (!aiConfig.processingEnabled) return;
      await enqueueJob({ documentId: e.documentId, versionNo: e.versionNo, trigger: e.versionNo > 1 ? "REPLACE" : "UPLOAD" });
    })),
    onDocumentEvent("document.archived", (e) => safe("archived", () => purgeDocument(e.documentId, { agencyId: e.agencyId }))),
    onDocumentEvent("document.deleted", (e) => safe("deleted", () => purgeDocument(e.documentId, { agencyId: e.agencyId }))),
    onDocumentEvent("document.restricted", (e) => safe("restricted", () => syncDocumentAi(e.documentId, "RECONCILE"))),
    onDocumentEvent("document.restored", (e) => safe("restored", async () => { if (aiConfig.processingEnabled) await syncDocumentAi(e.documentId, "RESTORE"); })),
  ];
  return unregisterAiProcessingSubscribers;
}
export function unregisterAiProcessingSubscribers(): void {
  for (const off of registered) off();
  registered = [];
}
