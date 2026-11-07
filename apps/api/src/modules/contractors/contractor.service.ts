import mongoose from "mongoose";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { readDocument } from "../identity/authorization/resource-scope.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Project } from "../projects/models/project.model.js";
import { mapMongoDuplicateField } from "../../shared/errors/mongo-duplicate.js";
import {
  directoryRow, profileGaps, projectContractor, reasonRequired, statusMoveAllowed, tierOf,
  type ContractorLike,
} from "./contractor.access.js";
import { agencyNames, assignedInScope, contextOf, Flow, lockContractor, need, notFound, run, visibleFilter, writeAudit, type Ctx, type Result } from "./contractor.context.js";
import { emailKeyOf, escapeRegex, nameKeyOf, registrationNumberOf, taxIdKeyOf } from "./contractor.keys.js";
import type { ContractorCreateInput, ContractorListQuery, ContractorPatchInput, StatusBody } from "./contractor.schema.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";
import { Contractor } from "./models/contractor.model.js";

type Id = mongoose.Types.ObjectId;
const oid = (v: string) => new mongoose.Types.ObjectId(v);
const isId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
const MAX_SORT_SET = 2000;

type Doc = ContractorLike & { _id: Id; registeredByAgencyId?: Id | null; updatedAt?: Date; status: string; nameKey?: string | null };

/** Assignment-derived counts, over in-scope projects only. */
async function activeCounts(ctx: Ctx, ids?: Id[]): Promise<Map<string, number>> {
  const match: Record<string, unknown> = { status: "ACTIVE" };
  if (ctx.scope.kind === "agencies") match.agencyId = { $in: ctx.agencyObjectIds };
  if (ids) match.contractorId = { $in: ids };
  const rows = await ContractorAssignment.aggregate<{ _id: Id; n: number }>([{ $match: match }, { $group: { _id: "$contractorId", n: { $sum: 1 } } }]).option({ maxTimeMS: 5000 });
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

function narrow(q: ContractorListQuery, ctx: Ctx, omit?: "status" | "category"): { filter: Record<string, unknown> | "none"; needsActive: boolean | null } {
  const and: Record<string, unknown>[] = [];
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    and.push({ $or: [{ name: rx }, { registrationNumber: rx }] });
  }
  if (q.status?.length && omit !== "status") and.push({ status: { $in: q.status } });
  if (q.category && omit !== "category") and.push({ category: q.category });
  if (q.district) and.push({ operatingDistricts: q.district });
  if (q.agencyId) {
    const allowed = ctx.scope.kind === "platform" || ctx.viewer.agencyIds.includes(q.agencyId);
    if (!allowed) return { filter: "none", needsActive: null };
    and.push({ registeredByAgencyId: oid(q.agencyId) });
  }
  if (q.certExpiringDays) {
    const now = new Date();
    if (q.certExpiringDays === "expired") and.push({ certifications: { $elemMatch: { status: { $ne: "REVOKED" }, expiresOn: { $lt: now } } } });
    else and.push({ certifications: { $elemMatch: { status: "VALID", expiresOn: { $gte: now, $lte: new Date(now.getTime() + Number(q.certExpiringDays) * 86_400_000) } } } });
  }
  return { filter: and.length ? { $and: and } : {}, needsActive: q.hasActiveProjects ?? null };
}

const merge = (...parts: Record<string, unknown>[]) => { const p = parts.filter((x) => Object.keys(x).length); return p.length ? { $and: p } : {}; };

async function rowsFor(ctx: Ctx, docs: Doc[], extra?: { risk?: Map<string, { band: string; level: string }> }) {
  const [names, counts] = await Promise.all([agencyNames(docs.map((d) => d.registeredByAgencyId)), activeCounts(ctx, docs.map((d) => d._id))]);
  const now = new Date();
  return docs.map((d) => {
    const owned = tierOf(ctx.viewer, d, true) === "manage";
    const risk = extra?.risk?.get(String(d._id));
    return {
      ...directoryRow(d, d.registeredByAgencyId ? names.get(String(d.registeredByAgencyId)) ?? null : null, now),
      activeProjects: counts.get(String(d._id)) ?? 0, canManage: owned,
      ...(ctx.viewer.canPerformance ? { reliabilityBand: risk?.band ?? null, evidenceLevel: risk?.level ?? null } : {}),
    };
  });
}

/** Optional risk lookup, filled in by the performance service (Step 94). Absent means risk filtering/sorting is unavailable. */
export const riskHooks: { bands: null | ((actor: AuthenticatedActor, ctx: Ctx, ids: Id[]) => Promise<Map<string, { band: string; level: string; high: number }>>) } = { bands: null };

export function listContractors(actor: AuthenticatedActor, q: ContractorListQuery) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    if ((q.riskBand || q.sort === "risk") && !ctx.viewer.canPerformance) throw new Flow(403, "FORBIDDEN");
    const vis = await visibleFilter(ctx);
    const base = narrow(q, ctx);
    if (base.filter === "none") return { ok: true, data: { rows: [], total: 0, page: q.page, limit: q.limit, facets: { status: [], category: [] }, scope: ctx.scope.kind } };
    let activeIds: Id[] | null = null;
    const extra: Record<string, unknown>[] = [];
    if (base.needsActive !== null) {
      const m = new Map(await activeCounts(ctx));
      activeIds = [...m.keys()].map(oid);
      extra.push(base.needsActive ? { _id: { $in: activeIds } } : { _id: { $nin: activeIds } });
    }
    const filter = merge(vis, base.filter, ...extra);
    const needsCompute = q.sort === "activeProjects" || q.sort === "risk" || Boolean(q.riskBand);
    let docs: Doc[];
    let total: number;
    let risk: Map<string, { band: string; level: string; high: number }> | undefined;
    if (needsCompute) {
      const all = (await Contractor.find(filter).select("name registeredByAgencyId status").limit(MAX_SORT_SET + 1).lean()) as unknown as { _id: Id; name: string }[];
      if (all.length > MAX_SORT_SET) throw new Flow(503, "SERVICE_UNAVAILABLE", { reason: "too_many_to_sort" });
      let ids = all;
      if (q.sort === "risk" || q.riskBand) {
        if (!riskHooks.bands) throw new Flow(503, "SERVICE_UNAVAILABLE");
        risk = await riskHooks.bands(actor, ctx, all.map((a) => a._id));
        if (q.riskBand) ids = all.filter((a) => risk!.get(String(a._id))?.band === q.riskBand);
        if (q.sort === "risk") ids = [...ids].sort((a, b) => (risk!.get(String(b._id))?.high ?? 0) - (risk!.get(String(a._id))?.high ?? 0) || a.name.localeCompare(b.name));
      }
      if (q.sort === "activeProjects") {
        const counts = await activeCounts(ctx, ids.map((i) => i._id));
        ids = [...ids].sort((a, b) => (counts.get(String(b._id)) ?? 0) - (counts.get(String(a._id)) ?? 0) || a.name.localeCompare(b.name));
      }
      total = ids.length;
      const pageIds = ids.slice((q.page - 1) * q.limit, q.page * q.limit).map((i) => i._id);
      const loaded = (await Contractor.find({ _id: { $in: pageIds } }).lean()) as unknown as Doc[];
      const byId = new Map(loaded.map((d) => [String(d._id), d]));
      docs = pageIds.map((i) => byId.get(String(i))).filter((d): d is Doc => Boolean(d));
    } else {
      const sort: Record<string, 1 | -1> = q.sort === "registeredAt" ? { createdAt: -1, _id: 1 } : { name: 1, _id: 1 };
      [docs, total] = await Promise.all([
        Contractor.find(filter).sort(sort).collation({ locale: "en", strength: 2 }).skip((q.page - 1) * q.limit).limit(q.limit).lean() as unknown as Promise<Doc[]>,
        Contractor.countDocuments(filter),
      ]);
    }
    const facetOf = async (field: "status" | "category") => {
      const own = narrow(q, ctx, field);
      if (own.filter === "none") return [];
      const rows = await Contractor.aggregate<{ _id: string | null; n: number }>([{ $match: merge(vis, own.filter, ...extra) }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]).option({ maxTimeMS: 5000 });
      return rows.filter((r) => r._id).map((r) => ({ value: r._id as string, count: r.n })).sort((a, b) => b.count - a.count);
    };
    const [status, category] = await Promise.all([facetOf("status"), facetOf("category")]);
    return { ok: true, data: { rows: await rowsFor(ctx, docs, risk ? { risk } : undefined), total, page: q.page, limit: q.limit, facets: { status, category }, scope: ctx.scope.kind } };
  });
}

export function summary(actor: AuthenticatedActor) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    const vis = await visibleFilter(ctx);
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86_400_000);
    const group = async (field: string) => (await Contractor.aggregate<{ _id: string | null; n: number }>([{ $match: vis }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }])).filter((r) => r._id).map((r) => ({ value: r._id as string, count: r.n }));
    const [byStatus, byCategory, expiring, expired, total, withWork] = await Promise.all([
      group("status"), group("category"),
      Contractor.countDocuments(merge(vis, { status: { $ne: "ARCHIVED" }, certifications: { $elemMatch: { status: "VALID", expiresOn: { $gte: now, $lte: soon } } } })),
      Contractor.countDocuments(merge(vis, { status: { $ne: "ARCHIVED" }, certifications: { $elemMatch: { status: { $ne: "REVOKED" }, expiresOn: { $lt: now } } } })),
      Contractor.countDocuments(vis),
      ContractorAssignment.distinct("contractorId", ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {}),
    ]);
    const withoutEvidence = await Contractor.countDocuments(merge(vis, { _id: { $nin: withWork } }));
    const data: Record<string, unknown> = {
      total, byStatus, byCategory, certifications: { expiring30d: expiring, expired }, withoutEvidence, scope: ctx.scope.kind, basedOn: "contractors and projects you can access",
    };
    if (ctx.viewer.canPerformance) data.performance = { available: Boolean(riskHooks.bands) };
    return { ok: true, data };
  });
}

export function duplicateCheck(actor: AuthenticatedActor, input: { registrationNumber?: string; name?: string; taxId?: string; email?: string; excludeId?: string }) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "contractor.manage");
    return { ok: true, data: await findDuplicates(ctx, input) };
  });
}

async function findDuplicates(ctx: Ctx, input: { registrationNumber?: string; name?: string; taxId?: string; email?: string; excludeId?: string }, session?: mongoose.ClientSession) {
  const exclude = input.excludeId && isId(input.excludeId) ? { _id: { $ne: oid(input.excludeId) } } : {};
  const exactOr: Record<string, unknown>[] = [];
  if (input.registrationNumber) exactOr.push({ registrationNumber: registrationNumberOf(input.registrationNumber) });
  const tax = taxIdKeyOf(input.taxId);
  if (tax) exactOr.push({ taxIdKey: tax });
  const possibleOr: Record<string, unknown>[] = [];
  const nameKey = input.name ? nameKeyOf(input.name) : "";
  if (nameKey) possibleOr.push({ nameKey });
  const emailKey = emailKeyOf(input.email);
  if (emailKey) possibleOr.push({ emailKey });
  const vis = await visibleFilter(ctx, session);
  const fetch = async (or: Record<string, unknown>[]) => {
    if (!or.length) return { visible: [] as Doc[], hidden: 0 };
    const q = Contractor.find({ $and: [exclude, { $or: or }] }).limit(25).lean();
    if (session) q.session(session);
    const all = (await q) as unknown as Doc[];
    const seeable = await Contractor.find({ $and: [vis, { _id: { $in: all.map((a) => a._id) } }] }).select("_id").lean();
    const ok = new Set(seeable.map((s) => String(s._id)));
    return { visible: all.filter((a) => ok.has(String(a._id))), hidden: all.filter((a) => !ok.has(String(a._id))).length };
  };
  const [exact, possible] = await Promise.all([fetch(exactOr), fetch(possibleOr)]);
  const names = await agencyNames([...exact.visible, ...possible.visible].map((d) => d.registeredByAgencyId));
  const now = new Date();
  const view = (d: Doc, reasons: string[]) => ({ ...directoryRow(d, d.registeredByAgencyId ? names.get(String(d.registeredByAgencyId)) ?? null : null, now), reasons });
  const exactIds = new Set(exact.visible.map((d) => String(d._id)));
  return {
    exact: exact.visible.map((d) => view(d, [d.registrationNumber === registrationNumberOf(input.registrationNumber ?? "") ? "registrationNumber" : "taxId"])),
    possible: possible.visible.filter((d) => !exactIds.has(String(d._id))).map((d) => view(d, [nameKey && d.nameKey === nameKey ? "name" : "email"])),
    // A bare boolean: no name, id or agency is revealed for a record the caller cannot see.
    existsOutsideScope: exact.hidden > 0,
  };
}

async function sanitizeDocRef(ctx: Ctx, actor: AuthenticatedActor, ref: { documentId?: string }): Promise<void> {
  if (!ref.documentId) return;
  if (!ctx.has("document.read")) throw new Flow(400, "VALIDATION_ERROR", { field: "documentId" });
  const ok = await readDocument(actor, ref.documentId);
  if (!ok.ok) throw new Flow(400, "VALIDATION_ERROR", { field: "documentId" });
}

const duplicateField = (e: unknown) => mapMongoDuplicateField(e);

export function registerContractor(actor: AuthenticatedActor, input: ContractorCreateInput, requestId: string) {
  return run(async (): Promise<Result<{ id: string }>> => {
    const session = await mongoose.startSession();
    try {
      let createdId = "";
      await session.withTransaction(async () => {
        const ctx = await contextOf(actor, session);
        need(ctx, "contractor.manage");
        let owner: Id;
        if (input.agencyId) {
          const allowed = ctx.scope.kind === "platform" || ctx.viewer.agencyIds.includes(input.agencyId);
          if (!allowed) throw new Flow(403, "FORBIDDEN");
          const ag = await Agency.findById(input.agencyId).select("status").session(session);
          if (!ag || ag.status !== "ACTIVE") throw new Flow(400, "VALIDATION_ERROR", { field: "agencyId" });
          owner = oid(input.agencyId);
        } else {
          if (ctx.scope.kind === "none") throw new Flow(403, "FORBIDDEN");
          owner = oid(actor.agencyId);
          if (ctx.scope.kind === "agencies" && !ctx.viewer.agencyIds.includes(actor.agencyId)) throw new Flow(403, "FORBIDDEN");
        }
        for (const d of input.documentRefs) await sanitizeDocRef(ctx, actor, d);
        const dup = await findDuplicates(ctx, { registrationNumber: input.registrationNumber, name: input.name, taxId: input.business?.taxId, email: input.contact?.email }, session);
        if (dup.exact.length || dup.existsOutsideScope) throw new Flow(409, "CONFLICT", { kind: "exact", exact: dup.exact, existsOutsideScope: dup.existsOutsideScope });
        if (dup.possible.length && !(input.confirmNotDuplicate && input.duplicateAcknowledgement)) throw new Flow(409, "CONFLICT", { kind: "possible", possible: dup.possible, acknowledgementRequired: true });
        const taxIdKey = taxIdKeyOf(input.business?.taxId);
        const emailKey = emailKeyOf(input.contact?.email);
        const created = (await Contractor.create([{
          name: input.name, registrationNumber: input.registrationNumber, registeredByAgencyId: owner, category: input.category,
          specializations: input.specializations, operatingDistricts: input.operatingDistricts,
          ...(input.contact ? { contact: input.contact } : {}), ...(input.business ? { business: input.business } : {}),
          certifications: input.certifications, documentRefs: input.documentRefs.map((d) => ({ ...d, documentId: d.documentId ? oid(d.documentId) : undefined })),
          nameKey: nameKeyOf(input.name), ...(taxIdKey ? { taxIdKey } : {}), ...(emailKey ? { emailKey } : {}),
          status: "ACTIVE", statusChangedAt: new Date(), statusChangedBy: oid(actor.userId),
        }], { session }))[0]!;
        createdId = String(created._id);
        await writeAudit(session, { actor, action: "contractor.registered", contractorId: created._id, agencyId: owner, newValue: { status: "ACTIVE", agencyId: owner, ...(dup.possible.length ? { reason: `duplicate-ack: ${input.duplicateAcknowledgement!.slice(0, 480)}` } : {}) }, requestId });
      });
      return { ok: true, data: { id: createdId } };
    } catch (error) {
      const f = duplicateField(error);
      if (f === "registrationNumber" || f === "taxIdKey") throw new Flow(409, "CONFLICT", { kind: "exact", field: f });
      throw error;
    } finally {
      await session.endSession();
    }
  });
}

export function getContractor(actor: AuthenticatedActor, rawId: string) {
  return run(async (): Promise<Result<unknown>> => {
    if (!isId(rawId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    const doc = (await Contractor.findById(rawId).lean()) as unknown as Doc | null;
    if (!doc) return notFound();
    const assigned = await assignedInScope(ctx, doc._id);
    const names = await agencyNames([doc.registeredByAgencyId]);
    const view = projectContractor(ctx.viewer, doc, { assignedInScope: assigned, agencyName: doc.registeredByAgencyId ? names.get(String(doc.registeredByAgencyId)) ?? null : null });
    if (!view) return notFound();
    const counts = await activeCounts(ctx, [doc._id]);
    const total = await ContractorAssignment.countDocuments({ contractorId: doc._id, ...(ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {}) });
    const out: Record<string, unknown> = { ...view, activeProjects: counts.get(String(doc._id)) ?? 0, totalAssignments: total, gaps: view.tier === "manage" ? profileGaps(doc) : undefined };
    if (view.tier === "manage" && "documentRefs" in view) {
      out.documentRefs = await Promise.all(view.documentRefs.map(async (r) => {
        let documentTitle: string | null = null;
        if (r.documentId && ctx.has("document.read")) { const d = await readDocument(actor, r.documentId); if (d.ok) documentTitle = d.data.fileName; }
        return { ...r, documentTitle };
      }));
    }
    out.can = {
      manage: view.tier === "manage", performance: ctx.viewer.canPerformance, viewValues: ctx.viewer.canManage || ctx.viewer.canBudget,
      assign: ctx.viewer.canManage && view.status === "ACTIVE", platform: ctx.scope.kind === "platform",
    };
    return { ok: true, data: out };
  });
}

/** Loads a record the actor may manage inside the transaction. Invisible = 404, visible but not owned = 403. */
async function loadManaged(ctx: Ctx, rawId: string, session: mongoose.ClientSession) {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const doc = await Contractor.findById(rawId).session(session);
  if (!doc) throw new Flow(404, "NOT_FOUND");
  const assigned = await assignedInScope(ctx, doc._id, session);
  const tier = tierOf(ctx.viewer, doc as unknown as Doc, assigned);
  if (tier === "none") throw new Flow(404, "NOT_FOUND");
  if (tier !== "manage") throw new Flow(403, "FORBIDDEN");
  return doc;
}

const stale = (doc: { updatedAt?: Date }, expected: string) => !doc.updatedAt || doc.updatedAt.getTime() !== new Date(expected).getTime();

export function patchContractor(actor: AuthenticatedActor, rawId: string, input: ContractorPatchInput, requestId: string) {
  return run(async (): Promise<Result<{ id: string }>> => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const ctx = await contextOf(actor, session);
        need(ctx, "contractor.manage");
        const doc = await loadManaged(ctx, rawId, session);
        if (stale(doc as { updatedAt?: Date }, input.expectedUpdatedAt)) throw new Flow(409, "CONFLICT", { kind: "stale" });
        const changed: string[] = [];
        const set: Record<string, unknown> = {};
        const unset: Record<string, 1> = {};
        if (input.name !== undefined && input.name !== doc.name) { set.name = input.name; set.nameKey = nameKeyOf(input.name); changed.push("name"); }
        if (input.category !== undefined && input.category !== doc.category) { set.category = input.category; changed.push("category"); }
        if (input.specializations) { set.specializations = input.specializations; changed.push("specializations"); }
        if (input.operatingDistricts) { set.operatingDistricts = input.operatingDistricts; changed.push("operatingDistricts"); }
        if (input.contact) {
          set.contact = input.contact; changed.push("contact");
          const k = emailKeyOf(input.contact.email);
          if (k) set.emailKey = k; else unset.emailKey = 1;
        }
        if (input.business) {
          set.business = input.business; changed.push("business");
          const k = taxIdKeyOf(input.business.taxId);
          if (k) set.taxIdKey = k; else unset.taxIdKey = 1;
        }
        if (input.registrationNumber && input.registrationNumber !== doc.registrationNumber) {
          if (ctx.scope.kind !== "platform" && (await ContractorAssignment.exists({ contractorId: doc._id }).session(session))) throw new Flow(403, "FORBIDDEN", { kind: "registration_locked" });
          set.registrationNumber = input.registrationNumber; changed.push("registrationNumber");
        }
        if (!changed.length) return;
        const updated = await Contractor.findOneAndUpdate({ _id: doc._id, updatedAt: (doc as { updatedAt?: Date }).updatedAt }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { session, new: true, runValidators: true }).select("_id");
        if (!updated) throw new Flow(409, "CONFLICT", { kind: "stale" });
        await writeAudit(session, { actor, action: "contractor.updated", contractorId: doc._id, agencyId: doc.registeredByAgencyId ?? null, newValue: { reason: `changed: ${changed.join(", ")}`.slice(0, 500) }, requestId });
      });
      return { ok: true, data: { id: rawId } };
    } catch (error) {
      const f = duplicateField(error);
      if (f === "registrationNumber" || f === "taxIdKey") throw new Flow(409, "CONFLICT", { kind: "exact", field: f });
      throw error;
    } finally {
      await session.endSession();
    }
  });
}

type ImpactRow = { assignmentId: string; projectId: string; projectCode: string; projectTitle: string; role: string };

async function activeImpact(ctx: Ctx, contractorId: Id, session: mongoose.ClientSession): Promise<{ impact: ImpactRow[]; total: number }> {
  const rows = await ContractorAssignment.find({ contractorId, status: "ACTIVE" }).session(session).lean();
  const inScope = ctx.scope.kind === "platform" ? rows : rows.filter((r) => ctx.viewer.agencyIds.includes(String(r.agencyId)));
  const projects = await Project.find({ _id: { $in: inScope.map((r) => r.projectId) } }).select("projectCode title").session(session).lean();
  const byId = new Map(projects.map((p) => [String(p._id), p]));
  return { total: rows.length, impact: inScope.map((r) => ({ assignmentId: String(r._id), projectId: String(r.projectId), projectCode: byId.get(String(r.projectId))?.projectCode ?? "", projectTitle: byId.get(String(r.projectId))?.title ?? "", role: r.role })) };
}

export function changeStatus(actor: AuthenticatedActor, rawId: string, input: StatusBody, requestId: string) {
  return run(async (): Promise<Result<{ id: string; status: string }>> => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const ctx = await contextOf(actor, session);
        need(ctx, "contractor.manage");
        const doc = await loadManaged(ctx, rawId, session);
        if (input.expectedUpdatedAt && stale(doc as { updatedAt?: Date }, input.expectedUpdatedAt)) throw new Flow(409, "CONFLICT", { kind: "stale" });
        const from = doc.status;
        if (!statusMoveAllowed(from, input.status)) throw new Flow(409, "CONFLICT", { kind: "illegal_transition", from, to: input.status });
        if (from === "ARCHIVED" && ctx.scope.kind !== "platform") throw new Flow(403, "FORBIDDEN");
        if (reasonRequired(input.status) && !input.reason) throw new Flow(400, "VALIDATION_ERROR", { field: "reason" });
        await lockContractor(session, doc._id);
        if (input.status === "ARCHIVED" || input.status === "SUSPENDED" || input.status === "INACTIVE") {
          const { impact, total } = await activeImpact(ctx, doc._id, session);
          if (total > 0 && input.status === "ARCHIVED") throw new Flow(409, "CONFLICT", { kind: "active_assignments", impact, hiddenCount: total - impact.length });
          if (total > 0 && !input.acknowledgeImpact) throw new Flow(409, "CONFLICT", { kind: "impact_ack_required", impact, hiddenCount: total - impact.length });
        }
        const set: Record<string, unknown> = { status: input.status, statusChangedAt: new Date(), statusChangedBy: oid(actor.userId) };
        const unset: Record<string, 1> = {};
        if (input.reason) set.statusReason = input.reason; else unset.statusReason = 1;
        if (input.status === "ARCHIVED") set.archivedAt = new Date(); else unset.archivedAt = 1;
        const updated = await Contractor.findOneAndUpdate({ _id: doc._id, status: from }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { session, new: true, runValidators: true }).select("_id");
        if (!updated) throw new Flow(409, "CONFLICT", { kind: "stale" });
        await writeAudit(session, { actor, action: "contractor.status_changed", contractorId: doc._id, agencyId: doc.registeredByAgencyId ?? null, oldValue: { status: from }, newValue: { status: input.status, ...(input.reason ? { reason: input.reason } : {}) }, requestId });
      });
      return { ok: true, data: { id: rawId, status: input.status } };
    } finally {
      await session.endSession();
    }
  });
}

type CertInput = { name?: string; issuer?: string; referenceNumber?: string; issuedOn?: Date; expiresOn?: Date };

/** Runs one certification/document-reference mutation through a versioned document save so concurrent writers conflict instead of overwriting. */
async function mutateSub(actor: AuthenticatedActor, rawId: string, action: string, requestId: string, apply: (doc: InstanceType<typeof Contractor>, ctx: Ctx) => Promise<string | undefined>): Promise<Result<{ id: string }>> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ctx = await contextOf(actor, session);
      need(ctx, "contractor.manage");
      const doc = await loadManaged(ctx, rawId, session);
      const reason = await apply(doc, ctx);
      doc.markModified("certifications");
      await doc.save({ session });
      await writeAudit(session, { actor, action, contractorId: doc._id, agencyId: doc.registeredByAgencyId ?? null, ...(reason ? { newValue: { reason: reason.slice(0, 500) } } : {}), requestId });
    });
    return { ok: true, data: { id: rawId } };
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError) throw new Flow(409, "CONFLICT", { kind: "stale" });
    throw error;
  } finally {
    await session.endSession();
  }
}

const subId = (raw: string) => { if (!isId(raw)) throw new Flow(404, "NOT_FOUND"); return raw; };

export const addCertification = (actor: AuthenticatedActor, id: string, input: CertInput & { name: string }, requestId: string) =>
  run(() => mutateSub(actor, id, "contractor.certification_added", requestId, async (doc) => {
    if (doc.certifications.length >= 20) throw new Flow(400, "VALIDATION_ERROR", { field: "certifications" });
    doc.certifications.push({ name: input.name, issuer: input.issuer, referenceNumber: input.referenceNumber, issuedOn: input.issuedOn, expiresOn: input.expiresOn, status: "VALID" } as never);
    return input.name;
  }));

export const updateCertification = (actor: AuthenticatedActor, id: string, certId: string, input: CertInput, requestId: string) =>
  run(() => mutateSub(actor, id, "contractor.certification_updated", requestId, async (doc) => {
    const cert = doc.certifications.id(subId(certId));
    if (!cert) throw new Flow(404, "NOT_FOUND");
    if (cert.status === "REVOKED") throw new Flow(409, "CONFLICT", { kind: "revoked" });
    const next = { issuedOn: input.issuedOn ?? cert.issuedOn, expiresOn: input.expiresOn ?? cert.expiresOn };
    if (next.issuedOn && next.expiresOn && next.expiresOn < next.issuedOn) throw new Flow(400, "VALIDATION_ERROR", { field: "expiresOn" });
    if (input.name !== undefined) cert.name = input.name;
    if (input.issuer !== undefined) cert.issuer = input.issuer;
    if (input.referenceNumber !== undefined) cert.referenceNumber = input.referenceNumber;
    if (input.issuedOn) cert.issuedOn = input.issuedOn;
    if (input.expiresOn) cert.expiresOn = input.expiresOn;
    return cert.name;
  }));

/** Soft delete: the certification stays on record as REVOKED with a reason. */
export const revokeCertification = (actor: AuthenticatedActor, id: string, certId: string, reason: string, requestId: string) =>
  run(() => mutateSub(actor, id, "contractor.certification_revoked", requestId, async (doc) => {
    const cert = doc.certifications.id(subId(certId));
    if (!cert) throw new Flow(404, "NOT_FOUND");
    if (cert.status === "REVOKED") throw new Flow(409, "CONFLICT", { kind: "revoked" });
    cert.status = "REVOKED";
    cert.revokedReason = reason;
    return cert.name;
  }));

export const addDocumentRef = (actor: AuthenticatedActor, id: string, input: { type: string; title: string; referenceNumber?: string; documentId?: string; notes?: string }, requestId: string) =>
  run(() => mutateSub(actor, id, "contractor.document_ref_added", requestId, async (doc, ctx) => {
    if (doc.documentRefs.length >= 30) throw new Flow(400, "VALIDATION_ERROR", { field: "documentRefs" });
    await sanitizeDocRef(ctx, actor, input);
    doc.documentRefs.push({ ...input, documentId: input.documentId ? oid(input.documentId) : undefined } as never);
    doc.markModified("documentRefs");
    return input.type;
  }));

export const removeDocumentRef = (actor: AuthenticatedActor, id: string, refId: string, requestId: string) =>
  run(() => mutateSub(actor, id, "contractor.document_ref_removed", requestId, async (doc) => {
    const ref = doc.documentRefs.id(subId(refId));
    if (!ref) throw new Flow(404, "NOT_FOUND");
    const type = ref.type;
    ref.deleteOne();
    doc.markModified("documentRefs");
    return type;
  }));

