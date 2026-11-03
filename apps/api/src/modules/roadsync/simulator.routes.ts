import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { whoIs, type Who } from "./conflict-record.service.js";
import { deleteScenario, listScenarios, saveScenario, simulate, SIM, SIM_HOURS, SIM_MEASURES, type Lever } from "./simulator.js";
import { assertLive, FlowControl } from "./work-requests.service.js";

const R = "roadsync.conflict.read" as const;
const W = "roadsync.coordination.respond" as const;
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const iso = z.string().datetime({ offset: true });
const hours = z.enum(SIM_HOURS);
const lever = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("shift"), requestId: id, start: iso, end: iso }).strict(),
  z.object({ kind: z.literal("hours"), requestId: id, workingHours: hours }).strict(),
  z.object({ kind: z.literal("buffer"), days: z.number().int().min(0).max(SIM.MAX_BUFFER_DAYS) }).strict(),
  z.object({ kind: z.literal("sequence"), firstRequestId: id, secondRequestId: id, gapDays: z.number().int().min(0).max(SIM.MAX_BUFFER_DAYS) }).strict(),
  z.object({ kind: z.literal("traffic"), requestId: id, measures: z.array(z.enum(SIM_MEASURES)).min(1).max(SIM_MEASURES.length) }).strict(),
  z.object({ kind: z.literal("cancel"), requestId: id }).strict(),
  z.object({ kind: z.literal("ghost"), sourceRequestId: id, start: iso, end: iso, workingHours: hours.optional() }).strict(),
  z.object({ kind: z.literal("replay"), coordinationRequestId: id }).strict(),
]);
const levers = z.array(lever).max(SIM.MAX_LEVERS);
const noControl = (v: string) => ![...v].some((c) => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127);
const simBody = z.object({ levers }).strict();
const saveBody = z.object({ name: z.string().trim().min(1).max(80).refine((v) => noControl(v) && !v.includes("$"), "unsafe text"), visibility: z.enum(["private", "agency", "national"]), levers }).strict();

const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : perMinute, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
const readLimiter = limiter(120), simLimiter = limiter(30), writeLimiter = limiter(30);
const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const bad = (res: Response, req: Request, code = "VALIDATION_ERROR") => void res.status(400).json(failure(code, "request could not be completed", req.requestId));
const notFound = (res: Response, req: Request) => void res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));
type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who };

/** Writes (saving a scenario) need the respond permission unless national; reads and runs need conflict read. */
function handle(perm: typeof R | typeof W, fn: (c: Ctx) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [R]);
      const w = await whoIs(actor);
      if (perm === W && !w.national) await assertLive(actor, [W]);
      await fn({ req, res, actor, w });
    } catch (error) {
      if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}
const jsonOnly = (c: Ctx) => { if (isJsonContentType(c.req)) return true; c.res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", c.req.requestId)); return false; };

export const simulatorRouter = Router();
const auth = [requireAuthenticated, requirePermission(R)] as const;

simulatorRouter.post("/conflicts/:id/simulate", ...auth, simLimiter, handle(R, async (c) => {
  if (!jsonOnly(c)) return;
  const b = simBody.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  const out = await simulate(c.w, idOf(c.req.params.id), b.data.levers as Lever[]);
  if (!out.ok) return out.status === 404 ? notFound(c.res, c.req) : bad(c.res, c.req, out.code.toUpperCase());
  c.res.json(success({ result: out.result }, c.req.requestId));
}));
simulatorRouter.get("/conflicts/:id/scenarios", ...auth, readLimiter, handle(R, async (c) => {
  const out = await listScenarios(c.w, idOf(c.req.params.id));
  if (!out) return notFound(c.res, c.req);
  c.res.json(success({ items: out }, c.req.requestId));
}));
simulatorRouter.post("/conflicts/:id/scenarios", ...auth, writeLimiter, handle(W, async (c) => {
  if (!jsonOnly(c)) return;
  const b = saveBody.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  const out = await saveScenario(c.w, idOf(c.req.params.id), b.data as { name: string; visibility: "private" | "agency" | "national"; levers: Lever[] });
  if (out.ok) return void c.res.status(201).json(success({ id: out.id }, c.req.requestId));
  if (out.status === 404) return notFound(c.res, c.req);
  if (out.status === 409) return void c.res.status(409).json(failure("CONFLICT", "request could not be completed", c.req.requestId));
  bad(c.res, c.req, out.code.toUpperCase());
}));
simulatorRouter.delete("/scenarios/:id", ...auth, writeLimiter, handle(W, async (c) => {
  if (!(await deleteScenario(c.w, idOf(c.req.params.id)))) return notFound(c.res, c.req);
  c.res.json(success({ deleted: true }, c.req.requestId));
}));
