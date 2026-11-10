import { describe, expect, it } from "vitest";
import {
  BLAME_FRAUD_DENYLIST,
  buildDeidentifiedNarrativeInput,
  containsProhibitedTerminology,
  verifyNarrativeContent,
} from "../src/modules/risk/risk-narrative.service.js";

describe("Risk AI Narrative & Verification (§4.9, Step 122)", () => {
  it("denylist correctly flags accusatory, blame-allocating and fraud terminology", () => {
    expect(containsProhibitedTerminology("The contractor committed fraud on the invoice")).toBe(true);
    expect(containsProhibitedTerminology("Officers engaged in bribery and corruption")).toBe(true);
    expect(containsProhibitedTerminology("The PM is guilty of misconduct")).toBe(true);
    expect(containsProhibitedTerminology("Possible kickback identified")).toBe(true);

    // Clean neutral statements pass
    expect(
      containsProhibitedTerminology(
        "Milestone M1 is 45 days overdue. Financial progress of 60% exceeds physical progress of 20%.",
      ),
    ).toBe(false);
  });

  it("builds minimised, de-identified payload from assessment", () => {
    const mockAssessment = {
      overallLevel: "HIGH",
      overallIndex: 65,
      categories: [
        {
          category: "DELAY",
          level: "HIGH",
          index: 45,
          sufficiency: "SUFFICIENT",
          missing: [],
        },
      ],
      indicators: [
        {
          code: "DL1",
          category: "DELAY",
          severity: "HIGH",
          points: 25,
          basis: "VERIFIED",
          evidence: [{ kind: "milestone", value: 45, unit: "days", asOf: "2026-11-01" }],
        },
      ],
    };

    const payload = buildDeidentifiedNarrativeInput("INF-RDA-001", mockAssessment);
    expect(payload.projectCode).toBe("INF-RDA-001");
    expect(payload.overallLevel).toBe("HIGH");
    expect(payload.overallIndex).toBe(65);
    expect(payload.categories.length).toBe(1);
    expect(payload.indicators[0].code).toBe("DL1");
    expect(payload.indicators[0].evidence[0].value).toBe(45);
  });

  it("verifies grounded figures and rejects hallucinated numbers or dates", () => {
    const allowedPayload = {
      projectCode: "INF-RDA-001",
      overallLevel: "HIGH",
      overallIndex: 65,
      indicators: [
        {
          code: "DL1",
          severity: "HIGH",
          evidence: [
            { kind: "milestone", value: "45 days" },
            { kind: "progress", value: "25%" },
          ],
        },
      ],
    };

    // Grounded text passes
    const goodText =
      "Project INF-RDA-001 is evaluated at HIGH risk. A milestone is delayed by 45 days, with 25% recorded progress.";
    const resultGood = verifyNarrativeContent(goodText, allowedPayload);
    expect(resultGood.verified).toBe(true);

    // Ungrounded figure (e.g. 99% or LKR 50,000,000) fails
    const badText =
      "Project INF-RDA-001 is delayed by 45 days and spending reached LKR 999,000,000 with 99% progress.";
    const resultBad = verifyNarrativeContent(badText, allowedPayload);
    expect(resultBad.verified).toBe(false);
    expect(resultBad.reason).toMatch(/is not grounded in assessment evidence/);
  });

  it("rejects narrative containing blame/fraud terminology during verification", () => {
    const allowedPayload = {
      projectCode: "INF-RDA-001",
      indicators: [],
    };

    const corruptText =
      "The project is delayed due to corrupt contractor practices and embezzlement.";
    const res = verifyNarrativeContent(corruptText, allowedPayload);
    expect(res.verified).toBe(false);
    expect(res.reason).toMatch(/Contains prohibited blame, fraud, or accusatory terminology/);
  });
});
