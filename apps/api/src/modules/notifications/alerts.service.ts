import mongoose from "mongoose";

import { logger } from "../../shared/logger.js";
import { parseListQuery } from "../../shared/http/list-query.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Inspection } from "../inspections/models/inspection.model.js";
import { CitizenIssue } from "../issues/models/citizen-issue.model.js";
import { Milestone } from "../projects/models/milestone.model.js";
import { Project } from "../projects/models/project.model.js";
import { RiskAssessment } from "../risk/models/risk-assessment.model.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { SystemAlert } from "./models/system-alert.model.js";
import { notify } from "./notify.service.js";

const ALERT_INTERVAL_MS = 15 * 60 * 1000;
const LEASE_COLLECTION = "job_leases";
const LEASE_ID = "system_alert_scan";

type CandidateAlert = {
  kind:
    | "MILESTONE_OVERDUE"
    | "PROJECT_OVERDUE"
    | "HIGH_CONFLICT"
    | "INSPECTION_OVERDUE"
    | "CRITICAL_RISK"
    | "ISSUE_UNROUTED"
    | "ISSUE_OVERDUE";
  severity: "WARNING" | "CRITICAL";
  title: string;
  message: string;
  resourceType: string;
  resourceId: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId | null;
  actionUrl: string;
  dedupeKey: string;
};

async function acquireLease(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return true;
  const now = new Date();
  const until = new Date(now.getTime() + ALERT_INTERVAL_MS - 30_000);
  try {
    const res = await db.collection<{ _id: string; lockedUntil?: Date }>(LEASE_COLLECTION).findOneAndUpdate(
      { _id: LEASE_ID, $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }] },
      { $set: { lockedUntil: until, updatedAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(res);
  } catch (err: unknown) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : undefined;
    if (code === 11000) return false;
    return true;
  }
}

export async function evaluateSystemAlerts(options?: { bypassLease?: boolean }): Promise<{ created: number; evaluated: number }> {
  if (mongoose.connection.readyState !== 1) return { created: 0, evaluated: 0 };
  if (!options?.bypassLease) {
    const leased = await acquireLease();
    if (!leased) return { created: 0, evaluated: 0 };
  }

  const now = new Date();
  const unroutedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates: CandidateAlert[] = [];

  const [overdueMilestones, overdueProjects, highConflicts, overdueInspections, criticalRisks, unroutedIssues, overdueIssues] =
    await Promise.all([
      Milestone.find({
        plannedEnd: { $lt: now },
        status: { $nin: ["COMPLETED", "CANCELLED"] },
      })
        .select("_id projectId title plannedEnd")
        .limit(50)
        .lean(),
      Project.find({
        plannedEndDate: { $lt: now },
        status: { $in: ["APPROVED", "ACTIVE", "IN_PROGRESS", "ON_HOLD"] },
      })
        .select("_id projectCode title agencyId plannedEndDate")
        .limit(50)
        .lean(),
      ConflictRecord.find({
        status: "open",
        recordType: "conflict",
      })
        .select("_id conflictNo severity agencyIds sides")
        .limit(50)
        .lean(),
      Inspection.find({
        inspectionDate: { $lt: now },
        status: { $in: ["SCHEDULED", "IN_PROGRESS"] },
      })
        .select("_id inspectionNo projectId agencyId inspectionDate")
        .limit(50)
        .lean(),
      RiskAssessment.find({
        overallLevel: "CRITICAL",
      })
        .sort({ createdAt: -1 })
        .select("_id projectId agencyId overallIndex")
        .limit(30)
        .lean(),
      CitizenIssue.find({
        assignedAgency: { $in: [null, undefined] },
        status: "SUBMITTED",
        createdAt: { $lt: unroutedCutoff },
      })
        .select("_id referenceNo title createdAt")
        .limit(50)
        .lean(),
      CitizenIssue.find({
        slaDueAt: { $lt: now },
        status: { $nin: ["RESOLVED", "CLOSED", "REJECTED", "DUPLICATE"] },
      })
        .select("_id referenceNo title assignedAgency slaDueAt")
        .limit(50)
        .lean(),
    ]);

  const milestoneProjectIds = overdueMilestones.map((m) => m.projectId);
  const milestoneProjects = milestoneProjectIds.length > 0
    ? await Project.find({ _id: { $in: milestoneProjectIds } }).select("_id agencyId projectCode").lean()
    : [];
  const milestoneProjectMap = new Map(milestoneProjects.map((p) => [String(p._id), p]));

  for (const m of overdueMilestones) {
    const p = milestoneProjectMap.get(String(m.projectId));
    candidates.push({
      kind: "MILESTONE_OVERDUE",
      severity: "WARNING",
      title: `Overdue milestone: ${m.title}`,
      message: `Milestone on project ${p?.projectCode ?? String(m.projectId)} passed planned end date.`,
      resourceType: "PROJECT",
      resourceId: m.projectId as mongoose.Types.ObjectId,
      agencyId: (p?.agencyId as mongoose.Types.ObjectId | undefined) ?? null,
      actionUrl: `/projects/${String(m.projectId)}`,
      dedupeKey: `MILESTONE_OVERDUE:${String(m._id)}`,
    });
  }

  for (const p of overdueProjects) {
    candidates.push({
      kind: "PROJECT_OVERDUE",
      severity: "WARNING",
      title: `Project overdue: ${p.projectCode}`,
      message: `${p.title} has passed its planned completion date.`,
      resourceType: "PROJECT",
      resourceId: p._id as mongoose.Types.ObjectId,
      agencyId: (p.agencyId as mongoose.Types.ObjectId | undefined) ?? null,
      actionUrl: `/projects/${String(p._id)}`,
      dedupeKey: `PROJECT_OVERDUE:${String(p._id)}`,
    });
  }

  for (const c of highConflicts) {
    const sevObj = c.severity as { tier?: string } | string | undefined;
    const tier = typeof sevObj === "string" ? sevObj : sevObj?.tier ?? "";
    if (!["HIGH", "CRITICAL", "high", "critical"].includes(tier)) continue;
    const firstAgency = Array.isArray(c.agencyIds) && c.agencyIds[0] ? (c.agencyIds[0] as mongoose.Types.ObjectId) : null;
    candidates.push({
      kind: "HIGH_CONFLICT",
      severity: "CRITICAL",
      title: `Unresolved high conflict ${c.conflictNo}`,
      message: `Spatial conflict ${c.conflictNo} (${tier.toUpperCase()}) remains open.`,
      resourceType: "CONFLICT",
      resourceId: c._id as mongoose.Types.ObjectId,
      agencyId: firstAgency,
      actionUrl: `/roadsync/conflicts/${String(c._id)}`,
      dedupeKey: `HIGH_CONFLICT:${String(c._id)}`,
    });
  }

  for (const ins of overdueInspections) {
    candidates.push({
      kind: "INSPECTION_OVERDUE",
      severity: "WARNING",
      title: `Overdue inspection ${ins.inspectionNo ?? String(ins._id)}`,
      message: "Scheduled site inspection has passed its inspection date without completion.",
      resourceType: "INSPECTION",
      resourceId: ins._id as mongoose.Types.ObjectId,
      agencyId: (ins.agencyId as mongoose.Types.ObjectId | undefined) ?? null,
      actionUrl: `/inspections/${String(ins._id)}`,
      dedupeKey: `INSPECTION_OVERDUE:${String(ins._id)}`,
    });
  }

  const seenRiskProjects = new Set<string>();
  for (const r of criticalRisks) {
    const pid = String(r.projectId);
    if (seenRiskProjects.has(pid)) continue;
    seenRiskProjects.add(pid);
    candidates.push({
      kind: "CRITICAL_RISK",
      severity: "CRITICAL",
      title: "Critical project risk detected",
      message: `Latest risk assessment scored CRITICAL (index ${r.overallIndex ?? "N/A"}).`,
      resourceType: "PROJECT",
      resourceId: r.projectId as mongoose.Types.ObjectId,
      agencyId: (r.agencyId as mongoose.Types.ObjectId | undefined) ?? null,
      actionUrl: `/projects/${pid}`,
      dedupeKey: `CRITICAL_RISK:${pid}`,
    });
  }

  for (const iss of unroutedIssues) {
    candidates.push({
      kind: "ISSUE_UNROUTED",
      severity: "WARNING",
      title: `Unrouted citizen issue ${iss.referenceNo ?? String(iss._id)}`,
      message: `${iss.title} has waited >24h without agency assignment.`,
      resourceType: "CITIZEN_ISSUE",
      resourceId: iss._id as mongoose.Types.ObjectId,
      agencyId: null,
      actionUrl: `/issues/${String(iss._id)}`,
      dedupeKey: `ISSUE_UNROUTED:${String(iss._id)}`,
    });
  }

  for (const iss of overdueIssues) {
    candidates.push({
      kind: "ISSUE_OVERDUE",
      severity: "CRITICAL",
      title: `Citizen issue SLA overdue: ${iss.referenceNo ?? String(iss._id)}`,
      message: `${iss.title} has exceeded its target SLA resolution window.`,
      resourceType: "CITIZEN_ISSUE",
      resourceId: iss._id as mongoose.Types.ObjectId,
      agencyId: (iss.assignedAgency as mongoose.Types.ObjectId | undefined) ?? null,
      actionUrl: `/issues/${String(iss._id)}`,
      dedupeKey: `ISSUE_OVERDUE:${String(iss._id)}`,
    });
  }

  let created = 0;
  for (const item of candidates) {
    const existing = await SystemAlert.findOne({ dedupeKey: item.dedupeKey }).select("_id status").lean();
    if (!existing) {
      await SystemAlert.create({
        ...item,
        status: "ACTIVE",
        lastEvaluatedAt: now,
      });
      created += 1;
      await notify({
        permission: "notification.read",
        agencyId: item.agencyId,
        type: "SYSTEM",
        severity: item.severity,
        title: item.title,
        message: item.message,
        resourceType: item.resourceType === "CONFLICT" || item.resourceType === "INSPECTION" || item.resourceType === "CITIZEN_ISSUE" ? item.resourceType : "PROJECT",
        resourceId: item.resourceId,
        actionUrl: item.actionUrl,
        dedupeKey: `alert:${item.dedupeKey}`,
      }).catch(() => undefined);
    } else {
      await SystemAlert.updateOne(
        { _id: existing._id },
        { $set: { lastEvaluatedAt: now, title: item.title, message: item.message, severity: item.severity } },
      );
    }
  }

  const activeKeys = new Set(candidates.map((c) => c.dedupeKey));
  await SystemAlert.updateMany(
    { status: { $in: ["ACTIVE", "ACKNOWLEDGED"] }, dedupeKey: { $nin: Array.from(activeKeys) } },
    { $set: { status: "RESOLVED", lastEvaluatedAt: now } },
  );

  return { created, evaluated: candidates.length };
}

export function startAlertsScheduler(): { stop: () => void } {
  if (process.env.NODE_ENV === "test") {
    return { stop: () => undefined };
  }
  const timer = setInterval(() => {
    void evaluateSystemAlerts().catch((err) => {
      logger.warn({ err: String(err) }, "system alerts evaluation failed");
    });
  }, ALERT_INTERVAL_MS);
  timer.unref();
  return {
    stop: () => clearInterval(timer),
  };
}

export async function listSystemAlerts(actor: AuthenticatedActor, rawQuery: Record<string, unknown>) {
  const scope = await resolveResourceScope(actor);
  if (scope.kind === "none") {
    return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  }
  const parsed = parseListQuery(rawQuery);
  const page = parsed?.page ?? 1;
  const limit = parsed?.limit ?? 20;
  const status = typeof rawQuery.status === "string" && ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"].includes(rawQuery.status)
    ? rawQuery.status
    : "ACTIVE";
  const severity = typeof rawQuery.severity === "string" && ["WARNING", "CRITICAL"].includes(rawQuery.severity)
    ? rawQuery.severity
    : undefined;

  const filter: Record<string, unknown> = { status };
  if (severity) filter.severity = severity;
  if (scope.kind === "agencies") {
    filter.$or = [{ agencyId: { $in: scope.agencyIds } }, { agencyId: null }];
  }

  const [rows, total] = await Promise.all([
    SystemAlert.find(filter)
      .sort({ severity: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SystemAlert.countDocuments(filter),
  ]);

  return {
    items: rows.map((r) => ({
      id: String(r._id),
      kind: r.kind,
      severity: r.severity,
      title: r.title,
      message: r.message,
      resourceType: r.resourceType,
      resourceId: String(r.resourceId),
      actionUrl: r.actionUrl ?? null,
      status: r.status,
      acknowledgedAt: r.acknowledgedAt instanceof Date ? r.acknowledgedAt.toISOString() : null,
      lastEvaluatedAt: r.lastEvaluatedAt instanceof Date ? r.lastEvaluatedAt.toISOString() : new Date().toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function acknowledgeSystemAlert(actor: AuthenticatedActor, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const scope = await resolveResourceScope(actor);
  if (scope.kind === "none") return null;

  const filter: Record<string, unknown> = { _id: new mongoose.Types.ObjectId(id) };
  if (scope.kind === "agencies") {
    filter.$or = [{ agencyId: { $in: scope.agencyIds } }, { agencyId: null }];
  }

  const updated = await SystemAlert.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "ACKNOWLEDGED",
        acknowledgedBy: new mongoose.Types.ObjectId(actor.userId),
        acknowledgedAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  if (!updated) return null;
  return {
    id: String(updated._id),
    status: updated.status,
    acknowledgedAt: updated.acknowledgedAt instanceof Date ? updated.acknowledgedAt.toISOString() : null,
  };
}
