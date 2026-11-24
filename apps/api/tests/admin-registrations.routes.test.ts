import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

/**
 * Regression: the admin registration router existed but was never mounted on /api/v1, so the admin
 * "Registration requests" page always received 404. These tests pin the mount AND the access control.
 */
describe("GET/POST /api/v1/admin/registrations (mounted + RBAC)", () => {
  const app = createApp();

  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-test-0123456789abcdef0123456789";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-test-0123456789abcdef0123456789";
    await startIsolatedMongo();
  });
  afterAll(async () => {
    await stopIsolatedMongo();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Role.deleteMany({}), Agency.deleteMany({})]);
  });

  async function actor(permissions: string[], roleKey: "GOV_ADMIN" | "PROJECT_MANAGER" | "AGENCY_OFFICER" = "GOV_ADMIN") {
    const agency = await Agency.create({
      code: `AGY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: "Test Agency",
      type: "MINISTRY",
      status: "ACTIVE",
    });
    const role = await Role.create({
      key: roleKey,
      name: "Test Role",
      description: "Test role description",
      scopeType: "ASSIGNED_PROJECT",
      permissions,
      isSystem: true,
      isActive: true,
    });
    const user = await User.create({
      firstName: "Test",
      lastName: "User",
      email: `u${Date.now()}_${Math.random()}@test.gov.lk`,
      passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrst",
      roleId: role._id,
      agencyId: agency._id,
      status: "ACTIVE",
      emailVerified: true,
      credentialEpoch: 1,
    });
    const { token } = await signAccessToken(user._id.toString(), 1);
    return token;
  }

  it("is mounted: unauthenticated requests get 401, not 404", async () => {
    const res = await request(app).get("/api/v1/admin/registrations");
    expect(res.status).toBe(401);
  });

  it("denies a user without user.read or with user.read only (agency staff), allows reviewers (200)", async () => {
    const denied = await actor(["project.read"], "PROJECT_MANAGER");
    const deniedRes = await request(app).get("/api/v1/admin/registrations").set("Authorization", `Bearer ${denied}`);
    expect(deniedRes.status).toBe(403);

    // AGENCY_OFFICER holds user.read: it must NOT see platform-wide applicant PII.
    const officer = await actor(["user.read"], "AGENCY_OFFICER");
    const officerRes = await request(app).get("/api/v1/admin/registrations").set("Authorization", `Bearer ${officer}`);
    expect(officerRes.status).toBe(403);

    const allowed = await actor(["user.read", "user.create"]);
    const okRes = await request(app).get("/api/v1/admin/registrations?status=PENDING&page=1&limit=15").set("Authorization", `Bearer ${allowed}`);
    expect(okRes.status).toBe(200);
  });

  it("denies approval without user.create even with user.read", async () => {
    const token = await actor(["user.read"], "AGENCY_OFFICER");
    const res = await request(app)
      .post("/api/v1/admin/registrations/000000000000000000000000/approve")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
