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
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { workRequestHooks } from "../src/modules/roadsync/work-requests.service.js";
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

describe("step 66 roadsync work requests", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step66-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step66-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    workRequestHooks.beforeAudit = async () => {};
    await WorkRequest.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const agency = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE" });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const officer = await actor("o66@example.com", "AGENCY_OFFICER", agency._id);
    const manager = await actor("pm66@example.com", "PROJECT_MANAGER", agency._id);
    const otherManager = await actor("pm66b@example.com", "PROJECT_MANAGER", agency._id);
    const make = (code: string, status: string, managerId: unknown) =>
      Project.create({
        projectCode: code,
        title: `Title ${code}`,
        projectType: "ROAD",
        agencyId: agency._id,
        managerId,
        budget: { amountMinor: 1000, currency: "LKR" },
        status,
        physicalProgress: 0,
        financialProgress: 0,
        createdBy: officer.user._id,
      });
    return {
      agency,
      officer,
      manager,
      otherManager,
      approved: await make("INF-RS-1", "APPROVED", manager.user._id),
      cancelled: await make("INF-RS-2", "CANCELLED", manager.user._id),
      draftProject: await make("INF-RS-3", "DRAFT", manager.user._id),
      foreign: await actor("f66@example.com", "AGENCY_OFFICER", other._id),
      superUser: await actor("s66@example.com", "SUPER_ADMIN", agency._id),
      contractor: await actor("c66@example.com", "CONTRACTOR", agency._id),
      citizen: await actor("z66@example.com", "CITIZEN", agency._id),
    };
  }

  const point = { type: "Point", coordinates: [79.86, 6.93] };
  const body = (projectId: string, extra: Record<string, unknown> = {}) => ({
    projectId,
    workType: "ROAD_RESURFACING",
    plannedStart: "2026-11-10T03:30:00.000Z",
    plannedEnd: "2026-11-12T11:30:00.000Z",
    geometry: point,
    ...extra,
  });
  const post = (token: string, payload: unknown) =>
    request(app).post("/api/v1/roadsync/work-requests").set("Authorization", `Bearer ${token}`).send(payload as object);
  const get = (token: string, path = "") =>
    request(app).get(`/api/v1/roadsync/work-requests${path}`).set("Authorization", `Bearer ${token}`);

  it("creates a DRAFT with server-derived agency, audits it, and lists/reads it", async () => {
    const d = await world();
    const res = await post(d.officer.token, body(d.approved.id));
    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    const wr = res.body.data.workRequest;
    expect(wr.status).toBe("DRAFT");
    expect(wr.priority).toBe("NORMAL");
    expect(wr.agencyId).toBe(d.agency.id);
    expect(wr.projectCode).toBe("INF-RS-1");
    expect(await AuditLog.countDocuments({ resourceType: "WORK_REQUEST", action: "work_request.created" })).toBe(1);

    const list = await get(d.officer.token);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.counts.byStatus).toEqual({ DRAFT: 1 });
    const detail = await get(d.manager.token, `/${wr.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.workRequest.geometry).toEqual(point);
    expect(await AuditLog.countDocuments({})).toBe(1); // GET performed no writes
  });

  it("scopes by agency and manager; foreign and unassigned get 404 with no leak", async () => {
    const d = await world();
    const created = (await post(d.officer.token, body(d.approved.id))).body.data.workRequest;
    const foreign = await get(d.foreign.token, `/${created.id}`);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain("Title INF-RS-1");
    expect((await get(d.foreign.token)).body.data.total).toBe(0);
    expect((await get(d.otherManager.token, `/${created.id}`)).status).toBe(404);
    expect((await get(d.otherManager.token)).body.data.total).toBe(0);
    expect((await get(d.superUser.token, `/${created.id}`)).status).toBe(200);
  });

  it("denies by capability and authentication", async () => {
    const d = await world();
    expect((await request(app).get("/api/v1/roadsync/work-requests")).status).toBe(401);
    expect((await post(d.contractor.token, body(d.approved.id))).status).toBe(403);
    expect((await get(d.citizen.token)).status).toBe(403);
    expect((await post(d.foreign.token, body(d.approved.id))).status).toBe(404);
    expect((await post(d.otherManager.token, body(d.approved.id))).status).toBe(404);
    expect(await WorkRequest.countDocuments({})).toBe(0);
  });

  it("lets the platform administrator create for the project's owning agency and audits the real actor", async () => {
    const d = await world();
    const unauthenticated = await request(app).post("/api/v1/roadsync/work-requests").send(body(d.approved.id));
    expect(unauthenticated.status).toBe(401);
    expect((await post(d.superUser.token, body("f".repeat(24)))).status).toBe(404);
    const created = await post(d.superUser.token, body(d.approved.id));
    expect(created.status).toBe(201);
    const owner = (await Project.findById(d.approved.id))?.agencyId.toString();
    const stored = await WorkRequest.findOne({});
    expect(stored?.agencyId.toString()).toBe(owner);
    const audit = await AuditLog.findOne({ resourceType: "WORK_REQUEST", action: "work_request.created" });
    expect(audit?.userId?.toString()).toBe(d.superUser.user._id.toString());
    expect(audit?.agencyId?.toString()).toBe(owner);
  });

  it("rejects unknown fields, bad geometry, bad dates and bad enums without persisting", async () => {
    const d = await world();
    const id = d.approved.id;
    const bad: unknown[] = [
      body(id, { agencyId: d.agency.id }),
      body(id, { status: "SUBMITTED" }),
      body(id, { priority: "URGENT" }),
      body(id, { workType: "NOPE" }),
      body(id, { geometry: { type: "Point", coordinates: [200, 6] } }),
      body(id, { geometry: { type: "Point", coordinates: [6.9, 79.8, 1] } }),
      body(id, { geometry: { type: "LineString", coordinates: [[79, 6]] } }),
      body(id, { geometry: { type: "Polygon", coordinates: [[[79, 6], [79.1, 6], [79.1, 6.1], [79.5, 6.5]]] } }),
      body(id, { geometry: { type: "Point", coordinates: [79, 6], extra: 1 } }),
      body(id, { plannedStart: "2026-11-10" }),
      body(id, { plannedStart: "2026-11-10T10:00:00" }),
      body(id, { plannedStart: "2026-11-13T00:00:00Z" }),
      body("not-an-id"),
    ];
    for (const payload of bad) expect((await post(d.officer.token, payload)).status).toBe(400);
    expect(await WorkRequest.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it("refuses CANCELLED and not-yet-approved projects with 409", async () => {
    const d = await world();
    expect((await post(d.officer.token, body(d.cancelled.id))).status).toBe(409);
    expect((await post(d.officer.token, body(d.draftProject.id))).status).toBe(409);
    expect(await WorkRequest.countDocuments({})).toBe(0);
  });

  it("rolls back the work request when the audit write fails", async () => {
    const d = await world();
    workRequestHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const res = await post(d.officer.token, body(d.approved.id));
    expect(res.status).toBe(503);
    expect(await WorkRequest.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it("validates list queries: unknown and repeated keys are 400, filters and bounds work", async () => {
    const d = await world();
    await post(d.officer.token, body(d.approved.id, { priority: "HIGH" }));
    expect((await get(d.officer.token, "?bogus=1")).status).toBe(400);
    expect((await get(d.officer.token, "?status=DRAFT&status=PLANNED")).status).toBe(400);
    expect((await get(d.officer.token, "?limit=500")).status).toBe(400);
    expect((await get(d.officer.token, "?agencyId=abc")).status).toBe(400);
    expect((await get(d.officer.token, "?priority=HIGH")).body.data.total).toBe(1);
    expect((await get(d.officer.token, "?priority=LOW")).body.data.total).toBe(0);
    expect((await get(d.officer.token, "/ffffffffffffffffffffffff")).status).toBe(404);
  });
  it("step 67: normalizes geometry on create and rejects out-of-country, swapped and self-crossing shapes", async () => {
    const d = await world();
    const open = { type: "Polygon", coordinates: [[[79.86, 6.93], [79.861, 6.93], [79.861, 6.931], [79.86, 6.931]]] };
    const res = await post(d.officer.token, body(d.approved.id, { geometry: open }));
    expect(res.status).toBe(201);
    const ring = res.body.data.workRequest.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const rejected = [
      { geometry: { type: "Point", coordinates: [77.2, 28.6] }, code: "OUTSIDE_SRI_LANKA" },
      { geometry: { type: "Point", coordinates: [6.93, 79.86] }, code: "COORDINATES_SWAPPED" },
      { geometry: { type: "Polygon", coordinates: [[[79.86, 6.93], [79.87, 6.94], [79.87, 6.93], [79.86, 6.94], [79.86, 6.93]]] }, code: "SELF_INTERSECTION" },
    ];
    for (const item of rejected) {
      const r = await post(d.officer.token, body(d.approved.id, { geometry: item.geometry }));
      expect(r.status).toBe(400);
      expect(r.body.error.details[0].code).toBe(item.code);
    }
    expect(await WorkRequest.countDocuments({})).toBe(1);
  });

  it("step 67: map endpoint uses the same scope, honours bbox and validates its query", async () => {
    const d = await world();
    await post(d.officer.token, body(d.approved.id));
    const map = await get(d.officer.token, "/map");
    expect(map.status).toBe(200);
    expect(map.body.data.type).toBe("FeatureCollection");
    expect(map.body.data.features).toHaveLength(1);
    expect(Object.keys(map.body.data.features[0].properties)).not.toContain("agencyId");
    expect((await get(d.foreign.token, "/map")).body.data.features).toHaveLength(0);
    expect((await get(d.officer.token, "/map?bbox=81,8,81.5,8.5")).body.data.features).toHaveLength(0);
    expect((await get(d.officer.token, "/map?bbox=79.8,6.9,79.9,7")).body.data.features).toHaveLength(1);
    expect((await get(d.officer.token, "/map?bbox=1,2,3")).status).toBe(400);
    expect((await get(d.citizen.token, "/map")).status).toBe(403);
  });

  it("step 67: geo validate returns candidates for collections and stores nothing", async () => {
    const d = await world();
    const validate = (token: string, geojson: unknown) =>
      request(app).post("/api/v1/roadsync/geo/validate").set("Authorization", `Bearer ${token}`).send({ geojson });
    const line = { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] };
    const one = await validate(d.officer.token, { type: "Feature", properties: {}, geometry: line });
    expect(one.body.data.valid).toBe(true);
    expect(one.body.data.derived.lengthMeters).toBeGreaterThan(1000);
    const many = await validate(d.officer.token, { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "A" }, geometry: line }, { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [79.86, 6.93] } }, { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [] } }] });
    expect(many.body.data.candidates).toHaveLength(2);
    expect(many.body.data.candidates[0].label).toBe("A");
    expect((await validate(d.officer.token, { type: "GeometryCollection", geometries: [] })).body.data.errors[0].code).toBe("UNSUPPORTED_TYPE");
    expect((await request(app).post("/api/v1/roadsync/geo/validate").set("Authorization", `Bearer ${d.officer.token}`).send({ geojson: line, extra: 1 })).status).toBe(400);
    expect((await validate(d.citizen.token, line)).status).toBe(403);
    expect((await request(app).post("/api/v1/roadsync/geo/validate").send({ geojson: line })).status).toBe(401);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });
});
