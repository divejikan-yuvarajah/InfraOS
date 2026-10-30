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
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { noticeHooks, notifyCommittedAudit } from "../src/modules/notifications/notice.service.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { projectHooks } from "../src/modules/projects/projects.service.js";
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

describe("step 65 project notifications", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step65-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step65-0123456789abcdef";
    await startIsolatedMongo();
    await Notification.syncIndexes();
  }, 300_000);

  afterEach(async () => {
    projectHooks.beforeAudit = async () => {};
    noticeHooks.beforeRead = async () => {};
    await Notification.deleteMany({});
    await Project.deleteMany({});
    await AuditLog.collection.deleteMany({});
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("notifies the in-scope reviewer and assigned manager from committed events only", async () => {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm65@example.com", "PROJECT_MANAGER", child._id);
    const reviewer = await actor("review65@example.com", "GOV_ADMIN", ministry._id);
    const foreign = await actor("foreign65@example.com", "GOV_ADMIN", other._id);
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${manager.token}`).send({
      projectCode: "INF-NOTE-6501",
      title: "Secret review road",
      description: "Synthetic",
      projectType: "ROAD",
      budget: { amountMinor: 1000, currency: "LKR" },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.project.id as string;
    const filled = await request(app).patch(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${manager.token}`).send({
      startDate: "2027-01-01T00:00:00.000Z",
      plannedEndDate: "2027-06-01T00:00:00.000Z",
      location: { district: "Colombo", province: "Western" },
      geometry: { type: "Point", coordinates: [79.86, 6.93] },
      revision: created.body.data.project.revision,
    });
    expect(filled.status).toBe(200);
    const before = await AuditLog.countDocuments({});
    const submitted = await request(app).post(`/api/v1/projects/${id}/transition`).set("Authorization", `Bearer ${manager.token}`).send({
      action: "SUBMIT",
      revision: filled.body.data.project.revision,
    });
    expect(submitted.status).toBe(200);
    expect(await AuditLog.countDocuments({})).toBe(before + 1);
    const reviewerFeed = await request(app).get("/api/v1/notifications?state=unread").set("Authorization", `Bearer ${reviewer.token}`);
    expect(reviewerFeed.status).toBe(200);
    expect(reviewerFeed.headers["cache-control"]).toBe("no-store");
    expect(reviewerFeed.body.data.unreadCount).toBe(1);
    expect(reviewerFeed.body.data.notices[0].titleKey).toBe("project.submitted");
    expect(reviewerFeed.body.data.notices[0].project.projectCode).toBe("INF-NOTE-6501");
    expect(JSON.stringify(reviewerFeed.body)).not.toContain("oldValue");
    expect(JSON.stringify(reviewerFeed.body)).not.toContain("eventKey");
    expect(JSON.stringify(reviewerFeed.body)).not.toContain("sourceAuditId");
    const managerFeed = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${manager.token}`);
    expect(managerFeed.body.data.notices).toEqual([]);
    const foreignFeed = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${foreign.token}`);
    expect(foreignFeed.body.data.notices).toEqual([]);
    expect(JSON.stringify(foreignFeed.body)).not.toContain("Secret review road");
    const noticeId = reviewerFeed.body.data.notices[0].id as string;
    expect((await request(app).patch(`/api/v1/notifications/${noticeId}/read`).set("Authorization", `Bearer ${foreign.token}`)).status).toBe(404);
    expect(JSON.stringify((await request(app).patch(`/api/v1/notifications/${noticeId}/read`).set("Authorization", `Bearer ${foreign.token}`)).body)).not.toContain("Secret review road");
    const read = await request(app).patch(`/api/v1/notifications/${noticeId}/read`).set("Authorization", `Bearer ${reviewer.token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.isRead).toBe(true);
    const again = await request(app).patch(`/api/v1/notifications/${noticeId}/read`).set("Authorization", `Bearer ${reviewer.token}`);
    expect(again.status).toBe(200);
    expect((await request(app).get("/api/v1/notifications/unread-count").set("Authorization", `Bearer ${reviewer.token}`)).body.data.count).toBe(0);
    const unread = await request(app).patch(`/api/v1/notifications/${noticeId}/unread`).set("Authorization", `Bearer ${reviewer.token}`);
    expect(unread.status).toBe(200);
    expect((await request(app).get("/api/v1/notifications/unread-count").set("Authorization", `Bearer ${reviewer.token}`)).body.data.count).toBe(1);
    const started = await request(app).post(`/api/v1/projects/${id}/review`).set("Authorization", `Bearer ${reviewer.token}`).send({
      action: "BEGIN_REVIEW",
      revision: submitted.body.data.project.revision,
    });
    expect(started.status).toBe(200);
    const approved = await request(app).post(`/api/v1/projects/${id}/review`).set("Authorization", `Bearer ${reviewer.token}`).send({
      action: "APPROVE",
      revision: started.body.data.project.revision,
    });
    expect(approved.status).toBe(200);
    const managerAfter = await request(app).get("/api/v1/notifications?state=all&limit=10").set("Authorization", `Bearer ${manager.token}`);
    expect(managerAfter.body.data.notices.map((row: { titleKey: string }) => row.titleKey).sort()).toEqual(["project.approved", "project.review_started"]);
    expect(managerAfter.body.data.notices.every((row: { project: { title: string } | null }) => row.project?.title === "Secret review road")).toBe(true);
    const auditsBeforeGet = await AuditLog.countDocuments({});
    await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${manager.token}`);
    expect(await AuditLog.countDocuments({})).toBe(auditsBeforeGet);
    await User.updateOne({ _id: manager.user._id }, { agencyId: other._id });
    const movedToken = (await signAccessToken(manager.user._id.toString(), 1)).token;
    const moved = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${movedToken}`);
    expect(moved.status).toBe(200);
    expect(moved.body.data.notices).toHaveLength(2);
    expect(moved.body.data.notices.every((row: { project: unknown }) => row.project === null)).toBe(true);
    expect(JSON.stringify(moved.body)).not.toContain("Secret review road");
  });

  it("does not create a notice when the transition aborts, and a repeated event key stays one row", async () => {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm65b@example.com", "PROJECT_MANAGER", ministry._id);
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${manager.token}`).send({
      projectCode: "INF-NOTE-6502",
      title: "Abort road",
      projectType: "ROAD",
      budget: { amountMinor: 1000, currency: "LKR" },
    });
    const id = created.body.data.project.id as string;
    const aborted = await request(app).post(`/api/v1/projects/${id}/transition`).set("Authorization", `Bearer ${manager.token}`).send({
      action: "SUBMIT",
      revision: 99,
    });
    expect(aborted.status).toBe(409);
    expect(await Notification.countDocuments({})).toBe(0);
    projectHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const filled = await request(app).patch(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${manager.token}`).send({
      startDate: "2027-01-01T00:00:00.000Z",
      plannedEndDate: "2027-06-01T00:00:00.000Z",
      location: { district: "Colombo" },
      geometry: { type: "Point", coordinates: [79.86, 6.93] },
      revision: created.body.data.project.revision,
    });
    expect(filled.status).toBe(503);
    expect(await Notification.countDocuments({})).toBe(0);
    projectHooks.beforeAudit = async () => {};
    const reviewer = await actor("review65b@example.com", "GOV_ADMIN", ministry._id);
    const project = await Project.findById(id);
    if (!project) throw new Error("project");
    const audit = await AuditLog.collection.insertOne({
      userId: manager.user._id,
      action: "project.submitted",
      resourceType: "PROJECT",
      resourceId: project._id,
      requestId: "notice-replay",
      timestamp: new Date(),
    });
    const replay = {
      auditId: audit.insertedId,
      action: "project.submitted" as const,
      resourceType: "PROJECT" as const,
      resourceId: project._id,
      actorId: manager.user._id.toString(),
    };
    const [first, second] = await Promise.allSettled([
      mongoose.startSession().then(async (session) => {
        try {
          await notifyCommittedAudit({ ...replay, session });
        } finally {
          await session.endSession();
        }
      }),
      mongoose.startSession().then(async (session) => {
        try {
          await notifyCommittedAudit({ ...replay, session });
        } finally {
          await session.endSession();
        }
      }),
    ]);
    expect(first.status === "fulfilled" || second.status === "fulfilled").toBe(true);
    expect(await Notification.countDocuments({ sourceAuditId: audit.insertedId })).toBe(1);
    const otherAudit = new mongoose.Types.ObjectId();
    const sessionTwo = await mongoose.startSession();
    await notifyCommittedAudit({
      session: sessionTwo,
      auditId: otherAudit,
      action: "project.review_started",
      resourceType: "PROJECT",
      resourceId: project._id,
      actorId: reviewer.user._id.toString(),
    });
    await sessionTwo.endSession();
    expect(await Notification.countDocuments({ userId: manager.user._id })).toBe(1);
    expect((await request(app).get(`/api/v1/notifications?userId=${reviewer.user._id.toString()}`).set("Authorization", `Bearer ${reviewer.token}`)).status).toBe(400);
    expect((await request(app).patch("/api/v1/notifications/not-an-id/read").set("Authorization", `Bearer ${reviewer.token}`)).status).toBe(400);
    await Role.updateOne({ key: "GOV_ADMIN" }, { $pull: { permissions: "notification.read" } });
    expect((await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${reviewer.token}`)).status).toBe(403);
    await User.updateOne({ _id: reviewer.user._id }, { status: "DISABLED" });
    expect((await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${reviewer.token}`)).status).toBe(401);
    noticeHooks.beforeRead = async () => {
      throw new Error("down");
    };
    await User.updateOne({ _id: manager.user._id }, { status: "ACTIVE" });
    const down = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${manager.token}`);
    expect(down.status).toBe(503);
    const audits = await AuditLog.countDocuments({});
    expect(audits).toBeGreaterThan(0);
  });
});
