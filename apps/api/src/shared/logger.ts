import pino from "pino";

import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "infraos-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.set-cookie",
      "password",
      "token",
      "*.password",
      "*.token",
    ],
    censor: "[Redacted]",
  },
});
