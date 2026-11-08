import type { Readable } from "node:stream";
import type { z } from "zod";

import { Flow, run, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { User } from "../identity/models/user.model.js";
import { getDocumentStorage } from "../inspections/evidence-storage.js";
import { emitDocumentEvent } from "./document-events.js";
import { previewable } from "./document-validation.js";
import { appendVersion, fileFlow } from "./document-upload.service.js";
import { capsOf, docContext, inTx, iso, loadDocument, needPerm, notifyDocument, oid, projectManagerOf, writeDocAudit, type Id } from "./document.common.js";
import type { removeVersionBody, restoreVersionBody } from "./document.schema.js";
import { aiEligibleFor } from "./document-categories.js";
import { Document } from "./models/document.model.js";
import { DocumentVersion } from "./models/document-version.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export type OpenedFile = { stream: Readable; mime: string; size: number; fileName: string; versionNo: number; activeContent: boolean };

/**
 * INTERNAL ONLY. Used later by the Batch 09 AI pipeline (service-to-service). It deliberately takes no actor and is NOT wired to any route:
 * the `internal: true` literal is a compile-time guard, and the runtime check below refuses anything else. Public reads go through `openFile`.
 */
export async function openDocumentStream(documentId: string, versionNo: number | null, opts: { internal: true }): Promise<OpenedFile | null> {
  if (opts?.internal !== true) throw new Error("openDocumentStream is internal");
  const doc = await Document.findOne({ _id: documentId, deletedAt: { $exists: false } }).select("currentVersionNo").lean();
  if (!doc) return null;
  const ver = await DocumentVersion.findOne({ documentId, versionNo: versionNo ?? doc.currentVersionNo, status: { $ne: "REMOVED" } }).select("+storageRef versionNo mimeType sizeBytes fileName activeContent").lean();
  const storage = getDocumentStorage();
  if (!ver?.storageRef || !storage) return null;
  return { stream: storage.open(ver.storageRef), mime: ver.mimeType, size: ver.sizeBytes, fileName: ver.fileName, versionNo: ver.versionNo, activeContent: Boolean(ver.activeContent) };
}

/** Authenticated, scope-checked open. Out of scope = 404. `download` needs document.download and is audited (count only); `preview` needs document.read. */
export const openFile = (actor: AuthenticatedActor, rawId: string, versionNo: number | undefined, mode: "download" | "preview", requestId: string) => run(async () => {
  const storage = getDocumentStorage();
  if (!storage) throw fileFlow("STORAGE_UNAVAILABLE");
  const d = await docContext(actor);
  needPerm(d.ctx, mode === "download" ? "document.download" : "document.read");
  const doc = await loadDocument(d, rawId);
  if ((doc.origin ?? "DOCTRACE") !== "DOCTRACE") throw new Flow(404, "NOT_FOUND"); // evidence bytes are served by the inspection module only
  const n = versionNo ?? doc.currentVersionNo;
  if (!n || !doc.currentVersionId) throw new Flow(404, "NOT_FOUND", { reason: "FILE_NOT_AVAILABLE" });
  const ver = await DocumentVersion.findOne({ documentId: doc._id, versionNo: n, status: { $ne: "REMOVED" } }).select("+storageRef versionNo mimeType sizeBytes fileName activeContent").lean();
  if (!ver?.storageRef || !(await storage.exists(ver.storageRef))) throw new Flow(404, "NOT_FOUND", { reason: "FILE_NOT_AVAILABLE" });
  if (mode === "preview" && !previewable(ver.mimeType, Boolean(ver.activeContent))) throw new Flow(409, "CONFLICT", { reason: "PREVIEW_NOT_AVAILABLE" });
  if (mode === "download") await writeDocAudit(undefined, { actor, action: "document.downloaded", documentId: doc._id, agencyId: doc.agencyId as Id, requestId }).catch(() => undefined);
  return ok({ stream: storage.open(ver.storageRef), mime: ver.mimeType, size: ver.sizeBytes, fileName: ver.fileName, versionNo: ver.versionNo, activeContent: Boolean(ver.activeContent) } satisfies OpenedFile);
});

export const listVersions = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const doc = await loadDocument(d, rawId);
  const rows = await DocumentVersion.find({ documentId: doc._id }).sort({ versionNo: -1 }).limit(25).lean();
  const users = await User.find({ _id: { $in: [...new Set(rows.map((r) => String(r.uploadedBy)))] } }).select("firstName lastName").lean();
  const names = new Map(users.map((u) => [String(u._id), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]));
  const caps = capsOf(d, doc);
  return ok({
    versions: rows.map((r) => ({
      versionNo: r.versionNo, fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, contentHash: r.contentHash, changeNote: r.changeNote ?? null, status: r.status, current: r.versionNo === doc.currentVersionNo,
      uploadedBy: names.get(String(r.uploadedBy)) ?? null, createdAt: iso((r as { createdAt?: Date }).createdAt), restoredFromVersionNo: r.restoredFromVersionNo ?? null,
      previewable: previewable(r.mimeType, Boolean(r.activeContent)), activeContent: Boolean(r.activeContent), removedAt: iso(r.removedAt),
    })),
    permissions: { canRestore: caps.canReplace, canRemove: d.ctx.has("document.delete") && d.viewer.roleKey === "GOV_ADMIN" },
  });
});

/** Restoring creates a NEW version that points at the old bytes. History is never rewritten. */
export const restoreVersion = (actor: AuthenticatedActor, rawId: string, rawN: string, input: z.infer<typeof restoreVersionBody>, requestId: string) => run(async () => {
  const n = Number(rawN);
  if (!Number.isInteger(n) || n < 1) throw new Flow(404, "NOT_FOUND");
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    needPerm(d.ctx, "document.upload");
    const doc = await loadDocument(d, rawId, session);
    if (!capsOf(d, doc).canReplace) throw new Flow(403, "FORBIDDEN");
    if (n === doc.currentVersionNo) throw new Flow(409, "CONFLICT", { reason: "already_current" });
    const old = await DocumentVersion.findOne({ documentId: doc._id, versionNo: n, status: { $ne: "REMOVED" } }).select("+storageRef fileName mimeType sizeBytes contentHash activeContent").session(session).lean();
    if (!old?.storageRef) throw new Flow(404, "NOT_FOUND");
    const r = await appendVersion(session, { d, actor, doc, storageRef: old.storageRef, fileName: old.fileName, mime: old.mimeType, size: old.sizeBytes, hash: old.contentHash, changeNote: input.changeNote, activeContent: Boolean(old.activeContent), restoredFrom: n, action: "document.version_restored", requestId });
    return { doc, r };
  });
  emitDocumentEvent("document.version_ready", { documentId: rawId, versionNo: out.r.versionNo, agencyId: String(out.doc.agencyId), aiProcessingAllowed: out.doc.aiProcessingAllowed ?? true, aiEligibleType: aiEligibleFor(out.doc.mimeType ?? "") });
  await notifyDocument([out.r.previousUploader, await projectManagerOf(out.doc.projectId as Id | undefined)], { title: "Document version restored", message: `An earlier version of ${out.doc.docNo ?? "a document"} was restored.`, documentId: out.doc._id, eventKey: `docr:${out.doc._id}:${out.r.versionNo}`.slice(0, 50), exclude: [actor.userId] });
  return ok({ versionNo: out.r.versionNo });
});

/** Permanent removal of an OLD version's bytes: GOV_ADMIN with a reason. The row stays as REMOVED. Bytes shared with another live version are kept. */
export const removeVersion = (actor: AuthenticatedActor, rawId: string, rawN: string, input: z.infer<typeof removeVersionBody>, requestId: string) => run(async () => {
  const n = Number(rawN);
  if (!Number.isInteger(n) || n < 1) throw new Flow(404, "NOT_FOUND");
  const storage = getDocumentStorage();
  if (!storage) throw fileFlow("STORAGE_UNAVAILABLE");
  const ref = await inTx(async (session) => {
    const d = await docContext(actor, session);
    needPerm(d.ctx, "document.delete");
    const doc = await loadDocument(d, rawId, session);
    if (d.viewer.roleKey !== "GOV_ADMIN" || !capsOf(d, doc).canArchive) throw new Flow(403, "FORBIDDEN");
    if (n === doc.currentVersionNo) throw new Flow(409, "CONFLICT", { reason: "current_version" });
    const ver = await DocumentVersion.findOneAndUpdate({ documentId: doc._id, versionNo: n, status: { $ne: "REMOVED" } }, { $set: { status: "REMOVED", removedAt: new Date(), removedBy: oid(actor.userId), removeReason: input.reason }, $unset: { storageRef: "" } }, { session, new: false }).select("+storageRef").lean();
    if (!ver) throw new Flow(404, "NOT_FOUND");
    await writeDocAudit(session, { actor, action: "document.updated", documentId: doc._id, agencyId: doc.agencyId as Id, newValue: { reason: input.reason }, requestId });
    const shared = ver.storageRef ? await DocumentVersion.exists({ storageRef: ver.storageRef, status: { $ne: "REMOVED" } }).session(session) : null;
    return shared ? null : ver.storageRef ?? null;
  });
  if (ref) await storage.delete(ref).catch(() => undefined);
  return ok({ removed: true });
});

