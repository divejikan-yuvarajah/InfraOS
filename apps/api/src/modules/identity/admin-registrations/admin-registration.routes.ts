import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { isJsonContentType } from "../auth/auth.security.js";
import { requireAuthenticated } from "../auth/require-authenticated.js";
import { requirePermission } from "../authorization/require-permission.js";
import {
  adminRegistrationApproveSchema,
  adminRegistrationListQuerySchema,
  adminRegistrationRejectSchema,
} from "./admin-registration.schema.js";
import {
  approveRegistrationRequest,
  getRegistrationRequest,
  listRegistrationRequests,
  rejectRegistrationRequest,
} from "./admin-registration.service.js";

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function routeId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const adminRegistrationRouter = Router();

adminRegistrationRouter.get(
  "/",
  requireAuthenticated,
  requirePermission("user.read"),
  async (req, res, next) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;

      const parsedQuery = adminRegistrationListQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        res.status(400).json(failure("VALIDATION_ERROR", "Invalid query parameters", req.requestId));
        return;
      }

      const result = await listRegistrationRequests(actor, parsedQuery.data);
      res.status(200).json(success(result, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

adminRegistrationRouter.get(
  "/:id",
  requireAuthenticated,
  requirePermission("user.read"),
  async (req, res, next) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;

      const id = routeId(req.params.id);
      const result = await getRegistrationRequest(actor, id);
      if (!result) {
        res.status(404).json(failure("NOT_FOUND", "Registration request not found", req.requestId));
        return;
      }

      res.status(200).json(success({ request: result }, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

adminRegistrationRouter.post(
  "/:id/approve",
  requireAuthenticated,
  requirePermission("user.create"),
  async (req, res, next) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;

      if (!isJsonContentType(req)) {
        res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
        return;
      }

      const parsed = adminRegistrationApproveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid approval parameters", req.requestId));
        return;
      }

      const id = routeId(req.params.id);
      const result = await approveRegistrationRequest(actor, id, parsed.data, req.requestId);
      if (!result.ok) {
        res.status(result.status).json(failure(result.code, result.message, req.requestId));
        return;
      }

      res.status(200).json(success(result, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

adminRegistrationRouter.post(
  "/:id/reject",
  requireAuthenticated,
  requirePermission("user.create"),
  async (req, res, next) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;

      if (!isJsonContentType(req)) {
        res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
        return;
      }

      const parsed = adminRegistrationRejectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid rejection parameters", req.requestId));
        return;
      }

      const id = routeId(req.params.id);
      const result = await rejectRegistrationRequest(actor, id, parsed.data, req.requestId);
      if (!result.ok) {
        res.status(result.status).json(failure(result.code, result.message, req.requestId));
        return;
      }

      res.status(200).json(success(result, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

