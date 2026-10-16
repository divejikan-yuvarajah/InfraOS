import { Types } from "mongoose";
import { Project } from "../../src/modules/projects/models/project.model.js";
import { Milestone } from "../../src/modules/projects/models/milestone.model.js";
import { WorkRequest } from "../../src/modules/roadsync/models/work-request.model.js";
import { Conflict } from "../../src/modules/roadsync/models/conflict.model.js";
import { CoordinationRequest } from "../../src/modules/roadsync/models/coordination-request.model.js";
import { Contractor } from "../../src/modules/contractors/models/contractor.model.js";
import { ProjectPayment } from "../../src/modules/finance/models/project-payment.model.js";
import { Document } from "../../src/modules/documents/models/document.model.js";
import { DocumentChunk } from "../../src/modules/documents/models/document-chunk.model.js";
import { Inspection } from "../../src/modules/inspections/models/inspection.model.js";
import { Asset } from "../../src/modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../../src/modules/assets/models/maintenance-record.model.js";
import { CitizenIssue } from "../../src/modules/issues/models/citizen-issue.model.js";
import { Notification } from "../../src/modules/notifications/models/notification.model.js";
import { RiskAssessment } from "../../src/modules/risk/models/risk-assessment.model.js";
import { AuditLog } from "../../src/modules/audit/models/audit-log.model.js";

export const id = () => new Types.ObjectId();
export const dates = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") };
export const point = { type: "Point", coordinates: [79.86, 6.92] };
export const money = { amountMinor: 100_000, currency: "LKR" };

export const fixtures = {
  Project: (patch = {}) => new Project({ projectCode: "INF-ROAD-0001", title: "Synthetic road project", projectType: "ROAD", agencyId: id(), createdBy: id(), budget: money, startDate: dates.start, plannedEndDate: dates.end, geometry: point, ...patch }),
  Milestone: (patch = {}) => new Milestone({ projectId: id(), title: "Synthetic milestone", plannedStart: dates.start, plannedEnd: dates.end, ...patch }),
  WorkRequest: (patch = {}) => new WorkRequest({ projectId: id(), agencyId: id(), geometry: point, workType: "ROAD_RESURFACING", plannedStart: dates.start, plannedEnd: dates.end, ...patch }),
  Conflict: (patch = {}) => new Conflict({ workRequestA: id(), workRequestB: id(), conflictType: "NEARBY_WORK", distance: 20, scheduleOverlap: true, severity: "HIGH", ...patch }),
  CoordinationRequest: (patch = {}) => new CoordinationRequest({ conflictId: id(), fromAgency: id(), toAgency: id(), message: "Synthetic coordination request", ...patch }),
  Contractor: (patch = {}) => new Contractor({ name: "Synthetic contractor", registrationNumber: "TEST-0001", riskLevel: "LOW", ...patch }),
  ProjectPayment: (patch = {}) => new ProjectPayment({ projectId: id(), contractorId: id(), amount: money, paymentType: "INTERIM", date: dates.start, createdBy: id(), ...patch }),
  Document: (patch = {}) => new Document({ projectId: id(), documentType: "CONTRACT", fileName: "synthetic.pdf", uploadedBy: id(), ...patch }),
  DocumentChunk: (patch = {}) => new DocumentChunk({ projectId: id(), documentId: id(), chunkIndex: 0, content: "Synthetic test content", ...patch }),
  Inspection: (patch = {}) => new Inspection({ projectId: id(), inspectorId: id(), inspectionDate: dates.start, ...patch }),
  Asset: (patch = {}) => new Asset({ sourceProjectId: id(), agencyId: id(), assetType: "ROAD", name: "Synthetic road", commissionedAt: dates.end, ...patch }),
  MaintenanceRecord: (patch = {}) => new MaintenanceRecord({ assetId: id(), maintenanceType: "ROUTINE", scheduledDate: dates.end, cost: money, ...patch }),
  CitizenIssue: (patch = {}) => new CitizenIssue({ citizenId: id(), category: "POTHOLE", description: "Synthetic issue", location: { locality: "Test locality" }, geometry: point, ...patch }),
  Notification: (patch = {}) => new Notification({ userId: id(), type: "SYSTEM", title: "Synthetic notice", message: "Test message", ...patch }),
  RiskAssessment: (patch = {}) => new RiskAssessment({ projectId: id(), overallRisk: 40, delayRisk: 30, budgetRisk: 20, scheduleRisk: 10, modelVersion: "TEST-RULES-v1", ...patch }),
  AuditLog: (patch = {}) => new AuditLog({ userId: id(), action: "project.updated", resourceType: "PROJECT", resourceId: id(), ...patch }),
};
