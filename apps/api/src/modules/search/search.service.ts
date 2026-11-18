import mongoose from "mongoose";
import { escapeSearchRegex } from "../../shared/http/list-query.js";
import { Asset } from "../assets/models/asset.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { documentReadFilter, loadViewer } from "../documents/document-access.js";
import { Document } from "../documents/models/document.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { CitizenIssue } from "../issues/models/citizen-issue.model.js";
import { Project } from "../projects/models/project.model.js";

export type GlobalSearchResultItem = {
  id: string;
  kind: "PROJECT" | "ISSUE" | "CONTRACTOR" | "DOCUMENT" | "ASSET";
  code: string | null;
  title: string;
  subtitle: string;
  status: string | null;
  href: string;
};

export async function runGlobalSearch(
  actor: AuthenticatedActor,
  rawQuery: string,
  perCategoryLimit = 5,
) {
  const q = rawQuery.trim();
  if (q.length < 2) {
    return {
      query: q,
      projects: [] as GlobalSearchResultItem[],
      issues: [] as GlobalSearchResultItem[],
      contractors: [] as GlobalSearchResultItem[],
      documents: [] as GlobalSearchResultItem[],
      assets: [] as GlobalSearchResultItem[],
    };
  }

  const limit = Math.min(20, Math.max(1, perCategoryLimit));
  const rx = new RegExp(escapeSearchRegex(q), "i");
  const [scope, roleDoc] = await Promise.all([
    resolveResourceScope(actor),
    mongoose.isValidObjectId(actor.roleId)
      ? Role.findById(actor.roleId).select("permissions isActive").lean()
      : Promise.resolve(null),
  ]);

  const granted =
    roleDoc && roleDoc.isActive !== false && Array.isArray(roleDoc.permissions)
      ? roleDoc.permissions
      : [];
  const isSuper = actor.roleKey === "SUPER_ADMIN";
  const canReadProjects = isSuper || hasPermission(granted, "project.read");
  const canReadIssues = isSuper || hasPermission(granted, "citizen_issue.read");
  const canReadContractors = isSuper || hasPermission(granted, "contractor.read");
  const canReadDocuments = isSuper || hasPermission(granted, "document.read");
  const canReadAssets = isSuper || hasPermission(granted, "asset.read");

  const projScope = projectReadFilter(scope);
  const agencyFilter =
    scope.kind === "platform"
      ? {}
      : scope.kind === "none"
        ? { _id: { $in: [] } }
        : { agencyId: { $in: scope.agencyIds } };

  const contractorFilter =
    scope.kind === "platform"
      ? {}
      : scope.kind === "none"
        ? { _id: { $in: [] } }
        : { $or: [{ registeredByAgencyId: { $in: scope.agencyIds } }, { registeredByAgencyId: null }] };

  const issueFilter =
    scope.kind === "platform"
      ? {}
      : scope.kind === "none"
        ? { _id: { $in: [] } }
        : { assignedAgency: { $in: scope.agencyIds } };

  const docScope = canReadDocuments
    ? documentReadFilter(await loadViewer(actor, scope))
    : { _id: { $in: [] } };

  const [projects, issues, contractors, documents, assets] = await Promise.all([
    canReadProjects
      ? Project.find({
          $and: [projScope, { $or: [{ title: rx }, { projectCode: rx }, { "location.district": rx }] }],
        })
          .select("_id projectCode title status location.district")
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    canReadIssues
      ? CitizenIssue.find({
          $and: [issueFilter, { $or: [{ referenceNo: rx }, { title: rx }, { "location.district": rx }] }],
        })
          .select("_id referenceNo title category status location.district")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    canReadContractors
      ? Contractor.find({
          $and: [contractorFilter, { $or: [{ name: rx }, { registrationNumber: rx }] }],
        })
          .select("_id registrationNumber name category status")
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    canReadDocuments
      ? Document.find({
          $and: [docScope, { $or: [{ title: rx }, { docNo: rx }, { fileName: rx }] }],
        })
          .select("_id docNo title fileName category status")
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    canReadAssets
      ? Asset.find({
          $and: [agencyFilter, { $or: [{ name: rx }, { assetNo: rx }, { "location.district": rx }] }],
        })
          .select("_id assetNo name assetType operationalStatus")
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
  ]);

  return {
    query: q,
    projects: projects.map((p): GlobalSearchResultItem => ({
      id: String(p._id),
      kind: "PROJECT",
      code: p.projectCode ?? null,
      title: p.title,
      subtitle: (p.location as { district?: string } | undefined)?.district ?? "Infrastructure Project",
      status: p.status ?? null,
      href: `/projects/${String(p._id)}`,
    })),
    issues: issues.map((i): GlobalSearchResultItem => ({
      id: String(i._id),
      kind: "ISSUE",
      code: i.referenceNo ?? null,
      title: i.title,
      subtitle: `${i.category}${((i.location as { district?: string } | undefined)?.district) ? ` · ${(i.location as { district?: string }).district}` : ""}`,
      status: i.status ?? null,
      href: `/issues/${String(i._id)}`,
    })),
    contractors: contractors.map((c): GlobalSearchResultItem => ({
      id: String(c._id),
      kind: "CONTRACTOR",
      code: c.registrationNumber ?? null,
      title: c.name,
      subtitle: c.category ?? "Contractor",
      status: c.status ?? null,
      href: `/contractors/${String(c._id)}`,
    })),
    documents: documents.map((d): GlobalSearchResultItem => ({
      id: String(d._id),
      kind: "DOCUMENT",
      code: d.docNo ?? null,
      title: d.title || d.fileName || "Document",
      subtitle: d.category ?? "Document",
      status: d.status ?? null,
      href: `/documents/${String(d._id)}`,
    })),
    assets: assets.map((a): GlobalSearchResultItem => ({
      id: String(a._id),
      kind: "ASSET",
      code: a.assetNo ?? null,
      title: a.name,
      subtitle: a.assetType ?? "Asset",
      status: a.operationalStatus ?? null,
      href: `/assets/${String(a._id)}`,
    })),
  };
}
