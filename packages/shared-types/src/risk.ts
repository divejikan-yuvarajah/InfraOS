import type { PercentageScore } from "./primitives.js";
import { RISK_FACTOR_CATEGORIES } from "./domain/enums.js";

export { RISK_FACTOR_CATEGORIES };
export type RiskFactorCategory = (typeof RISK_FACTOR_CATEGORIES)[number];

export const RISK_LEVELS = [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
  "NOT_ASSESSABLE",
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_SEVERITIES = [
  "INFO",
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const RISK_SEVERITY_POINTS: Record<RiskSeverity, number> = {
  INFO: 0,
  LOW: 5,
  MODERATE: 12,
  HIGH: 25,
  CRITICAL: 40,
} as const;

export const RISK_SUFFICIENCY_LEVELS = [
  "SUFFICIENT",
  "LIMITED",
  "INSUFFICIENT",
] as const;
export type RiskSufficiency = (typeof RISK_SUFFICIENCY_LEVELS)[number];

export const RISK_EVIDENCE_BASES = [
  "VERIFIED",
  "REPORTED",
  "RECORDED",
  "MIXED",
] as const;
export type RiskEvidenceBasis = (typeof RISK_EVIDENCE_BASES)[number];

export const RISK_TRIGGER_TYPES = [
  "ON_DEMAND",
  "SCHEDULED",
  "EVENT",
  "DEMO_SEQUENCE",
] as const;
export type RiskTriggerType = (typeof RISK_TRIGGER_TYPES)[number];

export const RISK_RESOLUTION_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
] as const;
export type RiskResolutionStatus = (typeof RISK_RESOLUTION_STATUSES)[number];

export const RISK_DISPLAY_RESOLUTION_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
  "REOPENED",
] as const;
export type RiskDisplayResolutionStatus = (typeof RISK_DISPLAY_RESOLUTION_STATUSES)[number];

export const RISK_CHANGE_TYPES = [
  "NEW",
  "ESCALATED",
  "DEESCALATED",
  "CLEARED",
] as const;
export type RiskChangeType = (typeof RISK_CHANGE_TYPES)[number];

export const RISK_RUN_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
] as const;
export type RiskRunStatus = (typeof RISK_RUN_STATUSES)[number];

export const RISK_RUN_TRIGGERS = [
  "SCHEDULED",
  "BULK_ADMIN",
  "STARTUP_CATCHUP",
] as const;
export type RiskRunTrigger = (typeof RISK_RUN_TRIGGERS)[number];

export const RISK_ENGINE_VERSION = "r1";

export interface RiskEvidenceRefDto {
  kind: string;
  ref: {
    type: string;
    id: string;
    label?: string;
  };
  value?: string | number | boolean | null;
  unit?: string;
  asOf?: string;
}

export interface RiskCalculationStepDto {
  formulaKey: string;
  steps: string[];
}

export interface RiskIndicatorDto {
  code: string;
  category: RiskFactorCategory;
  severity: RiskSeverity;
  points: number;
  fingerprint: string;
  subjectKey?: string;
  titleKey: string;
  explainKey: string;
  inputs?: Record<string, unknown>;
  evidence: RiskEvidenceRefDto[];
  calc?: RiskCalculationStepDto;
  basis: RiskEvidenceBasis;
  firstSeenAt?: string;
  durationDays?: number;
}

export interface RiskCategorySummaryDto {
  category: RiskFactorCategory;
  level: RiskLevel;
  index?: number;
  sufficiency: RiskSufficiency;
  missing: string[];
}

export interface RiskSourceFreshnessDto {
  source: string;
  available: boolean;
  asOf?: string | null;
  stale?: boolean;
  reasonKey?: string;
}

export interface RiskRecommendationDto {
  code: string;
  priority: RiskSeverity;
  indicatorFingerprints: string[];
  titleKey: string;
  bodyKey: string;
  suggestedRole?: string;
  target?: string;
}

export interface RiskChangeDto {
  type: RiskChangeType;
  code: string;
  fingerprint: string;
  from?: RiskSeverity;
  to?: RiskSeverity;
}

export interface RiskNarrativeDto {
  text: string;
  model: string;
  promptVersion: string;
  language: string;
  generatedAt: string;
  verified: boolean;
}

export interface RiskAssessmentDto {
  id: string;
  assessmentNo: string;
  projectId: string;
  agencyId: string;
  projectStatus: string;
  trigger: RiskTriggerType;
  engineVersion: string;
  inputsHash: string;
  applicable: boolean;
  overallLevel: RiskLevel;
  overallIndex?: number;
  categories: RiskCategorySummaryDto[];
  indicators: RiskIndicatorDto[];
  sourceFreshness: RiskSourceFreshnessDto[];
  missingData: string[];
  recommendations: RiskRecommendationDto[];
  changes: RiskChangeDto[];
  levelChange?: {
    from: RiskLevel;
    to: RiskLevel;
  };
  previousAssessmentId?: string;
  narrative?: RiskNarrativeDto;
  requestedBy?: string;
  createdAt: string;
  // Legacy backward-compatible fields
  overallRisk?: PercentageScore | null;
  delayRisk?: PercentageScore | null;
  budgetRisk?: PercentageScore | null;
  scheduleRisk?: PercentageScore | null;
  factors?: Array<{ category: RiskFactorCategory; description: string; score: number }>;
  legacyRecommendations?: string[];
  modelVersion?: string;
}

export interface RiskResolutionEventDto {
  status: RiskResolutionStatus;
  note?: string;
  by: string;
  at: string;
  assessmentId?: string;
}

export interface RiskResolutionDto {
  id: string;
  projectId: string;
  agencyId: string;
  fingerprint: string;
  indicatorCode: string;
  status: RiskResolutionStatus;
  displayStatus?: RiskDisplayResolutionStatus;
  note: string;
  severityAtDecision: RiskSeverity;
  currentSeverity?: RiskSeverity;
  assessmentId: string;
  assignedTo?: string;
  reviewAt?: string;
  decidedBy: string;
  decidedAt: string;
  events: RiskResolutionEventDto[];
  version: number;
  reopened?: boolean;
}

export interface RiskRunCountersDto {
  considered: number;
  assessed: number;
  unchanged: number;
  notApplicable: number;
  failed: number;
}

export interface RiskRunDto {
  id: string;
  runId: string;
  trigger: RiskRunTrigger;
  scope: string;
  status: RiskRunStatus;
  counters: RiskRunCountersDto;
  startedAt: string;
  finishedAt?: string;
  errorCode?: string;
}

export interface RiskOverviewCountsDto {
  assessed: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  notAssessable: number;
  stale: number;
  unacknowledgedHighPlus: number;
}

export interface RiskOverviewDto {
  asOf: string;
  scope: "platform" | "agency";
  counts: RiskOverviewCountsDto;
  categories: Record<RiskFactorCategory, { highPlusCount: number; totalAssessed: number }>;
  lastRun?: RiskRunDto | null;
  sourceNotices: Array<{ source: string; available: boolean; reasonKey?: string }>;
}

export interface RiskProjectRowDto {
  id: string;
  projectId: string;
  projectCode: string;
  title: string;
  status: string;
  agencyId: string;
  agencyName?: string;
  projectType: string;
  district?: string;
  overallLevel: RiskLevel;
  overallIndex?: number;
  categories: Record<RiskFactorCategory, RiskLevel>;
  topIndicators: Array<{
    code: string;
    severity: RiskSeverity;
    titleKey: string;
    points: number;
  }>;
  physicalProgress: number;
  financialProgress: number;
  physicalBasis: RiskEvidenceBasis;
  assessedAt: string;
  resolutionSummary: {
    openCount: number;
    acknowledgedCount: number;
    reopenedCount: number;
  };
}

export interface RiskScatterPointDto {
  projectId: string;
  projectCode: string;
  title: string;
  physicalPct: number;
  financialPct: number;
  basis: RiskEvidenceBasis;
  level: RiskLevel;
  agencyId: string;
}

export interface RiskPortfolioTrendPointDto {
  weekStart: string;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  notAssessable: number;
  total: number;
}

export interface RiskPortfolioTrendDto {
  trend: RiskPortfolioTrendPointDto[];
  insufficientHistory: boolean;
  snapshotsCount: number;
}

export interface RuleCatalogItemDto {
  code: string;
  category: RiskFactorCategory;
  titleKey: string;
  explainKey: string;
  thresholds: Record<string, unknown>;
  requiredInputs: string[];
  dataSourceKey: string;
  severities: RiskSeverity[];
  dedupeRule?: string;
}

export interface RiskMethodologyDto {
  engineVersion: string;
  rulesCatalog: RuleCatalogItemDto[];
  scoringDefinitions: {
    severityPoints: Record<RiskSeverity, number>;
    categoryIndexFormula: string;
    categoryLevelRules: string[];
    overallLevelRules: string[];
    sufficiencyRules: Record<RiskSufficiency, string>;
  };
  applicabilityRules: Record<string, string>;
  historyStats: {
    completedProjectsCount: number;
    completedWithActualEndDateCount: number;
    comparableSetsAvailable: number;
    readinessStatement: string;
  };
  honestyStatement: string;
}
