import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import { requireAuthenticated, type AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { DISMISS_REASONS } from "./advisor.rules.js";
import { addFeedback, adviceFor, handoff, requestAdvice, schedulePreview, stats } from "./advisor.service.js";
import { CLOSURE_TYPES, TRAFFIC_LEVEL_CODES } from "./assessment.rules.js";
import { whoIs, type Who } from "./conflict-record.service.js";
import { validateWorkGeometry } from "./geo.service.js";
import { DETECTION, WORK_PRIORITIES, WORK_TYPES, WORKING_HOURS } from "./roadsync.constants.js";
import { assertLive, FlowControl } from "./work-requests.service.js";
import { geometryInputSchema } from "./work-requests.schema.js";

const R = "roadsync.conflict.read" as const;
const W = "roadsync.coordination.respond" as const;
const WR = "roadsync.work_request.read" as const;
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const adviceQuery = z.object({ refresh: bool.default(false) }).strict();
const handoffQuery = z.object({ target: z.enum(["coordination", "resolution", "simulator"]) }).strict();
const feedbackBody = z.object({ planKey: z.string().regex(/^[a-f0-9]{12}$/).nullable().optional(), action: z.enum(["helpful", "not_helpful", "dismissed", "restored"]), reasonCode: z.enum(DISMISS_REASONS).optional() }).strict();
const instant = z.string().max(40).datetime({ offset: true });
const previewBody = z.object({
  geometry: geometryInputSchema,
  bufferMeters: z.number().finite().min(0).max(DETECTION.MAX_BUFFER_M).optional(),
  schedule: z.object({ plannedStart: instant, plannedEnd: instant, workingHours: z.enum(WORKING_HOURS).default("day"), flexibleDays: z.number().int().min(0).max(365).default(0), isEmergency: z.boolean().default(false) }).strict(),
  subject: z.object({
    workType: z.enum(WORK_TYPES).optional(), priority: z.enum(WORK_PRIORITIES).optional(), isEmergency: z.boolean().optional(),
    trafficImpact: z.object({ level: z.enum(TRAFFIC_LEVEL_CODES as [string, ...string[]]), closureType: z.enum(CLOSURE_TYPES).nullable().optional() }).strict().optional(),
  }).strict().optional(),
}).strict();

const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : perMinute, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
const computeLimiter = limiter(10), wizardLimiter = limiter(20), feedbackLimiter = limiter(30), readLimiter = limiter(120);
const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const bad = (res: Response, req: Request, code = "VALIDATION_ERROR") => void res.status(400).json(failure(code, "request could not be completed", req.requestId));
const notFound = (res: Response, req: Request) => void res.status(404).json(failure("NOT_FOUND", "resource was not found", req.requestId));
const forbidden = (res: Response, req: Request) => void res.status(403).json(failure("FORBIDDEN", "not permitted", req.requestId));
type Ctx = { req: Request; res: Response; actor: AuthenticatedActor; w: Who; canWrite: boolean };

async function canRespond(actor: AuthenticatedActor, w: Who): Promise<boolean> {
  if (w.national) return true;
  try { await assertLive(actor, [W]); return true; } catch { return false; }
}
function handle(fn: (c: Ctx) => Promise<void>, perm: typeof R | typeof WR = R) {
  return async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const actor = req.actor;
      if (!actor) return;
      await assertLive(actor, [perm]);
      const w = await whoIs(actor);
      await fn({ req, res, actor, w, canWrite: await canRespond(actor, w) });
    } catch (error) {
      if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
    }
  };
}
const withRefresh = (c: Ctx) => {
  const q = adviceQuery.safeParse(c.req.query);
  if (!q.success) { bad(c.res, c.req); return null; }
  if (q.data.refresh && !c.canWrite) { forbidden(c.res, c.req); return null; }
  return q.data.refresh;
};

export const advisorRouter = Router();
const auth = [requireAuthenticated, requirePermission(R)] as const;

advisorRouter.get("/conflicts/:id/advisor", ...auth, computeLimiter, handle(async (c) => {
  const refresh = withRefresh(c);
  if (refresh === null) return;
  const out = await adviceFor(c.w, idOf(c.req.params.id), { refresh, canWrite: c.canWrite });
  if ("ok" in out) return notFound(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
advisorRouter.get("/work-requests/:id/advisor", ...auth, computeLimiter, handle(async (c) => {
  const refresh = withRefresh(c);
  if (refresh === null) return;
  const out = await requestAdvice(c.w, idOf(c.req.params.id), { refresh, canWrite: c.canWrite });
  if ("ok" in out) return notFound(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
advisorRouter.post("/advisor/schedule-preview", requireAuthenticated, requirePermission(WR), wizardLimiter, handle(async (c) => {
  if (!isJsonContentType(c.req)) return void c.res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", c.req.requestId));
  const b = previewBody.safeParse(c.req.body);
  if (!b.success || !(new Date(b.data.schedule.plannedEnd) >= new Date(b.data.schedule.plannedStart))) return bad(c.res, c.req);
  const geo = validateWorkGeometry(b.data.geometry);
  if (!geo.valid) return void c.res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", c.req.requestId, geo.errors));
  c.res.json(success(await schedulePreview(c.actor, { geometry: geo.geometry, bufferMeters: b.data.bufferMeters ?? DETECTION.DEFAULT_BUFFER_M, schedule: b.data.schedule, subject: b.data.subject as never }), c.req.requestId));
}, WR));
advisorRouter.get("/advisor/stats", ...auth, readLimiter, handle(async (c) => {
  if (!c.w.national) return notFound(c.res, c.req);
  c.res.json(success(await stats(), c.req.requestId));
}));
advisorRouter.post("/advisor/:recNo/feedback", ...auth, feedbackLimiter, handle(async (c) => {
  if (!c.canWrite) return forbidden(c.res, c.req);
  if (!isJsonContentType(c.req)) return void c.res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", c.req.requestId));
  const b = feedbackBody.safeParse(c.req.body);
  if (!b.success) return bad(c.res, c.req);
  const out = await addFeedback(c.w, idOf(c.req.params.recNo), { planKey: b.data.planKey ?? null, action: b.data.action, reasonCode: b.data.reasonCode });
  if (out === "not_found") return notFound(c.res, c.req);
  if (out === "invalid") return bad(c.res, c.req);
  c.res.json(success({ recorded: true }, c.req.requestId));
}));
advisorRouter.get("/advisor/:recNo/plans/:planKey/handoff", ...auth, feedbackLimiter, handle(async (c) => {
  if (!c.canWrite) return forbidden(c.res, c.req);
  const q = handoffQuery.safeParse(c.req.query);
  if (!q.success || !/^[a-f0-9]{12}$/.test(idOf(c.req.params.planKey))) return bad(c.res, c.req);
  const out = await handoff(c.w, idOf(c.req.params.recNo), idOf(c.req.params.planKey), q.data.target);
  if (!out) return notFound(c.res, c.req);
  c.res.json(success(out, c.req.requestId));
}));
