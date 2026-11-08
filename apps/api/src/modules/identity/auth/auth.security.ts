import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../../config/env.js";
import { failure } from "../../../shared/http/envelope.js";

export function isAllowedAuthOrigin(req: Request): boolean {
  const allowed = env.FRONTEND_ORIGIN;
  if (!allowed || allowed === "*") return false;
  const origin = req.header("origin");
  if (origin) {
    if (origin === allowed) return true;
    if (env.NODE_ENV === "development") {
      if (
        (allowed === "http://localhost:3000" && origin === "http://127.0.0.1:3000") ||
        (allowed === "http://127.0.0.1:3000" && origin === "http://localhost:3000")
      ) {
        return true;
      }
    }
    return false;
  }
  const referer = req.header("referer");
  if (!referer) return false;
  try {
    const parsedOrigin = new URL(referer).origin;
    if (parsedOrigin === allowed) return true;
    if (env.NODE_ENV === "development") {
      if (
        (allowed === "http://localhost:3000" && parsedOrigin === "http://127.0.0.1:3000") ||
        (allowed === "http://127.0.0.1:3000" && parsedOrigin === "http://localhost:3000")
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function isJsonContentType(req: Request): boolean {
  const type = req.header("content-type") ?? "";
  return type.toLowerCase().startsWith("application/json");
}

export function createCredentialRateLimit(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, _next, _options) => {
      res.setHeader("Cache-Control", "no-store");
      res
        .status(429)
        .json(failure("RATE_LIMITED", "Too many requests", req.requestId));
    },
  });
}

export const loginRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 40 : env.NODE_ENV === "development" ? 200 : 10,
);

export const refreshRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 80 : 30,
);

export const logoutRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 80 : 30,
);

export const forgotPasswordRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 40 : 10,
);

export const resetPasswordRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 40 : 10,
);

export const registerRateLimit = createCredentialRateLimit(
  env.NODE_ENV === "test" ? 40 : 10,
);

export function rejectDisallowedOrigin(req: Request, res: Response): boolean {
  if (isAllowedAuthOrigin(req)) return false;
  res.setHeader("Cache-Control", "no-store");
  res
    .status(403)
    .json(failure("FORBIDDEN", "origin is not allowed", req.requestId));
  return true;
}
