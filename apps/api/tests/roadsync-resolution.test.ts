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
import { canonical, entryHash, genesisHash, redact, verifyChain, type Entry } from "../src/modules/roadsync/ledger.engine.js";
import { cleanData } from "../src/modules/roadsync/ledger.service.js";
import { itemSide, workItem } from "../src/modules/roadsync/detection.service.js";
import { startDateAllowed } from "../src/modules/roadsync/work-requests.schema.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRead, ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { CoordinationMessage, CoordinationRead, CoordinationRequest } from "../src/modules/roadsync/models/coordination.model.js";
import { Amendment, LedgerEntry, Resolution } from "../src/modules/roadsync/models/resolution.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { applyAmendmentToRequest } from "../src/modules/roadsync/work-requests.service.js";
import { buildApprovals, canApprove, deriveStatus, nationalReasons, termsToPlan, verifyResult, type Approval, type Viewer } from "../src/modules/roadsync/resolution.engine.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

// ---------- pure ----------

const T = new Date("2026-06-01T04:00:00Z");
const viewer = (over: Partial<Viewer>): Viewer => ({ userId: "u1", agencyId: "AG1", roleKey: "GOV_ADMIN", national: false, scopeIds: new Set(["AG1"]), ...over });
const step = (over: Partial<Approval>): Approval => ({ id: "s", step: "agency_admin", agencyId: "AG1", required: true, status: "pending", by: null, at: null, note: null, dueAt: T, ...over });

describe("step 76 approval policy and derivation", () => {
  it("enforces four-eyes, owning-agency admins and national-only steps", () => {
    const ctx = { submitterUserId: "u1" };
    expect(canApprove(step({}), viewer({ userId: "u1" }), ctx)).toBe("four_eyes");
    expect(canApprove(step({}), viewer({ userId: "u2" }), ctx)).toBe("ok");
    expect(canApprove(step({}), viewer({ userId: "u2", roleKey: "AGENCY_OFFICER" }), ctx)).toBe("forbidden");
    expect(canApprove(step({}), viewer({ userId: "u2", agencyId: "AG2", scopeIds: new Set(["AG2"]) }), ctx)).toBe("forbidden");
    expect(canApprove(step({ step: "national", agencyId: undefined }), viewer({ userId: "u2" }), ctx)).toBe("forbidden");
    expect(canApprove(step({ step: "national", agencyId: undefined }), viewer({ userId: "n1", national: true }), ctx)).toBe("ok");
    expect(canApprove(step({ step: "national_second", agencyId: undefined }), viewer({ userId: "n1", national: true }), { ...ctx, firstNationalUserId: "n1" })).toBe("four_eyes");
    expect(canApprove(step({ step: "national", agencyId: undefined, soloApproval: true }), viewer({ userId: "u1", national: true }), ctx)).toBe("ok");
  });

  it("routes to national when the agency has no second admin and adds national by rule", () => {
    const routed = buildApprovals({ kind: "amendment", amendmentId: "a", ownerAgencyId: "AG1", hasSecondAdmin: false, nationalNeeded: false, now: T });
    expect(routed).toHaveLength(1);
    expect(routed[0]).toMatchObject({ step: "national", routedNoSecondAdmin: true });
    expect(buildApprovals({ kind: "amendment", amendmentId: "a", ownerAgencyId: "AG1", hasSecondAdmin: true, nationalNeeded: true, now: T }).map((s) => s.step)).toEqual(["agency_admin", "national"]);
    expect(buildApprovals({ kind: "risk", hasSecondNational: false, now: T })).toMatchObject([{ step: "national", soloApproval: true }]);
    expect(nationalReasons({ type: "amendment", thirdParty: { newConflicts: 1, worsened: 0, cleared: 0 }, severityAtDetection: "critical", shiftDays: 90, band: "high" })).toEqual(["third_party_new_conflicts", "critical_severity", "large_shift"]);
  });

  it("derives status and keeps agreement, application and resolution separate", () => {
    const d = (amendments: string[], verification: string | null = null, current = "draft") => deriveStatus({ type: "amendment", current: current as never, amendments: amendments as never, approvals: [], verification: verification as never });
    expect(d(["draft"])).toBe("draft");
    expect(d(["pending_approval", "draft"])).toBe("pending_approval");
    expect(d(["approved", "approved"])).toBe("approved");
    expect(d(["applied", "approved"])).toBe("applying");
    expect(d(["applied"], "pending")).toBe("verifying");
    expect(d(["applied"], "unchanged")).toBe("needs_followup");
    expect(d(["applied"], "cleared")).toBe("resolved");
    expect(d(["applied"], "cleared", "cancelled")).toBe("cancelled");
    expect(verifyResult({ score: 70, band: "high" }, { active: true, kind: "conflict", score: 20, band: "low" })).toBe("cleared");
    expect(verifyResult({ score: 70, band: "high" }, { active: true, kind: "conflict", score: 55, band: "medium" })).toBe("reduced");
    expect(verifyResult({ score: 70, band: "high" }, { active: true, kind: "conflict", score: 85, band: "critical" })).toBe("worse");
  });

  it("reads isEmergency into assessment sides, fires national rule (c) and applies the 48 h backdate rule only to emergencies", () => {
    const row = { _id: { toString: () => "a".repeat(24) }, agencyId: { toString: () => "AG1" }, projectId: { toString: () => "P" }, workType: "ROAD_RESURFACING", status: "SUBMITTED", priority: "NORMAL", plannedStart: T, plannedEnd: T, geometry: { type: "Point", coordinates: [79.8, 6.9] } };
    expect(itemSide(workItem({ ...row, isEmergency: true } as never)).isEmergency).toBe(true);
    expect(itemSide(workItem(row as never)).isEmergency).toBe(false);
    expect(nationalReasons({ type: "amendment", thirdParty: null, severityAtDetection: "low", shiftDays: 1, band: "low", emergency: true })).toEqual(["emergency_work"]);
    const now = new Date("2026-06-10T10:00:00Z");
    expect(startDateAllowed(new Date("2026-06-09T10:00:00Z"), false, now)).toBe(false);
    expect(startDateAllowed(new Date("2026-06-09T10:00:00Z"), true, now)).toBe(true);
    expect(startDateAllowed(new Date("2026-06-07T09:00:00Z"), true, now)).toBe(false);
  });

  it("maps agreed terms to owner-only amendments and commitments", () => {
    const pair = { aId: "a1", bId: "b1", aType: "work_request", bType: "work_request", aAgencyId: "AG1", bAgencyId: "AG2" };
    const plan = termsToPlan({ proposal: { type: "schedule_shift", before: {}, after: { targetRequestId: "a1", start: "2026-08-01T00:00:00Z", end: "2026-08-10T00:00:00Z" } }, conditions: [{ agencyId: "AG2", code: "night_work_only" }], acceptedBy: [{ agencyId: "AG2" }] }, pair);
    expect(plan.amendments).toEqual([{ workRequestId: "a1", agencyId: "AG1", schedule: { plannedStart: "2026-08-01T00:00:00Z", plannedEnd: "2026-08-10T00:00:00Z" } }]);
    expect(plan.commitments).toEqual([{ agencyId: "AG2", code: "night_work_only" }]);
    const hours = termsToPlan({ proposal: { type: "working_hours", before: {}, after: { targetRequestId: "b1", workingHours: "night" } }, conditions: [], acceptedBy: [] }, pair);
    expect(hours.amendments).toEqual([{ workRequestId: "b1", agencyId: "AG2", workingHours: "night" }]);
    const foreign = termsToPlan({ proposal: { type: "schedule_shift", before: {}, after: { targetRequestId: "zzz", start: "x", end: "y" } }, conditions: [], acceptedBy: [] }, pair);
    expect(foreign.amendments).toHaveLength(0);
  });
});

describe("step 77 ledger integrity", () => {
  const mkChain = (n: number): Entry[] => {
    const out: Entry[] = [];
    let prev = genesisHash("c1");
    for (let i = 1; i <= n; i += 1) {
      const base = { conflictId: "c1", seq: i, at: new Date(T.getTime() + i * 1000), entityType: "record", entityId: "c1", entityNo: "RSC-2026-000001", action: "acknowledged", actor: { type: "user" as const, userId: "u1", agencyId: i === 2 ? "AG9" : "AG1" }, data: { n: i }, visibility: i === 2 ? ("agency" as const) : ("participants" as const), visibilityAgencyId: i === 2 ? "AG9" : null, stateAfter: { recordStatus: "open", severity: null, coordinationState: null, resolutionState: null }, prevHash: prev };
      const hash = entryHash(base);
      out.push({ ...base, recordedAt: base.at, hash });
      prev = hash;
    }
    return out;
  };
  it("verifies an intact chain and pinpoints edits, gaps and head mismatches", () => {
    const chain = mkChain(4);
    expect(verifyChain("c1", chain, { seq: 4, hash: chain[3]!.hash })).toMatchObject({ ok: true, count: 4 });
    const edited = chain.map((e) => (e.seq === 3 ? { ...e, data: { n: 99 } } : e));
    expect(verifyChain("c1", edited, null)).toMatchObject({ ok: false, firstBrokenSeq: 3, reason: "hash_mismatch" });
    expect(verifyChain("c1", chain.filter((e) => e.seq !== 2), null)).toMatchObject({ ok: false, reason: "seq_gap", firstBrokenSeq: 2 });
    expect(verifyChain("c1", chain, { seq: 5, hash: "x" })).toMatchObject({ ok: false, reason: "head_mismatch" });
    expect(canonical({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
  it("redacts agency-private entries into contiguous markers and hides other agencies' person identity", () => {
    const rows = redact(mkChain(3), { national: false, agencyId: "AG1", scopeIds: new Set(["AG1"]) });
    expect(rows.map((r) => r.kind)).toEqual(["entry", "hidden", "entry"]);
    expect(rows[1]).toMatchObject({ fromSeq: 2, toSeq: 2, count: 1 });
    expect(JSON.stringify(rows[1])).not.toContain("acknowledged");
    expect(redact(mkChain(3), { national: true, agencyId: "AG1", scopeIds: new Set() }).every((r) => r.kind === "entry")).toBe(true);
  });
  it("keeps free text out of ledger data", () => {
    expect(cleanData({ band: "high", note: "secret", reason: "secret", justification: "secret", text: "secret", long: "x".repeat(200), n: 3, ok: true })).toEqual({ band: "high", n: 3, ok: true });
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
const waitFor = async (check: () => Promise<boolean>) => { for (let i = 0; i < 150 && !(await check()); i += 1) await new Promise((r) => setTimeout(r, 100)); };
const at = (offsetDays: number) => new Date(`${new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)}T04:00:00.000Z`);

describe("steps 76-77 resolution, approval and ledger", { timeout: 240_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step76-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step76-0123456789abcdef";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, CoordinationRequest, Resolution, Amendment, LedgerEntry]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const m of [LedgerEntry, Amendment, Resolution, CoordinationMessage, CoordinationRead, CoordinationRequest, ConflictRecord, ConflictRead, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections(); await AuditLog.collection.deleteMany({});
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const lineA = { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] };
  const crossing = { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const NOTE = "SECRET-NOTE-TEXT-123";

  async function ready() {
    await seedRoles();
    const [agA, agB] = await Promise.all(["A", "B"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa76@example.com", "AGENCY_OFFICER", agA!._id);
    const adminA = await actor("ga76@example.com", "GOV_ADMIN", agA!._id);
    const officerB = await actor("ob76@example.com", "AGENCY_OFFICER", agB!._id);
    const superUser = await actor("su76@example.com", "SUPER_ADMIN", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `T ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB] = await Promise.all([mk("INF-AS-61", agA!._id), mk("INF-AS-62", agB!._id)]);
    const subject = await WorkRequest.create({ agencyId: agA!._id, projectId: pA!._id, status: "SUBMITTED", geometry: lineA, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(30), plannedEnd: at(40) });
    await WorkRequest.create({ agencyId: agB!._id, projectId: pB!._id, status: "SUBMITTED", geometry: crossing, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", plannedStart: at(32), plannedEnd: at(38) });
    await request(app).post(`/api/v1/roadsync/work-requests/${subject.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    const rec = (await ConflictRecord.findOne({ recordType: "conflict" }).lean())!;
    return { agA: agA!, agB: agB!, officerA, adminA, officerB, superUser, subject, rid: String(rec._id) };
  }
  const view = async (token: string, rid: string) => (await request(app).get(`/api/v1/roadsync/conflicts/${rid}/resolution`).set(auth(token))).body.data.resolution;
  const manual = (d: { subject: { id: string } }) => ({ type: "amendment", manual: { targetRequestId: d.subject.id, schedule: { plannedStart: at(50).toISOString(), plannedEnd: at(60).toISOString() } } });

  it("applies a working-hours amendment through the controlled path with a revision entry and refuses a stale replay", async () => {
    const d = await ready();
    const base = { amendmentId: "a".repeat(24), resolutionId: "b".repeat(24), workRequestId: d.subject.id, workingHours: "night" as const };
    const before = (await WorkRequest.findById(d.subject.id).lean())!;
    const done = await applyAmendmentToRequest({ ...base, baseVersion: (before as { __v: number }).__v }, { userId: d.officerA.user.id, agencyId: d.agA.id });
    expect(done.ok).toBe(true);
    const after = (await WorkRequest.findById(d.subject.id).lean())!;
    expect(after.schedule).toEqual({ workingHours: "night" });
    expect(after.plannedStart.toISOString()).toBe(before.plannedStart.toISOString());
    expect((after.revisions as { before: { workingHours: string }; after: { workingHours: string } }[])[0]).toMatchObject({ before: { workingHours: "day" }, after: { workingHours: "night" } });
    expect((after.originalSchedule as { workingHours: string }).workingHours).toBe("day");
    expect(await applyAmendmentToRequest({ ...base, baseVersion: (before as { __v: number }).__v }, { userId: d.officerA.user.id, agencyId: d.agA.id })).toMatchObject({ ok: false, code: "stale" });
  });

  it("blocks unauthenticated and foreign-agency starts", async () => {
    const d = await ready();
    expect((await request(app).get(`/api/v1/roadsync/conflicts/${d.rid}/resolution`)).status).toBe(401);
    // Agency B cannot amend Agency A's request.
    expect((await request(app).post(`/api/v1/roadsync/conflicts/${d.rid}/resolution`).set(auth(d.officerB.token)).send(manual(d))).status).toBe(403);
    // Directives and risk acceptance are national-only.
    const directive = { type: "directive", directive: { justification: "x".repeat(40), targets: [{ targetRequestId: d.subject.id, schedule: { plannedStart: at(50).toISOString(), plannedEnd: at(60).toISOString() } }] } };
    expect((await request(app).post(`/api/v1/roadsync/conflicts/${d.rid}/resolution`).set(auth(d.officerA.token)).send(directive)).status).toBe(403);
  });

  it("runs amendment -> four-eyes approval -> controlled apply -> verification -> resolved with an intact ledger", async () => {
    const d = await ready();
    const made = await request(app).post(`/api/v1/roadsync/conflicts/${d.rid}/resolution`).set(auth(d.officerA.token)).send(manual(d));
    expect(made.status).toBe(201);
    expect(made.body.data.resolutionNo).toMatch(/^RSR-\d{4}-000001$/);
    // One active resolution per conflict.
    expect((await request(app).post(`/api/v1/roadsync/conflicts/${d.rid}/resolution`).set(auth(d.officerA.token)).send(manual(d))).status).toBe(409);
    // Agreement never edits the request: nothing changed yet.
    expect((await WorkRequest.findById(d.subject.id).lean())!.plannedStart.toISOString()).toBe(at(30).toISOString());

    let res = await view(d.officerA.token, d.rid);
    const rid = res.id as string;
    const aid = res.amendments[0].id as string;
    // Apply before approval is refused.
    expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/apply`).set(auth(d.officerA.token)).send({})).status).toBe(409);
    expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/submit`).set(auth(d.officerA.token)).send({})).status).toBe(200);

    // The submitter cannot approve their own submission; a second admin of the owning agency can.
    res = await view(d.officerA.token, d.rid);
    for (const s of res.approvals.filter((x: { status: string }) => x.status === "pending")) {
      const self = await request(app).post(`/api/v1/roadsync/resolutions/${rid}/approvals/${encodeURIComponent(s.id)}/approve`).set(auth(d.officerA.token)).send({ version: res.version });
      expect(self.status).toBe(403);
    }
    for (let i = 0; i < 3; i += 1) {
      res = await view(d.adminA.token, d.rid);
      const pending = res.approvals.find((x: { status: string }) => x.status === "pending");
      if (!pending) break;
      const who = pending.step === "national" ? d.superUser : d.adminA;
      const body = { version: res.version, note: NOTE, ...(pending.step === "national" ? {} : {}) };
      expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/approvals/${encodeURIComponent(pending.id)}/approve`).set(auth(who.token)).send(body)).status).toBe(200);
    }
    res = await view(d.officerA.token, d.rid);
    expect(res.status).toBe("approved");

    // Stale resolution version is refused.
    const pf = await request(app).get(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/preflight`).set(auth(d.officerA.token));
    expect(pf.body.data.ok).toBe(true);
    // Only the owning agency applies.
    expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/apply`).set(auth(d.officerB.token)).send({})).status).toBe(403);
    expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/apply`).set(auth(d.officerA.token)).send({})).status).toBe(200);
    // Duplicate application is a no-op replay.
    expect((await request(app).post(`/api/v1/roadsync/resolutions/${rid}/amendments/${aid}/apply`).set(auth(d.officerA.token)).send({})).body.data.replayed).toBe(true);

    const wr = (await WorkRequest.findById(d.subject.id).lean())!;
    expect(wr.plannedStart.toISOString()).toBe(at(50).toISOString());
    expect(wr.amendedCount).toBe(1);
    expect((wr.revisions as unknown[]).length).toBe(1);
    expect((wr.originalSchedule as { plannedStart: Date }).plannedStart.toISOString()).toBe(at(30).toISOString());

    // Re-detection and re-assessment run automatically, then verification decides.
    await waitFor(async () => ["resolved", "needs_followup"].includes((await Resolution.findOne().lean())!.status));
    const finalRes = (await Resolution.findOne().lean())!;
    expect(finalRes.status).toBe("resolved");
    expect(finalRes.outcome).toMatchObject({ code: "amendment_cleared" });
    expect((await ConflictRecord.findById(d.rid).lean())!.status).toBe("resolved");

    // The ledger is a tamper-evident chain and holds no free text.
    const ok = await request(app).get(`/api/v1/roadsync/conflicts/${d.rid}/history/verify`).set(auth(d.officerA.token));
    expect(ok.body.data).toMatchObject({ ok: true });
    const entries = await LedgerEntry.find({ conflictId: d.rid }).sort({ seq: 1 }).lean();
    expect(entries[0]!.action).toBe("ledger_started");
    expect(entries.map((e) => e.action)).toEqual(expect.arrayContaining(["resolution_started", "amendment_submitted", "approval_granted", "amendment_applied", "verification_completed", "resolution_resolved"]));
    expect(JSON.stringify(entries)).not.toContain(NOTE);
    expect(JSON.stringify(await Notification.find().lean())).not.toContain(NOTE);
    expect(JSON.stringify(await AuditLog.find().lean())).not.toContain(NOTE);
    // The note is visible to parties only (here: the authoring agency).
    expect(JSON.stringify(await view(d.officerA.token, d.rid))).toContain(NOTE);

    // Tamper: editing an entry without recomputing the chain is detected.
    await LedgerEntry.collection.updateOne({ conflictId: entries[0]!.conflictId, seq: 2 }, { $set: { action: "dismissed" } });
    const broken = await request(app).get(`/api/v1/roadsync/conflicts/${d.rid}/history/verify`).set(auth(d.officerA.token));
    expect(broken.body.data).toMatchObject({ ok: false, firstBrokenSeq: 2, reason: "hash_mismatch" });
    // Chronicle redaction: the audit explorer is national-only.
    expect((await request(app).get("/api/v1/roadsync/audit").set(auth(d.officerA.token))).status).toBe(404);
    expect((await request(app).get("/api/v1/roadsync/audit").set(auth(d.superUser.token))).status).toBe(200);
  });
});
