import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("public read endpoints: cache headers and no private data", () => {
  const app = createApp();
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-test-0123456789abcdef0123456789";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-test-0123456789abcdef0123456789";
    await startIsolatedMongo();
  });
  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it.each(["/api/v1/public/summary", "/api/v1/public/projects", "/api/v1/public/map/features"])(
    "%s is anonymous and cacheable for a short time",
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toMatch(/public, max-age=30/);
    },
  );

  it("never makes issue tracking cacheable (no-store stays on the tracking route)", async () => {
    const res = await request(app).post("/api/v1/public/issues/track").send({ referenceNo: "ISS-2026-000001", trackingSecret: "not-a-real-secret" });
    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
  });
});
