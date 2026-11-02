/**
 * Step 77 reads beyond the Chronicle: evidence pack, chronicle CSV, closed-case archive, national audit explorer and
 * batch integrity check. Everything is redacted per viewer; exports carry ids, codes and numbers (free text only for
 * parties and only where the resolution view already allows it). No deletion or retention job exists in this step.
 */
import mongoose from "mongoose";

import { RULE_VERSION } from "./assessment.rules.js";
import { csvCell } from "./conflict-record.read.js";
import { loadReadable, type RecordPlain, type Who } from "./conflict-record.service.js";
import { verifyChain, type Entry } from "./ledger.engine.js";
import { appendLedger, chronicle } from "./ledger.service.js";
import { ConflictRecord } from "./models/conflict-record.model.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { Amendment, LedgerEntry } from "./models/resolution.model.js";
import { forConflict } from "./resolution.read.js";
import { LEDGER } from "./resolution.rules.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const BOM = String.fromCharCode(0xfeff);
const NOTICE = "Tamper-evident, not tamper-proof: the chain detects edits made without recomputing it. Demo data only; not an official government record.";

async function allRows(w: Who, id: string) {
  const out = [];
  let cursor: number | undefined;
  for (let i = 0; i < 50; i += 1) {
    const page = await chronicle(w, id, { limit: LEDGER.PAGE_MAX, includePreLedger: true, ...(cursor !== undefined ? { cursor } : {}) });
    if (!page) return null;
    out.push(...page.items);
    if (page.nextCursor === null || out.length >= LEDGER.EXPORT_MAX_ROWS) return { items: out.slice(0, LEDGER.EXPORT_MAX_ROWS), integrity: page.integrity };
    cursor = page.nextCursor;
  }
  return null;
}

async function audited(w: Who, rec: RecordPlain, count: number, format: "json" | "csv") {
  await appendLedger(String(rec._id), { entityType: "system", entityId: String(rec._id), entityNo: rec.conflictNo, action: "export_generated", actor: { type: "user", userId: w.actor.userId, agencyId: w.actor.agencyId, role: w.actor.roleKey }, data: { rows: count, format } }).catch(() => null);
}

export async function evidencePack(w: Who, id: string) {
  const rec = await loadReadable(w, id);
  if (!rec) return null;
  const rows = await allRows(w, id);
  if (!rows) return null;
  const res = await forConflict(w, id);
  const agreed = (await CoordinationRequest.find({ conflictId: oid(id), status: "agreed" }).select("requestNo type agreedTerms").lean()) as unknown as { requestNo: string; type: string; agreedTerms: { proposal: unknown; agreedAt: Date } | null }[];
  await audited(w, rec, rows.items.length, "json");
  return {
    generatedAt: new Date().toISOString(), ruleVersion: RULE_VERSION, evidenceNotice: NOTICE,
    case: { conflictNo: rec.conflictNo, status: rec.status, severity: { atDetection: rec.severity.atDetection.band, current: rec.severity.current.band }, parties: [rec.sides.a, rec.sides.b].map((s) => ({ ref: s.ref, agencyId: s.agencyId, plannedStart: iso(s.plannedStart), plannedEnd: iso(s.plannedEnd) })), closedAt: iso(rec.closedAt) },
    agreedTerms: agreed.map((a) => ({ requestNo: a.requestNo, type: a.type, agreedAt: iso(a.agreedTerms?.agreedAt), proposal: a.agreedTerms?.proposal ?? null })),
    resolution: res?.resolution ?? null, history: res?.history ?? [], chronicle: rows.items, integrity: rows.integrity,
  };
}

export async function chronicleCsv(w: Who, id: string): Promise<{ body: string; count: number } | null> {
  const rec = await loadReadable(w, id);
  if (!rec) return null;
  const rows = await allRows(w, id);
  if (!rows) return null;
  const head = ["seq", "at", "category", "action", "entity", "actorAgencyId", "actorRole", "preLedger", "shortHash"];
  const lines = rows.items.map((i) => (i.kind === "entry" ? [i.seq, i.at, i.category, i.action, i.entityNo, i.actorLabel.agencyId, i.actorLabel.role, "false", i.short] : i.kind === "preledger" ? ["", i.at, i.category, i.action, i.entityNo, "", "", "true", ""] : [`${i.fromSeq}-${i.toSeq}`, "", "hidden", `${i.count}_entries_not_visible`, "", "", "", "false", ""]).map(csvCell).join(","));
  await audited(w, rec, lines.length, "csv");
  return { body: `${BOM}${[head.join(","), ...lines].join("\r\n")}\r\n`, count: lines.length };
}

// ---------- closed-case archive ----------

export type ArchiveQuery = { outcome?: string[]; band?: string[]; from?: Date; to?: Date; q?: string; sort: "resolvedAt" | "duration" | "severity"; page: number; limit: number };
const CLOSED = ["resolved", "dismissed", "auto_closed"];

async function archiveFilter(w: Who, q: ArchiveQuery) {
  const f: Record<string, unknown> = { status: { $in: CLOSED } };
  if (!w.national) f.agencyIds = { $in: [...w.scopeIds].map(oid) };
  if (q.band) f["severity.atDetection.band"] = { $in: q.band };
  if (q.q) f.conflictNo = { $regex: `^${q.q.replace(/[^A-Za-z0-9-]/g, "")}`, $options: "i" };
  if (q.from || q.to) f.closedAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  return f;
}

export async function archive(w: Who, q: ArchiveQuery, cap = LEDGER.EXPORT_MAX_ROWS) {
  const recs = (await ConflictRecord.find(await archiveFilter(w, q)).sort(q.sort === "severity" ? { "severity.current.score": -1 } : { closedAt: -1 }).limit(cap).lean()) as unknown as RecordPlain[];
  const ids = recs.map((r) => r._id);
  const applied = ids.length ? await Amendment.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { conflictId: { $in: ids }, status: "applied" } }, { $group: { _id: "$conflictId", n: { $sum: 1 } } }]) : [];
  const appliedBy = new Map(applied.map((a) => [String(a._id), a.n]));
  let rows = recs.map((r) => {
    const outcome = r.resolution?.outcome ?? (r.status === "resolved" ? "resolved" : r.status);
    const end = r.closedAt ?? r.updatedAt;
    return { conflictId: String(r._id), conflictNo: r.conflictNo, status: r.status, outcome, resolutionNo: r.resolution?.no ?? null, resolutionType: r.resolution?.type ?? null, severityAtDetection: r.severity.atDetection.band, severityAtResolution: r.resolution?.resolvedBand ?? r.severity.current.band, durationDays: Math.max(0, Math.round((new Date(end).getTime() - new Date(r.createdAt).getTime()) / 86_400_000)), amendmentsApplied: appliedBy.get(String(r._id)) ?? 0, openCommitments: r.resolution?.openCommitments ?? 0, closedAt: iso(end), parties: [r.sides.a.ref, r.sides.b.ref], integrity: (r.ledgerHead as { verified?: { ok: boolean } } | undefined)?.verified?.ok ?? null };
  });
  if (q.outcome) rows = rows.filter((r) => q.outcome!.includes(r.outcome));
  if (q.sort === "duration") rows.sort((a, b) => b.durationDays - a.durationDays);
  const resolved = rows.filter((r) => r.status === "resolved");
  const days = resolved.map((r) => r.durationDays).sort((a, b) => a - b);
  return { total: rows.length, page: q.page, limit: q.limit, items: rows.slice((q.page - 1) * q.limit, q.page * q.limit), tiles: { resolved: resolved.length, riskAccepted: rows.filter((r) => r.outcome === "risk_accepted").length, noAction: rows.filter((r) => r.outcome === "no_action").length, medianDaysToResolve: days.length ? days[Math.floor(days.length / 2)]! : null }, _rows: rows };
}

export async function archiveCsv(w: Who, q: ArchiveQuery): Promise<{ body: string; count: number }> {
  const { _rows } = await archive(w, { ...q, page: 1, limit: 1 });
  const head = ["conflictNo", "status", "outcome", "resolutionNo", "severityAtDetection", "severityAtResolution", "durationDays", "amendmentsApplied", "openCommitments", "closedAt"];
  const lines = _rows.slice(0, LEDGER.EXPORT_MAX_ROWS).map((r) => [r.conflictNo, r.status, r.outcome, r.resolutionNo, r.severityAtDetection, r.severityAtResolution, r.durationDays, r.amendmentsApplied, r.openCommitments, r.closedAt].map(csvCell).join(","));
  return { body: `${BOM}${[head.join(","), ...lines].join("\r\n")}\r\n`, count: lines.length };
}

// ---------- national audit explorer ----------

export type AuditQuery = { action?: string[]; actorAgencyId?: string; entityType?: string; from?: Date; to?: Date; conflictId?: string; q?: string; page: number; limit: number };
/** National only (enforced by the route). Entries are ids, codes and numbers; the audit view adds the case number. */
export async function auditList(q: AuditQuery) {
  const f: Record<string, unknown> = {};
  if (q.action) f.action = { $in: q.action };
  if (q.actorAgencyId) f["actor.agencyId"] = q.actorAgencyId;
  if (q.entityType) f.entityType = q.entityType;
  if (q.conflictId) f.conflictId = oid(q.conflictId);
  if (q.q) f.action = { $regex: q.q.replace(/[^a-z_]/g, "") };
  if (q.from || q.to) f.at = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const [total, rows] = await Promise.all([LedgerEntry.countDocuments(f), LedgerEntry.find(f).sort({ at: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean()]);
  return { total, page: q.page, limit: q.limit, items: rows.map((r) => ({ conflictId: String(r.conflictId), seq: r.seq, at: iso(r.at), action: r.action, entityType: r.entityType, entityNo: r.entityNo, actor: r.actor, data: r.data, short: r.hash.slice(0, 8), hash: r.hash })) };
}

export async function verifyBatch(ids: string[]) {
  const out = [];
  for (const id of [...new Set(ids)].slice(0, LEDGER.VERIFY_BATCH_MAX)) {
    const rec = (await ConflictRecord.findById(oid(id)).select("conflictNo ledgerHead").lean()) as unknown as Pick<RecordPlain, "conflictNo" | "ledgerHead"> | null;
    if (!rec) { out.push({ conflictId: id, found: false }); continue; }
    const entries = (await LedgerEntry.find({ conflictId: oid(id) }).sort({ seq: 1 }).lean()) as unknown as Entry[];
    out.push({ conflictId: id, found: true, conflictNo: rec.conflictNo, ...verifyChain(id, entries, rec.ledgerHead) });
  }
  return out;
}

