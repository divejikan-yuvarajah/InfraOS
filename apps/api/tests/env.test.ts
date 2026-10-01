import { describe, expect, it } from "vitest";

import {
  assertSafeTestDatabaseName,
  EnvValidationError,
  parseEnv,
} from "../src/config/env.js";

const base = {
  NODE_ENV: "development",
  PORT: "4000",
  FRONTEND_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "info",
  API_PREFIX: "/api/v1",
};

describe("parseEnv", () => {
  it("accepts the current-required base configuration", () => {
    const env = parseEnv(base);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.FRONTEND_ORIGIN).toBe("http://localhost:3000");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.API_PREFIX).toBe("/api/v1");
    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.ACCESS_TOKEN_SECRET).toBeUndefined();
    expect(env.AI_INTERNAL_SECRET).toBeUndefined();
  });

  it("applies local defaults when optional non-secret values are omitted", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.FRONTEND_ORIGIN).toBe("http://localhost:3000");
    expect(env.API_PREFIX).toBe("/api/v1");
  });

  it("does not require future secrets for the current foundation", () => {
    const env = parseEnv({
      ...base,
      MONGODB_URI: "",
      ACCESS_TOKEN_SECRET: "   ",
      AI_INTERNAL_SECRET: "",
    });

    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.ACCESS_TOKEN_SECRET).toBeUndefined();
    expect(env.AI_INTERNAL_SECRET).toBeUndefined();
  });

  it("rejects an invalid PORT", () => {
    expect(() => parseEnv({ ...base, PORT: "abc" })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...base, PORT: "0" })).toThrow(/PORT/);
    expect(() => parseEnv({ ...base, PORT: "70000" })).toThrow(/PORT/);
  });

  it("rejects an invalid FRONTEND_ORIGIN", () => {
    expect(() => parseEnv({ ...base, FRONTEND_ORIGIN: "not-a-url" })).toThrow(
      /FRONTEND_ORIGIN/,
    );
    expect(() => parseEnv({ ...base, FRONTEND_ORIGIN: "*" })).toThrow(
      /FRONTEND_ORIGIN/,
    );
    expect(() =>
      parseEnv({ ...base, FRONTEND_ORIGIN: "http://user:pass@localhost:3000" }),
    ).toThrow(/FRONTEND_ORIGIN/);
  });

  it("does not print URL credentials in FRONTEND_ORIGIN errors", () => {
    try {
      parseEnv({
        ...base,
        FRONTEND_ORIGIN: "http://user:supersecret@localhost:3000",
      });
      throw new Error("expected EnvValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("supersecret");
      expect(message).not.toContain("user:supersecret");
    }
  });

  it("rejects an invalid NODE_ENV", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("requires FRONTEND_ORIGIN in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production", PORT: "4000" })).toThrow(
      /FRONTEND_ORIGIN/,
    );
  });

  it("accepts a production origin without future secrets", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      PORT: "8080",
      FRONTEND_ORIGIN: "https://infraos.example",
      LOG_LEVEL: "warn",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(8080);
    expect(env.FRONTEND_ORIGIN).toBe("https://infraos.example");
    expect(env.ACCESS_TOKEN_SECRET).toBeUndefined();
  });

  it("rejects a short ACCESS_TOKEN_SECRET when the value is present", () => {
    expect(() =>
      parseEnv({ ...base, ACCESS_TOKEN_SECRET: "too-short" }),
    ).toThrow(/ACCESS_TOKEN_SECRET/);
  });

  it("does not print secret values in validation errors", () => {
    const secret = `leak-me-${"x".repeat(40)}`;

    try {
      parseEnv({ ...base, ACCESS_TOKEN_SECRET: "short-secret-value" });
      throw new Error("expected EnvValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("ACCESS_TOKEN_SECRET");
      expect(message).not.toContain("short-secret-value");
      expect(message).not.toContain(secret);
    }
  });

  it("rejects Step 7 prompt aliases in favor of the architecture catalog", () => {
    expect(() =>
      parseEnv({ ...base, CLIENT_URL: "http://localhost:3000" }),
    ).toThrow(/FRONTEND_ORIGIN/);
    expect(() => parseEnv({ ...base, JWT_SECRET: "x".repeat(32) })).toThrow(
      /ACCESS_TOKEN_SECRET/,
    );
  });

  it("normalizes API_PREFIX trailing slashes", () => {
    const env = parseEnv({ ...base, API_PREFIX: "/api/v1/" });
    expect(env.API_PREFIX).toBe("/api/v1");
  });
});

describe("assertSafeTestDatabaseName", () => {
  it("allows infraos_test when NODE_ENV=test", () => {
    expect(() =>
      assertSafeTestDatabaseName("test", "infraos_test"),
    ).not.toThrow();
  });

  it("rejects production-like names in tests", () => {
    expect(() =>
      assertSafeTestDatabaseName("test", "infraos_prod"),
    ).toThrow(/MONGODB_DB_NAME/);
    expect(() => assertSafeTestDatabaseName("test", "infraos_dev")).toThrow(
      /_test/,
    );
  });

  it("does not constrain development or production names", () => {
    expect(() =>
      assertSafeTestDatabaseName("development", "infraos_dev"),
    ).not.toThrow();
    expect(() =>
      assertSafeTestDatabaseName("production", "infraos_prod"),
    ).not.toThrow();
  });
});
