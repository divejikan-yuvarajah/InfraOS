import { Router } from "express";

import { healthRouter, readyRouter } from "../modules/health/health.routes.js";

export function createV1Router(): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/ready", readyRouter);
  return router;
}
