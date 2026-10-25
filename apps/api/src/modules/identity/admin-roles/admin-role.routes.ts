import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { isJsonContentType } from "../auth/auth.security.js";
import { requireAuthenticated } from "../auth/require-authenticated.js";
import { requirePermission } from "../authorization/require-permission.js";
import { roleMetadataSchema, rolePermissionsSchema } from "./admin-role.schema.js";
import {
  AdminRoleDependencyError,
  getRole,
  listRoles,
  permissionCatalog,
  updateRoleMetadata,
  updateRolePermissions,
} from "./admin-role.service.js";
import type { RoleAdminFailure } from "./admin-role.types.js";

function routeId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function sendFailure(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  req: { requestId: string },
  result: RoleAdminFailure,
): void {
  const message =
    result.status === 503
      ? "sign-in is temporarily unavailable"
      : result.status === 401
        ? "sign-in is required"
        : result.status === 404
          ? "resource was not found"
          : "request could not be completed";
  res.status(result.status).json(failure(result.code, message, req.requestId));
}

export const adminRoleRouter = Router();
export const adminPermissionRouter = Router();

adminRoleRouter.get("/", requireAuthenticated, requirePermission("role.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await listRoles(actor);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ roles: result.roles }, req.requestId));
  } catch (error) {
    if (error instanceof AdminRoleDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminRoleRouter.get("/:id", requireAuthenticated, requirePermission("role.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await getRole(actor, routeId(req.params.id));
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ role: result.role }, req.requestId));
  } catch (error) {
    if (error instanceof AdminRoleDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminRoleRouter.patch("/:id", requireAuthenticated, requirePermission("role.manage"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = roleMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await updateRoleMetadata(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ role: result.role }, req.requestId));
  } catch (error) {
    if (error instanceof AdminRoleDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminRoleRouter.put(
  "/:id/permissions",
  requireAuthenticated,
  requirePermission("role.manage"),
  requirePermission("permission.manage"),
  async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;
      if (!isJsonContentType(req)) {
        res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
        return;
      }
      const parsed = rolePermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
        return;
      }
      const result = await updateRolePermissions(actor, routeId(req.params.id), parsed.data, req.requestId);
      if (!result.ok) {
        sendFailure(res, req, result);
        return;
      }
      res.status(200).json(success({ role: result.role }, req.requestId));
    } catch (error) {
      if (error instanceof AdminRoleDependencyError) {
        res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
        return;
      }
      throw error;
    }
  },
);

adminPermissionRouter.get("/", requireAuthenticated, requirePermission("permission.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
      res.status(403).json(failure("FORBIDDEN", "request could not be completed", req.requestId));
      return;
    }
    res.status(200).json(success({ catalog: permissionCatalog() }, req.requestId));
  } catch (error) {
    if (error instanceof AdminRoleDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});
