import { describe, expect, it } from "vitest";

import { computeHealth, HEALTH, type HealthInput } from "../src/modules/assets/asset-health.rules.js";
import { declinePerYear, evaluateCondition, trendOf, type AssessmentFacts } from "../src/modules/assets/condition-rules.js";
import { blockedGates, evaluateConversionGates, warningGates, type ConversionGateInput } from "../src/modules/assets/conversion-gates.js";
import { approvalAllowed, canMaintTransition, coupledStatus, isMaintenanceOverdue, nextRecurrenceDate, repeatFailures, unresolvedTasks } from "../src/modules/assets/maintenance-workflow.js";

const NOW = new Date("2026-11-07T06:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("conversion gates", () => {
  const ok: ConversionGateInput = { projectStatus: "COMPLETED", verifiedPercent: 100, finalHandoverVerified: false, hasValidGeometry: true, openFindings: 0, unpaidPayments: 0, pendingExpenses: 0, retentionOutstanding: false, activeAssignments: 0, receivingAgency: { exists: true, active: true }, existingConversion: null, approverIsRequester: false, documentCount: 2 };
  const by = (i: ConversionGateInput) => Object.fromEntries(evaluateConversionGates(i).map((g) => [g.key, g.status]));
  it("passes everything for a fully closed project", () => {
    expect(blockedGates(evaluateConversionGates(ok))).toEqual([]);
    expect(warningGates(evaluateConversionGates(ok))).toEqual([]);
  });
  it("blocks on status, unverified completion, receiving agency, duplicate and self-approval", () => {
    expect(by({ ...ok, projectStatus: "ACTIVE" }).PROJECT_COMPLETED).toBe("BLOCK");
    expect(by({ ...ok, verifiedPercent: 80 }).VERIFIED_COMPLETION).toBe("BLOCK");
    expect(by({ ...ok, verifiedPercent: 80, finalHandoverVerified: true }).VERIFIED_COMPLETION).toBe("PASS");
    expect(by({ ...ok, receivingAgency: { exists: true, active: false } }).RECEIVING_AGENCY).toBe("BLOCK");
    expect(by({ ...ok, existingConversion: { status: "APPROVED" } }).DUPLICATE).toBe("BLOCK");
    expect(by({ ...ok, approverIsRequester: true }).MAKER_CHECKER).toBe("BLOCK");
    expect(by({ ...ok, approverIsRequester: null }).MAKER_CHECKER).toBe("SKIPPED");
  });
  it("warns, but does not block, on geometry, findings, finance, contractors and documents", () => {
    const g = by({ ...ok, hasValidGeometry: false, openFindings: 2, unpaidPayments: 1, activeAssignments: 1, documentCount: 0 });
    expect([g.GEOMETRY, g.OPEN_FINDINGS, g.FINANCIAL_CLOSURE, g.CONTRACTOR_HANDOVER, g.DOCUMENTS]).toEqual(["WARN", "WARN", "WARN", "WARN", "WARN"]);
    expect(by({ ...ok, retentionOutstanding: true }).FINANCIAL_CLOSURE).toBe("WARN");
  });
});

describe("maintenance workflow", () => {
  it("allows the documented transitions and refuses illegal ones", () => {
    expect(canMaintTransition("APPROVE", "REQUESTED")).toBe(true);
    expect(canMaintTransition("APPROVE", "PLANNED")).toBe(false);
    expect(canMaintTransition("START", "SCHEDULED")).toBe(true);
    expect(canMaintTransition("START", "PLANNED")).toBe(false);
    expect(canMaintTransition("COMPLETE", "IN_PROGRESS")).toBe(true);
    expect(canMaintTransition("CANCEL", "COMPLETED")).toBe(false);
    expect(canMaintTransition("EDIT", "IN_PROGRESS")).toBe(false);
  });
  it("overdue is derived for open work only", () => {
    expect(isMaintenanceOverdue("SCHEDULED", daysAgo(1), NOW)).toBe(true);
    expect(isMaintenanceOverdue("COMPLETED", daysAgo(10), NOW)).toBe(false);
    expect(isMaintenanceOverdue("REQUESTED", daysAgo(10), NOW)).toBe(false);
    expect(isMaintenanceOverdue("PLANNED", new Date(NOW.getTime() + 86_400_000), NOW)).toBe(false);
  });
  it("maker-checker with the single documented emergency exception", () => {
    expect(approvalAllowed({ actorId: "a", requesterId: "b", maintenanceType: "CORRECTIVE", roleKey: "AGENCY_OFFICER" }).ok).toBe(true);
    expect(approvalAllowed({ actorId: "a", requesterId: "a", maintenanceType: "CORRECTIVE", roleKey: "GOV_ADMIN", acknowledgeEmergency: true }).ok).toBe(false);
    expect(approvalAllowed({ actorId: "a", requesterId: "a", maintenanceType: "EMERGENCY", roleKey: "AGENCY_OFFICER", acknowledgeEmergency: true }).ok).toBe(false);
    expect(approvalAllowed({ actorId: "a", requesterId: "a", maintenanceType: "EMERGENCY", roleKey: "GOV_ADMIN" }).ok).toBe(false);
    expect(approvalAllowed({ actorId: "a", requesterId: "a", maintenanceType: "EMERGENCY", roleKey: "GOV_ADMIN", acknowledgeEmergency: true })).toEqual({ ok: true, viaEmergency: true });
  });
  it("status coupling never overrides manual decisions", () => {
    expect(coupledStatus("IN_SERVICE", 1)).toBe("UNDER_MAINTENANCE");
    expect(coupledStatus("UNDER_MAINTENANCE", 0)).toBe("IN_SERVICE");
    expect(coupledStatus("UNDER_MAINTENANCE", 1)).toBe("UNDER_MAINTENANCE");
    expect(coupledStatus("OUT_OF_SERVICE", 0)).toBe("OUT_OF_SERVICE");
    expect(coupledStatus("DECOMMISSIONED", 1)).toBe("DECOMMISSIONED");
  });
  it("recurrence date, repeat failures and task reconciliation", () => {
    expect(nextRecurrenceDate(new Date("2026-01-01T00:00:00Z"), 180).toISOString().slice(0, 10)).toBe("2026-06-30");
    const rec = (status: string, type = "CORRECTIVE", d = 30) => ({ maintenanceType: type, status: status as never, scheduledDate: daysAgo(d) });
    expect(repeatFailures([rec("COMPLETED"), rec("COMPLETED"), rec("COMPLETED", "EMERGENCY")], NOW)).toEqual({ flagged: true, count: 3 });
    expect(repeatFailures([rec("COMPLETED"), rec("CANCELLED"), rec("REJECTED"), rec("COMPLETED", "PREVENTIVE")], NOW).flagged).toBe(false);
    expect(repeatFailures([rec("COMPLETED", "CORRECTIVE", 400), rec("COMPLETED", "CORRECTIVE", 401), rec("COMPLETED", "CORRECTIVE", 402)], NOW).flagged).toBe(false);
    expect(unresolvedTasks([{ key: "a", done: true }, { key: "b", done: false }, { key: "c", done: false, skippedNote: "not needed" }])).toEqual(["b"]);
  });
});

const A = (condition: AssessmentFacts["condition"], ago: number, issues: AssessmentFacts["issues"] = []): AssessmentFacts => ({ condition, assessedAt: daysAgo(ago), issues });

describe("condition rules k1", () => {
  it("trend needs two assessments and reads the last up-to-three", () => {
    expect(trendOf([A("GOOD", 10)])).toBe("INSUFFICIENT_HISTORY");
    expect(trendOf([A("POOR", 10), A("GOOD", 200)])).toBe("DETERIORATING");
    expect(trendOf([A("GOOD", 10), A("POOR", 200)])).toBe("IMPROVING");
    expect(trendOf([A("GOOD", 10), A("GOOD", 200)])).toBe("STABLE");
    expect(trendOf([A("FAIR", 10), A("GOOD", 200), A("EXCELLENT", 400)])).toBe("DETERIORATING"); // two steps over three
  });
  it("annualised decline only with three assessments spanning 180 days", () => {
    expect(declinePerYear([A("POOR", 10), A("GOOD", 100)])).toBeNull();
    expect(declinePerYear([A("POOR", 10), A("GOOD", 100), A("EXCELLENT", 120)])).toBeNull(); // spans 110 days
    expect(declinePerYear([A("POOR", 0), A("GOOD", 200), A("EXCELLENT", 365)])).toBe(3); // 5 -> 2 over one year
  });
  it("flags missing, overdue, due-soon, critical and open critical issues", () => {
    const base = { now: NOW, intervalDays: 365, operationalStatus: "IN_SERVICE" };
    const codes = (assessments: AssessmentFacts[], extra = {}) => evaluateCondition({ ...base, assessments, ...extra }).flags.map((f) => f.code);
    expect(codes([])).toEqual(["NO_ASSESSMENT_RECORDED"]);
    expect(codes([A("GOOD", 400)])).toContain("ASSESSMENT_OVERDUE");
    expect(codes([A("GOOD", 320)])).toContain("ASSESSMENT_DUE_SOON");
    expect(codes([A("GOOD", 30)])).toEqual([]);
    expect(codes([A("CRITICAL", 5, [{ key: "x", severity: "CRITICAL", status: "OPEN" }])])).toEqual(expect.arrayContaining(["CONDITION_CRITICAL", "OPEN_CRITICAL_ISSUE"]));
    expect(codes([A("GOOD", 5, [{ key: "x", severity: "CRITICAL", status: "RESOLVED" }])])).toEqual([]);
  });
  it("Defects Liability Watch fires only for a drop recorded inside the period", () => {
    const base = { now: NOW, intervalDays: 365, operationalStatus: "IN_SERVICE", defectsLiabilityEndsOn: new Date("2027-03-01") };
    const codes = (assessments: AssessmentFacts[], extra = {}) => evaluateCondition({ ...base, assessments, ...extra }).flags.map((f) => f.code);
    expect(codes([A("POOR", 5), A("GOOD", 100)])).toEqual(expect.arrayContaining(["WITHIN_DEFECTS_LIABILITY", "DLP_DETERIORATION"]));
    expect(codes([A("GOOD", 5), A("GOOD", 100)])).toEqual(["WITHIN_DEFECTS_LIABILITY"]);
    expect(codes([A("POOR", 5), A("GOOD", 100)], { defectsLiabilityEndsOn: new Date("2026-01-01") })).not.toContain("WITHIN_DEFECTS_LIABILITY");
    expect(codes([A("GOOD", 5)], { operationalStatus: "OUT_OF_SERVICE" })).toContain("OUT_OF_SERVICE");
  });
});

describe("health rules h1", () => {
  const base = (over: Partial<HealthInput> = {}): HealthInput => ({ now: NOW, intervalDays: 365, assessment: { condition: "GOOD", assessedAt: daysAgo(30), basis: "INSPECTION_VERIFIED", issues: [] }, maintenance: [], hazard: undefined, ...over });
  it("weights sum to 100", () => { expect(Object.values(HEALTH.weights).reduce((a, b) => a + b, 0)).toBe(100); });
  it("gives no score without an assessment, and none when it is more than twice the interval old", () => {
    const none = computeHealth(base({ assessment: null }));
    expect(none).toMatchObject({ availability: "INSUFFICIENT_EVIDENCE", score: null, band: null, reasons: ["NO_ASSESSMENT"] });
    expect(none.hints).toContain("RECORD_ASSESSMENT");
    const stale = computeHealth(base({ assessment: { condition: "EXCELLENT", assessedAt: daysAgo(800), basis: "INSPECTION_VERIFIED", issues: [] } }));
    expect(stale).toMatchObject({ availability: "INSUFFICIENT_EVIDENCE", score: null, reasons: ["ASSESSMENT_STALE"] });
  });
  it("renormalises over the available components and states which were used", () => {
    const r = computeHealth(base());
    expect(r.availability).toBe("AVAILABLE");
    expect(Object.keys(r.weightsUsed).sort()).toEqual(["assessmentTimeliness", "condition", "maintenance", "openIssues"]);
    expect(Object.values(r.weightsUsed).reduce((a, b) => a + (b as number), 0)).toBeGreaterThanOrEqual(99);
    expect(r.components.find((c) => c.key === "hazardExposure")).toMatchObject({ score: null, weightUsed: 0, reasonKey: "skipped" });
    expect(r.score).toBe(Math.round((80 * 45 + 100 * 20 + 100 * 20 + 100 * 10) / 95));
    expect(r.band).toBe("GOOD");
  });
  it("applies the age adjustment, issue penalties and maintenance penalties; completed work adds nothing", () => {
    const aged = computeHealth(base({ assessment: { condition: "GOOD", assessedAt: daysAgo(400), basis: "INSPECTION_VERIFIED", issues: [] } }));
    expect(aged.components.find((c) => c.key === "condition")!.score).toBe(70);
    const issues = computeHealth(base({ assessment: { condition: "GOOD", assessedAt: daysAgo(10), basis: "INSPECTION_VERIFIED", issues: [{ severity: "CRITICAL", status: "OPEN" }, { severity: "MAJOR", status: "OPEN" }, { severity: "MINOR", status: "RESOLVED" }] } }));
    expect(issues.components.find((c) => c.key === "openIssues")!.score).toBe(40);
    const m = computeHealth(base({ maintenance: [{ status: "SCHEDULED", priority: "HIGH", scheduledDate: daysAgo(40) }, { status: "COMPLETED", priority: "HIGH", scheduledDate: daysAgo(100) }] }));
    expect(m.components.find((c) => c.key === "maintenance")!.score).toBe(60); // 100 - (30 + 10 for >30 days); the completed one adds nothing
    expect(m.hints).toContain("CLOSE_OVERDUE_MAINTENANCE");
    const waiting = computeHealth(base({ maintenance: [{ status: "REQUESTED", scheduledDate: daysAgo(1), requestedAt: daysAgo(45) }] }));
    expect(waiting.components.find((c) => c.key === "maintenance")!.score).toBe(90);
    expect(waiting.hints).toContain("APPROVE_WAITING_REQUESTS");
  });
  it("caps the band by condition and by open critical issues", () => {
    const crit = computeHealth(base({ assessment: { condition: "CRITICAL", assessedAt: daysAgo(5), basis: "INSPECTION_VERIFIED", issues: [] } }));
    expect(crit.band).toBe("CRITICAL"); expect(crit.caps).toContain("CONDITION_CRITICAL");
    const poor = computeHealth(base({ assessment: { condition: "POOR", assessedAt: daysAgo(5), basis: "INSPECTION_VERIFIED", issues: [] }, hazard: null }));
    expect(["POOR", "CRITICAL"]).toContain(poor.band);
    const openCrit = computeHealth(base({ assessment: { condition: "EXCELLENT", assessedAt: daysAgo(5), basis: "INSPECTION_VERIFIED", issues: [{ severity: "CRITICAL", status: "OPEN" }] } }));
    expect(openCrit.band).toBe("POOR"); expect(openCrit.caps).toContain("OPEN_CRITICAL_ISSUE");
    expect(openCrit.hints).toContain("REVIEW_OPEN_CRITICAL_ISSUE");
  });
  it("evidence level grows with history and the hazard check, and a manual basis caps it at MODERATE", () => {
    const hist = [{ status: "COMPLETED", scheduledDate: daysAgo(50) }];
    expect(computeHealth(base()).evidenceLevel).toBe("LOW");
    expect(computeHealth(base({ maintenance: hist })).evidenceLevel).toBe("MODERATE");
    expect(computeHealth(base({ maintenance: hist, hazard: null })).evidenceLevel).toBe("GOOD");
    expect(computeHealth(base({ maintenance: hist, hazard: null, assessment: { condition: "GOOD", assessedAt: daysAgo(30), basis: "MANUAL_ENTRY", issues: [] } })).evidenceLevel).toBe("MODERATE");
    expect(computeHealth(base({ hazard: "HIGH" })).components.find((c) => c.key === "hazardExposure")!.score).toBe(40);
  });
});
