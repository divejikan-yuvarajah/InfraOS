import type { z } from "zod";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { contextOf, Flow, need, run, type Result } from "../contractors/contractor.context.js";
import { loadProject } from "../finance/finance.common.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import { validGeometry } from "../../shared/database/geometry.js";
import { DEFAULT_MONITORING_DAYS, type AssetType, type OperationalStatus } from "./asset.constants.js";
import { assetScope, inTransaction, iso, loadAsset, oid, writeAssetAudit, type Id } from "./asset.common.js";
import type { addAssetBody, assessmentBody, exportQuery, patchAssetBody, statusBody } from "./asset.schema.js";
import { notifyAssessment, recordAssessment } from "./asset-assessment.js";
import { refreshAssetCaches } from "./asset-cache.js";
import { attentionFilter } from "./asset.queries.js";
import { AssetConditionAssessment } from "./models/asset-condition-assessment.model.js";
import { AssetConversion } from "./models/asset-conversion.model.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const conflict = (current: string): never => { throw new Flow(409, "CONFLICT", { current }); };

export const patchAsset = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof patchAssetBody>, requestId: string) => run(async () => {
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.update");
    const asset = await loadAsset(ctx, actor, rawId, session, "write");
    if (asset.operationalStatus === "DECOMMISSIONED") conflict("DECOMMISSIONED");
    const { version, defectsLiabilityEndsOn, ...rest } = input;
    const $set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const $unset: Record<string, 1> = {};
    if (defectsLiabilityEndsOn === null) $unset.defectsLiabilityEndsOn = 1; else if (defectsLiabilityEndsOn) $set.defectsLiabilityEndsOn = defectsLiabilityEndsOn;
    const res = await Asset.findOneAndUpdate({ _id: asset._id, version, operationalStatus: { $ne: "DECOMMISSIONED" } }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}), $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    if ($set.monitoringIntervalDays !== undefined || $unset.defectsLiabilityEndsOn || $set.defectsLiabilityEndsOn) await refreshAssetCaches(asset._id, session);
    await writeAssetAudit(session, { actor, action: "asset.updated", resourceType: "ASSET", resourceId: asset._id, agencyId: asset.agencyId, newValue: { status: asset.operationalStatus ?? "IN_SERVICE", reason: `fields: ${[...Object.keys($set), ...Object.keys($unset)].join(",")}` }, requestId });
  });
  return ok({ updated: true });
});

const ALLOWED: Record<OperationalStatus, readonly OperationalStatus[]> = {
  IN_SERVICE: ["UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DECOMMISSIONED"], UNDER_MAINTENANCE: ["IN_SERVICE", "OUT_OF_SERVICE", "DECOMMISSIONED"], OUT_OF_SERVICE: ["IN_SERVICE", "UNDER_MAINTENANCE", "DECOMMISSIONED"], DECOMMISSIONED: [],
};

export const changeStatus = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof statusBody>, requestId: string) => run(async () => {
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.update");
    const asset = await loadAsset(ctx, actor, rawId, session, "write");
    const from = (asset.operationalStatus ?? "IN_SERVICE") as OperationalStatus;
    if (!ALLOWED[from].includes(input.status)) conflict(from);
    if ((input.status === "OUT_OF_SERVICE" || input.status === "DECOMMISSIONED") && (input.reason?.trim().length ?? 0) < 12) throw new Flow(400, "VALIDATION_ERROR", { field: "reason" });
    if (input.status === "DECOMMISSIONED" && (await MaintenanceRecord.exists({ assetId: asset._id, status: { $in: ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS"] } }).session(session))) throw new Flow(409, "CONFLICT", { reason: "open_maintenance" });
    const res = await Asset.findOneAndUpdate({ _id: asset._id, version: input.version, operationalStatus: from }, { $set: { operationalStatus: input.status }, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await refreshAssetCaches(asset._id, session);
    await writeAssetAudit(session, { actor, action: "asset.status_changed", resourceType: "ASSET", resourceId: asset._id, agencyId: asset.agencyId, oldValue: { status: from }, newValue: { status: input.status, ...(input.reason ? { reason: input.reason } : {}) }, requestId });
  });
  return ok({ status: input.status });
});

/** Add an asset to a project that already has an approved conversion. Origin ADDITION; the project is never edited. */
export const addAsset = (actor: AuthenticatedActor, input: z.infer<typeof addAssetBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.create");
    const project = await loadProject(ctx, actor, input.projectId, session, "write");
    const conv = await AssetConversion.findOne({ projectId: project._id, status: "APPROVED" }).session(session).lean();
    if (!conv) throw new Flow(409, "CONFLICT", { reason: "NOT_CONVERTED" });
    if (await Asset.exists({ sourceProjectId: project._id, name: input.asset.name }).session(session)) throw new Flow(409, "CONFLICT", { reason: "duplicate_name" });
    const geo = input.asset.geometrySource === "PROJECT" ? (await Project.findById(project._id).select("geometry").session(session).lean())?.geometry : null;
    if (input.asset.geometrySource === "PROJECT" && !(geo && validGeometry(geo))) throw new Flow(400, "VALIDATION_ERROR", { field: "geometrySource" });
    const p = input.asset;
    const [asset] = await Asset.create([{
      assetNo: await nextNumber("AST", now, session), sourceProjectId: project._id, origin: "ADDITION", conversionId: conv._id, assetType: p.assetType, name: p.name, ...(p.description ? { description: p.description } : {}), ...(p.location ? { location: p.location } : {}),
      ...(geo ? { geometry: geo } : {}), agencyId: conv.receivingAgencyId, constructionAgencyId: project.agencyId, operationalStatus: "IN_SERVICE", handoverAt: conv.handover.handoverDate,
      ...(conv.handover.defectsLiabilityEndsOn ? { defectsLiabilityEndsOn: conv.handover.defectsLiabilityEndsOn } : {}), ...(p.designLifeYears ? { designLifeYears: p.designLifeYears } : {}),
      monitoringIntervalDays: p.monitoringIntervalDays ?? DEFAULT_MONITORING_DAYS[p.assetType as AssetType], condition: "UNKNOWN", commissionedAt: p.commissionedAt ?? conv.handover.handoverDate, version: 0,
    }], { session });
    await writeAssetAudit(session, { actor, action: "asset.registered", resourceType: "ASSET", resourceId: asset!._id, agencyId: conv.receivingAgencyId, newValue: { status: "IN_SERVICE", agencyId: conv.receivingAgencyId, reason: input.reason }, requestId });
    return { id: asset!._id as Id, assetNo: asset!.assetNo ?? null };
  });
  return ok({ id: String(out.id), assetNo: out.assetNo });
});

/** Manual entry: lower confidence, always labelled "not inspection-verified". Appends one assessment; nothing is edited in place. */
export const addManualAssessment = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof assessmentBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.update");
    const asset = await loadAsset(ctx, actor, rawId, session, "write");
    if (asset.operationalStatus === "DECOMMISSIONED") conflict("DECOMMISSIONED");
    if (input.assessedAt.getTime() > now.getTime()) throw new Flow(400, "VALIDATION_ERROR", { field: "assessedAt" });
    // Issue carry-forward: every open issue of the previous assessment must be explicitly kept open or marked resolved.
    const prev = await AssetConditionAssessment.findOne({ assetId: asset._id, status: "ACTIVE" }).sort({ assessedAt: -1, createdAt: -1 }).session(session).lean();
    const submitted = new Set(input.issues.map((i) => i.key));
    if (new Set(input.issues.map((i) => i.key)).size !== input.issues.length) throw new Flow(400, "VALIDATION_ERROR", { field: "issues" });
    const missing = (prev?.issues ?? []).filter((i) => i.status === "OPEN" && !submitted.has(i.key));
    if (missing.length) throw new Flow(400, "VALIDATION_ERROR", { field: "issues", reason: "issues_not_carried", keys: missing.map((m) => m.key) });
    if (input.maintenanceRefs.length) {
      const n = await MaintenanceRecord.countDocuments({ _id: { $in: input.maintenanceRefs }, assetId: asset._id, status: "COMPLETED" }).session(session);
      if (n !== new Set(input.maintenanceRefs).size) throw new Flow(400, "VALIDATION_ERROR", { field: "maintenanceRefs" });
    }
    const rec = await recordAssessment(session, { asset, condition: input.condition, basis: "MANUAL_ENTRY", assessedAt: input.assessedAt, observations: input.observations, issues: input.issues, assessedBy: oid(actor.userId), maintenanceRefs: input.maintenanceRefs.map(oid) });
    await writeAssetAudit(session, { actor, action: "asset.assessment_recorded", resourceType: "ASSET", resourceId: asset._id, agencyId: asset.agencyId, oldValue: { status: asset.condition }, newValue: { status: input.condition, reason: input.reason }, requestId });
    return { asset, rec };
  });
  await notifyAssessment(out.asset, out.rec, [actor.userId]);
  return ok({ id: String(out.rec.id), condition: out.rec.condition, suggestion: out.rec.becameActive ? null : "older_assessment_stored" });
});

/* ---------------- export ---------------- */

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const exportAssets = (actor: AuthenticatedActor, q: z.infer<typeof exportQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  need(ctx, "report.export");
  const now = new Date();
  const and: Record<string, unknown>[] = [await assetScope(ctx, actor)];
  if (q.assetType?.length) and.push({ assetType: { $in: q.assetType } });
  if (q.condition?.length) and.push({ condition: { $in: q.condition } });
  if (q.operationalStatus?.length) and.push({ operationalStatus: { $in: q.operationalStatus } });
  if (q.agencyId) and.push({ agencyId: oid(q.agencyId) });
  if (q.projectId) and.push({ sourceProjectId: oid(q.projectId) });
  if (q.attention) and.push(attentionFilter(now));
  const rows = await Asset.find({ $and: and }).sort({ assetNo: 1, _id: 1 }).limit(5000).maxTimeMS(15000).lean();
  const agencies = new Map((await Agency.find({ _id: { $in: [...new Set(rows.map((r) => String(r.agencyId)))] } }).select("name").lean()).map((a) => [String(a._id), a.name as string]));
  const canHealth = ctx.has("asset.health.read");
  const head = ["Asset no", "Name", "Type", "Owner agency", "District", "Condition", "Operational status", ...(canHealth ? ["Health score"] : []), "Last assessed", "Next maintenance"];
  const lines = [head.map(csvCell).join(",")];
  for (const r of rows) lines.push([r.assetNo, r.name, r.assetType, agencies.get(String(r.agencyId)), r.location?.district, r.condition, r.operationalStatus ?? "IN_SERVICE", ...(canHealth ? [r.healthScore ?? ""] : []), iso(r.lastInspectionAt)?.slice(0, 10), iso(r.nextMaintenanceAt)?.slice(0, 10)].map(csvCell).join(","));
  // Audit the count only, never the rows.
  const { default: mongoose } = await import("mongoose");
  await AuditLog.create({ userId: oid(actor.userId), action: "asset.exported", resourceType: "ASSET", resourceId: new mongoose.Types.ObjectId(), requestId: "export", newValue: { status: "EXPORTED", reason: `rows ${rows.length}` } });
  return ok({ body: `${lines.join("\r\n")}\r\n`, count: rows.length, truncated: rows.length >= 5000 });
});

