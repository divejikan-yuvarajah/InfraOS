import pino from "pino";

import { env, SECRET_ENV_NAMES } from "../config/env.js";

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
      ...SECRET_ENV_NAMES,
      ...SECRET_ENV_NAMES.map((name) => `*.${name}`),
    ],
    censor: "[Redacted]",
  },
});
