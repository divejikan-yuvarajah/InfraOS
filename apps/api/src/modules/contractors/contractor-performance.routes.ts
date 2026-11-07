import type { Router as RouterType } from "express";

import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { contractorPerformance } from "./contractor-performance.service.js";
import { handle, invalid, param, readLimiter, reply } from "./contractor.http.js";

/** GET /contractors/:id/performance. Needs the dedicated performance permission on top of contractor.read (checked in the service). */
export function performanceRoute(router: RouterType): void {
  router.get("/:id/performance", requireAuthenticated, requirePermission("contractor.performance.read"), readLimiter, handle({}, async (req, res, actor) => {
    if (Object.keys(req.query).length) return invalid(res, req);
    reply(res, req, await contractorPerformance(actor, param(req.params.id)));
  }));
}
