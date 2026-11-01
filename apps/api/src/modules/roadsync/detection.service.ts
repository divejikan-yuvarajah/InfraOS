/**
 * Steps 68-69 detection: finds nearby activity for a work request and records factual space + time
 * pairs. It never classifies, scores or creates conflicts (Steps 70+).
 */
import { createHash } from "node:crypto";
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope, type ResourceScope } from "../identity/authorization/resource-scope.js";
import { Project } from "../projects/models/project.model.js";
import { Candidate } from "./models/candidate.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { DETECTION, DETECTION_ACTIVE_PROJECT_STATUSES, DETECTION_ACTIVE_WORK_STATUSES } from "./roadsync.constants.js";
import { roadsyncEvents, type DetectionCompletedEvent } from "./roadsync.events.js";
import { analyzeSchedules, notApplicable, TIMED_RELATIONS, type ScheduleSide, type TemporalResult, type WorkingHours } from "./schedule.analysis.js";
import { analyzeSpatial, searchPolygon, simplifyForTransport, type AnyGeometry, type SpatialResult } from "./spatial.analysis.js";
import { readFilter } from "./work-requests.service.js";
import { assessPair, corridorProfile, redactFactors, riskIndexOf, sequenceOf, type AssessSide, type ProfileItem } from "./assessment.engine.js";
import { bandOf, RULE_VERSION, type TrafficLevel } from "./assessment.rules.js";

export type SourceType = "work_request" | "project" | "asset";
type Oid = mongoose.Types.ObjectId;

const INFRA_OF_WORK: Record<string, string> = {
  ROAD_RESURFACING: "ROAD", ROAD_EXCAVATION: "ROAD", PIPELINE_INSTALLATION: "WATER", ELECTRIC_CABLE_WORK: "ELECTRICITY",
  TELECOM_CABLE_WORK: "TELECOM", DRAINAGE_WORK: "DRAINAGE", BRIDGE_WORK: "BRIDGE", UTILITY_REPAIR: "OTHER", OTHER: "OTHER",
};
const SOURCE_FETCH_CAP = 1000;

/** A normalized item from any detection source. */
export type SourceItem = {
  type: SourceType;
  id: string;
  agencyId: string;
  infrastructureType: string;
  workType: string | null;
  status: string;
  ref: string;
  title: string;
  start: Date | null;
  end: Date | null;
  workingHours: WorkingHours;
  geometry: AnyGeometry;
  updatedAt: Date | null;
  /** Only ever exposed to same-agency and national users. */
  detail: Record<string, unknown>;
};

export type SubjectInput = {
  id: string | null;
  agencyId: string | null;
  projectId: string | null;
  geometry: AnyGeometry;
  bufferMeters: number;
  schedule: ScheduleSide | null;
  infrastructureType: string;
  workType?: string | null;
  priority?: string | null;
};

/** Engine view of a stored/normalized item. Traffic impact is not captured by any source yet, so it is null. */
export function itemSide(item: SourceItem): AssessSide {
  const priority = item.type === "work_request" && typeof item.detail.priority === "string" ? item.detail.priority : null;
  return { sourceType: item.type, workType: item.workType, infrastructureType: item.infrastructureType, traffic: null, priority, isEmergency: false, workingHours: item.workingHours, start: item.start, end: item.end };
}
const subjectSide = (s: SubjectInput): AssessSide => ({
  sourceType: "work_request", workType: s.workType ?? null, infrastructureType: s.infrastructureType, traffic: null, priority: s.priority ?? null,
  isEmergency: s.schedule?.isEmergency ?? false, workingHours: s.schedule?.workingHours ?? "day", start: s.schedule?.start ?? null, end: s.schedule?.end ?? null,
});

export type PairResult = { item: SourceItem; spatial: SpatialResult; temporal: TemporalResult; isCandidate: boolean };
export type SourceCheck = { source: SourceType; ok: boolean; error?: string };

/** Canonical order for work_request pairs: the smaller id is `a`, so a pair is stored once. */
export function pairRef(x: string, y: string): { a: string; b: string; swapped: boolean } {
  return x <= y ? { a: x, b: y, swapped: false } : { a: y, b: x, swapped: true };
}

const oid = (id: string) => new mongoose.Types.ObjectId(id);

// ---------- sources ----------

const scheduleOf = (item: SourceItem): ScheduleSide | null =>
  item.start && item.end ? { start: item.start, end: item.end, workingHours: item.workingHours, flexibleDays: 0, isEmergency: false } : null;

async function fetchWorkRequests(area: unknown, excludeId: string | null): Promise<SourceItem[]> {
  const filter: Record<string, unknown> = { status: { $in: [...DETECTION_ACTIVE_WORK_STATUSES] }, geometry: { $geoIntersects: { $geometry: area } } };
  if (excludeId) filter._id = { $ne: oid(excludeId) };
  const rows = await WorkRequest.find(filter).select("agencyId projectId workType status priority plannedStart plannedEnd geometry updatedAt").limit(SOURCE_FETCH_CAP).lean();
  return rows.map((r) => workItem(r as unknown as WorkRow));
}
type WorkRow = { _id: Oid; agencyId: Oid; projectId: Oid; workType: string; status: string; priority: string; plannedStart: Date; plannedEnd: Date; geometry: AnyGeometry; updatedAt?: Date };
export function workItem(r: WorkRow): SourceItem {
  const id = r._id.toString();
  return {
    type: "work_request", id, agencyId: r.agencyId.toString(), infrastructureType: INFRA_OF_WORK[r.workType] ?? "OTHER", workType: r.workType, status: r.status,
    ref: `WR-${id.slice(-8).toUpperCase()}`, title: r.workType.replaceAll("_", " ").toLowerCase(), start: r.plannedStart, end: r.plannedEnd, workingHours: "day",
    geometry: r.geometry, updatedAt: r.updatedAt ?? null, detail: { priority: r.priority, projectId: r.projectId.toString() },
  };
}

async function fetchProjects(area: unknown, excludeProjectId: string | null): Promise<SourceItem[]> {
  const filter: Record<string, unknown> = {
    status: { $in: [...DETECTION_ACTIVE_PROJECT_STATUSES] }, startDate: { $ne: null }, plannedEndDate: { $ne: null },
    geometry: { $geoIntersects: { $geometry: area } },
  };
  if (excludeProjectId) filter._id = { $ne: oid(excludeProjectId) };
  const rows = await Project.find(filter).select("projectCode title description projectType agencyId status startDate plannedEndDate geometry updatedAt").limit(SOURCE_FETCH_CAP).lean();
  return rows.map((r) => projectItem(r as unknown as ProjectRow));
}
type ProjectRow = { _id: Oid; projectCode: string; title: string; description?: string; projectType: string; agencyId: Oid; status: string; startDate: Date; plannedEndDate: Date; geometry: AnyGeometry; updatedAt?: Date };
function projectItem(r: ProjectRow): SourceItem {
  return {
    type: "project", id: r._id.toString(), agencyId: r.agencyId.toString(), infrastructureType: r.projectType, workType: null, status: r.status, ref: r.projectCode, title: r.title,
    start: r.startDate, end: r.plannedEndDate, workingHours: "day", geometry: r.geometry, updatedAt: r.updatedAt ?? null, detail: { description: r.description ?? null },
  };
}

async function fetchAssets(area: unknown): Promise<SourceItem[]> {
  const rows = await Asset.find({ geometry: { $geoIntersects: { $geometry: area } }, agencyId: { $ne: null } }).select("name assetType agencyId condition geometry updatedAt").limit(SOURCE_FETCH_CAP).lean();
  return rows.map((r) => assetItem(r as unknown as AssetRow));
}
type AssetRow = { _id: Oid; name: string; assetType: string; agencyId: Oid; condition: string; geometry: AnyGeometry; updatedAt?: Date };
function assetItem(r: AssetRow): SourceItem {
  return {
    type: "asset", id: r._id.toString(), agencyId: r.agencyId.toString(), infrastructureType: r.assetType, workType: null, status: r.condition, ref: `AST-${r._id.toString().slice(-8).toUpperCase()}`,
    title: r.name, start: null, end: null, workingHours: "day", geometry: r.geometry, updatedAt: r.updatedAt ?? null, detail: {},
  };
}

/** Reloads items by id for read responses (any status, so an inactive pair can still show its other side). */
export async function loadItems(refs: { type: SourceType; id: string }[]): Promise<Map<string, SourceItem>> {
  const ids = (t: SourceType) => refs.filter((r) => r.type === t).map((r) => oid(r.id));
  const [w, p, a] = await Promise.all([
    ids("work_request").length ? WorkRequest.find({ _id: { $in: ids("work_request") } }).select("agencyId projectId workType status priority plannedStart plannedEnd geometry updatedAt").lean() : [],
    ids("project").length ? Project.find({ _id: { $in: ids("project") } }).select("projectCode title description projectType agencyId status startDate plannedEndDate geometry updatedAt").lean() : [],
    ids("asset").length ? Asset.find({ _id: { $in: ids("asset") } }).select("name assetType agencyId condition geometry updatedAt").lean() : [],
  ]);
  const out = new Map<string, SourceItem>();
  for (const r of w) out.set(`work_request:${r._id}`, workItem(r as unknown as WorkRow));
  for (const r of p) if ((r as unknown as ProjectRow).startDate) out.set(`project:${r._id}`, projectItem(r as unknown as ProjectRow));
  for (const r of a) out.set(`asset:${r._id}`, assetItem(r as unknown as AssetRow));
  return out;
}

// ---------- pipeline ----------

function analyzePair(a: SubjectInput, b: SourceItem, radius: number, subjectIsA: boolean): { spatial: SpatialResult; temporal: TemporalResult } {
  const itemSchedule = scheduleOf(b);
  const subjectSchedule = a.schedule;
  const bSide = { geometry: b.geometry, bufferMeters: DETECTION.DEFAULT_BUFFER_M };
  const aSide = { geometry: a.geometry, bufferMeters: a.bufferMeters };
  // Canonical work_request orientation can put the other item first; swap sides, then keep results in (a, b) order.
  const [first, second] = subjectIsA ? [aSide, bSide] : [bSide, aSide];
  const spatial = analyzeSpatial(first, second, radius);
  let temporal: TemporalResult;
  if (b.type === "asset") temporal = notApplicable("permanent");
  else if (!subjectSchedule || !itemSchedule) temporal = notApplicable("unknown");
  else temporal = subjectIsA ? analyzeSchedules(subjectSchedule, itemSchedule) : analyzeSchedules(itemSchedule, subjectSchedule);
  // Step 70: surface work finishing before invasive work starts (7 < gap <= 180 d) is a candidate even though it is not "adjacent".
  const [sideA, sideB] = subjectIsA ? [subjectSide(a), itemSide(b)] : [itemSide(b), subjectSide(a)];
  const sequenceRisk = sequenceOf(sideA, sideB, temporal);
  if (sequenceRisk) temporal = { ...temporal, sequenceRisk };
  return { spatial, temporal };
}

const SEQUENCE_SPATIAL = ["intersecting", "footprint_overlap", "adjacent"];
const isCandidateOf = (s: SpatialResult, t: TemporalResult) =>
  s.relation !== "none" && (TIMED_RELATIONS.includes(t.relation) || !t.applicable || Boolean(t.sequenceRisk && SEQUENCE_SPATIAL.includes(s.relation)));

async function collect(subject: SubjectInput, radius: number, limit: number) {
  const area = searchPolygon(subject.geometry, subject.bufferMeters + radius);
  const sources: SourceCheck[] = [];
  const items: SourceItem[] = [];
  const run = async (source: SourceType, load: () => Promise<SourceItem[]>) => {
    try {
      items.push(...(await load()));
      sources.push({ source, ok: true });
    } catch {
      sources.push({ source, ok: false, error: "unavailable" });
    }
  };
  await run("work_request", () => fetchWorkRequests(area, subject.id));
  await run("project", () => fetchProjects(area, subject.projectId));
  await run("asset", () => fetchAssets(area));
  const pairs: (PairResult & { subjectIsA: boolean })[] = [];
  for (const item of items) {
    const subjectIsA = item.type !== "work_request" || subject.id === null || pairRef(subject.id, item.id).a === subject.id;
    const { spatial, temporal } = analyzePair(subject, item, radius, subjectIsA);
    if (spatial.relation === "none") continue;
    pairs.push({ item, spatial, temporal, isCandidate: isCandidateOf(spatial, temporal), subjectIsA });
  }
  pairs.sort((x, y) => x.spatial.distanceMeters - y.spatial.distanceMeters || x.item.id.localeCompare(y.item.id));
  return { sources, nearby: pairs.length, pairs: pairs.slice(0, limit), truncated: pairs.length > limit };
}

// ---------- orientation and redaction ----------

/** Swaps a/b-oriented facts into the subject's (self, other) perspective. */
export function orient(spatial: SpatialResult, temporal: TemporalResult, subjectIsA: boolean): { spatial: SpatialResult; temporal: TemporalResult } {
  if (subjectIsA) return { spatial, temporal };
  return {
    spatial: { ...spatial, sharedPctOfA: spatial.sharedPctOfB, sharedPctOfB: spatial.sharedPctOfA, closestPoints: spatial.closestPoints ? [spatial.closestPoints[1], spatial.closestPoints[0]] : null },
    temporal: {
      ...temporal,
      containedBy: temporal.containedBy === "a" ? "b" : temporal.containedBy === "b" ? "a" : null,
      overlapPctOfA: temporal.overlapPctOfB,
      overlapPctOfB: temporal.overlapPctOfA,
      shift: temporal.shift ? { a: temporal.shift.b, b: temporal.shift.a } : null,
    },
  };
}

export type Access = { scope: ResourceScope; agencyIds: Set<string>; canOpenIds: Set<string> };

export async function buildAccess(actor: AuthenticatedActor, items: SourceItem[]): Promise<Access> {
  const scope = await resolveResourceScope(actor);
  const agencyIds = new Set(scope.kind === "agencies" ? scope.agencyIds.map(String) : []);
  const canOpenIds = new Set<string>();
  const wr = items.filter((i) => i.type === "work_request").map((i) => oid(i.id));
  const pr = items.filter((i) => i.type === "project").map((i) => oid(i.id));
  const [w, p] = await Promise.all([
    wr.length ? WorkRequest.find({ $and: [await readFilter(actor), { _id: { $in: wr } }] }).select("_id").lean() : [],
    pr.length ? Project.find({ $and: [projectReadFilter(scope), { _id: { $in: pr } }] }).select("_id").lean() : [],
  ]);
  w.forEach((r) => canOpenIds.add(`work_request:${r._id}`));
  p.forEach((r) => canOpenIds.add(`project:${r._id}`));
  return { scope, agencyIds, canOpenIds };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * The ONLY projection of another item, used by preview, detail and map. Cross-agency items get a fixed
 * allow-list; description, contact, cost, attachments, notes and createdBy are never read into an item.
 */
export function projectOther(item: SourceItem, access: Access, agencyNames: Map<string, string>) {
  const full = access.scope.kind === "platform" || access.agencyIds.has(item.agencyId);
  return {
    sourceType: item.type,
    id: item.id,
    ref: item.ref,
    title: item.title,
    agencyId: item.agencyId,
    agencyName: agencyNames.get(item.agencyId) ?? null,
    infrastructureType: item.infrastructureType,
    workType: item.workType,
    status: item.status,
    plannedStart: iso(item.start),
    plannedEnd: iso(item.end),
    workingHours: item.start ? item.workingHours : null,
    trafficImpactLevel: null as string | null,
    geometry: simplifyForTransport(item.geometry),
    detailLevel: full ? ("full" as const) : ("redacted" as const),
    ...(full ? { detail: item.detail } : {}),
    canOpen: access.canOpenIds.has(`${item.type}:${item.id}`),
  };
}

async function agencyNamesOf(ids: string[]): Promise<Map<string, string>> {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

export type NearbyView = {
  key: string;
  candidateId: string | null;
  other: ReturnType<typeof projectOther>;
  spatial: SpatialResult;
  temporal: TemporalResult;
  isCandidate: boolean;
  canOpen: boolean;
  stale: boolean;
};

async function toViews(actor: AuthenticatedActor, rows: { item: SourceItem; spatial: SpatialResult; temporal: TemporalResult; isCandidate: boolean; candidateId?: string | null; stale?: boolean }[]): Promise<NearbyView[]> {
  const access = await buildAccess(actor, rows.map((r) => r.item));
  const names = await agencyNamesOf(rows.map((r) => r.item.agencyId));
  return rows.map((r) => {
    const other = projectOther(r.item, access, names);
    return { key: `${r.item.type}:${r.item.id}`, candidateId: r.candidateId ?? null, other, spatial: r.spatial, temporal: r.temporal, isCandidate: r.isCandidate, canOpen: other.canOpen, stale: r.stale ?? false };
  });
}

// ---------- preview ----------

export type PreviewInput = {
  geometry: AnyGeometry;
  bufferMeters: number;
  schedule: { plannedStart: string; plannedEnd: string; workingHours: WorkingHours; flexibleDays: number; isEmergency: boolean } | null;
  radiusMeters: number;
  excludeRequestId: string | null;
  /** Step 71: optional what-you-are-drafting fields. Missing fields are reported, never required. */
  subject?: { workType?: string; priority?: string; isEmergency?: boolean; trafficImpact?: { level: TrafficLevel; closureType?: string | null } } | null;
};

export async function runDetectionPreview(actor: AuthenticatedActor, input: PreviewInput) {
  const schedule: ScheduleSide | null = input.schedule
    ? { start: new Date(input.schedule.plannedStart), end: new Date(input.schedule.plannedEnd), workingHours: input.schedule.workingHours, flexibleDays: input.schedule.flexibleDays, isEmergency: input.schedule.isEmergency }
    : null;
  const workType = input.subject?.workType ?? null;
  const subject: SubjectInput = {
    id: null, agencyId: null, projectId: null, geometry: input.geometry, bufferMeters: input.bufferMeters, schedule,
    infrastructureType: workType ? INFRA_OF_WORK[workType] ?? "OTHER" : "OTHER", workType, priority: input.subject?.priority ?? null,
  };
  if (input.excludeRequestId) {
    const own = await WorkRequest.findOne({ $and: [await readFilter(actor), { _id: oid(input.excludeRequestId) }] }).select("projectId").lean();
    if (own) subject.projectId = String(own.projectId);
  }
  const found = await collect({ ...subject, id: input.excludeRequestId }, input.radiusMeters, DETECTION.PREVIEW_MAX);
  const oriented = found.pairs.map((p) => ({ ...p, ...orient(p.spatial, p.temporal, p.subjectIsA) }));
  const candidates = await toViews(actor, oriented);

  // Same engine as the persisted assessment, so what a user sees while drafting matches what is stored after submission.
  const own: AssessSide = { ...subjectSide(subject), traffic: input.subject?.trafficImpact ?? null, isEmergency: input.subject?.isEmergency ?? input.schedule?.isEmergency ?? false };
  const assessed = found.pairs.map((p, i) => {
    const [sa, sb] = p.subjectIsA ? [own, itemSide(p.item)] : [itemSide(p.item), own];
    const r = assessPair(sa, sb, p.spatial, p.temporal);
    const detailLevel = candidates[i]?.other.detailLevel;
    return { pair: p, r: { ...r, factors: detailLevel === "full" ? r.factors : redactFactors(r.factors) } };
  });
  const withAssessment = candidates.map((c, i) => {
    const r = assessed[i]!.r;
    return { ...c, assessment: { kind: r.kind, classes: r.classes, primaryClass: r.primaryClass, score: r.score, band: r.band, floorApplied: r.floorApplied, factors: r.factors, mitigations: r.mitigations, incompleteInputs: r.incompleteInputs, inputsAssumed: r.inputsAssumed } };
  });
  const conflicts = assessed.filter((x) => x.r.kind === "conflict");
  const scores = conflicts.map((x) => x.r.score);
  const top = Math.max(0, ...scores);
  const incomplete = new Set<string>(assessed.flatMap((x) => x.r.incompleteInputs));
  if (!workType) incomplete.add("workType");
  if (!input.subject?.trafficImpact) incomplete.add("trafficImpact");
  const assessment = {
    riskIndex: riskIndexOf(scores),
    maxBand: scores.length ? bandOf(top) : null,
    counts: { conflicts: conflicts.length, opportunities: assessed.filter((x) => x.r.kind === "opportunity").length, advisories: assessed.filter((x) => x.r.kind === "advisory").length },
    corridorProfile: corridorProfile(input.geometry, conflicts.map((x): ProfileItem => ({ id: `${x.pair.item.type}:${x.pair.item.id}`, score: x.r.score, geometry: x.pair.item.geometry, reachMeters: 25 + input.bufferMeters }))),
    incompleteInputs: [...incomplete],
    ruleVersion: RULE_VERSION,
  };
  return { summary: { ...summarize(candidates, found.nearby), assessment }, candidates: withAssessment, sourcesChecked: found.sources, truncated: found.truncated };
}

export function summarize(views: NearbyView[], nearby: number) {
  const overlapping = views.filter((v) => ["identical", "contained", "partial_overlap"].includes(v.temporal.relation)).length;
  const nearInTime = views.filter((v) => v.temporal.relation === "adjacent").length;
  const closest = views.length ? Math.min(...views.map((v) => v.spatial.distanceMeters)) : null;
  return { nearby, candidates: views.filter((v) => v.isCandidate).length, overlapping, nearInTime, agencies: new Set(views.map((v) => v.other.agencyId)).size, closestMeters: closest };
}

// ---------- persisted run ----------

const ELIGIBLE = [...DETECTION_ACTIVE_WORK_STATUSES];

export type RunOutcome =
  | { state: "completed" | "running"; detection: unknown }
  | { state: "draft" }
  | { state: "missing" };

export async function runDetection(requestId: string, opts: { runBy: string; radius?: number }): Promise<RunOutcome> {
  const radius = opts.radius ?? DETECTION.PERSIST_RADIUS_M;
  const now = new Date();
  const claimed = await WorkRequest.findOneAndUpdate(
    {
      _id: oid(requestId),
      status: { $in: ELIGIBLE },
      $or: [{ "detection.status": { $ne: "running" } }, { "detection.startedAt": { $lt: new Date(now.getTime() - DETECTION.RUN_LOCK_TIMEOUT_MS) } }],
    },
    { $set: { "detection.status": "running", "detection.startedAt": now, "detection.runBy": opts.runBy }, $unset: { "detection.error": 1 } },
    { new: true },
  ).lean();
  if (!claimed) {
    const current = await WorkRequest.findById(requestId).select("status detection").lean();
    if (!current) return { state: "missing" };
    if (!ELIGIBLE.includes(current.status as never)) return { state: "draft" };
    return { state: "running", detection: current.detection ?? null };
  }
  try {
    const subject: SubjectInput = {
      id: requestId, agencyId: String(claimed.agencyId), projectId: String(claimed.projectId), geometry: claimed.geometry as unknown as AnyGeometry, bufferMeters: DETECTION.DEFAULT_BUFFER_M,
      schedule: { start: claimed.plannedStart, end: claimed.plannedEnd, workingHours: "day", flexibleDays: 0, isEmergency: false }, infrastructureType: INFRA_OF_WORK[claimed.workType] ?? "OTHER",
      workType: claimed.workType, priority: claimed.priority,
    };
    const found = await collect(subject, radius, DETECTION.MAX_CANDIDATES_PERSISTED);
    const total = found.sources.length;
    if (found.sources.every((s) => !s.ok) && total > 0) throw new Error("all sources failed");

    const existing = await Candidate.find({ status: "active", $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).select("aType aId bType bId inputsHash").lean();
    const keyOf = (aId: string, bType: string, bId: string) => `${aId}|${bType}|${bId}`;
    const existingHash = new Map(existing.map((e) => [keyOf(String(e.aId), e.bType, String(e.bId)), e.inputsHash]));
    const seen = new Set<string>();
    const ops: mongoose.AnyBulkWriteOperation<never>[] = [];
    const candidateKeys: string[] = [];
    for (const p of found.pairs) {
      const ref = p.item.type === "work_request" ? pairRef(requestId, p.item.id) : { a: requestId, b: p.item.id };
      const key = keyOf(ref.a, p.item.type, ref.b);
      seen.add(key);
      const aAgency = p.subjectIsA ? subject.agencyId! : p.item.agencyId;
      const bAgency = p.subjectIsA ? p.item.agencyId : subject.agencyId!;
      const aInfra = p.subjectIsA ? subject.infrastructureType : p.item.infrastructureType;
      const bInfra = p.subjectIsA ? p.item.infrastructureType : subject.infrastructureType;
      const inputsHash = createHash("sha1").update(JSON.stringify([subject.geometry, subject.bufferMeters, claimed.plannedStart, claimed.plannedEnd, p.item.geometry, p.item.start, p.item.end, p.item.status, radius, subject.workType, p.item.workType, subject.priority, p.item.detail.priority ?? null])).digest("hex");
      if (existingHash.get(key) === inputsHash) continue;
      ops.push({
        updateOne: {
          filter: { aType: "work_request", aId: oid(ref.a), bType: p.item.type, bId: oid(ref.b) },
          update: {
            $set: {
              agencyIds: [oid(aAgency), oid(bAgency)], aInfrastructureType: aInfra, bInfrastructureType: bInfra,
              aWorkType: p.subjectIsA ? subject.workType ?? null : p.item.workType, bWorkType: p.subjectIsA ? p.item.workType : subject.workType ?? null, spatial: p.spatial, temporal: p.temporal, isCandidate: p.isCandidate,
              status: "active", inactiveReason: null, detectedBy: opts.runBy, sourceUpdatedAt: p.item.updatedAt, inputsHash,
            },
            $setOnInsert: { detectedAt: now },
          },
          upsert: true,
        },
      } as never);
      if (p.isCandidate) candidateKeys.push(key);
    }
    for (const e of existing) {
      if (!seen.has(keyOf(String(e.aId), e.bType, String(e.bId)))) {
        ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { status: "inactive", inactiveReason: "out_of_radius" } } } } as never);
      }
    }
    if (ops.length) await Candidate.bulkWrite(ops as never, { ordered: false });

    const active = await Candidate.find({ status: "active", isCandidate: true, $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).select("_id agencyIds").lean();
    const agencies = new Set(found.pairs.filter((p) => p.isCandidate).map((p) => p.item.agencyId));
    const counts = { nearby: found.nearby, candidates: active.length, agencies: agencies.size, truncated: found.truncated };
    const done = await WorkRequest.findByIdAndUpdate(
      requestId,
      { $set: { "detection.status": "completed", "detection.completedAt": new Date(), "detection.counts": counts, "detection.sourcesChecked": found.sources } },
      { new: true },
    ).select("detection").lean();
    const event: DetectionCompletedEvent = { requestId, candidateIds: active.map((a) => String(a._id)), counts };
    roadsyncEvents.emit("roadsyncDetectionCompleted", event);
    return { state: "completed", detection: done?.detection ?? null };
  } catch {
    const failed = await WorkRequest.findByIdAndUpdate(requestId, { $set: { "detection.status": "failed", "detection.completedAt": new Date(), "detection.error": "Detection could not be completed." } }, { new: true }).select("detection").lean();
    return { state: "completed", detection: failed?.detection ?? null };
  }
}

/** Marks every pair involving a request inactive (cancellation). */
export async function deactivatePairs(requestId: string, reason: "request_cancelled" | "source_removed" = "request_cancelled"): Promise<number> {
  const res = await Candidate.updateMany(
    { status: "active", $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] },
    { $set: { status: "inactive", inactiveReason: reason } },
  );
  return res.modifiedCount;
}

let registered = false;
/** First subscribers to Step 66 lifecycle events. Detection never blocks or fails the emitter. */
export function registerDetectionSubscribers(): void {
  if (registered) return;
  registered = true;
  roadsyncEvents.on("workRequestSubmitted", (e: { requestId: string; runBy?: string }) => {
    setImmediate(() => { void runDetection(e.requestId, { runBy: e.runBy ?? "auto" }).catch(() => undefined); });
  });
  roadsyncEvents.on("workRequestCancelled", (e: { requestId: string }) => {
    void deactivatePairs(e.requestId).catch(() => undefined);
  });
}

// ---------- persisted reads ----------

export type DetectionQuery = {
  radiusMeters: number;
  sourceType?: SourceType[];
  agencyId?: string[];
  temporalRelation?: string[];
  spatialRelation?: string[];
  infrastructureType?: string[];
  onlyCandidates: boolean;
  sort: "distance" | "overlapDays" | "startDate" | "agency";
  page: number;
  limit: number;
};

export async function loadPairViews(actor: AuthenticatedActor, requestId: string) {
  const docs = await Candidate.find({ status: "active", $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).limit(DETECTION.MAX_CANDIDATES_PERSISTED * 2).lean();
  const refs = docs.map((d) => {
    const subjectIsA = d.aType === "work_request" && String(d.aId) === requestId;
    return { d, subjectIsA, other: subjectIsA ? { type: d.bType as SourceType, id: String(d.bId) } : { type: d.aType as SourceType, id: String(d.aId) } };
  });
  const items = await loadItems(refs.map((r) => r.other));
  const rows = refs.flatMap((r) => {
    const item = items.get(`${r.other.type}:${r.other.id}`);
    if (!item) return [];
    const o = orient(r.d.spatial as SpatialResult, r.d.temporal as TemporalResult, r.subjectIsA);
    const stale = item.updatedAt && r.d.sourceUpdatedAt ? item.updatedAt.getTime() > new Date(r.d.sourceUpdatedAt).getTime() : false;
    return [{ item, ...o, isCandidate: r.d.isCandidate, candidateId: String(r.d._id), stale: Boolean(stale) }];
  });
  return toViews(actor, rows);
}

const SORTS: Record<DetectionQuery["sort"], (a: NearbyView, b: NearbyView) => number> = {
  distance: (a, b) => a.spatial.distanceMeters - b.spatial.distanceMeters,
  overlapDays: (a, b) => b.temporal.overlapDays - a.temporal.overlapDays || a.spatial.distanceMeters - b.spatial.distanceMeters,
  startDate: (a, b) => (a.other.plannedStart ?? "9").localeCompare(b.other.plannedStart ?? "9"),
  agency: (a, b) => (a.other.agencyName ?? "").localeCompare(b.other.agencyName ?? ""),
};

export async function getDetection(actor: AuthenticatedActor, requestId: string, q: DetectionQuery) {
  const subject = await WorkRequest.findById(requestId).select("detection").lean();
  const all = await loadPairViews(actor, requestId);
  const within = all.filter((v) => v.spatial.distanceMeters <= q.radiusMeters);
  const filtered = within.filter((v) =>
    (!q.onlyCandidates || v.isCandidate) &&
    (!q.sourceType || q.sourceType.includes(v.other.sourceType)) &&
    (!q.agencyId || q.agencyId.includes(v.other.agencyId)) &&
    (!q.temporalRelation || q.temporalRelation.includes(v.temporal.relation)) &&
    (!q.spatialRelation || q.spatialRelation.includes(v.spatial.relation)) &&
    (!q.infrastructureType || q.infrastructureType.includes(v.other.infrastructureType)));
  filtered.sort((a, b) => (q.sort === "distance" ? SORTS.distance(a, b) : SORTS[q.sort](a, b) || a.spatial.distanceMeters - b.spatial.distanceMeters));
  const start = (q.page - 1) * q.limit;
  return {
    detection: subject?.detection ?? { status: "pending" },
    summary: summarize(within.filter((v) => v.isCandidate), within.length),
    candidates: filtered.slice(start, start + q.limit),
    total: filtered.length,
    page: q.page,
    limit: q.limit,
  };
}

const MAP_CAP = 200;
export async function getDetectionMap(actor: AuthenticatedActor, requestId: string, radius: number) {
  const views = (await loadPairViews(actor, requestId)).filter((v) => v.isCandidate && v.spatial.distanceMeters <= radius).sort(SORTS.distance).slice(0, MAP_CAP);
  const features: unknown[] = [];
  for (const v of views) {
    features.push({
      type: "Feature",
      geometry: v.other.geometry,
      properties: {
        kind: "candidate", candidateId: v.candidateId, refNo: v.other.ref, title: v.other.title, agencyName: v.other.agencyName, sourceType: v.other.sourceType,
        infrastructureType: v.other.infrastructureType, spatialRelation: v.spatial.relation, distanceMeters: v.spatial.distanceMeters, temporalRelation: v.temporal.relation, overlapDays: v.temporal.overlapDays,
      },
    });
    if (v.spatial.closestPoints && v.spatial.distanceMeters > 0) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: v.spatial.closestPoints }, properties: { kind: "connector", candidateId: v.candidateId, distanceMeters: v.spatial.distanceMeters } });
    }
  }
  return { type: "FeatureCollection" as const, features: features.slice(0, MAP_CAP) };
}
