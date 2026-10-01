import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { isAppError } from "../shared/errors/app-error.js";
import { failure } from "../shared/http/envelope.js";
import { logger } from "../shared/logger.js";

function requestIdOf(req: Request): string {
  return req.requestId ?? "unknown";
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = requestIdOf(req);

  if (error instanceof ZodError) {
    res.status(400).json(
      failure("VALIDATION_ERROR", "Request validation failed", requestId, {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    );
    return;
  }

  if (isAppError(error)) {
    if (error.code === "VALIDATION_ERROR" && error.details instanceof ZodError) {
      res.status(400).json(
        failure("VALIDATION_ERROR", error.message, requestId, {
          issues: error.details.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    res
      .status(error.statusCode)
      .json(failure(error.code, error.message, requestId, error.details));
    return;
  }

  logger.error({ err: error, requestId, method: req.method, path: req.path }, "unhandled error");

  res
    .status(500)
    .json(failure("INTERNAL_ERROR", "An unexpected error occurred", requestId));
}
