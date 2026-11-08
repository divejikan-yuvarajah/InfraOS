import { z } from "zod";

/** zod mirrors of apps/ai-service/app/schemas.py. Shared JSON fixtures in apps/ai-service/tests/fixtures are validated by both sides. */
const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const MAX_CHUNKS = 1500;
export const MAX_CHUNK_CHARS = 20_000;

export const serviceError = z.object({ code: z.string().max(60), message: z.string().max(300), retryable: z.boolean(), requestId: z.string().max(100) });

export const extractChunkResponse = z.object({
  fileSha256: sha256,
  pipelineVersion: z.string().min(1).max(20),
  pageCount: z.number().int().nonnegative().nullable(),
  pages: z.array(z.object({ page: z.number().int().positive().nullable(), charCount: z.number().int().nonnegative() })).max(5000),
  chunks: z.array(z.object({
    chunkId: z.string().regex(/^[a-f0-9]{24}:\d+:\d+$/),
    chunkIndex: z.number().int().nonnegative(),
    text: z.string().min(1).max(MAX_CHUNK_CHARS),
    pageStart: z.number().int().positive().nullable(),
    pageEnd: z.number().int().positive().nullable(),
    section: z.string().max(160).nullable(),
    contentHash: sha256,
    charCount: z.number().int().nonnegative(),
    tokenEstimate: z.number().int().nonnegative(),
  })).max(MAX_CHUNKS),
  stats: z.object({
    pages: z.number().int().nonnegative(), chars: z.number().int().nonnegative(), chunks: z.number().int().nonnegative(),
    duplicatesDropped: z.number().int().nonnegative(), truncated: z.boolean(),
    scripts: z.record(z.string(), z.number().int().nonnegative()), dominantScripts: z.array(z.string().max(10)).max(5),
  }),
  warnings: z.array(z.string().max(40)).max(20),
});
export type ExtractChunkResponse = z.infer<typeof extractChunkResponse>;

export const indexRequest = z.object({
  documentId: objectId, versionNo: z.number().int().positive(), projectId: objectId.nullable(), agencyId: objectId, category: z.string().min(1).max(60),
  chunks: z.array(z.object({
    chunkId: z.string(), chunkIndex: z.number().int().nonnegative(), text: z.string().min(1).max(MAX_CHUNK_CHARS),
    pageStart: z.number().int().positive().nullable(), pageEnd: z.number().int().positive().nullable(), section: z.string().max(160).nullable(), contentHash: sha256,
  })).min(1).max(MAX_CHUNKS),
});
export type IndexRequest = z.infer<typeof indexRequest>;

export const indexResponse = z.object({
  embedded: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), tokens: z.number().int().nonnegative(),
  model: z.string().min(1).max(120), dimension: z.number().int().positive(), collection: z.string().min(1).max(200),
});
export type IndexResponse = z.infer<typeof indexResponse>;

export const dropCollectionResponse = z.object({ dropped: z.boolean() });
export const deleteResponse = z.object({ removed: z.number().int().nonnegative() });

export const searchRequest = z.object({
  query: z.string().min(1).max(1000), allowedDocumentIds: z.array(objectId).min(1).max(500), topK: z.number().int().min(1).max(20).optional(),
  filters: z.object({ category: z.string().max(60).optional(), projectId: objectId.optional() }).optional(),
});
export type SearchRequest = z.infer<typeof searchRequest>;

export const searchResponse = z.object({
  hits: z.array(z.object({
    chunkId: z.string(), documentId: objectId, versionNo: z.number().int().positive(), score: z.number(),
    pageStart: z.number().int().positive().nullable(), pageEnd: z.number().int().positive().nullable(),
  })).max(20),
  model: z.string(), dimension: z.number().int().positive(), tokens: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof searchResponse>;

export const readyResponse = z.object({
  status: z.enum(["ready", "degraded"]),
  checks: z.object({ config: z.boolean(), qdrant: z.boolean(), embeddingProviderConfigured: z.boolean() }),
  embeddingModel: z.string().nullable(),
  collectionBase: z.string(),
});
export type ReadyResponse = z.infer<typeof readyResponse>;

export const capabilitiesResponse = z.object({
  pipelineVersion: z.string(), ocr: z.boolean(), unsupported: z.array(z.string()),
  supported: z.array(z.object({ format: z.string(), mimeTypes: z.array(z.string()) })),
  limits: z.object({ maxBodyBytes: z.number(), maxPages: z.number(), maxChars: z.number(), maxChunks: z.number() }),
  embedding: z.object({ model: z.string().nullable(), dimension: z.number().int().positive().nullable() }),
  collectionBase: z.string(),
});
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponse>;

export const reindexPlanResponse = z.object({
  configuredModel: z.string().nullable(), dimension: z.number().int().positive().nullable(), targetCollection: z.string().nullable(),
  collections: z.array(z.object({ name: z.string(), points: z.number().int().nonnegative() })), targetExists: z.boolean(),
});
export type ReindexPlanResponse = z.infer<typeof reindexPlanResponse>;

// ---------------------------------------------------------------- Batch 10: LLM endpoints (mirrors apps/ai-service/app/llm/schemas.py)

export const llmSource = z.object({ n: z.number().int().positive().max(5000), title: z.string().max(200), category: z.string().max(60).optional(), text: z.string().min(1).max(20_000) });
export type LlmSource = z.infer<typeof llmSource>;
const language = z.enum(["en", "si", "ta"]);
const usage = z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() });
const quoteRef = z.object({ n: z.number().int().positive(), quote: z.string().max(600) });
const llmMeta = { usage, model: z.string().max(120), promptVersion: z.string().max(40), structuredMode: z.enum(["json_schema", "json_object"]) };

export const answerRequest = z.object({ language, question: z.string().min(1).max(600), sources: z.array(llmSource).min(1).max(30), maxOutputTokens: z.number().int().min(100).max(4000) });
export type AnswerRequest = z.infer<typeof answerRequest>;
export const modelAnswer = z.object({
  status: z.enum(["ANSWERED", "PARTIAL", "INSUFFICIENT_EVIDENCE"]), answer: z.string().max(6000),
  claims: z.array(z.object({ text: z.string().max(1500), citations: z.array(z.number().int().positive()).max(10) })).max(30),
  citations: z.array(quoteRef).max(40), missing_info: z.array(z.string().max(300)).max(10),
});
export type ModelAnswer = z.infer<typeof modelAnswer>;
export const answerResponse = z.object({ output: modelAnswer, ...llmMeta });
export type AnswerResponse = z.infer<typeof answerResponse>;

const note = z.object({ text: z.string().max(1500), citations: z.array(quoteRef).max(10) });
export type LlmNote = z.infer<typeof note>;
export const mapRequest = z.object({ language, template: z.string().max(40), windowIndex: z.number().int().nonnegative(), windowCount: z.number().int().positive(), sources: z.array(llmSource).min(1).max(40), maxOutputTokens: z.number().int().min(100).max(4000) });
export const mapResponse = z.object({ output: z.object({ notes: z.array(note).max(40) }), ...llmMeta });
export type MapResponse = z.infer<typeof mapResponse>;

const sectionItem = z.object({ text: z.string().max(1500), date: z.string().max(80).nullable().optional(), citations: z.array(quoteRef).max(10) });
export const summarySection = z.object({ key: z.string().max(40), items: z.array(sectionItem).max(40) });
export type SummarySection = z.infer<typeof summarySection>;
export const reduceRequest = z.object({
  language, template: z.string().max(40), mode: z.enum(["notes", "final"]), sectionKeys: z.array(z.string().max(40)).max(20), notes: z.array(note).min(1).max(400), maxOutputTokens: z.number().int().min(100).max(4000), strong: z.boolean().optional(),
});
export const reduceResponse = z.object({ output: z.object({ notes: z.array(note).max(80).optional(), sections: z.array(summarySection).max(20).optional() }), ...llmMeta });
export type ReduceResponse = z.infer<typeof reduceResponse>;

export const extractRequest = z.object({
  language, template: z.string().max(40), fields: z.array(z.object({ key: z.string().max(60), type: z.string().max(20), repeats: z.boolean().optional() })).min(1).max(20),
  sources: z.array(llmSource).min(1).max(40), maxOutputTokens: z.number().int().min(100).max(4000), strong: z.boolean().optional(),
});
export const extractResponse = z.object({
  output: z.object({ fields: z.array(z.object({ key: z.string().max(60), status: z.enum(["FOUND", "NOT_FOUND", "AMBIGUOUS"]), values: z.array(z.object({ rawText: z.string().max(1500), citations: z.array(quoteRef).max(6) })).max(30) })).max(20) }),
  ...llmMeta,
});
export type ExtractResponse = z.infer<typeof extractResponse>;
