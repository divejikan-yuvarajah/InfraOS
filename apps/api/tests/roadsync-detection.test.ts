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
import { deactivatePairs } from "../src/modules/roadsync/detection.service.js";
import { Candidate } from "../src/modules/roadsync/models/candidate.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { roadsyncEvents } from "../src/modules/roadsync/roadsync.events.js";
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

describe("steps 68-69 roadsync detection", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step68-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step68-0123456789abcdef";
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
  const parallel100 = { type: "LineString", coordinates: [[79.86, 6.9309], [79.87, 6.9309]] };

  async function world() {
    await seedRoles();
    const agencyA = await Agency.create({ code: "DEPT_WEST", name: "Western Roads", type: "DEPARTMENT", status: "ACTIVE" });
    const agencyB = await Agency.create({ code: "MIN_WATER", name: "Water Board", type: "MINISTRY", status: "ACTIVE" });
    const officerA = await actor("oa68@example.com", "AGENCY_OFFICER", agencyA._id);
    const officerB = await actor("ob68@example.com", "AGENCY_OFFICER", agencyB._id);
    const gov = await actor("gov68@example.com", "GOV_ADMIN", agencyA._id);
    const superUser = await actor("su68@example.com", "SUPER_ADMIN", agencyA._id);
    const mk = (code: string, agencyId: unknown, extra: Record<string, unknown> = {}) =>
      Project.create({ projectCode: code, title: `Title ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "APPROVED", physicalProgress: 0, financialProgress: 0, createdBy: officerA.user._id, ...extra });
    const projA = await mk("INF-RS-10", agencyA._id, { geometry: parallel100, startDate: new Date("2026-11-10T04:00:00Z"), plannedEndDate: new Date("2026-11-20T04:00:00Z") });
    const projB = await mk("INF-RS-11", agencyB._id, { description: "SECRET-DESC", geometry: parallel100, startDate: new Date("2026-11-15T04:00:00Z"), plannedEndDate: new Date("2026-11-19T04:00:00Z") });
    const wr = (agencyId: unknown, projectId: unknown, status: string, geometry: unknown, start: string, end: string) =>
      WorkRequest.create({ agencyId, projectId, status, geometry, workType: "ROAD_RESURFACING", plannedStart: new Date(`${start}T04:00:00Z`), plannedEnd: new Date(`${end}T04:00:00Z`) });
    const subject = await wr(agencyA._id, projA._id, "SUBMITTED", lineA, "2026-11-10", "2026-11-20");
    const other = await wr(agencyB._id, projB._id, "SUBMITTED", crossing, "2026-11-18", "2026-11-25");
    const draft = await wr(agencyB._id, projB._id, "DRAFT", crossing, "2026-11-18", "2026-11-25");
    await wr(agencyB._id, projB._id, "CANCELLED", crossing, "2026-11-18", "2026-11-25");
    const draftA = await wr(agencyA._id, projA._id, "DRAFT", lineA, "2026-11-10", "2026-11-20");
    return { officerA, officerB, gov, superUser, projB, subject, other, draft, draftA };
  }
  const run = (token: string, id: string) => request(app).post(`/api/v1/roadsync/work-requests/${id}/detection/run`).set("Authorization", `Bearer ${token}`).send();
  const read = (token: string, id: string, qs = "") => request(app).get(`/api/v1/roadsync/work-requests/${id}/detection${qs}`).set("Authorization", `Bearer ${token}`);
  const list = (token: string, qs: string) => request(app).get(`/api/v1/roadsync/work-requests${qs}`).set("Authorization", `Bearer ${token}`);
  const preview = (token: string, payload: unknown) => request(app).post("/api/v1/roadsync/detect/preview").set("Authorization", `Bearer ${token}`).send(payload as object);
  const keysOf = (res: { body: { data: { candidates: { key: string }[] } } }) => res.body.data.candidates.map((c) => c.key);

  it("finds nearby submitted activity of other agencies, excluding drafts, cancelled, self and the parent project", async () => {
    const d = await world();
    const res = await run(d.officerA.token, d.subject.id);
    expect(res.status).toBe(200);
    expect(res.body.data.detection.status).toBe("completed");
    const got = await read(d.officerA.token, d.subject.id);
    expect(got.status).toBe(200);
    expect(keysOf(got).sort()).toEqual([`project:${d.projB.id}`, `work_request:${d.other.id}`].sort());
    const wr = got.body.data.candidates.find((c: { key: string }) => c.key === `work_request:${d.other.id}`);
    expect(wr.spatial.relation).toBe("intersecting");
    // Self perspective: A is 11 days, B is 8 days, overlap 18-20 Nov = 3 days.
    expect(wr.temporal).toMatchObject({ relation: "partial_overlap", overlapDays: 3, overlapPctOfA: 0.27, overlapPctOfB: 0.38 });
    expect(got.body.data.detection.counts.candidates).toBe(2);
    expect(await AuditLog.countDocuments({ action: "work_request.detection_run" })).toBe(1);
  });

  it("redacts cross-agency items and gives platform-level users full detail", async () => {
    const d = await world();
    await run(d.officerA.token, d.subject.id);
    const own = await read(d.officerA.token, d.subject.id);
    const project = own.body.data.candidates.find((c: { key: string }) => c.key === `project:${d.projB.id}`);
    expect(project.other.detailLevel).toBe("redacted");
    expect(project.other.detail).toBeUndefined();
    expect(JSON.stringify(own.body)).not.toContain("SECRET-DESC");
    expect(project.canOpen).toBe(false);
    const national = await read(d.superUser.token, d.subject.id);
    const full = national.body.data.candidates.find((c: { key: string }) => c.key === `project:${d.projB.id}`);
    expect(full.other.detailLevel).toBe("full");
    expect(full.other.detail.description).toBe("SECRET-DESC");
  });

  it("enforces object-level access and run permissions", async () => {
    const d = await world();
    expect((await read(d.officerB.token, d.subject.id)).status).toBe(404);
    expect((await run(d.officerB.token, d.subject.id)).status).toBe(404);
    expect((await run(d.superUser.token, d.subject.id)).status).toBe(200);
    expect((await request(app).post(`/api/v1/roadsync/work-requests/${d.subject.id}/detection/run`)).status).toBe(401);
    expect((await run(d.officerA.token, d.draftA.id)).status).toBe(409);
    expect((await request(app).get(`/api/v1/roadsync/work-requests/${d.subject.id}/detection`)).status).toBe(401);
  });

  it("is idempotent on re-run and honours the run lock", async () => {
    const d = await world();
    await run(d.officerA.token, d.subject.id);
    const first = await Candidate.find({}).lean();
    await run(d.officerA.token, d.subject.id);
    const second = await Candidate.find({}).lean();
    expect(second.map((c) => String(c._id)).sort()).toEqual(first.map((c) => String(c._id)).sort());
    await WorkRequest.updateOne({ _id: d.subject._id }, { $set: { "detection.status": "running", "detection.startedAt": new Date() } });
    const locked = await run(d.officerA.token, d.subject.id);
    expect(locked.status).toBe(202);
    expect(locked.body.data.detection.status).toBe("running");
  });

  it("runs after the submitted event and deactivates pairs on cancellation", async () => {
    const d = await world();
    roadsyncEvents.emit("workRequestSubmitted", { requestId: d.subject.id });
    for (let i = 0; i < 50 && (await WorkRequest.findById(d.subject.id).lean())?.detection?.status !== "completed"; i += 1) await new Promise((r) => setTimeout(r, 100));
    expect((await WorkRequest.findById(d.subject.id).lean())?.detection?.status).toBe("completed");
    expect(await deactivatePairs(d.other.id)).toBe(1);
    expect(keysOf(await read(d.officerA.token, d.subject.id))).toEqual([`project:${d.projB.id}`]);
    const rows = await list(d.officerA.token, "?hasCandidates=true");
    expect(rows.body.data.workRequests.map((w: { id: string }) => w.id)).toEqual([d.subject.id]);
    expect(rows.body.data.workRequests[0].nearbyCount).toBe(1);
  });

  it("previews without persisting, validates input and works without a schedule", async () => {
    const d = await world();
    const ok = await preview(d.officerB.token, { geometry: lineA });
    expect(ok.status).toBe(200);
    const keys = keysOf({ body: { data: ok.body.data } });
    expect(keys).toContain(`work_request:${d.subject.id}`);
    expect(keys).not.toContain(`work_request:${d.draft.id}`);
    expect(keys).not.toContain(`work_request:${d.draftA.id}`);
    expect(ok.body.data.candidates[0].temporal.relation).toBe("unknown");
    expect(await Candidate.countDocuments({})).toBe(0);
    expect((await preview(d.officerB.token, { geometry: { type: "Point", coordinates: [10, 10] } })).status).toBe(400);
    expect((await preview(d.officerB.token, { geometry: lineA, radiusMeters: 5 })).status).toBe(400);
    expect((await preview(d.officerB.token, { geometry: lineA, radiusMeters: 600 })).status).toBe(400);
    expect((await preview(d.officerB.token, { geometry: lineA, extra: 1 })).status).toBe(400);
    const timed = await preview(d.officerB.token, { geometry: lineA, schedule: { plannedStart: "2026-11-10T00:00:00Z", plannedEnd: "2026-11-12T00:00:00Z" } });
    expect(timed.status).toBe(200);
    expect(timed.body.data.candidates.find((c: { key: string }) => c.key === `work_request:${d.subject.id}`).temporal.relation).toBe("contained");
  });
});
