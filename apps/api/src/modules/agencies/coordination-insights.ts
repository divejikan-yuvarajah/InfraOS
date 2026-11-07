import { Router, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { agencyExists, dashboardAgencies, knownDistricts, resolveRange, type DashQuery } from "../roadsync/dashboard.read.js";
import { DASH, GRADES, HEALTH_WEIGHTS, RANGES } from "../roadsync/dashboard.rules.js";
import { assertLive, FlowControl } from "../roadsync/work-requests.service.js";

/**
 * Step 107: a thin, fair presentation layer over the EXISTING RoadSync agency scorecards. There is no scoring maths here:
 * every number comes from `dashboardAgencies` unchanged, under the same permission, scope and range rules.
 * This file only adds (a) the indicator mapping table, (b) the constants RoadSync itself uses, and (c) fairness ordering.
 */
const R = "roadsync.conflict.read" as const;

/** Blueprint indicator -> RoadSync scorecard field. `null` source means RoadSync has no such field, so it is listed as not available. */
export const INDICATOR_MAPPING = [
  { key: "healthScore", source: "healthScore", unit: "score", definitionKey: "roadsync.metrics.healthScore.definition" },
  { key: "caseload", source: "cases", unit: "count", definitionKey: "roadsync.metrics.cases.definition" },
  { key: "openConflicts", source: "open", unit: "count", definitionKey: "roadsync.metrics.open.definition" },
  { key: "overdueAcknowledgements", source: "overdueAcks", unit: "count", definitionKey: "roadsync.metrics.overdueAcks.definition" },
  { key: "overdueResponses", source: "overdueResponses", unit: "count", definitionKey: "roadsync.metrics.overdueResponses.definition" },
  { key: "agreementRate", source: "agreementRate", unit: "percent", definitionKey: "roadsync.metrics.agreementRate.definition" },
  { key: "medianAcknowledgementHours", source: "medianAckHours", unit: "hours", definitionKey: "roadsync.metrics.medianAckHours.definition" },
  { key: "medianResponseHours", source: "medianResponseHours", unit: "hours", definitionKey: "roadsync.metrics.medianResponseHours.definition" },
  { key: "negotiationRounds", source: "avgRounds", unit: "count", definitionKey: "roadsync.metrics.avgRounds.definition" },
  { key: "resolvedConflicts", source: "resolved", unit: "count", definitionKey: "roadsync.metrics.resolved.definition" },
  { key: "commitmentCompletion", source: "commitmentCompletion", unit: "percent", definitionKey: "roadsync.metrics.commitmentCompletion.definition" },
  // Honest gaps: RoadSync's agency scorecard has no source for these, so they are shown as "not available from current records".
  { key: "repeatedSchedulingConflicts", source: null, unit: "count", definitionKey: null },
  { key: "approvalTurnaround", source: null, unit: "hours", definitionKey: null },
] as const;

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({ range: z.enum(RANGES).default("30d"), from: day.optional(), to: day.optional(), compare: z.enum(["true", "false"]).transform((v) => v === "true").default(false), agencyId: objectId.optional(), district: z.string().trim().min(1).max(80).optional(), sort: z.enum(["name", "health"]).default("name") }).strict();

type Card = { agencyId: string; agencyName: string | null; cases: number; healthScore: number | null; grade: string | null };
const INSUFFICIENT = "NOT_ENOUGH_CASES" as const;
const availability = (c: Pick<Card, "cases" | "healthScore">) => (c.healthScore === null || c.cases < DASH.MIN_CASES_FOR_SCORE ? INSUFFICIENT : ("OK" as const));

/**
 * Default order is alphabetical. "health" orders only agencies that have enough cases for a score and keeps the rest below a divider,
 * so an agency with too little data can never be ranked against agencies that have enough.
 */
export function orderCards<T extends Card>(items: T[], sort: "name" | "health"): { items: (T & { availability: "OK" | typeof INSUFFICIENT; casesNeeded: number })[]; divider: number | null } {
  const decorated = items.map((c) => ({ ...c, availability: availability(c), casesNeeded: DASH.MIN_CASES_FOR_SCORE }));
  const byName = (a: Card, b: Card) => (a.agencyName ?? "").localeCompare(b.agencyName ?? "");
  if (sort === "name") return { items: decorated.sort(byName), divider: null };
  const enough = decorated.filter((c) => c.availability === "OK").sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0) || byName(a, b));
  const rest = decorated.filter((c) => c.availability !== "OK").sort(byName);
  return { items: [...enough, ...rest], divider: rest.length ? enough.length : null };
}

const limiter = rateLimit({
  windowMs: 60_000, limit: env.NODE_ENV === "test" ? 1000 : 120, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { res.setHeader("Cache-Control", "no-store"); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
const bad = (res: Response, req: Request) => void res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));

export const coordinationInsightsRouter = Router();
coordinationInsightsRouter.get("/", requireAuthenticated, requirePermission(R), limiter, async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const actor = req.actor;
    if (!actor) return;
    await assertLive(actor, [R]);
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return bad(res, req);
    const { sort, ...rest } = parsed.data;
    const q = rest as DashQuery;
    const w = await whoIs(actor);
    // Same rules as the RoadSync dashboard: only national viewers may narrow by agency or district, and both must exist.
    if ((q.agencyId || q.district) && !w.national) return void res.status(403).json(failure("FORBIDDEN", "not permitted", req.requestId));
    const range = resolveRange(q);
    if (!range || (q.range !== "custom" && (q.from || q.to))) return bad(res, req);
    if (q.agencyId && !(await agencyExists(q.agencyId))) return bad(res, req);
    if (q.district && !(await knownDistricts(w)).includes(q.district)) return bad(res, req);
    const data = await dashboardAgencies(w, q, range, "healthScore");
    const meta = {
      minCases: DASH.MIN_CASES_FOR_SCORE, minCohort: DASH.MIN_COHORT_FOR_BENCHMARK, weights: HEALTH_WEIGHTS, grades: GRADES,
      range: { key: q.range, from: range.start.toISOString(), to: range.end.toISOString(), days: range.days }, mapping: INDICATOR_MAPPING,
      notAvailable: INDICATOR_MAPPING.filter((m) => m.source === null).map((m) => m.key),
    };
    if (data.level === "national") {
      const ordered = orderCards(data.items as unknown as Card[], sort);
      res.json(success({ level: "national", ...ordered, benchmark: data.benchmark, benchmarkUnavailable: data.benchmark ? null : "cohort_too_small", meta, sort }, req.requestId));
      return;
    }
    const own = data.own as unknown as Card;
    res.json(success({ level: "agency", own: { ...own, availability: availability(own), casesNeeded: DASH.MIN_CASES_FOR_SCORE }, benchmark: data.benchmark, benchmarkUnavailable: data.benchmarkUnavailable, meta }, req.requestId));
  } catch (error) {
    if (error instanceof FlowControl) return void res.status(error.status).json(failure(error.code, "request could not be completed", req.requestId));
    res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
  }
});
