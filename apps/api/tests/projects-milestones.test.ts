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
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { milestoneTarget } from "../src/modules/projects/milestone.policy.js";
import { milestoneHooks } from "../src/modules/projects/milestones.service.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const app = createApp();

describe("milestone policy", () => {
  it("allows only the documented edges and keeps PLANNED out of storage", () => {
    expect(milestoneTarget("NOT_STARTED", "START")).toBe("IN_PROGRESS");
    expect(milestoneTarget("NOT_STARTED", "DELAY")).toBe("DELAYED");
    expect(milestoneTarget("NOT_STARTED", "BLOCK")).toBe("BLOCKED");
    expect(milestoneTarget("NOT_STARTED", "COMPLETE")).toBeNull();
    expect(milestoneTarget("IN_PROGRESS", "COMPLETE")).toBe("COMPLETED");
    expect(milestoneTarget("IN_PROGRESS", "CANCEL")).toBe("CANCELLED");
    expect(milestoneTarget("DELAYED", "RESUME")).toBe("IN_PROGRESS");
    expect(milestoneTarget("BLOCKED", "CANCEL")).toBe("CANCELLED");
    expect(milestoneTarget("COMPLETED", "START")).toBeNull();
    expect(milestoneTarget("CANCELLED", "RESUME")).toBeNull();
    expect(milestoneTarget("IN_PROGRESS", "START")).toBeNull();
    expect(milestoneTarget("PLANNED", "START")).toBeNull();
  });
});

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
    firstName: "Nimal",
    lastName: "Perera",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}

describe("step 58 milestones", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step58-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step58-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    milestoneHooks.beforeAudit = async () => {};
    await Milestone.deleteMany({});
    await Inspection.deleteMany({});
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
    const child = await Agency.create({
      code: "DEPT_WEST",
      name: "Western",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: ministry._id,
    });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm58@example.com", "PROJECT_MANAGER", child._id);
    const otherManager = await actor("pm58b@example.com", "PROJECT_MANAGER", child._id);
    const approved = await Project.create({
      projectCode: "INF-MS-58",
      title: "Milestone Road",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "APPROVED",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const draft = await Project.create({
      projectCode: "INF-MS-2",
      title: "Draft Road",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "DRAFT",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    return {
      approved,
      draft,
      manager,
      otherManager,
      gov: await actor("gov58@example.com", "GOV_ADMIN", ministry._id),
      foreign: await actor("foreign58@example.com", "GOV_ADMIN", other._id),
      officer: await actor("officer58@example.com", "AGENCY_OFFICER", child._id),
      superUser: await actor("super58@example.com", "SUPER_ADMIN", ministry._id),
      contractor: await actor("contractor58@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector58@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen58@example.com", "CITIZEN", child._id),
    };
  }

  const body = { title: "Deck pour", description: "Synthetic span", plannedStart: "2026-11-01", plannedEnd: "2026-12-15" };

  it("creates, lists, edits, and completes a milestone without completing the project", async () => {
    const data = await world();
    const created = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send(body);
    expect(created.status).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(created.body.data.milestone.status).toBe("NOT_STARTED");
    expect(created.body.data.milestone.progress).toBe(0);
    expect(created.body.data.milestone).not.toHaveProperty("__v");
    expect(created.body.data.milestone).not.toHaveProperty("weight");
    const id = created.body.data.milestone.id as string;
    const listed = await request(app)
      .get(`/api/v1/projects/${data.approved.id}/milestones`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.counts.notStarted).toBe(1);
    expect(listed.body.data.milestones[0].title).toBe("Deck pour");
    const detail = await request(app)
      .get(`/api/v1/projects/${data.approved.id}/milestones/${id}`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(detail.status).toBe(200);
    const patched = await request(app)
      .patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ revision: 0, title: "Deck pour revised" });
    expect(patched.status).toBe(200);
    expect(patched.body.data.milestone.revision).toBe(1);
    const started = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones/${id}/transition`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ action: "START", revision: 1 });
    expect(started.status).toBe(200);
    expect(started.body.data.milestone.status).toBe("IN_PROGRESS");
    const completed = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones/${id}/transition`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ action: "COMPLETE", revision: started.body.data.milestone.revision });
    expect(completed.status).toBe(200);
    expect(completed.body.data.milestone.status).toBe("COMPLETED");
    expect(completed.body.data.milestone.progress).toBe(100);
    const parent = await Project.findById(data.approved.id);
    expect(parent?.status).toBe("APPROVED");
    expect(parent?.physicalProgress).toBe(0);
    expect(parent?.financialProgress).toBe(0);
    const audit = await AuditLog.findOne({ resourceType: "MILESTONE", action: "milestone.status_changed" }).select("+newValue");
    expect(audit?.newValue?.status).toBe("COMPLETED");
    expect(audit?.newValue).not.toHaveProperty("title");
  });

  it("rejects illegal jumps, unknown fields, bad dates, stale revisions, and a missing parent", async () => {
    const data = await world();
    const created = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send(body);
    const id = created.body.data.milestone.id as string;
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones/${id}/transition`).set("Authorization", `Bearer ${data.manager.token}`).send({ action: "COMPLETE", revision: 0 })).status).toBe(409);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, status: "PLANNED" })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, weight: 2 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, plannedEnd: "2026-02-31" })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, plannedEnd: "2026-10-01" })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`).send({ revision: 0, progress: 101 })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`).send({ revision: 0, title: "x".repeat(201) })).status).toBe(400);
    const stale = await request(app)
      .patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ revision: 9, title: "Late" });
    expect(stale.status).toBe(409);
    const other = await Project.create({
      projectCode: "INF-MS-3",
      title: "Other",
      projectType: "ROAD",
      agencyId: data.approved.agencyId,
      managerId: data.manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "APPROVED",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: data.manager.user._id,
    });
    expect((await request(app).get(`/api/v1/projects/${other.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/projects/${data.draft.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send(body)).status).toBe(409);
    expect((await request(app).delete(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(404);
  });

  it("scopes reads and writes and rolls back when the audit write fails", async () => {
    const data = await world();
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.citizen.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.foreign.token}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.otherManager.token}`).send(body)).status).toBe(404);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.superUser.token}`).send(body)).status).toBe(403);
    const readable = await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.superUser.token}`);
    expect(readable.status).toBe(200);
    await Inspection.create({ projectId: data.approved._id, inspectorId: data.inspector.user._id, inspectionDate: new Date("2026-11-02T00:00:00.000Z") });
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(200);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.inspector.token}`).send(body)).status).toBe(403);
    const officer = await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.officer.token}`).send({ ...body, title: "Officer milestone" });
    expect(officer.status).toBe(201);
    milestoneHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const rolled = await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, title: "Should roll back" });
    expect(rolled.status).toBe(503);
    expect(await Milestone.countDocuments({ title: "Should roll back" })).toBe(0);
    milestoneHooks.beforeAudit = async () => {};
    const first = await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.gov.token}`).send({ ...body, title: "Ministry milestone" });
    expect(first.status).toBe(201);
    const id = first.body.data.milestone.id as string;
    const [left, right] = await Promise.all([
      request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.gov.token}`).send({ revision: 0, title: "Left" }),
      request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.gov.token}`).send({ revision: 0, title: "Right" }),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);
    expect(await AuditLog.countDocuments({ resourceId: id, action: "milestone.updated" })).toBe(1);
  });

  it("rejects unsafe payloads, a revoked grant, a stale epoch, and a terminal parent", async () => {
    const data = await world();
    const created = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send(body);
    const id = created.body.data.milestone.id as string;
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).set("Content-Type", "text/plain").send("nope")).status).toBe(415);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, title: { $gt: "" }, agencyId: data.approved.agencyId })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`).send({ revision: 0, progress: -1 })).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones/not-an-id`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", "Bearer not-a-token")).status).toBe(401);
    await User.updateOne({ _id: data.manager.user._id }, { $set: { credentialEpoch: 2 } });
    expect((await request(app).get(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(401);
    await User.updateOne({ _id: data.manager.user._id }, { $set: { credentialEpoch: 1 } });
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "milestone.create" } });
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, title: "After revoke" })).status).toBe(403);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $addToSet: { permissions: "milestone.create" } });
    const started = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones/${id}/transition`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ action: "START", revision: 0 });
    const completed = await request(app)
      .post(`/api/v1/projects/${data.approved.id}/milestones/${id}/transition`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ action: "COMPLETE", revision: started.body.data.milestone.revision });
    expect(completed.status).toBe(200);
    expect((await request(app).patch(`/api/v1/projects/${data.approved.id}/milestones/${id}`).set("Authorization", `Bearer ${data.manager.token}`).send({ revision: completed.body.data.milestone.revision, title: "Too late" })).status).toBe(409);
    await Project.updateOne({ _id: data.approved._id }, { $set: { status: "CANCELLED" } });
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/milestones`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...body, title: "After cancel" })).status).toBe(409);
    const audit = await AuditLog.findOne({ resourceType: "MILESTONE", action: "milestone.created" }).select("+newValue");
    expect(audit?.userId?.toString()).toBe(data.manager.user._id.toString());
    expect(audit?.requestId).toBeTruthy();
    expect(audit?.newValue?.status).toBe("NOT_STARTED");
  });
});
