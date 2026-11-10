import type {
  RiskCategorySummaryDto,
  RiskIndicatorDto,
  RiskRecommendationDto,
  RiskSeverity,
} from "@infraos/shared-types";
import type { RiskInputs } from "./types.js";

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface RecommendationDefinition {
  code: string;
  titleKey: string;
  bodyKey: string;
  defaultPriority: RiskSeverity;
  triggers: Array<{
    code: string;
    minSeverity: RiskSeverity;
  }>;
  suggestedRole: string;
  targetBuilder: (projectId: string, contractorId?: string | null) => string;
}

export const RECOMMENDATIONS_REGISTRY = {
  REVIEW_DELAYED_MILESTONES: {
    code: "REVIEW_DELAYED_MILESTONES",
    titleKey: "risk.recommendation.REVIEW_DELAYED_MILESTONES.title",
    bodyKey: "risk.recommendation.REVIEW_DELAYED_MILESTONES.body",
    defaultPriority: "MODERATE",
    triggers: [
      { code: "DL1", minSeverity: "MODERATE" },
      { code: "DL2", minSeverity: "MODERATE" },
      { code: "DL3", minSeverity: "LOW" },
    ],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/projects/${projectId}?tab=milestones`,
  },
  INVESTIGATE_HIGH_SPENDING: {
    code: "INVESTIGATE_HIGH_SPENDING",
    titleKey: "risk.recommendation.INVESTIGATE_HIGH_SPENDING.title",
    bodyKey: "risk.recommendation.INVESTIGATE_HIGH_SPENDING.body",
    defaultPriority: "HIGH",
    triggers: [
      { code: "BG1", minSeverity: "MODERATE" },
      { code: "BG5", minSeverity: "MODERATE" },
    ],
    suggestedRole: "AGENCY_OFFICER",
    targetBuilder: (projectId) => `/finance?projectId=${projectId}`,
  },
  REVIEW_BUDGET_COMMITMENTS: {
    code: "REVIEW_BUDGET_COMMITMENTS",
    titleKey: "risk.recommendation.REVIEW_BUDGET_COMMITMENTS.title",
    bodyKey: "risk.recommendation.REVIEW_BUDGET_COMMITMENTS.body",
    defaultPriority: "HIGH",
    triggers: [
      { code: "BG2", minSeverity: "MODERATE" },
      { code: "BG3", minSeverity: "MODERATE" },
    ],
    suggestedRole: "AGENCY_OFFICER",
    targetBuilder: (projectId) => `/finance?projectId=${projectId}`,
  },
  SCHEDULE_INSPECTION: {
    code: "SCHEDULE_INSPECTION",
    titleKey: "risk.recommendation.SCHEDULE_INSPECTION.title",
    bodyKey: "risk.recommendation.SCHEDULE_INSPECTION.body",
    defaultPriority: "LOW",
    triggers: [{ code: "SC3", minSeverity: "LOW" }],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/inspections?projectId=${projectId}`,
  },
  CLEAR_VERIFICATION_BACKLOG: {
    code: "CLEAR_VERIFICATION_BACKLOG",
    titleKey: "risk.recommendation.CLEAR_VERIFICATION_BACKLOG.title",
    bodyKey: "risk.recommendation.CLEAR_VERIFICATION_BACKLOG.body",
    defaultPriority: "MODERATE",
    triggers: [{ code: "PG2", minSeverity: "LOW" }],
    suggestedRole: "AGENCY_OFFICER",
    targetBuilder: (projectId) => `/inspections?projectId=${projectId}`,
  },
  REVIEW_UNRESOLVED_ROADSYNC_CONFLICTS: {
    code: "REVIEW_UNRESOLVED_ROADSYNC_CONFLICTS",
    titleKey: "risk.recommendation.REVIEW_UNRESOLVED_ROADSYNC_CONFLICTS.title",
    bodyKey: "risk.recommendation.REVIEW_UNRESOLVED_ROADSYNC_CONFLICTS.body",
    defaultPriority: "HIGH",
    triggers: [{ code: "CO1", minSeverity: "LOW" }],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/roadsync?projectId=${projectId}`,
  },
  COORDINATE_WITH_AFFECTED_AGENCIES: {
    code: "COORDINATE_WITH_AFFECTED_AGENCIES",
    titleKey: "risk.recommendation.COORDINATE_WITH_AFFECTED_AGENCIES.title",
    bodyKey: "risk.recommendation.COORDINATE_WITH_AFFECTED_AGENCIES.body",
    defaultPriority: "MODERATE",
    triggers: [
      { code: "CO1", minSeverity: "MODERATE" },
      { code: "CO2", minSeverity: "LOW" },
    ],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/roadsync?projectId=${projectId}`,
  },
  INVESTIGATE_MISSING_EVIDENCE: {
    code: "INVESTIGATE_MISSING_EVIDENCE",
    titleKey: "risk.recommendation.INVESTIGATE_MISSING_EVIDENCE.title",
    bodyKey: "risk.recommendation.INVESTIGATE_MISSING_EVIDENCE.body",
    defaultPriority: "MODERATE",
    triggers: [
      { code: "PG1", minSeverity: "MODERATE" },
      { code: "PG3", minSeverity: "MODERATE" },
    ],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/projects/${projectId}?tab=progress`,
  },
  REASSESS_CONTRACTOR_SCHEDULING: {
    code: "REASSESS_CONTRACTOR_SCHEDULING",
    titleKey: "risk.recommendation.REASSESS_CONTRACTOR_SCHEDULING.title",
    bodyKey: "risk.recommendation.REASSESS_CONTRACTOR_SCHEDULING.body",
    defaultPriority: "MODERATE",
    triggers: [
      { code: "CO3", minSeverity: "LOW" },
      { code: "DL4", minSeverity: "LOW" },
    ],
    suggestedRole: "AGENCY_OFFICER",
    targetBuilder: (projectId, contractorId) =>
      contractorId ? `/contractors/${contractorId}` : `/projects/${projectId}`,
  },
  FIX_SCHEDULE_DATA: {
    code: "FIX_SCHEDULE_DATA",
    titleKey: "risk.recommendation.FIX_SCHEDULE_DATA.title",
    bodyKey: "risk.recommendation.FIX_SCHEDULE_DATA.body",
    defaultPriority: "LOW",
    triggers: [{ code: "SC1", minSeverity: "LOW" }],
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId) => `/projects/${projectId}?tab=milestones`,
  },
  EXPEDITE_APPROVALS: {
    code: "EXPEDITE_APPROVALS",
    titleKey: "risk.recommendation.EXPEDITE_APPROVALS.title",
    bodyKey: "risk.recommendation.EXPEDITE_APPROVALS.body",
    defaultPriority: "MODERATE",
    triggers: [{ code: "SC2", minSeverity: "LOW" }],
    suggestedRole: "AGENCY_OFFICER",
    targetBuilder: (projectId) => `/projects/${projectId}?tab=reviews`,
  },
  ADD_MISSING_DATA: {
    code: "ADD_MISSING_DATA",
    titleKey: "risk.recommendation.ADD_MISSING_DATA.title",
    bodyKey: "risk.recommendation.ADD_MISSING_DATA.body",
    defaultPriority: "LOW",
    triggers: [], // Triggered by insufficient categories
    suggestedRole: "PROJECT_MANAGER",
    targetBuilder: (projectId, _contractorId) => `/projects/${projectId}`,
  },
} satisfies Record<string, RecommendationDefinition>;

/**
 * Generates advisory recommendations from active indicators and category sufficiency.
 * Labelled: "Advisory — decisions remain with authorised officers".
 */
export function generateRecommendations(
  indicators: RiskIndicatorDto[],
  categorySummaries: RiskCategorySummaryDto[],
  inputs: RiskInputs,
): RiskRecommendationDto[] {
  const recommendations: RiskRecommendationDto[] = [];
  const projectId = inputs.project.data?.id ?? "";
  const contractorId = inputs.project.data?.contractorId;

  // Map active indicators by code
  const indicatorMap = new Map<string, RiskIndicatorDto[]>();
  for (const ind of indicators) {
    if (ind.severity === "INFO") continue;
    const existing = indicatorMap.get(ind.code) ?? [];
    existing.push(ind);
    indicatorMap.set(ind.code, existing);
  }

  // Evaluate rule-triggered recommendations
  for (const def of Object.values(RECOMMENDATIONS_REGISTRY)) {
    if (def.code === "ADD_MISSING_DATA") continue;

    const matchedFingerprints: string[] = [];
    let highestTriggerSeverity: RiskSeverity = "LOW";

    for (const trigger of def.triggers) {
      const active = indicatorMap.get(trigger.code);
      if (!active) continue;

      for (const ind of active) {
        if (SEVERITY_RANK[ind.severity] >= SEVERITY_RANK[trigger.minSeverity]) {
          matchedFingerprints.push(ind.fingerprint);
          if (SEVERITY_RANK[ind.severity] > SEVERITY_RANK[highestTriggerSeverity]) {
            highestTriggerSeverity = ind.severity;
          }
        }
      }
    }

    if (matchedFingerprints.length > 0) {
      const priority: RiskSeverity =
        SEVERITY_RANK[highestTriggerSeverity] >= SEVERITY_RANK.HIGH
          ? "HIGH"
          : def.defaultPriority;

      recommendations.push({
        code: def.code,
        priority,
        indicatorFingerprints: Array.from(new Set(matchedFingerprints)),
        titleKey: def.titleKey,
        bodyKey: def.bodyKey,
        suggestedRole: def.suggestedRole,
        target: def.targetBuilder(projectId, contractorId),
      });
    }
  }

  // Trigger ADD_MISSING_DATA if any category is INSUFFICIENT or LIMITED
  const insufficientCategories = categorySummaries.filter(
    (c) => c.sufficiency === "INSUFFICIENT" || c.sufficiency === "LIMITED",
  );
  if (insufficientCategories.length > 0) {
    const hasInsufficient = insufficientCategories.some((c) => c.sufficiency === "INSUFFICIENT");
    recommendations.push({
      code: "ADD_MISSING_DATA",
      priority: hasInsufficient ? "HIGH" : "LOW",
      indicatorFingerprints: [],
      titleKey: RECOMMENDATIONS_REGISTRY.ADD_MISSING_DATA.titleKey,
      bodyKey: RECOMMENDATIONS_REGISTRY.ADD_MISSING_DATA.bodyKey,
      suggestedRole: RECOMMENDATIONS_REGISTRY.ADD_MISSING_DATA.suggestedRole,
      target: RECOMMENDATIONS_REGISTRY.ADD_MISSING_DATA.targetBuilder(projectId, contractorId),
    });
  }

  return recommendations;
}
