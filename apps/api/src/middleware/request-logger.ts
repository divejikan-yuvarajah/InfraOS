import type { IncomingMessage, ServerResponse } from "node:http";

import type { Request } from "express";
import { pinoHttp } from "pino-http";

import { logger } from "../shared/logger.js";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (req as Request).requestId ?? "unknown",
  customLogLevel: (
    _req: IncomingMessage,
    res: ServerResponse,
    error?: Error,
  ) => {
    if (error || res.statusCode >= 500) {
      return "error";
    }
    if (res.statusCode >= 400) {
      return "warn";
    }
    return "info";
  },
  serializers: {
    req(req: IncomingMessage) {
      return {
        id: (req as IncomingMessage & { id?: string }).id,
        method: req.method,
        url: req.url,
      };
    },
    res(res: ServerResponse) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
