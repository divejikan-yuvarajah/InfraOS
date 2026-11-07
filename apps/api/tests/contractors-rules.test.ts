import { describe, expect, it } from "vitest";

import {
  completionReliability, contractDataCompleteness, currentDelayExposure, evaluate, evidenceLevel, inspectionOutcomeRate, milestoneTimeliness,
  reliabilityBand, riskFlags, scheduleAdherence, unverifiedClaims, RULE_VERSION, type AssignmentEv, type Evidence,
} from "../src/modules/contractors/contractor-performance.rules.js";

const now = new Date("2026-06-01T00:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let n = 0;
const asg = (patch: Partial<AssignmentEv> = {}): AssignmentEv => { n += 1; return { id: `a${n}`, projectId: `p${n}`, role: "PRIMARY", status: "ACTIVE", startDate: d("2025-01-01"), hasContractValue: true, contractReference: "C-1", projectCode: `INF-ROAD-${n}`, projectTitle: `Project ${n}`, projectStatus: "ACTIVE", plannedEndDate: d("2027-01-01"), ...patch }; };
const empty = (patch: Partial<Evidence> = {}): Evidence => ({ contractorStatus: "ACTIVE", assignments: [], milestones: [], inspections: [], claims: [], certifications: [], profileGaps: [], ...patch });
const completed = (onTime: boolean) => asg({ status: "ENDED", projectStatus: "COMPLETED", plannedEndDate: d("2025-06-01"), actualEndDate: d(onTime ? "2025-05-30" : "2025-07-01"), endDate: d("2025-07-01") });

describe("indicators: evidence sufficiency", () => {
  it("zero evidence is INSUFFICIENT_EVIDENCE with null value, never 0%", () => {
    const e = evaluate(empty(), now);
    for (const i of e.indicators) { expect(i.status).toBe("INSUFFICIENT_EVIDENCE"); expect(i.value).toBeNull(); }
    expect(e.evidenceLevel).toBe("NONE");
    expect(e.band).toBe("NOT_ENOUGH_EVIDENCE");
    expect(e.flags).toEqual([]);
    expect(e.ruleVersion).toBe(RULE_VERSION);
  });
  it("completion reliability: boundary at 3, REPLACED excluded", () => {
    const two = empty({ assignments: [completed(true), completed(true)] });
    expect(completionReliability(two).status).toBe("INSUFFICIENT_EVIDENCE");
    const three = empty({ assignments: [completed(true), completed(true), asg({ status: "TERMINATED", projectStatus: "CANCELLED", endDate: d("2025-09-01"), endReason: "x" } as never)] });
    const i = completionReliability(three);
    expect(i.status).toBe("OK"); expect(i.value).toBe(66.7); expect(i.sampleSize).toBe(3);
    const withReplaced = empty({ assignments: [...three.assignments, asg({ status: "REPLACED", projectStatus: "ACTIVE" })] });
    expect(completionReliability(withReplaced).sampleSize).toBe(3);
  });
  it("schedule adherence reports on-time share and average late days", () => {
    const i = scheduleAdherence(empty({ assignments: [completed(true), completed(true), completed(false)] }));
    expect(i.status).toBe("OK"); expect(i.value).toBe(66.7); expect(i.inputs).toMatchObject({ late: 1, averageLateDays: 30 });
  });
  it("current delay exposure counts DELAYED and past-planned-end active work only", () => {
    const e = empty({ assignments: [asg({ projectStatus: "DELAYED" }), asg({ plannedEndDate: d("2026-01-01") }), asg(), asg({ status: "ENDED", projectStatus: "COMPLETED", plannedEndDate: d("2020-01-01") })] });
    const i = currentDelayExposure(e, now);
    expect(i.value).toBe(2); expect(i.sampleSize).toBe(3); expect(i.evidence).toHaveLength(2);
    expect(currentDelayExposure(empty(), now).status).toBe("INSUFFICIENT_EVIDENCE");
  });
  it("milestone timeliness needs 5 completed milestones with an actual date", () => {
    const ms = (late: boolean, k: number) => ({ id: `m${k}`, projectId: "p", title: `M${k}`, status: "COMPLETED", plannedEnd: d("2026-01-10"), actualEnd: d(late ? "2026-01-20" : "2026-01-05") });
    expect(milestoneTimeliness(empty({ milestones: [1, 2, 3, 4].map((k) => ms(false, k)) })).status).toBe("INSUFFICIENT_EVIDENCE");
    const i = milestoneTimeliness(empty({ milestones: [ms(false, 1), ms(false, 2), ms(false, 3), ms(false, 4), ms(true, 5)] }));
    expect(i.status).toBe("OK"); expect(i.value).toBe(80);
  });
  it("inspection outcomes are labelled coarse and need 3 concluded", () => {
    const ins = (status: string, k: number) => ({ id: `i${k}`, projectId: "p", status, inspectionDate: d("2026-03-01") });
    expect(inspectionOutcomeRate(empty({ inspections: [ins("VERIFIED", 1), ins("SCHEDULED", 2), ins("REJECTED", 3)] })).status).toBe("INSUFFICIENT_EVIDENCE");
    const i = inspectionOutcomeRate(empty({ inspections: [ins("VERIFIED", 1), ins("VERIFIED", 2), ins("REJECTED", 3), ins("REQUIRES_REVIEW", 4)] }));
    expect(i.value).toBe(50); expect(i.inputs).toMatchObject({ coarse: true, source: "inspection.v2" });
  });
  it("unverified claims stay insufficient without verified inspection progress, and fire above 10 points", () => {
    const a = asg();
    const claim = { id: "r1", projectId: a.projectId, claimed: 80, at: d("2026-05-01") };
    expect(unverifiedClaims(empty({ assignments: [a], claims: [claim] })).status).toBe("INSUFFICIENT_EVIDENCE");
    const verified = (p: number) => ({ id: "v1", projectId: a.projectId, status: "VERIFIED", inspectionDate: d("2026-05-02"), physicalProgress: p });
    expect(unverifiedClaims(empty({ assignments: [a], claims: [claim], inspections: [verified(65)] })).value).toBe(1);
    expect(unverifiedClaims(empty({ assignments: [a], claims: [claim], inspections: [verified(70)] })).value).toBe(0); // exactly 10 is not "more than 10"
  });
  it("contract data completeness", () => {
    const i = contractDataCompleteness(empty({ assignments: [asg(), asg({ contractReference: null }), asg({ hasContractValue: false })], profileGaps: ["contact"] }));
    expect(i.value).toBe(33.3); expect(i.evidence).toHaveLength(2);
  });
});

describe("evidence level and reliability band", () => {
  const ok = (key: string, value: number) => ({ key, value, unit: "percent" as const, sampleSize: 9, minSample: 3, status: "OK" as const, formulaKey: "x", inputs: {}, evidence: [] });
  it("evidence level counts sufficient indicators", () => {
    expect(evidenceLevel([ok("a", 1), ok("b", 1), ok("c", 1)])).toBe("MODERATE");
    expect(evidenceLevel(Array.from({ length: 5 }, (_, i) => ok(String(i), 1)))).toBe("GOOD");
  });
  it("band appears only with at least 3 sufficient indicators", () => {
    expect(reliabilityBand({ completionReliability: ok("completionReliability", 100), scheduleAdherence: ok("scheduleAdherence", 100) } as never).band).toBe("NOT_ENOUGH_EVIDENCE");
  });
  it("thresholds: STRONG >= 85 all; WEAK if any < 60 or two < 70; else MIXED", () => {
    const set = (a: number, b: number, c: number) => ({ completionReliability: ok("completionReliability", a), scheduleAdherence: ok("scheduleAdherence", b), milestoneTimeliness: ok("milestoneTimeliness", c) }) as never;
    expect(reliabilityBand(set(85, 90, 100)).band).toBe("STRONG");
    expect(reliabilityBand(set(84.9, 90, 100)).band).toBe("MIXED");
    expect(reliabilityBand(set(59.9, 100, 100)).band).toBe("WEAK");
    expect(reliabilityBand(set(65, 65, 100)).band).toBe("WEAK");
    expect(reliabilityBand(set(65, 80, 100)).band).toBe("MIXED");
  });
});

describe("risk flags: positive and negative cases", () => {
  const codes = (ev: Evidence) => riskFlags(ev, now).map((f) => f.code);
  it("REPEATED_DELAYS needs 2 late projects in 24 months", () => {
    expect(codes(empty({ assignments: [completed(false)] }))).not.toContain("REPEATED_DELAYS");
    expect(codes(empty({ assignments: [completed(false), completed(false)] }))).toContain("REPEATED_DELAYS");
    expect(codes(empty({ assignments: [completed(false), asg({ status: "ENDED", projectStatus: "COMPLETED", plannedEndDate: d("2020-01-01"), actualEndDate: d("2020-03-01") })] }))).not.toContain("REPEATED_DELAYS");
  });
  it("ACTIVE_DELAY", () => {
    expect(codes(empty({ assignments: [asg({ projectStatus: "DELAYED" })] }))).toContain("ACTIVE_DELAY");
    expect(codes(empty({ assignments: [asg()] }))).not.toContain("ACTIVE_DELAY");
  });
  it("FAILED_INSPECTIONS: two rejected in 12 months, or latest concluded rejected", () => {
    const ins = (id: string, status: string, date: string) => ({ id, projectId: "p", status, inspectionDate: d(date) });
    expect(codes(empty({ inspections: [ins("1", "REJECTED", "2026-03-01"), ins("2", "REJECTED", "2026-04-01")] }))).toContain("FAILED_INSPECTIONS");
    expect(codes(empty({ inspections: [ins("1", "REJECTED", "2026-04-01")] }))).toContain("FAILED_INSPECTIONS");
    expect(codes(empty({ inspections: [ins("1", "REJECTED", "2026-01-01"), ins("2", "VERIFIED", "2026-04-01")] }))).not.toContain("FAILED_INSPECTIONS");
    expect(codes(empty({ inspections: [ins("1", "REJECTED", "2024-01-01"), ins("2", "REJECTED", "2024-02-01"), ins("3", "VERIFIED", "2024-03-01")] }))).not.toContain("FAILED_INSPECTIONS");
  });
  it("UNRESOLVED_QUALITY after 30 days only", () => {
    const ins = (date: string) => [{ id: "1", projectId: "p", status: "REQUIRES_REVIEW", inspectionDate: d(date) }];
    expect(codes(empty({ inspections: ins("2026-04-01") }))).toContain("UNRESOLVED_QUALITY");
    expect(codes(empty({ inspections: ins("2026-05-20") }))).not.toContain("UNRESOLVED_QUALITY");
  });
  it("UNVERIFIED_CLAIMS appears only when the indicator has evidence and a hit", () => {
    const a = asg();
    const ev = empty({ assignments: [a], claims: [{ id: "r", projectId: a.projectId, claimed: 90, at: d("2026-05-01") }], inspections: [{ id: "v", projectId: a.projectId, status: "VERIFIED", inspectionDate: d("2026-05-02"), physicalProgress: 40 }] });
    expect(codes(ev)).toContain("UNVERIFIED_CLAIMS");
    expect(codes({ ...ev, inspections: [] })).not.toContain("UNVERIFIED_CLAIMS");
  });
  it("certificate flags", () => {
    const cert = (state: "EXPIRED" | "EXPIRING" | "VALID") => ({ id: "k", name: "CIDA", state, expiresOn: d("2026-06-10") });
    expect(codes(empty({ certifications: [cert("EXPIRED")] }))).toContain("CERT_EXPIRED");
    expect(codes(empty({ certifications: [cert("EXPIRING")] }))).toContain("CERT_EXPIRING_30D");
    expect(codes(empty({ certifications: [cert("VALID")] }))).toEqual([]);
  });
  it("INCOMPLETE_CONTRACT_DATA, SUSPENDED_WITH_ACTIVE_WORK, TERMINATED_ASSIGNMENT_RECENT", () => {
    expect(codes(empty({ assignments: [asg({ contractReference: null })] }))).toContain("INCOMPLETE_CONTRACT_DATA");
    expect(codes(empty({ assignments: [asg()] }))).not.toContain("INCOMPLETE_CONTRACT_DATA");
    expect(codes(empty({ profileGaps: ["contact"] }))).toContain("INCOMPLETE_CONTRACT_DATA");
    expect(codes(empty({ contractorStatus: "SUSPENDED", assignments: [asg()] }))).toContain("SUSPENDED_WITH_ACTIVE_WORK");
    expect(codes(empty({ contractorStatus: "SUSPENDED" }))).not.toContain("SUSPENDED_WITH_ACTIVE_WORK");
    expect(codes(empty({ assignments: [asg({ status: "TERMINATED", endDate: d("2026-02-01") })] }))).toContain("TERMINATED_ASSIGNMENT_RECENT");
    expect(codes(empty({ assignments: [asg({ status: "TERMINATED", endDate: d("2024-02-01") })] }))).not.toContain("TERMINATED_ASSIGNMENT_RECENT");
  });
  it("flags are sorted most severe first and carry evidence", () => {
    const f = riskFlags(empty({ contractorStatus: "SUSPENDED", assignments: [asg({ contractReference: null })] }), now);
    expect(f[0]!.severity).toBe("HIGH");
    expect(f.every((x) => x.reason.length > 0 && x.evidence.length > 0)).toBe(true);
  });
});
