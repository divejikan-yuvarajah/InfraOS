import type { Request, RequestHandler, Response } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { logger } from "../../../shared/logger.js";
import { Flow } from "../../contractors/contractor.context.js";
import { isJsonContentType } from "../../identity/auth/auth.security.js";
import { noStore } from "../../contractors/contractor.http.js";

/** Safe error: a status, a stable code and optional structured details. Never provider bodies, prompts or stack traces. */
export class RagFlow extends Error {
  constructor(readonly status: 400 | 404 | 409 | 422 | 429 | 503, readonly code: string, readonly details: Record<string, unknown> | null = null) {
    super(code);
    this.name = "RagFlow";
  }
}

const MESSAGES: Record<number, string> = { 400: "request could not be completed", 401: "sign-in is required", 403: "request could not be completed", 404: "resource was not found", 409: "request could not be completed", 422: "request could not be completed", 429: "too many requests", 503: "service is temporarily unavailable" };

/** noStore + actor guard + JSON-body check; maps RagFlow/Flow to the envelope; anything else is a sanitised 503. */
export function ragHandle(opts: { body?: boolean }, fn: (req: Request, res: Response, actor: NonNullable<Request["actor"]>) => Promise<{ data: unknown; status?: number }>): RequestHandler {
  return async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;
      if (opts.body && !isJsonContentType(req)) { res.status(415).json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId)); return; }
      const out = await fn(req, res, actor);
      res.status(out.status ?? 200).json(success(out.data, req.requestId));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortedAsk") return; // the client went away: nothing to send
      if (error instanceof RagFlow) { res.status(error.status).json(failure(error.code, MESSAGES[error.status] ?? MESSAGES[400]!, req.requestId, error.details)); return; }
      if (error instanceof Flow) { res.status(error.status).json(failure(error.code, MESSAGES[error.status] ?? MESSAGES[400]!, req.requestId, error.details)); return; }
      logger.error({ err: error instanceof Error ? error.name : "unknown", requestId: req.requestId }, "ai request failed");
      res.status(503).json(failure("SERVICE_UNAVAILABLE", MESSAGES[503]!, req.requestId));
    }
  };
}
