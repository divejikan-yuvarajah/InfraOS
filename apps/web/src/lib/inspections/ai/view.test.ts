import { describe, expect, it } from "vitest";

import { normalizeAnalysis } from "./api";
import { getInspectionAiCopy } from "./messages";
import { reviewProgressOf, reviewableItemsOf, visionPollIntervalMs } from "./view";

describe("inspection AI view helpers", () => {
  const copy = getInspectionAiCopy("en");

  it("normalizes Mongoose _id and computes review progress with CONFIRMED filter", () => {
    const normalized = normalizeAnalysis({
      _id: "64b7f1c2a3d4e5f60718293a",
      analysisNo: "AIV-2026-000001",
      inspectionId: "64b7f1c2a3d4e5f60718293b",
      projectId: "64b7f1c2a3d4e5f60718293c",
      agencyId: "64b7f1c2a3d4e5f60718293d",
      requestedBy: "64b7f1c2a3d4e5f60718293e",
      requestedByRole: "INSPECTOR",
      evidence: [],
      contextHash: "a".repeat(64),
      status: "READY",
      result: {
        images: [
          {
            n: 1,
            activityDescription: "Sub-base compaction visible along station 1+200",
            visibleWorkIndicators: [{ label: "Compacted aggregate", certainty: "CLEAR" }],
            qualityIssues: [],
          },
        ],
        overall: {
          consistencyWithReportedStage: "PARTIALLY_CONSISTENT",
          rationale: "Earthworks activity visible; surfacing not shown.",
        },
        potentialDiscrepancies: [
          { statement: "Drainage trench unlined", imageNs: [1], severity: "LOW" },
        ],
        cannotBeDetermined: ["Layer thickness"],
        questionsForInspector: ["Check density test logs"],
      },
      qualityChecks: {
        checks: [],
        coverage: { totalPhotos: 1, milestonesWithEvidence: 1, totalMilestones: 1, uncoveredMilestones: [] },
        metadataNote: "Metadata note",
      },
      inspectorReview: {
        status: "PENDING",
        decisions: {
          overall: { decision: "CONFIRMED" },
          "img:1": { decision: "DISPUTED", comment: "Different chainage" },
        },
      },
    });

    expect(normalized.id).toBe("64b7f1c2a3d4e5f60718293a");
    expect(reviewableItemsOf(normalized.result, copy).map((i) => i.key)).toEqual(["overall", "img:1", "disc:0"]);

    const prog = reviewProgressOf(normalized, {}, copy);
    expect(prog.reviewedCount).toBe(2);
    expect(prog.totalCount).toBe(3);
    expect(prog.confirmedKeys).toEqual(["overall"]);
  });

  it("stops vision polling on terminal statuses or hidden tabs", () => {
    expect(visionPollIntervalMs("RUNNING", true)).toBe(1000);
    expect(visionPollIntervalMs("RUNNING", false)).toBe(false);
    expect(visionPollIntervalMs("READY", true)).toBe(false);
    expect(visionPollIntervalMs("FAILED", true)).toBe(false);
  });
});

