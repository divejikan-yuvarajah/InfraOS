import mongoose, { type Schema } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Asset } from "../src/modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../src/modules/assets/models/maintenance-record.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { DocumentChunk } from "../src/modules/documents/models/document-chunk.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { CitizenIssue } from "../src/modules/issues/models/citizen-issue.model.js";
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { RiskAssessment } from "../src/modules/risk/models/risk-assessment.model.js";
import { Conflict } from "../src/modules/roadsync/models/conflict.model.js";
import { CoordinationRequest } from "../src/modules/roadsync/models/coordination-request.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { inspectIndexes } from "../src/shared/database/index-inspection.js";
import { INDEX_MODELS } from "../src/shared/database/index-models.js";
import { validGeometry } from "../src/shared/database/geometry.js";
import { fixtures, id } from "./helpers/domain-fixtures.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

function hasIndex(
  schema: Schema,
  key: Record<string, number | string>,
  options: Record<string, unknown> = {},
): boolean {
  return schema.indexes().some(([candidate, candidateOptions]) =>
    JSON.stringify(candidate) === JSON.stringify(key) &&
    Object.entries(options).every(([name, value]) =>
      JSON.stringify(candidateOptions[name]) === JSON.stringify(value)),
  );
}

describe("Step 14 index declarations", () => {
  it("declares unique, compound, history, and spatial indexes for actual query patterns", () => {
    expect(hasIndex(Project.schema, { projectCode: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(Project.schema, { agencyId: 1, status: 1, plannedEndDate: 1 })).toBe(true);
    expect(hasIndex(Project.schema, { geometry: "2dsphere" })).toBe(true);
    expect(hasIndex(Milestone.schema, { projectId: 1, plannedEnd: 1 })).toBe(true);
    expect(hasIndex(WorkRequest.schema, { geometry: "2dsphere", status: 1, plannedStart: 1, plannedEnd: 1 })).toBe(true);
    expect(hasIndex(Conflict.schema, { status: 1, severity: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(Conflict.schema, { activePairKey: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(CoordinationRequest.schema, { toAgency: 1, status: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(Contractor.schema, { registrationNumber: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(Document.schema, { projectId: 1, documentType: 1 })).toBe(true);
    expect(hasIndex(DocumentChunk.schema, { documentId: 1, chunkIndex: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(ProjectPayment.schema, { projectId: 1, date: -1 })).toBe(true);
    expect(hasIndex(Inspection.schema, { inspectorId: 1, status: 1, inspectionDate: -1 })).toBe(true);
    expect(hasIndex(Asset.schema, { geometry: "2dsphere" })).toBe(true);
    expect(hasIndex(MaintenanceRecord.schema, { status: 1, scheduledDate: 1 })).toBe(true);
    expect(hasIndex(CitizenIssue.schema, { geometry: "2dsphere" })).toBe(true);
    expect(hasIndex(Notification.schema, { userId: 1, isRead: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(RiskAssessment.schema, { projectId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(AuditLog.schema, { resourceType: 1, resourceId: 1, timestamp: -1 })).toBe(true);
  });
});

describe("GeoJSON validation", () => {
  it("accepts bounded Point, LineString, and closed Polygon geometry", () => {
    expect(validGeometry({ type: "Point", coordinates: [79.8612, 6.9271] })).toBe(true);
    expect(validGeometry({
      type: "LineString",
      coordinates: [[79.8612, 6.9271], [79.862, 6.928]],
    })).toBe(true);
    expect(validGeometry({
      type: "Polygon",
      coordinates: [[
        [79.86, 6.92], [79.87, 6.92], [79.87, 6.93], [79.86, 6.92],
      ]],
    })).toBe(true);
  });

  it.each([
    { type: "MultiPolygon", coordinates: [] },
    { type: "Point", coordinates: [181, 6.9] },
    { type: "Point", coordinates: [79.8, 91] },
    { type: "Point", coordinates: [] },
    { type: "LineString", coordinates: [] },
    { type: "Polygon", coordinates: [[[79.86, 6.92], [79.87, 6.92], [79.87, 6.93], [79.86, 6.93]]] },
  ])("rejects invalid or unsupported geometry %#", (geometry) => {
    expect(validGeometry(geometry)).toBe(false);
  });
});

describe("Step 14 disposable MongoDB integration", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Promise.all(INDEX_MODELS.map((model) => model.createIndexes()));
  });

  afterEach(async () => {
    await Promise.all([
      Project.deleteMany({}),
      WorkRequest.deleteMany({}),
      Conflict.deleteMany({}),
      Contractor.deleteMany({}),
      DocumentChunk.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("retrieves nearby, date-overlapping work candidates and excludes far or non-overlapping work", async () => {
    const projectId = id();
    const agencyId = id();
    const near = await fixtures.WorkRequest({
      projectId,
      agencyId,
      status: "ACTIVE",
      geometry: { type: "LineString", coordinates: [[79.8612, 6.9271], [79.862, 6.928]] },
      plannedStart: new Date("2026-01-10T00:00:00Z"),
      plannedEnd: new Date("2026-04-20T00:00:00Z"),
    }).save();
    await fixtures.WorkRequest({
      projectId,
      agencyId,
      status: "ACTIVE",
      geometry: { type: "LineString", coordinates: [[80.6337, 7.2906], [80.634, 7.291]] },
      plannedStart: new Date("2026-03-01T00:00:00Z"),
      plannedEnd: new Date("2026-05-01T00:00:00Z"),
    }).save();
    await fixtures.WorkRequest({
      projectId,
      agencyId,
      status: "ACTIVE",
      geometry: { type: "LineString", coordinates: [[79.8613, 6.9272], [79.8621, 6.9281]] },
      plannedStart: new Date("2027-01-01T00:00:00Z"),
      plannedEnd: new Date("2027-02-01T00:00:00Z"),
    }).save();

    const candidates = await WorkRequest.find({
      geometry: {
        $near: {
          $geometry: { type: "Point", coordinates: [79.8612, 6.9271] },
          $maxDistance: 2_000,
        },
      },
      status: "ACTIVE",
      plannedStart: { $lte: new Date("2026-05-01T00:00:00Z") },
      plannedEnd: { $gte: new Date("2026-03-01T00:00:00Z") },
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual([near.id]);

    const swappedCoordinateResults = await WorkRequest.find({
      geometry: {
        $near: {
          $geometry: { type: "Point", coordinates: [6.9271, 79.8612] },
          $maxDistance: 2_000,
        },
      },
    });
    expect(swappedCoordinateResults).toHaveLength(0);
  });

  it("enforces required unique constraints and permits resolved conflict history", async () => {
    await fixtures.Project().save();
    await expect(fixtures.Project().save()).rejects.toMatchObject({ code: 11000 });
    await fixtures.Contractor().save();
    await expect(fixtures.Contractor().save()).rejects.toMatchObject({ code: 11000 });

    const documentId = id();
    await fixtures.DocumentChunk({ documentId, chunkIndex: 0 }).save();
    await expect(fixtures.DocumentChunk({ documentId, chunkIndex: 0 }).save()).rejects.toMatchObject({ code: 11000 });

    const left = id();
    const right = id();
    const active = await fixtures.Conflict({ workRequestA: left, workRequestB: right }).save();
    expect(active.workRequestA.toHexString() < active.workRequestB.toHexString()).toBe(true);
    await expect(fixtures.Conflict({ workRequestA: right, workRequestB: left }).save()).rejects.toMatchObject({ code: 11000 });
    await fixtures.Conflict({ workRequestA: right, workRequestB: left, status: "RESOLVED" }).save();
    await fixtures.Conflict({ workRequestA: left, workRequestB: right, status: "CLOSED" }).save();
  });

  it("checks installed indexes without changing them", async () => {
    const before = await WorkRequest.collection.listIndexes().toArray();
    const reports = await inspectIndexes(
      mongoose.connection,
      INDEX_MODELS,
    );
    const after = await WorkRequest.collection.listIndexes().toArray();
    for (const report of reports) {
      expect(report.missing, report.collection).toEqual([]);
      expect(report.mismatch, report.collection).toEqual([]);
    }
    expect(after).toEqual(before);
  });

  it("enforces maintenance completion after its scheduled date", async () => {
    await expect(fixtures.MaintenanceRecord({
      scheduledDate: new Date("2026-04-01T00:00:00Z"),
      completedDate: new Date("2026-03-31T00:00:00Z"),
    }).validate()).rejects.toThrow("completedDate");
  });
});
