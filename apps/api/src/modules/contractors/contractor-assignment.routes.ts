import { Router, type Router as RouterType } from "express";

import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { assignContractor, endAssignment, listContractorAssignments, listProjectContractors, reassign } from "./contractor-assignment.service.js";
import { contractorTimeline } from "./contractor-timeline.service.js";
import { handle, invalid, param, readLimiter, reply, writeLimiter } from "./contractor.http.js";
import { assignBodySchema, assignmentListQuerySchema, endBodySchema, parseStrict, reassignBodySchema, timelineQuerySchema } from "./contractor.schema.js";
import { performanceRoute } from "./contractor-performance.routes.js";

/** Contractor-prefixed reads: assignment history, timeline and performance. Declared before the catch-all "/:id" handlers. */
export function assignmentRoutes(router: RouterType): void {
  const read = [requireAuthenticated, requirePermission("contractor.read"), readLimiter];
  router.get("/:id/assignments", ...read, handle({}, async (req, res, actor) => {
    const q = parseStrict(assignmentListQuerySchema, req.query);
    if (!q) return invalid(res, req);
    reply(res, req, await listContractorAssignments(actor, param(req.params.id), q));
  }));
  router.get("/:id/timeline", ...read, handle({}, async (req, res, actor) => {
    const q = parseStrict(timelineQuerySchema, req.query);
    if (!q) return invalid(res, req);
    reply(res, req, await contractorTimeline(actor, param(req.params.id), q));
  }));
  performanceRoute(router);
}

/** Mounted at /api/v1/projects/:projectId/contractors, ahead of the project router. */
export const projectContractorRouter = Router({ mergeParams: true });
const manage = [requireAuthenticated, requirePermission("contractor.manage"), writeLimiter];

projectContractorRouter.get("/", requireAuthenticated, requirePermission("contractor.read"), readLimiter, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await listProjectContractors(actor, param(req.params.projectId)));
}));

projectContractorRouter.post("/", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = assignBodySchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await assignContractor(actor, param(req.params.projectId), body.data, req.requestId), 201);
}));

projectContractorRouter.post("/:assignmentId/end", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = endBodySchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await endAssignment(actor, param(req.params.projectId), param(req.params.assignmentId), body.data, req.requestId));
}));

projectContractorRouter.post("/:assignmentId/reassign", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = reassignBodySchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await reassign(actor, param(req.params.projectId), param(req.params.assignmentId), body.data, req.requestId));
}));
