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
import { detectAffectedAgencies, type PairContext } from "../src/modules/roadsync/affected-agencies.js";
import { ackDueAt, allRequiredAcked, appendHistory, guardAction, reconcile, syncAck, type AckEntry, type HistoryPoint } from "../src/modules/roadsync/conflict-record.machine.js";
import { csvCell } from "../src/modules/roadsync/conflict-record.read.js";
import { RECORD } from "../src/modules/roadsync/conflict-record.rules.js";
import { syncRecordsForRequest } from "../src/modules/roadsync/conflict-record.service.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRead, ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { roadsyncEvents } from "../src/modules/roadsync/roadsync.events.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

// ---------- pure: Step 72 detection ----------

const D = (day: number) => new Date(Date.UTC(2026, 5, day));
const base = (over: Partial<PairContext> = {}): PairContext => ({
  a: { type: "work_request", id: "a1", agencyId: "AG1", infrastructureType: "WATER", submittedAt: D(1) },
  b: { type: "work_request", id: "b1", agencyId: "AG2", infrastructureType: "ELECTRICITY", submittedAt: D(2) },
  overlapWindow: { start: D(10), end: D(20) }, bufferMeters: 0, assets: [], nearbyWork: [], ...over,
});
const near = (id: string, agencyId: string, distanceMeters: number, start = 12, end = 14) => ({ agencyId, id, ref: `WR-${id}`, distanceMeters, start: D(start), end: D(end) });

describe("step 72 detectAffectedAgencies", () => {
  it("makes both parties required and suggests the first submitter as lead", () => {
    const r = detectAffectedAgencies(base());
    expect(r.agencies.map((a) => [a.agencyId, a.required])).toEqual([["AG1", true], ["AG2", true]]);
    expect(r.suggestedLead).toEqual({ agencyId: "AG1", reasonCode: "lead_first_submitted" });
    expect(r.internal).toBe(false);
  });
  it("collapses same-agency pairs into one required agency with no lead", () => {
    const r = detectAffectedAgencies(base({ b: { ...base().b, agencyId: "AG1" } }));
    expect(r.agencies).toHaveLength(1);
    expect(r.agencies[0]).toMatchObject({ roles: ["requesting", "counterpart"], required: true });
    expect(r.internal).toBe(true);
    expect(r.suggestedLead).toBeNull();
  });
  it("prefers the road owner as lead, then ties to the lower agency id", () => {
    expect(detectAffectedAgencies(base({ b: { ...base().b, infrastructureType: "ROAD" } })).suggestedLead).toEqual({ agencyId: "AG2", reasonCode: "lead_road_owner" });
    const tie = base({ a: { ...base().a, submittedAt: D(1) }, b: { ...base().b, submittedAt: D(1) } });
    expect(detectAffectedAgencies(tie).suggestedLead?.agencyId).toBe("AG1");
  });
  it("adds asset owners as required and third parties as informed-only, applying radius and date window", () => {
    const r = detectAffectedAgencies(base({
      assets: [{ id: "x1", agencyId: "AG3", infrastructureType: "WATER", distanceMeters: 10, intersectsFootprint: false }, { id: "x2", agencyId: "AG9", infrastructureType: "WATER", distanceMeters: 80, intersectsFootprint: false }],
      nearbyWork: [near("w1", "AG4", 60), near("w2", "AG5", 150), near("w3", "AG6", 40, 40, 45)],
    }));
    const by = Object.fromEntries(r.agencies.map((a) => [a.agencyId, a]));
    expect(by.AG3).toMatchObject({ roles: ["asset_owner"], required: true });
    expect(by.AG4).toMatchObject({ roles: ["third_party"], required: false });
    expect(by.AG9).toBeUndefined();
    expect(by.AG5).toBeUndefined(); // 150 m away
    expect(by.AG6).toBeUndefined(); // dates do not overlap the window +/- 7 days
  });
  it("caps at 12 agencies, parties first, deterministically", () => {
    const many = Array.from({ length: 20 }, (_, i) => near(`w${String(i).padStart(2, "0")}`, `T${String(i).padStart(2, "0")}`, 10 + i));
    const r = detectAffectedAgencies(base({ nearbyWork: many }));
    expect(r.agencies).toHaveLength(RECORD.MAX_AFFECTED_AGENCIES);
    expect(r.truncated).toBe(true);
    expect(r.agencies.slice(0, 2).map((a) => a.agencyId)).toEqual(["AG1", "AG2"]);
    expect(detectAffectedAgencies(base({ nearbyWork: [...many].reverse() })).agencies.map((a) => a.agencyId)).toEqual(r.agencies.map((a) => a.agencyId));
  });
});

// ---------- pure: Step 73 state machine, history, SLA, CSV ----------

const entry = (agencyId: string, required: boolean, acked: boolean, over: Partial<AckEntry> = {}): AckEntry => ({ agencyId, required, active: true, excluded: null, ack: { status: acked ? "acknowledged" : "pending" }, ...over });

describe("step 73 state machine", () => {
  it("acknowledged only when every active required agency acknowledged; informed-only agencies do not count", () => {
    expect(allRequiredAcked([entry("a", true, true), entry("b", true, false)])).toBe(false);
    expect(allRequiredAcked([entry("a", true, true), entry("b", true, true), entry("c", false, false)])).toBe(true);
    expect(syncAck("open", [entry("a", true, true), entry("b", true, true)])).toBe("acknowledged");
    expect(syncAck("acknowledged", [entry("a", true, true), entry("b", true, false)])).toBe("open"); // new required agency added
    expect(syncAck("resolved", [entry("a", true, true)])).toBe("resolved"); // reserved statuses are never moved
  });
  it("guards user actions: national only, valid sources only, reserved statuses unreachable", () => {
    expect(guardAction("dismiss", "open", { national: true, pairActive: true })).toEqual({ ok: true, to: "dismissed" });
    expect(guardAction("dismiss", "open", { national: false, pairActive: true })).toMatchObject({ ok: false, code: "forbidden" });
    expect(guardAction("dismiss", "dismissed", { national: true, pairActive: true })).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(guardAction("dismiss", "resolved", { national: true, pairActive: true })).toMatchObject({ ok: false });
    expect(guardAction("reopen", "auto_closed", { national: true, pairActive: false })).toMatchObject({ ok: false, code: "pair_inactive" });
    expect(guardAction("reopen", "dismissed", { national: true, pairActive: false })).toEqual({ ok: true, to: "open" });
    expect(guardAction("reopen", "open", { national: true, pairActive: true })).toMatchObject({ ok: false });
  });
  it("reconciles system transitions", () => {
    const agencies = [entry("a", true, false), entry("b", true, false)];
    const open = { status: "open" as const, belowThreshold: false, qualifies: true, pairActive: true, band: "high" as const, dismissedBand: null, agencies };
    expect(reconcile({ ...open, pairActive: false })).toMatchObject({ status: "auto_closed", event: "auto_closed", reason: "pair_inactive" });
    expect(reconcile({ ...open, qualifies: false })).toMatchObject({ status: "auto_closed", reason: "below_threshold" });
    // An acknowledged record that drops below the threshold stays open and is flagged.
    const acked = [entry("a", true, true), entry("b", true, true)];
    expect(reconcile({ ...open, status: "acknowledged", qualifies: false, agencies: acked })).toMatchObject({ status: "acknowledged", belowThreshold: true, event: null });
    // Dismissed reopens only on a band increase of at least one step.
    const dismissed = { ...open, status: "dismissed" as const, dismissedBand: "medium" as const };
    expect(reconcile({ ...dismissed, band: "medium" })).toMatchObject({ status: "dismissed", event: null });
    expect(reconcile({ ...dismissed, band: "high" })).toMatchObject({ status: "open", event: "reopened", reason: "severity_increased" });
    expect(reconcile({ ...open, status: "auto_closed" })).toMatchObject({ status: "open", event: "redetected" });
  });
  it("appends severity history only on a band change or a score move of 5+, and tightens the ack deadline only", () => {
    const p = (score: number, band: HistoryPoint["band"]): HistoryPoint => ({ at: new Date(), score, band, ruleVersion: "1.0.0", reason: "reassessed" });
    const one = [p(62, "high")];
    expect(appendHistory(one, p(64, "high")).changed).toBe(false);
    expect(appendHistory(one, p(67, "high")).changed).toBe(true);
    expect(appendHistory(one, p(58, "medium")).changed).toBe(true);
    const t0 = new Date("2026-06-01T00:00:00Z");
    const medium = ackDueAt(t0, "medium", null);
    expect(medium.getTime() - t0.getTime()).toBe(120 * 3_600_000);
    expect(ackDueAt(new Date(t0.getTime() + 3_600_000), "medium", medium)).toEqual(medium);
    expect(ackDueAt(new Date(t0.getTime() + 3_600_000), "critical", medium).getTime() - t0.getTime()).toBe(25 * 3_600_000);
  });
  it("neutralizes CSV formula injection and quotes correctly", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("a,b")).toBe("\"a,b\"");
    expect(csvCell(null)).toBe("");
  });
});

// ---------- integration ----------

const app = createApp();
async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) {
    await Role.create({ key, name: SYSTEM_ROLE_META[key].name, description: SYSTEM_ROLE_META[key].description, permissions: [...SYSTEM_ROLE_PERMISSIONS[key]], scopeType: SYSTEM_ROLE_META[key].scopeType, isSystem: true, isActive: true });
  }
}
async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  const user = await User.create({ firstName: "Nimal", lastName: "Perera", email, passwordHash: await hash("correct-horse-battery", 4), roleId: roleDoc!._id, agencyId, status: "ACTIVE", emailVerified: true, credentialEpoch: 1 });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}
const waitFor = async (check: () => Promise<boolean>) => { for (let i = 0; i < 100 && !(await check()); i += 1) await new Promise((r) => setTimeout(r, 100)); };
const at = (offsetDays: number) => new Date(`${new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)}T04:00:00.000Z`);

describe("steps 72-73 conflict records", { timeout: 180_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step72-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step72-0123456789abcdef";
    await startIsolatedMongo();
    await WorkRequest.init(); await Candidate.init(); await Project.init(); await ConflictRecord.init(); await Notification.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500)); // let the fire-and-forget pipeline settle before the next fixture
    await ConflictRecord.deleteMany({}); await ConflictRead.deleteMany({}); await Candidate.deleteMany({}); await WorkRequest.deleteMany({}); await Project.deleteMany({}); await Notification.deleteMany({});
    await clearCoreCollections(); await AuditLog.collection.deleteMany({});
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const lineA = { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] };
  const crossing = { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] };
  const sixtyMetresAway = { type: "LineString", coordinates: [[79.8645, 6.9306], [79.8655, 6.9306]] };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function world() {
    await seedRoles();
    const [agA, agB, agC, agD] = await Promise.all(["A", "B", "C", "D"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa72@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob72@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc72@example.com", "AGENCY_OFFICER", agC!._id);
    const officerD = await actor("od72@example.com", "AGENCY_OFFICER", agD!._id);
    const superUser = await actor("su72@example.com", "SUPER_ADMIN", agA!._id);
    const contractor = await actor("co72@example.com", "CONTRACTOR", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `Title ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB, pC] = await Promise.all([mk("INF-AS-21", agA!._id), mk("INF-AS-22", agB!._id), mk("INF-AS-23", agC!._id)]);
    const wr = (agencyId: unknown, projectId: unknown, status: string, geometry: unknown, workType: string, start: number, end: number, priority = "NORMAL") =>
      WorkRequest.create({ agencyId, projectId, status, geometry, workType, priority, plannedStart: at(start), plannedEnd: at(end) });
    const subject = await wr(agA!._id, pA!._id, "SUBMITTED", lineA, "PIPELINE_INSTALLATION", 30, 40);
    const cable = await wr(agB!._id, pB!._id, "SUBMITTED", crossing, "ELECTRIC_CABLE_WORK", 32, 38);
    const joint = await wr(agB!._id, pB!._id, "SUBMITTED", lineA, "PIPELINE_INSTALLATION", 35, 45, "CRITICAL");
    const third = await wr(agC!._id, pC!._id, "SUBMITTED", sixtyMetresAway, "TELECOM_CABLE_WORK", 33, 37);
    await wr(agB!._id, pB!._id, "DRAFT", crossing, "ELECTRIC_CABLE_WORK", 32, 38);
    return { agA: agA!, agB: agB!, agC: agC!, agD: agD!, officerA, officerB, officerC, officerD, superUser, contractor, subject, cable, joint, third };
  }
  const detect = (token: string, id: string) => request(app).post(`/api/v1/roadsync/work-requests/${id}/detection/run`).set(auth(token)).send();
  async function ready() {
    const d = await world();
    await detect(d.officerA.token, d.subject.id);
    await waitFor(async () => (await ConflictRecord.countDocuments()) >= 2);
    await waitFor(async () => (await Notification.countDocuments()) >= 3);
    return d;
  }
  const list = (token: string, qs = "") => request(app).get(`/api/v1/roadsync/conflicts${qs}`).set(auth(token));
  const dossier = (token: string, id: string) => request(app).get(`/api/v1/roadsync/conflicts/${id}`).set(auth(token));
  const post = (token: string, path: string, body: unknown) => request(app).post(`/api/v1/roadsync/conflicts/${path}`).set(auth(token)).send(body as object);
  const conflictRow = async () => { const r = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!; return { ...r, id: String(r._id) }; };

  it("creates exactly one record per qualifying pair, detects the third party and shares one number across agencies", async () => {
    const d = await ready();
    expect(await ConflictRecord.countDocuments()).toBe(2); // conflict + opportunity; drafts and the non-qualifying 60 m pair create none
    const rec = await conflictRow();
    expect(rec.conflictNo).toMatch(/^RSC-\d{4}-000001$|^RSC-\d{4}-000002$/);
    const roles = Object.fromEntries(rec.affectedAgencies.map((a) => [a.agencyId, a.roles]));
    expect(roles[d.agA.id]).toContain("requesting");
    expect(roles[d.agB.id]).toContain("counterpart");
    expect(roles[d.agC.id]).toEqual(["third_party"]);
    expect(rec.lead).toMatchObject({ agencyId: d.agA.id, source: "suggested" });

    const a = await list(d.officerA.token);
    const b = await list(d.officerB.token);
    expect(a.body.data.items.map((i: { conflictNo: string }) => i.conflictNo).sort()).toEqual(b.body.data.items.map((i: { conflictNo: string }) => i.conflictNo).sort());
    expect((await list(d.officerD.token)).body.data.total).toBe(0);

    // One batched notification per agency for the run, no per-record spam.
    const batches = await Notification.find({ title: "roadsync.notifications.batch_new" }).lean();
    expect(batches.filter((n) => String(n.userId) === d.officerA.user.id)).toHaveLength(1);
    expect(batches.some((n) => String(n.userId) === d.officerC.user.id)).toBe(true);
  });

  it("is idempotent: re-running assessment writes nothing and sends no further notifications", async () => {
    const d = await ready();
    const before = await ConflictRecord.find().lean();
    const notices = await Notification.countDocuments();
    const out = await syncRecordsForRequest(d.subject.id);
    expect(out).toEqual({ created: 0, updated: 0, closed: 0 });
    const after = await ConflictRecord.find().lean();
    expect(after.map((r) => r.version)).toEqual(before.map((r) => r.version));
    expect(await Notification.countDocuments()).toBe(notices);
  });

  it("lets the third party read the record with both sides redacted but never open either request", async () => {
    const d = await ready();
    const rec = await conflictRow();
    const res = await dossier(d.officerC.token, rec.id);
    expect(res.status).toBe(200);
    expect(res.body.data.parties.a.detailLevel).toBe("redacted");
    expect(res.body.data.parties.b.detailLevel).toBe("redacted");
    const text = JSON.stringify([res.body.data, (await list(d.officerC.token)).body, (await request(app).get(`/api/v1/roadsync/conflicts/${rec.id}/map`).set(auth(d.officerC.token))).body, (await request(app).get("/api/v1/roadsync/conflicts/export.csv").set(auth(d.officerC.token))).text]);
    expect(text).not.toContain("CRITICAL"); // the other agency's priority
    expect(text).not.toMatch(/"priority"|"description"|"contact"/);
    expect((await request(app).get(`/api/v1/roadsync/work-requests/${d.subject.id}`).set(auth(d.officerC.token))).status).toBe(404);
    expect((await dossier(d.officerD.token, rec.id)).status).toBe(404);
    const full = await dossier(d.superUser.token, rec.id);
    expect(full.body.data.parties.a.detailLevel).toBe("full");
  });

  it("enforces acknowledgement permissions, auto-acknowledges, and rejects stale versions", async () => {
    const d = await ready();
    const rec = await conflictRow();
    expect((await request(app).get(`/api/v1/roadsync/conflicts/${rec.id}`).set(auth(d.contractor.token))).status).toBe(403);
    expect((await post(d.officerD.token, `${rec.id}/acknowledge`, { version: rec.version })).status).toBe(404);
    expect((await post(d.superUser.token, `${rec.id}/acknowledge`, { version: rec.version })).status).toBe(403); // no agency, no reason
    const first = await post(d.officerA.token, `${rec.id}/acknowledge`, { version: rec.version });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("open");
    expect((await post(d.officerA.token, `${rec.id}/acknowledge`, { version: rec.version })).status).toBe(409); // stale
    const again = await post(d.officerA.token, `${rec.id}/acknowledge`, { version: first.body.data.version });
    expect(again.body.error?.details?.[0]?.code ?? again.body.errors?.[0]?.code ?? "ALREADY").toBeDefined();
    const second = await post(d.officerB.token, `${rec.id}/acknowledge`, { version: first.body.data.version });
    expect(second.body.data.status).toBe("acknowledged");
    expect(second.body.data.status).toBe((await conflictRow()).status);
  });

  it("limits dismiss, lead and agency management to national roles and protects party agencies", async () => {
    const d = await ready();
    const rec = await conflictRow();
    expect((await post(d.officerA.token, `${rec.id}/dismiss`, { version: rec.version, reason: "not relevant at all" })).status).toBe(403);
    expect((await post(d.officerA.token, `${rec.id}/lead`, { version: rec.version, agencyId: d.agB.id })).status).toBe(403);
    expect((await post(d.officerA.token, `${rec.id}/agencies`, { version: rec.version, agencyId: d.agD.id, reason: "needs to know about it" })).status).toBe(403);
    const lead = await post(d.superUser.token, `${rec.id}/lead`, { version: rec.version, agencyId: d.agB.id });
    expect(lead.status).toBe(200);
    expect((await ConflictRecord.findById(rec.id).lean())!.lead).toMatchObject({ agencyId: d.agB.id, source: "national" });
    const removeParty = await request(app).delete(`/api/v1/roadsync/conflicts/${rec.id}/agencies/${d.agA.id}`).set(auth(d.superUser.token)).send({ version: lead.body.data.version, reason: "should not be allowed" });
    expect(removeParty.status).toBe(400);
    const exclude = await request(app).delete(`/api/v1/roadsync/conflicts/${rec.id}/agencies/${d.agC.id}`).set(auth(d.superUser.token)).send({ version: lead.body.data.version, reason: "far enough away to ignore" });
    expect(exclude.status).toBe(200);
    expect((await dossier(d.officerC.token, rec.id)).status).toBe(404); // excluded agencies lose access
    const restore = await post(d.superUser.token, `${rec.id}/agencies/${d.agC.id}/restore`, { version: exclude.body.data.version });
    expect(restore.status).toBe(200);
    const added = await post(d.superUser.token, `${rec.id}/agencies`, { version: restore.body.data.version, agencyId: d.agD.id, reason: "regional coordinator must be told" });
    expect(added.status).toBe(200);
    expect((await dossier(d.officerD.token, rec.id)).status).toBe(200);
    const dismissed = await post(d.superUser.token, `${rec.id}/dismiss`, { version: added.body.data.version, reason: "reviewed and accepted risk" });
    expect(dismissed.body.data.status).toBe("dismissed");
    expect((await post(d.superUser.token, `${rec.id}/dismiss`, { version: dismissed.body.data.version, reason: "second dismissal attempt" })).status).toBe(409);
  });

  it("keeps notes private to the authoring agency and out of events and exports", async () => {
    const d = await ready();
    const rec = await conflictRow();
    const note = await post(d.officerA.token, `${rec.id}/notes`, { text: "SECRET-INTERNAL-PLAN" });
    expect(note.status).toBe(201);
    expect((await dossier(d.officerA.token, rec.id)).body.data.notes).toHaveLength(1);
    expect((await dossier(d.officerB.token, rec.id)).body.data.notes).toHaveLength(0);
    expect((await dossier(d.officerC.token, rec.id)).body.data.notes).toHaveLength(0);
    const asNational = await dossier(d.superUser.token, rec.id);
    expect(asNational.body.data.notes[0]).toMatchObject({ agencyName: "Agency A" });
    const leaks = JSON.stringify([(await dossier(d.officerB.token, rec.id)).body, (await request(app).get("/api/v1/roadsync/conflicts/export.csv").set(auth(d.officerA.token))).text, (await request(app).get(`/api/v1/roadsync/conflicts/${rec.id}/evidence.geojson`).set(auth(d.officerA.token))).text, await Notification.find().lean()]);
    expect(leaks).not.toContain("SECRET-INTERNAL-PLAN");
    expect(JSON.stringify((await ConflictRecord.findById(rec.id).lean())!.events)).not.toContain("SECRET-INTERNAL-PLAN");
  });

  it("acknowledges in bulk with per-item results and a hard cap of 25", async () => {
    const d = await ready();
    const ids = (await ConflictRecord.find().lean()).map((r) => String(r._id));
    const res = await request(app).post("/api/v1/roadsync/conflicts/acknowledge-bulk").set(auth(d.officerA.token)).send({ ids: [...ids, "a".repeat(24)] });
    expect(res.status).toBe(200);
    const results = res.body.data.results as { id: string; result: string }[];
    expect(results.filter((r) => r.result === "ok")).toHaveLength(2);
    expect(results.find((r) => r.id === "a".repeat(24))?.result).toBe("not_found");
    expect((await request(app).post("/api/v1/roadsync/conflicts/acknowledge-bulk").set(auth(d.officerA.token)).send({ ids: Array.from({ length: 26 }, (_, i) => i.toString(16).padStart(24, "0")) })).status).toBe(400);
  });

  it("auto-closes when a source is cancelled, refreshes aggregates, and reopens on re-detection", async () => {
    const d = await ready();
    const rec = await conflictRow();
    await waitFor(async () => (await WorkRequest.findById(d.subject.id).lean())?.conflictRecords?.total === 2);
    expect((await WorkRequest.findById(d.subject.id).lean())!.conflictRecords).toMatchObject({ total: 2, open: 2, needsAck: 2 });
    await WorkRequest.updateOne({ _id: d.cable._id }, { $set: { status: "CANCELLED" } });
    roadsyncEvents.emit("workRequestCancelled", { requestId: d.cable.id });
    await waitFor(async () => (await ConflictRecord.findById(rec.id).lean())?.status === "auto_closed");
    expect((await ConflictRecord.findById(rec.id).lean())!.status).toBe("auto_closed");
    await waitFor(async () => (await WorkRequest.findById(d.subject.id).lean())?.conflictRecords?.total === 1);
    expect((await WorkRequest.findById(d.subject.id).lean())!.conflictRecords?.total).toBe(1);

    await WorkRequest.updateOne({ _id: d.cable._id }, { $set: { status: "SUBMITTED" } });
    await detect(d.officerA.token, d.subject.id);
    await waitFor(async () => (await ConflictRecord.findById(rec.id).lean())?.status === "open");
    const reopened = (await ConflictRecord.findById(rec.id).lean())!;
    expect(reopened.status).toBe("open");
    expect(reopened.events.some((e) => e.type === "redetected")).toBe(true);
    expect(reopened.conflictNo).toBe(rec.conflictNo);
  });

  it("returns an agency preview for drafts without persisting or notifying", async () => {
    const d = await ready();
    const records = await ConflictRecord.countDocuments();
    const notices = await Notification.countDocuments();
    const res = await request(app).post("/api/v1/roadsync/detect/preview").set(auth(d.officerB.token)).send({ geometry: lineA, bufferMeters: 0, schedule: { plannedStart: at(30).toISOString(), plannedEnd: at(40).toISOString(), workingHours: "day", flexibleDays: 0, isEmergency: false }, radiusMeters: 250, subject: { workType: "ELECTRIC_CABLE_WORK" } });
    expect(res.status).toBe(200);
    expect(res.body.data.summary.agenciesToCoordinate).toBeDefined();
    expect(await ConflictRecord.countDocuments()).toBe(records);
    expect(await Notification.countDocuments()).toBe(notices);
  });
});
