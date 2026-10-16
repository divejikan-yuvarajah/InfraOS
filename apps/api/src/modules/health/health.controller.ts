import type { Request, Response } from "express";

import { isDatabaseReady } from "../../config/database.js";
import { failure, success } from "../../shared/http/envelope.js";

export type HealthData = {
  status: "ok";
  service: "infraos-api";
  timestamp: string;
};

export type ReadyData = {
  status: "ready";
  database: "connected";
};

export function getHealth(req: Request, res: Response): void {
  const payload: HealthData = {
    status: "ok",
    service: "infraos-api",
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(success(payload, req.requestId));
}

export function getReady(req: Request, res: Response): void {
  if (!isDatabaseReady()) {
    res
      .status(503)
      .json(
        failure("NOT_READY", "Database is not connected", req.requestId),
      );
    return;
  }

  const payload: ReadyData = {
    status: "ready",
    database: "connected",
  };
  res.status(200).json(success(payload, req.requestId));
}
