import { describe, expect, it } from "vitest";
import { fixtures, id, money, point } from "./helpers/domain-fixtures.js";

type ModelName = keyof typeof fixtures;

describe("Step 13 domain schema validation (no database)", () => {
  it.each(Object.keys(fixtures) as ModelName[])("accepts a valid %s", async (name) => {
    await expect(fixtures[name]().validate()).resolves.toBeUndefined();
  });

  const invalidEnums: [ModelName, string][] = [
    ["Project", "projectType"], ["Project", "status"], ["Milestone", "status"],
    ["WorkRequest", "workType"], ["WorkRequest", "status"], ["WorkRequest", "priority"],
    ["Conflict", "conflictType"], ["Conflict", "severity"], ["Conflict", "status"],
    ["CoordinationRequest", "status"], ["Contractor", "riskLevel"], ["Contractor", "status"],
    ["ProjectPayment", "paymentType"], ["ProjectPayment", "status"],
    ["Document", "documentType"], ["Document", "extractedTextStatus"], ["Document", "visibility"],
    ["Inspection", "status"], ["Asset", "assetType"], ["Asset", "condition"],
    ["MaintenanceRecord", "maintenanceType"], ["MaintenanceRecord", "status"],
    ["CitizenIssue", "category"], ["CitizenIssue", "status"], ["CitizenIssue", "priority"],
    ["Notification", "type"], ["Notification", "resourceType"], ["AuditLog", "resourceType"],
  ];
  it.each(invalidEnums)("rejects unknown %s.%s", async (name, field) => {
    await expect(fixtures[name]({ [field]: "UNRECOGNIZED" }).validate()).rejects.toThrow(field);
  });

  const percentages: [ModelName, string][] = [
    ["Project", "physicalProgress"], ["Project", "financialProgress"], ["Project", "riskScore"],
    ["Milestone", "progress"], ["Inspection", "physicalProgress"], ["Asset", "healthScore"],
    ["RiskAssessment", "overallRisk"], ["RiskAssessment", "delayRisk"],
    ["RiskAssessment", "budgetRisk"], ["RiskAssessment", "scheduleRisk"],
  ];
  it.each(percentages)("bounds %s.%s at 0–100", async (name, field) => {
    for (const value of [-1, 101, Infinity, NaN]) {
      await expect(fixtures[name]({ [field]: value }).validate()).rejects.toThrow(field);
    }
    for (const value of [0, 100]) {
      await expect(fixtures[name]({ [field]: value }).validate()).resolves.toBeUndefined();
    }
  });

  it.each<[ModelName, string]>([["Project", "budget"], ["ProjectPayment", "amount"], ["MaintenanceRecord", "cost"]])("uses safe integer LKR minor units in %s.%s", async (name, field) => {
    for (const amountMinor of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(fixtures[name]({ [field]: { ...money, amountMinor } }).validate()).rejects.toThrow("amountMinor");
    }
    await expect(fixtures[name]({ [field]: { amountMinor: 0, currency: "LKR" } }).validate()).resolves.toBeUndefined();
    await expect(fixtures[name]({ [field]: { ...money, currency: "USD" } }).validate()).rejects.toThrow("currency");
    await expect(fixtures[name]({ [field]: { currency: "LKR" } }).validate()).rejects.toThrow("amountMinor");
  });

  const refs: [ModelName, string][] = [
    ["Project", "agencyId"], ["Project", "createdBy"], ["Milestone", "projectId"],
    ["WorkRequest", "projectId"], ["WorkRequest", "agencyId"],
    ["Conflict", "workRequestA"], ["Conflict", "workRequestB"],
    ["CoordinationRequest", "conflictId"], ["CoordinationRequest", "fromAgency"], ["CoordinationRequest", "toAgency"],
    ["ProjectPayment", "projectId"], ["ProjectPayment", "contractorId"], ["ProjectPayment", "createdBy"],
    ["Document", "projectId"], ["Document", "uploadedBy"],
    ["DocumentChunk", "documentId"], ["DocumentChunk", "projectId"],
    ["Inspection", "projectId"], ["Inspection", "inspectorId"],
    ["Asset", "sourceProjectId"], ["Asset", "agencyId"], ["MaintenanceRecord", "assetId"],
    ["CitizenIssue", "citizenId"], ["Notification", "userId"], ["RiskAssessment", "projectId"],
    ["AuditLog", "resourceId"],
  ];
  it.each(refs)("requires a well-formed %s.%s", async (name, field) => {
    for (const value of [undefined, "invalid-id"]) {
      await expect(fixtures[name]({ [field]: value }).validate()).rejects.toThrow(field);
    }
  });

  it("allows draft project assignments to remain unset and preserves stable codes", async () => {
    const project = fixtures.Project();
    expect(project.managerId).toBeUndefined();
    expect(project.contractorId).toBeUndefined();
    expect(project.schema.path("projectCode").options.immutable).toBe(true);
    await expect(fixtures.Project({ projectCode: "arbitrary" }).validate()).rejects.toThrow("projectCode");
  });

  it.each<[ModelName, string, string]>([["Project", "startDate", "plannedEndDate"], ["Milestone", "plannedStart", "plannedEnd"], ["Milestone", "actualStart", "actualEnd"], ["WorkRequest", "plannedStart", "plannedEnd"]])("rejects reversed %s dates (%s, %s)", async (name, start, end) => {
    await expect(fixtures[name]({ [start]: "2026-03-01", [end]: "2026-01-01" }).validate()).rejects.toThrow(end);
    await expect(fixtures[name]({ [start]: "not-a-date" }).validate()).rejects.toThrow(start);
  });

  it.each(["Project", "WorkRequest", "Asset", "CitizenIssue"] as const)("validates %s GeoJSON", async (name) => {
    const geometries = [point, { type: "LineString", coordinates: [[79, 6], [80, 7]] }, { type: "Polygon", coordinates: [[[79, 6], [80, 6], [80, 7], [79, 6]]] }];
    for (const geometry of geometries) {
      await expect(fixtures[name]({ geometry }).validate()).resolves.toBeUndefined();
    }
    for (const geometry of [
      { type: "Point", coordinates: [181, 0] }, { type: "Point", coordinates: [79, 91] },
      { type: "Point", coordinates: ["79", 6] }, { type: "Point", coordinates: [79, 6, 0] },
      { type: "Point", coordinates: [NaN, 6] }, { type: "LineString", coordinates: [[79, 6]] },
      { type: "Polygon", coordinates: [[[79, 6], [80, 6], [80, 7], [79, 7]]] },
      { type: "MultiPoint", coordinates: [[79, 6]] }, { type: "Point" },
      { type: "LineString", coordinates: new Array(2) },
      { type: "Polygon", coordinates: new Array(1) },
    ]) {
      await expect(fixtures[name]({ geometry }).validate()).rejects.toThrow(/geometry/);
    }
  });

  it("requires work geometry, rejects self-conflicts and negative/nonfinite distance", async () => {
    await expect(fixtures.WorkRequest({ geometry: undefined }).validate()).rejects.toThrow("geometry");
    const workId = id();
    await expect(fixtures.Conflict({ workRequestA: workId, workRequestB: workId }).validate()).rejects.toThrow("itself");
    for (const distance of [-1, Infinity]) await expect(fixtures.Conflict({ distance }).validate()).rejects.toThrow("distance");
    await expect(fixtures.Conflict({ scheduleOverlap: undefined }).validate()).rejects.toThrow("scheduleOverlap");
  });

  it("validates contractor identifiers, ratings, and cached counts", async () => {
    for (const registrationNumber of ["", " ", "invalid!", "X".repeat(81)]) await expect(fixtures.Contractor({ registrationNumber }).validate()).rejects.toThrow("registrationNumber");
    for (const field of ["activeProjects", "completedProjects"]) await expect(fixtures.Contractor({ [field]: 0.5 }).validate()).rejects.toThrow(field);
    await expect(fixtures.Contractor({ rating: 6 }).validate()).rejects.toThrow("rating");
  });

  it("rejects payment submitter self-approval without comparing Contractor ids to User ids", async () => {
    const actor = id();
    await expect(fixtures.ProjectPayment({ createdBy: actor, approvedBy: actor }).validate()).rejects.toThrow("own payment");
  });

  it("bounds text, chunks, attachment arrays, and structured risk output", async () => {
    await expect(fixtures.Project({ title: "x".repeat(201) }).validate()).rejects.toThrow("title");
    await expect(fixtures.DocumentChunk({ content: "x".repeat(20_001) }).validate()).rejects.toThrow("content");
    await expect(fixtures.DocumentChunk({ chunkIndex: -1 }).validate()).rejects.toThrow("chunkIndex");
    await expect(fixtures.Inspection({ evidence: Array.from({ length: 51 }, id) }).validate()).rejects.toThrow("evidence");
    await expect(fixtures.Inspection({ evidence: ["binary-data"] }).validate()).rejects.toThrow("evidence");
    await expect(fixtures.CitizenIssue({ photos: Array(11).fill({ storageKey: "test/key", fileName: "test.jpg" }) }).validate()).rejects.toThrow("photos");
    await expect(fixtures.RiskAssessment({ factors: [{ category: "MAGIC", description: "test", score: 20 }] }).validate()).rejects.toThrow("category");
    await expect(fixtures.RiskAssessment({ factors: [{ category: "DELAY", description: "test", score: 101 }] }).validate()).rejects.toThrow("score");
    await expect(fixtures.RiskAssessment({ recommendations: Array(21).fill("test") }).validate()).rejects.toThrow("recommendations");
    await expect(fixtures.RiskAssessment({ recommendations: ["x".repeat(1001)] }).validate()).rejects.toThrow("recommendations");
  });

  it("defaults documents private, excludes storage from JSON, and rejects signed URLs", async () => {
    const doc = fixtures.Document({ storageKey: "private/test", storageUrl: "https://storage.example.test/object" });
    await doc.validate();
    expect(doc.visibility).toBe("INTERNAL");
    expect(doc.toJSON()).not.toHaveProperty("storageKey");
    expect(doc.toJSON()).not.toHaveProperty("storageUrl");
    for (const storageUrl of ["https://storage.example.test/key?token=test", "https://user:pass@example.test/key", "http://example.test/key"]) await expect(fixtures.Document({ storageUrl }).validate()).rejects.toThrow("storageUrl");
  });

  it("supports unlinked system notifications and controlled paired resource links", async () => {
    expect(fixtures.Notification().isRead).toBe(false);
    await expect(fixtures.Notification({ isRead: "sometimes" }).validate()).rejects.toThrow("isRead");
    await expect(fixtures.Notification({ resourceType: "PROJECT" }).validate()).rejects.toThrow("resourceId");
    await expect(fixtures.Notification({ resourceId: id() }).validate()).rejects.toThrow("resourceId");
    await expect(fixtures.Notification({ resourceType: "PROJECT", resourceId: id(), isRead: true }).validate()).resolves.toBeUndefined();
    expect(fixtures.Notification().schema.path("resourceId").options.refPath).toBeUndefined();
  });

  it("requires audit action/resource and rejects secret or full-document snapshots", async () => {
    for (const field of ["action", "resourceType", "resourceId"]) await expect(fixtures.AuditLog({ [field]: undefined }).validate()).rejects.toThrow(field);
    for (const key of ["password", "passwordHash", "accessToken", "refreshToken", "resetToken", "apiSecret", "content", "body", "nested"]) {
      await expect(fixtures.AuditLog({ oldValue: { [key]: "test-only" } }).validate()).rejects.toThrow("oldValue");
      await expect(fixtures.AuditLog({ newValue: { [key]: "test-only" } }).validate()).rejects.toThrow("newValue");
    }
    const audit = fixtures.AuditLog({ oldValue: { physicalProgress: 10 }, newValue: { physicalProgress: 20 }, ipAddress: "127.0.0.1", userAgent: "test" });
    await audit.validate();
    for (const key of ["oldValue", "newValue", "ipAddress", "userAgent"]) expect(audit.toJSON()).not.toHaveProperty(key);
  });
});
