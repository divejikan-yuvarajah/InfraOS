import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { requirePermission } from "../src/modules/identity/authorization/require-permission.js";
import { resetAuthNowForTests, setAuthNowForTests } from "../src/modules/identity/auth/auth.clock.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  SYSTEM_ROLE_META,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/modules/identity/seed/system-role-permissions.js";
import type { SystemRoleKey } from "@infraos/shared-types";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { createPermissionHarness } from "./helpers/permission-harness.js";

const ACCESS = "access-secret-step45-0123456789abcdef";
const REFRESH = "refresh-secret-step45-0123456789abcdef";
const harness = createPermissionHarness();
const app = createApp();

async function seedActor(roleKey: SystemRoleKey, email: string) {
  const meta = SYSTEM_ROLE_META[roleKey];
  const role = await Role.create({
    key: roleKey,
    name: meta.name,
    description: meta.description,
    permissions: [...SYSTEM_ROLE_PERMISSIONS[roleKey]],
    scopeType: meta.scopeType,
    isActive: true,
  });
  const agency = await Agency.create({
    code: `P45_${roleKey.slice(0, 8)}_${email.replace(/[^A-Za-z0-9]/g, "").slice(0, 8)}`,
    name: "Permission Test Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
  });
  const access = await signAccessToken(user._id.toString(), 0);
  return { role, agency, user, token: access.token };
}

function bearer(token: string) {
  return request(harness).get("/harness/project-read").set("Authorization", `Bearer ${token}`);
}

describe("step 45 permission authorization", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    resetAuthNowForTests();
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    vi.restoreAllMocks();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("allows a current grant and denies a missing one without leaking the role document", async () => {
    const officer = await seedActor("AGENCY_OFFICER", "officer-p45@example.com");
    const allowed = await bearer(officer.token);
    expect(allowed.status).toBe(200);
    expect(allowed.headers["cache-control"]).toContain("no-store");
    expect(allowed.body.data).toEqual({ allowed: true });
    expect(JSON.stringify(allowed.body)).not.toContain("passwordHash");
    expect(allowed.body.data.permissions).toBeUndefined();

    const citizen = await seedActor("CITIZEN", "citizen-p45@example.com");
    const denied = await request(harness)
      .get("/harness/payment-approve")
      .set("Authorization", `Bearer ${citizen.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
    expect(denied.headers["cache-control"]).toContain("no-store");
    expect(JSON.stringify(denied.body)).not.toContain("finance.payment.approve");
    expect(JSON.stringify(denied.body)).not.toContain("permissions");
  });

  it("keeps invalid bearers on 401 and does not continue when the actor is missing", async () => {
    const officer = await seedActor("AGENCY_OFFICER", "bearer-p45@example.com");
    const missing = await request(harness).get("/harness/project-read");
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("AUTH_REQUIRED");

    const basic = await request(harness)
      .get("/harness/project-read")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(basic.status).toBe(401);

    const forged = await new SignJWT({ typ: "access", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject(officer.user._id.toString())
      .setJti("jti-forged")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("different-access-secret-0123456789abcd"));
    expect(
      (await bearer(forged)).body.error.code,
    ).toBe("AUTH_REQUIRED");

    setAuthNowForTests(() => new Date(Date.now() + 20 * 60 * 1000));
    const expired = await bearer(officer.token);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
    resetAuthNowForTests();

    const skipped = await request(harness)
      .get("/harness/permission-only")
      .set("Authorization", `Bearer ${officer.token}`);
    expect(skipped.status).toBe(401);
    expect(skipped.body.error.code).toBe("AUTH_REQUIRED");

    let continued = false;
    const response = {
      setHeader() {
        return this;
      },
      status(code: number) {
        expect(code).toBe(401);
        return this;
      },
      json() {
        return this;
      },
    };
    await requirePermission("project.read")(
      { requestId: "direct" } as never,
      response as never,
      () => {
        continued = true;
      },
    );
    expect(continued).toBe(false);
  });

  it("follows role permission edits, inactivity, deletion, and reassignment on the next request", async () => {
    const officer = await seedActor("PROJECT_MANAGER", "edit-p45@example.com");
    expect((await bearer(officer.token)).status).toBe(200);

    officer.role.permissions = officer.role.permissions.filter((item) => item !== "project.read");
    await officer.role.save();
    const removed = await bearer(officer.token);
    expect(removed.status).toBe(403);
    expect(removed.body.error.code).toBe("FORBIDDEN");

    officer.role.permissions = [...officer.role.permissions, "project.read"];
    await officer.role.save();
    expect((await bearer(officer.token)).status).toBe(200);

    officer.role.isActive = false;
    await officer.role.save();
    expect((await bearer(officer.token)).status).toBe(401);

    officer.role.isActive = true;
    await officer.role.save();
    await Role.deleteOne({ _id: officer.role._id });
    expect((await bearer(officer.token)).status).toBe(401);

    const replacement = await Role.create({
      key: "AGENCY_OFFICER",
      name: SYSTEM_ROLE_META.AGENCY_OFFICER.name,
      description: SYSTEM_ROLE_META.AGENCY_OFFICER.description,
      permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
      scopeType: SYSTEM_ROLE_META.AGENCY_OFFICER.scopeType,
      isActive: true,
    });
    officer.user.roleId = replacement._id;
    await officer.user.save();
    expect((await bearer(officer.token)).status).toBe(200);

    let continued = false;
    const response = {
      setHeader() {
        return this;
      },
      status(code: number) {
        expect(code).toBe(401);
        return this;
      },
      json() {
        return this;
      },
    };
    await requirePermission("project.read")(
      {
        requestId: "stale-actor",
        actor: {
          userId: officer.user._id.toString(),
          roleId: officer.role._id.toString(),
          roleKey: "PROJECT_MANAGER",
          agencyId: officer.agency._id.toString(),
          credentialEpoch: 0,
        },
      } as never,
      response as never,
      () => {
        continued = true;
      },
    );
    expect(continued).toBe(false);
  });

  it("denies super-admin operational duties and applies the other seeded roles from the database", async () => {
    const admin = await seedActor("SUPER_ADMIN", "super-p45@example.com");
    expect(SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN).not.toContain("project.approve");
    expect(SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN).not.toContain("finance.payment.approve");
    expect(SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN).not.toContain("inspection.verify");
    expect(SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN).not.toContain("roadsync.conflict.resolve");
    for (const path of [
      "/harness/project-approve",
      "/harness/payment-approve",
      "/harness/inspection-verify",
      "/harness/conflict-resolve",
    ]) {
      const denied = await request(harness).get(path).set("Authorization", `Bearer ${admin.token}`);
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe("FORBIDDEN");
    }
    expect((await bearer(admin.token)).status).toBe(200);

    await Role.collection.updateOne(
      { _id: admin.role._id },
      { $set: { permissions: ["*"] } },
    );
    const wildcard = await bearer(admin.token);
    expect(wildcard.status).toBe(403);

    const gov = await seedActor("GOV_ADMIN", "gov-p45@example.com");
    const approve = await request(harness)
      .get("/harness/project-approve")
      .set("Authorization", `Bearer ${gov.token}`);
    expect(approve.status).toBe(200);

    const contractor = await seedActor("CONTRACTOR", "contractor-p45@example.com");
    const inspector = await seedActor("INSPECTOR", "inspector-p45@example.com");
    expect(
      (
        await request(harness)
          .get("/harness/payment-approve")
          .set("Authorization", `Bearer ${contractor.token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(harness)
          .get("/harness/payment-approve")
          .set("Authorization", `Bearer ${inspector.token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(harness)
          .get("/harness/inspection-verify")
          .set("Authorization", `Bearer ${inspector.token}`)
      ).status,
    ).toBe(200);
  });

  it("fails closed for an unknown required code and when the role query fails", async () => {
    const officer = await seedActor("AGENCY_OFFICER", "down-p45@example.com");
    let continued = false;
    const codes: number[] = [];
    const response = {
      setHeader() {
        return this;
      },
      status(code: number) {
        codes.push(code);
        return this;
      },
      json(body: { error?: { code?: string } }) {
        expect(body.error?.code).toBe("SERVICE_UNAVAILABLE");
        expect(JSON.stringify(body)).not.toContain("*");
        return this;
      },
    };
    await requirePermission("nope.nope" as never)(
      { requestId: "bad-code", actor: { userId: "u", roleId: "r", roleKey: "AGENCY_OFFICER", agencyId: "a", credentialEpoch: 0 } } as never,
      response as never,
      () => {
        continued = true;
      },
    );
    expect(continued).toBe(false);
    expect(codes).toEqual([500]);

    vi.spyOn(Role, "findById").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const down = await bearer(officer.token);
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(down.body)).not.toContain("database unavailable");
  });

  it("does not permission-lock identity, session, recovery, or health routes", async () => {
    const health = await request(app).get("/api/v1/health");
    expect(health.status).toBe(200);
    const ready = await request(app).get("/api/v1/ready");
    expect(ready.status).toBe(200);
    const me = await request(app).get("/api/v1/auth/me");
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("AUTH_REQUIRED");
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({});
    expect(login.status).toBe(400);
    const refresh = await request(app).post("/api/v1/auth/refresh").set("Origin", env.FRONTEND_ORIGIN);
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe("SESSION_EXPIRED");
    const logout = await request(app).post("/api/v1/auth/logout").set("Origin", env.FRONTEND_ORIGIN);
    expect(logout.status).toBe(204);
    const forgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({});
    expect(forgot.status).toBe(400);
    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({});
    expect(reset.status).toBe(400);
    const verify = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({});
    expect(verify.status).toBe(400);
  });
});
