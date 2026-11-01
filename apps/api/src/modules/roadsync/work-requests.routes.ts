import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { WORK_REQUEST_LIST_KEYS, workRequestCreateSchema, workRequestListQuerySchema } from "./work-requests.schema.js";
import { WorkRequestDependencyError, createWorkRequest, getWorkRequest, listWorkRequests, mapWorkRequests, type WorkRequestFailure } from "./work-requests.service.js";
import { extractCandidates, validateWorkGeometry } from "./geo.service.js";
import { workRequestMapQuerySchema } from "./work-requests.schema.js";
import { assessmentRouter } from "./assessment.routes.js";
import { detectionRouter } from "./detection.routes.js";

type Res = { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void };

function noStore(res: Res): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function sendFailure(res: Res, req: { requestId: string }, result: WorkRequestFailure): void {
  const message = result.status === 503 ? "service is temporarily unavailable" : result.status === 401 ? "sign-in is required" : result.status === 404 ? "resource was not found" : "request could not be completed";
  res.status(result.status).json(failure(result.code, message, req.requestId, result.details ?? null));
}

function unavailable(res: Res, req: { requestId: string }): void {
  res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
}

export const roadsyncRouter = Router();
roadsyncRouter.use(detectionRouter);
roadsyncRouter.use(assessmentRouter);

roadsyncRouter.get("/work-requests", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const unknown = Object.keys(req.query).some((key) => !(WORK_REQUEST_LIST_KEYS as readonly string[]).includes(key));
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = workRequestListQuerySchema.safeParse(req.query);
    if (unknown || repeated || !parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await listWorkRequests(actor, parsed.data);
    if (!result.ok) return sendFailure(res, req, result);
    res.status(200).json(success(result.list, req.requestId));
  } catch (error) {
    if (error instanceof WorkRequestDependencyError) return unavailable(res, req);
    throw error;
  }
});

roadsyncRouter.get("/work-requests/map", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = workRequestMapQuerySchema.safeParse(req.query);
    if (repeated || !parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await mapWorkRequests(actor, parsed.data);
    if (!result.ok) return sendFailure(res, req, result);
    res.status(200).json(success(result.map, req.requestId));
  } catch (error) {
    if (error instanceof WorkRequestDependencyError) return unavailable(res, req);
    throw error;
  }
});

/** Step 67: authoritative geometry check used live by the picker and by GeoJSON import. Pure; stores nothing. */
roadsyncRouter.post("/geo/validate", requireAuthenticated, requirePermission("roadsync.work_request.read"), (req, res) => {
  noStore(res);
  if (!isJsonContentType(req)) {
    res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
    return;
  }
  const body = (req.body ?? {}) as { geojson?: unknown };
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "geojson")) {
    res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
    return;
  }
  const extracted = extractCandidates(body.geojson);
  if ("error" in extracted) {
    res.status(200).json(success({ valid: false, errors: [extracted.error], warnings: [], candidates: [] }, req.requestId));
    return;
  }
  if (extracted.candidates.length > 1) {
    const candidates = extracted.candidates.map((c) => {
      const r = validateWorkGeometry(c.geometry);
      return { index: c.index, label: c.label, type: String((c.geometry as { type?: unknown }).type), valid: r.valid };
    });
    res.status(200).json(success({ valid: false, errors: [], warnings: extracted.skipped ? [extracted.skipped + " unsupported feature(s) skipped."] : [], candidates }, req.requestId));
    return;
  }
  const result = validateWorkGeometry(extracted.candidates[0]!.geometry);
  res.status(200).json(success({ ...result, candidates: [] }, req.requestId));
});

roadsyncRouter.get("/work-requests/:id", requireAuthenticated, requirePermission("roadsync.work_request.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] ?? "" : req.params.id ?? "";
    const result = await getWorkRequest(actor, id);
    if (!result.ok) return sendFailure(res, req, result);
    res.status(200).json(success({ workRequest: result.workRequest }, req.requestId));
  } catch (error) {
    if (error instanceof WorkRequestDependencyError) return unavailable(res, req);
    throw error;
  }
});

roadsyncRouter.post("/work-requests", requireAuthenticated, requirePermission("roadsync.work_request.create"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = workRequestCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await createWorkRequest(actor, parsed.data, req.requestId);
    if (!result.ok) return sendFailure(res, req, result);
    res.status(201).json(success({ workRequest: result.workRequest }, req.requestId));
  } catch (error) {
    if (error instanceof WorkRequestDependencyError) return unavailable(res, req);
    throw error;
  }
});
