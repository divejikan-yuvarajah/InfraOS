import { Router, type Request, type Response } from "express";
import type { z } from "zod";

import { handle, invalid, limiter, noStore, param, reply, sendFailure } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { addAsset, addManualAssessment, changeStatus, exportAssets, patchAsset } from "./asset.mutations.js";
import { assetSummary, assetTimeline, getAsset, listAssets } from "./asset.queries.js";
import { addAssetBody, assessmentBody, assetListQuery, conversionBody, conversionListQuery, convertibleQuery, decideBody, exportQuery, patchAssetBody, previewQuery, rejectBody, statusBody, timelineQuery } from "./asset.schema.js";
import { approveConversion, cancelConversion, convertibleProjects, getConversion, listConversions, previewConversion, rejectConversion, requestConversion } from "./conversion.service.js";

/** Mounted at /api/v1/assets. Session + permission here; scope, maker-checker and gates are enforced in the services, inside transactions. */
export const assetRouter = Router();
const read = limiter(240);
const write = limiter(60);
const exportLimit = limiter(10);
const auth = [requireAuthenticated];
const perm = (p: Parameters<typeof requirePermission>[0], l = read) => [...auth, requirePermission(p), l];
const rid = (req: Request) => req.requestId;

function body<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const out = schema.safeParse(req.body);
  if (!out.success) { invalid(res, req); return null; }
  return out.data;
}

assetRouter.get("/", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(assetListQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listAssets(actor, q));
}));
assetRouter.get("/summary", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await assetSummary(actor));
}));
assetRouter.get("/export.csv", ...perm("report.export", exportLimit), async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  noStore(res);
  const q = parseStrict(exportQuery, req.query);
  if (!q) return void invalid(res, req);
  const result = await exportAssets(actor, q);
  if (!result.ok) return void sendFailure(res, req, result);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="assets-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader("X-Row-Count", String(result.data.count));
  res.status(200).send(result.data.body);
});

/* conversions (declared before "/:id") */
assetRouter.get("/conversions", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(conversionListQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listConversions(actor, q));
}));
assetRouter.get("/conversions/projects", ...perm("asset.create"), handle({}, async (req, res, actor) => {
  const q = parseStrict(convertibleQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await convertibleProjects(actor, q));
}));
assetRouter.get("/conversions/preview", ...perm("asset.create"), handle({}, async (req, res, actor) => {
  const q = parseStrict(previewQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await previewConversion(actor, q));
}));
assetRouter.post("/conversions", ...perm("asset.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(conversionBody, req, res);
  if (!b) return;
  reply(res, req, await requestConversion(actor, b, rid(req)), 201);
}));
assetRouter.get("/conversions/:id", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getConversion(actor, param(req.params.id)));
}));
assetRouter.post("/conversions/:id/cancel", ...perm("asset.create", write), handle({ body: true }, async (req, res, actor) => {
  if (Object.keys(req.body ?? {}).length) return invalid(res, req);
  reply(res, req, await cancelConversion(actor, param(req.params.id), rid(req)));
}));
assetRouter.post("/conversions/:id/approve", ...perm("asset.conversion.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(decideBody, req, res);
  if (!b) return;
  reply(res, req, await approveConversion(actor, param(req.params.id), b.note, rid(req)));
}));
assetRouter.post("/conversions/:id/reject", ...perm("asset.conversion.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(rejectBody, req, res);
  if (!b) return;
  reply(res, req, await rejectConversion(actor, param(req.params.id), b.note, rid(req)));
}));

assetRouter.post("/", ...perm("asset.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(addAssetBody, req, res);
  if (!b) return;
  reply(res, req, await addAsset(actor, b, rid(req)), 201);
}));

assetRouter.get("/:id", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getAsset(actor, param(req.params.id)));
}));
assetRouter.patch("/:id", ...perm("asset.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(patchAssetBody, req, res);
  if (!b) return;
  reply(res, req, await patchAsset(actor, param(req.params.id), b, rid(req)));
}));
assetRouter.post("/:id/status", ...perm("asset.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(statusBody, req, res);
  if (!b) return;
  reply(res, req, await changeStatus(actor, param(req.params.id), b, rid(req)));
}));
assetRouter.get("/:id/timeline", ...perm("asset.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(timelineQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await assetTimeline(actor, param(req.params.id), q));
}));
assetRouter.post("/:id/assessments", ...perm("asset.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(assessmentBody, req, res);
  if (!b) return;
  reply(res, req, await addManualAssessment(actor, param(req.params.id), b, rid(req)), 201);
}));
