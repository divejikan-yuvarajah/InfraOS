import type { RiskIndicatorDto } from "@infraos/shared-types";
import { RISK_SEVERITY_POINTS } from "@infraos/shared-types";
import { THRESHOLDS } from "../catalog.js";
import {
  calendarDaysBetween,
  clamp,
  colomboDayStart,
} from "../math.js";
import type { RiskInputs } from "../types.js";

export function evaluateDelayIndicators(
  inputs: RiskInputs,
  now: Date,
): RiskIndicatorDto[] {
  const indicators: RiskIndicatorDto[] = [];
  const today = colomboDayStart(now);

  const projectEnv = inputs.project;
  const project = projectEnv.data;
  if (!project) return indicators;

  // Applicability: Delay indicators only apply to ACTIVE or DELAYED projects
  if (!["ACTIVE", "DELAYED"].includes(project.status)) {
    return indicators;
  }

  // -------------------------------------------------------------------------
  // DL1: Past planned end
  // -------------------------------------------------------------------------
  let dl1Critical = false;
  if (project.plannedEndDate) {
    const daysOverdue = calendarDaysBetween(project.plannedEndDate, today);
    if (daysOverdue > 0) {
      let severity: "MODERATE" | "HIGH" | "CRITICAL" = "MODERATE";
      if (daysOverdue > 60) {
        severity = "CRITICAL";
        dl1Critical = true;
      } else if (daysOverdue >= 15) {
        severity = "HIGH";
      }

      indicators.push({
        code: "DL1",
        category: "DELAY",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "DL1:-",
        titleKey: "risk.indicator.DL1.title",
        explainKey: "risk.indicator.DL1.explain",
        inputs: {
          plannedEndDate: project.plannedEndDate.toISOString(),
          daysOverdue,
          status: project.status,
        },
        evidence: [
          {
            kind: "project",
            ref: {
              type: "project",
              id: project.id,
              label: `${project.projectCode} ${project.title}`,
            },
            value: daysOverdue,
            unit: "days",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.delay.pastPlannedEnd",
          steps: [
            `Planned end date: ${project.plannedEndDate.toISOString().slice(0, 10)}`,
            `Current date (Asia/Colombo): ${today.toISOString().slice(0, 10)}`,
            `Calendar days overdue: ${daysOverdue}`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // DL2: Schedule variance (linear plan vs physical progress)
  // -------------------------------------------------------------------------
  if (
    project.startDate &&
    project.plannedEndDate &&
    project.startDate.getTime() < project.plannedEndDate.getTime()
  ) {
    const totalDays = calendarDaysBetween(project.startDate, project.plannedEndDate);
    const elapsedDays = calendarDaysBetween(project.startDate, today);

    // Evaluate only if duration >= 30 days and elapsed >= 10%
    if (totalDays >= THRESHOLDS.delay.dl2.minDurationDays && elapsedDays > 0) {
      const elapsedShare = elapsedDays / totalDays;
      if (elapsedShare >= THRESHOLDS.delay.dl2.minElapsedShare) {
        const plannedPct = clamp(Math.round((elapsedDays / totalDays) * 100), 0, 100);
        const actualPct =
          project.physicalBasis === "VERIFIED" && project.verifiedProgress != null
            ? project.verifiedProgress.percent
            : project.physicalProgress;
        const gap = plannedPct - actualPct;

        if (gap >= THRESHOLDS.delay.dl2.lowGap) {
          let severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
          if (gap >= THRESHOLDS.delay.dl2.criticalGap) {
            severity = "CRITICAL";
          } else if (gap >= THRESHOLDS.delay.dl2.highGap) {
            severity = "HIGH";
          } else if (gap >= THRESHOLDS.delay.dl2.moderateGap) {
            severity = "MODERATE";
          }

          // Basis REPORTED caps severity at HIGH
          if (project.physicalBasis === "REPORTED" && severity === "CRITICAL") {
            severity = "HIGH";
          }

          // Dedupe rule: Suppressed to INFO (0 pts) if DL1 is already CRITICAL
          let points = RISK_SEVERITY_POINTS[severity];
          let finalSeverity: "INFO" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = severity;
          if (dl1Critical) {
            finalSeverity = "INFO";
            points = 0;
          }

          indicators.push({
            code: "DL2",
            category: "DELAY",
            severity: finalSeverity,
            points,
            fingerprint: "DL2:-",
            titleKey: "risk.indicator.DL2.title",
            explainKey: "risk.indicator.DL2.explain",
            inputs: {
              totalDays,
              elapsedDays,
              plannedPct,
              actualPct,
              gap,
              basis: project.physicalBasis,
              dl1Suppressed: dl1Critical,
            },
            evidence: [
              {
                kind: "project",
                ref: {
                  type: "project",
                  id: project.id,
                  label: `${project.projectCode} ${project.title}`,
                },
                value: gap,
                unit: "pp",
                asOf: today.toISOString(),
              },
            ],
            calc: {
              formulaKey: "calc.delay.scheduleVariance",
              steps: [
                `Elapsed time on linear schedule: ${plannedPct}% (${elapsedDays} of ${totalDays} days)`,
                `Actual ${project.physicalBasis.toLowerCase()} physical progress: ${actualPct}%`,
                `Schedule variance gap: ${gap} percentage points`,
                dl1Critical
                  ? `Suppressed to INFO because project is already > 60 days past planned end (DL1 CRITICAL)`
                  : `Severity: ${finalSeverity} (${points} pts)${project.physicalBasis === "REPORTED" ? " (Reported basis caps at HIGH)" : ""}`,
              ],
            },
            basis: project.physicalBasis,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // DL3: Milestone slippage
  // -------------------------------------------------------------------------
  const milestonesEnv = inputs.milestones;
  if (milestonesEnv.available && milestonesEnv.data) {
    const dueMilestones = milestonesEnv.data.filter(
      (m) =>
        m.plannedEnd &&
        colomboDayStart(m.plannedEnd).getTime() <= today.getTime() &&
        m.status !== "CANCELLED",
    );

    if (dueMilestones.length > 0) {
      const overdue = dueMilestones.filter(
        (m) => m.status !== "COMPLETED",
      );

      if (overdue.length > 0) {
        const overdueCount = overdue.length;
        const dueCount = dueMilestones.length;
        const share = overdueCount / dueCount;
        const totalDaysLate = overdue.reduce((sum, m) => {
          return sum + Math.max(0, calendarDaysBetween(m.plannedEnd!, today));
        }, 0);
        const avgDaysLate = Math.round(totalDaysLate / overdueCount);

        let severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
        if (
          share >= THRESHOLDS.delay.dl3.criticalShare &&
          avgDaysLate >= THRESHOLDS.delay.dl3.criticalAvgDaysLate
        ) {
          severity = "CRITICAL";
        } else if (
          share >= THRESHOLDS.delay.dl3.highShare ||
          overdueCount >= THRESHOLDS.delay.dl3.highCount ||
          avgDaysLate >= THRESHOLDS.delay.dl3.highAvgDaysLate
        ) {
          severity = "HIGH";
        } else if (
          share >= THRESHOLDS.delay.dl3.moderateShare ||
          avgDaysLate >= THRESHOLDS.delay.dl3.moderateAvgDaysLate
        ) {
          severity = "MODERATE";
        }

        indicators.push({
          code: "DL3",
          category: "DELAY",
          severity,
          points: RISK_SEVERITY_POINTS[severity],
          fingerprint: "DL3:-",
          titleKey: "risk.indicator.DL3.title",
          explainKey: "risk.indicator.DL3.explain",
          inputs: {
            overdueCount,
            dueCount,
            share: Math.round(share * 1000) / 10,
            avgDaysLate,
          },
          evidence: overdue.slice(0, 5).map((m) => ({
            kind: "milestone",
            ref: {
              type: "milestone",
              id: m.id,
              label: m.title,
            },
            value: m.plannedEnd ? calendarDaysBetween(m.plannedEnd, today) : 0,
            unit: "days late",
            asOf: today.toISOString(),
          })),
          calc: {
            formulaKey: "calc.delay.milestoneSlippage",
            steps: [
              `Due milestones: ${dueCount}; Overdue milestones: ${overdueCount} (${Math.round(share * 100)}%)`,
              `Average days overdue across delayed milestones: ${avgDaysLate} days`,
              `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
            ],
          },
          basis: "RECORDED",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // DL4: Contractor delay history
  // -------------------------------------------------------------------------
  const contractorEnv = inputs.contractor;
  if (
    contractorEnv.available &&
    contractorEnv.data &&
    contractorEnv.data.assigned &&
    contractorEnv.data.contractorId
  ) {
    const cData = contractorEnv.data;
    if (cData.priorClosedProjectsCount >= THRESHOLDS.delay.dl4.minPriorProjects) {
      const delayedShare = cData.priorProjectsDelayedCount / cData.priorClosedProjectsCount;
      if (delayedShare >= THRESHOLDS.delay.dl4.lowShare) {
        let severity: "LOW" | "MODERATE" | "HIGH" = "LOW";
        if (delayedShare >= THRESHOLDS.delay.dl4.highShare) {
          severity = "HIGH";
        } else if (delayedShare >= THRESHOLDS.delay.dl4.moderateShare) {
          severity = "MODERATE";
        }

        indicators.push({
          code: "DL4",
          category: "DELAY",
          severity,
          points: RISK_SEVERITY_POINTS[severity],
          fingerprint: `DL4:${cData.contractorId ?? "-"}`,
          subjectKey: cData.contractorId ?? undefined,
          titleKey: "risk.indicator.DL4.title",
          explainKey: "risk.indicator.DL4.explain",
          inputs: {
            priorClosedProjectsCount: cData.priorClosedProjectsCount,
            priorProjectsDelayedCount: cData.priorProjectsDelayedCount,
            delayedShare: Math.round(delayedShare * 1000) / 10,
            contractorName: cData.contractorName ?? "Assigned contractor",
          },
          evidence: [
            {
              kind: "contractor",
              ref: {
                type: "contractor",
                id: cData.contractorId ?? "contractor",
                label: cData.contractorName ?? "Assigned contractor",
              },
              value: Math.round(delayedShare * 100),
              unit: "% delayed",
              asOf: today.toISOString(),
            },
          ],
          calc: {
            formulaKey: "calc.delay.contractorHistory",
            steps: [
              `Prior closed projects with delay data: ${cData.priorClosedProjectsCount}`,
              `Prior projects completed late (> 14 days) or ended delayed: ${cData.priorProjectsDelayedCount}`,
              `Historical delay rate: ${Math.round(delayedShare * 100)}%`,
              `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts, capped at HIGH)`,
            ],
          },
          basis: "RECORDED",
        });
      }
    } else {
      indicators.push({
        code: "DL4",
        category: "DELAY",
        severity: "INFO",
        points: 0,
        fingerprint: `DL4:${cData.contractorId ?? "-"}`,
        subjectKey: cData.contractorId ?? undefined,
        titleKey: "risk.indicator.DL4.title",
        explainKey: "risk.indicator.DL4.insufficientHistory",
        inputs: {
          priorClosedProjectsCount: cData.priorClosedProjectsCount,
          contractorName: cData.contractorName ?? "Assigned contractor",
        },
        evidence: [
          {
            kind: "contractor",
            ref: {
              type: "contractor",
              id: cData.contractorId ?? "contractor",
              label: cData.contractorName ?? "Assigned contractor",
            },
            value: cData.priorClosedProjectsCount,
            unit: "prior projects (minimum 3 required to score)",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.delay.contractorHistoryInsufficient",
          steps: [
            `Contractor has only ${cData.priorClosedProjectsCount} prior closed project(s) on record`,
            `Minimum 3 completed projects required to compute reliable delay rate`,
            `Informational indicator: not scored (0 pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // DL5: Historical overrun context (Informational only)
  // -------------------------------------------------------------------------
  const historyEnv = inputs.history;
  if (historyEnv.available && historyEnv.data) {
    if (historyEnv.data.comparableCount >= THRESHOLDS.delay.dl5.minComparables) {
      const overrunPct = Math.round((historyEnv.data.medianDurationOverrunRatio - 1) * 100);
      indicators.push({
        code: "DL5",
        category: "DELAY",
        severity: "INFO",
        points: 0,
        fingerprint: "DL5:-",
        titleKey: "risk.indicator.DL5.title",
        explainKey: "risk.indicator.DL5.explain",
        inputs: {
          comparableCount: historyEnv.data.comparableCount,
          overrunPct,
        },
        evidence: [
          {
            kind: "history",
            ref: {
              type: "comparables",
              id: `${project.projectType}:${project.agencyId}`,
              label: `Comparable completed ${project.projectType} projects`,
            },
            value: overrunPct,
            unit: "% median duration overrun",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.delay.historicalOverrun",
          steps: [
            `Sample size of completed comparable projects: ${historyEnv.data.comparableCount}`,
            `Median duration overrun ratio: ${historyEnv.data.medianDurationOverrunRatio.toFixed(2)}x (${overrunPct}%)`,
            `Informational indicator: not scored (0 pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  return indicators;
}
