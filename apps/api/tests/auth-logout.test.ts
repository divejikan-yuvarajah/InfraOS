import { hash } from "bcryptjs";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { createCredentialRateLimit } from "../src/modules/identity/auth/auth.security.js";
import {
  refreshRotationHooks,
  resetRefreshRotationHooks,
} from "../src/modules/identity/auth/refresh-session.service.js";
import { RefreshFamily } from "../src/modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const PASSWORD = "correct-horse-battery";
const app = createApp();

function origin(): string {
  return env.FRONTEND_ORIGIN;
}

function cookiePair(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : raw;
  return (line ?? "").split(";")[0] ?? "";
}

async function seedOfficer(email: string) {
  const role =
    (await Role.findOne({ key: "AGENCY_OFFICER" })) ??
    (await Role.create({
      key: "AGENCY_OFFICER",
      name: "Agency Officer",
      description: "test officer",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
      scopeType: "AGENCY",
      isActive: true,
    }));
  const slug = email.split("@")[0]?.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
  const agency = await Agency.create({
    code: `OUT_${slug}`,
    name: "Logout Test Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash(PASSWORD, 12),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
  });
  return user;
}

async function login(email: string) {
  return request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin())
    .set("Content-Type", "application/json")
    .send({ email, password: PASSWORD });
}

describe("step 40 logout", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step39-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step39-0123456789abcdef";
    await startIsolatedMongo();
    await RefreshFamily.syncIndexes();
    await RefreshSession.syncIndexes();
  }, 300_000);

  afterEach(async () => {
    resetRefreshRotationHooks();
    vi.restoreAllMocks();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("revokes the current family, clears the cookie, and rejects a later refresh", async () => {
    await seedOfficer("logout@example.com");
    const signedIn = await login("logout@example.com");
    const cookie = cookiePair(signedIn);
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookie);
    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(JSON.stringify(response.body)).not.toContain("accessToken");
    const cleared = String(response.headers["set-cookie"]);
    expect(cleared).toMatch(/HttpOnly/i);
    expect(cleared).toMatch(/Secure/i);
    expect(cleared).toMatch(/SameSite=None/i);
    expect(cleared).toContain("Path=/api/v1/auth");
    expect(cleared.toLowerCase()).not.toContain("domain=");
    const family = await RefreshFamily.findOne({});
    expect(family?.closedAt).toBeTruthy();
    const live = await RefreshSession.countDocuments({ revokedAt: null });
    expect(live).toBe(0);
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookie);
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("logout of a rotated predecessor kills the successor and leaves another family", async () => {
    await seedOfficer("old@example.com");
    await seedOfficer("other-device@example.com");
    const first = await login("old@example.com");
    const second = await login("other-device@example.com");
    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookiePair(first));
    expect(rotated.status).toBe(200);
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookiePair(first));
    expect(logout.status).toBe(204);
    const successor = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookiePair(rotated));
    expect(successor.status).toBe(401);
    const other = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookiePair(second));
    expect(other.status).toBe(200);
  });

  it("is idempotent for a missing, unknown, or repeated cookie", async () => {
    const missing = await request(app).post("/api/v1/auth/logout").set("Origin", origin());
    expect(missing.status).toBe(204);
    const unknown = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", "infraos_refresh=not-a-real-token");
    expect(unknown.status).toBe(204);
    expect(await RefreshFamily.countDocuments()).toBe(0);
    await seedOfficer("repeat@example.com");
    const signedIn = await login("repeat@example.com");
    const again = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookiePair(signedIn));
    expect(again.status).toBe(204);
    const repeated = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookiePair(signedIn));
    expect(repeated.status).toBe(204);
  });

  it("does not revoke when the origin is not allowed", async () => {
    await seedOfficer("origin@example.com");
    const signedIn = await login("origin@example.com");
    const denied = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "https://evil.example")
      .set("Cookie", cookiePair(signedIn));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
    expect(denied.headers["set-cookie"]).toBeUndefined();
    const family = await RefreshFamily.findOne({}).select("+activeTokenHash");
    expect(family?.closedAt).toBeNull();
  });

  it("returns 503 and keeps the cookie when the family barrier cannot be written", async () => {
    await seedOfficer("outage@example.com");
    const signedIn = await login("outage@example.com");
    vi.spyOn(RefreshFamily, "findOneAndUpdate").mockRejectedValueOnce(new Error("db down"));
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookiePair(signedIn));
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("activeTokenHash");
    const family = await RefreshFamily.findOne({});
    expect(family?.closedAt).toBeNull();
  });

  it("stops a refresh that already claimed the predecessor when logout commits first", async () => {
    await seedOfficer("barrier-a@example.com");
    const signedIn = await login("barrier-a@example.com");
    const cookie = cookiePair(signedIn);
    let release: () => void = () => {};
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimed: () => void = () => {};
    const claimedGate = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    refreshRotationHooks.afterClaim = async () => {
      claimed();
      await releaseGate;
    };
    const refreshPromise = new Promise<request.Response>((resolve, reject) => {
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Origin", origin())
        .set("Cookie", cookie)
        .end((error, response) => (error ? reject(error) : resolve(response)));
    });
    await claimedGate;
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookie);
    release();
    const refresh = await refreshPromise;
    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
    expect(await RefreshSession.countDocuments({ revokedAt: null })).toBe(0);
    const family = await RefreshFamily.findOne({}).select("+activeTokenHash");
    expect(family?.closedAt).toBeTruthy();
    expect(family?.activeTokenHash ?? null).toBeNull();
  });

  it("rejects a refresh that starts after logout has closed the family", async () => {
    await seedOfficer("barrier-b@example.com");
    const signedIn = await login("barrier-b@example.com");
    const cookie = cookiePair(signedIn);
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookie);
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookie);
    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
    expect(await RefreshSession.countDocuments({ revokedAt: null })).toBe(0);
  });

  it("does not restore a claimed session when logout wins after the hash swap", async () => {
    await seedOfficer("swap@example.com");
    const signedIn = await login("swap@example.com");
    const cookie = cookiePair(signedIn);
    let release: () => void = () => {};
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let swapped: () => void = () => {};
    const swappedGate = new Promise<void>((resolve) => {
      swapped = resolve;
    });
    refreshRotationHooks.afterAuthoritySwap = async () => {
      swapped();
      await releaseGate;
    };
    const refreshPromise = new Promise<request.Response>((resolve, reject) => {
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Origin", origin())
        .set("Cookie", cookie)
        .end((error, response) => (error ? reject(error) : resolve(response)));
    });
    await swappedGate;
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin())
      .set("Cookie", cookie);
    release();
    const refresh = await refreshPromise;
    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
    expect(await RefreshSession.countDocuments({ revokedAt: null })).toBe(0);
    const retry = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookie);
    expect(retry.status).toBe(401);
  });

  it("accepts two concurrent logouts and leaves the family closed", async () => {
    await seedOfficer("twice@example.com");
    const signedIn = await login("twice@example.com");
    const cookie = cookiePair(signedIn);
    const [first, second] = await Promise.all([
      request(app).post("/api/v1/auth/logout").set("Origin", origin()).set("Cookie", cookie),
      request(app).post("/api/v1/auth/logout").set("Origin", origin()).set("Cookie", cookie),
    ]);
    expect([first.status, second.status].every((status) => status === 204)).toBe(true);
    const family = await RefreshFamily.findOne({});
    expect(family?.closedAt).toBeTruthy();
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookie);
    expect(refresh.status).toBe(401);
  });

  it("returns the standard 429 envelope from the shared credential limiter", async () => {
    const limited = express();
    limited.use((req, _res, next) => {
      req.requestId = "logout-rate";
      next();
    });
    limited.post("/logout", createCredentialRateLimit(2), (_req, res) => {
      res.status(204).end();
    });
    await request(limited).post("/logout");
    await request(limited).post("/logout");
    const blocked = await request(limited).post("/logout");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});
