import type { z } from "zod";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_GROUPS, DOCUMENT_FILE_TYPE_TABLE, DOCUMENT_LINK_KEYS } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { AssetConversion } from "../assets/models/asset-conversion.model.js";
import { Flow, run, type Result } from "../contractors/contractor.context.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ProjectExpense } from "../finance/models/project-expense.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { getDocumentStorage } from "../inspections/evidence-storage.js";
import { Project } from "../projects/models/project.model.js";
import { documentAccess, documentReadFilter, type DocViewer } from "./document-access.js";
import { legacyTypeFor, categoryNeedsProject, illegalLink } from "./document-categories.js";
import { emitDocumentEvent } from "./document-events.js";
import { colomboDay, highlightSegments, planText, type TextPlan } from "./document-search.js";
import { capsOf, currentVersionOf, docContext, inTx, isId, iso, loadDocument, needPerm, notifyDocument, oid, resolveLinks, toDtos, validateLinks, writeDocAudit, type DCtx, type DocRow, type Id } from "./document.common.js";
import type { activityQuery, archiveBody, bulkBody, deleteBody, listQuery, patchBody, restoreBody, restrictBody, statusBody } from "./document.schema.js";
import { Document } from "./models/document.model.js";
import { DocumentVersion } from "./models/document-version.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
type Q = z.infer<typeof listQuery>;
type Filter = Record<string, unknown>;

const FAMILY_MIMES: Record<string, string[]> = Object.fromEntries(["pdf", "docx", "xlsx", "csv", "txt", "image"].map((f) => [f, [...new Set(DOCUMENT_FILE_TYPE_TABLE.filter((t) => t.family === f).flatMap((t) => [...t.mimes]))]]));
const monthStart = (now = new Date()): Date => { const c = new Date(now.getTime() + 5.5 * 3_600_000); return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), 1) - 5.5 * 3_600_000); };

/** Builds every user filter as a named clause so facets can drop their own dimension. The permission filter is added by the caller and is never optional. */
function clauses(q: Q, viewer: DocViewer): Record<string, Filter> {
  const c: Record<string, Filter> = {};
  c.origin = { origin: q.origin ?? "DOCTRACE" };
  c.status = { status: { $in: q.status?.length ? q.status : ["ACTIVE"] } };
  const cats = new Set(q.category ?? []);
  if (q.group) for (const d of DOCUMENT_CATEGORIES.filter((x) => x.group === q.group)) cats.add(d.key);
  if (q.group && !DOCUMENT_CATEGORY_GROUPS.includes(q.group as never)) cats.add("__none__");
  if (cats.size) c.category = { category: { $in: [...cats] } };
  if (q.projectId) c.project = { projectId: oid(q.projectId) };
  if (q.agencyId) c.agency = { agencyId: oid(q.agencyId) };
  if (q.contractorId) c.contractor = { contractorId: oid(q.contractorId) };
  if (q.assetId) c.asset = { assetId: oid(q.assetId) };
  if (q.inspectionId) c.inspection = { inspectionId: oid(q.inspectionId) };
  if (q.fileType?.length) c.fileType = { mimeType: { $in: q.fileType.flatMap((f) => FAMILY_MIMES[f] ?? []) } };
  if (q.confidentiality) c.confidentiality = q.confidentiality === "SENSITIVE" ? { confidentiality: "SENSITIVE" } : { confidentiality: { $ne: "SENSITIVE" } };
  if (q.visibility) c.visibility = { visibility: q.visibility };
  if (q.tag) { const tags = q.tag.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 15); if (tags.length) c.tag = { tags: { $all: tags } }; }
  if (q.uploadedBy) c.uploadedBy = { uploadedBy: oid(q.uploadedBy === "me" ? viewer.userId : q.uploadedBy) };
  if (q.from || q.to) c.created = { createdAt: { ...(q.from ? { $gte: colomboDay(q.from, false) } : {}), ...(q.to ? { $lte: colomboDay(q.to, true) } : {}) } };
  if (q.docDateFrom || q.docDateTo) c.docDate = { documentDate: { ...(q.docDateFrom ? { $gte: colomboDay(q.docDateFrom, false) } : {}), ...(q.docDateTo ? { $lte: colomboDay(q.docDateTo, true) } : {}) } };
  if (q.hasFile !== undefined) c.hasFile = q.hasFile ? { currentVersionId: { $exists: true, $ne: null } } : { $or: [{ currentVersionId: { $exists: false } }, { currentVersionId: null }] };
  if (q.aiReady) c.aiReady = { extractedTextStatus: "COMPLETED" };
  if (q.aiStatus) c.aiStatus = { extractedTextStatus: q.aiStatus };
  if (q.expiring) { const now = new Date(); c.expiring = { expiresAt: { $gte: now, $lte: new Date(now.getTime() + 30 * 86_400_000) } }; }
  if (q.thisMonth) c.thisMonth = { createdAt: { $gte: monthStart() } };
  return c;
}
const andOf = (viewer: DocViewer, parts: Filter[]): Filter => ({ $and: [documentReadFilter(viewer), ...parts] });

const SORT: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 }, title: { title: 1, _id: 1 }, size: { sizeBytes: -1, _id: -1 }, updated: { updatedAt: -1, _id: -1 } };

/** Library + search + facets. EVERYTHING (rows, total, facets) runs under the same permission filter inside the query, so counts cannot leak. */
export const listDocuments = (actor: AuthenticatedActor, q: Q) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const c = clauses(q, d.viewer);
  let plan: TextPlan = planText(q.q);
  const build = (omit: string[] = [], p: TextPlan = plan) => andOf(d.viewer, [...Object.entries(c).filter(([k]) => !omit.includes(k)).map(([, v]) => v), ...(p.mode === "none" ? [] : [p.filter])]);
  let filter = build();
  let total = await Document.countDocuments(filter);
  if (total === 0 && plan.mode === "text") { plan = { mode: "prefix", filter: plan.prefix }; filter = build(); total = await Document.countDocuments(filter); }
  const useScore = q.sort === "relevance" && plan.mode === "text";
  const sort = useScore ? ({ score: { $meta: "textScore" }, _id: -1 } as never) : (SORT[q.sort === "relevance" ? "newest" : q.sort] as never);
  const find = Document.find(filter, useScore ? { score: { $meta: "textScore" } } : undefined).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit);
  const group = (omit: string[], field: string, limit = 12) => Document.aggregate<{ _id: unknown; n: number }>([{ $match: build(omit, plan) }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit }]);
  const multiAgency = d.viewer.scopeKind === "platform" || d.viewer.agencyIds.length > 1;
  const [rows, byCategory, byStatus, byType, byProject, byAgency] = await Promise.all([
    find.lean() as unknown as Promise<DocRow[]>, group(["category"], "category", 30), group(["status"], "status", 6), group(["fileType"], "mimeType", 12),
    group(["project"], "projectId", 10), multiAgency ? group(["agency"], "agencyId", 10) : Promise.resolve([]),
  ]);
  const items = await toDtos(d, rows);
  const qs = q.q ?? "";
  const withHighlights = items.map((it) => ({ ...it, highlights: qs ? { title: highlightSegments(it.title, qs), description: highlightSegments(it.description, qs), reference: highlightSegments(it.reference ?? "", qs), tags: it.tags.map((t) => highlightSegments(t, qs)) } : null }));
  const pids = byProject.map((x) => x._id).filter(Boolean) as Id[];
  const aids = byAgency.map((x) => x._id).filter(Boolean) as Id[];
  const [projects, agencies] = await Promise.all([pids.length ? Project.find({ _id: { $in: pids } }).select("title projectCode").lean() : [], aids.length ? Agency.find({ _id: { $in: aids } }).select("name").lean() : []]);
  const familyOf = (mime: string) => Object.entries(FAMILY_MIMES).find(([, m]) => m.includes(mime))?.[0] ?? "other";
  const fileTypes = new Map<string, number>();
  for (const t of byType) fileTypes.set(familyOf(String(t._id)), (fileTypes.get(familyOf(String(t._id))) ?? 0) + t.n);
  return ok({
    items: withHighlights,
    meta: { total, page: q.page, limit: q.limit, pages: Math.max(1, Math.ceil(total / q.limit)), searchMode: plan.mode, metadataSearchOnly: true },
    facets: {
      category: byCategory.filter((x) => x._id).map((x) => ({ key: String(x._id), count: x.n })), status: byStatus.map((x) => ({ key: String(x._id), count: x.n })),
      fileType: [...fileTypes].map(([key, count]) => ({ key, count })),
      project: byProject.filter((x) => x._id).map((x) => { const p = projects.find((r) => String(r._id) === String(x._id)); return { id: String(x._id), label: p ? `${(p as { projectCode?: string }).projectCode ?? ""} ${p.title}`.trim() : "Project", count: x.n }; }),
      agency: byAgency.filter((x) => x._id).map((x) => ({ id: String(x._id), label: agencies.find((a) => String(a._id) === String(x._id))?.name ?? "Agency", count: x.n })),
    },
  });
});

export const documentSummary = (actor: AuthenticatedActor) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const base = { origin: "DOCTRACE" };
  const f = (extra: Filter) => andOf(d.viewer, [base, extra]);
  const now = new Date();
  const six = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [active, month, drafts, expiring, sensitive, awaiting, cat, perMonth, storage] = await Promise.all([
    Document.countDocuments(f({ status: "ACTIVE" })), Document.countDocuments(f({ status: { $in: ["ACTIVE", "SUPERSEDED"] }, createdAt: { $gte: monthStart() } })),
    Document.countDocuments(f({ status: "DRAFT" })), Document.countDocuments(f({ status: "ACTIVE", expiresAt: { $gte: now, $lte: new Date(now.getTime() + 30 * 86_400_000) } })),
    Document.countDocuments(f({ status: "ACTIVE", confidentiality: "SENSITIVE" })), Document.countDocuments(f({ status: "ACTIVE", $or: [{ currentVersionId: { $exists: false } }, { currentVersionId: null }] })),
    Document.aggregate<{ _id: string; n: number }>([{ $match: f({ status: "ACTIVE" }) }, { $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Document.aggregate<{ _id: string; n: number }>([{ $match: f({ createdAt: { $gte: six }, status: { $in: ["ACTIVE", "SUPERSEDED", "DRAFT"] } }) }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Colombo" } }, n: { $sum: 1 } } }]),
    Document.aggregate<{ _id: string; bytes: number }>([{ $match: f({ status: { $in: ["ACTIVE", "SUPERSEDED", "DRAFT"] }, sizeBytes: { $gt: 0 } }) }, { $group: { _id: "$category", bytes: { $sum: "$sizeBytes" } } }, { $sort: { bytes: -1 } }]),
  ]);
  const months: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) { const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); const key = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`; months.push({ month: key, count: perMonth.find((x) => x._id === key)?.n ?? 0 }); }
  return ok({ totalActive: active, addedThisMonth: month, drafts, expiringIn30Days: expiring, sensitive, awaitingFiles: awaiting, byCategory: cat.filter((x) => x._id).map((x) => ({ key: x._id, count: x.n })), uploadsPerMonth: months, storageByCategory: storage.filter((x) => x._id).map((x) => ({ key: x._id, bytes: x.bytes })), storageApproximate: true });
});

export const listCategories = (actor: AuthenticatedActor) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const inspector = d.viewer.roleKey === "INSPECTOR";
  return ok({ groups: DOCUMENT_CATEGORY_GROUPS, categories: DOCUMENT_CATEGORIES.filter((x) => !inspector || x.inspectorVisible).map((x) => ({ key: x.key, group: x.group, icon: x.icon, requiresProject: x.requiresProject, defaultVisibility: x.defaultVisibility, links: x.links, allowsImages: x.allowsImages, sensitiveByDefault: x.sensitiveByDefault })) });
});

/** Who can see a document, computed from the SAME policy function with synthetic role viewers. There is no per-user sharing. */
function audienceOf(row: DocRow): string[] {
  const facts = { agencyId: String(row.agencyId), projectId: row.projectId ? String(row.projectId) : null, ownerId: null, uploadedBy: "00", status: row.status ?? "ACTIVE", visibility: row.visibility, confidentiality: row.confidentiality ?? null, category: row.category ?? null };
  const a = String(row.agencyId);
  const roles: [string, DocViewer][] = [
    ["GOV_ADMIN", { roleKey: "GOV_ADMIN", userId: "1".repeat(24), agencyId: a, scopeKind: "agencies", agencyIds: [a], projectIds: [] }],
    ["AGENCY_OFFICER", { roleKey: "AGENCY_OFFICER", userId: "2".repeat(24), agencyId: a, scopeKind: "agencies", agencyIds: [a], projectIds: [] }],
    ["PROJECT_MANAGER", { roleKey: "PROJECT_MANAGER", userId: "3".repeat(24), agencyId: a, scopeKind: "agencies", agencyIds: [a], projectIds: row.projectId ? [String(row.projectId)] : [] }],
    ["INSPECTOR", { roleKey: "INSPECTOR", userId: "4".repeat(24), agencyId: a, scopeKind: "none", agencyIds: [], projectIds: row.projectId ? [String(row.projectId)] : [] }],
    ["SUPER_ADMIN", { roleKey: "SUPER_ADMIN", userId: "5".repeat(24), agencyId: a, scopeKind: "platform", agencyIds: [], projectIds: [] }],
  ];
  return roles.filter(([, v]) => documentAccess(v, facts)).map(([k]) => k);
}

export const getDocument = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const row = await loadDocument(d, rawId);
  const [dto] = await toDtos(d, [row]);
  const cur = await currentVersionOf(row);
  return ok({ ...dto!, currentVersion: cur ? { versionNo: cur.versionNo, changeNote: cur.changeNote ?? null, activeContent: Boolean(cur.activeContent), uploadedAt: iso((cur as { createdAt?: Date }).createdAt) } : null,
    linkDetails: await resolveLinks(d, row), access: { audience: audienceOf(row), publicMeansAnonymous: false } });
});

async function mustEdit(d: DCtx, row: DocRow) { if (!capsOf(d, row).canEdit) throw new Flow(403, "FORBIDDEN"); }
const unsetKeys = (obj: Record<string, unknown>) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v === null).map(([k]) => [k, ""]));

export const patchDocument = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof patchBody>, requestId: string) => run(async () => {
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    const row = await loadDocument(d, rawId, session);
    await mustEdit(d, row);
    if ((row.version ?? 0) !== input.version) throw new Flow(409, "CONFLICT", { reason: "stale" });
    const category = input.category ?? row.category ?? "OTHER";
    const set: Record<string, unknown> = {};
    const nulls: Record<string, unknown> = {};
    for (const k of ["title", "description", "reference", "language", "documentDate", "expiresAt", "visibility", "tags"] as const) if (input[k] !== undefined) (input[k] === null ? nulls : set)[k] = input[k];
    if (input.category && input.category !== row.category) {
      if (!row.projectId && categoryNeedsProject(input.category)) throw new Flow(400, "VALIDATION_ERROR", { field: "category", reason: "project_required" });
      set.category = input.category; set.documentType = legacyTypeFor(input.category);
    }
    // Links: explicit replacement set, or the existing ones re-checked against the (possibly new) category.
    const existing = Object.fromEntries(DOCUMENT_LINK_KEYS.filter((k) => (row as Record<string, unknown>)[k]).map((k) => [k, String((row as Record<string, unknown>)[k])]));
    const next: Record<string, string | null | undefined> = input.links ? { ...Object.fromEntries(DOCUMENT_LINK_KEYS.map((k) => [k, null])), ...input.links } : existing;
    if (input.links || input.category) {
      const active = Object.fromEntries(Object.entries(next).filter(([, v]) => v));
      if (illegalLink(category, active)) throw new Flow(400, "VALIDATION_ERROR", { field: illegalLink(category, active), reason: "link_not_allowed_for_category" });
      const checked = await validateLinks(category, active, { agencyId: row.agencyId as Id, projectId: (row.projectId as Id | undefined) ?? null }, session);
      for (const k of DOCUMENT_LINK_KEYS) { if (checked[k]) set[k] = checked[k]; else if ((row as Record<string, unknown>)[k]) nulls[k] = null; }
    }
    const conf = row.confidentiality ?? "STANDARD";
    if (conf === "SENSITIVE" && (set.visibility ?? row.visibility) === "PUBLIC") throw new Flow(400, "VALIDATION_ERROR", { field: "visibility", reason: "sensitive_not_public" });
    const upd = await Document.findOneAndUpdate({ _id: row._id, version: row.version ?? 0 }, { $set: set, ...(Object.keys(nulls).length ? { $unset: unsetKeys(nulls) } : {}), $inc: { version: 1 } }, { session, new: true, runValidators: true }).lean();
    if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
    await writeDocAudit(session, { actor, action: "document.updated", documentId: row._id, agencyId: row.agencyId as Id, newValue: { status: row.status ?? "ACTIVE" }, requestId });
    return upd as unknown as DocRow;
  });
  const d2 = await docContext(actor);
  return ok((await toDtos(d2, [out]))[0]!);
});

export const setStatus = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof statusBody>, requestId: string) => run(async () => {
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    const row = await loadDocument(d, rawId, session);
    await mustEdit(d, row);
    if (row.status === "ARCHIVED") throw new Flow(409, "CONFLICT", { reason: "archived" });
    if ((row.version ?? 0) !== input.version) throw new Flow(409, "CONFLICT", { reason: "stale" });
    let status: string = input.status;
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (input.supersededById) {
      if (input.supersededById === String(row._id)) throw new Flow(400, "VALIDATION_ERROR", { field: "supersededById" });
      const other = await loadDocument(d, input.supersededById, session);
      if (String(other.agencyId) !== String(row.agencyId) || other.status === "ARCHIVED") throw new Flow(400, "VALIDATION_ERROR", { field: "supersededById" });
      status = "SUPERSEDED"; set.supersededById = other._id;
    } else unset.supersededById = "";
    if (status === row.status && !input.supersededById) throw new Flow(409, "CONFLICT", { reason: "unchanged" });
    const upd = await Document.findOneAndUpdate({ _id: row._id, version: row.version ?? 0 }, { $set: { ...set, status }, ...(Object.keys(unset).length ? { $unset: unset } : {}), $inc: { version: 1 } }, { session, new: true }).lean();
    if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
    await writeDocAudit(session, { actor, action: "document.status_changed", documentId: row._id, agencyId: row.agencyId as Id, oldValue: { status: row.status ?? "ACTIVE" }, newValue: { status }, requestId });
    return upd as unknown as DocRow;
  });
  return ok((await toDtos(await docContext(actor), [out]))[0]!);
});

async function archiveOne(actor: AuthenticatedActor, rawId: string, reason: string, requestId: string): Promise<DocRow> {
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    const row = await loadDocument(d, rawId, session);
    if (!capsOf(d, row).canArchive) throw new Flow(403, "FORBIDDEN");
    const upd = await Document.findOneAndUpdate({ _id: row._id, status: { $ne: "ARCHIVED" }, version: row.version ?? 0 }, { $set: { status: "ARCHIVED", archivedAt: new Date(), archivedBy: oid(actor.userId), archiveReason: reason }, $inc: { version: 1 } }, { session, new: true }).lean();
    if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
    await writeDocAudit(session, { actor, action: "document.archived", documentId: row._id, agencyId: row.agencyId as Id, oldValue: { status: row.status ?? "ACTIVE" }, newValue: { status: "ARCHIVED", reason }, requestId });
    return upd as unknown as DocRow;
  });
  emitDocumentEvent("document.archived", { documentId: String(out._id), agencyId: String(out.agencyId) });
  await notifyDocument([(out.ownerId ?? out.uploadedBy) as Id], { title: "Document archived", message: `${out.docNo ?? "A document"} was archived.`, documentId: out._id, eventKey: `doca:${out._id}:${out.version}`.slice(0, 50), exclude: [actor.userId] });
  return out;
}
export const archiveDocument = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof archiveBody>, requestId: string) => run(async () => ok((await toDtos(await docContext(actor), [await archiveOne(actor, rawId, input.reason, requestId)]))[0]!));

export const restoreDocument = (actor: AuthenticatedActor, rawId: string, _input: z.infer<typeof restoreBody>, requestId: string) => run(async () => {
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    const row = await loadDocument(d, rawId, session);
    if (row.status !== "ARCHIVED" || !capsOf(d, row).canRestore) throw new Flow(row.status !== "ARCHIVED" ? 409 : 403, row.status !== "ARCHIVED" ? "CONFLICT" : "FORBIDDEN");
    const upd = await Document.findOneAndUpdate({ _id: row._id, status: "ARCHIVED", version: row.version ?? 0 }, { $set: { status: "ACTIVE" }, $unset: { archivedAt: "", archivedBy: "", archiveReason: "" }, $inc: { version: 1 } }, { session, new: true }).lean();
    if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
    await writeDocAudit(session, { actor, action: "document.restored", documentId: row._id, agencyId: row.agencyId as Id, oldValue: { status: "ARCHIVED" }, newValue: { status: "ACTIVE" }, requestId });
    return upd as unknown as DocRow;
  });
  emitDocumentEvent("document.restored", { documentId: String(out._id), agencyId: String(out.agencyId) });
  await notifyDocument([(out.ownerId ?? out.uploadedBy) as Id], { title: "Document restored", message: `${out.docNo ?? "A document"} was restored.`, documentId: out._id, eventKey: `docs:${out._id}:${out.version}`.slice(0, 50), exclude: [actor.userId] });
  return ok((await toDtos(await docContext(actor), [out]))[0]!);
});

/** Incoming references that make a permanent delete unsafe. Only counts/ids are returned. */
async function referencesTo(id: Id): Promise<{ type: string; id: string }[]> {
  const [conv, exp, contr, insp] = await Promise.all([
    AssetConversion.find({ "handover.documentIds": id }).select("_id").limit(5).lean(), ProjectExpense.find({ documentIds: id }).select("_id").limit(5).lean(),
    Contractor.find({ "documentRefs.documentId": id }).select("_id").limit(5).lean(), Inspection.find({ evidence: id }).select("_id").limit(5).lean(),
  ]);
  return [...conv.map((r) => ({ type: "ASSET_CONVERSION", id: String(r._id) })), ...exp.map((r) => ({ type: "EXPENSE", id: String(r._id) })), ...contr.map((r) => ({ type: "CONTRACTOR", id: String(r._id) })), ...insp.map((r) => ({ type: "INSPECTION", id: String(r._id) }))];
}

/** Archive-first, reason, typed confirmation, tombstone. Blocked (409 + referencing records) while anything still points at the document. */
export const deleteDocument = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof deleteBody>, requestId: string) => run(async () => {
  const storage = getDocumentStorage();
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    needPerm(d.ctx, "document.delete");
    const row = await loadDocument(d, rawId, session);
    const caps = capsOf(d, row);
    if (row.status !== "ARCHIVED") throw new Flow(409, "CONFLICT", { reason: "archive_first" });
    if (!caps.canDelete) throw new Flow(403, "FORBIDDEN");
    if (input.confirm.trim().toUpperCase() !== (row.docNo ?? "DELETE")) throw new Flow(400, "VALIDATION_ERROR", { field: "confirm", reason: "confirmation_mismatch" });
    const refs = await referencesTo(row._id);
    if (refs.length) throw new Flow(409, "CONFLICT", { reason: "referenced", references: refs });
    const vers = await DocumentVersion.find({ documentId: row._id }).select("+storageRef versionNo").session(session).lean();
    await DocumentVersion.updateMany({ documentId: row._id }, { $set: { status: "REMOVED", removedAt: new Date(), removedBy: oid(actor.userId), removeReason: input.reason }, $unset: { storageRef: "" } }, { session });
    await Document.updateOne({ _id: row._id }, {
      $set: { deletedAt: new Date(), deletedBy: oid(actor.userId), deleteReason: input.reason, fileName: "deleted", status: "ARCHIVED" },
      $unset: { currentVersionId: "", contentHash: "", description: "", tags: "", reference: "", mimeType: "", sizeBytes: "", documentDate: "", expiresAt: "", contractorId: "", inspectionId: "", paymentId: "", expenseId: "", assetId: "", milestoneId: "", supersededById: "" },
      $inc: { version: 1 } }, { session });
    await writeDocAudit(session, { actor, action: "document.deleted", documentId: row._id, agencyId: row.agencyId as Id, oldValue: { status: "ARCHIVED" }, newValue: { reason: input.reason }, requestId });
    return { row, refs: [...new Set(vers.map((v) => v.storageRef).filter(Boolean))] as string[], versionNos: vers.map((v) => v.versionNo) };
  });
  if (storage) for (const ref of out.refs) await storage.delete(ref).catch(() => undefined); // any miss is swept by db:cleanup:documents
  emitDocumentEvent("document.deleted", { documentId: String(out.row._id), agencyId: String(out.row.agencyId), versionNos: out.versionNos });
  return ok({ deleted: true, docNo: out.row.docNo ?? null });
});

export const restrictDocument = (actor: AuthenticatedActor, rawId: string, input: z.infer<typeof restrictBody>, requestId: string) => run(async () => {
  const out = await inTx(async (session) => {
    const d = await docContext(actor, session);
    needPerm(d.ctx, "document.restrict");
    const row = await loadDocument(d, rawId, session);
    if (!capsOf(d, row).canRestrict) throw new Flow(403, "FORBIDDEN");
    if ((row.version ?? 0) !== input.version) throw new Flow(409, "CONFLICT", { reason: "stale" });
    const conf = input.confidentiality ?? row.confidentiality ?? "STANDARD";
    let ai = input.aiProcessingAllowed ?? row.aiProcessingAllowed ?? true;
    const set: Record<string, unknown> = { confidentiality: conf };
    if (conf === "SENSITIVE") {
      ai = input.aiProcessingAllowed === true && d.viewer.roleKey === "GOV_ADMIN" ? true : false; // only GOV_ADMIN can allow AI on a sensitive document
      if (input.aiProcessingAllowed === true && d.viewer.roleKey !== "GOV_ADMIN") throw new Flow(403, "FORBIDDEN", { reason: "ai_on_sensitive_requires_gov_admin" });
      if (row.visibility === "PUBLIC") set.visibility = "INTERNAL";
    } else if (input.aiProcessingAllowed === true && row.confidentiality === "SENSITIVE" && d.viewer.roleKey !== "GOV_ADMIN") throw new Flow(403, "FORBIDDEN");
    set.aiProcessingAllowed = ai;
    const upd = await Document.findOneAndUpdate({ _id: row._id, version: row.version ?? 0 }, { $set: set, $inc: { version: 1 } }, { session, new: true }).lean();
    if (!upd) throw new Flow(409, "CONFLICT", { reason: "stale" });
    await writeDocAudit(session, { actor, action: "document.restricted", documentId: row._id, agencyId: row.agencyId as Id, oldValue: { status: row.confidentiality ?? "STANDARD" }, newValue: { status: conf, reason: input.reason }, requestId });
    return upd as unknown as DocRow;
  });
  emitDocumentEvent("document.restricted", { documentId: String(out._id), agencyId: String(out.agencyId), confidentiality: out.confidentiality ?? "STANDARD", aiProcessingAllowed: out.aiProcessingAllowed ?? true });
  return ok((await toDtos(await docContext(actor), [out]))[0]!);
});

const ACTION_LABELS = new Set(["document.uploaded", "document.updated", "document.status_changed", "document.version_added", "document.version_restored", "document.downloaded", "document.archived", "document.restored", "document.deleted", "document.restricted", "document.upload_rejected", "document.exported"]);
export const documentActivity = (actor: AuthenticatedActor, rawId: string, q: z.infer<typeof activityQuery>) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const row = await loadDocument(d, rawId);
  if (q.cursor && !isId(q.cursor)) throw new Flow(400, "VALIDATION_ERROR", { field: "cursor" });
  const rows = await AuditLog.find({ resourceType: "DOCUMENT", resourceId: row._id, ...(q.cursor ? { _id: { $lt: oid(q.cursor) } } : {}) }).select("+oldValue +newValue action userId timestamp").sort({ _id: -1 }).limit(q.limit + 1).lean();
  const page = rows.slice(0, q.limit);
  const users = await User.find({ _id: { $in: [...new Set(page.map((r) => String(r.userId)).filter((x) => x !== "undefined"))] } }).select("firstName lastName").lean();
  const names = new Map(users.map((u) => [String(u._id), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]));
  return ok({
    items: page.filter((r) => ACTION_LABELS.has(r.action)).map((r) => ({ id: String(r._id), action: r.action, actor: r.userId ? names.get(String(r.userId)) ?? null : null, at: iso((r as { timestamp?: Date }).timestamp), from: r.oldValue?.status ?? null, to: r.newValue?.status ?? null, reason: r.newValue?.reason ?? null })),
    nextCursor: rows.length > q.limit ? String(page[page.length - 1]!._id) : null,
  });
});

const csvCell = (v: unknown): string => { let s = v === null || v === undefined ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Metadata-only register. Same permission filter as the library, capped at 5000 rows, CSV-injection-safe, audited (row count only). */
export const exportRegister = (actor: AuthenticatedActor, q: Omit<Q, "page" | "limit" | "sort">, requestId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "report.export");
  needPerm(d.ctx, "document.read");
  const c = clauses({ ...q, sort: "newest", page: 1, limit: 50 }, d.viewer);
  const plan = planText(q.q);
  const rows = (await Document.find(andOf(d.viewer, [...Object.values(c), ...(plan.mode === "none" ? [] : [plan.mode === "text" ? plan.prefix : plan.filter])])).sort({ createdAt: -1 }).limit(5000).lean()) as unknown as DocRow[];
  const dtos = await toDtos(d, rows);
  const head = ["docNo", "title", "category", "status", "confidentiality", "visibility", "projectCode", "agency", "owner", "version", "sizeBytes", "reference", "documentDate", "createdAt", "tags"];
  const csv = [head.join(","), ...dtos.map((x) => [x.docNo, x.title, x.category, x.status, x.confidentiality, x.visibility, x.project?.code, x.agencyName, x.ownerName, x.currentVersionNo, x.sizeBytes, x.reference, x.documentDate, x.createdAt, x.tags.join(" ")].map(csvCell).join(","))].join("\r\n");
  await AuditLog.create([{ userId: oid(actor.userId), action: "document.exported", resourceType: "DOCUMENT", resourceId: oid(actor.agencyId), agencyId: oid(actor.agencyId), newValue: { reason: `exported ${dtos.length} rows` }, requestId: /^[A-Za-z0-9_-]+$/.test(requestId) ? requestId.slice(0, 100) : "request" }]);
  return ok({ csv, rows: dtos.length });
});

/** Same service as the library, scoped to one project. The project itself must be visible, otherwise 404. */
export const projectDocuments = (actor: AuthenticatedActor, rawProjectId: string, q: { category?: string; limit: number }) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  if (!isId(rawProjectId)) throw new Flow(404, "NOT_FOUND");
  const visible = d.viewer.roleKey === "INSPECTOR" ? d.viewer.projectIds.includes(rawProjectId) : Boolean(await Project.exists({ $and: [projectReadFilter(d.ctx.scope), { _id: rawProjectId }] }));
  if (!visible) throw new Flow(404, "NOT_FOUND");
  const base = { projectId: oid(rawProjectId) };
  const f = andOf(d.viewer, [{ origin: "DOCTRACE" }, { status: { $in: ["ACTIVE", "SUPERSEDED"] } }, base]);
  const [rows, counts, total] = await Promise.all([
    Document.find({ $and: [f, ...(q.category ? [{ category: q.category }] : [])] }).sort({ createdAt: -1, _id: -1 }).limit(q.limit).lean() as unknown as Promise<DocRow[]>,
    Document.aggregate<{ _id: string; n: number }>([{ $match: f }, { $group: { _id: "$category", n: { $sum: 1 } } }]), Document.countDocuments(f),
  ]);
  const caps = await Promise.all([Promise.resolve(d.ctx.has("document.upload") && ["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "SUPER_ADMIN"].includes(d.viewer.roleKey))]);
  return ok({ items: await toDtos(d, rows), total, byCategory: counts.map((x) => ({ key: x._id, count: x.n })), canUpload: caps[0] });
});

/** Bulk archive / add tag / change category. Each item goes through the same checks as the single-item call; the result lists every outcome. */
export const bulkAction = (actor: AuthenticatedActor, input: z.infer<typeof bulkBody>, requestId: string) => run(async () => {
  if (input.action === "ARCHIVE" && !input.reason) throw new Flow(400, "VALIDATION_ERROR", { field: "reason" });
  if (input.action === "ADD_TAG" && !input.tag) throw new Flow(400, "VALIDATION_ERROR", { field: "tag" });
  if (input.action === "CHANGE_CATEGORY" && !input.category) throw new Flow(400, "VALIDATION_ERROR", { field: "category" });
  const results: { id: string; ok: boolean; code?: string }[] = [];
  for (const id of [...new Set(input.ids)]) {
    try {
      if (input.action === "ARCHIVE") await archiveOne(actor, id, input.reason!, requestId);
      else {
        const d = await docContext(actor);
        const row = await loadDocument(d, id);
        const patch = input.action === "ADD_TAG" ? { version: row.version ?? 0, tags: [...new Set([...(row.tags ?? []), input.tag!])] } : { version: row.version ?? 0, category: input.category! };
        const r = await patchDocument(actor, id, patch as z.infer<typeof patchBody>, requestId);
        if (!r.ok) throw new Flow(r.status, r.code);
      }
      results.push({ id, ok: true });
    } catch (e) { results.push({ id, ok: false, code: e instanceof Flow ? (e.status === 404 ? "NOT_FOUND" : e.code) : "SERVICE_UNAVAILABLE" }); }
  }
  return ok({ results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
