import { createHash, randomUUID } from "node:crypto";
import { PassThrough, Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import type { z } from "zod";
import { categoryDef, DOCUMENT_LIMITS, type DocumentErrorCode } from "@infraos/shared-types";

import { Flow, run, type Failure, type Result } from "../contractors/contractor.context.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { nextNumber } from "../../shared/database/counter.js";
import { getDocumentStorage } from "../inspections/evidence-storage.js";
import { documentReadFilter } from "./document-access.js";
import { aiEligibleFor, legacyTypeFor } from "./document-categories.js";
import { emitDocumentEvent } from "./document-events.js";
import { FileInspector, precheckFile, type Family } from "./document-validation.js";
import { capsOf, docContext, inTx, loadDocument, needPerm, notifyDocument, oid, projectManagerOf, resolveOwnership, validateLinks, writeDocAudit, type DCtx, type DocRow, type Id } from "./document.common.js";
import { commitBody, uploadInit, versionInit } from "./document.schema.js";
import { Document } from "./models/document.model.js";
import { DocumentUpload } from "./models/document-upload.model.js";
import { DocumentVersion } from "./models/document-version.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const DAILY_USER_CAP = 300;
const STATUS_FOR: Record<DocumentErrorCode, Failure["status"]> = {
  FILE_TOO_LARGE: 413, FILE_TYPE_NOT_ALLOWED: 422, FILE_SIGNATURE_MISMATCH: 422, FILE_CORRUPT: 422, FILE_EMPTY: 422, FILE_DUPLICATE_WARNING: 409, STORAGE_UNAVAILABLE: 503, FILE_ACTIVE_CONTENT: 422, UPLOAD_LIMIT_REACHED: 409,
};
/** Every file problem is an ordinary failure carrying a translatable `fileError` code in `details`. */
export const fileFlow = (code: DocumentErrorCode, extra: Record<string, unknown> = {}) => new Flow(STATUS_FOR[code], code === "STORAGE_UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : code === "FILE_DUPLICATE_WARNING" || code === "UPLOAD_LIMIT_REACHED" ? "CONFLICT" : "VALIDATION_ERROR", { fileError: code, ...extra });
const storageOrThrow = () => getDocumentStorage() ?? (() => { throw fileFlow("STORAGE_UNAVAILABLE"); })();

type Meta = {
  category: string; title?: string; description?: string; tags: string[]; documentDate?: Date; reference?: string; language?: string; expiresAt?: Date;
  visibility: string; confidentiality: string; status: string; projectId?: string; links: Record<string, string | null | undefined>;
};

/** Step 1: validates scope, category, links and file facts before a single byte is accepted. Returns an upload ticket, never a storage location. */
export const initUpload = (actor: AuthenticatedActor, input: z.infer<typeof uploadInit>) => run(async () => {
  storageOrThrow();
  const d = await docContext(actor);
  needPerm(d.ctx, "document.upload");
  const def = categoryDef(input.category);
  if (!def) throw new Flow(400, "VALIDATION_ERROR", { field: "category" });
  const pre = precheckFile({ fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, allowsImages: def.allowsImages });
  if (!pre.ok) throw fileFlow(pre.code);
  if ((await DocumentUpload.countDocuments({ actorId: oid(actor.userId), createdAt: { $gte: new Date(Date.now() - 86_400_000) } })) >= DAILY_USER_CAP) throw fileFlow("UPLOAD_LIMIT_REACHED");
  const owner = await resolveOwnership(d, actor, input.category, input.projectId);
  await validateLinks(input.category, input.links, owner);
  const confidentiality = input.confidentiality ?? (def.sensitiveByDefault ? "SENSITIVE" : "STANDARD");
  if (confidentiality === "SENSITIVE") needPerm(d.ctx, "document.restrict");
  const visibility = input.visibility ?? def.defaultVisibility;
  if (confidentiality === "SENSITIVE" && visibility === "PUBLIC") throw new Flow(400, "VALIDATION_ERROR", { field: "visibility", reason: "sensitive_not_public" });
  const meta: Meta = {
    category: input.category, ...(input.title ? { title: input.title } : {}), ...(input.description ? { description: input.description } : {}), tags: input.tags,
    ...(input.documentDate ? { documentDate: input.documentDate } : {}), ...(input.reference ? { reference: input.reference } : {}), ...(input.language ? { language: input.language } : {}), ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    visibility, confidentiality, status: input.status, ...(owner.projectId ? { projectId: String(owner.projectId) } : {}), links: input.links,
  };
  const ticket = await DocumentUpload.create({ kind: "NEW", actorId: oid(actor.userId), agencyId: owner.agencyId, documentId: new mongoose.Types.ObjectId(), versionNo: 1, fileName: pre.fileName, declaredMime: pre.mime, declaredSize: input.sizeBytes, meta });
  return ok({ ticket: String(ticket._id), fileName: pre.fileName, upload: { path: `/documents/uploads/${ticket._id}/content`, method: "PUT", contentType: "application/octet-stream", maxBytes: input.sizeBytes } });
});

/** Replace flow init. Requires edit rights on the document; the new file is validated against the document's own category. */
export const initVersionUpload = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof versionInit>) => run(async () => {
  storageOrThrow();
  const d = await docContext(actor);
  needPerm(d.ctx, "document.upload");
  const doc = await loadDocument(d, rawId);
  if (!capsOf(d, doc).canReplace) throw new Flow(403, "FORBIDDEN");
  const next = (doc.currentVersionNo ?? 0) + 1;
  if (next > DOCUMENT_LIMITS.maxVersions) throw new Flow(409, "CONFLICT", { reason: "version_cap" });
  const def = categoryDef(doc.category ?? "OTHER");
  const pre = precheckFile({ fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, allowsImages: def?.allowsImages ?? false });
  if (!pre.ok) throw fileFlow(pre.code);
  if ((await DocumentUpload.countDocuments({ actorId: oid(actor.userId), createdAt: { $gte: new Date(Date.now() - 86_400_000) } })) >= DAILY_USER_CAP) throw fileFlow("UPLOAD_LIMIT_REACHED");
  const ticket = await DocumentUpload.create({ kind: "VERSION", actorId: oid(actor.userId), agencyId: doc.agencyId as Id, documentId: doc._id, versionNo: next, fileName: pre.fileName, declaredMime: pre.mime, declaredSize: input.sizeBytes, changeNote: input.changeNote });
  return ok({ ticket: String(ticket._id), fileName: pre.fileName, versionNo: next, upload: { path: `/documents/${doc._id}/versions/${ticket._id}/content`, method: "PUT", contentType: "application/octet-stream", maxBytes: input.sizeBytes } });
});

class Gate extends Transform {
  size = 0;
  readonly hash = createHash("sha256");
  readonly inspector: FileInspector;
  verdict: ReturnType<FileInspector["finish"]> | null = null;
  constructor(family: Family, ext: string, private readonly declared: number) { super(); this.inspector = new FileInspector(family, ext); }
  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null, d?: Buffer) => void): void {
    this.size += chunk.length;
    if (this.size > this.declared) return cb(fileFlow("FILE_TOO_LARGE"));
    this.hash.update(chunk);
    this.inspector.push(chunk);
    cb(null, chunk);
  }
  override _flush(cb: (e?: Error | null) => void): void {
    if (this.size !== this.declared) return cb(fileFlow(this.size === 0 ? "FILE_EMPTY" : "FILE_CORRUPT"));
    this.verdict = this.inspector.finish();
    if (!this.verdict.ok) return cb(fileFlow(this.verdict.code));
    cb();
  }
}

/** Step 2: streams bytes into storage. Size and signature are enforced while streaming; any failure removes the partial blob and leaves nothing behind. */
export const streamUpload = (actor: AuthenticatedActor, ticketId: string, body: Readable, contentLength: number | null, expectedDocumentId?: string) => run(async () => {
  const storage = storageOrThrow();
  if (!/^[a-f0-9]{24}$/i.test(ticketId)) throw new Flow(404, "NOT_FOUND");
  const d = await docContext(actor);
  needPerm(d.ctx, "document.upload");
  const ticket = await DocumentUpload.findOneAndUpdate({ _id: ticketId, actorId: oid(actor.userId), status: "PENDING" }, { $set: { status: "STORED" } }, { new: true }).lean();
  if (!ticket || (expectedDocumentId && String(ticket.documentId) !== expectedDocumentId)) throw new Flow(404, "NOT_FOUND");
  const reject = async (code: DocumentErrorCode, key?: string): Promise<never> => {
    if (key) await storage.delete(key).catch(() => undefined);
    await DocumentUpload.updateOne({ _id: ticket._id }, { $set: { status: "REJECTED" } });
    await writeDocAudit(undefined, { actor, action: "document.upload_rejected", documentId: ticket.documentId as Id, agencyId: ticket.agencyId as Id, newValue: { reason: code }, requestId: "upload" }).catch(() => undefined);
    body.resume();
    throw fileFlow(code);
  };
  const pre = precheckFile({ fileName: ticket.fileName, mimeType: ticket.declaredMime, sizeBytes: ticket.declaredSize, allowsImages: true });
  if (!pre.ok) return reject(pre.code);
  if (contentLength !== null && contentLength > ticket.declaredSize) return reject("FILE_TOO_LARGE");
  const key = `doc/${ticket.documentId}/v${ticket.versionNo}/${randomUUID()}`;
  const gate = new Gate(pre.family, pre.ext, ticket.declaredSize);
  const out = new PassThrough();
  const [fed, put] = await Promise.allSettled([pipeline(body, gate, out), storage.putStream(key, out, pre.mime)]);
  if (fed.status === "rejected" || put.status === "rejected") {
    const err = fed.status === "rejected" ? fed.reason : (put as PromiseRejectedResult).reason;
    if (err instanceof Flow && typeof err.details?.fileError === "string") return reject(err.details.fileError as DocumentErrorCode, key);
    await storage.delete(key).catch(() => undefined);
    await DocumentUpload.updateOne({ _id: ticket._id }, { $set: { status: "ABORTED" } });
    throw fileFlow("STORAGE_UNAVAILABLE");
  }
  const hash = gate.hash.digest("hex");
  const verdict = gate.verdict as { ok: true; activeContent: boolean };
  // Duplicate = same bytes already stored in this agency among documents the caller may read. The server never silently de-duplicates.
  const dupFilter = ticket.kind === "VERSION" ? { _id: ticket.documentId, contentHash: hash } : { agencyId: ticket.agencyId, contentHash: hash, deletedAt: { $exists: false } };
  const dup = await Document.findOne({ $and: [documentReadFilter(d.viewer), dupFilter] }).select("docNo title fileName").lean();
  await DocumentUpload.updateOne({ _id: ticket._id }, { $set: { storageRef: key, sizeBytes: gate.size, contentHash: hash, detectedMime: pre.mime, activeContent: verdict.activeContent, ...(dup ? { duplicateOf: dup._id } : {}) } });
  return ok({ ticket: String(ticket._id), sizeBytes: gate.size, contentHash: hash, activeContent: verdict.activeContent, duplicate: dup ? { id: String(dup._id), docNo: dup.docNo ?? null, title: dup.title ?? dup.fileName } : null });
});

export const abortUpload = (actor: AuthenticatedActor, ticketId: string) => run(async () => {
  if (!/^[a-f0-9]{24}$/i.test(ticketId)) throw new Flow(404, "NOT_FOUND");
  const ticket = await DocumentUpload.findOneAndUpdate({ _id: ticketId, actorId: oid(actor.userId), status: { $in: ["PENDING", "STORED"] } }, { $set: { status: "ABORTED" } }, { new: false }).select("+storageRef").lean();
  if (!ticket) throw new Flow(404, "NOT_FOUND");
  if (ticket.storageRef) await getDocumentStorage()?.delete(ticket.storageRef).catch(() => undefined);
  return ok({ aborted: true });
});

type AppendInput = { d: DCtx; actor: AuthenticatedActor; doc: DocRow; storageRef: string; fileName: string; mime: string; size: number; hash: string; changeNote: string; activeContent: boolean; restoredFrom?: number; action: "document.version_added" | "document.version_restored"; requestId: string };

/** Atomic: previous CURRENT -> SUPERSEDED, new immutable version row, document pointers updated (optimistic `version`), audit in the same transaction. */
export async function appendVersion(session: mongoose.ClientSession, i: AppendInput): Promise<{ versionNo: number; previousUploader: Id | null }> {
  const versionNo = (i.doc.currentVersionNo ?? 0) + 1;
  if (versionNo > DOCUMENT_LIMITS.maxVersions) throw new Flow(409, "CONFLICT", { reason: "version_cap" });
  const prev = await DocumentVersion.findOneAndUpdate({ documentId: i.doc._id, status: "CURRENT" }, { $set: { status: "SUPERSEDED" } }, { session, new: false }).select("uploadedBy").lean();
  const [ver] = await DocumentVersion.create([{ documentId: i.doc._id, versionNo, storageRef: i.storageRef, fileName: i.fileName, mimeType: i.mime, sizeBytes: i.size, contentHash: i.hash, uploadedBy: oid(i.actor.userId), changeNote: i.changeNote, ...(i.restoredFrom ? { restoredFromVersionNo: i.restoredFrom } : {}), activeContent: i.activeContent, status: "CURRENT" }], { session });
  const eligible = aiEligibleFor(i.mime);
  const upd = await Document.findOneAndUpdate({ _id: i.doc._id, version: i.doc.version ?? 0, currentVersionNo: i.doc.currentVersionNo ?? 0 }, {
    $set: { fileName: i.fileName, mimeType: i.mime, sizeBytes: i.size, contentHash: i.hash, currentVersionNo: versionNo, currentVersionId: ver!._id, extractedTextStatus: "NOT_STARTED", aiEligibleType: eligible }, $unset: { pageCount: "" }, $inc: { version: 1 },
  }, { session, new: true });
  if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
  await writeDocAudit(session, { actor: i.actor, action: i.action, documentId: i.doc._id, agencyId: i.doc.agencyId as Id, newValue: { status: i.doc.status ?? "ACTIVE" }, requestId: i.requestId });
  return { versionNo, previousUploader: (prev?.uploadedBy as Id | undefined) ?? null };
}

/** Step 3: finalises. New document: Document + version 1 + audit together. Replacement: appendVersion. Nothing partial can exist after a failure. */
export const commitUpload = (actor: AuthenticatedActor, ticketId: string, rawBody: z.infer<typeof commitBody>, requestId: string, expectedDocumentId?: string) => run(async () => {
  if (!/^[a-f0-9]{24}$/i.test(ticketId)) throw new Flow(404, "NOT_FOUND");
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    needPerm(d.ctx, "document.upload");
    const ticket = await DocumentUpload.findOne({ _id: ticketId, actorId: oid(actor.userId) }).select("+storageRef").session(session).lean();
    if (!ticket || (expectedDocumentId && String(ticket.documentId) !== expectedDocumentId)) throw new Flow(404, "NOT_FOUND");
    if (ticket.status !== "STORED" || !ticket.storageRef || !ticket.contentHash || !ticket.sizeBytes) throw new Flow(409, "CONFLICT", { reason: "not_ready" });
    if (ticket.duplicateOf && !rawBody.allowDuplicate) {
      const ex = await Document.findById(ticket.duplicateOf).select("docNo title fileName").session(session).lean();
      throw fileFlow("FILE_DUPLICATE_WARNING", { existing: ex ? { id: String(ex._id), docNo: ex.docNo ?? null, title: ex.title ?? ex.fileName } : null });
    }
    const base = { storageRef: ticket.storageRef, fileName: ticket.fileName, mime: ticket.detectedMime ?? ticket.declaredMime, size: ticket.sizeBytes, hash: ticket.contentHash, activeContent: Boolean(ticket.activeContent), requestId };
    if (ticket.kind === "VERSION") {
      const doc = await loadDocument(d, String(ticket.documentId), session);
      if (!capsOf(d, doc).canReplace) throw new Flow(403, "FORBIDDEN");
      if ((doc.currentVersionNo ?? 0) + 1 !== ticket.versionNo) throw new Flow(409, "CONFLICT", { reason: "stale" });
      const r = await appendVersion(session, { d, actor, doc, ...base, changeNote: ticket.changeNote ?? "", action: "document.version_added" });
      await DocumentUpload.updateOne({ _id: ticket._id }, { $set: { status: "COMMITTED" } }, { session });
      return { documentId: doc._id, agencyId: doc.agencyId as Id, projectId: (doc.projectId as Id | undefined) ?? null, versionNo: r.versionNo, previousUploader: r.previousUploader, replaced: true, aiAllowed: doc.aiProcessingAllowed ?? true, mime: base.mime, docNo: doc.docNo ?? null };
    }
    const meta = ticket.meta as Meta;
    meta.tags ??= [];
    const owner = await resolveOwnership(d, actor, meta.category, meta.projectId, session);
    if (String(owner.agencyId) !== String(ticket.agencyId)) throw new Flow(409, "CONFLICT", { reason: "scope_changed" });
    const links = await validateLinks(meta.category, meta.links ?? {}, owner, session);
    if (meta.confidentiality === "SENSITIVE") needPerm(d.ctx, "document.restrict");
    const docNo = await nextNumber("DOC", new Date(), session);
    const sensitive = meta.confidentiality === "SENSITIVE";
    const [doc] = await Document.create([{
      _id: ticket.documentId, ...(owner.projectId ? { projectId: owner.projectId } : {}), agencyId: owner.agencyId, documentType: legacyTypeFor(meta.category), category: meta.category, docNo,
      title: meta.title ?? ticket.fileName.replace(/\.[^.]+$/, "").slice(0, 200), ...(meta.description ? { description: meta.description } : {}), fileName: base.fileName, mimeType: base.mime, sizeBytes: base.size, contentHash: base.hash,
      uploadedBy: oid(actor.userId), ownerId: oid(actor.userId), uploadedByAgencyId: oid(actor.agencyId), currentVersionNo: 1, status: meta.status, visibility: meta.visibility, confidentiality: meta.confidentiality,
      aiProcessingAllowed: !sensitive, aiEligibleType: aiEligibleFor(base.mime), origin: "DOCTRACE", tags: meta.tags, ...(meta.documentDate ? { documentDate: meta.documentDate } : {}), ...(meta.reference ? { reference: meta.reference } : {}),
      ...(meta.language ? { language: meta.language } : {}), ...(meta.expiresAt ? { expiresAt: meta.expiresAt } : {}), ...links, version: 0,
    }], { session });
    const [ver] = await DocumentVersion.create([{ documentId: doc!._id, versionNo: 1, storageRef: base.storageRef, fileName: base.fileName, mimeType: base.mime, sizeBytes: base.size, contentHash: base.hash, uploadedBy: oid(actor.userId), activeContent: base.activeContent, status: "CURRENT" }], { session });
    await Document.updateOne({ _id: doc!._id }, { $set: { currentVersionId: ver!._id } }, { session, timestamps: false });
    await writeDocAudit(session, { actor, action: "document.uploaded", documentId: doc!._id, agencyId: owner.agencyId, ...(owner.projectId ? { newValue: { status: meta.status, projectId: owner.projectId } } : { newValue: { status: meta.status } }), requestId });
    await DocumentUpload.updateOne({ _id: ticket._id }, { $set: { status: "COMMITTED" } }, { session });
    return { documentId: doc!._id, agencyId: owner.agencyId, projectId: owner.projectId, versionNo: 1, previousUploader: null, replaced: false, aiAllowed: !sensitive, mime: base.mime, docNo };
  });
  emitDocumentEvent("document.version_ready", { documentId: String(out.documentId), versionNo: out.versionNo, agencyId: String(out.agencyId), aiProcessingAllowed: out.aiAllowed, aiEligibleType: aiEligibleFor(out.mime) });
  const pm = await projectManagerOf(out.projectId);
  const ref = out.docNo ?? "a document";
  if (out.replaced) await notifyDocument([out.previousUploader, pm], { title: "Document file replaced", message: `A new version of ${ref} was uploaded.`, documentId: out.documentId, eventKey: `docv:${out.documentId}:${out.versionNo}`.slice(0, 50), exclude: [actor.userId] });
  else if (pm) await notifyDocument([pm], { title: "New project document", message: `${ref} was added to a project you manage.`, documentId: out.documentId, eventKey: `docn:${out.documentId}`.slice(0, 50), exclude: [actor.userId] });
  return ok({ id: String(out.documentId), docNo: out.docNo, versionNo: out.versionNo });
});
