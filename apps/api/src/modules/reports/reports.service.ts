import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { AuditLog } from "../audit/models/audit-log.model.js";
import { ContractorAssignment } from "../contractors/models/contractor-assignment.model.js";
import { Contractor } from "../contractors/models/contractor.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { CitizenIssue } from "../issues/models/citizen-issue.model.js";
import { Project } from "../projects/models/project.model.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";

export type ReportFilters = {
  from?: string;
  to?: string;
  agencyId?: string;
  status?: string;
};

const CSV_ROW_CAP = 5000;

export function escapeCsvCell(raw: unknown): string {
  const str = raw == null ? "" : String(raw);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

async function buildScopedProjectFilter(actor: AuthenticatedActor, filters: ReportFilters) {
  const scope = await resolveResourceScope(actor);
  const base = projectReadFilter(scope);
  const parts: Record<string, unknown>[] = [base];

  if (filters.agencyId && mongoose.isValidObjectId(filters.agencyId)) {
    const reqAgency = new mongoose.Types.ObjectId(filters.agencyId);
    if (scope.kind === "platform" || (scope.kind === "agencies" && scope.agencyIds.some((id) => id.equals(reqAgency)))) {
      parts.push({ agencyId: reqAgency });
    } else {
      parts.push({ _id: { $in: [] } });
    }
  }
  if (filters.status) {
    parts.push({ status: filters.status });
  }
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) {
      const d = new Date(filters.from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (filters.to) {
      const d = new Date(filters.to);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    if (Object.keys(range).length > 0) {
      parts.push({ createdAt: range });
    }
  }
  return { scope, projectFilter: parts.length === 1 ? base : { $and: parts } };
}

export async function getReportsOverview(actor: AuthenticatedActor, filters: ReportFilters) {
  const { scope, projectFilter } = await buildScopedProjectFilter(actor, filters);
  const now = new Date();

  const projects = await Project.find(projectFilter)
    .select("_id status budget physicalProgress financialProgress plannedEndDate riskLevel agencyId")
    .lean();

  const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
  const statusMap = new Map<string, number>();
  let totalBudgetMinor = 0;
  let progressSum = 0;
  let delayedProjects = 0;
  let criticalRiskProjects = 0;

  for (const p of projects) {
    statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1);
    const budgetObj = p.budget as { amountMinor?: number } | undefined;
    totalBudgetMinor += typeof budgetObj?.amountMinor === "number" ? budgetObj.amountMinor : 0;
    progressSum += typeof p.physicalProgress === "number" ? p.physicalProgress : 0;
    if (p.plannedEndDate && p.plannedEndDate < now && !["COMPLETED", "CANCELLED"].includes(p.status)) {
      delayedProjects += 1;
    }
    if (p.riskLevel === "CRITICAL") {
      criticalRiskProjects += 1;
    }
  }

  const issueFilter =
    scope.kind === "platform"
      ? {}
      : scope.kind === "none"
        ? { _id: { $in: [] } }
        : { assignedAgency: { $in: scope.agencyIds } };

  const conflictFilter =
    scope.kind === "platform"
      ? { status: "open", recordType: "conflict" }
      : scope.kind === "none"
        ? { _id: { $in: [] } }
        : { status: "open", recordType: "conflict", agencyIds: { $in: scope.agencyIds } };

  const [paidAgg, openIssues, openConflicts] = await Promise.all([
    projectIds.length > 0
      ? ProjectPayment.aggregate<{ totalPaidMinor: number }>([
          { $match: { projectId: { $in: projectIds }, status: "PAID" } },
          { $group: { _id: null, totalPaidMinor: { $sum: "$amount.amountMinor" } } },
        ])
      : Promise.resolve([]),
    CitizenIssue.countDocuments({ ...issueFilter, status: { $nin: ["RESOLVED", "CLOSED", "REJECTED", "DUPLICATE"] } }),
    ConflictRecord.countDocuments(conflictFilter),
  ]);

  const totalPaidMinor = paidAgg[0]?.totalPaidMinor ?? 0;

  return {
    totalProjects: projects.length,
    activeProjects: (statusMap.get("ACTIVE") ?? 0) + (statusMap.get("IN_PROGRESS") ?? 0),
    completedProjects: statusMap.get("COMPLETED") ?? 0,
    delayedProjects,
    criticalRiskProjects,
    avgPhysicalProgress: projects.length > 0 ? Math.round(progressSum / projects.length) : 0,
    totalBudgetMinor,
    totalPaidMinor,
    openIssues,
    openConflicts,
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}

export async function getProjectsReport(actor: AuthenticatedActor, filters: ReportFilters) {
  const { projectFilter } = await buildScopedProjectFilter(actor, filters);
  const [projects, agencies] = await Promise.all([
    Project.find(projectFilter)
      .select("_id projectCode title projectType status agencyId budget physicalProgress financialProgress riskLevel plannedEndDate location.district")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
    Agency.find({ status: "ACTIVE" }).select("_id code name").lean(),
  ]);
  const agencyMap = new Map(agencies.map((a) => [String(a._id), { code: a.code, name: a.name }]));

  const districtCounts = new Map<string, number>();
  const items = projects.map((p) => {
    const dist = (p.location as { district?: string } | undefined)?.district ?? "Unspecified";
    districtCounts.set(dist, (districtCounts.get(dist) ?? 0) + 1);
    const ag = agencyMap.get(String(p.agencyId));
    const budgetMinor = (p.budget as { amountMinor?: number } | undefined)?.amountMinor ?? 0;
    return {
      id: String(p._id),
      projectCode: p.projectCode,
      title: p.title,
      projectType: p.projectType,
      status: p.status,
      agencyCode: ag?.code ?? null,
      agencyName: ag?.name ?? null,
      district: dist,
      budgetMinor,
      physicalProgress: p.physicalProgress ?? 0,
      financialProgress: p.financialProgress ?? 0,
      riskLevel: p.riskLevel ?? null,
      plannedEndDate: p.plannedEndDate instanceof Date ? p.plannedEndDate.toISOString() : null,
    };
  });

  return {
    items,
    byDistrict: Array.from(districtCounts.entries())
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
  };
}

export async function getAgenciesReport(actor: AuthenticatedActor, filters: ReportFilters) {
  const { projectFilter } = await buildScopedProjectFilter(actor, filters);
  const [projects, agencies] = await Promise.all([
    Project.find(projectFilter).select("_id agencyId budget physicalProgress status").lean(),
    Agency.find({ status: "ACTIVE" }).select("_id code name").lean(),
  ]);

  const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
  const paidByAgency = projectIds.length > 0
    ? await ProjectPayment.aggregate<{ _id: mongoose.Types.ObjectId; paidMinor: number }>([
        { $match: { projectId: { $in: projectIds }, status: "PAID" } },
        { $group: { _id: "$agencyId", paidMinor: { $sum: "$amount.amountMinor" } } },
      ])
    : [];
  const paidMap = new Map(paidByAgency.map((r) => [String(r._id), r.paidMinor]));
  const agencyMap = new Map(agencies.map((a) => [String(a._id), a]));

  const buckets = new Map<string, { projectCount: number; activeCount: number; budgetMinor: number; progressSum: number }>();
  for (const p of projects) {
    const key = String(p.agencyId);
    const b = buckets.get(key) ?? { projectCount: 0, activeCount: 0, budgetMinor: 0, progressSum: 0 };
    b.projectCount += 1;
    if (p.status === "ACTIVE" || p.status === "APPROVED") b.activeCount += 1;
    b.budgetMinor += (p.budget as { amountMinor?: number } | undefined)?.amountMinor ?? 0;
    b.progressSum += p.physicalProgress ?? 0;
    buckets.set(key, b);
  }

  return {
    items: Array.from(buckets.entries()).map(([agencyId, b]) => {
      const ag = agencyMap.get(agencyId);
      return {
        agencyId,
        code: ag?.code ?? agencyId,
        name: ag?.name ?? "Agency",
        projectCount: b.projectCount,
        activeCount: b.activeCount,
        budgetMinor: b.budgetMinor,
        paidMinor: paidMap.get(agencyId) ?? 0,
        avgPhysicalProgress: b.projectCount > 0 ? Math.round(b.progressSum / b.projectCount) : 0,
      };
    }),
  };
}

export async function getBudgetsReport(actor: AuthenticatedActor, filters: ReportFilters) {
  const { projectFilter } = await buildScopedProjectFilter(actor, filters);
  const projects = await Project.find(projectFilter)
    .select("_id projectCode title budget financialProgress")
    .sort({ "budget.amountMinor": -1 })
    .limit(100)
    .lean();

  const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
  const payments = projectIds.length > 0
    ? await ProjectPayment.aggregate<{ _id: { projectId: mongoose.Types.ObjectId; status: string }; totalMinor: number }>([
        { $match: { projectId: { $in: projectIds }, status: { $in: ["PAID", "PENDING", "APPROVED"] } } },
        { $group: { _id: { projectId: "$projectId", status: "$status" }, totalMinor: { $sum: "$amount.amountMinor" } } },
      ])
    : [];

  const paidMap = new Map<string, number>();
  const pendingMap = new Map<string, number>();
  for (const row of payments) {
    const pid = String(row._id.projectId);
    if (row._id.status === "PAID") paidMap.set(pid, row.totalMinor);
    else pendingMap.set(pid, (pendingMap.get(pid) ?? 0) + row.totalMinor);
  }

  return {
    items: projects.map((p) => {
      const pid = String(p._id);
      const budgetMinor = (p.budget as { amountMinor?: number } | undefined)?.amountMinor ?? 0;
      const paidMinor = paidMap.get(pid) ?? 0;
      const pendingMinor = pendingMap.get(pid) ?? 0;
      return {
        projectId: pid,
        projectCode: p.projectCode,
        title: p.title,
        budgetMinor,
        paidMinor,
        pendingMinor,
        utilizationPercent: budgetMinor > 0 ? Math.round((paidMinor / budgetMinor) * 100) : 0,
      };
    }),
  };
}

export async function getContractorsReport(actor: AuthenticatedActor, filters: ReportFilters) {
  const { projectFilter } = await buildScopedProjectFilter(actor, filters);
  const projects = await Project.find(projectFilter).select("_id").lean();
  const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
  if (projectIds.length === 0) return { items: [] };

  const [assignments, payments] = await Promise.all([
    ContractorAssignment.aggregate<{ _id: mongoose.Types.ObjectId; assignmentCount: number }>([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$contractorId", assignmentCount: { $sum: 1 } } },
    ]),
    ProjectPayment.aggregate<{ _id: mongoose.Types.ObjectId; paidMinor: number }>([
      { $match: { projectId: { $in: projectIds }, status: "PAID" } },
      { $group: { _id: "$contractorId", paidMinor: { $sum: "$amount.amountMinor" } } },
    ]),
  ]);

  const paidMap = new Map(payments.map((p) => [String(p._id), p.paidMinor]));
  const contractorIds = assignments.map((a) => a._id);
  const contractors = contractorIds.length > 0
    ? await Contractor.find({ _id: { $in: contractorIds } }).select("_id registrationNumber name category status").lean()
    : [];
  const contractorMap = new Map(contractors.map((c) => [String(c._id), c]));

  return {
    items: assignments.map((a) => {
      const c = contractorMap.get(String(a._id));
      return {
        contractorId: String(a._id),
        registrationNumber: c?.registrationNumber ?? null,
        name: c?.name ?? "Contractor",
        category: c?.category ?? null,
        status: c?.status ?? null,
        assignmentCount: a.assignmentCount,
        paidMinor: paidMap.get(String(a._id)) ?? 0,
      };
    }),
  };
}

export async function buildReportCsv(
  actor: AuthenticatedActor,
  kind: "projects" | "agencies" | "budgets" | "contractors",
  filters: ReportFilters,
  requestId: string,
): Promise<{ filename: string; csv: string }> {
  let headers: string[] = [];
  let rows: Array<Array<unknown>> = [];

  if (kind === "agencies") {
    const data = await getAgenciesReport(actor, filters);
    headers = ["Agency Code", "Agency Name", "Projects", "Active Projects", "Budget (LKR)", "Paid (LKR)", "Avg Progress (%)"];
    rows = data.items.slice(0, CSV_ROW_CAP).map((r) => [
      r.code,
      r.name,
      r.projectCount,
      r.activeCount,
      (r.budgetMinor / 100).toFixed(2),
      (r.paidMinor / 100).toFixed(2),
      r.avgPhysicalProgress,
    ]);
  } else if (kind === "budgets") {
    const data = await getBudgetsReport(actor, filters);
    headers = ["Project Code", "Title", "Budget (LKR)", "Paid (LKR)", "Pending (LKR)", "Utilization (%)"];
    rows = data.items.slice(0, CSV_ROW_CAP).map((r) => [
      r.projectCode,
      r.title,
      (r.budgetMinor / 100).toFixed(2),
      (r.paidMinor / 100).toFixed(2),
      (r.pendingMinor / 100).toFixed(2),
      r.utilizationPercent,
    ]);
  } else if (kind === "contractors") {
    const data = await getContractorsReport(actor, filters);
    headers = ["Registration No", "Name", "Category", "Status", "Assignments", "Paid (LKR)"];
    rows = data.items.slice(0, CSV_ROW_CAP).map((r) => [
      r.registrationNumber ?? "",
      r.name,
      r.category ?? "",
      r.status ?? "",
      r.assignmentCount,
      (r.paidMinor / 100).toFixed(2),
    ]);
  } else {
    const data = await getProjectsReport(actor, filters);
    headers = ["Project Code", "Title", "Type", "Status", "Agency", "District", "Budget (LKR)", "Physical (%)", "Financial (%)", "Risk"];
    rows = data.items.slice(0, CSV_ROW_CAP).map((r) => [
      r.projectCode,
      r.title,
      r.projectType,
      r.status,
      r.agencyCode ?? "",
      r.district,
      (r.budgetMinor / 100).toFixed(2),
      r.physicalProgress,
      r.financialProgress,
      r.riskLevel ?? "",
    ]);
  }

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(actor.userId),
    agencyId: actor.agencyId && mongoose.isValidObjectId(actor.agencyId) ? new mongoose.Types.ObjectId(actor.agencyId) : undefined,
    action: "report.export",
    resourceType: "SYSTEM",
    resourceId: new mongoose.Types.ObjectId(actor.userId),
    newValue: { reason: `export:${kind}:rows=${rows.length}` },
    requestId,
  });

  const csvLines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return {
    filename: `infraos-${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: csvLines.join("\r\n"),
  };
}
