import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { createHash } from "node:crypto";

import { z } from "zod";

import { exposureQuerySchema, nearbyQuerySchema, bboxField } from "./inframap.geo.js";
import { assetLayer, exposure, nearby, riskLayer } from "./inframap.context.service.js";
import { featureDetailAll } from "./inframap.detail.service.js";
import { LAYER_IDS, normalizeFilters, parseLayerQuery, unifiedFilterShape, type LayerId, type LayerQ } from "./inframap.filters.js";
import { facets, health, search } from "./inframap.search.service.js";
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

/**
 * Layer reads are the one place that is NOT `no-store`: they send `Cache-Control: private, no-cache` plus a weak ETag, so
 * the browser always revalidates and an unchanged layer answers 304 with no body. "private" keeps shared caches out, the
 * ETag is a hash of this user's own response, and `Vary: Authorization` stops another user's cached copy being reused.
 * Everything else in this router (search, facets, health, detail, lookups) stays `no-store`.
 */
function layerRoute(kind: LayerId, read: (actor: AuthenticatedActor, bbox: Bbox4, q: LayerQ) => Promise<LayerResult>) {
  return async (req: Request, res: Response) => {
    const actor = req.actor;
    if (!actor) return;
    const parsed = parseLayerQuery(kind, req.query);
    if (!parsed.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    try {
      const result = await read(actor, parsed.q.bbox, parsed.q);
      if (result.ok) {
        const { generatedAt: _generatedAt, ...stable } = result.layer;
        void _generatedAt;
        const etag = `W/"${createHash("sha1").update(JSON.stringify(stable)).digest("base64url").slice(0, 27)}"`;
        res.setHeader("Cache-Control", "private, no-cache");
        res.setHeader("Vary", "Authorization");
        res.setHeader("ETag", etag);
        if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
        res.status(200).json(success({ ...result.layer, generatedAt: result.layer.generatedAt ?? new Date().toISOString() }, req.requestId));
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      const code = result.status === 404 ? "NOT_FOUND" : result.status === 403 ? "FORBIDDEN" : result.status === 401 ? "AUTH_REQUIRED" : result.status === 400 ? "VALIDATION_ERROR" : result.status === 409 ? "CONFLICT" : "SERVICE_UNAVAILABLE";
      res.status(result.status).json(failure(code, "request could not be completed", req.requestId));
    } catch {
      res.setHeader("Cache-Control", "no-store");
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

inframapRouter.get("/assets", requireAuthenticated, requirePermission(MAP), requirePermission("asset.read"), readLimiter, layerRoute("assets", (a, b, q) => assetLayer(a, b, "assets", q)));
inframapRouter.get("/utilities", requireAuthenticated, requirePermission(MAP), requirePermission("asset.read"), readLimiter, layerRoute("utilities", (a, b, q) => assetLayer(a, b, "utilities", q)));
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

const featureParamsSchema = z.object({ layer: z.enum(LAYER_IDS as unknown as [LayerId, ...LayerId[]]), id: z.string().regex(/^[a-f0-9]{24}$/i) }).strict();

// Search, facets and health are tighter than layer reads: they run regex and aggregate queries.
const heavyLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId));
  },
});

const SEARCH_LAYERS = [...LAYER_IDS, "agencies", "places"] as const;
const searchSchema = z.object({
  q: z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(80).refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "control")),
  layers: z.string().max(120).transform((v) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))]).pipe(z.array(z.enum(SEARCH_LAYERS)).min(1).max(8)).optional(),
  scope: z.enum(["view", "all"]).optional(),
  bbox: bboxField.optional(),
  limit: z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(1).max(15)).optional(),
  ...unifiedFilterShape,
}).strict();
const facetsSchema = z.object({ bbox: bboxField.optional(), ...unifiedFilterShape }).strict();

inframapRouter.get("/search", requireAuthenticated, requirePermission(MAP), heavyLimiter, lookupRoute((req) => {
  const q = searchSchema.safeParse(req.query);
  if (!q.success) return { ok: false };
  const norm = normalizeFilters(null, q.data as Record<string, unknown>);
  if (!norm.ok) return { ok: false };
  const { q: text, layers, scope, bbox, limit } = q.data;
  return { ok: true, run: async (actor) => ({ ok: true as const, data: await search(actor, { q: text, layers: layers ?? SEARCH_LAYERS, scope: scope ?? "all", ...(bbox ? { bbox } : {}), limit: limit ?? 8, nf: norm.nf }) }) };
}));
inframapRouter.get("/facets", requireAuthenticated, requirePermission(MAP), heavyLimiter, lookupRoute((req) => {
  const q = facetsSchema.safeParse(req.query);
  if (!q.success) return { ok: false };
  const norm = normalizeFilters(null, q.data as Record<string, unknown>);
  if (!norm.ok) return { ok: false };
  return { ok: true, run: async (actor) => ({ ok: true as const, data: await facets(actor, norm.nf, q.data.bbox) }) };
}));
inframapRouter.get("/health", requireAuthenticated, requirePermission(MAP), heavyLimiter, lookupRoute((req) =>
  Object.keys(req.query).length === 0 ? { ok: true, run: async (actor) => ({ ok: true as const, data: await health(actor) }) } : { ok: false },
));
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
  return q.success ? { ok: true, run: (actor) => featureDetailAll(actor, q.data.layer, q.data.id) } : { ok: false };
}));
