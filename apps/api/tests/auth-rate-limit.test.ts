import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { createCredentialRateLimit } from "../src/modules/identity/auth/auth.security.js";

const ACCESS_SECRET = "access-secret-step39-0123456789abcdef";
const REFRESH_SECRET = "refresh-secret-step39-0123456789abcdef";

describe("auth rate limit", () => {
  it("returns the standard 429 envelope after the configured threshold", async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = "rate-test";
      next();
    });
    app.post("/login", createCredentialRateLimit(2), (_req, res) => {
      res.status(401).json({ ok: false });
    });

    await request(app).post("/login");
    await request(app).post("/login");
    const limited = await request(app).post("/login");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.body.meta.requestId).toBe("rate-test");
  });

  it("returns 400 for a malformed login body instead of an internal error", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send("{");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("returns 503 when MongoDB is not connected", async () => {
    const previousAccess = env.ACCESS_TOKEN_SECRET;
    const previousRefresh = env.REFRESH_TOKEN_SECRET;
    env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
    env.REFRESH_TOKEN_SECRET = REFRESH_SECRET;
    const connection = mongoose.connection;
    const descriptor = Object.getOwnPropertyDescriptor(connection, "readyState");
    Object.defineProperty(connection, "readyState", {
      configurable: true,
      get: () => 0,
    });
    try {
      const response = await request(createApp())
        .post("/api/v1/auth/login")
        .set("Origin", "http://localhost:3000")
        .set("Content-Type", "application/json")
        .send({ email: "nobody@example.com", password: "correct-horse-battery" });
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(response.body.data).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain("correct-horse");
    } finally {
      env.ACCESS_TOKEN_SECRET = previousAccess;
      env.REFRESH_TOKEN_SECRET = previousRefresh;
      if (descriptor) {
        Object.defineProperty(connection, "readyState", descriptor);
      } else {
        delete (connection as { readyState?: number }).readyState;
      }
    }
  });
});
