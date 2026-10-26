import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
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
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}

const draftBody = {
  projectCode: "INF-ROAD-101",
  title: "Example Road Improvement",
  description: "Academic demonstration proposal",
  projectType: "ROAD",
  budget: { amountMinor: 2500000000, currency: "LKR" },
};

describe("step 51 project foundation", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step51-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step51-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    projectHooks.beforeAudit = async () => {};
    vi.restoreAllMocks();
    await Project.deleteMany({});
    await Inspection.deleteMany({});
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
    return {
      ministry,
      child,
      other,
      gov: await actor("gov51@example.com", "GOV_ADMIN", ministry._id),
      officer: await actor("officer51@example.com", "AGENCY_OFFICER", child._id),
      manager: await actor("pm51@example.com", "PROJECT_MANAGER", child._id),
      superUser: await actor("super51@example.com", "SUPER_ADMIN", ministry._id),
      contractor: await actor("contractor51@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector51@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen51@example.com", "CITIZEN", child._id),
    };
  }

  it("creates a draft in the actor agency and hides it from other scopes", async () => {
    const data = await world();
    expect((await request(app).get("/api/v1/projects")).status).toBe(401);
    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ ...draftBody, agencyId: data.other._id.toString(), status: "APPROVED", managerId: data.superUser.user._id.toString() });
    expect(created.status).toBe(400);

    const ok = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send(draftBody);
    expect(ok.status).toBe(201);
    expect(ok.headers["cache-control"]).toContain("no-store");
    expect(ok.body.data.project.status).toBe("DRAFT");
    expect(ok.body.data.project.agencyId).toBe(data.child._id.toString());
    expect(ok.body.data.project.managerId).toBeNull();
    expect(JSON.stringify(ok.body)).not.toContain("passwordHash");

    const listed = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.total).toBe(listed.body.data.projects.length);
    expect(listed.body.data.projects[0].projectCode).toBe("INF-ROAD-101");

    const hidden = await request(app)
      .get(`/api/v1/projects/${ok.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.gov.token}`);
    expect(hidden.status).toBe(200);
    const otherGov = await actor("othergov51@example.com", "GOV_ADMIN", data.other._id);
    const deniedGov = await request(app)
      .get(`/api/v1/projects/${ok.body.data.project.id}`)
      .set("Authorization", `Bearer ${otherGov.token}`);
    expect(deniedGov.status).toBe(404);
    const otherList = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${otherGov.token}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body.data.total).toBe(0);
    expect(otherList.body.data.projects).toEqual([]);

    const badId = await request(app).get("/api/v1/projects/not-an-id").set("Authorization", `Bearer ${data.officer.token}`);
    expect(badId.status).toBe(400);
    const missing = await request(app)
      .get(`/api/v1/projects/${data.other._id.toString()}`)
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(missing.status).toBe(404);

    await Role.updateOne({ key: "SUPER_ADMIN" }, { $addToSet: { permissions: "project.create" } });
    const superCreate = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.superUser.token}`).send({
      ...draftBody,
      projectCode: "INF-ROAD-202",
    });
    expect(superCreate.status).toBe(403);
    const superRead = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.superUser.token}`);
    expect(superRead.status).toBe(200);
    expect(superRead.body.data.total).toBe(1);
    expect(superRead.body.data.projects[0].budget).toBeUndefined();
    const superDetail = await request(app)
      .get(`/api/v1/projects/${ok.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.superUser.token}`);
    expect(superDetail.body.data.project.budget.currency).toBe("LKR");

    expect((await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.citizen.token}`)).status).toBe(403);
  });

  it("limits manager edits, inspector reads, and rejects unsafe drafts", async () => {
    const data = await world();
    const owned = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send({
      ...draftBody,
      projectCode: "INF-BRIDGE-3",
    });
    expect(owned.status).toBe(201);
    expect(owned.body.data.project.managerId).toBeNull();

    const managerEdit = await request(app)
      .patch(`/api/v1/projects/${owned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ title: "Taken over", revision: 0 });
    expect(managerEdit.status).toBe(404);

    const renamed = await request(app)
      .patch(`/api/v1/projects/${owned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ title: "Bridge draft", revision: 0, status: "ACTIVE" });
    expect(renamed.status).toBe(400);
    const saved = await request(app)
      .patch(`/api/v1/projects/${owned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ title: "Bridge draft", revision: 0 });
    expect(saved.status).toBe(200);
    const pmOwned = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.manager.token}`).send({
      ...draftBody,
      projectCode: "INF-ROAD-77",
      geometry: { type: "LineString", coordinates: [[79.855, 6.927], [79.862, 6.93]] },
    });
    expect(pmOwned.status).toBe(201);
    expect(pmOwned.body.data.project.managerId).toBe(data.manager.user._id.toString());
    const pmEdit = await request(app)
      .patch(`/api/v1/projects/${pmOwned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send({ title: "Assigned draft", revision: 0 });
    expect(pmEdit.status).toBe(200);

    const polygon = await request(app)
      .patch(`/api/v1/projects/${owned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1]]] },
        revision: saved.body.data.project.revision,
      });
    expect(polygon.status).toBe(400);
    const inverted = await request(app)
      .patch(`/api/v1/projects/${owned.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({
        startDate: "2027-05-01T00:00:00.000Z",
        plannedEndDate: "2027-01-01T00:00:00.000Z",
        revision: saved.body.data.project.revision,
      });
    expect(inverted.status).toBe(400);

    await Inspection.create({
      projectId: owned.body.data.project.id,
      inspectorId: data.inspector.user._id,
      inspectionDate: new Date("2027-02-01T00:00:00.000Z"),
      status: "SCHEDULED",
    });
    const seen = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.inspector.token}`);
    expect(seen.status).toBe(200);
    expect(seen.body.data.total).toBe(1);
    const otherProject = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send({
      ...draftBody,
      projectCode: "INF-WATER-9",
    });
    const inspectorMiss = await request(app)
      .get(`/api/v1/projects/${otherProject.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.inspector.token}`);
    expect(inspectorMiss.status).toBe(404);
  });

  it("returns one winner for duplicate codes and revisions and rolls back a failed audit", async () => {
    const data = await world();
    const [first, second] = await Promise.all([
      request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send(draftBody),
      request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send(draftBody),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await Project.countDocuments({ projectCode: "INF-ROAD-101" })).toBe(1);

    const projectId = (first.status === 201 ? first : second).body.data.project.id as string;
    const [left, right] = await Promise.all([
      request(app).patch(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${data.officer.token}`).send({ title: "North", revision: 0 }),
      request(app).patch(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${data.officer.token}`).send({ title: "South", revision: 0 }),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);

    projectHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const current = await Project.findById(projectId);
    const rolled = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ title: "Should not stick", revision: current?.__v ?? 0 });
    expect(rolled.status).toBe(503);
    expect((await Project.findById(projectId))?.title).not.toBe("Should not stick");

    vi.spyOn(Project, "find").mockRejectedValueOnce(new Error("db down"));
    const down = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`);
    expect(down.status).toBe(503);
  });

  it("rejects non-json writes, non-draft edits, and injected scope", async () => {
    const data = await world();
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send(draftBody);
    expect(created.status).toBe(201);
    const text = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${data.officer.token}`)
      .set("Content-Type", "text/plain")
      .send("not-json");
    expect(text.status).toBe(415);
    await Project.updateOne({ _id: created.body.data.project.id }, { $set: { status: "ACTIVE" } });
    const locked = await request(app)
      .patch(`/api/v1/projects/${created.body.data.project.id}`)
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ title: "Should stay active", revision: created.body.data.project.revision });
    expect(locked.status).toBe(409);
    expect((await Project.findById(created.body.data.project.id))?.status).toBe("ACTIVE");
    const injected = await request(app)
      .get("/api/v1/projects")
      .query({ agencyId: data.other._id.toString() })
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(injected.status).toBe(200);
    expect(injected.body.data.total).toBe(0);
    expect(injected.body.data.projects).toEqual([]);
    const operator = await request(app)
      .get("/api/v1/projects")
      .query({ roleKey: "SUPER_ADMIN" })
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(operator.status).toBe(400);
    const badBudget = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ ...draftBody, projectCode: "INF-ROAD-303", budget: { amountMinor: -1, currency: "LKR" } });
    expect(badBudget.status).toBe(400);
    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $pull: { permissions: "project.read" } });
    const removed = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`);
    expect(removed.status).toBe(403);
  });

  it("creates a minimal draft and denies a removed create grant", async () => {
    const data = await world();
    const minimal = {
      projectCode: "INF-ROAD-5201",
      title: "Synthetic corridor",
      projectType: "ROAD",
      budget: { amountMinor: 0, currency: "LKR" },
    };
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${data.officer.token}`).send(minimal);
    expect(created.status).toBe(201);
    expect(created.body.data.project.status).toBe("DRAFT");
    expect(created.body.data.project.startDate).toBeNull();
    expect(created.body.data.project.agencyId).toBe(data.child._id.toString());
    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $pull: { permissions: "project.create" } });
    const revoked = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${data.officer.token}`)
      .send({ ...minimal, projectCode: "INF-ROAD-5202" });
    expect(revoked.status).toBe(403);
    expect(await Project.countDocuments({ projectCode: "INF-ROAD-5202" })).toBe(0);
    for (const token of [data.contractor.token, data.inspector.token, data.citizen.token]) {
      const denied = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...minimal, projectCode: "INF-ROAD-5203" });
      expect(denied.status).toBe(403);
    }
    expect(await Project.countDocuments({ projectCode: "INF-ROAD-5203" })).toBe(0);
    expect(await AuditLog.countDocuments({ action: "project.created", resourceId: created.body.data.project.id })).toBe(1);
  });

  it("sorts and filters the scoped list without widening agency access", async () => {
    const data = await world();
    const otherOfficer = await actor("otheroff53@example.com", "AGENCY_OFFICER", data.other._id);
    for (const code of ["INF-ROAD-3", "INF-ROAD-1", "INF-ROAD-2"]) {
      const created = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${data.officer.token}`)
        .send({ ...draftBody, projectCode: code, title: code === "INF-ROAD-2" ? "ජල මාර්ගය" : "Alpha road" });
      expect(created.status).toBe(201);
    }
    const outside = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${otherOfficer.token}`)
      .send({ ...draftBody, projectCode: "INF-WATER-9", title: "Other ministry" });
    expect(outside.status).toBe(201);

    const first = await request(app)
      .get("/api/v1/projects")
      .query({ sortBy: "projectCode", sortDir: "asc", limit: 1, page: 1 })
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(first.status).toBe(200);
    expect(first.body.data.total).toBe(3);
    expect(first.body.data.projects.map((row: { projectCode: string }) => row.projectCode)).toEqual(["INF-ROAD-1"]);
    expect(JSON.stringify(first.body.data.projects)).not.toContain("amountMinor");
    const second = await request(app)
      .get("/api/v1/projects")
      .query({ sortBy: "projectCode", sortDir: "asc", limit: 1, page: 2 })
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(second.body.data.projects[0].projectCode).toBe("INF-ROAD-2");
    expect(second.body.data.agencies.map((row: { code: string }) => row.code)).toEqual(["DEPT_WEST"]);

    const unicode = await request(app).get("/api/v1/projects").query({ q: "ජල" }).set("Authorization", `Bearer ${data.officer.token}`);
    expect(unicode.body.data.total).toBe(1);
    const none = await request(app).get("/api/v1/projects").query({ status: "ACTIVE" }).set("Authorization", `Bearer ${data.officer.token}`);
    expect(none.body.data.total).toBe(0);
    expect((await request(app).get("/api/v1/projects").query({ sortBy: "$where" }).set("Authorization", `Bearer ${data.officer.token}`)).status).toBe(400);
    expect((await request(app).get("/api/v1/projects").query({ q: "$gt" }).set("Authorization", `Bearer ${data.officer.token}`)).status).toBe(400);
    expect((await request(app).get("/api/v1/projects").query({ sortBy: ["createdAt", "title"] }).set("Authorization", `Bearer ${data.officer.token}`)).status).toBe(400);

    const hidden = await request(app)
      .get("/api/v1/projects")
      .query({ agencyId: data.other._id.toString() })
      .set("Authorization", `Bearer ${data.officer.token}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.total).toBe(0);
    expect(hidden.body.data.projects).toEqual([]);
    expect(JSON.stringify(hidden.body)).not.toContain("INF-WATER-9");

    await Agency.updateOne({ _id: data.child._id }, { $set: { status: "INACTIVE" } });
    const inactive = await request(app).get("/api/v1/projects").query({ q: "INF-ROAD-1" }).set("Authorization", `Bearer ${data.gov.token}`);
    expect(inactive.body.data.total).toBe(0);
    await Agency.updateOne({ _id: data.child._id }, { $set: { status: "ACTIVE", parentAgencyId: data.other._id } });
    const lost = await request(app).get("/api/v1/projects").query({ q: "INF-ROAD-1" }).set("Authorization", `Bearer ${data.gov.token}`);
    expect(lost.body.data.total).toBe(0);
    const otherGov = await actor("othergov53@example.com", "GOV_ADMIN", data.other._id);
    const gained = await request(app).get("/api/v1/projects").query({ q: "INF-ROAD-1" }).set("Authorization", `Bearer ${otherGov.token}`);
    expect(gained.body.data.total).toBe(1);
    expect((await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
  });

  it("returns one scoped overview without a budget when finance.budget.read is absent", async () => {
    const data = await world();
    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${data.manager.token}`)
      .send(draftBody);
    expect(created.status).toBe(201);
    const id = created.body.data.project.id as string;
    await Project.updateOne(
      { _id: id },
      {
        $set: {
          startDate: new Date("2026-10-26T00:00:00.000Z"),
          geometry: { type: "Point", coordinates: [79.8612, 6.9271] },
          physicalProgress: 12,
          financialProgress: 40,
        },
      },
    );
    await Inspection.create({
      projectId: id,
      inspectorId: data.inspector.user._id,
      inspectionDate: new Date("2027-02-01T00:00:00.000Z"),
      status: "SCHEDULED",
    });

    const owned = await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(owned.status).toBe(200);
    expect(owned.headers["cache-control"]).toBe("no-store");
    expect(owned.body.data.project.managerName).toBe("Nimal Perera");
    expect(owned.body.data.project.description).toBe("Academic demonstration proposal");
    expect(owned.body.data.project.startDate).toBe("2026-10-26T00:00:00.000Z");
    expect(owned.body.data.project.actualEndDate).toBeNull();
    expect(owned.body.data.project.physicalProgress).toBe(12);
    expect(owned.body.data.project.geometry.type).toBe("Point");
    expect(owned.body.data.project.budget.amountMinor).toBe(2500000000);
    const serialized = JSON.stringify(owned.body);
    expect(serialized).not.toContain("financialProgress");
    expect(serialized).not.toContain("contractor");
    expect(serialized).not.toContain("@");

    await Role.updateOne({ key: "AGENCY_OFFICER" }, { $pull: { permissions: "finance.budget.read" } });
    const noBudget = await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.officer.token}`);
    expect(noBudget.status).toBe(200);
    expect(noBudget.body.data.project.budget).toBeUndefined();
    expect(JSON.stringify(noBudget.body)).not.toContain("amountMinor");

    const assigned = await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.inspector.token}`);
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.project.budget).toBeUndefined();

    const stranger = await actor("inspector54b@example.com", "INSPECTOR", data.child._id);
    expect((await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${stranger.token}`)).status).toBe(404);

    const other = await actor("other54@example.com", "AGENCY_OFFICER", data.other._id);
    const hidden = await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${other.token}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("INF-ROAD-101");

    expect((await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/not-an-id").set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(400);

    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "project.read" } });
    expect((await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(403);

    vi.spyOn(Project, "findOne").mockRejectedValueOnce(new Error("db down"));
    const down = await request(app).get(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${data.officer.token}`);
    expect(down.status).toBe(503);
  });
});
