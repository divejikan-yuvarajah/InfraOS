import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const app = createApp();

describe("GET /api/v1/health", () => {
  it("returns a safe structured health payload", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      status: "ok",
      service: "infraos-api",
      timestamp: expect.any(String),
    });
    expect(response.body.meta.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(/SECRET|PASSWORD|mongodb/i);
  });

  it("allows the local frontend origin over CORS", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("echoes a valid incoming request id", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("x-request-id", "test-request-1");

    expect(response.headers["x-request-id"]).toBe("test-request-1");
    expect(response.body.meta.requestId).toBe("test-request-1");
  });
});

describe("GET /health", () => {
  it("exposes an unversioned probe for infrastructure monitors", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.data.service).toBe("infraos-api");
  });
});

describe("GET /api/v1/ready", () => {
  it("returns 503 when the database is not connected", async () => {
    const response = await request(app).get("/api/v1/ready");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_READY");
    expect(JSON.stringify(response.body)).not.toMatch(
      /SECRET|PASSWORD|mongodb\+srv|cluster\.mongodb/i,
    );
  });
});

describe("GET /ready", () => {
  it("exposes an unversioned readiness probe", async () => {
    const response = await request(app).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("NOT_READY");
  });
});

describe("unknown route", () => {
  it("returns structured JSON 404", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.body.error.message).toEqual(expect.any(String));
    expect(response.body.meta.requestId).toEqual(expect.any(String));
  });
});
