import { Agency } from "../../modules/agencies/models/agency.model.js";
import { Asset } from "../../modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../../modules/assets/models/maintenance-record.model.js";
import { AuditLog } from "../../modules/audit/models/audit-log.model.js";
import { Contractor } from "../../modules/contractors/models/contractor.model.js";
import { DocumentChunk } from "../../modules/documents/models/document-chunk.model.js";
import { Document } from "../../modules/documents/models/document.model.js";
import { ProjectPayment } from "../../modules/finance/models/project-payment.model.js";
import { EmailVerificationChallenge } from "../../modules/identity/models/email-verification-challenge.model.js";
import { PasswordResetChallenge } from "../../modules/identity/models/password-reset-challenge.model.js";
import { RefreshFamily } from "../../modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../../modules/identity/models/refresh-session.model.js";
import { Role } from "../../modules/identity/models/role.model.js";
import { User } from "../../modules/identity/models/user.model.js";
import { Inspection } from "../../modules/inspections/models/inspection.model.js";
import { CitizenIssue } from "../../modules/issues/models/citizen-issue.model.js";
import { Notification } from "../../modules/notifications/models/notification.model.js";
import { Milestone } from "../../modules/projects/models/milestone.model.js";
import { Project } from "../../modules/projects/models/project.model.js";
import { RiskAssessment } from "../../modules/risk/models/risk-assessment.model.js";
import { Conflict } from "../../modules/roadsync/models/conflict.model.js";
import { CoordinationRequest } from "../../modules/roadsync/models/coordination-request.model.js";
import { WorkRequest } from "../../modules/roadsync/models/work-request.model.js";

/** Every persisted model inspected by the read-only index check command. */
export const INDEX_MODELS = [
  User,
  Role,
  Agency,
  RefreshSession,
  RefreshFamily,
  EmailVerificationChallenge,
  PasswordResetChallenge,
  Project,
  Milestone,
  WorkRequest,
  Conflict,
  CoordinationRequest,
  Contractor,
  ProjectPayment,
  Document,
  DocumentChunk,
  Inspection,
  Asset,
  MaintenanceRecord,
  CitizenIssue,
  Notification,
  RiskAssessment,
  AuditLog,
] as const;
