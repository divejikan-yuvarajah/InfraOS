import type mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import type { z } from "zod";

import { Agency } from "../agencies/models/agency.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { contextOf, Flow, need, run, type Ctx, type Result } from "../contractors/contractor.context.js";
import { Document } from "../documents/models/document.model.js";
import { loadProject, type ProjectDoc } from "../finance/finance.common.js";
import { ProjectExpense } from "../finance/models/project-expense.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { ProgressVerification } from "../inspections/models/progress-verification.model.js";
import { Project } from "../projects/models/project.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import { validGeometry } from "../../shared/database/geometry.js";
import { assetTypeForProject, DEFAULT_MONITORING_DAYS, type AssetType } from "./asset.constants.js";
import { holdersOf, inTransaction, iso, isId, notifyAsset, oid, writeAssetAudit, type Id } from "./asset.common.js";
import type { conversionBody, conversionListQuery } from "./asset.schema.js";
import { blockedGates, evaluateConversionGates, warningGates, type ConversionGate, type ConversionGateInput } from "./conversion-gates.js";
import { refreshAssetCaches } from "./asset-cache.js";
import { AssetConversion } from "./models/asset-conversion.model.js";
import { Asset } from "./models/asset.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const DAY = 86_400_000;

/** Test seam: lets a test fail an approval after the assets were created but before the audit row, to prove nothing persists. */
export const conversionHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

type GeoProject = ProjectDoc & { geometry?: { type: string; coordinates: unknown } | null; projectType: string };

async function loadGeoProject(ctx: Ctx, actor: AuthenticatedActor, id: string, session: ClientSession | undefined, mode: "read" | "write"): Promise<GeoProject> {
  const base = await loadProject(ctx, actor, id, session, mode);
  const q = Project.findById(base._id).select("geometry projectType startDate");
  if (session) q.session(session);
  const extra = (await q.lean()) as { geometry?: { type: string; coordinates: unknown } | null; projectType: string } | null;
  return { ...base, geometry: extra?.geometry ?? null, projectType: extra?.projectType ?? "OTHER" };
}

/** Builds the gate input from live records. Used by preview, request and the approve transaction alike. */
export async function gateInputFor(project: GeoProject, p: { receivingAgencyId: Id; documentCount: number; approverIsRequester: boolean | null; excludeConversionId?: Id }, session?: ClientSession): Promise<ConversionGateInput> {
  const s = <T extends { session: (s: ClientSession) => T }>(q: T): T => (session ? q.session(session) : q);
  const [ver, finalHandover, unpaid, retention, expenses, assignments, agency, existing, latestVerified] = await Promise.all([
    s(ProgressVerification.findOne({ projectId: project._id, status: "ACTIVE" }).sort({ asOf: -1 }).select("verifiedPercent")).lean(),
    s(Inspection.exists({ projectId: project._id, inspectionType: "FINAL_HANDOVER", status: "VERIFIED" })),
    s(ProjectPayment.countDocuments({ projectId: project._id, status: { $in: ["PENDING", "APPROVED"] } })),
    s(ProjectPayment.exists({ projectId: project._id, paymentType: "RETENTION", status: { $in: ["PENDING", "APPROVED"] } })),
    s(ProjectExpense.countDocuments({ projectId: project._id, status: "PENDING_VERIFICATION" })),
    s(ContractorAssignment.countDocuments({ projectId: project._id, status: "ACTIVE" })),
    s(Agency.findById(p.receivingAgencyId).select("status")).lean(),
    s(AssetConversion.findOne({ projectId: project._id, status: { $in: ["PENDING_APPROVAL", "APPROVED"] }, ...(p.excludeConversionId ? { _id: { $ne: p.excludeConversionId } } : {}) }).select("status conversionNo")).lean(),
    s(Inspection.findOne({ projectId: project._id, status: "VERIFIED" }).sort({ completedAt: -1, inspectionDate: -1 }).select("submissions.reportSnapshot.defects")).lean(),
  ]);
  const defects = latestVerified?.submissions?.[latestVerified.submissions.length - 1]?.reportSnapshot?.defects ?? [];
  return {
    projectStatus: project.status, verifiedPercent: ver?.verifiedPercent ?? null, finalHandoverVerified: Boolean(finalHandover), hasValidGeometry: Boolean(project.geometry && validGeometry(project.geometry)),
    openFindings: defects.filter((d) => d.severity === "MAJOR" || d.severity === "CRITICAL").length, unpaidPayments: unpaid, pendingExpenses: expenses, retentionOutstanding: Boolean(retention),
    activeAssignments: assignments, receivingAgency: { exists: Boolean(agency), active: agency?.status === "ACTIVE" }, existingConversion: existing ? { status: existing.status as "PENDING_APPROVAL" | "APPROVED", conversionNo: existing.conversionNo ?? null } : null,
    approverIsRequester: p.approverIsRequester, documentCount: p.documentCount,
  };
}

const snap = (gates: ConversionGate[], at: "REQUEST" | "DECISION") => ({ at, evaluatedAt: new Date(), gates: gates.map((g) => ({ key: g.key, status: g.status, message: g.message })) });

/** Agencies the viewer could hand over to: their scope (platform: every active agency), bounded. */
async function receivingOptions(ctx: Ctx): Promise<{ id: string; name: string }[]> {
  const filter = ctx.scope.kind === "platform" ? { status: "ACTIVE" } : { status: "ACTIVE", _id: { $in: ctx.agencyObjectIds } };
  return (await Agency.find(filter).select("name").sort({ name: 1 }).limit(100).lean()).map((a) => ({ id: String(a._id), name: a.name as string }));
}

/* ---------------- preview ---------------- */

export const previewConversion = (actor: AuthenticatedActor, q: { projectId: string; receivingAgencyId?: string }) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.create");
  const project = await loadGeoProject(ctx, actor, q.projectId, undefined, "write");
  const receiving = q.receivingAgencyId ? oid(q.receivingAgencyId) : (project.agencyId as Id);
  const docs = await Document.find({ projectId: project._id }).select("fileName documentType").sort({ createdAt: -1 }).limit(50).lean();
  const gates = evaluateConversionGates(await gateInputFor(project, { receivingAgencyId: receiving, documentCount: 0, approverIsRequester: null }));
  return ok({
    project: { id: String(project._id), projectCode: project.projectCode, title: project.title, status: project.status, projectType: project.projectType },
    gates, blocked: blockedGates(gates).length > 0, warnings: warningGates(gates).length,
    suggestions: { name: project.title, assetType: assetTypeForProject(project.projectType), hasGeometry: Boolean(project.geometry && validGeometry(project.geometry)), defaultMonitoringDays: DEFAULT_MONITORING_DAYS[assetTypeForProject(project.projectType)], receivingAgencyId: String(receiving) },
    documents: docs.map((d) => ({ id: String(d._id), fileName: d.fileName, documentType: d.documentType })), receivingOptions: await receivingOptions(ctx),
  });
});

/** In-scope COMPLETED projects with no active conversion, for the wizard's first step. */
export const convertibleProjects = (actor: AuthenticatedActor, q: { q?: string }) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.create");
  const taken = await AssetConversion.distinct("projectId", { status: { $in: ["PENDING_APPROVAL", "APPROVED"] } });
  const rx = q.q ? new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const { projectWriteFilter } = await import("../identity/authorization/resource-scope.js");
  const rows = await Project.find({ $and: [projectReadFilter(ctx.scope), projectWriteFilter(actor, ctx.scope), { status: "COMPLETED", _id: { $nin: taken } }, ...(rx ? [{ $or: [{ title: rx }, { projectCode: rx }] }] : [])] }).select("projectCode title projectType").sort({ updatedAt: -1 }).limit(20).lean();
  const ver = await ProgressVerification.find({ projectId: { $in: rows.map((r) => r._id) }, status: "ACTIVE" }).select("projectId verifiedPercent").lean();
  const vmap = new Map(ver.map((v) => [String(v.projectId), v.verifiedPercent]));
  return ok({ projects: rows.map((r) => ({ id: String(r._id), projectCode: r.projectCode, title: r.title, projectType: r.projectType, verifiedPercent: vmap.get(String(r._id)) ?? null })) });
});

/* ---------------- request / cancel ---------------- */

export const requestConversion = (actor: AuthenticatedActor, input: z.infer<typeof conversionBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.create");
    const project = await loadGeoProject(ctx, actor, input.projectId, session, "write");
    const startAt = project.startDate ? new Date(project.startDate) : null;
    if ((startAt && input.handover.handoverDate.getTime() < startAt.getTime()) || input.handover.handoverDate.getTime() > now.getTime() + 30 * DAY) throw new Flow(400, "VALIDATION_ERROR", { field: "handoverDate" });
    const receivingId = input.receivingAgencyId ? oid(input.receivingAgencyId) : (project.agencyId as Id);
    if (input.handover.documentIds.length) {
      const n = await Document.countDocuments({ _id: { $in: input.handover.documentIds }, projectId: project._id }).session(session);
      if (n !== new Set(input.handover.documentIds).size) throw new Flow(400, "VALIDATION_ERROR", { field: "documentIds" });
    }
    const gates = evaluateConversionGates(await gateInputFor(project, { receivingAgencyId: receivingId, documentCount: input.handover.documentIds.length, approverIsRequester: null }, session));
    if (blockedGates(gates).length) {
      const dup = gates.find((g) => g.key === "DUPLICATE" && g.status === "BLOCK");
      throw new Flow(409, "CONFLICT", { reason: dup ? "ALREADY_CONVERTED" : "gates_blocked", gates: gates.filter((g) => g.status === "BLOCK") });
    }
    if (warningGates(gates).length && input.acknowledgeWarnings !== true) throw new Flow(400, "VALIDATION_ERROR", { field: "acknowledgeWarnings", gates: warningGates(gates) });
    if (input.proposedAssets.some((a) => a.geometrySource === "PROJECT") && !(project.geometry && validGeometry(project.geometry))) throw new Flow(400, "VALIDATION_ERROR", { field: "geometrySource" });
    const conversionNo = await nextNumber("CNV", now, session);
    try {
      const [row] = await AssetConversion.create([{
        conversionNo, projectId: project._id, agencyId: project.agencyId, status: "PENDING_APPROVAL", requestedBy: oid(actor.userId), requestedAt: now, receivingAgencyId: receivingId,
        handover: { handoverDate: input.handover.handoverDate, ...(input.handover.handoverNote ? { handoverNote: input.handover.handoverNote } : {}), ...(input.handover.defectsLiabilityEndsOn ? { defectsLiabilityEndsOn: input.handover.defectsLiabilityEndsOn } : {}), documentIds: input.handover.documentIds, conditionAtHandover: input.handover.conditionAtHandover },
        proposedAssets: input.proposedAssets, gateResults: [snap(gates, "REQUEST")], version: 0,
      }], { session });
      await writeAssetAudit(session, { actor, action: "asset.conversion_requested", resourceType: "ASSET", resourceId: row!._id, agencyId: project.agencyId, newValue: { status: "PENDING_APPROVAL", agencyId: receivingId }, requestId });
      return { id: row!._id as Id, conversionNo, projectCode: project.projectCode, agencyIds: [project.agencyId as Id, receivingId] };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new Flow(409, "CONFLICT", { reason: "ALREADY_CONVERTED" });
      throw e;
    }
  });
  const approvers = await holdersOf(out.agencyIds, "asset.conversion.approve", [actor.userId]);
  await notifyAsset(approvers, { title: "Asset conversion awaiting approval", message: `${out.conversionNo} for ${out.projectCode} needs a decision.`, resource: { type: "PROJECT", id: oid(input.projectId) }, eventKey: `cnv-req:${out.id}` });
  return ok({ id: String(out.id), conversionNo: out.conversionNo });
});

export const cancelConversion = (actor: AuthenticatedActor, rawId: string, requestId: string) => run(async () => {
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.create");
    if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
    const row = await AssetConversion.findOne({ _id: rawId, requestedBy: oid(actor.userId) }).session(session).lean();
    if (!row) throw new Flow(404, "NOT_FOUND");
    const res = await AssetConversion.findOneAndUpdate({ _id: row._id, status: "PENDING_APPROVAL", version: row.version ?? 0 }, { $set: { status: "CANCELLED", decidedBy: oid(actor.userId), decidedAt: new Date() }, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: row.status });
    await writeAssetAudit(session, { actor, action: "asset.conversion_cancelled", resourceType: "ASSET", resourceId: row._id, agencyId: row.agencyId, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "CANCELLED" }, requestId });
  });
  return ok({ cancelled: true });
});

/* ---------------- list / detail ---------------- */

async function conversionScope(ctx: Ctx, actor: AuthenticatedActor): Promise<Record<string, unknown>> {
  if (actor.roleKey === "INSPECTOR" || actor.roleKey === "CONTRACTOR" || actor.roleKey === "CITIZEN") return { _id: { $in: [] } };
  if (ctx.scope.kind === "platform") return {};
  if (ctx.scope.kind === "agencies") return { $or: [{ agencyId: { $in: ctx.agencyObjectIds } }, { receivingAgencyId: { $in: ctx.agencyObjectIds } }] };
  return { _id: { $in: [] } };
}

export const listConversions = (actor: AuthenticatedActor, q: z.infer<typeof conversionListQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const filter = { $and: [await conversionScope(ctx, actor), ...(q.status?.length ? [{ status: { $in: q.status } }] : []), ...(q.projectId ? [{ projectId: oid(q.projectId) }] : []), ...(q.agencyId ? [{ agencyId: oid(q.agencyId) }] : [])] };
  const [rows, total, facets] = await Promise.all([
    AssetConversion.find(filter).select("conversionNo projectId agencyId receivingAgencyId status requestedBy requestedAt decidedAt proposedAssets.name").sort({ requestedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean(),
    AssetConversion.countDocuments(filter).maxTimeMS(8000),
    AssetConversion.aggregate<{ _id: string; n: number }>([{ $match: await conversionScope(ctx, actor) }, { $group: { _id: "$status", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
  ]);
  const projects = new Map((await Project.find({ _id: { $in: rows.map((r) => r.projectId) } }).select("projectCode title").lean()).map((p) => [String(p._id), p]));
  const agencies = new Map((await Agency.find({ _id: { $in: rows.flatMap((r) => [r.agencyId, r.receivingAgencyId]) } }).select("name").lean()).map((a) => [String(a._id), a.name as string]));
  const { displayNames } = await import("../inspections/inspection.common.js");
  const names = await displayNames(rows.map((r) => r.requestedBy as Id));
  return ok({
    rows: rows.map((r) => ({ id: String(r._id), conversionNo: r.conversionNo ?? null, status: r.status, projectId: String(r.projectId), projectCode: projects.get(String(r.projectId))?.projectCode ?? null, projectTitle: projects.get(String(r.projectId))?.title ?? null,
      agencyName: agencies.get(String(r.agencyId)) ?? null, receivingAgencyName: agencies.get(String(r.receivingAgencyId)) ?? null, requestedByName: names.get(String(r.requestedBy)) ?? null, requestedAt: iso(r.requestedAt), decidedAt: iso(r.decidedAt), assetCount: r.proposedAssets?.length ?? 0, requestedByMe: String(r.requestedBy) === actor.userId })),
    total, page: q.page, limit: q.limit, facets: Object.fromEntries(facets.map((f) => [f._id, f.n])),
  });
});

export const getConversion = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const row = await AssetConversion.findOne({ $and: [await conversionScope(ctx, actor), { _id: rawId }] }).lean();
  if (!row) throw new Flow(404, "NOT_FOUND");
  const project = await loadGeoProject(ctx, actor, String(row.projectId), undefined, "read").catch(() => null);
  const live = row.status === "PENDING_APPROVAL" && project ? evaluateConversionGates(await gateInputFor(project, { receivingAgencyId: row.receivingAgencyId as Id, documentCount: row.handover.documentIds.length, approverIsRequester: String(row.requestedBy) === actor.userId, excludeConversionId: row._id as Id })) : null;
  const { displayNames } = await import("../inspections/inspection.common.js");
  const names = await displayNames([row.requestedBy as Id, row.decidedBy as Id | undefined]);
  const [agency, receiving, docs, assets] = await Promise.all([Agency.findById(row.agencyId).select("name").lean(), Agency.findById(row.receivingAgencyId).select("name").lean(), Document.find({ _id: { $in: row.handover.documentIds } }).select("fileName documentType").lean(), Asset.find({ _id: { $in: row.createdAssetIds } }).select("assetNo name assetType").lean()]);
  return ok({
    id: String(row._id), conversionNo: row.conversionNo ?? null, status: row.status, project: project ? { id: String(project._id), projectCode: project.projectCode, title: project.title, status: project.status } : null,
    agencyName: agency?.name ?? null, receivingAgencyId: String(row.receivingAgencyId), receivingAgencyName: receiving?.name ?? null, requestedByName: names.get(String(row.requestedBy)) ?? null, requestedAt: iso(row.requestedAt),
    decidedByName: row.decidedBy ? names.get(String(row.decidedBy)) ?? null : null, decidedAt: iso(row.decidedAt), decisionNote: row.decisionNote ?? null,
    handover: { handoverDate: iso(row.handover.handoverDate), handoverNote: row.handover.handoverNote ?? null, defectsLiabilityEndsOn: iso(row.handover.defectsLiabilityEndsOn), conditionAtHandover: row.handover.conditionAtHandover ?? "UNKNOWN", documents: docs.map((d) => ({ id: String(d._id), fileName: d.fileName, documentType: d.documentType })) },
    proposedAssets: row.proposedAssets, gateSnapshots: row.gateResults, liveGates: live, createdAssets: assets.map((a) => ({ id: String(a._id), assetNo: a.assetNo ?? null, name: a.name, assetType: a.assetType })), version: row.version ?? 0,
    can: { cancel: row.status === "PENDING_APPROVAL" && String(row.requestedBy) === actor.userId && ctx.has("asset.create"), decide: row.status === "PENDING_APPROVAL" && ctx.has("asset.conversion.approve") && String(row.requestedBy) !== actor.userId, decideBlockedReason: row.status === "PENDING_APPROVAL" && ctx.has("asset.conversion.approve") && String(row.requestedBy) === actor.userId ? "own_request" : null },
  });
});

/* ---------------- decide ---------------- */

export const approveConversion = (actor: AuthenticatedActor, rawId: string, note: string | undefined, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.conversion.approve");
    const row = await loadForDecision(ctx, actor, rawId, session);
    if (row.status === "APPROVED") return { created: row.createdAssetIds as Id[], row, fresh: false };
    if (row.status !== "PENDING_APPROVAL") throw new Flow(409, "CONFLICT", { current: row.status });
    if (String(row.requestedBy) === actor.userId) throw new Flow(403, "FORBIDDEN", { reason: "own_request" });
    const project = await loadGeoProject(ctx, actor, String(row.projectId), session, "read");
    const gates = evaluateConversionGates(await gateInputFor(project, { receivingAgencyId: row.receivingAgencyId as Id, documentCount: row.handover.documentIds.length, approverIsRequester: false, excludeConversionId: row._id }, session));
    if (blockedGates(gates).length) throw new Flow(409, "CONFLICT", { reason: "gates_blocked", gates: blockedGates(gates) });
    const created: Id[] = [];
    for (const p of row.proposedAssets) {
      const [asset] = await Asset.create([{
        assetNo: await nextNumber("AST", now, session), sourceProjectId: project._id, origin: "CONVERSION", conversionId: row._id, assetType: p.assetType, name: p.name, ...(p.description ? { description: p.description } : {}),
        ...(p.location ? { location: p.location } : {}), ...(p.geometrySource === "PROJECT" && project.geometry && validGeometry(project.geometry) ? { geometry: project.geometry } : {}),
        agencyId: row.receivingAgencyId, constructionAgencyId: project.agencyId, operationalStatus: "IN_SERVICE", handoverAt: row.handover.handoverDate,
        ...(row.handover.defectsLiabilityEndsOn ? { defectsLiabilityEndsOn: row.handover.defectsLiabilityEndsOn } : {}), ...(p.designLifeYears ? { designLifeYears: p.designLifeYears } : {}),
        monitoringIntervalDays: p.monitoringIntervalDays ?? DEFAULT_MONITORING_DAYS[p.assetType as AssetType], condition: row.handover.conditionAtHandover ?? "UNKNOWN", commissionedAt: p.commissionedAt ?? row.handover.handoverDate, version: 0,
      }], { session });
      created.push(asset!._id as Id);
      await refreshAssetCaches(asset!._id as Id, session);
    }
    const res = await AssetConversion.findOneAndUpdate({ _id: row._id, status: "PENDING_APPROVAL", version: row.version ?? 0 }, {
      $set: { status: "APPROVED", decidedBy: oid(actor.userId), decidedAt: now, ...(note ? { decisionNote: note } : {}), createdAssetIds: created }, $inc: { version: 1 }, $push: { gateResults: snap(gates, "DECISION") },
    }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "already_decided" });
    await conversionHooks.beforeAudit();
    await writeAssetAudit(session, { actor, action: "asset.conversion_approved", resourceType: "ASSET", resourceId: row._id, agencyId: row.agencyId, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "APPROVED", agencyId: row.receivingAgencyId }, requestId });
    for (const id of created) await writeAssetAudit(session, { actor, action: "asset.registered", resourceType: "ASSET", resourceId: id, agencyId: row.receivingAgencyId, newValue: { status: "IN_SERVICE", agencyId: row.receivingAgencyId }, requestId });
    return { created, row, fresh: true };
  });
  if (out.fresh) {
    await notifyAsset([out.row.requestedBy as Id], { title: "Asset conversion approved", message: `${out.row.conversionNo ?? "Conversion"} was approved: ${out.created.length} asset(s) registered.`, resource: { type: "ASSET", id: out.created[0]! }, eventKey: `cnv-ok:${out.row._id}` });
    await notifyAsset(await holdersOf([out.row.receivingAgencyId as Id], "asset.update", [actor.userId]), { title: "New assets handed over to your agency", message: `${out.created.length} asset(s) were registered from ${out.row.conversionNo ?? "a conversion"}.`, resource: { type: "ASSET", id: out.created[0]! }, eventKey: `cnv-own:${out.row._id}` });
  }
  const assets = await Asset.find({ _id: { $in: out.created } }).select("assetNo name").lean();
  return ok({ status: "APPROVED", assets: assets.map((a) => ({ id: String(a._id), assetNo: a.assetNo ?? null, name: a.name })) });
});

export const rejectConversion = (actor: AuthenticatedActor, rawId: string, note: string, requestId: string) => run(async () => {
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "asset.conversion.approve");
    const row = await loadForDecision(ctx, actor, rawId, session);
    if (row.status !== "PENDING_APPROVAL") throw new Flow(409, "CONFLICT", { current: row.status });
    if (String(row.requestedBy) === actor.userId) throw new Flow(403, "FORBIDDEN", { reason: "own_request" });
    const res = await AssetConversion.findOneAndUpdate({ _id: row._id, status: "PENDING_APPROVAL", version: row.version ?? 0 }, { $set: { status: "REJECTED", decidedBy: oid(actor.userId), decidedAt: new Date(), decisionNote: note }, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "already_decided" });
    await writeAssetAudit(session, { actor, action: "asset.conversion_rejected", resourceType: "ASSET", resourceId: row._id, agencyId: row.agencyId, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "REJECTED", reason: note }, requestId });
    return row;
  });
  await notifyAsset([out.requestedBy as Id], { title: "Asset conversion rejected", message: `${out.conversionNo ?? "Conversion"} was rejected.`, resource: { type: "PROJECT", id: out.projectId as Id }, eventKey: `cnv-no:${out._id}` });
  return ok({ status: "REJECTED" });
});

/** The approver must be able to read the project AND the receiving agency must be inside their scope (platform: any). Out of scope is a plain 404. */
async function loadForDecision(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session: ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const row = await AssetConversion.findOne({ $and: [await conversionScope(ctx, actor), { _id: rawId }] }).session(session).lean();
  if (!row) throw new Flow(404, "NOT_FOUND");
  if (ctx.scope.kind !== "platform" && !ctx.agencyObjectIds.some((a) => String(a) === String(row.receivingAgencyId)) ) throw new Flow(404, "NOT_FOUND");
  return row as typeof row & { _id: mongoose.Types.ObjectId };
}
