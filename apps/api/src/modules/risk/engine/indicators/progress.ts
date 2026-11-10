import type { RiskIndicatorDto, RiskSeverity } from "@infraos/shared-types";
import { RISK_SEVERITY_POINTS } from "@infraos/shared-types";
import { THRESHOLDS } from "../catalog.js";
import { calendarDaysBetween, colomboDayStart } from "../math.js";
import type { RiskInputs } from "../types.js";

const SEVERITY_RANKS: Record<string, number> = {
  INFO: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function elevateSeverity<T extends RiskSeverity>(current: T | null, candidate: T): T {
  if (!current) return candidate;
  const currentRank = SEVERITY_RANKS[current] ?? 0;
  const candidateRank = SEVERITY_RANKS[candidate] ?? 0;
  return candidateRank > currentRank ? candidate : current;
}

export function evaluateProgressIndicators(
  inputs: RiskInputs,
  now: Date,
): RiskIndicatorDto[] {
  const indicators: RiskIndicatorDto[] = [];
  const today = colomboDayStart(now);

  const projectEnv = inputs.project;
  const project = projectEnv.data;
  if (!project) return indicators;

  // Only ACTIVE or DELAYED projects evaluate progress stagnation
  if (!["ACTIVE", "DELAYED"].includes(project.status)) {
    return indicators;
  }

  // -------------------------------------------------------------------------
  // PG1: Progress stagnation
  // -------------------------------------------------------------------------
  const reportsEnv = inputs.progressReports;
  const reports = reportsEnv.data ?? [];

  if (reports.length === 0) {
    if (project.startDate) {
      const elapsedSinceStart = calendarDaysBetween(project.startDate, today);
      if (elapsedSinceStart >= THRESHOLDS.progress.pg1.noReportElapsedDays) {
        indicators.push({
          code: "PG1",
          category: "PROGRESS",
          severity: "MODERATE",
          points: RISK_SEVERITY_POINTS.MODERATE,
          fingerprint: "PG1:-",
          titleKey: "risk.indicator.PG1.title",
          explainKey: "risk.indicator.PG1.explain",
          inputs: {
            reason: "no_reports_since_start",
            elapsedSinceStart,
          },
          evidence: [
            {
              kind: "project",
              ref: {
                type: "project",
                id: project.id,
                label: `${project.projectCode} ${project.title}`,
              },
              value: elapsedSinceStart,
              unit: "days since start without progress report",
              asOf: today.toISOString(),
            },
          ],
          calc: {
            formulaKey: "calc.progress.noReport",
            steps: [
              `Project started: ${project.startDate.toISOString().slice(0, 10)}`,
              `Days elapsed without any submitted progress report: ${elapsedSinceStart} days`,
              `Threshold crossed: >= 30 days without progress report`,
              `Severity assigned: MODERATE (${RISK_SEVERITY_POINTS.MODERATE} pts)`,
            ],
          },
          basis: "RECORDED",
        });
      }
    }
  } else {
    // Sort reports descending by reportedAt
    const sorted = [...reports].sort(
      (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
    const latest = sorted[0];
    if (!latest) return indicators;

    const daysSinceLatest = calendarDaysBetween(latest.reportedAt, today);

    let severity: "LOW" | "MODERATE" | "HIGH" | null = null;
    let reason = "";

    if (daysSinceLatest >= THRESHOLDS.progress.pg1.highDays) {
      severity = "HIGH";
      reason = `Last progress report was ${daysSinceLatest} days ago (>= 75 days)`;
    } else if (daysSinceLatest >= THRESHOLDS.progress.pg1.moderateDays) {
      severity = "MODERATE";
      reason = `Last progress report was ${daysSinceLatest} days ago (>= 45 days)`;
    } else if (daysSinceLatest >= THRESHOLDS.progress.pg1.lowDays) {
      severity = "LOW";
      reason = `Last progress report was ${daysSinceLatest} days ago (>= 30 days)`;
    }

    // Check stagnant identical reports
    if (sorted.length >= 2 && sorted[1]) {
      const second = sorted[1];
      if (latest.reportedPercent === second.reportedPercent) {
        const gapBetweenIdentical = calendarDaysBetween(second.reportedAt, latest.reportedAt);
        if (gapBetweenIdentical >= THRESHOLDS.progress.pg1.stagnantReportsDays) {
          if (!severity || severity === "LOW") {
            severity = "MODERATE";
            reason = `Successive progress reports show identical ${latest.reportedPercent}% progress across ${gapBetweenIdentical} days`;
          }
        }
      }
    }

    if (severity) {
      indicators.push({
        code: "PG1",
        category: "PROGRESS",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "PG1:-",
        titleKey: "risk.indicator.PG1.title",
        explainKey: "risk.indicator.PG1.explain",
        inputs: {
          daysSinceLatest,
          latestReportedAt: latest.reportedAt.toISOString(),
          latestPercent: latest.reportedPercent,
          reason,
        },
        evidence: [
          {
            kind: "progressReport",
            ref: {
              type: "progressReport",
              id: latest.id,
              label: `Report #${latest.sequence} (${latest.reportedPercent}%)`,
            },
            value: daysSinceLatest,
            unit: "days since report",
            asOf: latest.reportedAt.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.progress.stagnation",
          steps: [
            reason,
            `Assigned severity: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "REPORTED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // PG2: Unresolved quality / verification items
  // -------------------------------------------------------------------------
  const inspectionsEnv = inputs.inspections;
  if (inspectionsEnv.available && inspectionsEnv.data) {
    const insp = inspectionsEnv.data;
    let pg2Severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | null = null;
    const reasons: string[] = [];

    // Critical defects: >= 7 days HIGH, >= 30 days CRITICAL
    if (insp.openCriticalDefectsCount > 0) {
      if (insp.oldestCriticalDefectDays >= THRESHOLDS.progress.pg2.criticalDefectCriticalDays) {
        pg2Severity = elevateSeverity(pg2Severity, "CRITICAL");
        reasons.push(
          `${insp.openCriticalDefectsCount} open critical defects (oldest ${insp.oldestCriticalDefectDays} days >= 30 days)`,
        );
      } else if (insp.oldestCriticalDefectDays >= THRESHOLDS.progress.pg2.criticalDefectHighDays) {
        pg2Severity = elevateSeverity(pg2Severity, "HIGH");
        reasons.push(
          `${insp.openCriticalDefectsCount} open critical defects (oldest ${insp.oldestCriticalDefectDays} days >= 7 days)`,
        );
      }
    }

    // Major defects: >= 14 days MODERATE
    if (insp.openMajorDefectsCount > 0 && insp.oldestMajorDefectDays >= THRESHOLDS.progress.pg2.majorDefectModerateDays) {
      pg2Severity = elevateSeverity(pg2Severity, "MODERATE");
      reasons.push(
        `${insp.openMajorDefectsCount} open major defects (oldest ${insp.oldestMajorDefectDays} days >= 14 days)`,
      );
    }

    // Verifications awaiting review: >= 7 days LOW, >= 21 days MODERATE
    if (insp.verificationsAwaitingReviewCount > 0) {
      if (insp.oldestVerificationAwaitingDays >= THRESHOLDS.progress.pg2.verificationModerateDays) {
        pg2Severity = elevateSeverity(pg2Severity, "MODERATE");
        reasons.push(
          `${insp.verificationsAwaitingReviewCount} progress verifications awaiting review >= 21 days (oldest: ${insp.oldestVerificationAwaitingDays} days)`,
        );
      } else if (insp.oldestVerificationAwaitingDays >= THRESHOLDS.progress.pg2.verificationLowDays) {
        pg2Severity = elevateSeverity(pg2Severity, "LOW");
        reasons.push(
          `${insp.verificationsAwaitingReviewCount} progress verifications awaiting review >= 7 days (oldest: ${insp.oldestVerificationAwaitingDays} days)`,
        );
      }
    }

    if (pg2Severity) {
      indicators.push({
        code: "PG2",
        category: "PROGRESS",
        severity: pg2Severity,
        points: RISK_SEVERITY_POINTS[pg2Severity],
        fingerprint: "PG2:-",
        titleKey: "risk.indicator.PG2.title",
        explainKey: "risk.indicator.PG2.explain",
        inputs: {
          openCriticalDefectsCount: insp.openCriticalDefectsCount,
          oldestCriticalDefectDays: insp.oldestCriticalDefectDays,
          openMajorDefectsCount: insp.openMajorDefectsCount,
          oldestMajorDefectDays: insp.oldestMajorDefectDays,
          verificationsAwaitingReviewCount: insp.verificationsAwaitingReviewCount,
          oldestVerificationAwaitingDays: insp.oldestVerificationAwaitingDays,
        },
        evidence: [
          {
            kind: "inspection",
            ref: {
              type: "inspections",
              id: project.id,
              label: `${insp.openCriticalDefectsCount} critical / ${insp.openMajorDefectsCount} major defects`,
            },
            value: Math.max(
              insp.oldestCriticalDefectDays,
              insp.oldestMajorDefectDays,
              insp.oldestVerificationAwaitingDays,
            ),
            unit: "max days unresolved",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.progress.unresolvedQuality",
          steps: [
            ...reasons,
            `Severity assigned: ${pg2Severity} (${RISK_SEVERITY_POINTS[pg2Severity]} pts)`,
          ],
        },
        basis: "VERIFIED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // PG3: Reported vs verified progress gap
  // -------------------------------------------------------------------------
  if (
    project.verifiedProgress &&
    typeof project.physicalProgress === "number" &&
    typeof project.verifiedProgress.percent === "number"
  ) {
    const reported = project.physicalProgress;
    const verified = project.verifiedProgress.percent;
    const gap = reported - verified;

    if (gap >= THRESHOLDS.progress.pg3.moderateGapPp) {
      const severity: "MODERATE" | "HIGH" =
        gap >= THRESHOLDS.progress.pg3.highGapPp ? "HIGH" : "MODERATE";

      indicators.push({
        code: "PG3",
        category: "PROGRESS",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "PG3:-",
        titleKey: "risk.indicator.PG3.title",
        explainKey: "risk.indicator.PG3.explain",
        inputs: {
          reported,
          verified,
          gap,
        },
        evidence: [
          {
            kind: "verification",
            ref: {
              type: "verification",
              id: project.verifiedProgress.verificationId,
              label: `Verified progress ${verified}% vs reported ${reported}%`,
            },
            value: gap,
            unit: "pp gap",
            asOf: project.verifiedProgress.asOf.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.progress.verifiedGap",
          steps: [
            `Reported physical progress: ${reported}%`,
            `Verified physical progress: ${verified}%`,
            `Discrepancy gap: ${gap} percentage points ahead of verification`,
            `Assigned severity: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "MIXED",
      });
    }
  }

  return indicators;
}
