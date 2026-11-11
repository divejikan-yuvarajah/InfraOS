import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { handle, invalid, limiter, noStore, param, reply } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requireAnyPermission, requirePermission } from "../identity/authorization/require-permission.js";
import { getAiStatusLite } from "./governance/ai-status.service.js";
import { aiGovernanceRouter } from "./governance/ai-governance.routes.js";
import { copilotRouter } from "./copilot/copilot.routes.js";
import { aiStatus, bulkReprocess, cancelDocumentJob, diagnosticSearch, getDocumentAi, listChunks, listJobs, processingSummary, reindex, reprocessDocument } from "./ai.service.js";
import { askQuestion } from "./rag/rag.service.js";
import { ragHandle } from "./rag/http.js";
import { chunkContext, deleteThread, getInteraction, getThread, listThreads, scopePreview, submitFeedback } from "./rag/qa.service.js";
import { createSummary, listSummaries, readSummary, summaryBody } from "./rag/summary.service.js";
import { applyBody, applyMetadata, createExtraction, extractionBody, listExtractions, readExtraction, reviewBody, saveReview } from "./rag/extraction.service.js";
import { qualityAggregates, qualityQuery } from "./rag/quality.service.js";
import { askBody, chunkContextParams, feedbackBody, scopePreviewQuery, threadParam, threadsQuery } from "./rag/rag.schema.js";
import { RagFlow } from "./rag/http.js";
import { aiConfig } from "./ai.config.js";
import { bulkReprocessBody, chunkQuery, diagnosticBody, jobsQuery, reindexBody } from "./ai.schema.js";

const auth = [requireAuthenticated];
const read = limiter(240);
const write = limiter(30);
const heavy = limiter(10);
const diagnosticLimit = rateLimit({
  windowMs: 10 * 60_000, limit: env.NODE_ENV === "test" ? 5000 : 20, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { noStore(res); res.status(429).json(failure("RATE_LIMITED", "Too many requests", req.requestId)); },
});

const qaLimit = rateLimit({
  windowMs: 10 * 60_000, limit: env.NODE_ENV === "test" ? 5000 : aiConfig.rag.requestsPer10Min, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => (req as { actor?: { userId: string } }).actor?.userId ?? ipKeyGenerator(req.ip ?? ""),
  handler: (req, res) => { noStore(res); res.status(429).json(failure("AI_RATE_LIMITED", "too many requests", req.requestId)); },
});
const bad = (): never => { throw new RagFlow(400, "VALIDATION_ERROR"); };

/** Mounted at /api/v1/documents (before the document router). Only `/:id/ai...` paths live here. */
export const aiDocumentRouter = Router();
aiDocumentRouter.get("/:id/ai", ...auth, requirePermission("document.read"), read, handle({}, async (req, res, actor) => { reply(res, req, await getDocumentAi(actor, param(req.params.id))); }));
aiDocumentRouter.post("/:id/ai/reprocess", ...auth, requirePermission("document.process"), write, handle({ body: true }, async (req, res, actor) => {
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body as object).length) return invalid(res, req);
  reply(res, req, await reprocessDocument(actor, param(req.params.id), req.requestId), 202);
}));
aiDocumentRouter.post("/:id/ai/cancel", ...auth, requirePermission("document.process"), write, handle({ body: true }, async (req, res, actor) => {
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body as object).length) return invalid(res, req);
  reply(res, req, await cancelDocumentJob(actor, param(req.params.id), req.requestId));
}));
aiDocumentRouter.get("/:id/ai/chunks", ...auth, requirePermission("document.read"), requirePermission("document.download"), read, handle({}, async (req, res, actor) => {
  const q = parseStrict(chunkQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listChunks(actor, param(req.params.id), q, req.requestId));
}));

/** Mounted at /api/v1/ai. */
export const aiRouter = Router();
aiRouter.use(aiGovernanceRouter);
aiRouter.use("/copilot", copilotRouter);
aiRouter.get("/processing/summary", ...auth, requirePermission("document.process"), read, handle({}, async (req, res, actor) => { reply(res, req, await processingSummary(actor)); }));
aiRouter.get("/processing/jobs", ...auth, requirePermission("document.process"), read, handle({}, async (req, res, actor) => {
  const q = parseStrict(jobsQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listJobs(actor, q));
}));
aiRouter.post("/processing/reprocess", ...auth, requirePermission("document.process"), heavy, handle({ body: true }, async (req, res, actor) => {
  const b = bulkReprocessBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await bulkReprocess(actor, b.data, req.requestId));
}));
aiRouter.get("/status", ...auth, requirePermission("ai.manage"), read, handle({}, async (req, res, actor) => { reply(res, req, await aiStatus(actor)); }));
aiRouter.get("/status/lite", ...auth, requireAnyPermission("copilot.use", "document.ask", "risk.read", "inspection.verify", "inspection.submit", "ai.manage"), read, handle({}, async (req, res, actor) => {
  res.status(200).json(success(await getAiStatusLite(actor.agencyId), req.requestId));
}));
aiRouter.post("/processing/reindex", ...auth, requirePermission("ai.manage"), heavy, handle({ body: true }, async (req, res, actor) => {
  const b = reindexBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await reindex(actor, b.data, req.requestId), b.data.action === "start" ? 202 : 200);
}));
aiRouter.post("/search/diagnostic", ...auth, requirePermission("document.process"), diagnosticLimit, handle({ body: true }, async (req, res, actor) => {
  const b = diagnosticBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await diagnosticSearch(actor, b.data, req.requestId));
}));

// ---- Batch 10: document Q&A (private history; every route requires document.ask)
aiRouter.post("/qa", ...auth, requirePermission("document.ask"), qaLimit, ragHandle({ body: true }, async (req, res, actor) => {
  const b = askBody.safeParse(req.body);
  if (!b.success) return bad();
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); });
  const r = await askQuestion(actor, b.data, req.requestId, ac.signal);
  return { data: { ...r.interaction, ...(r.related ? { related: r.related } : {}) } };
}));
aiRouter.get("/qa/threads", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => { const q = parseStrict(threadsQuery, req.query); return q ? listThreads(actor, q) : bad(); }));
aiRouter.get("/qa/threads/:threadId", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => { const t = threadParam.safeParse(param(req.params.threadId)); return t.success ? getThread(actor, t.data) : bad(); }));
aiRouter.delete("/qa/threads/:threadId", ...auth, requirePermission("document.ask"), write, ragHandle({}, async (req, _res, actor) => { const t = threadParam.safeParse(param(req.params.threadId)); return t.success ? deleteThread(actor, t.data, req.requestId) : bad(); }));
aiRouter.delete("/qa/threads", ...auth, requirePermission("document.ask"), write, ragHandle({}, async (req, _res, actor) => deleteThread(actor, null, req.requestId)));
aiRouter.get("/interactions/:id", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => getInteraction(actor, param(req.params.id))));
aiRouter.post("/interactions/:id/feedback", ...auth, requirePermission("document.ask"), write, ragHandle({ body: true }, async (req, _res, actor) => { const b = feedbackBody.safeParse(req.body); return b.success ? submitFeedback(actor, param(req.params.id), b.data, req.requestId) : bad(); }));
aiRouter.get("/scope-preview", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => { const q = parseStrict(scopePreviewQuery, req.query); return q ? scopePreview(actor, q) : bad(); }));
aiDocumentRouter.get("/:id/ai/chunks/:chunkId/context", ...auth, requirePermission("document.read"), requirePermission("document.download"), read, ragHandle({}, async (req, _res, actor) => {
  const p = chunkContextParams.safeParse({ chunkId: param(req.params.chunkId) });
  return p.success ? chunkContext(actor, param(req.params.id), p.data.chunkId) : bad();
}));

// ---- Batch 10: summaries (async, cached artifacts; document.ask + document access)
aiDocumentRouter.get("/:id/ai/summaries", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => listSummaries(actor, param(req.params.id))));
aiDocumentRouter.post("/:id/ai/summaries", ...auth, requirePermission("document.ask"), qaLimit, ragHandle({ body: true }, async (req, _res, actor) => {
  const b = summaryBody.safeParse(req.body);
  return b.success ? createSummary(actor, param(req.params.id), b.data, req.requestId) : bad();
}));
aiDocumentRouter.get("/:id/ai/summaries/:artifactId", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => readSummary(actor, param(req.params.id), param(req.params.artifactId))));

// ---- Batch 10: structured extraction (generate: document.ask; review/apply: document.update)
aiDocumentRouter.get("/:id/ai/extractions", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => listExtractions(actor, param(req.params.id))));
aiDocumentRouter.post("/:id/ai/extractions", ...auth, requirePermission("document.ask"), qaLimit, ragHandle({ body: true }, async (req, _res, actor) => {
  const b = extractionBody.safeParse(req.body);
  return b.success ? createExtraction(actor, param(req.params.id), b.data, req.requestId) : bad();
}));
aiDocumentRouter.get("/:id/ai/extractions/:artifactId", ...auth, requirePermission("document.ask"), read, ragHandle({}, async (req, _res, actor) => readExtraction(actor, param(req.params.id), param(req.params.artifactId))));
aiDocumentRouter.put("/:id/ai/extractions/:artifactId/review", ...auth, requirePermission("document.update"), write, ragHandle({ body: true }, async (req, _res, actor) => {
  const b = reviewBody.safeParse(req.body);
  return b.success ? saveReview(actor, param(req.params.id), param(req.params.artifactId), b.data, req.requestId) : bad();
}));
aiDocumentRouter.post("/:id/ai/extractions/:artifactId/apply-metadata", ...auth, requirePermission("document.update"), write, ragHandle({ body: true }, async (req, _res, actor) => {
  const b = applyBody.safeParse(req.body);
  return b.success ? applyMetadata(actor, param(req.params.id), param(req.params.artifactId), b.data, req.requestId) : bad();
}));

// ---- Batch 10: quality aggregates (ai.manage; counts only, never content)
aiRouter.get("/quality", ...auth, requirePermission("ai.manage"), read, ragHandle({}, async (req, _res, actor) => { const q = parseStrict(qualityQuery, req.query); return q ? qualityAggregates(actor, q) : bad(); }));

