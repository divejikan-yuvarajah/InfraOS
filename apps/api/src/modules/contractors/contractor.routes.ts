import { Router } from "express";

import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import {
  addCertification, addDocumentRef, changeStatus, duplicateCheck, getContractor, listContractors, patchContractor, registerContractor, removeDocumentRef,
  revokeCertification, summary, updateCertification,
} from "./contractor.service.js";
import {
  certCreateSchema, certPatchSchema, certRevokeSchema, contractorCreateSchema, contractorListQuerySchema, contractorPatchSchema, docRefCreateSchema,
  duplicateCheckSchema, parseStrict, statusBodySchema,
} from "./contractor.schema.js";
import { handle, invalid, param, readLimiter, reply, writeLimiter } from "./contractor.http.js";
import { riskSummary } from "./contractor-performance.service.js";
import { contractorInspectionOutcomes } from "../inspections/inspection.integration.js";
import { assignmentRoutes } from "./contractor-assignment.routes.js";

/** Mounted at /api/v1/contractors. Every route: session, permission, strict input, no-store; scope is enforced inside the services. */
export const contractorRouter = Router();
const read = [requireAuthenticated, requirePermission("contractor.read"), readLimiter];
const manage = [requireAuthenticated, requirePermission("contractor.manage"), writeLimiter];

contractorRouter.get("/", ...read, handle({}, async (req, res, actor) => {
  const q = parseStrict(contractorListQuerySchema, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listContractors(actor, q));
}));

contractorRouter.get("/summary", ...read, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  const base = await summary(actor);
  if (base.ok && (base.data as { performance?: unknown }).performance) {
    // Risk distribution reuses the same pure rules over a capped batch and states when it is truncated.
    const risk = await riskSummary(actor);
    (base.data as Record<string, unknown>).performance = risk.ok ? { available: true, ...(risk.data as object) } : { available: false };
  }
  reply(res, req, base);
}));

contractorRouter.get("/duplicate-check", requireAuthenticated, requirePermission("contractor.manage"), readLimiter, handle({}, async (req, res, actor) => {
  const q = parseStrict(duplicateCheckSchema, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await duplicateCheck(actor, q));
}));

contractorRouter.post("/", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = contractorCreateSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await registerContractor(actor, body.data, req.requestId), 201);
}));

contractorRouter.get("/:id/inspection-outcomes", requireAuthenticated, requirePermission("contractor.performance.read"), readLimiter, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await contractorInspectionOutcomes(actor, param(req.params.id)));
}));

// Assignment, performance and timeline routes share this prefix and are declared before the "/:id" catch-alls they extend.
assignmentRoutes(contractorRouter);

contractorRouter.get("/:id", ...read, handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getContractor(actor, param(req.params.id)));
}));

contractorRouter.patch("/:id", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = contractorPatchSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await patchContractor(actor, param(req.params.id), body.data, req.requestId));
}));

contractorRouter.post("/:id/status", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = statusBodySchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await changeStatus(actor, param(req.params.id), body.data, req.requestId));
}));

contractorRouter.post("/:id/certifications", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = certCreateSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await addCertification(actor, param(req.params.id), body.data, req.requestId), 201);
}));

contractorRouter.patch("/:id/certifications/:certId", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = certPatchSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await updateCertification(actor, param(req.params.id), param(req.params.certId), body.data, req.requestId));
}));

contractorRouter.delete("/:id/certifications/:certId", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = certRevokeSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await revokeCertification(actor, param(req.params.id), param(req.params.certId), body.data.reason, req.requestId));
}));

contractorRouter.post("/:id/documents", ...manage, handle({ body: true }, async (req, res, actor) => {
  const body = docRefCreateSchema.safeParse(req.body);
  if (!body.success) return invalid(res, req);
  reply(res, req, await addDocumentRef(actor, param(req.params.id), body.data, req.requestId), 201);
}));

contractorRouter.delete("/:id/documents/:refId", ...manage, handle({}, async (req, res, actor) => {
  reply(res, req, await removeDocumentRef(actor, param(req.params.id), param(req.params.refId), req.requestId));
}));
