import { Router } from "express";
import mongoose from "mongoose";

import { failure, success } from "../../shared/http/envelope.js";
import { escapeSearchRegex } from "../../shared/http/list-query.js";
import { Agency } from "../agencies/models/agency.model.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { User } from "../identity/models/user.model.js";
import { AuditLog } from "./models/audit-log.model.js";

export const adminAuditLogRouter = Router();

const REDACT_KEYS = /password|secret|token|hash|taxid|apikey|authorization/i;

function redactSnapshot(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.test(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = redactSnapshot(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function encodeCursor(ts: Date, id: string): string {
  return Buffer.from(`${ts.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(raw: string): { ts: Date; id: mongoose.Types.ObjectId } | null {
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const [isoStr, idStr] = text.split("|");
    if (!isoStr || !idStr || !mongoose.isValidObjectId(idStr)) return null;
    const ts = new Date(isoStr);
    if (Number.isNaN(ts.getTime())) return null;
    return { ts, id: new mongoose.Types.ObjectId(idStr) };
  } catch {
    return null;
  }
}

adminAuditLogRouter.get("/", requireAuthenticated, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");

  const actor = req.actor;
  if (!actor) {
    res.status(401).json(failure("UNAUTHENTICATED", "sign-in is required", req.requestId));
    return;
  }

  if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
    res.status(403).json(failure("FORBIDDEN", "request could not be completed", req.requestId));
    return;
  }

  const rawLimit = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 100) : 30;

  const parts: Record<string, unknown>[] = [];
  if (typeof req.query.action === "string" && req.query.action.trim()) {
    parts.push({ action: new RegExp(escapeSearchRegex(req.query.action.trim()), "i") });
  }
  if (typeof req.query.resourceType === "string" && req.query.resourceType.trim()) {
    parts.push({ resourceType: req.query.resourceType.trim() });
  }
  if (typeof req.query.userId === "string" && mongoose.isValidObjectId(req.query.userId)) {
    parts.push({ userId: new mongoose.Types.ObjectId(req.query.userId) });
  }
  if (typeof req.query.from === "string" || typeof req.query.to === "string") {
    const range: Record<string, Date> = {};
    if (typeof req.query.from === "string") {
      const d = new Date(req.query.from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (typeof req.query.to === "string") {
      const d = new Date(req.query.to);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    if (Object.keys(range).length > 0) parts.push({ timestamp: range });
  }
  if (typeof req.query.cursor === "string" && req.query.cursor.trim()) {
    const cur = decodeCursor(req.query.cursor.trim());
    if (cur) {
      parts.push({
        $or: [
          { timestamp: { $lt: cur.ts } },
          { timestamp: cur.ts, _id: { $lt: cur.id } },
        ],
      });
    }
  }

  const filter = parts.length > 0 ? { $and: parts } : {};
  const docs = await AuditLog.find(filter)
    .select("+oldValue +newValue")
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit + 1)
    .lean()
    .exec();

  const pageDocs = docs.slice(0, limit);
  const userIds = Array.from(new Set(pageDocs.map((d) => String(d.userId)).filter((id) => mongoose.isValidObjectId(id))));
  const agencyIds = Array.from(new Set(pageDocs.flatMap((d) => (d.agencyId ? [String(d.agencyId)] : []))));

  const [users, agencies] = await Promise.all([
    userIds.length > 0 ? User.find({ _id: { $in: userIds } }).select("_id email displayName").lean() : Promise.resolve([]),
    agencyIds.length > 0 ? Agency.find({ _id: { $in: agencyIds } }).select("_id code name").lean() : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const agencyMap = new Map(agencies.map((a) => [String(a._id), a]));

  const items = pageDocs.map((doc) => {
    const u = userMap.get(String(doc.userId));
    const ag = doc.agencyId ? agencyMap.get(String(doc.agencyId)) : undefined;
    const ts = doc.timestamp instanceof Date ? doc.timestamp : new Date();
    return {
      id: String(doc._id),
      userId: doc.userId ? String(doc.userId) : null,
      actorEmail: u?.email ?? null,
      actorName: u?.displayName ?? null,
      agencyId: doc.agencyId ? String(doc.agencyId) : null,
      agencyCode: ag?.code ?? null,
      action: doc.action,
      resourceType: doc.resourceType,
      resourceId: doc.resourceId ? String(doc.resourceId) : null,
      oldValue: redactSnapshot(doc.oldValue),
      newValue: redactSnapshot(doc.newValue),
      requestId: doc.requestId ?? null,
      timestamp: ts.toISOString(),
    };
  });

  const last = pageDocs.at(-1);
  const nextCursor =
    docs.length > limit && last?.timestamp instanceof Date
      ? encodeCursor(last.timestamp, String(last._id))
      : null;

  res.status(200).json(success({ items, nextCursor }, req.requestId));
});

adminAuditLogRouter.get("/governance", requireAuthenticated, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const actor = req.actor;
  if (!actor) {
    res.status(401).json(failure("UNAUTHENTICATED", "sign-in is required", req.requestId));
    return;
  }
  if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
    res.status(403).json(failure("FORBIDDEN", "request could not be completed", req.requestId));
    return;
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [sensitiveActions, reportExports, failedLoginCount] = await Promise.all([
    AuditLog.find({
      action: { $in: ["role.updated", "role.created", "user.disabled", "user.role_changed", "project.public_release_updated", "citizen_issue.routed"] },
    })
      .select("+newValue")
      .sort({ timestamp: -1 })
      .limit(20)
      .lean(),
    AuditLog.find({ action: "report.export" })
      .select("+newValue")
      .sort({ timestamp: -1 })
      .limit(20)
      .lean(),
    AuditLog.countDocuments({
      timestamp: { $gte: since7d },
      action: /login_failed|auth\.failed/i,
    }),
  ]);

  res.status(200).json(
    success(
      {
        failedLoginCount7d: failedLoginCount,
        recentSensitiveActions: sensitiveActions.map((d) => ({
          id: String(d._id),
          userId: String(d.userId),
          action: d.action,
          resourceType: d.resourceType,
          resourceId: d.resourceId ? String(d.resourceId) : null,
          summary: redactSnapshot(d.newValue),
          timestamp: d.timestamp instanceof Date ? d.timestamp.toISOString() : new Date().toISOString(),
        })),
        recentExports: reportExports.map((d) => ({
          id: String(d._id),
          userId: String(d.userId),
          summary: redactSnapshot(d.newValue),
          timestamp: d.timestamp instanceof Date ? d.timestamp.toISOString() : new Date().toISOString(),
        })),
      },
      req.requestId,
    ),
  );
});
