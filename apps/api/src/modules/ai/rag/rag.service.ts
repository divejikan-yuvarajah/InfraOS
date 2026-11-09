import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { AI_PIPELINE_VERSION, AI_PROMPT_VERSIONS, type AiLanguage, type AiQaStatus } from "@infraos/shared-types";

import { logger } from "../../../shared/logger.js";
import { docContext, needPerm, type DCtx } from "../../documents/document.common.js";
import { documentAccess } from "../../documents/document-access.js";
import { DocumentChunk } from "../../documents/models/document-chunk.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { aiConfig } from "../ai.config.js";
import { AiClientError, aiClient } from "../ai-client.js";
import { chatBudgetState } from "../processing/budget.js";
import { AiUsageRecord } from "../usage.model.js";
import { assembleContext, neighbourKeys, type ChunkLite, type ContextChunk } from "./context.js";
import { verifyAnswer, type GroundedAnswer } from "./grounding.js";
import { RagFlow } from "./http.js";
import { buildInteractionDto, type InteractionDto } from "./interaction.dto.js";
import { AiInteraction } from "./interaction.model.js";
import { looksLikeInjection } from "./injection.js";
import { redactText } from "./redact.js";
import { rerank } from "./rerank.js";
import { resolveScope, type ResolvedScope, type ScopeInput } from "./scope.js";
import { cleanInput, truncate } from "./text.js";

const oid = (v: string) => new mongoose.Types.ObjectId(v);
const DEDUPE_MS = 10_000;
const FALLBACK_PASSAGES = 5;
const RELATED_PASSAGES = 3;

export type AskInput = { question: string; scope: ScopeInput; threadId?: string | undefined; language?: AiLanguage | undefined; regenerate?: boolean | undefined };
export type Passage = { documentId: string; docNo: string | null; title: string; pageStart: number | null; pageEnd: number | null; section: string | null; excerpt: string; score?: number };
export type AskResult = { interaction: InteractionDto; related?: Passage[] };

export class AbortedAsk extends Error { constructor() { super("aborted"); this.name = "AbortedAsk"; } }

/** Script-based language guess (no dependency): Sinhala/Tamil letters win, otherwise English. */
export function detectLanguage(text: string): AiLanguage {
  const si = (text.match(/[඀-෿]/g) ?? []).length;
  const ta = (text.match(/[஀-௿]/g) ?? []).length;
  if (si === 0 && ta === 0) return "en";
  return si >= ta ? "si" : "ta";
}

const ANAPHORA = /^(?:and|also|what about|how about|why|then|so|it|they|this|that|those|these|he|she)\b/i;
/** Short or pronoun-led follow-ups borrow the previous question for RETRIEVAL only; the prompt keeps the user's own words. */
export function retrievalQuery(question: string, previous: string | null): string {
  if (!previous) return question;
  const words = question.split(/\s+/).filter(Boolean).length;
  return words < 5 || ANAPHORA.test(question) ? `${previous} ${question}` : question;
}

export const costMinor = (inTok: number, outTok: number): number | undefined => {
  const { priceInputPerMMinor: pi, priceOutputPerMMinor: po } = aiConfig.chat;
  return pi !== undefined && po !== undefined ? Math.round((inTok * pi + outTok * po) / 1_000_000) : undefined;
};

const inflight = new Map<string, { hash: string; promise: Promise<AskResult> }>();
const recent = new Map<string, { at: number; id: string }>();

const hashOf = (userId: string, input: AskInput, q: string) => createHash("sha256").update(JSON.stringify([userId, input.scope.mode, [...(input.scope.documentIds ?? [])].sort(), input.scope.projectId ?? "", q])).digest("hex");

type StoredCitation = { n: number; chunkId: string; documentId: mongoose.Types.ObjectId; versionNo: number; pageStart?: number; pageEnd?: number; section?: string; quote?: string; quoteVerified: boolean; wasNeighbor: boolean };
type Persist = {
  answer?: { text: string; claims: { text: string; citationNs: number[]; supported: boolean }[]; missingInfo: string[] };
  citations?: StoredCitation[];
  evidence?: { level: "VERIFIED" | "PARTIAL" | "NONE"; unverifiedFigures: string[]; droppedClaims: number; quotesVerified: number; quotesTotal: number };
  retrieval?: { candidates: number; used: number; flaggedSuspicious: number; droppedStale: number; redactions: number; minScoreUsed?: number };
  usage?: { inputTokens: number; outputTokens: number; estimatedCostMinor?: number };
  model?: string; promptVersion?: string; errorCode?: string;
};

export async function askQuestion(actor: NonNullable<Express.Request["actor"]>, input: AskInput, requestId: string, signal?: AbortSignal): Promise<AskResult> {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  const cfg = aiConfig;
  if (!cfg.configured || !cfg.processingEnabled || !cfg.chat.model) throw new RagFlow(503, "AI_UNAVAILABLE", { reason: "NOT_CONFIGURED" });
  const question = cleanInput(input.question);
  if (question.length < 3 || question.length > 600) throw new RagFlow(400, "VALIDATION_ERROR");

  const budget = await chatBudgetState();
  if (budget.exceeded) throw new RagFlow(429, "AI_BUDGET_EXCEEDED", { resetsAt: budget.resetsAt.toISOString() });

  const hash = hashOf(actor.userId, input, question);
  if (!input.regenerate) {
    const prior = inflight.get(actor.userId);
    if (prior?.hash === hash) return prior.promise;
    const last = recent.get(hash);
    if (last && Date.now() - last.at < DEDUPE_MS) {
      const row = await AiInteraction.findOne({ _id: oid(last.id), userId: oid(actor.userId) });
      if (row) return { interaction: await buildInteractionDto(d, row) };
    }
  }
  if (inflight.has(actor.userId)) throw new RagFlow(429, "AI_RATE_LIMITED", { reason: "REQUEST_IN_PROGRESS" });

  const promise = execute(d, actor, input, question, requestId, signal);
  inflight.set(actor.userId, { hash, promise });
  try {
    const result = await promise;
    recent.set(hash, { at: Date.now(), id: result.interaction.id });
    if (recent.size > 500) for (const [k, v] of recent) if (Date.now() - v.at > DEDUPE_MS) recent.delete(k);
    return result;
  } finally {
    inflight.delete(actor.userId);
  }
}

async function execute(d: DCtx, actor: NonNullable<Express.Request["actor"]>, input: AskInput, question: string, requestId: string, signal?: AbortSignal): Promise<AskResult> {
  const started = Date.now();
  const cfg = aiConfig;
  const language = input.language ?? detectLanguage(question);

  // thread: must already belong to the caller, otherwise a new one is started
  let threadId: string = randomUUID();
  let previous: string | null = null;
  if (input.threadId) {
    const last = await AiInteraction.findOne({ userId: oid(actor.userId), threadId: input.threadId }).sort({ createdAt: -1 }).select("question threadId").lean();
    if (!last) throw new RagFlow(404, "NOT_FOUND");
    threadId = input.threadId;
    previous = last.question;
  }

  const scope = await resolveScope(d, input.scope);
  const ids = [...scope.docs.keys()];

  const finish = async (status: AiQaStatus, fields: Persist & { related?: Passage[] }): Promise<AskResult> => {
    if (signal?.aborted) throw new AbortedAsk();
    const { related, ...rest } = fields;
    const usage = rest.usage ?? { inputTokens: 0, outputTokens: 0 };
    const doc: Record<string, unknown> = {
      kind: "QA", userId: oid(actor.userId), agencyId: oid(actor.agencyId), threadId, scope: { mode: input.scope.mode, ...(input.scope.documentIds ? { documentIds: input.scope.documentIds.map(oid) } : {}), ...(input.scope.projectId ? { projectId: oid(input.scope.projectId) } : {}) },
      question, language, status, citations: [], coverage: scope.coverage, model: cfg.chat.model, promptVersion: AI_PROMPT_VERSIONS.qa, pipelineVersion: AI_PIPELINE_VERSION, latencyMs: Date.now() - started,
      expiresAt: new Date(Date.now() + cfg.chat.interactionTtlDays * 86_400_000), ...rest, usage,
    };
    const [row] = await AiInteraction.create([doc] as never[]);
    if (!row) throw new RagFlow(503, "AI_UNAVAILABLE");
    await writeAiAudit(undefined, { action: "ai.question_asked", resourceType: "SYSTEM", resourceId: row._id, agencyId: actor.agencyId, actorUserId: actor.userId, status, reason: row.errorCode ?? input.scope.mode, requestId }).catch(() => undefined);
    return { interaction: await buildInteractionDto(d, row, { excerpts: true }), ...(related ? { related } : {}) };
  };
  const noEvidence = { answer: { text: "", claims: [], missingInfo: [] as string[] }, evidence: { level: "NONE" as const, unverifiedFigures: [] as string[], droppedClaims: 0, quotesVerified: 0, quotesTotal: 0 } };

  if (ids.length === 0) return finish("INSUFFICIENT_EVIDENCE", { ...noEvidence, retrieval: { candidates: 0, used: 0, flaggedSuspicious: 0, droppedStale: 0, redactions: 0 } });

  // ---- vector search under the server-built allow-list
  let hits;
  try {
    hits = await aiClient().search({ query: retrievalQuery(question, previous), allowedDocumentIds: ids, topK: cfg.rag.topK });
  } catch (error) {
    logger.warn({ code: error instanceof AiClientError ? error.code : "unknown" }, "rag retrieval failed");
    await finish("FAILED", { ...noEvidence, errorCode: "AI_UNAVAILABLE" }).catch(() => undefined);
    throw new RagFlow(503, "AI_UNAVAILABLE", { reason: "RETRIEVAL_FAILED" });
  }
  if (hits.tokens > 0) await AiUsageRecord.create({ kind: "EMBEDDING", purpose: "QA", agencyId: oid(actor.agencyId), userId: oid(actor.userId), provider: "openrouter", model: hits.model, inputTokens: hits.tokens, outputTokens: 0, status: "OK" }).catch(() => undefined);

  // ---- hydrate from MongoDB and re-authorise every hit (nothing in the vector payload is trusted)
  const rows = await DocumentChunk.find({ chunkId: { $in: hits.hits.map((h) => h.chunkId) }, status: "ACTIVE" }).select("+content chunkId documentId versionNo chunkIndex pageStart pageEnd section").lean();
  const byChunk = new Map(rows.map((r) => [r.chunkId, r]));
  type Hit = ChunkLite & { dense: number };
  const kept: Hit[] = [];
  let droppedStale = 0;
  for (const h of hits.hits) {
    const row = byChunk.get(h.chunkId);
    const doc = scope.docs.get(h.documentId);
    const live = row && doc && String(row.documentId) === h.documentId && row.versionNo === h.versionNo && doc.indexedVersionNo === h.versionNo && documentAccess(d.viewer, doc.facts);
    if (!live || !row || !doc) { droppedStale += 1; continue; }
    kept.push({ chunkId: row.chunkId, documentId: h.documentId, versionNo: row.versionNo, chunkIndex: row.chunkIndex, pageStart: row.pageStart ?? null, pageEnd: row.pageEnd ?? null, section: row.section ?? null, text: (row as unknown as { content: string }).content, title: doc.title, category: doc.category, dense: h.score });
  }
  // ---- injection screen: flagged chunks never reach the model
  const safe = kept.filter((k) => !looksLikeInjection(k.text));
  const flagged = kept.length - safe.length;
  const retrievalStats = { candidates: hits.hits.length, used: 0, flaggedSuspicious: flagged, droppedStale, redactions: 0, minScoreUsed: cfg.rag.minScore };

  if (safe.length === 0) return finish("INSUFFICIENT_EVIDENCE", { ...noEvidence, retrieval: retrievalStats });

  const ranked = rerank(question, safe.map((s) => ({ ...s })), scope.docs.size > 1 ? { perDocCap: cfg.rag.perDocCap } : {});
  const best = Math.max(...safe.map((s) => s.dense));
  const passageOf = (c: Hit & { finalScore?: number }): Passage => ({ documentId: c.documentId, docNo: scope.docs.get(c.documentId)?.docNo ?? null, title: c.title, pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, excerpt: truncate(redactText(c.text).text, 400), score: Math.round(c.dense * 1000) / 1000 });

  // ---- evidence gate: no LLM call without evidence
  if (best < cfg.rag.minScore) return finish("INSUFFICIENT_EVIDENCE", { ...noEvidence, retrieval: retrievalStats, related: ranked.slice(0, RELATED_PASSAGES).map(passageOf) });

  // ---- context: ranked chunks + neighbours of the top three (clause splits), redacted
  const keys = neighbourKeys(ranked, 3);
  const nRows = keys.length ? await DocumentChunk.find({ status: "ACTIVE", $or: keys.map((k) => ({ documentId: oid(k.documentId), versionNo: k.versionNo, chunkIndex: k.chunkIndex })) }).select("+content chunkId documentId versionNo chunkIndex pageStart pageEnd section").lean() : [];
  const neighbours: ChunkLite[] = [];
  for (const r of nRows) {
    const doc = scope.docs.get(String(r.documentId));
    const text = (r as unknown as { content: string }).content;
    if (!doc || doc.indexedVersionNo !== r.versionNo || looksLikeInjection(text)) continue;
    neighbours.push({ chunkId: r.chunkId, documentId: String(r.documentId), versionNo: r.versionNo, chunkIndex: r.chunkIndex, pageStart: r.pageStart ?? null, pageEnd: r.pageEnd ?? null, section: r.section ?? null, text, title: doc.title, category: doc.category });
  }
  let redactions = 0;
  const redact = (c: ChunkLite): ChunkLite => { if (!cfg.chat.redactContext) return c; const r = redactText(c.text); redactions += r.count; return { ...c, text: r.text }; };
  const context = assembleContext({ ranked: ranked.map(redact), neighbours: neighbours.map(redact), maxChunks: cfg.rag.contextChunks, maxChars: cfg.rag.contextMaxChars });
  const stats = { ...retrievalStats, used: context.length, redactions };

  // ---- generate
  let completion;
  try {
    completion = await aiClient().answer({ language, question, sources: context.map((c) => ({ n: c.n, title: truncate(c.title, 200), category: c.category, text: c.text })), maxOutputTokens: cfg.chat.qaMaxOutputTokens }, signal);
  } catch (error) {
    if (signal?.aborted) throw new AbortedAsk();
    const llm = error instanceof AiClientError ? error.llm : undefined;
    const code = llm === "LLM_INVALID_OUTPUT" ? "AI_INVALID_OUTPUT" : error instanceof AiClientError && error.code === "AI_SERVICE_TIMEOUT" ? "AI_TIMEOUT" : llm === "LLM_RATE_LIMITED" ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE";
    logger.warn({ code }, "rag generation failed; falling back to passages");
    // Honest fallback ladder: verbatim passages only, labelled as such. Nothing is generated.
    const top = ranked.slice(0, FALLBACK_PASSAGES);
    return finish("PASSAGES_ONLY", {
      ...noEvidence, retrieval: stats, errorCode: code,
      citations: top.map((c, i) => ({ n: i + 1, chunkId: c.chunkId, documentId: oid(c.documentId), versionNo: c.versionNo, ...(c.pageStart !== null ? { pageStart: c.pageStart } : {}), ...(c.pageEnd !== null ? { pageEnd: c.pageEnd } : {}), ...(c.section ? { section: c.section } : {}), quoteVerified: false, wasNeighbor: false })),
    });
  }

  const g: GroundedAnswer = verifyAnswer(completion.output, context);
  const usage = { inputTokens: completion.usage.inputTokens, outputTokens: completion.usage.outputTokens, ...(costMinor(completion.usage.inputTokens, completion.usage.outputTokens) !== undefined ? { estimatedCostMinor: costMinor(completion.usage.inputTokens, completion.usage.outputTokens)! } : {}) };
  await AiUsageRecord.create({ kind: "CHAT", purpose: "QA", agencyId: oid(actor.agencyId), userId: oid(actor.userId), provider: "openrouter", model: completion.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, status: "OK", ...(usage.estimatedCostMinor !== undefined ? { estimatedCostMinor: usage.estimatedCostMinor } : {}) }).catch(() => undefined);

  return finish(g.status, {
    answer: { text: g.text, claims: g.claims.map((c) => ({ text: c.text, citationNs: c.citationNs, supported: c.supported })), missingInfo: g.missingInfo },
    citations: g.citations.map((c) => ({ n: c.n, chunkId: c.chunkId, documentId: oid(c.documentId), versionNo: c.versionNo, ...(c.pageStart !== null ? { pageStart: c.pageStart } : {}), ...(c.pageEnd !== null ? { pageEnd: c.pageEnd } : {}), ...(c.section ? { section: c.section } : {}), ...(c.quote ? { quote: c.quote } : {}), quoteVerified: c.quoteVerified, wasNeighbor: c.wasNeighbor })),
    evidence: g.evidence, retrieval: stats, usage, model: completion.model, promptVersion: completion.promptVersion,
    ...(g.status === "INSUFFICIENT_EVIDENCE" ? { related: ranked.slice(0, RELATED_PASSAGES).map(passageOf) } : {}),
  });
}

export type { ContextChunk, ResolvedScope };
