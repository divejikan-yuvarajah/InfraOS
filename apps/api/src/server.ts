import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, prefix: env.API_PREFIX },
    "infraos-api listening",
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, "graceful shutdown started");
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
