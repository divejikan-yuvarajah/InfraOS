import mongoose from "mongoose";
import { Router, type NextFunction, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { audit, whoIs, type Who } from "./conflict-record.service.js";
import { agencyExists, dashboardAgencies, dashboardBrief, dashboardCalendar, dashboardCsv, dashboardMap, dashboardOverview, knownDistricts, resolveRange, SCORECARD_SORTS, type DashQuery } from "./dashboard.read.js";
import { RANGES } from "./dashboard.rules.js";
import { assertLive, FlowControl } from "./work-requests.service.js";

const R = "roadsync.conflict.read" as const;
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const base = { range: z.enum(RANGES).default("30d"), from: day.optional(), to: day.optional(), compare: bool.default(false), agencyId: objectId.optional(), district: z.string().trim().min(1).max(80).optional() };
const overviewSchema = z.object({ ...base, refresh: bool.optional() }).strict();
const filterSchema = z.object(base).strict();
const agenciesSchema = z.object({ ...base, sort: z.enum(SCORECARD_SORTS).default("healthScore") }).strict();

const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : perMinute, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
const readLimiter = limiter(120);
const exportLimiter = limiter(10);
const refreshLimiter = limiter(6);
const refreshOnly = (req: Request, res: Response, next: NextFunction) => (req.query.refresh === "true" ? refreshLimiter(req, res, next) : next());

const bad = (res: Response, req: Request) => void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
const forbidden = (res: Response, req: Request) => void res.status(403).json(failure("FORBIDDEN", "not permitted", req.requestId));
const canRespond = async (actor: AuthenticatedActor) => { try { await assertLive(actor, ["roadsync.coordination.respond"]); return true; } catch { return false; } };
type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who; canWrite: boolean };

function handle(fn: (c: Ctx) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [R]);
      await fn({ req, res, actor, w: await whoIs(actor), canWrite: await canRespond(actor) });
    } catch (error) {
      if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}

/**
 * Scope comes from the token, never the client. Only national viewers may narrow by agency or district, and both
 * values must exist in what the viewer can read (so the filter cannot probe for other agencies or districts).
 */
async function parse(c: Ctx, schema: z.ZodType) {
  const p = schema.safeParse(c.req.query);
  if (!p.success) { bad(c.res, c.req); return null; }
  const q = p.data as DashQuery;
  if ((q.agencyId || q.district) && !c.w.national) { forbidden(c.res, c.req); return null; }
  if (q.refresh && !c.w.national) { forbidden(c.res, c.req); return null; }
  const range = resolveRange(q);
  if (!range || (q.range !== "custom" && (q.from || q.to))) { bad(c.res, c.req); return null; }
  if (q.agencyId && !(await agencyExists(q.agencyId))) { bad(c.res, c.req); return null; }
  if (q.district && !(await knownDistricts(c.w)).includes(q.district)) { bad(c.res, c.req); return null; }
  return { q, range, data: p.data };
}

export const dashboardRouter = Router();
const auth = [requireAuthenticated, requirePermission(R)] as const;

dashboardRouter.get("/dashboard/overview", ...auth, readLimiter, refreshOnly, handle(async (c) => {
  const p = await parse(c, overviewSchema);
  if (p) c.res.json(success(await dashboardOverview(c.w, p.q, p.range, c.canWrite), c.req.requestId));
}));
dashboardRouter.get("/dashboard/map", ...auth, readLimiter, handle(async (c) => {
  const p = await parse(c, filterSchema);
  if (p) c.res.json(success(await dashboardMap(c.w, p.q, p.range), c.req.requestId));
}));
dashboardRouter.get("/dashboard/calendar", ...auth, readLimiter, handle(async (c) => {
  const p = await parse(c, filterSchema);
  if (p) c.res.json(success(await dashboardCalendar(c.w, p.q, p.range), c.req.requestId));
}));
dashboardRouter.get("/dashboard/agencies", ...auth, readLimiter, handle(async (c) => {
  const p = await parse(c, agenciesSchema);
  if (p) c.res.json(success(await dashboardAgencies(c.w, p.q, p.range, (p.data as { sort: (typeof SCORECARD_SORTS)[number] }).sort), c.req.requestId));
}));
dashboardRouter.get("/dashboard/brief", ...auth, readLimiter, handle(async (c) => {
  const p = await parse(c, filterSchema);
  if (p) c.res.json(success(await dashboardBrief(c.w, p.q, p.range, c.canWrite), c.req.requestId));
}));
dashboardRouter.get("/dashboard/export.csv", ...auth, exportLimiter, handle(async (c) => {
  const p = await parse(c, filterSchema);
  if (!p) return;
  const { body, count } = await dashboardCsv(c.w, p.q, p.range, c.canWrite);
  await audit({ type: "user", userId: c.actor.userId, agencyId: c.actor.agencyId }, "exported", { _id: new mongoose.Types.ObjectId() }, "exported", `dashboard rows ${count}`);
  c.res.setHeader("Content-Type", "text/csv; charset=utf-8");
  c.res.setHeader("Content-Disposition", `attachment; filename="roadsync-dashboard-${new Date().toISOString().slice(0, 10)}.csv"`);
  c.res.status(200).send(body);
}));
