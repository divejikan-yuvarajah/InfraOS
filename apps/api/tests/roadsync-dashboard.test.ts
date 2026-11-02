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
import { clearDashboardCache } from "../src/modules/roadsync/dashboard.read.js";
import { benchmark, buckets, delta, health, overview, pct, percentile, previousRange, rangeOf, scorecard, signals, type Data, type DAgency, type DRecord, type DReq, type DRes } from "../src/modules/roadsync/dashboard.metrics.js";
import { HEALTH_WEIGHTS } from "../src/modules/roadsync/dashboard.rules.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { ConflictRead, ConflictRecord } from "../src/modules/roadsync/models/conflict-record.model.js";
import { CoordinationMessage, CoordinationRead, CoordinationRequest } from "../src/modules/roadsync/models/coordination.model.js";
import { Amendment, LedgerEntry, Resolution } from "../src/modules/roadsync/models/resolution.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

// ---------- pure: metric definitions on a hand-built fixture ----------
const NOW = new Date("2026-06-15T06:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const ag = (agencyId: string, over: Partial<DAgency> = {}): DAgency => ({ agencyId, required: true, active: true, excluded: false, ackStatus: "pending", ackAt: null, ackDueAt: day(-1), addedAt: day(-12), ...over });
const rec = (id: string, over: Partial<DRecord> = {}): DRecord => ({
  id, conflictNo: `RSC-2026-00000${id}`, recordType: "conflict", status: "open", band: "medium", score: 50, classes: ["utility_trench"], createdAt: day(-5), closedAt: null, resolvedAt: null, outcome: null, resolvedBand: null,
  overlapStart: null, overlapEnd: null, district: "Colombo", lng: 79.86, lat: 6.93, agencies: [ag("A"), ag("B", { ackStatus: "acknowledged", ackAt: day(-4) })], trenchMeters: null, ...over,
});
const req = (id: string, conflictId: string, over: Partial<DReq> = {}): DReq => ({
  id, conflictId, status: "negotiating", createdAt: day(-8), closedAt: null, lastActivityAt: day(-2), escalatedAt: null, escalated: false, agreedRound: null, rounds: 1,
  participants: [{ agencyId: "A", required: true, stance: "proposer", dueAt: day(1), lastDecisionAt: null }, { agencyId: "B", required: true, stance: "accepted", dueAt: day(-5), lastDecisionAt: day(-6) }], ...over,
});
const res = (conflictId: string, over: Partial<DRes> = {}): DRes => ({ conflictId, type: "amendment", status: "resolved", active: false, createdAt: day(-9), outcome: "amendment_cleared", resolvedAt: day(-2), verification: "cleared", verifiedAt: day(-2), commitments: [], nationalStep: false, ...over });
const RANGE = rangeOf("30d", undefined, undefined, NOW)!;
const opts = { range: RANGE, compare: false, now: NOW, national: true, viewerAgencies: null, approvalsOverdue: 0 };

function fixture(): Data {
  return {
    records: [
      rec("1", { band: "critical", createdAt: day(-40), agencies: [ag("A"), ag("B", { ackStatus: "acknowledged", ackAt: day(-35), ackDueAt: day(-30) })] }),
      rec("2", { band: "high", createdAt: day(-10), overlapStart: day(3), overlapEnd: day(9), agencies: [ag("A", { ackStatus: "acknowledged", ackAt: day(-2), ackDueAt: day(-5) }), ag("B")] }),
      rec("3", { status: "acknowledged", createdAt: day(-5), agencies: [ag("A", { ackStatus: "acknowledged", ackAt: day(-4), ackDueAt: day(-3) })] }),
      rec("4", { status: "resolved", createdAt: day(-20), closedAt: day(-2), resolvedAt: day(-2), outcome: "amendment_cleared", resolvedBand: "high", band: "low" }),
      rec("5", { recordType: "opportunity", band: "info", trenchMeters: 400, overlapStart: day(1), overlapEnd: day(10) }),
      rec("6", { recordType: "opportunity", status: "resolved", createdAt: day(-15), closedAt: day(-3), resolvedAt: day(-3), outcome: "opportunity_realized", trenchMeters: 250 }),
    ],
    reqs: [req("q1", "1", { status: "agreed", closedAt: day(-3), agreedRound: 1, rounds: 1 }), req("q2", "2", { status: "agreed", closedAt: day(-4), agreedRound: 2, rounds: 3 }), req("q3", "3", { status: "no_agreement", closedAt: day(-6), rounds: 2 }), req("q4", "3", { lastActivityAt: day(-12) })],
    ress: [res("4"), res("6", { type: "opportunity", outcome: "opportunity_realized", resolvedAt: day(-3) })],
    ams: [],
  };
}

describe("step 78 metric definitions", () => {
  it("uses nearest-rank percentiles and never divides by zero", () => {
    expect(percentile([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
    expect(pct(1, 0)).toBeNull();
    expect(delta(5, 0)).toEqual({ abs: 5, pct: null });
    expect(delta(null, 3)).toBeNull();
    expect(delta(110, 100)).toEqual({ abs: 10, pct: 10 });
  });

  it("builds inclusive Asia/Colombo ranges and an equal-length previous period", () => {
    const evening = new Date("2026-06-15T20:00:00Z"); // 01:30 on 16 June in Colombo
    const r = rangeOf("7d", undefined, undefined, evening)!;
    expect(r.days).toBe(7);
    expect(r.end.toISOString()).toBe("2026-06-16T18:29:59.999Z");
    expect(r.start.toISOString()).toBe("2026-06-09T18:30:00.000Z");
    const p = previousRange(r);
    expect(p.days).toBe(7);
    expect(p.endDay).toBe(r.startDay - 1);
    expect(rangeOf("custom", "2024-01-01", "2026-06-01", NOW)).toBeNull();
    expect(rangeOf("custom", "2026-06-10", "2026-06-01", NOW)).toBeNull();
    expect(buckets(RANGE).length).toBe(30);
  });

  it("computes the headline numbers on the fixture", () => {
    const o = overview(fixture(), opts);
    const k = Object.fromEntries(o.kpis.map((x) => [x.key, x]));
    expect(k.openConflicts).toMatchObject({ value: 3 });
    expect(k.criticalHigh!.value).toBe(2);
    expect(o.byBand).toEqual({ critical: 1, high: 1, medium: 1 });
    expect(o.backlogAging.buckets.map((b) => b.count)).toEqual([0, 1, 1, 0, 1]);
    expect(o.backlogAging.oldest).toEqual({ conflictNo: "RSC-2026-000001", ageDays: 40 });
    expect(o.newInRange).toBe(3);
    expect(o.resolvedInRange).toBe(2);
    // completed in range: rec2/A late; rec3/A, rec4/B, rec5/B, rec6/B on time (rec1/B is 35 d old, outside the range).
    // Still pending past due on open records (a miss, since the range includes today): rec1/A, rec2/B, rec5/A.
    expect(k.ackTimeliness).toMatchObject({ numerator: 4, denominator: 8, value: 50 });
    // required responses in range: q1,q2,q3,q4 each have B accepted 6 d ago against a due date 5 d ago.
    expect(k.responseTimeliness).toMatchObject({ numerator: 4, denominator: 4, value: 100 });
    expect(k.agreementRate).toMatchObject({ numerator: 2, denominator: 3 });
    expect(o.coordination).toMatchObject({ agreed: 2, noAgreement: 1, firstRound: 1, avgRounds: 2, stuck: 1 });
    expect(k.medianDaysToResolve!.value).toBe(12); // resolutions took 18 d and 12 d; nearest-rank p50 of two values is the lower one
    expect(o.digOnce).toMatchObject({ realized: 1, realizedMeters: 250, openCount: 1, openMeters: 400 });
    expect(o.outcomes.verification).toEqual({ cleared: 2, total: 2, rate: 100 });
  });

  it("builds the funnel with null instead of fabricated zero medians", () => {
    const o = overview({ ...fixture(), reqs: [], ress: [] }, opts);
    const f = Object.fromEntries(o.funnel.map((x) => [x.key, x]));
    expect(f.recorded!.count).toBe(3);
    expect(f.coordination).toMatchObject({ count: 0, medianDays: null });
    expect(f.resolved!.medianDays).toBeNull();
  });

  it("measures a past period as of its own end, not as of now", () => {
    const past = rangeOf("custom", "2020-01-01", "2020-01-07", NOW)!;
    const o = overview(fixture(), { ...opts, range: past });
    expect(o.health.score).toBeNull();
    expect(o.health.cases).toBe(0);
    expect(o.backlogAging.oldest).toBeNull();
    expect(o.kpis.find((k) => k.key === "openConflicts")!.value).toBe(0);
  });

  it("derives the previous-period delta and keeps null when there is no baseline", () => {
    const o = overview(fixture(), { ...opts, compare: true });
    const open = o.kpis.find((x) => x.key === "openConflicts")!;
    expect(open.previous).toBeTypeOf("number");
    const dig = o.kpis.find((x) => x.key === "digOnceMeters")!;
    expect(dig.previous).toBe(0);
    expect(dig.delta).toEqual({ abs: 250, pct: null });
  });
});

describe("step 78 health score", () => {
  const all = (v: number) => ({ ackTimeliness: v, responseTimeliness: v, resolutionProgress: v, backlogHealth: v, commitmentCompletion: v });
  it("weights sum to 100, renormalizes missing components and needs enough cases", () => {
    expect(Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    const h = health({ ...all(80), commitmentCompletion: null }, 9);
    expect(h.excluded).toEqual(["commitmentCompletion"]);
    expect(h.components.reduce((n, c) => n + c.weight, 0)).toBeCloseTo(100, 0);
    expect(h.score).toBe(80);
    expect(health(all(90), 4).score).toBeNull();
    expect(health(all(90), 4).insufficientData).toBe(true);
  });
  it("applies the grade boundaries", () => {
    const g = (n: number) => health(all(n), 5).grade;
    expect([g(49), g(50), g(69), g(70), g(84), g(85)]).toEqual(["at_risk", "needs_attention", "needs_attention", "good", "good", "excellent"]);
  });
  it("shares benchmark medians only with a cohort of three eligible agencies", () => {
    const card = (id: string) => ({ ...scorecard(fixture(), "A", RANGE, NOW), agencyId: id, cases: 6 });
    expect(benchmark([card("A"), card("B")])).toBeNull();
    expect(benchmark([card("A"), card("B"), card("C")])!.cohort).toBe(3);
  });
});

describe("step 78 signals", () => {
  const scoped = (over: Partial<Data> = {}): Data => ({ records: [], reqs: [], ress: [], ams: [], ...over });
  const nat = { national: true, viewerAgencies: null, approvalsOverdue: 0 };
  const codes = (d: Data, o = nat) => signals(d, NOW, o).map((s) => s.code);
  it("stays quiet on an empty scope", () => expect(codes(scoped())).toEqual([]));
  it("fires each rule on a minimal fixture", () => {
    const soon = rec("1", { band: "critical", overlapStart: day(2), overlapEnd: day(6) });
    expect(codes(scoped({ records: [soon] }))).toContain("critical_starting_uncoordinated");
    expect(codes(scoped({ records: [soon], reqs: [req("q", "1", { status: "agreed" })] }))).not.toContain("critical_starting_uncoordinated");
    const three = [rec("1"), rec("2"), rec("3")].map((r) => ({ ...r, agencies: [ag("A")] }));
    expect(codes(scoped({ records: three }))).toContain("overdue_acks_cluster");
    expect(codes(scoped({ records: three.slice(0, 2) }))).not.toContain("overdue_acks_cluster");
    expect(codes(scoped({ reqs: [req("q", "1", { lastActivityAt: day(-11) })] }))).toContain("stuck_negotiation");
    expect(codes(scoped({ reqs: [req("q", "1", { lastActivityAt: day(-9) })] }))).not.toContain("stuck_negotiation");
    expect(codes(scoped({ ress: [res("1", { status: "needs_followup", active: true, outcome: null })] }))).toContain("verification_followup");
    expect(codes(scoped(), { ...nat, approvalsOverdue: 0 })).not.toContain("approvals_overdue");
    const risen = rec("1", { status: "resolved", outcome: "risk_accepted", resolvedBand: "medium", band: "high", closedAt: day(-3), resolvedAt: day(-3) });
    expect(codes(scoped({ records: [risen] }))).toContain("risk_accepted_rising");
    const opp = rec("2", { recordType: "opportunity", overlapStart: day(1), overlapEnd: day(5), trenchMeters: 150 });
    expect(codes(scoped({ records: [opp] }))).toContain("opportunity_window_closing");
    expect(codes(scoped({ records: [{ ...opp, trenchMeters: 50 }] }))).not.toContain("opportunity_window_closing");
    const old = [rec("1", { createdAt: day(-40) }), rec("2")];
    expect(codes(scoped({ records: old }))).toContain("backlog_aging");
    expect(codes(scoped({ records: [rec("1", { createdAt: day(-2) })] }))).not.toContain("backlog_aging");
  });
  it("shows escalation-unattended to national only and orders by severity", () => {
    const esc = req("q", "1", { escalated: true, escalatedAt: day(-5), lastActivityAt: day(-4) });
    expect(codes(scoped({ reqs: [esc] }))).toContain("escalated_unattended");
    expect(codes(scoped({ reqs: [esc] }), { national: false, viewerAgencies: new Set(["A"]), approvalsOverdue: 0 })).not.toContain("escalated_unattended");
    const sig = signals(scoped({ reqs: [esc, req("q2", "1", { lastActivityAt: day(-11) })], ress: [res("1", { status: "needs_followup", active: true, outcome: null })] }), NOW, nat);
    expect(sig.map((s) => s.severity)).toEqual(["critical", "warning", "info"]);
    expect(sig.length).toBeLessThanOrEqual(8);
  });
});

// ---------- integration: scoping, parity, anonymity, cache isolation, export, validation ----------
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

describe("step 78 dashboard API", { timeout: 240_000 }, () => {
  const app = createApp();
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step78-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step78-0123456789abcdef";
    await startIsolatedMongo();
    for (const m of [WorkRequest, Candidate, Project, ConflictRecord, Notification, CoordinationRequest, Resolution, Amendment, LedgerEntry]) await m.init();
  }, 300_000);
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 500));
    clearDashboardCache();
    for (const m of [LedgerEntry, Amendment, Resolution, CoordinationMessage, CoordinationRead, CoordinationRequest, ConflictRecord, ConflictRead, Candidate, WorkRequest, Project, Notification]) await m.deleteMany({});
    await clearCoreCollections(); await AuditLog.collection.deleteMany({});
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = (token: string | null, path: string) => { const r = request(app).get(`/api/v1/roadsync${path}`); return token ? r.set(auth(token)) : r; };

  async function ready() {
    await seedRoles();
    const [agA, agB, agC] = await Promise.all(["A", "B", "C"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa78@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob78@example.com", "AGENCY_OFFICER", agB!._id);
    const officerC = await actor("oc78@example.com", "AGENCY_OFFICER", agC!._id);
    const superUser = await actor("su78@example.com", "SUPER_ADMIN", agA!._id);
    const citizen = await actor("ci78@example.com", "CITIZEN", agA!._id);
    const mk = (code: string, agencyId: unknown) => Project.create({ projectCode: code, title: `T ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id });
    const [pA, pB] = await Promise.all([mk("INF-AS-71", agA!._id), mk("INF-AS-72", agB!._id)]);
    const subject = await WorkRequest.create({ agencyId: agA!._id, projectId: pA!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "PIPELINE_INSTALLATION", priority: "NORMAL", plannedStart: at(5), plannedEnd: at(15) });
    await WorkRequest.create({ agencyId: agB!._id, projectId: pB!._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.865, 6.925], [79.865, 6.935]] }, workType: "ELECTRIC_CABLE_WORK", priority: "CRITICAL", plannedStart: at(6), plannedEnd: at(12) });
    await request(app).post(`/api/v1/roadsync/work-requests/${subject.id}/detection/run`).set(auth(officerA.token)).send();
    await waitFor(async () => (await ConflictRecord.countDocuments({ recordType: "conflict" })) === 1);
    return { agA: agA!, agB: agB!, officerA, officerB, officerC, superUser, citizen };
  }
  const kpi = (body: { data: { kpis: { key: string; value: number | null }[] } }, key: string) => body.data.kpis.find((k) => k.key === key)!.value;

  it("scopes every number to the viewer and keeps unrelated agencies at zero", async () => {
    const d = await ready();
    const a = (await get(d.officerA.token, "/dashboard/overview")).body;
    const b = (await get(d.officerB.token, "/dashboard/overview")).body;
    const c = (await get(d.officerC.token, "/dashboard/overview")).body;
    const n = (await get(d.superUser.token, "/dashboard/overview")).body;
    expect(a.data.scope.level).toBe("agency");
    expect(n.data.scope.level).toBe("national");
    expect([kpi(a, "openConflicts"), kpi(b, "openConflicts"), kpi(n, "openConflicts")]).toEqual([1, 1, 1]);
    expect(kpi(c, "openConflicts")).toBe(0);
    expect(c.data.signals).toEqual([]);
    const mapC = (await get(d.officerC.token, "/dashboard/map")).body.data;
    const calC = (await get(d.officerC.token, "/dashboard/calendar")).body.data;
    expect(mapC.bins).toEqual([]);
    expect(calC.days.every((x: { activeCount: number }) => x.activeCount === 0)).toBe(true);
    expect((await get(d.officerA.token, "/dashboard/map")).body.data.bins.length).toBeGreaterThan(0);
  });

  it("matches the drilled-down list counts and the nav-badge summaries exactly", async () => {
    const d = await ready();
    for (const who of [d.officerA, d.officerB, d.superUser]) {
      const o = (await get(who.token, "/dashboard/overview")).body;
      const list = async (q: string) => (await get(who.token, `/conflicts?${q}&limit=1`)).body.data.total as number;
      const open = "status=open,acknowledged,awaiting_response,negotiating,escalated";
      expect(kpi(o, "openConflicts")).toBe(await list(`${open}&recordType=conflict`));
      expect(kpi(o, "criticalHigh")).toBe(await list(`${open}&band=critical,high`));
      const sum = (await get(who.token, "/conflicts/summary")).body.data;
      expect(o.data.attention.needsMyAck).toBe(sum.needsMyAck);
      expect(o.data.attention.startingSoon).toBe(sum.startingIn14d);
      expect(o.data.attention.overdue.acks).toBe(sum.overdue);
      const appr = (await get(who.token, "/approvals/summary")).body.data;
      expect(o.data.attention.needsMyApproval).toBe(appr.pending);
      expect(o.data.attention.overdue.approvals).toBe(appr.overdue);
    }
  });

  it("never gives agency users another agency's name, id or ranking and enforces the benchmark cohort", async () => {
    const d = await ready();
    const own = await get(d.officerA.token, "/dashboard/agencies");
    expect(own.body.data.level).toBe("agency");
    expect(own.body.data.benchmark).toBeNull();
    expect(own.body.data.benchmarkUnavailable).toBe("cohort_too_small");
    for (const path of ["/dashboard/agencies", "/dashboard/overview", "/dashboard/brief", "/dashboard/map", "/dashboard/calendar", "/dashboard/export.csv"]) {
      const text = JSON.stringify((await get(d.officerA.token, path)).body) + ((await get(d.officerA.token, path)).text ?? "");
      expect(text).not.toContain(String(d.agB._id));
      expect(text).not.toContain("Agency B");
    }
    const nat = (await get(d.superUser.token, "/dashboard/agencies")).body.data;
    expect(nat.level).toBe("national");
    expect(nat.items.map((x: { agencyName: string }) => x.agencyName).sort()).toEqual(["Agency A", "Agency B"]);
  });

  it("keeps cache entries per scope and limits refresh to national roles", async () => {
    const d = await ready();
    const nat1 = (await get(d.superUser.token, "/dashboard/overview")).body.data;
    const nat2 = (await get(d.superUser.token, "/dashboard/overview")).body.data;
    expect([nat1.cached, nat2.cached]).toEqual([false, true]);
    const agency = (await get(d.officerA.token, "/dashboard/overview")).body.data;
    expect(agency.cached).toBe(false);
    expect(agency.scope.level).toBe("agency");
    expect((await get(d.officerA.token, "/dashboard/overview?refresh=true")).status).toBe(403);
    const forced = (await get(d.superUser.token, "/dashboard/overview?refresh=true")).body.data;
    expect(forced.cached).toBe(false);
  });

  it("exports a scoped, sanitized CSV with a count-only audit entry and a brief without free text", async () => {
    const d = await ready();
    await Agency.updateOne({ _id: d.agB._id }, { $set: { name: "=HYPERLINK(1)" } });
    const before = await AuditLog.countDocuments({ action: "roadsync.conflict_record.exported" });
    const csv = await get(d.superUser.token, "/dashboard/export.csv");
    expect(csv.status).toBe(200);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain("'=HYPERLINK(1)");
    expect(csv.text).not.toMatch(/(^|,)=HYPERLINK/m);
    const audits = await AuditLog.find({ action: "roadsync.conflict_record.exported" }).lean();
    expect(audits.length).toBe(before + 1);
    expect(JSON.stringify(audits)).not.toContain("HYPERLINK");
    const brief = (await get(d.superUser.token, "/dashboard/brief")).body.data;
    expect(Object.keys(brief).sort()).toEqual(["cached", "generatedAt", "health", "kpis", "range", "scope", "scorecards", "signals", "topCritical"]);
    expect(Object.keys(brief.topCritical[0] ?? { conflictNo: 1 }).every((k) => ["conflictNo", "band", "classes", "start", "end", "district", "ageDays"].includes(k))).toBe(true);
  });

  it("rejects bad input and unauthorized callers at the API", async () => {
    const d = await ready();
    expect((await get(null, "/dashboard/overview")).status).toBe(401);
    expect((await get(d.citizen.token, "/dashboard/overview")).status).toBe(403);
    expect((await get(d.superUser.token, "/dashboard/overview?range=custom&from=2024-01-01&to=2026-06-01")).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?range=custom&from=2026-05-01")).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?range=30d&from=2026-05-01&to=2026-05-20")).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?bogus=1")).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?range=999d")).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?district=Atlantis")).status).toBe(400);
    expect((await get(d.superUser.token, `/dashboard/overview?agencyId=${"0".repeat(24)}`)).status).toBe(400);
    expect((await get(d.superUser.token, "/dashboard/overview?district[$ne]=x")).status).toBe(400);
    // Agency users cannot choose their own scope.
    expect((await get(d.officerA.token, `/dashboard/overview?agencyId=${d.agB._id}`)).status).toBe(403);
    expect((await get(d.officerA.token, "/dashboard/overview?district=Colombo")).status).toBe(403);
  });
});
