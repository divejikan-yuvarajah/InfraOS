import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { exposureQuerySchema, featureParamsSchema, layerQuerySchemas, nearbyQuerySchema } from "./inframap.geo.js";
import { assetLayer, exposure, featureDetail, nearby, riskLayer } from "./inframap.context.service.js";
import { conflictLayer, layersInfo, projectLayer, roadworkLayer, type LayerResult } from "./inframap.service.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";

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

type Bbox4 = [number, number, number, number];

function layerRoute(kind: keyof typeof layerQuerySchemas, read: (actor: AuthenticatedActor, bbox: Bbox4, filters: Record<string, string | undefined>) => Promise<LayerResult>) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const actor = req.actor;
    if (!actor) return;
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = layerQuerySchemas[kind].safeParse(req.query);
    if (repeated || !parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    try {
      const { bbox, ...filters } = parsed.data as { bbox: Bbox4 } & Record<string, string | undefined>;
      const result = await read(actor, bbox, filters);
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

// Every route needs the map permission plus the layer's own data permission; scope is applied in the data layer.
const MAP = "map.view.internal" as const;
inframapRouter.get("/layers", requireAuthenticated, requirePermission(MAP), readLimiter, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  if (!req.actor) return;
  if (Object.keys(req.query).length > 0) {
    res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
    return;
  }
  try {
    res.status(200).json(success(await layersInfo(req.actor), req.requestId));
  } catch {
    res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
  }
});
inframapRouter.get("/projects", requireAuthenticated, requirePermission(MAP), requirePermission("project.read"), readLimiter, layerRoute("projects", projectLayer));
inframapRouter.get("/roadworks", requireAuthenticated, requirePermission(MAP), requirePermission("roadsync.work_request.read"), readLimiter, layerRoute("roadworks", roadworkLayer));
inframapRouter.get("/conflicts", requireAuthenticated, requirePermission(MAP), requirePermission("roadsync.conflict.read"), readLimiter, layerRoute("conflicts", conflictLayer));

inframapRouter.get("/assets", requireAuthenticated, requirePermission(MAP), requirePermission("asset.read"), readLimiter, layerRoute("assets", (a, b, f) => assetLayer(a, b, "assets", f)));
inframapRouter.get("/utilities", requireAuthenticated, requirePermission(MAP), requirePermission("asset.read"), readLimiter, layerRoute("utilities", (a, b, f) => assetLayer(a, b, "utilities", f)));
inframapRouter.get("/risks", requireAuthenticated, requirePermission(MAP), requirePermission("risk.read"), readLimiter, layerRoute("risks", riskLayer));

type Outcome = { ok: true; data: unknown } | { ok: false; status: number; code: string };
/** One wrapper for the lookup routes: strict parse, no-store, honest failure codes, no internals. */
function lookupRoute(parse: (req: Request) => { ok: true; run: (actor: AuthenticatedActor) => Promise<Outcome> } | { ok: false }) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    if (!req.actor) return;
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const parsed = repeated ? { ok: false as const } : parse(req);
    if (!parsed.ok) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    try {
      const result = await parsed.run(req.actor);
      if (result.ok) { res.status(200).json(success(result.data, req.requestId)); return; }
      const code = result.status === 404 ? "NOT_FOUND" : result.status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE";
      res.status(result.status).json(failure(code, "request could not be completed", req.requestId));
    } catch {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}

inframapRouter.get("/exposure", requireAuthenticated, requirePermission(MAP), readLimiter, lookupRoute((req) => {
  const q = exposureQuerySchema.safeParse(req.query);
  return q.success ? { ok: true, run: (actor) => exposure(actor, q.data.layer, q.data.id) } : { ok: false };
}));
inframapRouter.get("/nearby", requireAuthenticated, requirePermission(MAP), readLimiter, lookupRoute((req) => {
  const q = nearbyQuerySchema.safeParse(req.query);
  return q.success ? { ok: true, run: (actor) => nearby(actor, q.data.featureLayer, q.data.featureId, Number(q.data.radiusM), q.data.layers) } : { ok: false };
}));
inframapRouter.get("/features/:layer/:id", requireAuthenticated, requirePermission(MAP), readLimiter, lookupRoute((req) => {
  const q = featureParamsSchema.safeParse({ ...req.params, ...(Object.keys(req.query).length ? { extra: 1 } : {}) });
  return q.success ? { ok: true, run: (actor) => featureDetail(actor, q.data.layer, q.data.id) } : { ok: false };
}));
