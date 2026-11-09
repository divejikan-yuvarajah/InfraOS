import type { RiskIndicatorDto, RiskSeverity } from "@infraos/shared-types";
import { RISK_SEVERITY_POINTS } from "@infraos/shared-types";
import { THRESHOLDS } from "../catalog.js";
import { colomboDayStart } from "../math.js";
import type { RiskInputs } from "../types.js";

const SEVERITY_ORDER: RiskSeverity[] = ["INFO", "LOW", "MODERATE", "HIGH", "CRITICAL"];

function escalate(sev: RiskSeverity): RiskSeverity {
  const idx = SEVERITY_ORDER.indexOf(sev);
  if (idx < 0 || idx >= SEVERITY_ORDER.length - 1) return "CRITICAL";
  return SEVERITY_ORDER[idx + 1] ?? "CRITICAL";
}

export function evaluateCoordinationIndicators(
  inputs: RiskInputs,
  now: Date,
): RiskIndicatorDto[] {
  const indicators: RiskIndicatorDto[] = [];
  const today = colomboDayStart(now);

  const projectEnv = inputs.project;
  const project = projectEnv.data;
  if (!project) return indicators;

  // -------------------------------------------------------------------------
  // CO1: Unresolved RoadSync conflicts
  // -------------------------------------------------------------------------
  const roadsyncEnv = inputs.roadsync;
  if (roadsyncEnv.available && roadsyncEnv.data) {
    const conflicts = roadsyncEnv.data.conflicts ?? [];

    for (const c of conflicts) {
      // Map RoadSync band: LOW->LOW, MEDIUM->MODERATE, HIGH->HIGH, CRITICAL->CRITICAL
      let severity: RiskSeverity = "LOW";
      if (c.severityBand === "CRITICAL") severity = "CRITICAL";
      else if (c.severityBand === "HIGH") severity = "HIGH";
      else if (c.severityBand === "MEDIUM") severity = "MODERATE";
      else severity = "LOW";

      // Aged >= 30 days open: +1 level (cap CRITICAL)
      const aged = c.openDays >= THRESHOLDS.coordination.co1.agedDays;
      if (aged) {
        severity = escalate(severity);
      }

      indicators.push({
        code: "CO1",
        category: "COORDINATION",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: `CO1:${c.conflictNo}`,
        subjectKey: c.conflictNo,
        titleKey: "risk.indicator.CO1.title",
        explainKey: "risk.indicator.CO1.explain",
        inputs: {
          conflictId: c.conflictId,
          conflictNo: c.conflictNo,
          originalBand: c.severityBand,
          status: c.status,
          openDays: c.openDays,
          aged,
          affectedAgencyCount: c.affectedAgencyCount,
          affectedAgencies: c.affectedAgencyNames ?? [],
        },
        evidence: [
          {
            kind: "conflict",
            ref: {
              type: "conflict",
              id: c.conflictId,
              label: `${c.conflictNo} (${c.severityBand})`,
            },
            value: c.openDays,
            unit: "days open",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.coordination.roadsyncConflict",
          steps: [
            `RoadSync conflict ${c.conflictNo} has status "${c.status}" and band "${c.severityBand}"`,
            `Open duration: ${c.openDays} days${aged ? " (>= 30 days aged: +1 severity escalation)" : ""}`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }

    // -----------------------------------------------------------------------
    // CO2: Coordination overdue & commitments
    // -----------------------------------------------------------------------
    const unackCount = roadsyncEnv.data.unacknowledgedCoordinationCount ?? 0;
    const oldestUnackDays = roadsyncEnv.data.oldestUnacknowledgedDays ?? 0;
    const overdueCommitmentsCount = roadsyncEnv.data.overdueCommitmentsCount ?? 0;
    const oldestOverdueCommitmentDays = roadsyncEnv.data.oldestOverdueCommitmentDays ?? 0;

    const totalOverdue = unackCount + overdueCommitmentsCount;
    const maxDays = Math.max(oldestUnackDays, oldestOverdueCommitmentDays);

    if (totalOverdue > 0) {
      let severity: RiskSeverity = "LOW";
      if (maxDays >= THRESHOLDS.coordination.co2.slaHighDays) {
        severity = "HIGH";
      } else if (maxDays >= THRESHOLDS.coordination.co2.slaModerateDays) {
        severity = "MODERATE";
      }

      indicators.push({
        code: "CO2",
        category: "COORDINATION",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "CO2:-",
        titleKey: "risk.indicator.CO2.title",
        explainKey: "risk.indicator.CO2.explain",
        inputs: {
          unackCount,
          oldestUnackDays,
          overdueCommitmentsCount,
          oldestOverdueCommitmentDays,
          maxDays,
        },
        evidence: [
          {
            kind: "coordination",
            ref: {
              type: "coordination",
              id: project.id,
              label: `${totalOverdue} coordination item(s) overdue`,
            },
            value: maxDays,
            unit: "days overdue",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.coordination.overdueRequests",
          steps: [
            `Unacknowledged coordination requests: ${unackCount}; Overdue commitments: ${overdueCommitmentsCount}`,
            `Oldest overdue coordination item: ${maxDays} days`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // CO3: Contractor concurrency load
  // -------------------------------------------------------------------------
  const contractorEnv = inputs.contractor;
  if (
    contractorEnv.available &&
    contractorEnv.data &&
    contractorEnv.data.assigned &&
    contractorEnv.data.contractorId
  ) {
    const cData = contractorEnv.data;
    if (cData.activeAssignmentsCount >= THRESHOLDS.coordination.co3.lowOverlapping) {
      let severity: RiskSeverity = "LOW";
      if (cData.activeAssignmentsCount >= THRESHOLDS.coordination.co3.moderateOverlapping) {
        severity = "MODERATE";
      }

      indicators.push({
        code: "CO3",
        category: "COORDINATION",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: `CO3:${cData.contractorId ?? "-"}`,
        subjectKey: cData.contractorId ?? undefined,
        titleKey: "risk.indicator.CO3.title",
        explainKey: "risk.indicator.CO3.explain",
        inputs: {
          activeAssignmentsCount: cData.activeAssignmentsCount,
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
            value: cData.activeAssignmentsCount,
            unit: "active projects",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.coordination.contractorConcurrency",
          steps: [
            `Contractor has ${cData.activeAssignmentsCount} overlapping active project assignments`,
            `Capacity may be stretched (>= ${THRESHOLDS.coordination.co3.lowOverlapping} projects)`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  return indicators;
}
