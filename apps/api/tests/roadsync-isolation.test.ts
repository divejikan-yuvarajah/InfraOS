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
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRecord, RoadsyncCounter } from "../src/modules/roadsync/models/conflict-record.model.js";
import { CoordinationRequest } from "../src/modules/roadsync/models/coordination.model.js";
import { Recommendation } from "../src/modules/roadsync/models/recommendation.model.js";
import { Amendment, LedgerEntry, Resolution } from "../src/modules/roadsync/models/resolution.model.js";
import { Scenario } from "../src/modules/roadsync/models/scenario.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { installWriteSpy } from "./helpers/write-spy.js";
import type { SystemRoleKey } from "@infraos/shared-types";

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

const TITLE_A = "SECRET-TITLE-AGENCY-A";
const TITLE_B = "SECRET-TITLE-AGENCY-B";

describe("steps 79-80 isolation: write-spy and redaction", { timeout: 240_000 }, () => {
  const app = createApp();
  const api = "/api/v1/roadsync";
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-iso-0123456789abcdef0123";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-iso-0123456789abcdef012";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, CoordinationRequest, Resolution, Amendment, LedgerEntry, Scenario, Recommendation, RoadsyncCounter, AuditLog]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [Recommendation, Scenario, LedgerEntry, Amendment, Resolution, CoordinationRequest, ConflictRecord, Candidate, WorkRequest, Project, Notification, RoadsyncCounter]) await m.deleteMany({});
    await AuditLog.collection.deleteMany({}); // the model blocks deleteMany (append-only); this is the disposable test DB
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (t: string, path: string) => request(app).get(`${api}${path}`).set(auth(t));

  async function ready() {
    await seedRoles();
    const [agA, agB] = await Promise.all(["A", "B"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa-iso@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob-iso@example.com", "AGENCY_OFFICER", agB!._id);
    const mk = (code: string, title: string, agencyId: unknown) => Project.create({ projectCode: code, title, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB] = await Promise.all([mk("INF-ISO-1", TITLE_A, agA!._id), mk("INF-ISO-2", TITLE_B, agB!._id)]);
    const mine = await WorkRequest.create({ agencyId: agA!._id, projectId: pA!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(15), plannedEnd: at(25) });
    const theirs = await WorkRequest.create({ agencyId: agB!._id, projectId: pB!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] }, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", isEmergency: true, plannedStart: at(17), plannedEnd: at(23) });
    await request(app).post(`${api}/work-requests/${mine.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    // Detection keeps writing notifications and ledger rows briefly; wait until quiet so the spy sees only the call under test.
    let last = "", stable = 0;
    for (let i = 0; i < 40 && stable < 4; i += 1) {
      const now = JSON.stringify([await Notification.countDocuments({}), await LedgerEntry.countDocuments({}), await Candidate.countDocuments({}), await AuditLog.countDocuments({}), await CoordinationRequest.countDocuments({})]);
      stable = now === last ? stable + 1 : 0; last = now;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { officerA, officerB, mine, theirs, cid: String(rec._id) };
  }
  const shiftAway = (d: { mine: { id: string } }) => ({ kind: "shift", requestId: d.mine.id, start: at(60).toISOString(), end: at(70).toISOString() });

  it("step 79: simulating writes nothing; saving a scenario writes only roadsync_scenarios (+ audit)", async () => {
    const d = await ready();
    const spy = installWriteSpy();
    try {
      const sim = await request(app).post(`${api}/conflicts/${d.cid}/simulate`).set(auth(d.officerA.token)).send({ levers: [shiftAway(d)] });
      expect(sim.status).toBe(200);
      expect(spy.operations()).toEqual({});
      const saved = await request(app).post(`${api}/conflicts/${d.cid}/scenarios`).set(auth(d.officerA.token)).send({ name: "Spy", visibility: "private", levers: [shiftAway(d)] });
      expect(saved.status).toBe(201);
      const allowed = new Set(["roadsync_scenarios", AuditLog.collection.name]);
      expect(spy.collections().filter((c) => !allowed.has(c))).toEqual([]);
      expect(spy.collections()).toContain("roadsync_scenarios");
      spy.reset();
      expect((await get(d.officerA.token, `/conflicts/${d.cid}/scenarios`)).status).toBe(200);
      expect(spy.operations()).toEqual({});
    } finally { spy.stop(); }
  });

  it("step 80: compute, feedback and handoff write only the recommendations collection (+ its counter and audit)", async () => {
    const d = await ready();
    const spy = installWriteSpy();
    const allowed = new Set(["roadsync_recommendations", RoadsyncCounter.collection.name, AuditLog.collection.name]);
    const outside = () => spy.collections().filter((c) => !allowed.has(c));
    try {
      const advice = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data;
      expect(spy.collections()).toContain("roadsync_recommendations");
      expect(outside()).toEqual([]);
      spy.reset();
      expect((await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data.cached).toBe(true);
      expect((await get(d.officerA.token, `/conflicts/${d.cid}/advisor/cached`)).status).toBe(200);
      expect(spy.operations()).toEqual({});
      const key = advice.plans[0].planKey as string;
      const fb = await request(app).post(`${api}/advisor/${advice.recNo}/feedback`).set(auth(d.officerA.token)).send({ planKey: key, action: "helpful" });
      expect(fb.status).toBe(200);
      expect(outside()).toEqual([]);
      spy.reset();
      for (const target of ["coordination", "resolution", "simulator"]) expect((await get(d.officerA.token, `/advisor/${advice.recNo}/plans/${key}/handoff?target=${target}`)).status).toBe(200);
      expect(outside()).toEqual([]);
      spy.reset();
      expect((await get(d.officerA.token, `/conflicts/${d.cid}/advisor?refresh=true`)).status).toBe(200);
      expect(outside()).toEqual([]);
    } finally { spy.stop(); }
  });

  it("redacts the other agency's private data from simulator, advisor, handoff and scenario output", async () => {
    const d = await ready();
    const advice = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data;
    const key = advice.plans[0].planKey as string;
    const theirLever = { kind: "shift", requestId: d.theirs.id, start: at(60).toISOString(), end: at(70).toISOString() };
    const outputs = [
      JSON.stringify(advice),
      JSON.stringify((await request(app).post(`${api}/conflicts/${d.cid}/simulate`).set(auth(d.officerA.token)).send({ levers: [theirLever] })).body),
      JSON.stringify((await request(app).post(`${api}/conflicts/${d.cid}/scenarios`).set(auth(d.officerA.token)).send({ name: "Red", visibility: "agency", levers: [shiftAway(d)] })).body),
      JSON.stringify((await get(d.officerA.token, `/conflicts/${d.cid}/scenarios`)).body),
      ...(await Promise.all(["coordination", "resolution", "simulator"].map(async (t) => JSON.stringify((await get(d.officerA.token, `/advisor/${advice.recNo}/plans/${key}/handoff?target=${t}`)).body)))),
    ];
    for (const out of outputs) {
      expect(out).not.toContain(TITLE_B);
      expect(out).not.toContain("CRITICAL");
      expect(out).not.toContain("isEmergency");
      expect(out).not.toContain("INF-ISO-2");
    }
    const other = JSON.stringify((await get(d.officerB.token, `/conflicts/${d.cid}/advisor`)).body);
    expect(other).not.toContain(TITLE_A);
    expect(other).not.toContain("INF-ISO-1");
  });
});
