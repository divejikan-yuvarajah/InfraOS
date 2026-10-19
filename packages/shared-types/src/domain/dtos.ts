import type { AgencyStatus, AgencyType, SystemRoleKey, UserStatus } from "../identity.js";
import type { Permission } from "../permissions.js";
import type { EntityId, IsoDateTimeString, MoneyDto, PercentageScore } from "../primitives.js";
import type { WireTimestamps } from "../api/contracts.js";
import type { InfraGeometry } from "../geo/geometry.js";
import type {
  AssetCondition,
  AssetType,
  ConflictSeverity,
  ConflictStatus,
  ConflictType,
  ContractorStatus,
  ContractorRiskLevel,
  CoordinationStatus,
  DocumentProcessingStatus,
  DocumentType,
  DocumentVisibility,
  InspectionStatus,
  IssueCategory,
  IssueStatus,
  MaintenanceStatus,
  MilestoneStatus,
  NotificationResource,
  NotificationType,
  PaymentStatus,
  PaymentType,
  ProjectStatus,
  ProjectType,
  WorkPriority,
  WorkStatus,
  WorkType,
} from "../domain/enums.js";

export interface LocationDto {
  province?: string;
  district?: string;
  locality?: string;
  roadName?: string;
  description?: string;
}

export interface SafeUserDto {
  id: EntityId;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  roleKey: SystemRoleKey;
  agencyId: EntityId | null;
  status: UserStatus;
}

export interface CurrentUserDto {
  id: EntityId;
  displayName: string;
  email: string;
  roleKey: SystemRoleKey;
  permissions: readonly Permission[];
  agencyId: EntityId | null;
  status: UserStatus;
}

export interface AgencySummaryDto {
  id: EntityId;
  code: string;
  name: string;
  shortName: string | null;
  type: AgencyType;
  status: AgencyStatus;
}

export interface ProjectSummaryDto extends WireTimestamps {
  id: EntityId;
  projectCode: string;
  title: string;
  projectType: ProjectType;
  status: ProjectStatus;
  agencyId: EntityId;
  physicalProgress: PercentageScore;
  financialProgress: PercentageScore;
  plannedEndDate: IsoDateTimeString | null;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  description: string | null;
  managerId: EntityId | null;
  contractorId: EntityId | null;
  location: LocationDto | null;
  geometry: InfraGeometry | null;
  startDate: IsoDateTimeString | null;
  actualEndDate: IsoDateTimeString | null;
  budget: MoneyDto;
  riskScore: PercentageScore | null;
}

/** Anonymous-safe. No budget, staff ids, or internal notes. */
export interface PublicProjectDto {
  id: EntityId;
  projectCode: string;
  title: string;
  projectType: ProjectType;
  status: ProjectStatus;
  locality: string | null;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  projectType: ProjectType;
  location?: LocationDto;
  geometry?: InfraGeometry;
  startDate?: IsoDateTimeString;
  plannedEndDate?: IsoDateTimeString;
  budget: MoneyDto;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string | null;
  location?: LocationDto | null;
  geometry?: InfraGeometry | null;
  startDate?: IsoDateTimeString | null;
  plannedEndDate?: IsoDateTimeString | null;
}

export interface ProjectApprovalCommand {
  note?: string;
}

export interface MilestoneDto extends WireTimestamps {
  id: EntityId;
  projectId: EntityId;
  title: string;
  status: MilestoneStatus;
  progress: PercentageScore;
  plannedStart: IsoDateTimeString;
  plannedEnd: IsoDateTimeString;
}

export interface CreateMilestoneRequest {
  title: string;
  plannedStart: IsoDateTimeString;
  plannedEnd: IsoDateTimeString;
  description?: string;
}

export interface WorkRequestDto extends WireTimestamps {
  id: EntityId;
  projectId: EntityId;
  agencyId: EntityId;
  workType: WorkType;
  status: WorkStatus;
  priority: WorkPriority;
  plannedStart: IsoDateTimeString;
  plannedEnd: IsoDateTimeString;
  geometry: InfraGeometry;
}

export interface CreateWorkRequestRequest {
  projectId: EntityId;
  workType: WorkType;
  priority?: WorkPriority;
  plannedStart: IsoDateTimeString;
  plannedEnd: IsoDateTimeString;
  geometry: InfraGeometry;
}

export interface ConflictDto {
  id: EntityId;
  workRequestAId: EntityId;
  workRequestBId: EntityId;
  conflictType: ConflictType;
  distanceMeters: number | null;
  scheduleOverlap: boolean;
  severity: ConflictSeverity;
  status: ConflictStatus;
  createdAt: IsoDateTimeString;
}

export interface SpatialConflictCandidateDto {
  workRequestId: EntityId;
  distanceMeters: number;
  scheduleOverlaps: boolean;
  label: "CANDIDATE_ONLY";
}

export interface CoordinationRequestDto {
  id: EntityId;
  conflictId: EntityId;
  fromAgencyId: EntityId;
  toAgencyId: EntityId;
  status: CoordinationStatus;
  message: string;
  createdAt: IsoDateTimeString;
}

export interface ResolveConflictRequest {
  decisionNote: string;
  proposedStart?: IsoDateTimeString;
  proposedEnd?: IsoDateTimeString;
}

export interface ContractorSummaryDto {
  id: EntityId;
  name: string;
  registrationNumber: string;
  status: ContractorStatus;
  riskLevel: ContractorRiskLevel | null;
}

export interface PaymentDto {
  id: EntityId;
  projectId: EntityId;
  contractorId: EntityId;
  amount: MoneyDto;
  paymentType: PaymentType;
  status: PaymentStatus;
  date: IsoDateTimeString;
}

export interface CreatePaymentRequest {
  projectId: EntityId;
  contractorId: EntityId;
  amount: MoneyDto;
  paymentType: PaymentType;
  date: IsoDateTimeString;
}

export interface ApprovePaymentCommand {
  note?: string;
}

export interface ProjectDocumentDto {
  id: EntityId;
  projectId: EntityId;
  documentType: DocumentType;
  fileName: string;
  visibility: DocumentVisibility;
  extractedTextStatus: DocumentProcessingStatus;
  sizeBytes: number | null;
  createdAt: IsoDateTimeString;
}

export interface RagQuestionRequest {
  projectId: EntityId;
  question: string;
}

export interface RagAnswerDto {
  answer: string | null;
  generated: true;
  noEvidence: boolean;
  citations: { documentId: EntityId; chunkIndex: number }[];
}

export interface InspectionDto {
  id: EntityId;
  projectId: EntityId;
  inspectorId: EntityId;
  inspectionDate: IsoDateTimeString;
  status: InspectionStatus;
  verifiedPhysicalProgress: PercentageScore | null;
  notes: string | null;
}

export interface AssetSummaryDto {
  id: EntityId;
  name: string;
  assetType: AssetType;
  condition: AssetCondition;
  sourceProjectId: EntityId;
  agencyId: EntityId;
  commissionedAt: IsoDateTimeString;
}

export interface MaintenanceRecordDto {
  id: EntityId;
  assetId: EntityId;
  status: MaintenanceStatus;
  scheduledDate: IsoDateTimeString;
  completedDate: IsoDateTimeString | null;
}

export interface CitizenIssueReceiptDto {
  id: EntityId;
  category: IssueCategory;
  status: IssueStatus;
  createdAt: IsoDateTimeString;
}

export interface CitizenIssueCreateRequest {
  category: IssueCategory;
  description: string;
  locality: string;
  geometry?: InfraGeometry;
}

export interface NotificationDto {
  id: EntityId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  resourceType: NotificationResource | null;
  resourceId: EntityId | null;
  createdAt: IsoDateTimeString;
}

export interface RiskAssessmentSummaryDto {
  id: EntityId;
  projectId: EntityId;
  overallRisk: PercentageScore;
  modelVersion: string;
  createdAt: IsoDateTimeString;
  synthetic: boolean;
}

export interface AuditLogSummaryDto {
  id: EntityId;
  action: string;
  resourceType: string;
  resourceId: EntityId;
  timestamp: IsoDateTimeString;
}
