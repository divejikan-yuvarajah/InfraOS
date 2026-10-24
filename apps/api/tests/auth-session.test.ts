import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { resetAuthNowForTests, setAuthNowForTests } from "../src/modules/identity/auth/auth.clock.js";
import { verifyAccessToken } from "../src/modules/identity/auth/jwt.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { NON_LOGIN_PASSWORD_HASH } from "../src/database/seeds/helpers/fixture-users.js";
import { LOG_REDACT_PATHS } from "../src/shared/logger.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const PASSWORD = "correct-horse-battery";
const app = createApp();

function origin(): string {
  return env.FRONTEND_ORIGIN;
}

function cookieHeader(response: request.Response): string {
  const raw = response.headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : raw;
  expect(line).toBeTruthy();
  return (line ?? "").split(";")[0] ?? "";
}

async function seedOfficer(email: string, overrides: Record<string, unknown> = {}) {
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
  const slug = email.split("@")[0]?.replace(/[^A-Za-z0-9]/g, "").slice(0, 18).toUpperCase();
  const agency = await Agency.create({
    code: `AUTH_${slug}`,
    name: "Auth Test Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  const passwordHash = await hash(PASSWORD, 12);
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash,
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    ...overrides,
  });
  return { role, agency, user };
}

describe("step 39 login and refresh", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step39-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step39-0123456789abcdef";
    await startIsolatedMongo();
    await Promise.all([
      User.syncIndexes(),
      RefreshSession.syncIndexes(),
      Role.syncIndexes(),
      Agency.syncIndexes(),
    ]);
  }, 300_000);

  afterEach(async () => {
    resetAuthNowForTests();
    vi.restoreAllMocks();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("logs in an active verified officer and sets a host-only refresh cookie", async () => {
    await seedOfficer("officer@example.com");
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .set("Content-Type", "application/json")
      .send({ email: "  Officer@Example.com ", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("officer@example.com");
    expect(response.body.data.user.roleKey).toBe("AGENCY_OFFICER");
    expect(response.body.data.user.status).toBe("ACTIVE");
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.accessTokenExpiresInSeconds).toBe(900);
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    const header = String(response.headers["set-cookie"]);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=None/i);
    expect(header).toContain("Path=/api/v1/auth");
    expect(header.toLowerCase()).not.toContain("domain=");
    expect(response.headers["cache-control"]).toContain("no-store");
    const claims = await verifyAccessToken(response.body.data.accessToken);
    expect(claims.sub).toBe(response.body.data.user.id);
    expect(claims.credentialEpoch).toBe(0);
    const stored = await RefreshSession.findOne({ userId: response.body.data.user.id }).select(
      "+tokenHash",
    );
    expect(stored?.tokenHash).toEqual(expect.any(String));
    expect(stored?.tokenHash).not.toContain(cookieHeader(response).split("=")[1] ?? "missing");
  });

  it("returns the same generic 401 for a wrong password and an unknown email", async () => {
    await seedOfficer("known@example.com");
    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "known@example.com", password: "not-the-password" });
    const missing = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "missing@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.error.code).toBe("AUTH_REQUIRED");
    expect(missing.body.error.code).toBe(wrong.body.error.code);
    expect(missing.body.error.message).toBe(wrong.body.error.message);
  });

  it("denies inactive accounts, unverified active accounts, and the non-login fixture hash", async () => {
    const pending = await seedOfficer("pending@example.com", { status: "PENDING" });
    await User.create({
      firstName: "A",
      lastName: "B",
      email: "suspended@example.com",
      passwordHash: pending.user.passwordHash,
      roleId: pending.role._id,
      agencyId: pending.agency._id,
      status: "SUSPENDED",
      emailVerified: true,
    });
    await User.create({
      firstName: "A",
      lastName: "B",
      email: "disabled@example.com",
      passwordHash: pending.user.passwordHash,
      roleId: pending.role._id,
      agencyId: pending.agency._id,
      status: "DISABLED",
      emailVerified: true,
    });
    await User.create({
      firstName: "A",
      lastName: "B",
      email: "unverified@example.com",
      passwordHash: pending.user.passwordHash,
      roleId: pending.role._id,
      agencyId: pending.agency._id,
      status: "ACTIVE",
      emailVerified: false,
    });
    await User.create({
      firstName: "A",
      lastName: "B",
      email: "fixture@example.com",
      passwordHash: NON_LOGIN_PASSWORD_HASH,
      roleId: pending.role._id,
      agencyId: pending.agency._id,
      status: "ACTIVE",
      emailVerified: true,
    });

    for (const email of [
      "pending@example.com",
      "suspended@example.com",
      "disabled@example.com",
      "unverified@example.com",
      "fixture@example.com",
    ]) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", origin())
        .send({ email, password: PASSWORD });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_REQUIRED");
      expect(response.headers["set-cookie"]).toBeUndefined();
    }

    await seedOfficer("inactive-role@example.com");
    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $set: { isActive: false } });
    const inactiveRole = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "inactive-role@example.com", password: PASSWORD });
    expect(inactiveRole.status).toBe(401);

    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $set: { isActive: true } });
    await seedOfficer("inactive-agency@example.com");
    await Agency.updateOne({ code: "AUTH_INACTIVEAGENCY" }, { $set: { status: "INACTIVE" } });
    const inactiveAgency = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "inactive-agency@example.com", password: PASSWORD });
    expect(inactiveAgency.status).toBe(401);
  });

  it("rejects injected fields, a disallowed origin, and a non-JSON body", async () => {
    await seedOfficer("guard@example.com");
    const injected = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "guard@example.com", password: PASSWORD, role: "SUPER_ADMIN" });
    expect(injected.status).toBe(400);
    const originDenied = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "guard@example.com", password: PASSWORD });
    expect(originDenied.status).toBe(403);
    const text = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .set("Content-Type", "text/plain")
      .send("email=guard@example.com");
    expect(text.status).toBe(415);
  });

  it("rotates once, rejects replay outside the grace window, and leaves another family alone", async () => {
    await seedOfficer("rotate@example.com");
    await seedOfficer("other@example.com");
    const first = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "rotate@example.com", password: PASSWORD });
    const other = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "other@example.com", password: PASSWORD });
    const oldCookie = cookieHeader(first);
    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", oldCookie);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).not.toBe(first.body.data.accessToken);
    const successorCookie = cookieHeader(rotated);
    expect(successorCookie).not.toBe(oldCookie);

    setAuthNowForTests(() => new Date(Date.now() + 11_000));
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", oldCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("SESSION_EXPIRED");

    const family = await RefreshSession.find({ userId: first.body.data.user.id });
    expect(family.every((row) => row.revokedAt)).toBe(true);
    const otherStill = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookieHeader(other));
    expect(otherStill.status).toBe(200);
    expect(successorCookie.length).toBeGreaterThan(10);
  });

  it("allows only one successor when the same refresh cookie is presented concurrently", async () => {
    await seedOfficer("race@example.com");
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "race@example.com", password: PASSWORD });
    const cookie = cookieHeader(login);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", origin())
          .set("Cookie", cookie),
      ),
    );
    expect(results.filter((item) => item.status === 200)).toHaveLength(1);
    const live = await RefreshSession.countDocuments({
      userId: login.body.data.user.id,
      revokedAt: null,
    });
    expect(live).toBe(1);
  });

  it("does not extend the original refresh expiry and rejects a disabled account", async () => {
    await seedOfficer("expiry@example.com");
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "expiry@example.com", password: PASSWORD });
    const original = await RefreshSession.findOne({ userId: login.body.data.user.id });
    expect(original).toBeTruthy();
    setAuthNowForTests(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookieHeader(login));
    expect(rotated.status).toBe(200);
    const successor = await RefreshSession.findOne({
      userId: login.body.data.user.id,
      revokedAt: null,
    });
    expect(successor?.expiresAt.toISOString()).toBe(original?.expiresAt.toISOString());

    await User.updateOne({ _id: login.body.data.user.id }, { $set: { status: "DISABLED" } });
    const blocked = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookieHeader(rotated));
    expect(blocked.status).toBe(401);
  });

  it("rejects a logically expired refresh session without issuing a cookie", async () => {
    await seedOfficer("stale@example.com");
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "stale@example.com", password: PASSWORD });
    setAuthNowForTests(() => new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    const stale = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin())
      .set("Cookie", cookieHeader(login));
    expect(stale.status).toBe(401);
    const cleared = String(stale.headers["set-cookie"] ?? "");
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(await RefreshSession.countDocuments({ userId: login.body.data.user.id })).toBe(1);
  });

  it("does not set a cookie when the refresh session cannot be stored", async () => {
    await seedOfficer("outage@example.com");
    vi.spyOn(RefreshSession, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .send({ email: "outage@example.com", password: PASSWORD });
    expect(response.status).toBe(503);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body.data).toBeUndefined();
  });

  it("redacts credential fields from the logger configuration", () => {
    expect(LOG_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        "req.headers.authorization",
        "req.headers.cookie",
        "password",
        "passwordHash",
        "accessToken",
        "refreshToken",
        "tokenHash",
      ]),
    );
  });
});
