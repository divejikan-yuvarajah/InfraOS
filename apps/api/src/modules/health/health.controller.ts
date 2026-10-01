import type { Request, Response } from "express";

import { success } from "../../shared/http/envelope.js";

export type HealthData = {
  status: "ok";
  service: "infraos-api";
  timestamp: string;
};

export function getHealth(req: Request, res: Response): void {
  const payload: HealthData = {
    status: "ok",
    service: "infraos-api",
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(success(payload, req.requestId));
}
