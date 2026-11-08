import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AssetConversion } from "../src/modules/assets/models/asset-conversion.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentUpload } from "../src/modules/documents/models/document-upload.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { pdf, txt } from "./helpers/doc-files.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const api = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  del: (p: string, b: unknown) => request(app).delete(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  put: (p: string, bytes: Buffer) => request(app).put(`/api/v1${p}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(bytes),
});
const blobs = () => mongoose.connection.collection("documents.files").countDocuments({});
let salt = 0;

describe("DocTrace management, search and archive (Steps 109-110)", { timeout: 300_000 }, () => {
  let w: World;
  let projectId: string;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); await Promise.all([Document.syncIndexes(), DocumentVersion.syncIndexes()]); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    await clearCoreCollections();
    await Promise.all([AuditLog.collection.deleteMany({}), Project.deleteMany({}), Document.deleteMany({}), DocumentVersion.collection.deleteMany({}), DocumentUpload.deleteMany({}), Counter.deleteMany({}), Inspection.collection.deleteMany({}), Notification.deleteMany({}), AssetConversion.collection.deleteMany({})]);
    for (const c of ["documents.files", "documents.chunks"]) await mongoose.connection.collection(c).deleteMany({});
  });
  async function setup() {
    w = await contractorWorld();
    projectId = String((await makeProject(w.child._id, { managerId: w.manager.user._id }))._id);
  }
  async function add(token: string, over: Record<string, unknown> = {}, bytes = pdf(`doc ${(salt += 1)}`)) {
    const body = { fileName: "doc.pdf", mimeType: "application/pdf", sizeBytes: bytes.length, category: "PROJECT_PLAN", projectId, title: "Kandy Road Plan (Synthetic)", ...over };
    const init = await api(token).post("/documents/uploads", body);
    expect(init.status).toBe(201);
    const t = init.body.data.ticket as string;
    expect((await api(token).put(`/documents/uploads/${t}/content`, bytes)).status).toBe(200);
    const c = await api(token).post(`/documents/uploads/${t}/commit`, {});
    expect(c.status).toBe(201);
    return c.body.data.id as string;
  }

  it("lists with search, safe highlights, filters, pagination and facets; metacharacters are harmless", async () => {
    await setup();
    const a = await add(w.officer.token, { title: "Kandy Road Plan (Synthetic)", tags: ["Road", "kandy"], reference: "REF-77" });
    await add(w.officer.token, { title: "Bridge Design Notes (Synthetic)", category: "ENGINEERING_DRAWING", tags: ["bridge"] });
    await add(w.officer.token, { title: "Galle Contract (Synthetic)", category: "CONTRACT" });
    const all = await api(w.officer.token).get("/documents");
    expect(all.status).toBe(200);
    expect(all.body.data.meta).toMatchObject({ total: 3, metadataSearchOnly: true });
    expect(all.body.data.facets.category.map((f: { key: string }) => f.key).sort()).toEqual(["CONTRACT", "ENGINEERING_DRAWING", "PROJECT_PLAN"]);
    const q = await api(w.officer.token).get("/documents?q=kandy%20road&sort=relevance");
    expect(q.body.data.items.map((i: { id: string }) => i.id)).toEqual([a]);
    expect(q.body.data.items[0].highlights.title.some((s: { match: boolean }) => s.match)).toBe(true);
    expect(JSON.stringify(q.body.data.items[0].highlights)).not.toContain("<mark");
    expect((await api(w.officer.token).get("/documents?q=ka")).body.data.items).toHaveLength(1); // short prefix path
    expect((await api(w.officer.token).get("/documents?q=REF-7")).body.data.items).toHaveLength(1); // reference prefix
    const doc = await Document.findById(a).lean();
    expect((await api(w.officer.token).get(`/documents?q=${doc!.docNo}`)).body.data.items.map((i: { id: string }) => i.id)).toEqual([a]);
    for (const evil of [".*", "(a+)+$", "%5Cd%2B", "%24where", "road%20-bridge%22"]) expect((await api(w.officer.token).get(`/documents?q=${evil}`)).status).toBe(200);
    expect((await api(w.officer.token).get("/documents?q=.*")).body.data.items).toHaveLength(0);
    expect((await api(w.officer.token).get("/documents?category=CONTRACT,ENGINEERING_DRAWING")).body.data.meta.total).toBe(2);
    expect((await api(w.officer.token).get("/documents?group=CONTRACT_FINANCE")).body.data.meta.total).toBe(1);
    expect((await api(w.officer.token).get("/documents?tag=road,kandy")).body.data.meta.total).toBe(1);
    expect((await api(w.officer.token).get("/documents?fileType=pdf&uploadedBy=me")).body.data.meta.total).toBe(3);
    expect((await api(w.officer.token).get("/documents?fileType=docx")).body.data.meta.total).toBe(0);
    const p1 = await api(w.officer.token).get("/documents?limit=2&page=1&sort=title");
    const p2 = await api(w.officer.token).get("/documents?limit=2&page=2&sort=title");
    expect(p1.body.data.items.map((i: { title: string }) => i.title)).toEqual(["Bridge Design Notes (Synthetic)", "Galle Contract (Synthetic)"]);
    expect(p2.body.data.items).toHaveLength(1);
    expect((await api(w.officer.token).get("/documents?limit=51")).status).toBe(400); // out of range
    expect((await api(w.officer.token).get("/documents?page=1&page=2")).status).toBe(400); // repeated keys rejected
    expect((await api(w.officer.token).get("/documents?unknown=1")).status).toBe(400);
    expect(JSON.stringify(all.body)).not.toMatch(/storage|gridfs|storageRef/i);
  });

  it("two-agency isolation: other agency sees nothing in list, facets, counts, summary, details or activity", async () => {
    await setup();
    const id = await add(w.officer.token, { title: "Secret Plan (Synthetic)" });
    const other = await api(w.siblingOfficer.token).get("/documents?q=secret");
    expect(other.status).toBe(200);
    expect(other.body.data.meta.total).toBe(0);
    expect(other.body.data.facets.category).toEqual([]);
    expect((await api(w.otherGov.token).get("/documents")).body.data.meta.total).toBe(0);
    expect((await api(w.siblingOfficer.token).get("/documents/summary")).body.data.totalActive).toBe(0);
    for (const p of [`/documents/${id}`, `/documents/${id}/activity`, `/documents/${id}/versions`]) expect((await api(w.siblingOfficer.token).get(p)).status).toBe(404);
    expect((await api(w.siblingOfficer.token).patch(`/documents/${id}`, { version: 0, title: "Hijack" })).status).toBe(404);
    expect((await api(w.siblingOfficer.token).post(`/documents/${id}/archive`, { reason: "Hostile archive attempt" })).status).toBe(404);
    expect((await api(w.siblingOfficer.token).get(`/projects/${projectId}/documents`)).status).toBe(404);
    expect((await api(w.gov.token).get("/documents")).body.data.meta.total).toBe(1); // ministry covers its child agency
    expect((await api(w.contractorUser.token).get("/documents")).body.data.meta.total).toBe(0); // scope none
    expect((await api(w.citizen.token).get("/documents")).status).toBe(403); // no document.read grant
    expect((await api(w.contractorUser.token).get(`/documents/${id}`)).status).toBe(404);
  });

  it("inspectors see only allowlisted, team-visible categories on assigned projects", async () => {
    await setup();
    await Inspection.collection.insertOne({ inspectorId: w.inspector.user._id, projectId: new mongoose.Types.ObjectId(projectId), status: "SCHEDULED" });
    const report = await add(w.officer.token, { category: "INSPECTION_REPORT", title: "Inspection Report (Synthetic)", visibility: "PROJECT_TEAM" });
    await add(w.officer.token, { category: "CONTRACT", title: "Contract (Synthetic)", visibility: "PROJECT_TEAM" });
    await add(w.officer.token, { category: "PROJECT_PLAN", title: "Internal Plan (Synthetic)", visibility: "INTERNAL" });
    const r = await api(w.inspector.token).get("/documents");
    expect(r.body.data.items.map((i: { id: string }) => i.id)).toEqual([report]);
    expect((await api(w.inspector.token).get("/documents/categories")).body.data.categories.every((c: { key: string }) => c.key !== "CONTRACT")).toBe(true);
    expect((await api(w.inspector.token).get(`/documents/${report}`)).status).toBe(200);
    expect((await api(w.inspector.token).patch(`/documents/${report}`, { version: 0, title: "x" })).status).toBe(403);
  });

  it("edit with optimistic concurrency, category and link rules, status changes", async () => {
    await setup();
    const id = await add(w.officer.token);
    const bad = await api(w.officer.token).patch(`/documents/${id}`, { version: 0, links: { inspectionId: String(new mongoose.Types.ObjectId()) } });
    expect(bad.status).toBe(400); // inspection links are not legal for a project plan
    const ok = await api(w.officer.token).patch(`/documents/${id}`, { version: 0, title: "Renamed (Synthetic)", tags: ["B", "b", "c"], description: "d" });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ title: "Renamed (Synthetic)", tags: ["b", "c"], version: 1 });
    expect((await api(w.officer.token).patch(`/documents/${id}`, { version: 0, title: "Stale" })).status).toBe(409);
    const cat = await api(w.officer.token).patch(`/documents/${id}`, { version: 1, category: "CONTRACT" });
    expect(cat.body.data.category).toBe("CONTRACT");
    expect((await Document.findById(id).lean())!.documentType).toBe("CONTRACT"); // legacy type kept in sync
    expect((await api(w.officer.token).patch(`/documents/${id}`, { version: 2, agencyId: String(w.other._id) })).status).toBe(400);
    const st = await api(w.officer.token).post(`/documents/${id}/status`, { version: 2, status: "DRAFT" });
    expect(st.body.data.status).toBe("DRAFT");
    expect((await api(w.siblingOfficer.token).get(`/documents/${id}`)).status).toBe(404);
    expect((await api(w.manager.token).get(`/documents/${id}`)).status).toBe(404); // drafts: owner and agency officers only
    expect((await api(w.officer.token).post(`/documents/${id}/status`, { version: 3, status: "DRAFT" })).status).toBe(409);
    expect((await api(w.manager.token).patch(`/documents/${id}`, { version: 3, title: "no" })).status).toBe(404);
  });

  it("archive hides from search; restore returns it; permanent delete needs archive, confirm, no references, and leaves a tombstone", async () => {
    await setup();
    const id = await add(w.officer.token, { title: "To Remove (Synthetic)" });
    const docNo = (await Document.findById(id).lean())!.docNo!;
    expect((await api(w.officer.token).post(`/documents/${id}/archive`, { reason: "short" })).status).toBe(400);
    expect((await api(w.officer.token).del(`/documents/${id}`, { reason: "Not archived yet at all", confirm: docNo })).status).toBe(403); // officers hold no delete grant
    expect((await api(w.gov.token).del(`/documents/${id}`, { reason: "Not archived yet at all", confirm: docNo })).status).toBe(409);
    expect((await api(w.officer.token).post(`/documents/${id}/archive`, { reason: "Superseded by a newer plan" })).status).toBe(200);
    expect((await api(w.officer.token).get("/documents?q=remove")).body.data.meta.total).toBe(0);
    expect((await api(w.officer.token).get("/documents?status=ARCHIVED")).body.data.meta.total).toBe(1);
    expect((await api(w.manager.token).get(`/documents/${id}`)).status).toBe(404); // archived: admins and owner only
    expect(await blobs()).toBe(1); // bytes retained
    expect((await api(w.officer.token).post(`/documents/${id}/restore`, {})).status).toBe(200);
    expect((await api(w.officer.token).get("/documents?q=remove")).body.data.meta.total).toBe(1);
    await api(w.officer.token).post(`/documents/${id}/archive`, { reason: "Archive again for deletion" });
    expect((await api(w.gov.token).del(`/documents/${id}`, { reason: "Retention period has ended", confirm: "WRONG" })).status).toBe(400);
    await Inspection.collection.insertOne({ inspectorId: w.inspector.user._id, projectId: new mongoose.Types.ObjectId(projectId), status: "SCHEDULED", evidence: [new mongoose.Types.ObjectId(id)] });
    const blocked = await api(w.gov.token).del(`/documents/${id}`, { reason: "Retention period has ended", confirm: docNo });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.references[0].type).toBe("INSPECTION");
    expect(await blobs()).toBe(1);
    await Inspection.collection.deleteMany({});
    const gone = await api(w.gov.token).del(`/documents/${id}`, { reason: "Retention period has ended", confirm: docNo.toLowerCase() });
    expect(gone.status).toBe(200);
    expect(await blobs()).toBe(0); // bytes removed
    const tomb = await Document.findById(id).lean();
    expect(tomb).toMatchObject({ docNo, title: "To Remove (Synthetic)", deleteReason: "Retention period has ended" });
    expect(tomb!.deletedAt).toBeTruthy();
    expect(tomb!.currentVersionId).toBeUndefined();
    expect((await DocumentVersion.find({ documentId: id }).lean()).every((v) => v.status === "REMOVED")).toBe(true);
    expect((await api(w.gov.token).get(`/documents/${id}`)).status).toBe(404);
    const actions = (await AuditLog.find({ resourceId: new mongoose.Types.ObjectId(id) }).select("action").lean()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["document.uploaded", "document.archived", "document.restored", "document.deleted"]));
  });

  it("restrict: sensitive documents narrow visibility and exclude AI; only GOV_ADMIN may allow AI on them", async () => {
    await setup();
    const id = await add(w.officer.token, { visibility: "PUBLIC" });
    expect((await api(w.manager.token).post(`/documents/${id}/restrict`, { version: 0, confidentiality: "SENSITIVE", reason: "Contains personal data" })).status).toBe(403);
    const r = await api(w.officer.token).post(`/documents/${id}/restrict`, { version: 0, confidentiality: "SENSITIVE", reason: "Contains personal data" });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ confidentiality: "SENSITIVE", visibility: "INTERNAL", ai: { allowed: false } });
    expect((await api(w.officer.token).post(`/documents/${id}/restrict`, { version: 1, aiProcessingAllowed: true, reason: "Officer cannot allow AI" })).status).toBe(403);
    expect((await api(w.gov.token).post(`/documents/${id}/restrict`, { version: 1, aiProcessingAllowed: true, reason: "Reviewed and cleared by admin" })).body.data.ai.allowed).toBe(true);
    expect((await api(w.manager.token).get(`/documents/${id}`)).status).toBe(200); // PM of the project still sees sensitive docs
    const bad = await api(w.officer.token).patch(`/documents/${id}`, { version: 2, visibility: "PUBLIC" });
    expect(bad.status).toBe(400);
  });

  it("detail, activity, summary, project panel, export and bulk actions", async () => {
    await setup();
    const id = await add(w.officer.token, { title: "=HYPERLINK(\"x\") (Synthetic)", tags: ["t1"] });
    const id2 = await add(w.officer.token, { title: "Second (Synthetic)" });
    const det = await api(w.officer.token).get(`/documents/${id}`);
    expect(det.status).toBe(200);
    expect(det.body.data).toMatchObject({ fileAvailable: true, currentVersionNo: 1, ai: { extractedTextStatus: "NOT_STARTED", eligibleType: true }, permissions: { canEdit: true, canArchive: true, canDelete: false, canRestrict: true } });
    expect(det.body.data.access.audience).toEqual(expect.arrayContaining(["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]));
    expect(det.body.data.access.audience).toContain("INSPECTOR"); // project plans are inspector-visible and team-visible by default
    const contract = await add(w.officer.token, { category: "CONTRACT", title: "Contract (Synthetic)" });
    expect((await api(w.officer.token).get(`/documents/${contract}`)).body.data.access.audience).not.toContain("INSPECTOR");
    const act = await api(w.officer.token).get(`/documents/${id}/activity`);
    expect(act.body.data.items.map((i: { action: string }) => i.action)).toContain("document.uploaded");
    const sum = await api(w.officer.token).get("/documents/summary");
    expect(sum.body.data).toMatchObject({ totalActive: 3, addedThisMonth: 3, drafts: 0, awaitingFiles: 0, storageApproximate: true });
    expect(sum.body.data.uploadsPerMonth).toHaveLength(6);
    const panel = await api(w.manager.token).get(`/projects/${projectId}/documents`);
    expect(panel.body.data).toMatchObject({ total: 3, canUpload: true });
    expect((await api(w.inspector.token).get(`/projects/${projectId}/documents`)).status).toBe(404);
    const csv = await api(w.officer.token).get("/documents/export.csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("'=HYPERLINK"); // CSV-injection safe
    expect(csv.text).not.toMatch(/storage|gridfs/i);
    expect((await api(w.contractorUser.token).get("/documents/export.csv")).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: "document.exported" })).toBe(1);
    const bulkTag = await api(w.officer.token).post("/documents/bulk", { ids: [id, id2, String(new mongoose.Types.ObjectId())], action: "ADD_TAG", tag: "Batch" });
    expect(bulkTag.body.data).toMatchObject({ succeeded: 2, failed: 1 });
    expect((await Document.findById(id2).lean())!.tags).toEqual(["batch"]);
    expect((await api(w.officer.token).post("/documents/bulk", { ids: [id, id2], action: "ARCHIVE", reason: "Bulk archive for cleanup" })).body.data.succeeded).toBe(2);
    expect((await api(w.siblingOfficer.token).post("/documents/bulk", { ids: [id], action: "ARCHIVE", reason: "Hostile bulk archive" })).body.data.failed).toBe(1);
    expect(await Notification.countDocuments({ resourceType: "DOCUMENT" })).toBeGreaterThan(0);
  });

  it("agency-level documents need no project; project-bound categories do; text files preview as plain text", async () => {
    await setup();
    const letter = await add(w.officer.token, { category: "GOVERNMENT_CORRESPONDENCE", projectId: undefined, fileName: "letter.txt", mimeType: "text/plain", title: "Letter (Synthetic)" }, txt("Dear sir (Synthetic)"));
    const d = await Document.findById(letter).lean();
    expect(d!.projectId).toBeUndefined();
    expect(String(d!.agencyId)).toBe(String(w.child._id));
    const noProject = await api(w.officer.token).post("/documents/uploads", { fileName: "c.pdf", mimeType: "application/pdf", sizeBytes: 50, category: "CONTRACT" });
    expect(noProject.status).toBe(400);
    const prev = await api(w.officer.token).get(`/documents/${letter}/preview`);
    expect(prev.headers["content-type"]).toContain("text/plain");
    expect(prev.text).toContain("Dear sir");
    expect((await api(w.siblingOfficer.token).get(`/documents/${letter}`)).status).toBe(404);
    expect((await api(w.manager.token).get(`/documents/${letter}`)).status).toBe(404); // INTERNAL agency-level: PM sees only team-visible ones
  });
});
