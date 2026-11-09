import mongoose from "mongoose";
import {
  type RiskFactorCategory,
  type RiskLevel,
  type RiskMethodologyDto,
  type RiskOverviewDto,
  type RiskPortfolioTrendDto,
  type RiskPortfolioTrendPointDto,
  type RiskProjectRowDto,
  type RiskProjectsListDto,
  type RiskScatterPointDto,
  type RiskSeverity,
} from "@infraos/shared-types";
import { RULES_CATALOG, THRESHOLDS } from "./engine/catalog.js";
import { colomboDayStart } from "./engine/math.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import {
  projectReadFilter,
  resolveResourceScope,
} from "../identity/authorization/resource-scope.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Project } from "../projects/models/project.model.js";
import { RiskAssessment } from "./models/risk-assessment.model.js";
import { RiskResolution } from "./models/risk-resolution.model.js";
import { RiskRun } from "./models/risk-run.model.js";
import { writeRiskAudit } from "./risk.audit.js";

const SEVERITY_POINTS: Record<RiskSeverity, number> = {
  INFO: 0,
  LOW: 5,
  MODERATE: 12,
  HIGH: 25,
  CRITICAL: 40,
};

const LEVEL_WEIGHT: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  NOT_ASSESSABLE: 0,
};

export function csvSafe(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export interface RiskProjectsQuery {
  agencyId?: string;
  projectType?: string;
  status?: string;
  level?: string; // Comma-separated: "HIGH,CRITICAL"
  category?: string; // Has >= HIGH in this category
  sufficiency?: string;
  resolution?: string; // "unacknowledged" | "acknowledged" | "reopened"
  stale?: string | number | boolean;
  q?: string;
  district?: string;
  sort?: "level" | "index" | "assessedAt" | "title" | "gap";
  page?: number;
  limit?: number;
}

export async function getRiskOverview(
  actor: AuthenticatedActor,
): Promise<RiskOverviewDto> {
  const scope = await resolveResourceScope(actor);
  const now = new Date();
  const today = colomboDayStart(now);
  const staleThreshold = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const baseFilter = projectReadFilter(scope);

  // Load all projects in scope
  const projects = await Project.find(baseFilter)
    .select("riskLevel riskScore riskAssessedAt latestRiskAssessmentId status")
    .lean();

  let assessed = 0;
  let critical = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  let notAssessable = 0;
  let stale = 0;

  const assessedProjectIds: mongoose.Types.ObjectId[] = [];
  const highPlusProjectIds: mongoose.Types.ObjectId[] = [];

  for (const p of projects) {
    if (p.riskLevel) {
      assessed++;
      assessedProjectIds.push(p._id);

      if (p.riskLevel === "CRITICAL") {
        critical++;
        highPlusProjectIds.push(p._id);
      } else if (p.riskLevel === "HIGH") {
        high++;
        highPlusProjectIds.push(p._id);
      } else if (p.riskLevel === "MODERATE") {
        moderate++;
      } else if (p.riskLevel === "LOW") {
        low++;
      }

      if (p.riskAssessedAt && new Date(p.riskAssessedAt) < staleThreshold) {
        stale++;
      }
    } else {
      notAssessable++;
    }
  }

  // Count unacknowledged HIGH+
  let unacknowledgedHighPlus = highPlusProjectIds.length;
  if (highPlusProjectIds.length > 0) {
    const resolutions = await RiskResolution.find({
      projectId: { $in: highPlusProjectIds },
      status: { $in: ["ACKNOWLEDGED", "RESOLVED", "DISMISSED"] },
    })
      .select("projectId")
      .lean();

    const ackedProjectIds = new Set(resolutions.map((r) => r.projectId.toString()));
    unacknowledgedHighPlus = highPlusProjectIds.filter(
      (id) => !ackedProjectIds.has(id.toString()),
    ).length;
  }

  // Category breakdown: projects with >= HIGH indicator
  const categoriesMap: Record<
    RiskFactorCategory,
    { highPlusCount: number; totalAssessed: number }
  > = {
    DELAY: { highPlusCount: 0, totalAssessed: assessed },
    PROGRESS: { highPlusCount: 0, totalAssessed: assessed },
    BUDGET: { highPlusCount: 0, totalAssessed: assessed },
    SCHEDULE: { highPlusCount: 0, totalAssessed: assessed },
    COORDINATION: { highPlusCount: 0, totalAssessed: assessed },
    OTHER: { highPlusCount: 0, totalAssessed: assessed },
  };

  if (assessedProjectIds.length > 0) {
    const latestAssessments = await RiskAssessment.find({
      projectId: { $in: assessedProjectIds },
    })
      .sort({ createdAt: -1 })
      .select("projectId categories")
      .lean();

    // Map latest assessment per project
    const seen = new Set<string>();
    for (const a of latestAssessments) {
      const pid = a.projectId.toString();
      if (seen.has(pid)) continue;
      seen.add(pid);

      for (const cat of a.categories ?? []) {
        if (
          (cat.level === "HIGH" || cat.level === "CRITICAL") &&
          categoriesMap[cat.category as RiskFactorCategory]
        ) {
          categoriesMap[cat.category as RiskFactorCategory].highPlusCount++;
        }
      }
    }
  }

  // Last run info
  const lastRun = await RiskRun.findOne()
    .sort({ startedAt: -1 })
    .lean();

  return {
    asOf: now.toISOString(),
    scope: scope.kind === "platform" ? "platform" : "agency",
    counts: {
      assessed,
      critical,
      high,
      moderate,
      low,
      notAssessable,
      stale,
      unacknowledgedHighPlus,
    },
    categories: categoriesMap,
    lastRun: lastRun
      ? {
          id: lastRun._id.toString(),
          runId: lastRun.runId,
          trigger: lastRun.trigger,
          scope: lastRun.scope,
          status: lastRun.status,
          counters: lastRun.counters,
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString(),
          errorCode: lastRun.errorCode ?? undefined,
        }
      : null,
    sourceNotices: [],
  };
}

export async function getRiskProjects(
  actor: AuthenticatedActor,
  query: RiskProjectsQuery,
): Promise<RiskProjectsListDto> {
  const scope = await resolveResourceScope(actor);
  const now = new Date();
  const today = colomboDayStart(now);
  const staleThreshold = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const filters: Record<string, unknown>[] = [projectReadFilter(scope)];

  if (query.agencyId && mongoose.Types.ObjectId.isValid(query.agencyId)) {
    filters.push({ agencyId: new mongoose.Types.ObjectId(query.agencyId) });
  }

  if (query.projectType) {
    filters.push({ projectType: query.projectType });
  }

  if (query.status) {
    filters.push({ status: query.status });
  }

  if (query.level) {
    const levels = query.level.split(",").map((l) => l.trim().toUpperCase());
    filters.push({ riskLevel: { $in: levels } });
  }

  if (query.district) {
    filters.push({ "location.district": query.district });
  }

  if (query.stale === "1" || query.stale === 1 || query.stale === true) {
    filters.push({
      riskAssessedAt: { $lt: staleThreshold },
      riskLevel: { $exists: true, $ne: null },
    });
  }

  if (query.q) {
    const regex = new RegExp(query.q.trim(), "i");
    filters.push({
      $or: [{ projectCode: regex }, { title: regex }],
    });
  }

  const combinedFilter = filters.length > 1 ? { $and: filters } : filters[0]!;

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  // Sorting
  const sortOption: Record<string, 1 | -1> = {};
  if (query.sort === "index") {
    sortOption.riskScore = -1;
  } else if (query.sort === "assessedAt") {
    sortOption.riskAssessedAt = -1;
  } else if (query.sort === "title") {
    sortOption.title = 1;
  } else {
    // Default level desc then riskScore desc
    sortOption.riskScore = -1;
    sortOption.riskAssessedAt = -1;
  }

  const total = await Project.countDocuments(combinedFilter);
  const projects = await Project.find(combinedFilter)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  if (projects.length === 0) {
    return {
      items: [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const projectIds = projects.map((p) => p._id);
  const agencyIds = Array.from(new Set(projects.map((p) => p.agencyId)));

  const [agencies, latestAssessments, resolutions] = await Promise.all([
    Agency.find({ _id: { $in: agencyIds } }).select("name").lean(),
    RiskAssessment.find({ projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .lean(),
    RiskResolution.find({ projectId: { $in: projectIds } }).lean(),
  ]);

  const agencyMap = new Map(agencies.map((a) => [a._id.toString(), a.name]));

  // Map latest assessment per project
  const assessmentMap = new Map<string, any>();
  for (const a of latestAssessments) {
    const pid = a.projectId.toString();
    if (!assessmentMap.has(pid)) {
      assessmentMap.set(pid, a);
    }
  }

  // Map resolutions per project
  const resMap = new Map<string, any[]>();
  for (const r of resolutions) {
    const pid = r.projectId.toString();
    const existing = resMap.get(pid) ?? [];
    existing.push(r);
    resMap.set(pid, existing);
  }

  const rows: RiskProjectRowDto[] = projects.map((p) => {
    const pid = p._id.toString();
    const assessment = assessmentMap.get(pid);
    const projResolutions = resMap.get(pid) ?? [];

    const categories: Record<RiskFactorCategory, RiskLevel> = {
      DELAY: "NOT_ASSESSABLE",
      PROGRESS: "NOT_ASSESSABLE",
      BUDGET: "NOT_ASSESSABLE",
      SCHEDULE: "NOT_ASSESSABLE",
      COORDINATION: "NOT_ASSESSABLE",
      OTHER: "NOT_ASSESSABLE",
    };

    for (const cat of assessment?.categories ?? []) {
      if (cat.category in categories) {
        categories[cat.category as RiskFactorCategory] = cat.level;
      }
    }

    // Top 3 indicators by points
    const indicators = [...(assessment?.indicators ?? [])]
      .filter((i) => i.severity !== "INFO")
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((i) => ({
        code: i.code,
        severity: i.severity,
        titleKey: i.titleKey,
        points: i.points,
      }));

    let openCount = 0;
    let acknowledgedCount = 0;
    let reopenedCount = 0;

    for (const r of projResolutions) {
      if (r.status === "OPEN") openCount++;
      else if (r.status === "ACKNOWLEDGED") acknowledgedCount++;
      else if (r.status === "REOPENED") reopenedCount++;
    }

    return {
      id: pid,
      projectId: pid,
      projectCode: p.projectCode,
      title: p.title,
      status: p.status,
      agencyId: p.agencyId.toString(),
      agencyName: agencyMap.get(p.agencyId.toString()),
      projectType: p.projectType,
      district: (p as any).location?.district,
      overallLevel: p.riskLevel ?? "NOT_ASSESSABLE",
      overallIndex: p.riskScore ?? undefined,
      categories,
      topIndicators: indicators,
      physicalProgress: p.physicalProgress ?? 0,
      financialProgress: p.financialProgress ?? 0,
      physicalBasis: (assessment?.indicators?.[0]?.basis as any) ?? "REPORTED",
      assessedAt: p.riskAssessedAt
        ? new Date(p.riskAssessedAt).toISOString()
        : new Date(p.updatedAt ?? now).toISOString(),
      resolutionSummary: {
        openCount,
        acknowledgedCount,
        reopenedCount,
      },
    };
  });

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRiskScatter(
  actor: AuthenticatedActor,
): Promise<RiskScatterPointDto[]> {
  const scope = await resolveResourceScope(actor);
  const filter = {
    $and: [
      projectReadFilter(scope),
      {
        status: { $in: ["ACTIVE", "DELAYED", "ON_HOLD", "APPROVED"] },
        riskLevel: { $exists: true, $ne: null },
      },
    ],
  };

  const projects = await Project.find(filter)
    .sort({ riskScore: -1 })
    .limit(500)
    .select("projectCode title physicalProgress financialProgress riskLevel agencyId")
    .lean();

  return projects.map((p) => ({
    projectId: p._id.toString(),
    projectCode: p.projectCode,
    title: p.title,
    physicalPct: p.physicalProgress ?? 0,
    financialPct: p.financialProgress ?? 0,
    basis: "REPORTED",
    level: p.riskLevel ?? "LOW",
    agencyId: p.agencyId.toString(),
  }));
}

export async function getPortfolioTrend(
  actor: AuthenticatedActor,
  rangeWeeks: number = 12,
): Promise<RiskPortfolioTrendDto> {
  const scope = await resolveResourceScope(actor);
  const projects = await Project.find(projectReadFilter(scope))
    .select("_id")
    .lean();

  const projectIds = projects.map((p) => p._id);
  if (projectIds.length === 0) {
    return {
      trend: [],
      insufficientHistory: true,
      snapshotsCount: 0,
    };
  }

  const now = new Date();
  const weeksLimit = Math.min(Math.max(rangeWeeks, 4), 26);
  const startDate = new Date(now.getTime() - weeksLimit * 7 * 24 * 60 * 60 * 1000);

  // Group assessments by week and project to get latest assessment per project per week
  const assessments = await RiskAssessment.find({
    projectId: { $in: projectIds },
    createdAt: { $gte: startDate },
  })
    .sort({ createdAt: 1 })
    .select("projectId overallLevel createdAt")
    .lean();

  if (assessments.length === 0) {
    return {
      trend: [],
      insufficientHistory: true,
      snapshotsCount: 0,
    };
  }

  // Bucket by week starting on Monday
  const weekBuckets = new Map<string, Map<string, RiskLevel>>();

  for (const a of assessments) {
    const aDate = new Date(a.createdAt);
    const day = aDate.getUTCDay();
    const diff = aDate.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
    const weekStart = new Date(Date.UTC(aDate.getUTCFullYear(), aDate.getUTCMonth(), diff));
    const weekKey = weekStart.toISOString().slice(0, 10);

    const projectLevelMap = weekBuckets.get(weekKey) ?? new Map<string, RiskLevel>();
    projectLevelMap.set(a.projectId.toString(), a.overallLevel);
    weekBuckets.set(weekKey, projectLevelMap);
  }

  const trend: RiskPortfolioTrendPointDto[] = [];
  const sortedWeeks = Array.from(weekBuckets.keys()).sort();

  for (const weekKey of sortedWeeks) {
    const projectMap = weekBuckets.get(weekKey)!;
    let critical = 0;
    let high = 0;
    let moderate = 0;
    let low = 0;
    let notAssessable = 0;

    for (const level of projectMap.values()) {
      if (level === "CRITICAL") critical++;
      else if (level === "HIGH") high++;
      else if (level === "MODERATE") moderate++;
      else if (level === "LOW") low++;
      else notAssessable++;
    }

    trend.push({
      weekStart: weekKey,
      critical,
      high,
      moderate,
      low,
      notAssessable,
      total: projectMap.size,
    });
  }

  return {
    trend,
    insufficientHistory: trend.length < 3,
    snapshotsCount: assessments.length,
  };
}

export async function getMethodology(): Promise<RiskMethodologyDto> {
  const completedProjectsCount = await Project.countDocuments({ status: "COMPLETED" });
  const completedWithActualEndDateCount = await Project.countDocuments({
    status: "COMPLETED",
    actualEndDate: { $exists: true, $ne: null },
  });

  return {
    engineVersion: "r1",
    rulesCatalog: RULES_CATALOG,
    scoringDefinitions: {
      severityPoints: SEVERITY_POINTS,
      categoryIndexFormula: "min(100, sum of triggered rule points in category)",
      categoryLevelRules: [
        "CRITICAL: Any CRITICAL indicator or category index >= 70",
        "HIGH: Any HIGH indicator or category index >= 45",
        "MODERATE: Any MODERATE indicator or category index >= 20",
        "LOW: Category index < 20 and sufficiency is SUFFICIENT or LIMITED",
        "NOT_ASSESSABLE: Category sufficiency is INSUFFICIENT",
      ],
      overallLevelRules: [
        "Maximum level across assessable categories",
        "NOT_ASSESSABLE when all categories are INSUFFICIENT",
        "Low — limited data when overall is LOW and any category is LIMITED or INSUFFICIENT",
      ],
      sufficiencyRules: {
        SUFFICIENT: "All headline inputs available, fresh and valid",
        LIMITED: "Some indicators unavailable or stale; risk assessment proceeds with caution",
        INSUFFICIENT: "Headline data missing; category cannot be objectively scored",
      },
    },
    applicabilityRules: {
      ACTIVE: "Full risk evaluation across all 5 categories",
      DELAYED: "Full risk evaluation across all 5 categories",
      ON_HOLD: "Schedule and budget readiness evaluated; delay timers paused",
      APPROVED: "Pre-start readiness evaluated (budget, schedule, coordination)",
      DRAFT: "Not applicable (project not formally started)",
      SUBMITTED: "Not applicable (pending approval)",
      UNDER_REVIEW: "Not applicable (pending review)",
      COMPLETED: "Not applicable (outcomes recorded, risk history preserved)",
      CANCELLED: "Not applicable",
      REJECTED: "Not applicable",
    },
    historyStats: {
      completedProjectsCount,
      completedWithActualEndDateCount,
      comparableSetsAvailable: 1,
      readinessStatement:
        "Platform currently operating with deterministic rule baseline (r1). Statistical model training readiness monitored as historical project volume grows.",
    },
    limitationsKeys: [
      "risk.methodology.limitations.ruleBasedBaseline",
      "risk.methodology.limitations.dataAvailability",
      "risk.methodology.limitations.noFraudClaims",
      "risk.methodology.limitations.advisoryOnly",
    ],
    honestyStatement:
      "Rule-based baseline. Not a prediction model. No accuracy claim.",
  };
}

export async function exportRiskCsv(
  actor: AuthenticatedActor,
  query: RiskProjectsQuery,
  requestId: string,
): Promise<string> {
  const result = await getRiskProjects(actor, {
    ...query,
    page: 1,
    limit: 5000,
  });

  const headers = [
    "Project Code",
    "Title",
    "Agency",
    "Project Type",
    "Status",
    "District",
    "Overall Risk Level",
    "Rule Points Index",
    "Physical Progress %",
    "Financial Progress %",
    "Progress Basis",
    "Delay Level",
    "Progress Level",
    "Budget Level",
    "Schedule Level",
    "Coordination Level",
    "Last Assessed At",
    "Top Indicator",
  ];

  const lines: string[] = [headers.map(csvSafe).join(",")];

  for (const row of result.items) {
    const line = [
      row.projectCode,
      row.title,
      row.agencyName ?? row.agencyId,
      row.projectType,
      row.status,
      row.district ?? "",
      row.overallLevel,
      row.overallIndex ?? "",
      `${row.physicalProgress}%`,
      `${row.financialProgress}%`,
      row.physicalBasis,
      row.categories.DELAY,
      row.categories.PROGRESS,
      row.categories.BUDGET,
      row.categories.SCHEDULE,
      row.categories.COORDINATION,
      row.assessedAt,
      row.topIndicators[0]?.code ?? "NONE",
    ];
    lines.push(line.map(csvSafe).join(","));
  }

  await writeRiskAudit(undefined, {
    action: "risk.exported",
    resourceId: new mongoose.Types.ObjectId(),
    actorUserId: actor.userId,
    status: "EXPORTED",
    reason: `rows:${result.items.length}`,
    requestId,
  });

  return lines.join("\r\n");
}

