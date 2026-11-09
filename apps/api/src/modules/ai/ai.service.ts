import mongoose from "mongoose";
import type { z } from "zod";
import { AI_PIPELINE_VERSION, type AiIneligibleReason } from "@infraos/shared-types";

import { Flow, run, type Result } from "../contractors/contractor.context.js";
import { documentAccess, documentReadFilter } from "../documents/document-access.js";
import { capsOf, docContext, isId, loadDocument, needPerm, type DCtx, type DocRow } from "../documents/document.common.js";
import { DocumentChunk } from "../documents/models/document-chunk.model.js";
import { Document } from "../documents/models/document.model.js";
import { User } from "../identity/models/user.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { writeAiAudit } from "./ai.audit.js";
import { aiConfig } from "./ai.config.js";
import { AiClientError, aiClient } from "./ai-client.js";
import type { bulkReprocessBody, chunkQuery, diagnosticBody, jobsQuery, reindexBody } from "./ai.schema.js";
import { budgetState, tokensUsedToday } from "./processing/budget.js";
import { ProcessingJob, type ProcessingJobDocument } from "./processing/job.model.js";
import { cancelActiveJobs, enqueueJob, loadAiDocument } from "./processing/job.service.js";
import { lastReconcileSummary } from "./processing/reconciler.js";
import { AiUsageRecord } from "./usage.model.js";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const oid = (v: string) => new mongoose.Types.ObjectId(v);
const iso = (d?: Date | null) => (d ? d.toISOString() : null);
const unavailable = (e: unknown): Flow => new Flow(503, "SERVICE_UNAVAILABLE", { reason: e instanceof AiClientError ? e.code : "AI_SERVICE_UNAVAILABLE" });

/** Safe job projection: ids, enums, counts and timestamps only. No file names, content or service messages. */
export function jobDto(j: ProcessingJobDocument, requester?: string | null) {
  return {
    id: String(j._id), documentId: String(j.documentId), versionNo: j.versionNo, trigger: j.trigger, status: j.status, stage: j.stage,
    stages: (j.stages ?? []).map((s) => ({ key: s.key, status: s.status, startedAt: iso(s.startedAt), finishedAt: iso(s.finishedAt), errorCode: s.errorCode ?? null })),
    attempt: j.attempt, maxAttempts: j.maxAttempts, nextAttemptAt: iso(j.nextAttemptAt), errorCode: j.errorCode ?? null, errorMessageKey: j.errorMessageKey ?? null,
    warnings: [...(j.warnings ?? [])], stats: { pages: j.stats?.pages ?? 0, chars: j.stats?.chars ?? 0, chunks: j.stats?.chunks ?? 0, duplicatesDropped: j.stats?.duplicatesDropped ?? 0, embedded: j.stats?.embedded ?? 0, tokens: j.stats?.tokens ?? 0, truncated: Boolean(j.stats?.truncated) },
    pipelineVersion: j.pipelineVersion, embeddingModel: j.embeddingModel ?? null, requestedBy: j.requestedBy ? (requester ?? null) : null, byUser: Boolean(j.requestedBy),
    startedAt: iso(j.startedAt), finishedAt: iso(j.finishedAt), createdAt: iso((j as unknown as { createdAt?: Date }).createdAt),
  };
}

async function requesterNames(jobs: ProcessingJobDocument[]): Promise<Map<string, string>> {
  const ids = [...new Set(jobs.map((j) => (j.requestedBy ? String(j.requestedBy) : "")).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids.map(oid) } }).select("firstName lastName").lean();
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

const aiIndexDto = (d: DocRow) => {
  const a = d.aiIndex;
  return a ? { indexedVersionNo: a.indexedVersionNo ?? null, chunkCount: a.chunkCount ?? 0, pageCount: a.pageCount ?? null, embeddingModel: a.embeddingModel ?? null, embeddingDimension: a.embeddingDimension ?? null,
    pipelineVersion: a.pipelineVersion ?? null, indexedAt: iso(a.indexedAt), errorCode: a.errorCode ?? null, warnings: [...(a.warnings ?? [])], truncated: Boolean(a.truncated), outdated: Boolean(a.pipelineVersion && a.pipelineVersion !== AI_PIPELINE_VERSION) } : null;
};

export const serviceAvailable = (): { configured: boolean; available: boolean } => ({ configured: aiConfig.configured, available: aiConfig.configured && aiClient().breaker.state === "closed" });

// ---------------------------------------------------------------- per document

export const getDocumentAi = (actor: AuthenticatedActor, rawId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  const row = await loadDocument(d, rawId);
  const facts = await loadAiDocument(String(row._id));
  const jobs = (await ProcessingJob.find({ documentId: row._id }).sort({ createdAt: -1 }).limit(10).lean()) as ProcessingJobDocument[];
  const names = await requesterNames(jobs);
  const active = jobs.find((j) => ["QUEUED", "RUNNING", "DEFERRED"].includes(j.status));
  const eligible = facts?.eligibility.eligible ?? false;
  return ok({
    documentId: String(row._id), docNo: row.docNo ?? null, eligible, reasonCode: facts && !facts.eligibility.eligible ? facts.eligibility.reasonCode : null,
    extractedTextStatus: row.extractedTextStatus, aiIndex: aiIndexDto(row), currentJob: active ? jobDto(active, names.get(String(active.requestedBy))) : null,
    lastJob: jobs[0] ? jobDto(jobs[0], names.get(String(jobs[0].requestedBy))) : null,
    jobs: jobs.map((j) => jobDto(j, names.get(String(j.requestedBy)))),
    canReprocess: d.ctx.has("document.process") && eligible && !active, canCancel: d.ctx.has("document.process") && Boolean(active),
    canViewChunks: d.ctx.has("document.read") && d.ctx.has("document.download") && capsOf(d, row).canDownload,
    pipelineVersion: AI_PIPELINE_VERSION, service: serviceAvailable(),
  });
});

export const reprocessDocument = (actor: AuthenticatedActor, rawId: string, requestId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  const row = await loadDocument(d, rawId);
  const r = await enqueueJob({ documentId: String(row._id), trigger: "REPROCESS", requestedBy: actor.userId });
  if (!r.queued) {
    if (r.reason === "ACTIVE_JOB") throw new Flow(409, "CONFLICT", { reason: "ACTIVE_JOB", activeJobId: r.job ? String(r.job._id) : null });
    throw new Flow(409, "CONFLICT", { reason: r.reason });
  }
  await writeAiAudit(undefined, { action: "ai.document_reprocess_requested", resourceId: row._id, agencyId: String(row.agencyId), actorUserId: actor.userId, status: "QUEUED", requestId });
  return ok({ job: jobDto(r.job) });
});

export const cancelDocumentJob = (actor: AuthenticatedActor, rawId: string, requestId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  const row = await loadDocument(d, rawId);
  const n = await cancelActiveJobs(String(row._id));
  if (n === 0) throw new Flow(409, "CONFLICT", { reason: "NO_ACTIVE_JOB" });
  const indexed = row.aiIndex?.indexedVersionNo === row.currentVersionNo && row.extractedTextStatus === "COMPLETED";
  if (!indexed) await Document.updateOne({ _id: row._id }, { $set: { extractedTextStatus: "NOT_STARTED" } }, { timestamps: false });
  await writeAiAudit(undefined, { action: "ai.document_processing_cancelled", resourceId: row._id, agencyId: String(row.agencyId), actorUserId: actor.userId, status: "CANCELLED", requestId });
  return ok({ cancelled: n });
});

export const listChunks = (actor: AuthenticatedActor, rawId: string, q: z.infer<typeof chunkQuery>, requestId: string) => run<Result<Record<string, unknown>>>(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.read");
  needPerm(d.ctx, "document.download");
  const row = await loadDocument(d, rawId);
  if (!capsOf(d, row).canDownload) throw new Flow(403, "FORBIDDEN"); // SENSITIVE/out-of-policy documents never expose text
  const version = row.aiIndex?.indexedVersionNo;
  if (!version || row.extractedTextStatus !== "COMPLETED") return ok({ items: [], total: 0, page: q.page, limit: q.limit, indexedVersionNo: null });
  const filter = { documentId: row._id, versionNo: version, status: "ACTIVE" };
  const [total, rows] = await Promise.all([
    DocumentChunk.countDocuments(filter),
    DocumentChunk.find(filter).select("+content chunkIndex pageStart pageEnd section status charCount").sort({ chunkIndex: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
  ]);
  await writeAiAudit(undefined, { action: "ai.chunk_preview_viewed", resourceId: row._id, agencyId: String(row.agencyId), actorUserId: actor.userId, status: "COMPLETED", reason: `count:${rows.length}`, requestId }).catch(() => undefined);
  return ok({
    total, page: q.page, limit: q.limit, indexedVersionNo: version,
    items: rows.map((c) => ({ chunkIndex: c.chunkIndex, pageStart: c.pageStart ?? null, pageEnd: c.pageEnd ?? null, section: c.section ?? null, status: c.status, charCount: c.charCount, text: (c as unknown as { content?: string }).content?.slice(0, 1500) ?? "" })),
  });
});

// ---------------------------------------------------------------- processing center

const EXCLUDED = { $or: [{ aiProcessingAllowed: false }, { confidentiality: "SENSITIVE", aiProcessingAllowed: { $ne: true } }] };

async function scopedBase(d: DCtx): Promise<Record<string, unknown>[]> {
  return [documentReadFilter(d.viewer), { origin: "DOCTRACE", status: "ACTIVE" }];
}

export const processingSummary = (actor: AuthenticatedActor) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  const base = await scopedBase(d);
  const count = (...extra: Record<string, unknown>[]) => Document.countDocuments({ $and: [...base, ...extra] });
  const eligible = { aiEligibleType: true, $nor: [EXCLUDED] };
  const [total, eligibleTotal, ready, queued, processing, failed, unsupported, notStarted, excluded, notEligible, outdated] = await Promise.all([
    count(), count(eligible), count(eligible, { extractedTextStatus: "COMPLETED" }), count(eligible, { extractedTextStatus: "QUEUED" }), count(eligible, { extractedTextStatus: "PROCESSING" }),
    count(eligible, { extractedTextStatus: "FAILED" }), count(eligible, { extractedTextStatus: "UNSUPPORTED" }), count(eligible, { extractedTextStatus: "NOT_STARTED" }),
    count({ aiEligibleType: true }, EXCLUDED), count({ aiEligibleType: { $ne: true } }), count(eligible, { extractedTextStatus: "COMPLETED", "aiIndex.pipelineVersion": { $ne: AI_PIPELINE_VERSION } }),
  ]);
  const manage = d.ctx.has("ai.manage");
  const used = manage ? await tokensUsedToday() : 0;
  return ok({
    total, eligible: eligibleTotal, ready, queued, processing, failed, unsupported, notStarted, excluded, notEligible, outdated,
    coveragePercent: eligibleTotal > 0 ? Math.round((ready / eligibleTotal) * 1000) / 10 : null,
    tokens: manage ? { usedToday: used, dailyBudget: aiConfig.dailyTokenBudget, estimatedCostMinor: aiConfig.pricePerMTokensMinor !== undefined ? Math.round((used * aiConfig.pricePerMTokensMinor) / 1_000_000) : null, costIsEstimated: aiConfig.pricePerMTokensMinor !== undefined } : null,
    pipelineVersion: AI_PIPELINE_VERSION, service: serviceAvailable(),
  });
});

export const listJobs = (actor: AuthenticatedActor, q: z.infer<typeof jobsQuery>) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  const docFilter: Record<string, unknown>[] = [documentReadFilter(d.viewer), { origin: "DOCTRACE" }];
  if (q.agencyId) docFilter.push({ agencyId: oid(q.agencyId) });
  if (q.documentId) docFilter.push({ _id: oid(q.documentId) });
  if (q.q) { const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); docFilter.push({ $or: [{ title: rx }, { docNo: rx }] }); }
  // Authorization = the same read filter every other document query uses; jobs are visible only for documents the caller can read.
  const visible = await Document.find({ $and: docFilter }).select("_id").limit(5000).lean();
  const jf: Record<string, unknown> = { documentId: { $in: visible.map((v) => v._id) } };
  if (q.status) jf.status = q.status === "ACTIVE" ? { $in: ["QUEUED", "RUNNING", "DEFERRED"] } : q.status;
  if (q.trigger) jf.trigger = q.trigger;
  if (q.from || q.to) jf.createdAt = { ...(q.from ? { $gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { $lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) };
  const [total, rows] = await Promise.all([
    ProcessingJob.countDocuments(jf),
    ProcessingJob.find(jf).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
  ]);
  const jobs = rows as ProcessingJobDocument[];
  const [docs, names] = await Promise.all([
    Document.find({ _id: { $in: jobs.map((j) => j.documentId) } }).select("docNo title").lean(),
    requesterNames(jobs),
  ]);
  const byId = new Map(docs.map((x) => [String(x._id), x]));
  return ok({
    total, page: q.page, limit: q.limit,
    items: jobs.map((j) => ({ ...jobDto(j, names.get(String(j.requestedBy))), docNo: byId.get(String(j.documentId))?.docNo ?? null, title: byId.get(String(j.documentId))?.title ?? null })),
  });
});

export const bulkReprocess = (actor: AuthenticatedActor, body: z.infer<typeof bulkReprocessBody>, requestId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  const scope = documentReadFilter(d.viewer);
  const docs = body.ids
    ? await Document.find({ $and: [scope, { _id: { $in: body.ids.map(oid) } }] }).select("_id docNo agencyId").lean()
    : await Document.find({ $and: [scope, { origin: "DOCTRACE", extractedTextStatus: "FAILED" }] }).select("_id docNo agencyId").sort({ updatedAt: -1 }).limit(50).lean();
  const found = new Set(docs.map((x) => String(x._id)));
  const results: { documentId: string; docNo: string | null; result: "QUEUED" | "ACTIVE_JOB" | AiIneligibleReason | "NOT_FOUND" | "STALE_VERSION" }[] = [];
  for (const id of body.ids ?? []) if (!found.has(id)) results.push({ documentId: id, docNo: null, result: "NOT_FOUND" }); // out of scope looks identical to missing
  for (const doc of docs) {
    const r = await enqueueJob({ documentId: String(doc._id), trigger: "REPROCESS", requestedBy: actor.userId });
    if (r.queued) await writeAiAudit(undefined, { action: "ai.document_reprocess_requested", resourceId: doc._id, agencyId: String(doc.agencyId), actorUserId: actor.userId, status: "QUEUED", requestId }).catch(() => undefined);
    results.push({ documentId: String(doc._id), docNo: doc.docNo ?? null, result: r.queued ? "QUEUED" : r.reason });
  }
  return ok({ queued: results.filter((r) => r.result === "QUEUED").length, results });
});

// ---------------------------------------------------------------- admin

const modelKey = (m?: string | null) => (m ?? "").toLowerCase();

async function reindexProgress(model: string | null, dimension: number | null) {
  const indexed = { origin: "DOCTRACE", status: "ACTIVE", extractedTextStatus: "COMPLETED" };
  const total = await Document.countDocuments(indexed);
  if (!model || !dimension) return { total, migrated: 0, pending: total, percent: total ? 0 : 100 };
  const migrated = await Document.countDocuments({ ...indexed, "aiIndex.embeddingDimension": dimension, $expr: { $eq: [{ $toLower: { $ifNull: ["$aiIndex.embeddingModel", ""] } }, modelKey(model)] } });
  return { total, migrated, pending: total - migrated, percent: total ? Math.round((migrated / total) * 1000) / 10 : 100 };
}

export const aiStatus = (actor: AuthenticatedActor) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "ai.manage");
  const client = aiClient();
  const health = await client.health();
  const [ready, plan] = health ? await Promise.all([client.ready().catch(() => null), client.reindexPlan().catch(() => null)]) : [null, null];
  const [budget, queue] = await Promise.all([
    budgetState(),
    ProcessingJob.aggregate<{ _id: string; n: number }>([{ $match: { status: { $in: ["QUEUED", "RUNNING", "DEFERRED", "FAILED"] } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const last = lastReconcileSummary();
  return ok({
    configured: aiConfig.configured, processingEnabled: aiConfig.processingEnabled, circuit: client.breaker.state,
    state: !aiConfig.configured ? "UNAVAILABLE" : !health ? "UNAVAILABLE" : ready?.status === "ready" ? "HEALTHY" : "DEGRADED",
    checks: ready?.checks ?? null, model: plan?.configuredModel ?? aiConfig.embedModel ?? null, dimension: plan?.dimension ?? null, collection: plan?.targetCollection ?? null,
    collections: plan?.collections ?? [], pipelineVersion: AI_PIPELINE_VERSION,
    budget: { usedToday: budget.used, dailyBudget: budget.budget, remaining: budget.remaining, resetsAt: iso(budget.resetsAt), estimatedCostMinor: aiConfig.pricePerMTokensMinor !== undefined ? Math.round((budget.used * aiConfig.pricePerMTokensMinor) / 1_000_000) : null, costIsEstimated: aiConfig.pricePerMTokensMinor !== undefined },
    queue: Object.fromEntries(queue.map((x) => [x._id, x.n])), reindex: await reindexProgress(plan?.configuredModel ?? null, plan?.dimension ?? null),
    lastReconcile: last ? { at: last.at.toISOString(), enqueued: last.enqueued, purged: last.purged, requeued: last.requeued } : null,
  });
});

export const reindex = (actor: AuthenticatedActor, body: z.infer<typeof reindexBody>, requestId: string) => run<Result<Record<string, unknown>>>(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "ai.manage");
  const client = aiClient();
  let plan;
  try { plan = await client.reindexPlan(); } catch (e) { throw unavailable(e); }
  if (!plan.configuredModel || !plan.dimension) throw new Flow(409, "CONFLICT", { reason: "EMBEDDING_NOT_CONFIGURED" });
  const progress = await reindexProgress(plan.configuredModel, plan.dimension);
  if (body.action === "start") {
    if (progress.pending === 0) throw new Flow(409, "CONFLICT", { reason: "NOTHING_TO_REINDEX" });
    const targets = await Document.find({ origin: "DOCTRACE", status: "ACTIVE", extractedTextStatus: "COMPLETED" }).select("_id aiIndex.embeddingModel aiIndex.embeddingDimension").sort({ updatedAt: 1 }).limit(5000).lean();
    const pending = targets.filter((t) => modelKey(t.aiIndex?.embeddingModel) !== modelKey(plan.configuredModel) || t.aiIndex?.embeddingDimension !== plan.dimension);
    let queued = 0;
    for (let i = 0; i < pending.length; i += 25) {
      const batch = await Promise.all(pending.slice(i, i + 25).map((t) => enqueueJob({ documentId: String(t._id), trigger: "REINDEX", requestedBy: actor.userId }).catch(() => null)));
      queued += batch.filter((r) => r?.queued).length;
    }
    await writeAiAudit(undefined, { action: "ai.reindex_started", resourceType: "SYSTEM", resourceId: new mongoose.Types.ObjectId(), actorUserId: actor.userId, status: "STARTED", requestId });
    return ok({ queued, pending: progress.pending, targetCollection: plan.targetCollection, note: "old collection stays untouched until you finalize" });
  }
  if (progress.percent < 95) throw new Flow(409, "CONFLICT", { reason: "NOT_ENOUGH_PROGRESS", percent: progress.percent });
  if (!plan.targetExists) throw new Flow(409, "CONFLICT", { reason: "TARGET_MISSING" });
  const old = plan.collections.filter((c) => c.name !== plan.targetCollection).map((c) => c.name);
  const dropped: string[] = [];
  try { for (const name of old) { await client.dropCollection(name); dropped.push(name); } } catch (e) { throw unavailable(e); }
  await writeAiAudit(undefined, { action: "ai.reindex_started", resourceType: "SYSTEM", resourceId: new mongoose.Types.ObjectId(), actorUserId: actor.userId, status: "COMPLETED", reason: "finalized", requestId });
  return ok({ dropped: dropped.length, percent: progress.percent });
});

// ---------------------------------------------------------------- diagnostic

export const diagnosticSearch = (actor: AuthenticatedActor, body: z.infer<typeof diagnosticBody>, requestId: string) => run(async () => {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.process");
  if (body.projectId && !isId(body.projectId)) throw new Flow(400, "VALIDATION_ERROR");
  // The allow-list is built here, server-side, from the caller's own read filter. The client never supplies ids or filters beyond a project.
  const candidates = await Document.find({ $and: [documentReadFilter(d.viewer), { origin: "DOCTRACE", extractedTextStatus: "COMPLETED", "aiIndex.indexedVersionNo": { $exists: true } }, ...(body.projectId ? [{ projectId: oid(body.projectId) }] : [])] })
    .select("agencyId projectId ownerId uploadedBy status visibility confidentiality category deletedAt docNo title aiIndex").sort({ updatedAt: -1 }).limit(500).lean();
  if (!candidates.length) return ok({ results: [], searched: 0, note: "NO_INDEXED_DOCUMENTS" });
  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  if ((await budgetState()).exceeded) throw new Flow(503, "SERVICE_UNAVAILABLE", { reason: "BUDGET_EXCEEDED" });
  let res;
  try {
    res = await aiClient().search({ query: body.query, allowedDocumentIds: [...byId.keys()], topK: Math.min(20, body.limit * 2), ...(body.projectId ? { filters: { projectId: body.projectId } } : {}) });
  } catch (e) { throw unavailable(e); }
  if (res.tokens > 0) await AiUsageRecord.create({ kind: "EMBEDDING", agencyId: oid(actor.agencyId), userId: oid(actor.userId), provider: "openrouter", model: res.model, inputTokens: res.tokens, outputTokens: 0, status: "OK" }).catch(() => undefined);
  const chunkIds = res.hits.map((h) => h.chunkId);
  const chunks = await DocumentChunk.find({ chunkId: { $in: chunkIds }, status: "ACTIVE" }).select("+content chunkId documentId versionNo pageStart pageEnd section").lean();
  const chunkById = new Map(chunks.map((c) => [c.chunkId, c]));
  const results: Record<string, unknown>[] = [];
  for (const h of res.hits) {
    const doc = byId.get(h.documentId);
    const chunk = chunkById.get(h.chunkId);
    if (!doc || !chunk) continue; // not in the allow-list, or the chunk is not ACTIVE in Mongo
    if (doc.aiIndex?.indexedVersionNo !== h.versionNo || chunk.versionNo !== h.versionNo) continue; // stale version
    if (!documentAccess(d.viewer, { agencyId: String(doc.agencyId), projectId: doc.projectId ? String(doc.projectId) : null, ownerId: doc.ownerId ? String(doc.ownerId) : null, uploadedBy: doc.uploadedBy ? String(doc.uploadedBy) : null, status: doc.status, visibility: doc.visibility, confidentiality: doc.confidentiality, category: doc.category })) continue; // re-authorise every hit
    results.push({
      documentId: h.documentId, docNo: doc.docNo ?? null, title: doc.title ?? null, chunkId: h.chunkId, pageStart: chunk.pageStart ?? null, pageEnd: chunk.pageEnd ?? null,
      section: chunk.section ?? null, score: Math.round(h.score * 1000) / 1000, snippet: ((chunk as unknown as { content?: string }).content ?? "").slice(0, 300),
    });
    if (results.length >= body.limit) break;
  }
  await writeAiAudit(undefined, { action: "ai.retrieval_diagnostic_run", resourceType: "SYSTEM", resourceId: new mongoose.Types.ObjectId(actor.userId), agencyId: actor.agencyId, actorUserId: actor.userId, status: "COMPLETED", reason: `count:${results.length}`, requestId }).catch(() => undefined);
  return ok({ results, searched: candidates.length, note: "DIAGNOSTIC_NOT_AN_ANSWER" });
});
