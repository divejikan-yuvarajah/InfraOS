import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { assignmentHooks } from "../src/modules/contractors/contractor-assignment.service.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const as = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
});
let seq = 0;
const newContractor = (agencyId: unknown, patch: Record<string, unknown> = {}) => { seq += 1; return Contractor.create({ name: `Contractor ${seq}`, registrationNumber: `T-${seq}`, registeredByAgencyId: agencyId, category: "GENERAL", status: "ACTIVE", ...patch }); };
const day = "2026-02-01";

describe("contractor assignments (Step 93)", { timeout: 120_000 }, () => {
  let w: World;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); await Contractor.syncIndexes(); await ContractorAssignment.syncIndexes(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { assignmentHooks.beforeAudit = async () => {}; await clearCoreCollections(); await AuditLog.collection.deleteMany({}); await Promise.all([Project.deleteMany({}), Contractor.deleteMany({}), ContractorAssignment.deleteMany({})]); });

  it("assigns PRIMARY, syncs Project.contractorId, refuses a second PRIMARY with requiresReassignment, allows ADDITIONAL", async () => {
    w = await contractorWorld();
    const [p, c1, c2, c3] = [await makeProject(w.child._id), await newContractor(w.ministry._id), await newContractor(w.ministry._id), await newContractor(w.ministry._id)];
    const gov = as(w.gov.token);
    const ok = await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c1._id), role: "PRIMARY", startDate: day, contractReference: "CT-1", contractValueMinor: 1_999_999 });
    expect(ok.status).toBe(201);
    expect(String((await Project.findById(p._id))!.contractorId)).toBe(String(c1._id));
    const second = await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c2._id), role: "PRIMARY", startDate: day });
    expect(second.status).toBe(409);
    expect(second.body.error.details).toMatchObject({ kind: "primary_exists", requiresReassignment: true });
    expect((await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c2._id), role: "ADDITIONAL", startDate: day })).status).toBe(201);
    expect((await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c2._id), role: "ADDITIONAL", startDate: day })).status).toBe(409); // same pair twice
    expect((await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c3._id), role: "ADDITIONAL", startDate: day, contractValueMinor: 1.5 })).status).toBe(400); // money is integer cents
    const row = (await ContractorAssignment.findOne({ contractorId: c1._id }))!;
    expect(row.contractValue?.amountMinor).toBe(1_999_999);
    const audit = (await AuditLog.findOne({ action: "contractor.assigned" }).select("+newValue"))!;
    expect(audit.newValue?.amount?.amountMinor).toBe(1_999_999);
    expect(String(audit.newValue?.projectId)).toBe(String(p._id));
  });

  it("blocks assignment to suspended/inactive contractors and archive while assignments are ACTIVE", async () => {
    w = await contractorWorld();
    const p = await makeProject(w.child._id);
    const c = await newContractor(w.ministry._id);
    const gov = as(w.gov.token);
    expect((await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day })).status).toBe(201);
    const archive = await gov.post(`/contractors/${c._id}/status`, { status: "ARCHIVED", reason: "Trying to archive busy contractor" });
    expect(archive.status).toBe(409);
    expect(archive.body.error.details.kind).toBe("active_assignments");
    expect(archive.body.error.details.impact).toHaveLength(1);
    const noAck = await gov.post(`/contractors/${c._id}/status`, { status: "SUSPENDED", reason: "Safety audit failed on site" });
    expect(noAck.status).toBe(409);
    expect(noAck.body.error.details.kind).toBe("impact_ack_required");
    expect((await gov.post(`/contractors/${c._id}/status`, { status: "SUSPENDED", reason: "Safety audit failed on site", acknowledgeImpact: true })).status).toBe(200);
    const p2 = await makeProject(w.child._id);
    const refused = await gov.post(`/projects/${p2._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day });
    expect(refused.status).toBe(409);
    expect(refused.body.error.details.kind).toBe("contractor_inactive");
  });

  it("ends an assignment, keeps the row, clears the project pointer, and can promote an additional contractor", async () => {
    w = await contractorWorld();
    const p = await makeProject(w.child._id);
    const [c1, c2] = [await newContractor(w.ministry._id), await newContractor(w.ministry._id)];
    const gov = as(w.gov.token);
    const a1 = (await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c1._id), role: "PRIMARY", startDate: day })).body.data.id;
    const a2 = (await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c2._id), role: "ADDITIONAL", startDate: day })).body.data.id;
    expect((await gov.post(`/projects/${p._id}/contractors/${a1}/end`, { status: "TERMINATED", endDate: "2026-01-01", endReason: "Ends before it started" })).status).toBe(400);
    expect((await gov.post(`/projects/${p._id}/contractors/${a1}/end`, { status: "TERMINATED", endDate: "2026-03-01", endReason: "Contract breach confirmed", promoteAssignmentId: a2 })).status).toBe(200);
    expect(String((await Project.findById(p._id))!.contractorId)).toBe(String(c2._id));
    const rows = await ContractorAssignment.find({ projectId: p._id }).sort({ createdAt: 1 });
    expect(rows.map((r) => [r.role, r.status])).toEqual([["PRIMARY", "TERMINATED"], ["PRIMARY", "ACTIVE"]]);
    expect((await gov.post(`/projects/${p._id}/contractors/${a1}/end`, { status: "ENDED", endDate: "2026-03-02", endReason: "Ending twice should fail" })).status).toBe(409);
    expect((await gov.post(`/projects/${p._id}/contractors/${rows[1]!._id}/end`, { status: "ENDED", endDate: "2026-04-01", endReason: "Work finished and handed over" })).status).toBe(200);
    expect((await Project.findById(p._id))!.contractorId).toBeUndefined();
    expect(await ContractorAssignment.countDocuments({ projectId: p._id })).toBe(2); // history kept
  });

  it("reassigns atomically: both rows change together, or nothing changes when the transaction fails", async () => {
    w = await contractorWorld();
    const p = await makeProject(w.child._id);
    const [c1, c2] = [await newContractor(w.ministry._id), await newContractor(w.ministry._id)];
    const gov = as(w.gov.token);
    const a1 = (await gov.post(`/projects/${p._id}/contractors`, { contractorId: String(c1._id), role: "PRIMARY", startDate: day })).body.data.id;
    const payload = { newContractorId: String(c2._id), effectiveDate: "2026-03-01", reason: "Replaced after repeated delays" };

    assignmentHooks.beforeAudit = async () => { throw new Error("simulated failure after the writes"); };
    const failed = await gov.post(`/projects/${p._id}/contractors/${a1}/reassign`, payload);
    expect(failed.status).toBe(503);
    expect((await ContractorAssignment.findById(a1))!.status).toBe("ACTIVE");
    expect(await ContractorAssignment.countDocuments({ projectId: p._id })).toBe(1);
    expect(String((await Project.findById(p._id))!.contractorId)).toBe(String(c1._id));
    expect(await AuditLog.countDocuments({ action: "contractor.reassigned" })).toBe(0);

    assignmentHooks.beforeAudit = async () => {};
    const ok = await gov.post(`/projects/${p._id}/contractors/${a1}/reassign`, payload);
    expect(ok.status).toBe(200);
    const old = (await ContractorAssignment.findById(a1))!;
    expect(old.status).toBe("REPLACED");
    expect(String(old.replacedByAssignmentId)).toBe(ok.body.data.id);
    expect(String((await Project.findById(p._id))!.contractorId)).toBe(String(c2._id));
    expect(await AuditLog.countDocuments({ action: "contractor.reassigned" })).toBe(2);
    expect((await gov.post(`/projects/${p._id}/contractors/${a1}/reassign`, payload)).status).toBe(409); // no longer active
  });

  it("scope: other agencies cannot assign or read; a project manager only assigns on their own projects; read-only roles cannot write", async () => {
    w = await contractorWorld();
    const mine = await makeProject(w.child._id, { managerId: w.manager.user._id });
    const notMine = await makeProject(w.child._id, { managerId: w.officer.user._id });
    const c = await newContractor(w.ministry._id);
    const body = { contractorId: String(c._id), role: "PRIMARY", startDate: day };
    expect((await as(w.otherGov.token).post(`/projects/${mine._id}/contractors`, body)).status).toBe(404);
    expect((await as(w.siblingOfficer.token).get(`/projects/${mine._id}/contractors`)).status).toBe(404);
    expect((await as(w.officer.token).post(`/projects/${mine._id}/contractors`, body)).status).toBe(403); // no contractor.manage
    expect((await as(w.contractorUser.token).post(`/projects/${mine._id}/contractors`, body)).status).toBe(403);
    expect((await as(w.otherGov.token).post(`/projects/${mine._id}/contractors`, { ...body, contractorId: "zzz" })).status).toBe(400);
    const gov = as(w.gov.token);
    expect((await gov.post(`/projects/${notMine._id}/contractors`, body)).status).toBe(201);
    expect((await gov.post(`/projects/${"b".repeat(24)}/contractors`, body)).status).toBe(404);
  });

  it("refuses assignment to closed projects and to contractors the actor cannot see", async () => {
    w = await contractorWorld();
    const done = await makeProject(w.child._id, { status: "COMPLETED" });
    const open = await makeProject(w.child._id);
    const c = await newContractor(w.ministry._id);
    const foreign = await newContractor(w.other._id);
    const gov = as(w.gov.token);
    const closed = await gov.post(`/projects/${done._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day });
    expect(closed.status).toBe(409);
    expect(closed.body.error.details.kind).toBe("project_state");
    expect((await gov.post(`/projects/${open._id}/contractors`, { contractorId: String(foreign._id), role: "PRIMARY", startDate: day })).status).toBe(404);
    // A platform admin can see every contractor.
    expect((await as(w.superUser.token).post(`/projects/${open._id}/contractors`, { contractorId: String(foreign._id), role: "PRIMARY", startDate: day })).status).toBe(201);
  });

  it("history and project lists show only in-scope projects, tier contract values, and never delete anything", async () => {
    w = await contractorWorld();
    const mine = await makeProject(w.child._id, { title: "In scope road" });
    const secret = await makeProject(w.other._id, { title: "Other ministry secret" });
    const c = await newContractor(w.ministry._id);
    await as(w.superUser.token).post(`/projects/${mine._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day, contractValueMinor: 500_000 });
    await as(w.superUser.token).post(`/projects/${secret._id}/contractors`, { contractorId: String(c._id), role: "ADDITIONAL", startDate: day });

    const gov = await as(w.gov.token).get(`/contractors/${c._id}/assignments`);
    expect(gov.status).toBe(200);
    expect(gov.body.data.total).toBe(1);
    expect(gov.body.data.rows[0].project.title).toBe("In scope road");
    expect(gov.body.data.rows[0].contractValue).toEqual({ amountMinor: 500_000, currency: "LKR" });
    expect(JSON.stringify(gov.body)).not.toContain("secret");
    const all = await as(w.superUser.token).get(`/contractors/${c._id}/assignments?view=all`);
    expect(all.body.data.total).toBe(2);
    expect((await as(w.gov.token).get(`/contractors/${c._id}/assignments?view=completed`)).body.data.total).toBe(0);
    expect((await as(w.gov.token).get(`/contractors/${c._id}/assignments?bogus=1`)).status).toBe(400);

    // PM/officer: contractor.read without manage/budget. The officer holds finance.budget.read, the contractor user does not read at all.
    const asOfficer = await as(w.officer.token).get(`/projects/${mine._id}/contractors`);
    expect(asOfficer.status).toBe(200);
    expect(asOfficer.body.data.rows).toHaveLength(1);
    expect(asOfficer.body.data.can.assign).toBe(false);
    expect((await as(w.gov.token).get(`/projects/${mine._id}/contractors`)).body.data.can.assign).toBe(true);
    expect((await as(w.otherGov.token).get(`/contractors/${c._id}/assignments`)).status).toBe(200); // visible via its own project assignment
    expect((await as(w.otherGov.token).get(`/contractors/${c._id}/assignments`)).body.data.total).toBe(1);
  });

  it("timeline: merged newest-first events from in-scope data, cursor paginated, no audit leakage across scope", async () => {
    w = await contractorWorld();
    const mine = await makeProject(w.child._id, { title: "Timeline road" });
    const hidden = await makeProject(w.other._id, { title: "Hidden project" });
    const c = await newContractor(w.ministry._id, { certifications: [{ name: "CIDA", expiresOn: new Date("2020-01-01"), status: "VALID" }] });
    await as(w.superUser.token).post(`/projects/${mine._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day });
    await as(w.superUser.token).post(`/projects/${hidden._id}/contractors`, { contractorId: String(c._id), role: "PRIMARY", startDate: day });
    await as(w.gov.token).post(`/contractors/${c._id}/status`, { status: "SUSPENDED", reason: "Under review after incident", acknowledgeImpact: true });
    const t = await as(w.gov.token).get(`/contractors/${c._id}/timeline?limit=2`);
    expect(t.status).toBe(200);
    expect(t.body.data.events).toHaveLength(2);
    expect(t.body.data.nextCursor).toBe("o2");
    const types = [...t.body.data.events, ...(await as(w.gov.token).get(`/contractors/${c._id}/timeline?cursor=o2&limit=20`)).body.data.events].map((e: { type: string }) => e.type);
    expect(types).toContain("audit.status_changed");
    expect(types).toContain("assignment.started");
    expect(types).toContain("certification.expired");
    expect(JSON.stringify(t.body)).not.toContain("Hidden");
    const full = JSON.stringify((await as(w.gov.token).get(`/contractors/${c._id}/timeline?limit=50`)).body);
    expect(full).not.toContain("Hidden project");
    // Directory tier (officer sees it via assignment): no reasons, no actors.
    const dir = JSON.stringify((await as(w.officer.token).get(`/contractors/${c._id}/timeline?limit=50`)).body);
    expect(dir).not.toContain("Under review after incident");
    expect((await as(w.gov.token).get(`/contractors/${c._id}/timeline?cursor=bad`)).status).toBe(400);
    expect((await as(w.otherGov.token).get(`/contractors/${"c".repeat(24)}/timeline`)).status).toBe(404);
  });
});
