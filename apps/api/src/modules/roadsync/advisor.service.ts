/**
 * Step 80 advisor service. Compute endpoints write ONLY `roadsync_recommendations` (plus an audit row for refresh,
 * feedback and handoff). No events, notifications, ledger entries or changes to requests, pairs, records, coordination,
 * resolutions or scenarios. Snapshots are keyed by audience (agency or "national") and never shared across audiences.
 */
import mongoose from "mongoose";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Agency } from "../agencies/models/agency.model.js";
import { advise, inputsHashOf, type Advice, type Plan } from "./advisor.engine.js";
import { ADV, ADVISOR_VERSION, DISMISS_REASONS, FEEDBACK_ACTIONS } from "./advisor.rules.js";
import { assessPair, riskIndexOf } from "./assessment.engine.js";
import { bandOf, RULE_VERSION, type Band } from "./assessment.rules.js";
import { OPEN_LIKE } from "./conflict-record.rules.js";
import { audit, type Who } from "./conflict-record.service.js";
import { collect, INFRA_OF_WORK, itemSide, runDetectionPreview, subjectSide, type SubjectInput } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { Recommendation, nextRecNo, type RecommendationDocument } from "./models/recommendation.model.js";
import { analyzeSchedules, colomboDay, type ScheduleSide } from "./schedule.analysis.js";
import { loadWorld, type SimFail } from "./simulator.js";
import { accessFilter } from "./conflict-record.read.js";
import { DETECTION } from "./roadsync.constants.js";
import type { AnyGeometry } from "./spatial.analysis.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const DAY = 86_400_000;
const audienceOf = (w: Who) => (w.national ? "national" : String(w.actor.agencyId));
const iso = (d: Date) => d.toISOString();

type Feedback = { userId: unknown; agencyId: unknown; planKey: string | null; action: string; reasonCode: string | null; at: Date };
type Stored = { advice: Advice };

const locks = new Map<string, Promise<RecommendationDocument>>();

/** Latest feedback per plan decides whether it is dismissed for this audience. */
function dismissedOf(fb: Feedback[]): Map<string, Feedback> {
  const last = new Map<string, Feedback>();
  for (const f of fb) if (f.planKey) last.set(f.planKey, f);
  return new Map([...last].filter(([, f]) => f.action === "dismissed"));
}

async function names(ids: string[]): Promise<Record<string, string>> {
  const clean = [...new Set(ids)].filter((x) => /^[a-f0-9]{24}$/i.test(x));
  const rows = clean.length ? await Agency.find({ _id: { $in: clean.map(oid) } }).select("name").lean() : [];
  return Object.fromEntries(rows.map((a) => [String(a._id), a.name as string]));
}
const agencyIdsOf = (a: Advice): string[] => [
  ...a.plans.flatMap((p) => [...p.metrics.agenciesToCoordinate, ...p.moves.map((m) => m.agencyId)]),
  ...a.coordination.flatMap((c) => [...c.participants.map((x) => x.agencyId), ...(c.suggestedLead ? [c.suggestedLead.agencyId] : [])]),
  ...a.opportunities.flatMap((o) => (o.leadAgencyId ? [o.leadAgencyId] : [])), ...a.excluded.flatMap((e) => (e.agencyId ? [e.agencyId] : [])),
];

export type AdviceOut = {
  recNo: string | null; status: "fresh" | "terminal"; generatedAt: string; stale: false; cached: boolean; advisorVersion: string; audience: "national" | "agency";
  plans: Plan[]; excluded: Advice["excluded"]; coordination: Advice["coordination"]; opportunities: Advice["opportunities"]; coverage: Advice["coverage"]; baseline: Advice["baseline"];
  dismissed: { planKey: string; reasonCode: string | null; at: string; score: number; archetypes: string[] }[];
  confidence: "high" | "medium" | "low" | null; allowedActions: string[]; agencies: Record<string, string>; readOnly: boolean;
  requestPlan?: { planKey: string; requestId: string; shiftDays: number; fixes: number; of: number } | null;
};

export async function adviceFor(w: Who, conflictId: string, o: { refresh: boolean; canWrite: boolean; now?: Date }): Promise<AdviceOut | SimFail> {
  const loaded = await loadWorld(w, conflictId);
  if (!loaded.ok) return loaded;
  const { world } = loaded;
  const now = o.now ?? new Date();
  const audience = audienceOf(w);
  const allowed = o.canWrite ? ["refresh", "feedback", "handoff"] : [];
  const base = { advisorVersion: ADVISOR_VERSION, audience: (w.national ? "national" : "agency") as "national" | "agency", allowedActions: allowed, stale: false as const };

  if (!OPEN_LIKE.includes(world.rec.status)) {
    const empty = advise({ ...world, requests: new Map(), docs: [] }, { today: now, national: w.national });
    return { ...base, recNo: null, status: "terminal", generatedAt: iso(now), cached: false, plans: [], excluded: [], coordination: [], opportunities: [], coverage: empty.coverage, baseline: empty.baseline, dismissed: [], confidence: null, agencies: {}, readOnly: true };
  }

  const hash = inputsHashOf(world);
  const key = { "scope.type": "conflict", "scope.conflictId": oid(conflictId), "scope.requestId": null, audienceKey: audience, advisorVersion: ADVISOR_VERSION };
  const existing = await Recommendation.findOne({ ...key, status: "fresh" });
  const usable = existing && existing.inputsHash === hash && existing.expiresAt.getTime() > now.getTime() && !o.refresh;
  let doc: RecommendationDocument | null = usable ? existing : null;

  if (!doc) {
    const lockKey = `${conflictId}|${audience}`;
    let pending = locks.get(lockKey);
    if (!pending) {
      pending = (async () => {
        const cand = world.rec.recordType === "opportunity" ? ((await Candidate.findById(world.rec.candidateId).select("assessment.estimatedSharedTrenchMeters").lean()) as unknown as { assessment?: { estimatedSharedTrenchMeters?: number | null } } | null) : null;
        const advice = advise(world, { today: now, national: w.national, clock: () => performance.now(), trenchMeters: cand?.assessment?.estimatedSharedTrenchMeters ?? null });
        const carry = existing && existing.inputsHash === hash ? existing.feedback : [];
        if (existing) await Recommendation.updateMany({ ...key, status: "fresh" }, { $set: { status: "superseded" } });
        const recNo = await nextRecNo(now);
        return Recommendation.create({
          recNo, scope: { type: "conflict", conflictId: oid(conflictId), requestId: null }, audienceKey: audience, generatedForUserId: oid(w.actor.userId), advisorVersion: ADVISOR_VERSION, ruleVersion: RULE_VERSION, inputsHash: advice.inputsHash,
          generatedAt: now, expiresAt: new Date(now.getTime() + ADV.CACHE_TTL_HOURS * 3_600_000), status: "fresh", result: { advice } satisfies Stored, feedback: carry,
        });
      })().finally(() => locks.delete(lockKey));
      locks.set(lockKey, pending);
    }
    try { doc = await pending; } catch { doc = await Recommendation.findOne({ ...key, status: "fresh" }); }
    if (!doc) return { ok: false, status: 404, code: "not_found" };
    if (o.refresh) void audit({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId }, "advisor_refresh", { _id: oid(conflictId) }, "refreshed", doc.recNo);
  }

  const advice = (doc.result as Stored).advice;
  const hidden = dismissedOf(doc.feedback as unknown as Feedback[]);
  const plans = advice.plans.filter((p) => !hidden.has(p.planKey));
  const dismissed = advice.plans.filter((p) => hidden.has(p.planKey)).map((p) => ({ planKey: p.planKey, reasonCode: hidden.get(p.planKey)!.reasonCode, at: iso(hidden.get(p.planKey)!.at), score: p.score, archetypes: p.archetypes }));
  const tiers = plans.map((p) => p.confidence.tier);
  return {
    ...base, recNo: doc.recNo, status: "fresh", generatedAt: iso(doc.generatedAt), cached: Boolean(usable), plans, excluded: advice.excluded, coordination: advice.coordination, opportunities: advice.opportunities, coverage: advice.coverage, baseline: advice.baseline,
    dismissed, confidence: tiers.includes("low") ? "low" : tiers.includes("medium") ? "medium" : tiers.length ? "high" : null, agencies: await names(agencyIdsOf({ ...advice, plans })), readOnly: false,
  };
}

/** Request-scope: the advisor run of the request's most severe open conflict, plus the best single shift of THIS request. */
export async function requestAdvice(w: Who, requestId: string, o: { refresh: boolean; canWrite: boolean }): Promise<(AdviceOut & { conflictId: string }) | SimFail> {
  if (!/^[a-f0-9]{24}$/i.test(requestId)) return { ok: false, status: 404, code: "not_found" };
  const rid = oid(requestId);
  const rec = (await ConflictRecord.findOne({ $and: [accessFilter(w), { status: { $in: OPEN_LIKE }, recordType: "conflict", $or: [{ aType: "work_request", aId: rid }, { bType: "work_request", bId: rid }] }] }).sort({ "severity.current.score": -1, conflictNo: 1 }).select("_id").lean()) as unknown as { _id: mongoose.Types.ObjectId } | null;
  if (!rec) return { ok: false, status: 404, code: "not_found" };
  const out = await adviceFor(w, String(rec._id), o);
  if ("ok" in out) return out;
  const best = out.plans.filter((p) => p.moves.length === 1 && p.moves[0]!.requestId === requestId && p.moves[0]!.kind === "shift_request" && p.moves[0]!.mine)
    .map((p) => ({ p, fixes: out.baseline.conflictCount - p.afterSummary.conflictCount })).sort((a, b) => b.fixes - a.fixes || a.p.metrics.totalShiftDays - b.p.metrics.totalShiftDays || a.p.planKey.localeCompare(b.p.planKey))[0];
  return { ...out, conflictId: String(rec._id), requestPlan: best && best.fixes > 0 ? { planKey: best.p.planKey, requestId, shiftDays: best.p.moves[0]!.shiftDays ?? 0, fixes: best.fixes, of: out.baseline.conflictCount } : null };
}

/** Cheap read for tab badges and composer chips: reports an existing fresh snapshot for the viewer's audience, never computes one. */
export async function cachedSummary(w: Who, conflictId: string) {
  if (!/^[a-f0-9]{24}$/i.test(conflictId)) return null;
  const visible = await ConflictRecord.exists({ $and: [accessFilter(w), { _id: oid(conflictId) }] });
  if (!visible) return null;
  const doc = (await Recommendation.findOne({ "scope.type": "conflict", "scope.conflictId": oid(conflictId), "scope.requestId": null, audienceKey: audienceOf(w), advisorVersion: ADVISOR_VERSION, status: "fresh", expiresAt: { $gt: new Date() } }).lean()) as unknown as { recNo: string; feedback: Feedback[]; generatedAt: Date; result: Stored } | null;
  if (!doc) return { available: false as const };
  const hidden = dismissedOf(doc.feedback);
  const plans = doc.result.advice.plans.filter((p) => !hidden.has(p.planKey));
  const top = plans[0];
  return { available: plans.length > 0, recNo: doc.recNo, count: plans.length, generatedAt: doc.generatedAt.toISOString(), top: top ? { planKey: top.planKey, archetype: top.archetypes[0] ?? null, riskBefore: top.metrics.riskBefore, riskAfter: top.metrics.riskAfter } : null };
}

// ---------- feedback and handoff ----------
async function owned(w: Who, recNo: string) {
  if (!/^RSX-\d{4}-\d{6}$/.test(recNo)) return null;
  const doc = await Recommendation.findOne({ recNo, audienceKey: audienceOf(w) });
  if (!doc?.scope.conflictId) return null;
  const rec = (await ConflictRecord.findOne({ $and: [accessFilter(w), { _id: doc.scope.conflictId }] }).select("agencyIds status affectedAgencies").lean()) as unknown as { agencyIds: mongoose.Types.ObjectId[]; status: string; affectedAgencies: { agencyId: string; required: boolean; active: boolean; excluded?: unknown }[] } | null;
  return rec ? { doc, rec } : null;
}
const planOf = (doc: RecommendationDocument, planKey: string) => (doc.result as Stored).advice.plans.find((p) => p.planKey === planKey) ?? null;

export async function addFeedback(w: Who, recNo: string, input: { planKey: string | null; action: (typeof FEEDBACK_ACTIONS)[number] | "restored"; reasonCode?: string | undefined }): Promise<"ok" | "not_found" | "invalid"> {
  const got = await owned(w, recNo);
  if (!got) return "not_found";
  if (input.planKey && !planOf(got.doc, input.planKey)) return "invalid";
  if (input.action === "handoff_used") return "invalid";
  if (input.action === "dismissed" && !(DISMISS_REASONS as readonly string[]).includes(input.reasonCode ?? "")) return "invalid";
  if ((input.action === "dismissed" || input.action === "restored") && !input.planKey) return "invalid";
  await record(w, got.doc, input.planKey, input.action, input.action === "dismissed" ? input.reasonCode ?? null : null);
  return "ok";
}
async function record(w: Who, doc: RecommendationDocument, planKey: string | null, action: string, reasonCode: string | null) {
  await Recommendation.updateOne({ _id: doc._id, $expr: { $lt: [{ $size: "$feedback" }, ADV.FEEDBACK_CAP] } }, { $push: { feedback: { userId: oid(w.actor.userId), agencyId: oid(w.actor.agencyId), planKey, action, reasonCode, at: new Date() } } });
  await audit({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId }, "advisor_feedback", { _id: doc.scope.conflictId! }, action, `${doc.recNo} ${planKey ?? ""}`.trim());
}

type Draft = { moveIndex: number; conflictId: string } & Record<string, unknown>;
export type Handoff = { target: string; drafts: Draft[]; notEligible: { moveIndex: number; reason: string }[]; levers?: unknown[]; banner: { recNo: string; planKey: string } };

/** Prefill payloads for the EXISTING composer / studio / Scenario Lab. Creates nothing; records `handoff_used` and an audit row. */
export async function handoff(w: Who, recNo: string, planKey: string, target: "coordination" | "resolution" | "simulator"): Promise<Handoff | null> {
  const got = await owned(w, recNo);
  const plan = got ? planOf(got.doc, planKey) : null;
  if (!got || !plan) return null;
  const conflictId = String(got.doc.scope.conflictId);
  const open = OPEN_LIKE.includes(got.rec.status as never);
  const requiredParty = w.national || got.rec.affectedAgencies.some((a) => a.required && a.active && !a.excluded && w.scopeIds.has(a.agencyId));
  const drafts: Draft[] = [];
  const notEligible: Handoff["notEligible"] = [];
  plan.moves.forEach((m, moveIndex) => {
    if (target === "simulator") return;
    if (!open) return void notEligible.push({ moveIndex, reason: "record_not_open" });
    if (target === "coordination") {
      if (!requiredParty) return void notEligible.push({ moveIndex, reason: "not_required_party" });
      if (m.kind === "shift_request" && m.newStart && m.newEnd) drafts.push({ moveIndex, conflictId, type: "schedule_shift", proposal: { targetRequestId: m.requestId, newStart: m.newStart, newEnd: m.newEnd } });
      else if (m.kind === "set_hours" && m.workingHours) drafts.push({ moveIndex, conflictId, type: "working_hours", proposal: { targetRequestId: m.requestId, workingHours: m.workingHours } });
      else if (m.kind === "sequence_pair" && m.firstRequestId && m.gapDays !== null) drafts.push({ moveIndex, conflictId, type: "sequence_order", proposal: { firstRequestId: m.firstRequestId, minGapDays: m.gapDays } });
      return;
    }
    if (!m.mine) return void notEligible.push({ moveIndex, reason: "not_own_request" });
    if ((m.newStart && m.newEnd) || m.workingHours) drafts.push({ moveIndex, conflictId, type: "amendment", manual: { targetRequestId: m.requestId, ...(m.newStart && m.newEnd ? { schedule: { plannedStart: m.newStart, plannedEnd: m.newEnd } } : {}), ...(m.workingHours ? { workingHours: m.workingHours } : {}) } });
  });
  await record(w, got.doc, planKey, "handoff_used", null);
  await audit({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId }, "advisor_handoff", { _id: oid(conflictId) }, target, `${recNo} ${planKey}`);
  return { target, drafts, notEligible, ...(target === "simulator" ? { levers: plan.levers } : {}), banner: { recNo, planKey } };
}

// ---------- national stats: aggregate counts only ----------
export async function stats() {
  const total = await Recommendation.countDocuments({});
  const rows = await Recommendation.aggregate<{ _id: { action: string; reason: string | null }; n: number; agencies: mongoose.Types.ObjectId[] }>([
    { $unwind: "$feedback" }, { $group: { _id: { action: "$feedback.action", reason: "$feedback.reasonCode" }, n: { $sum: 1 }, agencies: { $addToSet: "$feedback.agencyId" } } },
  ]);
  const cohort = new Set(rows.flatMap((r) => r.agencies.map(String))).size;
  const count = (a: string) => rows.filter((r) => r._id.action === a).reduce((n, r) => n + r.n, 0);
  const suppressed = cohort < 3;
  const rate = (n: number) => (suppressed || total === 0 ? null : Math.round((n / total) * 1000) / 10);
  return {
    generated: total, feedbackAgencies: suppressed ? null : cohort, suppressed,
    helpfulRate: rate(count("helpful")), dismissRate: rate(count("dismissed")), handoffRate: rate(count("handoff_used")),
    dismissReasons: suppressed ? null : Object.fromEntries(rows.filter((r) => r._id.action === "dismissed").map((r) => [r._id.reason ?? "other", r.n])),
  };
}

// ---------- wizard Schedule Advisor (never persisted) ----------
export type PreviewIn = {
  geometry: AnyGeometry; bufferMeters: number; schedule: { plannedStart: string; plannedEnd: string; workingHours: "day" | "night" | "24h"; flexibleDays: number; isEmergency: boolean };
  subject?: { workType?: string; priority?: string; isEmergency?: boolean; trafficImpact?: { level: never; closureType?: string | null } } | undefined;
};
const sched = (s: { start: Date; end: Date; workingHours: ScheduleSide["workingHours"]; flexibleDays: number; isEmergency: boolean }): ScheduleSide => s;

/** Sweeps the draft's start date over the next ~6 months against the real nearby requests; outputs bands and counts only. */
export async function schedulePreview(actor: AuthenticatedActor, input: PreviewIn, now = new Date()) {
  const start0 = new Date(input.schedule.plannedStart), end0 = new Date(input.schedule.plannedEnd);
  const dur = end0.getTime() - start0.getTime();
  const workType = input.subject?.workType ?? null;
  const subject: SubjectInput = { id: null, agencyId: null, projectId: null, geometry: input.geometry, bufferMeters: input.bufferMeters, schedule: sched({ start: start0, end: end0, workingHours: input.schedule.workingHours, flexibleDays: input.schedule.flexibleDays, isEmergency: input.schedule.isEmergency }), infrastructureType: workType ? INFRA_OF_WORK[workType] ?? "OTHER" : "OTHER", workType, priority: input.subject?.priority ?? null };
  const found = await collect(subject, DETECTION.DEFAULT_VIEW_RADIUS_M, DETECTION.PREVIEW_MAX);
  const own = { ...subjectSide(subject), traffic: (input.subject?.trafficImpact as never) ?? null, isEmergency: input.subject?.isEmergency ?? input.schedule.isEmergency };
  const at = (offsetDays: number) => {
    const s = new Date(start0.getTime() + offsetDays * DAY), e = new Date(s.getTime() + dur);
    const scores = found.pairs.flatMap((p) => {
      const other = itemSide(p.item);
      if (!other.start || !other.end || p.item.type === "asset") return [];
      const mine = sched({ start: s, end: e, workingHours: input.schedule.workingHours, flexibleDays: input.schedule.flexibleDays, isEmergency: input.schedule.isEmergency });
      const theirs = sched({ start: other.start, end: other.end, workingHours: other.workingHours, flexibleDays: 0, isEmergency: false });
      const temporal = p.subjectIsA ? analyzeSchedules(mine, theirs) : analyzeSchedules(theirs, mine);
      const r = p.subjectIsA ? assessPair({ ...own, start: s, end: e }, other, p.spatial, temporal) : assessPair(other, { ...own, start: s, end: e }, p.spatial, temporal);
      return r.kind === "conflict" && r.score >= ADV.RECORD_MIN_SCORE ? [r.score] : [];
    });
    return { conflicts: scores.length, maxBand: (scores.length ? bandOf(Math.max(...scores)) : null) as Band | null, riskIndex: riskIndexOf(scores) };
  };
  const todayDay = colomboDay(now);
  const firstOffset = (input.schedule.isEmergency ? todayDay - 7 : todayDay) - colomboDay(start0);
  const sweep = Array.from({ length: ADV.WIZARD_SWEEP_DAYS + 1 }, (_, i) => firstOffset + i).map((offset) => ({ offset, ...at(offset) }));
  const windows: { from: string; to: string; maxBand: Band | null; conflicts: number }[] = [];
  for (const d of sweep) {
    const date = new Date(start0.getTime() + d.offset * DAY).toISOString().slice(0, 10);
    const last = windows[windows.length - 1];
    if (last && last.maxBand === d.maxBand) { last.to = date; last.conflicts = Math.max(last.conflicts, d.conflicts); } else windows.push({ from: date, to: date, maxBand: d.maxBand, conflicts: d.conflicts });
  }
  const current = at(0);
  const free = sweep.filter((d) => d.conflicts === 0);
  const nearest = (dir: 1 | -1) => free.filter((d) => (dir === 1 ? d.offset > 0 : d.offset < 0)).sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0]?.offset ?? null;
  const earlier = nearest(-1), later = nearest(1);
  const best = free.filter((d) => d.offset !== 0).sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || a.offset - b.offset)[0]?.offset ?? null;
  const within = (n: number | null) => n !== null && Math.abs(n) <= input.schedule.flexibleDays;
  // Redacted candidate list and the agencies you would coordinate with come from the existing preview pipeline.
  const preview = await runDetectionPreview(actor, { geometry: input.geometry, bufferMeters: input.bufferMeters, schedule: input.schedule, radiusMeters: DETECTION.DEFAULT_VIEW_RADIUS_M, excludeRequestId: null, subject: input.subject as never });
  const conflicts = preview.candidates.filter((c) => c.assessment.kind === "conflict" && c.assessment.score >= ADV.RECORD_MIN_SCORE).sort((a, b) => b.assessment.score - a.assessment.score);
  return {
    current: { ...current, candidates: conflicts.slice(0, 5).map((c) => ({ ref: c.other.ref, agencyName: c.other.agencyName, detailLevel: c.other.detailLevel, score: c.assessment.score, band: c.assessment.band })) },
    windows, none: current.conflicts === 0,
    nearestClear: { earlier: earlier === null ? null : { offsetDays: earlier, withinFlexibility: within(earlier) }, later: later === null ? null : { offsetDays: later, withinFlexibility: within(later) } },
    bestForDisruption: best === null ? null : { offsetDays: best, withinFlexibility: within(best) },
    agenciesToCoordinate: [...new Set(conflicts.map((c) => c.other.agencyName).filter((x): x is string => Boolean(x)))].sort(),
    truncated: found.truncated, coverageNote: "stored_pairs_only", generatedAt: new Date().toISOString(),
  };
}
