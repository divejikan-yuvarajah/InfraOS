/**
 * Explainable contractor indicators and risk flags (Step 94). Pure and deterministic: no database, no clock except the `now` argument.
 *
 * There is NO single overall score. Each indicator reports its own sample size and answers INSUFFICIENT_EVIDENCE with value null
 * when the sample is below its minimum, so a missing measurement can never read as 0% or as a default rating.
 *
 * Reliability band thresholds (single source of truth, see BAND below), over the available percentage indicators among 1-5
 * (indicator 3 contributes the share of active assignments NOT currently delayed):
 *   the band is shown only when at least BAND.minIndicators of them have enough evidence, otherwise NOT_ENOUGH_EVIDENCE;
 *   WEAK   if any value < BAND.weakBelow, or two or more values < BAND.mixedBelow;
 *   STRONG if every value >= BAND.strongAtLeast;
 *   MIXED  otherwise.
 */
export const RULE_VERSION = "c1";

export const MIN_SAMPLE = { completion: 3, schedule: 3, milestones: 5, inspections: 3, activeAssignments: 1 } as const;
export const BAND = { minIndicators: 3, strongAtLeast: 85, mixedBelow: 70, weakBelow: 60 } as const;
export const FLAGS = { repeatedDelayMonths: 24, repeatedDelayMin: 2, failedInspectionMonths: 12, failedInspectionMin: 2, qualityStaleDays: 30, claimGapPoints: 10, terminatedMonths: 12, certExpiringDays: 30 } as const;

export type AssignmentEv = {
  id: string; projectId: string; role: string; status: "ACTIVE" | "ENDED" | "REPLACED" | "TERMINATED";
  startDate: Date; endDate?: Date | null; contractReference?: string | null; hasContractValue: boolean;
  projectCode: string; projectTitle: string; projectStatus: string;
  plannedEndDate?: Date | null; actualEndDate?: Date | null;
};
export type MilestoneEv = { id: string; projectId: string; title: string; status: string; plannedEnd: Date; actualEnd?: Date | null };
export type InspectionEv = { id: string; projectId: string; status: string; inspectionDate: Date; physicalProgress?: number | null };
export type ClaimEv = { id: string; projectId: string; claimed: number; at: Date };
export type CertEv = { id: string; name: string; state: "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED"; expiresOn?: Date | null };

export type Evidence = {
  contractorStatus: string;
  assignments: AssignmentEv[];
  milestones: MilestoneEv[];
  inspections: InspectionEv[]; // source "inspection.v1": coarse outcomes only, replaced by Batch 06
  claims: ClaimEv[];
  certifications: CertEv[];
  profileGaps: string[];
};

export type EvidenceRef = { kind: "project" | "milestone" | "inspection" | "assignment" | "certification" | "profile"; id: string; label: string; projectId?: string };

export type Indicator = {
  key: string; value: number | null; unit: "percent" | "count" | "days"; sampleSize: number; minSample: number;
  status: "OK" | "INSUFFICIENT_EVIDENCE"; formulaKey: string; inputs: Record<string, unknown>; evidence: EvidenceRef[];
};

const ratio = (num: number, den: number) => Math.round((num / den) * 1000) / 10; // one decimal, no float drift in the output
const DAY = 86_400_000;
const monthsAgo = (now: Date, m: number) => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - m); return d; };

function make(key: string, formulaKey: string, unit: Indicator["unit"], minSample: number, sampleSize: number, value: number | null, inputs: Record<string, unknown>, evidence: EvidenceRef[]): Indicator {
  const ok = sampleSize >= minSample && value !== null;
  return { key, value: ok ? value : null, unit, sampleSize, minSample, status: ok ? "OK" : "INSUFFICIENT_EVIDENCE", formulaKey, inputs, evidence };
}
const projRef = (a: AssignmentEv): EvidenceRef => ({ kind: "project", id: a.projectId, label: `${a.projectCode} ${a.projectTitle}`, projectId: a.projectId });

export const isDelayedNow = (a: AssignmentEv, now: Date): boolean =>
  a.status === "ACTIVE" && !["COMPLETED", "CANCELLED"].includes(a.projectStatus) && (a.projectStatus === "DELAYED" || (!!a.plannedEndDate && a.plannedEndDate.getTime() < now.getTime()));

export function completionReliability(ev: Evidence): Indicator {
  const ended = ev.assignments.filter((a) => a.status !== "ACTIVE");
  // REPLACED is a management decision, not an outcome, so it is excluded from both sides. Other ended work that finished neither way is also excluded.
  const done = ended.filter((a) => a.status === "ENDED" && a.projectStatus === "COMPLETED");
  const failed = ended.filter((a) => a.status === "TERMINATED" || (a.status === "ENDED" && a.projectStatus === "CANCELLED"));
  const n = done.length + failed.length;
  return make("completionReliability", "c1.completion", "percent", MIN_SAMPLE.completion, n, n ? ratio(done.length, n) : null,
    { completed: done.length, notCompleted: failed.length }, [...done, ...failed].map(projRef));
}

export function scheduleAdherence(ev: Evidence): Indicator {
  const seen = new Set<string>();
  const rows = ev.assignments.filter((a) => a.projectStatus === "COMPLETED" && a.plannedEndDate && a.actualEndDate && !seen.has(a.projectId) && !!seen.add(a.projectId));
  const late = rows.filter((a) => a.actualEndDate!.getTime() > a.plannedEndDate!.getTime());
  const avgLate = late.length ? Math.round(late.reduce((s, a) => s + (a.actualEndDate!.getTime() - a.plannedEndDate!.getTime()) / DAY, 0) / late.length) : 0;
  return make("scheduleAdherence", "c1.schedule", "percent", MIN_SAMPLE.schedule, rows.length, rows.length ? ratio(rows.length - late.length, rows.length) : null,
    { onTime: rows.length - late.length, late: late.length, averageLateDays: avgLate }, rows.map(projRef));
}

export function currentDelayExposure(ev: Evidence, now: Date): Indicator {
  const active = ev.assignments.filter((a) => a.status === "ACTIVE");
  const delayed = active.filter((a) => isDelayedNow(a, now));
  return make("currentDelayExposure", "c1.delayExposure", "count", MIN_SAMPLE.activeAssignments, active.length, delayed.length,
    { delayed: delayed.length, active: active.length, onScheduleShare: active.length ? ratio(active.length - delayed.length, active.length) : null }, delayed.map(projRef));
}

export function milestoneTimeliness(ev: Evidence): Indicator {
  const rows = ev.milestones.filter((m) => m.status === "COMPLETED" && m.actualEnd);
  const onTime = rows.filter((m) => m.actualEnd!.getTime() <= m.plannedEnd.getTime());
  return make("milestoneTimeliness", "c1.milestones", "percent", MIN_SAMPLE.milestones, rows.length, rows.length ? ratio(onTime.length, rows.length) : null,
    { onTime: onTime.length, late: rows.length - onTime.length }, rows.filter((m) => m.actualEnd!.getTime() > m.plannedEnd.getTime()).map((m) => ({ kind: "milestone" as const, id: m.id, label: m.title, projectId: m.projectId })));
}

const CONCLUDED = ["VERIFIED", "REJECTED", "REQUIRES_REVIEW"];
export function inspectionOutcomeRate(ev: Evidence): Indicator {
  const rows = ev.inspections.filter((i) => CONCLUDED.includes(i.status));
  const verified = rows.filter((i) => i.status === "VERIFIED").length;
  return make("inspectionOutcomeRate", "c1.inspection.coarse", "percent", MIN_SAMPLE.inspections, rows.length, rows.length ? ratio(verified, rows.length) : null,
    { verified, rejected: rows.filter((i) => i.status === "REJECTED").length, requiresReview: rows.filter((i) => i.status === "REQUIRES_REVIEW").length, source: "inspection.v1", coarse: true },
    rows.filter((i) => i.status !== "VERIFIED").map((i) => ({ kind: "inspection" as const, id: i.id, label: i.status, projectId: i.projectId })));
}

/** Claimed progress is labelled claimed. A project counts only when a verified-inspection progress figure exists to compare it with. */
export function unverifiedClaims(ev: Evidence): Indicator {
  const activeProjects = new Set(ev.assignments.filter((a) => a.status === "ACTIVE" && a.projectStatus === "ACTIVE").map((a) => a.projectId));
  const latest = <T extends { projectId: string; at: Date }>(rows: T[], id: string) => rows.filter((r) => r.projectId === id).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  const verifiedRows = ev.inspections.filter((i) => i.status === "VERIFIED" && typeof i.physicalProgress === "number").map((i) => ({ projectId: i.projectId, at: i.inspectionDate, v: i.physicalProgress as number, id: i.id }));
  let compared = 0;
  const hits: EvidenceRef[] = [];
  for (const id of activeProjects) {
    const claim = latest(ev.claims, id);
    const ver = latest(verifiedRows, id);
    if (!claim || !ver) continue;
    compared += 1;
    if (claim.claimed - ver.v > FLAGS.claimGapPoints) hits.push({ kind: "project", id, label: `${claim.claimed}% claimed vs ${ver.v}% verified`, projectId: id });
  }
  return make("unverifiedClaims", "c1.claims", "count", 1, compared, compared ? hits.length : null, { compared, gapPoints: FLAGS.claimGapPoints, claimed: true }, hits);
}

export function contractDataCompleteness(ev: Evidence): Indicator {
  const active = ev.assignments.filter((a) => a.status === "ACTIVE");
  const complete = active.filter((a) => a.contractReference && a.hasContractValue);
  return make("contractDataCompleteness", "c1.contractData", "percent", MIN_SAMPLE.activeAssignments, active.length, active.length ? ratio(complete.length, active.length) : null,
    { complete: complete.length, active: active.length, profileGaps: ev.profileGaps },
    active.filter((a) => !(a.contractReference && a.hasContractValue)).map((a) => ({ kind: "assignment" as const, id: a.id, label: `${a.projectCode} ${a.projectTitle}`, projectId: a.projectId })));
}

export type EvidenceLevel = "NONE" | "LOW" | "MODERATE" | "GOOD";
export type Band = "STRONG" | "MIXED" | "WEAK" | "NOT_ENOUGH_EVIDENCE";

export function evidenceLevel(indicators: Indicator[]): EvidenceLevel {
  const n = indicators.filter((i) => i.status === "OK").length;
  return n === 0 ? "NONE" : n <= 2 ? "LOW" : n <= 4 ? "MODERATE" : "GOOD";
}

export function reliabilityBand(ind: Record<string, Indicator>): { band: Band; considered: { key: string; value: number }[] } {
  const delay = ind.currentDelayExposure;
  const shares: { key: string; value: number }[] = [];
  for (const k of ["completionReliability", "scheduleAdherence", "milestoneTimeliness", "inspectionOutcomeRate"]) {
    const i = ind[k];
    if (i && i.status === "OK" && i.value !== null) shares.push({ key: k, value: i.value });
  }
  if (delay && delay.status === "OK") {
    const s = delay.inputs.onScheduleShare;
    if (typeof s === "number") shares.push({ key: "currentDelayExposure", value: s });
  }
  if (shares.length < BAND.minIndicators) return { band: "NOT_ENOUGH_EVIDENCE", considered: shares };
  const below70 = shares.filter((s) => s.value < BAND.mixedBelow).length;
  if (shares.some((s) => s.value < BAND.weakBelow) || below70 >= 2) return { band: "WEAK", considered: shares };
  if (shares.every((s) => s.value >= BAND.strongAtLeast)) return { band: "STRONG", considered: shares };
  return { band: "MIXED", considered: shares };
}

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type RiskFlag = { code: string; severity: Severity; reason: string; params: Record<string, string | number>; evidence: EvidenceRef[]; since: string | null };
export const SEVERITY_ORDER: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export function riskFlags(ev: Evidence, now: Date): RiskFlag[] {
  const out: RiskFlag[] = [];
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const earliest = (ds: (Date | null | undefined)[]) => iso(ds.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0]);

  const lateProject = (a: AssignmentEv) => a.projectStatus === "DELAYED" || (a.projectStatus === "COMPLETED" && !!a.actualEndDate && !!a.plannedEndDate && a.actualEndDate.getTime() > a.plannedEndDate.getTime()) || isDelayedNow(a, now);
  const windowStart = monthsAgo(now, FLAGS.repeatedDelayMonths);
  const seen = new Set<string>();
  const late = ev.assignments.filter((a) => lateProject(a) && (a.plannedEndDate ?? a.startDate).getTime() >= windowStart.getTime() && !seen.has(a.projectId) && !!seen.add(a.projectId));
  if (late.length >= FLAGS.repeatedDelayMin) out.push({ code: "REPEATED_DELAYS", severity: late.length >= 4 ? "HIGH" : "MEDIUM", reason: `${late.length} projects were delayed or finished late in the last ${FLAGS.repeatedDelayMonths} months.`, params: { count: late.length, months: FLAGS.repeatedDelayMonths }, evidence: late.map(projRef), since: earliest(late.map((a) => a.plannedEndDate)) });

  const delayed = ev.assignments.filter((a) => isDelayedNow(a, now));
  if (delayed.length) out.push({ code: "ACTIVE_DELAY", severity: delayed.length >= 3 ? "HIGH" : "MEDIUM", reason: `${delayed.length} active project${delayed.length === 1 ? " is" : "s are"} delayed or past the planned end date.`, params: { count: delayed.length }, evidence: delayed.map(projRef), since: earliest(delayed.map((a) => a.plannedEndDate)) });

  const concluded = ev.inspections.filter((i) => CONCLUDED.includes(i.status)).sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime());
  const rejected = concluded.filter((i) => i.status === "REJECTED" && i.inspectionDate.getTime() >= monthsAgo(now, FLAGS.failedInspectionMonths).getTime());
  if (rejected.length >= FLAGS.failedInspectionMin || concluded[0]?.status === "REJECTED") {
    const refs = (rejected.length ? rejected : concluded.slice(0, 1)).map((i) => ({ kind: "inspection" as const, id: i.id, label: "REJECTED", projectId: i.projectId }));
    out.push({ code: "FAILED_INSPECTIONS", severity: rejected.length >= FLAGS.failedInspectionMin ? "HIGH" : "MEDIUM", reason: rejected.length >= FLAGS.failedInspectionMin ? `${rejected.length} inspections were rejected in the last ${FLAGS.failedInspectionMonths} months.` : "The most recent concluded inspection was rejected.", params: { count: rejected.length, months: FLAGS.failedInspectionMonths }, evidence: refs, since: earliest((rejected.length ? rejected : concluded.slice(0, 1)).map((i) => i.inspectionDate)) });
  }

  const stale = ev.inspections.filter((i) => i.status === "REQUIRES_REVIEW" && now.getTime() - i.inspectionDate.getTime() > FLAGS.qualityStaleDays * DAY);
  if (stale.length) out.push({ code: "UNRESOLVED_QUALITY", severity: "MEDIUM", reason: `${stale.length} inspection${stale.length === 1 ? "" : "s"} requiring review ${stale.length === 1 ? "has" : "have"} been open for over ${FLAGS.qualityStaleDays} days.`, params: { count: stale.length, days: FLAGS.qualityStaleDays }, evidence: stale.map((i) => ({ kind: "inspection" as const, id: i.id, label: "REQUIRES_REVIEW", projectId: i.projectId })), since: earliest(stale.map((i) => i.inspectionDate)) });

  const claims = unverifiedClaims(ev);
  if (claims.status === "OK" && (claims.value ?? 0) > 0) out.push({ code: "UNVERIFIED_CLAIMS", severity: "MEDIUM", reason: `Claimed progress is more than ${FLAGS.claimGapPoints} points above the latest verified inspection on ${claims.value} active project${claims.value === 1 ? "" : "s"}.`, params: { count: claims.value ?? 0, points: FLAGS.claimGapPoints }, evidence: claims.evidence, since: null });

  const expired = ev.certifications.filter((c) => c.state === "EXPIRED");
  if (expired.length) out.push({ code: "CERT_EXPIRED", severity: "HIGH", reason: `${expired.length} certification${expired.length === 1 ? " has" : "s have"} expired.`, params: { count: expired.length }, evidence: expired.map((c) => ({ kind: "certification" as const, id: c.id, label: c.name })), since: earliest(expired.map((c) => c.expiresOn)) });
  const expiring = ev.certifications.filter((c) => c.state === "EXPIRING");
  if (expiring.length) out.push({ code: "CERT_EXPIRING_30D", severity: "MEDIUM", reason: `${expiring.length} certification${expiring.length === 1 ? " expires" : "s expire"} within ${FLAGS.certExpiringDays} days.`, params: { count: expiring.length, days: FLAGS.certExpiringDays }, evidence: expiring.map((c) => ({ kind: "certification" as const, id: c.id, label: c.name })), since: earliest(expiring.map((c) => c.expiresOn)) });

  const incomplete = ev.assignments.filter((a) => a.status === "ACTIVE" && !(a.contractReference && a.hasContractValue));
  if (incomplete.length || ev.profileGaps.length) {
    out.push({ code: "INCOMPLETE_CONTRACT_DATA", severity: "LOW", reason: incomplete.length ? `${incomplete.length} active assignment${incomplete.length === 1 ? " lacks" : "s lack"} a contract reference or value.` : "The contractor profile is missing required details.", params: { count: incomplete.length, gaps: ev.profileGaps.join(",") }, evidence: [...incomplete.map((a) => ({ kind: "assignment" as const, id: a.id, label: `${a.projectCode} ${a.projectTitle}`, projectId: a.projectId })), ...ev.profileGaps.map((g) => ({ kind: "profile" as const, id: g, label: g }))], since: null });
  }

  const active = ev.assignments.filter((a) => a.status === "ACTIVE");
  if (ev.contractorStatus === "SUSPENDED" && active.length) out.push({ code: "SUSPENDED_WITH_ACTIVE_WORK", severity: "HIGH", reason: `The contractor is suspended but still holds ${active.length} active assignment${active.length === 1 ? "" : "s"}.`, params: { count: active.length }, evidence: active.map(projRef), since: null });

  const term = ev.assignments.filter((a) => a.status === "TERMINATED" && (a.endDate ?? a.startDate).getTime() >= monthsAgo(now, FLAGS.terminatedMonths).getTime());
  if (term.length) out.push({ code: "TERMINATED_ASSIGNMENT_RECENT", severity: "MEDIUM", reason: `${term.length} assignment${term.length === 1 ? " was" : "s were"} terminated in the last ${FLAGS.terminatedMonths} months.`, params: { count: term.length, months: FLAGS.terminatedMonths }, evidence: term.map(projRef), since: earliest(term.map((a) => a.endDate)) });

  return out.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

export function evaluate(ev: Evidence, now: Date) {
  const completion = completionReliability(ev);
  const schedule = scheduleAdherence(ev);
  const delay = currentDelayExposure(ev, now);
  const milestones = milestoneTimeliness(ev);
  const inspections = inspectionOutcomeRate(ev);
  const claims = unverifiedClaims(ev);
  const contract = contractDataCompleteness(ev);
  const indicators = [completion, schedule, delay, milestones, inspections, claims, contract];
  const byKey = Object.fromEntries(indicators.map((i) => [i.key, i]));
  const { band, considered } = reliabilityBand(byKey);
  return { ruleVersion: RULE_VERSION, indicators, evidenceLevel: evidenceLevel(indicators), band, bandBasis: considered, flags: riskFlags(ev, now) };
}

export type Evaluation = ReturnType<typeof evaluate>;
