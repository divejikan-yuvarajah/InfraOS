import mongoose, { type ClientSession } from "mongoose";
import type { Permission } from "@infraos/shared-types";

import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import type { NOTIFICATION_RESOURCES, NOTIFICATION_TYPES } from "./notification.constants.js";
import { Notification } from "./models/notification.model.js";
import { emitToUsers } from "./realtime.js";

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationResource = (typeof NOTIFICATION_RESOURCES)[number];
export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotifyInput = {
  recipients?: Array<string | mongoose.Types.ObjectId>;
  permission?: Permission;
  agencyId?: string | mongoose.Types.ObjectId | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  resourceType?: NotificationResource;
  resourceId?: string | mongoose.Types.ObjectId | null;
  actionUrl?: string;
  dedupeKey?: string;
  session?: ClientSession;
};

function sanitizeActionUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
  return trimmed.slice(0, 300);
}

async function resolveRecipients(input: NotifyInput): Promise<mongoose.Types.ObjectId[]> {
  if (input.recipients && input.recipients.length > 0) {
    const unique = new Map<string, mongoose.Types.ObjectId>();
    for (const raw of input.recipients) {
      const str = String(raw);
      if (mongoose.isValidObjectId(str)) {
        unique.set(str, new mongoose.Types.ObjectId(str));
      }
    }
    return Array.from(unique.values());
  }

  if (!input.permission) return [];

  const roles = await Role.find({ isActive: true }).select("_id key permissions").lean();
  const matchingRoleIds = roles
    .filter((r) => hasPermission(Array.isArray(r.permissions) ? r.permissions : [], input.permission!))
    .map((r) => r._id);
  const platformRoleIds = roles
    .filter((r) => (r.key === "SUPER_ADMIN" || r.key === "GOV_ADMIN") && hasPermission(Array.isArray(r.permissions) ? r.permissions : [], input.permission!))
    .map((r) => r._id);

  if (matchingRoleIds.length === 0) return [];

  const agencyFilter = input.agencyId && mongoose.isValidObjectId(String(input.agencyId))
    ? {
        $or: [
          { agencyId: new mongoose.Types.ObjectId(String(input.agencyId)), roleId: { $in: matchingRoleIds } },
          { roleId: { $in: platformRoleIds } },
        ],
      }
    : { roleId: { $in: matchingRoleIds } };

  const users = await User.find({
    status: "ACTIVE",
    emailVerified: true,
    ...agencyFilter,
  })
    .select("_id")
    .limit(50)
    .lean();

  return users.map((u) => u._id as mongoose.Types.ObjectId);
}

export async function notify(input: NotifyInput): Promise<number> {
  const recipientIds = await resolveRecipients(input);
  if (recipientIds.length === 0) return 0;

  const actionUrl = sanitizeActionUrl(input.actionUrl);
  const hasResource = Boolean(input.resourceType && input.resourceId && mongoose.isValidObjectId(String(input.resourceId)));
  const resourceIdObj = hasResource ? new mongoose.Types.ObjectId(String(input.resourceId)) : undefined;

  const docs = recipientIds.map((userId) => ({
    userId,
    type: input.type,
    severity: input.severity ?? "INFO",
    title: input.title.slice(0, 200),
    message: input.message.slice(0, 2000),
    ...(hasResource ? { resourceType: input.resourceType, resourceId: resourceIdObj } : {}),
    ...(actionUrl ? { actionUrl } : {}),
    ...(input.dedupeKey ? { dedupeKey: `${input.dedupeKey}:${userId.toString()}`.slice(0, 140) } : {}),
    isRead: false,
  }));

  let insertedCount = 0;
  const emittedUsers: string[] = [];

  try {
    const inserted = await Notification.insertMany(docs, {
      session: input.session,
      ordered: false,
    });
    insertedCount = inserted.length;
    for (const row of inserted) {
      emittedUsers.push(row.userId.toString());
    }
  } catch (err: unknown) {
    // Ordered=false allows non-duplicate docs to insert; only suppress duplicate key 11000
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : undefined;
    if (code !== 11000) throw err;
  }

  if (emittedUsers.length > 0 && !input.session?.inTransaction()) {
    emitToUsers(emittedUsers, "notification:new", {
      type: input.type,
      severity: input.severity ?? "INFO",
      title: input.title,
      actionUrl: actionUrl ?? null,
    });
  }

  return insertedCount;
}
