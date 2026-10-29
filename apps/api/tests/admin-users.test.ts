import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { adminUserHooks } from "../src/modules/identity/admin-users/admin-user.service.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { RefreshFamily } from "../src/modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const PASSWORD = "correct-horse-battery";
const SECRET_PASSWORD = "Distinct-Test-Secret-48";
const ACCESS = "access-secret-step48-0123456789abcdef";
const REFRESH = "refresh-secret-step48-0123456789abcdef";
const app = createApp();

async function seedRoles() {
  const keys = Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[];
  for (const key of keys) {
    await Role.create({
      key,
      name: SYSTEM_ROLE_META[key].name,
      description: SYSTEM_ROLE_META[key].description,
      permissions: [...SYSTEM_ROLE_PERMISSIONS[key]],
      scopeType: SYSTEM_ROLE_META[key].scopeType,
      isActive: true,
    });
  }
}

async function makeUser(input: {
  email: string;
  role: SystemRoleKey;
  agencyId: unknown;
  firstName?: string;
  status?: string;
  emailVerified?: boolean;
  epoch?: number;
}) {
  const role = await Role.findOne({ key: input.role });
  if (!role) throw new Error("missing role");
  return User.create({
    firstName: input.firstName ?? "Staff",
    lastName: "User",
    email: input.email,
    passwordHash: await hash(PASSWORD, 4),
    roleId: role._id,
    agencyId: input.agencyId,
    status: input.status ?? "ACTIVE",
    emailVerified: input.emailVerified ?? true,
    credentialEpoch: input.epoch ?? 0,
  });
}

async function tokenFor(userId: string, epoch = 0) {
  return (await signAccessToken(userId, epoch)).token;
}

describe("step 48 admin user management", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    adminUserHooks.beforeAudit = async () => {};
    vi.restoreAllMocks();
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const ministry = await Agency.create({
      code: "MIN_WORKS",
      name: "Ministry of Works",
      type: "MINISTRY",
      status: "ACTIVE",
    });
    const child = await Agency.create({
      code: "RDA_WEST",
      name: "Western Road",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: ministry._id,
    });
    const other = await Agency.create({
      code: "MIN_WATER",
      name: "Ministry of Water",
      type: "MINISTRY",
      status: "ACTIVE",
    });
    const superUser = await makeUser({ email: "super@example.com", role: "SUPER_ADMIN", agencyId: ministry._id, firstName: "Super" });
    const superPeer = await makeUser({ email: "super-peer@example.com", role: "SUPER_ADMIN", agencyId: ministry._id, firstName: "Peer" });
    const gov = await makeUser({ email: "gov@example.com", role: "GOV_ADMIN", agencyId: ministry._id, firstName: "Gov" });
    const officer = await makeUser({ email: "officer@example.com", role: "AGENCY_OFFICER", agencyId: child._id, firstName: "Nila" });
    const outsider = await makeUser({ email: "outsider@example.com", role: "AGENCY_OFFICER", agencyId: other._id, firstName: "Out" });
    const manager = await makeUser({ email: "pm@example.com", role: "PROJECT_MANAGER", agencyId: child._id, firstName: "Pm" });
    const citizen = await makeUser({ email: "citizen@example.com", role: "CITIZEN", agencyId: null, firstName: "Citizen" });
    return {
      ministry,
      child,
      other,
      superUser,
      superPeer,
      gov,
      officer,
      outsider,
      manager,
      citizen,
      superToken: await tokenFor(superUser._id.toString()),
      peerToken: await tokenFor(superPeer._id.toString()),
      govToken: await tokenFor(gov._id.toString()),
      officerToken: await tokenFor(officer._id.toString()),
      managerToken: await tokenFor(manager._id.toString()),
    };
  }

  it("scopes the directory and rejects unauthenticated or under-privileged callers", async () => {
    const data = await world();
    const anon = await request(app).get("/api/v1/admin/users");
    expect(anon.status).toBe(401);

    const malformed = await request(app).get("/api/v1/admin/users").set("Authorization", "Bearer not-a-token");
    expect(malformed.status).toBe(401);

    const stale = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${await tokenFor(data.superUser._id.toString(), 9)}`);
    expect(stale.status).toBe(401);

    const manager = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.managerToken}`);
    expect(manager.status).toBe(403);

    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $set: { permissions: ["user.read", "profile.read"] } });
    const injected = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.managerToken}`);
    expect(injected.status).toBe(403);

    const officerList = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.officerToken}`);
    expect(officerList.status).toBe(200);
    expect(officerList.headers["cache-control"]).toContain("no-store");
    expect(officerList.body.data.users.map((user: { email: string }) => user.email).sort()).toEqual([
      "officer@example.com",
      "pm@example.com",
    ]);
    expect(JSON.stringify(officerList.body)).not.toContain("passwordHash");
    expect(JSON.stringify(officerList.body)).not.toContain("credentialEpoch");

    const hidden = await request(app)
      .get(`/api/v1/admin/users/${data.outsider._id.toString()}`)
      .set("Authorization", `Bearer ${data.officerToken}`);
    expect(hidden.status).toBe(404);

    const govList = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`);
    const govEmails = govList.body.data.users.map((user: { email: string }) => user.email).sort();
    expect(govEmails).toEqual(["gov@example.com", "officer@example.com", "pm@example.com", "super-peer@example.com", "super@example.com"].sort());
    expect(govEmails).not.toContain("outsider@example.com");
    expect(govEmails).not.toContain("citizen@example.com");

    const superList = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.superToken}`);
    const superEmails = superList.body.data.users.map((user: { email: string }) => user.email);
    expect(superEmails).toContain("outsider@example.com");
    expect(superEmails).not.toContain("citizen@example.com");

    const profile = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${data.officerToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.profile.email).toBe("officer@example.com");
  });

  it("creates pending staff inside scope and refuses escalation, duplicates, and leaks", async () => {
    const data = await world();
    const created = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({
        firstName: "නිමල්",
        lastName: "Perera",
        email: "New.Staff@example.com",
        password: SECRET_PASSWORD,
        roleKey: "AGENCY_OFFICER",
        agencyCode: "RDA_WEST",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.activationDelivery).toBe("BLOCKED");
    expect(created.body.data.notice).toMatch(/unavailable/i);
    expect(created.body.data.user).toMatchObject({
      email: "new.staff@example.com",
      status: "PENDING",
      emailVerified: false,
      roleKey: "AGENCY_OFFICER",
    });
    expect(JSON.stringify(created.body)).not.toContain(SECRET_PASSWORD);
    expect(JSON.stringify(created.body)).not.toContain("passwordHash");
    const stored = await User.findOne({ email: "new.staff@example.com" }).select("+passwordHash");
    expect(stored?.status).toBe("PENDING");
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toBe(SECRET_PASSWORD);

    const duplicate = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({
        firstName: "Other",
        lastName: "Person",
        email: "new.staff@example.com",
        password: SECRET_PASSWORD,
        roleKey: "INSPECTOR",
        agencyCode: "RDA_WEST",
      });
    expect(duplicate.status).toBe(409);
    expect(await User.countDocuments({ email: "new.staff@example.com" })).toBe(1);

    const peerAdmin = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({
        firstName: "Peer",
        lastName: "Admin",
        email: "peer-admin@example.com",
        password: SECRET_PASSWORD,
        roleKey: "GOV_ADMIN",
        agencyCode: "MIN_WORKS",
      });
    expect(peerAdmin.status).toBe(403);

    const cross = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({
        firstName: "Cross",
        lastName: "Org",
        email: "cross@example.com",
        password: SECRET_PASSWORD,
        roleKey: "AGENCY_OFFICER",
        agencyCode: "MIN_WATER",
      });
    expect(cross.status).toBe(403);
    expect(await User.countDocuments({ email: "cross@example.com" })).toBe(0);

    const platform = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.superToken}`)
      .send({
        firstName: "Root",
        lastName: "Admin",
        email: "root@example.com",
        password: SECRET_PASSWORD,
        roleKey: "SUPER_ADMIN",
        agencyCode: null,
      });
    expect(platform.status).toBe(409);

    const injected = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.superToken}`)
      .send({
        firstName: "Bad",
        lastName: "Body",
        email: "bad@example.com",
        password: SECRET_PASSWORD,
        roleKey: "AGENCY_OFFICER",
        agencyCode: "RDA_WEST",
        status: "ACTIVE",
        emailVerified: true,
        $set: { status: "ACTIVE" },
      });
    expect(injected.status).toBe(400);

    const officerCreate = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.officerToken}`)
      .send({
        firstName: "No",
        lastName: "Create",
        email: "no-create@example.com",
        password: SECRET_PASSWORD,
        roleKey: "AGENCY_OFFICER",
        agencyCode: "RDA_WEST",
      });
    expect(officerCreate.status).toBe(403);

    const media = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.govToken}`)
      .set("Content-Type", "text/plain")
      .send("nope");
    expect(media.status).toBe(415);
  });

  it("disables with epoch revocation, protects the last super admin, and rolls back audit", async () => {
    const data = await world();
    await RefreshFamily.create({
      familyId: "family-officer",
      userId: data.officer._id,
      expiresAt: new Date(Date.now() + 60_000),
      credentialEpoch: 0,
      activeTokenHash: "hash-value-0123456789",
    });
    await RefreshSession.create({
      userId: data.officer._id,
      tokenHash: "session-hash-0123456789",
      familyId: "family-officer",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const self = await request(app)
      .post(`/api/v1/admin/users/${data.superUser._id.toString()}/disable`)
      .set("Authorization", `Bearer ${data.superToken}`)
      .send({ revision: 0 });
    expect(self.status).toBe(409);

    const govOnSuper = await request(app)
      .post(`/api/v1/admin/users/${data.superUser._id.toString()}/disable`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ revision: 0 });
    expect(govOnSuper.status).toBe(403);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/admin/users/${data.superPeer._id.toString()}/disable`)
        .set("Authorization", `Bearer ${data.superToken}`)
        .send({ revision: 0 }),
      request(app)
        .post(`/api/v1/admin/users/${data.superUser._id.toString()}/disable`)
        .set("Authorization", `Bearer ${data.peerToken}`)
        .send({ revision: 0 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(200);
    expect([401, 409]).toContain(statuses[1]);
    const stillActive = await User.countDocuments({ roleId: data.superUser.roleId, status: "ACTIVE", emailVerified: true });
    expect(stillActive).toBe(1);
    const superUserAfterRace = await User.findById(data.superUser._id);
    const superPeerAfterRace = await User.findById(data.superPeer._id);
    const actingAdminToken =
      superUserAfterRace?.status === "ACTIVE"
        ? await tokenFor(data.superUser._id.toString(), superUserAfterRace.credentialEpoch ?? 0)
        : await tokenFor(data.superPeer._id.toString(), superPeerAfterRace?.credentialEpoch ?? 0);
    data.superToken = actingAdminToken;

    const disabled = await request(app)
      .post(`/api/v1/admin/users/${data.officer._id.toString()}/disable`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ revision: 0 });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.user.status).toBe("DISABLED");
    const officerNow = await User.findById(data.officer._id);
    expect(officerNow?.credentialEpoch).toBe(1);
    expect(officerNow?.status).toBe("DISABLED");
    const family = await RefreshFamily.findOne({ familyId: "family-officer" });
    expect(family?.closedAt).toBeTruthy();
    const session = await RefreshSession.findOne({ familyId: "family-officer" });
    expect(session?.revokedAt).toBeTruthy();

    const oldAccess = await request(app)
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${data.officerToken}`);
    expect(oldAccess.status).toBe(401);
    const peerAccess = await request(app)
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${data.managerToken}`);
    expect(peerAccess.status).toBe(200);

    await User.updateOne({ _id: data.officer._id }, { $set: { emailVerified: false } });
    const blockedEnable = await request(app)
      .post(`/api/v1/admin/users/${data.officer._id.toString()}/enable`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ revision: disabled.body.data.user.revision });
    expect(blockedEnable.status).toBe(409);
    await User.updateOne({ _id: data.officer._id }, { $set: { emailVerified: true } });
    const enabled = await request(app)
      .post(`/api/v1/admin/users/${data.officer._id.toString()}/enable`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ revision: disabled.body.data.user.revision });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.user.emailVerified).toBe(true);
    expect(enabled.body.data.user.status).toBe("ACTIVE");

    adminUserHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const outsiderBefore = await User.findById(data.outsider._id);
    const rolled = await request(app)
      .post(`/api/v1/admin/users/${data.outsider._id.toString()}/disable`)
      .set("Authorization", `Bearer ${data.superToken}`)
      .send({ revision: outsiderBefore?.__v ?? 0 });
    expect(rolled.status).toBe(503);
    const outsiderAfter = await User.findById(data.outsider._id);
    expect(outsiderAfter?.status).toBe("ACTIVE");
    expect(await AuditLog.countDocuments({ resourceId: data.outsider._id })).toBe(0);
  });

  it("rejects unsafe name updates and bumps epoch on super-admin assignment", async () => {
    const data = await world();
    const badId = await request(app)
      .get("/api/v1/admin/users/not-an-id")
      .set("Authorization", `Bearer ${data.superToken}`);
    expect(badId.status).toBe(400);

    const renamed = await request(app)
      .patch(`/api/v1/admin/users/${data.officer._id.toString()}`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ firstName: "Updated", lastName: "Officer", revision: 0, roleKey: "SUPER_ADMIN" });
    expect(renamed.status).toBe(400);
    expect((await User.findById(data.officer._id))?.firstName).toBe("Nila");

    const ok = await request(app)
      .patch(`/api/v1/admin/users/${data.officer._id.toString()}`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ firstName: "Updated", lastName: "Officer", revision: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.firstName).toBe("Updated");

    const govAssign = await request(app)
      .post(`/api/v1/admin/users/${data.officer._id.toString()}/assignment`)
      .set("Authorization", `Bearer ${data.govToken}`)
      .send({ revision: ok.body.data.user.revision, roleKey: "INSPECTOR" });
    expect(govAssign.status).toBe(403);

    const assigned = await request(app)
      .post(`/api/v1/admin/users/${data.officer._id.toString()}/assignment`)
      .set("Authorization", `Bearer ${data.superToken}`)
      .send({ revision: ok.body.data.user.revision, roleKey: "PROJECT_MANAGER", agencyCode: "MIN_WATER" });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.user.roleKey).toBe("PROJECT_MANAGER");
    expect(assigned.body.data.user.agencyId).toBe(data.other._id.toString());
    expect((await User.findById(data.officer._id))?.credentialEpoch).toBe(1);

    vi.spyOn(User, "countDocuments").mockRejectedValueOnce(new Error("db down"));
    const down = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${data.superToken}`);
    expect(down.status).toBe(503);
  });
});
