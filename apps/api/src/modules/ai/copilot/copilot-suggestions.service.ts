import mongoose from "mongoose";
import type { AuthenticatedActor } from "./copilot.types.js";
import { Project } from "../../projects/models/project.model.js";
import { Milestone } from "../../projects/models/milestone.model.js";
import { Inspection } from "../../inspections/models/inspection.model.js";
import { RiskAssessment } from "../../risk/models/risk-assessment.model.js";

export type SuggestionItem = {
  id: string;
  labelKey: string;
  prompt: string;
};

export async function getSuggestions(
  actor: AuthenticatedActor,
  pageType?: string,
  recordId?: string,
): Promise<{ suggestions: SuggestionItem[] }> {
  const suggestions: SuggestionItem[] = [];

  if (pageType === "PROJECT" && recordId) {
    const isOid = mongoose.Types.ObjectId.isValid(recordId);
    const project = await Project.findOne(
      isOid ? { _id: recordId } : { projectCode: recordId }
    ).select("_id projectCode riskLevel").lean();

    if (project) {
      const pId = project._id;
      const [milestoneCount, inspectionCount, risk] = await Promise.all([
        Milestone.countDocuments({ projectId: pId }),
        Inspection.countDocuments({ projectId: pId }),
        RiskAssessment.findOne({ projectId: pId }).sort({ createdAt: -1 }).select("overallLevel").lean(),
      ]);

      suggestions.push({
        id: "proj_summary",
        labelKey: "copilot.suggestion.project_summary",
        prompt: `Give me a comprehensive progress summary for project ${project.projectCode}.`,
      });

      if (risk) {
        suggestions.push({
          id: "proj_risk",
          labelKey: "copilot.suggestion.why_risk",
          prompt: `Why is this project assessed at ${risk.overallLevel || project.riskLevel} risk?`,
        });
      }

      if (milestoneCount > 0) {
        suggestions.push({
          id: "proj_milestones",
          labelKey: "copilot.suggestion.delayed_milestones",
          prompt: `Which milestones are currently delayed or at risk of missing their deadlines?`,
        });
      }

      if (inspectionCount > 0) {
        suggestions.push({
          id: "proj_inspections",
          labelKey: "copilot.suggestion.latest_inspection",
          prompt: `Summarise the latest site inspection findings and any recorded defects.`,
        });
      }

      return { suggestions };
    }
  }

  if (pageType === "RISK") {
    suggestions.push(
      {
        id: "risk_high_projects",
        labelKey: "copilot.suggestion.high_risk_projects",
        prompt: "Which infrastructure projects currently have the highest risk scores in our agency?",
      },
      {
        id: "risk_indicators",
        labelKey: "copilot.suggestion.risk_drivers",
        prompt: "What are the most common risk indicators driving delayed projects?",
      },
    );
    return { suggestions };
  }

  if (pageType === "INSPECTION") {
    suggestions.push(
      {
        id: "insp_defects",
        labelKey: "copilot.suggestion.inspection_defects",
        prompt: "What are the common defects and follow-up requirements across recent inspections?",
      },
    );
    return { suggestions };
  }

  // Default suggestions for portfolio / dashboard
  suggestions.push(
    {
      id: "dash_overview",
      labelKey: "copilot.suggestion.portfolio_overview",
      prompt: "Give me an overview of delayed milestones across our active projects.",
    },
    {
      id: "dash_risks",
      labelKey: "copilot.suggestion.top_risks",
      prompt: "Which projects have critical risk levels or large progress discrepancies?",
    },
    {
      id: "dash_conflicts",
      labelKey: "copilot.suggestion.road_conflicts",
      prompt: "Are there any open RoadSync utility conflicts requiring coordination?",
    },
  );

  return { suggestions };
}
