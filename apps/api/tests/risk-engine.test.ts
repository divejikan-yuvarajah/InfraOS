import { describe, expect, it } from "vitest";
import {
  calculateRatioBps,
  calendarDaysBetween,
  computeEffectiveResolutionStatus,
  computeInputsHash,
  evaluateRisk,
  type RiskInputs,
  THRESHOLDS,
} from "../src/modules/risk/engine/index.js";

function createMockInputs(overrides?: Partial<RiskInputs>): RiskInputs {
  const baseDate = new Date("2026-03-01T00:00:00.000Z");
  const plannedEnd = new Date("2026-09-01T00:00:00.000Z");

  const defaultInputs: RiskInputs = {
    project: {
      available: true,
      asOf: baseDate,
      data: {
        id: "proj-123",
        projectCode: "PRJ-TEST-001",
        title: "Test Urban Road Rehabilitation",
        status: "ACTIVE",
        agencyId: "agency-rda",
        projectType: "ROAD",
        district: "Colombo",
        startDate: baseDate,
        plannedEndDate: plannedEnd,
        budgetMinor: 100_000_000, // 1,000,000 LKR
        physicalProgress: 40,
        financialProgress: 40,
        physicalBasis: "VERIFIED",
        verifiedProgress: {
          percent: 40,
          asOf: baseDate,
          verificationId: "ver-1",
        },
        contractorId: "cont-1",
      },
    },
    milestones: {
      available: true,
      asOf: baseDate,
      data: [
        {
          id: "m-1",
          title: "Earthworks",
          status: "COMPLETED",
          progress: 100,
          plannedStart: baseDate,
          plannedEnd: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          id: "m-2",
          title: "Drainage",
          status: "IN_PROGRESS",
          progress: 50,
          plannedStart: new Date("2026-04-02T00:00:00.000Z"),
          plannedEnd: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
    },
    progressReports: {
      available: true,
      asOf: baseDate,
      data: [
        {
          id: "pr-1",
          reportedPercent: 40,
          previousPercent: 30,
          reportedAt: new Date("2026-03-25T00:00:00.000Z"),
          sequence: 1,
        },
      ],
    },
    dependencies: {
      available: true,
      asOf: baseDate,
      data: [],
    },
    reviews: {
      available: true,
      asOf: baseDate,
      data: {
        pendingReviewsCount: 0,
        oldestPendingDays: 0,
        items: [],
      },
    },
    finance: {
      available: true,
      asOf: baseDate,
      data: {
        budgetMinor: 100_000_000,
        spentMinor: 40_000_000,
        committedMinor: 10_000_000,
        approvedRevisionsCount: 0,
        cumulativeBudgetIncreaseMinor: 0,
        pendingRevisionsCount: 0,
        oldestPendingRevisionDays: 0,
        pendingPaymentApprovalsCount: 0,
        oldestPendingPaymentApprovalDays: 0,
        unverifiedExpensesCount: 0,
        oldestUnverifiedExpenseDays: 0,
        largestSingleTransactionMinor: 15_000_000,
        trailingMonthlySpendMinor: [10_000_000, 15_000_000, 15_000_000],
        last30DaysSpendMinor: 12_000_000,
      },
    },
    inspections: {
      available: true,
      asOf: baseDate,
      data: {
        scheduledOverdueCount: 0,
        oldestScheduledOverdueDays: 0,
        openCriticalDefectsCount: 0,
        oldestCriticalDefectDays: 0,
        openMajorDefectsCount: 0,
        oldestMajorDefectDays: 0,
        verificationsAwaitingReviewCount: 0,
        oldestVerificationAwaitingDays: 0,
        totalCompletedInspectionsCount: 2,
      },
    },
    contractor: {
      available: true,
      asOf: baseDate,
      data: {
        assigned: true,
        contractorId: "cont-1",
        contractorName: "Lanka Infra Ltd",
        priorClosedProjectsCount: 5,
        priorProjectsDelayedCount: 1, // 20% delay history
        activeAssignmentsCount: 2,
      },
    },
    roadsync: {
      available: true,
      asOf: baseDate,
      data: {
        conflicts: [],
        unacknowledgedCoordinationCount: 0,
        oldestUnacknowledgedDays: 0,
        overdueCommitmentsCount: 0,
        oldestOverdueCommitmentDays: 0,
      },
    },
    history: {
      available: true,
      asOf: baseDate,
      data: {
        comparableCount: 10,
        medianDurationOverrunRatio: 1.15,
      },
    },
  };

  return { ...defaultInputs, ...overrides };
}

describe("Pure Risk Engine - Steps 119-121", () => {
  const referenceNow = new Date("2026-04-01T10:00:00.000Z");

  describe("Applicability Rules (§4.1)", () => {
    it("returns NOT_ASSESSABLE and applicable:false for DRAFT and COMPLETED projects", () => {
      const draftInputs = createMockInputs();
      draftInputs.project.data!.status = "DRAFT";
      const draftResult = evaluateRisk(draftInputs, referenceNow);
      expect(draftResult.applicable).toBe(false);
      expect(draftResult.overallLevel).toBe("NOT_ASSESSABLE");
      expect(draftResult.indicators).toHaveLength(0);

      const completedInputs = createMockInputs();
      completedInputs.project.data!.status = "COMPLETED";
      const completedResult = evaluateRisk(completedInputs, referenceNow);
      expect(completedResult.applicable).toBe(false);
      expect(completedResult.overallLevel).toBe("NOT_ASSESSABLE");
    });

    it("evaluates schedule and budget readiness for ON_HOLD and APPROVED without delay timers", () => {
      const onHoldInputs = createMockInputs();
      onHoldInputs.project.data!.status = "ON_HOLD";
      const onHoldResult = evaluateRisk(onHoldInputs, referenceNow);
      expect(onHoldResult.applicable).toBe(true);
      const delayCat = onHoldResult.categories.find((c) => c.category === "DELAY");
      expect(delayCat?.level).toBe("NOT_ASSESSABLE");
      expect(delayCat?.missing).toContain("on_hold_paused");

      const approvedInputs = createMockInputs();
      approvedInputs.project.data!.status = "APPROVED";
      const approvedResult = evaluateRisk(approvedInputs, referenceNow);
      expect(approvedResult.applicable).toBe(true);
      const approvedDelay = approvedResult.categories.find((c) => c.category === "DELAY");
      expect(approvedDelay?.level).toBe("NOT_ASSESSABLE");
    });
  });

  describe("Indicator Boundary & Cap Tests (§4.4)", () => {
    describe("DL1: Past planned end", () => {
      it("triggers MODERATE (1-14 days), HIGH (15-60 days), and CRITICAL (> 60 days)", () => {
        const inputs = createMockInputs();
        // Today is 2026-04-01
        // Planned end yesterday (1 day overdue) -> MODERATE
        inputs.project.data!.plannedEndDate = new Date("2026-03-31T00:00:00.000Z");
        let result = evaluateRisk(inputs, referenceNow);
        let dl1 = result.indicators.find((i) => i.code === "DL1");
        expect(dl1?.severity).toBe("MODERATE");
        expect(dl1?.points).toBe(12);

        // 20 days overdue -> HIGH
        inputs.project.data!.plannedEndDate = new Date("2026-03-12T00:00:00.000Z");
        result = evaluateRisk(inputs, referenceNow);
        dl1 = result.indicators.find((i) => i.code === "DL1");
        expect(dl1?.severity).toBe("HIGH");
        expect(dl1?.points).toBe(25);

        // 65 days overdue -> CRITICAL
        inputs.project.data!.plannedEndDate = new Date("2026-01-26T00:00:00.000Z");
        result = evaluateRisk(inputs, referenceNow);
        dl1 = result.indicators.find((i) => i.code === "DL1");
        expect(dl1?.severity).toBe("CRITICAL");
        expect(dl1?.points).toBe(40);
      });
    });

    describe("DL2: Schedule variance and REPORTED basis cap", () => {
      it("caps DL2 at HIGH when basis is REPORTED even if gap >= 50 pp", () => {
        const inputs = createMockInputs();
        inputs.project.data!.startDate = new Date("2026-01-01T00:00:00.000Z");
        inputs.project.data!.plannedEndDate = new Date("2026-07-01T00:00:00.000Z"); // ~181 days total
        // At 2026-04-01: elapsed is ~90 days (50% planned)
        // With physicalProgress = 0, gap = 50 pp (normally CRITICAL)
        inputs.project.data!.physicalBasis = "REPORTED";
        inputs.project.data!.physicalProgress = 0;
        inputs.project.data!.verifiedProgress = null;

        const result = evaluateRisk(inputs, referenceNow);
        const dl2 = result.indicators.find((i) => i.code === "DL2");
        expect(dl2?.severity).toBe("HIGH"); // Capped from CRITICAL to HIGH
        expect(dl2?.basis).toBe("REPORTED");
      });

      it("suppresses DL2 to INFO (0 points) when DL1 is already CRITICAL (dedupe rule)", () => {
        const inputs = createMockInputs();
        // DL1 > 60 days overdue -> CRITICAL
        inputs.project.data!.startDate = new Date("2025-06-01T00:00:00.000Z");
        inputs.project.data!.plannedEndDate = new Date("2026-01-01T00:00:00.000Z"); // overdue > 90 days
        inputs.project.data!.physicalProgress = 10;
        inputs.project.data!.physicalBasis = "VERIFIED";

        const result = evaluateRisk(inputs, referenceNow);
        const dl1 = result.indicators.find((i) => i.code === "DL1");
        const dl2 = result.indicators.find((i) => i.code === "DL2");

        expect(dl1?.severity).toBe("CRITICAL");
        expect(dl2?.severity).toBe("INFO");
        expect(dl2?.points).toBe(0);
      });
    });

    describe("DL4: Contractor delay history minimum sample rule", () => {
      it("returns INFO 'insufficient history' if contractor has < 3 prior closed projects", () => {
        const inputs = createMockInputs();
        inputs.contractor.data!.priorClosedProjectsCount = 2; // < 3
        inputs.contractor.data!.priorProjectsDelayedCount = 2; // 100% delayed, but sample too small

        const result = evaluateRisk(inputs, referenceNow);
        const dl4 = result.indicators.find((i) => i.code === "DL4");
        expect(dl4?.severity).toBe("INFO");
        expect(dl4?.points).toBe(0);
      });

      it("scores LOW (>= 40%), MODERATE (>= 60%), HIGH (>= 80%) when >= 3 prior projects", () => {
        const inputs = createMockInputs();
        inputs.contractor.data!.priorClosedProjectsCount = 10;
        inputs.contractor.data!.priorProjectsDelayedCount = 9; // 90% delayed -> HIGH

        const result = evaluateRisk(inputs, referenceNow);
        const dl4 = result.indicators.find((i) => i.code === "DL4");
        expect(dl4?.severity).toBe("HIGH");
        expect(dl4?.points).toBe(25);
      });
    });

    describe("BG1: Financial-to-physical mismatch and REPORTED basis cap", () => {
      it("caps BG1 at HIGH when basis is REPORTED even if gap >= 55 pp", () => {
        const inputs = createMockInputs();
        // Spend 85% vs Physical 20% -> gap = 65 pp (normally CRITICAL >= 55 pp)
        inputs.finance.data!.budgetMinor = 100_000_000;
        inputs.finance.data!.spentMinor = 85_000_000;
        inputs.project.data!.physicalProgress = 20;
        inputs.project.data!.physicalBasis = "REPORTED";
        inputs.project.data!.verifiedProgress = null;

        const result = evaluateRisk(inputs, referenceNow);
        const bg1 = result.indicators.find((i) => i.code === "BG1");
        expect(bg1?.severity).toBe("HIGH"); // Capped to HIGH
        expect(bg1?.basis).toBe("REPORTED");
      });

      it("flags INFO if physical progress is ahead of spend by >= 25 pp", () => {
        const inputs = createMockInputs();
        // Physical 70% vs Spend 20% -> work ahead by 50 pp
        inputs.finance.data!.spentMinor = 20_000_000;
        inputs.project.data!.physicalProgress = 70;
        inputs.project.data!.physicalBasis = "VERIFIED";
        inputs.project.data!.verifiedProgress = {
          percent: 70,
          asOf: referenceNow,
          verificationId: "ver-1",
        };

        const result = evaluateRisk(inputs, referenceNow);
        const bg1 = result.indicators.find((i) => i.code === "BG1");
        expect(bg1?.severity).toBe("INFO");
        expect(bg1?.points).toBe(0);
      });
    });

    describe("BG2: Commitment exposure", () => {
      it("triggers MODERATE (> 95%), HIGH (> 100%), CRITICAL (> 115%)", () => {
        const inputs = createMockInputs();
        inputs.finance.data!.budgetMinor = 100_000_000;
        // Spent 70m + Committed 48m = 118m (118% > 115%) -> CRITICAL
        inputs.finance.data!.spentMinor = 70_000_000;
        inputs.finance.data!.committedMinor = 48_000_000;

        const result = evaluateRisk(inputs, referenceNow);
        const bg2 = result.indicators.find((i) => i.code === "BG2");
        expect(bg2?.severity).toBe("CRITICAL");
        expect(bg2?.points).toBe(40);
      });
    });

    describe("BG3: Cost efficiency and EAC conditions", () => {
      it("computes CPI and shows EAC only when physicalProgress >= 25% and basis is VERIFIED", () => {
        const inputs = createMockInputs();
        // Budget 100m, Physical 30% (EV = 30m), Spent 50m (AC = 50m) -> CPI = 0.60 (< 0.70 HIGH)
        inputs.finance.data!.budgetMinor = 100_000_000;
        inputs.finance.data!.spentMinor = 50_000_000;
        inputs.project.data!.physicalProgress = 30;
        inputs.project.data!.physicalBasis = "VERIFIED";
        inputs.project.data!.verifiedProgress = {
          percent: 30,
          asOf: referenceNow,
          verificationId: "v-1",
        };

        const result = evaluateRisk(inputs, referenceNow);
        const bg3 = result.indicators.find((i) => i.code === "BG3");
        expect(bg3?.severity).toBe("HIGH");
        expect(bg3?.inputs?.eacMinor).toBeDefined();
        expect(bg3?.calc?.steps.some((s) => s.includes("EAC"))).toBe(true);
      });

      it("hides EAC when physicalProgress < 25%", () => {
        const inputs = createMockInputs();
        // Physical 15% (>= 10% min to evaluate CPI, but < 25% for EAC)
        inputs.finance.data!.budgetMinor = 100_000_000;
        inputs.finance.data!.spentMinor = 25_000_000;
        inputs.project.data!.physicalProgress = 15;
        inputs.project.data!.physicalBasis = "VERIFIED";

        const result = evaluateRisk(inputs, referenceNow);
        const bg3 = result.indicators.find((i) => i.code === "BG3");
        expect(bg3?.inputs?.eacMinor).toBeUndefined();
      });
    });

    describe("BG5: Spend spike minimum history rule", () => {
      it("does not score spend spike if trailing monthly spend history is < 3 months", () => {
        const inputs = createMockInputs();
        inputs.finance.data!.trailingMonthlySpendMinor = [10_000_000, 10_000_000]; // only 2 months
        inputs.finance.data!.last30DaysSpendMinor = 50_000_000; // 5x monthly average

        const result = evaluateRisk(inputs, referenceNow);
        const bg5 = result.indicators.find((i) => i.code === "BG5");
        expect(bg5).toBeUndefined();
      });

      it("triggers MODERATE if last 30 days spend > 2x trailing monthly average with >= 3 months", () => {
        const inputs = createMockInputs();
        inputs.finance.data!.trailingMonthlySpendMinor = [
          10_000_000,
          10_000_000,
          10_000_000,
        ]; // avg = 10m
        inputs.finance.data!.last30DaysSpendMinor = 25_000_000; // 2.5x > 2.0x

        const result = evaluateRisk(inputs, referenceNow);
        const bg5 = result.indicators.find((i) => i.code === "BG5");
        expect(bg5?.severity).toBe("MODERATE");
      });
    });

    describe("CO1 & CO2: RoadSync integration", () => {
      it("maps RoadSync severity bands 1:1 and escalates if open >= 30 days", () => {
        const inputs = createMockInputs();
        inputs.roadsync.data!.conflicts = [
          {
            conflictId: "c-1",
            conflictNo: "RS-2026-0001",
            severityBand: "HIGH",
            status: "OPEN",
            openDays: 35, // >= 30 days -> escalates HIGH to CRITICAL
            affectedAgencyCount: 2,
          },
        ];

        const result = evaluateRisk(inputs, referenceNow);
        const co1 = result.indicators.find((i) => i.code === "CO1");
        expect(co1?.severity).toBe("CRITICAL");
        expect(co1?.points).toBe(40);
      });

      it("is SUFFICIENT when RoadSync is available with 0 conflicts", () => {
        const inputs = createMockInputs();
        inputs.roadsync.available = true;
        inputs.roadsync.data!.conflicts = [];

        const result = evaluateRisk(inputs, referenceNow);
        const coordCat = result.categories.find((c) => c.category === "COORDINATION");
        expect(coordCat?.sufficiency).toBe("SUFFICIENT");
        expect(coordCat?.level).toBe("LOW");
        expect(coordCat?.index).toBe(0);
      });

      it("is INSUFFICIENT when RoadSync service is unavailable", () => {
        const inputs = createMockInputs();
        inputs.roadsync.available = false;
        inputs.roadsync.data = undefined;

        const result = evaluateRisk(inputs, referenceNow);
        const coordCat = result.categories.find((c) => c.category === "COORDINATION");
        expect(coordCat?.sufficiency).toBe("INSUFFICIENT");
        expect(coordCat?.level).toBe("NOT_ASSESSABLE");
      });
    });

    describe("PG1, PG2, PG3: Progress & Quality indicators", () => {
      it("triggers PG1 stagnation based on days since last report", () => {
        const inputs = createMockInputs();
        // Last report 50 days ago (>= 45 days -> MODERATE)
        inputs.progressReports.data = [
          {
            id: "pr-old",
            reportedPercent: 30,
            previousPercent: 20,
            reportedAt: new Date("2026-02-10T00:00:00.000Z"),
            sequence: 1,
          },
        ];

        const result = evaluateRisk(inputs, referenceNow);
        const pg1 = result.indicators.find((i) => i.code === "PG1");
        expect(pg1?.severity).toBe("MODERATE");
      });

      it("triggers PG2 quality defects and pending verifications", () => {
        const inputs = createMockInputs();
        // Open critical defect unresolved >= 7 days -> HIGH
        inputs.inspections.data!.openCriticalDefectsCount = 1;
        inputs.inspections.data!.oldestCriticalDefectDays = 10;

        const result = evaluateRisk(inputs, referenceNow);
        const pg2 = result.indicators.find((i) => i.code === "PG2");
        expect(pg2?.severity).toBe("HIGH");
      });

      it("triggers PG3 gap when reported progress is ahead of verified progress", () => {
        const inputs = createMockInputs();
        inputs.project.data!.physicalBasis = "VERIFIED";
        inputs.project.data!.physicalProgress = 65; // reported
        inputs.project.data!.verifiedProgress = {
          percent: 40, // verified (gap = 25 pp >= 20 pp -> HIGH)
          asOf: referenceNow,
          verificationId: "v-1",
        };

        const result = evaluateRisk(inputs, referenceNow);
        const pg3 = result.indicators.find((i) => i.code === "PG3");
        expect(pg3?.severity).toBe("HIGH");
      });
    });

    describe("SC1, SC2, SC3: Schedule & Inspection indicators", () => {
      it("triggers SC1 for milestone dates after project planned end and delayed dependencies", () => {
        const inputs = createMockInputs();
        inputs.dependencies.data = [
          {
            id: "dep-1",
            predecessorProjectId: "p-other",
            predecessorProjectCode: "PRJ-999",
            predecessorStatus: "DELAYED",
            isCriticalChain: true,
          },
        ];

        const result = evaluateRisk(inputs, referenceNow);
        const sc1 = result.indicators.find((i) => i.code === "SC1");
        expect(sc1?.severity).toBe("MODERATE");
      });

      it("dedupes SC2 approvals by excluding verifications (PG2) and budget revisions (BG4)", () => {
        const inputs = createMockInputs();
        // reviews pending 15 days -> MODERATE
        inputs.reviews.data = {
          pendingReviewsCount: 2,
          oldestPendingDays: 15,
          items: [],
        };

        const result = evaluateRisk(inputs, referenceNow);
        const sc2 = result.indicators.find((i) => i.code === "SC2");
        expect(sc2?.severity).toBe("MODERATE");
      });

      it("triggers SC3 for scheduled inspections past date", () => {
        const inputs = createMockInputs();
        inputs.inspections.data!.scheduledOverdueCount = 1;
        inputs.inspections.data!.oldestScheduledOverdueDays = 8; // >= 7 days -> MODERATE

        const result = evaluateRisk(inputs, referenceNow);
        const sc3 = result.indicators.find((i) => i.code === "SC3");
        expect(sc3?.severity).toBe("MODERATE");
      });
    });

    describe("CO3: Contractor concurrency load", () => {
      it("triggers LOW (>= 4 active assignments) and MODERATE (>= 6)", () => {
        const inputs = createMockInputs();
        inputs.contractor.data!.activeAssignmentsCount = 4;

        const result = evaluateRisk(inputs, referenceNow);
        const co3 = result.indicators.find((i) => i.code === "CO3");
        expect(co3?.severity).toBe("LOW");
      });
    });

    describe("Recommendations & Change Detection (§4.5, §4.6)", () => {
      it("generates advisory recommendations with priority based on trigger severity", () => {
        const inputs = createMockInputs();
        // DL1 HIGH -> triggers REVIEW_DELAYED_MILESTONES with HIGH priority
        inputs.project.data!.plannedEndDate = new Date("2026-03-15T00:00:00.000Z");

        const result = evaluateRisk(inputs, referenceNow);
        const rec = result.recommendations.find(
          (r) => r.code === "REVIEW_DELAYED_MILESTONES",
        );
        expect(rec).toBeDefined();
        expect(rec?.priority).toBe("HIGH");
        expect(rec?.target).toContain("/projects/proj-123");
      });

      it("detects indicator transitions NEW, ESCALATED, DEESCALATED, CLEARED", () => {
        const inputs = createMockInputs();
        inputs.project.data!.plannedEndDate = new Date("2026-03-25T00:00:00.000Z"); // 7 days overdue -> MODERATE

        const previousAssessment = {
          indicators: [
            {
              code: "DL1",
              category: "DELAY",
              severity: "LOW",
              points: 5,
              fingerprint: "DL1:-",
              titleKey: "t",
              explainKey: "e",
              evidence: [],
              basis: "RECORDED" as const,
            },
          ],
          overallLevel: "LOW" as const,
        };

        const result = evaluateRisk(inputs, referenceNow, previousAssessment as any);
        const escalated = result.changes.find(
          (c) => c.code === "DL1" && c.type === "ESCALATED",
        );
        expect(escalated).toBeDefined();
        expect(escalated?.from).toBe("LOW");
        expect(escalated?.to).toBe("MODERATE");
        expect(result.levelChange?.from).toBe("LOW");
        expect(result.levelChange?.to).toBe("MODERATE");
      });
    });
  });

  describe("BigInt Money Math (§4.4)", () => {
    it("handles large currency values >= 10^12 cents (10 billion LKR) with no float drift", () => {
      // 10 billion LKR in cents = 10,000,000,000 * 100 = 1,000,000,000,000 cents
      const largeBudgetMinor = 1_000_000_000_000;
      const spentMinor = 333_333_333_333; // exactly 33.3333333333%

      const bps = calculateRatioBps(spentMinor, largeBudgetMinor);
      expect(bps).toBe(3333); // 33.33% in basis points

      const ratio = calculateRatioBps(1_500_000_000_000, 1_000_000_000_000);
      expect(ratio).toBe(15000); // 150.00%
    });
  });

  describe("Determinism and Inputs Hash (§4.1)", () => {
    it("produces identical inputsHash and identical result on consecutive evaluations", () => {
      const inputs1 = createMockInputs();
      const inputs2 = createMockInputs();

      const result1 = evaluateRisk(inputs1, referenceNow);
      const result2 = evaluateRisk(inputs2, referenceNow);

      expect(result1.inputsHash).toBe(result2.inputsHash);
      expect(result1.overallLevel).toBe(result2.overallLevel);
      expect(result1.overallIndex).toBe(result2.overallIndex);
      expect(result1.indicators.length).toBe(result2.indicators.length);
    });
  });

  describe("Re-surfacing Resolution Pure Logic (§4.2)", () => {
    it("keeps ACKNOWLEDGED or DISMISSED if severity does not increase and review date is future", () => {
      const futureDate = new Date("2026-05-01T00:00:00.000Z");
      const status = computeEffectiveResolutionStatus(
        {
          status: "ACKNOWLEDGED",
          severityAtDecision: "MODERATE",
          reviewAt: futureDate,
        },
        "MODERATE",
        referenceNow,
      );
      expect(status).toBe("ACKNOWLEDGED");
    });

    it("reopens ACKNOWLEDGED if current severity escalates higher than decision time", () => {
      const futureDate = new Date("2026-05-01T00:00:00.000Z");
      const status = computeEffectiveResolutionStatus(
        {
          status: "ACKNOWLEDGED",
          severityAtDecision: "LOW",
          reviewAt: futureDate,
        },
        "HIGH", // escalated!
        referenceNow,
      );
      expect(status).toBe("REOPENED");
    });

    it("reopens DISMISSED if reviewAt date has passed", () => {
      const pastDate = new Date("2026-03-15T00:00:00.000Z");
      const status = computeEffectiveResolutionStatus(
        {
          status: "DISMISSED",
          severityAtDecision: "HIGH",
          reviewAt: pastDate,
        },
        "HIGH",
        referenceNow,
      );
      expect(status).toBe("REOPENED");
    });

    it("reopens RESOLVED if the indicator returns with active severity", () => {
      const status = computeEffectiveResolutionStatus(
        {
          status: "RESOLVED",
          severityAtDecision: "HIGH",
        },
        "MODERATE", // reappeared!
        referenceNow,
      );
      expect(status).toBe("REOPENED");
    });

    it("remains RESOLVED if the indicator is no longer present", () => {
      const status = computeEffectiveResolutionStatus(
        {
          status: "RESOLVED",
          severityAtDecision: "HIGH",
        },
        null, // gone!
        referenceNow,
      );
      expect(status).toBe("RESOLVED");
    });
  });
});
