import type {
  RiskFactorCategory,
  RiskSourceFreshnessDto,
  RiskSufficiency,
} from "@infraos/shared-types";
import { THRESHOLDS } from "./catalog.js";
import { calendarDaysBetween, colomboDayStart } from "./math.js";
import type { RiskInputs } from "./types.js";

export function evaluateSourceFreshness(
  inputs: RiskInputs,
  now: Date,
): RiskSourceFreshnessDto[] {
  const today = colomboDayStart(now);
  const freshness: RiskSourceFreshnessDto[] = [];

  // 1. ProjectTrace / milestones
  freshness.push({
    source: "projectTrace",
    available: inputs.project.available,
    asOf: inputs.project.asOf?.toISOString() ?? null,
    stale: false,
    reasonKey: inputs.project.reasonKey,
  });

  // 2. Progress reports
  const pAsOf = inputs.progressReports.asOf;
  const pDays = pAsOf ? calendarDaysBetween(pAsOf, today) : null;
  const pStale = pDays !== null && pDays > THRESHOLDS.freshness.progressStaleDays;
  freshness.push({
    source: "progressReports",
    available: inputs.progressReports.available,
    asOf: pAsOf?.toISOString() ?? null,
    stale: pStale,
    reasonKey: inputs.progressReports.reasonKey,
  });

  // 3. Finance
  const fAsOf = inputs.finance.asOf;
  const fDays = fAsOf ? calendarDaysBetween(fAsOf, today) : null;
  const fStale = fDays !== null && fDays > THRESHOLDS.freshness.financeStaleDays;
  freshness.push({
    source: "finance",
    available: inputs.finance.available,
    asOf: fAsOf?.toISOString() ?? null,
    stale: fStale,
    reasonKey: inputs.finance.reasonKey,
  });

  // 4. Inspections
  const iAsOf = inputs.inspections.asOf;
  const iDays = iAsOf ? calendarDaysBetween(iAsOf, today) : null;
  const iStale = iDays !== null && iDays > THRESHOLDS.freshness.inspectionsStaleDays;
  freshness.push({
    source: "inspections",
    available: inputs.inspections.available,
    asOf: iAsOf?.toISOString() ?? null,
    stale: iStale,
    reasonKey: inputs.inspections.reasonKey,
  });

  // 5. RoadSync
  const rAsOf = inputs.roadsync.asOf;
  const rDays = rAsOf ? calendarDaysBetween(rAsOf, today) : null;
  const rStale = rDays !== null && rDays > THRESHOLDS.freshness.roadsyncStaleDays;
  freshness.push({
    source: "roadsync",
    available: inputs.roadsync.available,
    asOf: rAsOf?.toISOString() ?? null,
    stale: rStale,
    reasonKey: inputs.roadsync.reasonKey,
  });

  return freshness;
}

export function evaluateCategorySufficiency(
  category: RiskFactorCategory,
  inputs: RiskInputs,
): { sufficiency: RiskSufficiency; missing: string[] } {
  const missing: string[] = [];
  const project = inputs.project.data;

  switch (category) {
    case "DELAY": {
      if (!inputs.project.available || !project) {
        missing.push("project_unavailable");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (!project.plannedEndDate) {
        missing.push("planned_end_date_missing");
      }
      if (!project.startDate) {
        missing.push("start_date_missing");
      }
      const hasMilestones =
        inputs.milestones.available && (inputs.milestones.data?.length ?? 0) > 0;
      if (!hasMilestones) {
        missing.push("milestones_missing");
      }
      if (!inputs.contractor.available) {
        missing.push("contractor_data_unavailable");
      }

      if (!project.plannedEndDate && !hasMilestones) {
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (missing.length > 0) {
        return { sufficiency: "LIMITED", missing };
      }
      return { sufficiency: "SUFFICIENT", missing };
    }

    case "PROGRESS": {
      const hasReports =
        inputs.progressReports.available && (inputs.progressReports.data?.length ?? 0) > 0;
      const hasVerifications =
        inputs.inspections.available && project?.verifiedProgress != null;

      if (!inputs.progressReports.available && !inputs.inspections.available) {
        missing.push("progress_and_inspections_unavailable");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (!hasReports) {
        missing.push("progress_reports_missing");
      }
      if (!inputs.inspections.available) {
        missing.push("inspections_data_unavailable");
      }
      if (!hasReports && !hasVerifications) {
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (missing.length > 0) {
        return { sufficiency: "LIMITED", missing };
      }
      return { sufficiency: "SUFFICIENT", missing };
    }

    case "BUDGET": {
      if (!inputs.finance.available || !inputs.finance.data) {
        missing.push("finance_records_unavailable");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      const budgetMinor = inputs.finance.data.budgetMinor || (project?.budgetMinor ?? 0);
      if (budgetMinor <= 0) {
        missing.push("budget_missing_or_zero");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (
        inputs.finance.data.trailingMonthlySpendMinor.length <
        THRESHOLDS.budget.bg5.minMonthlyHistory
      ) {
        missing.push("limited_monthly_spend_history");
      }
      if (missing.length > 0) {
        return { sufficiency: "LIMITED", missing };
      }
      return { sufficiency: "SUFFICIENT", missing };
    }

    case "SCHEDULE": {
      if (!inputs.project.available || !project) {
        missing.push("project_unavailable");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      const hasMilestones =
        inputs.milestones.available && (inputs.milestones.data?.length ?? 0) > 0;
      if (!hasMilestones) {
        missing.push("milestones_missing");
      }
      if (!inputs.dependencies.available) {
        missing.push("dependencies_unavailable");
      }
      if (!inputs.reviews.available) {
        missing.push("reviews_unavailable");
      }
      if (!inputs.inspections.available) {
        missing.push("inspections_unavailable");
      }
      if (!hasMilestones && !project.plannedEndDate) {
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (missing.length > 0) {
        return { sufficiency: "LIMITED", missing };
      }
      return { sufficiency: "SUFFICIENT", missing };
    }

    case "COORDINATION": {
      if (!inputs.roadsync.available) {
        missing.push("roadsync_unavailable");
        return { sufficiency: "INSUFFICIENT", missing };
      }
      if (!inputs.contractor.available) {
        missing.push("contractor_data_unavailable");
        return { sufficiency: "LIMITED", missing };
      }
      return { sufficiency: "SUFFICIENT", missing };
    }

    default:
      return { sufficiency: "SUFFICIENT", missing };
  }
}

