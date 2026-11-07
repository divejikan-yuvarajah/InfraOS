import express, { Router, type Request, type Response } from "express";
import type { z } from "zod";

import { env } from "../../config/env.js";
import { failure } from "../../shared/http/envelope.js";
import { handle, invalid, limiter, noStore, param, reply } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { MAX_FULL_BYTES } from "../inspections/inspection.constants.js";
import {
  approveMaintenance, cancelMaintenance, completeMaintenance, getMaintenance, listMaintenance, maintenanceCalendar, maintenanceSummary, patchMaintenance, rejectMaintenance, requestMaintenance,
  scheduleMaintenance, startMaintenance, toggleTask,
} from "./maintenance.service.js";
import { createMaintenanceEvidence, openMaintenanceFile, patchMaintenanceEvidence, removeMaintenanceEvidence, uploadMaintenanceFile } from "./maintenance-evidence.service.js";
import { approveBody, cancelBody, completeBody, evidenceBody, evidencePatch, evidenceRemove, fileQuery, maintCalendarQuery, maintListQuery, patchBody, rejectBody, requestBody, scheduleBody, startBody, taskPatch } from "./maintenance.schema.js";

/** Mounted at /api/v1/maintenance. Static paths are declared before "/:id". */
export const maintenanceRouter = Router();
const read = limiter(240);
const write = limiter(60);
const uploadLimit = limiter(env.NODE_ENV === "test" ? 5000 : 120);
const auth = [requireAuthenticated];
const perm = (p: Parameters<typeof requirePermission>[0], l = read) => [...auth, requirePermission(p), l];
const rid = (req: Request) => req.requestId;
function body<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const out = schema.safeParse(req.body);
  if (!out.success) { invalid(res, req); return null; }
  return out.data;
}

maintenanceRouter.get("/", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(maintListQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listMaintenance(actor, q));
}));
maintenanceRouter.get("/calendar", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(maintCalendarQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await maintenanceCalendar(actor, q));
}));
maintenanceRouter.get("/summary", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await maintenanceSummary(actor));
}));

/* evidence (before "/:id") */
const rawImage = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_FULL_BYTES });
maintenanceRouter.put("/evidence/:evidenceId/file", ...auth, requirePermission("maintenance.update"), uploadLimit, rawImage, handle({}, async (req, res, actor) => {
  const q = parseStrict(fileQuery, req.query);
  if (!q || !Buffer.isBuffer(req.body)) { res.status(415).json(failure("UNSUPPORTED_MEDIA", "JPEG, PNG or WebP image bytes are required", req.requestId)); return; }
  reply(res, req, await uploadMaintenanceFile(actor, param(req.params.evidenceId), q.variant, req.body));
}));
maintenanceRouter.get("/evidence/:evidenceId/file", ...perm("asset.read", limiter(600)), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const q = parseStrict(fileQuery, req.query);
  if (!q) { noStore(res); res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId)); return; }
  const file = await openMaintenanceFile(actor, param(req.params.evidenceId), q.variant);
  if (!file.ok) {
    noStore(res);
    res.status(file.status).json(failure(file.status === 404 ? "NOT_FOUND" : file.status === 503 ? "SERVICE_UNAVAILABLE" : file.status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", file.status === 404 ? "resource was not found" : "request could not be completed", req.requestId));
    return;
  }
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  if (file.size) res.setHeader("Content-Length", String(file.size));
  file.stream.once("error", () => { if (!res.headersSent) res.status(503).end(); else res.destroy(); });
  file.stream.pipe(res);
});
maintenanceRouter.patch("/evidence/:evidenceId", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(evidencePatch, req, res);
  if (!b) return;
  reply(res, req, await patchMaintenanceEvidence(actor, param(req.params.evidenceId), b));
}));
maintenanceRouter.delete("/evidence/:evidenceId", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(evidenceRemove, req, res);
  if (!b) return;
  reply(res, req, await removeMaintenanceEvidence(actor, param(req.params.evidenceId), b, rid(req)));
}));

maintenanceRouter.get("/:id", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getMaintenance(actor, param(req.params.id)));
}));
maintenanceRouter.patch("/:id", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(patchBody, req, res);
  if (!b) return;
  reply(res, req, await patchMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.post("/:id/approve", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(approveBody, req, res);
  if (!b) return;
  reply(res, req, await approveMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.post("/:id/reject", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(rejectBody, req, res);
  if (!b) return;
  reply(res, req, await rejectMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.post("/:id/schedule", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(scheduleBody, req, res);
  if (!b) return;
  reply(res, req, await scheduleMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.post("/:id/start", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  if (!body(startBody, req, res)) return;
  reply(res, req, await startMaintenance(actor, param(req.params.id), rid(req)));
}));
maintenanceRouter.post("/:id/complete", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(completeBody, req, res);
  if (!b) return;
  reply(res, req, await completeMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.post("/:id/cancel", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(cancelBody, req, res);
  if (!b) return;
  reply(res, req, await cancelMaintenance(actor, param(req.params.id), b, rid(req)));
}));
maintenanceRouter.patch("/:id/tasks/:key", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(taskPatch, req, res);
  if (!b) return;
  reply(res, req, await toggleTask(actor, param(req.params.id), param(req.params.key), b));
}));
maintenanceRouter.post("/:id/evidence", ...perm("maintenance.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(evidenceBody, req, res);
  if (!b) return;
  reply(res, req, await createMaintenanceEvidence(actor, param(req.params.id), b, rid(req)), 201);
}));

/** Mounted at /api/v1/assets/:assetId/maintenance (before /assets): request or plan work for one asset. */
export const assetMaintenanceRouter = Router({ mergeParams: true });
assetMaintenanceRouter.post("/", ...perm("maintenance.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(requestBody, req, res);
  if (!b) return;
  reply(res, req, await requestMaintenance(actor, param(req.params.assetId), b, rid(req)), 201);
}));
