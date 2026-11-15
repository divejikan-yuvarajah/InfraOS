import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { acknowledgeSystemAlert, evaluateSystemAlerts, listSystemAlerts } from "./alerts.service.js";

export const alertsRouter = Router();

alertsRouter.get("/", requireAuthenticated, requirePermission("notification.read"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const data = await listSystemAlerts(actor, req.query as Record<string, unknown>);
  res.status(200).json(success(data, req.requestId));
});

alertsRouter.post("/:id/acknowledge", requireAuthenticated, requirePermission("notification.update"), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const id = Array.isArray(req.params.id) ? req.params.id[0] ?? "" : req.params.id ?? "";
  const updated = await acknowledgeSystemAlert(actor, id);
  if (!updated) {
    res.status(404).json(failure("NOT_FOUND", "alert not found", req.requestId));
    return;
  }
  res.status(200).json(success(updated, req.requestId));
});

alertsRouter.post("/evaluate", requireAuthenticated, requirePermission("notification.update"), async (req, res) => {
  const result = await evaluateSystemAlerts({ bypassLease: true });
  res.status(200).json(success(result, req.requestId));
});
