import mongoose from "mongoose";
import { DOCUMENT_CATEGORIES } from "@infraos/shared-types";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import type { ResourceScope } from "../identity/authorization/resource-scope.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Project } from "../projects/models/project.model.js";

type Id = mongoose.Types.ObjectId;
const NONE = { _id: { $in: [] as Id[] } };
const oid = (v: string) => new mongoose.Types.ObjectId(v);

/**
 * Everything the policy needs about the caller, resolved once per request from the live user/role (never from the token alone).
 * `PUBLIC` visibility NEVER means anonymous access: it only widens visibility among authenticated users who are already inside scope.
 */
export type DocViewer = {
  roleKey: string;
  userId: string;
  agencyId: string;
  scopeKind: ResourceScope["kind"];
  /** Agencies in scope (own + descendants for GOV_ADMIN, own for officers/managers). Empty for platform/none. */
  agencyIds: string[];
  /** PROJECT_MANAGER: projects they manage. INSPECTOR: projects they hold a live inspection for. */
  projectIds: string[];
};

export type DocFacts = {
  agencyId?: string | null; projectId?: string | null; ownerId?: string | null; uploadedBy?: string | null;
  status?: string | null; visibility?: string | null; confidentiality?: string | null; category?: string | null; deletedAt?: Date | null;
};

const INSPECTOR_CATEGORIES = DOCUMENT_CATEGORIES.filter((c) => c.inspectorVisible).map((c) => c.key);
const STAFF_ADMIN = ["GOV_ADMIN", "AGENCY_OFFICER"];

export async function loadViewer(actor: AuthenticatedActor, scope: ResourceScope): Promise<DocViewer> {
  let projectIds: string[] = [];
  if (actor.roleKey === "PROJECT_MANAGER" && mongoose.isValidObjectId(actor.agencyId)) {
    projectIds = (await Project.find({ agencyId: oid(actor.agencyId), managerId: oid(actor.userId) }).select("_id").limit(2000).lean()).map((p) => String(p._id));
  } else if (actor.roleKey === "INSPECTOR") {
    projectIds = (await Inspection.distinct("projectId", { inspectorId: oid(actor.userId), status: { $ne: "CANCELLED" } })).map(String);
  }
  return { roleKey: actor.roleKey, userId: actor.userId, agencyId: actor.agencyId, scopeKind: scope.kind, agencyIds: scope.kind === "agencies" ? scope.agencyIds.map(String) : [], projectIds };
}

const isOwner = (v: DocViewer, d: DocFacts) => Boolean(d.ownerId && String(d.ownerId) === v.userId) || (!d.ownerId && Boolean(d.uploadedBy && String(d.uploadedBy) === v.userId));

/** Pure read decision. MUST agree with `documentReadFilter` (asserted against each other in tests over a role x agency x visibility x confidentiality x status matrix). */
export function documentAccess(v: DocViewer, d: DocFacts): boolean {
  if (d.deletedAt) return false;
  if (!d.status || !["ACTIVE", "SUPERSEDED", "DRAFT", "ARCHIVED"].includes(d.status)) return false;
  const agency = d.agencyId ? String(d.agencyId) : null;
  const project = d.projectId ? String(d.projectId) : null;
  const owner = isOwner(v, d);
  let inScope = false;
  switch (v.roleKey) {
    case "SUPER_ADMIN": inScope = v.scopeKind === "platform" && agency !== null; break;
    case "GOV_ADMIN": inScope = agency !== null && v.agencyIds.includes(agency); break;
    case "AGENCY_OFFICER": inScope = agency !== null && agency === v.agencyId && v.scopeKind === "agencies"; break;
    case "PROJECT_MANAGER": {
      if (agency === null || agency !== v.agencyId || v.scopeKind !== "agencies") break;
      inScope = (project !== null && v.projectIds.includes(project)) || (project === null && (d.visibility === "PROJECT_TEAM" || d.visibility === "PUBLIC")) || owner;
      break;
    }
    case "INSPECTOR":
      inScope = project !== null && v.projectIds.includes(project) && (d.visibility === "PROJECT_TEAM" || d.visibility === "PUBLIC")
        && d.confidentiality !== "SENSITIVE" && INSPECTOR_CATEGORIES.includes(d.category ?? "") && (d.status === "ACTIVE" || d.status === "SUPERSEDED");
      break;
    default: inScope = false;
  }
  if (!inScope) return false;
  if ((d.status === "DRAFT" || d.status === "ARCHIVED") && !(owner || STAFF_ADMIN.includes(v.roleKey))) return false;
  if (d.confidentiality === "SENSITIVE") {
    const pmOfProject = v.roleKey === "PROJECT_MANAGER" && project !== null && v.projectIds.includes(project);
    if (!(owner || STAFF_ADMIN.includes(v.roleKey) || pmOfProject)) return false;
  }
  return true;
}

/** Mongo equivalent of `documentAccess`. Applied inside every query, counts and facets included; nothing is filtered after the fact. */
export function documentReadFilter(v: DocViewer): Record<string, unknown> {
  if (!mongoose.isValidObjectId(v.userId)) return NONE;
  const me = oid(v.userId);
  const own = mongoose.isValidObjectId(v.agencyId) ? oid(v.agencyId) : null;
  const ownerIsMe = { $or: [{ ownerId: me }, { ownerId: { $exists: false }, uploadedBy: me }] };
  let base: Record<string, unknown>;
  switch (v.roleKey) {
    case "SUPER_ADMIN": base = v.scopeKind === "platform" ? { agencyId: { $exists: true, $ne: null } } : NONE; break;
    case "GOV_ADMIN": base = v.agencyIds.length ? { agencyId: { $in: v.agencyIds.map(oid) } } : NONE; break;
    case "AGENCY_OFFICER": base = own && v.scopeKind === "agencies" ? { agencyId: own } : NONE; break;
    case "PROJECT_MANAGER": {
      if (!own || v.scopeKind !== "agencies") return NONE;
      base = { agencyId: own, $or: [
        { projectId: { $in: v.projectIds.map(oid) } },
        { projectId: { $exists: false }, visibility: { $in: ["PROJECT_TEAM", "PUBLIC"] } },
        { projectId: null, visibility: { $in: ["PROJECT_TEAM", "PUBLIC"] } },
        ownerIsMe,
      ] };
      break;
    }
    case "INSPECTOR":
      base = { projectId: { $in: v.projectIds.map(oid) }, visibility: { $in: ["PROJECT_TEAM", "PUBLIC"] }, confidentiality: { $ne: "SENSITIVE" }, category: { $in: INSPECTOR_CATEGORIES }, status: { $in: ["ACTIVE", "SUPERSEDED"] } };
      break;
    default: return NONE;
  }
  const and: Record<string, unknown>[] = [base, { deletedAt: { $exists: false } }, { status: { $in: ["ACTIVE", "SUPERSEDED", "DRAFT", "ARCHIVED"] } }];
  if (!STAFF_ADMIN.includes(v.roleKey)) and.push({ $or: [{ status: { $in: ["ACTIVE", "SUPERSEDED"] } }, ownerIsMe] });
  if (!STAFF_ADMIN.includes(v.roleKey)) {
    const sensitiveOk: Record<string, unknown>[] = [{ confidentiality: { $ne: "SENSITIVE" } }, ownerIsMe];
    if (v.roleKey === "PROJECT_MANAGER") sensitiveOk.push({ projectId: { $in: v.projectIds.map(oid) } });
    and.push({ $or: sensitiveOk });
  }
  return { $and: and };
}

/** Who may change a document. Edit requires read access first (a plain 404 otherwise); this decides 403 vs success. */
export type DocCaps = { canEdit: boolean; canReplace: boolean; canArchive: boolean; canRestore: boolean; canDelete: boolean; canRestrict: boolean; canDownload: boolean };

export function documentCaps(v: DocViewer, d: DocFacts & { origin?: string | null }, has: (p: string) => boolean): DocCaps {
  const none = { canEdit: false, canReplace: false, canArchive: false, canRestore: false, canDelete: false, canRestrict: false, canDownload: false };
  if (!documentAccess(v, d)) return none;
  const agency = d.agencyId ? String(d.agencyId) : null;
  const project = d.projectId ? String(d.projectId) : null;
  const doctrace = (d.origin ?? "DOCTRACE") === "DOCTRACE";
  const owner = isOwner(v, d);
  const live = d.status === "DRAFT" || d.status === "ACTIVE";
  let writeScope = false;
  if (v.roleKey === "GOV_ADMIN") writeScope = agency !== null && v.agencyIds.includes(agency);
  else if (v.roleKey === "AGENCY_OFFICER") writeScope = agency !== null && agency === v.agencyId;
  else if (v.roleKey === "PROJECT_MANAGER") writeScope = agency === v.agencyId && project !== null && v.projectIds.includes(project);
  const adminWrite = doctrace && has("document.update") && writeScope && d.status !== "ARCHIVED";
  const ownEdit = doctrace && owner && has("document.upload") && live;
  const canEdit = adminWrite || ownEdit;
  const governance = doctrace && has("document.delete") && (v.roleKey === "GOV_ADMIN" ? writeScope : v.roleKey === "SUPER_ADMIN" && agency !== null);
  return {
    canEdit,
    canReplace: canEdit && has("document.upload"),
    canArchive: doctrace && d.status !== "ARCHIVED" && (canEdit || governance),
    canRestore: doctrace && d.status === "ARCHIVED" && (owner || governance || (STAFF_ADMIN.includes(v.roleKey) && has("document.update") && writeScope)),
    canDelete: governance && d.status === "ARCHIVED",
    canRestrict: doctrace && has("document.restrict") && writeScope && (v.roleKey === "GOV_ADMIN" || v.roleKey === "AGENCY_OFFICER"),
    canDownload: has("document.download"),
  };
}
