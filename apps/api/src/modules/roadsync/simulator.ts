/**
 * Step 79 conflict simulator. Re-runs the Step 71 scoring over the record's stored pairs with hypothetical levers
 * applied; nothing is persisted by `simulate` and nothing here can create, send or apply a change. Output is scores,
 * bands and counts only. Agency users change only their own requests; levers on other agencies' requests are accepted
 * as ASSUMPTIONS (flagged, and the scenario is then not actionable). National may vary any request. Geometry, priority,
 * the emergency flag and cost are never varied: the only inputs are dates, working hours, removal and a ghost copy.
 */
import mongoose from "mongoose";

import { assessPair, riskIndexOf } from "./assessment.engine.js";
import { bandOf, type Band } from "./assessment.rules.js";
import { canRead, type RecordPlain, type Who } from "./conflict-record.service.js";
import { itemSide, loadItems, type SourceItem } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { Scenario, type ScenarioDocument } from "./models/scenario.model.js";
import { termsToPlan } from "./resolution.engine.js";
import { analyzeSchedules, type ScheduleSide } from "./schedule.analysis.js";
import type { SpatialResult } from "./spatial.analysis.js";
import { TRAFFIC_MEASURES } from "./coordination.rules.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const DAY = 86_400_000;
export const SIM = { MAX_LEVERS: 8, MAX_GHOSTS: 2, MAX_SPAN_DAYS: 36 * 31, MAX_BUFFER_DAYS: 180, PAIR_CAP: 300, SAVED_PER_USER: 20, MIN_SCORE: 40 } as const;
const HOURS = ["day", "night", "24h"] as const;
type Hours = (typeof HOURS)[number];
const BANDS: Band[] = ["info", "low", "medium", "high", "critical"];

export type Lever =
  | { kind: "shift"; requestId: string; start: string; end: string }
  | { kind: "hours"; requestId: string; workingHours: Hours }
  | { kind: "buffer"; days: number }
  | { kind: "sequence"; firstRequestId: string; secondRequestId: string; gapDays: number }
  | { kind: "traffic"; requestId: string; measures: string[] }
  | { kind: "cancel"; requestId: string }
  | { kind: "ghost"; sourceRequestId: string; start: string; end: string; workingHours?: Hours }
  | { kind: "replay"; coordinationRequestId: string };
export const LEVER_KINDS = ["shift", "hours", "buffer", "sequence", "traffic", "cancel", "ghost", "replay"] as const;
export const SIM_HOURS = HOURS;
export const SIM_MEASURES = TRAFFIC_MEASURES;

type Snap = { score: number; band: Band; kind: string };
type PairDoc = { _id: mongoose.Types.ObjectId; aType: "work_request" | "project" | "asset"; aId: mongoose.Types.ObjectId; bType: "work_request" | "project" | "asset"; bId: mongoose.Types.ObjectId; spatial: SpatialResult; temporal: Parameters<typeof assessPair>[3] };
type Override = { start?: Date; end?: Date; workingHours?: Hours };

export type SimResult = {
  pair: { before: Snap; after: Snap };
  request: { before: { riskIndex: number; maxBand: Band | null; conflictCount: number }; after: { riskIndex: number; maxBand: Band | null; conflictCount: number } };
  thirdParty: { newConflicts: number; worsened: number; cleared: number };
  ghost: { pairs: number; newConflicts: number; maxBand: Band | null } | null;
  verdict: "clears" | "lowers" | "none" | "raises";
  levers: { kind: string; assumption: boolean; scoreEffect: "applied" | "none" | "removed" }[];
  commitments: { requestId: string; measures: string[] }[];
  warnings: string[];
  actionable: boolean;
  coverageNote: "stored_pairs_only";
};
export type SimFail = { ok: false; status: 400 | 403 | 404; code: string };
export type SimOk = { ok: true; result: SimResult; levers: Lever[] };

const sched = (s: { start: Date; end: Date; workingHours: ScheduleSide["workingHours"] }): ScheduleSide => ({ start: s.start, end: s.end, workingHours: s.workingHours, flexibleDays: 0, isEmergency: false });
const bad = (code: string): SimFail => ({ ok: false, status: 400, code });
const validDate = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

/** Pure: expand levers into per-request overrides, removals, ghosts and commitments. Returns an error code or the effects. */
export function expand(levers: Lever[], ctx: { requests: Map<string, { agencyId: string; start: Date | null; end: Date | null }>; mine: (agencyId: string) => boolean; replay: Map<string, Lever[]> }) {
  const over = new Map<string, Override>();
  const removed = new Set<string>();
  const ghosts: { sourceId: string; start: Date; end: Date; workingHours?: Hours }[] = [];
  const commitments: { requestId: string; measures: string[] }[] = [];
  const marks: SimResult["levers"] = [];
  const warnings = new Set<string>();
  const touched = new Set<string>();
  const known = (id: string) => ctx.requests.get(id);
  const apply = (id: string, patch: Override) => { if (touched.has(id) && (patch.start || patch.end) && (over.get(id)?.start || over.get(id)?.end)) warnings.add("lever_overridden"); touched.add(id); over.set(id, { ...over.get(id), ...patch }); };
  const mark = (kind: string, id: string | null, effect: SimResult["levers"][number]["scoreEffect"]) => marks.push({ kind, assumption: id ? !ctx.mine(known(id)!.agencyId) : false, scoreEffect: effect });
  const run = (list: Lever[]): string | null => {
    for (const l of list) {
      if (l.kind === "shift") {
        const r = known(l.requestId), s = validDate(l.start), e = validDate(l.end);
        if (!r) return "invalid_target";
        if (!s || !e || e < s || (e.getTime() - s.getTime()) / DAY > SIM.MAX_SPAN_DAYS) return "invalid_dates";
        apply(l.requestId, { start: s, end: e }); mark("shift", l.requestId, "applied");
      } else if (l.kind === "hours") {
        if (!known(l.requestId)) return "invalid_target";
        if (!HOURS.includes(l.workingHours)) return "invalid_hours";
        apply(l.requestId, { workingHours: l.workingHours }); mark("hours", l.requestId, "applied");
      } else if (l.kind === "sequence" || l.kind === "buffer") {
        const ids = [...ctx.requests.keys()];
        let first = l.kind === "sequence" ? l.firstRequestId : "", second = l.kind === "sequence" ? l.secondRequestId : "";
        const gap = l.kind === "sequence" ? l.gapDays : l.days;
        if (!Number.isInteger(gap) || gap < 0 || gap > SIM.MAX_BUFFER_DAYS) return "invalid_gap";
        if (l.kind === "buffer") {
          const [a, b] = ids;
          const ra = a ? known(a) : undefined, rb = b ? known(b) : undefined;
          if (!a || !b || !ra?.start || !rb?.start) return "invalid_target";
          [first, second] = ra.start <= rb.start ? [a, b] : [b, a];
        }
        const f = known(first), sc = known(second);
        if (!f || !sc || first === second || !sc.start || !sc.end) return "invalid_target";
        const firstEnd = over.get(first)?.end ?? f.end;
        if (!firstEnd) return "invalid_target";
        const dur = sc.end.getTime() - sc.start.getTime();
        const start = new Date(firstEnd.getTime() + (gap + 1) * DAY);
        apply(second, { start, end: new Date(start.getTime() + dur) }); mark(l.kind, second, "applied");
      } else if (l.kind === "traffic") {
        if (!known(l.requestId)) return "invalid_target";
        const m = [...new Set(l.measures)].filter((x) => (TRAFFIC_MEASURES as readonly string[]).includes(x));
        if (!m.length || m.length !== new Set(l.measures).size) return "invalid_measures";
        commitments.push({ requestId: l.requestId, measures: m }); mark("traffic", l.requestId, "none");
      } else if (l.kind === "cancel") {
        if (!known(l.requestId)) return "invalid_target";
        removed.add(l.requestId); mark("cancel", l.requestId, "removed");
      } else if (l.kind === "ghost") {
        const s = validDate(l.start), e = validDate(l.end);
        if (!known(l.sourceRequestId)) return "invalid_target";
        if (!s || !e || e < s || (e.getTime() - s.getTime()) / DAY > SIM.MAX_SPAN_DAYS) return "invalid_dates";
        if (l.workingHours && !HOURS.includes(l.workingHours)) return "invalid_hours";
        if (ghosts.length >= SIM.MAX_GHOSTS) return "too_many_ghosts";
        ghosts.push({ sourceId: l.sourceRequestId, start: s, end: e, ...(l.workingHours ? { workingHours: l.workingHours } : {}) }); mark("ghost", l.sourceRequestId, "applied");
      } else if (l.kind === "replay") {
        const inner = ctx.replay.get(l.coordinationRequestId);
        if (!inner) return "invalid_replay";
        const err = run(inner);
        if (err) return err;
        warnings.add("replayed_agreed_terms");
      } else return "invalid_lever";
    }
    return null;
  };
  const error = run(levers);
  return { error, over, removed, ghosts, commitments, marks, warnings: [...warnings] };
}

export async function simulate(w: Who, conflictId: string, levers: Lever[]): Promise<SimOk | SimFail> {
  if (!/^[a-f0-9]{24}$/i.test(conflictId)) return { ok: false, status: 404, code: "not_found" };
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("-notes -events").lean()) as unknown as RecordPlain | null;
  if (!rec || !canRead(w, rec)) return { ok: false, status: 404, code: "not_found" };
  if (levers.length > SIM.MAX_LEVERS) return bad("too_many_levers");

  const sides = [{ type: rec.aType, id: String(rec.aId), agencyId: rec.sides.a.agencyId }, { type: rec.bType, id: String(rec.bId), agencyId: rec.sides.b.agencyId }].filter((s) => s.type === "work_request");
  const docs = (await Candidate.find({ status: "active", $or: sides.flatMap((s) => [{ aType: "work_request", aId: oid(s.id) }, { bType: "work_request", bId: oid(s.id) }]) }).limit(SIM.PAIR_CAP).lean()) as unknown as PairDoc[];
  const refs = new Map<string, { type: "work_request" | "project" | "asset"; id: string }>();
  for (const d of docs) { refs.set(`${d.aType}:${d.aId}`, { type: d.aType, id: String(d.aId) }); refs.set(`${d.bType}:${d.bId}`, { type: d.bType, id: String(d.bId) }); }
  const items = await loadItems([...refs.values()]);

  const requests = new Map<string, { agencyId: string; start: Date | null; end: Date | null }>(sides.map((s) => {
    const snap = String(rec.aId) === s.id ? rec.sides.a : rec.sides.b;
    return [s.id, { agencyId: s.agencyId, start: snap.plannedStart ? new Date(snap.plannedStart) : null, end: snap.plannedEnd ? new Date(snap.plannedEnd) : null }] as [string, { agencyId: string; start: Date | null; end: Date | null }];
  }));
  for (const [id, r] of requests) { const it = items.get(`work_request:${id}`); if (it) { const base = itemSide(it); r.start = base.start ?? r.start; r.end = base.end ?? r.end; } }

  // Replayable agreed terms: only requests the viewer participates in (or any, for national).
  const replay = new Map<string, Lever[]>();
  const wantsReplay = levers.filter((l): l is Extract<Lever, { kind: "replay" }> => l.kind === "replay");
  for (const l of wantsReplay) {
    if (!/^[a-f0-9]{24}$/i.test(l.coordinationRequestId)) return bad("invalid_replay");
    const scope = w.national ? {} : { participantAgencyIds: { $in: [...w.scopeIds].map(oid) } };
    const q = (await CoordinationRequest.findOne({ $and: [{ _id: oid(l.coordinationRequestId), conflictId: rec._id, status: "agreed" }, scope] }).select("agreedTerms").lean()) as unknown as { agreedTerms: Parameters<typeof termsToPlan>[0] } | null;
    if (!q?.agreedTerms) return bad("invalid_replay");
    const plan = termsToPlan(q.agreedTerms, { aId: String(rec.aId), bId: String(rec.bId), aType: rec.aType, bType: rec.bType, aAgencyId: rec.sides.a.agencyId, bAgencyId: rec.sides.b.agencyId });
    replay.set(l.coordinationRequestId, plan.amendments.flatMap((a): Lever[] => [
      ...(a.schedule ? [{ kind: "shift" as const, requestId: a.workRequestId, start: a.schedule.plannedStart, end: a.schedule.plannedEnd }] : []),
      ...(a.workingHours ? [{ kind: "hours" as const, requestId: a.workRequestId, workingHours: a.workingHours }] : []),
    ]));
  }

  const mine = (agencyId: string) => w.national || w.scopeIds.has(agencyId);
  const fx = expand(levers, { requests, mine, replay });
  if (fx.error) return bad(fx.error);

  const sideOf = (item: SourceItem, apply: boolean) => {
    const base = itemSide(item);
    const o = apply && item.type === "work_request" ? fx.over.get(item.id) : undefined;
    return o ? { ...base, start: o.start ?? base.start, end: o.end ?? base.end, workingHours: o.workingHours ?? base.workingHours } : base;
  };
  const score = (d: PairDoc, a: ReturnType<typeof itemSide>, b: ReturnType<typeof itemSide>): Snap => {
    let temporal = d.temporal;
    if (a.sourceType !== "asset" && b.sourceType !== "asset" && a.start && a.end && b.start && b.end) temporal = analyzeSchedules(sched({ start: a.start, end: a.end, workingHours: a.workingHours }), sched({ start: b.start, end: b.end, workingHours: b.workingHours }));
    const r = assessPair(a, b, d.spatial, temporal);
    return { score: r.score, band: r.band, kind: r.kind };
  };
  const none: Snap = { score: 0, band: "info", kind: "advisory" };
  const rows = docs.flatMap((d) => {
    const a = items.get(`${d.aType}:${d.aId}`), b = items.get(`${d.bType}:${d.bId}`);
    if (!a || !b) return [];
    const gone = (a.type === "work_request" && fx.removed.has(a.id)) || (b.type === "work_request" && fx.removed.has(b.id));
    return [{ id: String(d._id), before: score(d, sideOf(a, false), sideOf(b, false)), after: gone ? none : score(d, sideOf(a, true), sideOf(b, true)) }];
  });
  const live = (x: Snap) => x.kind === "conflict" && x.score >= SIM.MIN_SCORE;
  const summarize = (pick: "before" | "after") => { const s = rows.filter((r) => r[pick].kind === "conflict").map((r) => r[pick].score); return { riskIndex: riskIndexOf(s), maxBand: s.length ? bandOf(Math.max(...s)) : null, conflictCount: s.length }; };
  const target = rows.find((r) => r.id === String(rec.candidateId));
  const third = rows.filter((r) => r.id !== String(rec.candidateId));

  // Ghost works: a copy of an existing request's stored pairs scored with the ghost's schedule (geometry is copied, never varied).
  let ghostOut: SimResult["ghost"] = null;
  if (fx.ghosts.length) {
    const scores: Snap[] = [];
    for (const g of fx.ghosts) {
      for (const d of docs) {
        const aIsSrc = d.aType === "work_request" && String(d.aId) === g.sourceId, bIsSrc = d.bType === "work_request" && String(d.bId) === g.sourceId;
        if (!aIsSrc && !bIsSrc) continue;
        const a = items.get(`${d.aType}:${d.aId}`), b = items.get(`${d.bType}:${d.bId}`);
        if (!a || !b) continue;
        const [src, other] = aIsSrc ? [a, b] : [b, a];
        if (other.type === "work_request" && other.id === g.sourceId) continue;
        const ghostSide = { ...itemSide(src), start: g.start, end: g.end, ...(g.workingHours ? { workingHours: g.workingHours } : {}) };
        const otherSide = sideOf(other, true);
        scores.push(aIsSrc ? score(d, ghostSide, otherSide) : score(d, otherSide, ghostSide));
      }
    }
    const lives = scores.filter(live);
    ghostOut = { pairs: scores.length, newConflicts: lives.length, maxBand: lives.length ? bandOf(Math.max(...lives.map((x) => x.score))) : null };
  }

  const pairBefore = target?.before ?? none, pairAfter = target?.after ?? none;
  const verdict = pairAfter.kind !== "conflict" && pairBefore.kind === "conflict" ? "clears" : pairAfter.score < pairBefore.score ? "lowers" : pairAfter.score > pairBefore.score ? "raises" : "none";
  const result: SimResult = {
    pair: { before: pairBefore, after: pairAfter }, request: { before: summarize("before"), after: summarize("after") },
    thirdParty: {
      newConflicts: third.filter((r) => !live(r.before) && live(r.after)).length,
      worsened: third.filter((r) => live(r.before) && live(r.after) && BANDS.indexOf(r.after.band) > BANDS.indexOf(r.before.band)).length,
      cleared: third.filter((r) => live(r.before) && !live(r.after)).length,
    },
    ghost: ghostOut, verdict, levers: fx.marks, commitments: fx.commitments,
    warnings: [...fx.warnings, ...(fx.commitments.length ? ["traffic_no_score_effect"] : []), ...(docs.length >= SIM.PAIR_CAP ? ["pairs_capped"] : [])],
    actionable: !fx.marks.some((m) => m.assumption) && fx.marks.length > 0, coverageNote: "stored_pairs_only",
  };
  return { ok: true, result, levers };
}

// ---------- saved scenarios (snapshots; visibility private | agency | national) ----------
export type Visibility = "private" | "agency" | "national";
const visibleTo = (w: Who, s: Pick<ScenarioDocument, "ownerUserId" | "ownerAgencyId" | "visibility">) =>
  String(s.ownerUserId) === w.actor.userId || (s.visibility === "agency" && w.scopeIds.has(String(s.ownerAgencyId))) || (s.visibility === "national" && w.national);
const view = (w: Who, s: ScenarioDocument & { levers: unknown[]; result: unknown }) => ({ id: String(s._id), name: s.name, visibility: s.visibility, mine: String(s.ownerUserId) === w.actor.userId, createdAt: s.createdAt.toISOString(), levers: s.levers, result: s.result });

export async function listScenarios(w: Who, conflictId: string) {
  if (!/^[a-f0-9]{24}$/i.test(conflictId)) return null;
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("agencyIds").lean()) as unknown as Pick<RecordPlain, "agencyIds"> | null;
  if (!rec || !canRead(w, rec)) return null;
  const rows = await Scenario.find({ conflictId: oid(conflictId) }).sort({ createdAt: -1 }).limit(100).lean();
  return rows.filter((s) => visibleTo(w, s)).map((s) => view(w, s as never));
}

export async function saveScenario(w: Who, conflictId: string, input: { name: string; visibility: Visibility; levers: Lever[] }): Promise<{ ok: true; id: string } | SimFail | { ok: false; status: 409; code: string }> {
  const sim = await simulate(w, conflictId, input.levers);
  if (!sim.ok) return sim;
  const mineCount = await Scenario.countDocuments({ conflictId: oid(conflictId), ownerUserId: oid(w.actor.userId) });
  if (mineCount >= SIM.SAVED_PER_USER) return { ok: false, status: 409, code: "limit_reached" };
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("conflictNo").lean()) as unknown as { conflictNo: string };
  // The result is recomputed here; a client-supplied snapshot is never trusted.
  const row = await Scenario.create({ conflictId: oid(conflictId), conflictNo: rec.conflictNo, name: input.name, visibility: input.visibility, ownerUserId: oid(w.actor.userId), ownerAgencyId: oid(w.actor.agencyId), levers: sim.levers, result: sim.result });
  return { ok: true, id: String(row._id) };
}

export async function deleteScenario(w: Who, id: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  const res = await Scenario.deleteOne({ _id: oid(id), ownerUserId: oid(w.actor.userId) });
  return res.deletedCount === 1;
}
