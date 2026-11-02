/**
 * Step 77 case ledger I/O. The ONLY writes to `roadsync_ledger` are in this module and there is no update or delete
 * path. Entries carry ids, codes and numbers only (never free text). Writers are small hooks on the existing event
 * emitters plus direct appends from the resolution service; a per-conflict gate serialises appends and the unique
 * { conflictId, seq } index is the final guard.
 */
import mongoose from "mongoose";

import { loadReadable, type RecordPlain, type Who } from "./conflict-record.service.js";
import { entryHash, genesisHash, redact, stateAt, verifyChain, type Entry, type LedgerActor, type StateAfter, type Verify, type Visibility, type ViewerCtx } from "./ledger.engine.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { LedgerEntry } from "./models/resolution.model.js";
import { LEDGER, type LedgerAction } from "./resolution.rules.js";
import { roadsyncEvents } from "./roadsync.events.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
export const viewerCtx = (w: Who): ViewerCtx => ({ national: w.national, agencyId: w.actor.agencyId, scopeIds: w.scopeIds });

const RECORD_ACTION: Record<string, LedgerAction> = {
  detected: "record_detected", severity_changed: "severity_changed", agency_added: "agency_added", agency_removed: "agency_removed", agency_excluded: "agency_excluded", agency_restored: "agency_restored",
  acknowledged: "acknowledged", lead_set: "lead_set", dismissed: "dismissed", reopened: "reopened", auto_closed: "auto_closed", redetected: "redetected", note_added: "note_added",
};
const REQUEST_ACTION: Record<string, LedgerAction> = {
  created: "coordination_created", response: "coordination_response", needs_info: "coordination_response", counter_proposed: "coordination_counter", conditions_confirmed: "coordination_conditions_confirmed",
  agreed: "coordination_agreed", closed_no_agreement: "coordination_closed_no_agreement", withdrawn: "coordination_withdrawn", auto_withdrawn: "coordination_withdrawn", escalated: "coordination_escalated",
  deescalated: "coordination_deescalated", nudged: "coordination_nudged", deadline_extended: "deadline_extended",
};
export const CATEGORY = (action: string): "record" | "coordination" | "resolution" | "approval" | "system" =>
  action.startsWith("coordination_") || action === "deadline_extended" ? "coordination" : action.startsWith("approval_") ? "approval"
    : /^(resolution|amendment|directive|commitment|verification|risk)_|^risk_/.test(action) ? "resolution" : action === "ledger_started" || action === "export_generated" || action === "integrity_verified" ? "system" : "record";

/** Ids, codes and numbers only: short strings, numbers, booleans. Anything that could be prose is dropped. */
const SAFE_KEY = /^(?!.*(note|text|reason|justification|message|comment|description)).*$/i;
export function cleanData(d: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!SAFE_KEY.test(k)) continue;
    if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (typeof v === "string" && v.length <= 60) out[k] = v;
    else if (Array.isArray(v) && v.length <= 12 && v.every((x) => typeof x === "string" && x.length <= 60 || typeof x === "number")) out[k] = v;
  }
  return out;
}

async function stateOf(conflictId: string, extra: Partial<StateAfter> = {}): Promise<StateAfter> {
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("status severity coordination resolution").lean()) as unknown as RecordPlain | null;
  const cur = rec?.severity?.current;
  return { recordStatus: rec?.status ?? "unknown", severity: cur ? { score: cur.score, band: cur.band } : null, coordinationState: rec?.coordination?.state ?? null, resolutionState: rec?.resolution?.state ?? null, ...extra };
}

const gates = new Map<string, Promise<unknown>>();
function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (gates.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn);
  gates.set(key, run);
  void run.finally(() => { if (gates.get(key) === run) gates.delete(key); }).catch(() => undefined);
  return run;
}

export type NewEntry = { at?: Date; entityType: Entry["entityType"]; entityId: string; entityNo?: string | null; action: LedgerAction; actor: LedgerActor; data?: Record<string, unknown>; visibility?: Visibility; visibilityAgencyId?: string | null; state?: Partial<StateAfter> };

async function appendRaw(conflictId: string, e: NewEntry): Promise<Entry | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rec = (await ConflictRecord.findById(oid(conflictId)).select("ledgerHead").lean()) as { ledgerHead?: { seq: number; hash: string } } | null;
    if (!rec) return null;
    const head = rec.ledgerHead ?? null;
    const seq = (head?.seq ?? 0) + 1;
    const base = { conflictId, seq, at: e.at ?? new Date(), entityType: e.entityType, entityId: e.entityId, entityNo: e.entityNo ?? null, action: e.action, actor: e.actor, data: cleanData(e.data ?? {}), visibility: e.visibility ?? "participants" as Visibility, visibilityAgencyId: e.visibilityAgencyId ?? null, stateAfter: await stateOf(conflictId, e.state), prevHash: head?.hash ?? genesisHash(conflictId) };
    const hash = entryHash(base);
    const adv = await ConflictRecord.updateOne({ _id: oid(conflictId), ...(head ? { "ledgerHead.seq": head.seq } : { ledgerHead: { $exists: false } }) }, { $set: { "ledgerHead.seq": seq, "ledgerHead.hash": hash } });
    if (adv.modifiedCount !== 1) continue;
    const entry: Entry = { ...base, recordedAt: new Date(), hash };
    try { await LedgerEntry.create(entry); } catch {
      // Roll the head back so a failed insert never leaves a gap; if even that fails, verify reports head_mismatch/seq_gap.
      await ConflictRecord.updateOne({ _id: oid(conflictId), "ledgerHead.seq": seq, "ledgerHead.hash": hash }, head ? { $set: { "ledgerHead.seq": head.seq, "ledgerHead.hash": head.hash } } : { $unset: { ledgerHead: 1 } }).catch(() => null);
      return null;
    }
    return entry;
  }
  return null;
}

/** Records with no ledger yet get a genesis entry plus the latest events; older events are shown as pre-ledger rows. */
async function ensureLedger(conflictId: string): Promise<void> {
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("ledgerHead events conflictNo").lean()) as unknown as RecordPlain | null;
  if (!rec || rec.ledgerHead) return;
  const reqs = await CoordinationRequest.find({ conflictId: oid(conflictId) }).select("events").lean();
  const times = [...rec.events.map((x) => new Date(x.at).getTime()), ...reqs.flatMap((r) => (r.events as { at: Date }[]).map((x) => new Date(x.at).getTime()))];
  const cutoff = times.length ? new Date(Math.max(...times) - 1) : new Date();
  await appendRaw(conflictId, { entityType: "system", entityId: conflictId, entityNo: rec.conflictNo, action: "ledger_started", actor: { type: "system" }, data: { cutoff: cutoff.toISOString(), preLedgerRecordEvents: rec.events.filter((x) => new Date(x.at) <= cutoff).length, preLedgerCoordinationEvents: reqs.reduce((n, r) => n + (r.events as { at: Date }[]).filter((x) => new Date(x.at) <= cutoff).length, 0) } });
}

export const appendLedger = (conflictId: string, e: NewEntry): Promise<Entry | null> =>
  serial(conflictId, async () => { await ensureLedger(conflictId); return appendRaw(conflictId, e); });

const cutoffOf = async (conflictId: string): Promise<Date | null> => {
  const g = (await LedgerEntry.findOne({ conflictId: oid(conflictId), seq: 1 }).lean()) as { data?: { cutoff?: string } } | null;
  return g?.data?.cutoff ? new Date(g.data.cutoff) : null;
};

type Src = { entityType: "record" | "coordination"; entityId: string; entityNo: string; ev: { id: string; at: Date; type: string; actorType: string; actorId: string | null; actorAgencyId: string | null; data: Record<string, unknown> }; action: LedgerAction };
async function sources(conflictId: string): Promise<Src[]> {
  const rec = (await ConflictRecord.findById(oid(conflictId)).select("events conflictNo").lean()) as unknown as RecordPlain | null;
  if (!rec) return [];
  const reqs = (await CoordinationRequest.find({ conflictId: oid(conflictId) }).select("events requestNo").lean()) as unknown as { _id: mongoose.Types.ObjectId; requestNo: string; events: Src["ev"][] }[];
  return [
    ...rec.events.flatMap((ev) => (RECORD_ACTION[ev.type] ? [{ entityType: "record" as const, entityId: conflictId, entityNo: rec.conflictNo, ev: ev as unknown as Src["ev"], action: RECORD_ACTION[ev.type]! }] : [])),
    ...reqs.flatMap((r) => r.events.flatMap((ev) => (REQUEST_ACTION[ev.type] ? [{ entityType: "coordination" as const, entityId: String(r._id), entityNo: r.requestNo, ev, action: REQUEST_ACTION[ev.type]! }] : []))),
  ].sort((a, b) => new Date(a.ev.at).getTime() - new Date(b.ev.at).getTime());
}

/** Imports record and coordination events that are not yet in the ledger (idempotent by event id). */
export function catchUp(conflictId: string): Promise<number> {
  return serial(conflictId, async () => {
    await ensureLedger(conflictId);
    const cutoff = await cutoffOf(conflictId);
    const have = new Set((await LedgerEntry.find({ conflictId: oid(conflictId), "data.eventId": { $exists: true } }).select("data.eventId").lean()).map((x) => (x.data as { eventId?: string }).eventId));
    let n = 0;
    for (const s of await sources(conflictId)) {
      if (have.has(s.ev.id) || (cutoff && new Date(s.ev.at) <= cutoff)) continue;
      const priv = s.action === "note_added";
      const actor: LedgerActor = s.ev.actorType === "user" ? { type: "user", ...(s.ev.actorId ? { userId: s.ev.actorId } : {}), ...(s.ev.actorAgencyId ? { agencyId: s.ev.actorAgencyId } : {}) } : { type: "system" };
      const onBehalf = s.ev.data.onBehalf === true;
      if (await appendRaw(conflictId, { at: new Date(s.ev.at), entityType: s.entityType, entityId: s.entityId, entityNo: s.entityNo, action: s.action, actor, data: { ...s.ev.data, eventId: s.ev.id, ...(onBehalf ? { hasReason: true } : {}) }, visibility: priv ? "agency" : "participants", visibilityAgencyId: priv ? s.ev.actorAgencyId : null })) n += 1;
    }
    return n;
  });
}

let registered = false;
export function registerLedgerSubscribers(): void {
  if (registered) return;
  registered = true;
  const run = (conflictId: string) => setImmediate(() => { void catchUp(conflictId).catch(() => undefined); });
  roadsyncEvents.on("roadsyncConflictRecordChanged", (e: { conflictId: string }) => run(e.conflictId));
  roadsyncEvents.on("roadsyncCoordinationChanged", (e: { conflictId: string }) => run(e.conflictId));
}

// ---------- reads ----------

export type ChronicleQuery = { cursor?: number; limit: number; category?: string[]; actorAgencyId?: string; from?: Date; to?: Date; q?: string; includePreLedger: boolean };
export type Item = { kind: "entry"; seq: number; at: string; recordedAt: string | null; category: string; action: string; entityType: string; entityId: string; entityNo: string | null; actor: Record<string, unknown>; actorLabel: { agencyId: string | null; role: string | null; person: boolean }; data: Record<string, unknown>; stateAfter: StateAfter; short: string; hash: string; prevHash: string; preLedger: false }
  | { kind: "preledger"; at: string; category: string; action: string; entityType: string; entityNo: string | null; preLedger: true }
  | { kind: "hidden"; fromSeq: number; toSeq: number; count: number };

async function allEntries(conflictId: string): Promise<Entry[]> {
  return (await LedgerEntry.find({ conflictId: oid(conflictId) }).sort({ seq: 1 }).limit(LEDGER.REPLAY_MAX_ENTRIES * 2).lean()) as unknown as Entry[];
}

export async function chronicle(w: Who, id: string, q: ChronicleQuery) {
  const rec = await loadReadable(w, id);
  if (!rec) return null;
  await catchUp(id);
  const entries = await allEntries(id);
  const v = viewerCtx(w);
  const rows = redact(entries, v);
  const cutoff = await cutoffOf(id);
  const items: Item[] = [];
  const pre: Item[] = [];
  if (q.includePreLedger && cutoff) {
    for (const s of await sources(id)) if (new Date(s.ev.at) <= cutoff && (s.action !== "note_added" || w.national || (s.ev.actorAgencyId && (s.ev.actorAgencyId === v.agencyId || v.scopeIds.has(s.ev.actorAgencyId))))) pre.push({ kind: "preledger", at: new Date(s.ev.at).toISOString(), category: CATEGORY(s.action), action: s.action, entityType: s.entityType, entityNo: s.entityNo, preLedger: true });
  }
  let hiddenCount = 0;
  for (const r of rows) {
    if (r.kind === "hidden") { hiddenCount += r.count; items.push(r); continue; }
    const e = r.entry;
    items.push({ kind: "entry", seq: e.seq, at: new Date(e.at).toISOString(), recordedAt: new Date(e.recordedAt).toISOString(), category: CATEGORY(e.action), action: e.action, entityType: e.entityType, entityId: e.entityId, entityNo: e.entityNo, actor: e.actor as unknown as Record<string, unknown>, actorLabel: e.actorLabel, data: e.data, stateAfter: e.stateAfter, short: e.short, hash: e.hash, prevHash: e.prevHash, preLedger: false });
  }
  const at = (i: Item) => (i.kind === "hidden" ? 0 : new Date(i.at).getTime());
  const merged = [...pre, ...items].sort((a, b) => (a.kind === "hidden" || b.kind === "hidden" ? 0 : at(a) - at(b)));
  const keep = (i: Item) => {
    if (i.kind === "hidden") return !q.category && !q.actorAgencyId && !q.from && !q.to && !q.q;
    if (q.category && !q.category.includes(i.category)) return false;
    if (q.q && !i.action.includes(q.q)) return false;
    if (q.from && at(i) < q.from.getTime()) return false;
    if (q.to && at(i) > q.to.getTime()) return false;
    if (q.actorAgencyId && (i.kind === "preledger" || i.actorLabel.agencyId !== q.actorAgencyId)) return false;
    return true;
  };
  const filtered = merged.filter(keep);
  const start = q.cursor ?? 0;
  const page = filtered.slice(start, start + q.limit);
  const head = (rec as RecordPlain).ledgerHead ?? null;
  return { items: page, total: filtered.length, nextCursor: start + q.limit < filtered.length ? start + q.limit : null, hiddenCount, integrity: { lastVerified: (head as { verified?: unknown } | null)?.verified ?? null, count: entries.length, shortHead: head?.hash?.slice(0, 8) ?? null } };
}

export async function stateAtTime(w: Who, id: string, at: Date) {
  const rec = await loadReadable(w, id);
  if (!rec) return null;
  await catchUp(id);
  return stateAt(await allEntries(id), at, viewerCtx(w));
}

const lastVerify = new Map<string, number>();
export async function verifyCase(w: Who, id: string): Promise<{ result: Verify; shortHead: string | null; fullHead: string | null } | null> {
  const rec = await loadReadable(w, id);
  if (!rec) return null;
  await catchUp(id);
  const fresh = (await ConflictRecord.findById(oid(id)).select("ledgerHead").lean()) as { ledgerHead?: { seq: number; hash: string } } | null;
  const result = verifyChain(id, await allEntries(id), fresh?.ledgerHead);
  await ConflictRecord.updateOne({ _id: oid(id), "ledgerHead.seq": { $exists: true } }, { $set: { "ledgerHead.verified": { at: new Date(), ok: result.ok, count: result.count, ...(result.ok ? {} : { firstBrokenSeq: result.firstBrokenSeq, reason: result.reason }) } } });
  const key = `${id}:${w.actor.userId}`;
  if (Date.now() - (lastVerify.get(key) ?? 0) > LEDGER.VERIFY_AUDIT_WINDOW_MS) {
    lastVerify.set(key, Date.now());
    await appendLedger(id, { entityType: "system", entityId: id, entityNo: rec.conflictNo, action: "integrity_verified", actor: { type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId, role: w.actor.roleKey }, data: { count: result.count, ok: result.ok } });
  }
  return { result, shortHead: result.headHash?.slice(0, 8) ?? null, fullHead: w.national ? result.headHash : null };
}

