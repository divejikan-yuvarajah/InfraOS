import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createCredentialRateLimit } from "../src/modules/identity/auth/auth.security.js";

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
});
