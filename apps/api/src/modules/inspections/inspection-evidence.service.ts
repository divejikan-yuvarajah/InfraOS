import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import mongoose from "mongoose";
import type { z } from "zod";

import { contextOf, Flow, need, run, type Result } from "../contractors/contractor.context.js";
import { Document } from "../documents/models/document.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { checklistFor } from "./inspection-checklists.js";
import { getEvidenceStorage, storageKeyFor } from "./evidence-storage.js";
import { MAX_EVIDENCE, MAX_FULL_BYTES, MAX_THUMB_BYTES, type InspectionType } from "./inspection.constants.js";
import { inTransaction, inspectionScope, loadInspection, oid, writeInspectionAudit, isId } from "./inspection.common.js";
import { sitePresence, sniffImage } from "./inspection.rules.js";
import type { evidenceBody, evidencePatch, evidenceRemoveBody } from "./inspection.schema.js";
import { InspectionEvidence } from "./models/inspection-evidence.model.js";
import { Inspection } from "./models/inspection.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const EDITABLE = ["IN_PROGRESS", "REQUIRES_REVIEW"];
const FIVE_MIN = 5 * 60_000;
const FOURTEEN_DAYS = 14 * 86_400_000;

const storageOrThrow = () => {
  const s = getEvidenceStorage();
  if (!s) throw new Flow(503, "SERVICE_UNAVAILABLE", { reason: "STORAGE_NOT_CONFIGURED" });
  return s;
};

/** Step 1 of the upload: registers metadata and returns the evidence id. No bytes yet. */
export const createEvidence = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof evidenceBody>, requestId: string) => run(async () => {
  storageOrThrow();
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "inspection.submit");
    const row = await loadInspection(ctx, actor, rawId, session, "inspector");
    if (!EDITABLE.includes(row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
    if (input.capturedAt.getTime() > now.getTime() + FIVE_MIN || input.capturedAt.getTime() < row.inspectionDate.getTime() - FOURTEEN_DAYS) throw new Flow(400, "VALIDATION_ERROR", { field: "capturedAt" });
    if (input.checklistItemKey && !checklistFor((row.inspectionType ?? "PROGRESS_VERIFICATION") as InspectionType).some((i) => i.key === input.checklistItemKey)) throw new Flow(400, "VALIDATION_ERROR", { field: "checklistItemKey" });
    const live = await InspectionEvidence.find({ inspectionId: row._id, status: { $in: ["ACTIVE", "PENDING_UPLOAD"] } }).select("sha256").session(session).lean();
    const dup = live.find((e) => e.sha256 === input.sha256);
    if (dup) throw new Flow(409, "CONFLICT", { reason: "duplicate", evidenceId: String(dup._id) });
    if (live.length >= MAX_EVIDENCE) throw new Flow(409, "CONFLICT", { reason: "evidence_cap" });
    const project = await Project.findById(row.projectId).select("geometry agencyId").session(session).lean();
    if (!project) throw new Flow(404, "NOT_FOUND");
    const evidenceId = new mongoose.Types.ObjectId();
    const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
    const base = { projectId: row.projectId, documentType: "SITE_EVIDENCE" as const, uploadedBy: oid(actor.userId), visibility: "INTERNAL" as const };
    const [doc] = await Document.create([{ ...base, fileName: `${row.inspectionNo ?? "inspection"}-${live.length + 1}.${ext}`, mimeType: input.mimeType, sizeBytes: input.sizeBytes, storageKey: storageKeyFor(String(row._id), String(evidenceId), "full") }], { session });
    const [thumbDoc] = input.thumb ? await Document.create([{ ...base, fileName: `${row.inspectionNo ?? "inspection"}-${live.length + 1}-thumb.jpg`, mimeType: "image/jpeg", sizeBytes: input.thumb.sizeBytes, storageKey: storageKeyFor(String(row._id), String(evidenceId), "thumb") }], { session }) : [undefined];
    const presence = input.location ? sitePresence([input.location.lon, input.location.lat], row.sitePoint ? [row.sitePoint.coordinates[0]!, row.sitePoint.coordinates[1]!] : null, project.geometry as { type: string; coordinates: unknown } | undefined) : null;
    await InspectionEvidence.create([{
      _id: evidenceId, inspectionId: row._id, projectId: row.projectId, agencyId: project.agencyId, documentId: doc!._id, ...(thumbDoc ? { thumbDocumentId: thumbDoc._id } : {}),
      ...(input.caption ? { caption: input.caption } : {}), ...(input.checklistItemKey ? { checklistItemKey: input.checklistItemKey } : {}), ...(input.defectKey ? { defectKey: input.defectKey } : {}),
      capturedAt: input.capturedAt, uploadedAt: now, uploadedBy: oid(actor.userId),
      ...(input.location ? { location: { point: { type: "Point", coordinates: [input.location.lon, input.location.lat] }, accuracyM: input.location.accuracyM, source: "DEVICE" } } : {}),
      sha256: input.sha256, ...(input.thumb ? { thumbSha256: input.thumb.sha256, thumbSizeBytes: input.thumb.sizeBytes } : {}), mimeType: input.mimeType, width: input.width, height: input.height, sizeBytes: input.sizeBytes,
      status: "PENDING_UPLOAD", ...(presence ? { sitePresence: presence } : {}),
    }], { session });
    await writeInspectionAudit(session, { actor, action: "inspection.evidence_added", inspectionId: row._id, agencyId: row.agencyId, newValue: { status: row.status }, requestId });
    return { evidenceId: String(evidenceId), sitePresence: presence };
  });
  return ok({ evidenceId: out.evidenceId, sitePresence: out.sitePresence, upload: { path: `/inspections/evidence/${out.evidenceId}/file`, variants: ["full", "thumb"] } });
});

async function loadOwnEvidence(actor: AuthenticatedActor, evidenceId: string, session?: mongoose.ClientSession) {
  if (!isId(evidenceId)) throw new Flow(404, "NOT_FOUND");
  const ctx = await contextOf(actor, session);
  need(ctx, "inspection.submit");
  const q = InspectionEvidence.findOne({ _id: evidenceId, uploadedBy: oid(actor.userId) });
  if (session) q.session(session);
  const ev = await q.lean();
  if (!ev) throw new Flow(404, "NOT_FOUND");
  const insp = await loadInspection(ctx, actor, String(ev.inspectionId), session, "inspector");
  return { ev, insp, ctx };
}

/** Step 2: raw bytes. Validates magic bytes, size and SHA-256 before anything is stored. Idempotent on retry. */
export const uploadEvidenceFile = (actor: AuthenticatedActor, evidenceId: string, variant: "full" | "thumb", data: Buffer) => run(async () => {
  const storage = storageOrThrow();
  const { ev, insp } = await loadOwnEvidence(actor, evidenceId);
  if (!EDITABLE.includes(insp.status) || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: ev.status === "REMOVED" ? "REMOVED" : insp.status });
  const cap = variant === "full" ? MAX_FULL_BYTES : MAX_THUMB_BYTES;
  if (!data.length) throw new Flow(400, "VALIDATION_ERROR", { reason: "empty" });
  if (data.length > cap) throw new Flow(413, "VALIDATION_ERROR", { reason: "too_large" });
  const real = sniffImage(data);
  if (!real || (variant === "full" && real !== ev.mimeType)) throw new Flow(400, "VALIDATION_ERROR", { reason: "unsupported_or_mismatched_type" });
  const expected = variant === "full" ? ev.sha256 : ev.thumbSha256;
  if (variant === "thumb" && !ev.thumbDocumentId) throw new Flow(400, "VALIDATION_ERROR", { reason: "no_thumb_declared" });
  const actual = createHash("sha256").update(data).digest("hex");
  if (!expected || actual !== expected) throw new Flow(422, "VALIDATION_ERROR", { reason: "hash_mismatch" });
  if (variant === "full" && data.length !== ev.sizeBytes) throw new Flow(422, "VALIDATION_ERROR", { reason: "size_mismatch" });
  const key = storageKeyFor(String(ev.inspectionId), String(ev._id), variant);
  if (!(await storage.exists(key))) await storage.put(key, data, real);
  if (variant === "full") {
    await InspectionEvidence.updateOne({ _id: ev._id, status: { $in: ["PENDING_UPLOAD", "ACTIVE"] } }, { $set: { status: "ACTIVE" } });
    await Inspection.updateOne({ _id: ev.inspectionId }, { $addToSet: { evidence: ev.documentId } }, { timestamps: false });
  }
  return ok({ evidenceId: String(ev._id), variant, status: variant === "full" ? "ACTIVE" : ev.status });
});

export const patchEvidence = (actor: AuthenticatedActor, evidenceId: string, input: z.infer<typeof evidencePatch>) => run(async () => {
  const { ev, insp } = await loadOwnEvidence(actor, evidenceId);
  if (!EDITABLE.includes(insp.status) || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: insp.status });
  if (input.checklistItemKey && !checklistFor((insp.inspectionType ?? "PROGRESS_VERIFICATION") as InspectionType).some((i) => i.key === input.checklistItemKey)) throw new Flow(400, "VALIDATION_ERROR", { field: "checklistItemKey" });
  const $set: Record<string, unknown> = {}; const $unset: Record<string, 1> = {};
  for (const k of ["caption", "checklistItemKey", "defectKey"] as const) {
    const v = input[k];
    if (v === undefined) continue;
    if (v === null || v === "") $unset[k] = 1; else $set[k] = v;
  }
  await InspectionEvidence.updateOne({ _id: ev._id }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
  return ok({ updated: true });
});

export const removeEvidence = (actor: AuthenticatedActor, evidenceId: string, input: z.infer<typeof evidenceRemoveBody>, requestId: string) => run(async () => {
  const storage = storageOrThrow();
  const now = new Date();
  const toDelete = await inTransaction(async (session) => {
    const { ev, insp } = await loadOwnEvidence(actor, evidenceId, session);
    if (!EDITABLE.includes(insp.status) || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: insp.status });
    await InspectionEvidence.updateOne({ _id: ev._id, status: { $ne: "REMOVED" } }, { $set: { status: "REMOVED", removedBy: oid(actor.userId), removedAt: now, removalReason: input.reason } }, { session });
    await Inspection.updateOne({ _id: insp._id }, { $pull: { evidence: ev.documentId } }, { session, timestamps: false });
    await writeInspectionAudit(session, { actor, action: "inspection.evidence_removed", inspectionId: insp._id, agencyId: insp.agencyId, newValue: { status: insp.status }, requestId });
    // Bytes are kept once the inspection has been submitted (accountability); never-submitted evidence is physically removed.
    return (insp.submissions?.length ?? 0) === 0 ? [storageKeyFor(String(insp._id), String(ev._id), "full"), storageKeyFor(String(insp._id), String(ev._id), "thumb")] : [];
  });
  for (const key of toDelete) await storage.delete(key).catch(() => undefined);
  return ok({ removed: true });
});

/** Authenticated, scope-checked streaming. Never a public or presigned URL. Removed files are visible to reviewers only. */
export async function openEvidenceFile(actor: AuthenticatedActor, evidenceId: string, variant: "full" | "thumb"): Promise<{ ok: true; stream: Readable; mime: string; size: number } | { ok: false; status: 401 | 403 | 404 | 503 }> {
  try {
    if (!isId(evidenceId)) return { ok: false, status: 404 };
    const storage = getEvidenceStorage();
    if (!storage) return { ok: false, status: 503 };
    const ctx = await contextOf(actor);
    if (!ctx.has("inspection.read")) return { ok: false, status: 403 };
    const ev = await InspectionEvidence.findById(evidenceId).lean();
    if (!ev) return { ok: false, status: 404 };
    const insp = await Inspection.findOne({ $and: [inspectionScope(ctx, actor), { _id: ev.inspectionId }] }).select("inspectorId submissions.no").lean();
    if (!insp) return { ok: false, status: 404 };
    const reviewer = ctx.has("inspection.verify") || ctx.has("inspection.reject");
    if (ev.status === "PENDING_UPLOAD" && String(ev.uploadedBy) !== actor.userId) return { ok: false, status: 404 };
    if (ev.status === "REMOVED" && !(reviewer && String(insp.inspectorId) !== actor.userId && (insp.submissions?.length ?? 0) > 0)) return { ok: false, status: 404 };
    const useThumb = variant === "thumb" && Boolean(ev.thumbDocumentId) && (await storage.exists(storageKeyFor(String(ev.inspectionId), String(ev._id), "thumb")));
    const key = storageKeyFor(String(ev.inspectionId), String(ev._id), useThumb ? "thumb" : "full");
    if (!(await storage.exists(key))) return { ok: false, status: 404 };
    return { ok: true, stream: storage.open(key), mime: useThumb ? "image/jpeg" : ev.mimeType, size: useThumb ? ev.thumbSizeBytes ?? 0 : ev.sizeBytes };
  } catch (error) {
    if (error instanceof Flow) return { ok: false, status: error.status === 401 ? 401 : error.status === 403 ? 403 : 404 };
    return { ok: false, status: 503 };
  }
}

