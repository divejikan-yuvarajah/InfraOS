import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import {
  buildReportCsv,
  getAgenciesReport,
  getBudgetsReport,
  getContractorsReport,
  getProjectsReport,
  getReportsOverview,
  type ReportFilters,
} from "./reports.service.js";

export const reportsRouter = Router();

function parseFilters(q: Record<string, unknown>): ReportFilters {
  return {
    from: typeof q.from === "string" ? q.from : undefined,
    to: typeof q.to === "string" ? q.to : undefined,
    agencyId: typeof q.agencyId === "string" ? q.agencyId : undefined,
    status: typeof q.status === "string" ? q.status : undefined,
  };
}

reportsRouter.get("/overview", requireAuthenticated, requirePermission("report.view"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await getReportsOverview(actor, parseFilters(req.query as Record<string, unknown>));
  res.status(200).json(success(data, req.requestId));
});

reportsRouter.get("/projects", requireAuthenticated, requirePermission("report.view"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await getProjectsReport(actor, parseFilters(req.query as Record<string, unknown>));
  res.status(200).json(success(data, req.requestId));
});

reportsRouter.get("/agencies", requireAuthenticated, requirePermission("report.view"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await getAgenciesReport(actor, parseFilters(req.query as Record<string, unknown>));
  res.status(200).json(success(data, req.requestId));
});

reportsRouter.get("/budgets", requireAuthenticated, requirePermission("report.view"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await getBudgetsReport(actor, parseFilters(req.query as Record<string, unknown>));
  res.status(200).json(success(data, req.requestId));
});

reportsRouter.get("/contractors", requireAuthenticated, requirePermission("report.view"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await getContractorsReport(actor, parseFilters(req.query as Record<string, unknown>));
  res.status(200).json(success(data, req.requestId));
});

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10_000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(failure("RATE_LIMITED", "Export rate limit exceeded", req.requestId));
  },
});

reportsRouter.get("/export.csv", exportLimiter, requireAuthenticated, requirePermission("report.export"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const rawKind = typeof req.query.kind === "string" ? req.query.kind : "projects";
  const kind = (["projects", "agencies", "budgets", "contractors"].includes(rawKind)
    ? rawKind
    : "projects") as "projects" | "agencies" | "budgets" | "contractors";
  const { filename, csv } = await buildReportCsv(actor, kind, parseFilters(req.query as Record<string, unknown>), req.requestId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(csv);
});
