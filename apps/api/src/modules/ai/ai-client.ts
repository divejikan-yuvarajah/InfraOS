import { createHash, createHmac, randomUUID } from "node:crypto";
import type { z } from "zod";

import { AI_ERROR_CODES, type AiErrorCode } from "@infraos/shared-types";
import { logger } from "../../shared/logger.js";
import { aiConfig, type AiConfig } from "./ai.config.js";
import {
  capabilitiesResponse, deleteResponse, extractChunkResponse, indexRequest, indexResponse, readyResponse, reindexPlanResponse, searchRequest, searchResponse, serviceError,
  type CapabilitiesResponse, type ExtractChunkResponse, type IndexRequest, type IndexResponse, type ReadyResponse, type ReindexPlanResponse, type SearchRequest, type SearchResponse,
} from "./ai.contracts.js";

/** Express -> FastAPI client. Signed per request, bounded by timeouts, guarded by a circuit breaker, zod-validated. Never logs bodies, text or secrets. */
export class AiClientError extends Error {
  constructor(readonly code: AiErrorCode, readonly retryable: boolean, readonly circuitOpen = false) {
    super(code);
  }
}

const KNOWN = new Set<string>(AI_ERROR_CODES);
/** Service codes that are not in the shared enum but have a clear equivalent. */
const ALIAS: Record<string, AiErrorCode> = { PAYLOAD_TOO_LARGE: "TOO_LARGE", HASH_MISMATCH: "CORRUPT_FILE" };
const TRANSIENT_STATUS = (s: number) => s >= 500 || s === 408 || s === 429;

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  constructor(private readonly threshold = 5, private readonly openMs = 60_000, private readonly now: () => number = Date.now) {}
  get isOpen(): boolean { return this.now() < this.openUntil; }
  get state(): "closed" | "open" { return this.isOpen ? "open" : "closed"; }
  success(): void { this.failures = 0; this.openUntil = 0; }
  failure(): void { this.failures += 1; if (this.failures >= this.threshold) this.openUntil = this.now() + this.openMs; }
}

export function signRequest(secret: string, method: string, path: string, timestamp: string, bodyHash: string): string {
  return createHmac("sha256", secret).update(`${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`).digest("hex");
}
const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

export type AiClientDeps = { config?: AiConfig; fetchImpl?: typeof fetch; breaker?: CircuitBreaker; sleep?: (ms: number) => Promise<void>; now?: () => number };

export function createAiClient(deps: AiClientDeps = {}) {
  const cfg = deps.config ?? aiConfig;
  const doFetch = deps.fetchImpl ?? fetch;
  const breaker = deps.breaker ?? new CircuitBreaker();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function call<T>(method: "GET" | "POST", path: string, opts: { body?: string; form?: FormData; bodyHash: string; timeoutMs: number; schema: z.ZodType<T>; requestId?: string; authenticated?: boolean }): Promise<T> {
    if (!cfg.baseUrl || !cfg.secret) throw new AiClientError("AI_SERVICE_UNAVAILABLE", true);
    if (breaker.isOpen) throw new AiClientError("AI_SERVICE_UNAVAILABLE", true, true);
    const rid = opts.requestId ?? randomUUID();
    const headers: Record<string, string> = { "X-Infraos-Request-Id": rid };
    if (opts.authenticated !== false) {
      const ts = String(Date.now());
      headers["X-Infraos-Timestamp"] = ts;
      headers["X-Infraos-Signature"] = signRequest(cfg.secret, method, path, ts, opts.bodyHash);
    }
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${cfg.baseUrl}${path}`, { method, headers, body: opts.form ?? opts.body, signal: controller.signal, redirect: "error" });
    } catch (error) {
      breaker.failure();
      const aborted = error instanceof Error && error.name === "AbortError";
      logger.warn({ path, requestId: rid, timeout: aborted }, "ai service unreachable");
      throw new AiClientError(aborted ? "AI_SERVICE_TIMEOUT" : "AI_SERVICE_UNAVAILABLE", true);
    } finally {
      clearTimeout(timer);
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const parsed = serviceError.safeParse(json);
      const transient = TRANSIENT_STATUS(res.status) || res.status === 401 || res.status === 403;
      if (transient) breaker.failure(); else breaker.success();
      let code: AiErrorCode = "AI_SERVICE_UNAVAILABLE";
      let retryable = true;
      const svc = parsed.success ? (ALIAS[parsed.data.code] ?? parsed.data.code) : null;
      if (parsed.success && svc && KNOWN.has(svc)) { code = svc as AiErrorCode; retryable = parsed.data.retryable; }
      else if (!transient) { code = "INTERNAL_ERROR"; retryable = false; }
      logger.warn({ path, requestId: rid, status: res.status, code }, "ai service error");
      throw new AiClientError(code, retryable);
    }
    breaker.success();
    const ok = opts.schema.safeParse(json);
    if (!ok.success) {
      logger.error({ path, requestId: rid }, "ai service response failed contract validation");
      throw new AiClientError("AI_SERVICE_UNAVAILABLE", true);
    }
    return ok.data;
  }

  const jsonPost = <T>(path: string, payload: unknown, timeoutMs: number, schema: z.ZodType<T>) => {
    const body = JSON.stringify(payload);
    return call("POST", path, { body, bodyHash: sha256(body), timeoutMs, schema });
  };

  return {
    breaker,
    get configured(): boolean { return cfg.configured; },

    /** Unauthenticated liveness; also used to wake a sleeping free-tier instance. Does not touch the circuit breaker's open check. */
    async health(): Promise<boolean> {
      if (!cfg.baseUrl) return false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), cfg.timeoutsMs.health);
        try {
          const r = await doFetch(`${cfg.baseUrl}/health`, { method: "GET", signal: ctrl.signal, redirect: "error" });
          return r.ok;
        } finally { clearTimeout(timer); }
      } catch { return false; }
    },

    /** Cold-start tolerant: polls /health with backoff up to `maxWaitMs` (Render free tier takes 30-60 s). */
    async wake(maxWaitMs = 70_000): Promise<void> {
      const start = Date.now();
      let delay = 1000;
      for (;;) {
        if (await this.health()) return;
        if (Date.now() - start + delay > maxWaitMs) throw new AiClientError("AI_SERVICE_UNAVAILABLE", true);
        await sleep(delay);
        delay = Math.min(delay * 2, 8000);
      }
    },

    ready: (): Promise<ReadyResponse> => call("GET", "/ready", { bodyHash: sha256(""), timeoutMs: cfg.timeoutsMs.health, schema: readyResponse }),
    capabilities: (): Promise<CapabilitiesResponse> => call("GET", "/v1/capabilities", { bodyHash: sha256(""), timeoutMs: cfg.timeoutsMs.health, schema: capabilitiesResponse }),
    reindexPlan: (): Promise<ReindexPlanResponse> => jsonPost("/v1/admin/reindex-plan", {},cfg.timeoutsMs.search, reindexPlanResponse),

    /** Multipart: the signature covers the JSON metadata part, which declares the file sha256 (the service re-hashes the file). */
    extractChunk(input: { documentId: string; versionNo: number; mimeType: string; bytes: Uint8Array; language?: string }): Promise<ExtractChunkResponse> {
      const fileSha256 = sha256(input.bytes);
      const metadata = JSON.stringify({ documentId: input.documentId, versionNo: input.versionNo, mimeType: input.mimeType, fileSha256, ...(input.language ? { language: input.language } : {}) });
      const form = new FormData();
      form.append("metadata", metadata);
      form.append("file", new Blob([new Uint8Array(input.bytes)],{ type: input.mimeType }), "document");
      return call("POST", "/v1/extract-chunk", { form, bodyHash: sha256(metadata), timeoutMs: cfg.timeoutsMs.extract, schema: extractChunkResponse });
    },

    index: (req: IndexRequest): Promise<IndexResponse> => jsonPost("/v1/index", indexRequest.parse(req), cfg.timeoutsMs.index, indexResponse),
    deleteDocument: (documentId: string, keepVersionNo?: number) => jsonPost("/v1/delete", { documentId, ...(keepVersionNo ? { keepVersionNo } : {}) }, cfg.timeoutsMs.delete, deleteResponse),
    search: (req: SearchRequest): Promise<SearchResponse> => jsonPost("/v1/search", searchRequest.parse(req), cfg.timeoutsMs.search, searchResponse),
  };
}

export type AiClient = ReturnType<typeof createAiClient>;
let shared: AiClient | undefined;
/** Process-wide client (one breaker). Tests build their own with `createAiClient`. */
export const aiClient = (): AiClient => (shared ??= createAiClient());
export const resetAiClientForTests = (): void => { shared = undefined; };
