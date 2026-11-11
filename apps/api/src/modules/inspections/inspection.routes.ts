import { Router, type Request, type Response } from "express";
import type { z } from "zod";

import { handle, invalid, limiter, param, reply } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { INSPECTION_TYPES, type InspectionType } from "./inspection.constants.js";
import { decideInspection } from "./inspection-decision.service.js";
import { evidenceRouter } from "./inspection-evidence.routes.js";
import { inspectionAiRouter } from "./ai/inspection-ai.routes.js";
import { saveReport, startInspection, submitInspection } from "./inspection-report.service.js";
import {
  calendarQuery, cancelBody, decisionBody, editBody, inspectorsQuery, listQuery, reassignBody, reportBody, rescheduleBody, scheduleBody, submitBody, summaryQuery,
} from "./inspection.schema.js";
import {
  calendarInspections, cancelInspection, checklistTemplate, editInspection, getInspection, inspectionSummary, inspectorLookup, listInspections, myWork,
  reassignInspection, rescheduleInspection, scheduleInspection,
} from "./inspection.service.js";

/** Mounted at /api/v1/inspections. Session + permission here; scope, maker-checker and transitions are enforced in the services, inside transactions. */
export const inspectionRouter = Router();
const read = limiter(240);
const write = limiter(60);
const auth = [requireAuthenticated];
const perm = (p: Parameters<typeof requirePermission>[0], l = read) => [...auth, requirePermission(p), l];

function body<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const out = schema.safeParse(req.body);
  if (!out.success) { invalid(res, req); return null; }
  return out.data;
}
const rid = (req: Request) => req.requestId;

inspectionRouter.get("/", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(listQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listInspections(actor, q));
}));
inspectionRouter.get("/calendar", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(calendarQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await calendarInspections(actor, q));
}));
inspectionRouter.get("/summary", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(summaryQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await inspectionSummary(actor, q));
}));
inspectionRouter.get("/my", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await myWork(actor));
}));
inspectionRouter.get("/inspectors", ...perm("inspection.assign"), handle({}, async (req, res, actor) => {
  const q = parseStrict(inspectorsQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await inspectorLookup(actor, q));
}));
inspectionRouter.get("/checklist/:type", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  const type = param(req.params.type) as InspectionType;
  if (!INSPECTION_TYPES.includes(type) || Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await checklistTemplate(actor, type));
}));

inspectionRouter.post("/", ...perm("inspection.assign", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(scheduleBody, req, res);
  if (!b) return;
  reply(res, req, await scheduleInspection(actor, b, rid(req)), 201);
}));

/* evidence routes (own permission checks) */
inspectionRouter.use(evidenceRouter);
inspectionRouter.use(inspectionAiRouter);

inspectionRouter.get("/:id", ...perm("inspection.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getInspection(actor, param(req.params.id)));
}));
inspectionRouter.patch("/:id", ...perm("inspection.assign", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(editBody, req, res);
  if (!b) return;
  reply(res, req, await editInspection(actor, param(req.params.id), b, rid(req)));
}));
inspectionRouter.post("/:id/reschedule", ...perm("inspection.assign", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(rescheduleBody, req, res);
  if (!b) return;
  reply(res, req, await rescheduleInspection(actor, param(req.params.id), b, rid(req)));
}));
inspectionRouter.post("/:id/assign", ...perm("inspection.assign", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(reassignBody, req, res);
  if (!b) return;
  reply(res, req, await reassignInspection(actor, param(req.params.id), b, rid(req)));
}));
inspectionRouter.post("/:id/cancel", ...perm("inspection.assign", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(cancelBody, req, res);
  if (!b) return;
  reply(res, req, await cancelInspection(actor, param(req.params.id), b, rid(req)));
}));

inspectionRouter.post("/:id/start", ...perm("inspection.submit", write), handle({ body: true }, async (req, res, actor) => {
  if (Object.keys(req.body ?? {}).length) return invalid(res, req);
  reply(res, req, await startInspection(actor, param(req.params.id), rid(req)));
}));
inspectionRouter.put("/:id/report", ...perm("inspection.submit", limiter(240)), handle({ body: true }, async (req, res, actor) => {
  const b = body(reportBody, req, res);
  if (!b) return;
  reply(res, req, await saveReport(actor, param(req.params.id), b));
}));
inspectionRouter.post("/:id/submit", ...perm("inspection.submit", write), handle({ body: true }, async (req, res, actor) => {
  const b = body(submitBody, req, res);
  if (!b) return;
  reply(res, req, await submitInspection(actor, param(req.params.id), b, rid(req)));
}));

/** Permission is checked per decision inside the service (verify for approve and revision, reject for reject and revision). Any holder of either may reach it. */
inspectionRouter.post("/:id/decision", ...auth, write, handle({ body: true }, async (req, res, actor) => {
  const b = body(decisionBody, req, res);
  if (!b) return;
  reply(res, req, await decideInspection(actor, param(req.params.id), b, rid(req)));
}));
