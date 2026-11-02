/**
 * Step 76 reads. Free text (justification, approval notes, contest reason) is returned only to parties of the
 * resolution (required agencies + national); informed-only agencies get status, outcome and date diffs. Impact objects
 * are scores, bands and counts only. `allowed` actions come from the same engine the server re-checks on every write.
 */
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { loadReadable, type RecordPlain, type Who } from "./conflict-record.service.js";
import { OPEN_LIKE } from "./conflict-record.rules.js";
import { computeAmendmentImpact } from "./coordination.impact.js";
import { CoordinationRequest } from "./models/coordination.model.js";
import { Resolution } from "./models/resolution.model.js";
import { WorkRequest } from "./models/work-request.model.js";
import { amendmentActions, isOfficer, shiftDays, termsToPlan, verificationDelayed } from "./resolution.engine.js";
import { IN_FLIGHT, RES } from "./resolution.rules.js";
import { isParty, loadAms, loadForViewer, requiredAgencies, viewerOf, type AmPlain, type ResPlain } from "./resolution.service.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

async function names(ids: string[]) {
  const rows = ids.length ? await Agency.find({ _id: { $in: [...new Set(ids)].map(oid) } }).select("name").lean() : [];
  return new Map(rows.map((a) => [String(a._id), a.name as string]));
}

export async function viewResolution(w: Who, rec: RecordPlain, res: ResPlain, ams: AmPlain[], now = new Date()) {
  const party = isParty(w, rec);
  const v = viewerOf(w);
  const nm = await names([res.initiator.agencyId, ...res.approvals.flatMap((a) => (a.agencyId ? [a.agencyId] : [])), ...ams.map((a) => String(a.agencyId)), ...res.commitments.map((c) => c.agencyId)]);
  const firstNational = res.approvals.find((s) => s.step === "national" && s.status === "approved")?.by ?? null;
  const verification = res.verification ? { ...res.verification, requestedAt: iso(res.verification.requestedAt), assessedAt: iso(res.verification.assessedAt), result: res.verification.result === "pending" && verificationDelayed(res.verification.requestedAt, now) ? "delayed" : res.verification.result } : null;
  const ctx = { status: res.status, approvals: res.approvals, submitterUserId: res.initiator.userId, firstNationalUserId: firstNational };
  const mineAgency = (id: string) => v.agencyId === id || v.scopeIds.has(id);
  const allowed: string[] = [];
  if (res.active && (w.national || (res.initiator.agencyId === v.agencyId && isOfficer(v))) && !ams.some((a) => a.status === "applied")) allowed.push("cancel");
  if (party && (IN_FLIGHT as readonly string[]).includes(res.status)) allowed.push("reassess");
  if (res.type === "directive" && res.active && !res.contested && ams.some((a) => mineAgency(String(a.agencyId)))) allowed.push("contest");
  if (res.approvals.some((s) => s.step === "party_confirmation" && s.status === "pending" && s.agencyId && mineAgency(s.agencyId) && isOfficer(v))) allowed.push("confirm");
  if (res.approvals.some((s) => s.status === "pending" && ((s.step === "national" || s.step === "national_second") ? w.national : false) && !s.amendmentId)) allowed.push("approve", "reject");
  if (res.status === "needs_followup" && party) allowed.push("add_amendment");
  if (res.status === "needs_followup" && w.national) allowed.push("accept_residual_risk");
  if (w.national && res.commitments.some((c) => c.status === "pending")) allowed.push("waive_commitment");
  if (res.commitments.some((c) => c.status === "pending" && isOfficer(v) && mineAgency(c.agencyId))) allowed.push("complete_commitment");
  return {
    id: String(res._id), resolutionNo: res.resolutionNo, conflictId: String(res.conflictId), conflictNo: res.conflictNo, type: res.type, status: res.status, active: res.active, version: res.version, createdAt: iso(res.createdAt), closedAt: iso(res.closedAt),
    contested: res.contested ? { at: iso(res.contested.at), ...(party ? { reason: res.contested.reason } : {}) } : null,
    initiator: { agencyId: res.initiator.agencyId, agencyName: nm.get(res.initiator.agencyId) ?? null, onBehalf: Boolean(res.initiator.onBehalf) },
    source: res.source,
    plan: { ...(res.plan.noAction ? { noAction: { reasonCode: res.plan.noAction.reasonCode, ...(party && res.plan.noAction.note ? { note: res.plan.noAction.note } : {}) } } : {}), ...(res.plan.riskAcceptance ? { riskAcceptance: { acceptedBand: res.plan.riskAcceptance.acceptedBand, acceptedScore: res.plan.riskAcceptance.acceptedScore, mitigations: res.plan.riskAcceptance.mitigations.map((m) => ({ code: m.code, ...(party && m.text ? { text: m.text } : {}) })), ...(party ? { justification: res.plan.riskAcceptance.justification } : {}) } } : {}), ...(res.plan.directive ? { directive: { deadlineAt: iso(res.plan.directive.deadlineAt), overdue: now > new Date(res.plan.directive.deadlineAt) && ams.some((a) => a.status !== "applied"), ...(party ? { justification: res.plan.directive.justification } : {}) } } : {}), ...(res.plan.opportunity ? { opportunity: { leadAgencyId: res.plan.opportunity.leadAgencyId ?? null, ...(party && res.plan.opportunity.note ? { note: res.plan.opportunity.note } : {}) } } : {}) },
    approvals: res.approvals.map((s) => ({ id: s.id, step: s.step, agencyId: s.agencyId ?? null, agencyName: s.agencyId ? nm.get(s.agencyId) ?? null : null, amendmentId: s.amendmentId ?? null, status: s.status, at: iso(s.at), byMe: s.by === w.actor.userId, ...(party && s.note ? { note: s.note } : {}), dueAt: iso(s.dueAt), overdue: s.status === "pending" && now > new Date(s.dueAt), soloApproval: Boolean(s.soloApproval), routedNoSecondAdmin: Boolean(s.routedNoSecondAdmin), onBehalf: Boolean(s.onBehalf) })),
    commitments: res.commitments.map((c) => ({ id: c.id, agencyId: c.agencyId, agencyName: nm.get(c.agencyId) ?? null, code: c.code, status: c.status, ...(party && c.text ? { text: c.text } : {}), doneAt: iso(c.doneAt ?? null) })),
    verification, outcome: res.outcome ? { ...res.outcome, resolvedAt: iso(res.outcome.resolvedAt) } : null,
    amendments: ams.map((a) => ({ id: String(a._id), amendmentNo: a.amendmentNo, workRequestId: String(a.workRequestId), agencyId: String(a.agencyId), agencyName: nm.get(String(a.agencyId)) ?? null, status: a.status, mandated: a.mandated, source: a.source, mine: mineAgency(String(a.agencyId)), changes: { schedule: { before: { plannedStart: iso(a.changes.schedule.before.plannedStart), plannedEnd: iso(a.changes.schedule.before.plannedEnd) }, after: { plannedStart: iso(a.changes.schedule.after.plannedStart), plannedEnd: iso(a.changes.schedule.after.plannedEnd) }, shiftDays: shiftDays(a.changes.schedule.before.plannedStart, a.changes.schedule.after.plannedStart) } }, impact: a.impact, appliedAt: iso(a.appliedAt), allowed: amendmentActions({ id: String(a._id), agencyId: String(a.agencyId), status: a.status as never, createdByUserId: a.createdBy.userId, mandated: a.mandated }, ctx, v) })),
    allowed,
  };
}

export async function forConflict(w: Who, conflictId: string) {
  const rec = await loadReadable(w, conflictId);
  if (!rec) return null;
  const all = (await Resolution.find({ conflictId: oid(conflictId) }).sort({ createdAt: -1 }).limit(20).lean()) as unknown as ResPlain[];
  const current = all.find((r) => r.active) ?? all[0] ?? null;
  return {
    resolution: current ? await viewResolution(w, rec, current, await loadAms(current._id)) : null,
    history: all.filter((r) => r !== current).map((r) => ({ id: String(r._id), resolutionNo: r.resolutionNo, type: r.type, status: r.status, outcome: r.outcome?.code ?? null, closedAt: iso(r.closedAt) })),
    recordStatus: rec.status, canStart: OPEN_LIKE.includes(rec.status) && !all.some((r) => r.active),
  };
}

export async function getOne(w: Who, id: string) {
  const ctx = await loadForViewer(w, id);
  return ctx ? viewResolution(w, ctx.rec, ctx.res, await loadAms(ctx.res._id)) : null;
}

/** Deterministic facts only: derived plan from agreed terms and which paths this viewer may start. */
export async function suggestions(w: Who, conflictId: string) {
  const rec = await loadReadable(w, conflictId);
  if (!rec) return null;
  const v = viewerOf(w);
  const required = requiredAgencies(rec);
  const mineRequired = required.some((id) => id === v.agencyId || v.scopeIds.has(id));
  const open = OPEN_LIKE.includes(rec.status);
  const pair = { aId: String(rec.aId), bId: String(rec.bId), aType: rec.aType, bType: rec.bType, aAgencyId: rec.sides.a.agencyId, bAgencyId: rec.sides.b.agencyId };
  const agreed = (await CoordinationRequest.find({ conflictId: oid(conflictId), status: "agreed" }).sort({ closedAt: -1 }).limit(3).lean()) as unknown as { _id: mongoose.Types.ObjectId; requestNo: string; type: string; agreedTerms: Parameters<typeof termsToPlan>[0] & { round: number } }[];
  const own = [rec.aType === "work_request" ? { id: String(rec.aId), agencyId: rec.sides.a.agencyId } : null, rec.bType === "work_request" ? { id: String(rec.bId), agencyId: rec.sides.b.agencyId } : null].filter((x): x is { id: string; agencyId: string } => Boolean(x));
  return {
    open, agreed: agreed.map((r) => ({ coordinationRequestId: String(r._id), requestNo: r.requestNo, type: r.type, plan: termsToPlan(r.agreedTerms, pair) })),
    targets: own.map((t) => ({ requestId: t.id, agencyId: t.agencyId, mine: t.agencyId === v.agencyId || v.scopeIds.has(t.agencyId) })),
    paths: { agreedTerms: open && mineRequired && agreed.length > 0, manual: open && mineRequired && own.some((t) => t.agencyId === v.agencyId), opportunity: open && mineRequired && rec.recordType === "opportunity", noAction: open && mineRequired, directive: open && w.national, riskAcceptance: open && w.national && rec.recordType === "conflict" },
    limits: { justificationMin: RES.JUSTIFICATION_MIN, reasonMin: RES.REASON_MIN, directiveDefaultDays: RES.DIRECTIVE_DEFAULT_DAYS, directiveMaxDays: RES.DIRECTIVE_MAX_DAYS },
  };
}

export async function previewImpact(w: Who, body: { conflictId: string; changes: { targetRequestId: string; schedule: { plannedStart: string; plannedEnd: string } }[] }) {
  const rec = await loadReadable(w, body.conflictId);
  if (!rec) return null;
  const out = [];
  for (const c of body.changes.slice(0, RES.MAX_AMENDMENTS)) {
    const side = [rec.aType === "work_request" && String(rec.aId) === c.targetRequestId ? rec.sides.a.agencyId : null, rec.bType === "work_request" && String(rec.bId) === c.targetRequestId ? rec.sides.b.agencyId : null].find(Boolean);
    if (!side) return "invalid_target" as const;
    const wr = await WorkRequest.findById(oid(c.targetRequestId)).select("plannedStart plannedEnd").lean();
    if (!wr) return "invalid_target" as const;
    const start = new Date(c.schedule.plannedStart);
    const end = new Date(c.schedule.plannedEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "invalid_dates" as const;
    out.push({ targetRequestId: c.targetRequestId, shiftDays: shiftDays(wr.plannedStart, start), impact: await computeAmendmentImpact(c.targetRequestId, String(rec.candidateId), { start, end }) });
  }
  return { items: out, combined: { newConflicts: out.reduce((n, o) => n + o.impact.thirdParty.newConflicts, 0), worsened: out.reduce((n, o) => n + o.impact.thirdParty.worsened, 0), cleared: out.reduce((n, o) => n + o.impact.thirdParty.cleared, 0) } };
}

// ---------- approvals queue ----------

export type QueueQuery = { tab: "mine" | "submitted" | "all"; step?: string; overdue?: boolean; page: number; limit: number };
export async function approvalsQueue(w: Who, q: QueueQuery, now = new Date()) {
  const v = viewerOf(w);
  const rows = (await Resolution.find({ active: true, "approvals.status": "pending" }).sort({ updatedAt: -1 }).limit(200).lean()) as unknown as ResPlain[];
  const out = [];
  for (const res of rows) {
    const rec = await loadReadable(w, String(res.conflictId));
    if (!rec) continue;
    const ams = await loadAms(res._id);
    for (const s of res.approvals.filter((x) => x.status === "pending")) {
      const am = s.amendmentId ? ams.find((a) => String(a._id) === s.amendmentId) : undefined;
      const submitter = am?.submittedBy?.userId ?? res.initiator.userId;
      const assigned = s.step === "national" || s.step === "national_second" ? w.national : Boolean(s.agencyId && (s.agencyId === v.agencyId || v.scopeIds.has(s.agencyId))) || (w.national && Boolean(s.agencyId));
      const involved = assigned || submitter === v.userId || w.national || isParty(w, rec);
      if (q.tab === "mine" ? !assigned : q.tab === "submitted" ? submitter !== v.userId : !involved) continue;
      if (q.step && s.step !== q.step) continue;
      const overdue = now > new Date(s.dueAt);
      if (q.overdue && !overdue) continue;
      out.push({ resolutionId: String(res._id), resolutionNo: res.resolutionNo, amendmentNo: am?.amendmentNo ?? null, conflictId: String(res.conflictId), conflictNo: res.conflictNo, type: res.type, step: s.step, stepId: s.id, severityAtDetection: rec.severity.atDetection.band, dueAt: iso(s.dueAt), overdue, fourEyesOk: submitter !== v.userId || Boolean(s.soloApproval), assigned, version: res.version, requestedByAgencyId: res.initiator.agencyId, changes: am ? { before: { plannedStart: iso(am.changes.schedule.before.plannedStart), plannedEnd: iso(am.changes.schedule.before.plannedEnd) }, after: { plannedStart: iso(am.changes.schedule.after.plannedStart), plannedEnd: iso(am.changes.schedule.after.plannedEnd) } } : null, impact: am?.impact ? { pair: am.impact.pair, thirdParty: am.impact.thirdParty } : null });
    }
  }
  const nm = await names(out.map((o) => o.requestedByAgencyId));
  const page = out.slice((q.page - 1) * q.limit, q.page * q.limit).map((o) => ({ ...o, requestedBy: nm.get(o.requestedByAgencyId) ?? null }));
  return { items: page, total: out.length, page: q.page, limit: q.limit };
}

export async function approvalsSummary(w: Who) {
  const r = await approvalsQueue(w, { tab: "mine", page: 1, limit: 200 });
  return { pending: r.total, overdue: r.items.filter((i) => i.overdue).length };
}

