import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { isPermission, type Permission } from "@infraos/shared-types";

import { failure } from "../../../shared/http/envelope.js";
import { logger } from "../../../shared/logger.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";

/**
 * Step 45 grant check. It runs only after requireAuthenticated has set req.actor.
 * Permissions come from the current Role document. The JWT, role label, and seed
 * defaults are not grants. Step 46 still has to apply agency and resource scope.
 */

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function reject(
  res: Response,
  req: Request,
  status: 401 | 403 | 500 | 503,
  code: "AUTH_REQUIRED" | "FORBIDDEN" | "SERVICE_UNAVAILABLE",
): void {
  noStore(res);
  const message =
    status === 403
      ? "request could not be completed"
      : status === 401
        ? "sign-in is required"
        : "sign-in is temporarily unavailable";
  res.status(status).json(failure(code, message, req.requestId));
}

export function hasPermission(
  granted: readonly string[],
  required: Permission,
): boolean {
  if (!isPermission(required) || required.includes("*")) return false;
  return granted.some((grant) => grant === required);
}

export function requirePermission(
  permission: Permission,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async function requirePermissionMiddleware(req, res, next) {
    try {
      noStore(res);
      if (!isPermission(permission) || permission.includes("*")) {
        reject(res, req, 500, "SERVICE_UNAVAILABLE");
        return;
      }
      const actor = req.actor;
      if (!actor?.userId || !actor.roleId || !actor.roleKey) {
        reject(res, req, 401, "AUTH_REQUIRED");
        return;
      }
      if (mongoose.connection.readyState !== 1) {
        reject(res, req, 503, "SERVICE_UNAVAILABLE");
        return;
      }
      const user = await User.findById(actor.userId).select("roleId");
      if (!user?.roleId || user.roleId.toString() !== actor.roleId) {
        reject(res, req, 401, "AUTH_REQUIRED");
        return;
      }
      const role = await Role.findById(actor.roleId);
      if (!role?.isActive || role.key !== actor.roleKey) {
        reject(res, req, 401, "AUTH_REQUIRED");
        return;
      }
      const granted = Array.isArray(role.permissions) ? role.permissions : [];
      if (!hasPermission(granted, permission)) {
        logger.info(
          { requestId: req.requestId, decision: "deny", permission },
          "permission denied",
        );
        reject(res, req, 403, "FORBIDDEN");
        return;
      }
      next();
    } catch {
      logger.warn({ requestId: req.requestId }, "permission lookup failed");
      reject(res, req, 503, "SERVICE_UNAVAILABLE");
    }
  };
}
