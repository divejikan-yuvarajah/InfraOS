import { Router, type Request, type Response } from "express";

import { failure } from "../../shared/http/envelope.js";
import { handle, invalid, limiter, noStore, param, reply, sendFailure } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { openFile, listVersions, removeVersion, restoreVersion } from "./document-files.js";
import { abortUpload, commitUpload, initUpload, initVersionUpload, streamUpload } from "./document-upload.service.js";
import { commitBody, downloadQuery, removeVersionBody, restoreVersionBody, uploadInit, versionInit } from "./document.schema.js";

/** Mounted at /api/v1/documents. Static paths are declared before `/:id`. */
export const documentRouter = Router();
const auth = [requireAuthenticated];
const read = limiter(300);
const write = limiter(60);
const uploads = limiter(60); // init/commit; content is separately capped below
const content = limiter(30);
const files = limiter(120);

// ---- upload protocol: init -> stream -> commit | abort ----
documentRouter.post("/uploads", ...auth, requirePermission("document.upload"), uploads, handle({ body: true }, async (req, res, actor) => {
  const b = uploadInit.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await initUpload(actor, b.data), 201);
}));

async function contentHandler(req: Request, res: Response, expectedDocumentId?: string): Promise<void> {
  noStore(res);
  const actor = req.actor;
  if (!actor) return;
  if (!/^application\/octet-stream\b/i.test(req.headers["content-type"] ?? "")) { req.resume(); res.status(415).json(failure("UNSUPPORTED_MEDIA", "binary body is required", req.requestId)); return; }
  const len = req.headers["content-length"] ? Number(req.headers["content-length"]) : null;
  try {
    const r = await streamUpload(actor, param(req.params.ticket), req, Number.isFinite(len) ? len : null, expectedDocumentId);
    if (!r.ok) { req.resume(); sendFailure(res, req, r); return; }
    res.status(200).json({ success: true, data: r.data, meta: { requestId: req.requestId } });
  } catch {
    req.resume();
    res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId));
  }
}
documentRouter.put("/uploads/:ticket/content", ...auth, requirePermission("document.upload"), content, (req, res) => void contentHandler(req, res));
documentRouter.post("/uploads/:ticket/commit", ...auth, requirePermission("document.upload"), uploads, handle({ body: true }, async (req, res, actor) => {
  const b = commitBody.safeParse(req.body ?? {});
  if (!b.success) return invalid(res, req);
  reply(res, req, await commitUpload(actor, param(req.params.ticket), b.data, req.requestId), 201);
}));
documentRouter.post("/uploads/:ticket/abort", ...auth, requirePermission("document.upload"), write, handle({}, async (req, res, actor) => { reply(res, req, await abortUpload(actor, param(req.params.ticket))); }));

// ---- replace flow (same protocol, scoped to a document) ----
documentRouter.post("/:id/versions", ...auth, requirePermission("document.upload"), uploads, handle({ body: true }, async (req, res, actor) => {
  const b = versionInit.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await initVersionUpload(actor, param(req.params.id), b.data), 201);
}));
documentRouter.put("/:id/versions/:ticket/content", ...auth, requirePermission("document.upload"), content, (req, res) => void contentHandler(req, res, param(req.params.id)));
documentRouter.post("/:id/versions/:ticket/commit", ...auth, requirePermission("document.upload"), uploads, handle({ body: true }, async (req, res, actor) => {
  const b = commitBody.safeParse(req.body ?? {});
  if (!b.success) return invalid(res, req);
  reply(res, req, await commitUpload(actor, param(req.params.ticket), b.data, req.requestId, param(req.params.id)), 201);
}));
documentRouter.get("/:id/versions", ...auth, requirePermission("document.read"), read, handle({}, async (req, res, actor) => { reply(res, req, await listVersions(actor, param(req.params.id))); }));
documentRouter.post("/:id/versions/:n/restore", ...auth, requirePermission("document.upload"), write, handle({ body: true }, async (req, res, actor) => {
  const b = restoreVersionBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await restoreVersion(actor, param(req.params.id), param(req.params.n), b.data, req.requestId), 201);
}));
documentRouter.delete("/:id/versions/:n", ...auth, requirePermission("document.delete"), write, handle({ body: true }, async (req, res, actor) => {
  const b = removeVersionBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await removeVersion(actor, param(req.params.id), param(req.params.n), b.data, req.requestId));
}));

// ---- bytes: always through the API, never a storage URL ----
function safeAsciiName(name: string): string { return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_"); }
async function sendFile(req: Request, res: Response, mode: "download" | "preview"): Promise<void> {
  const actor = req.actor;
  if (!actor) return;
  const q = parseStrict(downloadQuery, req.query);
  if (!q) { noStore(res); res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId)); return; }
  let file;
  try { file = await openFile(actor, param(req.params.id), q.version, mode, req.requestId); } catch { noStore(res); res.status(503).json(failure("SERVICE_UNAVAILABLE", "service is temporarily unavailable", req.requestId)); return; }
  if (!file.ok) { noStore(res); sendFailure(res, req, file); return; }
  const f = file.data;
  const inline = mode === "preview";
  res.setHeader("Content-Type", inline && (f.mime === "text/plain" || f.mime === "text/csv") ? "text/plain; charset=utf-8" : f.mime);
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeAsciiName(f.fileName)}"; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.setHeader("Content-Length", String(f.size));
  f.stream.once("error", () => { if (!res.headersSent) res.status(503).end(); else res.destroy(); });
  res.once("close", () => f.stream.destroy()); // client abort stops reading from storage
  f.stream.pipe(res);
}
documentRouter.get("/:id/download", ...auth, requirePermission("document.download"), files, (req, res) => void sendFile(req, res, "download"));
documentRouter.get("/:id/preview", ...auth, requirePermission("document.read"), files, (req, res) => void sendFile(req, res, "preview"));
