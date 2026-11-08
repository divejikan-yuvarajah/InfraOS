import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import mongoose from "mongoose";
import type { z } from "zod";

import { contextOf, Flow, need, run, type Result } from "../contractors/contractor.context.js";
import { Document } from "../documents/models/document.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { getEvidenceStorage } from "../inspections/evidence-storage.js";
import { MAX_FULL_BYTES, MAX_THUMB_BYTES } from "../inspections/inspection.constants.js";
import { sniffImage } from "../inspections/inspection.rules.js";
import { Project } from "../projects/models/project.model.js";
import { inTransaction, isId, oid, writeAssetAudit } from "./asset.common.js";
import { MAX_MAINTENANCE_EVIDENCE } from "./asset.constants.js";
import { maintScope } from "./maintenance.service.js";
import type { evidenceBody, evidencePatch, evidenceRemove } from "./maintenance.schema.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceEvidence } from "./models/maintenance-evidence.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const FIVE_MIN = 5 * 60_000;
export const maintenanceKey = (maintenanceId: string, evidenceId: string, variant: "full" | "thumb") => `mnt/${maintenanceId}/${evidenceId}/${variant}`;

const storageOrThrow = () => {
  const s = getEvidenceStorage();
  if (!s) throw new Flow(503, "SERVICE_UNAVAILABLE", { reason: "STORAGE_NOT_CONFIGURED" });
  return s;
};

async function loadWritable(actor: AuthenticatedActor, maintenanceId: string, session?: mongoose.ClientSession) {
  if (!isId(maintenanceId)) throw new Flow(404, "NOT_FOUND");
  const ctx = await contextOf(actor, session);
  need(ctx, "maintenance.update");
  const q = MaintenanceRecord.findOne({ $and: [maintScope(ctx, actor), { _id: maintenanceId }] });
  if (session) q.session(session);
  const row = await q.lean();
  if (!row) throw new Flow(404, "NOT_FOUND");
  return { ctx, row };
}

/** Step 1 of the upload: registers metadata. Photos can be added only while the work is IN_PROGRESS. */
export const createMaintenanceEvidence = (actor: AuthenticatedActor, maintenanceId: string, input: z.infer<typeof evidenceBody>, requestId: string) => run(async () => {
  storageOrThrow();
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const { row } = await loadWritable(actor, maintenanceId, session);
    if (row.status !== "IN_PROGRESS") throw new Flow(409, "CONFLICT", { current: row.status });
    if (input.capturedAt.getTime() > now.getTime() + FIVE_MIN) throw new Flow(400, "VALIDATION_ERROR", { field: "capturedAt" });
    const live = await MaintenanceEvidence.find({ maintenanceId: row._id, status: { $in: ["ACTIVE", "PENDING_UPLOAD"] } }).select("sha256").session(session).lean();
    const dup = live.find((e) => e.sha256 === input.sha256);
    if (dup) throw new Flow(409, "CONFLICT", { reason: "duplicate", evidenceId: String(dup._id) });
    if (live.length >= MAX_MAINTENANCE_EVIDENCE) throw new Flow(409, "CONFLICT", { reason: "evidence_cap" });
    const asset = await Asset.findById(row.assetId).select("sourceProjectId agencyId").session(session).lean();
    const project = asset ? await Project.findById(asset.sourceProjectId).select("_id").session(session).lean() : null;
    if (!asset || !project) throw new Flow(404, "NOT_FOUND");
    const evidenceId = new mongoose.Types.ObjectId();
    const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
    const base = { projectId: project._id, documentType: "SITE_EVIDENCE" as const, uploadedBy: oid(actor.userId), visibility: "INTERNAL" as const, origin: "INSPECTION_EVIDENCE" as const, agencyId: asset.agencyId };
    const [doc] = await Document.create([{ ...base, fileName: `${row.maintenanceNo ?? "maintenance"}-${live.length + 1}.${ext}`, mimeType: input.mimeType, sizeBytes: input.sizeBytes, storageKey: maintenanceKey(String(row._id), String(evidenceId), "full") }], { session });
    const [thumbDoc] = input.thumb ? await Document.create([{ ...base, fileName: `${row.maintenanceNo ?? "maintenance"}-${live.length + 1}-thumb.jpg`, mimeType: "image/jpeg", sizeBytes: input.thumb.sizeBytes, storageKey: maintenanceKey(String(row._id), String(evidenceId), "thumb") }], { session }) : [undefined];
    await MaintenanceEvidence.create([{
      _id: evidenceId, maintenanceId: row._id, assetId: row.assetId, agencyId: asset.agencyId, documentId: doc!._id, ...(thumbDoc ? { thumbDocumentId: thumbDoc._id } : {}), ...(input.caption ? { caption: input.caption } : {}),
      capturedAt: input.capturedAt, uploadedAt: now, uploadedBy: oid(actor.userId), sha256: input.sha256, ...(input.thumb ? { thumbSha256: input.thumb.sha256, thumbSizeBytes: input.thumb.sizeBytes } : {}),
      mimeType: input.mimeType, width: input.width, height: input.height, sizeBytes: input.sizeBytes, status: "PENDING_UPLOAD",
    }], { session });
    await writeAssetAudit(session, { actor, action: "maintenance.evidence_added", resourceType: "MAINTENANCE_RECORD", resourceId: row._id, agencyId: row.agencyId, newValue: { status: row.status }, requestId });
    return { evidenceId: String(evidenceId) };
  });
  return ok({ evidenceId: out.evidenceId, upload: { path: `/maintenance/evidence/${out.evidenceId}/file`, variants: ["full", "thumb"] } });
});

async function loadOwn(actor: AuthenticatedActor, evidenceId: string, session?: mongoose.ClientSession) {
  if (!isId(evidenceId)) throw new Flow(404, "NOT_FOUND");
  const q = MaintenanceEvidence.findOne({ _id: evidenceId, uploadedBy: oid(actor.userId) });
  if (session) q.session(session);
  const ev = await q.lean();
  if (!ev) throw new Flow(404, "NOT_FOUND");
  const { row } = await loadWritable(actor, String(ev.maintenanceId), session);
  return { ev, row };
}

/** Step 2: raw bytes. Same validation as inspection evidence (shared validator and limits): magic bytes, size cap and SHA-256 before anything is stored. */
export const uploadMaintenanceFile = (actor: AuthenticatedActor, evidenceId: string, variant: "full" | "thumb", data: Buffer) => run(async () => {
  const storage = storageOrThrow();
  const { ev, row } = await loadOwn(actor, evidenceId);
  if (row.status !== "IN_PROGRESS" || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: ev.status === "REMOVED" ? "REMOVED" : row.status });
  if (!data.length) throw new Flow(400, "VALIDATION_ERROR", { reason: "empty" });
  if (data.length > (variant === "full" ? MAX_FULL_BYTES : MAX_THUMB_BYTES)) throw new Flow(413, "VALIDATION_ERROR", { reason: "too_large" });
  const real = sniffImage(data);
  if (!real || (variant === "full" && real !== ev.mimeType)) throw new Flow(400, "VALIDATION_ERROR", { reason: "unsupported_or_mismatched_type" });
  if (variant === "thumb" && !ev.thumbDocumentId) throw new Flow(400, "VALIDATION_ERROR", { reason: "no_thumb_declared" });
  const expected = variant === "full" ? ev.sha256 : ev.thumbSha256;
  if (!expected || createHash("sha256").update(data).digest("hex") !== expected) throw new Flow(422, "VALIDATION_ERROR", { reason: "hash_mismatch" });
  if (variant === "full" && data.length !== ev.sizeBytes) throw new Flow(422, "VALIDATION_ERROR", { reason: "size_mismatch" });
  const key = maintenanceKey(String(ev.maintenanceId), String(ev._id), variant);
  if (!(await storage.exists(key))) await storage.put(key, data, real);
  if (variant === "full") await MaintenanceEvidence.updateOne({ _id: ev._id, status: { $in: ["PENDING_UPLOAD", "ACTIVE"] } }, { $set: { status: "ACTIVE" } });
  return ok({ evidenceId: String(ev._id), variant, status: variant === "full" ? "ACTIVE" : ev.status });
});

export const patchMaintenanceEvidence = (actor: AuthenticatedActor, evidenceId: string, input: z.infer<typeof evidencePatch>) => run(async () => {
  const { ev, row } = await loadOwn(actor, evidenceId);
  if (row.status !== "IN_PROGRESS" || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: row.status });
  await MaintenanceEvidence.updateOne({ _id: ev._id }, input.caption ? { $set: { caption: input.caption } } : { $unset: { caption: 1 } });
  return ok({ updated: true });
});

export const removeMaintenanceEvidence = (actor: AuthenticatedActor, evidenceId: string, input: z.infer<typeof evidenceRemove>, requestId: string) => run(async () => {
  const storage = storageOrThrow();
  await inTransaction(async (session) => {
    const { ev, row } = await loadOwn(actor, evidenceId, session);
    if (row.status !== "IN_PROGRESS" || ev.status === "REMOVED") throw new Flow(409, "CONFLICT", { current: row.status });
    await MaintenanceEvidence.updateOne({ _id: ev._id, status: { $ne: "REMOVED" } }, { $set: { status: "REMOVED", removedBy: oid(actor.userId), removedAt: new Date(), removalReason: input.reason } }, { session });
    await writeAssetAudit(session, { actor, action: "maintenance.evidence_removed", resourceType: "MAINTENANCE_RECORD", resourceId: row._id, agencyId: row.agencyId, newValue: { status: row.status }, requestId });
  });
  const ev = await MaintenanceEvidence.findById(evidenceId).select("maintenanceId").lean();
  if (ev) for (const v of ["full", "thumb"] as const) await storage.delete(maintenanceKey(String(ev.maintenanceId), evidenceId, v)).catch(() => undefined);
  return ok({ removed: true });
});

/** Authenticated, scope-checked streaming. Never a public or presigned URL. Removed files are never served. */
export async function openMaintenanceFile(actor: AuthenticatedActor, evidenceId: string, variant: "full" | "thumb"): Promise<{ ok: true; stream: Readable; mime: string; size: number } | { ok: false; status: 401 | 403 | 404 | 503 }> {
  try {
    if (!isId(evidenceId)) return { ok: false, status: 404 };
    const storage = getEvidenceStorage();
    if (!storage) return { ok: false, status: 503 };
    const ctx = await contextOf(actor);
    if (!ctx.has("asset.read")) return { ok: false, status: 403 };
    const ev = await MaintenanceEvidence.findById(evidenceId).lean();
    if (!ev || ev.status === "REMOVED") return { ok: false, status: 404 };
    if (!(await MaintenanceRecord.exists({ $and: [maintScope(ctx, actor), { _id: ev.maintenanceId }] }))) return { ok: false, status: 404 };
    if (ev.status === "PENDING_UPLOAD" && String(ev.uploadedBy) !== actor.userId) return { ok: false, status: 404 };
    const useThumb = variant === "thumb" && Boolean(ev.thumbDocumentId) && (await storage.exists(maintenanceKey(String(ev.maintenanceId), String(ev._id), "thumb")));
    const key = maintenanceKey(String(ev.maintenanceId), String(ev._id), useThumb ? "thumb" : "full");
    if (!(await storage.exists(key))) return { ok: false, status: 404 };
    return { ok: true, stream: storage.open(key), mime: useThumb ? "image/jpeg" : ev.mimeType, size: useThumb ? ev.thumbSizeBytes ?? 0 : ev.sizeBytes };
  } catch (error) {
    if (error instanceof Flow) return { ok: false, status: error.status === 401 ? 401 : error.status === 403 ? 403 : 404 };
    return { ok: false, status: 503 };
  }
}
