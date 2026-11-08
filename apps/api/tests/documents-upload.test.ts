import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentUpload } from "../src/modules/documents/models/document-upload.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { exe, pdf, png, txt } from "./helpers/doc-files.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const api = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  put: (p: string, bytes: Buffer) => request(app).put(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(bytes),
});
const blobs = () => mongoose.connection.collection("documents.files").countDocuments({});
const MIME: Record<string, string> = { pdf: "application/pdf", txt: "text/plain", png: "image/png" };

describe("DocTrace secure upload, versions, download (Step 108)", { timeout: 240_000 }, () => {
  let w: World;
  let projectId: string;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); await Promise.all([Document.syncIndexes(), DocumentVersion.syncIndexes()]); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Document.deleteMany({}), DocumentVersion.collection.deleteMany({}), DocumentUpload.deleteMany({}), Counter.deleteMany({})]);
    for (const c of ["documents.files", "documents.chunks"]) await mongoose.connection.collection(c).deleteMany({});
  });
  async function setup() {
    w = await contractorWorld();
    projectId = String((await makeProject(w.child._id, { managerId: w.manager.user._id }))._id);
  }
  const meta = (name: string, bytes: Buffer, over: Record<string, unknown> = {}) => ({ fileName: name, mimeType: MIME[name.split(".").pop()!] ?? "application/pdf", sizeBytes: bytes.length, category: "PROJECT_PLAN", projectId, title: "Plan (Synthetic)", ...over });
  async function upload(token: string, name: string, bytes: Buffer, over: Record<string, unknown> = {}, commitBody: Record<string, unknown> = {}) {
    const init = await api(token).post("/documents/uploads", meta(name, bytes, over));
    if (init.status !== 201) return { init };
    const t = init.body.data.ticket as string;
    const put = await api(token).put(`/documents/uploads/${t}/content`, bytes);
    if (put.status !== 200) return { init, put, t };
    const commit = await api(token).post(`/documents/uploads/${t}/commit`, commitBody);
    return { init, put, commit, t };
  }

  it("uploads, commits atomically, never exposes storage details and serves safe download headers", async () => {
    await setup();
    const file = pdf("first");
    const r = await upload(w.officer.token, "plan.pdf", file);
    expect(r.commit!.status).toBe(201);
    expect(r.commit!.body.data.docNo).toMatch(/^DOC-\d{4}-000001$/);
    const id = r.commit!.body.data.id as string;
    expect(await Document.countDocuments()).toBe(1);
    const versions = await DocumentVersion.find({}).select("+storageRef").lean();
    expect(versions).toHaveLength(1);
    expect(versions[0]!.storageRef).toMatch(/^doc\/[a-f0-9]{24}\/v1\/[0-9a-f-]{36}$/); // server generated, not derived from the file name
    expect(await blobs()).toBe(1);
    expect(await AuditLog.countDocuments({ action: "document.uploaded", resourceId: new mongoose.Types.ObjectId(id) })).toBe(1);
    const raw = JSON.stringify([r.init.body, r.put!.body, r.commit!.body]);
    expect(raw).not.toMatch(/storage|gridfs|doc\/[a-f0-9]{24}|storageRef/i);
    const dl = await api(w.officer.token).get(`/documents/${id}/download`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on("data", (d: Buffer) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); });
    expect(dl.status).toBe(200);
    expect(Buffer.from(dl.body as Buffer).equals(file)).toBe(true);
    expect(dl.headers["content-disposition"]).toMatch(/^attachment; filename="plan\.pdf"; filename\*=UTF-8''plan\.pdf$/);
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");
    expect(dl.headers["cache-control"]).toBe("private, no-store");
    expect(dl.headers["content-length"]).toBe(String(file.length));
    expect(await AuditLog.countDocuments({ action: "document.downloaded" })).toBe(1);
    const prev = await api(w.officer.token).get(`/documents/${id}/preview`);
    expect(prev.status).toBe(200);
    expect(prev.headers["content-security-policy"]).toContain("sandbox");
    expect((await request(app).get(`/api/v1/documents/${id}/download`)).status).toBe(401);
  });

  it("rejects hostile files with a specific code, no stored bytes and a minimal audit row", async () => {
    await setup();
    const bad = exe();
    const r = await upload(w.officer.token, "evil.pdf", bad);
    expect(r.put!.status).toBe(422);
    expect(r.put!.body.error.details.fileError).toBe("FILE_SIGNATURE_MISMATCH");
    expect(await blobs()).toBe(0);
    expect(await Document.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: "document.upload_rejected" })).toBe(1);
    const row = await AuditLog.findOne({ action: "document.upload_rejected" }).select("+newValue").lean();
    expect(JSON.stringify(row)).not.toContain("evil");
    expect((await api(w.officer.token).post("/documents/uploads", meta("run.exe", bad))).body.error.details.fileError).toBe("FILE_TYPE_NOT_ALLOWED");
    const over = await api(w.officer.token).post("/documents/uploads", meta("a.txt", txt("x".repeat(100)), { category: "PROJECT_PLAN" }));
    const t = over.body.data.ticket as string;
    const big = await api(w.officer.token).put(`/documents/uploads/${t}/content`, txt("y".repeat(300)));
    expect(big.status).toBe(413);
    expect(big.body.error.details.fileError).toBe("FILE_TOO_LARGE");
    expect(await blobs()).toBe(0);
    const photo = await api(w.officer.token).post("/documents/uploads", meta("p.png", png(), { category: "CONTRACT" }));
    expect(photo.body.error.details.fileError).toBe("FILE_TYPE_NOT_ALLOWED"); // images only for some categories
  });

  it("abort leaves no blob; a committed ticket cannot be replayed; duplicate bytes warn before saving", async () => {
    await setup();
    const file = pdf("dup");
    const init = await api(w.officer.token).post("/documents/uploads", meta("a.pdf", file));
    const t = init.body.data.ticket as string;
    expect((await api(w.officer.token).put(`/documents/uploads/${t}/content`, file)).status).toBe(200);
    expect(await blobs()).toBe(1);
    expect((await api(w.officer.token).post(`/documents/uploads/${t}/abort`)).status).toBe(200);
    expect(await blobs()).toBe(0);
    expect((await api(w.officer.token).post(`/documents/uploads/${t}/commit`)).status).toBe(409);

    const one = await upload(w.officer.token, "one.pdf", file);
    expect(one.commit!.status).toBe(201);
    const two = await upload(w.officer.token, "two.pdf", file);
    expect(two.put!.body.data.duplicate).toMatchObject({ docNo: expect.stringMatching(/^DOC-/) });
    expect(two.commit!.status).toBe(409);
    expect(two.commit!.body.error.details.fileError).toBe("FILE_DUPLICATE_WARNING");
    expect(await Document.countDocuments()).toBe(1);
    const again = await api(w.officer.token).post(`/documents/uploads/${two.t}/commit`, { allowDuplicate: true });
    expect(again.status).toBe(201);
    expect(await Document.countDocuments()).toBe(2);
  });

  it("replacement keeps old versions downloadable, resets extraction status, restore adds a NEW version, stale tickets conflict", async () => {
    await setup();
    const v1 = pdf("version one");
    const id = (await upload(w.officer.token, "plan.pdf", v1)).commit!.body.data.id as string;
    await Document.updateOne({ _id: id }, { $set: { extractedTextStatus: "COMPLETED" } });
    const v2 = pdf("version two, longer");
    const init = await api(w.officer.token).post(`/documents/${id}/versions`, { fileName: "plan-v2.pdf", mimeType: "application/pdf", sizeBytes: v2.length, changeNote: "Corrected figures" });
    expect(init.status).toBe(201);
    const t = init.body.data.ticket as string;
    expect((await api(w.officer.token).put(`/documents/${id}/versions/${t}/content`, v2)).status).toBe(200);
    expect((await api(w.officer.token).post(`/documents/${id}/versions/${t}/commit`)).status).toBe(201);
    const doc = await Document.findById(id).lean();
    expect(doc).toMatchObject({ currentVersionNo: 2, extractedTextStatus: "NOT_STARTED", fileName: "plan-v2.pdf" });
    const list = await api(w.officer.token).get(`/documents/${id}/versions`);
    expect(list.body.data.versions.map((v: { versionNo: number; status: string }) => `${v.versionNo}:${v.status}`)).toEqual(["2:CURRENT", "1:SUPERSEDED"]);
    const old = await api(w.officer.token).get(`/documents/${id}/download?version=1`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on("data", (d: Buffer) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); });
    expect(Buffer.from(old.body as Buffer).equals(v1)).toBe(true);
    const restored = await api(w.officer.token).post(`/documents/${id}/versions/1/restore`, { changeNote: "Back to the original" });
    expect(restored.status).toBe(201);
    expect(restored.body.data.versionNo).toBe(3);
    expect(await DocumentVersion.countDocuments({ documentId: id })).toBe(3); // history never rewritten
    expect((await api(w.officer.token).post(`/documents/${id}/versions/3/restore`, { changeNote: "Same again" })).status).toBe(409);
    expect((await api(w.officer.token).post(`/documents/${id}/versions`, { fileName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, changeNote: "no" })).status).toBe(400);
    // a stale second upload ticket on the same base version cannot commit
    const initA = await api(w.officer.token).post(`/documents/${id}/versions`, { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: pdf("aaa").length, changeNote: "Branch A edit" });
    const initB = await api(w.officer.token).post(`/documents/${id}/versions`, { fileName: "b.pdf", mimeType: "application/pdf", sizeBytes: pdf("bbb").length, changeNote: "Branch B edit" });
    for (const [i, b] of [[initA, pdf("aaa")], [initB, pdf("bbb")]] as const) await api(w.officer.token).put(`/documents/${id}/versions/${i.body.data.ticket}/content`, b);
    expect((await api(w.officer.token).post(`/documents/${id}/versions/${initA.body.data.ticket}/commit`)).status).toBe(201);
    expect((await api(w.officer.token).post(`/documents/${id}/versions/${initB.body.data.ticket}/commit`)).status).toBe(409);
  });

  it("isolates agencies and roles: other agency 404, contractor/inspector/citizen cannot upload or read", async () => {
    await setup();
    const id = (await upload(w.officer.token, "plan.pdf", pdf("iso"))).commit!.body.data.id as string;
    for (const path of [`/documents/${id}/download`, `/documents/${id}/preview`, `/documents/${id}/versions`]) {
      expect((await api(w.siblingOfficer.token).get(path)).status).toBe(404);
      expect((await api(w.otherGov.token).get(path)).status).toBe(404);
      expect((await api(w.contractorUser.token).get(path)).status).toBe(404);
    }
    expect((await api(w.siblingOfficer.token).post(`/documents/${id}/versions`, { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 100, changeNote: "Hostile replace" })).status).toBe(404);
    expect((await api(w.gov.token).get(`/documents/${id}/versions`)).status).toBe(200); // ministry covers the child agency
    for (const who of [w.contractorUser, w.inspector, w.citizen]) expect((await api(who.token).post("/documents/uploads", meta("a.pdf", pdf()))).status).toBe(403);
    // manager of the project may upload; the officer of another agency may not target this project
    expect((await api(w.siblingOfficer.token).post("/documents/uploads", meta("a.pdf", pdf()))).status).toBe(404);
    expect((await api(w.manager.token).post("/documents/uploads", meta("a.pdf", pdf()))).status).toBe(201);
    // agency is never taken from the client
    expect((await api(w.officer.token).post("/documents/uploads", { ...meta("a.pdf", pdf()), agencyId: String(w.other._id) })).status).toBe(400);
  });
});
