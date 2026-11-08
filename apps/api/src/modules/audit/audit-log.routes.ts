import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { AuditLog } from "./models/audit-log.model.js";

export const adminAuditLogRouter = Router();

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

  try {
    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 50;

    const docs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const items = docs.map((doc) => ({
      id: String(doc._id),
      actorUserId: doc.actorUserId ? String(doc.actorUserId) : null,
      actorAgencyId: doc.actorAgencyId ? String(doc.actorAgencyId) : null,
      action: doc.action,
      entityType: doc.entityType,
      entityId: doc.entityId,
      outcome: doc.outcome,
      requestId: doc.requestId ?? null,
      metadata: doc.metadata ?? {},
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date().toISOString(),
    }));

    res.status(200).json(
      success(
        {
          items,
          total: items.length,
        },
        req.requestId,
      ),
    );
  } catch {
    res.status(200).json(
      success(
        {
          items: [],
          total: 0,
        },
        req.requestId,
      ),
    );
  }
});

