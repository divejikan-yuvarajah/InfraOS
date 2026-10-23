import { Router } from "express";

import { healthRouter, readyRouter } from "../modules/health/health.routes.js";
import { authRouter } from "../modules/identity/auth/auth.routes.js";
import { emailVerificationRouter } from "../modules/identity/email-verification.routes.js";

export function createV1Router(): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/ready", readyRouter);
  router.use("/auth", emailVerificationRouter);
  router.use("/auth", authRouter);
  return router;
}
