import type { RiskIndicatorDto } from "@infraos/shared-types";
import { RISK_SEVERITY_POINTS } from "@infraos/shared-types";
import { THRESHOLDS } from "../catalog.js";
import { calendarDaysBetween, colomboDayStart } from "../math.js";
import type { RiskInputs } from "../types.js";

export function evaluateScheduleIndicators(
  inputs: RiskInputs,
  now: Date,
): RiskIndicatorDto[] {
  const indicators: RiskIndicatorDto[] = [];
  const today = colomboDayStart(now);

  const projectEnv = inputs.project;
  const project = projectEnv.data;
  if (!project) return indicators;

  // -------------------------------------------------------------------------
  // SC1: Schedule inconsistencies & dependency propagation
  // -------------------------------------------------------------------------
  const milestonesEnv = inputs.milestones;
  const dependenciesEnv = inputs.dependencies;
  const milestones = milestonesEnv.data ?? [];
  const dependencies = dependenciesEnv.data ?? [];

  const issues: string[] = [];
  let criticalChainDelayed = false;

  // Check milestone windows
  for (const m of milestones) {
    if (m.plannedStart && m.plannedEnd && m.plannedEnd.getTime() < m.plannedStart.getTime()) {
      issues.push(`Milestone "${m.title}" planned end is before its planned start`);
    }
    if (project.plannedEndDate && m.plannedEnd && m.plannedEnd.getTime() > project.plannedEndDate.getTime()) {
      issues.push(`Milestone "${m.title}" planned end exceeds project planned end date`);
    }
    if (project.startDate && m.plannedStart && m.plannedStart.getTime() < project.startDate.getTime()) {
      issues.push(`Milestone "${m.title}" planned start is before project start date`);
    }
  }

  // Check dependencies
  for (const dep of dependencies) {
    if (dep.predecessorPlannedEnd && dep.successorPlannedStart) {
      if (dep.predecessorPlannedEnd.getTime() > dep.successorPlannedStart.getTime()) {
        issues.push(
          `Dependency violation: Predecessor ends after successor starts`,
        );
      }
    }
    if (
      dep.predecessorStatus &&
      ["DELAYED", "BLOCKED"].includes(dep.predecessorStatus)
    ) {
      if (dep.isCriticalChain) {
        criticalChainDelayed = true;
        issues.push(
          `Critical chain predecessor (${dep.predecessorProjectCode ?? "predecessor"}) is ${dep.predecessorStatus}`,
        );
      } else {
        issues.push(
          `Predecessor (${dep.predecessorProjectCode ?? "predecessor"}) is ${dep.predecessorStatus}`,
        );
      }
    }
  }

  if (issues.length > 0) {
    let severity: "LOW" | "MODERATE" = "LOW";
    if (criticalChainDelayed || issues.length >= THRESHOLDS.schedule.sc1.moderateIssuesCount) {
      severity = "MODERATE";
    }

    indicators.push({
      code: "SC1",
      category: "SCHEDULE",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "SC1:-",
      titleKey: "risk.indicator.SC1.title",
      explainKey: "risk.indicator.SC1.explain",
      inputs: {
        issueCount: issues.length,
        criticalChainDelayed,
        issues: issues.slice(0, 10),
      },
      evidence: [
        {
          kind: "schedule",
          ref: {
            type: "schedule",
            id: project.id,
            label: `${issues.length} schedule/dependency inconsistencies`,
          },
          value: issues.length,
          unit: "issues found",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.schedule.inconsistencies",
        steps: [
          `Schedule consistency check found ${issues.length} issue(s)`,
          criticalChainDelayed
            ? `Critical chain predecessor delayed: elevated to MODERATE`
            : `Issue count: ${issues.length} (>= 3 is MODERATE, 1-2 is LOW)`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
        ],
      },
      basis: "RECORDED",
    });
  }

  // -------------------------------------------------------------------------
  // SC2: Delayed approvals (excluding verifications in PG2 and revisions in BG4)
  // -------------------------------------------------------------------------
  const reviewsEnv = inputs.reviews;
  const financeEnv = inputs.finance;

  let maxPendingDays = 0;
  let totalPendingApprovals = 0;

  if (reviewsEnv.available && reviewsEnv.data) {
    totalPendingApprovals += reviewsEnv.data.pendingReviewsCount;
    if (reviewsEnv.data.oldestPendingDays > maxPendingDays) {
      maxPendingDays = reviewsEnv.data.oldestPendingDays;
    }
  }

  if (financeEnv.available && financeEnv.data) {
    totalPendingApprovals += financeEnv.data.pendingPaymentApprovalsCount;
    if (financeEnv.data.oldestPendingPaymentApprovalDays > maxPendingDays) {
      maxPendingDays = financeEnv.data.oldestPendingPaymentApprovalDays;
    }
  }

  if (totalPendingApprovals > 0 && maxPendingDays >= THRESHOLDS.schedule.sc2.slaLowDays) {
    let severity: "LOW" | "MODERATE" | "HIGH" = "LOW";
    if (maxPendingDays >= THRESHOLDS.schedule.sc2.slaHighDays) {
      severity = "HIGH";
    } else if (maxPendingDays >= THRESHOLDS.schedule.sc2.slaModerateDays) {
      severity = "MODERATE";
    }

    indicators.push({
      code: "SC2",
      category: "SCHEDULE",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "SC2:-",
      titleKey: "risk.indicator.SC2.title",
      explainKey: "risk.indicator.SC2.explain",
      inputs: {
        totalPendingApprovals,
        maxPendingDays,
      },
      evidence: [
        {
          kind: "review",
          ref: {
            type: "approvals",
            id: project.id,
            label: `${totalPendingApprovals} pending review/payment approvals`,
          },
          value: maxPendingDays,
          unit: "days pending past SLA",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.schedule.delayedApprovals",
        steps: [
          `Pending approvals count: ${totalPendingApprovals}`,
          `Oldest pending decision: ${maxPendingDays} days (SLA: 7d LOW, 14d MODERATE, 30d HIGH)`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
        ],
      },
      basis: "RECORDED",
    });
  }

  // -------------------------------------------------------------------------
  // SC3: Inspection delays
  // -------------------------------------------------------------------------
  const inspectionsEnv = inputs.inspections;
  if (inspectionsEnv.available && inspectionsEnv.data) {
    const insp = inspectionsEnv.data;
    if (insp.scheduledOverdueCount > 0) {
      let severity: "LOW" | "MODERATE" | "HIGH" = "LOW";
      if (insp.oldestScheduledOverdueDays >= THRESHOLDS.schedule.sc3.highDaysLate) {
        severity = "HIGH";
      } else if (insp.oldestScheduledOverdueDays >= THRESHOLDS.schedule.sc3.moderateDaysLate) {
        severity = "MODERATE";
      }

      indicators.push({
        code: "SC3",
        category: "SCHEDULE",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "SC3:-",
        titleKey: "risk.indicator.SC3.title",
        explainKey: "risk.indicator.SC3.explain",
        inputs: {
          scheduledOverdueCount: insp.scheduledOverdueCount,
          oldestScheduledOverdueDays: insp.oldestScheduledOverdueDays,
        },
        evidence: [
          {
            kind: "inspection",
            ref: {
              type: "inspections",
              id: project.id,
              label: `${insp.scheduledOverdueCount} scheduled inspection(s) overdue`,
            },
            value: insp.oldestScheduledOverdueDays,
            unit: "days overdue",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.schedule.inspectionDelays",
          steps: [
            `${insp.scheduledOverdueCount} scheduled inspection(s) past planned date without submitted report`,
            `Oldest overdue inspection: ${insp.oldestScheduledOverdueDays} days late`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    } else if (
      project.status === "ACTIVE" &&
      insp.totalCompletedInspectionsCount === 0 &&
      project.startDate
    ) {
      const elapsed = calendarDaysBetween(project.startDate, today);
      if (elapsed >= THRESHOLDS.schedule.sc3.noInspectionsActiveDays) {
        indicators.push({
          code: "SC3",
          category: "SCHEDULE",
          severity: "INFO",
          points: 0,
          fingerprint: "SC3:none",
          titleKey: "risk.indicator.SC3.title",
          explainKey: "risk.indicator.SC3.noneRecorded",
          inputs: {
            elapsedDaysSinceStart: elapsed,
          },
          evidence: [
            {
              kind: "inspection",
              ref: {
                type: "inspections",
                id: project.id,
                label: "No inspections recorded",
              },
              value: elapsed,
              unit: "days active without inspection",
              asOf: today.toISOString(),
            },
          ],
          calc: {
            formulaKey: "calc.schedule.noInspectionsRecorded",
            steps: [
              `Project has been ACTIVE for ${elapsed} days (>= 60 days)`,
              `No scheduled or completed inspection records found`,
              `Informational flag: 0 pts`,
            ],
          },
          basis: "RECORDED",
        });
      }
    }
  }

  return indicators;
}

