import type { ClientSession } from "mongoose";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import type { RiskInputs, SourceEnvelope } from "./engine/types.js";
import {
  fetchContractorSource,
  fetchDependenciesSource,
  fetchFinanceSource,
  fetchHistorySource,
  fetchInspectionsSource,
  fetchMilestonesSource,
  fetchProgressSource,
  fetchProjectSource,
  fetchReviewsSource,
  fetchRoadsyncSource,
} from "./sources/index.js";

export class RiskAccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RiskAccessError";
  }
}

function fallbackEnvelope<T>(reasonKey: string, defaultData?: T): SourceEnvelope<T> {
  return {
    available: false,
    asOf: null,
    reasonKey,
    data: defaultData,
  };
}

/**
 * Assembles all 10 source inputs for risk engine evaluation (§4.3, Step 119).
 * - Enforces actor resource scoping.
 * - Out-of-scope or non-existent project throws RiskAccessError(404, "NOT_FOUND").
 * - Queries run with bounds/caps.
 * - Source failures degrade gracefully into { available: false, reasonKey }.
 * - No sensitive names, free text, or unvetted blobs are passed into engine.
 */
export async function assembleRiskInputs(
  actor: AuthenticatedActor,
  projectId: string,
  now: Date,
  session?: ClientSession,
): Promise<RiskInputs> {
  const scope = await resolveResourceScope(actor);

  // 1. Fetch core project within actor's scope
  const projectEnv = await fetchProjectSource(projectId, scope, session);
  if (!projectEnv.available || !projectEnv.data) {
    throw new RiskAccessError(
      404,
      "NOT_FOUND",
      "Project not found or outside authorized scope",
    );
  }

  const projectData = projectEnv.data;

  // 2. Concurrently assemble secondary sources
  const [
    milestonesSettled,
    progressSettled,
    dependenciesSettled,
    reviewsSettled,
    financeSettled,
    inspectionsSettled,
    contractorSettled,
    roadsyncSettled,
    historySettled,
  ] = await Promise.allSettled([
    fetchMilestonesSource(projectId, session),
    fetchProgressSource(projectId, session),
    fetchDependenciesSource(projectId, session),
    fetchReviewsSource(projectId, now, session),
    fetchFinanceSource(projectId, now, session),
    fetchInspectionsSource(projectId, now, session),
    fetchContractorSource(projectData.contractorId, session),
    fetchRoadsyncSource(projectId, now, session),
    fetchHistorySource(projectData.projectType, projectData.agencyId, session),
  ]);

  const milestones =
    milestonesSettled.status === "fulfilled"
      ? milestonesSettled.value
      : fallbackEnvelope("milestones_source_failed", []);

  const progressReports =
    progressSettled.status === "fulfilled"
      ? progressSettled.value
      : fallbackEnvelope("progress_source_failed", []);

  const dependencies =
    dependenciesSettled.status === "fulfilled"
      ? dependenciesSettled.value
      : fallbackEnvelope("dependencies_source_failed", []);

  const reviews =
    reviewsSettled.status === "fulfilled"
      ? reviewsSettled.value
      : fallbackEnvelope("reviews_source_failed", {
          pendingReviewsCount: 0,
          oldestPendingDays: 0,
          items: [],
        });

  const finance =
    financeSettled.status === "fulfilled"
      ? financeSettled.value
      : fallbackEnvelope("finance_source_failed", {
          budgetMinor: projectData.budgetMinor,
          spentMinor: 0,
          committedMinor: 0,
          approvedRevisionsCount: 0,
          cumulativeBudgetIncreaseMinor: 0,
          pendingRevisionsCount: 0,
          oldestPendingRevisionDays: 0,
          pendingPaymentApprovalsCount: 0,
          oldestPendingPaymentApprovalDays: 0,
          unverifiedExpensesCount: 0,
          oldestUnverifiedExpenseDays: 0,
          largestSingleTransactionMinor: 0,
          trailingMonthlySpendMinor: [],
          last30DaysSpendMinor: 0,
        });

  const inspections =
    inspectionsSettled.status === "fulfilled"
      ? inspectionsSettled.value
      : fallbackEnvelope("inspections_source_failed", {
          scheduledOverdueCount: 0,
          oldestScheduledOverdueDays: 0,
          openCriticalDefectsCount: 0,
          oldestCriticalDefectDays: 0,
          openMajorDefectsCount: 0,
          oldestMajorDefectDays: 0,
          verificationsAwaitingReviewCount: 0,
          oldestVerificationAwaitingDays: 0,
          totalCompletedInspectionsCount: 0,
        });

  const contractor =
    contractorSettled.status === "fulfilled"
      ? contractorSettled.value
      : fallbackEnvelope("contractor_source_failed", {
          assigned: false,
          priorClosedProjectsCount: 0,
          priorProjectsDelayedCount: 0,
          activeAssignmentsCount: 0,
        });

  const roadsync =
    roadsyncSettled.status === "fulfilled"
      ? roadsyncSettled.value
      : fallbackEnvelope("roadsync_source_failed", {
          conflicts: [],
          unacknowledgedCoordinationCount: 0,
          oldestUnacknowledgedDays: 0,
          overdueCommitmentsCount: 0,
          oldestOverdueCommitmentDays: 0,
        });

  const history =
    historySettled.status === "fulfilled"
      ? historySettled.value
      : fallbackEnvelope("history_source_failed", {
          comparableCount: 0,
          medianDurationOverrunRatio: 1.0,
        });

  return {
    project: projectEnv,
    milestones,
    progressReports,
    dependencies,
    reviews,
    finance,
    inspections,
    contractor,
    roadsync,
    history,
  };
}
