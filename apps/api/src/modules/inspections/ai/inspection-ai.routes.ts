import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { failure, success } from "../../../shared/http/envelope.js";
import { handle, invalid, limiter, noStore, param } from "../../contractors/contractor.http.js";
import { requireAuthenticated } from "../../identity/auth/require-authenticated.js";
import { requireAnyPermission, requirePermission } from "../../identity/authorization/require-permission.js";
import { Role } from "../../identity/models/role.model.js";
import {
  getVisionEligibility,
  requestVisionAnalysis,
  listVisionAnalyses,
  getVisionAnalysis,
  reviewVisionAnalysis,
  insertVisionObservations,
  InspectionAiFlowError,
} from "./inspection-ai.service.js";

export const inspectionAiRouter = Router();

const read = limiter(240);
const write = limiter(30);
const auth = [requireAuthenticated];

async function getActorPermissions(actor: { roleId: string }): Promise<readonly string[]> {
  const role = await Role.findById(actor.roleId).select("permissions").lean();
  return (role?.permissions as string[]) ?? [];
}

const analysesBody = z.object({
  evidenceIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(6),
  acknowledgedProvider: z.boolean(),
});

const reviewBody = z.object({
  decisions: z.record(
    z.string().regex(/^(img:[1-6]|disc:\d+|overall)$/),
    z.object({
      decision: z.enum(["CONFIRMED", "DISPUTED", "NOT_RELEVANT"]),
      comment: z.string().max(300).optional(),
    }),
  ),
});

const insertBody = z.object({
  keys: z.array(z.string().regex(/^(img:[1-6]|disc:\d+|overall)$/)).min(1).max(20),
});

function handleAiError(res: Response, req: Request, err: unknown) {
  if (err instanceof InspectionAiFlowError) {
    noStore(res);
    return res.status(err.status).json(failure(err.code, err.message, req.requestId, err.details));
  }
  noStore(res);
  return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error", req.requestId));
}

// 1. Eligibility
inspectionAiRouter.get(
  "/:id/ai/eligibility",
  ...auth,
  requireAnyPermission("inspection.read", "inspection.submit", "inspection.verify", "inspection.reject"),
  read,
  handle({}, async (req, res, actor) => {
    try {
      const perms = await getActorPermissions(actor);
      const data = await getVisionEligibility(actor, param(req.params.id), perms);
      res.status(200).json(success(data, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);

// 2. Request Analysis
inspectionAiRouter.post(
  "/:id/ai/analyses",
  ...auth,
  requireAnyPermission("inspection.submit", "inspection.verify", "inspection.reject"),
  write,
  handle({ body: true }, async (req, res, actor) => {
    const parsed = analysesBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, req);

    try {
      const perms = await getActorPermissions(actor);
      const result = await requestVisionAnalysis(actor, param(req.params.id), parsed.data, perms, req.requestId);
      res.status(result.status).json(success(result.analysis, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);

// 3. List Analyses
inspectionAiRouter.get(
  "/:id/ai/analyses",
  ...auth,
  requireAnyPermission("inspection.read", "inspection.submit", "inspection.verify", "inspection.reject"),
  read,
  handle({}, async (req, res, actor) => {
    try {
      const data = await listVisionAnalyses(actor, param(req.params.id));
      res.status(200).json(success(data, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);

// 4. Get Single Analysis
inspectionAiRouter.get(
  "/:id/ai/analyses/:aid",
  ...auth,
  requireAnyPermission("inspection.read", "inspection.submit", "inspection.verify", "inspection.reject"),
  read,
  handle({}, async (req, res, actor) => {
    try {
      const data = await getVisionAnalysis(actor, param(req.params.id), param(req.params.aid));
      res.status(200).json(success(data.analysis, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);

// 5. Review Analysis Decisions
inspectionAiRouter.put(
  "/:id/ai/analyses/:aid/review",
  ...auth,
  requirePermission("inspection.submit"),
  write,
  handle({ body: true }, async (req, res, actor) => {
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, req);

    try {
      const perms = await getActorPermissions(actor);
      const data = await reviewVisionAnalysis(
        actor,
        param(req.params.id),
        param(req.params.aid),
        parsed.data,
        perms,
        req.requestId,
      );
      res.status(200).json(success(data.analysis, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);

// 6. Insert Confirmed Observations into report
inspectionAiRouter.post(
  "/:id/ai/analyses/:aid/insert",
  ...auth,
  requirePermission("inspection.submit"),
  write,
  handle({ body: true }, async (req, res, actor) => {
    const parsed = insertBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, req);

    try {
      const perms = await getActorPermissions(actor);
      const data = await insertVisionObservations(
        actor,
        param(req.params.id),
        param(req.params.aid),
        parsed.data,
        perms,
        req.requestId,
      );
      res.status(200).json(success(data, req.requestId));
    } catch (err) {
      handleAiError(res, req, err);
    }
  }),
);
