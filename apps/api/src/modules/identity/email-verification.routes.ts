import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import {
  consumeEmailVerification,
  requestEmailVerification,
  VerificationDependencyError,
} from "./email-verification.service.js";
import { createVerificationSender } from "./verification-mail.js";

const requestSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();

const consumeSchema = z
  .object({
    token: z.string().trim().min(43).max(43),
  })
  .strict();

const sender = createVerificationSender(env.NODE_ENV);

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return origin === env.FRONTEND_ORIGIN;
}

export const emailVerificationRouter = Router();

emailVerificationRouter.post("/verification/request", async (req, res, next) => {
  try {
    if (!originAllowed(req.header("origin"))) {
      res.status(403).json(failure("FORBIDDEN", "origin is not allowed", req.requestId));
      return;
    }
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "verification could not be completed", req.requestId));
      return;
    }
    await requestEmailVerification({
      email: parsed.data.email,
      sender,
      allowlistedOrigin: env.FRONTEND_ORIGIN,
      requestId: req.requestId,
    });
    res.setHeader("Referrer-Policy", "no-referrer");
    res.status(200).json(success({ status: "ACCEPTED" }, req.requestId));
  } catch (error) {
    if (error instanceof VerificationDependencyError) {
      res.status(503).json(failure(error.code, error.message, req.requestId));
      return;
    }
    next(error);
  }
});

emailVerificationRouter.post("/verify-email", async (req, res, next) => {
  try {
    if (!originAllowed(req.header("origin"))) {
      res.status(403).json(failure("FORBIDDEN", "origin is not allowed", req.requestId));
      return;
    }
    if ("returnTo" in (req.body ?? {}) || "next" in (req.body ?? {})) {
      res.status(400).json(failure("VALIDATION_ERROR", "verification could not be completed", req.requestId));
      return;
    }
    const parsed = consumeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "verification could not be completed", req.requestId));
      return;
    }
    const result = await consumeEmailVerification({
      token: parsed.data.token,
      requestId: req.requestId,
    });
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!result.ok) {
      res.status(400).json(failure("VALIDATION_ERROR", "verification could not be completed", req.requestId));
      return;
    }
    res.status(200).json(success({ status: "VERIFIED" }, req.requestId));
  } catch (error) {
    if (error instanceof VerificationDependencyError) {
      res.status(503).json(failure(error.code, error.message, req.requestId));
      return;
    }
    next(error);
  }
});
