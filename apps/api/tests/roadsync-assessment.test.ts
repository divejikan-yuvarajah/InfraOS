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
import { riskIndexOf } from "../src/modules/roadsync/assessment.engine.js";
import { runAssessment } from "../src/modules/roadsync/assessment.service.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { roadsyncEvents } from "../src/modules/roadsync/roadsync.events.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const app = createApp();

async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) {
    await Role.create({
      key, name: SYSTEM_ROLE_META[key].name, description: SYSTEM_ROLE_META[key].description,
      permissions: [...SYSTEM_ROLE_PERMISSIONS[key]], scopeType: SYSTEM_ROLE_META[key].scopeType, isSystem: true, isActive: true,
    });
  }
}
async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({ firstName: "Nimal", lastName: "Perera", email, passwordHash: await hash("correct-horse-battery", 4), roleId: roleDoc._id, agencyId, status: "ACTIVE", emailVerified: true, credentialEpoch: 1 });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}
const waitFor = async (check: () => Promise<boolean>) => {
  for (let i = 0; i < 80 && !(await check()); i += 1) await new Promise((r) => setTimeout(r, 100));
};

/** Dates are relative to now so the "start is not in the past" what-if rule behaves the same on any run date. */
const at = (offsetDays: number) => new Date(`${new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)}T04:00:00.000Z`);

describe("steps 70-71 roadsync assessment", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step70-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step70-0123456789abcdef";
    await startIsolatedMongo();
    await WorkRequest.init();
    await Candidate.init();
    await Project.init();
  }, 300_000);
  afterEach(async () => {
    await Candidate.deleteMany({});
    await WorkRequest.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });
  afterAll(async () => {
    await stopIsolatedMongo();
  });

  const lineA = { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] };
  const crossing = { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] };

  async function world() {
    await seedRoles();
    const agencyA = await Agency.create({ code: "DEPT_WEST", name: "Western Roads", type: "DEPARTMENT", status: "ACTIVE" });
    const agencyB = await Agency.create({ code: "MIN_WATER", name: "Water Board", type: "MINISTRY", status: "ACTIVE" });
    const officerA = await actor("oa70@example.com", "AGENCY_OFFICER", agencyA._id);
    const officerB = await actor("ob70@example.com", "AGENCY_OFFICER", agencyB._id);
    const superUser = await actor("su70@example.com", "SUPER_ADMIN", agencyA._id);
    const contractor = await actor("co70@example.com", "CONTRACTOR", agencyA._id);
    const mk = (code: string, agencyId: unknown) =>
      Project.create({ projectCode: code, title: `Title ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const projA = await mk("INF-AS-10", agencyA._id);
    const projB = await mk("INF-AS-11", agencyB._id);
    const wr = (agencyId: unknown, projectId: unknown, status: string, geometry: unknown, workType: string, start: number, end: number, priority = "NORMAL") =>
      WorkRequest.create({ agencyId, projectId, status, geometry, workType, priority, plannedStart: at(start), plannedEnd: at(end) });
    // Subject: water pipe laying days +30..+40. Cable crossing +32..+38: 30 + 3 + 25 + 20 = 78, lifted to 80 by floor F1.
    // Same-line pipe +35..+45 at CRITICAL priority is a joint-works opportunity whose priority must stay private.
    const subject = await wr(agencyA._id, projA._id, "SUBMITTED", lineA, "PIPELINE_INSTALLATION", 30, 40);
    const cable = await wr(agencyB._id, projB._id, "SUBMITTED", crossing, "ELECTRIC_CABLE_WORK", 32, 38);
    const joint = await wr(agencyB._id, projB._id, "SUBMITTED", lineA, "PIPELINE_INSTALLATION", 35, 45, "CRITICAL");
    const draft = await wr(agencyB._id, projB._id, "DRAFT", crossing, "ELECTRIC_CABLE_WORK", 32, 38);
    await wr(agencyB._id, projB._id, "CANCELLED", crossing, "ELECTRIC_CABLE_WORK", 32, 38);
    const draftA = await wr(agencyA._id, projA._id, "DRAFT", lineA, "PIPELINE_INSTALLATION", 30, 40);
    return { officerA, officerB, superUser, contractor, subject, cable, joint, draft, draftA };
  }
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const detect = (token: string, id: string) => request(app).post(`/api/v1/roadsync/work-requests/${id}/detection/run`).set(auth(token)).send();
  const assess = (token: string, id: string, qs = "") => request(app).get(`/api/v1/roadsync/work-requests/${id}/assessment${qs}`).set(auth(token));
  const assessed = async (id: string) => {
    await waitFor(async () => (await WorkRequest.findById(id).lean())?.assessment?.status === "completed");
  };
  async function ready() {
    const d = await world();
    await detect(d.officerA.token, d.subject.id);
    await assessed(d.subject.id);
    return d;
  }

  it("assesses stored pairs on both requests with one symmetric result and the correct aggregates", async () => {
    const d = await ready();
    const mine = await assess(d.officerA.token, d.subject.id);
    expect(mine.status).toBe(200);
    expect(mine.body.data.summary.counts).toMatchObject({ conflicts: 1, opportunities: 1 });
    const item = mine.body.data.items[0];
    expect(item.other.id).toBe(d.cable.id);
    expect(item.assessment).toMatchObject({ kind: "conflict", primaryClass: "utility_strike_risk", floorApplied: { code: "F1", min: 80 } });
    expect(item.assessment.effective.band).toBe("critical");
    expect(item.assessment.classes).toEqual(expect.arrayContaining(["utility_strike_risk", "direct_physical_overlap"]));
    const total = item.assessment.factors.reduce((n: number, f: { points: number }) => n + f.points, 0) + item.assessment.mitigations.reduce((n: number, m: { points: number }) => n + m.points, 0);
    expect(total).toBe(item.assessment.score);
    expect(mine.body.data.summary.riskIndex).toBe(riskIndexOf([item.assessment.effective.score]));
    expect(mine.body.data.summary.corridorProfile.length).toBeLessThanOrEqual(60);

    const opp = await assess(d.officerA.token, d.subject.id, "?kind=opportunity");
    expect(opp.body.data.items).toHaveLength(1);
    expect(opp.body.data.items[0].assessment.kind).toBe("opportunity");
    expect(opp.body.data.items[0].assessment.estimatedSharedTrenchMeters).toBeGreaterThan(0);
    expect(mine.body.data.items.map((i: { other: { id: string } }) => i.other.id)).not.toContain(d.draft.id);

    // Counterpart: the other agency sees the SAME score and band for the same pair, and its own aggregate refreshed.
    await waitFor(async () => (await WorkRequest.findById(d.cable.id).lean())?.assessment?.status === "completed");
    const theirs = await assess(d.officerB.token, d.cable.id);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data.items[0].assessment.score).toBe(item.assessment.score);
    expect(theirs.body.data.items[0].assessment.band).toBe(item.assessment.band);
    expect(theirs.body.data.summary.riskIndex).toBe(mine.body.data.summary.riskIndex);
  });

  it("is idempotent without force and redacts cross-agency factor params", async () => {
    const d = await ready();
    const again = await runAssessment(d.subject.id, { runBy: "test" });
    expect(again).toMatchObject({ state: "completed", assessed: 0 });
    const own = (await assess(d.officerA.token, d.subject.id, "?kind=opportunity")).body.data.items[0];
    expect(own.other.id).toBe(d.joint.id);
    expect(own.other.detailLevel).toBe("redacted");
    const hidden = own.assessment.factors.find((f: { key: string }) => f.key === "priorityEmergency");
    expect(hidden).toMatchObject({ code: "other_agency", params: { involvesOtherAgency: true } });
    expect(JSON.stringify(own).toLowerCase()).not.toContain("critical");
    const national = (await assess(d.superUser.token, d.subject.id, "?kind=opportunity")).body.data.items[0];
    expect(national.other.detailLevel).toBe("full");
    expect(national.assessment.factors.find((f: { key: string }) => f.key === "priorityEmergency").code).toBe("critical");
  });

  it("limits overrides to national roles, audits them, keeps them across re-runs and flags stale ones", async () => {
    const d = await ready();
    const view = (token: string) => assess(token, d.subject.id);
    const first = (await view(d.superUser.token)).body.data;
    const id = first.items[0].candidateId as string;
    const before = first.summary.riskIndex as number;
    const put = (token: string, body: unknown) => request(app).post(`/api/v1/roadsync/assessment/candidates/${id}/override`).set(auth(token)).send(body as object);

    expect((await put(d.officerA.token, { band: "low", reason: "Coordinated off-peak work" })).status).toBe(403);
    expect((await request(app).post(`/api/v1/roadsync/assessment/candidates/${id}/override`).send({ band: "low", reason: "Coordinated off-peak work" })).status).toBe(401);
    expect((await put(d.superUser.token, { band: "low", reason: "short" })).status).toBe(400);
    expect((await put(d.superUser.token, { band: "low", reason: "Coordinated off-peak work", extra: 1 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/roadsync/assessment/candidates/${"f".repeat(24)}/override`).set(auth(d.superUser.token)).send({ band: "low", reason: "Coordinated off-peak work" })).status).toBe(404);

    expect((await put(d.superUser.token, { band: "low", reason: "Coordinated off-peak work" })).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: "work_request.assessment_override_set" })).toBe(1);
    const national = (await view(d.superUser.token)).body.data;
    expect(national.items[0].assessment.effective.band).toBe("low");
    expect(national.items[0].assessment.override).toMatchObject({ band: "low", reason: "Coordinated off-peak work" });
    expect(national.summary.riskIndex).toBeLessThan(before);
    const agency = (await view(d.officerA.token)).body.data.items[0].assessment;
    expect(agency.overridden).toBe(true);
    expect(agency.override).toBeUndefined();

    await runAssessment(d.subject.id, { runBy: "test", force: true });
    expect((await view(d.superUser.token)).body.data.items[0].assessment.effective.band).toBe("low");
    await Candidate.updateOne({ _id: id }, { $set: { inputsHash: "changed-inputs" } });
    await runAssessment(d.subject.id, { runBy: "test" });
    expect((await view(d.superUser.token)).body.data.items[0].assessment.overrideStale).toBe(true);

    const clear = await request(app).delete(`/api/v1/roadsync/assessment/candidates/${id}/override`).set(auth(d.superUser.token));
    expect(clear.status).toBe(200);
    expect((await view(d.superUser.token)).body.data.items[0].assessment.effective.band).toBe("critical");
    expect(await AuditLog.countDocuments({ action: "work_request.assessment_override_cleared" })).toBe(1);
  });

  it("enforces authentication, scope, draft and role rules", async () => {
    const d = await ready();
    expect((await request(app).get(`/api/v1/roadsync/work-requests/${d.subject.id}/assessment`)).status).toBe(401);
    expect((await assess(d.contractor.token, d.subject.id)).status).toBe(403);
    expect((await assess(d.officerB.token, d.subject.id)).status).toBe(404);
    expect((await assess(d.officerA.token, d.subject.id, "?band=nope")).status).toBe(400);
    expect((await assess(d.officerA.token, d.subject.id, "?unknown=1")).status).toBe(400);
    expect((await assess(d.officerA.token, "not-an-id")).status).toBe(404);
    const run = (token: string, id: string) => request(app).post(`/api/v1/roadsync/work-requests/${id}/assessment/run`).set(auth(token)).send();
    expect((await run(d.officerA.token, d.draftA.id)).status).toBe(409);
    expect((await run(d.contractor.token, d.subject.id)).status).toBe(403);
    expect((await run(d.officerB.token, d.subject.id)).status).toBe(404);
    expect((await run(d.officerA.token, d.subject.id)).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: "work_request.assessment_run" })).toBe(1);
    expect((await request(app).get("/api/v1/roadsync/assessment/rules").set(auth(d.officerA.token))).body.data.version).toBe("1.0.0");
    expect((await request(app).get("/api/v1/roadsync/assessment/rules")).status).toBe(401);
  });

  it("answers what-if from stored pairs without persisting and finds the nearest conflict-free starts", async () => {
    const d = await ready();
    const persisted = (await assess(d.officerA.token, d.subject.id)).body.data.summary.riskIndex as number;
    const call = (body: unknown) => request(app).post(`/api/v1/roadsync/work-requests/${d.subject.id}/assessment/whatif`).set(auth(d.officerA.token)).send(body as object);
    const swept = await call({ sweep: true });
    expect(swept.status).toBe(200);
    expect(swept.body.data.coverageNote).toBe("stored_pairs_only");
    expect(swept.body.data.current.riskIndex).toBe(persisted);
    expect(swept.body.data.curve).toHaveLength(181);
    expect(swept.body.data.curve.find((c: { shiftDays: number }) => c.shiftDays === 0).riskIndex).toBe(persisted);
    // Cable work covers +32..+38 and the subject +30..+40: ending before +32 or starting after +38 clears the only conflict.
    expect(swept.body.data.firstClearShifts.earlier.shiftDays).toBe(-9);
    expect(swept.body.data.firstClearShifts.later.shiftDays).toBe(9);
    const moved = await call({ shiftDays: 9 });
    expect(moved.body.data.scenario).toMatchObject({ shiftDays: 9, conflictCount: 0 });
    expect(JSON.stringify(swept.body)).not.toContain("CRITICAL");
    expect((await call({ shiftDays: 500 })).status).toBe(400);
    expect((await call({ bufferMeters: 900 })).status).toBe(400);
    expect((await call({ nope: true })).status).toBe(400);
    expect((await request(app).post(`/api/v1/roadsync/work-requests/${d.draftA.id}/assessment/whatif`).set(auth(d.officerA.token)).send({})).status).toBe(409);
    expect((await WorkRequest.findById(d.subject.id).lean())?.plannedStart.toISOString()).toBe(at(30).toISOString());
    expect((await assess(d.officerA.token, d.subject.id)).body.data.summary.riskIndex).toBe(persisted);
  });

  it("previews the assessment on the fly, reports missing inputs and persists nothing", async () => {
    const d = await world();
    const preview = (body: unknown) => request(app).post("/api/v1/roadsync/detect/preview").set(auth(d.officerB.token)).send(body as object);
    const schedule = { plannedStart: at(30).toISOString(), plannedEnd: at(40).toISOString() };
    const bare = await preview({ geometry: lineA, schedule });
    expect(bare.status).toBe(200);
    expect(bare.body.data.summary.assessment.incompleteInputs).toEqual(expect.arrayContaining(["workType", "trafficImpact"]));
    const full = await preview({ geometry: lineA, schedule, subject: { workType: "ELECTRIC_CABLE_WORK", priority: "NORMAL", trafficImpact: { level: "low" } } });
    expect(full.status).toBe(200);
    expect(full.body.data.summary.assessment.incompleteInputs).not.toContain("workType");
    expect(full.body.data.summary.assessment.counts.conflicts).toBeGreaterThanOrEqual(1);
    expect(full.body.data.candidates[0].assessment.factors.length).toBeGreaterThan(0);
    expect((await preview({ geometry: lineA, subject: { workType: "NOT_A_TYPE" } })).status).toBe(400);
    expect((await preview({ geometry: lineA, subject: { extra: 1 } })).status).toBe(400);
    expect(await Candidate.countDocuments({})).toBe(0);
  });

  it("refreshes the counterpart when a request is cancelled and exposes risk on list and map payloads", async () => {
    const d = await ready();
    const rows = await request(app).get("/api/v1/roadsync/work-requests?hasConflicts=true&band=critical&sort=riskIndex").set(auth(d.officerA.token));
    expect(rows.status).toBe(200);
    expect(rows.body.data.workRequests.map((w: { id: string }) => w.id)).toEqual([d.subject.id]);
    expect(rows.body.data.workRequests[0].assessment).toMatchObject({ maxBand: "critical", conflicts: 1, opportunities: 1 });
    expect((await request(app).get("/api/v1/roadsync/work-requests?band=bogus").set(auth(d.officerA.token))).status).toBe(400);
    const map = await request(app).get("/api/v1/roadsync/work-requests/map").set(auth(d.officerA.token));
    expect(map.body.data.features.find((f: { properties: { id: string } }) => f.properties.id === d.subject.id).properties.maxBand).toBe("critical");

    await WorkRequest.updateOne({ _id: d.cable._id }, { $set: { status: "CANCELLED" } });
    roadsyncEvents.emit("workRequestCancelled", { requestId: d.cable.id });
    await waitFor(async () => ((await WorkRequest.findById(d.subject.id).lean())?.assessment?.counts?.conflicts ?? 1) === 0);
    const after = await assess(d.officerA.token, d.subject.id);
    expect(after.body.data.summary.counts.conflicts).toBe(0);
    expect(after.body.data.summary.riskIndex).toBe(0);
    expect(after.body.data.items).toEqual([]);
  });

  it("serves a capped map feature collection with hotspots and profile segments", async () => {
    const d = await ready();
    const res = await request(app).get(`/api/v1/roadsync/work-requests/${d.subject.id}/assessment/map`).set(auth(d.officerA.token));
    expect(res.status).toBe(200);
    expect(res.body.data.features.length).toBeLessThanOrEqual(250);
    const kinds = new Set(res.body.data.features.map((f: { properties: { feature?: string; kind?: string } }) => f.properties.feature ?? f.properties.kind));
    expect(kinds).toEqual(expect.objectContaining({}));
    expect([...kinds]).toEqual(expect.arrayContaining(["profile", "hotspot", "candidate"]));
    expect((await request(app).get(`/api/v1/roadsync/work-requests/${d.subject.id}/assessment/map`).set(auth(d.officerB.token))).status).toBe(404);
  });
});
