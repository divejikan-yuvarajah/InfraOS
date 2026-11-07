import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter } from "../identity/authorization/resource-scope.js";
import { User } from "../identity/models/user.model.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { Project } from "../projects/models/project.model.js";
import { canSee, certState, tierOf, type ContractorLike } from "./contractor.access.js";
import { assignedInScope, contextOf, need, notFound, run, type Result } from "./contractor.context.js";
import { ContractorAssignment } from "./models/contractor-assignment.model.js";
import { Contractor } from "./models/contractor.model.js";

const MAX_EVENTS = 600;
/** Audit rows that describe assignments are NOT used: assignment events come from the scoped assignment rows, so an out-of-scope project can never leak through an audit row. */
const AUDIT_ACTIONS = ["contractor.registered", "contractor.updated", "contractor.status_changed", "contractor.certification_added", "contractor.certification_updated", "contractor.certification_revoked", "contractor.document_ref_added", "contractor.document_ref_removed"];

export type TimelineEvent = { key: string; type: string; at: string; params: Record<string, string | number | null>; projectId?: string; actor?: string | null };

/** Merged, newest-first events for one contractor, built per request from bounded sources. The cursor is an offset into that deterministic list. */
export function contractorTimeline(actor: AuthenticatedActor, rawId: string, q: { cursor?: string; limit: number }) {
  return run(async (): Promise<Result<unknown>> => {
    if (!/^[a-f0-9]{24}$/i.test(rawId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.read");
    const doc = await Contractor.findById(rawId).lean();
    if (!doc) return notFound();
    const assigned = await assignedInScope(ctx, doc._id);
    if (!canSee(ctx.viewer, doc as unknown as ContractorLike, assigned)) return notFound();
    const manage = tierOf(ctx.viewer, doc as unknown as ContractorLike, assigned) === "manage";
    const now = new Date();
    const events: TimelineEvent[] = [];

    const scoped = ctx.scope.kind === "agencies" ? { agencyId: { $in: ctx.agencyObjectIds } } : {};
    const rows = await ContractorAssignment.find({ contractorId: doc._id, ...scoped }).sort({ startDate: -1 }).limit(300).lean();
    const projects = await Project.find({ $and: [projectReadFilter(ctx.scope), { _id: { $in: rows.map((r) => r.projectId) } }] }).select("projectCode title status plannedEndDate actualEndDate").lean();
    const byProject = new Map(projects.map((p) => [String(p._id), p]));
    const visibleRows = rows.filter((r) => byProject.has(String(r.projectId)));
    const label = (id: unknown) => { const p = byProject.get(String(id)); return p ? `${p.projectCode} ${p.title}` : ""; };
    for (const r of visibleRows) {
      const pid = String(r.projectId);
      events.push({ key: `a:${r._id}:s`, type: "assignment.started", at: r.startDate.toISOString(), params: { project: label(pid), role: r.role }, projectId: pid });
      if (r.status !== "ACTIVE" && r.endDate) events.push({ key: `a:${r._id}:e`, type: `assignment.${r.status.toLowerCase()}`, at: r.endDate.toISOString(), params: { project: label(pid), role: r.role, reason: r.endReason ?? null }, projectId: pid });
      const p = byProject.get(pid)!;
      if (p.status === "COMPLETED" && p.actualEndDate) {
        const late = p.plannedEndDate && p.actualEndDate > p.plannedEndDate ? Math.floor((p.actualEndDate.getTime() - p.plannedEndDate.getTime()) / 86_400_000) : 0;
        events.push({ key: `p:${pid}:c`, type: late > 0 ? "project.completed_late" : "project.completed", at: p.actualEndDate.toISOString(), params: { project: label(pid), lateDays: late }, projectId: pid });
      } else if (r.status === "ACTIVE" && p.status === "DELAYED" && p.plannedEndDate) {
        events.push({ key: `p:${pid}:d`, type: "project.delayed", at: p.plannedEndDate.toISOString(), params: { project: label(pid) }, projectId: pid });
      }
    }
    const inspections = await Inspection.find({ projectId: { $in: visibleRows.map((r) => r.projectId) }, status: { $in: ["VERIFIED", "REJECTED", "REQUIRES_REVIEW"] } }).select("projectId status inspectionDate").limit(200).lean();
    for (const i of inspections) {
      if (visibleRows.some((r) => String(r.projectId) === String(i.projectId) && i.inspectionDate >= r.startDate && (!r.endDate || i.inspectionDate <= r.endDate))) {
        events.push({ key: `i:${i._id}`, type: "inspection.outcome", at: i.inspectionDate.toISOString(), params: { project: label(i.projectId), outcome: i.status }, projectId: String(i.projectId) });
      }
    }

    const audit = await AuditLog.find({ resourceType: "CONTRACTOR", resourceId: doc._id, action: { $in: AUDIT_ACTIONS } }).select("+newValue +oldValue").sort({ timestamp: -1 }).limit(300).lean();
    // Directory-tier viewers only learn that a status change happened: no reason, no edited-field names, no actor.
    const visibleAudit = manage ? audit : audit.filter((a) => a.action === "contractor.status_changed" || a.action === "contractor.registered");
    const names = manage ? new Map((await User.find({ _id: { $in: [...new Set(visibleAudit.map((a) => String(a.userId)))] } }).select("firstName lastName").lean()).map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()])) : new Map<string, string>();
    for (const a of visibleAudit) {
      const reason = manage ? a.newValue?.reason ?? null : null;
      events.push({ key: `l:${a._id}`, type: a.action.replace("contractor.", "audit."), at: (a.timestamp ?? new Date(0)).toISOString(), params: { status: a.newValue?.status ?? null, from: manage ? a.oldValue?.status ?? null : null, reason }, actor: manage ? names.get(String(a.userId)) ?? null : null });
    }
    if (manage) {
      for (const c of doc.certifications ?? []) {
        if (!c.expiresOn) continue;
        const state = certState(c, now);
        if (state === "EXPIRED" || state === "EXPIRING") events.push({ key: `k:${c._id}`, type: state === "EXPIRED" ? "certification.expired" : "certification.expiring", at: c.expiresOn.toISOString(), params: { name: c.name } });
      }
    }

    events.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
    const capped = events.slice(0, MAX_EVENTS);
    const offset = q.cursor?.startsWith("o") ? Number(q.cursor.slice(1)) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) return { ok: false, status: 400, code: "VALIDATION_ERROR", details: null };
    const page = capped.slice(offset, offset + q.limit);
    const next = offset + q.limit < capped.length ? `o${offset + q.limit}` : null;
    return { ok: true, data: { events: page, nextCursor: next, truncated: events.length > MAX_EVENTS, basedOn: "projects you can access" } };
  });
}
