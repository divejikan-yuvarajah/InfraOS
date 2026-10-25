import mongoose from "mongoose";

import { Agency } from "../../agencies/models/agency.model.js";
import { Conflict } from "../../roadsync/models/conflict.model.js";
import { CoordinationRequest } from "../../roadsync/models/coordination-request.model.js";
import { Document } from "../../documents/models/document.model.js";
import { Inspection } from "../../inspections/models/inspection.model.js";
import { ProjectPayment } from "../../finance/models/project-payment.model.js";
import { Notification } from "../../notifications/models/notification.model.js";
import { CitizenIssue } from "../../issues/models/citizen-issue.model.js";
import { Project } from "../../projects/models/project.model.js";
import { WorkRequest } from "../../roadsync/models/work-request.model.js";
import type { AuthenticatedActor } from "../auth/require-authenticated.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import { hasPermission } from "./require-permission.js";

/**
 * Step 46 scope. Filters are built on the server and sent to Mongo.
 * An unknown relationship is match-none, never {}.
 * Contractor ownership is denied: Contractor has no userId.
 * Project submitter SoD is not claimed: Project has createdBy but no submittedBy.
 */

const MATCH_NONE = { _id: { $in: [] as mongoose.Types.ObjectId[] } };
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_DEPTH = 8;

export type ResourceScope =
  | { kind: "platform" }
  | { kind: "agencies"; agencyIds: mongoose.Types.ObjectId[] }
  | { kind: "none" };

export type AccessFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
};

export type AccessSuccess<T> = { ok: true; data: T };

export type ProjectView = {
  id: string;
  title: string;
  status: string;
  agencyId: string;
};

export type DocumentView = {
  id: string;
  fileName: string;
  visibility: string;
  projectId: string;
};

type Filter = Record<string, unknown>;

function objectId(value: string): mongoose.Types.ObjectId | null {
  if (!OBJECT_ID.test(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function fail(status: AccessFailure["status"], code: AccessFailure["code"]): AccessFailure {
  return { ok: false, status, code };
}

export function isMatchNone(filter: Filter): boolean {
  const id = filter._id;
  return Boolean(id && typeof id === "object" && Array.isArray((id as { $in?: unknown }).$in) && (id as { $in: unknown[] }).$in.length === 0);
}

export function projectReadFilter(scope: ResourceScope): Filter {
  if (scope.kind === "none") return MATCH_NONE;
  if (scope.kind === "platform") return { agencyId: { $exists: true, $ne: null } };
  return { agencyId: { $in: scope.agencyIds } };
}

export function projectWriteFilter(actor: AuthenticatedActor, scope: ResourceScope): Filter {
  if (actor.roleKey === "SUPER_ADMIN" || actor.roleKey === "CONTRACTOR" || actor.roleKey === "INSPECTOR" || actor.roleKey === "CITIZEN") {
    return MATCH_NONE;
  }
  const agencyId = objectId(actor.agencyId);
  const userId = objectId(actor.userId);
  if (!agencyId || !userId || scope.kind === "none") return MATCH_NONE;
  if (actor.roleKey === "PROJECT_MANAGER") {
    return { agencyId, managerId: userId };
  }
  if (scope.kind === "platform") return MATCH_NONE;
  return { agencyId: { $in: scope.agencyIds } };
}

/** Reject caller agency, identity, and Mongo operators. Does not merge them into the scope. */
export function untrustedConstraint(input: unknown): "ok" | "reject" {
  if (input == null) return "ok";
  if (typeof input !== "object" || Array.isArray(input)) return "reject";
  for (const key of Object.keys(input)) {
    if (
      key.startsWith("$") ||
      key === "agencyId" ||
      key === "userId" ||
      key === "roleKey" ||
      key === "permissions" ||
      key === "organizationId"
    ) {
      return "reject";
    }
  }
  return "ok";
}

async function collectDescendants(rootId: mongoose.Types.ObjectId): Promise<ResourceScope> {
  const ids = [rootId];
  const seen = new Set([rootId.toString()]);
  let frontier = [rootId];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    const children = await Agency.find({
      parentAgencyId: { $in: frontier },
      status: "ACTIVE",
    }).select("_id");
    const next: mongoose.Types.ObjectId[] = [];
    for (const child of children) {
      const key = child._id.toString();
      if (seen.has(key)) return { kind: "none" };
      seen.add(key);
      ids.push(child._id);
      next.push(child._id);
    }
    frontier = next;
  }
  if (frontier.length > 0) return { kind: "none" };
  return { kind: "agencies", agencyIds: ids };
}

export async function resolveResourceScope(actor: AuthenticatedActor): Promise<ResourceScope> {
  const agencyId = objectId(actor.agencyId);
  if (!agencyId || !objectId(actor.userId)) return { kind: "none" };
  const own = await Agency.findById(agencyId).select("status parentAgencyId");
  if (!own || own.status !== "ACTIVE") return { kind: "none" };
  if (actor.roleKey === "SUPER_ADMIN") return { kind: "platform" };
  if (actor.roleKey === "CONTRACTOR" || actor.roleKey === "CITIZEN" || actor.roleKey === "INSPECTOR") {
    return { kind: "none" };
  }
  if (actor.roleKey === "AGENCY_OFFICER" || actor.roleKey === "PROJECT_MANAGER") {
    return { kind: "agencies", agencyIds: [own._id] };
  }
  if (actor.roleKey === "GOV_ADMIN") {
    if (own.parentAgencyId) {
      const parent = await Agency.findById(own.parentAgencyId).select("status");
      if (!parent || parent.status !== "ACTIVE") return { kind: "none" };
    }
    return collectDescendants(own._id);
  }
  return { kind: "none" };
}

function projectView(project: { _id: mongoose.Types.ObjectId; title: string; status: string; agencyId: mongoose.Types.ObjectId }): ProjectView {
  return {
    id: project._id.toString(),
    title: project.title,
    status: project.status,
    agencyId: project.agencyId.toString(),
  };
}

async function inspectorProjectIds(actor: AuthenticatedActor): Promise<mongoose.Types.ObjectId[]> {
  const userId = objectId(actor.userId);
  if (!userId) return [];
  return Inspection.find({ inspectorId: userId }).distinct("projectId");
}

export async function readProject(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AccessSuccess<ProjectView> | AccessFailure> {
  const id = objectId(rawId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  try {
    const scope = await resolveResourceScope(actor);
    let filter = projectReadFilter(scope);
    if (actor.roleKey === "INSPECTOR") {
      filter = { _id: { $in: await inspectorProjectIds(actor) } };
    }
    if (actor.roleKey === "CONTRACTOR") filter = MATCH_NONE;
    const project = await Project.findOne({ $and: [filter, { _id: id }] }).select("title status agencyId");
    if (!project) return fail(404, "NOT_FOUND");
    return { ok: true, data: projectView(project) };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function listProjects(
  actor: AuthenticatedActor,
  query: unknown,
): Promise<AccessSuccess<{ projects: ProjectView[]; total: number }> | AccessFailure> {
  if (untrustedConstraint(query) === "reject") return fail(400, "VALIDATION_ERROR");
  try {
    const scope = await resolveResourceScope(actor);
    let filter = projectReadFilter(scope);
    if (actor.roleKey === "INSPECTOR") {
      filter = { _id: { $in: await inspectorProjectIds(actor) } };
    }
    if (actor.roleKey === "CONTRACTOR") filter = MATCH_NONE;
    const [projects, total, aggregated] = await Promise.all([
      Project.find(filter).select("title status agencyId").sort({ title: 1 }).limit(20),
      Project.countDocuments(filter),
      Project.aggregate<{ total: number }>([{ $match: filter }, { $count: "total" }]),
    ]);
    const aggregateTotal = aggregated[0]?.total ?? 0;
    if (aggregateTotal !== total) return fail(503, "SERVICE_UNAVAILABLE");
    return {
      ok: true,
      data: { projects: projects.map(projectView), total },
    };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function updateProjectTitle(
  actor: AuthenticatedActor,
  rawId: string,
  title: string,
): Promise<AccessSuccess<ProjectView> | AccessFailure> {
  const id = objectId(rawId);
  if (!id || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
    return fail(400, "VALIDATION_ERROR");
  }
  if (actor.roleKey === "SUPER_ADMIN") return fail(403, "FORBIDDEN");
  try {
    const scope = await resolveResourceScope(actor);
    const filter = projectWriteFilter(actor, scope);
    const current = await Project.findOne({ $and: [filter, { _id: id }] }).select("status title agencyId");
    if (!current) return fail(404, "NOT_FOUND");
    if (current.status !== "DRAFT") return fail(409, "CONFLICT");
    const updated = await Project.findOneAndUpdate(
      { $and: [filter, { _id: id, status: "DRAFT" }] },
      { $set: { title: title.trim() } },
      { new: true, projection: { title: 1, status: 1, agencyId: 1 } },
    );
    if (!updated) return fail(409, "CONFLICT");
    return { ok: true, data: projectView(updated) };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function readDocument(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AccessSuccess<DocumentView> | AccessFailure> {
  const id = objectId(rawId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  try {
    const scope = await resolveResourceScope(actor);
    const projects = await Project.find(projectReadFilter(scope)).select("_id");
    const projectIds = actor.roleKey === "INSPECTOR" ? await inspectorProjectIds(actor) : projects.map((item) => item._id);
    const document = await Document.findOne({ _id: id, projectId: { $in: projectIds } }).select("fileName visibility projectId");
    if (!document) return fail(404, "NOT_FOUND");
    return {
      ok: true,
      data: {
        id: document._id.toString(),
        fileName: document.fileName,
        visibility: document.visibility,
        projectId: document.projectId.toString(),
      },
    };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function readNotification(actor: AuthenticatedActor, rawId: string): Promise<AccessSuccess<{ id: string; title: string }> | AccessFailure> {
  const id = objectId(rawId);
  const userId = objectId(actor.userId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  if (!userId) return fail(404, "NOT_FOUND");
  try {
    const notice = await Notification.findOne({ _id: id, userId }).select("title");
    if (!notice) return fail(404, "NOT_FOUND");
    return { ok: true, data: { id: notice._id.toString(), title: notice.title } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function readInspection(actor: AuthenticatedActor, rawId: string): Promise<AccessSuccess<{ id: string; projectId: string }> | AccessFailure> {
  const id = objectId(rawId);
  const userId = objectId(actor.userId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  if (!userId || actor.roleKey !== "INSPECTOR") return fail(404, "NOT_FOUND");
  try {
    const inspection = await Inspection.findOne({ _id: id, inspectorId: userId }).select("projectId");
    if (!inspection) return fail(404, "NOT_FOUND");
    return { ok: true, data: { id: inspection._id.toString(), projectId: inspection.projectId.toString() } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

/** Platform conflict read is the stored roadsync.conflict.read grant. It does not grant resolve. */
async function superAdminMayReadConflicts(actor: AuthenticatedActor): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) throw new Error("database unavailable");
  const user = await User.findById(actor.userId).select("roleId");
  if (!user?.roleId || user.roleId.toString() !== actor.roleId) return false;
  const role = await Role.findById(actor.roleId).select("key isActive permissions");
  if (!role?.isActive || role.key !== "SUPER_ADMIN" || role.key !== actor.roleKey) return false;
  const granted = Array.isArray(role.permissions) ? role.permissions : [];
  return hasPermission(granted, "roadsync.conflict.read");
}

export async function readConflict(actor: AuthenticatedActor, rawId: string): Promise<AccessSuccess<{ id: string; status: string }> | AccessFailure> {
  const id = objectId(rawId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  try {
    if (actor.roleKey === "SUPER_ADMIN") {
      if (!(await superAdminMayReadConflicts(actor))) return fail(403, "FORBIDDEN");
      const conflict = await Conflict.findOne({ _id: id }).select("status");
      if (!conflict) return fail(404, "NOT_FOUND");
      return { ok: true, data: { id: conflict._id.toString(), status: conflict.status } };
    }
    const partyIds = await partyWorkRequestIds(actor);
    const parties =
      actor.roleKey === "GOV_ADMIN"
        ? { workRequestA: { $in: partyIds }, workRequestB: { $in: partyIds } }
        : { $or: [{ workRequestA: { $in: partyIds } }, { workRequestB: { $in: partyIds } }] };
    const conflict = await Conflict.findOne({ _id: id, ...parties }).select("status");
    if (!conflict) return fail(404, "NOT_FOUND");
    return { ok: true, data: { id: conflict._id.toString(), status: conflict.status } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

async function partyWorkRequestIds(actor: AuthenticatedActor): Promise<mongoose.Types.ObjectId[]> {
  const scope = await resolveResourceScope(actor);
  if (actor.roleKey === "PROJECT_MANAGER") {
    const userId = objectId(actor.userId);
    const agencyId = objectId(actor.agencyId);
    if (!userId || !agencyId) return [];
    const projects = await Project.find({ agencyId, managerId: userId }).select("_id");
    return WorkRequest.find({ projectId: { $in: projects.map((item) => item._id) } }).distinct("_id");
  }
  if (scope.kind !== "agencies") return [];
  const inAgency = await WorkRequest.find({ agencyId: { $in: scope.agencyIds } }).select("_id");
  return inAgency.map((item) => item._id);
}

export async function approvePayment(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AccessSuccess<{ id: string; status: string }> | AccessFailure> {
  const id = objectId(rawId);
  const userId = objectId(actor.userId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  if (!userId) return fail(404, "NOT_FOUND");
  if (actor.roleKey === "SUPER_ADMIN") return fail(403, "FORBIDDEN");
  try {
    const scope = await resolveResourceScope(actor);
    const projects = await Project.find(projectReadFilter(scope)).select("_id");
    const visible = await ProjectPayment.findOne({
      _id: id,
      projectId: { $in: projects.map((item) => item._id) },
    }).select("status createdBy");
    if (!visible) return fail(404, "NOT_FOUND");
    if (visible.createdBy.equals(userId) || visible.status !== "PENDING") return fail(409, "CONFLICT");
    const updated = await ProjectPayment.findOneAndUpdate(
      {
        _id: id,
        status: "PENDING",
        createdBy: { $ne: userId },
        projectId: { $in: projects.map((item) => item._id) },
      },
      { $set: { status: "APPROVED", approvedBy: userId } },
      { new: true, projection: { status: 1 } },
    );
    if (!updated) return fail(409, "CONFLICT");
    return { ok: true, data: { id: updated._id.toString(), status: updated.status } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function readCoordination(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AccessSuccess<{ id: string; status: string }> | AccessFailure> {
  const id = objectId(rawId);
  const agencyId = objectId(actor.agencyId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  if (!agencyId || actor.roleKey === "SUPER_ADMIN") return fail(actor.roleKey === "SUPER_ADMIN" ? 403 : 404, actor.roleKey === "SUPER_ADMIN" ? "FORBIDDEN" : "NOT_FOUND");
  try {
    const scope = await resolveResourceScope(actor);
    const allowed = scope.kind === "agencies" ? scope.agencyIds : [];
    const row = await CoordinationRequest.findOne({
      _id: id,
      $or: [{ toAgency: { $in: allowed } }, { fromAgency: { $in: allowed } }],
    }).select("status");
    if (!row) return fail(404, "NOT_FOUND");
    return { ok: true, data: { id: row._id.toString(), status: row.status } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}

export async function readCitizenIssue(
  actor: AuthenticatedActor,
  rawId: string,
): Promise<AccessSuccess<{ id: string; status: string }> | AccessFailure> {
  const id = objectId(rawId);
  const userId = objectId(actor.userId);
  const agencyId = objectId(actor.agencyId);
  if (!id) return fail(400, "VALIDATION_ERROR");
  if (!userId) return fail(404, "NOT_FOUND");
  const filter: Filter =
    actor.roleKey === "CITIZEN"
      ? { _id: id, citizenId: userId }
      : actor.roleKey === "AGENCY_OFFICER" && agencyId
        ? { _id: id, assignedAgency: agencyId }
        : MATCH_NONE;
  try {
    const issue = await CitizenIssue.findOne(filter).select("status");
    if (!issue) return fail(404, "NOT_FOUND");
    return { ok: true, data: { id: issue._id.toString(), status: issue.status } };
  } catch {
    return fail(503, "SERVICE_UNAVAILABLE");
  }
}
