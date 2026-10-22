import { Router } from "express";

import { healthRouter, readyRouter } from "../modules/health/health.routes.js";
import { emailVerificationRouter } from "../modules/identity/email-verification.routes.js";

export function createV1Router(): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/ready", readyRouter);
  router.use("/auth", emailVerificationRouter);
  return router;
}
