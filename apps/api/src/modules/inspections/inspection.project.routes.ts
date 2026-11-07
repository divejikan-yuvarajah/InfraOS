import { Router } from "express";

import { handle, invalid, limiter, param, reply } from "../contractors/contractor.http.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { projectInspections, verifiedProgressSeries } from "./inspection.service.js";

const read = limiter(240);

/** Mounted at /api/v1/projects/:projectId/inspections (before /projects). */
export const projectInspectionsRouter = Router({ mergeParams: true });
projectInspectionsRouter.get("/", requireAuthenticated, requirePermission("inspection.read"), read, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await projectInspections(actor, param(req.params.projectId)));
}));

/** Mounted at /api/v1/projects/:projectId/verified-progress. Reported points are labelled reported/unverified. */
export const projectVerifiedProgressRouter = Router({ mergeParams: true });
projectVerifiedProgressRouter.get("/", requireAuthenticated, requirePermission("project.read"), read, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await verifiedProgressSeries(actor, param(req.params.projectId)));
}));
