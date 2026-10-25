import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { requirePermission } from "../authorization/require-permission.js";
import { requireAuthenticated } from "../auth/require-authenticated.js";
import { isJsonContentType } from "../auth/auth.security.js";
import {
  adminUserAssignmentSchema,
  adminUserCreateSchema,
  adminUserNamePatchSchema,
  adminUserRevisionSchema,
  parseAdminUserListQuery,
} from "./admin-user.schema.js";
import {
  AdminUserDependencyError,
  assignAdminUser,
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminUser,
  listAdminUsers,
  updateAdminUserName,
} from "./admin-user.service.js";
import type { AdminUserFailure } from "./admin-user.types.js";

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
  result: AdminUserFailure,
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

export const adminUserRouter = Router();

adminUserRouter.get("/", requireAuthenticated, requirePermission("user.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const query = parseAdminUserListQuery(req.query);
    if (!query) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await listAdminUsers(actor, query);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success(result.list, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.get("/:id", requireAuthenticated, requirePermission("user.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await getAdminUser(actor, routeId(req.params.id));
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ user: result.user }, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.post("/", requireAuthenticated, requirePermission("user.create"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = adminUserCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await createAdminUser(actor, parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(201).json(
      success(
        {
          user: result.user,
          activationDelivery: "BLOCKED",
          notice: "Activation delivery unavailable",
        },
        req.requestId,
      ),
    );
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.patch("/:id", requireAuthenticated, requirePermission("user.update"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = adminUserNamePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await updateAdminUserName(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ user: result.user }, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.post("/:id/disable", requireAuthenticated, requirePermission("user.disable"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = adminUserRevisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await disableAdminUser(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ user: result.user }, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.post("/:id/enable", requireAuthenticated, requirePermission("user.disable"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = adminUserRevisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await enableAdminUser(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ user: result.user }, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

adminUserRouter.post("/:id/assignment", requireAuthenticated, requirePermission("user.update"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = adminUserAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await assignAdminUser(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ user: result.user }, req.requestId));
  } catch (error) {
    if (error instanceof AdminUserDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});
