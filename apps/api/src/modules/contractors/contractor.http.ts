import type { Request, RequestHandler, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { logger } from "../../shared/logger.js";
import { isJsonContentType } from "../identity/auth/auth.security.js";
import type { Failure, Result } from "./contractor.context.js";

export const limiter = (limit: number): RequestHandler => rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 5000 : limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { noStore(res); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});
export const readLimiter = limiter(240);
export const writeLimiter = limiter(60);

export function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

export const param = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? "" : value ?? "");

const MESSAGES: Record<number, string> = { 400: "request could not be completed", 401: "sign-in is required", 403: "request could not be completed", 404: "resource was not found", 409: "request could not be completed", 503: "service is temporarily unavailable" };

export function sendFailure(res: Response, req: Request, f: Failure): void {
  res.status(f.status).json(failure(f.code, MESSAGES[f.status] ?? "request could not be completed", req.requestId, f.details));
}

/** Wraps a handler: no-store, actor guard, JSON body check for writes, and a sanitized 503 for anything unexpected (no stack traces). */
export function handle(opts: { body?: boolean }, fn: (req: Request, res: Response, actor: NonNullable<Request["actor"]>) => Promise<void>): RequestHandler {
  return async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;
      if (opts.body && !isJsonContentType(req)) { res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId)); return; }
      await fn(req, res, actor);
    } catch (error) {
      logger.error({ err: error instanceof Error ? error.message : "unknown", requestId: req.requestId }, "contractor request failed");
      res.status(503).json(failure("SERVICE_UNAVAILABLE", MESSAGES[503]!, req.requestId));
    }
  };
}

export function reply<T>(res: Response, req: Request, result: Result<T>, status = 200): void {
  if (!result.ok) { sendFailure(res, req, result); return; }
  res.status(status).json(success(result.data, req.requestId));
}

export const invalid = (res: Response, req: Request): void => { res.status(400).json(failure("VALIDATION_ERROR", MESSAGES[400]!, req.requestId)); };
