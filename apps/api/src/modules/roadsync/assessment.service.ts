/**
 * Steps 70-71 assessment pipeline and reads. Pair-level and symmetric: the stored pair carries one assessment
 * that both agencies see; only orientation and redaction differ per viewer. Formal conflict records,
 * notifications and coordination are Steps 72+ and are NOT created here.
 */
import mongoose from "mongoose";

import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { assessPair, corridorProfile, redactFactors, riskIndexOf, type PairAssessment, type ProfileItem } from "./assessment.engine.js";
import { ASSESSMENT, BAND_CODES, BAND_RANGE, RULE_VERSION, type Band, type ClassCode } from "./assessment.rules.js";
import { deactivatePairs, itemSide, loadItems, loadPairViews, type SourceItem, type SourceType } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { DETECTION, DETECTION_ACTIVE_WORK_STATUSES, type WORKING_HOURS } from "./roadsync.constants.js";
import { roadsyncEvents, type AssessmentCompletedEvent } from "./roadsync.events.js";
import { analyzeSchedules, colomboDay, dayToIso, type ScheduleSide, type TemporalResult } from "./schedule.analysis.js";
import { analyzeSpatial, hotspotOf, pointAlongLine, type AnyGeometry, type SpatialResult } from "./spatial.analysis.js";
import { readFilter } from "./work-requests.service.js";

type Oid = mongoose.Types.ObjectId;
const oid = (id: string) => new mongoose.Types.ObjectId(id);
const DAY_MS = 86_400_000;
const ELIGIBLE = [...DETECTION_ACTIVE_WORK_STATUSES];

type Override = { band: Band; reason: string; by: string; at: Date; inputsHash: string };
type Effective = { score: number; band: Band };
type Stored = PairAssessment & {
  ruleVersion: string;
  assessedAt: Date;
  inputsHash: string;
  hotspot: { type: "Point"; coordinates: [number, number] };
  override: Override | null;
  effective: Effective;
  overrideStale: boolean;
};
type PairDoc = {
  _id: Oid;
  aType: SourceType;
  aId: Oid;
  bType: SourceType;
  bId: Oid;
  agencyIds: Oid[];
  spatial: SpatialResult;
  temporal: TemporalResult;
  inputsHash: string;
  assessment?: Stored;
};

/** An override pins the band; the score is clamped into that band so the two never disagree. */
export function effectiveOf(score: number, band: Band, override: Pick<Override, "band"> | null): Effective {
  if (!override) return { score, band };
  const [lo, hi] = BAND_RANGE[override.band];
  return { band: override.band, score: Math.min(hi, Math.max(lo, score)) };
}

const pairFilter = (requestId: string) => ({ status: "active" as const, $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] });
const subjectIsA = (d: Pick<PairDoc, "aType" | "aId">, requestId: string) => d.aType === "work_request" && String(d.aId) === requestId;

async function loadPairs(requestId: string): Promise<{ docs: PairDoc[]; items: Map<string, SourceItem> }> {
  const docs = (await Candidate.find(pairFilter(requestId)).limit(ASSESSMENT.BATCH_MAX * 2).lean()) as unknown as PairDoc[];
  const refs = new Map<string, { type: SourceType; id: string }>();
  for (const d of docs) {
    refs.set(`${d.aType}:${d.aId}`, { type: d.aType, id: String(d.aId) });
    refs.set(`${d.bType}:${d.bId}`, { type: d.bType, id: String(d.bId) });
  }
  return { docs, items: await loadItems([...refs.values()]) };
}

// ---------- pipeline ----------

export type AssessmentOutcome = { state: "completed" | "running" | "draft" | "missing"; assessed: number; skipped: number; failed: number };

export async function runAssessment(requestId: string, opts: { runBy: string; force?: boolean }): Promise<AssessmentOutcome> {
  const now = new Date();
  const claimed = await WorkRequest.findOneAndUpdate(
    {
      _id: oid(requestId),
      status: { $in: ELIGIBLE },
      $or: [{ "assessment.status": { $ne: "running" } }, { "assessment.startedAt": { $lt: new Date(now.getTime() - ASSESSMENT.RUN_LOCK_TIMEOUT_MS) } }],
    },
    { $set: { "assessment.status": "running", "assessment.startedAt": now } },
    { new: true },
  ).select("_id").lean();
  if (!claimed) {
    const current = await WorkRequest.findById(requestId).select("status").lean();
    if (!current) return { state: "missing", assessed: 0, skipped: 0, failed: 0 };
    return { state: ELIGIBLE.includes(current.status as never) ? "running" : "draft", assessed: 0, skipped: 0, failed: 0 };
  }
  try {
    const { docs, items } = await loadPairs(requestId);
    const ops: mongoose.AnyBulkWriteOperation<never>[] = [];
    let skipped = 0;
    let failed = 0;
    for (const doc of docs) {
      try {
        const prev = doc.assessment;
        if (!opts.force && prev && prev.ruleVersion === RULE_VERSION && prev.inputsHash === doc.inputsHash) { skipped += 1; continue; }
        const a = items.get(`${doc.aType}:${doc.aId}`);
        const b = items.get(`${doc.bType}:${doc.bId}`);
        if (!a || !b) { failed += 1; continue; }
        const result = assessPair(itemSide(a), itemSide(b), doc.spatial, doc.temporal);
        const override = prev?.override ?? null;
        const [lng, lat] = hotspotOf(a.geometry, b.geometry, doc.spatial);
        const set: Record<string, unknown> = {
          "assessment.ruleVersion": RULE_VERSION, "assessment.assessedAt": now, "assessment.inputsHash": doc.inputsHash,
          "assessment.kind": result.kind, "assessment.classes": result.classes, "assessment.primaryClass": result.primaryClass,
          "assessment.score": result.score, "assessment.band": result.band, "assessment.floorApplied": result.floorApplied,
          "assessment.factors": result.factors, "assessment.mitigations": result.mitigations, "assessment.incompleteInputs": result.incompleteInputs,
          "assessment.inputsAssumed": result.inputsAssumed, "assessment.sequence": result.sequence,
          "assessment.estimatedSharedTrenchMeters": result.estimatedSharedTrenchMeters,
          "assessment.hotspot": { type: "Point", coordinates: [lng, lat] },
          "assessment.effective": effectiveOf(result.score, result.band, override),
          "assessment.overrideStale": Boolean(override && override.inputsHash !== doc.inputsHash),
        };
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } } as never);
      } catch {
        failed += 1; // one malformed pair never fails the run
      }
    }
    if (ops.length) await Candidate.bulkWrite(ops as never, { ordered: false });
    const counterparts = new Set<string>();
    for (const d of docs) {
      if (d.aType === "work_request" && String(d.aId) !== requestId) counterparts.add(String(d.aId));
      if (d.bType === "work_request" && String(d.bId) !== requestId) counterparts.add(String(d.bId));
    }
    const summary = await refreshAggregate(requestId);
    await WorkRequest.updateOne({ _id: oid(requestId) }, { $set: { "assessment.status": "completed" } }); // release our own claim
    for (const id of [...counterparts].slice(0, 50)) await refreshAggregate(id).catch(() => null);
    roadsyncEvents.emit("roadsyncAssessmentCompleted", {
      requestId,
      conflictCandidateIds: summary?.topCandidateIds ?? [],
      counts: summary?.counts ?? { conflicts: 0, opportunities: 0, advisories: 0 },
      maxBand: summary?.maxBand ?? null,
      riskIndex: summary?.riskIndex ?? 0,
    } satisfies AssessmentCompletedEvent);
    return { state: "completed", assessed: ops.length, skipped, failed };
  } catch {
    await WorkRequest.updateOne({ _id: oid(requestId) }, { $set: { "assessment.status": "failed", "assessment.assessedAt": new Date() } });
    return { state: "completed", assessed: 0, skipped: 0, failed: 1 };
  }
}

/** Recomputes the request-level aggregates from the stored pair assessments. Never re-runs detection. */
export async function refreshAggregate(requestId: string) {
  const wr = await WorkRequest.findById(requestId).select("geometry").lean();
  if (!wr) return null;
  const { docs, items } = await loadPairs(requestId);
  const rows = docs.filter((d) => d.assessment).map((d) => {
    const other = items.get(subjectIsA(d, requestId) ? `${d.bType}:${d.bId}` : `${d.aType}:${d.aId}`);
    return { id: String(d._id), a: d.assessment!, other };
  });
  const conflicts = rows.filter((r) => r.a.kind === "conflict");
  const byBand = Object.fromEntries(BAND_CODES.map((b) => [b, 0])) as Record<Band, number>;
  const byClass: Record<string, number> = {};
  for (const r of conflicts) byBand[r.a.effective.band] += 1;
  for (const r of rows.filter((x) => x.a.kind !== "advisory")) for (const c of r.a.classes) byClass[c] = (byClass[c] ?? 0) + 1;
  const scores = conflicts.map((r) => r.a.effective.score);
  const ranked = [...conflicts].sort((x, y) => y.a.effective.score - x.a.effective.score || x.id.localeCompare(y.id));
  const top = ranked[0];
  const summary = {
    ruleVersion: RULE_VERSION,
    counts: { conflicts: conflicts.length, opportunities: rows.filter((r) => r.a.kind === "opportunity").length, advisories: rows.filter((r) => r.a.kind === "advisory").length, byBand, byClass },
    maxScore: top ? top.a.effective.score : 0,
    maxBand: top ? top.a.effective.band : null,
    riskIndex: riskIndexOf(scores),
    topCandidateIds: ranked.slice(0, 5).map((r) => r.id),
    corridorProfile: corridorProfile(wr.geometry as unknown as AnyGeometry, conflicts.flatMap((r): ProfileItem[] => (r.other ? [{ id: r.id, score: r.a.effective.score, geometry: r.other.geometry, reachMeters: 25 }] : []))),
  };
  await WorkRequest.updateOne(
    { _id: oid(requestId) },
    { $set: { "assessment.ruleVersion": summary.ruleVersion, "assessment.assessedAt": new Date(), "assessment.counts": summary.counts, "assessment.maxScore": summary.maxScore, "assessment.maxBand": summary.maxBand, "assessment.riskIndex": summary.riskIndex, "assessment.corridorProfile": summary.corridorProfile, "assessment.topCandidateIds": summary.topCandidateIds } },
  );
  await WorkRequest.updateOne({ _id: oid(requestId), "assessment.status": { $ne: "running" } }, { $set: { "assessment.status": "completed" } });
  return summary;
}

let registered = false;
export function registerAssessmentSubscribers(): void {
  if (registered) return;
  registered = true;
  roadsyncEvents.on("roadsyncDetectionCompleted", (e: { requestId: string }) => {
    setImmediate(() => { void runAssessment(e.requestId, { runBy: "auto" }).catch(() => undefined); });
  });
  roadsyncEvents.on("workRequestCancelled", (e: { requestId: string }) => {
    void (async () => {
      const docs = (await Candidate.find({ $or: [{ aType: "work_request", aId: oid(e.requestId) }, { bType: "work_request", bId: oid(e.requestId) }] }).select("aType aId bType bId").lean()) as unknown as PairDoc[];
      await deactivatePairs(e.requestId);
      const others = new Set(docs.flatMap((d) => [d.aType === "work_request" ? String(d.aId) : "", d.bType === "work_request" ? String(d.bId) : ""]).filter((id) => id && id !== e.requestId));
      for (const id of [...others].slice(0, 50)) await refreshAggregate(id).catch(() => null);
    })().catch(() => undefined);
  });
}

// ---------- reads ----------

function outputAssessment(s: Stored, full: boolean, national: boolean, isA: boolean) {
  return {
    kind: s.kind,
    classes: s.classes,
    primaryClass: s.primaryClass,
    score: s.score,
    band: s.band,
    effective: s.effective,
    floorApplied: s.floorApplied,
    factors: full ? s.factors : redactFactors(s.factors),
    mitigations: s.mitigations,
    incompleteInputs: s.incompleteInputs,
    inputsAssumed: s.inputsAssumed,
    sequence: s.sequence ? { direction: (s.sequence.direction === "a_then_b") === isA ? "self_then_other" : "other_then_self", gapDays: s.sequence.gapDays } : null,
    estimatedSharedTrenchMeters: s.estimatedSharedTrenchMeters,
    hotspot: s.hotspot,
    overridden: Boolean(s.override),
    overrideStale: s.overrideStale,
    ...(national && s.override ? { override: { band: s.override.band, reason: s.override.reason, by: s.override.by, at: new Date(s.override.at).toISOString() } } : {}),
  };
}

export type AssessmentQuery = {
  band?: Band[];
  kind?: ("conflict" | "opportunity" | "advisory")[];
  class?: ClassCode[];
  agencyId?: string[];
  sourceType?: SourceType[];
  onlyConflicts: boolean;
  sort: "severity" | "distance" | "overlap" | "startDate";
  page: number;
  limit: number;
};

async function loadAssessed(actor: AuthenticatedActor, requestId: string) {
  const wr = await WorkRequest.findOne({ $and: [await readFilter(actor), { _id: oid(requestId) }] }).select("geometry status assessment plannedStart plannedEnd workType priority agencyId").lean();
  if (!wr) return null;
  const [views, scope] = await Promise.all([loadPairViews(actor, requestId), resolveResourceScope(actor)]);
  const ids = views.flatMap((v) => (v.candidateId ? [oid(v.candidateId)] : []));
  const docs = (await Candidate.find({ _id: { $in: ids } }).select("aType aId assessment inputsHash").lean()) as unknown as PairDoc[];
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const national = scope.kind === "platform";
  const items = views.flatMap((v) => {
    const doc = v.candidateId ? byId.get(v.candidateId) : undefined;
    if (!doc?.assessment) return [];
    const isA = subjectIsA(doc, requestId);
    return [{ candidateId: v.candidateId!, key: v.key, other: v.other, spatial: v.spatial, temporal: v.temporal, assessment: outputAssessment(doc.assessment, v.other.detailLevel === "full", national, isA), stale: v.stale, canOpen: v.canOpen }];
  });
  return { wr, items, national };
}

export async function getAssessment(actor: AuthenticatedActor, requestId: string, q: AssessmentQuery) {
  const loaded = await loadAssessed(actor, requestId);
  if (!loaded) return null;
  const { wr, items } = loaded;
  const stored = (wr.assessment ?? {}) as { status?: string; ruleVersion?: string; assessedAt?: Date; riskIndex?: number; maxBand?: Band | null; maxScore?: number; corridorProfile?: unknown; topCandidateIds?: string[] };
  const count = (kind: string) => items.filter((i) => i.assessment.kind === kind).length;
  const byBand = Object.fromEntries(BAND_CODES.map((b) => [b, items.filter((i) => i.assessment.kind === "conflict" && i.assessment.effective.band === b).length]));
  const byClass: Record<string, number> = {};
  for (const i of items.filter((x) => x.assessment.kind !== "advisory")) for (const c of i.assessment.classes) byClass[c] = (byClass[c] ?? 0) + 1;
  const kinds = q.kind ?? (q.onlyConflicts ? ["conflict"] : undefined);
  const filtered = items.filter((i) =>
    (!kinds || kinds.includes(i.assessment.kind)) &&
    (!q.band || q.band.includes(i.assessment.effective.band)) &&
    (!q.class || q.class.some((c) => i.assessment.classes.includes(c))) &&
    (!q.agencyId || q.agencyId.includes(i.other.agencyId)) &&
    (!q.sourceType || q.sourceType.includes(i.other.sourceType)));
  const sorters: Record<AssessmentQuery["sort"], (x: (typeof items)[number], y: (typeof items)[number]) => number> = {
    severity: (x, y) => y.assessment.effective.score - x.assessment.effective.score,
    distance: (x, y) => x.spatial.distanceMeters - y.spatial.distanceMeters,
    overlap: (x, y) => y.temporal.overlapDays - x.temporal.overlapDays,
    startDate: (x, y) => (x.other.plannedStart ?? "9").localeCompare(y.other.plannedStart ?? "9"),
  };
  filtered.sort((x, y) => sorters[q.sort](x, y) || y.assessment.effective.score - x.assessment.effective.score || x.spatial.distanceMeters - y.spatial.distanceMeters);
  const start = (q.page - 1) * q.limit;
  return {
    summary: {
      status: stored.status ?? "pending",
      ruleVersion: stored.ruleVersion ?? null,
      ruleStale: Boolean(stored.ruleVersion && stored.ruleVersion !== RULE_VERSION),
      currentRuleVersion: RULE_VERSION,
      assessedAt: stored.assessedAt ? new Date(stored.assessedAt).toISOString() : null,
      riskIndex: stored.riskIndex ?? 0,
      maxBand: stored.maxBand ?? null,
      maxScore: stored.maxScore ?? 0,
      counts: { conflicts: count("conflict"), opportunities: count("opportunity"), advisories: count("advisory"), byBand, byClass },
      corridorProfile: stored.corridorProfile ?? null,
      topCandidateIds: stored.topCandidateIds ?? [],
      anyStale: items.some((i) => i.stale),
    },
    items: filtered.slice(start, start + q.limit),
    total: filtered.length,
    page: q.page,
    limit: q.limit,
  };
}

/** Eligible request check used by the run route: 404 hidden, 409 draft. */
export async function runForActor(actor: AuthenticatedActor, requestId: string): Promise<"missing" | "draft" | AssessmentOutcome> {
  const visible = await WorkRequest.findOne({ $and: [await readFilter(actor), { _id: oid(requestId) }] }).select("status agencyId").lean();
  if (!visible) return "missing";
  if (!ELIGIBLE.includes(visible.status as never)) return "draft";
  const outcome = await runAssessment(requestId, { runBy: actor.userId, force: true });
  if (outcome.state === "completed") {
    await AuditLog.create({
      userId: oid(actor.userId), action: "work_request.assessment_run", resourceType: "WORK_REQUEST", resourceId: oid(requestId),
      newValue: { status: "COMPLETED", agencyId: visible.agencyId }, requestId: "assessment", agencyId: visible.agencyId,
    });
  }
  return outcome;
}

export async function getAssessmentMap(actor: AuthenticatedActor, requestId: string) {
  const loaded = await loadAssessed(actor, requestId);
  if (!loaded) return null;
  const { wr, items } = loaded;
  const profile = ((wr.assessment as { corridorProfile?: { fromM: number; toM: number; score: number }[] } | undefined)?.corridorProfile ?? []);
  const features: unknown[] = [];
  const geometry = wr.geometry as unknown as AnyGeometry;
  const bandOfScore = (score: number): Band => BAND_CODES.find((b) => score <= BAND_RANGE[b][1]) ?? "critical";
  for (const bin of profile) {
    if (bin.score <= 0 || geometry.type !== "LineString") continue;
    const mid = (bin.fromM + bin.toM) / 2;
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates: [pointAlongLine(geometry, bin.fromM), pointAlongLine(geometry, mid), pointAlongLine(geometry, bin.toM)] }, properties: { kind: "profile", score: bin.score, band: bandOfScore(bin.score), fromM: bin.fromM, toM: bin.toM } });
  }
  const ranked = [...items].sort((x, y) => y.assessment.effective.score - x.assessment.effective.score);
  for (const i of ranked) {
    const props = { candidateId: i.candidateId, band: i.assessment.effective.band, score: i.assessment.effective.score, kind: i.assessment.kind, primaryClass: i.assessment.primaryClass, distanceMeters: i.spatial.distanceMeters };
    if (i.assessment.kind !== "advisory") features.push({ type: "Feature", geometry: i.assessment.hotspot, properties: { ...props, feature: "hotspot" } });
    features.push({ type: "Feature", geometry: i.other.geometry, properties: { ...props, feature: "candidate", infrastructureType: i.other.infrastructureType } });
    if (i.spatial.closestPoints && i.spatial.distanceMeters > 0) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: i.spatial.closestPoints }, properties: { candidateId: i.candidateId, feature: "connector", kind: "connector" } });
  }
  return { type: "FeatureCollection" as const, features: features.slice(0, ASSESSMENT.MAP_FEATURE_CAP) };
}

// ---------- override ----------

async function aggregateSides(doc: PairDoc) {
  const ids = [doc.aType === "work_request" ? String(doc.aId) : "", doc.bType === "work_request" ? String(doc.bId) : ""].filter(Boolean);
  for (const id of ids) await refreshAggregate(id).catch(() => null);
}

/** National roles only (platform scope). Returns "forbidden" for any other role, "missing" for unknown or inactive pairs. */
export async function setOverride(actor: AuthenticatedActor, candidateId: string, input: { band: Band; reason: string } | null): Promise<"forbidden" | "missing" | "ok"> {
  if ((await resolveResourceScope(actor)).kind !== "platform") return "forbidden";
  const doc = (await Candidate.findOne({ _id: oid(candidateId), status: "active", "assessment.kind": { $exists: true } }).lean()) as unknown as PairDoc | null;
  if (!doc?.assessment) return "missing";
  const now = new Date();
  const override: Override | null = input ? { band: input.band, reason: input.reason, by: actor.userId, at: now, inputsHash: doc.inputsHash } : null;
  await Candidate.updateOne({ _id: doc._id }, { $set: { "assessment.override": override, "assessment.effective": effectiveOf(doc.assessment.score, doc.assessment.band, override), "assessment.overrideStale": false } });
  const subject = doc.aType === "work_request" ? doc.aId : doc.bId;
  await AuditLog.create({
    userId: oid(actor.userId), action: input ? "work_request.assessment_override_set" : "work_request.assessment_override_cleared", resourceType: "WORK_REQUEST", resourceId: subject,
    newValue: { status: (input?.band ?? doc.assessment.band).toUpperCase(), ...(input ? { reason: input.reason } : {}), agencyId: doc.agencyIds[0] }, requestId: "assessment", agencyId: doc.agencyIds[0],
  });
  await aggregateSides(doc);
  return "ok";
}

// ---------- what-if ----------

export type WhatIfBody = { shiftDays?: number; bufferMeters?: number; workingHours?: (typeof WORKING_HOURS)[number]; sweep?: boolean };
type Outcome = { riskIndex: number; maxBand: Band | null; conflictCount: number };

export async function whatIf(actor: AuthenticatedActor, requestId: string, body: WhatIfBody) {
  const wr = await WorkRequest.findOne({ $and: [await readFilter(actor), { _id: oid(requestId) }] }).select("status plannedStart plannedEnd").lean();
  if (!wr) return "missing" as const;
  if (!ELIGIBLE.includes(wr.status as never)) return "draft" as const;
  const { docs, items } = await loadPairs(requestId);
  const subjectItem = items.get(`work_request:${requestId}`);
  if (!subjectItem || !subjectItem.start || !subjectItem.end) return "missing" as const;
  const today = colomboDay(new Date());
  const pairs = docs.flatMap((d) => {
    const a = items.get(`${d.aType}:${d.aId}`);
    const b = items.get(`${d.bType}:${d.bId}`);
    return a && b ? [{ d, a, b, isA: subjectIsA(d, requestId) }] : [];
  });
  const buffer = body.bufferMeters;
  // Spatial facts do not depend on the shift, so they are computed once per buffer value.
  const spatialOf = (buf: number | undefined) => pairs.map((p) => buf === undefined ? p.d.spatial : analyzeSpatial({ geometry: p.a.geometry, bufferMeters: p.isA ? buf : 0 }, { geometry: p.b.geometry, bufferMeters: p.isA ? 0 : buf }, DETECTION.PERSIST_RADIUS_M));
  const sched = (s: { start: Date; end: Date; workingHours: ScheduleSide["workingHours"] }): ScheduleSide => ({ start: s.start, end: s.end, workingHours: s.workingHours, flexibleDays: 0, isEmergency: false });
  const evaluate = (shift: number, spatials: SpatialResult[], hours?: ScheduleSide["workingHours"]): Outcome => {
    const scores: number[] = [];
    pairs.forEach((p, i) => {
      const own = itemSide(subjectItem);
      const moved = { ...own, start: new Date(subjectItem.start!.getTime() + shift * DAY_MS), end: new Date(subjectItem.end!.getTime() + shift * DAY_MS), workingHours: hours ?? own.workingHours };
      const [aSide, bSide] = p.isA ? [moved, itemSide(p.b)] : [itemSide(p.a), moved];
      let temporal: TemporalResult = p.d.temporal;
      if (aSide.sourceType !== "asset" && bSide.sourceType !== "asset" && aSide.start && aSide.end && bSide.start && bSide.end) {
        temporal = analyzeSchedules(sched({ start: aSide.start, end: aSide.end, workingHours: aSide.workingHours }), sched({ start: bSide.start, end: bSide.end, workingHours: bSide.workingHours }));
      }
      const result = assessPair(aSide, bSide, spatials[i]!, temporal);
      if (result.kind === "conflict") scores.push(result.score);
    });
    const top = Math.max(0, ...scores);
    return { riskIndex: riskIndexOf(scores), maxBand: scores.length ? (BAND_CODES.find((b) => top <= BAND_RANGE[b][1]) ?? "critical") : null, conflictCount: scores.length };
  };
  const base = spatialOf(undefined);
  const current = evaluate(0, base);
  const spatials = buffer === undefined ? base : spatialOf(buffer);
  const shift = body.shiftDays ?? 0;
  const scenario = evaluate(shift, spatials, body.workingHours);
  const startDay = colomboDay(subjectItem.start);
  const dates = (s: number) => ({ shiftDays: s, newStart: new Date(subjectItem.start!.getTime() + s * DAY_MS).toISOString(), newEnd: new Date(subjectItem.end!.getTime() + s * DAY_MS).toISOString() });
  let curve: ({ shiftDays: number } & Outcome)[] | undefined;
  let firstClearShifts: { earlier: unknown; later: unknown } | undefined;
  if (body.sweep) {
    curve = [];
    for (let s = ASSESSMENT.WHATIF_MIN_DAYS; s <= ASSESSMENT.WHATIF_MAX_DAYS; s += 1) curve.push({ shiftDays: s, ...evaluate(s, spatials, body.workingHours) });
    const clear = (s: number) => startDay + s >= today && (curve!.find((c) => c.shiftDays === s)?.conflictCount ?? 1) === 0;
    const earlier = [...Array(-ASSESSMENT.WHATIF_MIN_DAYS).keys()].map((n) => -(n + 1)).find(clear);
    const later = [...Array(ASSESSMENT.WHATIF_MAX_DAYS).keys()].map((n) => n + 1).find(clear);
    const pack = (s: number | undefined) => (s === undefined ? null : { ...dates(s), withinFlexibility: false });
    firstClearShifts = { earlier: pack(earlier), later: pack(later) };
  }
  return {
    coverageNote: "stored_pairs_only" as const,
    range: [ASSESSMENT.WHATIF_MIN_DAYS, ASSESSMENT.WHATIF_MAX_DAYS] as const,
    flexibleDays: 0,
    earliestShiftDays: today - startDay,
    current,
    scenario: { ...scenario, ...dates(shift), bufferMeters: buffer ?? 0, workingHours: body.workingHours ?? "day" },
    ...(curve ? { curve } : {}),
    ...(firstClearShifts ? { firstClearShifts } : {}),
    startDate: dayToIso(startDay),
  };
}
