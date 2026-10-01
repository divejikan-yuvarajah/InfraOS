import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  isDatabaseReady,
  sanitizeMongoError,
} from "../src/config/database.js";
import { parseEnv } from "../src/config/env.js";

vi.mock("mongoose", () => {
  const connection = {
    readyState: 0,
    on: vi.fn(),
    db: undefined as unknown,
  };

  return {
    default: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      connection,
    },
  };
});

const testEnv = parseEnv({
  NODE_ENV: "test",
  PORT: "4000",
  FRONTEND_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "silent",
  API_PREFIX: "/api/v1",
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  MONGODB_DB_NAME: "infraos_test",
});

describe("sanitizeMongoError", () => {
  it("redacts connection strings and passwords", () => {
    const error = new Error(
      "failed to connect to mongodb+srv://user:supersecret@cluster.mongodb.net/infraos_dev",
    );
    const sanitized = sanitizeMongoError(error);
    expect(sanitized).not.toContain("supersecret");
    expect(sanitized).not.toContain("cluster.mongodb.net");
    expect(sanitized).toContain("[redacted]");
  });
});

describe("connectDatabase", () => {
  beforeEach(() => {
    mongoose.connection.readyState = 0;
    vi.mocked(mongoose.connect).mockReset();
    vi.mocked(mongoose.disconnect).mockReset();
    vi.mocked(mongoose.connect).mockImplementation(async () => {
      mongoose.connection.readyState = 1;
      return mongoose;
    });
    vi.mocked(mongoose.disconnect).mockImplementation(async () => {
      mongoose.connection.readyState = 0;
    });
  });

  it("reuses a single connection for repeated calls", async () => {
    await connectDatabase(testEnv);
    await connectDatabase(testEnv);

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(isDatabaseReady()).toBe(true);
    expect(getDatabaseStatus()).toEqual({
      ready: true,
      state: "connected",
    });
  });

  it("fails without logging a usable URI when connect throws", async () => {
    vi.mocked(mongoose.connect).mockImplementation(async () => {
      throw new Error(
        "querySrv ECONNREFUSED mongodb+srv://user:supersecret@cluster.mongodb.net",
      );
    });

    await expect(connectDatabase(testEnv)).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return (
        !message.includes("supersecret") &&
        (message.includes("[redacted]") || /unavailable/i.test(message))
      );
    });
  });

  it("disconnects when a connection exists", async () => {
    await connectDatabase(testEnv);
    await disconnectDatabase();
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(isDatabaseReady()).toBe(false);
  });
});
