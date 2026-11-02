/**
 * Step 73 record reads: list, summary, dossier, map, evidence, CSV and the detect/preview extension.
 * Visibility EXTENSION (intentional): any active affected agency, informed-only included, may read a record,
 * but every other agency's item goes through the Step 68 redaction projection (`projectOther`) from FRESH reads.
 * Agencies still cannot open other agencies' work requests, and private notes never leave their agency.
 */
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { User } from "../identity/models/user.model.js";
import { redactFactors } from "./assessment.engine.js";
import { BAND_CODES, type Band } from "./assessment.rules.js";
import { RECORD, OPEN_LIKE, type RecordStatus } from "./conflict-record.rules.js";
import { canRead, previewAgencies, type Affected, type RecEvent, type RecordPlain, type SideSnap } from "./conflict-record.service.js";
import { buildAccess, loadItems, projectOther, type Access, type SourceItem } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { ConflictRead, ConflictRecord } from "./models/conflict-record.model.js";
import { colomboDay } from "./schedule.analysis.js";
import { hotspotOf, type AnyGeometry } from "./spatial.analysis.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import type { Who } from "./conflict-record.service.js";

type Oid = mongoose.Types.ObjectId;
const oid = (id: string) => new mongoose.Types.ObjectId(id);
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const MATCH_NONE = { _id: { $in: [] as Oid[] } };
const DAY_MS = 86_400_000;
const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ListQuery = {
  status?: RecordStatus[];
  band?: Band[];
  recordType?: ("conflict" | "opportunity")[];
  class?: string[];
  agencyId?: string[];
  leadAgencyId?: string;
  needsMyAck?: boolean;
  ackOverdue?: boolean;
  startsWithinDays?: number;
  requestId?: string;
  q?: string;
  watching?: boolean;
  internal?: boolean;
  sort: "severity" | "timeToImpact" | "ackDue" | "createdAt" | "updatedAt";
  page: number;
  limit: number;
};

const FETCH_CAP = 1000;
const LIST_SELECT = "-notes";

export function accessFilter(w: Who): Record<string, unknown> {
  if (w.national) return {};
  if (!w.scopeIds.size) return MATCH_NONE;
  return { agencyIds: { $in: [...w.scopeIds].map(oid) } };
}

export function myEntry(w: Who, rec: Pick<RecordPlain, "affectedAgencies">): Affected | null {
  const live = rec.affectedAgencies.filter((a) => a.active && !a.excluded);
  return live.find((a) => a.agencyId === w.actor.agencyId) ?? live.find((a) => w.scopeIds.has(a.agencyId)) ?? null;
}
const isOverdue = (e: Affected | null, rec: RecordPlain, now: Date) => Boolean(e && e.ack.status === "pending" && e.ackDueAt && new Date(e.ackDueAt) < now && OPEN_LIKE.includes(rec.status));
const needsAck = (e: Affected | null, rec: RecordPlain) => Boolean(e && e.ack.status === "pending" && rec.status === "open");

export function timeToImpact(win: RecordPlain["overlapWindow"], now = new Date()) {
  if (!win) return { state: "none" as const, days: null, dayIndex: null, totalDays: null };
  const today = colomboDay(now);
  const s = colomboDay(new Date(win.start));
  const e = colomboDay(new Date(win.end));
  const total = e - s + 1;
  if (today < s) return { state: "upcoming" as const, days: s - today, dayIndex: null, totalDays: total };
  if (today <= e) return { state: "active" as const, days: 0, dayIndex: today - s + 1, totalDays: total };
  return { state: "ended" as const, days: null, dayIndex: null, totalDays: total };
}

// ---------- view context ----------

type View = {
  w: Who;
  now: Date;
  items: Map<string, SourceItem>;
  access: Access;
  names: Map<string, string>;
  seen: Map<string, { lastSeenAt: Date }>;
};

async function prepare(w: Who, recs: RecordPlain[]): Promise<View> {
  const refs = new Map<string, { type: "work_request" | "project" | "asset"; id: string }>();
  for (const r of recs) { refs.set(`${r.aType}:${r.aId}`, { type: r.aType, id: String(r.aId) }); refs.set(`${r.bType}:${r.bId}`, { type: r.bType, id: String(r.bId) }); }
  const items = await loadItems([...refs.values()]);
  const access = await buildAccess(w.actor, [...items.values()]);
  const agencyIds = new Set<string>();
  for (const r of recs) for (const a of r.affectedAgencies) agencyIds.add(a.agencyId);
  for (const i of items.values()) agencyIds.add(i.agencyId);
  for (const r of recs) { agencyIds.add(r.sides.a.agencyId); agencyIds.add(r.sides.b.agencyId); }
  const names = new Map((await Agency.find({ _id: { $in: [...agencyIds].map(oid) } }).select("name").lean()).map((a) => [String(a._id), a.name as string]));
  const marks = recs.length ? await ConflictRead.find({ userId: oid(w.actor.userId), conflictId: { $in: recs.map((r) => r._id) } }).lean() : [];
  return { w, now: new Date(), items, access, names, seen: new Map(marks.map((m) => [String(m.conflictId), { lastSeenAt: m.lastSeenAt }])) };
}

/** Fresh read through the Step 68 projection; falls back to the denormalized snapshot, redacted, if the source is gone. */
function party(v: View, rec: RecordPlain, side: "a" | "b") {
  const type = side === "a" ? rec.aType : rec.bType;
  const id = String(side === "a" ? rec.aId : rec.bId);
  const item = v.items.get(`${type}:${id}`);
  const snap: SideSnap = rec.sides[side];
  const mine = v.w.national || v.w.scopeIds.has(snap.agencyId);
  if (item) return { ...projectOther(item, v.access, v.names), mine };
  return { sourceType: type, id, ref: snap.ref, title: snap.title, agencyId: snap.agencyId, agencyName: v.names.get(snap.agencyId) ?? null, infrastructureType: snap.infrastructureType, workType: snap.workType, status: "UNKNOWN", plannedStart: iso(snap.plannedStart), plannedEnd: iso(snap.plannedEnd), workingHours: null, trafficImpactLevel: null, geometry: null, detailLevel: "redacted" as const, canOpen: false, mine };
}

function unseenCount(v: View, rec: RecordPlain): number {
  const mark = v.seen.get(String(rec._id));
  return rec.events.filter((e) => (!mark || new Date(e.at) > new Date(mark.lastSeenAt)) && e.actorId !== v.w.actor.userId).length;
}

function rowOf(v: View, rec: RecordPlain) {
  const mine = myEntry(v.w, rec);
  const live = rec.affectedAgencies.filter((a) => a.active && !a.excluded);
  const required = live.filter((a) => a.required);
  return {
    id: String(rec._id),
    conflictNo: rec.conflictNo,
    recordType: rec.recordType,
    status: rec.status,
    severity: rec.severity.current,
    parties: { a: party(v, rec, "a"), b: party(v, rec, "b") },
    affectedAgencies: rec.affectedAgencies.filter((a) => !a.excluded || v.w.national).map((a) => ({ agencyId: a.agencyId, agencyName: v.names.get(a.agencyId) ?? null, roles: a.roles, required: a.required, ackStatus: a.ack.status, active: a.active && !a.excluded })),
    myAgency: mine ? { agencyId: mine.agencyId, roles: mine.roles, required: mine.required, ackStatus: mine.ack.status, ackDueAt: iso(mine.ackDueAt), overdue: isOverdue(mine, rec, v.now) } : null,
    lead: rec.lead ? { agencyId: rec.lead.agencyId, agencyName: v.names.get(rec.lead.agencyId) ?? null, source: rec.lead.source, reasonCode: rec.lead.reasonCode } : null,
    timeToImpact: timeToImpact(rec.overlapWindow, v.now),
    overlapWindow: rec.overlapWindow ? { start: iso(rec.overlapWindow.start), end: iso(rec.overlapWindow.end) } : null,
    ackProgress: { done: required.filter((a) => a.ack.status === "acknowledged").length, required: required.length },
    belowThreshold: rec.belowThreshold,
    internal: rec.internal,
    unseenChanges: unseenCount(v, rec),
    watching: rec.watchers.some((x) => String(x) === v.w.actor.userId),
    hotspot: rec.hotspot,
    createdAt: iso(rec.createdAt),
    updatedAt: iso(rec.updatedAt),
    version: rec.version,
  };
}
export type RecordRow = ReturnType<typeof rowOf>;

// ---------- list ----------

function mongoFilter(w: Who, q: Partial<ListQuery>): Record<string, unknown> {
  const and: Record<string, unknown>[] = [accessFilter(w)];
  if (q.status?.length) and.push({ status: { $in: q.status } });
  if (q.band?.length) and.push({ "severity.current.band": { $in: q.band } });
  if (q.recordType?.length) and.push({ recordType: { $in: q.recordType } });
  if (q.class?.length) and.push({ "severity.current.classes": { $in: q.class } });
  if (q.agencyId?.length) and.push({ agencyIds: { $in: q.agencyId.map(oid) } });
  if (q.leadAgencyId) and.push({ "lead.agencyId": q.leadAgencyId });
  if (q.requestId) and.push({ $or: [{ aType: "work_request", aId: oid(q.requestId) }, { bType: "work_request", bId: oid(q.requestId) }] });
  if (q.watching) and.push({ watchers: oid(w.actor.userId) });
  if (q.internal !== undefined) and.push({ internal: q.internal });
  if (q.startsWithinDays !== undefined) and.push({ "overlapWindow.start": { $lte: new Date(Date.now() + q.startsWithinDays * DAY_MS) }, "overlapWindow.end": { $gte: new Date(Date.now() - DAY_MS) } });
  if (q.q) {
    const re = new RegExp(escapeRe(q.q.slice(0, 60)), "i");
    and.push({ $or: [{ conflictNo: re }, { "sides.a.ref": re }, { "sides.b.ref": re }, { "sides.a.title": re }, { "sides.b.title": re }] });
  }
  return and.length === 1 ? and[0]! : { $and: and };
}

async function loadMatching(w: Who, q: Partial<ListQuery>): Promise<RecordPlain[]> {
  return (await ConflictRecord.find(mongoFilter(w, q)).select(LIST_SELECT).sort({ updatedAt: -1 }).limit(FETCH_CAP).lean()) as unknown as RecordPlain[];
}

const SORTERS: Record<ListQuery["sort"], (a: RecordRow, b: RecordRow) => number> = {
  severity: (a, b) => b.severity.score - a.severity.score,
  timeToImpact: (a, b) => (a.overlapWindow?.start ?? "9").localeCompare(b.overlapWindow?.start ?? "9"),
  ackDue: (a, b) => (a.myAgency?.ackDueAt ?? "9").localeCompare(b.myAgency?.ackDueAt ?? "9"),
  createdAt: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  updatedAt: (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
};

export async function listRecords(w: Who, q: ListQuery) {
  const recs = await loadMatching(w, q);
  const v = await prepare(w, recs);
  let rows = recs.map((r) => ({ rec: r, row: rowOf(v, r) }));
  if (q.needsMyAck) rows = rows.filter((x) => needsAck(myEntry(w, x.rec), x.rec));
  if (q.ackOverdue) rows = rows.filter((x) => x.row.myAgency?.overdue);
  rows.sort((a, b) => SORTERS[q.sort](a.row, b.row) || b.row.severity.score - a.row.severity.score || a.row.conflictNo.localeCompare(b.row.conflictNo));
  const start = (q.page - 1) * q.limit;
  return { items: rows.slice(start, start + q.limit).map((x) => x.row), total: rows.length, page: q.page, limit: q.limit };
}

export async function summary(w: Who) {
  const recs = await loadMatching(w, {});
  const now = new Date();
  const live = recs.filter((r) => OPEN_LIKE.includes(r.status));
  const byBand = Object.fromEntries(BAND_CODES.map((b) => [b, live.filter((r) => r.severity.current.band === b).length]));
  const byStatus: Record<string, number> = {};
  for (const r of recs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const soon = now.getTime() + 14 * DAY_MS;
  return {
    needsMyAck: live.filter((r) => needsAck(myEntry(w, r), r)).length,
    overdue: live.filter((r) => isOverdue(myEntry(w, r), r, now)).length,
    byBand, byStatus,
    startingIn14d: live.filter((r) => r.overlapWindow && new Date(r.overlapWindow.start).getTime() <= soon && new Date(r.overlapWindow.end).getTime() >= now.getTime() - DAY_MS).length,
    opportunities: live.filter((r) => r.recordType === "opportunity").length,
    watching: recs.filter((r) => r.watchers.some((x) => String(x) === w.actor.userId)).length,
    criticalHigh: live.filter((r) => ["critical", "high"].includes(r.severity.current.band)).length,
    capped: recs.length >= FETCH_CAP,
  };
}

// ---------- dossier ----------

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const rows = ids.length ? await User.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("firstName lastName").lean() : [];
  return new Map(rows.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

function affectedOut(v: View, rec: RecordPlain, userName: Map<string, string>) {
  return rec.affectedAgencies.filter((a) => !a.excluded || v.w.national).map((a) => {
    const own = v.w.scopeIds.has(a.agencyId) || v.w.national;
    return {
      agencyId: a.agencyId,
      agencyName: v.names.get(a.agencyId) ?? null,
      roles: a.roles,
      required: a.required,
      source: a.source,
      active: a.active,
      inactiveReason: a.inactiveReason,
      excluded: a.excluded ? { at: iso(a.excluded.at), ...(v.w.national ? { reason: a.excluded.reason } : {}) } : null,
      reasons: a.reasons.map((r) => ({ code: r.code, params: own ? r.params : { ...r.params, requestRef: undefined } })),
      ack: { status: a.ack.status, at: iso(a.ack.at), byRole: a.ack.byRole ?? null, onBehalf: Boolean(a.ack.onBehalf), ...(own && a.ack.by ? { byName: userName.get(a.ack.by) ?? null } : {}) },
      ackDueAt: iso(a.ackDueAt),
      addedAt: iso(a.addedAt),
    };
  });
}

function eventOut(v: View, e: RecEvent, userName: Map<string, string>) {
  const own = e.actorAgencyId && (v.w.national || v.w.scopeIds.has(e.actorAgencyId));
  return {
    id: e.id, at: iso(e.at), type: e.type, data: e.data,
    actor: e.actorType === "system" ? { kind: "system" as const } : { kind: "user" as const, agencyId: e.actorAgencyId, agencyName: e.actorAgencyId ? v.names.get(e.actorAgencyId) ?? null : null, ...(own && e.actorId ? { name: userName.get(e.actorId) ?? null } : {}) },
  };
}

export type Perms = { respond: boolean; note: boolean };

export async function getDossier(w: Who, id: string, perms: Perms) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const rec = (await ConflictRecord.findById(oid(id)).lean()) as unknown as RecordPlain | null;
  if (!rec || !canRead(w, rec)) return null;
  const v = await prepare(w, [rec]);
  const [candidate, marker] = await Promise.all([
    Candidate.findById(rec.candidateId).select("assessment spatial temporal status").lean(),
    ConflictRead.findOne({ conflictId: rec._id, userId: oid(w.actor.userId) }).lean(),
  ]);
  const a = party(v, rec, "a");
  const b = party(v, rec, "b");
  const bothVisible = w.national || (w.scopeIds.has(rec.sides.a.agencyId) && w.scopeIds.has(rec.sides.b.agencyId));
  const factors = (f: unknown[]) => (bothVisible ? f : redactFactors(f as never));
  const asm = candidate?.assessment as unknown as { ruleVersion?: string; factors: unknown[]; mitigations: unknown[]; floorApplied: unknown; sequence: unknown; incompleteInputs: string[]; inputsAssumed: string[]; estimatedSharedTrenchMeters: number | null; override?: { band: Band; reason: string; by: string; at: Date } | null; overrideStale?: boolean } | undefined;
  const userIds = [...rec.events.map((e) => e.actorId ?? ""), ...rec.notes.map((n) => n.authorId), ...rec.affectedAgencies.map((x) => x.ack.by ?? "")].filter(Boolean);
  const userName = await userNames(userIds);
  const mine = myEntry(w, rec);
  const myNotes = rec.notes.filter((n) => w.national || w.scopeIds.has(n.agencyId));
  // "Since you last looked", computed BEFORE the marker moves.
  const since = marker
    ? (() => {
        const snap = (marker.snapshot ?? null) as { score: number; band: Band; status: RecordStatus } | null;
        const fresh = rec.events.filter((e) => new Date(e.at) > new Date(marker.lastSeenAt) && e.actorId !== w.actor.userId);
        return {
          newEvents: fresh.length,
          severityDelta: snap && (snap.score !== rec.severity.current.score || snap.band !== rec.severity.current.band) ? { from: { score: snap.score, band: snap.band }, to: { score: rec.severity.current.score, band: rec.severity.current.band } } : null,
          agenciesAdded: fresh.filter((e) => e.type === "agency_added").length,
          statusChanged: snap && snap.status !== rec.status ? { from: snap.status, to: rec.status } : null,
        };
      })()
    : null;
  const related = await relatedOf(w, rec);
  await ConflictRead.updateOne({ conflictId: rec._id, userId: oid(w.actor.userId) }, { $set: { lastSeenAt: new Date(), lastSeenVersion: rec.version, snapshot: { score: rec.severity.current.score, band: rec.severity.current.band, status: rec.status } } }, { upsert: true });
  const row = rowOf(v, rec);
  return {
    ...row,
    unseenChanges: 0,
    statusReason: rec.status === "dismissed" || w.national ? rec.statusReason : null,
    statusChangedAt: iso(rec.statusChangedAt),
    closedAt: iso(rec.closedAt),
    parties: { a, b },
    severityDetail: {
      current: rec.severity.current,
      atDetection: { ...rec.severity.atDetection, assessedAt: iso(rec.severity.atDetection.assessedAt), factorsSnapshot: factors(rec.severity.atDetection.factorsSnapshot) },
      history: rec.severity.history.map((h) => ({ ...h, at: iso(h.at) })),
    },
    assessment: asm ? { ruleVersion: asm.ruleVersion ?? rec.ruleVersion, factors: factors(asm.factors), mitigations: asm.mitigations, floorApplied: asm.floorApplied, sequence: asm.sequence, incompleteInputs: asm.incompleteInputs, inputsAssumed: asm.inputsAssumed, estimatedSharedTrenchMeters: asm.estimatedSharedTrenchMeters, overridden: Boolean(asm.override), overrideStale: Boolean(asm.overrideStale), ...(w.national && asm.override ? { override: { band: asm.override.band, reason: asm.override.reason, at: iso(asm.override.at) } } : {}) } : null,
    spatial: candidate?.spatial ?? null,
    temporal: candidate?.temporal ?? null,
    pairActive: candidate?.status === "active",
    affected: affectedOut(v, rec, userName),
    notes: myNotes.map((n) => ({ id: n.id, agencyId: n.agencyId, agencyName: v.names.get(n.agencyId) ?? null, authorName: userName.get(n.authorId) ?? null, text: n.text, createdAt: iso(n.createdAt), mine: n.authorId === w.actor.userId })),
    events: rec.events.map((e) => eventOut(v, e, userName)),
    related,
    diffSinceLastSeen: since,
    watchers: rec.watchers.length,
    canAct: {
      acknowledge: perms.respond && !w.national && Boolean(mine && mine.ack.status === "pending" && OPEN_LIKE.includes(rec.status)),
      dismiss: w.national && OPEN_LIKE.includes(rec.status),
      reopen: w.national && ["dismissed", "auto_closed"].includes(rec.status),
      setLead: w.national && OPEN_LIKE.includes(rec.status),
      manageAgencies: w.national && OPEN_LIKE.includes(rec.status),
      note: perms.note && Boolean(mine || w.national),
    },
  };
}

async function relatedOf(w: Who, rec: RecordPlain) {
  const ids = [rec.aId, rec.bId];
  const near = { hotspot: { $geoWithin: { $centerSphere: [rec.hotspot.coordinates, RECORD.RELATED_RADIUS_M / 6_378_100] } } };
  const found = (await ConflictRecord.find({ $and: [accessFilter(w), { _id: { $ne: rec._id } }, { $or: [{ aId: { $in: ids } }, { bId: { $in: ids } }, near] }] }).select(LIST_SELECT).limit(12).lean().catch(() => [])) as unknown as RecordPlain[];
  const v = await prepare(w, found);
  return found.map((r) => rowOf(v, r));
}

// ---------- map / evidence ----------

const feature = (geometry: unknown, properties: Record<string, unknown>) => ({ type: "Feature" as const, geometry, properties });

export async function getMap(w: Who, id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const rec = (await ConflictRecord.findById(oid(id)).lean()) as unknown as RecordPlain | null;
  if (!rec || !canRead(w, rec)) return null;
  const v = await prepare(w, [rec]);
  const features: unknown[] = [feature(rec.hotspot, { feature: "hotspot", band: rec.severity.current.band, score: rec.severity.current.score, conflictNo: rec.conflictNo })];
  for (const side of ["a", "b"] as const) {
    const p = party(v, rec, side);
    if (p.geometry) features.push(feature(p.geometry, { feature: "party", side, ref: p.ref, title: p.title, agencyName: p.agencyName, mine: p.mine, infrastructureType: p.infrastructureType }));
  }
  const cand = await Candidate.findById(rec.candidateId).select("spatial").lean();
  const cp = (cand?.spatial as { closestPoints?: unknown; distanceMeters?: number } | undefined);
  if (cp?.closestPoints && (cp.distanceMeters ?? 0) > 0) features.push(feature({ type: "LineString", coordinates: cp.closestPoints }, { feature: "connector" }));
  const nearbyIds = rec.affectedAgencies.flatMap((a) => a.active && !a.excluded && a.roles.includes("third_party") ? a.via.filter((x) => x.type === "work_request").map((x) => x.id) : []);
  if (nearbyIds.length) {
    const nearby = await loadItems(nearbyIds.map((id2) => ({ type: "work_request" as const, id: id2 })));
    const access = await buildAccess(w.actor, [...nearby.values()]);
    for (const item of nearby.values()) {
      const p = projectOther(item, access, v.names);
      features.push(feature(p.geometry, { feature: "nearby", ref: p.ref, title: p.title, agencyName: p.agencyName, infrastructureType: p.infrastructureType }));
    }
  }
  for (const r of (await relatedOf(w, rec)).slice(0, 12)) features.push(feature(r.hotspot, { feature: "related", conflictNo: r.conflictNo, band: r.severity.band, id: r.id }));
  return { type: "FeatureCollection" as const, features: features.slice(0, RECORD.MAP_FEATURE_CAP) };
}

export async function getEvidence(w: Who, id: string) {
  const map = await getMap(w, id);
  if (!map) return null;
  const rec = (await ConflictRecord.findById(oid(id)).select("conflictNo severity overlapWindow affectedAgencies recordType status").lean()) as unknown as RecordPlain;
  const names = new Map((await Agency.find({ _id: { $in: rec.affectedAgencies.map((a) => oid(a.agencyId)) } }).select("name").lean()).map((a) => [String(a._id), a.name as string]));
  const base = { conflictNo: rec.conflictNo, recordType: rec.recordType, status: rec.status, band: rec.severity.current.band, score: rec.severity.current.score, classes: rec.severity.current.classes, startDate: iso(rec.overlapWindow?.start), endDate: iso(rec.overlapWindow?.end), agencies: rec.affectedAgencies.filter((a) => a.active && !a.excluded).map((a) => names.get(a.agencyId) ?? "") };
  return { type: "FeatureCollection" as const, properties: base, features: (map.features as { properties: Record<string, unknown> }[]).filter((f) => f.properties.feature !== "related").map((f) => ({ ...f, properties: f.properties.feature === "hotspot" ? { ...f.properties, ...base } : f.properties })) };
}

// ---------- CSV ----------

/** Neutralizes spreadsheet formula injection, then quotes. Cells starting with = + - @ tab or CR get a leading apostrophe. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
const COLUMNS = ["conflictNo", "status", "band", "score", "primaryClass", "partyRefs", "agencies", "ackProgress", "startDate", "endDate", "district", "createdAt"] as const;
export async function exportCsv(w: Who, q: ListQuery): Promise<{ body: string; count: number }> {
  const recs = (await loadMatching(w, q)).slice(0, RECORD.EXPORT_MAX_ROWS);
  const v = await prepare(w, recs);
  let rows = recs.map((r) => ({ rec: r, row: rowOf(v, r) }));
  if (q.needsMyAck) rows = rows.filter((x) => needsAck(myEntry(w, x.rec), x.rec));
  if (q.ackOverdue) rows = rows.filter((x) => x.row.myAgency?.overdue);
  rows.sort((a, b) => SORTERS[q.sort](a.row, b.row));
  const lines = rows.map(({ row, rec }) => [
    row.conflictNo, row.status, row.severity.band, row.severity.score, row.severity.primaryClass ?? "",
    `${row.parties.a.ref} / ${row.parties.b.ref}`, rec.affectedAgencies.filter((a) => a.active && !a.excluded).map((a) => v.names.get(a.agencyId) ?? "").join("; "),
    `${row.ackProgress.done}/${row.ackProgress.required}`, row.overlapWindow?.start?.slice(0, 10) ?? "", row.overlapWindow?.end?.slice(0, 10) ?? "", rec.district ?? "", row.createdAt ?? "",
  ].map(csvCell).join(","));
  return { body: `\uFEFF${COLUMNS.join(",")}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`, count: lines.length };
}

// ---------- per-request list ----------

export async function recordsForRequest(w: Who, requestId: string, readable: boolean) {
  if (!readable) return null;
  return listRecords(w, { requestId, sort: "severity", page: 1, limit: RECORD.LIST_MAX });
}

// ---------- detect/preview extension ----------

type PreviewShape = {
  summary: Record<string, unknown>;
  candidates: { other: { id: string; sourceType: "work_request" | "project" | "asset"; agencyId: string; agencyName: string | null; infrastructureType: string; geometry: unknown; plannedStart: string | null; plannedEnd: string | null; status: string }; spatial: { intersects: boolean; closestPoints: [[number, number], [number, number]] | null }; temporal: { overlapStart: string | null; overlapEnd: string | null }; assessment: { kind: string; score: number } & Record<string, unknown> }[];
};

/** Adds an advisory `affectedAgencies` preview per qualifying candidate and `summary.agenciesToCoordinate`. Never persists or notifies. */
export async function augmentPreview<T extends PreviewShape>(actor: AuthenticatedActor, input: { geometry: AnyGeometry; excludeRequestId: string | null; workType?: string | null; schedule: { plannedStart: string; plannedEnd: string } | null }, result: T): Promise<T> {
  const subjectId = input.excludeRequestId ?? new mongoose.Types.ObjectId().toHexString();
  const subject: SourceItem = {
    type: "work_request", id: subjectId, agencyId: actor.agencyId, infrastructureType: "OTHER", workType: input.workType ?? null, status: "SUBMITTED", ref: "DRAFT", title: "draft",
    start: input.schedule ? new Date(input.schedule.plannedStart) : null, end: input.schedule ? new Date(input.schedule.plannedEnd) : null, workingHours: "day", geometry: input.geometry, updatedAt: null, detail: {},
  };
  const roster = new Map<string, { agencyId: string; name: string | null; roles: Set<string>; required: boolean }>();
  let evaluated = 0;
  const candidates = [];
  for (const c of result.candidates) {
    const a = c.assessment;
    const qualifying = (a.kind === "conflict" && a.score >= RECORD.RECORD_MIN_SCORE) || (a.kind === "opportunity" && ((a as { estimatedSharedTrenchMeters?: number | null }).estimatedSharedTrenchMeters ?? 0) >= RECORD.OPPORTUNITY_MIN_TRENCH_M);
    if (!qualifying || evaluated >= 20) { candidates.push(c); continue; }
    evaluated += 1;
    const other: SourceItem = { type: c.other.sourceType, id: c.other.id, agencyId: c.other.agencyId, infrastructureType: c.other.infrastructureType, workType: null, status: c.other.status, ref: "", title: "", start: c.other.plannedStart ? new Date(c.other.plannedStart) : null, end: c.other.plannedEnd ? new Date(c.other.plannedEnd) : null, workingHours: "day", geometry: c.other.geometry as AnyGeometry, updatedAt: null, detail: {} };
    const hot = hotspotOf(input.geometry, other.geometry, c.spatial);
    const det = await previewAgencies(subject, other, hot, c.temporal, new Date()).catch(() => null);
    if (!det) { candidates.push(c); continue; }
    const agencies = det.agencies.filter((x) => x.agencyId !== actor.agencyId);
    const names = new Map((await Agency.find({ _id: { $in: agencies.map((x) => oid(x.agencyId)) } }).select("name").lean()).map((x) => [String(x._id), x.name as string]));
    for (const x of agencies) {
      const cur = roster.get(x.agencyId) ?? { agencyId: x.agencyId, name: names.get(x.agencyId) ?? null, roles: new Set<string>(), required: false };
      x.roles.forEach((r) => cur.roles.add(r));
      cur.required = cur.required || x.required;
      roster.set(x.agencyId, cur);
    }
    candidates.push({ ...c, affectedAgencies: agencies.map((x) => ({ agencyId: x.agencyId, name: names.get(x.agencyId) ?? null, roles: x.roles, required: x.required, reasons: x.reasons.map((r) => r.code) })) });
  }
  const agenciesToCoordinate = [...roster.values()].map((r) => ({ agencyId: r.agencyId, name: r.name, roles: [...r.roles], required: r.required })).sort((x, y) => Number(y.required) - Number(x.required) || (x.name ?? "").localeCompare(y.name ?? ""));
  return { ...result, candidates: candidates as T["candidates"], summary: { ...result.summary, agenciesToCoordinate } };
}

