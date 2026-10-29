import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { dependencyHooks } from "../src/modules/projects/dependency.service.js";
import { ProjectDependency } from "../src/modules/projects/models/project-dependency.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const app = createApp();

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

async function actor(email: string, role: SystemRoleKey, agencyId: unknown, epoch = 1) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({
    firstName: "Nimal",
    lastName: "Perera",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: epoch,
  });
  return { user, token: (await signAccessToken(user._id.toString(), epoch)).token };
}

function project(code: string, agencyId: unknown, managerId: unknown, status = "ACTIVE") {
  return Project.create({
    projectCode: code,
    title: code,
    projectType: "ROAD",
    agencyId,
    managerId,
    budget: { amountMinor: 1000, currency: "LKR" },
    status,
    physicalProgress: 10,
    financialProgress: 0,
    createdBy: managerId,
  });
}

describe("step 62 project dependencies", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step62-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step62-0123456789abcdef";
    await startIsolatedMongo();
    await ProjectDependency.syncIndexes();
  }, 300_000);

  afterEach(async () => {
    dependencyHooks.beforeAudit = async () => {};
    await ProjectDependency.deleteMany({});
    await AuditLog.collection.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE" });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm62@example.com", "PROJECT_MANAGER", child._id);
    const a = await project("INF-DEP-6201", child._id, manager.user._id);
    const b = await project("INF-DEP-6202", child._id, manager.user._id);
    const c = await project("INF-DEP-6203", child._id, manager.user._id);
    const done = await project("INF-DEP-6204", child._id, manager.user._id, "COMPLETED");
    const foreignProject = await project("INF-DEP-6299", other._id, manager.user._id);
    return {
      a, b, c, done, foreignProject, manager,
      foreign: await actor("foreign62@example.com", "AGENCY_OFFICER", other._id),
      contractor: await actor("contractor62@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector62@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen62@example.com", "CITIZEN", child._id),
      admin: await actor("admin62@example.com", "SUPER_ADMIN", child._id),
    };
  }

  async function revision(token: string, id: string) {
    const read = await request(app).get(`/api/v1/projects/${id}/dependencies`).set("Authorization", `Bearer ${token}`);
    expect(read.status).toBe(200);
    return read.body.data.graphRevision as number;
  }

  it("links a visible prerequisite, rejects self, duplicate, and cycles, and does not change status", async () => {
    const data = await world();
    const before = await Project.findById(data.a.id);
    const graphRevision = await revision(data.manager.token, data.a.id);
    const linked = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision });
    expect(linked.status).toBe(201);
    expect(linked.body.data.link.prerequisite.title).toBe("INF-DEP-6202");
    expect(linked.body.data.link.scheduling).toBe("informational");
    const again = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision: linked.body.data.graphRevision });
    expect(again.status).toBe(409);
    const self = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.a.id, graphRevision: linked.body.data.graphRevision });
    expect(self.status).toBe(409);
    const back = await request(app)
      .post(`/api/v1/projects/${data.b.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.a.id, graphRevision: linked.body.data.graphRevision });
    expect(back.status).toBe(409);
    const mid = await request(app)
      .post(`/api/v1/projects/${data.b.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.c.id, graphRevision: linked.body.data.graphRevision });
    expect(mid.status).toBe(201);
    const triangle = await request(app)
      .post(`/api/v1/projects/${data.c.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.a.id, graphRevision: mid.body.data.graphRevision });
    expect(triangle.status).toBe(409);
    const after = await Project.findById(data.a.id);
    expect(after?.status).toBe("ACTIVE");
    expect(after?.physicalProgress).toBe(10);
    expect(after?.__v).toBe(before?.__v);
    const timeline = await request(app).get(`/api/v1/projects/${data.a.id}/timeline`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(timeline.body.data.timeline.dependencies.links[0].prerequisite.projectCode).toBe("INF-DEP-6202");
    expect(JSON.stringify(timeline.body)).not.toContain("financialProgress");
  });

  it("soft-removes, keeps audit, and allows the same pair to be added again", async () => {
    const data = await world();
    const graphRevision = await revision(data.manager.token, data.a.id);
    const linked = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision });
    const removed = await request(app)
      .delete(`/api/v1/projects/${data.a.id}/dependencies/${linked.body.data.link.id}`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ graphRevision: linked.body.data.graphRevision });
    expect(removed.status).toBe(200);
    expect(await ProjectDependency.countDocuments({ removedAt: null })).toBe(0);
    expect(await ProjectDependency.countDocuments({ removedAt: { $ne: null } })).toBe(1);
    expect(await Project.findById(data.b.id)).toBeTruthy();
    const relinked = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision: removed.body.data.graphRevision });
    expect(relinked.status).toBe(201);
    expect(await AuditLog.countDocuments({ action: "project.dependency_linked" })).toBe(2);
    const stale = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.c.id, graphRevision });
    expect(stale.status).toBe(409);
  });

  it("denies hidden targets and roles that must not write", async () => {
    const data = await world();
    const graphRevision = await revision(data.manager.token, data.a.id);
    expect((await request(app).get(`/api/v1/projects/${data.a.id}/dependencies`)).status).toBe(401);
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.contractor.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision })).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.inspector.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision })).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.citizen.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision })).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.admin.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision })).status).toBe(403);
    const hidden = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.foreignProject.id, graphRevision });
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("INF-DEP-6299");
    const closed = await request(app)
      .post(`/api/v1/projects/${data.done.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision });
    expect(closed.status).toBe(409);
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.manager.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision, agencyId: data.a.id })).status).toBe(400);
    await User.updateOne({ _id: data.manager.user._id }, { $inc: { credentialEpoch: 1 } });
    expect((await request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.manager.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision })).status).toBe(401);
  });

  it("rolls back the link when the audit write fails", async () => {
    const data = await world();
    dependencyHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const graphRevision = await revision(data.manager.token, data.a.id);
    const failed = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision });
    expect(failed.status).toBe(503);
    expect(await ProjectDependency.countDocuments({})).toBe(0);
    expect((await Project.findById(data.a.id))?.status).toBe("ACTIVE");
  });

  it("rejects a project manager after project.update is removed", async () => {
    const data = await world();
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "project.update" } });
    const graphRevision = await revision(data.manager.token, data.a.id);
    const denied = await request(app)
      .post(`/api/v1/projects/${data.a.id}/dependencies`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ prerequisiteProjectId: data.b.id, graphRevision });
    expect(denied.status).toBe(403);
  });

  it("lets only one of two opposite edges commit", async () => {
    const data = await world();
    const graphRevision = await revision(data.manager.token, data.a.id);
    const [left, right] = await Promise.all([
      request(app).post(`/api/v1/projects/${data.a.id}/dependencies`).set("Authorization", `Bearer ${data.manager.token}`).send({ prerequisiteProjectId: data.b.id, graphRevision }),
      request(app).post(`/api/v1/projects/${data.b.id}/dependencies`).set("Authorization", `Bearer ${data.manager.token}`).send({ prerequisiteProjectId: data.a.id, graphRevision }),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([201, 409]);
    const active = await ProjectDependency.find({ removedAt: null });
    expect(active).toHaveLength(1);
    const audits = await AuditLog.find({ action: "project.dependency_linked" });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.resourceId.toString()).toBe(active[0]?.projectId.toString());
  });
});
