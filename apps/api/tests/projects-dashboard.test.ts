import { hash } from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { dashboardHooks, getProjectDashboard } from "../src/modules/projects/dashboard.service.js";
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
  return { user, token: (await signAccessToken(user._id.toString(), epoch)).token, role: roleDoc };
}

async function project(code: string, title: string, agencyId: unknown, managerId: unknown, status: string, physicalProgress = 0) {
  return Project.create({
    projectCode: code,
    title,
    projectType: "ROAD",
    agencyId,
    managerId,
    budget: { amountMinor: 100000, currency: "LKR" },
    status,
    physicalProgress,
    financialProgress: 0,
    createdBy: managerId,
  });
}

describe("step 64 project dashboard", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step64-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step64-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    dashboardHooks.beforeRead = async () => {};
    await AuditLog.collection.deleteMany({});
    await ProgressReport.collection.deleteMany({});
    await ProjectPayment.deleteMany({});
    await Inspection.deleteMany({});
    await Milestone.deleteMany({});
    await Project.deleteMany({});
    await Contractor.deleteMany({});
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("counts one agency scope, keeps 100 percent active, and withholds other agencies", async () => {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm64@example.com", "PROJECT_MANAGER", child._id);
    const peer = await actor("peer64@example.com", "PROJECT_MANAGER", child._id);
    const officer = await actor("officer64@example.com", "AGENCY_OFFICER", child._id);
    const foreign = await actor("foreign64@example.com", "AGENCY_OFFICER", other._id);
    const reviewer = await actor("review64@example.com", "GOV_ADMIN", ministry._id);
    const own = await project("INF-DASH-6401", "Reported complete road", child._id, manager.user._id, "ACTIVE", 100);
    await project("INF-DASH-6402", "Peer bridge", child._id, peer.user._id, "ACTIVE", 20);
    await project("INF-DASH-6403", "Held drain", child._id, manager.user._id, "ON_HOLD", 0);
    await project("INF-DASH-6404", "Late pier", child._id, manager.user._id, "DELAYED", 0);
    await project("INF-DASH-6405", "Waiting approval", child._id, manager.user._id, "SUBMITTED", 0);
    await project("INF-DASH-6499", "Foreign road", other._id, foreign.user._id, "ACTIVE", 100);
    await project("INF-DASH-6498", "Foreign submission", other._id, foreign.user._id, "SUBMITTED", 0);
    const company = await Contractor.create({ name: "Atlas Works", registrationNumber: "REG64" });
    await ProjectPayment.create({
      projectId: own._id,
      contractorId: company._id,
      amount: { amountMinor: 2500, currency: "LKR" },
      paymentType: "INTERIM",
      status: "PAID",
      date: new Date("2026-06-01T00:00:00.000Z"),
      createdBy: manager.user._id,
    });
    await ProjectPayment.create({
      projectId: own._id,
      contractorId: company._id,
      amount: { amountMinor: 9000, currency: "LKR" },
      paymentType: "INTERIM",
      status: "PENDING",
      date: new Date("2026-06-02T00:00:00.000Z"),
      createdBy: manager.user._id,
    });
    const asOf = new Date("2026-07-02T03:00:00.000Z");
    const dayStart = new Date("2026-07-01T18:30:00.000Z");
    await Milestone.create({ projectId: own._id, title: "Just overdue", status: "IN_PROGRESS", progress: 10, plannedStart: new Date("2026-06-01T00:00:00.000Z"), plannedEnd: new Date(dayStart.getTime() - 1) });
    await Milestone.create({ projectId: own._id, title: "Due at midnight", status: "NOT_STARTED", progress: 0, plannedStart: new Date("2026-06-01T00:00:00.000Z"), plannedEnd: dayStart });
    await Milestone.create({ projectId: own._id, title: "Already finished plan", status: "COMPLETED", progress: 100, plannedStart: new Date("2026-05-01T00:00:00.000Z"), plannedEnd: new Date("2026-05-02T00:00:00.000Z") });
    const beforeProjects = await Project.countDocuments({});
    const beforeReports = await ProgressReport.countDocuments({});
    const beforeAudits = await AuditLog.countDocuments({});
    const updatedAt = own.updatedAt?.toISOString();
    const response = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${officer.token}`);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.meta.requestId).toEqual(expect.any(String));
    const data = response.body.data;
    expect(data.counts.total).toBe(5);
    expect(data.counts.active).toBe(2);
    expect(data.counts.onHold).toBe(1);
    expect(data.counts.delayed).toBe(1);
    expect(data.counts.byStatus.SUBMITTED).toBe(1);
    expect(data.counts.byStatus.COMPLETED).toBe(0);
    expect(data.physical.reportedAt100StillNotCompleted).toBe(1);
    expect(data.physical.completedByStatus).toBe(0);
    expect(data.physical.meaning).toBe("physical_progress_does_not_set_status");
    expect(data.recentProjects).toHaveLength(5);
    expect(data.recentProjects.map((row: { projectCode: string }) => row.projectCode)).not.toContain("INF-DASH-6499");
    expect(data.reviews).toBeNull();
    expect(data.finance.storedPaidCount).toBe(1);
    expect(data.finance.storedPaidAmountMinor).toBe(2500);
    expect(data.finance.provenance).toBe("stored_record_provisional_not_bank_settlement");
    expect(JSON.stringify(data)).not.toContain("9000");
    expect(JSON.stringify(data)).not.toContain("REG64");
    const direct = await getProjectDashboard({
      userId: officer.user._id.toString(),
      roleId: officer.role._id.toString(),
      roleKey: "AGENCY_OFFICER",
      agencyId: child._id.toString(),
      credentialEpoch: 1,
    }, asOf);
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;
    expect(direct.dashboard.milestones?.overdue).toBe(1);
    expect(direct.dashboard.milestones?.dueWithin14Days).toBe(1);
    expect(direct.dashboard.milestones?.items.map((item) => item.title)).toEqual(["Just overdue", "Due at midnight"]);
    expect(direct.dashboard.milestones?.items.every((item) => item.meaning === "planned_not_completed")).toBe(true);
    const managerView = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${manager.token}`);
    expect(managerView.status).toBe(200);
    expect(managerView.body.data.counts.total).toBe(5);
    expect(managerView.body.data.assignedToYou).toBe(4);
    const reviewView = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${reviewer.token}`);
    expect(reviewView.status).toBe(200);
    expect(reviewView.body.data.counts.total).toBe(5);
    expect(reviewView.body.data.reviews.pending).toBe(1);
    expect(reviewView.body.data.reviews.items.map((row: { projectCode: string }) => row.projectCode)).toEqual(["INF-DASH-6405"]);
    const foreignView = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${foreign.token}`);
    expect(foreignView.status).toBe(200);
    expect(foreignView.body.data.counts.total).toBe(2);
    expect(foreignView.body.data.counts.byStatus.SUBMITTED).toBe(1);
    expect(foreignView.body.data.reviews).toBeNull();
    expect(foreignView.body.data.finance.storedPaidCount).toBe(0);
    expect(await Project.countDocuments({})).toBe(beforeProjects);
    expect(await ProgressReport.countDocuments({})).toBe(beforeReports);
    expect(await AuditLog.countDocuments({})).toBe(beforeAudits);
    const reread = await Project.findById(own._id).select("updatedAt status physicalProgress");
    expect(reread?.status).toBe("ACTIVE");
    expect(reread?.physicalProgress).toBe(100);
    expect(reread?.updatedAt?.toISOString()).toBe(updatedAt);
  });

  it("fails closed for missing grants, disabled accounts, epoch changes, and bad query input", async () => {
    await seedRoles();
    const agency = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm64b@example.com", "PROJECT_MANAGER", agency._id);
    await project("INF-DASH-6410", "Only road", agency._id, manager.user._id, "ACTIVE", 0);
    const inspector = await actor("inspector64@example.com", "INSPECTOR", agency._id);
    const contractor = await actor("contractor64@example.com", "CONTRACTOR", agency._id);
    expect((await request(app).get("/api/v1/projects/dashboard")).status).toBe(401);
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${inspector.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${contractor.token}`)).status).toBe(403);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "project.dashboard.read" } });
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${manager.token}`)).status).toBe(403);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $addToSet: { permissions: "project.dashboard.read" } });
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "project.read" } });
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${manager.token}`)).status).toBe(403);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $addToSet: { permissions: "project.read" } });
    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $pull: { permissions: "finance.budget.read" } });
    const officer = await actor("officer64b@example.com", "AGENCY_OFFICER", agency._id);
    const withheld = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${officer.token}`);
    expect(withheld.status).toBe(200);
    expect(withheld.body.data.finance).toBeNull();
    expect(withheld.body.data.coverage.finance).toBe("withheld");
    expect(JSON.stringify(withheld.body.data)).not.toContain("amountMinor");
    await User.updateOne({ _id: manager.user._id }, { status: "DISABLED" });
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${manager.token}`)).status).toBe(401);
    await User.updateOne({ _id: manager.user._id }, { status: "ACTIVE", credentialEpoch: 2 });
    expect((await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${manager.token}`)).status).toBe(401);
    expect((await request(app).get("/api/v1/projects/dashboard?agencyId=" + agency._id.toString()).set("Authorization", `Bearer ${officer.token}`)).status).toBe(400);
    expect((await request(app).get("/api/v1/projects/dashboard?role=SUPER_ADMIN").set("Authorization", `Bearer ${officer.token}`)).status).toBe(400);
    dashboardHooks.beforeRead = async () => {
      throw new Error("source down");
    };
    const down = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${officer.token}`);
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("limits an inspector who is granted the dashboard to assigned projects", async () => {
    await seedRoles();
    const agency = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm64c@example.com", "PROJECT_MANAGER", agency._id);
    const inspector = await actor("inspector64b@example.com", "INSPECTOR", agency._id);
    const visible = await project("INF-DASH-6420", "Assigned inspection", agency._id, manager.user._id, "ACTIVE", 0);
    await project("INF-DASH-6421", "Unassigned road", agency._id, manager.user._id, "DELAYED", 0);
    await Inspection.create({ projectId: visible._id, inspectorId: inspector.user._id, inspectionDate: new Date("2026-07-01T00:00:00.000Z"), status: "SCHEDULED" });
    await Role.updateOne({ key: "INSPECTOR" }, { $addToSet: { permissions: "project.dashboard.read" } });
    const response = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${inspector.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.scope).toBe("assigned");
    expect(response.body.data.counts.total).toBe(1);
    expect(response.body.data.counts.delayed).toBe(0);
    expect(response.body.data.recentProjects.map((row: { projectCode: string }) => row.projectCode)).toEqual(["INF-DASH-6420"]);
    expect(response.body.data.finance).toBeNull();
  });

  it("returns a verified zero when the agency has no projects", async () => {
    await seedRoles();
    const agency = await Agency.create({ code: "MIN_EMPTY", name: "Empty", type: "MINISTRY", status: "ACTIVE" });
    const officer = await actor("empty64@example.com", "AGENCY_OFFICER", agency._id);
    const response = await request(app).get("/api/v1/projects/dashboard").set("Authorization", `Bearer ${officer.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.counts.total).toBe(0);
    expect(response.body.data.recentProjects).toEqual([]);
    expect(response.body.data.milestones?.overdue).toBe(0);
    expect(response.body.data.milestones?.dueWithin14Days).toBe(0);
  });

  it("rejects a non-object id actor before reading projects", async () => {
    await seedRoles();
    const result = await getProjectDashboard({
      userId: "not-an-id",
      roleId: new mongoose.Types.ObjectId().toString(),
      roleKey: "AGENCY_OFFICER",
      agencyId: new mongoose.Types.ObjectId().toString(),
      credentialEpoch: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
  });
});
