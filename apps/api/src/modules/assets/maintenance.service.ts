import type mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import type { z } from "zod";

import { Agency } from "../agencies/models/agency.model.js";
import { contextOf, Flow, need, run, type Ctx, type Result } from "../contractors/contractor.context.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { calendarWindowOk } from "../inspections/inspection.rules.js";
import { nextNumber } from "../../shared/database/counter.js";
import { assetScope, holdersOf, inTransaction, iso, isId, escapeRx, loadAsset, notifyAsset, oid, writeAssetAudit, type AssetRow, type Id } from "./asset.common.js";
import { refreshAssetCaches } from "./asset-cache.js";
import { type MaintenanceStatus } from "./asset.constants.js";
import { approvalAllowed, canMaintTransition, isMaintenanceOverdue, nextRecurrenceDate, repeatFailures, unresolvedTasks } from "./maintenance-workflow.js";
import type { approveBody, cancelBody, completeBody, maintCalendarQuery, maintListQuery, patchBody, rejectBody, requestBody, scheduleBody, taskPatch } from "./maintenance.schema.js";
import { AssetConditionAssessment } from "./models/asset-condition-assessment.model.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceEvidence } from "./models/maintenance-evidence.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const NONE = { _id: { $in: [] as Id[] } };
const DAY = 86_400_000;
const money = (minor: number) => ({ amountMinor: minor, currency: "LKR" as const });
export type MaintRow = mongoose.InferSchemaType<typeof MaintenanceRecord.schema> & { _id: Id };

/** Test seam: fails a completion after the data changed but before the audit row, to prove nothing persists. */
export const maintenanceHooks: { beforeAudit: () => Promise<void> } = { beforeAudit: async () => {} };

/** Scope follows the asset's owning agency. Inspectors, contractors and citizens never see maintenance. */
export function maintScope(ctx: Ctx, actor: AuthenticatedActor): Record<string, unknown> {
  if (actor.roleKey === "INSPECTOR" || actor.roleKey === "CONTRACTOR" || actor.roleKey === "CITIZEN") return NONE;
  if (ctx.scope.kind === "platform") return { agencyId: { $exists: true, $ne: null } };
  if (ctx.scope.kind === "agencies") return { agencyId: { $in: ctx.agencyObjectIds } };
  return NONE;
}

async function loadMaint(ctx: Ctx, actor: AuthenticatedActor, rawId: string, session?: ClientSession): Promise<MaintRow> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = MaintenanceRecord.findOne({ $and: [maintScope(ctx, actor), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as MaintRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  return row;
}

async function assertContractor(id: string | null | undefined, session: ClientSession): Promise<void> {
  if (!id) return;
  const c = await Contractor.findOne({ _id: id, status: "ACTIVE" }).select("_id").session(session).lean();
  if (!c) throw new Flow(400, "VALIDATION_ERROR", { field: "contractorId" });
}
async function assertAgency(id: string | null | undefined, session: ClientSession): Promise<void> {
  if (!id) return;
  if (!(await Agency.exists({ _id: id, status: "ACTIVE" }).session(session))) throw new Flow(400, "VALIDATION_ERROR", { field: "responsibleAgencyId" });
}
async function assertIssueKeys(assetId: Id, keys: string[], session: ClientSession): Promise<void> {
  if (!keys.length) return;
  const latest = await AssetConditionAssessment.findOne({ assetId, status: "ACTIVE" }).sort({ assessedAt: -1, createdAt: -1 }).session(session).lean();
  const open = new Set((latest?.issues ?? []).filter((i) => i.status === "OPEN").map((i) => i.key));
  if (keys.some((k) => !open.has(k))) throw new Flow(400, "VALIDATION_ERROR", { field: "linkedIssueKeys" });
}

/* ---------------- request / plan ---------------- */

export const requestMaintenance = (actor: AuthenticatedActor, rawAssetId: string, input: z.infer<typeof requestBody>, requestId: string) => run(async () => {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "maintenance.create");
    if (input.plan) need(ctx, "maintenance.update");
    if (actor.roleKey === "INSPECTOR") throw new Flow(403, "FORBIDDEN");
    const asset = await loadAsset(ctx, actor, rawAssetId, session, "write");
    if (asset.operationalStatus === "DECOMMISSIONED") throw new Flow(409, "CONFLICT", { current: "DECOMMISSIONED" });
    if (input.recurrenceDays && input.maintenanceType !== "PREVENTIVE" && input.maintenanceType !== "ROUTINE") throw new Flow(400, "VALIDATION_ERROR", { field: "recurrenceDays" });
    if (new Set(input.tasks.map((t) => t.key)).size !== input.tasks.length) throw new Flow(400, "VALIDATION_ERROR", { field: "tasks" });
    await assertContractor(input.contractorId, session);
    await assertAgency(input.responsibleAgencyId, session);
    await assertIssueKeys(asset._id, input.linkedIssueKeys, session);
    const status: MaintenanceStatus = input.plan ? "PLANNED" : "REQUESTED";
    const maintenanceNo = await nextNumber("MNT", now, session);
    const [row] = await MaintenanceRecord.create([{
      maintenanceNo, assetId: asset._id, agencyId: asset.agencyId, title: input.title, ...(input.description ? { description: input.description } : {}), maintenanceType: input.maintenanceType, priority: input.priority,
      origin: input.plan ? input.origin ?? "PLANNED" : "REQUEST", scheduledDate: input.scheduledDate, requestedBy: oid(actor.userId), requestedAt: now, status,
      ...(input.assignedTeam ? { assignedTeam: input.assignedTeam } : {}), ...(input.contractorId ? { contractorId: oid(input.contractorId) } : {}), ...(input.responsibleAgencyId ? { responsibleAgencyId: oid(input.responsibleAgencyId) } : {}),
      tasks: input.tasks.map((t) => ({ ...t, done: false })), ...(input.estimatedCost !== undefined ? { estimatedCost: money(input.estimatedCost) } : {}), ...(input.recurrenceDays ? { recurrenceDays: input.recurrenceDays } : {}),
      linkedIssueKeys: input.linkedIssueKeys, ...(input.acknowledgeEmergency ? { emergencyAcknowledged: true } : {}), version: 0,
    }], { session });
    await refreshAssetCaches(asset._id, session);
    await writeAssetAudit(session, { actor, action: "maintenance.requested", resourceType: "MAINTENANCE_RECORD", resourceId: row!._id, agencyId: asset.agencyId, newValue: { status, ...(input.estimatedCost !== undefined ? { cost: money(input.estimatedCost) } : {}) }, requestId });
    return { id: row!._id as Id, maintenanceNo, asset };
  });
  if (!input.plan) await notifyAsset(await holdersOf([out.asset.agencyId as Id], "maintenance.update", [actor.userId]), { title: "Maintenance request awaiting approval", message: `${out.maintenanceNo} for ${out.asset.assetNo ?? "an asset"} needs a decision.`, resource: { type: "ASSET", id: out.asset._id }, eventKey: `mnt-req:${out.id}` });
  return ok({ id: String(out.id), maintenanceNo: out.maintenanceNo, status: input.plan ? "PLANNED" : "REQUESTED" });
});

/* ---------------- edit ---------------- */

export const patchMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof patchBody>, requestId: string) => run(async () => {
  await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "maintenance.update");
    const row = await loadMaint(ctx, actor, rawId, session);
    if (!canMaintTransition("EDIT", row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
    const { version, estimatedCost, recurrenceDays, contractorId, responsibleAgencyId, tasks, ...rest } = input;
    const $set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const $unset: Record<string, 1> = {};
    if (estimatedCost !== undefined) $set.estimatedCost = money(estimatedCost);
    if (recurrenceDays === null) $unset.recurrenceDays = 1; else if (recurrenceDays !== undefined) { if (row.maintenanceType !== "PREVENTIVE" && row.maintenanceType !== "ROUTINE") throw new Flow(400, "VALIDATION_ERROR", { field: "recurrenceDays" }); $set.recurrenceDays = recurrenceDays; }
    if (contractorId === null) $unset.contractorId = 1; else if (contractorId) { await assertContractor(contractorId, session); $set.contractorId = oid(contractorId); }
    if (responsibleAgencyId === null) $unset.responsibleAgencyId = 1; else if (responsibleAgencyId) { await assertAgency(responsibleAgencyId, session); $set.responsibleAgencyId = oid(responsibleAgencyId); }
    if (tasks) { if (new Set(tasks.map((t) => t.key)).size !== tasks.length) throw new Flow(400, "VALIDATION_ERROR", { field: "tasks" }); $set.tasks = tasks.map((t) => ({ ...t, done: row.tasks?.find((x) => x.key === t.key)?.done ?? false })); }
    if (input.linkedIssueKeys) await assertIssueKeys(row.assetId as Id, input.linkedIssueKeys, session);
    const res = await MaintenanceRecord.findOneAndUpdate({ _id: row._id, version, status: { $in: ["REQUESTED", "PLANNED", "SCHEDULED"] } }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}), $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "stale_version" });
    await refreshAssetCaches(row.assetId as Id, session);
    await writeAssetAudit(session, { actor, action: "maintenance.updated", resourceType: "MAINTENANCE_RECORD", resourceId: row._id, agencyId: row.agencyId, newValue: { status: row.status, reason: `fields: ${[...Object.keys($set), ...Object.keys($unset)].join(",")}` }, requestId });
  });
  return ok({ updated: true });
});

/* ---------------- transitions ---------------- */

type Notice = { to: Id[]; title: string; message: string; assetId: Id; key: string };

async function transition(actor: AuthenticatedActor, rawId: string, requestId: string, work: (a: { ctx: Ctx; row: MaintRow; asset: AssetRow; session: ClientSession; now: Date }) => Promise<{ action: string; $set: Record<string, unknown>; from: MaintenanceStatus[]; to: MaintenanceStatus; auditReason?: string; notice?: Notice; extra?: (session: ClientSession) => Promise<void>; result?: Record<string, unknown> }>) {
  const now = new Date();
  const out = await inTransaction(async (session) => {
    const ctx = await contextOf(actor, session);
    need(ctx, "maintenance.update");
    const row = await loadMaint(ctx, actor, rawId, session);
    const asset = (await Asset.findById(row.assetId).session(session).lean()) as AssetRow | null;
    if (!asset) throw new Flow(404, "NOT_FOUND");
    const plan = await work({ ctx, row, asset, session, now });
    if (!plan.from.includes(row.status)) throw new Flow(409, "CONFLICT", { current: row.status });
    const res = await MaintenanceRecord.findOneAndUpdate({ _id: row._id, status: { $in: plan.from }, version: row.version ?? 0 }, { $set: { ...plan.$set, status: plan.to }, $inc: { version: 1 } }, { new: true, session });
    if (!res) throw new Flow(409, "CONFLICT", { current: "already_changed" });
    if (plan.extra) await plan.extra(session);
    await refreshAssetCaches(asset._id, session, { coupleStatus: true });
    await maintenanceHooks.beforeAudit();
    await writeAssetAudit(session, { actor, action: plan.action, resourceType: "MAINTENANCE_RECORD", resourceId: row._id, agencyId: row.agencyId, oldValue: { status: row.status }, newValue: { status: plan.to, ...(plan.auditReason ? { reason: plan.auditReason } : {}), ...(res.cost ? { cost: res.cost } : {}) }, requestId });
    return { plan, row };
  });
  if (out.plan.notice) await notifyAsset(out.plan.notice.to, { title: out.plan.notice.title, message: out.plan.notice.message, resource: { type: "ASSET", id: out.plan.notice.assetId }, eventKey: out.plan.notice.key });
  return ok({ id: String(out.row._id), status: out.plan.to, ...(out.plan.result ?? {}) });
}

const toRequester = (row: MaintRow, asset: AssetRow, title: string, key: string): Notice => ({ to: row.requestedBy ? [row.requestedBy as Id] : [], title, message: `${row.maintenanceNo ?? "Maintenance"} for ${asset.assetNo ?? "an asset"}.`, assetId: asset._id, key: `${key}:${row._id}` });

export const approveMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof approveBody>, requestId: string) => run(() => transition(actor, rawId, requestId, async ({ row, asset }) => {
  const verdict = approvalAllowed({ actorId: actor.userId, requesterId: row.requestedBy ? String(row.requestedBy) : null, maintenanceType: row.maintenanceType, roleKey: actor.roleKey, ...(input.acknowledgeEmergency !== undefined ? { acknowledgeEmergency: input.acknowledgeEmergency } : {}) });
  if (!verdict.ok) throw new Flow(403, "FORBIDDEN", { reason: "own_request" });
  // The single documented exception (EMERGENCY, GOV_ADMIN, acknowledged) must say so in the audit reason.
  return { action: "maintenance.approved", from: ["REQUESTED"], to: "PLANNED", $set: { decidedBy: oid(actor.userId), decidedAt: new Date(), ...(input.note ? { decisionNote: input.note } : {}), ...(verdict.viaEmergency ? { emergencyAcknowledged: true } : {}) }, auditReason: verdict.viaEmergency ? "emergency self approval acknowledged" : input.note, notice: toRequester(row, asset, "Maintenance request approved", "mnt-ok") };
}));

export const rejectMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof rejectBody>, requestId: string) => run(() => transition(actor, rawId, requestId, async ({ row, asset }) => {
  if (row.requestedBy && String(row.requestedBy) === actor.userId) throw new Flow(403, "FORBIDDEN", { reason: "own_request" });
  return { action: "maintenance.rejected", from: ["REQUESTED"], to: "REJECTED", $set: { decidedBy: oid(actor.userId), decidedAt: new Date(), decisionNote: input.note }, auditReason: input.note, notice: toRequester(row, asset, "Maintenance request rejected", "mnt-no") };
}));

export const scheduleMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof scheduleBody>, requestId: string) => run(() => transition(actor, rawId, requestId, async ({ row, asset, session }) => {
  await assertContractor(input.contractorId ?? undefined, session);
  await assertAgency(input.responsibleAgencyId ?? undefined, session);
  const $set: Record<string, unknown> = { scheduledDate: input.scheduledDate, ...(input.assignedTeam !== undefined ? { assignedTeam: input.assignedTeam } : {}), ...(input.contractorId ? { contractorId: oid(input.contractorId) } : {}), ...(input.responsibleAgencyId ? { responsibleAgencyId: oid(input.responsibleAgencyId) } : {}) };
  return { action: "maintenance.scheduled", from: ["PLANNED", "SCHEDULED"], to: "SCHEDULED", $set, notice: toRequester(row, asset, "Maintenance scheduled", "mnt-sch") };
}));

export const startMaintenance = (actor: AuthenticatedActor, rawId: string, requestId: string) => run(() => transition(actor, rawId, requestId, async ({ row, asset, now }) => {
  if (asset.operationalStatus === "DECOMMISSIONED") throw new Flow(409, "CONFLICT", { current: "DECOMMISSIONED" });
  return { action: "maintenance.started", from: ["SCHEDULED"], to: "IN_PROGRESS", $set: { startedAt: now }, notice: toRequester(row, asset, "Maintenance started", "mnt-start") };
}));

export const cancelMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof cancelBody>, requestId: string) => run(() => transition(actor, rawId, requestId, async () => ({ action: "maintenance.cancelled", from: ["PLANNED", "SCHEDULED", "IN_PROGRESS"], to: "CANCELLED", $set: { cancelReason: input.reason }, auditReason: input.reason })));

/**
 * Completion records the work done. It NEVER changes the asset condition: condition changes only through an assessment.
 * If a recurrence is set, the next PLANNED job is created in the same transaction (idempotent through previousRecordId).
 */
export const completeMaintenance = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof completeBody>, requestId: string) => run(() => transition(actor, rawId, requestId, async ({ row, asset, now }) => {
  if (input.completedDate.getTime() > now.getTime() || input.completedDate.getTime() < row.scheduledDate.getTime()) throw new Flow(400, "VALIDATION_ERROR", { field: "completedDate" });
  const merged = (row.tasks ?? []).map((t) => { const p = input.tasks.find((x) => x.key === t.key); return { key: t.key, title: t.title, done: p ? p.done : t.done, ...(p?.skippedNote ? { skippedNote: p.skippedNote } : t.skippedNote ? { skippedNote: t.skippedNote } : {}) }; });
  if (input.tasks.some((t) => !merged.some((m) => m.key === t.key))) throw new Flow(400, "VALIDATION_ERROR", { field: "tasks" });
  const open = unresolvedTasks(merged);
  if (open.length) throw new Flow(400, "VALIDATION_ERROR", { field: "tasks", reason: "tasks_unresolved", keys: open });
  const $set: Record<string, unknown> = { completedDate: input.completedDate, completionNotes: input.completionNotes, outcome: input.outcome, completedBy: oid(actor.userId), tasks: merged, ...(input.cost !== undefined ? { cost: money(input.cost) } : {}) };
  return {
    action: "maintenance.completed", from: ["IN_PROGRESS"], to: "COMPLETED", $set, notice: toRequester(row, asset, "Maintenance completed", "mnt-done"),
    result: { suggestAssessment: true, conditionUnchanged: true },
    extra: async (session) => {
      if (!row.recurrenceDays) return;
      if (await MaintenanceRecord.exists({ previousRecordId: row._id }).session(session)) return;
      await MaintenanceRecord.create([{
        maintenanceNo: await nextNumber("MNT", now, session), assetId: row.assetId, agencyId: row.agencyId, title: row.title, maintenanceType: row.maintenanceType, priority: row.priority ?? "NORMAL", origin: "RECURRENCE",
        scheduledDate: nextRecurrenceDate(input.completedDate, row.recurrenceDays), status: "PLANNED", recurrenceDays: row.recurrenceDays, previousRecordId: row._id, requestedBy: oid(actor.userId), requestedAt: now,
        ...(row.contractorId ? { contractorId: row.contractorId } : {}), tasks: (row.tasks ?? []).map((t) => ({ key: t.key, title: t.title, done: false })), version: 0,
      }], { session });
    },
  };
}));

export const toggleTask = (actor: AuthenticatedActor, rawId: string, taskKey: string, input: z.infer<typeof taskPatch>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "maintenance.update");
  const row = await loadMaint(ctx, actor, rawId);
  if (row.status !== "IN_PROGRESS" && row.status !== "SCHEDULED") throw new Flow(409, "CONFLICT", { current: row.status });
  if (!row.tasks?.some((t) => t.key === taskKey)) throw new Flow(404, "NOT_FOUND");
  const res = await MaintenanceRecord.updateOne({ _id: row._id, status: row.status, "tasks.key": taskKey }, { $set: { "tasks.$.done": input.done, ...(input.skippedNote !== undefined ? { "tasks.$.skippedNote": input.skippedNote } : {}) }, $inc: { version: 1 } });
  if (!res.modifiedCount) throw new Flow(409, "CONFLICT", { current: "already_changed" });
  return ok({ key: taskKey, done: input.done });
});

/* ---------------- reads ---------------- */

type Q = Partial<z.infer<typeof maintListQuery>>;
function buildFilter(ctx: Ctx, actor: AuthenticatedActor, q: Q, now: Date, assetIds?: Id[]): Record<string, unknown> {
  const and: Record<string, unknown>[] = [maintScope(ctx, actor)];
  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.type) and.push({ maintenanceType: q.type });
  if (q.priority) and.push({ priority: q.priority });
  if (q.assetId) and.push({ assetId: oid(q.assetId) });
  if (q.agencyId) and.push({ agencyId: oid(q.agencyId) });
  if (q.mine) and.push({ requestedBy: oid(actor.userId) });
  if (q.dateFrom || q.dateTo) and.push({ scheduledDate: { ...(q.dateFrom ? { $gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { $lte: new Date(q.dateTo) } : {}) } });
  if (q.overdue) and.push({ status: { $in: ["PLANNED", "SCHEDULED", "IN_PROGRESS"] }, scheduledDate: { $lt: now } });
  if (q.q) { const rx = new RegExp(escapeRx(q.q), "i"); and.push({ $or: [{ title: rx }, { maintenanceNo: rx }, ...(assetIds?.length ? [{ assetId: { $in: assetIds } }] : [])] }); }
  return { $and: and };
}

async function decorate(rows: MaintRow[], now: Date) {
  const assets = new Map((await Asset.find({ _id: { $in: [...new Set(rows.map((r) => String(r.assetId)))] } }).select("assetNo name assetType").lean()).map((a) => [String(a._id), a]));
  return rows.map((m) => ({
    id: String(m._id), maintenanceNo: m.maintenanceNo ?? null, title: m.title ?? null, maintenanceType: m.maintenanceType, priority: m.priority ?? "NORMAL", status: m.status, overdue: isMaintenanceOverdue(m.status, m.scheduledDate, now),
    scheduledDate: m.scheduledDate.toISOString(), completedDate: iso(m.completedDate), assetId: String(m.assetId), assetNo: assets.get(String(m.assetId))?.assetNo ?? null, assetName: assets.get(String(m.assetId))?.name ?? null, assetType: assets.get(String(m.assetId))?.assetType ?? null,
    estimatedCostMinor: m.estimatedCost?.amountMinor ?? null, actualCostMinor: m.cost?.amountMinor ?? null, taskCount: m.tasks?.length ?? 0, tasksDone: m.tasks?.filter((t) => t.done).length ?? 0, version: m.version ?? 0,
  }));
}

export const listMaintenance = (actor: AuthenticatedActor, q: z.infer<typeof maintListQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const now = new Date();
  const assetIds = q.q ? (await Asset.find({ $and: [await assetScope(ctx, actor), { $or: [{ name: new RegExp(escapeRx(q.q), "i") }, { assetNo: new RegExp(escapeRx(q.q), "i") }] }] }).select("_id").limit(200).lean()).map((a) => a._id as Id) : [];
  const filter = buildFilter(ctx, actor, q, now, assetIds);
  const sort: Record<string, 1 | -1> = q.sort === "date_desc" ? { scheduledDate: -1, _id: -1 } : q.sort === "priority" ? { priority: -1, scheduledDate: 1 } : { scheduledDate: 1, _id: 1 };
  const [rows, total, facets] = await Promise.all([
    MaintenanceRecord.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).maxTimeMS(8000).lean(),
    MaintenanceRecord.countDocuments(filter).maxTimeMS(8000),
    MaintenanceRecord.aggregate<{ _id: string; n: number }>([{ $match: maintScope(ctx, actor) }, { $group: { _id: "$status", n: { $sum: 1 } } }]).option({ maxTimeMS: 8000 }),
  ]);
  const view = (await decorate(rows as unknown as MaintRow[], now)).map((r, i) => ({ ...r, requestedByMe: String((rows[i] as MaintRow).requestedBy) === actor.userId }));
  return ok({ rows: view, total, page: q.page, limit: q.limit, facets: Object.fromEntries(facets.map((f) => [f._id, f.n])) });
});

export const maintenanceCalendar = (actor: AuthenticatedActor, q: z.infer<typeof maintCalendarQuery>) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const from = new Date(q.from), to = new Date(q.to);
  if (!calendarWindowOk(from, to)) throw new Flow(400, "VALIDATION_ERROR", { field: "window" });
  const now = new Date();
  const filter = buildFilter(ctx, actor, { ...q, dateFrom: q.from, dateTo: q.to }, now);
  const rows = await MaintenanceRecord.find({ $and: [filter, { status: { $nin: ["REJECTED", "CANCELLED"] } }] }).sort({ scheduledDate: 1, _id: 1 }).limit(501).maxTimeMS(8000).lean();
  return ok({ rows: await decorate(rows.slice(0, 500) as unknown as MaintRow[], now), truncated: rows.length > 500, from: from.toISOString(), to: to.toISOString(), timezone: "Asia/Colombo" });
});

export const maintenanceSummary = (actor: AuthenticatedActor) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const now = new Date();
  const scope = maintScope(ctx, actor);
  const c = (extra: Record<string, unknown>) => MaintenanceRecord.countDocuments({ $and: [scope, extra] }).maxTimeMS(8000);
  const [requested, next7, inProgress, overdue, completed30, myRequests] = await Promise.all([
    c({ status: "REQUESTED" }), c({ status: { $in: ["PLANNED", "SCHEDULED"] }, scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 7 * DAY) } }), c({ status: "IN_PROGRESS" }),
    c({ status: { $in: ["PLANNED", "SCHEDULED", "IN_PROGRESS"] }, scheduledDate: { $lt: now } }), c({ status: "COMPLETED", completedDate: { $gte: new Date(now.getTime() - 30 * DAY) } }), c({ requestedBy: oid(actor.userId), status: "REQUESTED" }),
  ]);
  const oldest = await MaintenanceRecord.findOne({ $and: [scope, { status: "REQUESTED" }] }).sort({ requestedAt: 1 }).select("requestedAt").lean();
  return ok({ counts: { requested, next7d: next7, inProgress, overdue, completed30d: completed30, myOpenRequests: myRequests }, oldestRequestAgeDays: oldest?.requestedAt ? Math.floor((now.getTime() - oldest.requestedAt.getTime()) / DAY) : null });
});

export const getMaintenance = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const ctx = await contextOf(actor);
  need(ctx, "asset.read");
  const row = await loadMaint(ctx, actor, rawId);
  const now = new Date();
  const [asset, evidence, history] = await Promise.all([
    Asset.findById(row.assetId).select("assetNo name assetType agencyId operationalStatus").lean(),
    MaintenanceEvidence.find({ maintenanceId: row._id, status: { $in: ["ACTIVE", "PENDING_UPLOAD"] } }).sort({ uploadedAt: 1 }).lean(),
    MaintenanceRecord.find({ assetId: row.assetId }).select("maintenanceType status scheduledDate").limit(100).lean(),
  ]);
  const { displayNames } = await import("../inspections/inspection.common.js");
  const names = await displayNames([row.requestedBy as Id | undefined, row.decidedBy as Id | undefined, row.completedBy as Id | undefined]);
  const contractor = row.contractorId && ctx.has("contractor.read") ? await Contractor.findById(row.contractorId).select("name").lean() : null;
  const responsible = row.responsibleAgencyId ? await Agency.findById(row.responsibleAgencyId).select("name").lean() : null;
  const status = row.status;
  const mine = row.requestedBy ? String(row.requestedBy) === actor.userId : false;
  // The single documented exception: a GOV_ADMIN may approve their own EMERGENCY request, only with an explicit acknowledgement.
  const emergencySelf = mine && row.maintenanceType === "EMERGENCY" && actor.roleKey === "GOV_ADMIN";
  return ok({
    id: String(row._id), maintenanceNo: row.maintenanceNo ?? null, title: row.title ?? null, description: row.description ?? null, maintenanceType: row.maintenanceType, priority: row.priority ?? "NORMAL", origin: row.origin ?? "PLANNED", status, overdue: isMaintenanceOverdue(status, row.scheduledDate, now),
    asset: asset ? { id: String(asset._id), assetNo: asset.assetNo ?? null, name: asset.name, assetType: asset.assetType, operationalStatus: asset.operationalStatus ?? "IN_SERVICE" } : null,
    scheduledDate: row.scheduledDate.toISOString(), completedDate: iso(row.completedDate), startedAt: iso(row.startedAt), requestedAt: iso(row.requestedAt), decidedAt: iso(row.decidedAt), decisionNote: row.decisionNote ?? null,
    requestedByName: row.requestedBy ? names.get(String(row.requestedBy)) ?? null : null, decidedByName: row.decidedBy ? names.get(String(row.decidedBy)) ?? null : null, completedByName: row.completedBy ? names.get(String(row.completedBy)) ?? null : null, requestedByMe: mine,
    assignedTeam: row.assignedTeam ?? null, contractor: contractor ? { id: String(row.contractorId), name: contractor.name } : null, responsibleAgency: responsible ? { id: String(row.responsibleAgencyId), name: responsible.name } : null,
    tasks: row.tasks ?? [], linkedIssueKeys: row.linkedIssueKeys ?? [], estimatedCostMinor: row.estimatedCost?.amountMinor ?? null, actualCostMinor: row.cost?.amountMinor ?? null, currency: "LKR",
    completionNotes: row.completionNotes ?? null, outcome: row.outcome ?? null, cancelReason: row.cancelReason ?? null, recurrenceDays: row.recurrenceDays ?? null, emergencyAcknowledged: row.emergencyAcknowledged ?? false, version: row.version ?? 0,
    repeatFailures: repeatFailures(history.map((h) => ({ maintenanceType: h.maintenanceType, status: h.status, scheduledDate: h.scheduledDate })), now),
    evidence: evidence.map((e) => ({ id: String(e._id), caption: e.caption ?? null, capturedAt: e.capturedAt.toISOString(), uploadedAt: e.uploadedAt.toISOString(), status: e.status, width: e.width ?? null, height: e.height ?? null, sizeBytes: e.sizeBytes, hasThumb: Boolean(e.thumbDocumentId), shaPrefix: e.sha256.slice(0, 12), uploadedByMe: String(e.uploadedBy) === actor.userId })),
    can: {
      edit: ctx.has("maintenance.update") && canMaintTransition("EDIT", status),
      approve: ctx.has("maintenance.update") && status === "REQUESTED" && (!mine || emergencySelf),
      approveBlockedReason: ctx.has("maintenance.update") && status === "REQUESTED" && mine && !emergencySelf ? "own_request" : null,
      emergencySelfApproval: ctx.has("maintenance.update") && status === "REQUESTED" && emergencySelf,
      reject: ctx.has("maintenance.update") && status === "REQUESTED" && !mine, schedule: ctx.has("maintenance.update") && canMaintTransition("SCHEDULE", status), start: ctx.has("maintenance.update") && status === "SCHEDULED",
      complete: ctx.has("maintenance.update") && status === "IN_PROGRESS", cancel: ctx.has("maintenance.update") && canMaintTransition("CANCEL", status), manageEvidence: ctx.has("maintenance.update") && status === "IN_PROGRESS",
    },
  });
});

