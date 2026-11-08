import { Agency } from "../../modules/agencies/models/agency.model.js";
import { Asset } from "../../modules/assets/models/asset.model.js";
import { AssetConditionAssessment } from "../../modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../../modules/assets/models/asset-conversion.model.js";
import { MaintenanceEvidence } from "../../modules/assets/models/maintenance-evidence.model.js";
import { MaintenanceRecord } from "../../modules/assets/models/maintenance-record.model.js";
import { AuditLog } from "../../modules/audit/models/audit-log.model.js";
import { ContractorAssignment } from "../../modules/contractors/models/contractor-assignment.model.js";
import { Contractor } from "../../modules/contractors/models/contractor.model.js";
import { DocumentChunk } from "../../modules/documents/models/document-chunk.model.js";
import { Document } from "../../modules/documents/models/document.model.js";
import { DocumentUpload } from "../../modules/documents/models/document-upload.model.js";
import { DocumentVersion } from "../../modules/documents/models/document-version.model.js";
import { ProjectBudgetRevision } from "../../modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../../modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../../modules/finance/models/project-payment.model.js";
import { EmailVerificationChallenge } from "../../modules/identity/models/email-verification-challenge.model.js";
import { PasswordResetChallenge } from "../../modules/identity/models/password-reset-challenge.model.js";
import { RefreshFamily } from "../../modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../../modules/identity/models/refresh-session.model.js";
import { Role } from "../../modules/identity/models/role.model.js";
import { User } from "../../modules/identity/models/user.model.js";
import { InspectionEvidence } from "../../modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../../modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../../modules/inspections/models/progress-verification.model.js";
import { CitizenIssue } from "../../modules/issues/models/citizen-issue.model.js";
import { Notification } from "../../modules/notifications/models/notification.model.js";
import { Milestone } from "../../modules/projects/models/milestone.model.js";
import { Project } from "../../modules/projects/models/project.model.js";
import { HazardZone } from "../../modules/risk/models/hazard-zone.model.js";
import { RiskAssessment } from "../../modules/risk/models/risk-assessment.model.js";
import { Candidate } from "../../modules/roadsync/models/candidate.model.js";
import { Conflict } from "../../modules/roadsync/models/conflict.model.js";
import { ConflictRead, ConflictRecord, RoadsyncCounter } from "../../modules/roadsync/models/conflict-record.model.js";
import { CoordinationRequest } from "../../modules/roadsync/models/coordination-request.model.js";
import {
  CoordinationMessage,
  CoordinationRead,
  CoordinationRequest as RoadsyncCoordinationRequest,
} from "../../modules/roadsync/models/coordination.model.js";
import { Recommendation } from "../../modules/roadsync/models/recommendation.model.js";
import { Amendment, LedgerEntry, Resolution } from "../../modules/roadsync/models/resolution.model.js";
import { Scenario } from "../../modules/roadsync/models/scenario.model.js";
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
  Candidate,
  ConflictRecord,
  ConflictRead,
  RoadsyncCounter,
  RoadsyncCoordinationRequest,
  CoordinationMessage,
  CoordinationRead,
  Resolution,
  Amendment,
  LedgerEntry,
  Scenario,
  Recommendation,
  Contractor,
  ContractorAssignment,
  ProjectPayment,
  ProjectBudgetRevision,
  ProjectExpense,
  Document,
  DocumentChunk,
  DocumentVersion,
  DocumentUpload,
  Inspection,
  InspectionEvidence,
  ProgressVerification,
  Asset,
  AssetConversion,
  AssetConditionAssessment,
  MaintenanceRecord,
  MaintenanceEvidence,
  CitizenIssue,
  Notification,
  RiskAssessment,
  HazardZone,
  AuditLog,
] as const;
