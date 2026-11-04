import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { bboxQuerySchema } from "./inframap.geo.js";
import { conflictLayer, projectLayer, workRequestLayer, type LayerResult } from "./inframap.service.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import type { Bbox } from "./inframap.geo.js";

/** Step 81-84 read-only map layers. Every route needs a session and the layer's own read permission; scope is applied in the data layer. */
export const inframapRouter = Router();

const readLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId));
  },
});

function layerRoute(read: (actor: AuthenticatedActor, bbox: Bbox) => Promise<LayerResult>) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const actor = req.actor;
    if (!actor) return;
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = bboxQuerySchema.safeParse(req.query);
    if (repeated || !parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    try {
      const result = await read(actor, parsed.data.bbox);
      if (result.ok) {
        res.status(200).json(success(result.layer, req.requestId));
        return;
      }
      const code = result.status === 404 ? "NOT_FOUND" : result.status === 403 ? "FORBIDDEN" : result.status === 401 ? "AUTH_REQUIRED" : result.status === 400 ? "VALIDATION_ERROR" : result.status === 409 ? "CONFLICT" : "SERVICE_UNAVAILABLE";
      res.status(result.status).json(failure(code, "request could not be completed", req.requestId));
    } catch {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}

inframapRouter.get("/projects", requireAuthenticated, requirePermission("project.read"), readLimiter, layerRoute(projectLayer));
inframapRouter.get("/work-requests", requireAuthenticated, requirePermission("roadsync.work_request.read"), readLimiter, layerRoute(workRequestLayer));
inframapRouter.get("/conflicts", requireAuthenticated, requirePermission("roadsync.conflict.read"), readLimiter, layerRoute(conflictLayer));
