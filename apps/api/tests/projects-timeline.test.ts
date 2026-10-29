import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { ProgressReport } from "../src/modules/projects/models/progress-report.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { timelineHooks } from "../src/modules/projects/timeline.service.js";
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

describe("step 61 project timeline", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step61-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step61-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    timelineHooks.beforeRead = async () => {};
    timelineHooks.beforeMilestoneRead = async () => {};
    timelineHooks.beforeProgressRead = async () => {};
    await ProgressReport.collection.deleteMany({});
    await Milestone.deleteMany({});
    await Inspection.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
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
    const manager = await actor("pm61@example.com", "PROJECT_MANAGER", child._id);
    const active = await Project.create({
      projectCode: "INF-TIME-6101",
      title: "Secret timeline title",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 100,
      financialProgress: 40,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      plannedEndDate: new Date("2026-12-31T00:00:00.000Z"),
      createdBy: manager.user._id,
    });
    const empty = await Project.create({
      projectCode: "INF-TIME-6102",
      title: "Empty source project",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "CANCELLED",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const foreignProject = await Project.create({
      projectCode: "INF-TIME-6199",
      title: "Foreign water title",
      projectType: "WATER",
      agencyId: other._id,
      managerId: manager.user._id,
      budget: { amountMinor: 1000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const deck = await Milestone.create({
      projectId: active._id,
      title: "Deck pour",
      description: "private milestone description",
      plannedStart: new Date("2026-07-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
      actualStart: new Date("2026-07-03T00:00:00.000Z"),
      progress: 0,
      status: "DELAYED",
    });
    const abutment = await Milestone.create({
      projectId: active._id,
      title: "Abutment works",
      plannedStart: new Date("2026-07-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-09-01T00:00:00.000Z"),
      progress: 0,
      status: "BLOCKED",
    });
    await ProgressReport.create({
      projectId: active._id,
      sequence: 1,
      reportedPercent: 40,
      previousPercent: 0,
      note: "Reported deck note",
      reporterUserId: manager.user._id,
      reportedAt: new Date("2026-07-01T18:30:00.000Z"),
    });
    return {
      active,
      empty,
      foreignProject,
      deck,
      abutment,
      manager,
      foreign: await actor("foreign61@example.com", "AGENCY_OFFICER", other._id),
      contractor: await actor("contractor61@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector61@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen61@example.com", "CITIZEN", child._id),
    };
  }

  it("returns planned and recorded dates in a stable order without completing the project", async () => {
    const data = await world();
    const before = await Project.findById(data.active.id);
    const read = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline?limit=20`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(read.status).toBe(200);
    expect(read.headers["cache-control"]).toBe("no-store");
    const timeline = read.body.data.timeline;
    expect(timeline.dependencies).toEqual({ status: "visible", scheduling: "informational", links: [] });
    expect(timeline.current).toEqual({ projectStatus: "ACTIVE", physicalProgress: 100, meaning: "reported_not_verified" });
    expect(timeline.provenance).toBe("Reported physical progress is not inspection verification.");
    expect(timeline.sourceAvailability).toEqual({ milestone: "visible", progress: "visible" });
    const dates = timeline.entries.map((entry: { eventDate: string; label?: string; dateRole: string }) => `${entry.eventDate}:${entry.dateRole}:${entry.label ?? ""}`);
    expect(dates).toContain("2026-06-01:plannedStart:");
    expect(dates).toContain("2026-07-01:plannedMilestoneStart:Deck pour");
    expect(dates).toContain("2026-07-01:plannedMilestoneStart:Abutment works");
    expect(dates).toContain("2026-07-03:actualMilestoneStart:Deck pour");
    expect(dates).toContain("2026-07-01T18:30:00.000Z:reported:");
    const starts = timeline.entries.filter((entry: { dateRole: string }) => entry.dateRole === "plannedMilestoneStart");
    const orderedStarts = [...starts].sort((left: { sourceId: string }, right: { sourceId: string }) => left.sourceId.localeCompare(right.sourceId));
    expect(starts.map((entry: { sourceId: string }) => entry.sourceId)).toEqual(orderedStarts.map((entry: { sourceId: string }) => entry.sourceId));
    const reportIndex = dates.findIndex((item: string) => item.includes(":reported:"));
    const lastStart = Math.max(...starts.map((entry: { id: string }) => timeline.entries.findIndex((item: { id: string }) => item.id === entry.id)));
    expect(reportIndex).toBeGreaterThan(lastStart);
    const report = timeline.entries.find((entry: { dateRole: string }) => entry.dateRole === "reported");
    expect(report.reportedPercent).toBe(40);
    expect(report.note).toBe("Reported deck note");
    expect(report).not.toHaveProperty("reporterUserId");
    const body = JSON.stringify(read.body);
    expect(body).not.toContain("financialProgress");
    expect(body).not.toContain("pm61@example.com");
    expect(body).not.toContain("private milestone description");
    const after = await Project.findById(data.active.id);
    expect(after?.status).toBe("ACTIVE");
    expect(after?.physicalProgress).toBe(100);
    expect(after?.__v).toBe(before?.__v);
    expect(await Milestone.findById(data.deck.id)).toMatchObject({ status: "DELAYED" });
    expect(await ProgressReport.countDocuments({ projectId: data.active._id })).toBe(1);
  });

  it("paginates deterministically and leaves an empty source without invented dates", async () => {
    const data = await world();
    const first = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline?limit=2&page=1&sort=asc&kind=milestone`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    const second = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline?limit=2&page=2&sort=asc&kind=milestone`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(first.status).toBe(200);
    expect(first.body.data.timeline.entries).toHaveLength(2);
    expect(first.body.data.timeline.hasMore).toBe(true);
    expect(second.body.data.timeline.entries[0].id).not.toBe(first.body.data.timeline.entries[0].id);
    const reversed = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline?limit=2&page=1&sort=desc&kind=milestone`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(reversed.body.data.timeline.entries[0].id).not.toBe(first.body.data.timeline.entries[0].id);
    const empty = await request(app)
      .get(`/api/v1/projects/${data.empty.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(empty.status).toBe(200);
    expect(empty.body.data.timeline.entries.every((entry: { sourceKind: string }) => entry.sourceKind === "project")).toBe(true);
    expect(empty.body.data.timeline.current.projectStatus).toBe("CANCELLED");
    expect(empty.body.data.timeline.entries.some((entry: { dateRole: string }) => entry.dateRole === "plannedStart")).toBe(false);
  });

  it("hides restricted sources and denies missing, foreign, and unauthenticated callers", async () => {
    const data = await world();
    expect((await request(app).get(`/api/v1/projects/${data.active.id}/timeline`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/projects/${data.active.id}/timeline`).set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${data.active.id}/timeline`).set("Authorization", `Bearer ${data.citizen.token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/${data.active.id}/timeline`).set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(403);
    const foreign = await request(app)
      .get(`/api/v1/projects/${data.foreignProject.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain("Foreign water title");
    expect((await request(app).get(`/api/v1/projects/not-an-id/timeline`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/projects/${data.active.id}/timeline?export=1`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(400);
    expect((await request(app).post(`/api/v1/projects/${data.active.id}/timeline`).set("Authorization", `Bearer ${data.manager.token}`).send({})).status).toBe(404);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "milestone.read" } });
    const noMilestones = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(noMilestones.body.data.timeline.sourceAvailability.milestone).toBe("restricted");
    expect(JSON.stringify(noMilestones.body)).not.toContain("Deck pour");
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "progress.read" } });
    const noProgress = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(noProgress.body.data.timeline.sourceAvailability.progress).toBe("restricted");
    expect(JSON.stringify(noProgress.body)).not.toContain("Reported deck note");
    expect(JSON.stringify(noProgress.body)).not.toContain("reportedPercent");
  });

  it("returns 503 when the timeline read dependency fails and does not write", async () => {
    const data = await world();
    timelineHooks.beforeRead = async () => {
      throw new Error("timeline down");
    };
    const failed = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed.body)).not.toContain("Deck pour");
    const parent = await Project.findById(data.active.id);
    expect(parent?.status).toBe("ACTIVE");
    expect(parent?.physicalProgress).toBe(100);
  });

  it("marks a failed milestone source unavailable instead of an empty milestone list", async () => {
    const data = await world();
    timelineHooks.beforeMilestoneRead = async () => {
      throw new Error("milestone store down");
    };
    const failed = await request(app)
      .get(`/api/v1/projects/${data.active.id}/timeline`)
      .set("Authorization", `Bearer ${data.manager.token}`);
    expect(failed.status).toBe(200);
    expect(failed.body.data.timeline.sourceAvailability.milestone).toBe("unavailable");
    expect(failed.body.data.timeline.sourceAvailability.progress).toBe("visible");
    expect(JSON.stringify(failed.body)).not.toContain("Deck pour");
    expect(failed.body.data.timeline.entries.some((entry: { dateRole: string }) => entry.dateRole === "reported")).toBe(true);
  });
});
