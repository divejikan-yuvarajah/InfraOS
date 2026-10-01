import type { NextFunction, Request, Response } from "express";

import { AppError } from "../shared/errors/app-error.js";

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${req.method} ${req.path} was not found`,
    ),
  );
}
