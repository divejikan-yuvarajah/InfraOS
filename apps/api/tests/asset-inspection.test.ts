import { createHash } from "node:crypto";

import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { AssetConditionAssessment } from "../src/modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../src/modules/assets/models/asset-conversion.model.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { checklistFor } from "../src/modules/inspections/inspection-checklists.js";
import { InspectionEvidence } from "../src/modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../src/modules/inspections/models/progress-verification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { id } from "./helpers/domain-fixtures.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const api = (token: string, base: string) => ({
  get: (p: string) => request(app).get(`/api/v1/${base}${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1/${base}${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  put: (p: string, b: unknown) => request(app).put(`/api/v1/${base}${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  putFile: (p: string, bytes: Buffer) => request(app).put(`/api/v1/${base}${p}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "image/jpeg").send(bytes),
});
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("synthetic-asset-photo".padEnd(64, "x"))]);

describe("ASSET_CONDITION inspections feed the asset record (Step 105)", { timeout: 180_000 }, () => {
  let w: World;
  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Asset.syncIndexes(), AssetConversion.syncIndexes(), AssetConditionAssessment.syncIndexes(), Inspection.syncIndexes(), InspectionEvidence.syncIndexes(), ProgressVerification.syncIndexes()]);
  }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Asset.deleteMany({}), AssetConversion.deleteMany({}), Inspection.deleteMany({}), InspectionEvidence.deleteMany({}), Document.deleteMany({}), Counter.deleteMany({}), ProgressVerification.collection.deleteMany({}), AssetConditionAssessment.collection.deleteMany({})]);
    for (const c of ["inspectionEvidence.files", "inspectionEvidence.chunks"]) await mongoose.connection.collection(c).deleteMany({});
  });

  async function convertedAsset() {
    const project = await makeProject(w.child._id, { status: "COMPLETED", managerId: w.manager.user._id, actualEndDate: new Date("2026-04-01") });
    await ProgressVerification.create({ projectId: project._id, agencyId: w.child._id, inspectionId: id(), submissionNo: 1, verifiedPercent: 100, claimedPercent: 100, discrepancyPp: 0, inspectorId: id(), reviewerId: id(), asOf: new Date("2026-03-30"), status: "ACTIVE" });
    const req = await api(w.manager.token, "assets").post("/conversions", { projectId: String(project._id), handover: { handoverDate: new Date("2026-04-05").toISOString(), defectsLiabilityEndsOn: "2099-04-05", documentIds: [], conditionAtHandover: "UNKNOWN" }, proposedAssets: [{ key: "road", assetType: "ROAD", name: "Road (Synthetic)", geometrySource: "NONE" }], acknowledgeWarnings: true });
    const ok = await api(w.gov.token, "assets").post(`/conversions/${req.body.data.id}/approve`, {});
    return { project, assetId: ok.body.data.assets[0].id as string };
  }

  it("schedules against an asset, needs a rating to submit, and approval by another reviewer records a verified assessment", async () => {
    w = await contractorWorld();
    const { project, assetId } = await convertedAsset();
    const insp = (extra: Record<string, unknown>) => api(w.officer.token, "inspections").post("/", { projectId: String(project._id), inspectorId: String(w.inspector.user._id), inspectionDate: new Date(Date.now() + 2 * 3_600_000).toISOString(), ...extra });
    expect((await insp({ inspectionType: "ASSET_CONDITION" })).status).toBe(400); // an asset is required
    expect((await insp({ inspectionType: "QUALITY", assetId })).status).toBe(400); // and only for this type
    expect((await insp({ inspectionType: "ASSET_CONDITION", assetId: String(id()) })).status).toBe(404);
    const created = await insp({ inspectionType: "ASSET_CONDITION", assetId });
    expect(created.status).toBe(201);
    const iid = created.body.data.id as string;
    const inspector = api(w.inspector.token, "inspections");

    // the assigned inspector can now see this one asset, and only it
    expect((await api(w.inspector.token, "assets").get(`/${assetId}`)).status).toBe(200);
    expect((await api(w.inspector.token, "assets").get(`/${String(id())}`)).status).toBe(404);

    expect((await inspector.post(`/${iid}/start`)).status).toBe(200);
    const meta = { capturedAt: new Date().toISOString(), sha256: createHash("sha256").update(jpeg).digest("hex"), mimeType: "image/jpeg", width: 10, height: 10, sizeBytes: jpeg.length };
    const ev = await inspector.post(`/${iid}/evidence`, meta);
    expect((await inspector.putFile(`/evidence/${ev.body.data.evidenceId}/file?variant=full`, jpeg)).status).toBe(200);
    const checklist = checklistFor("ASSET_CONDITION").map((i) => ({ key: i.key, result: "PASS" as const }));
    const base = { revision: 0, checklist, defects: [{ key: "crack", title: "Crack in the surface", severity: "MAJOR", reworkRequired: false }], inspectorDeclaration: true, siteObservations: "Surface wear is visible (Synthetic)." };
    const noRating = await inspector.put(`/${iid}/report`, base);
    expect(noRating.status).toBe(200);
    const early = await inspector.post(`/${iid}/submit`, { revision: noRating.body.data.revision });
    expect(early.status).toBe(400);
    expect(early.body.error.details.gaps).toContain("condition_rating_required");
    const saved = await inspector.put(`/${iid}/report`, { ...base, revision: noRating.body.data.revision, conditionRating: "POOR" });
    expect((await inspector.post(`/${iid}/submit`, { revision: saved.body.data.revision })).status).toBe(200);

    expect(await AssetConditionAssessment.countDocuments({})).toBe(0); // nothing changes until a reviewer approves
    expect((await Asset.findById(assetId))!.condition).toBe("UNKNOWN");
    expect((await api(w.inspector.token, "inspections").post(`/${iid}/decision`, { decision: "APPROVE" })).status).toBe(403); // submitter cannot decide
    const approved = await api(w.gov.token, "inspections").post(`/${iid}/decision`, { decision: "APPROVE" });
    expect(approved.status).toBe(200);

    const rows = await AssetConditionAssessment.find({ assetId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ condition: "POOR", basis: "INSPECTION_VERIFIED", status: "ACTIVE" });
    expect(String(rows[0]!.inspectionId)).toBe(iid);
    expect(String(rows[0]!.reviewedBy)).toBe(String(w.gov.user._id));
    expect(rows[0]!.issues).toMatchObject([{ key: "crack", severity: "MAJOR", status: "OPEN" }]);
    const asset = (await Asset.findById(assetId))!;
    expect(asset.condition).toBe("POOR");
    expect(asset.lastInspectionAt).toBeTruthy();
    expect(asset.healthScore).toBeGreaterThan(0);
    expect(await ProgressVerification.countDocuments({ inspectionId: iid })).toBe(0); // no progress verification for this type
    const passport = (await api(w.officer.token, "assets").get(`/${assetId}`)).body.data;
    expect(passport.condition).toMatchObject({ value: "POOR", basis: "INSPECTION_VERIFIED" });
    expect(passport.health).toMatchObject({ availability: "AVAILABLE", basis: "INSPECTION_VERIFIED" });
    expect(passport.health.caps).toContain("CONDITION_POOR");
    expect(await AuditLog.countDocuments({ action: "asset.assessment_recorded" })).toBe(1);
    expect(passport.condition.flags.map((f: { code: string }) => f.code)).toContain("WITHIN_DEFECTS_LIABILITY");
  });
});
