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
import { allowedActions, applyDecision, confirmConditions, deadlineState, deriveStatus, openNextRound, validateProposal, type Participant, type ReqState, type ValidateCtx } from "../src/modules/roadsync/coordination.engine.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRead, ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { CoordinationMessage, CoordinationRead, CoordinationRequest } from "../src/modules/roadsync/models/coordination.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { roadsyncEvents } from "../src/modules/roadsync/roadsync.events.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

// ---------- pure ----------

const now = new Date("2026-06-01T04:00:00Z");
const D = (n: number) => new Date(now.getTime() + n * 86_400_000);
const vctx = (over: Partial<ValidateCtx> = {}): ValidateCtx => ({
  a: { id: "a".repeat(24), type: "work_request", agencyId: "AG1", start: D(30), end: D(40), workingHours: "day", isEmergency: false },
  b: { id: "b".repeat(24), type: "work_request", agencyId: "AG2", start: D(32), end: D(38), workingHours: "day", isEmergency: false },
  recordType: "conflict", classes: ["direct_physical_overlap"], now, ...over,
});
const A = "a".repeat(24);

describe("step 74 proposal validation", () => {
  it("accepts a same-duration shift and captures server-side before/after", () => {
    const r = validateProposal("schedule_shift", { targetRequestId: A, newStart: D(50).toISOString(), newEnd: D(60).toISOString() }, vctx());
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.proposal.before.start).toBe(D(30).toISOString()); expect(r.proposal.after.shiftDays).toBe(20); }
  });
  it("rejects bad shifts: past start, >180 d, duration change, foreign target, unknown keys", () => {
    const shift = (over: object) => validateProposal("schedule_shift", { targetRequestId: A, newStart: D(50).toISOString(), newEnd: D(60).toISOString(), ...over }, vctx());
    expect(shift({ newStart: D(-5).toISOString(), newEnd: D(5).toISOString() })).toMatchObject({ ok: false, code: "start_in_past" });
    expect(shift({ newStart: D(220).toISOString(), newEnd: D(230).toISOString() })).toMatchObject({ ok: false, code: "shift_too_large" });
    expect(shift({ newEnd: D(65).toISOString() })).toMatchObject({ ok: false, code: "duration_changed" });
    expect(shift({ newEnd: D(62).toISOString(), changeDuration: true })).toMatchObject({ ok: true });
    expect(shift({ newEnd: D(80).toISOString(), changeDuration: true })).toMatchObject({ ok: false, code: "duration_change_too_large" });
    expect(shift({ targetRequestId: "c".repeat(24) })).toMatchObject({ ok: false, code: "target_not_in_pair" });
    expect(shift({ extra: 1 })).toMatchObject({ ok: false, code: "invalid_proposal" });
  });
  it("restricts joint works to opportunities, derives sequence dates and checks meeting slots", () => {
    const joint = { leadAgencyId: "d".repeat(24), proposedStart: D(40).toISOString(), proposedEnd: D(50).toISOString(), scopeNote: "dig once" };
    expect(validateProposal("joint_works", joint, vctx())).toMatchObject({ ok: false, code: "not_an_opportunity" });
    expect(validateProposal("joint_works", joint, vctx({ recordType: "opportunity" }))).toMatchObject({ ok: true });
    const seq = validateProposal("sequence_order", { firstRequestId: A, minGapDays: 14 }, vctx());
    expect(seq.ok && seq.proposal.derived?.newStart).toBe(D(40 + 15).toISOString());
    const slot = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
    expect(validateProposal("site_meeting", { mode: "online", locationText: "x", slots: [slot(2)] }, vctx())).toMatchObject({ ok: false, code: "slot_too_soon" });
    expect(validateProposal("site_meeting", { mode: "online", locationText: "x", slots: [slot(48), slot(48)] }, vctx())).toMatchObject({ ok: false, code: "duplicate_slots" });
  });
});

const part = (agencyId: string, role: Participant["role"], required: boolean, stance: Participant["stance"]): Participant => ({ agencyId, role, required, stance, lastDecisionAt: null, dueAt: null });
const base = (): ReqState & { escalated: boolean } => ({
  status: "awaiting_response", escalated: false, currentRound: 1, maxRounds: 5, deadlineAt: D(3), initiator: { agencyId: "A" }, nudges: [],
  participants: [part("A", "initiator", true, "proposer"), part("B", "recipient", true, "pending"), part("C", "consulted", false, "pending")],
  rounds: [{ n: 1, proposal: { type: "schedule_shift", before: {}, after: {} }, proposedBy: { agencyId: "A", userId: "u" }, note: null, createdAt: now, responses: [], impact: null }],
});
const resp = (agencyId: string, decision: Parameters<typeof applyDecision>[1]["decision"]) => ({ agencyId, userId: "u", decision, conditions: [], reasonCode: null, note: null, selectedSlot: null, counterRound: null, at: now });

describe("step 75 negotiation engine", () => {
  it("derives status: consulted never blocks, conditional blocks until confirmed", () => {
    const r = base();
    expect(deriveStatus(r.participants)).toBe("awaiting_response");
    expect(applyDecision(r, resp("C", "declined"))).toBe("ok");
    expect(r.status).toBe("awaiting_response"); // a consulted decline does not block or start negotiating
    expect(applyDecision(r, resp("B", "accepted_with_conditions"))).toBe("ok");
    expect(r.status).toBe("negotiating");
    expect(confirmConditions(r, "all", now)).toBe("ok");
    expect(r.status).toBe("agreed");
  });
  it("lets decisions be replaced within a round and blocks the proposer from answering their own round", () => {
    const r = base();
    applyDecision(r, resp("B", "declined"));
    expect(r.status).toBe("negotiating");
    applyDecision(r, resp("B", "accepted"));
    expect(r.status).toBe("agreed");
    expect(r.rounds[0]!.responses).toHaveLength(1);
    expect(applyDecision(base(), resp("A", "accepted"))).toBe("own_round");
  });
  it("opens round n+1 on counter/revise, enforces type compatibility and the 5-round cap", () => {
    const r = base();
    const by = { agencyId: "B", userId: "u" };
    expect(openNextRound(r, by, { type: "traffic_management", before: {}, after: {} }, null, now)).toBe("incompatible_type");
    expect(openNextRound(r, by, { type: "working_hours", before: {}, after: {} }, null, now)).toBe("ok");
    expect(r.currentRound).toBe(2);
    expect(r.participants.find((p) => p.agencyId === "B")!.stance).toBe("proposer");
    expect(r.participants.find((p) => p.agencyId === "A")!.stance).toBe("pending");
    expect(r.status).toBe("negotiating");
    r.currentRound = 5;
    expect(openNextRound(r, by, { type: "working_hours", before: {}, after: {} }, null, now)).toBe("max_rounds");
  });
  it("computes allowed actions per viewer and derives overdue without a cron", () => {
    const r = base();
    const v = (agencyId: string | null, over: object = {}) => ({ agencyId, national: false, canWrite: true, isParticipant: agencyId !== null, now, ...over });
    expect(allowedActions(r, v("A"))).toEqual(expect.arrayContaining(["revise", "nudge", "withdraw", "close_no_agreement", "extend_deadline"]));
    expect(allowedActions(r, v("A"))).not.toContain("respond");
    expect(allowedActions(r, v("B"))).toEqual(expect.arrayContaining(["respond", "counter"]));
    expect(allowedActions(r, v("C"))).toContain("respond");
    expect(allowedActions(r, v("C"))).not.toContain("counter");
    expect(allowedActions(r, v("B", { canWrite: false }))).toEqual(["message"]);
    expect(allowedActions(r, v(null))).toEqual([]);
    expect(allowedActions(r, v(null, { national: true }))).toEqual(expect.arrayContaining(["escalate", "withdraw"]));
    expect(allowedActions({ ...r, nudges: [{ at: now, by: "u", agencyId: "A" }] }, v("A"))).not.toContain("nudge"); // cooldown
    expect(deadlineState(D(-1), "awaiting_response", now).state).toBe("overdue");
    expect(deadlineState(D(-1), "agreed", now).state).toBe("closed");
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

describe("steps 74-75 coordination", { timeout: 180_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step74-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step74-0123456789abcdef";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, CoordinationRequest]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [CoordinationMessage, CoordinationRead, CoordinationRequest, ConflictRecord, ConflictRead, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections(); await AuditLog.collection.deleteMany({});
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const lineA = { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] };
  const crossing = { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] };
  const near = { type: "LineString", coordinates: [[79.8645, 6.9306], [79.8655, 6.9306]] };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function world() {
    await seedRoles();
    const [agA, agB, agC, agD] = await Promise.all(["A", "B", "C", "D"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa74@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob74@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc74@example.com", "AGENCY_OFFICER", agC!._id);
    const officerD = await actor("od74@example.com", "AGENCY_OFFICER", agD!._id);
    const viewerA = await actor("va74@example.com", "PROJECT_MANAGER", agA!._id);
    const superUser = await actor("su74@example.com", "SUPER_ADMIN", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `T ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB, pC] = await Promise.all([mk("INF-AS-31", agA!._id), mk("INF-AS-32", agB!._id), mk("INF-AS-33", agC!._id)]);
    const wr = (agencyId: unknown, projectId: unknown, geometry: unknown, workType: string, s: number, e: number, priority = "NORMAL") => WorkRequest.create({ agencyId, projectId, status: "SUBMITTED", geometry, workType, priority, plannedStart: at(s), plannedEnd: at(e) });
    const subject = await wr(agA!._id, pA!._id, lineA, "PIPELINE_INSTALLATION", 30, 40);
    const cable = await wr(agB!._id, pB!._id, crossing, "ELECTRIC_CABLE_WORK", 32, 38, "CRITICAL");
    await wr(agC!._id, pC!._id, near, "TELECOM_CABLE_WORK", 33, 37);
    return { agA: agA!, agB: agB!, agC: agC!, agD: agD!, officerA, officerB, officerC, officerD, viewerA, superUser, subject, cable };
  }
  async function ready() {
    const d = await world();
    await request(app).post(`/api/v1/roadsync/work-requests/${d.subject.id}/detection/run`).set(auth(d.officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1 && (await Notification.countDocuments()) >= 3);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    return { ...d, rec, rid: String(rec._id) };
  }
  const shiftBody = (d: { subject: { id: string } }, extra: object = {}) => ({ type: "schedule_shift", summary: "SECRET-SUMMARY please move", proposal: { targetRequestId: d.subject.id, newStart: at(50).toISOString(), newEnd: at(60).toISOString() }, participants: [], ...extra });
  const create = (token: string, rid: string, body: object) => request(app).post(`/api/v1/roadsync/conflicts/${rid}/coordination`).set(auth(token)).send(body);
  const detail = (token: string, id: string) => request(app).get(`/api/v1/roadsync/coordination/${id}`).set(auth(token));
  const act = (token: string, id: string, path: string, body: object) => request(app).post(`/api/v1/roadsync/coordination/${id}/${path}`).set(auth(token)).send(body);

  it("creates a request: notifies once, acknowledges the initiator, moves the record and previews impact", async () => {
    const d = await ready();
    const res = await create(d.officerA.token, d.rid, shiftBody(d, { participants: [{ agencyId: d.agC.id, mode: "consulted" }] }));
    expect(res.status).toBe(201);
    expect(res.body.data.requestNo).toMatch(/^RSQ-\d{4}-000001$/);
    const req = (await CoordinationRequest.findById(res.body.data.id).lean())!;
    const impact = req.rounds[0].impact as { before: { pairScore: number }; after: { pairScore: number } };
    expect(impact.after.pairScore).toBeLessThan(impact.before.pairScore);
    expect(req.participants.find((p: { agencyId: string }) => p.agencyId === d.agC.id)).toMatchObject({ role: "consulted", required: false });
    const rec = (await ConflictRecord.findById(d.rid).lean())!;
    expect(rec.status).toBe("awaiting_response");
    expect(rec.affectedAgencies.find((a) => a.agencyId === d.agA.id)!.ack.status).toBe("acknowledged");
    const received = await Notification.find({ title: "roadsync.coordination.request_received" }).lean();
    expect(received).toHaveLength(2); // B (required) and C (consulted)
    expect(JSON.stringify(received)).not.toContain("SECRET-SUMMARY");
    // Submitted work requests are never modified.
    expect((await WorkRequest.findById(d.subject.id).lean())!.plannedStart.toISOString()).toBe(at(30).toISOString());
    // A duplicate of the same type from the same agency is refused.
    expect((await create(d.officerA.token, d.rid, shiftBody(d))).status).toBe(409);
  });

  it("agrees through conditions: respond, confirm, immutable terms, record state, idempotent replay and stale version", async () => {
    const d = await ready();
    const id = (await create(d.officerA.token, d.rid, shiftBody(d))).body.data.id as string;
    const v0 = (await detail(d.officerB.token, id)).body.data.version as number;
    const body = { version: v0, round: 1, decision: "accepted_with_conditions", conditions: [{ code: "night_work_only" }] };
    const first = await act(d.officerB.token, id, "respond", body);
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("negotiating");
    expect((await act(d.officerB.token, id, "respond", body)).status).toBe(409); // stale version
    const events = (await CoordinationRequest.findById(id).lean())!.events.length;
    const replay = await act(d.officerB.token, id, "respond", { ...body, version: first.body.data.version });
    expect(replay.status).toBe(200);
    expect((await CoordinationRequest.findById(id).lean())!.events).toHaveLength(events); // no duplicate event
    expect((await act(d.officerB.token, id, "confirm-conditions", { version: first.body.data.version, agencyIds: "all" })).status).toBe(403); // not the proposer
    const confirmed = await act(d.officerA.token, id, "confirm-conditions", { version: first.body.data.version, agencyIds: "all" });
    expect(confirmed.body.data.status).toBe("agreed");
    const done = (await CoordinationRequest.findById(id).lean())!;
    expect(done.agreedTerms).toMatchObject({ round: 1, conditions: [{ code: "night_work_only" }] });
    await waitFor(async () => (await ConflictRecord.findById(d.rid).lean())?.coordination?.state === "agreed");
    expect((await ConflictRecord.findById(d.rid).lean())!.coordination).toMatchObject({ state: "agreed", agreedCount: 1, activeCount: 0 });
    expect((await act(d.officerB.token, id, "respond", { version: confirmed.body.data.version, round: 1, decision: "accepted" })).status).toBe(409); // terminal
    expect((await WorkRequest.findById(d.subject.id).lean())!.plannedStart.toISOString()).toBe(at(30).toISOString());
  });

  it("negotiates a counter in round 2 and lets only one of two simultaneous responses win", async () => {
    const d = await ready();
    const id = (await create(d.officerA.token, d.rid, shiftBody(d, { participants: [{ agencyId: d.agC.id, mode: "consulted" }] }))).body.data.id as string;
    const v = (await detail(d.officerB.token, id)).body.data.version as number;
    const [one, two] = await Promise.all([
      act(d.officerB.token, id, "respond", { version: v, round: 1, decision: "needs_info", note: "which crossing?" }),
      act(d.officerC.token, id, "respond", { version: v, round: 1, decision: "accepted" }),
    ]);
    expect([one.status, two.status].sort()).toEqual([200, 409]);
    const cur = (await detail(d.officerB.token, id)).body.data;
    const counter = await act(d.officerB.token, id, "respond", { version: cur.version, round: 1, decision: "counter_proposed", counterProposal: { type: "working_hours", proposal: { targetRequestId: d.cable.id, workingHours: "night" } } });
    expect(counter.status).toBe(200);
    expect(counter.body.data).toMatchObject({ status: "negotiating", round: 2 });
    const room = (await detail(d.officerA.token, id)).body.data;
    expect(room.participants.find((p: { agencyName: string }) => p.agencyName === "Agency A").stance).toBe("pending");
    expect(room.allowedActions).toContain("respond");
    await waitFor(async () => (await ConflictRecord.findById(d.rid).lean())?.status === "negotiating");
    expect((await ConflictRecord.findById(d.rid).lean())!.status).toBe("negotiating");
    const agreed = await act(d.officerA.token, id, "respond", { version: room.version, round: 2, decision: "accepted" });
    expect(agreed.body.data.status).toBe("agreed");
  });

  it("enforces RBAC: informed-only cannot initiate, non-participants get 404, viewers are read-only, national needs agency + reason", async () => {
    const d = await ready();
    expect((await create(d.officerC.token, d.rid, shiftBody(d))).status).toBe(403);
    expect((await create(d.viewerA.token, d.rid, shiftBody(d))).status).toBe(403);
    expect((await create(d.superUser.token, d.rid, shiftBody(d))).status).toBe(403);
    expect((await create(d.superUser.token, d.rid, shiftBody(d, { onBehalfOfAgencyId: d.agA.id, reason: "national coordinator action" }))).status).toBe(201);
    const id = String((await CoordinationRequest.findOne().lean())!._id);
    expect((await detail(d.officerD.token, id)).status).toBe(404);
    expect((await detail(d.officerC.token, id)).status).toBe(404); // an affected agency that is not a participant
    expect((await request(app).get(`/api/v1/roadsync/coordination/${id}/messages`).set(auth(d.officerD.token))).status).toBe(404);
    const v = (await detail(d.officerB.token, id)).body.data.version as number;
    expect((await act(d.viewerA.token, id, "respond", { version: v, round: 1, decision: "accepted" })).status).toBe(403);
    expect((await act(d.officerA.token, id, "respond", { version: v, round: 1, decision: "accepted" })).status).toBe(403); // own round
    expect((await act(d.superUser.token, id, "respond", { version: v, round: 1, decision: "accepted" })).status).toBe(403);
    expect((await act(d.officerB.token, id, "escalate", { version: v, reason: "not a national role" })).status).toBe(403);
    // Dismiss is blocked while coordination is live; escalation is national-only and moves the record.
    const rec = (await ConflictRecord.findById(d.rid).lean())!;
    expect((await request(app).post(`/api/v1/roadsync/conflicts/${d.rid}/dismiss`).set(auth(d.superUser.token)).send({ version: rec.version, reason: "reviewed and accepted" })).status).toBe(409);
    const esc = await act(d.superUser.token, id, "escalate", { version: v, reason: "overdue and critical" });
    expect(esc.status).toBe(200);
    await waitFor(async () => (await ConflictRecord.findById(d.rid).lean())?.status === "escalated");
    expect((await ConflictRecord.findById(d.rid).lean())!.status).toBe("escalated");
    expect((await act(d.superUser.token, id, "deescalate", { version: esc.body.data.version, reason: "back on track now" })).status).toBe(200);
  });

  it("keeps free text and private fields out of events, notifications and audit, and out of non-participants' reach", async () => {
    const d = await ready();
    const id = (await create(d.officerA.token, d.rid, shiftBody(d, { participants: [{ agencyId: d.agC.id, mode: "consulted" }] }))).body.data.id as string;
    const msg = await request(app).post(`/api/v1/roadsync/coordination/${id}/messages`).set(auth(d.officerB.token)).send({ text: "SECRET-THREAD-TEXT" });
    expect(msg.status).toBe(201);
    const page = await request(app).get(`/api/v1/roadsync/coordination/${id}/messages?limit=1`).set(auth(d.officerA.token));
    expect(page.body.data.items[0].text).toBe("SECRET-THREAD-TEXT");
    const asC = JSON.stringify((await detail(d.officerC.token, id)).body);
    expect(asC).not.toMatch(/"priority"|"description"|"contact"|CRITICAL/); // B's priority is private
    const stored = JSON.stringify([(await CoordinationRequest.findById(id).lean())!.events, await Notification.find({ title: /coordination/ }).lean(), await AuditLog.find({ action: /coordination/ }).select("+newValue").lean()]);
    expect(stored).not.toContain("SECRET-SUMMARY");
    expect(stored).not.toContain("SECRET-THREAD-TEXT");
    // Record-level visibility for non-participants is the summary only.
    const summaryOnly = await request(app).get(`/api/v1/roadsync/conflicts/${d.rid}/coordination`).set(auth(d.officerC.token));
    expect(summaryOnly.status).toBe(200);
    expect(summaryOnly.body.data.coordination.activeCount).toBe(1);
  });

  it("limits nudges, deadline extensions and terminal-thread posts; withdraw closes the request", async () => {
    const d = await ready();
    const id = (await create(d.officerA.token, d.rid, shiftBody(d))).body.data.id as string;
    let v = (await detail(d.officerA.token, id)).body.data.version as number;
    const nudged = await act(d.officerA.token, id, "nudge", { version: v });
    expect(nudged.status).toBe(200);
    expect((await act(d.officerA.token, id, "nudge", { version: nudged.body.data.version })).status).toBe(409); // cooldown
    expect((await act(d.officerB.token, id, "nudge", { version: nudged.body.data.version })).status).toBe(403);
    const cur = (await detail(d.officerA.token, id)).body.data;
    const patch = (deadlineAt: string, version: number) => request(app).patch(`/api/v1/roadsync/coordination/${id}/deadline`).set(auth(d.officerA.token)).send({ version, deadlineAt });
    expect((await patch(new Date(new Date(cur.deadline.at).getTime() + 9 * 86_400_000).toISOString(), cur.version)).status).toBe(400); // > +7 d
    const ext = await patch(new Date(new Date(cur.deadline.at).getTime() + 3 * 86_400_000).toISOString(), cur.version);
    expect(ext.status).toBe(200);
    expect((await patch(new Date(new Date(cur.deadline.at).getTime() + 5 * 86_400_000).toISOString(), ext.body.data.version)).status).toBe(409); // once per round
    v = ext.body.data.version;
    expect((await act(d.officerA.token, id, "withdraw", { version: v, reason: "too short" })).status).toBe(400);
    expect((await act(d.officerA.token, id, "withdraw", { version: v, reason: "no longer needed here" })).status).toBe(200);
    expect((await request(app).post(`/api/v1/roadsync/coordination/${id}/messages`).set(auth(d.officerB.token)).send({ text: "late" })).status).toBe(409);
    await waitFor(async () => (await ConflictRecord.findById(d.rid).lean())?.coordination?.activeCount === 0);
    expect((await ConflictRecord.findById(d.rid).lean())!.status).not.toBe("awaiting_response");
  });

  it("auto-withdraws active requests when the record auto-closes, and previews impact without persisting", async () => {
    const d = await ready();
    const before = await CoordinationRequest.countDocuments();
    const preview = await request(app).post("/api/v1/roadsync/coordination/preview-impact").set(auth(d.officerB.token)).send({ conflictId: d.rid, type: "working_hours", proposal: { targetRequestId: d.cable.id, workingHours: "night" } });
    expect(preview.status).toBe(200);
    expect(preview.body.data.impact.applicable).toBe(true);
    expect(JSON.stringify(preview.body)).not.toMatch(/"priority"|"flexible|isEmergency/);
    expect(await CoordinationRequest.countDocuments()).toBe(before);
    const id = (await create(d.officerA.token, d.rid, shiftBody(d))).body.data.id as string;
    await WorkRequest.updateOne({ _id: d.cable._id }, { $set: { status: "CANCELLED" } });
    roadsyncEvents.emit("workRequestCancelled", { requestId: d.cable.id });
    await waitFor(async () => (await CoordinationRequest.findById(id).lean())?.status === "withdrawn");
    const r = (await CoordinationRequest.findById(id).lean())!;
    expect(r.status).toBe("withdrawn");
    expect(r.events.some((e: { type: string }) => e.type === "auto_withdrawn")).toBe(true);
  });
});
