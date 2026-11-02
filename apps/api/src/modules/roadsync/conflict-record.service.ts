/**
 * Step 72-73 record pipeline and mutations. Records are born ONLY from Step 70-71 assessments
 * (`roadsyncAssessmentCompleted`), one per pair (unique candidateId). Detection, assessment and this pipeline
 * are chained asynchronously and never block or fail a submit. Coordination, messaging, resolution and
 * email are Steps 74+ and are NOT implemented here.
 */
import { createHash } from "node:crypto";
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { User } from "../identity/models/user.model.js";
import { Notification } from "../notifications/models/notification.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { detectAffectedAgencies, type Detection, type PairContext } from "./affected-agencies.js";
import { RULE_VERSION, type Band } from "./assessment.rules.js";
import { appendHistory, ackDueAt, allRequiredAcked, bandRank, guardAction, reconcile, syncAck, trimEvents, type HistoryPoint } from "./conflict-record.machine.js";
import { OPEN_LIKE, RECORD, type AgencyRole, type EventType, type ReasonCode, type RecordStatus } from "./conflict-record.rules.js";
import { loadItems, type SourceItem } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { ACTIVE_REQUEST } from "./coordination.rules.js";
import { ConflictRecord, nextConflictNo } from "./models/conflict-record.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { DETECTION_ACTIVE_PROJECT_STATUSES, DETECTION_ACTIVE_WORK_STATUSES } from "./roadsync.constants.js";
import { roadsyncEvents } from "./roadsync.events.js";
import { analyzeSpatial, distanceFromPoint, type AnyGeometry } from "./spatial.analysis.js";

type Oid = mongoose.Types.ObjectId;
const oid = (id: string) => new mongoose.Types.ObjectId(id);
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

// ---------- types ----------

export type Snap = { score: number; band: Band; primaryClass: string | null; classes: string[]; kind: "conflict" | "opportunity"; overridden: boolean };
export type Severity = { current: Snap; atDetection: Snap & { ruleVersion: string; assessedAt: Date; factorsSnapshot: unknown[]; agencyCount: number }; history: HistoryPoint[] };
export type Ack = { status: "pending" | "acknowledged"; by: string | null; at: Date | null; byRole?: string | null; onBehalf?: boolean };
export type Affected = {
  agencyId: string;
  roles: AgencyRole[];
  reasons: { code: ReasonCode; params: Record<string, unknown> }[];
  required: boolean;
  source: "auto" | "manual";
  active: boolean;
  inactiveReason: string | null;
  excluded: { reason: string; by: string; at: Date } | null;
  ack: Ack;
  ackDueAt: Date | null;
  notifiedAt: Date | null;
  addedAt: Date;
  /** Items that caused the agency to be involved. Internal only; never sent to clients. */
  via: { type: string; id: string }[];
};
export type RecEvent = { id: string; at: Date; type: EventType; actorType: "system" | "user"; actorId: string | null; actorAgencyId: string | null; data: Record<string, unknown> };
export type Note = { id: string; agencyId: string; authorId: string; text: string; createdAt: Date };
export type SideSnap = { ref: string; title: string; agencyId: string; infrastructureType: string; workType: string | null; plannedStart: Date | null; plannedEnd: Date | null };
export type RecordPlain = {
  _id: Oid;
  conflictNo: string;
  recordType: "conflict" | "opportunity";
  candidateId: Oid;
  pairKey: string;
  aType: "work_request" | "project" | "asset";
  aId: Oid;
  bType: "work_request" | "project" | "asset";
  bId: Oid;
  sides: { a: SideSnap; b: SideSnap };
  hotspot: { type: "Point"; coordinates: [number, number] };
  district: string | null;
  overlapWindow: { start: Date; end: Date } | null;
  internal: boolean;
  severity: Severity;
  belowThreshold: boolean;
  status: RecordStatus;
  statusReason: string | null;
  statusChangedAt: Date | null;
  statusChangedBy: Oid | null;
  dismissedAt: { at: Date; score: number; band: Band } | null;
  affectedAgencies: Affected[];
  agencyIds: Oid[];
  lead: { agencyId: string; source: "suggested" | "national"; setBy: string | null; setAt: Date; reasonCode: string } | null;
  watchers: Oid[];
  notes: Note[];
  events: RecEvent[];
  inputsHash: string;
  ruleVersion: string;
  version: number;
  closedAt: Date | null;
  coordination?: { activeCount: number; agreedCount: number; noAgreementCount: number; lastActivityAt: Date | null; state: "none" | "awaiting_response" | "negotiating" | "escalated" | "agreed" };
  createdAt: Date;
  updatedAt: Date;
};

type Stored = {
  kind: "conflict" | "opportunity" | "advisory";
  classes: string[];
  primaryClass: string | null;
  score: number;
  band: Band;
  factors: unknown[];
  ruleVersion: string;
  assessedAt: Date;
  hotspot: { type: "Point"; coordinates: [number, number] };
  override: { band: Band } | null;
  effective: { score: number; band: Band };
  estimatedSharedTrenchMeters: number | null;
};
type PairDoc = {
  _id: Oid;
  aType: "work_request" | "project" | "asset";
  aId: Oid;
  bType: "work_request" | "project" | "asset";
  bId: Oid;
  status: "active" | "inactive";
  inputsHash: string;
  spatial: { distanceMeters: number };
  temporal: { overlapStart: string | null; overlapEnd: string | null };
  assessment?: Stored;
};

export type Actor = { type: "system" } | { type: "user"; userId: string; agencyId: string };

// ---------- pure helpers ----------

const snapOf = (a: Stored): Snap => ({ score: a.effective.score, band: a.effective.band, primaryClass: a.primaryClass, classes: [...a.classes], kind: a.kind as "conflict" | "opportunity", overridden: Boolean(a.override) });

export function qualifies(doc: Pick<PairDoc, "assessment">): boolean {
  const a = doc.assessment;
  if (!a) return false;
  if (a.kind === "conflict") return a.effective.score >= RECORD.RECORD_MIN_SCORE;
  if (a.kind === "opportunity") return (a.estimatedSharedTrenchMeters ?? 0) >= RECORD.OPPORTUNITY_MIN_TRENCH_M;
  return false;
}

const sideSnap = (i: SourceItem): SideSnap => ({ ref: i.ref, title: i.title, agencyId: i.agencyId, infrastructureType: i.infrastructureType, workType: i.workType, plannedStart: i.start, plannedEnd: i.end });
const itemLive = (i: SourceItem | undefined): i is SourceItem => {
  if (!i) return false;
  if (i.type === "work_request") return (DETECTION_ACTIVE_WORK_STATUSES as readonly string[]).includes(i.status);
  if (i.type === "project") return (DETECTION_ACTIVE_PROJECT_STATUSES as readonly string[]).includes(i.status);
  return true;
};

export function pushEvent(rec: RecordPlain, type: EventType, actor: Actor, data: Record<string, unknown> = {}, at = new Date()): void {
  rec.events.push({ id: new mongoose.Types.ObjectId().toHexString(), at, type, actorType: actor.type, actorId: actor.type === "user" ? actor.userId : null, actorAgencyId: actor.type === "user" ? actor.agencyId : null, data });
  rec.events = trimEvents(rec.events);
}

const syncAgencyIds = (rec: RecordPlain) => {
  rec.agencyIds = rec.affectedAgencies.filter((a) => a.active && !a.excluded).map((a) => oid(a.agencyId));
};

// ---------- persistence ----------

const SAVED_KEYS = ["recordType", "sides", "hotspot", "district", "overlapWindow", "internal", "severity", "belowThreshold", "status", "statusReason", "statusChangedAt", "statusChangedBy", "dismissedAt", "affectedAgencies", "agencyIds", "lead", "watchers", "notes", "events", "inputsHash", "ruleVersion", "closedAt", "coordination"] as const;

/** Writes changed top-level fields with an optimistic version guard. False means someone else saved first. */
export async function saveRecord(before: RecordPlain, after: RecordPlain): Promise<boolean> {
  const set: Record<string, unknown> = {};
  for (const key of SAVED_KEYS) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) set[key] = after[key];
  if (!Object.keys(set).length) return true;
  const res = await ConflictRecord.updateOne({ _id: before._id, version: before.version }, { $set: set, $inc: { version: 1 } });
  return res.matchedCount === 1;
}

/** Deep copy that keeps Dates and ObjectIds intact (structuredClone would strip the ObjectId prototype). */
function clone<T>(v: T): T {
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(v.toHexString()) as T;
  if (Array.isArray(v)) return v.map((x) => clone(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, clone(x)])) as T;
  return v;
}
const plain = (r: unknown) => r as RecordPlain;

/** Load -> mutate -> save with up to three optimistic retries. `fn` returns false to abort without writing. */
export async function withRecord<T>(id: Oid, fn: (rec: RecordPlain) => T | Promise<T>): Promise<{ saved: boolean; changed: boolean; value: T | null; rec: RecordPlain | null }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = plain(await ConflictRecord.findById(id).lean());
    if (!before) return { saved: false, changed: false, value: null, rec: null };
    const after = clone(before);
    const value = await fn(after);
    if (value === false) return { saved: false, changed: false, value, rec: before };
    const changed = SAVED_KEYS.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (await saveRecord(before, after)) return { saved: true, changed, value, rec: changed ? { ...after, version: after.version + 1 } : after };
  }
  return { saved: false, changed: false, value: null, rec: null };
}

// ---------- notifications (in-app only) ----------

export type NotifyKind = "new" | "escalated" | "agency_added" | "reopened" | "auto_closed";
export type Pending = { agencyId: string; kind: NotifyKind; conflictId: string; conflictNo: string; band: Band; primaryClass: string | null; sides: { a: Brief; b: Brief }; start: string | null; end: string | null };
type Brief = { ref: string; title: string; agencyId: string; agencyName: string | null };

const RECIPIENT_ROLES = ["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"];
const RECIPIENT_CAP = 50;
export const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 40);

async function agencyNameMap(ids: string[]): Promise<Map<string, string>> {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

async function pendingFor(rec: RecordPlain, agencyId: string, kind: NotifyKind): Promise<Pending> {
  const names = await agencyNameMap([rec.sides.a.agencyId, rec.sides.b.agencyId]);
  const brief = (s: SideSnap): Brief => ({ ref: s.ref, title: s.title, agencyId: s.agencyId, agencyName: names.get(s.agencyId) ?? null });
  return { agencyId, kind, conflictId: String(rec._id), conflictNo: rec.conflictNo, band: rec.severity.current.band, primaryClass: rec.severity.current.primaryClass, sides: { a: brief(rec.sides.a), b: brief(rec.sides.b) }, start: iso(rec.overlapWindow?.start), end: iso(rec.overlapWindow?.end) };
}

/** Active recipients of in-app notices for an agency: admins and officers; viewers are excluded. */
export async function recipientIds(agencyId: string): Promise<string[]> {
  const users = await User.find({ agencyId: oid(agencyId), status: "ACTIVE" }).populate({ path: "roleId", select: "key" }).select("_id roleId").limit(RECIPIENT_CAP * 2).lean();
  return users.filter((u) => RECIPIENT_ROLES.includes((u.roleId as unknown as { key?: string } | null)?.key ?? "")).slice(0, RECIPIENT_CAP).map((u) => String(u._id));
}

/** One batched notification per (agency, run) for new records; individual ones for everything else. Deduped by key. */
export async function dispatchNotifications(pending: Pending[]): Promise<number> {
  if (!pending.length) return 0;
  const byAgency = new Map<string, Pending[]>();
  for (const p of pending) byAgency.set(p.agencyId, [...(byAgency.get(p.agencyId) ?? []), p]);
  const recipients = new Map<string, string[]>();
  for (const agencyId of byAgency.keys()) {
    const users = await User.find({ agencyId: oid(agencyId), status: "ACTIVE" }).populate({ path: "roleId", select: "key" }).select("_id roleId").limit(RECIPIENT_CAP * 2).lean();
    recipients.set(agencyId, users.filter((u) => RECIPIENT_ROLES.includes((u.roleId as unknown as { key?: string } | null)?.key ?? "")).slice(0, RECIPIENT_CAP).map((u) => String(u._id)));
  }
  const rows: { userId: Oid; type: "CONFLICT"; title: string; message: string; resourceType?: "CONFLICT"; resourceId?: Oid; eventKey: string }[] = [];
  for (const [agencyId, list] of byAgency) {
    const users = recipients.get(agencyId) ?? [];
    const fresh = list.filter((p) => p.kind === "new");
    if (fresh.length) {
      const top = [...fresh].sort((x, y) => bandRank(y.band) - bandRank(x.band) || x.conflictNo.localeCompare(y.conflictNo))[0]!;
      const key = fresh.map((p) => `${p.conflictId}:${p.band}`).sort().join("|");
      const message = JSON.stringify({ count: fresh.length, highestBand: top.band, conflictNo: top.conflictNo, conflictId: fresh.length === 1 ? top.conflictId : null });
      for (const userId of users) rows.push({ userId: oid(userId), type: "CONFLICT", title: "roadsync.notifications.batch_new", message, ...(fresh.length === 1 ? { resourceType: "CONFLICT" as const, resourceId: oid(top.conflictId) } : {}), eventKey: hash(`batch:${agencyId}:${userId}:${key}`) });
    }
    for (const p of list.filter((x) => x.kind !== "new")) {
      const message = JSON.stringify({ conflictNo: p.conflictNo, band: p.band, primaryClass: p.primaryClass, a: p.sides.a, b: p.sides.b, start: p.start, end: p.end });
      for (const userId of users) rows.push({ userId: oid(userId), type: "CONFLICT", title: `roadsync.notifications.${p.kind}`, message, resourceType: "CONFLICT", resourceId: oid(p.conflictId), eventKey: hash(`${p.conflictId}:${agencyId}:${p.kind}:${p.band}:${userId}`) });
    }
  }
  if (!rows.length) return 0;
  const existing = new Set((await Notification.find({ eventKey: { $in: rows.map((r) => r.eventKey) } }).select("eventKey").lean()).map((r) => r.eventKey));
  const fresh = rows.filter((r) => !existing.has(r.eventKey));
  if (!fresh.length) return 0;
  try {
    await Notification.insertMany(fresh, { ordered: false });
  } catch {
    // Duplicate keys from a concurrent run are exactly the dedupe we want.
  }
  return fresh.length;
}

// ---------- audit ----------

type AuditAction = "state_changed" | "acknowledged" | "acknowledged_bulk" | "lead_set" | "agency_added" | "agency_excluded" | "agency_restored" | "note_added" | "note_deleted" | "dismissed" | "reopened" | "exported" | "watch_changed";
export async function audit(actor: Actor, action: AuditAction, rec: Pick<RecordPlain, "_id"> & { sides?: RecordPlain["sides"] }, status: string, reason?: string): Promise<void> {
  try {
    const agency = actor.type === "user" ? oid(actor.agencyId) : undefined;
    await AuditLog.create({
      ...(actor.type === "user" ? { userId: oid(actor.userId) } : {}),
      action: `roadsync.conflict_record.${action}`, resourceType: "CONFLICT", resourceId: rec._id,
      newValue: { status: status.toUpperCase().replace(/[^A-Z_]/g, "_"), ...(reason && !reason.includes("$") && ![...reason].some((c) => c.charCodeAt(0) <= 31) ? { reason: reason.slice(0, 500) } : {}), ...(agency ? { agencyId: agency } : {}) },
      requestId: "conflict_record", ...(agency ? { agencyId: agency } : {}),
    });
  } catch {
    // Audit failure must not undo a committed transition (the event log still holds the fact).
  }
}

// ---------- aggregates (refreshed through the changed event) ----------

export type ChangeEvent = { conflictId: string; change: string; from: RecordStatus | null; to: RecordStatus; candidateId: string; requestIds: string[] };
const dirty = new Map<string, ChangeEvent>();

export function emitChanged(rec: RecordPlain, change: string, from: RecordStatus | null): void {
  const requestIds = [rec.aType === "work_request" ? String(rec.aId) : "", rec.bType === "work_request" ? String(rec.bId) : ""].filter(Boolean);
  const e: ChangeEvent = { conflictId: String(rec._id), change, from, to: rec.status, candidateId: String(rec.candidateId), requestIds };
  roadsyncEvents.emit("roadsyncConflictRecordChanged", e);
}

async function refreshRequestAggregate(requestId: string): Promise<void> {
  const wr = await WorkRequest.findById(requestId).select("agencyId").lean();
  if (!wr) return;
  const rows = plainList(await ConflictRecord.find({ status: { $in: [...OPEN_LIKE] }, $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).select("status affectedAgencies").lean());
  const owner = String(wr.agencyId);
  const needsAck = rows.filter((r) => r.affectedAgencies.some((a) => a.agencyId === owner && a.active && !a.excluded && a.required && a.ack.status === "pending")).length;
  await WorkRequest.updateOne({ _id: oid(requestId) }, { $set: { conflictRecords: { total: rows.length, open: rows.filter((r) => r.status !== "acknowledged").length, acknowledged: rows.filter((r) => r.status === "acknowledged").length, needsAck } } });
}
const plainList = (rows: unknown[]) => rows as RecordPlain[];

export async function flushAggregates(): Promise<void> {
  const batch = [...dirty.values()];
  dirty.clear();
  const requestIds = new Set(batch.flatMap((b) => b.requestIds));
  for (const b of batch) {
    const rec = await ConflictRecord.findById(oid(b.conflictId)).select("conflictNo status").lean();
    if (rec) await Candidate.updateOne({ _id: oid(b.candidateId) }, { $set: { conflictRecord: { id: b.conflictId, no: rec.conflictNo, status: rec.status } } }).catch(() => null);
  }
  for (const id of requestIds) await refreshRequestAggregate(id).catch(() => null);
}

let registered = false;
export function registerConflictRecordSubscribers(): void {
  if (registered) return;
  registered = true;
  roadsyncEvents.on("roadsyncConflictRecordChanged", (e: ChangeEvent) => {
    dirty.set(e.conflictId, e);
    setImmediate(() => { void flushAggregates().catch(() => undefined); });
  });
  roadsyncEvents.on("roadsyncAssessmentCompleted", (e: { requestId: string }) => {
    setImmediate(() => { void syncRecordsForRequest(e.requestId).catch(() => undefined); });
  });
  roadsyncEvents.on("roadsyncOverrideChanged", (e: { requestId: string }) => {
    setImmediate(() => { void syncRecordsForRequest(e.requestId).catch(() => undefined); });
  });
  roadsyncEvents.on("workRequestCancelled", (e: { requestId: string }) => {
    // Assessment's own subscriber deactivates the pairs first; wait a tick so reconcile sees the inactive state.
    setTimeout(() => { void syncRecordsForRequest(e.requestId).catch(() => undefined); }, 250);
  });
}

// ---------- detection context loader ----------

const WORK_LIVE = [...DETECTION_ACTIVE_WORK_STATUSES];

async function loadContext(doc: PairDoc, a: SourceItem, b: SourceItem, hotspot: [number, number]): Promise<PairContext> {
  const created = await WorkRequest.find({ _id: { $in: [doc.aType === "work_request" ? doc.aId : null, doc.bType === "work_request" ? doc.bId : null].filter(Boolean) as Oid[] } }).select("createdAt").lean();
  const submittedAt = new Map(created.map((r) => [String(r._id), (r as unknown as { createdAt?: Date }).createdAt ?? null]));
  const point = { type: "Point" as const, coordinates: hotspot };
  const reach = Math.max(RECORD.ASSET_MIN_RADIUS_M, 0) + 50;
  const assetRows = await Asset.find({ geometry: { $nearSphere: { $geometry: point, $maxDistance: reach } }, agencyId: { $ne: null } }).select("assetType agencyId geometry").limit(100).lean().catch(() => []);
  const assets = assetRows.map((r) => {
    const geometry = r.geometry as unknown as AnyGeometry;
    const touches = [a, b].some((s) => {
      const sp = analyzeSpatial({ geometry, bufferMeters: 0 }, { geometry: s.geometry, bufferMeters: 0 }, RECORD.ASSET_MIN_RADIUS_M);
      return sp.intersects || sp.footprintOverlap;
    });
    return { id: String(r._id), agencyId: String(r.agencyId), infrastructureType: r.assetType as string, distanceMeters: distanceFromPoint(hotspot, geometry), intersectsFootprint: touches };
  });
  const parties = [doc.aId, doc.bId];
  const works = await WorkRequest.find({ _id: { $nin: parties }, status: { $in: WORK_LIVE }, geometry: { $nearSphere: { $geometry: point, $maxDistance: RECORD.THIRD_PARTY_RADIUS_M } } }).select("agencyId plannedStart plannedEnd geometry").limit(100).lean().catch(() => []);
  const nearbyWork = works.map((w) => ({ agencyId: String(w.agencyId), id: String(w._id), ref: `WR-${String(w._id).slice(-8).toUpperCase()}`, distanceMeters: distanceFromPoint(hotspot, w.geometry as unknown as AnyGeometry), start: w.plannedStart, end: w.plannedEnd }));
  const ow = doc.temporal.overlapStart && doc.temporal.overlapEnd ? { start: new Date(doc.temporal.overlapStart), end: new Date(new Date(doc.temporal.overlapEnd).getTime() + 86_399_000) } : null;
  return {
    a: { type: doc.aType, id: String(doc.aId), agencyId: a.agencyId, infrastructureType: a.infrastructureType, submittedAt: submittedAt.get(String(doc.aId)) ?? null },
    b: { type: doc.bType, id: String(doc.bId), agencyId: b.agencyId, infrastructureType: b.infrastructureType, submittedAt: submittedAt.get(String(doc.bId)) ?? null },
    overlapWindow: ow, bufferMeters: 0, assets, nearbyWork,
  };
}

/** Preview of who will be involved, computed on the fly with the same engine. Used by detect/preview. */
export async function previewAgencies(a: SourceItem, b: SourceItem, hotspot: [number, number], overlap: { overlapStart: string | null; overlapEnd: string | null }, submittedAtA: Date | null): Promise<Detection> {
  const doc = { aType: a.type, aId: oid(a.id), bType: b.type, bId: oid(b.id), temporal: overlap } as unknown as PairDoc;
  const ctx = await loadContext(doc, a, b, hotspot);
  ctx.a.submittedAt = submittedAtA ?? ctx.a.submittedAt;
  return detectAffectedAgencies(ctx);
}

// ---------- pipeline ----------

const gates = new Map<string, Promise<unknown>>();
/** Serializes runs per request inside this process; the unique candidateId index makes the upsert safe across processes. */
export function syncRecordsForRequest(requestId: string): Promise<{ created: number; updated: number; closed: number }> {
  const prev = gates.get(requestId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => runSync(requestId));
  gates.set(requestId, next);
  void next.finally(() => { if (gates.get(requestId) === next) gates.delete(requestId); }).catch(() => undefined);
  return next;
}

async function runSync(requestId: string): Promise<{ created: number; updated: number; closed: number }> {
  const out = { created: 0, updated: 0, closed: 0 };
  const docs = (await Candidate.find({ $or: [{ aType: "work_request", aId: oid(requestId) }, { bType: "work_request", bId: oid(requestId) }] }).limit(400).lean()) as unknown as PairDoc[];
  if (!docs.length) return out;
  const refs = new Map<string, { type: "work_request" | "project" | "asset"; id: string }>();
  for (const d of docs) { refs.set(`${d.aType}:${d.aId}`, { type: d.aType, id: String(d.aId) }); refs.set(`${d.bType}:${d.bId}`, { type: d.bType, id: String(d.bId) }); }
  const items = await loadItems([...refs.values()]);
  const pending: Pending[] = [];
  for (const doc of docs) {
    try {
      const r = await processPair(doc, items, pending);
      if (r === "created") out.created += 1; else if (r === "closed") out.closed += 1; else if (r === "updated") out.updated += 1;
    } catch {
      // One malformed pair never fails the run.
    }
  }
  await flushAggregates();
  await dispatchNotifications(pending).catch(() => 0);
  return out;
}

type Outcome = "created" | "updated" | "closed" | "none";

async function processPair(doc: PairDoc, items: Map<string, SourceItem>, pending: Pending[]): Promise<Outcome> {
  const a = items.get(`${doc.aType}:${doc.aId}`);
  const b = items.get(`${doc.bType}:${doc.bId}`);
  const live = doc.status === "active" && itemLive(a) && itemLive(b);
  const wants = live && qualifies(doc);
  const existing = plainOrNull(await ConflictRecord.findOne({ candidateId: doc._id }).lean());
  if (!existing) {
    if (!wants || !a || !b || !doc.assessment) return "none";
    return createRecord(doc, a, b, pending);
  }
  const now = new Date();
  const result = await withRecord(existing._id, async (rec) => {
    const sys: Actor = { type: "system" };
    const wasStatus = rec.status;
    const bandBefore = rec.severity.current.band;
    const added: string[] = [];
    if (doc.assessment && a && b) {
      const snap = snapOf(doc.assessment);
      const prev = rec.severity.current;
      if (JSON.stringify(prev) !== JSON.stringify(snap)) {
        const reason: HistoryPoint["reason"] = !prev.overridden && snap.overridden ? "override" : prev.overridden && !snap.overridden ? "override_cleared" : "reassessed";
        const { history, changed } = appendHistory(rec.severity.history, { at: now, score: snap.score, band: snap.band, ruleVersion: doc.assessment.ruleVersion, reason });
        rec.severity = { ...rec.severity, current: snap, history };
        if (changed) pushEvent(rec, "severity_changed", sys, { from: { score: prev.score, band: prev.band }, to: { score: snap.score, band: snap.band }, reason }, now);
        if (reason !== "reassessed") pushEvent(rec, "override_applied", sys, { cleared: reason === "override_cleared", band: snap.band }, now);
        if (bandRank(snap.band) > bandRank(prev.band)) {
          for (const ag of rec.affectedAgencies.filter((x) => x.active && !x.excluded && x.ack.status === "pending" && x.ackDueAt)) ag.ackDueAt = ackDueAt(now, snap.band, ag.ackDueAt);
        }
      }
      const sides = { a: sideSnap(a), b: sideSnap(b) };
      if (JSON.stringify(sides) !== JSON.stringify(rec.sides)) rec.sides = sides;
      const ow = doc.temporal.overlapStart && doc.temporal.overlapEnd ? { start: new Date(doc.temporal.overlapStart), end: new Date(new Date(doc.temporal.overlapEnd).getTime() + 86_399_000) } : null;
      if (JSON.stringify(ow) !== JSON.stringify(rec.overlapWindow)) rec.overlapWindow = ow;
      // Recompute agencies ONLY when inputs changed or the rules moved on.
      if (rec.inputsHash !== doc.inputsHash || rec.ruleVersion !== RULE_VERSION) {
        const ctx = await loadContext(doc, a, b, doc.assessment.hotspot.coordinates);
        added.push(...mergeAgencies(rec, detectAffectedAgencies(ctx), now, rec.severity.current.band, sys));
        rec.hotspot = doc.assessment.hotspot;
        rec.inputsHash = doc.inputsHash;
        rec.ruleVersion = RULE_VERSION;
      }
    }
    const rc = reconcile({ status: rec.status, belowThreshold: rec.belowThreshold, qualifies: wants, pairActive: live, band: rec.severity.current.band, dismissedBand: rec.dismissedAt?.band ?? null, agencies: rec.affectedAgencies });
    rec.belowThreshold = rc.belowThreshold;
    if (rc.status !== rec.status) {
      rec.status = rc.status;
      rec.statusChangedAt = now;
      rec.statusChangedBy = null;
      rec.statusReason = rc.reason;
      rec.closedAt = rc.status === "auto_closed" || rc.status === "dismissed" ? now : null;
    }
    if (rc.event) pushEvent(rec, rc.event, sys, rc.reason ? { reason: rc.reason } : {}, now);
    syncAgencyIds(rec);
    return { wasStatus, escalated: bandRank(rec.severity.current.band) > bandRank(bandBefore), added, rc };
  });
  // An unchanged re-run writes nothing and notifies nobody.
  if (!result.saved || !result.changed || !result.rec || !result.value) return "none";
  const { wasStatus, escalated, added, rc } = result.value;
  const rec = result.rec;
  emitChanged(rec, rc.event ?? (rec.status !== wasStatus ? "status_synced" : "updated"), wasStatus);
  const active = rec.affectedAgencies.filter((x) => x.active && !x.excluded);
  if (escalated) for (const ag of active) pending.push(await pendingFor(rec, ag.agencyId, "escalated"));
  for (const agencyId of added) pending.push(await pendingFor(rec, agencyId, "agency_added"));
  if (rc.event === "reopened" || rc.event === "redetected") for (const ag of active) pending.push(await pendingFor(rec, ag.agencyId, "reopened"));
  if (rc.event === "auto_closed") for (const ag of rec.affectedAgencies.filter((x) => x.ack.status === "acknowledged")) pending.push(await pendingFor(rec, ag.agencyId, "auto_closed"));
  return rc.event === "auto_closed" ? "closed" : "updated";
}

const plainOrNull = (r: unknown) => (r ? (r as RecordPlain) : null);

/** Diffs detection into the roster. Never drops an agency; removal means active=false with a reason. Returns newly (re)activated agency ids. */
export function mergeAgencies(rec: RecordPlain, det: Detection, now: Date, band: Band, actor: Actor): string[] {
  const added: string[] = [];
  const seen = new Set<string>();
  for (const d of det.agencies) {
    seen.add(d.agencyId);
    const e = rec.affectedAgencies.find((x) => x.agencyId === d.agencyId);
    if (!e) {
      rec.affectedAgencies.push({ agencyId: d.agencyId, roles: d.roles, reasons: d.reasons, required: d.required, source: "auto", active: true, inactiveReason: null, excluded: null, ack: { status: "pending", by: null, at: null }, ackDueAt: ackDueAt(now, band, null), notifiedAt: null, addedAt: now, via: d.via });
      pushEvent(rec, "agency_added", actor, { agencyId: d.agencyId, roles: d.roles, required: d.required }, now);
      added.push(d.agencyId);
      continue;
    }
    if (e.source === "manual") continue;
    e.roles = d.roles; e.reasons = d.reasons; e.required = d.required; e.via = d.via;
    if (!e.active) {
      e.active = true; e.inactiveReason = null;
      if (!e.ackDueAt) e.ackDueAt = ackDueAt(now, band, null);
      pushEvent(rec, "agency_added", actor, { agencyId: d.agencyId, roles: d.roles, required: d.required, reactivated: true }, now);
      if (!e.excluded) added.push(d.agencyId);
    }
  }
  for (const e of rec.affectedAgencies) {
    if (e.source === "auto" && e.active && !seen.has(e.agencyId)) {
      e.active = false; e.inactiveReason = "no_longer_detected";
      pushEvent(rec, "agency_removed", actor, { agencyId: e.agencyId, reason: "no_longer_detected" }, now);
    }
  }
  if (det.suggestedLead && (!rec.lead || rec.lead.source === "suggested") && rec.lead?.agencyId !== det.suggestedLead.agencyId) {
    rec.lead = { agencyId: det.suggestedLead.agencyId, source: "suggested", setBy: null, setAt: now, reasonCode: det.suggestedLead.reasonCode };
  }
  if (!det.suggestedLead && rec.lead?.source === "suggested") rec.lead = null;
  rec.internal = det.internal;
  return added;
}

async function createRecord(doc: PairDoc, a: SourceItem, b: SourceItem, pending: Pending[]): Promise<Outcome> {
  const assessment = doc.assessment!;
  const now = new Date();
  const ctx = await loadContext(doc, a, b, assessment.hotspot.coordinates);
  const det = detectAffectedAgencies(ctx);
  const snap = snapOf(assessment);
  const district = null;
  const conflictNo = await nextConflictNo(now);
  const rec = {
    conflictNo, recordType: snap.kind, candidateId: doc._id, pairKey: `${doc.aType}:${doc.aId}|${doc.bType}:${doc.bId}`,
    aType: doc.aType, aId: doc.aId, bType: doc.bType, bId: doc.bId, sides: { a: sideSnap(a), b: sideSnap(b) },
    hotspot: assessment.hotspot, district,
    overlapWindow: ctx.overlapWindow, internal: det.internal,
    severity: { current: snap, atDetection: { ...snap, ruleVersion: assessment.ruleVersion, assessedAt: now, factorsSnapshot: assessment.factors, agencyCount: det.agencies.length }, history: [{ at: now, score: snap.score, band: snap.band, ruleVersion: assessment.ruleVersion, reason: "detected" }] },
    belowThreshold: false, status: "open" as RecordStatus, statusReason: null, statusChangedAt: now, statusChangedBy: null, dismissedAt: null,
    affectedAgencies: det.agencies.map((d): Affected => ({ agencyId: d.agencyId, roles: d.roles, reasons: d.reasons, required: d.required, source: "auto", active: true, inactiveReason: null, excluded: null, ack: { status: "pending", by: null, at: null }, ackDueAt: ackDueAt(now, snap.band, null), notifiedAt: now, addedAt: now, via: d.via })),
    agencyIds: det.agencies.map((d) => oid(d.agencyId)),
    lead: det.suggestedLead ? { agencyId: det.suggestedLead.agencyId, source: "suggested", setBy: null, setAt: now, reasonCode: det.suggestedLead.reasonCode } : null,
    watchers: [], notes: [], events: [] as RecEvent[], inputsHash: doc.inputsHash, ruleVersion: RULE_VERSION, version: 1, closedAt: null,
  };
  const draft = rec as unknown as RecordPlain;
  pushEvent(draft, "detected", { type: "system" }, { agencies: det.agencies.length, band: snap.band }, now);
  if (det.suggestedLead) pushEvent(draft, "lead_set", { type: "system" }, { agencyId: det.suggestedLead.agencyId, reasonCode: det.suggestedLead.reasonCode }, now);
  try {
    const saved = plain((await ConflictRecord.create(draft)).toObject());
    emitChanged(saved, "detected", null);
    for (const ag of saved.affectedAgencies) pending.push(await pendingFor(saved, ag.agencyId, "new"));
    return "created";
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return "none"; // another run already created it: idempotent
    throw error;
  }
}

// ---------- user mutations ----------

export type Mutation =
  | { ok: true; rec: RecordPlain; value?: unknown }
  | { ok: false; status: 403 | 404 | 409 | 400; code: "forbidden" | "not_found" | "stale" | "invalid_transition" | "pair_inactive" | "invalid" | "already" | "active_coordination" };

export type Who = { actor: AuthenticatedActor; national: boolean; scopeIds: Set<string> };
export async function whoIs(actor: AuthenticatedActor): Promise<Who> {
  const scope = await resolveResourceScope(actor);
  return { actor, national: scope.kind === "platform", scopeIds: new Set(scope.kind === "agencies" ? scope.agencyIds.map(String) : []) };
}
export const canRead = (w: Who, rec: Pick<RecordPlain, "agencyIds">) => w.national || rec.agencyIds.some((id) => w.scopeIds.has(String(id)));
const asActor = (w: Who): Actor => ({ type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId });

async function loadReadable(w: Who, id: string): Promise<RecordPlain | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const rec = plainOrNull(await ConflictRecord.findById(oid(id)).lean());
  return rec && canRead(w, rec) ? rec : null;
}
export { loadReadable };

/** Runs a guarded mutation: read check (404), version check (409), optimistic save, event + emit. */
async function mutate(w: Who, id: string, expected: number, fn: (rec: RecordPlain, now: Date) => "forbidden" | "invalid_transition" | "pair_inactive" | "invalid" | "already" | { change: string; value?: unknown; audit?: AuditAction; reason?: string }): Promise<Mutation> {
  const current = await loadReadable(w, id);
  if (!current) return { ok: false, status: 404, code: "not_found" };
  if (current.version !== expected) return { ok: false, status: 409, code: "stale" };
  const now = new Date();
  const before = clone(current);
  const after = clone(current);
  const res = fn(after, now);
  if (typeof res === "string") return { ok: false, status: res === "forbidden" ? 403 : res === "invalid" ? 400 : res === "already" ? 409 : 409, code: res };
  syncAgencyIds(after);
  const saved = await saveRecord(before, after);
  if (!saved) return { ok: false, status: 409, code: "stale" };
  after.version += 1;
  emitChanged(after, res.change, before.status);
  await audit(asActor(w), res.audit ?? "state_changed", after, after.status, res.reason);
  return { ok: true, rec: after, value: res.value };
}

const requireReason = (reason: string | undefined) => Boolean(reason && reason.trim().length >= RECORD.REASON_MIN_CHARS);

export async function acknowledge(w: Who, id: string, input: { version: number; note?: string; agencyId?: string; reason?: string }): Promise<Mutation> {
  const result = await mutate(w, id, input.version, (rec, now) => {
    let agencyId = w.actor.agencyId;
    let onBehalf = false;
    if (w.national) {
      if (!input.agencyId || !requireReason(input.reason)) return "forbidden";
      agencyId = input.agencyId;
      onBehalf = true;
    } else if (input.agencyId && input.agencyId !== w.actor.agencyId) return "forbidden";
    const entry = rec.affectedAgencies.find((a) => a.agencyId === agencyId && a.active && !a.excluded);
    if (!entry) return "forbidden";
    if (!OPEN_LIKE.includes(rec.status)) return "invalid_transition";
    if (entry.ack.status === "acknowledged") return "already";
    entry.ack = { status: "acknowledged", by: w.actor.userId, at: now, byRole: w.actor.roleKey, onBehalf };
    pushEvent(rec, "acknowledged", asActor(w), { agencyId, ...(onBehalf ? { onBehalf: true } : {}), hasNote: Boolean(input.note) }, now);
    const next = syncAck(rec.status, rec.affectedAgencies);
    if (next !== rec.status) { rec.status = next; rec.statusChangedAt = now; rec.statusChangedBy = oid(w.actor.userId); }
    return { change: "acknowledged", audit: "acknowledged", reason: input.note ?? input.reason, value: { allAcked: allRequiredAcked(rec.affectedAgencies) } };
  });
  return result;
}

export type BulkResult = { id: string; result: "ok" | "already" | "forbidden" | "not_found" | "stale" | "invalid" };
export async function acknowledgeBulk(w: Who, ids: string[]): Promise<BulkResult[]> {
  const out: BulkResult[] = [];
  for (const id of [...new Set(ids)].slice(0, RECORD.BULK_ACK_MAX)) {
    const rec = await loadReadable(w, id);
    if (!rec) { out.push({ id, result: "not_found" }); continue; }
    const r = await acknowledge(w, id, { version: rec.version });
    out.push({ id, result: r.ok ? "ok" : r.code === "already" ? "already" : r.code === "stale" ? "stale" : r.code === "not_found" ? "not_found" : r.code === "forbidden" ? "forbidden" : "invalid" });
  }
  await audit(asActor(w), "acknowledged_bulk", { _id: new mongoose.Types.ObjectId() }, "ok", `count ${out.filter((o) => o.result === "ok").length}`);
  return out;
}

export async function dismiss(w: Who, id: string, input: { version: number; reason: string }): Promise<Mutation> {
  // A record with live coordination must have its requests withdrawn or closed first.
  if (/^[a-f0-9]{24}$/i.test(id) && (await CoordinationRequest.exists({ conflictId: oid(id), status: { $in: [...ACTIVE_REQUEST] } }))) return { ok: false, status: 409, code: "active_coordination" };
  return mutate(w, id, input.version, (rec, now) => {
    const g = guardAction("dismiss", rec.status, { national: w.national, pairActive: true });
    if (!g.ok) return g.code;
    if (!requireReason(input.reason)) return "invalid";
    rec.status = g.to; rec.statusReason = input.reason; rec.statusChangedAt = now; rec.statusChangedBy = oid(w.actor.userId); rec.closedAt = now;
    rec.dismissedAt = { at: now, score: rec.severity.current.score, band: rec.severity.current.band };
    pushEvent(rec, "dismissed", asActor(w), { band: rec.severity.current.band }, now);
    return { change: "dismissed", audit: "dismissed", reason: input.reason };
  });
}

export async function reopen(w: Who, id: string, input: { version: number; reason: string }): Promise<Mutation> {
  const cand = await loadReadable(w, id);
  const pairActive = cand ? Boolean(await Candidate.exists({ _id: cand.candidateId, status: "active" })) : false;
  return mutate(w, id, input.version, (rec, now) => {
    const g = guardAction("reopen", rec.status, { national: w.national, pairActive });
    if (!g.ok) return g.code;
    if (!requireReason(input.reason)) return "invalid";
    rec.status = syncAck("open", rec.affectedAgencies); rec.statusReason = input.reason; rec.statusChangedAt = now; rec.statusChangedBy = oid(w.actor.userId); rec.closedAt = null; rec.dismissedAt = null;
    pushEvent(rec, "reopened", asActor(w), { manual: true }, now);
    return { change: "reopened", audit: "reopened", reason: input.reason };
  });
}

export async function setLead(w: Who, id: string, input: { version: number; agencyId: string }): Promise<Mutation> {
  return mutate(w, id, input.version, (rec, now) => {
    if (!w.national) return "forbidden";
    if (!rec.affectedAgencies.some((a) => a.agencyId === input.agencyId && a.active && !a.excluded)) return "invalid";
    rec.lead = { agencyId: input.agencyId, source: "national", setBy: w.actor.userId, setAt: now, reasonCode: "national_set" };
    pushEvent(rec, "lead_set", asActor(w), { agencyId: input.agencyId, source: "national" }, now);
    return { change: "lead_set", audit: "lead_set" };
  });
}

export async function addAgency(w: Who, id: string, input: { version: number; agencyId: string; reason: string }): Promise<Mutation> {
  const exists = await Agency.exists({ _id: oid(input.agencyId), status: "ACTIVE" });
  return mutate(w, id, input.version, (rec, now) => {
    if (!w.national) return "forbidden";
    if (!exists || !requireReason(input.reason) || !OPEN_LIKE.includes(rec.status)) return "invalid";
    if (rec.affectedAgencies.length >= RECORD.MAX_AFFECTED_AGENCIES * 2) return "invalid";
    const prev = rec.affectedAgencies.find((a) => a.agencyId === input.agencyId);
    if (prev?.active && !prev.excluded) return "already";
    if (prev) { prev.active = true; prev.inactiveReason = null; prev.excluded = null; prev.source = "manual"; if (!prev.roles.length) prev.roles = ["third_party"]; prev.reasons.push({ code: "manually_added", params: {} }); }
    else rec.affectedAgencies.push({ agencyId: input.agencyId, roles: ["third_party"], reasons: [{ code: "manually_added", params: {} }], required: false, source: "manual", active: true, inactiveReason: null, excluded: null, ack: { status: "pending", by: null, at: null }, ackDueAt: ackDueAt(now, rec.severity.current.band, null), notifiedAt: null, addedAt: now, via: [] });
    pushEvent(rec, "agency_added", asActor(w), { agencyId: input.agencyId, manual: true }, now);
    const next = syncAck(rec.status, rec.affectedAgencies);
    if (next !== rec.status) { rec.status = next; rec.statusChangedAt = now; }
    return { change: "agency_added", audit: "agency_added", reason: input.reason, value: { agencyId: input.agencyId } };
  });
}

const isParty = (rec: RecordPlain, agencyId: string) => rec.sides.a.agencyId === agencyId || rec.sides.b.agencyId === agencyId;

export async function excludeAgency(w: Who, id: string, input: { version: number; agencyId: string; reason: string }): Promise<Mutation> {
  return mutate(w, id, input.version, (rec, now) => {
    if (!w.national) return "forbidden";
    const e = rec.affectedAgencies.find((a) => a.agencyId === input.agencyId);
    if (!e || !e.active || e.excluded || isParty(rec, input.agencyId) || !requireReason(input.reason)) return "invalid";
    if (e.source === "manual") rec.affectedAgencies = rec.affectedAgencies.filter((a) => a !== e);
    else e.excluded = { reason: input.reason, by: w.actor.userId, at: now };
    if (rec.lead?.agencyId === input.agencyId) rec.lead = null;
    pushEvent(rec, e.source === "manual" ? "agency_removed" : "agency_excluded", asActor(w), { agencyId: input.agencyId }, now);
    const next = syncAck(rec.status, rec.affectedAgencies);
    if (next !== rec.status) { rec.status = next; rec.statusChangedAt = now; }
    return { change: "agency_excluded", audit: "agency_excluded", reason: input.reason };
  });
}

export async function restoreAgency(w: Who, id: string, input: { version: number; agencyId: string }): Promise<Mutation> {
  return mutate(w, id, input.version, (rec, now) => {
    if (!w.national) return "forbidden";
    const e = rec.affectedAgencies.find((a) => a.agencyId === input.agencyId);
    if (!e || !e.excluded) return "invalid";
    e.excluded = null;
    pushEvent(rec, "agency_restored", asActor(w), { agencyId: input.agencyId }, now);
    const next = syncAck(rec.status, rec.affectedAgencies);
    if (next !== rec.status) { rec.status = next; rec.statusChangedAt = now; }
    return { change: "agency_restored", audit: "agency_restored" };
  });
}

export async function setWatch(w: Who, id: string, on: boolean): Promise<Mutation> {
  const rec = await loadReadable(w, id);
  if (!rec) return { ok: false, status: 404, code: "not_found" };
  const me = oid(w.actor.userId);
  const res = on
    ? await ConflictRecord.updateOne({ _id: rec._id, $expr: { $lt: [{ $size: "$watchers" }, RECORD.WATCHERS_MAX] } }, { $addToSet: { watchers: me } })
    : await ConflictRecord.updateOne({ _id: rec._id }, { $pull: { watchers: me } });
  if (on && res.matchedCount === 0) return { ok: false, status: 400, code: "invalid" };
  return { ok: true, rec };
}

export async function addNote(w: Who, id: string, text: string): Promise<Mutation> {
  const current = await loadReadable(w, id);
  if (!current) return { ok: false, status: 404, code: "not_found" };
  return mutate(w, id, current.version, (rec, now) => {
    const own = rec.affectedAgencies.some((a) => a.agencyId === w.actor.agencyId && a.active && !a.excluded);
    if (!own && !w.national) return "forbidden";
    if (rec.notes.filter((n) => n.agencyId === w.actor.agencyId).length >= RECORD.NOTES_MAX) return "invalid";
    const note: Note = { id: new mongoose.Types.ObjectId().toHexString(), agencyId: w.actor.agencyId, authorId: w.actor.userId, text, createdAt: now };
    rec.notes.push(note);
    pushEvent(rec, "note_added", asActor(w), { agencyId: w.actor.agencyId }, now); // meta only, never the text
    return { change: "note_added", audit: "note_added", value: { id: note.id } };
  });
}

export async function deleteNote(w: Who, id: string, noteId: string): Promise<Mutation> {
  const current = await loadReadable(w, id);
  if (!current) return { ok: false, status: 404, code: "not_found" };
  return mutate(w, id, current.version, (rec) => {
    const note = rec.notes.find((n) => n.id === noteId);
    if (!note) return "invalid";
    const author = note.authorId === w.actor.userId;
    const agencyAdmin = w.actor.roleKey === "GOV_ADMIN" && w.scopeIds.has(note.agencyId);
    if (!author && !agencyAdmin) return "forbidden";
    rec.notes = rec.notes.filter((n) => n.id !== noteId);
    return { change: "note_deleted", audit: "note_deleted" };
  });
}

