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
import { bboxQuerySchema, isOverdueWork, LAYER_FEATURE_CAP, layerCollection, transportGeometry } from "../src/modules/inframap/inframap.geo.js";
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const parse = (bbox: unknown) => bboxQuerySchema.safeParse(bbox === undefined ? {} : { bbox });

describe("steps 81-84 bbox and geometry transport (pure)", () => {
  it("accepts one ordered, finite, bounded box and rejects everything else", () => {
    expect(parse("79.5,5.8,82,10")).toMatchObject({ success: true, data: { bbox: [79.5, 5.8, 82, 10] } });
    for (const bad of [undefined, "", "1,2,3", "1,2,3,4,5", "a,b,c,d", "79,6,78,7", "79,7,80,6", "NaN,1,2,3", "79,6,80,", "-181,0,0,1", "0,-91,1,0", "0,0,181,1", "0,0,11,1", "0,0,1,11", "0,0,100,5"]) {
      expect(parse(bad).success, String(bad)).toBe(false);
    }
    expect(bboxQuerySchema.safeParse({ bbox: "79,6,80,7", extra: "1" }).success).toBe(false);
  });

  it("rounds coordinates, drops invalid geometry and flags truncation at the layer cap", () => {
    expect(transportGeometry({ type: "Point", coordinates: [79.8612345678, 6.9271234567] })).toEqual({ type: "Point", coordinates: [79.861235, 6.927123] });
    for (const bad of [null, undefined, {}, { type: "Point", coordinates: [200, 0] }, { type: "LineString", coordinates: [[79, 6]] }, { type: "Circle", coordinates: [1, 2] }, "x"]) expect(transportGeometry(bad), String(bad)).toBeNull();
    const good = { type: "Point", coordinates: [79.86, 6.93] };
    const mixed = layerCollection([{ geometry: good, properties: { id: "a" } }, { geometry: { type: "Point", coordinates: ["x", 1] }, properties: { id: "b" } }], false);
    expect(mixed.features.map((f) => f.properties.id)).toEqual(["a"]);
    const many = layerCollection(Array.from({ length: LAYER_FEATURE_CAP + 1 }, (_, i) => ({ geometry: good, properties: { id: String(i) } })), false);
    expect(many.features).toHaveLength(LAYER_FEATURE_CAP);
    expect(many.truncated).toBe(true);
    expect(layerCollection([{ geometry: good, properties: {} }], false).truncated).toBe(false);
    expect(layerCollection([], true).truncated).toBe(true);
  });
});

async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) await Role.create({ key, name: SYSTEM_ROLE_META[key].name, description: SYSTEM_ROLE_META[key].description, permissions: [...SYSTEM_ROLE_PERMISSIONS[key]], scopeType: SYSTEM_ROLE_META[key].scopeType, isSystem: true, isActive: true });
}
async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const r = await Role.findOne({ key: role });
  const user = await User.create({ firstName: "Nimal", lastName: "Perera", email, passwordHash: await hash("correct-horse-battery", 4), roleId: r!._id, agencyId, status: "ACTIVE", emailVerified: true, credentialEpoch: 1 });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}
const waitFor = async (check: () => Promise<boolean>) => { for (let i = 0; i < 150 && !(await check()); i += 1) await new Promise((r) => setTimeout(r, 100)); };
const at = (n: number) => new Date(`${new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)}T04:00:00.000Z`);

const TITLE_A = "INFRAMAP-TITLE-AGENCY-A";
const TITLE_B = "INFRAMAP-TITLE-AGENCY-B";
const TITLE_C = "INFRAMAP-TITLE-AGENCY-C";
const HERE = "79.8,6.9,79.95,6.97";
const FAR = "80.5,7.5,80.7,7.7";

describe("steps 81-84 InfraMap layers", { timeout: 240_000 }, () => {
  const app = createApp();
  const api = "/api/v1/inframap";
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-inframap-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-inframap-0123456789abcde";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [ConflictRecord, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (t: string | null, layer: string, query = `bbox=${HERE}`) => { const r = request(app).get(`${api}/${layer}?${query}`); return t ? r.set(auth(t)) : r; };
  const ids = (res: { body: { data: { features: { properties: { id: string } }[] } } }) => res.body.data.features.map((f) => f.properties.id).sort();

  async function ready() {
    await seedRoles();
    const [agA, agB, agC] = await Promise.all(["A", "B", "C"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa-im@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob-im@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc-im@example.com", "AGENCY_OFFICER", agC!._id);
    const superUser = await actor("su-im@example.com", "SUPER_ADMIN", agA!._id);
    const citizen = await actor("ci-im@example.com", "CITIZEN", agA!._id);
    const contractor = await actor("co-im@example.com", "CONTRACTOR", agA!._id);
    const mk = (code: string, title: string, agencyId: unknown, geometry?: unknown) => Project.create({ projectCode: code, title, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 55, financialProgress: 10, createdBy: officerA.user._id, ...(geometry ? { geometry } : {}) });
    const pA = await mk("INF-IM-1", TITLE_A, agA!._id, { type: "LineString", coordinates: [[79.85, 6.92], [79.88, 6.94]] });
    const pB = await mk("INF-IM-2", TITLE_B, agB!._id, { type: "Point", coordinates: [79.866, 6.931] });
    const pC = await mk("INF-IM-3", TITLE_C, agC!._id, { type: "Point", coordinates: [79.9, 6.95] });
    const pNone = await mk("INF-IM-4", "INFRAMAP-NO-GEOMETRY", agA!._id);
    const mine = await WorkRequest.create({ agencyId: agA!._id, projectId: pA.id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(15), plannedEnd: at(25) });
    const theirs = await WorkRequest.create({ agencyId: agB!._id, projectId: pB.id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] }, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", plannedStart: at(17), plannedEnd: at(23) });
    await request(app).post(`/api/v1/roadsync/work-requests/${mine.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    // Detection keeps writing briefly; wait until quiet so the assertions read settled data.
    let last = "", stable = 0;
    for (let i = 0; i < 40 && stable < 4; i += 1) {
      const now = JSON.stringify([await Notification.countDocuments({}), await Candidate.countDocuments({})]);
      stable = now === last ? stable + 1 : 0; last = now;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { officerA, officerB, officerC, superUser, citizen, contractor, pA, pB, pC, pNone, mine, theirs, cid: String(rec._id) };
  }

  it("requires a session and the layer's read permission", async () => {
    const d = await ready();
    for (const layer of ["projects", "roadworks", "conflicts"]) {
      expect((await get(null, layer)).status, `${layer} anonymous`).toBe(401);
      expect((await get(d.citizen.token, layer)).status, `${layer} citizen`).toBe(403);
    }
    expect((await get(d.contractor.token, "projects")).status).toBe(403);
    expect((await get(d.contractor.token, "conflicts")).status).toBe(403);
    const ok = await get(d.officerA.token, "projects");
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toContain("no-store");
  });

  it("scopes every layer to the caller's agency, with national seeing all", async () => {
    const d = await ready();
    expect(ids(await get(d.officerA.token, "projects"))).toEqual([d.pA.id]);
    expect(ids(await get(d.officerB.token, "projects"))).toEqual([d.pB.id]);
    expect(ids(await get(d.officerC.token, "projects"))).toEqual([d.pC.id]);
    expect(ids(await get(d.superUser.token, "projects"))).toEqual([d.pA.id, d.pB.id, d.pC.id].sort());
    expect(ids(await get(d.officerA.token, "roadworks"))).toEqual([d.mine.id]);
    expect(ids(await get(d.officerB.token, "roadworks"))).toEqual([d.theirs.id]);
    expect(ids(await get(d.officerC.token, "roadworks"))).toEqual([]);
    expect(ids(await get(d.officerA.token, "conflicts"))).toEqual([d.cid]);
    expect(ids(await get(d.officerB.token, "conflicts"))).toEqual([d.cid]);
    expect(ids(await get(d.officerC.token, "conflicts"))).toEqual([]);
    expect(ids(await get(d.superUser.token, "conflicts"))).toEqual([d.cid]);
  });

  it("never returns another agency's private fields, finance or progress", async () => {
    const d = await ready();
    const everything = JSON.stringify([
      (await get(d.officerA.token, "projects")).body, (await get(d.officerA.token, "roadworks")).body, (await get(d.officerA.token, "conflicts")).body,
    ]);
    for (const secret of [TITLE_B, TITLE_C, "INF-IM-2", "INF-IM-3", "CRITICAL", "ELECTRIC_CABLE_WORK", "INFRAMAP-NO-GEOMETRY"]) expect(everything, secret).not.toContain(secret);
    for (const key of ["budget", "amountMinor", "physicalProgress", "financialProgress", "managerId", "description", "notes", "sides", "affectedAgencies"]) expect(everything, key).not.toContain(key);
    const conflict = (await get(d.officerB.token, "conflicts")).body.data.features[0];
    expect(Object.keys(conflict.properties).sort()).toEqual(["band", "conflictNo", "district", "id", "overlapEnd", "overlapStart", "resolutionState", "score", "status"]);
    expect(conflict.geometry.type).toBe("Point");
    const project = (await get(d.officerA.token, "projects")).body.data.features[0];
    expect(Object.keys(project.properties).sort()).toEqual(["agencyName", "district", "geometryType", "id", "isDelayed", "plannedEndDate", "projectCode", "projectType", "province", "startDate", "status", "title"]);
  });

  it("returns only what intersects the viewport and omits projects without a geometry", async () => {
    const d = await ready();
    for (const layer of ["projects", "roadworks", "conflicts"]) {
      const far = await get(d.superUser.token, layer, `bbox=${FAR}`);
      expect(far.status).toBe(200);
      expect(far.body.data).toMatchObject({ type: "FeatureCollection", truncated: false, features: [] });
    }
    const narrow = await get(d.superUser.token, "projects", "bbox=79.895,6.945,79.905,6.955");
    expect(ids(narrow)).toEqual([d.pC.id]);
    expect(ids(await get(d.superUser.token, "projects"))).not.toContain(d.pNone.id);
  });

  it("reports layer availability and the in-scope projects that have no map location", async () => {
    const d = await ready();
    expect((await request(app).get(`${api}/layers`)).status).toBe(401);
    expect((await request(app).get(`${api}/layers`).set(auth(d.citizen.token))).status).toBe(403);
    expect((await request(app).get(`${api}/layers?x=1`).set(auth(d.officerA.token))).status).toBe(400);
    const a = await request(app).get(`${api}/layers`).set(auth(d.officerA.token));
    expect(a.status).toBe(200);
    expect(a.headers["cache-control"]).toContain("no-store");
    expect(a.body.data.layers.map((l: { id: string }) => l.id)).toEqual(["projects", "roadworks", "conflicts", "assets", "utilities", "risks"]);
    expect(a.body.data.layers.every((l: { available: boolean }) => l.available)).toBe(true);
    expect(a.body.data.projectsWithoutLocation.total).toBe(1);
    expect(a.body.data.projectsWithoutLocation.items).toEqual([{ id: d.pNone.id, projectCode: "INF-IM-4", title: "INFRAMAP-NO-GEOMETRY" }]);
    const b = await request(app).get(`${api}/layers`).set(auth(d.officerB.token));
    expect(JSON.stringify(b.body)).not.toContain("INFRAMAP-NO-GEOMETRY");
    expect(b.body.data.projectsWithoutLocation.total).toBe(0);
  });

  it("applies closed-enum filters on the server and derives overdue from the planned end", async () => {
    const d = await ready();
    expect(ids(await get(d.superUser.token, "projects", `bbox=${HERE}&status=ACTIVE`))).toEqual([]);
    expect(ids(await get(d.superUser.token, "projects", `bbox=${HERE}&status=APPROVED&projectType=ROAD`))).toEqual([d.pA.id, d.pB.id, d.pC.id].sort());
    expect(ids(await get(d.superUser.token, "conflicts", `bbox=${HERE}&group=closed`))).toEqual([]);
    expect(ids(await get(d.superUser.token, "conflicts", `bbox=${HERE}&group=open`))).toEqual([d.cid]);
    for (const query of [`bbox=${HERE}&status=NOPE`, `bbox=${HERE}&overdue=yes`, `bbox=${HERE}&band=severe`]) {
      for (const layer of ["projects", "roadworks", "conflicts"]) expect((await get(d.superUser.token, layer, query)).status, `${layer}?${query}`).toBe(400);
    }
    expect(isOverdueWork("SUBMITTED", at(-1))).toBe(true);
    expect(isOverdueWork("SUBMITTED", at(3))).toBe(false);
    expect(isOverdueWork("COMPLETED", at(-5))).toBe(false);
    expect(isOverdueWork("CANCELLED", at(-5))).toBe(false);
    expect(isOverdueWork("ACTIVE", null)).toBe(false);
    const works = (await get(d.officerA.token, "roadworks")).body.data.features[0].properties;
    expect(works).toMatchObject({ isOverdue: false, displayStatus: "SUBMITTED" });
    await WorkRequest.updateOne({ _id: d.mine._id }, { $set: { plannedEnd: at(-2) } });
    expect((await get(d.officerA.token, "roadworks")).body.data.features[0].properties).toMatchObject({ isOverdue: true, displayStatus: "overdue" });
    expect(ids(await get(d.officerA.token, "roadworks", `bbox=${HERE}&overdue=1`))).toEqual([d.mine.id]);
  });

  it("rejects malformed, repeated, oversized or unknown query input before touching data", async () => {
    const d = await ready();
    for (const layer of ["projects", "roadworks", "conflicts"]) {
      for (const query of ["", "bbox=", "bbox=1,2,3", "bbox=a,b,c,d", "bbox=79,7,78,6", "bbox=0,0,50,50", `bbox=${HERE}&bbox=${FAR}`, `bbox=${HERE}&limit=5`, `bbox[$ne]=1`, `bbox=${HERE}&status[$ne]=x`]) {
        expect((await get(d.officerA.token, layer, query)).status, `${layer}?${query}`).toBe(400);
      }
    }
  });
});
