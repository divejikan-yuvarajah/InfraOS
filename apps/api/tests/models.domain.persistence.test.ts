import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures, id, money } from "./helpers/domain-fixtures.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";

describe("Step 13 domain persistence in disposable MongoDB", { timeout: 60_000 }, () => {
  beforeAll(async () => { await startIsolatedMongo(); });
  afterAll(async () => { await stopIsolatedMongo(); });

  it.each(Object.keys(fixtures) as (keyof typeof fixtures)[])("round-trips %s with ObjectIds and timestamps", async (name) => {
    const doc = fixtures[name]();
    await doc.save();
    const stored = await doc.collection.findOne({ _id: doc._id });
    expect(stored?._id.equals(doc._id)).toBe(true);
    expect(stored?.[name === "AuditLog" ? "timestamp" : "createdAt"]).toBeInstanceOf(Date);
    if (!["AuditLog", "RiskAssessment", "Notification"].includes(name)) expect(stored?.updatedAt).toBeInstanceOf(Date);
    if (name === "Project") {
      expect(stored?.startDate).toBeInstanceOf(Date);
      expect(stored?.budget).toEqual(money);
    }
  });

  it("resolves the domain graph against unchanged Step 12 identity/agency models", async () => {
    const role = await Role.create({ key: "PROJECT_MANAGER", name: "Test manager", description: "Synthetic test role", scopeType: "ASSIGNED_PROJECT", permissions: [] });
    const agency = await Agency.create({ code: "TEST_ROAD", name: "Synthetic agency", type: "ROAD" });
    const otherAgency = await Agency.create({ code: "TEST_WATER", name: "Synthetic water agency", type: "WATER" });
    const user = await User.create({ firstName: "Test", lastName: "User", email: "test@example.test", passwordHash: "test-only-placeholder".repeat(3), roleId: role._id, agencyId: agency._id });
    const contractor = await fixtures.Contractor({ registrationNumber: "TEST-GRAPH-0001" }).save();
    const project = await fixtures.Project({ projectCode: "INF-ROAD-0002", agencyId: agency._id, managerId: user._id, createdBy: user._id, contractorId: contractor._id }).save();
    await project.populate(["agencyId", "managerId", "contractorId", "createdBy"]);
    expect(project.populated("agencyId")).toEqual(agency._id);
    expect(project.populated("managerId")).toEqual(user._id);
    expect(project.populated("contractorId")).toEqual(contractor._id);
    expect(JSON.stringify(project)).not.toContain("passwordHash");

    const workA = await fixtures.WorkRequest({ projectId: project._id, agencyId: agency._id }).save();
    const workB = await fixtures.WorkRequest({ projectId: project._id, agencyId: otherAgency._id }).save();
    const conflict = await fixtures.Conflict({ workRequestA: workA._id, workRequestB: workB._id }).save();
    const coordination = await fixtures.CoordinationRequest({ conflictId: conflict._id, fromAgency: agency._id, toAgency: otherAgency._id }).save();
    const document = await fixtures.Document({ projectId: project._id, uploadedBy: user._id }).save();
    const chunk = await fixtures.DocumentChunk({ projectId: project._id, documentId: document._id }).save();
    const asset = await fixtures.Asset({ sourceProjectId: project._id, agencyId: agency._id }).save();
    const maintenance = await fixtures.MaintenanceRecord({ assetId: asset._id }).save();
    const milestone = await fixtures.Milestone({ projectId: project._id }).save();
    const payment = await fixtures.ProjectPayment({ projectId: project._id, contractorId: contractor._id, createdBy: user._id }).save();
    const inspection = await fixtures.Inspection({ projectId: project._id, inspectorId: user._id, evidence: [document._id] }).save();
    const issue = await fixtures.CitizenIssue({ citizenId: user._id, assignedAgency: agency._id }).save();
    const notification = await fixtures.Notification({ userId: user._id, resourceType: "PROJECT", resourceId: project._id }).save();
    const risk = await fixtures.RiskAssessment({ projectId: project._id }).save();
    const audit = await fixtures.AuditLog({ userId: user._id, agencyId: agency._id, resourceId: project._id }).save();

    for (const [doc, paths] of [
      [workA, ["projectId", "agencyId"]], [conflict, ["workRequestA", "workRequestB"]],
      [coordination, ["conflictId", "fromAgency", "toAgency"]], [document, ["projectId", "uploadedBy"]],
      [chunk, ["documentId", "projectId"]], [asset, ["sourceProjectId", "agencyId"]],
      [maintenance, ["assetId"]], [milestone, ["projectId"]], [payment, ["projectId", "contractorId", "createdBy"]],
      [inspection, ["projectId", "inspectorId", "evidence"]], [issue, ["citizenId", "assignedAgency"]],
      [notification, ["userId"]], [risk, ["projectId"]], [audit, ["userId", "agencyId"]],
    ] as const) {
      await doc.populate([...paths]);
      for (const path of paths) {
        expect(doc.populated(path), path).toBeDefined();
        expect(doc.get(path), path).not.toBeNull();
      }
    }
    // Assessment persistence must never set the official project state.
    expect((await Project.findById(project._id))?.status).toBe("DRAFT");
  });

  it("hides stored document keys and extracted text from ordinary queries", async () => {
    const doc = await fixtures.Document({ storageKey: "private/test-object" }).save();
    const chunk = await fixtures.DocumentChunk({ documentId: doc._id }).save();
    expect((await Document.findById(doc._id))?.storageKey).toBeUndefined();
    expect((await DocumentChunk.findById(chunk._id))?.content).toBeUndefined();
    expect((await DocumentChunk.findById(chunk._id).select("+content"))?.content).toBe("Synthetic test content");
  });

  it("keeps audit records append-only across save/query/document/bulk mutation paths", async () => {
    const audit = await fixtures.AuditLog({ newValue: { budget: money } }).save();
    audit.action = "project.deleted";
    await expect(audit.save()).rejects.toThrow("append-only");
    const filter = { _id: audit._id };
    const change = { action: "project.deleted" };
    const attempts = [
      () => AuditLog.updateOne(filter, change), () => AuditLog.updateMany(filter, change),
      () => AuditLog.replaceOne(filter, change), () => AuditLog.findOneAndUpdate(filter, change),
      () => AuditLog.findOneAndReplace(filter, change), () => AuditLog.findOneAndDelete(filter),
      () => AuditLog.deleteOne(filter), () => AuditLog.deleteMany(filter), () => audit.deleteOne(),
      () => AuditLog.bulkWrite([{ updateOne: { filter, update: { $set: change } } }]),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow("append-only");
    const stored = await AuditLog.findById(audit._id);
    expect(stored?.action).toBe("project.updated");
    expect(stored?.newValue).toBeUndefined();
    const inserts = await AuditLog.insertMany([{ action: "project.created", resourceType: "PROJECT", resourceId: id() }]);
    expect(inserts).toHaveLength(1);
  });
});
