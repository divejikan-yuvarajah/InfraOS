import type { RiskIndicatorDto } from "@infraos/shared-types";
import { RISK_SEVERITY_POINTS } from "@infraos/shared-types";
import { THRESHOLDS } from "../catalog.js";
import {
  BPS_ONE_HUNDRED_PERCENT,
  bpsToPercentage,
  colomboDayStart,
  ratioBps,
} from "../math.js";
import type { RiskInputs } from "../types.js";

export function evaluateBudgetIndicators(
  inputs: RiskInputs,
  now: Date,
): RiskIndicatorDto[] {
  const indicators: RiskIndicatorDto[] = [];
  const today = colomboDayStart(now);

  const projectEnv = inputs.project;
  const project = projectEnv.data;
  const financeEnv = inputs.finance;

  if (!project || !financeEnv.available || !financeEnv.data) {
    return indicators;
  }

  const fin = financeEnv.data;
  const budgetMinor = fin.budgetMinor > 0 ? fin.budgetMinor : project.budgetMinor;
  if (budgetMinor <= 0) {
    return indicators;
  }

  const spentMinor = fin.spentMinor;
  const committedMinor = fin.committedMinor;
  const financialBps = ratioBps(spentMinor, budgetMinor);
  const financialPct = bpsToPercentage(financialBps);
  const physicalPct =
    project.physicalBasis === "VERIFIED" && project.verifiedProgress != null
      ? project.verifiedProgress.percent
      : project.physicalProgress;

  // -------------------------------------------------------------------------
  // BG1: Financial-to-physical mismatch
  // -------------------------------------------------------------------------
  const gap = financialPct - physicalPct;

  if (gap >= THRESHOLDS.budget.bg1.lowPp) {
    let severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
    if (gap >= THRESHOLDS.budget.bg1.criticalPp) {
      severity = "CRITICAL";
    } else if (gap >= THRESHOLDS.budget.bg1.highPp) {
      severity = "HIGH";
    } else if (gap >= THRESHOLDS.budget.bg1.moderatePp) {
      severity = "MODERATE";
    }

    // Basis REPORTED caps severity at HIGH
    if (project.physicalBasis === "REPORTED" && severity === "CRITICAL") {
      severity = "HIGH";
    }

    indicators.push({
      code: "BG1",
      category: "BUDGET",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "BG1:-",
      titleKey: "risk.indicator.BG1.title",
      explainKey: "risk.indicator.BG1.explain",
      inputs: {
        financialPct,
        physicalPct,
        gap,
        spentMinor,
        budgetMinor,
        basis: project.physicalBasis,
      },
      evidence: [
        {
          kind: "finance",
          ref: {
            type: "finance",
            id: project.id,
            label: "Recorded spend vs physical completion",
          },
          value: gap,
          unit: "pp gap",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.financialPhysicalGap",
        steps: [
          `Financial progress: ${financialPct}%`,
          `Physical progress (${project.physicalBasis.toLowerCase()}): ${physicalPct}%`,
          `Spending ahead of physical progress: ${gap} percentage points`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)${project.physicalBasis === "REPORTED" ? " (Reported basis caps at HIGH)" : ""}`,
        ],
      },
      basis: project.physicalBasis,
    });
  } else if (physicalPct - financialPct >= THRESHOLDS.budget.bg1.workAheadInfoPp) {
    // Reverse case: work ahead of recorded spend -> INFO
    const reverseGap = physicalPct - financialPct;
    indicators.push({
      code: "BG1",
      category: "BUDGET",
      severity: "INFO",
      points: 0,
      fingerprint: "BG1:-",
      titleKey: "risk.indicator.BG1.title",
      explainKey: "risk.indicator.BG1.workAhead",
      inputs: {
        financialPct,
        physicalPct,
        reverseGap,
        spentMinor,
        budgetMinor,
      },
      evidence: [
        {
          kind: "finance",
          ref: {
            type: "finance",
            id: project.id,
            label: "Physical completion ahead of recorded spend",
          },
          value: reverseGap,
          unit: "pp gap",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.workAheadOfSpend",
        steps: [
          `Physical progress: ${physicalPct}% vs recorded financial spend: ${financialPct}%`,
          `Work is ${reverseGap} pp ahead of spend — verify unrecorded expenses or unpaid invoices`,
          `Informational indicator: 0 pts`,
        ],
      },
      basis: project.physicalBasis,
    });
  }

  // -------------------------------------------------------------------------
  // BG2: Commitment exposure
  // -------------------------------------------------------------------------
  const totalCommittedBps = ratioBps(spentMinor + committedMinor, budgetMinor);
  if (totalCommittedBps > THRESHOLDS.budget.bg2.moderateBps) {
    let severity: "MODERATE" | "HIGH" | "CRITICAL" = "MODERATE";
    if (totalCommittedBps > THRESHOLDS.budget.bg2.criticalBps) {
      severity = "CRITICAL";
    } else if (totalCommittedBps > THRESHOLDS.budget.bg2.highBps) {
      severity = "HIGH";
    }

    const exposurePct = bpsToPercentage(totalCommittedBps);
    indicators.push({
      code: "BG2",
      category: "BUDGET",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "BG2:-",
      titleKey: "risk.indicator.BG2.title",
      explainKey: "risk.indicator.BG2.explain",
      inputs: {
        totalCommittedBps,
        exposurePct,
        spentMinor,
        committedMinor,
        budgetMinor,
      },
      evidence: [
        {
          kind: "finance",
          ref: {
            type: "finance",
            id: project.id,
            label: "Total commitments (spent + approved unpaid)",
          },
          value: exposurePct,
          unit: "% of budget",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.commitmentExposure",
        steps: [
          `Committed exposure (spent + committed): ${exposurePct}% of allocated budget`,
          `Threshold crossed: > ${severity === "CRITICAL" ? "115%" : severity === "HIGH" ? "100%" : "95%"}`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
        ],
      },
      basis: "RECORDED",
    });
  }

  // -------------------------------------------------------------------------
  // BG3: Cost efficiency (indicative CPI)
  // -------------------------------------------------------------------------
  if (physicalPct >= THRESHOLDS.budget.bg3.minPhysicalPct && spentMinor > 0) {
    // CPI = EV / AC = (budgetMinor * physicalPct / 100) / spentMinor
    // In basis points: EV_bps = (budgetMinor * physicalPct) / 100
    // CPI = EV / spentMinor
    const evMinor = (BigInt(budgetMinor) * BigInt(Math.round(physicalPct * 10))) / 1000n;
    const cpiBps = ratioBps(evMinor, spentMinor);
    const cpi = cpiBps / 10000;

    if (cpi < THRESHOLDS.budget.bg3.lowCpi) {
      let severity: "LOW" | "MODERATE" | "HIGH" = "LOW";
      if (cpi < THRESHOLDS.budget.bg3.highCpi) {
        severity = "HIGH";
      } else if (cpi < THRESHOLDS.budget.bg3.moderateCpi) {
        severity = "MODERATE";
      }

      // EAC is shown ONLY if physicalPct >= 25% AND basis is VERIFIED
      let eacMinor: number | null = null;
      if (
        physicalPct >= THRESHOLDS.budget.bg3.eacMinPhysicalPct &&
        project.physicalBasis === "VERIFIED" &&
        cpiBps > 0
      ) {
        const eacBig = (BigInt(budgetMinor) * BPS_ONE_HUNDRED_PERCENT) / BigInt(cpiBps);
        eacMinor = Number(eacBig > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : eacBig);
      }

      indicators.push({
        code: "BG3",
        category: "BUDGET",
        severity,
        points: RISK_SEVERITY_POINTS[severity],
        fingerprint: "BG3:-",
        titleKey: "risk.indicator.BG3.title",
        explainKey: "risk.indicator.BG3.explain",
        inputs: {
          cpi: Math.round(cpi * 100) / 100,
          physicalPct,
          spentMinor,
          budgetMinor,
          eacMinor,
          basis: project.physicalBasis,
        },
        evidence: [
          {
            kind: "finance",
            ref: {
              type: "finance",
              id: project.id,
              label: "Indicative cost performance index (EV / AC)",
            },
            value: (Math.round(cpi * 100) / 100).toFixed(2),
            unit: "CPI",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.budget.costEfficiency",
          steps: [
            `Earned value (EV): ${physicalPct}% of budget`,
            `Actual cost (AC): recorded spent`,
            `Indicative CPI: ${(Math.round(cpi * 100) / 100).toFixed(2)}`,
            eacMinor !== null
              ? `Illustrative EAC if current efficiency continues (not a forecast)`
              : `EAC omitted (requires >= 25% verified progress)`,
            `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
          ],
        },
        basis: project.physicalBasis,
      });
    }
  }

  // -------------------------------------------------------------------------
  // BG4: Budget revisions
  // -------------------------------------------------------------------------
  const increasePct = ratioBps(fin.cumulativeBudgetIncreaseMinor, budgetMinor) / 100;
  if (
    fin.approvedRevisionsCount >= THRESHOLDS.budget.bg4.lowRevisions ||
    increasePct >= THRESHOLDS.budget.bg4.lowIncreasePct
  ) {
    let severity: "LOW" | "MODERATE" = "LOW";
    if (
      fin.approvedRevisionsCount >= THRESHOLDS.budget.bg4.moderateRevisions ||
      increasePct >= THRESHOLDS.budget.bg4.moderateIncreasePct
    ) {
      severity = "MODERATE";
    }

    indicators.push({
      code: "BG4",
      category: "BUDGET",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "BG4:-",
      titleKey: "risk.indicator.BG4.title",
      explainKey: "risk.indicator.BG4.explain",
      inputs: {
        approvedRevisionsCount: fin.approvedRevisionsCount,
        increasePct: Math.round(increasePct * 10) / 10,
        cumulativeBudgetIncreaseMinor: fin.cumulativeBudgetIncreaseMinor,
      },
      evidence: [
        {
          kind: "finance",
          ref: {
            type: "budgetRevisions",
            id: project.id,
            label: `${fin.approvedRevisionsCount} approved revisions`,
          },
          value: Math.round(increasePct * 10) / 10,
          unit: "% cumulative increase",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.revisions",
        steps: [
          `Approved budget revisions count: ${fin.approvedRevisionsCount}`,
          `Cumulative budget increase: ${Math.round(increasePct * 10) / 10}%`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
        ],
      },
      basis: "RECORDED",
    });
  } else if (
    fin.pendingRevisionsCount > 0 &&
    fin.oldestPendingRevisionDays >= THRESHOLDS.budget.bg4.pendingAgeDays
  ) {
    // Pending revision age flag -> INFO
    indicators.push({
      code: "BG4",
      category: "BUDGET",
      severity: "INFO",
      points: 0,
      fingerprint: "BG4:-",
      titleKey: "risk.indicator.BG4.title",
      explainKey: "risk.indicator.BG4.pending",
      inputs: {
        pendingRevisionsCount: fin.pendingRevisionsCount,
        oldestPendingRevisionDays: fin.oldestPendingRevisionDays,
      },
      evidence: [
        {
          kind: "finance",
          ref: {
            type: "budgetRevisions",
            id: project.id,
            label: "Pending budget revision",
          },
          value: fin.oldestPendingRevisionDays,
          unit: "days pending",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.pendingRevision",
        steps: [
          `Budget revision pending approval: ${fin.oldestPendingRevisionDays} days (>= 14 days)`,
          `Informational flag: 0 pts`,
        ],
      },
      basis: "RECORDED",
    });
  }

  // -------------------------------------------------------------------------
  // BG5: Spending spike
  // -------------------------------------------------------------------------
  if (
    fin.trailingMonthlySpendMinor &&
    fin.trailingMonthlySpendMinor.length >= THRESHOLDS.budget.bg5.minMonthlyHistory
  ) {
    const sumMonthly = fin.trailingMonthlySpendMinor.reduce((a, b) => a + BigInt(b), 0n);
    const avgMonthly = sumMonthly / BigInt(fin.trailingMonthlySpendMinor.length);

    if (avgMonthly > 0n && BigInt(fin.last30DaysSpendMinor) > avgMonthly * 2n) {
      indicators.push({
        code: "BG5",
        category: "BUDGET",
        severity: "MODERATE",
        points: RISK_SEVERITY_POINTS.MODERATE,
        fingerprint: "BG5:-",
        titleKey: "risk.indicator.BG5.title",
        explainKey: "risk.indicator.BG5.explain",
        inputs: {
          last30DaysSpendMinor: fin.last30DaysSpendMinor,
          trailingAvgMinor: Number(avgMonthly),
          ratio: Number((BigInt(fin.last30DaysSpendMinor) * 100n) / avgMonthly) / 100,
        },
        evidence: [
          {
            kind: "finance",
            ref: {
              type: "finance",
              id: project.id,
              label: "Last 30 days spending vs monthly average",
            },
            value: Number((BigInt(fin.last30DaysSpendMinor) * 100n) / avgMonthly) / 100,
            unit: "x monthly avg",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.budget.spendingSpike",
          steps: [
            `Last 30 days spend exceeds 2x trailing monthly average (${(Number((BigInt(fin.last30DaysSpendMinor) * 100n) / avgMonthly) / 100).toFixed(1)}x)`,
            `Investigate unusually high spending rate`,
            `Severity assigned: MODERATE (${RISK_SEVERITY_POINTS.MODERATE} pts)`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  // Single large transaction > 25% of budget flag -> INFO
  if (
    fin.largestSingleTransactionMinor > 0 &&
    ratioBps(fin.largestSingleTransactionMinor, budgetMinor) > 2500
  ) {
    const singlePct = bpsToPercentage(ratioBps(fin.largestSingleTransactionMinor, budgetMinor));
    // If BG5 was not already added, add as INFO
    if (!indicators.some((i) => i.code === "BG5")) {
      indicators.push({
        code: "BG5",
        category: "BUDGET",
        severity: "INFO",
        points: 0,
        fingerprint: "BG5:large_tx",
        titleKey: "risk.indicator.BG5.title",
        explainKey: "risk.indicator.BG5.largeTx",
        inputs: {
          largestSingleTransactionMinor: fin.largestSingleTransactionMinor,
          singlePct,
        },
        evidence: [
          {
            kind: "finance",
            ref: {
              type: "payment",
              id: project.id,
              label: "Largest single payment/expense",
            },
            value: singlePct,
            unit: "% of total budget",
            asOf: today.toISOString(),
          },
        ],
        calc: {
          formulaKey: "calc.budget.largeTransaction",
          steps: [
            `Single transaction represents ${singlePct}% of total project budget (> 25%)`,
            `Informational flag: 0 pts`,
          ],
        },
        basis: "RECORDED",
      });
    }
  }

  // -------------------------------------------------------------------------
  // BG6: Unverified expense backlog
  // -------------------------------------------------------------------------
  if (fin.unverifiedExpensesCount > 0 && fin.oldestUnverifiedExpenseDays >= THRESHOLDS.budget.bg6.lowDays) {
    let severity: "LOW" | "MODERATE" = "LOW";
    if (
      fin.unverifiedExpensesCount >= THRESHOLDS.budget.bg6.moderateCount ||
      fin.oldestUnverifiedExpenseDays >= THRESHOLDS.budget.bg6.moderateDays
    ) {
      severity = "MODERATE";
    }

    indicators.push({
      code: "BG6",
      category: "BUDGET",
      severity,
      points: RISK_SEVERITY_POINTS[severity],
      fingerprint: "BG6:-",
      titleKey: "risk.indicator.BG6.title",
      explainKey: "risk.indicator.BG6.explain",
      inputs: {
        unverifiedExpensesCount: fin.unverifiedExpensesCount,
        oldestUnverifiedExpenseDays: fin.oldestUnverifiedExpenseDays,
      },
      evidence: [
        {
          kind: "expense",
          ref: {
            type: "expenses",
            id: project.id,
            label: `${fin.unverifiedExpensesCount} expenses awaiting verification`,
          },
          value: fin.oldestUnverifiedExpenseDays,
          unit: "days oldest unverified",
          asOf: today.toISOString(),
        },
      ],
      calc: {
        formulaKey: "calc.budget.unverifiedExpenses",
        steps: [
          `${fin.unverifiedExpensesCount} expense(s) pending verification for >= 30 days (oldest: ${fin.oldestUnverifiedExpenseDays} days)`,
          `Severity assigned: ${severity} (${RISK_SEVERITY_POINTS[severity]} pts)`,
        ],
      },
      basis: "RECORDED",
    });
  }

  return indicators;
}
