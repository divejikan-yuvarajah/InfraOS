import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { getHealth } from "./modules/health/health.controller.js";
import { createV1Router } from "./routes/v1.js";
import { failure } from "./shared/http/envelope.js";

function corsOrigin(): string | false {
  if (env.CLIENT_URL === "*") {
    return false;
  }
  return env.CLIENT_URL;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: corsOrigin(),
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === "test" ? 10_000 : 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) =>
      req.path === "/health" || req.path === `${env.API_PREFIX}/health`,
    handler: (req, res) => {
      res
        .status(429)
        .json(failure("RATE_LIMITED", "Too many requests", req.requestId));
    },
  });
  app.use(limiter);

  app.get("/health", getHealth);
  app.use(env.API_PREFIX, createV1Router());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
