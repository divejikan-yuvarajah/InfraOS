import type {
  RiskDisplayResolutionStatus,
  RiskResolutionStatus,
  RiskSeverity,
} from "@infraos/shared-types";
import { colomboDayStart } from "./math.js";

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface ResolutionLike {
  status: RiskResolutionStatus;
  severityAtDecision: RiskSeverity;
  reviewAt?: Date | string | null;
}

/**
 * Computes the effective display resolution status (§4.2):
 * - If no resolution or status is OPEN -> "OPEN"
 * - If IN_PROGRESS -> "IN_PROGRESS"
 * - If RESOLVED -> "REOPENED" if the indicator reappears (currentSeverity is active, i.e. > INFO), else "RESOLVED"
 * - If ACKNOWLEDGED or DISMISSED:
 *     - "REOPENED" if current severity is higher than severityAtDecision
 *     - "REOPENED" if reviewAt date is in the past (<= today)
 *     - Otherwise, keeps "ACKNOWLEDGED" or "DISMISSED"
 *
 * NOTE: Resolutions never alter indicator calculations or scores.
 */
export function computeEffectiveResolutionStatus(
  resolution: ResolutionLike | null | undefined,
  currentSeverity: RiskSeverity | null | undefined,
  now: Date,
): RiskDisplayResolutionStatus {
  if (!resolution || resolution.status === "OPEN") {
    return "OPEN";
  }

  if (resolution.status === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }

  const isIndicatorActive =
    currentSeverity != null &&
    currentSeverity !== "INFO" &&
    SEVERITY_RANK[currentSeverity] > 0;

  if (resolution.status === "RESOLVED") {
    if (isIndicatorActive) {
      return "REOPENED";
    }
    return "RESOLVED";
  }

  if (resolution.status === "ACKNOWLEDGED" || resolution.status === "DISMISSED") {
    // 1. Check if severity escalated compared to decision time
    if (
      isIndicatorActive &&
      SEVERITY_RANK[currentSeverity] > SEVERITY_RANK[resolution.severityAtDecision]
    ) {
      return "REOPENED";
    }

    // 2. Check if reviewAt date has passed
    if (resolution.reviewAt) {
      const reviewDate =
        typeof resolution.reviewAt === "string"
          ? new Date(resolution.reviewAt)
          : resolution.reviewAt;

      if (!isNaN(reviewDate.getTime())) {
        const today = colomboDayStart(now);
        const reviewDay = colomboDayStart(reviewDate);
        if (today.getTime() >= reviewDay.getTime()) {
          return "REOPENED";
        }
      }
    }

    return resolution.status;
  }

  return "OPEN";
}

