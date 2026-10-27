import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { projectCreateSchema, projectListQuerySchema, projectPatchSchema, projectTransitionSchema } from "./projects.schema.js";
import { ProjectDependencyError, createProject, getProject, listProjectCatalog, transitionProject, updateProjectDraft } from "./projects.service.js";
import type { ProjectFailure } from "./projects.types.js";

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
  result: ProjectFailure,
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

export const projectRouter = Router();

projectRouter.get("/", requireAuthenticated, requirePermission("project.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const unknown = Object.keys(req.query).filter((key) => !["page", "limit", "status", "type", "q", "agencyId", "sortBy", "sortDir"].includes(key));
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    if (unknown.length > 0 || repeated) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const parsed = projectListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await listProjectCatalog(actor, parsed.data);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success(result.list, req.requestId));
  } catch (error) {
    if (error instanceof ProjectDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

projectRouter.get("/:id", requireAuthenticated, requirePermission("project.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await getProject(actor, routeId(req.params.id));
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ project: result.project }, req.requestId));
  } catch (error) {
    if (error instanceof ProjectDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

projectRouter.post("/", requireAuthenticated, requirePermission("project.create"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = projectCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await createProject(actor, parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(201).json(success({ project: result.project }, req.requestId));
  } catch (error) {
    if (error instanceof ProjectDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

projectRouter.post("/:id/transition", requireAuthenticated, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = projectTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await transitionProject(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ project: result.project }, req.requestId));
  } catch (error) {
    if (error instanceof ProjectDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

projectRouter.patch("/:id", requireAuthenticated, requirePermission("project.update"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = projectPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await updateProjectDraft(actor, routeId(req.params.id), parsed.data, req.requestId);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ project: result.project }, req.requestId));
  } catch (error) {
    if (error instanceof ProjectDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});
