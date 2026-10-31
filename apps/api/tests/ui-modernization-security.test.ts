import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

/**
 * Server-side proof for the Mission Control UI work: the frontend hides or shows controls,
 * but only the API decides. These cases mirror what the redesigned pages can attempt.
 */
const app = createApp();
const SECRET = "Distinct-Test-Secret-48";

async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) {
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
    firstName: "Test",
    lastName: "User",
    email,
    passwordHash: await hash(SECRET, 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}

const draftBody = {
  projectCode: "INF-UIS-57",
  title: "UI security road",
  description: "Synthetic proposal",
  projectType: "ROAD",
  budget: { amountMinor: 2500000000, currency: "LKR" },
};

describe("ui modernization server-side security", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-ui-security-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-ui-security-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    await Project.deleteMany({});
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    return {
      gov: await actor("gov-ui@example.com", "GOV_ADMIN", ministry._id),
      officer: await actor("officer-ui@example.com", "AGENCY_OFFICER", child._id),
      manager: await actor("pm-ui@example.com", "PROJECT_MANAGER", child._id),
      contractor: await actor("contractor-ui@example.com", "CONTRACTOR", child._id),
      foreignOfficer: await actor("foreign-officer-ui@example.com", "AGENCY_OFFICER", other._id),
      foreignGov: await actor("foreign-gov-ui@example.com", "GOV_ADMIN", other._id),
    };
  }

  async function submittedProject(token: string) {
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${token}`).send(draftBody);
    expect(created.status).toBe(201);
    const id = created.body.data.project.id as string;
    const filled = await request(app).patch(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${token}`).send({
      startDate: "2027-01-01T00:00:00.000Z",
      plannedEndDate: "2027-06-01T00:00:00.000Z",
      location: { district: "Colombo", province: "Western" },
      geometry: { type: "Point", coordinates: [79.86, 6.93] },
      revision: created.body.data.project.revision,
    });
    expect(filled.status).toBe(200);
    const submitted = await request(app).post(`/api/v1/projects/${id}/transition`).set("Authorization", `Bearer ${token}`).send({
      action: "SUBMIT",
      revision: filled.body.data.project.revision,
    });
    expect(submitted.status).toBe(200);
    return submitted.body.data.project as { id: string; revision: number };
  }

  const newStaff = {
    firstName: "Sneaky",
    lastName: "Account",
    email: "sneaky.staff@example.com",
    password: SECRET,
    roleKey: "AGENCY_OFFICER",
    agencyCode: "DEPT_WEST",
  };

  it("rejects staff creation from an agency officer, a project manager, a contractor and an anonymous caller", async () => {
    const data = await world();
    expect((await request(app).post("/api/v1/admin/users").send(newStaff)).status).toBe(401);
    for (const who of [data.officer, data.manager, data.contractor, data.foreignOfficer]) {
      const response = await request(app).post("/api/v1/admin/users").set("Authorization", `Bearer ${who.token}`).send(newStaff);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(SECRET);
    }
    expect(await User.countDocuments({ email: newStaff.email })).toBe(0);
  });

  it("refuses an officer or manager trying to escalate an existing account through the admin API", async () => {
    const data = await world();
    const target = data.manager.user._id.toString();
    const response = await request(app)
      .patch(`/api/v1/admin/users/${target}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ firstName: "Changed" });
    expect([403, 404]).toContain(response.status);
    expect((await User.findById(target))?.firstName).toBe("Test");
  });

  it("rejects review decisions from every role without the approval grant and leaves the status untouched", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token);
    for (const who of [data.officer, data.manager, data.contractor]) {
      const response = await request(app)
        .post(`/api/v1/projects/${project.id}/review`)
        .set("Authorization", `Bearer ${who.token}`)
        .send({ action: "BEGIN_REVIEW", revision: project.revision });
      expect(response.status).toBe(403);
    }
    expect((await request(app).post(`/api/v1/projects/${project.id}/review`).send({ action: "BEGIN_REVIEW", revision: project.revision })).status).toBe(401);
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");
    expect(await AuditLog.countDocuments({ action: /review/ })).toBe(0);
  });

  it("rejects a review decision from an approver in another agency without revealing the project", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token);
    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/review`)
      .set("Authorization", `Bearer ${data.foreignGov.token}`)
      .send({ action: "BEGIN_REVIEW", revision: project.revision });
    expect([403, 404]).toContain(response.status);
    expect(JSON.stringify(response.body)).not.toContain("INF-UIS-57");
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");
  });

  it("blocks the submitter from approving their own submission even when they hold the approval grant", async () => {
    const data = await world();
    // Give the submitting role the approval grant so only segregation of duties can stop the decision.
    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $addToSet: { permissions: "project.approve" } });
    const project = await submittedProject(data.officer.token);
    const begun = await request(app)
      .post(`/api/v1/projects/${project.id}/review`)
      .set("Authorization", `Bearer ${data.gov.token}`)
      .send({ action: "BEGIN_REVIEW", revision: project.revision });
    expect(begun.status).toBe(200);
    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/review`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ action: "APPROVE", revision: begun.body.data.project.revision });
    expect([403, 409]).toContain(response.status);
    expect((await Project.findById(project.id))?.status).toBe("UNDER_REVIEW");
  });

  it("hides another agency's project from reads, lists and the dashboard", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token);

    const direct = await request(app).get(`/api/v1/projects/${project.id}`).set("Authorization", `Bearer ${data.foreignOfficer.token}`);
    expect(direct.status).toBe(404);
    expect(JSON.stringify(direct.body)).not.toContain("INF-UIS-57");

    const list = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.foreignOfficer.token}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain("INF-UIS-57");

    for (const sub of ["milestones", "progress", "progress/history"]) {
      const response = await request(app).get(`/api/v1/projects/${project.id}/${sub}`).set("Authorization", `Bearer ${data.foreignOfficer.token}`);
      expect([403, 404]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toContain("INF-UIS-57");
    }

    const dashboard = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${data.foreignOfficer.token}`);
    expect(dashboard.status).toBe(200);
    expect(JSON.stringify(dashboard.body)).not.toContain("INF-UIS-57");

    const own = await request(app).get(`/api/v1/projects/${project.id}`).set("Authorization", `Bearer ${data.officer.token}`);
    expect(own.status).toBe(200);
  });
});
