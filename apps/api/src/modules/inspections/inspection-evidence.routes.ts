import express, { Router } from "express";

import { env } from "../../config/env.js";
import { failure } from "../../shared/http/envelope.js";
import { handle, invalid, limiter, noStore, param, reply } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { MAX_FULL_BYTES } from "./inspection.constants.js";
import { createEvidence, openEvidenceFile, patchEvidence, removeEvidence, uploadEvidenceFile } from "./inspection-evidence.service.js";
import { evidenceBody, evidencePatch, evidenceRemoveBody, fileQuery } from "./inspection.schema.js";

/** Mounted inside the inspections router. Static `/evidence/...` paths are matched before `/:id`. */
export const evidenceRouter = Router();
const uploadLimit = limiter(env.NODE_ENV === "test" ? 5000 : 120); // roughly 60 photos x (full + thumb) per 10 minutes is well inside this per-minute cap for one device
const write = limiter(60);
const read = limiter(600);
const auth = [requireAuthenticated];

// Raw bytes only for this route. express.json stays at 1 MB globally and never sees image bodies.
const rawImage = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_FULL_BYTES });

evidenceRouter.post("/:id/evidence", ...auth, requirePermission("inspection.submit"), write, handle({ body: true }, async (req, res, actor) => {
  const b = evidenceBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await createEvidence(actor, param(req.params.id), b.data, req.requestId), 201);
}));

evidenceRouter.put("/evidence/:evidenceId/file", ...auth, requirePermission("inspection.submit"), uploadLimit, rawImage, handle({}, async (req, res, actor) => {
  const q = parseStrict(fileQuery, req.query);
  if (!q || !Buffer.isBuffer(req.body)) { res.status(415).json(failure("UNSUPPORTED_MEDIA", "JPEG, PNG or WebP image bytes are required", req.requestId)); return; }
  reply(res, req, await uploadEvidenceFile(actor, param(req.params.evidenceId), q.variant, req.body));
}));

evidenceRouter.get("/evidence/:evidenceId/file", ...auth, requirePermission("inspection.read"), read, async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const q = parseStrict(fileQuery, req.query);
  if (!q) { noStore(res); res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId)); return; }
  const file = await openEvidenceFile(actor, param(req.params.evidenceId), q.variant);
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

evidenceRouter.patch("/evidence/:evidenceId", ...auth, requirePermission("inspection.submit"), write, handle({ body: true }, async (req, res, actor) => {
  const b = evidencePatch.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await patchEvidence(actor, param(req.params.evidenceId), b.data));
}));

evidenceRouter.delete("/evidence/:evidenceId", ...auth, requirePermission("inspection.submit"), write, handle({ body: true }, async (req, res, actor) => {
  const b = evidenceRemoveBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await removeEvidence(actor, param(req.params.evidenceId), b.data, req.requestId));
}));
