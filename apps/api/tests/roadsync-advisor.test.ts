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
import { CoordinationRequest } from "../src/modules/roadsync/models/coordination.model.js";
import { Recommendation } from "../src/modules/roadsync/models/recommendation.model.js";
import { Amendment, LedgerEntry, Resolution } from "../src/modules/roadsync/models/resolution.model.js";
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

describe("step 80 coordination advisor", { timeout: 240_000 }, () => {
  const app = createApp();
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step80-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step80-0123456789abcdef";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, CoordinationRequest, Resolution, Amendment, LedgerEntry, Scenario, Recommendation]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [Recommendation, Scenario, LedgerEntry, Amendment, Resolution, CoordinationRequest, ConflictRecord, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = "/api/v1/roadsync";
  async function ready() {
    await seedRoles();
    const [agA, agB, agC] = await Promise.all(["A", "B", "C"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa80@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob80@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc80@example.com", "AGENCY_OFFICER", agC!._id);
    const superUser = await actor("su80@example.com", "SUPER_ADMIN", agA!._id);
    const citizen = await actor("ci80@example.com", "CITIZEN", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `T ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB] = await Promise.all([mk("INF-AS-81", agA!._id), mk("INF-AS-82", agB!._id)]);
    const mine = await WorkRequest.create({ agencyId: agA!._id, projectId: pA!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(15), plannedEnd: at(25) });
    const theirs = await WorkRequest.create({ agencyId: agB!._id, projectId: pB!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] }, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", plannedStart: at(17), plannedEnd: at(23) });
    await request(app).post(`${api}/work-requests/${mine.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    // The detection pipeline keeps writing (notifications, ledger) for a moment; wait until it is quiet so isolation checks measure only the advisor.
    let last = "", stable = 0;
    for (let i = 0; i < 40 && stable < 4; i += 1) {
      const now = JSON.stringify([await Notification.countDocuments({}), await LedgerEntry.countDocuments({}), await Candidate.countDocuments({}), await CoordinationRequest.countDocuments({})]);
      stable = now === last ? stable + 1 : 0; last = now;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { agA: agA!, officerA, officerB, officerC, superUser, citizen, mine, theirs, cid: String(rec._id) };
  }
  const get = (t: string | null, path: string) => { const r = request(app).get(`${api}${path}`); return t ? r.set(auth(t)) : r; };

  it("is deterministic, cached per audience, and every plan's after-state equals a fresh simulation", async () => {
    const d = await ready();
    const first = await get(d.officerA.token, `/conflicts/${d.cid}/advisor`);
    expect(first.status).toBe(200);
    const advice = first.body.data;
    expect(advice.plans.length).toBeGreaterThan(0);
    expect(advice.plans.length).toBeLessThanOrEqual(5);
    expect(advice.audience).toBe("agency");
    // The cached-only summary reports the viewer's own snapshot and never computes one for anybody else.
    const cachedA = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor/cached`)).body.data;
    expect(cachedA).toMatchObject({ available: true, recNo: advice.recNo, count: advice.plans.length });
    expect((await get(d.officerB.token, `/conflicts/${d.cid}/advisor/cached`)).body.data.available).toBe(false);
    expect(await Recommendation.countDocuments({})).toBe(1);
    expect((await get(d.officerC.token, `/conflicts/${d.cid}/advisor/cached`)).status).toBe(404);
    expect(advice.plans.every((p: { metrics: { collateralOther: number } }) => typeof p.metrics.collateralOther === "number")).toBe(true);
    const second = await get(d.officerA.token, `/conflicts/${d.cid}/advisor`);
    expect(second.body.data.cached).toBe(true);
    expect(second.body.data.recNo).toBe(advice.recNo);
    const forced = await get(d.officerA.token, `/conflicts/${d.cid}/advisor?refresh=true`);
    expect(forced.body.data.plans.map((p: { planKey: string }) => p.planKey)).toEqual(advice.plans.map((p: { planKey: string }) => p.planKey));
    for (const p of advice.plans) {
      const sim = await request(app).post(`${api}/conflicts/${d.cid}/simulate`).set(auth(d.officerA.token)).send({ levers: p.levers });
      expect(sim.body.data.result.request.after).toEqual(p.afterSummary);
      expect(p.levers.every((l: { kind: string }) => ["shift", "hours", "buffer"].includes(l.kind))).toBe(true);
      expect(Object.values(p.components).length).toBe(7);
    }
  });

  it("marks other agencies' moves as proposals for agency users, never for national, and separates audiences", async () => {
    const d = await ready();
    const a = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data;
    const n = (await get(d.superUser.token, `/conflicts/${d.cid}/advisor`)).body.data;
    const moves = (x: { plans: { moves: { requestId: string; propose: boolean }[] }[] }) => x.plans.flatMap((p) => p.moves);
    expect(moves(a).filter((m) => m.requestId === d.theirs.id).every((m) => m.propose)).toBe(true);
    expect(moves(a).filter((m) => m.requestId === d.mine.id).every((m) => !m.propose)).toBe(true);
    expect(moves(n).every((m) => !m.propose)).toBe(true);
    expect(n.audience).toBe("national");
    expect(n.recNo).not.toBe(a.recNo);
    expect((await get(d.officerC.token, `/conflicts/${d.cid}/advisor`)).status).toBe(404);
    expect((await get(d.citizen.token, `/conflicts/${d.cid}/advisor`)).status).toBe(403);
    expect((await get(null, `/conflicts/${d.cid}/advisor`)).status).toBe(401);
    expect((await get(d.officerA.token, `/conflicts/${d.cid}/advisor?bogus=1`)).status).toBe(400);
  });

  it("suppresses a dismissed plan per agency, restores it, and records feedback without free text", async () => {
    const d = await ready();
    const a = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data;
    const key = a.plans[0].planKey as string;
    const fb = (t: string, body: unknown) => request(app).post(`${api}/advisor/${a.recNo}/feedback`).set(auth(t)).send(body);
    expect((await fb(d.officerA.token, { planKey: key, action: "dismissed" })).status).toBe(400);
    expect((await fb(d.officerA.token, { planKey: key, action: "dismissed", reasonCode: "too_disruptive" })).status).toBe(200);
    const after = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data;
    expect(after.plans.map((p: { planKey: string }) => p.planKey)).not.toContain(key);
    expect(after.dismissed.map((x: { planKey: string }) => x.planKey)).toEqual([key]);
    const b = (await get(d.officerB.token, `/conflicts/${d.cid}/advisor`)).body.data;
    expect(b.plans.length).toBeGreaterThan(0);
    expect((await fb(d.officerB.token, { planKey: key, action: "helpful" })).status).toBe(404);
    expect((await fb(d.officerA.token, { planKey: key, action: "restored" })).status).toBe(200);
    expect((await get(d.officerA.token, `/conflicts/${d.cid}/advisor`)).body.data.plans.map((p: { planKey: string }) => p.planKey)).toContain(key);
    expect((await fb(d.officerA.token, { planKey: key, action: "helpful", note: "free text" })).status).toBe(400);
  });

  it("hands off prefills for the existing forms, creates nothing, and leaves every other collection untouched", async () => {
    const d = await ready();
    const before = async () => ({ c: await CoordinationRequest.countDocuments({}), r: await Resolution.countDocuments({}), s: await Scenario.countDocuments({}), n: await Notification.countDocuments({}), l: await LedgerEntry.countDocuments({}), w: JSON.stringify(await WorkRequest.find({}).select("updatedAt __v").lean()), k: JSON.stringify(await ConflictRecord.find({}).select("version updatedAt").lean()), p: await Candidate.countDocuments({}) });
    const snap = await before();
    const a = (await get(d.officerA.token, `/conflicts/${d.cid}/advisor?refresh=true`)).body.data;
    const plan = a.plans.find((p: { moves: { mine: boolean }[] }) => p.moves.some((m) => m.mine)) ?? a.plans[0];
    const h = (target: string) => get(d.officerA.token, `/advisor/${a.recNo}/plans/${plan.planKey}/handoff?target=${target}`);
    const coord = (await h("coordination")).body.data;
    expect(coord.drafts.length + coord.notEligible.length).toBe(plan.moves.length);
    expect(coord.drafts.every((x: { type: string }) => ["schedule_shift", "working_hours", "sequence_order"].includes(x.type))).toBe(true);
    const res = (await h("resolution")).body.data;
    expect(res.drafts.every((x: { manual: { targetRequestId: string } }) => x.manual.targetRequestId === d.mine.id)).toBe(true);
    expect((await h("simulator")).body.data.levers).toEqual(plan.levers);
    expect((await h("bogus")).status).toBe(400);
    expect((await get(d.officerC.token, `/advisor/${a.recNo}/plans/${plan.planKey}/handoff?target=simulator`)).status).toBe(404);
    expect(await before()).toEqual(snap);
    const doc = await Recommendation.findOne({ recNo: a.recNo }).lean();
    expect((doc!.feedback as { action: string }[]).filter((f) => f.action === "handoff_used").length).toBe(3);
  });

  it("previews wizard schedule windows without persisting, and keeps stats national-only", async () => {
    const d = await ready();
    const body = { geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, schedule: { plannedStart: at(15).toISOString(), plannedEnd: at(25).toISOString(), workingHours: "day", flexibleDays: 7, isEmergency: false }, subject: { workType: "PIPELINE_INSTALLATION" } };
    const wr = await WorkRequest.countDocuments({});
    const out = await request(app).post(`${api}/advisor/schedule-preview`).set(auth(d.officerA.token)).send(body);
    expect(out.status).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    expect(out.body.data.windows.every((w: { from: string }) => w.from >= today)).toBe(true);
    expect(JSON.stringify(out.body.data)).not.toMatch(/priority|flexib.*Days"\s*:\s*[1-9]|isEmergency|description|contact/);
    expect(await WorkRequest.countDocuments({})).toBe(wr);
    expect((await request(app).post(`${api}/advisor/schedule-preview`).set(auth(d.officerA.token)).send({ ...body, geometry: { type: "Point" } })).status).toBe(400);
    expect((await get(d.officerA.token, "/advisor/stats")).status).toBe(404);
    const st = await get(d.superUser.token, "/advisor/stats");
    expect(st.status).toBe(200);
    expect(st.body.data.suppressed).toBe(true);
  });
});
