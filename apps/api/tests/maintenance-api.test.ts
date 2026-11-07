import { createHash } from "node:crypto";

import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { maintenanceHooks } from "../src/modules/assets/maintenance.service.js";
import { AssetConditionAssessment } from "../src/modules/assets/models/asset-condition-assessment.model.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { MaintenanceEvidence } from "../src/modules/assets/models/maintenance-evidence.model.js";
import { MaintenanceRecord } from "../src/modules/assets/models/maintenance-record.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, makeUser, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const call = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  del: (p: string, b: unknown) => request(app).delete(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  putFile: (p: string, bytes: Buffer) => request(app).put(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "image/jpeg").send(bytes),
});
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("synthetic-maintenance".padEnd(64, "x"))]);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const when = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("maintenance workflow API (Step 105)", { timeout: 180_000 }, () => {
  let w: World;
  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Asset.syncIndexes(), MaintenanceRecord.syncIndexes(), MaintenanceEvidence.syncIndexes(), AssetConditionAssessment.syncIndexes()]);
  }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    maintenanceHooks.beforeAudit = async () => {};
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Asset.deleteMany({}), MaintenanceRecord.deleteMany({}), MaintenanceEvidence.deleteMany({}), Document.deleteMany({}), Counter.deleteMany({}), AssetConditionAssessment.collection.deleteMany({})]);
    for (const c of ["inspectionEvidence.files", "inspectionEvidence.chunks"]) await mongoose.connection.collection(c).deleteMany({});
  });

  async function asset() {
    const project = await makeProject(w.child._id, { status: "COMPLETED", managerId: w.manager.user._id });
    return Asset.create({ assetNo: "AST-2026-000001", sourceProjectId: project._id, origin: "CONVERSION", assetType: "ROAD", name: "Road (Synthetic)", agencyId: w.child._id, constructionAgencyId: w.child._id, operationalStatus: "IN_SERVICE", condition: "GOOD", commissionedAt: new Date("2026-01-01"), monitoringIntervalDays: 365, version: 0 });
  }
  const req = (token: string, assetId: unknown, over: Record<string, unknown> = {}) => call(token).post(`/assets/${assetId}/maintenance`, { title: "Fill potholes (Synthetic)", maintenanceType: "CORRECTIVE", priority: "HIGH", scheduledDate: when(5), tasks: [{ key: "clean", title: "Clean the area" }, { key: "fill", title: "Fill and compact" }], ...over });

  it("request, approve (maker-checker), schedule, start, complete: condition never changes by itself, and a recurrence is created once", async () => {
    w = await contractorWorld();
    const a = await asset();
    expect((await call(w.inspector.token).post(`/assets/${a._id}/maintenance`, {})).status).toBe(403);
    expect((await req(w.contractorUser.token, a._id)).status).toBe(403);
    expect((await req(w.siblingOfficer.token, a._id)).status).toBe(404);
    const created = await req(w.manager.token, a._id, { maintenanceType: "PREVENTIVE", recurrenceDays: 180, estimatedCost: "25000.00" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: "REQUESTED" });
    expect(created.body.data.maintenanceNo).toMatch(/^MNT-\d{4}-000001$/);
    const id = created.body.data.id as string;
    expect((await req(w.manager.token, a._id, { plan: true })).status).toBe(403); // planning needs maintenance.update
    expect((await call(w.manager.token).post(`/maintenance/${id}/approve`, {})).status).toBe(403); // the requester role cannot approve
    expect((await call(w.officer.token).post(`/maintenance/${id}/start`, {})).status).toBe(409); // not scheduled yet
    const approved = await call(w.officer.token).post(`/maintenance/${id}/approve`, { note: "Approved (Synthetic)" });
    expect(approved.status).toBe(200);
    expect((await MaintenanceRecord.findById(id))!.status).toBe("PLANNED");
    expect((await call(w.officer.token).post(`/maintenance/${id}/schedule`, { scheduledDate: when(-1), assignedTeam: "Road crew A" })).status).toBe(200);
    expect((await Asset.findById(a._id))!.nextMaintenanceAt).toBeTruthy();
    expect((await call(w.officer.token).post(`/maintenance/${id}/start`, {})).status).toBe(200);
    expect((await Asset.findById(a._id))!.operationalStatus).toBe("UNDER_MAINTENANCE");

    const incomplete = await call(w.officer.token).post(`/maintenance/${id}/complete`, { completedDate: new Date().toISOString(), completionNotes: "Potholes were filled and compacted (Synthetic).", outcome: "RESOLVED", cost: "21500.50" });
    expect(incomplete.status).toBe(400); // tasks neither done nor skipped with a note
    expect(incomplete.body.error.details.reason).toBe("tasks_unresolved");
    expect((await call(w.officer.token).patch(`/maintenance/${id}/tasks/clean`, { done: true })).status).toBe(200);
    const noNotes = await call(w.officer.token).post(`/maintenance/${id}/complete`, { completedDate: new Date().toISOString(), completionNotes: "short", outcome: "RESOLVED", tasks: [{ key: "fill", done: false, skippedNote: "Not needed after inspection" }] });
    expect(noNotes.status).toBe(400);

    maintenanceHooks.beforeAudit = async () => { throw new Error("simulated failure"); };
    const complete = { completedDate: new Date().toISOString(), completionNotes: "Potholes were filled and compacted (Synthetic).", outcome: "RESOLVED", cost: "21500.50", tasks: [{ key: "fill", done: true }] };
    expect((await call(w.officer.token).post(`/maintenance/${id}/complete`, complete)).status).toBe(503);
    expect((await MaintenanceRecord.findById(id))!.status).toBe("IN_PROGRESS"); // nothing persisted
    expect(await MaintenanceRecord.countDocuments({ origin: "RECURRENCE" })).toBe(0);
    maintenanceHooks.beforeAudit = async () => {};
    const done = await call(w.officer.token).post(`/maintenance/${id}/complete`, complete);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: "COMPLETED", suggestAssessment: true, conditionUnchanged: true });

    const after = (await Asset.findById(a._id))!;
    expect(after.condition).toBe("GOOD"); // maintenance never changes condition
    expect(after.operationalStatus).toBe("IN_SERVICE"); // coupling reverted
    expect(await AssetConditionAssessment.countDocuments({})).toBe(0);
    const rec = await MaintenanceRecord.find({ origin: "RECURRENCE" });
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ status: "PLANNED", recurrenceDays: 180 });
    expect(String(rec[0]!.previousRecordId)).toBe(id);
    const row = (await MaintenanceRecord.findById(id))!;
    expect(row.cost?.amountMinor).toBe(2_150_050); // integer cents
    expect(row.estimatedCost?.amountMinor).toBe(2_500_000);
    expect((await call(w.officer.token).post(`/maintenance/${id}/complete`, complete)).status).toBe(409);
    expect(await MaintenanceRecord.countDocuments({ origin: "RECURRENCE" })).toBe(1);
    const audit = (await AuditLog.findOne({ action: "maintenance.completed" }).select("+newValue"))!;
    expect(Object.keys(audit.toObject().newValue ?? {}).sort()).toEqual(["cost", "status"]);
  });

  it("approver must differ from the requester, except one acknowledged emergency approved by a GOV_ADMIN", async () => {
    w = await contractorWorld();
    const a = await asset();
    const own = await req(w.officer.token, a._id);
    expect((await call(w.officer.token).post(`/maintenance/${own.body.data.id}/approve`, {})).status).toBe(403);
    expect((await call(w.officer.token).post(`/maintenance/${own.body.data.id}/reject`, { note: "Rejecting my own request" })).status).toBe(403);
    expect((await call(w.gov.token).post(`/maintenance/${own.body.data.id}/reject`, { note: "short" })).status).toBe(400);
    expect((await call(w.gov.token).post(`/maintenance/${own.body.data.id}/reject`, { note: "Not needed this quarter" })).status).toBe(200);
    const em = await req(w.gov.token, a._id, { maintenanceType: "EMERGENCY", priority: "URGENT" });
    const eid = em.body.data.id as string;
    expect((await call(w.gov.token).post(`/maintenance/${eid}/approve`, {})).status).toBe(403);
    const officerEm = await req(w.officer.token, a._id, { maintenanceType: "EMERGENCY", priority: "URGENT" });
    expect((await call(w.officer.token).post(`/maintenance/${officerEm.body.data.id}/approve`, { acknowledgeEmergency: true })).status).toBe(403); // not a GOV_ADMIN
    expect((await call(w.gov.token).post(`/maintenance/${eid}/approve`, { acknowledgeEmergency: true })).status).toBe(200);
    const audit = (await AuditLog.findOne({ action: "maintenance.approved" }).select("+newValue"))!;
    expect(audit.toObject().newValue?.reason).toMatch(/emergency/);
  });

  it("overdue is derived, direct plans skip approval, cancelled work frees the asset, and repeat failures are flagged on the passport", async () => {
    w = await contractorWorld();
    const a = await asset();
    const plan = await req(w.officer.token, a._id, { plan: true, scheduledDate: when(-3), title: "Late planned job (Synthetic)" });
    expect(plan.body.data.status).toBe("PLANNED");
    expect((await call(w.officer.token).get(`/maintenance/${plan.body.data.id}`)).body.data.overdue).toBe(true);
    expect((await MaintenanceRecord.findById(plan.body.data.id))!.status).toBe("PLANNED"); // OVERDUE is never written
    const passport = (await call(w.officer.token).get(`/assets/${a._id}`)).body.data;
    expect(passport.maintenance[0].overdue).toBe(true);
    expect(passport.health).toMatchObject({ availability: "INSUFFICIENT_EVIDENCE" }); // no assessment, so no score even with maintenance data
    expect((await call(w.officer.token).post(`/maintenance/${plan.body.data.id}/cancel`, { reason: "short" })).status).toBe(400);
    expect((await call(w.officer.token).post(`/maintenance/${plan.body.data.id}/cancel`, { reason: "Superseded by the planned resurfacing" })).status).toBe(200);
    for (let i = 0; i < 3; i += 1) await MaintenanceRecord.create({ assetId: a._id, agencyId: w.child._id, maintenanceNo: `MNT-2026-9000${i}0`, maintenanceType: "CORRECTIVE", status: "COMPLETED", scheduledDate: new Date(Date.now() - (30 + i) * 86_400_000), completedDate: new Date(Date.now() - (29 + i) * 86_400_000), priority: "NORMAL", origin: "REQUEST", version: 0 });
    expect((await call(w.officer.token).get(`/assets/${a._id}`)).body.data.repeatFailures).toEqual({ flagged: true, count: 3 });
  });

  it("scope: other agencies get 404, inspectors and contractors see nothing, filters and the calendar are server-side", async () => {
    w = await contractorWorld();
    const a = await asset();
    const r = await req(w.officer.token, a._id, { plan: true });
    const mid = r.body.data.id as string;
    expect((await call(w.siblingOfficer.token).get(`/maintenance/${mid}`)).status).toBe(404);
    expect((await call(w.inspector.token).get(`/maintenance/${mid}`)).status).toBe(404);
    expect((await call(w.inspector.token).get("/maintenance")).body.data.rows).toEqual([]);
    expect((await call(w.contractorUser.token).get("/maintenance")).status).toBe(403);
    expect((await call(w.siblingOfficer.token).get("/maintenance")).body.data.rows).toEqual([]);
    const list = await call(w.officer.token).get("/maintenance?status=PLANNED&type=CORRECTIVE");
    expect(list.body.data.rows).toHaveLength(1);
    expect((await call(w.officer.token).get("/maintenance?status=PLANNED&status=SCHEDULED")).status).toBe(400);
    const cal = await call(w.officer.token).get(`/maintenance/calendar?from=${encodeURIComponent(when(-10))}&to=${encodeURIComponent(when(30))}`);
    expect(cal.status).toBe(200);
    expect(cal.body.data.rows).toHaveLength(1);
    expect((await call(w.officer.token).get(`/maintenance/calendar?from=${encodeURIComponent(when(0))}&to=${encodeURIComponent(when(120))}`)).status).toBe(400);
    const summary = (await call(w.officer.token).get("/maintenance/summary")).body.data;
    expect(summary.counts.requested).toBe(0);
    expect((await call(w.officer.token).patch(`/maintenance/${mid}`, { version: 99, title: "Stale" })).status).toBe(409);
    expect((await call(w.officer.token).patch(`/maintenance/${mid}`, { version: 0, title: "Renamed (Synthetic)", estimatedCost: "100.00" })).status).toBe(200);
    const other = await makeUser("gov-b@example.com", "GOV_ADMIN", w.other._id);
    expect((await call(other.token).get(`/maintenance/${mid}`)).status).toBe(404);
  });

  it("evidence: only while in progress, validated, private, capped and removable", async () => {
    w = await contractorWorld();
    const a = await asset();
    const r = await req(w.officer.token, a._id, { plan: true });
    const id = r.body.data.id as string;
    const meta = { capturedAt: new Date().toISOString(), sha256: sha(jpeg), mimeType: "image/jpeg", width: 10, height: 10, sizeBytes: jpeg.length };
    expect((await call(w.officer.token).post(`/maintenance/${id}/evidence`, meta)).status).toBe(409); // not in progress yet
    await call(w.officer.token).post(`/maintenance/${id}/schedule`, { scheduledDate: when(1) });
    await call(w.officer.token).post(`/maintenance/${id}/start`, {});
    const created = await call(w.officer.token).post(`/maintenance/${id}/evidence`, meta);
    expect(created.status).toBe(201);
    const eid = created.body.data.evidenceId as string;
    expect((await call(w.officer.token).post(`/maintenance/${id}/evidence`, meta)).status).toBe(409); // duplicate hash
    expect((await call(w.officer.token).putFile(`/maintenance/evidence/${eid}/file?variant=full`, Buffer.from("<svg/>"))).status).toBe(400);
    expect((await call(w.officer.token).putFile(`/maintenance/evidence/${eid}/file?variant=full`, Buffer.concat([jpeg.subarray(0, 40), Buffer.from("zz")]))).status).toBe(422);
    expect((await call(w.officer.token).putFile(`/maintenance/evidence/${eid}/file?variant=full`, jpeg)).status).toBe(200);
    const file = await call(w.officer.token).get(`/maintenance/evidence/${eid}/file`);
    expect(file.status).toBe(200);
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect(file.headers["cache-control"]).toMatch(/^private/);
    expect((await call(w.siblingOfficer.token).get(`/maintenance/evidence/${eid}/file`)).status).toBe(404);
    expect((await call(w.contractorUser.token).get(`/maintenance/evidence/${eid}/file`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/maintenance/evidence/${eid}/file`)).status).toBe(401);
    expect((await call(w.gov.token).del(`/maintenance/evidence/${eid}`, { reason: "Wrong job" })).status).toBe(404); // only the uploader
    expect((await call(w.officer.token).del(`/maintenance/evidence/${eid}`, { reason: "Wrong photo, retaking" })).status).toBe(200);
    expect((await call(w.officer.token).get(`/maintenance/evidence/${eid}/file`)).status).toBe(404);
  });
});
