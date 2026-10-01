import type { Server } from "node:http";

import { createApp } from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
  sanitizeMongoError,
} from "./config/database.js";
import { env, requireMongoConfig } from "./config/env.js";
import { logger } from "./shared/logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startHttpServer(): Promise<Server> {
  const app = createApp();
  return await new Promise((resolve) => {
    const server = app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV, prefix: env.API_PREFIX },
        "infraos-api listening",
      );
      resolve(server);
    });
  });
}

async function connectMongoIfConfigured(): Promise<void> {
  if (env.NODE_ENV === "production") {
    requireMongoConfig(env);
  }

  if (!env.MONGODB_URI) {
    logger.warn(
      "MONGODB_URI is not set; HTTP will start and /health will pass, but /ready will not be ready",
    );
    return;
  }

  try {
    await connectDatabase(env);
  } catch (error) {
    logger.error(
      { reason: sanitizeMongoError(error) },
      "MongoDB unavailable at startup",
    );
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

function registerShutdown(server: Server): void {
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "graceful shutdown started");

    const force = setTimeout(() => {
      logger.error("graceful shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    server.close(async (closeError) => {
      if (closeError) {
        logger.error(
          { reason: closeError.message },
          "error closing HTTP server",
        );
      }
      try {
        await disconnectDatabase();
      } catch (error) {
        logger.error(
          { reason: sanitizeMongoError(error) },
          "error disconnecting MongoDB",
        );
      }
      process.exit(closeError ? 1 : 0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

async function main(): Promise<void> {
  await connectMongoIfConfigured();
  const server = await startHttpServer();
  registerShutdown(server);
}

main().catch((error: unknown) => {
  logger.error(
    { reason: sanitizeMongoError(error) },
    "infraos-api failed to start",
  );
  process.exit(1);
});
