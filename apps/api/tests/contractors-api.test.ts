import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const api = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1/contractors${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown) => request(app).post(`/api/v1/contractors${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1/contractors${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  del: (p: string, b?: unknown) => request(app).delete(`/api/v1/contractors${p}`).set("Authorization", `Bearer ${token}`).send((b ?? {}) as object),
});
const body = (over: Record<string, unknown> = {}) => ({ name: "Alpha Builders (Pvt) Ltd", registrationNumber: "reg/001", category: "ROAD_CONSTRUCTION", operatingDistricts: ["Colombo"], contact: { email: "ceo@alpha.invalid", phone: "0112223344" }, business: { taxId: "TAX-1234", registrationAuthority: "CIDA" }, ...over });

describe("contractor registry API (Step 92)", { timeout: 120_000 }, () => {
  let w: World;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); await Contractor.syncIndexes(); await ContractorAssignment.syncIndexes(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { await clearCoreCollections(); await AuditLog.collection.deleteMany({}); await Promise.all([Project.deleteMany({}), Contractor.deleteMany({}), ContractorAssignment.deleteMany({})]); });
  const setup = async () => { w = await contractorWorld(); return w; };

  it("requires a session and the permission; contractor, inspector and citizen roles are denied", async () => {
    await setup();
    expect((await request(app).get("/api/v1/contractors")).status).toBe(401);
    expect((await api(w.contractorUser.token).get("/")).status).toBe(200); // holds contractor.read but scope none
    expect((await api(w.contractorUser.token).get("/")).body.data.rows).toEqual([]);
    expect((await api(w.inspector.token).get("/")).status).toBe(403);
    expect((await api(w.citizen.token).get("/")).status).toBe(403);
    expect((await api(w.officer.token).post("/", body())).status).toBe(403); // read only
    expect((await api(w.contractorUser.token).post("/", body())).status).toBe(403);
  });

  it("registers with audit, owner agency and server-side duplicate keys; the audit snapshot holds only allowlisted keys", async () => {
    await setup();
    const res = await api(w.gov.token).post("/", body());
    expect(res.status).toBe(201);
    const doc = (await Contractor.findById(res.body.data.id))!;
    expect(doc.registrationNumber).toBe("REG/001");
    expect(String(doc.registeredByAgencyId)).toBe(String(w.ministry._id));
    expect(doc.nameKey).toBe("alpha builders");
    expect(doc.taxIdKey).toBe("TAX1234");
    expect(doc.rating).toBeUndefined(); expect(doc.riskLevel).toBeUndefined();
    const audit = (await AuditLog.findOne({ action: "contractor.registered" }).select("+newValue"))!;
    expect(audit.resourceType).toBe("CONTRACTOR");
    expect(JSON.stringify(audit.toObject())).not.toMatch(/TAX-1234|ceo@alpha|0112223344/);
  });

  it("rejects exact duplicates (409), requires acknowledgement for possible ones, and never leaks out-of-scope detail", async () => {
    await setup();
    await api(w.gov.token).post("/", body());
    const exact = await api(w.gov.token).post("/", body({ name: "Different Name" }));
    expect(exact.status).toBe(409);
    expect(exact.body.error.details.kind).toBe("exact");
    const taxDup = await api(w.gov.token).post("/", body({ name: "Another", registrationNumber: "REG-2" }));
    expect(taxDup.status).toBe(409); // taxId is unique, so it is a hard block

    const possible = body({ registrationNumber: "REG-3", business: { registrationAuthority: "CIDA" }, contact: { email: "x@y.invalid" } });
    const first = await api(w.gov.token).post("/", possible);
    expect(first.status).toBe(409);
    expect(first.body.error.details).toMatchObject({ kind: "possible", acknowledgementRequired: true });
    const short = await api(w.gov.token).post("/", { ...possible, confirmNotDuplicate: true, duplicateAcknowledgement: "short" });
    expect(short.status).toBe(400);
    const ok = await api(w.gov.token).post("/", { ...possible, confirmNotDuplicate: true, duplicateAcknowledgement: "Different company, same trading name" });
    expect(ok.status).toBe(201);

    // The other ministry cannot see the record: a registration clash reveals only a boolean.
    const leak = await api(w.otherGov.token).post("/", body({ name: "Zeta", business: undefined }));
    expect(leak.status).toBe(409);
    expect(leak.body.error.details).toEqual({ kind: "exact", exact: [], existsOutsideScope: true });
    const check = await api(w.otherGov.token).get("/duplicate-check?registrationNumber=REG/001");
    expect(check.body.data).toEqual({ exact: [], possible: [], existsOutsideScope: true });
    expect(JSON.stringify(check.body)).not.toContain("Alpha");
    const visible = await api(w.gov.token).get("/duplicate-check?registrationNumber=REG/001");
    expect(visible.body.data.exact[0]).toMatchObject({ registrationNumber: "REG/001" });
    expect(visible.body.data.exact[0].contact).toBeUndefined();
  });

  it("directory rows never carry contact, tax id, documents or contract values; out-of-scope ids answer 404", async () => {
    await setup();
    const id = (await api(w.gov.token).post("/", body())).body.data.id as string;
    const list = await api(w.gov.token).get("/");
    expect(list.body.data.rows).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/TAX|ceo@alpha|0112223344|documentRefs|contractValue/);
    expect((await api(w.officer.token).get("/")).body.data.rows).toHaveLength(0); // child agency: not registered there, not assigned
    expect((await api(w.otherGov.token).get(`/${id}`)).status).toBe(404);
    expect((await api(w.officer.token).get(`/${id}`)).status).toBe(404);
    expect((await api(w.gov.token).get("/zzz")).status).toBe(404);
    const profile = await api(w.gov.token).get(`/${id}`);
    expect(profile.body.data.tier).toBe("manage");
    expect(profile.body.data.contact.email).toBe("ceo@alpha.invalid");
    // A sub-agency officer who works on the contractor sees only the directory tier.
    const project = await makeProject(w.child._id);
    await ContractorAssignment.create({ projectId: project._id, contractorId: id, agencyId: w.child._id, role: "PRIMARY", startDate: new Date(), assignedBy: w.gov.user._id });
    const asOfficer = await api(w.officer.token).get(`/${id}`);
    expect(asOfficer.status).toBe(200);
    expect(asOfficer.body.data.tier).toBe("directory");
    expect(JSON.stringify(asOfficer.body)).not.toMatch(/TAX|ceo@alpha|0112223344/);
    expect((await api(w.officer.token).get("/")).body.data.rows).toHaveLength(1);
  });

  it("rejects unknown and repeated query keys and bad bodies", async () => {
    await setup();
    expect((await api(w.gov.token).get("/?bogus=1")).status).toBe(400);
    expect((await api(w.gov.token).get("/?status=ACTIVE&status=SUSPENDED")).status).toBe(400);
    expect((await api(w.gov.token).get("/?limit=500")).status).toBe(400);
    expect((await api(w.gov.token).get("/?riskBand=WEAK")).status).toBe(200); // gov holds contractor.performance.read
    expect((await api(w.officer.token).get("/?riskBand=WEAK")).status).toBe(403);
    expect((await api(w.gov.token).post("/", body({ extra: 1 }))).status).toBe(400);
    expect((await api(w.gov.token).post("/", body({ operatingDistricts: ["Atlantis"] }))).status).toBe(400);
  });

  it("filters, sorts and paginates on the server", async () => {
    await setup();
    for (const [n, cat, district] of [["Bravo", "BRIDGE_STRUCTURAL", "Galle"], ["Alpha", "ROAD_CONSTRUCTION", "Colombo"], ["Charlie", "ROAD_CONSTRUCTION", "Galle"]] as const) {
      await api(w.gov.token).post("/", body({ name: n, registrationNumber: `R-${n}`, category: cat, operatingDistricts: [district], business: undefined, contact: undefined }));
    }
    const all = await api(w.gov.token).get("/?limit=2&page=1");
    expect(all.body.data.rows.map((r: { name: string }) => r.name)).toEqual(["Alpha", "Bravo"]);
    expect(all.body.data.total).toBe(3);
    expect((await api(w.gov.token).get("/?limit=2&page=2")).body.data.rows.map((r: { name: string }) => r.name)).toEqual(["Charlie"]);
    expect((await api(w.gov.token).get("/?district=Galle&category=ROAD_CONSTRUCTION")).body.data.rows.map((r: { name: string }) => r.name)).toEqual(["Charlie"]);
    const q = await api(w.gov.token).get("/?q=brav");
    expect(q.body.data.rows).toHaveLength(1);
    expect(q.body.data.facets.category.find((f: { value: string }) => f.value === "BRIDGE_STRUCTURAL").count).toBe(1);
  });

  it("patches with optimistic concurrency and audits changed field names only", async () => {
    await setup();
    const id = (await api(w.gov.token).post("/", body())).body.data.id as string;
    const before = (await Contractor.findById(id))!;
    const stamp = before.updatedAt.toISOString();
    const ok = await api(w.gov.token).patch(`/${id}`, { expectedUpdatedAt: stamp, name: "Alpha Renamed", contact: { email: "new@alpha.invalid" } });
    expect(ok.status).toBe(200);
    const stale = await api(w.gov.token).patch(`/${id}`, { expectedUpdatedAt: stamp, name: "Late edit" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.kind).toBe("stale");
    const audit = (await AuditLog.findOne({ action: "contractor.updated" }).select("+newValue"))!;
    expect(audit.newValue?.reason).toBe("changed: name, contact");
    expect(JSON.stringify(audit.toObject())).not.toContain("new@alpha");
    expect((await Contractor.findById(id))!.emailKey).toBe("new@alpha.invalid");
    expect((await api(w.officer.token).patch(`/${id}`, { expectedUpdatedAt: stamp, name: "x" })).status).toBe(403);
  });

  it("status changes: legal moves, reasons, ARCHIVED to ACTIVE only by platform, audited", async () => {
    await setup();
    const id = (await api(w.gov.token).post("/", body())).body.data.id as string;
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "SUSPENDED" })).status).toBe(400); // reason needed
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "SUSPENDED", reason: "too short" })).status).toBe(400);
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "SUSPENDED", reason: "Failed safety audit on site" })).status).toBe(200);
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "SUSPENDED", reason: "Failed safety audit on site" })).status).toBe(409);
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "ACTIVE" })).status).toBe(200);
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "ARCHIVED", reason: "Company dissolved in 2026" })).status).toBe(200);
    expect((await api(w.gov.token).post(`/${id}/status`, { status: "ACTIVE" })).status).toBe(403);
    expect((await api(w.superUser.token).post(`/${id}/status`, { status: "ACTIVE" })).status).toBe(200);
    const actions = (await AuditLog.find({ action: "contractor.status_changed" }).select("+newValue").sort({ timestamp: 1 })).map((a) => a.newValue?.status);
    expect(actions).toEqual(["SUSPENDED", "ACTIVE", "ARCHIVED", "ACTIVE"]);
  });

  it("certifications and document references: add, update, soft-revoke, remove, with audit", async () => {
    await setup();
    const id = (await api(w.gov.token).post("/", body())).body.data.id as string;
    expect((await api(w.gov.token).post(`/${id}/certifications`, { name: "CIDA C4", expiresOn: "2026-12-31" })).status).toBe(201);
    const cert = (await Contractor.findById(id))!.certifications[0]!;
    expect((await api(w.gov.token).post(`/${id}/certifications`, { name: "Bad", issuedOn: "2026-05-01", expiresOn: "2026-01-01" })).status).toBe(400);
    expect((await api(w.gov.token).patch(`/${id}/certifications/${cert._id}`, { issuer: "CIDA" })).status).toBe(200);
    expect((await api(w.gov.token).del(`/${id}/certifications/${cert._id}`, { reason: "no" })).status).toBe(400);
    expect((await api(w.gov.token).del(`/${id}/certifications/${cert._id}`, { reason: "Certificate withdrawn by the issuer" })).status).toBe(200);
    expect((await api(w.gov.token).patch(`/${id}/certifications/${cert._id}`, { issuer: "again" })).status).toBe(409);
    const revoked = (await Contractor.findById(id))!.certifications[0]!;
    expect(revoked.status).toBe("REVOKED"); // soft: the row stays
    expect((await api(w.gov.token).post(`/${id}/documents`, { type: "TAX", title: "Tax clearance 2026" })).status).toBe(201);
    expect((await api(w.gov.token).post(`/${id}/documents`, { type: "TAX", title: "Linked", documentId: "a".repeat(24) })).status).toBe(400);
    const ref = (await Contractor.findById(id))!.documentRefs[0]!;
    expect((await api(w.gov.token).del(`/${id}/documents/${ref._id}`)).status).toBe(200);
    expect((await Contractor.findById(id))!.documentRefs).toHaveLength(0);
    const actions = (await AuditLog.find({ resourceType: "CONTRACTOR" }).sort({ timestamp: 1 })).map((a) => a.action);
    expect(actions).toEqual(["contractor.registered", "contractor.certification_added", "contractor.certification_updated", "contractor.certification_revoked", "contractor.document_ref_added", "contractor.document_ref_removed"]);
    expect((await api(w.officer.token).post(`/${id}/certifications`, { name: "x" })).status).toBe(403);
  });

  it("summary is scoped and carries no sensitive data", async () => {
    await setup();
    await api(w.gov.token).post("/", body({ certifications: [{ name: "Soon", expiresOn: new Date(Date.now() + 10 * 86_400_000).toISOString() }, { name: "Old", expiresOn: "2020-01-01" }] }));
    const s = await api(w.gov.token).get("/summary");
    expect(s.status).toBe(200);
    expect(s.body.data).toMatchObject({ total: 1, certifications: { expiring30d: 1, expired: 1 }, withoutEvidence: 1 });
    expect((await api(w.otherGov.token).get("/summary")).body.data.total).toBe(0);
    expect((await api(w.gov.token).get("/summary?x=1")).status).toBe(400);
  });
});
