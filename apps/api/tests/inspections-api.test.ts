import { createHash } from "node:crypto";

import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { checklistFor } from "../src/modules/inspections/inspection-checklists.js";
import { decisionHooks } from "../src/modules/inspections/inspection-decision.service.js";
import { InspectionEvidence } from "../src/modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../src/modules/inspections/models/progress-verification.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { ProgressReport } from "../src/modules/projects/models/progress-report.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, makeUser, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const call = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  put: (p: string, b: unknown) => request(app).put(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  del: (p: string, b: unknown) => request(app).delete(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  putFile: (p: string, bytes: Buffer, type = "image/jpeg") => request(app).put(`/api/v1/inspections${p}`).set("Authorization", `Bearer ${token}`).set("Content-Type", type).send(bytes),
});
const jpeg = (seed: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`synthetic-${seed}`.padEnd(64, "x"))]);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("inspection workflow API (Steps 98-102)", { timeout: 180_000 }, () => {
  let w: World;
  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([Inspection.syncIndexes(), InspectionEvidence.syncIndexes(), ProgressVerification.syncIndexes(), Project.syncIndexes()]);
  }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    decisionHooks.beforeAudit = async () => {};
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Inspection.deleteMany({}), InspectionEvidence.deleteMany({}), ProgressVerification.collection.deleteMany({}), Document.deleteMany({}), Milestone.deleteMany({}), Counter.deleteMany({})]);
    await ProgressReport.collection.deleteMany({});
    for (const c of ["inspectionEvidence.files", "inspectionEvidence.chunks"]) await mongoose.connection.collection(c).deleteMany({});
  });

  const when = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  async function schedule(over: Record<string, unknown> = {}) {
    const project = await makeProject(w.child._id);
    const res = await call(w.officer.token).post("/", { projectId: String(project._id), inspectorId: String(w.inspector.user._id), inspectionDate: when(2), inspectionType: "PROGRESS_VERIFICATION", ...over });
    return { project, res };
  }
  const answerAll = (type = "PROGRESS_VERIFICATION") => checklistFor(type as never).map((i) => ({ key: i.key, result: "PASS" as const }));
  async function addPhoto(token: string, id: string, seed: string, extra: Record<string, unknown> = {}) {
    const bytes = jpeg(seed);
    const meta = { capturedAt: new Date().toISOString(), sha256: sha(bytes), mimeType: "image/jpeg", width: 800, height: 600, sizeBytes: bytes.length, thumb: { sizeBytes: bytes.length, sha256: sha(bytes) }, ...extra };
    const created = await call(token).post(`/${id}/evidence`, meta);
    expect(created.status).toBe(201);
    const evId = created.body.data.evidenceId as string;
    expect((await call(token).putFile(`/evidence/${evId}/file?variant=full`, bytes)).status).toBe(200);
    expect((await call(token).putFile(`/evidence/${evId}/file?variant=thumb`, bytes)).status).toBe(200);
    return evId;
  }
  async function toSubmitted(measured = 50, claimed?: number) {
    const { project, res } = await schedule();
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    if (claimed !== undefined) await ProgressReport.create({ projectId: project._id, sequence: 1, reportedPercent: claimed, previousPercent: 0, note: "claim", reporterUserId: w.manager.user._id, reportedAt: new Date() });
    expect((await call(w.inspector.token).post(`/${id}/start`)).status).toBe(200);
    await addPhoto(w.inspector.token, id, "a");
    await addPhoto(w.inspector.token, id, "b");
    const saved = await call(w.inspector.token).put(`/${id}/report`, { revision: 0, checklist: answerAll(), defects: [], measuredProgress: measured, inspectorDeclaration: true, ...(claimed !== undefined && Math.abs(measured - claimed) > 10 ? { discrepancyNote: "less work was completed on site" } : {}) });
    expect(saved.status).toBe(200);
    const submitted = await call(w.inspector.token).post(`/${id}/submit`, { revision: saved.body.data.revision });
    expect(submitted.status).toBe(200);
    return { id, project };
  }

  it("schedules with a number, audit and notice; roles and scope are enforced", async () => {
    w = await contractorWorld();
    const { project, res } = await schedule();
    expect(res.status).toBe(201);
    expect(res.body.data.inspectionNo).toMatch(/^INS-\d{4}-000001$/);
    const doc = (await Inspection.findById(res.body.data.id))!;
    expect(String(doc.agencyId)).toBe(String(project.agencyId));
    expect(doc.status).toBe("SCHEDULED");
    const audit = (await AuditLog.findOne({ action: "inspection.scheduled" }).select("+newValue"))!;
    expect(Object.keys(audit.toObject().newValue ?? {}).sort()).toEqual(["agencyId", "status"]);
    const body = { projectId: String(project._id), inspectorId: String(w.inspector.user._id), inspectionDate: when(5) };
    expect((await call(w.inspector.token).post("/", body)).status).toBe(403); // inspectors cannot assign
    expect((await call(w.contractorUser.token).post("/", body)).status).toBe(403);
    expect((await call(w.superUser.token).post("/", body)).status).toBe(403); // read-only
    expect((await call(w.siblingOfficer.token).post("/", body)).status).toBe(404); // out of scope
    expect((await request(app).get("/api/v1/inspections")).status).toBe(401);
    expect((await call(w.contractorUser.token).get("/")).status).toBe(403);
    const otherInspector = await makeUser("inspector.south@example.com", "INSPECTOR", w.sibling._id);
    expect((await call(w.officer.token).post("/", { ...body, inspectorId: String(otherInspector.user._id) })).status).toBe(400); // inspector outside scope
    expect((await call(w.officer.token).post("/", { ...body, extra: 1 })).status).toBe(400); // unknown key
    expect((await call(w.officer.token).post("/", { ...body, inspectionDate: when(-48) })).status).toBe(400);
  });

  it("reassign and reschedule keep history and change access", async () => {
    w = await contractorWorld();
    const { res } = await schedule();
    const id = res.body.data.id as string;
    expect((await call(w.inspector.token).get(`/${id}`)).status).toBe(200);
    const second = await makeUser("inspector2@example.com", "INSPECTOR", w.child._id);
    expect((await call(w.officer.token).post(`/${id}/assign`, { inspectorId: String(second.user._id), reason: "short" })).status).toBe(400);
    expect((await call(w.officer.token).post(`/${id}/assign`, { inspectorId: String(second.user._id), reason: "Original inspector is on leave" })).status).toBe(200);
    expect((await call(w.inspector.token).get(`/${id}`)).status).toBe(404); // old inspector lost access
    expect((await call(second.token).get(`/${id}`)).status).toBe(200);
    expect((await call(w.officer.token).post(`/${id}/reschedule`, { inspectionDate: when(30), reason: "Site closed for the day" })).status).toBe(200);
    const doc = (await Inspection.findById(id))!;
    expect(doc.assignmentHistory).toHaveLength(2);
    expect(doc.rescheduleHistory).toHaveLength(1);
    expect((await call(w.officer.token).post(`/${id}/cancel`, { reason: "Project paused by the agency" })).status).toBe(200);
    expect((await call(w.officer.token).post(`/${id}/reschedule`, { inspectionDate: when(40), reason: "Cannot reschedule cancelled" })).status).toBe(409);
    const cal = await call(w.officer.token).get(`/calendar?from=${encodeURIComponent(when(-24))}&to=${encodeURIComponent(when(24 * 40))}`);
    expect(cal.status).toBe(200);
    const tooWide = await call(w.officer.token).get(`/calendar?from=${encodeURIComponent(when(0))}&to=${encodeURIComponent(when(24 * 90))}`);
    expect(tooWide.status).toBe(400);
  });

  it("report flow: start window, autosave conflicts, submit validation, then reviewer maker-checker", async () => {
    w = await contractorWorld();
    const { res } = await schedule({ inspectionDate: when(72) });
    const id = res.body.data.id as string;
    expect((await call(w.inspector.token).post(`/${id}/start`)).status).toBe(409); // outside the 24 h window
    await Inspection.updateOne({ _id: id }, { $set: { inspectionDate: new Date(Date.now() + 3_600_000) } });
    expect((await call(w.inspector.token).post(`/${id}/start`)).status).toBe(200);
    const first = await call(w.inspector.token).put(`/${id}/report`, { revision: 0, checklist: answerAll().slice(0, 2), defects: [], inspectorDeclaration: false });
    expect(first.status).toBe(200);
    expect(first.body.data.revision).toBe(1);
    const stale = await call(w.inspector.token).put(`/${id}/report`, { revision: 0, checklist: [], defects: [] });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.revision).toBe(1);
    expect((await call(w.inspector.token).put(`/${id}/report`, { revision: 1, checklist: [{ key: "not_a_key", result: "PASS" }], defects: [] })).status).toBe(400);
    const incomplete = await call(w.inspector.token).post(`/${id}/submit`, { revision: 1 });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error.details.gaps).toEqual(expect.arrayContaining(["checklist_incomplete", "not_enough_evidence", "measured_progress_required", "declaration_required"]));
  });

  it("approve creates one ACTIVE verification, supersedes the older one and never touches reported progress or milestones", async () => {
    w = await contractorWorld();
    const first = await toSubmitted(40, 55);
    const ms = await Milestone.create({ projectId: first.project._id, title: "M1", plannedStart: new Date("2026-01-01"), plannedEnd: new Date("2026-03-01"), progress: 30 });
    expect((await call(w.inspector.token).post(`/${first.id}/decision`, { decision: "APPROVE" })).status).toBe(403); // submitter cannot decide
    expect((await call(w.contractorUser.token).post(`/${first.id}/decision`, { decision: "APPROVE" })).status).toBe(403);
    expect((await call(w.siblingOfficer.token).post(`/${first.id}/decision`, { decision: "APPROVE" })).status).toBe(404);
    const noAck = await call(w.officer.token).post(`/${first.id}/decision`, { decision: "APPROVE" });
    expect(noAck.status).toBe(400); // 40 vs 55 claimed is a 15 pp gap
    expect(noAck.body.error.details.field).toBe("acknowledgeDiscrepancy");
    const approved = await call(w.officer.token).post(`/${first.id}/decision`, { decision: "APPROVE", acknowledgeDiscrepancy: true });
    expect(approved.status).toBe(200);
    expect(approved.body.data.verifiedPercent).toBe(40);
    const project = (await Project.findById(first.project._id))!;
    expect(project.verifiedProgress?.percent).toBe(40);
    expect(project.physicalProgress).toBe(0); // reported cache untouched
    expect((await Milestone.findById(ms._id))!.progress).toBe(30);
    const inspection = (await Inspection.findById(first.id))!;
    expect(inspection.status).toBe("VERIFIED");
    expect(inspection.physicalProgress).toBe(40);
    const ver = await ProgressVerification.find({ projectId: first.project._id });
    expect(ver).toHaveLength(1);
    expect(ver[0]!.discrepancyPp).toBe(-15);
    expect((await call(w.officer.token).post(`/${first.id}/decision`, { decision: "APPROVE", acknowledgeDiscrepancy: true })).status).toBe(409); // already decided
    await expect(ProgressVerification.updateOne({ _id: ver[0]!._id }, { $set: { verifiedPercent: 99 } })).rejects.toThrow(/append-only/);
    const audit = (await AuditLog.findOne({ action: "inspection.approved" }).select("+newValue"))!;
    expect(Object.keys(audit.toObject().newValue ?? {}).sort()).toEqual(["physicalProgress", "status"]);
  });

  it("a second approved inspection supersedes the first; an older one never becomes active", async () => {
    w = await contractorWorld();
    const a = await toSubmitted(30);
    expect((await call(w.officer.token).post(`/${a.id}/decision`, { decision: "APPROVE" })).status).toBe(200);
    // second inspection on the same project, later date
    const created = await call(w.officer.token).post("/", { projectId: String(a.project._id), inspectorId: String(w.inspector.user._id), inspectionDate: when(10) });
    const id = created.body.data.id as string;
    await call(w.inspector.token).post(`/${id}/start`);
    await addPhoto(w.inspector.token, id, "c"); await addPhoto(w.inspector.token, id, "d");
    const saved = await call(w.inspector.token).put(`/${id}/report`, { revision: 0, checklist: answerAll(), defects: [], measuredProgress: 45, inspectorDeclaration: true });
    await call(w.inspector.token).post(`/${id}/submit`, { revision: saved.body.data.revision });
    expect((await call(w.gov.token).post(`/${id}/decision`, { decision: "APPROVE" })).status).toBe(200);
    const all = await ProgressVerification.find({ projectId: a.project._id }).sort({ asOf: 1 });
    expect(all.map((v) => v.status)).toEqual(["SUPERSEDED", "ACTIVE"]);
    expect((await Project.findById(a.project._id))!.verifiedProgress?.percent).toBe(45);
  });

  it("revision loop and rejection; reviewers need a note", async () => {
    w = await contractorWorld();
    const { id } = await toSubmitted(50);
    expect((await call(w.officer.token).post(`/${id}/decision`, { decision: "REQUEST_REVISION" })).status).toBe(400);
    expect((await call(w.officer.token).post(`/${id}/decision`, { decision: "REQUEST_REVISION", note: "Please add a photo of the culvert", itemComments: [{ itemKey: "surface_finish", comment: "unclear" }] })).status).toBe(200);
    expect((await Inspection.findById(id))!.status).toBe("REQUIRES_REVIEW");
    const draft = (await Inspection.findById(id))!;
    const resubmit = await call(w.inspector.token).post(`/${id}/submit`, { revision: draft.report!.revision });
    expect(resubmit.status).toBe(200);
    expect((await Inspection.findById(id))!.submissions).toHaveLength(2);
    expect((await call(w.officer.token).post(`/${id}/decision`, { decision: "REJECT", note: "Report does not match the site" })).status).toBe(200);
    expect((await Inspection.findById(id))!.status).toBe("REJECTED");
    expect(await ProgressVerification.countDocuments({})).toBe(0);
    expect((await call(w.officer.token).post(`/${id}/decision`, { decision: "APPROVE" })).status).toBe(409);
  });

  it("two reviewers deciding at once: exactly one wins", async () => {
    w = await contractorWorld();
    const { id } = await toSubmitted(50);
    const [a, b] = await Promise.all([call(w.officer.token).post(`/${id}/decision`, { decision: "APPROVE" }), call(w.gov.token).post(`/${id}/decision`, { decision: "REJECT", note: "Rejecting at the same moment" })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await ProgressVerification.countDocuments({})).toBe(a.status === 200 ? 1 : 0);
  });

  it("a failure mid-approval leaves nothing behind", async () => {
    w = await contractorWorld();
    const { id, project } = await toSubmitted(50);
    decisionHooks.beforeAudit = async () => { throw new Error("simulated failure"); };
    const res = await call(w.officer.token).post(`/${id}/decision`, { decision: "APPROVE" });
    expect(res.status).toBe(503);
    expect((await Inspection.findById(id))!.status).toBe("SUBMITTED");
    expect(await ProgressVerification.countDocuments({})).toBe(0);
    expect((await Project.findById(project._id))!.verifiedProgress).toBeUndefined();
  });

  it("evidence upload validation and secure serving", async () => {
    w = await contractorWorld();
    const { res } = await schedule();
    const id = res.body.data.id as string;
    await call(w.inspector.token).post(`/${id}/start`);
    const bytes = jpeg("one");
    const meta = { capturedAt: new Date().toISOString(), sha256: sha(bytes), mimeType: "image/jpeg", width: 10, height: 10, sizeBytes: bytes.length };
    const created = await call(w.inspector.token).post(`/${id}/evidence`, meta);
    const evId = created.body.data.evidenceId as string;
    expect((await call(w.inspector.token).post(`/${id}/evidence`, meta)).status).toBe(409); // duplicate hash
    expect((await call(w.inspector.token).putFile(`/evidence/${evId}/file?variant=full`, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/jpeg")).status).toBe(400); // forged type
    expect((await call(w.inspector.token).putFile(`/evidence/${evId}/file?variant=full`, jpeg("different"))).status).toBe(422); // hash mismatch
    expect((await call(w.inspector.token).putFile(`/evidence/${evId}/file?variant=full`, bytes, "image/gif")).status).toBe(415);
    expect((await call(w.inspector.token).putFile(`/evidence/${evId}/file?variant=full`, bytes)).status).toBe(200);
    expect((await call(w.inspector.token).putFile(`/evidence/${evId}/file?variant=full`, bytes)).status).toBe(200); // idempotent retry
    expect((await call(w.officer.token).putFile(`/evidence/${evId}/file?variant=full`, bytes)).status).toBe(403); // not an uploader role
    const file = await call(w.inspector.token).get(`/evidence/${evId}/file`);
    expect(file.status).toBe(200);
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect(file.headers["cache-control"]).toMatch(/^private/);
    expect(Buffer.from(file.body as Buffer).length).toBe(bytes.length);
    expect((await call(w.officer.token).get(`/evidence/${evId}/file`)).status).toBe(200); // in-scope staff
    expect((await call(w.siblingOfficer.token).get(`/evidence/${evId}/file`)).status).toBe(404); // other agency
    expect((await call(w.contractorUser.token).get(`/evidence/${evId}/file`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/inspections/evidence/${evId}/file`)).status).toBe(401);
    expect((await call(w.inspector.token).del(`/evidence/${evId}`, { reason: "bad" })).status).toBe(400); // reason too short
    expect((await call(w.inspector.token).del(`/evidence/${evId}`, { reason: "Blurry photo, retaking" })).status).toBe(200);
    expect((await call(w.inspector.token).get(`/evidence/${evId}/file`)).status).toBe(404); // removed files are no longer served to the uploader
  });
});
