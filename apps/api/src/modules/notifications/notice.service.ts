import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { Agency } from "../agencies/models/agency.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { Project } from "../projects/models/project.model.js";
import { Notification } from "./models/notification.model.js";
import { encodeNoticeCursor, decodeNoticeCursor, isNoticeAction, noticeAudience, noticeType, type NoticeAction } from "./notice.policy.js";
import type { NoticeListQuery } from "./notice.schema.js";

const PRIVATE_DENY = new Set(["CONTRACTOR", "CITIZEN"]);
const RECIPIENT_CAP = 50;

export const noticeHooks: { beforeRead: () => Promise<void> } = {
  beforeRead: async () => {},
};

export class NoticeDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("notification service is temporarily unavailable");
    this.name = "NoticeDependencyError";
  }
}

class FlowControl extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 503, readonly code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "SERVICE_UNAVAILABLE") {
    super(code);
    this.name = "FlowControl";
  }
}

export type NoticeFailure = { ok: false; status: FlowControl["status"]; code: FlowControl["code"] };

export type NoticeItem = {
  id: string;
  type: "APPROVAL" | "MILESTONE" | "SYSTEM";
  titleKey: NoticeAction;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  project: null | { id: string; projectCode: string; title: string; status: string };
};

function fail(status: NoticeFailure["status"], code: NoticeFailure["code"]): NoticeFailure {
  return { ok: false, status, code };
}

function duplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}

async function assertLive(actor: AuthenticatedActor, permission: Permission): Promise<void> {
  if (!mongoose.isValidObjectId(actor.userId) || !mongoose.isValidObjectId(actor.roleId)) throw new FlowControl(401, "AUTH_REQUIRED");
  const user = await User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const role = await Role.findById(actor.roleId).select("key isActive permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const allowed = role?.isActive && role.key === actor.roleKey && hasPermission(granted, permission);
  if (!allowed) throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
}

async function ancestorAgencyIds(projectAgencyId: mongoose.Types.ObjectId, session: ClientSession): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  let currentId: string | null = String(projectAgencyId);
  for (let depth = 0; depth < 8 && currentId; depth += 1) {
    if (seen.has(currentId)) return [];
    seen.add(currentId);
    const row = await Agency.collection.findOne(
      { _id: new mongoose.Types.ObjectId(currentId) },
      { projection: { status: 1, parentAgencyId: 1 }, session },
    ) as { _id: mongoose.Types.ObjectId; status?: string; parentAgencyId?: unknown } | null;
    if (!row || row.status !== "ACTIVE") break;
    ids.push(row._id as mongoose.Types.ObjectId);
    currentId = row.parentAgencyId ? String(row.parentAgencyId) : null;
  }
  return ids;
}

async function reviewerRecipients(projectAgencyId: mongoose.Types.ObjectId, actorId: string, session: ClientSession): Promise<mongoose.Types.ObjectId[]> {
  const role = await Role.findOne({ key: "GOV_ADMIN", isActive: true }).session(session).select("permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  if (!role || !hasPermission(granted, "project.approve")) return [];
  const agencies = await ancestorAgencyIds(projectAgencyId, session);
  if (agencies.length === 0) return [];
  const users = await User.find({
    roleId: role._id,
    agencyId: { $in: agencies },
    status: "ACTIVE",
    emailVerified: true,
  }).session(session).select("_id").sort({ _id: 1 }).limit(RECIPIENT_CAP + 1);
  if (users.length > RECIPIENT_CAP) throw new NoticeDependencyError();
  return users.map((user) => user._id).filter((id) => id.toString() !== actorId);
}

async function managerRecipient(project: { managerId?: mongoose.Types.ObjectId | null; agencyId: mongoose.Types.ObjectId }, actorId: string, session: ClientSession): Promise<mongoose.Types.ObjectId[]> {
  if (!project.managerId || project.managerId.toString() === actorId) return [];
  const manager = await User.findById(project.managerId).session(session).select("status emailVerified roleId agencyId");
  if (!manager || manager.status !== "ACTIVE" || manager.emailVerified !== true || !manager.agencyId || manager.agencyId.toString() !== project.agencyId.toString()) return [];
  const role = await Role.findById(manager.roleId).session(session).select("key isActive permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  if (!role?.isActive || role.key !== "PROJECT_MANAGER" || !hasPermission(granted, "project.read")) return [];
  return [manager._id];
}

export async function notifyCommittedAudit(input: {
  session: ClientSession;
  auditId: mongoose.Types.ObjectId;
  action: string;
  resourceType: "PROJECT" | "MILESTONE";
  resourceId: mongoose.Types.ObjectId;
  actorId: string;
}): Promise<void> {
  if (!isNoticeAction(input.action)) return;
  const action = input.action;
  let projectId = input.resourceId;
  if (input.resourceType === "MILESTONE") {
    const milestone = await Milestone.findById(input.resourceId).session(input.session).select("projectId");
    if (!milestone) throw new NoticeDependencyError();
    projectId = milestone.projectId;
  }
  const project = await Project.findById(projectId).session(input.session).select("agencyId managerId");
  if (!project) throw new NoticeDependencyError();
  const recipients = noticeAudience(action) === "reviewer"
    ? await reviewerRecipients(project.agencyId, input.actorId, input.session)
    : await managerRecipient(project, input.actorId, input.session);
  if (recipients.length === 0) return;
  const docs = recipients.map((userId) => ({
    userId,
    type: noticeType(action),
    title: action,
    message: action,
    resourceType: "PROJECT" as const,
    resourceId: project._id,
    isRead: false,
    sourceAuditId: input.auditId,
    eventKey: `${input.auditId.toString()}:${userId.toString()}`,
  }));
  try {
    await Notification.insertMany(docs, { session: input.session, ordered: true });
  } catch (error) {
    if (duplicateKey(error)) {
      if (input.session.inTransaction()) throw new NoticeDependencyError();
      return;
    }
    throw error;
  }
}

async function readFilter(actor: AuthenticatedActor): Promise<{ denied: true } | { denied: false; filter: Record<string, unknown> }> {
  if (PRIVATE_DENY.has(actor.roleKey)) return { denied: true };
  if (actor.roleKey === "INSPECTOR") {
    const ids = await Inspection.find({ inspectorId: actor.userId }).distinct("projectId");
    return { denied: false, filter: { _id: { $in: ids } } };
  }
  return { denied: false, filter: projectReadFilter(await resolveResourceScope(actor)) };
}

function iso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

export async function listNotices(actor: AuthenticatedActor, query: NoticeListQuery): Promise<{ ok: true; list: { notices: NoticeItem[]; nextCursor: string | null; unreadCount: number } } | NoticeFailure> {
  try {
    await noticeHooks.beforeRead();
    await assertLive(actor, "notification.read");
    const userId = new mongoose.Types.ObjectId(actor.userId);
    const parts: Record<string, unknown>[] = [{ userId }];
    if (query.state === "read") parts.push({ isRead: true });
    if (query.state === "unread") parts.push({ isRead: false });
    if (query.cursor) {
      const decoded = decodeNoticeCursor(query.cursor);
      if (!decoded) throw new FlowControl(400, "VALIDATION_ERROR");
      const createdAt = new Date(decoded.t);
      parts.push({ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } }] });
    }
    const rows = await Notification.find({ $and: parts }).sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).select("type title isRead createdAt readAt resourceType resourceId");
    const page = rows.slice(0, query.limit);
    const ids = page.flatMap((row) => row.resourceType === "PROJECT" && row.resourceId ? [row.resourceId] : []);
    const scoped = await readFilter(actor);
    const visible = scoped.denied || ids.length === 0
      ? new Map<string, { projectCode: string; title: string; status: string }>()
      : new Map((await Project.find({ $and: [scoped.filter, { _id: { $in: ids } }] }).select("projectCode title status")).map((project) => [project._id.toString(), project]));
    const notices: NoticeItem[] = page.flatMap((row) => {
      if (!isNoticeAction(row.title)) return [];
      const project = row.resourceId ? visible.get(row.resourceId.toString()) : undefined;
      return [{
        id: row._id.toString(),
        type: row.type === "MILESTONE" || row.type === "SYSTEM" || row.type === "APPROVAL" ? row.type : "SYSTEM",
        titleKey: row.title,
        isRead: row.isRead,
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
        readAt: iso(row.readAt),
        project: project && row.resourceId ? { id: row.resourceId.toString(), projectCode: project.projectCode, title: project.title, status: project.status } : null,
      }];
    });
    const last = page.at(-1);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return {
      ok: true,
      list: {
        notices,
        nextCursor: rows.length > query.limit && last?.createdAt ? encodeNoticeCursor(last.createdAt.toISOString(), last._id.toString()) : null,
        unreadCount,
      },
    };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof NoticeDependencyError) return fail(503, "SERVICE_UNAVAILABLE");
    throw new NoticeDependencyError();
  }
}

export async function unreadNoticeCount(actor: AuthenticatedActor): Promise<{ ok: true; count: number } | NoticeFailure> {
  try {
    await noticeHooks.beforeRead();
    await assertLive(actor, "notification.read");
    const count = await Notification.countDocuments({ userId: actor.userId, isRead: false });
    return { ok: true, count };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    if (error instanceof NoticeDependencyError) return fail(503, "SERVICE_UNAVAILABLE");
    throw new NoticeDependencyError();
  }
}

export async function setNoticeRead(actor: AuthenticatedActor, rawId: string, isRead: boolean): Promise<{ ok: true; notice: { id: string; isRead: boolean; readAt: string | null } } | NoticeFailure> {
  try {
    await assertLive(actor, "notification.update");
    if (!mongoose.isValidObjectId(rawId)) throw new FlowControl(400, "VALIDATION_ERROR");
    const updated = await Notification.findOneAndUpdate(
      { _id: rawId, userId: actor.userId },
      isRead ? { $set: { isRead: true, readAt: new Date() } } : { $set: { isRead: false }, $unset: { readAt: 1 } },
      { new: true },
    ).select("isRead readAt");
    if (!updated) throw new FlowControl(404, "NOT_FOUND");
    return { ok: true, notice: { id: updated._id.toString(), isRead: updated.isRead, readAt: iso(updated.readAt) } };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new NoticeDependencyError();
  }
}
