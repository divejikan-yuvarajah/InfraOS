import mongoose from "mongoose";

import {
  env,
  requireMongoConfig,
  type AppEnv,
} from "./env.js";
import { logger } from "../shared/logger.js";

/**
 * Connection timeouts and pool — documented in docs/database/connection.md.
 * Fail startup selection in a few seconds rather than hang. Modest pool for
 * one API process; tune later per Render instance, not as national-scale config.
 */
export const MONGO_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 8_000,
  connectTimeoutMS: 8_000,
  maxPoolSize: 10,
  minPoolSize: 0,
} as const;

const STARTUP_ATTEMPTS = 3;
const STARTUP_RETRY_MS = 1_500;

export class DatabaseConnectionError extends Error {
  constructor(message = "Database is unavailable") {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export type DatabaseState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

export type DatabaseStatus = {
  ready: boolean;
  state: DatabaseState;
};

let listenersAttached = false;
let connecting: Promise<void> | null = null;

const READY_STATE: Record<number, DatabaseState> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function sanitizeMongoError(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : "MongoDB connection failed";
  return raw
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, "mongodb://[redacted]")
    .replace(/:[^:@/\s]+@/g, ":[redacted]@");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function attachLifecycleListeners(): void {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("error", (error) => {
    logger.error(
      { reason: sanitizeMongoError(error) },
      "MongoDB connection error",
    );
  });
}

export function getDatabaseStatus(): DatabaseStatus {
  const state = READY_STATE[mongoose.connection.readyState] ?? "disconnected";
  return {
    ready: mongoose.connection.readyState === 1,
    state,
  };
}

export function isDatabaseReady(): boolean {
  return getDatabaseStatus().ready;
}

export async function pingDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new DatabaseConnectionError();
  }
  await db.admin().command({ ping: 1 });
}

type DatabaseConnectOptions = {
  autoIndex?: boolean;
};

async function connectOnce(
  config: { uri: string; dbName: string },
  autoIndex: boolean,
): Promise<void> {
  attachLifecycleListeners();
  mongoose.set("strictQuery", true);
  mongoose.set("autoIndex", autoIndex);
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    ...MONGO_CONNECT_OPTIONS,
  });
}

/**
 * One shared Mongoose connection per API process. Safe to call repeatedly.
 */
export async function connectDatabase(
  source: AppEnv = env,
  options: DatabaseConnectOptions = {},
): Promise<void> {
  if (isDatabaseReady()) {
    return;
  }

  if (connecting) {
    await connecting;
    return;
  }

  const config = requireMongoConfig(source);

  connecting = (async () => {
    const attempts = source.NODE_ENV === "test" ? 1 : STARTUP_ATTEMPTS;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await connectOnce(
          config,
          options.autoIndex ?? source.NODE_ENV !== "production",
        );
        return;
      } catch (error) {
        lastError = error;
        logger.error(
          {
            attempt,
            attempts,
            reason: sanitizeMongoError(error),
          },
          "MongoDB connection attempt failed",
        );
        if (attempt < attempts) {
          await sleep(STARTUP_RETRY_MS);
        }
      }
    }
    throw new DatabaseConnectionError(sanitizeMongoError(lastError));
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
}
