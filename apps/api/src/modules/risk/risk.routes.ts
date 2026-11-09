import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { resolveRiskScope } from "./risk-scope.js";
import { Role } from "../identity/models/role.model.js";
import {
  assessProject,
  compareProjectAssessments,
  getProjectAssessmentById,
  getProjectLatestAssessment,
  getProjectRiskHistory,
} from "./risk-assessment.service.js";
import { RiskAccessError } from "./risk-inputs.service.js";
import {
  exportRiskCsv,
  getMethodology,
  getPortfolioTrend,
  getRiskOverview,
  getRiskProjects,
  getRiskScatter,
} from "./risk-read.service.js";
import {
  listProjectResolutions,
  updateResolution,
} from "./risk-resolution.service.js";
import {
  getRecentRuns,
  getRunById,
  startAdminBulkRun,
} from "./risk-scheduler.js";
import type { ViewerPermissions } from "./risk-tiering.js";

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? (val[0] ?? "") : (val ?? "");
}

function handleRouteError(err: unknown, req: Request, res: Response): void {
  if (err instanceof RiskAccessError) {
    res.status(err.status).json(failure(err.code, err.message, req.requestId));
    return;
  }
  if (err instanceof z.ZodError) {
    res
      .status(400)
      .json(failure("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request", req.requestId));
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json(failure("INTERNAL_ERROR", message, req.requestId));
}

async function resolveViewerPermissions(req: Request): Promise<ViewerPermissions> {
  const actor = req.actor!;
  const role = await Role.findById(actor.roleId).select("permissions").lean();
  const granted = Array.isArray(role?.permissions) ? (role.permissions as string[]) : [];

  return {
    canReadFinance:
      granted.includes("finance.budget.read") ||
      granted.includes("finance.payment.read") ||
      granted.includes("finance.expense.read"),
    canReadContractor: granted.includes("contractor.read"),
    agencyId: actor.agencyId ?? null,
    isPlatformScope: actor.roleKey === "SUPER_ADMIN",
  };
}

// =============================================================================
// Router 1: Global Risk Router mounted at /risk
// =============================================================================
export const riskRouter = Router();

// GET /risk/overview
riskRouter.get(
  "/overview",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const overview = await getRiskOverview(req.actor!);
      res.json(success(overview, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/projects
const riskProjectsQuerySchema = z.object({
  agencyId: z.string().optional(),
  projectType: z.string().optional(),
  status: z.string().optional(),
  level: z.string().optional(),
  category: z.string().optional(),
  sufficiency: z.string().optional(),
  resolution: z.string().optional(),
  stale: z.union([z.string(), z.number(), z.boolean()]).optional(),
  q: z.string().optional(),
  district: z.string().optional(),
  sort: z.enum(["level", "index", "assessedAt", "title", "gap"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

riskRouter.get(
  "/projects",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const query = riskProjectsQuerySchema.parse(req.query);
      const result = await getRiskProjects(req.actor!, query);
      res.json(success(result, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/scatter
riskRouter.get(
  "/scatter",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const scatter = await getRiskScatter(req.actor!);
      res.json(success(scatter, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/portfolio-trend
const trendQuerySchema = z.object({
  range: z.coerce.number().min(4).max(26).optional(),
});

riskRouter.get(
  "/portfolio-trend",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const query = trendQuerySchema.parse(req.query);
      const trend = await getPortfolioTrend(req.actor!, query.range);
      res.json(success(trend, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/methodology
riskRouter.get(
  "/methodology",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const methodology = await getMethodology();
      res.json(success(methodology, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/export.csv
riskRouter.get(
  "/export.csv",
  requireAuthenticated,
  requirePermission("risk.read"),
  requirePermission("report.export"),
  async (req, res) => {
    try {
      noStore(res);
      const query = riskProjectsQuerySchema.parse(req.query);
      const csv = await exportRiskCsv(req.actor!, query, req.requestId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="risk-projects-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// POST /risk/assess-all (admin bulk assess)
riskRouter.post(
  "/assess-all",
  requireAuthenticated,
  requirePermission("risk.request"),
  async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor!;
      if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
        throw new RiskAccessError(
          403,
          "FORBIDDEN",
          "Bulk assessment requires GOV_ADMIN or SUPER_ADMIN role",
        );
      }
      const scope = await resolveRiskScope(actor);
      const scopeStr =
        scope.kind === "platform"
          ? "platform"
          : scope.kind === "agencies"
            ? (scope.agencyIds[0]?.toString() ?? "platform")
            : "none";
      const run = await startAdminBulkRun(actor, scopeStr);
      res.status(202).json(success({ runId: run.runId, id: run._id.toString(), status: run.status }, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/runs
riskRouter.get(
  "/runs",
  requireAuthenticated,
  requirePermission("risk.request"),
  async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor!;
      if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
        throw new RiskAccessError(
          403,
          "FORBIDDEN",
          "Viewing runs requires GOV_ADMIN or SUPER_ADMIN role",
        );
      }
      const runs = await getRecentRuns();
      res.json(success(runs, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /risk/runs/:id
riskRouter.get(
  "/runs/:id",
  requireAuthenticated,
  requirePermission("risk.request"),
  async (req, res) => {
    try {
      noStore(res);
      const actor = req.actor!;
      if (actor.roleKey !== "SUPER_ADMIN" && actor.roleKey !== "GOV_ADMIN") {
        throw new RiskAccessError(
          403,
          "FORBIDDEN",
          "Viewing run details requires GOV_ADMIN or SUPER_ADMIN role",
        );
      }
      const id = paramStr(req.params.id);
      const run = await getRunById(id);
      if (!run) {
        throw new RiskAccessError(404, "NOT_FOUND", "Risk run not found");
      }
      res.json(success(run, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// =============================================================================
// Router 2: Project Risk Router mounted at /projects/:projectId/risk
// =============================================================================
export const projectRiskRouter = Router({ mergeParams: true });

// GET /projects/:projectId/risk (latest assessment & triage status)
projectRiskRouter.get(
  "/",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const viewerPermissions = await resolveViewerPermissions(req);
      const result = await getProjectLatestAssessment(
        req.actor!,
        projectId,
        viewerPermissions,
      );
      res.json(success(result, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// POST /projects/:projectId/risk/assess (on-demand assess)
const assessBodySchema = z.object({
  force: z.boolean().optional(),
});

projectRiskRouter.post(
  "/assess",
  requireAuthenticated,
  requirePermission("risk.request"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const body = assessBodySchema.parse(req.body ?? {});
      const result = await assessProject(
        req.actor!,
        projectId,
        "ON_DEMAND",
        new Date(),
        { force: body.force },
      );
      res.json(success(result, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /projects/:projectId/risk/history (assessment history summary)
const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

projectRiskRouter.get(
  "/history",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const query = historyQuerySchema.parse(req.query);
      const history = await getProjectRiskHistory(req.actor!, projectId, query);
      res.json(success(history, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /projects/:projectId/risk/compare?from=&to=
const compareQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

projectRiskRouter.get(
  "/compare",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const { from, to } = compareQuerySchema.parse(req.query);
      const viewerPermissions = await resolveViewerPermissions(req);
      const comparison = await compareProjectAssessments(
        req.actor!,
        projectId,
        from,
        to,
        viewerPermissions,
      );
      res.json(success(comparison, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /projects/:projectId/risk/assessments/:aid
projectRiskRouter.get(
  "/assessments/:aid",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const aid = paramStr(req.params.aid);
      const viewerPermissions = await resolveViewerPermissions(req);
      const assessment = await getProjectAssessmentById(
        req.actor!,
        projectId,
        aid,
        viewerPermissions,
      );
      res.json(success(assessment, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// GET /projects/:projectId/risk/resolutions
projectRiskRouter.get(
  "/resolutions",
  requireAuthenticated,
  requirePermission("risk.read"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const resolutions = await listProjectResolutions(req.actor!, projectId);
      res.json(success(resolutions, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

// PUT /projects/:projectId/risk/resolutions/:fingerprint
const updateResolutionSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
  note: z.string().max(1000).optional(),
  reviewAt: z.union([z.string(), z.date()]).nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  version: z.number().int().min(0),
});

projectRiskRouter.put(
  "/resolutions/:fingerprint",
  requireAuthenticated,
  requirePermission("risk.resolve"),
  async (req, res) => {
    try {
      noStore(res);
      const projectId = paramStr(req.params.projectId);
      const fingerprint = paramStr(req.params.fingerprint);
      const body = updateResolutionSchema.parse(req.body);
      const updated = await updateResolution(
        req.actor!,
        projectId,
        fingerprint,
        body,
      );
      res.json(success(updated, req.requestId));
    } catch (err) {
      handleRouteError(err, req, res);
    }
  },
);

