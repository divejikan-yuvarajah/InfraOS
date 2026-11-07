import { describe, expect, it } from "vitest";

import { evaluate, outstandingQualityFindings, reworkFrequency, riskFlags, RULE_VERSION, unverifiedClaims, type AssignmentEv, type Evidence, type InspectionEv } from "../src/modules/contractors/contractor-performance.rules.js";
import { inspectionHold } from "../src/modules/finance/payment.gates.js";

const d = (s: string) => new Date(s);
const empty = (patch: Partial<Evidence> = {}): Evidence => ({ contractorStatus: "ACTIVE", assignments: [], milestones: [], inspections: [], verifications: [], claims: [], certifications: [], profileGaps: [], ...patch });
const ins = (id: string, status: string, date: string, defects: InspectionEv["defects"] = []): InspectionEv => ({ id, projectId: "p", status, inspectionDate: d(date), structured: true, defects });
const asg: AssignmentEv = { id: "a", projectId: "p", role: "PRIMARY", status: "ACTIVE", startDate: d("2026-01-01"), hasContractValue: true, contractReference: "C-1", projectCode: "INF-ROAD-1", projectTitle: "Road", projectStatus: "ACTIVE", plannedEndDate: d("2027-01-01") };
const NOW = d("2026-06-01");

describe("contractor rules c2 (Batch 06)", () => {
  it("rule version is c2", () => { expect(RULE_VERSION).toBe("c2"); expect(evaluate(empty(), NOW).ruleVersion).toBe("c2"); });

  it("rework frequency needs 3 concluded structured inspections and is never zero by default", () => {
    const two = reworkFrequency(empty({ inspections: [ins("1", "VERIFIED", "2026-02-01", [{ key: "d", severity: "MAJOR", reworkRequired: true }]), ins("2", "VERIFIED", "2026-03-01")] }));
    expect(two.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(two.value).toBeNull();
    const three = reworkFrequency(empty({ inspections: [ins("1", "VERIFIED", "2026-02-01", [{ key: "d", severity: "MAJOR", reworkRequired: true }]), ins("2", "VERIFIED", "2026-03-01"), ins("3", "REJECTED", "2026-04-01")] }));
    expect(three).toMatchObject({ status: "OK", value: 33.3, inputs: { withRework: 1, concluded: 3 } });
    expect(reworkFrequency(empty({ inspections: [{ id: "x", projectId: "p", status: "VERIFIED", inspectionDate: d("2026-02-01") }] })).sampleSize).toBe(0); // legacy rows are not structured evidence
  });

  it("outstanding quality findings count MAJOR and CRITICAL defects in the latest approved inspection per project", () => {
    const q = outstandingQualityFindings(empty({ inspections: [
      ins("old", "VERIFIED", "2026-01-01", [{ key: "a", severity: "CRITICAL", reworkRequired: true }]),
      ins("new", "VERIFIED", "2026-03-01", [{ key: "b", severity: "MAJOR", reworkRequired: false }, { key: "c", severity: "MINOR", reworkRequired: false }]),
    ] }));
    expect(q).toMatchObject({ status: "OK", value: 1, inputs: { major: 1, critical: 0, projects: 1 } });
    expect(outstandingQualityFindings(empty()).status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("unverified claims use approved verifications, and exactly 10 points is not more than 10", () => {
    const claim = { id: "c", projectId: "p", claimed: 55, at: d("2026-05-01") };
    const over = unverifiedClaims(empty({ assignments: [asg], claims: [claim], verifications: [{ id: "v", projectId: "p", verified: 40, claimed: 55, asOf: d("2026-05-02") }] }));
    expect(over.value).toBe(1);
    const edge = unverifiedClaims(empty({ assignments: [asg], claims: [claim], verifications: [{ id: "v", projectId: "p", verified: 45, claimed: 55, asOf: d("2026-05-02") }] }));
    expect(edge.value).toBe(0);
    expect(unverifiedClaims(empty({ assignments: [asg], claims: [claim] })).status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("raises UNRESOLVED_QUALITY, EXCESSIVE_REWORK and UNVERIFIED_CLAIMS from real evidence", () => {
    const rw = [{ key: "d", severity: "MAJOR", reworkRequired: true }];
    const flags = riskFlags(empty({
      assignments: [asg], claims: [{ id: "c", projectId: "p", claimed: 70, at: d("2026-05-01") }], verifications: [{ id: "v", projectId: "p", verified: 40, claimed: 70, asOf: d("2026-05-02") }],
      inspections: [ins("1", "VERIFIED", "2026-02-01", rw), ins("2", "VERIFIED", "2026-03-01", rw), ins("3", "VERIFIED", "2026-04-01", rw)],
    }), NOW).map((f) => f.code);
    expect(flags).toEqual(expect.arrayContaining(["UNRESOLVED_QUALITY", "EXCESSIVE_REWORK", "UNVERIFIED_CLAIMS"]));
    expect(riskFlags(empty(), NOW).map((f) => f.code)).not.toContain("EXCESSIVE_REWORK");
  });
});

describe("INSPECTION_HOLD payment gate", () => {
  const base = { paymentType: "INTERIM", amountMinor: 1, projectStatus: "ACTIVE", contractor: { status: "ACTIVE" }, hasAssignment: true, budgetMinor: 100, paidMinor: 0, approvedUnpaidMinor: 0, alreadyCountedMinor: 0, contractValueMinor: null, assignmentCumulativeMinor: 0, duplicateInvoice: false, progress: { valueBp: null, basis: "NONE" as const }, actorIsRequester: null };
  it("is skipped without information, warns on rejection or open critical defects, and passes otherwise", () => {
    expect(inspectionHold(base).status).toBe("SKIPPED");
    expect(inspectionHold({ ...base, inspectionHold: { rejected: true, openCritical: false } }).status).toBe("WARN");
    expect(inspectionHold({ ...base, inspectionHold: { rejected: false, openCritical: true } }).status).toBe("WARN");
    expect(inspectionHold({ ...base, inspectionHold: { rejected: false, openCritical: false } }).status).toBe("PASS");
  });
});
