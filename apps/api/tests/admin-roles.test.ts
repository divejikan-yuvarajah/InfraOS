import { hash } from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { adminRoleHooks } from "../src/modules/identity/admin-roles/admin-role.service.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const ACCESS = "access-secret-step50-0123456789abcdef";
const REFRESH = "refresh-secret-step50-0123456789abcdef";
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
      isSystem: true,
      isActive: true,
    });
  }
}

async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({
    firstName: "Ada",
    lastName: "Admin",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 2,
  });
  return { user, role: roleDoc, token: (await signAccessToken(user._id.toString(), 2)).token };
}

describe("step 50 role administration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    adminRoleHooks.beforeAudit = async () => {};
    vi.restoreAllMocks();
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const agency = await Agency.create({ code: "MIN_IAM", name: "IAM", type: "MINISTRY", status: "ACTIVE" });
    const superUser = await actor("super50@example.com", "SUPER_ADMIN", agency._id);
    const gov = await actor("gov50@example.com", "GOV_ADMIN", agency._id);
    const officer = await actor("officer50@example.com", "AGENCY_OFFICER", agency._id);
    const contractor = await actor("contractor50@example.com", "CONTRACTOR", agency._id);
    return { agency, superUser, gov, officer, contractor };
  }

  it("lists seven roles for super and gov and denies other roles", async () => {
    const data = await world();
    expect((await request(app).get("/api/v1/admin/roles")).status).toBe(401);
    const listed = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${data.superUser.token}`);
    expect(listed.status).toBe(200);
    expect(listed.headers["cache-control"]).toContain("no-store");
    expect(listed.body.data.roles).toHaveLength(7);
    expect(JSON.stringify(listed.body)).not.toContain("passwordHash");

    const govList = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${data.gov.token}`);
    expect(govList.status).toBe(200);
    const catalog = await request(app).get("/api/v1/admin/permissions").set("Authorization", `Bearer ${data.gov.token}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.catalog.some((group: { module: string }) => group.module === "role")).toBe(true);

    await Role.updateOne({ key: "CONTRACTOR" }, { $set: { permissions: ["role.read", "role.manage", "permission.read", "permission.manage"] } });
    const forged = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${data.contractor.token}`);
    expect(forged.status).toBe(403);

    const govPatch = await request(app)
      .patch(`/api/v1/admin/roles/${data.officer.role._id.toString()}`)
      .set("Authorization", `Bearer ${data.gov.token}`)
      .send({ name: "Changed", description: "No", revision: 0 });
    expect(govPatch.status).toBe(403);
  });

  it("edits metadata, rejects unsafe grants, and revokes the next request", async () => {
    const data = await world();
    const officerRole = await Role.findOne({ key: "AGENCY_OFFICER" });
    if (!officerRole) throw new Error("officer");
    const renamed = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Field officer", description: officerRole.description, revision: 0, key: "CITIZEN" });
    expect(renamed.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Field officer", description: officerRole.description, revision: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.role.key).toBe("AGENCY_OFFICER");

    const stale = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Again", description: officerRole.description, revision: 0 });
    expect(stale.status).toBe(409);

    const withoutProfile = officerRole.permissions.filter((permission) => permission !== "profile.read");
    const removed = await request(app)
      .put(`/api/v1/admin/roles/${officerRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ permissions: withoutProfile, revision: ok.body.data.role.revision, reason: "Remove profile read" });
    expect(removed.status).toBe(200);
    expect(removed.body.data.role.permissions).not.toContain("profile.read");
    const nextProfile = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${data.officer.token}`);
    expect(nextProfile.status).toBe(403);
    expect((await User.findById(data.officer.user._id))?.credentialEpoch).toBe(2);

    const superRole = await Role.findOne({ key: "SUPER_ADMIN" });
    if (!superRole) throw new Error("super");
    const approve = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: [...superRole.permissions, "project.approve"],
        revision: superRole.__v ?? 0,
        reason: "Try operational approval",
      });
    expect(approve.status).toBe(409);

    const dropClose = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: superRole.permissions.filter((permission) => permission !== "citizen_issue.close"),
        revision: superRole.__v ?? 0,
        reason: "Drop contested issue close",
      });
    expect(dropClose.status).toBe(409);
    expect((await Role.findById(superRole._id))?.permissions).toContain("citizen_issue.close");

    const contractorRole = await Role.findOne({ key: "CONTRACTOR" });
    if (!contractorRole) throw new Error("contractor");
    const elevate = await request(app)
      .put(`/api/v1/admin/roles/${contractorRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: [...contractorRole.permissions, "role.manage"],
        revision: contractorRole.__v ?? 0,
        reason: "Try contractor IAM",
      });
    expect(elevate.status).toBe(409);
    for (const permission of ["finance.payment.approve", "inspection.verify"] as const) {
      const denied = await request(app)
        .put(`/api/v1/admin/roles/${contractorRole._id.toString()}/permissions`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({
          permissions: [...contractorRole.permissions, permission],
          revision: contractorRole.__v ?? 0,
          reason: "Try contractor elevation",
        });
      expect(denied.status).toBe(409);
    }
    for (const permission of ["finance.payment.approve", "inspection.verify", "roadsync.conflict.resolve"] as const) {
      const denied = await request(app)
        .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({
          permissions: [...superRole.permissions, permission],
          revision: superRole.__v ?? 0,
          reason: "Try operational approval",
        });
      expect(denied.status).toBe(409);
    }
    expect((await User.findById(data.officer.user._id))?.roleId.toString()).toBe(officerRole._id.toString());
    expect((await Role.findOne({ key: "PROJECT_MANAGER" }))?.permissions).toEqual(
      expect.arrayContaining(["profile.read"]),
    );

    const govRole = await Role.findOne({ key: "GOV_ADMIN" });
    if (!govRole) throw new Error("gov");
    const dropFrozen = await request(app)
      .put(`/api/v1/admin/roles/${govRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: govRole.permissions.filter((permission) => permission !== "agency.manage"),
        revision: govRole.__v ?? 0,
        reason: "Drop contested agency manage",
      });
    expect(dropFrozen.status).toBe(409);
    expect((await Role.findById(govRole._id))?.permissions).toContain("agency.manage");

    const lockout = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: superRole.permissions.filter((permission) => permission !== "role.manage"),
        revision: superRole.__v ?? 0,
        reason: "Remove last governance",
      });
    expect(lockout.status).toBe(409);
  });

  it("returns one success for a shared revision and rolls back a failed audit", async () => {
    const data = await world();
    const officerRole = await Role.findOne({ key: "AGENCY_OFFICER" });
    if (!officerRole) throw new Error("officer");
    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({ name: "North officer", description: officerRole.description, revision: 0 }),
      request(app)
        .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({ name: "South officer", description: officerRole.description, revision: 0 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    adminRoleHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const current = await Role.findById(officerRole._id);
    const rolled = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Should not stick", description: current?.description, revision: current?.__v ?? 0 });
    expect(rolled.status).toBe(503);
    expect((await Role.findById(officerRole._id))?.name).not.toBe("Should not stick");
    expect(await AuditLog.countDocuments({ resourceId: officerRole._id, action: "identity.role.updated" })).toBe(1);

    const unchanged = await Role.findById(officerRole._id);
    const before = await AuditLog.countDocuments({ resourceId: officerRole._id });
    const noop = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: unchanged?.name, description: unchanged?.description, revision: unchanged?.__v ?? 0 });
    expect(noop.status).toBe(200);
    expect(await AuditLog.countDocuments({ resourceId: officerRole._id })).toBe(before);

    vi.spyOn(mongoose, "startSession").mockRejectedValueOnce(new Error("transactions unavailable"));
    const noTxn = await request(app)
      .patch(`/api/v1/admin/roles/${officerRole._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "No transaction", description: unchanged?.description, revision: unchanged?.__v ?? 0 });
    expect(noTxn.status).toBe(503);
    expect((await Role.findById(officerRole._id))?.name).toBe(unchanged?.name);

    vi.spyOn(Role, "find").mockRejectedValueOnce(new Error("db down"));
    const down = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${data.superUser.token}`);
    expect(down.status).toBe(503);
  });

  it("keeps last governance when assignment races a grant removal", async () => {
    const data = await world();
    const second = await actor("super50b@example.com", "SUPER_ADMIN", data.agency._id);
    const superRole = await Role.findOne({ key: "SUPER_ADMIN" });
    if (!superRole) throw new Error("super");
    await Role.updateOne({ _id: superRole._id }, { $pull: { permissions: "permission.manage" } });
    const missingBoth = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        permissions: superRole.permissions.filter((permission) => permission !== "profile.read"),
        revision: superRole.__v ?? 0,
        reason: "Missing permission manage",
      });
    expect(missingBoth.status).toBe(403);
    await Role.updateOne({ _id: superRole._id }, { $addToSet: { permissions: "permission.manage" } });

    const unknown = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ permissions: ["not.a.permission", "role.*"], revision: 0, reason: "Bad catalog codes" });
    expect(unknown.status).toBe(400);
    const duplicate = await request(app)
      .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ permissions: ["role.read", "role.read"], revision: 0, reason: "Duplicate catalog code" });
    expect(duplicate.status).toBe(400);

    await User.updateOne({ _id: data.superUser.user._id }, { $set: { credentialEpoch: 9 } });
    const staleToken = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${data.superUser.token}`);
    expect(staleToken.status).toBe(401);
    await User.updateOne({ _id: data.superUser.user._id }, { $set: { credentialEpoch: 2 } });

    const [assigned, stripped] = await Promise.all([
      request(app)
        .post(`/api/v1/admin/users/${second.user._id.toString()}/assignment`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({ revision: 0, roleKey: "AGENCY_OFFICER" }),
      request(app)
        .put(`/api/v1/admin/roles/${superRole._id.toString()}/permissions`)
        .set("Authorization", `Bearer ${second.token}`)
        .send({
          permissions: superRole.permissions.filter((permission) => permission !== "role.manage"),
          revision: superRole.__v ?? 0,
          reason: "Remove last governance access",
        }),
    ]);
    expect([401, 409]).toContain(stripped.status);
    expect([200, 409]).toContain(assigned.status);
    const still = await Role.findById(superRole._id);
    expect(still?.permissions).toContain("role.manage");
    expect(still?.permissions).toContain("permission.manage");
    const remaining = await User.countDocuments({
      roleId: superRole._id,
      status: "ACTIVE",
      emailVerified: true,
      agencyId: data.agency._id,
    });
    expect(remaining).toBeGreaterThanOrEqual(1);
    expect((await User.findById(data.superUser.user._id))?.credentialEpoch).toBe(2);
  });
});
