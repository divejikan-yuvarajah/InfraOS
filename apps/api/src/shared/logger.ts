import pino from "pino";

import { env, SECRET_ENV_NAMES } from "../config/env.js";

export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.set-cookie",
  "res.headers.set-cookie",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "activeTokenHash",
  "accessToken",
  "refreshToken",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.tokenHash",
  "*.accessToken",
  "*.refreshToken",
  ...SECRET_ENV_NAMES,
  ...SECRET_ENV_NAMES.map((name) => `*.${name}`),
] as const;

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "infraos-api" },
  redact: {
    paths: [...LOG_REDACT_PATHS],
    censor: "[Redacted]",
  },
});
