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
import { progressHooks } from "../src/modules/projects/progress.service.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { ProgressReport } from "../src/modules/projects/models/progress-report.model.js";
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

describe("step 59 physical progress", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step59-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step59-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    progressHooks.beforeAudit = async () => {};
    await ProgressReport.collection.deleteMany({});
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
    const manager = await actor("pm59@example.com", "PROJECT_MANAGER", child._id);
    const otherManager = await actor("pm59b@example.com", "PROJECT_MANAGER", child._id);
    const active = await Project.create({
      projectCode: "INF-PROG-59",
      title: "Active progress road",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 0,
      financialProgress: 4,
      createdBy: manager.user._id,
    });
    const approved = await Project.create({
      projectCode: "INF-PROG-5902",
      title: "Approved only",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "APPROVED",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const milestone = await Milestone.create({
      projectId: active._id,
      title: "Deck",
      plannedStart: new Date("2026-11-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-12-01T00:00:00.000Z"),
      progress: 0,
      status: "NOT_STARTED",
    });
    return {
      active,
      approved,
      milestone,
      manager,
      otherManager,
      gov: await actor("gov59@example.com", "GOV_ADMIN", ministry._id),
      foreign: await actor("foreign59@example.com", "GOV_ADMIN", other._id),
      officer: await actor("officer59@example.com", "AGENCY_OFFICER", child._id),
      superUser: await actor("super59@example.com", "SUPER_ADMIN", ministry._id),
      contractor: await actor("contractor59@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector59@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen59@example.com", "CITIZEN", child._id),
    };
  }

  const report = { percentage: 20, note: "Deck steel placed", revision: 0 };

  it("records history, keeps the project active at 100, and leaves milestones alone", async () => {
    const data = await world();
    const created = await request(app)
      .post(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send(report);
    expect(created.status).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(created.body.data.physicalProgress).toBe(20);
    expect(created.body.data.status).toBe("ACTIVE");
    expect(created.body.data.report.previousPercent).toBe(0);
    expect(created.body.data.report).not.toHaveProperty("reporterUserId");
    const current = await request(app)
      .get(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(current.status).toBe(200);
    expect(current.body.data.progress.physicalProgress).toBe(20);
    expect(current.body.data.progress.latest.note).toBe("Deck steel placed");
    const again = await request(app)
      .post(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ percentage: 65, note: "Abutment complete", revision: created.body.data.revision });
    expect(again.status).toBe(201);
    const full = await request(app)
      .post(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ percentage: 100, note: "Reported complete, not officially closed", revision: again.body.data.revision });
    expect(full.status).toBe(201);
    const parent = await Project.findById(data.active.id);
    expect(parent?.status).toBe("ACTIVE");
    expect(parent?.physicalProgress).toBe(100);
    expect(parent?.financialProgress).toBe(4);
    const milestone = await Milestone.findById(data.milestone.id);
    expect(milestone?.status).toBe("NOT_STARTED");
    expect(milestone?.progress).toBe(0);
    const history = await request(app)
      .get(`/api/v1/projects/${data.active.id}/progress/history`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(history.status).toBe(200);
    expect(history.body.data.total).toBe(3);
    expect(history.body.data.reports[0].reportedPercent).toBe(100);
    expect(history.body.data.reports[2].reportedPercent).toBe(20);
    const lowered = await request(app)
      .post(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ percentage: 80, note: "short", revision: full.body.data.revision });
    expect(lowered.status).toBe(400);
    const corrected = await request(app)
      .post(`/api/v1/projects/${data.active.id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ percentage: 80, note: "Corrected after a recount", revision: full.body.data.revision });
    expect(corrected.status).toBe(201);
    expect(corrected.body.data.report.previousPercent).toBe(100);
    const audit = await AuditLog.findOne({ resourceType: "PROJECT", action: "progress.reported", resourceId: data.active._id }).select("+newValue +oldValue").sort({ timestamp: -1 });
    expect(audit?.newValue?.physicalProgress).toBe(80);
    expect(audit?.newValue).not.toHaveProperty("note");
    expect(audit?.userId?.toString()).toBe(data.manager.user._id.toString());
  });

  it("denies unmapped contractors and out-of-scope callers, and rejects ineligible states", async () => {
    const data = await world();
    const id = data.active.id;
    expect((await request(app).get(`/api/v1/projects/${id}/progress`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.contractor.token}`).send(report)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.citizen.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.superUser.token}`).send(report)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.superUser.token}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.officer.token}`).send(report)).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.gov.token}`).send(report)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.gov.token}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.foreign.token}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.otherManager.token}`)).status).toBe(200);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.otherManager.token}`).send(report)).status).toBe(404);
    await Inspection.create({ projectId: data.active._id, inspectorId: data.inspector.user._id, inspectionDate: new Date("2026-11-02T00:00:00.000Z") });
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(200);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.inspector.token}`).send(report)).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${data.approved.id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send(report)).status).toBe(409);
    for (const status of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "CANCELLED", "COMPLETED", "ON_HOLD", "DELAYED"] as const) {
      await Project.updateOne({ _id: data.active._id }, { $set: { status } });
      expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send(report)).status).toBe(409);
    }
  });

  it("rejects unsafe input, stale revisions, revoked grants, and rolls back a failed audit", async () => {
    const data = await world();
    const id = data.active.id;
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).set("Content-Type", "text/plain").send("nope")).status).toBe(415);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...report, percentage: { $gt: 0 }, agencyId: "x" })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...report, percentage: -1 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...report, percentage: 101 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...report, note: "bad $ note" })).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ ...report, userId: data.manager.user.id })).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/not-an-id/progress`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", "Bearer not-a-token")).status).toBe(401);
    const first = await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send(report);
    expect(first.status).toBe(201);
    const duplicate = await request(app)
      .post(`/api/v1/projects/${id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ ...report, revision: first.body.data.revision });
    expect(duplicate.status).toBe(409);
    const [left, right] = await Promise.all([
      request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ percentage: 30, note: "Left crew", revision: first.body.data.revision }),
      request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ percentage: 40, note: "Right crew", revision: first.body.data.revision }),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
    expect(await ProgressReport.countDocuments({ projectId: data.active._id })).toBe(2);
    expect(await AuditLog.countDocuments({ resourceId: data.active._id, action: "progress.reported" })).toBe(2);
    await User.updateOne({ _id: data.manager.user._id }, { $set: { credentialEpoch: 2 } });
    expect((await request(app).get(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(401);
    await User.updateOne({ _id: data.manager.user._id }, { $set: { credentialEpoch: 1 } });
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "progress.submit" } });
    const parent = await Project.findById(data.active.id);
    expect((await request(app).post(`/api/v1/projects/${id}/progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ percentage: 50, note: "After revoke", revision: parent?.__v })).status).toBe(403);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $addToSet: { permissions: "progress.submit" } });
    progressHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const before = await Project.findById(data.active.id);
    const rolled = await request(app)
      .post(`/api/v1/projects/${id}/progress`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ percentage: 55, note: "Should roll back", revision: before?.__v });
    expect(rolled.status).toBe(503);
    const after = await Project.findById(data.active.id);
    expect(after?.physicalProgress).toBe(before?.physicalProgress);
    expect(after?.status).toBe("ACTIVE");
    expect(await ProgressReport.countDocuments({ note: "Should roll back" })).toBe(0);
  });
});
