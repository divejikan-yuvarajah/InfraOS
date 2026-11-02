/**
 * Step 78 dashboard reads. Scope is applied in the data layer (the same `accessFilter` as the Inbox) BEFORE anything is
 * aggregated, and for agency users every agency-level input (acknowledgements, participants) is narrowed to their own
 * agencies. Nothing here returns free text. Shared "needs you now" numbers come from the SAME summary functions the
 * nav badges use, so they cannot disagree. Aggregates are computed on read; there are no new collections.
 */
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { accessFilter, csvCell, summary as recordSummary } from "./conflict-record.read.js";
import { OPEN_LIKE } from "./conflict-record.rules.js";
import type { Who } from "./conflict-record.service.js";
import { summary as coordinationSummary } from "./coordination.read.js";
import { benchmark, calendar, forAgency, mapBins, overview, previousRange, rangeOf, scorecard, topCritical, type Data, type DAm, type DRecord, type DReq, type DRes, type Metric, type Range, type Scorecard, type Signal } from "./dashboard.metrics.js";
import { DASH, type RangeKey } from "./dashboard.rules.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { Amendment, Resolution } from "./models/resolution.model.js";
import { approvalsSummary } from "./resolution.read.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const d = (v: unknown): Date | null => (v ? new Date(v as Date) : null);
const BOM = String.fromCharCode(0xfeff);

export type DashQuery = { range: RangeKey; from?: string; to?: string; compare: boolean; agencyId?: string; district?: string; refresh?: boolean };

// ---------- in-process TTL cache, keyed by scope so entries can never cross scope levels ----------
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, bypass: boolean, load: () => Promise<T>): Promise<{ value: T; cached: boolean; generatedAt: string }> {
  const hit = cache.get(key);
  const now = Date.now();
  if (!bypass && hit && now - hit.at < DASH.CACHE_TTL_SECONDS * 1000) return { value: hit.value as T, cached: true, generatedAt: new Date(hit.at).toISOString() };
  const value = await load();
  cache.set(key, { at: now, value });
  if (cache.size > 200) for (const [k, v] of cache) if (now - v.at >= DASH.CACHE_TTL_SECONDS * 1000) cache.delete(k);
  return { value, cached: false, generatedAt: new Date(now).toISOString() };
}
export const clearDashboardCache = () => cache.clear();
const scopeKey = (w: Who) => (w.national ? "national" : `agency:${[...w.scopeIds].sort().join(",")}`);
const queryKey = (q: DashQuery) => [q.range, q.from ?? "", q.to ?? "", q.compare ? "c" : "", q.agencyId ?? "", q.district ?? ""].join("|");

// ---------- scoped loading ----------
export function resolveRange(q: DashQuery, now = new Date()): Range | null { return rangeOf(q.range, q.from, q.to, now); }

type RecDoc = { _id: mongoose.Types.ObjectId; conflictNo: string; recordType: "conflict" | "opportunity"; status: string; candidateId: mongoose.Types.ObjectId; severity: { current: { band: string; score: number; classes?: string[] } }; createdAt: Date; closedAt: Date | null; resolution?: { outcome?: string | null; resolvedAt?: Date | null; resolvedBand?: string | null }; overlapWindow: { start: Date; end: Date } | null; district: string | null; hotspot: { coordinates: [number, number] }; affectedAgencies: { agencyId: string; required: boolean; active: boolean; excluded?: unknown; ack: { status: "pending" | "acknowledged"; at?: Date | null }; ackDueAt?: Date | null; addedAt: Date }[] };
const REC_SELECT = "conflictNo recordType status candidateId severity.current createdAt closedAt resolution.outcome resolution.resolvedAt resolution.resolvedBand overlapWindow district hotspot affectedAgencies";

/** Agency users only ever see their own agencies' entries; national keeps every agency. */
async function loadData(w: Who, q: Pick<DashQuery, "agencyId" | "district">, from: Date): Promise<Data> {
  const and: Record<string, unknown>[] = [accessFilter(w), { $or: [{ status: { $in: OPEN_LIKE } }, { createdAt: { $gte: from } }, { closedAt: { $gte: from } }, { "resolution.resolvedAt": { $gte: from } }] }];
  if (q.district) and.push({ district: q.district });
  const recs = (await ConflictRecord.find({ $and: and }).select(REC_SELECT).sort({ createdAt: -1 }).limit(DASH.FETCH_CAP).lean()) as unknown as RecDoc[];
  const opp = recs.filter((r) => r.recordType === "opportunity" && r.candidateId);
  const cands = opp.length ? ((await Candidate.find({ _id: { $in: opp.map((r) => r.candidateId) } }).select("assessment.estimatedSharedTrenchMeters").lean()) as unknown as { _id: mongoose.Types.ObjectId; assessment?: { estimatedSharedTrenchMeters?: number | null } }[]) : [];
  const trench = new Map(cands.map((c) => [String(c._id), c.assessment?.estimatedSharedTrenchMeters ?? null]));
  const mine = (id: string) => w.national || w.scopeIds.has(id);
  const ids = recs.map((r) => r._id);
  const records: DRecord[] = recs.map((r) => ({
    id: String(r._id), conflictNo: r.conflictNo, recordType: r.recordType, status: r.status, band: r.severity.current.band, score: r.severity.current.score, classes: r.severity.current.classes ?? [],
    createdAt: new Date(r.createdAt), closedAt: d(r.closedAt), resolvedAt: d(r.resolution?.resolvedAt), outcome: r.resolution?.outcome ?? null, resolvedBand: r.resolution?.resolvedBand ?? null,
    overlapStart: d(r.overlapWindow?.start), overlapEnd: d(r.overlapWindow?.end), district: r.district, lng: r.hotspot.coordinates[0], lat: r.hotspot.coordinates[1],
    agencies: r.affectedAgencies.filter((a) => mine(a.agencyId)).map((a) => ({ agencyId: a.agencyId, required: a.required, active: a.active, excluded: Boolean(a.excluded), ackStatus: a.ack.status, ackAt: d(a.ack.at), ackDueAt: d(a.ackDueAt), addedAt: new Date(a.addedAt) })),
    trenchMeters: trench.get(String(r.candidateId)) ?? null,
  }));
  if (!ids.length) return { records, reqs: [], ress: [], ams: [] };
  const reqScope = w.national ? {} : { participantAgencyIds: { $in: [...w.scopeIds].map(oid) } };
  const reqDocs = (await CoordinationRequest.find({ $and: [{ conflictId: { $in: ids } }, reqScope] }).select("conflictId status createdAt closedAt updatedAt escalated agreedTerms.round currentRound participants events").limit(DASH.FETCH_CAP).lean()) as unknown as { _id: mongoose.Types.ObjectId; conflictId: mongoose.Types.ObjectId; status: string; createdAt: Date; closedAt: Date | null; updatedAt: Date; escalated: { at?: Date | null } | null; agreedTerms: { round?: number } | null; currentRound: number; participants: DReq["participants"] }[];
  const reqs: DReq[] = reqDocs.map((x) => ({
    id: String(x._id), conflictId: String(x.conflictId), status: x.status, createdAt: new Date(x.createdAt), closedAt: d(x.closedAt), lastActivityAt: new Date(x.updatedAt), escalated: Boolean(x.escalated), escalatedAt: d(x.escalated?.at),
    agreedRound: x.agreedTerms?.round ?? null, rounds: x.currentRound,
    participants: x.participants.filter((p) => mine(p.agencyId)).map((p) => ({ agencyId: p.agencyId, required: Boolean(p.required), stance: p.stance, dueAt: d(p.dueAt), lastDecisionAt: d(p.lastDecisionAt) })),
  }));
  const resDocs = (await Resolution.find({ conflictId: { $in: ids } }).select("conflictId type status active createdAt outcome verification commitments.status approvals.step").limit(DASH.FETCH_CAP).lean()) as unknown as { conflictId: mongoose.Types.ObjectId; type: string; status: string; active: boolean; createdAt: Date; outcome: { code?: string; resolvedAt?: Date } | null; verification: { result?: string; assessedAt?: Date } | null; commitments: { status: string }[]; approvals: { step: string }[] }[];
  const ress: DRes[] = resDocs.map((x) => ({ conflictId: String(x.conflictId), type: x.type, status: x.status, active: x.active, createdAt: new Date(x.createdAt), outcome: x.outcome?.code ?? null, resolvedAt: d(x.outcome?.resolvedAt), verification: x.verification?.result ?? null, verifiedAt: d(x.verification?.assessedAt), commitments: (x.commitments ?? []).map((c) => ({ status: c.status })), nationalStep: (x.approvals ?? []).some((s) => s.step === "national") }));
  const amDocs = (await Amendment.find({ conflictId: { $in: ids }, status: "applied" }).select("conflictId appliedAt changes.schedule").limit(DASH.FETCH_CAP).lean()) as unknown as { conflictId: mongoose.Types.ObjectId; appliedAt: Date | null; changes: { schedule?: { before: { plannedStart: Date }; after: { plannedStart: Date } } } }[];
  const ams: DAm[] = amDocs.filter((a) => a.appliedAt).map((a) => ({ conflictId: String(a.conflictId), appliedAt: new Date(a.appliedAt!), shiftDays: a.changes.schedule ? (new Date(a.changes.schedule.after.plannedStart).getTime() - new Date(a.changes.schedule.before.plannedStart).getTime()) / 86_400_000 : 0 }));
  return { records, reqs, ress, ams };
}

async function agencyNames(ids: string[]): Promise<Map<string, string>> {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

// ---------- endpoints ----------
type Overview = ReturnType<typeof overview>;
async function overviewCached(w: Who, q: DashQuery, range: Range, bypass: boolean) {
  return cached(`overview|${scopeKey(w)}|${queryKey(q)}`, bypass, async () => {
    const now = new Date();
    const data = await loadData(w, q, previousRange(range).start);
    const o = overview(data, { range, compare: q.compare, now, national: w.national, viewerAgencies: w.national ? null : w.scopeIds, approvalsOverdue: 0, ...(q.agencyId ? { agencyId: q.agencyId } : {}) });
    // Names are resolved for national viewers only; agency viewers only ever see their own agency in signals.
    const names = await agencyNames(o.signals.flatMap((s) => (typeof s.params.agencyId === "string" ? [s.params.agencyId] : [])));
    const signals = o.signals.map((s) => (typeof s.params.agencyId === "string" ? { ...s, params: { ...s.params, agencyName: names.get(String(s.params.agencyId)) ?? "" } } : s));
    return { ...o, signals } as Overview;
  });
}

const SEV = { critical: 0, warning: 1, info: 2 } as const;
export async function dashboardOverview(w: Who, q: DashQuery, range: Range, canWrite: boolean) {
  const [{ value, cached: hit, generatedAt }, rec, coord, appr] = await Promise.all([
    overviewCached(w, q, range, Boolean(q.refresh && w.national)), recordSummary(w), coordinationSummary(w, canWrite), approvalsSummary(w),
  ]);
  const signals: Signal[] = [...value.signals as Signal[]];
  if (appr.overdue) signals.push({ code: "approvals_overdue", severity: "warning", params: { count: appr.overdue }, drilldown: { page: "approvals", query: { overdue: "true" } } });
  signals.sort((a, b) => SEV[a.severity] - SEV[b.severity]);
  return {
    scope: { level: w.national ? "national" : "agency", ...(w.national ? {} : { agencyId: w.actor.agencyId }) },
    range: { key: q.range, start: range.start.toISOString(), end: range.end.toISOString(), days: range.days }, generatedAt, cached: hit, ...value,
    signals: signals.slice(0, DASH.SIGNALS_MAX),
    attention: {
      needsMyAck: rec.needsMyAck, needsMyResponse: coord.needsMyResponse, needsMyApproval: appr.pending, startingSoon: rec.startingIn14d,
      overdue: { acks: rec.overdue, responses: coord.overdueForMe, approvals: appr.overdue }, overdueTotal: rec.overdue + coord.overdueForMe + appr.overdue,
    },
  };
}

export async function dashboardMap(w: Who, q: DashQuery, range: Range) {
  const out = await cached(`map|${scopeKey(w)}|${queryKey(q)}`, false, async () => {
    const data = forAgency(await loadData(w, q, range.start), q.agencyId);
    return { bins: mapBins(data.records), asOf: new Date().toISOString() };
  });
  return { ...out.value, generatedAt: out.generatedAt, cached: out.cached };
}
export async function dashboardCalendar(w: Who, q: DashQuery, range: Range) {
  const out = await cached(`calendar|${scopeKey(w)}|${queryKey(q)}`, false, async () => ({ days: calendar(forAgency(await loadData(w, q, range.start), q.agencyId), new Date()) }));
  return { ...out.value, generatedAt: out.generatedAt, cached: out.cached };
}

const SCORE_SORT = ["healthScore", "cases", "open", "overdueAcks", "overdueResponses", "agreementRate", "medianAckHours", "medianResponseHours", "avgRounds", "resolved", "commitmentCompletion"] as const;
export const SCORECARD_SORTS = SCORE_SORT;
async function nationalCards(q: DashQuery, range: Range): Promise<Scorecard[]> {
  return (await cached(`cards|national|${queryKey({ ...q, agencyId: undefined, compare: false })}`, false, async () => {
    const data = await loadData({ actor: undefined as never, national: true, scopeIds: new Set() }, { ...(q.district ? { district: q.district } : {}) }, range.start);
    const ids = [...new Set(data.records.flatMap((r) => r.agencies.filter((a) => a.active && !a.excluded).map((a) => a.agencyId)))];
    return ids.map((id) => scorecard(data, id, range, new Date()));
  })).value;
}
export async function dashboardAgencies(w: Who, q: DashQuery, range: Range, sort: (typeof SCORE_SORT)[number]) {
  const all = await nationalCards(q, range);
  if (w.national) {
    const names = await agencyNames(all.map((c) => c.agencyId));
    const rows = all.map((c) => ({ ...c, agencyName: names.get(c.agencyId) ?? null })).sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number) || (a.agencyName ?? "").localeCompare(b.agencyName ?? ""));
    return { level: "national" as const, items: rows, benchmark: benchmark(all) };
  }
  // Agency viewers: ONLY their own card (from scoped data) plus anonymized medians; never other agencies' names, ids or values.
  const own = (await cached(`card|${scopeKey(w)}|${queryKey({ ...q, compare: false })}`, false, async () => scorecard(await loadData(w, q, range.start), w.actor.agencyId, range, new Date()))).value;
  const bench = benchmark(all);
  return { level: "agency" as const, own, benchmark: bench, benchmarkUnavailable: bench ? null : ("cohort_too_small" as const) };
}

export async function dashboardBrief(w: Who, q: DashQuery, range: Range, canWrite: boolean) {
  const [ov, agencies, data] = await Promise.all([dashboardOverview(w, q, range, canWrite), dashboardAgencies(w, q, range, "healthScore"), loadData(w, q, range.start)]);
  return {
    scope: ov.scope, range: ov.range, generatedAt: ov.generatedAt, cached: ov.cached, kpis: ov.kpis.map(({ key, value, numerator, denominator, unit, definitionKey }) => ({ key, value, numerator, denominator, unit, definitionKey })),
    signals: ov.signals.map(({ code, severity, params }) => ({ code, severity, params })), topCritical: topCritical(forAgency(data, q.agencyId).records, new Date()),
    health: ov.health, scorecards: agencies.level === "national" ? agencies.items.slice(0, DASH.TOP_N) : { own: agencies.own, benchmark: agencies.benchmark },
  };
}

export async function dashboardCsv(w: Who, q: DashQuery, range: Range, canWrite: boolean): Promise<{ body: string; count: number }> {
  const ov = await dashboardOverview(w, q, range, canWrite);
  const ag = await dashboardAgencies(w, q, range, "healthScore");
  const period = `${range.start.toISOString().slice(0, 10)}..${range.end.toISOString().slice(0, 10)}`;
  const lines: unknown[][] = [["section", "metric", "value", "numerator", "denominator", "unit", "period"]];
  for (const k of ov.kpis as (Metric & { previous?: number | null })[]) lines.push(["kpi", k.key, k.value, k.numerator, k.denominator, k.unit, period]);
  lines.push(["health", "score", ov.health.score, null, null, "score", period]);
  const head = ["agency", "cases", "open", "overdueAcks", "overdueResponses", "agreementRate", "medianAckHours", "medianResponseHours", "avgRounds", "resolved", "commitmentCompletion", "healthScore"];
  lines.push([], head);
  const cards = ag.level === "national" ? ag.items : [{ ...ag.own, agencyName: null }];
  for (const c of cards) lines.push([(c as { agencyName: string | null }).agencyName ?? "own agency", c.cases, c.open, c.overdueAcks, c.overdueResponses, c.agreementRate, c.medianAckHours, c.medianResponseHours, c.avgRounds, c.resolved, c.commitmentCompletion, c.healthScore]);
  return { body: `${BOM}${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`, count: lines.length };
}

/** Districts that exist in the viewer's readable records; the only values the district filter accepts. */
export async function knownDistricts(w: Who): Promise<string[]> {
  return ((await ConflictRecord.distinct("district", accessFilter(w))) as (string | null)[]).filter((x): x is string => Boolean(x));
}
export async function agencyExists(id: string): Promise<boolean> { return Boolean(await Agency.exists({ _id: oid(id) })); }
