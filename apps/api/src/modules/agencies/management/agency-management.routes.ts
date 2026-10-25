import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { isJsonContentType } from "../../identity/auth/auth.security.js";
import { requireAuthenticated } from "../../identity/auth/require-authenticated.js";
import { requirePermission } from "../../identity/authorization/require-permission.js";
import {
  agencyCreateSchema,
  agencyDeactivateSchema,
  agencyMetadataPatchSchema,
  agencyReparentSchema,
  parseAgencyListQuery,
} from "./agency-management.schema.js";
import {
  AgencyManagementDependencyError,
  createAgency,
  deactivateAgency,
  getAgency,
  listAgencies,
  reparentAgency,
  updateAgencyMetadata,
} from "./agency-management.service.js";
import type { AgencyFailure } from "./agency-management.types.js";

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
  result: AgencyFailure,
): void {
  const message =
    result.status === 503
      ? "sign-in is temporarily unavailable"
      : result.status === 401
        ? "sign-in is required"
        : result.status === 404
          ? "resource was not found"
          : "request could not be completed";
  res.status(result.status).json(failure(result.code, message, req.requestId, result.details ?? null));
}

async function unavailable(res: { status: (code: number) => { json: (body: unknown) => void } }, requestId: string) {
  res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", requestId));
}

export const agencyManagementRouter = Router();

agencyManagementRouter.get("/", requireAuthenticated, requirePermission("agency.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const query = parseAgencyListQuery(req.query);
    if (!query) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await listAgencies(actor, query);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success(result.list, req.requestId));
  } catch (error) {
    if (error instanceof AgencyManagementDependencyError) {
      await unavailable(res, req.requestId);
      return;
    }
    throw error;
  }
});

agencyManagementRouter.get("/:id", requireAuthenticated, requirePermission("agency.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await getAgency(actor, routeId(req.params.id));
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ agency: result.agency }, req.requestId));
  } catch (error) {
    if (error instanceof AgencyManagementDependencyError) {
      await unavailable(res, req.requestId);
      return;
    }
    throw error;
  }
});

agencyManagementRouter.post("/", requireAuthenticated, requirePermission("agency.manage"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = agencyCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await createAgency(actor, parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(201).json(success({ agency: result.agency }, req.requestId));
  } catch (error) {
    if (error instanceof AgencyManagementDependencyError) {
      await unavailable(res, req.requestId);
      return;
    }
    throw error;
  }
});

agencyManagementRouter.patch("/:id", requireAuthenticated, requirePermission("agency.manage"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = agencyMetadataPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await updateAgencyMetadata(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ agency: result.agency }, req.requestId));
  } catch (error) {
    if (error instanceof AgencyManagementDependencyError) {
      await unavailable(res, req.requestId);
      return;
    }
    throw error;
  }
});

agencyManagementRouter.post("/:id/reparent", requireAuthenticated, requirePermission("agency.manage"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = agencyReparentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await reparentAgency(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ agency: result.agency }, req.requestId));
  } catch (error) {
    if (error instanceof AgencyManagementDependencyError) {
      await unavailable(res, req.requestId);
      return;
    }
    throw error;
  }
});

agencyManagementRouter.post(
  "/:id/deactivate",
  requireAuthenticated,
  requirePermission("agency.manage"),
  async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;
      if (!isJsonContentType(req)) {
        res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
        return;
      }
      const parsed = agencyDeactivateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
        return;
      }
      const result = await deactivateAgency(actor, routeId(req.params.id), parsed.data, req.requestId);
      if (!result.ok) {
        sendFailure(res, req, result);
        return;
      }
      res.status(200).json(success({ agency: result.agency }, req.requestId));
    } catch (error) {
      if (error instanceof AgencyManagementDependencyError) {
        await unavailable(res, req.requestId);
        return;
      }
      throw error;
    }
  },
);
