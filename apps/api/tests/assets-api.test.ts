import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { conversionHooks } from "../src/modules/assets/conversion.service.js";
import { AssetConditionAssessment } from "../src/modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../src/modules/assets/models/asset-conversion.model.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../src/modules/assets/models/maintenance-record.model.js";
import { ProgressVerification } from "../src/modules/inspections/models/progress-verification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, makeUser, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { id } from "./helpers/domain-fixtures.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const call = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1/assets${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1/assets${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1/assets${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
});

describe("asset conversion and asset management API (Steps 103-104)", { timeout: 180_000 }, () => {
  let w: World;
  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Asset.syncIndexes(), AssetConversion.syncIndexes(), AssetConditionAssessment.syncIndexes(), MaintenanceRecord.syncIndexes(), ProgressVerification.syncIndexes()]);
  }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    conversionHooks.beforeAudit = async () => {};
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Asset.deleteMany({}), AssetConversion.deleteMany({}), MaintenanceRecord.deleteMany({}), Counter.deleteMany({}), ProgressVerification.collection.deleteMany({}), AssetConditionAssessment.collection.deleteMany({})]);
  });

  async function completed(over: Record<string, unknown> = {}, verified = true) {
    const project = await makeProject(w.child._id, { status: "COMPLETED", managerId: w.manager.user._id, actualEndDate: new Date("2026-04-01"), ...over });
    if (verified) await ProgressVerification.create({ projectId: project._id, agencyId: w.child._id, inspectionId: id(), submissionNo: 1, verifiedPercent: 100, claimedPercent: 100, discrepancyPp: 0, inspectorId: id(), reviewerId: id(), asOf: new Date("2026-03-30"), status: "ACTIVE" });
    return project;
  }
  const body = (projectId: unknown, over: Record<string, unknown> = {}) => ({
    projectId: String(projectId), handover: { handoverDate: new Date("2026-04-05").toISOString(), handoverNote: "Handed over (Synthetic)", defectsLiabilityEndsOn: "2027-04-05", documentIds: [], conditionAtHandover: "UNKNOWN" },
    proposedAssets: [{ key: "road", assetType: "ROAD", name: "Main road (Synthetic)", geometrySource: "PROJECT" }, { key: "drain", assetType: "DRAINAGE", name: "Side drain (Synthetic)", geometrySource: "NONE" }], acknowledgeWarnings: true, ...over,
  });
  async function approved() {
    const project = await completed();
    const req = await call(w.manager.token).post("/conversions", body(project._id));
    expect(req.status).toBe(201);
    const ok = await call(w.gov.token).post(`/conversions/${req.body.data.id}/approve`, {});
    expect(ok.status).toBe(200);
    return { project, conversionId: req.body.data.id as string, assets: ok.body.data.assets as { id: string }[] };
  }

  it("gates block an unfinished project and an unverified completion, and the preview needs asset.create", async () => {
    w = await contractorWorld();
    const active = await makeProject(w.child._id, { status: "ACTIVE", managerId: w.manager.user._id });
    const p1 = await call(w.manager.token).get(`/conversions/preview?projectId=${active._id}`);
    expect(p1.status).toBe(200);
    expect(p1.body.data.blocked).toBe(true);
    expect(p1.body.data.gates.filter((g: { status: string }) => g.status === "BLOCK").map((g: { key: string }) => g.key)).toEqual(expect.arrayContaining(["PROJECT_COMPLETED", "VERIFIED_COMPLETION"]));
    const unverified = await completed({}, false);
    expect((await call(w.manager.token).post("/conversions", body(unverified._id))).status).toBe(409);
    expect((await call(w.inspector.token).get(`/conversions/preview?projectId=${active._id}`)).status).toBe(403);
    expect((await call(w.contractorUser.token).get("/")).status).toBe(403);
  });

  it("a warning needs acknowledgement; the request is created pending; a second request for the project is refused", async () => {
    w = await contractorWorld();
    const project = await completed();
    const noAck = await call(w.manager.token).post("/conversions", body(project._id, { acknowledgeWarnings: false }));
    expect(noAck.status).toBe(400);
    expect(noAck.body.error.details.field).toBe("acknowledgeWarnings");
    const req = await call(w.manager.token).post("/conversions", body(project._id));
    expect(req.status).toBe(201);
    expect(req.body.data.conversionNo).toMatch(/^CNV-\d{4}-000001$/);
    const dup = await call(w.officer.token).post("/conversions", body(project._id));
    expect(dup.status).toBe(409);
    expect(dup.body.error.details.reason).toBe("ALREADY_CONVERTED");
    expect(await Asset.countDocuments({})).toBe(0); // nothing is created until approval
    expect((await call(w.manager.token).post("/conversions", body(project._id, { handover: { handoverDate: new Date(Date.now() + 90 * 86_400_000).toISOString(), documentIds: [], conditionAtHandover: "UNKNOWN" } }))).status).toBe(400); // the handover date is validated before anything else
  });

  it("maker-checker: the requester cannot approve; only GOV_ADMIN holds the grant; another approver creates the assets and the project stays untouched", async () => {
    w = await contractorWorld();
    const project = await completed();
    const before = JSON.stringify((await Project.findById(project._id).lean())!);
    const req = await call(w.gov.token).post("/conversions", body(project._id));
    expect(req.status).toBe(201);
    const cid = req.body.data.id as string;
    const own = await call(w.gov.token).post(`/conversions/${cid}/approve`, {});
    expect(own.status).toBe(403);
    expect(own.body.error.details.reason).toBe("own_request");
    for (const who of [w.manager, w.officer, w.inspector, w.contractorUser, w.superUser]) expect((await call(who.token).post(`/conversions/${cid}/approve`, {})).status).toBe(403);
    const gov2 = await makeUser("gov2@example.com", "GOV_ADMIN", w.ministry._id);
    expect((await call(w.otherGov.token).post(`/conversions/${cid}/approve`, {})).status).toBe(404); // other agency
    const done = await call(gov2.token).post(`/conversions/${cid}/approve`, {});
    expect(done.status).toBe(200);
    expect(done.body.data.assets).toHaveLength(2);
    const assets = await Asset.find({}).sort({ assetNo: 1 });
    expect(assets.map((a) => a.assetNo)).toEqual(["AST-2026-000001", "AST-2026-000002"].map((n) => n.replace("2026", String(new Date().getUTCFullYear()))));
    expect(assets[0]).toMatchObject({ origin: "CONVERSION", operationalStatus: "IN_SERVICE", condition: "UNKNOWN" });
    expect(String(assets[0]!.agencyId)).toBe(String(w.child._id));
    expect(assets[0]!.geometry).toBeTruthy();
    expect(assets[1]!.geometry).toBeUndefined();
    expect(assets[0]!.healthScore).toBeUndefined();
    expect(JSON.stringify((await Project.findById(project._id).lean())!)).toBe(before); // the project is preserved
    expect(await AuditLog.countDocuments({ action: "asset.registered" })).toBe(2);
    const audit = (await AuditLog.findOne({ action: "asset.conversion_approved" }).select("+newValue"))!;
    expect(Object.keys(audit.toObject().newValue ?? {}).sort()).toEqual(["agencyId", "status"]);
    const again = await call(gov2.token).post(`/conversions/${cid}/approve`, {}); // idempotent
    expect(again.status).toBe(200);
    expect(await Asset.countDocuments({})).toBe(2);
    expect((await call(gov2.token).post(`/conversions/${cid}/reject`, { note: "Too late to reject this one" })).status).toBe(409);
  });

  it("a failure during approval leaves no assets behind and the request stays pending", async () => {
    w = await contractorWorld();
    const project = await completed();
    const req = await call(w.manager.token).post("/conversions", body(project._id));
    conversionHooks.beforeAudit = async () => { throw new Error("simulated failure"); };
    const res = await call(w.gov.token).post(`/conversions/${req.body.data.id}/approve`, {});
    expect(res.status).toBe(503);
    expect(await Asset.countDocuments({})).toBe(0);
    expect((await AssetConversion.findById(req.body.data.id))!.status).toBe("PENDING_APPROVAL");
  });

  it("two approvers at once: exactly one wins and the assets are created once", async () => {
    w = await contractorWorld();
    const project = await completed();
    const req = await call(w.manager.token).post("/conversions", body(project._id));
    const gov2 = await makeUser("gov3@example.com", "GOV_ADMIN", w.ministry._id);
    const [a, b] = await Promise.all([call(w.gov.token).post(`/conversions/${req.body.data.id}/approve`, {}), call(gov2.token).post(`/conversions/${req.body.data.id}/approve`, {})]);
    expect([a.status, b.status].every((s) => s === 200 || s === 409 || s === 503)).toBe(true);
    expect(await Asset.countDocuments({})).toBe(2);
  });

  it("reject needs a note and frees the project for a new request; the requester can cancel while pending", async () => {
    w = await contractorWorld();
    const project = await completed();
    const req = await call(w.manager.token).post("/conversions", body(project._id));
    expect((await call(w.gov.token).post(`/conversions/${req.body.data.id}/reject`, { note: "short" })).status).toBe(400);
    expect((await call(w.gov.token).post(`/conversions/${req.body.data.id}/reject`, { note: "Handover documents are missing" })).status).toBe(200);
    const again = await call(w.manager.token).post("/conversions", body(project._id));
    expect(again.status).toBe(201);
    expect((await call(w.officer.token).post(`/conversions/${again.body.data.id}/cancel`)).status).toBe(404); // only the requester
    expect((await call(w.manager.token).post(`/conversions/${again.body.data.id}/cancel`)).status).toBe(200);
  });

  it("asset visibility follows the owning or construction agency; others get 404", async () => {
    w = await contractorWorld();
    const { assets } = await approved();
    const aid = assets[0]!.id;
    expect((await call(w.officer.token).get(`/${aid}`)).status).toBe(200);
    expect((await call(w.gov.token).get(`/${aid}`)).status).toBe(200);
    expect((await call(w.superUser.token).get(`/${aid}`)).status).toBe(200);
    expect((await call(w.siblingOfficer.token).get(`/${aid}`)).status).toBe(404);
    expect((await call(w.otherGov.token).get(`/${aid}`)).status).toBe(404);
    expect((await call(w.inspector.token).get(`/${aid}`)).status).toBe(404);
    expect((await call(w.contractorUser.token).get(`/${aid}`)).status).toBe(403);
    const list = await call(w.siblingOfficer.token).get("/");
    expect(list.body.data.rows).toEqual([]);
    expect((await call(w.officer.token).get("/")).body.data.rows).toHaveLength(2);
  });

  it("health is 'not enough evidence' until an assessment exists, then explains itself; condition changes only through an assessment", async () => {
    w = await contractorWorld();
    const { assets } = await approved();
    const aid = assets[0]!.id;
    const empty = (await call(w.officer.token).get(`/${aid}`)).body.data;
    expect(empty.health).toMatchObject({ availability: "INSUFFICIENT_EVIDENCE", score: null, band: null });
    expect(empty.condition).toMatchObject({ value: "UNKNOWN", basis: "NONE" });
    expect(empty.condition.flags.map((f: { code: string }) => f.code)).toContain("NO_ASSESSMENT_RECORDED");
    expect((await call(w.manager.token).get(`/${aid}`)).body.data.health.availability).toBe("INSUFFICIENT_EVIDENCE"); // PROJECT_MANAGER holds asset.health.read

    const post = (over: Record<string, unknown> = {}) => call(w.officer.token).post(`/${aid}/assessments`, { assessedAt: new Date(Date.now() - 86_400_000).toISOString(), condition: "FAIR", observations: "Surface cracking is visible along the verge (Synthetic).", reason: "Routine manual survey", issues: [{ key: "cracks", title: "Cracking along the verge", severity: "MAJOR", status: "OPEN" }], ...over });
    expect((await post({ observations: "too short" })).status).toBe(400);
    const first = await post();
    expect(first.status).toBe(201);
    let passport = (await call(w.officer.token).get(`/${aid}`)).body.data;
    expect(passport.condition).toMatchObject({ value: "FAIR", basis: "MANUAL_ENTRY" });
    expect(passport.health).toMatchObject({ availability: "AVAILABLE", basis: "MANUAL_ENTRY" });
    expect(passport.health.score).toBeGreaterThan(0);
    expect((await Asset.findById(aid))!.healthScore).toBe(passport.health.score);
    // the next assessment must carry the open issue forward (kept open or resolved)
    expect((await post({ condition: "GOOD", issues: [] })).status).toBe(400);
    expect((await post({ condition: "GOOD", issues: [{ key: "cracks", title: "Cracking along the verge", severity: "MAJOR", status: "RESOLVED" }] })).status).toBe(201);
    passport = (await call(w.officer.token).get(`/${aid}`)).body.data;
    expect(passport.condition.value).toBe("GOOD");
    expect(passport.assessments.filter((a: { status: string }) => a.status === "ACTIVE")).toHaveLength(1);
    expect(passport.openIssues).toEqual([]);
    await expect(AssetConditionAssessment.updateOne({ assetId: aid }, { $set: { condition: "EXCELLENT" } })).rejects.toThrow(/append-only/);
    // an asset in a different agency's scope cannot be assessed, and read-only roles cannot write
    expect((await call(w.siblingOfficer.token).post(`/${aid}/assessments`, { assessedAt: new Date().toISOString(), condition: "POOR", observations: "x".repeat(25), reason: "Not my asset here", issues: [] })).status).toBe(404);
    expect((await call(w.manager.token).post(`/${aid}/assessments`, { assessedAt: new Date().toISOString(), condition: "POOR", observations: "x".repeat(25), reason: "Not allowed to assess", issues: [] })).status).toBe(403);
    expect((await call(w.inspector.token).post(`/${aid}/assessments`, { assessedAt: new Date().toISOString(), condition: "POOR", observations: "x".repeat(25), reason: "Not allowed to assess", issues: [] })).status).toBe(403);
  });

  it("edit and status changes use versions and reasons; decommissioned is terminal", async () => {
    w = await contractorWorld();
    const { assets } = await approved();
    const aid = assets[0]!.id;
    const v0 = (await call(w.officer.token).get(`/${aid}`)).body.data.version as number;
    expect((await call(w.officer.token).patch(`/${aid}`, { version: v0, name: "Renamed road (Synthetic)", designLifeYears: 40 })).status).toBe(200);
    expect((await call(w.officer.token).patch(`/${aid}`, { version: v0, name: "Stale edit" })).status).toBe(409);
    expect((await call(w.manager.token).patch(`/${aid}`, { version: v0 + 1, name: "Nope" })).status).toBe(403);
    const v1 = v0 + 1;
    expect((await call(w.officer.token).post(`/${aid}/status`, { version: v1, status: "OUT_OF_SERVICE" })).status).toBe(400); // needs a reason
    expect((await call(w.officer.token).post(`/${aid}/status`, { version: v1, status: "OUT_OF_SERVICE", reason: "Closed for flood damage" })).status).toBe(200);
    expect((await call(w.officer.token).post(`/${aid}/status`, { version: v1 + 1, status: "DECOMMISSIONED", reason: "Replaced by a new road section" })).status).toBe(200);
    expect((await call(w.officer.token).post(`/${aid}/status`, { version: v1 + 2, status: "IN_SERVICE" })).status).toBe(409);
    expect((await call(w.officer.token).patch(`/${aid}`, { version: v1 + 2, name: "After decommission" })).status).toBe(409);
  });

  it("additions need an approved conversion; the export is scope-safe and neutralises spreadsheet formulas", async () => {
    w = await contractorWorld();
    const lone = await completed();
    const add = (projectId: unknown, name: string) => call(w.officer.token).post("/", { projectId: String(projectId), asset: { key: "extra", assetType: "BRIDGE", name, geometrySource: "NONE" }, reason: "A footbridge was part of the works" });
    expect((await add(lone._id, "Footbridge (Synthetic)")).status).toBe(409);
    const { project } = await approved();
    const created = await add(project._id, "=HYPERLINK(\"http://x\")");
    expect(created.status).toBe(201);
    expect((await Asset.findById(created.body.data.id))!.origin).toBe("ADDITION");
    expect((await call(w.siblingOfficer.token).post("/", { projectId: String(project._id), asset: { key: "x", assetType: "BRIDGE", name: "Other agency", geometrySource: "NONE" }, reason: "Not in my scope at all" })).status).toBe(404);
    expect((await call(w.inspector.token).post("/", { projectId: String(project._id), asset: { key: "x", assetType: "BRIDGE", name: "Inspector", geometrySource: "NONE" }, reason: "Inspectors cannot add assets" })).status).toBe(403);
    const csv = await call(w.gov.token).get("/export.csv");
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("\"'=HYPERLINK");
    expect(csv.headers["x-row-count"]).toBe("3");
    expect((await call(w.inspector.token).get("/export.csv")).status).toBe(403);
    expect((await call(w.siblingOfficer.token).get("/export.csv")).text.split("\r\n").filter(Boolean)).toHaveLength(1); // header only
  });

  it("directory filters, facets and the summary are server-side", async () => {
    w = await contractorWorld();
    await approved();
    const list = await call(w.officer.token).get("/?assetType=ROAD&sort=name");
    expect(list.status).toBe(200);
    expect(list.body.data.rows.map((r: { assetType: string }) => r.assetType)).toEqual(["ROAD"]);
    expect(list.body.data.facets.assetType).toMatchObject({ ROAD: 1, DRAINAGE: 1 });
    expect((await call(w.officer.token).get("/?bogus=1")).status).toBe(400);
    expect((await call(w.officer.token).get("/?assetType=ROAD&assetType=WATER")).status).toBe(400); // repeated keys
    const summary = (await call(w.officer.token).get("/summary")).body.data;
    expect(summary.total).toBe(2);
    expect(summary.byType).toMatchObject({ ROAD: 1, DRAINAGE: 1 });
    expect(summary.health).toMatchObject({ available: 0, total: 2 });
    expect(summary.assessments.overdue).toBe(0);
    const nonHealth = await makeUser("viewer@example.com", "INSPECTOR", w.child._id);
    void nonHealth; void mongoose;
  });
});
