import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { agencyManagementHooks } from "../src/modules/agencies/management/agency-management.service.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const ACCESS = "access-secret-step49-0123456789abcdef";
const REFRESH = "refresh-secret-step49-0123456789abcdef";
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

async function makeUser(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({
    firstName: "Staff",
    lastName: "User",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
  });
  return { user, token: (await signAccessToken(user._id.toString(), 0)).token };
}

describe("step 49 agency management", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    agencyManagementHooks.beforeAudit = async () => {};
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
    await Project.deleteMany({});
    await WorkRequest.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_WORKS", name: "Works", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({
      code: "RDA_WEST",
      name: "Western Road",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: ministry._id,
    });
    const sibling = await Agency.create({
      code: "RDA_SOUTH",
      name: "Southern Road",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: ministry._id,
    });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const superUser = await makeUser("super49@example.com", "SUPER_ADMIN", ministry._id);
    const gov = await makeUser("gov49@example.com", "GOV_ADMIN", ministry._id);
    const officer = await makeUser("officer49@example.com", "AGENCY_OFFICER", child._id);
    const inspector = await makeUser("inspector49@example.com", "INSPECTOR", child._id);
    return { ministry, child, sibling, other, superUser, gov, officer, inspector };
  }

  it("scopes reads and refuses management from non-platform roles", async () => {
    const data = await world();
    expect((await request(app).get("/api/v1/admin/agencies")).status).toBe(401);
    expect((await request(app).get("/api/v1/admin/agencies").set("Authorization", "Bearer bad")).status).toBe(401);

    const inspector = await request(app)
      .get("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.inspector.token}`);
    expect(inspector.status).toBe(403);
    await Role.updateOne({ key: "INSPECTOR" }, { $set: { permissions: ["agency.read", "agency.manage", "profile.read"] } });
    const injected = await request(app)
      .get("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.inspector.token}`);
    expect(injected.status).toBe(403);

    const officer = await request(app)
      .get("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(officer.status).toBe(200);
    expect(officer.headers["cache-control"]).toContain("no-store");
    expect(officer.body.data.agencies.map((agency: { code: string }) => agency.code)).toEqual(["RDA_WEST"]);
    expect(officer.body.data.total).toBe(1);

    const hidden = await request(app)
      .get(`/api/v1/admin/agencies/${data.other._id.toString()}`)
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(hidden.status).toBe(404);
    const malformed = await request(app)
      .get("/api/v1/admin/agencies/not-an-id")
      .set("Authorization", `Bearer ${data.superUser.token}`);
    expect(malformed.status).toBe(400);

    const gov = await request(app).get("/api/v1/admin/agencies").set("Authorization", `Bearer ${data.gov.token}`);
    const govCodes = gov.body.data.agencies.map((agency: { code: string }) => agency.code).sort();
    expect(govCodes).toEqual(["MIN_WORKS", "RDA_SOUTH", "RDA_WEST"]);
    expect(govCodes).not.toContain("MIN_WATER");

    const govCreate = await request(app)
      .post("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.gov.token}`)
      .send({ code: "NEW_DEPT", name: "New", type: "DEPARTMENT", parentAgencyId: data.ministry._id.toString() });
    expect(govCreate.status).toBe(403);
  });

  it("creates unicode agencies, rejects duplicates and unsafe fields, and updates metadata", async () => {
    const data = await world();
    const created = await request(app)
      .post("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        code: "rda_east",
        name: "නැගෙනහිර පාර",
        type: "DEPARTMENT",
        parentAgencyId: data.ministry._id.toString(),
        description: "draft",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.agency.code).toBe("RDA_EAST");
    expect(created.body.data.agency.name).toBe("නැගෙනහිර පාර");
    expect(created.body.data.agency.status).toBe("ACTIVE");

    const duplicate = await request(app)
      .post("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        code: "RDA_EAST",
        name: "Again",
        type: "DEPARTMENT",
        parentAgencyId: data.ministry._id.toString(),
      });
    expect(duplicate.status).toBe(409);
    expect(await Agency.countDocuments({ code: "RDA_EAST" })).toBe(1);

    const operators = await request(app)
      .patch(`/api/v1/admin/agencies/${created.body.data.agency.id}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Changed", revision: 0, code: "HACK", $set: { status: "INACTIVE" } });
    expect(operators.status).toBe(400);
    expect((await Agency.findById(created.body.data.agency.id))?.code).toBe("RDA_EAST");

    const renamed = await request(app)
      .patch(`/api/v1/admin/agencies/${created.body.data.agency.id}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Eastern Road", revision: 0 });
    expect(renamed.status).toBe(200);
    const stale = await request(app)
      .patch(`/api/v1/admin/agencies/${created.body.data.agency.id}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Stale", revision: 0 });
    expect(stale.status).toBe(409);

    const root = await request(app)
      .post("/api/v1/admin/agencies")
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ code: "MIN_EXTRA", name: "Extra", type: "MINISTRY", parentAgencyId: data.ministry._id.toString() });
    expect(root.status).toBe(400);
  });

  it("rejects cycles, inactive parents, and opposing reparent races", async () => {
    const data = await world();
    const self = await request(app)
      .post(`/api/v1/admin/agencies/${data.child._id.toString()}/reparent`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ parentAgencyId: data.child._id.toString(), revision: 0 });
    expect(self.status).toBe(409);

    const inactive = await Agency.create({ code: "OLD_UNIT", name: "Old", type: "DEPARTMENT", status: "INACTIVE", parentAgencyId: data.ministry._id });
    const ontoInactive = await request(app)
      .post(`/api/v1/admin/agencies/${data.sibling._id.toString()}/reparent`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ parentAgencyId: inactive._id.toString(), revision: 0 });
    expect(ontoInactive.status).toBe(409);

    const grandchild = await request(app)
      .post(`/api/v1/admin/agencies/${data.ministry._id.toString()}/reparent`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ parentAgencyId: data.child._id.toString(), revision: 0 });
    expect(grandchild.status).toBe(409);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/admin/agencies/${data.child._id.toString()}/reparent`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({ parentAgencyId: data.sibling._id.toString(), revision: 0 }),
      request(app)
        .post(`/api/v1/admin/agencies/${data.sibling._id.toString()}/reparent`)
        .set("Authorization", `Bearer ${data.superUser.token}`)
        .send({ parentAgencyId: data.child._id.toString(), revision: 0 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const left = await Agency.findById(data.child._id);
    const right = await Agency.findById(data.sibling._id);
    const seen = new Set<string>();
    let cursor = left?.parentAgencyId?.toString() ?? null;
    while (cursor) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
      cursor = (await Agency.findById(cursor))?.parentAgencyId?.toString() ?? null;
    }
    expect(left?.parentAgencyId?.equals(right?._id ?? data.child._id) && right?.parentAgencyId?.equals(left?._id ?? data.sibling._id)).toBe(false);

    const unit = await Agency.create({
      code: "UNIT_A",
      name: "Unit",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: data.ministry._id,
    });
    const nested = await makeUser("nested49@example.com", "GOV_ADMIN", unit._id);
    await Agency.updateOne({ _id: data.ministry._id }, { $set: { status: "INACTIVE" } });
    const narrowed = await request(app).get("/api/v1/admin/agencies").set("Authorization", `Bearer ${nested.token}`);
    expect(narrowed.status).toBe(200);
    expect(narrowed.body.data.total).toBe(0);
    const missingChild = await request(app)
      .get(`/api/v1/admin/agencies/${unit._id.toString()}`)
      .set("Authorization", `Bearer ${nested.token}`);
    expect(missingChild.status).toBe(404);
  });

  it("blocks deactivation with dependents, rolls back failed audits, and updates staff provisioning scope", async () => {
    const data = await world();
    const blocked = await request(app)
      .post(`/api/v1/admin/agencies/${data.child._id.toString()}/deactivate`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ revision: 0 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.activeUsers).toBeGreaterThan(0);
    expect((await Agency.findById(data.child._id))?.status).toBe("ACTIVE");

    await Project.create({
      projectCode: "INF-TEST-1",
      title: "Span",
      projectType: "ROAD",
      agencyId: data.sibling._id,
      budget: { amountMinor: 100, currency: "LKR" },
      physicalProgress: 0,
      financialProgress: 0,
      status: "ACTIVE",
      createdBy: data.superUser.user._id,
    });
    const projectBlock = await request(app)
      .post(`/api/v1/admin/agencies/${data.sibling._id.toString()}/deactivate`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ revision: 0 });
    expect(projectBlock.status).toBe(409);
    expect(projectBlock.body.error.details.projects).toBe(1);

    const empty = await Agency.create({
      code: "EMPTY_UNIT",
      name: "Empty",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: data.ministry._id,
    });
    const work = await Project.create({
      projectCode: "INF-TEST-2",
      title: "Closed",
      projectType: "ROAD",
      agencyId: empty._id,
      budget: { amountMinor: 100, currency: "LKR" },
      physicalProgress: 0,
      financialProgress: 0,
      status: "CANCELLED",
      createdBy: data.superUser.user._id,
    });
    await WorkRequest.create({
      projectId: work._id,
      agencyId: empty._id,
      geometry: { type: "Point", coordinates: [80.1, 7.2] },
      workType: "ROAD_RESURFACING",
      plannedStart: new Date("2026-01-01"),
      plannedEnd: new Date("2026-02-01"),
      status: "CANCELLED",
      priority: "NORMAL",
    });
    const deactivated = await request(app)
      .post(`/api/v1/admin/agencies/${empty._id.toString()}/deactivate`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ revision: 0 });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.agency.status).toBe("INACTIVE");

    const provision = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({
        firstName: "New",
        lastName: "Staff",
        email: "empty-staff@example.com",
        password: "correct-horse-battery",
        roleKey: "AGENCY_OFFICER",
        agencyCode: "EMPTY_UNIT",
      });
    expect(provision.status).toBe(400);
    expect(await User.countDocuments({ email: "empty-staff@example.com" })).toBe(0);

    const moved = await request(app)
      .post(`/api/v1/admin/agencies/${data.child._id.toString()}/reparent`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ parentAgencyId: data.other._id.toString(), revision: 0 });
    expect(moved.status).toBe(200);
    const govAfter = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${data.gov.token}`);
    const emails = govAfter.body.data.users.map((user: { email: string }) => user.email);
    expect(emails).not.toContain("officer49@example.com");

    agencyManagementHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const before = await Agency.findById(data.sibling._id);
    const rolled = await request(app)
      .patch(`/api/v1/admin/agencies/${data.sibling._id.toString()}`)
      .set("Authorization", `Bearer ${data.superUser.token}`)
      .send({ name: "Should not stick", revision: before?.__v ?? 0 });
    expect(rolled.status).toBe(503);
    expect((await Agency.findById(data.sibling._id))?.name).toBe("Southern Road");
    expect(await AuditLog.countDocuments({ resourceId: data.sibling._id, action: "identity.agency.updated" })).toBe(0);
  });
});
