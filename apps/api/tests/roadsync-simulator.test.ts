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
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { Scenario } from "../src/modules/roadsync/models/scenario.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
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

describe("step 79 conflict simulator", { timeout: 240_000 }, () => {
  const app = createApp();
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step79-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step79-0123456789abcdef";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, Scenario]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [Scenario, ConflictRecord, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  async function ready() {
    await seedRoles();
    const [agA, agB, agC] = await Promise.all(["A", "B", "C"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa79@example.com", "AGENCY_OFFICER", agA!._id);
    const officerA2 = await actor("oa279@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob79@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc79@example.com", "AGENCY_OFFICER", agC!._id);
    const superUser = await actor("su79@example.com", "SUPER_ADMIN", agA!._id);
    const citizen = await actor("ci79@example.com", "CITIZEN", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `T ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB] = await Promise.all([mk("INF-AS-91", agA!._id), mk("INF-AS-92", agB!._id)]);
    const mine = await WorkRequest.create({ agencyId: agA!._id, projectId: pA!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(10), plannedEnd: at(20) });
    const theirs = await WorkRequest.create({ agencyId: agB!._id, projectId: pB!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] }, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", plannedStart: at(12), plannedEnd: at(18) });
    await request(app).post(`/api/v1/roadsync/work-requests/${mine.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    return { officerA, officerA2, officerB, officerC, superUser, citizen, mine, theirs, cid: String(rec._id) };
  }
  const sim = (token: string | null, cid: string, levers: unknown[]) => {
    const r = request(app).post(`/api/v1/roadsync/conflicts/${cid}/simulate`);
    return (token ? r.set(auth(token)) : r).send({ levers });
  };
  const shiftAway = (d: { mine: { id: string } }) => ({ kind: "shift", requestId: d.mine.id, start: at(60).toISOString(), end: at(70).toISOString() });

  it("clears the pair when an own request moves away and returns scores, bands and counts only", async () => {
    const d = await ready();
    const out = await sim(d.officerA.token, d.cid, [shiftAway(d)]);
    expect(out.status).toBe(200);
    expect(out.body.data.result.verdict).toBe("clears");
    expect(out.body.data.result.pair.before.kind).toBe("conflict");
    expect(out.body.data.result.actionable).toBe(true);
    expect(Object.keys(out.body.data.result).sort()).toEqual(["actionable", "commitments", "coverageNote", "ghost", "levers", "pair", "request", "thirdParty", "verdict", "warnings"]);
    const cancel = await sim(d.officerA.token, d.cid, [{ kind: "cancel", requestId: d.mine.id }]);
    expect(cancel.body.data.result.verdict).toBe("clears");
    const traffic = await sim(d.officerA.token, d.cid, [{ kind: "traffic", requestId: d.mine.id, measures: ["flaggers"] }]);
    expect(traffic.body.data.result.verdict).toBe("none");
    expect(traffic.body.data.result.warnings).toContain("traffic_no_score_effect");
  });

  it("flags another agency's request as an assumption for agency users but not for national", async () => {
    const d = await ready();
    const lever = { kind: "shift", requestId: d.theirs.id, start: at(60).toISOString(), end: at(70).toISOString() };
    const a = await sim(d.officerA.token, d.cid, [lever]);
    expect(a.body.data.result.levers[0].assumption).toBe(true);
    expect(a.body.data.result.actionable).toBe(false);
    const n = await sim(d.superUser.token, d.cid, [lever]);
    expect(n.body.data.result.levers[0].assumption).toBe(false);
    expect(n.body.data.result.actionable).toBe(true);
  });

  it("rejects fixed fields, bad dates and unrelated callers at the API", async () => {
    const d = await ready();
    expect((await sim(d.officerA.token, d.cid, [{ ...shiftAway(d), geometry: { type: "Point" } }])).status).toBe(400);
    expect((await sim(d.officerA.token, d.cid, [{ kind: "priority", requestId: d.mine.id }])).status).toBe(400);
    expect((await sim(d.officerA.token, d.cid, [{ kind: "shift", requestId: d.mine.id, start: at(30).toISOString(), end: at(20).toISOString() }])).status).toBe(400);
    expect((await sim(d.officerA.token, d.cid, [{ kind: "cancel", requestId: "0".repeat(24) }])).status).toBe(400);
    expect((await sim(null, d.cid, [])).status).toBe(401);
    expect((await sim(d.citizen.token, d.cid, [])).status).toBe(403);
    expect((await sim(d.officerC.token, d.cid, [])).status).toBe(404);
  });

  it("saves recomputed snapshots with private, agency and national visibility and no cross-agency sharing", async () => {
    const d = await ready();
    const save = (token: string, visibility: string, name = "Move away") => request(app).post(`/api/v1/roadsync/conflicts/${d.cid}/scenarios`).set(auth(token)).send({ name, visibility, levers: [shiftAway(d)] });
    const priv = await save(d.officerA.token, "private", "Private");
    const agency = await save(d.officerA.token, "agency", "Agency");
    const nat = await save(d.officerA.token, "national", "National");
    expect([priv.status, agency.status, nat.status]).toEqual([201, 201, 201]);
    const names = async (t: string) => ((await request(app).get(`/api/v1/roadsync/conflicts/${d.cid}/scenarios`).set(auth(t))).body.data.items as { name: string }[]).map((x) => x.name).sort();
    expect(await names(d.officerA.token)).toEqual(["Agency", "National", "Private"]);
    expect(await names(d.officerA2.token)).toEqual(["Agency"]);
    expect(await names(d.officerB.token)).toEqual([]);
    expect(await names(d.superUser.token)).toEqual(["National"]);
    expect((await request(app).get(`/api/v1/roadsync/conflicts/${d.cid}/scenarios`).set(auth(d.officerC.token))).status).toBe(404);
    expect((await save(d.officerA.token, "public")).status).toBe(400);
    expect((await request(app).delete(`/api/v1/roadsync/scenarios/${priv.body.data.id}`).set(auth(d.officerA2.token))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/roadsync/scenarios/${priv.body.data.id}`).set(auth(d.officerA.token))).status).toBe(200);
  });
});
