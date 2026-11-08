import mongoose, { type ClientSession } from "mongoose";
import { categoryDef, DOCUMENT_LINK_KEYS, LEGACY_TYPE_TO_CATEGORY, type DocumentLinkKey } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { contextOf, Flow, type Ctx } from "../contractors/contractor.context.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ProjectExpense } from "../finance/models/project-expense.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, projectWriteFilter } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { Project } from "../projects/models/project.model.js";
import { documentCaps, documentReadFilter, loadViewer, type DocCaps, type DocViewer } from "./document-access.js";
import { illegalLink, type LinkInput } from "./document-categories.js";
import { Document } from "./models/document.model.js";
import { DocumentVersion } from "./models/document-version.model.js";

export type Id = mongoose.Types.ObjectId;
export const oid = (v: string) => new mongoose.Types.ObjectId(v);
export const isId = (v: string) => /^[a-f0-9]{24}$/i.test(v);
export type DocRow = mongoose.InferSchemaType<typeof Document.schema> & { _id: Id };

export type DCtx = { ctx: Ctx; viewer: DocViewer };
/** Re-reads the live user and role, resolves scope and the document viewer. Called again inside write transactions. */
export async function docContext(actor: AuthenticatedActor, session?: ClientSession): Promise<DCtx> {
  const ctx = await contextOf(actor, session);
  return { ctx, viewer: await loadViewer(actor, ctx.scope) };
}

export function needPerm(ctx: Ctx, permission: Parameters<Ctx["has"]>[0]): void {
  if (!ctx.has(permission)) throw new Flow(403, "FORBIDDEN");
}

/** Out of scope => plain 404, never 403 (no existence leak). DocTrace rows only unless `evidence` is allowed (read paths). */
export async function loadDocument(d: DCtx, rawId: string, session?: ClientSession): Promise<DocRow> {
  if (!isId(rawId)) throw new Flow(404, "NOT_FOUND");
  const q = Document.findOne({ $and: [documentReadFilter(d.viewer), { _id: rawId }] });
  if (session) q.session(session);
  const row = (await q.lean()) as DocRow | null;
  if (!row) throw new Flow(404, "NOT_FOUND");
  return row;
}

export const capsOf = (d: DCtx, row: DocRow): DocCaps => documentCaps(d.viewer, factsOf(row), (p) => d.ctx.has(p as never));
export const factsOf = (r: DocRow) => ({
  agencyId: r.agencyId ? String(r.agencyId) : null, projectId: r.projectId ? String(r.projectId) : null, ownerId: r.ownerId ? String(r.ownerId) : null,
  uploadedBy: String(r.uploadedBy), status: r.status ?? null, visibility: r.visibility, confidentiality: r.confidentiality ?? null, category: r.category ?? null, origin: r.origin ?? "DOCTRACE", deletedAt: r.deletedAt ?? null,
});

export const inTx = async <T>(work: (s: ClientSession) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await work(session); });
    return out;
  } finally { await session.endSession(); }
};

export const auditRid = (requestId: string): string => { const t = requestId.trim().slice(0, 100); return /^[A-Za-z0-9_-]+$/.test(t) ? t : "request"; };

type Snapshot = { status?: string; reason?: string; agencyId?: Id | null; projectId?: Id | null };
/** Allowlisted snapshot keys only. File names, titles and content never enter an audit row. */
export async function writeDocAudit(session: ClientSession | undefined, i: { actor: AuthenticatedActor; action: string; documentId: Id; agencyId?: Id | null; oldValue?: Snapshot; newValue?: Snapshot; requestId: string }): Promise<void> {
  const clean = (s?: Snapshot) => (s ? Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)) : undefined);
  await AuditLog.create([{
    userId: oid(i.actor.userId), action: i.action, resourceType: "DOCUMENT", resourceId: i.documentId, ...(i.agencyId ? { agencyId: i.agencyId } : {}),
    oldValue: clean(i.oldValue), newValue: clean(i.newValue), requestId: auditRid(i.requestId),
  }], session ? { session } : {});
}

/** Active, verified holders of a permission in the given agencies. Bounded. */
async function holders(agencyIds: Id[], permission: string): Promise<Id[]> {
  const roles = await Role.find({ isActive: true, permissions: permission }).select("_id").lean();
  return (await User.find({ roleId: { $in: roles.map((r) => r._id) }, agencyId: { $in: agencyIds }, status: "ACTIVE", emailVerified: true }).select("_id").limit(60).lean()).map((u) => u._id as Id);
}

/** Best-effort in-app notices after commit. Deduplicated per user + event key. A failure never rolls back or hides state. */
export async function notifyDocument(userIds: (Id | null | undefined)[], n: { title: string; message: string; documentId: Id; eventKey: string; exclude?: string[] }): Promise<void> {
  try {
    const unique = [...new Map(userIds.filter((u): u is Id => Boolean(u)).filter((u) => !n.exclude?.includes(String(u))).map((u) => [String(u), u])).values()];
    if (!unique.length) return;
    await Notification.insertMany(unique.map((userId) => ({ userId, type: "SYSTEM", title: n.title.slice(0, 200), message: n.message.slice(0, 2000), resourceType: "DOCUMENT", resourceId: n.documentId, isRead: false, eventKey: `${n.eventKey}:${userId}`.slice(0, 80) })), { ordered: false }).catch(() => undefined);
  } catch { /* best effort */ }
}
export async function projectManagerOf(projectId: Id | null | undefined): Promise<Id | null> {
  if (!projectId) return null;
  return ((await Project.findById(projectId).select("managerId").lean())?.managerId as Id | undefined) ?? null;
}
export { holders as holdersOf };

/**
 * Resolves the owning agency and checks write scope for a new or moved document. The agency is NEVER taken from client input:
 * with a project it is the project's agency (projectWriteFilter must admit it), otherwise it is the actor's own agency.
 */
export async function resolveOwnership(d: DCtx, actor: AuthenticatedActor, category: string, rawProjectId: string | undefined, session?: ClientSession): Promise<{ agencyId: Id; projectId: Id | null }> {
  const def = categoryDef(category);
  if (!def) throw new Flow(400, "VALIDATION_ERROR", { field: "category" });
  if (!["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "SUPER_ADMIN"].includes(actor.roleKey)) throw new Flow(403, "FORBIDDEN");
  if (rawProjectId) {
    if (!isId(rawProjectId)) throw new Flow(404, "NOT_FOUND");
    const rq = Project.findOne({ $and: [projectReadFilter(d.ctx.scope), { _id: rawProjectId }] }).select("agencyId");
    if (session) rq.session(session);
    const project = await rq.lean();
    if (!project) throw new Flow(404, "NOT_FOUND");
    const wq = Project.exists({ $and: [projectWriteFilter(actor, d.ctx.scope), { _id: rawProjectId }] });
    if (session) wq.session(session);
    if (!(await wq)) throw new Flow(403, "FORBIDDEN");
    return { agencyId: project.agencyId as Id, projectId: project._id as Id };
  }
  if (def.requiresProject) throw new Flow(400, "VALIDATION_ERROR", { field: "projectId", reason: "project_required" });
  if (!mongoose.isValidObjectId(actor.agencyId)) throw new Flow(403, "FORBIDDEN");
  return { agencyId: oid(actor.agencyId), projectId: null };
}

/** Link rules (category table) + same-project / same-agency checks. Returns the cleaned set of links to persist. */
export async function validateLinks(category: string, links: LinkInput, owner: { agencyId: Id; projectId: Id | null }, session?: ClientSession): Promise<Partial<Record<DocumentLinkKey, Id>>> {
  const present = Object.fromEntries(Object.entries(links).filter(([, v]) => Boolean(v)));
  if (!Object.keys(present).length) return {};
  if (illegalLink(category, present)) throw new Flow(400, "VALIDATION_ERROR", { field: illegalLink(category, present), reason: "link_not_allowed_for_category" });
  if (!owner.projectId) throw new Flow(400, "VALIDATION_ERROR", { reason: "links_need_project" });
  const p = owner.projectId;
  const out: Partial<Record<DocumentLinkKey, Id>> = {};
  const withSession = <T extends { session: (s: ClientSession) => T }>(q: T) => (session ? q.session(session) : q);
  for (const key of DOCUMENT_LINK_KEYS) {
    const raw = present[key] as string | undefined;
    if (!raw) continue;
    if (!isId(raw)) throw new Flow(400, "VALIDATION_ERROR", { field: key });
    const id = oid(raw);
    let ok = false;
    if (key === "contractorId") ok = Boolean(await withSession(ContractorAssignment.exists({ projectId: p, contractorId: id })));
    else if (key === "inspectionId") ok = Boolean(await withSession(Inspection.exists({ _id: id, projectId: p })));
    else if (key === "paymentId") ok = Boolean(await withSession(ProjectPayment.exists({ _id: id, projectId: p })));
    else if (key === "expenseId") ok = Boolean(await withSession(ProjectExpense.exists({ _id: id, projectId: p })));
    else if (key === "milestoneId") ok = Boolean(await withSession(Milestone.exists({ _id: id, projectId: p })));
    else if (key === "assetId") ok = Boolean(await withSession(Asset.exists({ _id: id, $or: [{ sourceProjectId: p }, { agencyId: owner.agencyId }] })));
    if (!ok) throw new Flow(400, "VALIDATION_ERROR", { field: key, reason: "link_not_in_project" });
    out[key] = id;
  }
  return out;
}

/** Details-page link resolution with per-link permission tiering: the label is only returned when the viewer may read that entity type. */
export async function resolveLinks(d: DCtx, row: DocRow): Promise<{ type: DocumentLinkKey; id: string; label: string | null; accessible: boolean }[]> {
  const out: { type: DocumentLinkKey; id: string; label: string | null; accessible: boolean }[] = [];
  for (const key of DOCUMENT_LINK_KEYS) {
    const id = (row as Record<string, unknown>)[key] as Id | undefined;
    if (!id) continue;
    let label: string | null = null;
    let accessible = false;
    try {
      if (key === "contractorId" && d.ctx.has("contractor.read")) { label = (await Contractor.findById(id).select("name").lean())?.name ?? null; accessible = Boolean(label); }
      else if (key === "inspectionId" && d.ctx.has("inspection.read")) { label = (await Inspection.findById(id).select("inspectionNo").lean())?.inspectionNo ?? null; accessible = Boolean(label); }
      else if (key === "paymentId" && d.ctx.has("finance.budget.read")) { label = (await ProjectPayment.findById(id).select("paymentNo").lean() as { paymentNo?: string } | null)?.paymentNo ?? null; accessible = Boolean(label); }
      else if (key === "expenseId" && d.ctx.has("finance.budget.read")) { label = (await ProjectExpense.findById(id).select("expenseNo").lean() as { expenseNo?: string } | null)?.expenseNo ?? null; accessible = Boolean(label); }
      else if (key === "assetId" && d.ctx.has("asset.read")) { label = (await Asset.findById(id).select("assetNo").lean())?.assetNo ?? null; accessible = Boolean(label); }
      else if (key === "milestoneId" && d.ctx.has("milestone.read")) { label = (await Milestone.findById(id).select("title").lean())?.title ?? null; accessible = Boolean(label); }
    } catch { /* leave unresolved */ }
    out.push({ type: key, id: String(id), label, accessible });
  }
  return out;
}

export const iso = (x: Date | null | undefined): string | null => (x ? x.toISOString() : null);

/** Row -> allowlisted wire shape. Storage fields do not exist on this path (never selected, never copied). */
export async function toDtos(d: DCtx, rows: DocRow[]) {
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean).map(String))];
  const agencyIds = [...new Set(rows.map((r) => r.agencyId).filter(Boolean).map(String))];
  const userIds = [...new Set(rows.map((r) => String(r.ownerId ?? r.uploadedBy)))];
  const [projects, agencies, users] = await Promise.all([
    projectIds.length ? Project.find({ _id: { $in: projectIds } }).select("title projectCode").lean() : [],
    agencyIds.length ? Agency.find({ _id: { $in: agencyIds } }).select("name").lean() : [],
    User.find({ _id: { $in: userIds } }).select("firstName lastName").lean(),
  ]);
  const pm = new Map(projects.map((p) => [String(p._id), p]));
  const am = new Map(agencies.map((a) => [String(a._id), a.name as string]));
  const um = new Map(users.map((u) => [String(u._id), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]));
  return rows.map((r) => {
    const category = r.category ?? LEGACY_TYPE_TO_CATEGORY[r.documentType as keyof typeof LEGACY_TYPE_TO_CATEGORY] ?? "OTHER";
    const caps = capsOf(d, r);
    const project = r.projectId ? pm.get(String(r.projectId)) : undefined;
    return {
      id: String(r._id), docNo: r.docNo ?? null, title: r.title ?? r.fileName, description: r.description ?? null, category, group: categoryDef(category)?.group ?? "GOVERNMENT",
      status: r.status ?? "ACTIVE", visibility: r.visibility, confidentiality: r.confidentiality ?? "STANDARD", origin: r.origin ?? "DOCTRACE",
      projectId: r.projectId ? String(r.projectId) : null, project: project ? { id: String(project._id), title: project.title as string, code: (project as { projectCode?: string }).projectCode ?? null } : null,
      agencyId: r.agencyId ? String(r.agencyId) : null, agencyName: r.agencyId ? am.get(String(r.agencyId)) ?? null : null,
      ownerId: String(r.ownerId ?? r.uploadedBy), ownerName: um.get(String(r.ownerId ?? r.uploadedBy)) ?? null,
      fileName: r.fileName, mimeType: r.mimeType ?? null, sizeBytes: r.sizeBytes ?? null, contentHash: r.contentHash ?? null,
      currentVersionNo: r.currentVersionNo ?? null, fileAvailable: Boolean(r.currentVersionId), tags: r.tags ?? [],
      documentDate: iso(r.documentDate), reference: r.reference ?? null, language: r.language ?? null, expiresAt: iso(r.expiresAt),
      links: Object.fromEntries(DOCUMENT_LINK_KEYS.filter((k) => (r as Record<string, unknown>)[k]).map((k) => [k, String((r as Record<string, unknown>)[k])])),
      ai: { extractedTextStatus: r.extractedTextStatus, allowed: r.aiProcessingAllowed ?? true, eligibleType: r.aiEligibleType ?? false, sensitive: r.confidentiality === "SENSITIVE", errorCode: r.aiIndex?.errorCode ?? null, warningCount: r.aiIndex?.warnings?.length ?? 0, truncated: Boolean(r.aiIndex?.truncated), indexedAt: iso(r.aiIndex?.indexedAt) },
      version: r.version ?? 0, createdAt: iso((r as { createdAt?: Date }).createdAt), updatedAt: iso((r as { updatedAt?: Date }).updatedAt), archivedAt: iso(r.archivedAt), deleted: Boolean(r.deletedAt),
      permissions: caps,
    };
  });
}

export async function currentVersionOf(row: DocRow, session?: ClientSession) {
  if (!row.currentVersionId) return null;
  const q = DocumentVersion.findById(row.currentVersionId).select("versionNo fileName mimeType sizeBytes contentHash uploadedBy changeNote activeContent status createdAt");
  if (session) q.session(session);
  return q.lean();
}
