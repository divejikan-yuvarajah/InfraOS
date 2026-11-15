import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { getIssueStorage } from "../inspections/evidence-storage.js";
import { escapeSearchRegex, type ParsedListQuery } from "../../shared/http/list-query.js";
import { ISSUE_TRANSITIONS, type IssueCategory, type IssueStatus } from "./issue.constants.js";
import { CitizenIssue } from "./models/citizen-issue.model.js";
import { IssueRoutingRule } from "./models/issue-routing-rule.model.js";

async function issueScopeFilter(actor: AuthenticatedActor): Promise<Record<string, unknown>> {
  const scope = await resolveResourceScope(actor);
  if (scope.kind === "platform") return {};
  if (scope.kind === "none") return { _id: { $in: [] } };
  // Staff without platform access see issues assigned to their agency
  if (actor.roleKey === "AGENCY_OFFICER" || actor.roleKey === "PROJECT_MANAGER") {
    return { assignedAgency: { $in: scope.agencyIds } };
  }
  return { _id: { $in: [] } };
}

export async function listStaffIssues(actor: AuthenticatedActor, query: ParsedListQuery & { unassignedOnly?: boolean }) {
  const scopeFilter = await issueScopeFilter(actor);
  const filter: Record<string, unknown> = { ...scopeFilter };

  if (query.unassignedOnly) {
    filter.assignedAgency = { $exists: false };
  } else if (query.agencyId && mongoose.isValidObjectId(query.agencyId)) {
    const scope = await resolveResourceScope(actor);
    if (scope.kind === "platform" || (scope.kind === "agencies" && scope.agencyIds.some((id) => String(id) === query.agencyId))) {
      filter.assignedAgency = new mongoose.Types.ObjectId(query.agencyId);
    } else {
      return { items: [], page: query.page, limit: query.limit, total: 0, totalPages: 1 };
    }
  }
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;
  if (query.district) filter["location.district"] = query.district;
  if (query.q) {
    const rx = new RegExp(escapeSearchRegex(query.q), "i");
    filter.$or = [{ referenceNo: rx }, { title: rx }, { description: rx }, { "location.district": rx }];
  }

  const [docs, total, agencies] = await Promise.all([
    CitizenIssue.find(filter)
      .select("referenceNo category title description location status priority assignedAgency publicMapVisible createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    CitizenIssue.countDocuments(filter),
    Agency.find({ status: "ACTIVE" }).select("_id code name").lean(),
  ]);

  const agencyMap = new Map(agencies.map((a) => [String(a._id), { id: String(a._id), code: a.code, name: a.name }]));

  return {
    items: docs.map((d) => ({
      id: String(d._id),
      referenceNo: d.referenceNo ?? null,
      category: d.category,
      title: d.title ?? null,
      description: d.description,
      district: d.location?.district ?? null,
      province: d.location?.province ?? null,
      status: d.status,
      priority: d.priority,
      publicMapVisible: Boolean(d.publicMapVisible),
      assignedAgency: d.assignedAgency ? agencyMap.get(String(d.assignedAgency)) ?? null : null,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : new Date().toISOString(),
    })),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getStaffIssueDetail(actor: AuthenticatedActor, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const scopeFilter = await issueScopeFilter(actor);
  const doc = await CitizenIssue.findOne({ _id: new mongoose.Types.ObjectId(id), ...scopeFilter })
    .select("+photos +contact +internalNotes")
    .lean();
  if (!doc) return null;

  let assignedAgency: { id: string; code: string; name: string } | null = null;
  if (doc.assignedAgency) {
    const ag = await Agency.findById(doc.assignedAgency).select("_id code name").lean();
    if (ag) assignedAgency = { id: String(ag._id), code: ag.code, name: ag.name };
  }

  return {
    id: String(doc._id),
    referenceNo: doc.referenceNo ?? null,
    category: doc.category,
    title: doc.title ?? null,
    description: doc.description,
    location: doc.location,
    geometry: doc.geometry ?? null,
    status: doc.status,
    priority: doc.priority,
    publicMapVisible: Boolean(doc.publicMapVisible),
    assignedAgency,
    duplicateOfIssueId: doc.duplicateOfIssueId ? String(doc.duplicateOfIssueId) : null,
    photoCount: Array.isArray(doc.photos) ? doc.photos.length : 0,
    photos: (doc.photos ?? []).map((p, idx) => ({
      index: idx,
      fileName: p.fileName,
      mimeType: p.mimeType ?? "image/jpeg",
      sizeBytes: p.sizeBytes ?? 0,
    })),
    contact: doc.contact ?? null,
    statusHistory: doc.statusHistory ?? [],
    internalNotes: (doc.internalNotes ?? []).map((n) => ({
      authorId: String(n.authorId),
      body: n.body,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date().toISOString(),
    })),
    publicMessages: (doc.publicMessages ?? []).map((m) => ({
      authorLabel: m.authorLabel,
      body: m.body,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
    })),
    allowedTransitions: ISSUE_TRANSITIONS[doc.status as IssueStatus] ?? [],
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function openStaffIssuePhoto(actor: AuthenticatedActor, id: string, index: number) {
  if (!mongoose.isValidObjectId(id)) return null;
  const scopeFilter = await issueScopeFilter(actor);
  const doc = await CitizenIssue.findOne({ _id: new mongoose.Types.ObjectId(id), ...scopeFilter })
    .select("+photos")
    .lean();
  if (!doc) return null;
  const photo = (doc.photos ?? [])[index];
  if (!photo) return null;
  const storage = getIssueStorage();
  if (!storage) return null;
  return {
    mimeType: photo.mimeType || "image/jpeg",
    stream: storage.open(photo.storageKey),
  };
}

export async function routeStaffIssue(
  actor: AuthenticatedActor,
  id: string,
  agencyId: string,
  requestId: string,
  publicMapVisible?: boolean,
) {
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(agencyId)) {
    return { ok: false as const, status: 404 as const, code: "NOT_FOUND" as const };
  }
  const scopeFilter = await issueScopeFilter(actor);
  const issue = await CitizenIssue.findOne({ _id: new mongoose.Types.ObjectId(id), ...scopeFilter });
  if (!issue) return { ok: false as const, status: 404 as const, code: "NOT_FOUND" as const };

  const agency = await Agency.findOne({ _id: new mongoose.Types.ObjectId(agencyId), status: "ACTIVE" }).select("_id name code").lean();
  if (!agency) return { ok: false as const, status: 404 as const, code: "NOT_FOUND" as const };

  const prevStatus = issue.status;
  issue.assignedAgency = agency._id;
  if (typeof publicMapVisible === "boolean") {
    issue.publicMapVisible = publicMapVisible;
  }
  if (issue.status === "SUBMITTED") {
    issue.status = "ASSIGNED";
    issue.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: "ASSIGNED",
      changedBy: new mongoose.Types.ObjectId(actor.userId),
      note: `Routed to ${agency.code}`,
      changedAt: new Date(),
    });
    issue.publicMessages.push({
      authorLabel: "Agency Triage",
      body: `Assigned to ${agency.name} (${agency.code}) for assessment.`,
      createdAt: new Date(),
    });
  }
  await issue.save();

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(actor.userId),
    agencyId: agency._id,
    action: "citizen_issue.routed",
    resourceType: "CITIZEN_ISSUE",
    resourceId: issue._id,
    newValue: { status: issue.status, agencyId: agency._id, reason: `routed to ${agency.code}` },
    requestId,
  });

  return { ok: true as const, issueId: String(issue._id), status: issue.status, agencyId: String(agency._id) };
}

export async function transitionStaffIssue(
  actor: AuthenticatedActor,
  id: string,
  input: {
    toStatus: IssueStatus;
    publicMessage?: string;
    internalNote?: string;
    duplicateOfIssueId?: string;
    publicMapVisible?: boolean;
  },
  requestId: string,
) {
  if (!mongoose.isValidObjectId(id)) return { ok: false as const, status: 404 as const, code: "NOT_FOUND" as const };
  const scopeFilter = await issueScopeFilter(actor);
  const issue = await CitizenIssue.findOne({ _id: new mongoose.Types.ObjectId(id), ...scopeFilter }).select("+internalNotes");
  if (!issue) return { ok: false as const, status: 404 as const, code: "NOT_FOUND" as const };

  const allowed = ISSUE_TRANSITIONS[issue.status as IssueStatus] ?? [];
  if (!allowed.includes(input.toStatus)) {
    return { ok: false as const, status: 409 as const, code: "INVALID_TRANSITION" as const };
  }

  const prevStatus = issue.status;
  issue.status = input.toStatus;
  if (typeof input.publicMapVisible === "boolean") {
    issue.publicMapVisible = input.publicMapVisible;
  }
  if (input.toStatus === "DUPLICATE" && input.duplicateOfIssueId && mongoose.isValidObjectId(input.duplicateOfIssueId)) {
    issue.duplicateOfIssueId = new mongoose.Types.ObjectId(input.duplicateOfIssueId);
  }
  issue.statusHistory.push({
    fromStatus: prevStatus,
    toStatus: input.toStatus,
    changedBy: new mongoose.Types.ObjectId(actor.userId),
    note: input.publicMessage?.slice(0, 500) ?? input.internalNote?.slice(0, 500),
    changedAt: new Date(),
  });
  if (input.internalNote?.trim()) {
    issue.internalNotes.push({
      authorId: new mongoose.Types.ObjectId(actor.userId),
      body: input.internalNote.trim(),
      createdAt: new Date(),
    });
  }
  if (input.publicMessage?.trim()) {
    issue.publicMessages.push({
      authorLabel: "Agency Update",
      body: input.publicMessage.trim(),
      createdAt: new Date(),
    });
  }
  await issue.save();

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(actor.userId),
    agencyId: issue.assignedAgency ?? (actor.agencyId ? new mongoose.Types.ObjectId(actor.agencyId) : undefined),
    action: "citizen_issue.status_changed",
    resourceType: "CITIZEN_ISSUE",
    resourceId: issue._id,
    oldValue: { status: prevStatus },
    newValue: { status: input.toStatus },
    requestId,
  });

  return {
    ok: true as const,
    issueId: String(issue._id),
    referenceNo: issue.referenceNo ?? null,
    fromStatus: prevStatus,
    toStatus: input.toStatus,
    agencyId: issue.assignedAgency ? String(issue.assignedAgency) : null,
  };
}

export async function addIssueNote(
  actor: AuthenticatedActor,
  id: string,
  input: { kind: "INTERNAL" | "PUBLIC"; body: string },
) {
  if (!mongoose.isValidObjectId(id)) return { ok: false as const, status: 404 as const };
  const scopeFilter = await issueScopeFilter(actor);
  const issue = await CitizenIssue.findOne({ _id: new mongoose.Types.ObjectId(id), ...scopeFilter }).select("+internalNotes");
  if (!issue) return { ok: false as const, status: 404 as const };

  if (input.kind === "INTERNAL") {
    issue.internalNotes.push({
      authorId: new mongoose.Types.ObjectId(actor.userId),
      body: input.body.trim(),
      createdAt: new Date(),
    });
  } else {
    issue.publicMessages.push({
      authorLabel: "Agency Update",
      body: input.body.trim(),
      createdAt: new Date(),
    });
  }
  await issue.save();
  return { ok: true as const };
}

export async function listRoutingRules() {
  const [rules, agencies] = await Promise.all([
    IssueRoutingRule.find({}).sort({ priorityOrder: 1, createdAt: -1 }).lean(),
    Agency.find({ status: "ACTIVE" }).select("_id code name").lean(),
  ]);
  const agencyMap = new Map(agencies.map((a) => [String(a._id), { id: String(a._id), code: a.code, name: a.name }]));
  return rules.map((r) => ({
    id: String(r._id),
    category: r.category,
    province: r.province ?? null,
    district: r.district ?? null,
    agency: agencyMap.get(String(r.agencyId)) ?? null,
    priorityOrder: r.priorityOrder,
    isActive: r.isActive,
  }));
}

export async function createRoutingRule(
  actor: AuthenticatedActor,
  input: { category: IssueCategory; province?: string; district?: string; agencyId: string; priorityOrder?: number },
) {
  if (!mongoose.isValidObjectId(input.agencyId)) return null;
  const agency = await Agency.findById(input.agencyId).select("_id").lean();
  if (!agency) return null;
  const doc = await IssueRoutingRule.create({
    category: input.category,
    province: input.province?.trim() || undefined,
    district: input.district?.trim() || undefined,
    agencyId: agency._id,
    priorityOrder: input.priorityOrder ?? 100,
    isActive: true,
    createdBy: new mongoose.Types.ObjectId(actor.userId),
  });
  return { id: String(doc._id) };
}

export async function deleteRoutingRule(id: string) {
  if (!mongoose.isValidObjectId(id)) return false;
  const res = await IssueRoutingRule.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
  return res.deletedCount > 0;
}
