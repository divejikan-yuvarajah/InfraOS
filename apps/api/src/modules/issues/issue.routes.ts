import { Router } from "express";
import { z } from "zod";

import { failure, success } from "../../shared/http/envelope.js";
import { parseListQuery } from "../../shared/http/list-query.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requireAnyPermission, requirePermission } from "../identity/authorization/require-permission.js";
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "./issue.constants.js";
import {
  addIssueNote,
  createRoutingRule,
  deleteRoutingRule,
  getStaffIssueDetail,
  listRoutingRules,
  listStaffIssues,
  openStaffIssuePhoto,
  routeStaffIssue,
  transitionStaffIssue,
} from "./issue.service.js";

export const issueRouter = Router();

const routeBodySchema = z.object({
  agencyId: z.string().min(1),
  publicMapVisible: z.boolean().optional(),
});

const statusBodySchema = z.object({
  toStatus: z.enum(ISSUE_STATUSES),
  publicMessage: z.string().trim().max(1500).optional(),
  internalNote: z.string().trim().max(2000).optional(),
  duplicateOfIssueId: z.string().optional(),
  publicMapVisible: z.boolean().optional(),
});

const noteBodySchema = z.object({
  kind: z.enum(["INTERNAL", "PUBLIC"]),
  body: z.string().trim().min(2).max(1500),
});

const routingRuleBodySchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  province: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  agencyId: z.string().min(1),
  priorityOrder: z.number().int().min(1).max(1000).optional(),
});

issueRouter.get("/routing-rules", requireAuthenticated, requireAnyPermission("citizen_issue.assign", "agency.manage"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const items = await listRoutingRules();
  res.status(200).json(success({ items }, req.requestId));
});

issueRouter.post("/routing-rules", requireAuthenticated, requireAnyPermission("citizen_issue.assign", "agency.manage"), async (req, res) => {
  const parsed = routingRuleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid routing rule", req.requestId));
    return;
  }
  const created = await createRoutingRule(req.actor!, parsed.data);
  if (!created) {
    res.status(404).json(failure("NOT_FOUND", "Agency not found", req.requestId));
    return;
  }
  res.status(201).json(success(created, req.requestId));
});

issueRouter.delete("/routing-rules/:id", requireAuthenticated, requireAnyPermission("citizen_issue.assign", "agency.manage"), async (req, res) => {
  const ok = await deleteRoutingRule(String(req.params.id));
  if (!ok) {
    res.status(404).json(failure("NOT_FOUND", "Routing rule not found", req.requestId));
    return;
  }
  res.status(200).json(success({ deleted: true }, req.requestId));
});

issueRouter.get("/", requireAuthenticated, requirePermission("citizen_issue.read"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const unassignedOnly = req.query.unassigned === "true";
  const raw = { ...(req.query as Record<string, unknown>) };
  delete raw.unassigned;
  const parsed = parseListQuery(raw);
  if (!parsed) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid query parameters", req.requestId));
    return;
  }
  const data = await listStaffIssues(req.actor!, { ...parsed, unassignedOnly });
  res.status(200).json(success(data, req.requestId));
});

issueRouter.get("/:id", requireAuthenticated, requirePermission("citizen_issue.read"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const detail = await getStaffIssueDetail(req.actor!, String(req.params.id));
  if (!detail) {
    res.status(404).json(failure("NOT_FOUND", "Issue not found", req.requestId));
    return;
  }
  res.status(200).json(success(detail, req.requestId));
});

issueRouter.get("/:id/photos/:index", requireAuthenticated, requirePermission("citizen_issue.read"), async (req, res) => {
  const idx = Number(req.params.index);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
    res.status(404).json(failure("NOT_FOUND", "Photo not found", req.requestId));
    return;
  }
  const opened = await openStaffIssuePhoto(req.actor!, String(req.params.id), idx);
  if (!opened) {
    res.status(404).json(failure("NOT_FOUND", "Photo not found", req.requestId));
    return;
  }
  res.setHeader("Content-Type", opened.mimeType);
  res.setHeader("Cache-Control", "no-store");
  opened.stream.on("error", () => {
    if (!res.headersSent) res.status(404).end();
  });
  opened.stream.pipe(res);
});

issueRouter.patch("/:id/route", requireAuthenticated, requirePermission("citizen_issue.assign"), async (req, res) => {
  const parsed = routeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid routing payload", req.requestId));
    return;
  }
  const result = await routeStaffIssue(
    req.actor!,
    String(req.params.id),
    parsed.data.agencyId,
    req.requestId,
    parsed.data.publicMapVisible,
  );
  if (!result.ok) {
    res.status(result.status).json(failure(result.code, "Issue or agency not found", req.requestId));
    return;
  }
  res.status(200).json(success(result, req.requestId));
});

issueRouter.patch("/:id/status", requireAuthenticated, requireAnyPermission("citizen_issue.update", "citizen_issue.close"), async (req, res) => {
  const parsed = statusBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid status transition payload", req.requestId));
    return;
  }
  const result = await transitionStaffIssue(req.actor!, String(req.params.id), parsed.data, req.requestId);
  if (!result.ok) {
    const msg = result.status === 409 ? "Status transition not permitted" : "Issue not found";
    res.status(result.status).json(failure(result.code, msg, req.requestId));
    return;
  }
  res.status(200).json(success(result, req.requestId));
});

issueRouter.post("/:id/notes", requireAuthenticated, requirePermission("citizen_issue.update"), async (req, res) => {
  const parsed = noteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid note payload", req.requestId));
    return;
  }
  const result = await addIssueNote(req.actor!, String(req.params.id), parsed.data);
  if (!result.ok) {
    res.status(404).json(failure("NOT_FOUND", "Issue not found", req.requestId));
    return;
  }
  res.status(201).json(success({ saved: true }, req.requestId));
});
