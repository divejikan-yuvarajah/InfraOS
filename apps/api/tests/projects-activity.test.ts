import { hash } from "bcryptjs";
import mongoose from "mongoose";
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
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { ProgressReport } from "../src/modules/projects/models/progress-report.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { activityHooks } from "../src/modules/projects/activity.service.js";
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
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token, role: roleDoc };
}

async function audit(action: string, resourceType: "PROJECT" | "MILESTONE", resourceId: unknown, at: string, userId: unknown, snapshot?: Record<string, unknown>) {
  const [row] = await AuditLog.create([{
    userId,
    action,
    resourceType,
    resourceId,
    newValue: snapshot,
    timestamp: new Date(at),
    requestId: "activity-test",
    agencyId: undefined,
  }]);
  if (!row) throw new Error("audit");
  if (row.timestamp?.toISOString() !== new Date(at).toISOString()) {
    await AuditLog.collection.updateOne({ _id: row._id }, { $set: { timestamp: new Date(at) } });
  }
  return row;
}

describe("step 63 project activity", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step63-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step63-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    activityHooks.beforeRead = async () => {};
    await AuditLog.collection.deleteMany({});
    await ProgressReport.collection.deleteMany({});
    await Milestone.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("returns scoped recorded events, hides private fields, and does not mutate the project", async () => {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm63@example.com", "PROJECT_MANAGER", child._id);
    const foreign = await actor("foreign63@example.com", "AGENCY_OFFICER", other._id);
    const inspector = await actor("inspector63@example.com", "INSPECTOR", child._id);
    const contractor = await actor("contractor63@example.com", "CONTRACTOR", child._id);
    const citizen = await actor("citizen63@example.com", "CITIZEN", child._id);
    const project = await Project.create({
      projectCode: "INF-ACT-6301",
      title: "Secret activity title",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 990000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 100,
      financialProgress: 40,
      createdBy: manager.user._id,
    });
    const sibling = await Project.create({
      projectCode: "INF-ACT-6302",
      title: "Visible prerequisite",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const hidden = await Project.create({
      projectCode: "INF-ACT-6399",
      title: "Hidden foreign target",
      projectType: "ROAD",
      agencyId: other._id,
      managerId: foreign.user._id,
      budget: { amountMinor: 1, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: foreign.user._id,
    });
    const milestone = await Milestone.create({
      projectId: project._id,
      title: "Deck pour",
      status: "DELAYED",
      progress: 0,
      plannedStart: new Date("2026-07-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
    });
    const foreignMilestone = await Milestone.create({
      projectId: hidden._id,
      title: "Foreign pier",
      status: "NOT_STARTED",
      progress: 0,
      plannedStart: new Date("2026-07-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
    });
    const same = "2026-07-02T00:00:00.000Z";
    await audit("project.created", "PROJECT", project._id, "2026-06-01T00:00:00.000Z", manager.user._id, { status: "DRAFT" });
    await audit("project.updated", "PROJECT", project._id, same, manager.user._id, { status: "DRAFT", reason: "private reason", budget: { amountMinor: 990000, currency: "LKR" } });
    await audit("progress.reported", "PROJECT", project._id, "2026-07-03T00:00:00.000Z", manager.user._id, { physicalProgress: 100, financialProgress: 40 });
    await audit("milestone.status_changed", "MILESTONE", milestone._id, "2026-07-04T00:00:00.000Z", manager.user._id, { status: "DELAYED" });
    await audit("milestone.status_changed", "MILESTONE", foreignMilestone._id, "2026-07-04T01:00:00.000Z", manager.user._id, { status: "COMPLETED" });
    await audit("project.dependency_linked", "PROJECT", project._id, "2026-07-05T00:00:00.000Z", manager.user._id, { prerequisiteProjectId: sibling._id });
    await audit("project.dependency_removed", "PROJECT", project._id, "2026-07-06T00:00:00.000Z", manager.user._id, { prerequisiteProjectId: hidden._id });
    await audit("project.unknown_action", "PROJECT", project._id, "2026-07-07T00:00:00.000Z", manager.user._id, { status: "ACTIVE" });
    await audit("project.updated", "PROJECT", project._id, same, manager.user._id, { status: "DRAFT" });
    await ProgressReport.create({
      projectId: project._id,
      sequence: 1,
      reportedPercent: 100,
      previousPercent: 0,
      note: "private inspection note",
      reporterUserId: manager.user._id,
      reportedAt: new Date("2026-07-03T00:00:01.000Z"),
    });
    const before = await AuditLog.countDocuments({});
    const response = await request(app).get(`/api/v1/projects/${project._id.toString()}/activity?limit=20`).set("Authorization", `Bearer ${manager.token}`);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("Secret activity title");
    expect(body).not.toContain("private reason");
    expect(body).not.toContain("private inspection note");
    expect(body).not.toContain("Hidden foreign target");
    expect(body).not.toContain("Foreign pier");
    expect(body).not.toContain("990000");
    expect(body).not.toContain("pm63@example.com");
    expect(body).not.toContain("oldValue");
    expect(body).not.toContain("ipAddress");
    expect(body).not.toContain("userAgent");
    const kinds = response.body.data.activities.map((entry: { kind: string }) => entry.kind);
    expect(kinds).toContain("PROJECT_CREATED");
    expect(kinds).toContain("PROGRESS_REPORTED");
    expect(kinds).toContain("MILESTONE_STATUS_CHANGED");
    expect(kinds).toContain("DEPENDENCY_LINKED");
    expect(kinds).toContain("DEPENDENCY_REMOVED");
    expect(kinds).not.toContain("PROGRESS_RECORDED");
    expect(body).toContain("Visible prerequisite");
    expect(body).toContain("Deck pour");
    expect(body).toContain("reported_not_verified");
    expect(body).not.toContain("project.unknown_action");
    const stored = await Project.findById(project._id);
    expect(stored?.status).toBe("ACTIVE");
    expect(stored?.physicalProgress).toBe(100);
    expect(await AuditLog.countDocuments({})).toBe(before);
    const page = await request(app).get(`/api/v1/projects/${project._id.toString()}/activity?limit=1&category=project`).set("Authorization", `Bearer ${manager.token}`);
    expect(page.status).toBe(200);
    expect(page.body.data.activities).toHaveLength(1);
    expect(page.body.data.hasMore).toBe(true);
    const next = await request(app).get(`/api/v1/projects/${project._id.toString()}/activity?limit=1&category=project&cursor=${page.body.data.nextCursor}`).set("Authorization", `Bearer ${manager.token}`);
    expect(next.status).toBe(200);
    expect(next.body.data.activities[0].id).not.toBe(page.body.data.activities[0].id);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`)).status).toBe(401);
    const hiddenRead = await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${foreign.token}`);
    expect(hiddenRead.status).toBe(404);
    expect(JSON.stringify(hiddenRead.body)).not.toContain("Secret activity title");
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${inspector.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${contractor.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${citizen.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity?$where=1`).set("Authorization", `Bearer ${manager.token}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity?cursor=not-a-cursor`).set("Authorization", `Bearer ${manager.token}`)).status).toBe(400);
    await Role.updateOne({ _id: manager.role._id }, { $pull: { permissions: "project.timeline.read" } });
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${manager.token}`)).status).toBe(403);
    await Role.updateOne({ _id: manager.role._id }, { $addToSet: { permissions: "project.timeline.read" } });
    await User.updateOne({ _id: manager.user._id }, { $inc: { credentialEpoch: 1 } });
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${manager.token}`)).status).toBe(401);
    activityHooks.beforeRead = async () => { throw new Error("down"); };
    const fresh = await actor("pm63b@example.com", "PROJECT_MANAGER", child._id);
    expect((await request(app).get(`/api/v1/projects/${project._id.toString()}/activity`).set("Authorization", `Bearer ${fresh.token}`)).status).toBe(503);
    expect(new mongoose.Types.ObjectId(project._id).toString()).toHaveLength(24);
  });
});
