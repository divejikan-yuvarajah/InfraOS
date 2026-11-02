/**
 * Step 78 pure metric definitions. No I/O: the read layer maps scoped documents to the plain shapes below, so every
 * function here is unit-testable with a fixture and reusable by later steps. Scope is applied BEFORE these run.
 * Every metric carries { numerator, denominator, unit, definitionKey, drilldown } so the UI can explain and link it.
 */
import { BAND_WEIGHT, DASH, GRADES, HEALTH_WEIGHTS, RANGE_DAYS, type Grade, type HealthComponent, type RangeKey } from "./dashboard.rules.js";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const COLOMBO_OFFSET = 5.5 * HOUR;
const OPEN_LIKE = ["open", "acknowledged", "awaiting_response", "negotiating", "escalated"];
const ACTIVE_REQ = ["awaiting_response", "negotiating"];
const SILENT_STANCES = ["proposer", "pending"];
const CLOSED_VERIFY = ["cleared", "reduced", "unchanged", "worse"];

export type DAgency = { agencyId: string; required: boolean; active: boolean; excluded: boolean; ackStatus: "pending" | "acknowledged"; ackAt: Date | null; ackDueAt: Date | null; addedAt: Date };
export type DRecord = {
  id: string; conflictNo: string; recordType: "conflict" | "opportunity"; status: string; band: string; score: number; classes: string[];
  createdAt: Date; closedAt: Date | null; resolvedAt: Date | null; outcome: string | null; resolvedBand: string | null;
  overlapStart: Date | null; overlapEnd: Date | null; district: string | null; lng: number; lat: number;
  agencies: DAgency[]; trenchMeters: number | null;
};
export type DReq = {
  id: string; conflictId: string; status: string; createdAt: Date; closedAt: Date | null; lastActivityAt: Date; escalatedAt: Date | null; escalated: boolean;
  agreedRound: number | null; rounds: number; participants: { agencyId: string; required: boolean; stance: string; dueAt: Date | null; lastDecisionAt: Date | null }[];
};
export type DRes = { conflictId: string; type: string; status: string; active: boolean; createdAt: Date; outcome: string | null; resolvedAt: Date | null; verification: string | null; verifiedAt: Date | null; commitments: { status: string }[]; nationalStep: boolean };
export type DAm = { conflictId: string; appliedAt: Date; shiftDays: number };
export type Data = { records: DRecord[]; reqs: DReq[]; ress: DRes[]; ams: DAm[] };

export type Drill = { page: "conflicts" | "coordination" | "approvals" | "history"; query: Record<string, string> };
export type Metric = { key: string; value: number | null; numerator: number | null; denominator: number | null; unit: "count" | "percent" | "days" | "hours" | "meters"; definitionKey: string; drilldown: Drill; sampled?: boolean };

// ---------- ranges (date-only, Asia/Colombo, inclusive) ----------
export const colomboDayNum = (d: Date) => Math.floor((d.getTime() + COLOMBO_OFFSET) / DAY);
export const dayStart = (n: number) => new Date(n * DAY - COLOMBO_OFFSET);
export type Range = { startDay: number; endDay: number; start: Date; end: Date; days: number };
const mkRange = (startDay: number, endDay: number): Range => ({ startDay, endDay, start: dayStart(startDay), end: new Date(dayStart(endDay + 1).getTime() - 1), days: endDay - startDay + 1 });
const isoDay = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / DAY);
export function rangeOf(key: RangeKey, from: string | undefined, to: string | undefined, now: Date): Range | null {
  if (key === "custom") {
    if (!from || !to) return null;
    const a = isoDay(from), b = isoDay(to);
    if (Number.isNaN(a) || Number.isNaN(b) || b < a || b - a + 1 > DASH.MAX_CUSTOM_DAYS) return null;
    return mkRange(a, b);
  }
  const end = colomboDayNum(now);
  return mkRange(end - RANGE_DAYS[key] + 1, end);
}
export const previousRange = (r: Range): Range => mkRange(r.startDay - r.days, r.startDay - 1);
const within = (d: Date | null | undefined, r: Range) => Boolean(d) && d!.getTime() >= r.start.getTime() && d!.getTime() <= r.end.getTime();

// ---------- statistics ----------
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)]!;
}
const cap = (v: number[]) => ({ values: v.length > DASH.PERCENTILE_CAP ? v.slice(0, DASH.PERCENTILE_CAP) : v, sampled: v.length > DASH.PERCENTILE_CAP });
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Percent with a null (not 0, not Infinity) when there is nothing to divide by. */
export const pct = (num: number, den: number): number | null => (den > 0 ? round1((num / den) * 100) : null);
export function delta(cur: number | null, prev: number | null): { abs: number; pct: number | null } | null {
  if (cur === null || prev === null) return null;
  return { abs: round1(cur - prev), pct: prev === 0 ? null : round1(((cur - prev) / Math.abs(prev)) * 100) };
}

// ---------- helpers ----------
const live = (r: DRecord) => OPEN_LIKE.includes(r.status);
const endOf = (r: DRecord) => r.resolvedAt ?? r.closedAt ?? (live(r) ? null : r.createdAt);
export const openAt = (r: DRecord, at: Date) => r.createdAt.getTime() <= at.getTime() && (!endOf(r) || endOf(r)!.getTime() > at.getTime());
const involves = (r: DRecord, agencyId: string | undefined) => !agencyId || r.agencies.some((a) => a.agencyId === agencyId && a.active && !a.excluded);
const ageDays = (r: DRecord, now: Date) => Math.floor((now.getTime() - r.createdAt.getTime()) / DAY);
const exposure = (rs: DRecord[]) => rs.reduce((n, r) => n + (BAND_WEIGHT[r.band] ?? 0), 0);
const drill = (page: Drill["page"], query: Record<string, string> = {}): Drill => ({ page, query });
const m = (key: string, value: number | null, unit: Metric["unit"], d: Drill, numerator: number | null = null, denominator: number | null = null, sampled = false): Metric =>
  ({ key, value, numerator, denominator, unit, definitionKey: `roadsync.metrics.${key}.definition`, drilldown: d, ...(sampled ? { sampled } : {}) });

export type Scoped = { records: DRecord[]; reqs: DReq[]; ress: DRes[]; ams: DAm[] };
/** Restrict a (already viewer-scoped) dataset to one agency's involvement; no agencyId = unchanged. */
export function forAgency(d: Data, agencyId?: string): Scoped {
  if (!agencyId) return d;
  const records = d.records.filter((r) => involves(r, agencyId));
  const ids = new Set(records.map((r) => r.id));
  return { records, reqs: d.reqs.filter((q) => ids.has(q.conflictId) && q.participants.some((p) => p.agencyId === agencyId)), ress: d.ress.filter((x) => ids.has(x.conflictId)), ams: d.ams.filter((a) => ids.has(a.conflictId)) };
}

// ---------- acknowledgement, response, coordination ----------
function ackStats(s: Scoped, r: Range, agencyId: string | undefined, now: Date) {
  const entries = s.records.flatMap((rec) => rec.agencies.filter((a) => a.required && a.active && !a.excluded && (!agencyId || a.agencyId === agencyId)).map((a) => ({ rec, a })));
  const done = entries.filter((e) => e.a.ackStatus === "acknowledged" && e.a.ackAt && within(e.a.ackAt, r));
  const onTime = done.filter((e) => !e.a.ackDueAt || e.a.ackAt!.getTime() <= e.a.ackDueAt.getTime()).length;
  const hours = cap(done.map((e) => (e.a.ackAt!.getTime() - e.a.addedAt.getTime()) / HOUR));
  const overdue = entries.filter((e) => e.a.ackStatus === "pending" && e.a.ackDueAt && e.a.ackDueAt < now && live(e.rec)).length;
  // A deadline that has passed with no acknowledgement is a miss: for periods that include today, those still pending count in the denominator.
  return { total: done.length + (r.end.getTime() >= now.getTime() ? overdue : 0), onTime, medianH: percentile(hours.values, 50), p90H: percentile(hours.values, 90), overdue, sampled: hours.sampled };
}
function respStats(s: Scoped, r: Range, agencyId: string | undefined, now: Date) {
  const parts = s.reqs.flatMap((q) => q.participants.filter((p) => p.required && (!agencyId || p.agencyId === agencyId)).map((p) => ({ q, p })));
  const done = parts.filter((x) => !SILENT_STANCES.includes(x.p.stance) && x.p.lastDecisionAt && x.p.dueAt && within(x.p.lastDecisionAt, r));
  const onTime = done.filter((x) => x.p.lastDecisionAt!.getTime() <= x.p.dueAt!.getTime()).length;
  const hours = cap(done.map((x) => (x.p.lastDecisionAt!.getTime() - x.q.createdAt.getTime()) / HOUR));
  const overdue = parts.filter((x) => ACTIVE_REQ.includes(x.q.status) && x.p.stance === "pending" && x.p.dueAt && x.p.dueAt < now).length;
  return { total: done.length + (r.end.getTime() >= now.getTime() ? overdue : 0), onTime, medianH: percentile(hours.values, 50), overdue, sampled: hours.sampled };
}
function coordStats(s: Scoped, r: Range, now: Date) {
  const closedIn = (q: DReq, st: string) => q.status === st && within(q.closedAt, r);
  const agreed = s.reqs.filter((q) => closedIn(q, "agreed"));
  const noAgree = s.reqs.filter((q) => closedIn(q, "no_agreement")).length;
  return {
    created: s.reqs.filter((q) => within(q.createdAt, r)).length, agreed: agreed.length, noAgreement: noAgree, withdrawn: s.reqs.filter((q) => closedIn(q, "withdrawn")).length,
    firstRound: agreed.filter((q) => q.agreedRound === 1).length,
    avgRounds: agreed.length ? round1(agreed.reduce((n, q) => n + q.rounds, 0) / agreed.length) : null,
    escalatedNow: s.reqs.filter((q) => ACTIVE_REQ.includes(q.status) && q.escalated).length,
    stuck: s.reqs.filter((q) => q.status === "negotiating" && now.getTime() - q.lastActivityAt.getTime() >= DASH.STUCK_NEGOTIATION_DAYS * DAY).length,
  };
}
function resStats(s: Scoped, r: Range) {
  const recBy = new Map(s.records.map((x) => [x.id, x]));
  const resolved = s.ress.filter((x) => x.outcome && within(x.resolvedAt, r));
  const byOutcome: Record<string, number> = {};
  for (const x of resolved) byOutcome[x.outcome!] = (byOutcome[x.outcome!] ?? 0) + 1;
  const days = cap(resolved.flatMap((x) => { const rec = recBy.get(x.conflictId); return rec ? [(x.resolvedAt!.getTime() - rec.createdAt.getTime()) / DAY] : []; }));
  const verified = s.ress.filter((x) => x.verification && CLOSED_VERIFY.includes(x.verification) && within(x.verifiedAt, r));
  const cleared = verified.filter((x) => x.verification === "cleared").length;
  const commits = s.ress.filter((x) => within(x.createdAt, r)).flatMap((x) => x.commitments);
  const doneC = commits.filter((c) => c.status === "done").length;
  const pendC = commits.filter((c) => c.status === "pending").length;
  const amended = s.ress.filter((x) => x.type === "amendment" && x.outcome && within(x.resolvedAt, r));
  const ams = s.ams.filter((a) => within(a.appliedAt, r));
  return {
    resolved: resolved.length, byOutcome, medianDays: percentile(days.values, 50), p90Days: percentile(days.values, 90), sampled: days.sampled,
    verifyCleared: cleared, verifyTotal: verified.length,
    needsFollowupNow: s.ress.filter((x) => x.active && x.status === "needs_followup").length,
    openCommitments: s.ress.flatMap((x) => x.commitments).filter((c) => c.status === "pending").length, commitDone: doneC, commitPending: pendC,
    amendmentsApplied: ams.length, meanShiftDays: ams.length ? round1(ams.reduce((n, a) => n + Math.abs(a.shiftDays), 0) / ams.length) : null,
    nationalShare: pct(amended.filter((x) => x.nationalStep).length, amended.length), amendedTotal: amended.length,
  };
}
function digOnce(s: Scoped, r: Range) {
  const realized = s.ress.filter((x) => x.outcome === "opportunity_realized" && within(x.resolvedAt, r));
  const recBy = new Map(s.records.map((x) => [x.id, x]));
  const meters = realized.reduce((n, x) => n + (recBy.get(x.conflictId)?.trenchMeters ?? 0), 0);
  const open = s.records.filter((x) => x.recordType === "opportunity" && live(x));
  return { realized: realized.length, realizedMeters: Math.round(meters), openCount: open.length, openMeters: Math.round(open.reduce((n, x) => n + (x.trenchMeters ?? 0), 0)) };
}

// ---------- health score ----------
export function health(components: Record<HealthComponent, number | null>, cases: number, minCases: number = DASH.MIN_CASES_FOR_SCORE) {
  const keys = Object.keys(HEALTH_WEIGHTS) as HealthComponent[];
  const included = keys.filter((k) => components[k] !== null);
  const wsum = included.reduce((n, k) => n + HEALTH_WEIGHTS[k], 0);
  const rows = keys.map((k) => {
    const excluded = components[k] === null;
    const weight = excluded || !wsum ? 0 : (HEALTH_WEIGHTS[k] / wsum) * 100;
    return { key: k, value: components[k], baseWeight: HEALTH_WEIGHTS[k], weight: round1(weight), contribution: excluded ? 0 : round1((weight * components[k]!) / 100), excluded };
  });
  const insufficient = cases < minCases || !included.length;
  const score = insufficient ? null : Math.round(rows.reduce((n, x) => n + x.contribution, 0));
  const grade: Grade | null = score === null ? null : GRADES.find((g) => score >= g.min)!.code;
  return { score, grade, cases, insufficientData: insufficient, components: rows, excluded: rows.filter((x) => x.excluded).map((x) => x.key) };
}

function healthComponents(s: Scoped, r: Range, agencyId: string | undefined, now: Date) {
  const ack = ackStats(s, r, agencyId, now);
  const resp = respStats(s, r, agencyId, now);
  const res = resStats(s, r);
  // Backlog and case counts are measured as of the period end (or now, for periods that include today), never "now" for a past period.
  const asOf = r.end.getTime() < now.getTime() ? r.end : now;
  const open = s.records.filter((x) => x.recordType === "conflict" && openAt(x, asOf));
  const old30 = open.filter((x) => ageDays(x, asOf) > DASH.BACKLOG_AGING_DAYS).length;
  const old14 = open.filter((x) => ageDays(x, asOf) > 14).length;
  const cases = s.records.filter((x) => openAt(x, asOf) || within(x.createdAt, r) || within(x.resolvedAt, r)).length;
  const commitDen = res.commitDone + res.commitPending;
  return {
    cases, ack, resp, res, open,
    components: {
      ackTimeliness: pct(ack.onTime, ack.total), responseTimeliness: pct(resp.onTime, resp.total),
      resolutionProgress: pct(res.resolved, res.resolved + old30),
      backlogHealth: open.length ? round1(100 - Math.min(100, (100 * old14) / Math.max(1, open.length))) : null,
      commitmentCompletion: commitDen ? pct(res.commitDone, commitDen) : null,
    } as Record<HealthComponent, number | null>,
  };
}

// ---------- KPIs ----------
function kpis(d: Data, r: Range, now: Date, at: Date, agencyId?: string): Metric[] {
  const s = forAgency(d, agencyId);
  const h = healthComponents(s, r, agencyId, now);
  const openAtT = s.records.filter((x) => x.recordType === "conflict" && openAt(x, at));
  const ch = openAtT.filter((x) => x.band === "critical" || x.band === "high");
  const co = coordStats(s, r, now);
  const dig = digOnce(s, r);
  const st = OPEN_LIKE.join(",");
  return [
    m("openConflicts", openAtT.length, "count", drill("conflicts", { status: st, recordType: "conflict" })),
    m("criticalHigh", ch.length, "count", drill("conflicts", { status: st, band: "critical,high" })),
    m("medianDaysToResolve", h.res.medianDays === null ? null : round1(h.res.medianDays), "days", drill("history", { outcome: Object.keys(h.res.byOutcome).join(",") }), h.res.resolved, null, h.res.sampled),
    m("agreementRate", pct(co.agreed, co.agreed + co.noAgreement), "percent", drill("coordination", { status: "agreed" }), co.agreed, co.agreed + co.noAgreement),
    m("ackTimeliness", h.components.ackTimeliness, "percent", drill("conflicts", { status: st }), h.ack.onTime, h.ack.total),
    m("responseTimeliness", h.components.responseTimeliness, "percent", drill("coordination", { tab: "all" }), h.resp.onTime, h.resp.total),
    m("digOnceMeters", dig.realizedMeters, "meters", drill("conflicts", { recordType: "opportunity" }), dig.realized, null),
  ];
}

// ---------- trends ----------
export function buckets(r: Range): { startDay: number; endDay: number }[] {
  const step = r.days <= 31 ? 1 : r.days <= 120 ? 7 : 30;
  const out: { startDay: number; endDay: number }[] = [];
  for (let d = r.startDay; d <= r.endDay; d += step) out.push({ startDay: d, endDay: Math.min(r.endDay, d + step - 1) });
  return out;
}
function trends(s: Scoped, r: Range, agencyId: string | undefined) {
  const conflicts = s.records.filter((x) => x.recordType === "conflict");
  return buckets(r).map((b) => {
    const br = mkRange(b.startDay, b.endDay);
    const openN = conflicts.filter((x) => openAt(x, br.end));
    const ack = ackStats(s, br, agencyId, br.end);
    const resp = respStats(s, br, agencyId, br.end);
    return {
      date: br.start.toISOString().slice(0, 10), created: conflicts.filter((x) => within(x.createdAt, br)).length, resolved: conflicts.filter((x) => within(x.resolvedAt, br)).length,
      open: openN.length, criticalHigh: openN.filter((x) => x.band === "critical" || x.band === "high").length, exposure: exposure(openN),
      ackTimeliness: pct(ack.onTime, ack.total), responseTimeliness: pct(resp.onTime, resp.total),
    };
  });
}

// ---------- funnel ----------
function funnel(s: Scoped, r: Range) {
  const cohort = s.records.filter((x) => x.recordType === "conflict" && within(x.createdAt, r));
  const reqBy = new Map<string, DReq[]>();
  for (const q of s.reqs) reqBy.set(q.conflictId, [...(reqBy.get(q.conflictId) ?? []), q]);
  const resBy = new Map(s.ress.filter((x) => x.outcome).map((x) => [x.conflictId, x]));
  const stage = (key: string, items: { at: Date | null; prev: Date }[], prevCount: number) => {
    const days = items.filter((i) => i.at).map((i) => (i.at!.getTime() - i.prev.getTime()) / DAY);
    return { key, count: items.length, ofPrevious: pct(items.length, prevCount), medianDays: percentile(days, 50) === null ? null : round1(percentile(days, 50)!) };
  };
  const recorded = cohort.map((x) => ({ at: x.createdAt, prev: x.createdAt }));
  const acked = cohort.flatMap((x) => {
    const req = x.agencies.filter((a) => a.required && a.active && !a.excluded);
    if (!req.length || !req.every((a) => a.ackStatus === "acknowledged" && a.ackAt)) return [];
    return [{ at: new Date(Math.max(...req.map((a) => a.ackAt!.getTime()))), prev: x.createdAt }];
  });
  const coord = cohort.flatMap((x) => { const q = reqBy.get(x.id); return q?.length ? [{ at: new Date(Math.min(...q.map((y) => y.createdAt.getTime()))), prev: x.createdAt }] : []; });
  const agreed = cohort.flatMap((x) => { const q = (reqBy.get(x.id) ?? []).filter((y) => y.status === "agreed" && y.closedAt); return q.length ? [{ at: new Date(Math.min(...q.map((y) => y.closedAt!.getTime()))), prev: x.createdAt }] : []; });
  const resolvedS = cohort.flatMap((x) => { const z = resBy.get(x.id); return z?.resolvedAt ? [{ at: z.resolvedAt, prev: x.createdAt }] : []; });
  const stages = [stage("recorded", recorded, recorded.length), stage("acknowledged", acked, recorded.length), stage("coordination", coord, acked.length || recorded.length), stage("agreed", agreed, coord.length), stage("resolved", resolvedS, agreed.length || recorded.length)];
  // Stage medians are measured from case creation; the per-stage step time is the difference of consecutive medians.
  const steps = stages.map((st, i) => {
    const before = stages.slice(0, i).reverse().find((x) => x.medianDays !== null);
    return { ...st, stepDays: i === 0 || st.medianDays === null || !before ? null : round1(Math.max(0, st.medianDays - before.medianDays!)) };
  });
  const candidates = steps.filter((x, i) => i > 0 && x.stepDays !== null);
  const slow = candidates.length ? candidates.reduce((a, b) => (b.stepDays! > a.stepDays! ? b : a)) : null;
  return steps.map((x) => ({ ...x, bottleneck: Boolean(slow && x.key === slow.key && slow.stepDays! > 0) }));
}

// ---------- spatial & calendar ----------
export function mapBins(records: DRecord[]) {
  const cells = new Map<string, DRecord[]>();
  for (const x of records.filter(live)) {
    const k = `${Math.floor(x.lng / DASH.MAP_GRID_DEG)}:${Math.floor(x.lat / DASH.MAP_GRID_DEG)}`;
    cells.set(k, [...(cells.get(k) ?? []), x]);
  }
  const p5 = (n: number) => Math.round(n * 1e5) / 1e5;
  return [...cells.entries()].map(([k, rs]) => {
    const [cx, cy] = k.split(":").map(Number) as [number, number];
    const bandCounts: Record<string, number> = {};
    for (const x of rs) bandCounts[x.band] = (bandCounts[x.band] ?? 0) + 1;
    const top = [...rs].sort((a, b) => b.score - a.score || a.conflictNo.localeCompare(b.conflictNo));
    return { center: [p5((cx + 0.5) * DASH.MAP_GRID_DEG), p5((cy + 0.5) * DASH.MAP_GRID_DEG)] as [number, number], count: rs.length, maxBand: top[0]!.band, bandCounts, topConflictNos: top.slice(0, 3).map((x) => x.conflictNo) };
  }).sort((a, b) => b.count - a.count || a.center[0] - b.center[0]).slice(0, DASH.MAP_CELL_CAP);
}
export function districtRanking(records: DRecord[]) {
  const by = new Map<string, DRecord[]>();
  for (const x of records.filter((y) => live(y) && y.recordType === "conflict" && y.district)) by.set(x.district!, [...(by.get(x.district!) ?? []), x]);
  return [...by.entries()].map(([district, rs]) => ({ district, open: rs.length, exposure: exposure(rs) })).sort((a, b) => b.exposure - a.exposure || b.open - a.open || a.district.localeCompare(b.district)).slice(0, DASH.TOP_N);
}
const coordinated = (id: string, d: Scoped) => d.reqs.some((q) => q.conflictId === id && ["awaiting_response", "negotiating", "agreed"].includes(q.status)) || d.ress.some((x) => x.conflictId === id && x.status !== "cancelled");
export function calendar(s: Scoped, now: Date) {
  const today = colomboDayNum(now);
  const recs = s.records.filter((x) => live(x) && x.overlapStart && x.overlapEnd);
  return Array.from({ length: DASH.CALENDAR_DAYS }, (_, i) => {
    const day = today + i;
    const active = recs.filter((x) => colomboDayNum(x.overlapStart!) <= day && colomboDayNum(x.overlapEnd!) >= day);
    const starts = recs.filter((x) => colomboDayNum(x.overlapStart!) === day);
    const top = [...active].sort((a, b) => (BAND_WEIGHT[b.band] ?? 0) - (BAND_WEIGHT[a.band] ?? 0) || b.score - a.score || a.conflictNo.localeCompare(b.conflictNo));
    return {
      date: dayStart(day).toISOString().slice(0, 10), starts: starts.length, ends: recs.filter((x) => colomboDayNum(x.overlapEnd!) === day).length, activeCount: active.length, maxBand: top[0]?.band ?? null,
      topConflictNos: top.slice(0, 3).map((x) => x.conflictNo), uncoordinated: i <= DASH.UNCOORDINATED_START_DAYS ? starts.filter((x) => !coordinated(x.id, s)).length : 0,
    };
  });
}

// ---------- signals (deterministic rules, no AI) ----------
export type Signal = { code: string; severity: "info" | "warning" | "critical"; params: Record<string, number | string>; drilldown: Drill };
const SEV = { critical: 0, warning: 1, info: 2 } as const;
export function signals(s: Scoped, now: Date, opts: { national: boolean; viewerAgencies: Set<string> | null; approvalsOverdue: number }): Signal[] {
  const out: Signal[] = [];
  const openC = s.records.filter((x) => x.recordType === "conflict" && live(x));
  const st = OPEN_LIKE.join(",");
  const soon = openC.filter((x) => (x.band === "critical" || x.band === "high") && x.overlapStart && x.overlapEnd && x.overlapStart.getTime() <= now.getTime() + DASH.UNCOORDINATED_START_DAYS * DAY && x.overlapEnd.getTime() >= now.getTime() && !coordinated(x.id, s)).length;
  if (soon) out.push({ code: "critical_starting_uncoordinated", severity: "critical", params: { count: soon }, drilldown: drill("conflicts", { status: st, band: "critical,high", startsWithinDays: String(DASH.UNCOORDINATED_START_DAYS) }) });
  const overdueBy = new Map<string, number>();
  for (const x of openC) for (const a of x.agencies) if (a.required && a.active && !a.excluded && a.ackStatus === "pending" && a.ackDueAt && a.ackDueAt < now && (!opts.viewerAgencies || opts.viewerAgencies.has(a.agencyId))) overdueBy.set(a.agencyId, (overdueBy.get(a.agencyId) ?? 0) + 1);
  for (const [agencyId, count] of [...overdueBy.entries()].sort((a, b) => b[1] - a[1])) if (count >= DASH.OVERDUE_CLUSTER_MIN) out.push({ code: "overdue_acks_cluster", severity: count >= 5 ? "critical" : "warning", params: { agencyId, count }, drilldown: drill("conflicts", { status: st, agencyId }) });
  const stuck = s.reqs.filter((q) => q.status === "negotiating" && now.getTime() - q.lastActivityAt.getTime() >= DASH.STUCK_NEGOTIATION_DAYS * DAY).length;
  if (stuck) out.push({ code: "stuck_negotiation", severity: "warning", params: { count: stuck, days: DASH.STUCK_NEGOTIATION_DAYS }, drilldown: drill("coordination", { status: "negotiating" }) });
  if (opts.approvalsOverdue) out.push({ code: "approvals_overdue", severity: "warning", params: { count: opts.approvalsOverdue }, drilldown: drill("approvals", { overdue: "true" }) });
  const follow = s.ress.filter((x) => x.active && x.status === "needs_followup").length;
  if (follow) out.push({ code: "verification_followup", severity: "info", params: { count: follow }, drilldown: drill("conflicts", { resolutionState: "needs_followup" }) });
  if (opts.national) {
    const esc = s.reqs.filter((q) => ACTIVE_REQ.includes(q.status) && q.escalated && q.escalatedAt && now.getTime() - q.escalatedAt.getTime() >= DASH.ESCALATION_UNATTENDED_DAYS * DAY && now.getTime() - q.lastActivityAt.getTime() >= DASH.ESCALATION_UNATTENDED_DAYS * DAY).length;
    if (esc) out.push({ code: "escalated_unattended", severity: "critical", params: { count: esc, days: DASH.ESCALATION_UNATTENDED_DAYS }, drilldown: drill("coordination", { tab: "escalated" }) });
  }
  const risen = s.records.filter((x) => x.outcome === "risk_accepted" && x.status === "resolved" && x.resolvedBand && (BAND_WEIGHT[x.band] ?? 0) > (BAND_WEIGHT[x.resolvedBand] ?? 0)).length;
  if (risen) out.push({ code: "risk_accepted_rising", severity: "warning", params: { count: risen }, drilldown: drill("history", { outcome: "risk_accepted" }) });
  const closing = s.records.filter((x) => x.recordType === "opportunity" && live(x) && x.overlapEnd && x.overlapEnd.getTime() >= now.getTime() && x.overlapEnd.getTime() <= now.getTime() + DASH.OPPORTUNITY_WINDOW_DAYS * DAY && (x.trenchMeters ?? 0) >= DASH.OPPORTUNITY_MIN_TRENCH_M).length;
  if (closing) out.push({ code: "opportunity_window_closing", severity: "info", params: { count: closing, days: DASH.OPPORTUNITY_WINDOW_DAYS }, drilldown: drill("conflicts", { recordType: "opportunity", status: st }) });
  const aged = openC.filter((x) => ageDays(x, now) > DASH.BACKLOG_AGING_DAYS).length;
  if (openC.length && aged / openC.length > DASH.BACKLOG_AGING_SHARE) out.push({ code: "backlog_aging", severity: "warning", params: { count: aged, percent: Math.round((aged / openC.length) * 100), days: DASH.BACKLOG_AGING_DAYS }, drilldown: drill("conflicts", { status: st, recordType: "conflict" }) });
  return out.sort((a, b) => SEV[a.severity] - SEV[b.severity]).slice(0, DASH.SIGNALS_MAX);
}

// ---------- scorecards ----------
export function scorecard(d: Data, agencyId: string, r: Range, now: Date) {
  const s = forAgency(d, agencyId);
  const h = healthComponents(s, r, agencyId, now);
  const co = coordStats(s, r, now);
  const hs = health(h.components, h.cases);
  return {
    agencyId, cases: h.cases, open: h.open.length, overdueAcks: h.ack.overdue, overdueResponses: h.resp.overdue,
    agreementRate: pct(co.agreed, co.agreed + co.noAgreement), medianAckHours: h.ack.medianH === null ? null : round1(h.ack.medianH), medianResponseHours: h.resp.medianH === null ? null : round1(h.resp.medianH),
    avgRounds: co.avgRounds, resolved: h.res.resolved, commitmentCompletion: h.components.commitmentCompletion, healthScore: hs.score, grade: hs.grade,
  };
}
export type Scorecard = ReturnType<typeof scorecard>;
export const BENCH_KEYS = ["agreementRate", "medianAckHours", "medianResponseHours", "avgRounds", "commitmentCompletion", "healthScore"] as const;
/** Anonymized medians over agencies with enough cases; null (never a guess) when the cohort is too small. */
export function benchmark(cards: Scorecard[]): { cohort: number; medians: Record<(typeof BENCH_KEYS)[number], number | null> } | null {
  const eligible = cards.filter((c) => c.cases >= DASH.MIN_CASES_FOR_SCORE);
  if (eligible.length < DASH.MIN_COHORT_FOR_BENCHMARK) return null;
  const medians = Object.fromEntries(BENCH_KEYS.map((k) => { const v = eligible.map((c) => c[k]).filter((x): x is number => x !== null); return [k, v.length ? round1(percentile(v, 50)!) : null]; })) as Record<(typeof BENCH_KEYS)[number], number | null>;
  return { cohort: eligible.length, medians };
}

// ---------- overview ----------
export type OverviewOpts = { range: Range; compare: boolean; now: Date; agencyId?: string; national: boolean; viewerAgencies: Set<string> | null; approvalsOverdue: number };
export function overview(d: Data, o: OverviewOpts) {
  const { range, now } = o;
  const s = forAgency(d, o.agencyId);
  const cur = kpis(d, range, now, range.end > now ? now : range.end, o.agencyId);
  const prevR = previousRange(range);
  const prev = o.compare ? kpis(d, prevR, now, prevR.end, o.agencyId) : null;
  const h = healthComponents(s, range, o.agencyId, now);
  const hs = health(h.components, h.cases);
  const open = h.open;
  const tr = trends(s, range, o.agencyId);
  const spark = tr.slice(-DASH.SPARK_POINTS);
  const sparkOf: Record<string, (number | null)[]> = { openConflicts: spark.map((x) => x.open), criticalHigh: spark.map((x) => x.criticalHigh), ackTimeliness: spark.map((x) => x.ackTimeliness), responseTimeliness: spark.map((x) => x.responseTimeliness) };
  const asOf = range.end.getTime() < now.getTime() ? range.end : now;
  const buckets = DASH.AGING_BUCKETS_DAYS.map(([lo, hi]) => {
    const inB = open.filter((x) => { const a = ageDays(x, asOf); return a >= lo && a <= hi; });
    const byBand: Record<string, number> = {};
    for (const x of inB) byBand[x.band] = (byBand[x.band] ?? 0) + 1;
    return { fromDays: lo, toDays: Number.isFinite(hi) ? hi : null, count: inB.length, byBand };
  });
  const byClass: Record<string, number> = {};
  const byBand: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const x of open) { byBand[x.band] = (byBand[x.band] ?? 0) + 1; byStatus[x.status] = (byStatus[x.status] ?? 0) + 1; for (const c of x.classes) byClass[c] = (byClass[c] ?? 0) + 1; }
  const oldest = [...open].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const dig = digOnce(s, range);
  return {
    kpis: cur.map((k, i) => ({ ...k, ...(prev ? { previous: prev[i]!.value, delta: delta(k.value, prev[i]!.value) } : {}), spark: sparkOf[k.key] ?? null })),
    funnel: funnel(s, range), trends: tr, backlogAging: { buckets, oldest: oldest ? { conflictNo: oldest.conflictNo, ageDays: ageDays(oldest, asOf) } : null },
    byBand, byClass, byStatus, newInRange: s.records.filter((x) => x.recordType === "conflict" && within(x.createdAt, range)).length, resolvedInRange: h.res.resolved,
    outcomes: { byOutcome: h.res.byOutcome, verification: { cleared: h.res.verifyCleared, total: h.res.verifyTotal, rate: pct(h.res.verifyCleared, h.res.verifyTotal) }, meanShiftDays: h.res.meanShiftDays, amendmentsApplied: h.res.amendmentsApplied, nationalApprovalShare: h.res.nationalShare },
    coordination: coordStats(s, range, now), timeliness: { ack: { medianHours: h.ack.medianH, p90Hours: h.ack.p90H, overdueNow: h.ack.overdue }, response: { medianHours: h.resp.medianH, overdueNow: h.resp.overdue } },
    digOnce: dig, health: hs, signals: signals(s, now, { national: o.national, viewerAgencies: o.viewerAgencies, approvalsOverdue: o.approvalsOverdue }),
    exposure: { index: exposure(open), openConflicts: open.length },
    topLists: {
      districts: districtRanking(s.records),
      longestOpen: [...open].filter((x) => x.band === "critical" || x.band === "high").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 5).map((x) => ({ conflictNo: x.conflictNo, band: x.band, ageDays: ageDays(x, now), status: x.status, id: x.id })),
    },
  };
}
export const topCritical = (records: DRecord[], now: Date, n = 5) =>
  records.filter((x) => live(x) && (x.band === "critical" || x.band === "high")).sort((a, b) => (BAND_WEIGHT[b.band] ?? 0) - (BAND_WEIGHT[a.band] ?? 0) || b.score - a.score).slice(0, n).map((x) => ({ conflictNo: x.conflictNo, band: x.band, classes: x.classes, start: x.overlapStart?.toISOString().slice(0, 10) ?? null, end: x.overlapEnd?.toISOString().slice(0, 10) ?? null, district: x.district, ageDays: ageDays(x, now) }));
