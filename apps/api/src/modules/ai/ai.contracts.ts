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
