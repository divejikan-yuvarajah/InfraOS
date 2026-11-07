import type { z } from "zod";

import { Agency } from "../agencies/models/agency.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { contextOf, Flow, need, run, type Ctx, type Result } from "../contractors/contractor.context.js";
import { Document } from "../documents/models/document.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { attentionReasons } from "../inframap/inframap.access.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { Project } from "../projects/models/project.model.js";
import { DEFAULT_MONITORING_DAYS, type AssetType } from "./asset.constants.js";
import { assetScope, assetWriteScope, escapeRx, iso, loadAsset, oid, type AssetRow, type Id } from "./asset.common.js";
import type { assetListQuery, timelineQuery } from "./asset.schema.js";
import { computeAssetState } from "./asset-cache.js";
import { isMaintenanceOverdue, repeatFailures } from "./maintenance-workflow.js";
import { AssetConditionAssessment } from "./models/asset-condition-assessment.model.js";
import { AssetConversion } from "./models/asset-conversion.model.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const DAY = 86_400_000;
const intervalOf = (a: { assetType: string; monitoringIntervalDays?: number | null }) => a.monitoringIntervalDays ?? DEFAULT_MONITORING_DAYS[a.assetType as AssetType] ?? 365;
const OPEN_WORK = ["PLANNED", "SCHEDULED", "IN_PROGRESS"] as const;

/** The same needs-attention rule InfraMap uses, expressed as a database filter so the directory can filter server-side. */
export function attentionFilter(now = new Date()): Record<string, unknown> {
  const stale = new Date(now.getTime() - 365 * DAY);
  return { $or: [{ condition: { $in: ["POOR", "CRITICAL"] } }, { nextMaintenanceAt: { $lt: now } }, { lastInspectionAt: { $lt: stale } }, { lastInspectionAt: { $exists: false }, commissionedAt: { $lt: stale } }] };
}

const HEALTH_RANGE: Record<string, Record<string, unknown>> = { GOOD: { healthScore: { $gte: 75 } }, WATCH: { healthScore: { $gte: 50, $lt: 75 } }, POOR: { healthScore: { $gte: 25, $lt: 50 } }, CRITICAL: { healthScore: { $lt: 25 } }, NONE: { healthScore: { $exists: false } } };

async function buildFilter(ctx: Ctx, actor: AuthenticatedActor, q: Partial<z.infer<typeof assetListQuery>>, now: Date): Promise<Record<string, unknown>> {
  const and: Record<string, unknown>[] = [await assetScope(ctx, actor)];
  if (q.assetType?.length) and.push({ assetType: { $in: q.assetType } });
  if (q.condition?.length) and.push({ condition: { $in: q.condition } });
  if (q.operationalStatus?.length) and.push({ operationalStatus: { $in: q.operationalStatus } });
  if (q.agencyId) and.push({ agencyId: oid(q.agencyId) });
  if (q.projectId) and.push({ sourceProjectId: oid(q.projectId) });
  if (q.district) and.push({ "location.district": q.district });
  if (q.attention) and.push(attentionFilter(now));
  if (q.dlp) and.push({ defectsLiabilityEndsOn: { $gte: now } });
  if (q.healthBand?.length) { if (!ctx.has("asset.health.read")) throw new Flow(403, "FORBIDDEN"); and.push({ $or: q.healthBand.map((b) => HEALTH_RANGE[b]!) }); }
  if (q.hasOpenMaintenance) and.push({ _id: { $in: await MaintenanceRecord.distinct("assetId", { status: { $in: ["REQUESTED", ...OPEN_WORK] } }) } });
  if (q.q) { const rx = new RegExp(escapeRx(q.q), "i"); and.push({ $or: [{ name: rx }, { assetNo: rx }] }); }
  return { $and: and };
}

const SORTS: Record<string, Record<string, 1 | -1>> = { name: { name: 1, _id: 1 }, condition: { condition: 1, _id: 1 }, health: { healthScore: 1, _id: 1 }, nextMaintenance: { nextMaintenanceAt: 1, _id: 1 }, recent: { createdAt: -1, _id: -1 } };

async function decorate(ctx: Ctx, rows: AssetRow[], now: Date) {
  const ids = rows.map((r) => r._id);
  const [assess, agencies] = await Promise.all([
    AssetConditionAssessment.find({ assetId: { $in: ids }, status: "ACTIVE" }).select("assetId basis assessedAt").lean(),
    Agency.find({ _id: { $in: [...new Set(rows.map((r) => String(r.agencyId)))] } }).select("name").lean(),
  ]);
  const basis = new Map(assess.map((a) => [String(a.assetId), a.basis]));
  const names = new Map(agencies.map((a) => [String(a._id), a.name as string]));
  const canHealth = ctx.has("asset.health.read");
  return rows.map((r) => {
    const reasons = attentionReasons({ condition: r.condition, nextMaintenanceAt: r.nextMaintenanceAt ?? null, lastInspectionAt: r.lastInspectionAt ?? null, commissionedAt: r.commissionedAt } as never, now);
    const due = (r.lastInspectionAt ?? r.commissionedAt).getTime() + intervalOf(r) * DAY;
    return {
      id: String(r._id), assetNo: r.assetNo ?? null, name: r.name, assetType: r.assetType, agencyId: String(r.agencyId), agencyName: names.get(String(r.agencyId)) ?? null, district: r.location?.district ?? null,
      condition: r.condition, conditionBasis: basis.get(String(r._id)) ?? (r.condition === "UNKNOWN" ? "NONE" : "LEGACY"), healthScore: canHealth ? r.healthScore ?? null : null,
      operationalStatus: r.operationalStatus ?? "IN_SERVICE", origin: r.origin ?? "LEGACY", nextAssessmentDue: new Date(due).toISOString(), assessmentOverdue: due < now.getTime(), nextMaintenanceAt: iso(r.nextMaintenanceAt), lastInspectionAt: iso(r.lastInspectionAt),
      attention: reasons, withinDlp: Boolean(r.defectsLiabilityEndsOn && r.defectsLiabilityEndsOn.getTime() >= now.getTime()), version: r.version ?? 0,
    };
  });
}

export const listAssets = (actor: AuthenticatedActor, q: z.infer<typeof assetListQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const now = new Date();
  const filter = await buildFilter(ctx, actor, q, now);
  const scope = { $and: [await assetScope(ctx, actor)] };
  const [rows, total, byCondition, byStatus, byType] = await Promise.all([
    Asset.find(filter).sort(SORTS[q.sort]!).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean(),
    Asset.countDocuments(filter).maxTimeMS(8000),
    Asset.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: "$condition", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
    Asset.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: { $ifNull: ["$operationalStatus", "IN_SERVICE"] }, n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
    Asset.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: "$assetType", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
  ]);
  const f = (a: { _id: string; n: number }[]) => Object.fromEntries(a.map((x) => [x._id, x.n]));
  return ok({ rows: await decorate(ctx, rows as unknown as AssetRow[], now), total, page: q.page, limit: q.limit, facets: { condition: f(byCondition), operationalStatus: f(byStatus), assetType: f(byType) } });
});

export const assetSummary = (actor: AuthenticatedActor) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const now = new Date();
  const scope = await assetScope(ctx, actor);
  const base = { $and: [scope] };
  const overdueExpr = { $lt: [{ $add: [{ $ifNull: ["$lastInspectionAt", "$commissionedAt"] }, { $multiply: [{ $ifNull: ["$monitoringIntervalDays", 365] }, DAY] }] }, now] };
  const dueSoonExpr = { $and: [{ $gte: [{ $add: [{ $ifNull: ["$lastInspectionAt", "$commissionedAt"] }, { $multiply: [{ $ifNull: ["$monitoringIntervalDays", 365] }, DAY * 0.85] }] }, now] }, { $lt: [{ $add: [{ $ifNull: ["$lastInspectionAt", "$commissionedAt"] }, { $multiply: [{ $ifNull: ["$monitoringIntervalDays", 365] }, DAY] }] }, now] }] };
  const myAssets = await Asset.distinct("_id", base);
  const maintScope = { assetId: { $in: myAssets } };
  const g = (field: string) => Asset.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: field, n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 });
  const [total, byType, byCondition, byStatus, attention, assessOverdue, assessDue, overdueMaint, requests, upcoming, pendingConv, workload] = await Promise.all([
    Asset.countDocuments(scope).maxTimeMS(8000), g("$assetType"), g("$condition"), g("$operationalStatus"),
    Asset.countDocuments({ $and: [scope, attentionFilter(now)] }).maxTimeMS(8000),
    Asset.countDocuments({ $and: [scope, { operationalStatus: { $ne: "DECOMMISSIONED" } }, { $expr: overdueExpr }] }).maxTimeMS(8000),
    Asset.countDocuments({ $and: [scope, { operationalStatus: { $ne: "DECOMMISSIONED" } }, { $expr: dueSoonExpr }] }).maxTimeMS(8000),
    MaintenanceRecord.countDocuments({ ...maintScope, status: { $in: OPEN_WORK }, scheduledDate: { $lt: now } }).maxTimeMS(8000),
    MaintenanceRecord.countDocuments({ ...maintScope, status: "REQUESTED" }).maxTimeMS(8000),
    MaintenanceRecord.countDocuments({ ...maintScope, status: { $in: ["PLANNED", "SCHEDULED"] }, scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY) } }).maxTimeMS(8000),
    ctx.has("asset.conversion.approve") ? AssetConversion.countDocuments({ status: "PENDING_APPROVAL", requestedBy: { $ne: oid(actor.userId) }, ...(ctx.scope.kind === "agencies" ? { receivingAgencyId: { $in: ctx.agencyObjectIds } } : {}) }) : Promise.resolve(null),
    MaintenanceRecord.aggregate<{ _id: string; planned: number; completed: number }>([
      { $match: { ...maintScope, scheduledDate: { $gte: new Date(now.getTime() - 150 * DAY), $lte: new Date(now.getTime() + 60 * DAY) }, status: { $nin: ["CANCELLED", "REJECTED"] } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$scheduledDate", timezone: "Asia/Colombo" } }, planned: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 0, 1] } }, completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } } } }, { $sort: { _id: 1 } },
    ]).option({ maxTimeMS: 8000 }),
  ]);
  const withBasis = await AssetConditionAssessment.distinct("assetId", { assetId: { $in: myAssets }, status: "ACTIVE" });
  const canHealth = ctx.has("asset.health.read");
  let health: unknown = { restricted: true };
  if (canHealth) {
    const scored = await Asset.aggregate<{ _id: string; n: number }>([{ $match: { $and: [scope, { healthScore: { $exists: true } }] } }, { $bucket: { groupBy: "$healthScore", boundaries: [0, 25, 50, 75, 101], default: "other", output: { n: { $sum: 1 } } } }]).option({ maxTimeMS: 8000 });
    const b = Object.fromEntries(scored.map((x) => [String(x._id), x.n]));
    health = { available: scored.reduce((n, x) => n + x.n, 0), total, distribution: { CRITICAL: b["0"] ?? 0, POOR: b["25"] ?? 0, WATCH: b["50"] ?? 0, GOOD: b["75"] ?? 0 } };
  }
  const f = (a: { _id: string; n: number }[]) => Object.fromEntries(a.map((x) => [x._id ?? "IN_SERVICE", x.n]));
  const top = await Asset.find({ $and: [scope, attentionFilter(now)] }).sort({ healthScore: 1, nextMaintenanceAt: 1 }).limit(5).lean();
  return ok({
    total, byType: f(byType), byCondition: f(byCondition), byOperationalStatus: f(byStatus), unassessed: Math.max(0, total - withBasis.length), attention, assessments: { overdue: assessOverdue, dueSoon: assessDue },
    maintenance: { overdue: overdueMaint, openRequests: requests, upcoming30d: upcoming }, pendingConversions: pendingConv, health, workload: workload.map((w) => ({ month: w._id, planned: w.planned, completed: w.completed })),
    attentionList: await decorate(ctx, top as unknown as AssetRow[], now),
  });
});

/* ---------------- passport ---------------- */

const sumMinor = (rows: { amountMinor: number }[]) => Number(rows.reduce((s, r) => s + BigInt(r.amountMinor), 0n));

export const getAsset = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const asset = await loadAsset(ctx, actor, rawId, undefined, "read");
  const now = new Date();
  const canHealth = ctx.has("asset.health.read");
  const [state, allAssess, maint, conversion, project, writeOk] = await Promise.all([
    computeAssetState(asset, now),
    AssetConditionAssessment.find({ assetId: asset._id }).sort({ assessedAt: -1, createdAt: -1 }).limit(60).lean(),
    MaintenanceRecord.find({ assetId: asset._id }).sort({ scheduledDate: -1 }).limit(60).lean(),
    asset.conversionId ? AssetConversion.findById(asset.conversionId).select("conversionNo status receivingAgencyId handover.documentIds handover.handoverNote").lean() : Promise.resolve(null),
    Project.findOne({ $and: [projectReadFilter(ctx.scope), { _id: asset.sourceProjectId }] }).select("projectCode title status projectType actualEndDate agencyId contractorId").lean(),
    Asset.exists({ $and: [assetWriteScope(ctx, actor), { _id: asset._id }] }),
  ]);
  const { displayNames } = await import("../inspections/inspection.common.js");
  const names = await displayNames([...allAssess.map((a) => a.assessedBy as Id), ...allAssess.map((a) => a.reviewedBy as Id | undefined), ...maint.map((m) => m.requestedBy as Id | undefined)]);
  const [owner, builder] = await Promise.all([Agency.findById(asset.agencyId).select("name").lean(), asset.constructionAgencyId ? Agency.findById(asset.constructionAgencyId).select("name").lean() : null]);

  // Construction history, each part behind its own permission.
  const construction: Record<string, unknown> = { project: project ? { id: String(project._id), projectCode: project.projectCode, title: project.title, status: project.status, projectType: project.projectType, completedOn: iso(project.actualEndDate) } : null };
  if (project && ctx.has("contractor.read")) {
    const asg = await ContractorAssignment.find({ projectId: project._id, ...(asset.handoverAt ? { startDate: { $lte: asset.handoverAt } } : {}) }).select("contractorId role status contractReference").limit(20).lean();
    const cs = await Contractor.find({ _id: { $in: asg.map((a) => a.contractorId) } }).select("name").lean();
    const cmap = new Map(cs.map((c) => [String(c._id), c.name as string]));
    construction.contractors = asg.map((a) => ({ contractorId: String(a.contractorId), name: cmap.get(String(a.contractorId)) ?? null, role: a.role, status: a.status, contractReference: a.contractReference ?? null }));
  }
  if (project && ctx.has("finance.payment.read")) {
    const paid = await ProjectPayment.find({ projectId: project._id, status: "PAID" }).select("amount.amountMinor").lean();
    construction.finance = { paidMinor: sumMinor(paid.map((p) => ({ amountMinor: p.amount.amountMinor }))), basis: "paid payments only" };
  }
  if (project && ctx.has("inspection.read")) {
    const outcomes = await Inspection.aggregate<{ _id: string; n: number }>([{ $match: { projectId: project._id, status: { $in: ["VERIFIED", "REJECTED", "REQUIRES_REVIEW"] } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
    construction.inspections = Object.fromEntries(outcomes.map((o) => [o._id, o.n]));
  }
  if (conversion && ctx.has("document.read")) {
    const docs = await Document.find({ _id: { $in: conversion.handover.documentIds } }).select("fileName documentType").lean();
    construction.documents = docs.map((d) => ({ id: String(d._id), fileName: d.fileName, documentType: d.documentType }));
  }

  const costs = maint.filter((m) => m.status !== "CANCELLED" && m.status !== "REJECTED");
  const latest = state.latest;
  return ok({
    id: String(asset._id), assetNo: asset.assetNo ?? null, name: asset.name, description: asset.description ?? null, assetType: asset.assetType, origin: asset.origin ?? "LEGACY", operationalStatus: asset.operationalStatus ?? "IN_SERVICE",
    owner: { id: String(asset.agencyId), name: owner?.name ?? null }, constructionAgency: asset.constructionAgencyId ? { id: String(asset.constructionAgencyId), name: builder?.name ?? null } : null,
    location: asset.location ?? null, hasGeometry: Boolean(asset.geometry), handoverAt: iso(asset.handoverAt), defectsLiabilityEndsOn: iso(asset.defectsLiabilityEndsOn), designLifeYears: asset.designLifeYears ?? null,
    monitoringIntervalDays: intervalOf(asset), commissionedAt: iso(asset.commissionedAt), version: asset.version ?? 0, sensitivity: asset.sensitivity ?? null,
    condition: { value: asset.condition, basis: latest?.basis ?? (asset.condition === "UNKNOWN" ? "NONE" : "LEGACY"), lastAssessedAt: iso(latest?.assessedAt), trend: state.condition.trend, declinePerYear: state.condition.declinePerYear, flags: state.condition.flags, rulesVersion: state.condition.version },
    health: canHealth ? state.health : { restricted: true },
    assessments: allAssess.map((a) => ({ id: String(a._id), assessedAt: iso(a.assessedAt), condition: a.condition, basis: a.basis, status: a.status, observations: a.observations ?? null, issues: a.issues, inspectionId: a.inspectionId ? String(a.inspectionId) : null, assessedByName: names.get(String(a.assessedBy)) ?? null, reviewedByName: a.reviewedBy ? names.get(String(a.reviewedBy)) ?? null : null, previousCondition: a.previousCondition ?? null })),
    openIssues: latest ? latest.issues.filter((i) => i.status === "OPEN") : [],
    maintenance: maint.map((m) => ({ id: String(m._id), maintenanceNo: m.maintenanceNo ?? null, title: m.title ?? null, maintenanceType: m.maintenanceType, priority: m.priority ?? "NORMAL", status: m.status, overdue: isMaintenanceOverdue(m.status, m.scheduledDate, now), scheduledDate: iso(m.scheduledDate), completedDate: iso(m.completedDate), estimatedCostMinor: m.estimatedCost?.amountMinor ?? null, actualCostMinor: m.cost?.amountMinor ?? null, outcome: m.outcome ?? null })),
    repeatFailures: repeatFailures(maint.map((m) => ({ maintenanceType: m.maintenanceType, status: m.status, scheduledDate: m.scheduledDate })), now),
    costs: { estimatedMinor: sumMinor(costs.filter((m) => m.estimatedCost).map((m) => ({ amountMinor: m.estimatedCost!.amountMinor }))), actualMinor: sumMinor(costs.filter((m) => m.cost).map((m) => ({ amountMinor: m.cost!.amountMinor }))), currency: "LKR" },
    conversion: conversion ? { id: String(asset.conversionId), conversionNo: conversion.conversionNo ?? null, status: conversion.status, handoverNote: conversion.handover.handoverNote ?? null } : null, construction,
    can: { update: Boolean(writeOk) && ctx.has("asset.update"), recordAssessment: Boolean(writeOk) && ctx.has("asset.update"), requestMaintenance: ctx.has("maintenance.create") && actor.roleKey !== "INSPECTOR", viewHealth: canHealth, export: ctx.has("report.export"), requestVerifiedAssessment: ctx.has("inspection.assign") },
  });
});

/* ---------------- lifecycle timeline ---------------- */

export const assetTimeline = (actor: AuthenticatedActor, rawId: string, q: z.infer<typeof timelineQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const asset = await loadAsset(ctx, actor, rawId, undefined, "read");
  const before = q.cursor ? new Date(q.cursor) : null;
  if (before && Number.isNaN(before.getTime())) throw new Flow(400, "VALIDATION_ERROR");
  type Ev = { at: Date; source: string; type: string; ref?: string; params?: Record<string, string | number | null>; link?: string };
  const events: Ev[] = [];
  const projectReadable = Boolean(await Project.exists({ $and: [projectReadFilter(ctx.scope), { _id: asset.sourceProjectId }] }));
  if (projectReadable) {
    for (const m of await Milestone.find({ projectId: asset.sourceProjectId, status: "COMPLETED", actualEnd: { $exists: true } }).select("title actualEnd").limit(30).lean()) events.push({ at: m.actualEnd as Date, source: "project", type: "milestone_completed", ref: String(m._id), params: { title: m.title } });
    const p = await Project.findById(asset.sourceProjectId).select("actualEndDate").lean();
    if (p?.actualEndDate) events.push({ at: p.actualEndDate, source: "project", type: "project_completed", link: `/projects/${asset.sourceProjectId}/overview` });
    if (ctx.has("inspection.read")) {
      for (const i of await Inspection.find({ projectId: asset.sourceProjectId, status: { $in: ["VERIFIED", "REJECTED"] }, completedAt: { $exists: true } }).select("inspectionNo inspectionType status completedAt").limit(40).lean()) events.push({ at: i.completedAt as Date, source: "inspection", type: i.status === "VERIFIED" ? "inspection_approved" : "inspection_rejected", ref: String(i._id), params: { no: i.inspectionNo ?? null, kind: i.inspectionType ?? null }, link: `/inspections/${i._id}` });
    }
  }
  if (asset.conversionId) {
    const c = await AssetConversion.findById(asset.conversionId).select("conversionNo requestedAt decidedAt status").lean();
    if (c) { events.push({ at: c.requestedAt, source: "conversion", type: "conversion_requested", params: { no: c.conversionNo ?? null } }); if (c.decidedAt) events.push({ at: c.decidedAt, source: "conversion", type: c.status === "APPROVED" ? "conversion_approved" : "conversion_decided", params: { no: c.conversionNo ?? null } }); }
  }
  for (const a of await AssetConditionAssessment.find({ assetId: asset._id }).select("assessedAt condition basis inspectionId").sort({ assessedAt: -1 }).limit(60).lean()) events.push({ at: a.assessedAt, source: "assessment", type: "assessment_recorded", ref: String(a._id), params: { condition: a.condition, basis: a.basis }, ...(a.inspectionId && ctx.has("inspection.read") ? { link: `/inspections/${a.inspectionId}` } : {}) });
  for (const m of await MaintenanceRecord.find({ assetId: asset._id }).select("maintenanceNo requestedAt decidedAt startedAt completedDate status title").sort({ scheduledDate: -1 }).limit(60).lean()) {
    const base = { source: "maintenance", ref: String(m._id), params: { no: m.maintenanceNo ?? null, title: m.title ?? null } };
    if (m.requestedAt) events.push({ ...base, at: m.requestedAt, type: "maintenance_requested" });
    if (m.decidedAt) events.push({ ...base, at: m.decidedAt, type: m.status === "REJECTED" ? "maintenance_rejected" : "maintenance_approved" });
    if (m.startedAt) events.push({ ...base, at: m.startedAt, type: "maintenance_started" });
    if (m.completedDate) events.push({ ...base, at: m.completedDate, type: "maintenance_completed" });
  }
  for (const a of await AuditLog.find({ resourceType: "ASSET", resourceId: asset._id, action: { $in: ["asset.registered", "asset.status_changed", "asset.updated"] } }).select("action timestamp").sort({ timestamp: -1 }).limit(40).lean()) events.push({ at: a.timestamp as Date, source: "status", type: a.action.replace("asset.", "asset_") });
  const filtered = events.filter((e) => (!q.source || e.source === q.source) && (!before || e.at.getTime() < before.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());
  const page = filtered.slice(0, q.limit);
  return ok({ events: page.map((e) => ({ at: e.at.toISOString(), source: e.source, type: e.type, ref: e.ref ?? null, params: e.params ?? {}, link: e.link ?? null })), nextCursor: filtered.length > q.limit ? page[page.length - 1]!.at.toISOString() : null });
});
