import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { resetAuthNowForTests, setAuthNowForTests } from "../src/modules/identity/auth/auth.clock.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const PASSWORD = "correct-horse-battery";
const ACCESS = "access-secret-step47-0123456789abcdef";
const REFRESH = "refresh-secret-step47-0123456789abcdef";
const app = createApp();

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
  const agency = await Agency.create({
    code: `P47_${email.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase()}`,
    name: "Profile Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash(PASSWORD, 4),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
    lastLoginAt: new Date("2026-10-01T08:00:00.000Z"),
  });
  const token = (await signAccessToken(user._id.toString(), 0)).token;
  return { role, agency, user, token };
}

describe("step 47 profile self-service", { timeout: 90_000 }, () => {
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

  it("returns a safe own-user projection and rejects unsafe access", async () => {
    const { user, token, agency } = await seedOfficer("profile-read@example.com");
    const read = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.headers["cache-control"]).toContain("no-store");
    expect(read.body.data.profile).toMatchObject({
      id: user._id.toString(),
      firstName: "Nila",
      lastName: "Perera",
      displayName: "Nila Perera",
      email: "profile-read@example.com",
      emailVerified: true,
      status: "ACTIVE",
      roleKey: "AGENCY_OFFICER",
      agencyId: agency._id.toString(),
      agencyName: "Profile Agency",
      revision: 0,
    });
    expect(read.body.data.profile.lastLoginAt).toBe("2026-10-01T08:00:00.000Z");
    const raw = JSON.stringify(read.body);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("credentialEpoch");
    expect(raw).not.toContain('"permissions"');
    expect(raw).not.toContain("__v");

    const missing = await request(app).get("/api/v1/profile/me");
    expect(missing.status).toBe(401);

    const other = await seedOfficer("profile-other@example.com");
    const foreign = await request(app)
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${other.token}`)
      .query({ userId: user._id.toString() });
    expect(foreign.status).toBe(200);
    expect(foreign.body.data.profile.id).toBe(other.user._id.toString());
  });

  it("patches names with unicode, rejects privilege fields, and keeps auth/me working", async () => {
    const { user, token } = await seedOfficer("profile-patch@example.com");
    const patch = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ firstName: "නිමල්", lastName: "පෙරේරා", revision: 0 });
    expect(patch.status).toBe(200);
    expect(patch.body.data.profile.firstName).toBe("නිමල්");
    expect(patch.body.data.profile.revision).toBe(1);

    const injected = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        firstName: "නිමල්",
        lastName: "පෙරේරා",
        revision: 1,
        email: "evil@example.com",
        roleKey: "SUPER_ADMIN",
      });
    expect(injected.status).toBe(400);

    const stored = await User.findById(user._id);
    expect(stored?.email).toBe("profile-patch@example.com");
    expect(stored?.roleId.toString()).toBe(user.roleId.toString());

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.displayName).toBe("නිමල් පෙරේරා");
  });

  it("returns 409 on stale revision and allows only one concurrent writer", async () => {
    const { token } = await seedOfficer("profile-conflict@example.com");
    const raced = await Promise.all([
      request(app)
        .patch("/api/v1/profile/me")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/json")
        .send({ firstName: "A", lastName: "One", revision: 0 }),
      request(app)
        .patch("/api/v1/profile/me")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/json")
        .send({ firstName: "B", lastName: "Two", revision: 0 }),
    ]);
    expect(raced.map((item) => item.status).sort()).toEqual([200, 409]);

    const stale = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ firstName: "Stale", lastName: "Writer", revision: 0 });
    expect(stale.status).toBe(409);
  });

  it("denies missing grants, wrong media, and dependency failures", async () => {
    const { role, token } = await seedOfficer("profile-deny@example.com");
    role.permissions = role.permissions.filter((item) => item !== "profile.read");
    await role.save();
    expect(
      (await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${token}`)).status,
    ).toBe(403);

    role.permissions = role.permissions.filter((item) => item !== "profile.update");
    await role.save();
    const forbidden = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ firstName: "No", lastName: "Grant", revision: 0 });
    expect(forbidden.status).toBe(403);

    role.permissions = [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER];
    await role.save();

    const unsupported = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .send("firstName=x");
    expect(unsupported.status).toBe(415);

    vi.spyOn(User, "findOne").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const down = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${token}`);
    expect(down.status).toBe(503);
    expect(JSON.stringify(down.body)).not.toContain("database unavailable");
  });

  it("rejects expired tokens and operator injection without mutating the user", async () => {
    const { user, token } = await seedOfficer("profile-epoch@example.com");
    setAuthNowForTests(() => new Date(Date.now() + 20 * 60 * 1000));
    const expired = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${token}`);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
    resetAuthNowForTests();
    const fresh = (await signAccessToken(user._id.toString(), 0)).token;

    const operator = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${fresh}`)
      .set("Content-Type", "application/json")
      .send({ firstName: "Safe", lastName: "Name", revision: 0, $set: { email: "evil@example.com" } });
    expect(operator.status).toBe(400);
    expect((await User.findById(user._id))?.firstName).toBe("Nila");
  });

  it("does not expose another user through forged body userId on patch", async () => {
    const victim = await seedOfficer("profile-victim@example.com");
    const attacker = await seedOfficer("profile-attacker@example.com");
    const attempt = await request(app)
      .patch("/api/v1/profile/me")
      .set("Authorization", `Bearer ${attacker.token}`)
      .set("Content-Type", "application/json")
      .send({
        firstName: "Hacked",
        lastName: "Victim",
        revision: 0,
        userId: victim.user._id.toString(),
      });
    expect(attempt.status).toBe(400);
    const still = await User.findById(victim.user._id);
    expect(still?.firstName).toBe("Nila");
  });
});
