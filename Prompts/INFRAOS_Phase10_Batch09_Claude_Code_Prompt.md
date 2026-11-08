# INFRAOS — PHASE 10 · BATCH 09 (STEPS 111–114)
## FastAPI AI Service · Document Text Extraction · Chunking · Embeddings · Vector Store (Qdrant)
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Express/Mongoose/Next.js), a Python/FastAPI engineer and an information-retrieval engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 09 of Phase 10 — Steps 111–114**:

| Step | Deliverable |
|---|---|
| 111 | **FastAPI AI service** (`apps/ai-service`): secure service-to-service API, health/readiness, config, structured errors, safe logging, Render deployment files |
| 112 | **Document text extraction** (PDF, DOCX, TXT/CSV) with page metadata, quality and failure classification, reprocessing |
| 113 | **Chunking & embeddings**: clause/section-aware chunks with page references, cost-conscious batch embeddings through a provider adapter, usage tracking |
| 114 | **Vector store (Qdrant)** + processing pipeline orchestration (Express job queue), status UI, reprocess/reindex, deletion sync |

Pipeline delivered end-to-end: **Secure Upload (Batch 08) → Document record → Job → Extraction → Cleaning → Chunking → Embeddings → Qdrant indexing → "AI-ready" document**, with honest status at every stage in the DocTrace UI.

**Out of scope (Batch 10+):** question answering, summarisation, structured extraction, LLM chat, citations UI, risk, vision, Copilot. This batch builds **no LLM generation** — only embeddings and a minimal retrieval *diagnostic* to prove the index works. Do not build OCR (scanned PDFs are detected and reported honestly, §4.4).

Deadline-driven university project: **a reliable, secure, cheap pipeline with a polished status UI beats breadth.** Every button, filter, status chip and dialog must really work. Never fabricate processing results, embeddings, model capabilities or "AI-ready" states.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, helpers or provider capabilities. §2 is recon at the time of writing — re-verify.
2. **Locked architecture (repo ADRs) — follow, don't relitigate:** ADR-008 (FastAPI for compute only, Express is the only browser-facing API and the authority for ACL/records), ADR-011 (**Qdrant is the single vector DB; do NOT use Atlas Vector Search**, no second vector store), `docs/architecture/ai-decisions.md` (provider adapter, OpenRouter default, model ids in env, Express passes allowed document ids, FastAPI never writes official records), ADR-012 (Render for Express + FastAPI). If you believe a decision is wrong, **stop and ask me**; don't silently deviate.
3. **FastAPI is stateless compute.** It does not authenticate end users, decide roles, read MongoDB, read the document store, or write project/finance/inspection/document records. Express reads bytes through `openDocumentStream` (Batch 08 seam) and sends them to FastAPI; Express persists chunks/status. FastAPI's only datastore is Qdrant.
4. **Authorization stays in Express.** Vector search must always be filtered by an **allow-list of document ids supplied by Express**; FastAPI refuses a search without one. Never trust client-supplied ids/filters.
5. **No browser access to FastAPI** — ever. The browser never receives `AI_*`, `OPENROUTER_*`, `QDRANT_*` values or the FastAPI URL.
6. **No chunk text, document text, file names, secrets or full prompts in logs, audit snapshots, error messages or URLs.** Log ids, counts, durations and error codes only.
7. **Sensitive documents are never processed** unless `aiProcessingAllowed` is true (Batch 08 fields). Archived/deleted/restricted documents are **purged from the index**.
8. **Never fabricate:** no fake embeddings in production paths, no synthetic "AI-ready", no pretend OCR. A deterministic fake embedder may exist **only** for automated tests/offline CI behind `APP_ENV=test` and must be unreachable in other environments.
9. **Cost-conscious:** one embedding model, batching, per-job and daily token budgets, no re-embedding of unchanged work where cheap, no premium models by default.
10. **No heavy tests, no extra Markdown reports** (update the existing `apps/ai-service/README.md` and `docs/setup/environment.md` briefly; ≤ 12 lines appended elsewhere is fine). Dependencies: only those listed in §4.1 — justify any other.
11. **Never touch `main` or `development` directly; never force-push.** See §11.
12. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
13. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with allowlisted snapshots (action regex `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`), `strict:"throw"` schemas, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (re-verify against the code)

**Repo:** npm workspaces `apps/web` (Next 16/React 19/Tailwind 4), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`; **`apps/ai-service` currently contains only `README.md` + `.env.example` (documentation-only; not an npm workspace).** CI (`.github/workflows/quality.yml`) runs Node checks only and **refuses any injected DB URI**.

**Already declared in `apps/api/src/config/env.ts` (optional, parsed):** `AI_BASE_URL` (alias `AI_SERVICE_URL`), `AI_INTERNAL_SECRET` (alias `AI_SERVICE_SECRET`), `OPENROUTER_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`. `apps/ai-service/.env.example` names: `AI_INTERNAL_SECRET, LLM_PROVIDER, OPENROUTER_API_KEY, EMBEDDING_MODEL, QDRANT_URL, QDRANT_API_KEY`. `ai-decisions.md` names `AI_CHAT_MODEL`, `AI_EMBED_MODEL` — **reconcile the names (prefer `AI_EMBED_MODEL`; keep one canonical name and update the catalog in `docs/setup/environment.md`).**
**Docs to read:** `docs/adr/ADR-008-fastapi-ai-service.md`, `ADR-011-rag-vector-store.md`, `ADR-012-deployment-strategy.md`, `docs/architecture/ai-decisions.md`, `deployment-decisions.md`, `file-document-architecture.md`, `docs/setup/environment.md`.

**Models (extended by Batch 08 — verify on your base):** `Document` (+ `docNo`, `agencyId`, `status` DRAFT|ACTIVE|SUPERSEDED|ARCHIVED, `currentVersionNo`, `contentHash`, `confidentiality`, `aiProcessingAllowed`, `aiEligibleType`, `extractedTextStatus` NOT_STARTED|QUEUED|PROCESSING|COMPLETED|FAILED|UNSUPPORTED, `pageCount?`, `language?`, `origin`), `documentVersions`, `DocumentChunk` (`documentChunks`: `documentId, projectId, chunkIndex, content (select:false, ≤ 20 000), embeddingReference`, **unique `{documentId,chunkIndex}`** — must change, §4.2), Batch 08 `document-events.ts` (in-process emitter after commit: `document.version_ready|archived|restored|deleted|restricted`, **no subscribers yet**), `openDocumentStream(documentId, versionNo, {internal:true})`, `documentReadFilter`/`documentAccess`.
**Permissions:** `document.process` and `document.ask` exist (process: SUPER_ADMIN, GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER — **print & confirm**). No AI-admin permission exists.
**Deployment (locked):** Express + FastAPI on Render; Qdrant Cloud (hosted) / Docker (local); Vercel only for web. Render free tiers **sleep and cold-start (30–60 s)** and lose in-memory background tasks → durable job state must live in MongoDB, and the Express caller must tolerate cold starts.
**Python:** target 3.12 (`requires-python >=3.12`); verify the local interpreter.

> **BATCH 08 FINAL REPORT / HANDOFF NOTES (authoritative if present — else derive from the code):**
> `[PASTE BATCH 08 REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; branch + `git log --oneline -5`.
2. **Required on `origin/development`:** Batch 08 (`document-events.ts`, `openDocumentStream`, `documentVersions`, extended `Document`, `aiProcessingAllowed`). **If missing → STOP and ask me**: (A) I merge Batch 08 first; (B) stack on the unmerged Batch 08 branch (`feature/doctrace-management`); (C) stop. Don't guess.
3. `npm install`; Node ≥ 22; baseline `npm run type-check` + documents/identity tests; list pre-existing failures (don't fix). Verify `python3 --version` (≥ 3.12; if older, ask me before proceeding) and `pip` availability; create a venv **inside `apps/ai-service/.venv`** (gitignored).
4. Print the role → `document.*` matrix; confirm who holds `document.process`.
5. **Credentials & capability gate (do not skip):** check whether `OPENROUTER_API_KEY`, `QDRANT_URL`/`QDRANT_API_KEY` (or a local Qdrant via Docker) and `AI_INTERNAL_SECRET` are available in the environment **without printing them**. Then, if a key exists, run a **live capability check** (§4.5) of the embeddings endpoint with the configured model. **If the key/Qdrant is missing or the embeddings endpoint is unavailable → STOP at that point and ask me**: (A) I supply credentials/model; (B) switch the embedding adapter to another OpenAI-compatible gateway or Gemini (name it); (C) build everything with the test-only fake embedder and mark live verification **Unresolved** (clearly, in the report). Never proceed as if live embedding worked.
6. Check the permission-propagation path used in earlier batches before adding `ai.manage` (§4.9).
7. Read the ADRs/docs listed in §2 and note anything in them this prompt contradicts (report it; follow the ADR).

---

## 4. DESIGN AND IMPLEMENTATION

### 4.1 FastAPI service (Step 111) — `apps/ai-service`
**Layout:** `pyproject.toml` (deps pinned with compatible ranges), `app/main.py`, `app/config.py` (pydantic-settings; fail-fast validation of required env), `app/security.py`, `app/errors.py`, `app/logging.py`, `app/schemas.py` (pydantic v2), `app/routers/{health,capabilities,extract,index,search,admin}.py`, `app/extraction/{detect,pdf,docx,text}.py`, `app/chunking/{cleaner,sections,chunker}.py`, `app/embeddings/{base,openai_compatible}.py` (provider adapter; OpenRouter = OpenAI-compatible HTTP), `app/vectorstore/qdrant_store.py`, `tests/` (small pytest suite), `Dockerfile`, `render.yaml` (Render blueprint for this service, or the repo-conventional equivalent), updated `README.md` and `.env.example`.
**Dependencies (only these):** `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `httpx`, `pypdf`, `python-docx`, `qdrant-client`; dev: `pytest`, `pytest-asyncio` (or sync tests). No LangChain/LlamaIndex, no PyTorch, no OCR libs, no Celery/Redis.
**Service auth (Express → FastAPI only):** every `/v1/*` and `/ready` request must carry `X-Infraos-Timestamp`, `X-Infraos-Request-Id` and `X-Infraos-Signature` = HMAC-SHA256(`AI_INTERNAL_SECRET`, `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`); reject if timestamp skew > 60 s, bad signature (constant-time compare) or missing headers (401, generic body). For multipart uploads the signature covers the **JSON metadata part hash + file sha256** declared in the metadata (service re-hashes the file and rejects on mismatch). Reject requests carrying a browser `Origin` header; **no CORS middleware**; disable `/docs`, `/redoc`, `/openapi.json` unless `APP_ENV=development`. `GET /health` is unauthenticated and returns only `{status:"ok"}` (for Render). `/ready` (authenticated) verifies config, Qdrant reachability and embedding-provider configuration and returns booleans/names (no secrets).
**Errors:** one error shape `{ code, message, retryable, requestId }`; codes from §4.4; never echo input content; 4xx for caller errors, 5xx only for real server faults; global exception handler hides stack traces.
**Limits & timeouts:** max request body 30 MB, extraction CPU work runs off the event loop (`run_in_threadpool`) with a hard per-call timeout (default 90 s), embedding provider timeout 30 s with bounded retries, Qdrant timeout 15 s. Concurrency limit (semaphore, default 2 concurrent extractions) to protect free-tier RAM (512 MB).
**Endpoints:**
| Method + path | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /ready` | readiness (signed) |
| `GET /v1/capabilities` | supported formats/MIME, limits, `pipelineVersion`, chunking params, embedding model + dimension (from the live adapter), collection name, OCR: `false` |
| `POST /v1/extract-chunk` | multipart (file + JSON metadata `{documentId, versionNo, mimeType, fileSha256, language?}`) → `{ pages[], chunks[], stats, warnings[] }` — **no embedding, no storage** |
| `POST /v1/index` | JSON `{documentId, versionNo, projectId, agencyId, category, chunks:[{chunkId, chunkIndex, text, pageStart, pageEnd, section?, contentHash}]}` → embeds in batches and upserts to Qdrant; swaps old-version points after success; returns `{embedded, skipped, tokens, model, dimension, collection}` |
| `POST /v1/delete` | `{documentId, keepVersionNo?}` → removes points by payload filter (idempotent) |
| `POST /v1/search` | `{query, allowedDocumentIds[1..500], topK≤20, filters?}` → hits `{chunkId, documentId, versionNo, score, pageStart, pageEnd}` (**no chunk text returned**; Express hydrates from MongoDB after re-checking ACL). Rejects missing/empty allow-list. Used for the diagnostic here and by Batch 10. |
| `POST /v1/admin/reindex-plan` | optional: returns collection/model status for the reindex UI (no data changes) |
Request/response contracts are validated by pydantic **and** mirrored as zod schemas in Express (§4.7); keep one JSON fixture per endpoint that both sides' tests validate.

### 4.2 Data model (Express/Mongo) — extend, don't duplicate
- **`documentChunks` (extend, `strict:"throw"`):** add `versionNo` (int), `agencyId`, `chunkId` (`{documentId}:{versionNo}:{chunkIndex}`, unique), `pageStart`, `pageEnd`, `section?` (≤ 160), `charCount`, `tokenEstimate`, `contentHash` (sha256 of normalised text), `status` ∈ `STAGED | ACTIVE | STALE` (STAGED while indexing, ACTIVE after success, STALE for superseded), `embeddingModel?`, `embeddingDimension?`, `embeddingReference` (= Qdrant point id, uuid), `indexedAt?`. **Replace** the old unique index `{documentId,chunkIndex}` with `{documentId:1,versionNo:1,chunkIndex:1}` unique + `{agencyId:1,documentId:1,status:1}` + `{documentId:1,status:1}` + `{chunkId:1}` unique. Provide `scripts/migrate-document-chunks-batch09.ts` (dry-run default, `--commit`) that drops the legacy index safely and backfills fields for any existing rows (likely none); add to `check-indexes.ts`; `npm run db:indexes:check`. `content` stays `select:false`; **never** serialized by any list/detail API except the explicit chunk-preview route (§4.8).
- **`documentProcessingJobs` (new):** `documentId`, `versionNo`, `agencyId`, `projectId?`, `trigger` ∈ `UPLOAD | REPLACE | REPROCESS | REINDEX | RECONCILE | RESTORE`, `status` ∈ `QUEUED | RUNNING | SUCCEEDED | FAILED | DEFERRED | CANCELLED | SKIPPED`, `stage` ∈ `PENDING | EXTRACT | CHUNK | EMBED | INDEX | DONE` (+ per-stage `stages[{key,status,startedAt,finishedAt,errorCode?}]`), `attempt`, `maxAttempts` (3), `nextAttemptAt`, `lockedBy?`, `leaseUntil?`, `errorCode?`, `errorMessageKey?` (translatable key, **no free text from the service**), `warnings[]` (codes), `stats` `{pages, chars, chunks, duplicatesDropped, embedded, tokens, truncated}`, `pipelineVersion`, `embeddingModel`, `requestedBy?`, `startedAt?`, `finishedAt?`, `version` (OCC). Indexes: unique partial `{documentId:1,versionNo:1}` where `status ∈ {QUEUED,RUNNING,DEFERRED}` (one active job per document version), `{status:1,nextAttemptAt:1}`, `{agencyId:1,createdAt:-1}`, `{documentId:1,createdAt:-1}`. Retention: keep the last 20 jobs per document (prune on completion).
- **`aiUsageRecords` (new, reused by Batch 12):** `kind` ∈ `EMBEDDING` (later `CHAT`, `VISION`), `agencyId`, `userId?`, `documentId?`, `jobId?`, `provider`, `model`, `inputTokens`, `outputTokens` (0 for embeddings), `estimatedCostMinor?` (integer, **only when a verified price constant is configured; otherwise unset — never invented**), `requestCount`, `status` ∈ `OK | ERROR | RATE_LIMITED`, `createdAt`; TTL none; indexes `{agencyId:1,createdAt:-1}`, `{kind:1,createdAt:-1}`. Daily token budget check reads from this collection (Asia/Colombo day).
- **`Document` additions (additive):** `aiIndex` subdocument `{ indexedVersionNo?, chunkCount?, pageCount?, embeddingModel?, embeddingDimension?, pipelineVersion?, indexedAt?, lastJobId?, errorCode?, warnings[] , truncated? }` and `extractedTextStatus` semantics: **`COMPLETED` = fully indexed (extract + chunk + embed + index succeeded for the current version)**; `PROCESSING/QUEUED` = job active; `FAILED` = last job failed permanently; `UNSUPPORTED` = type/scanned/empty not processable; `NOT_STARTED` = never processed or excluded/purged. Keep `pageCount` in sync from extraction. Add to `check-indexes`.
- **Audit:** user-initiated + terminal outcomes only (not per-stage): `ai.document_processing_queued|completed|failed|cancelled`, `ai.document_reprocess_requested`, `ai.document_index_purged`, `ai.reindex_started`, `ai.retrieval_diagnostic_run`. Resource `DOCUMENT` (or `SYSTEM` for global). Snapshot keys from the allowlist only (`status`, `reason`, `agencyId`); codes/stats live on the job, not in audit; add nothing to the allowlist unless unavoidable.

### 4.3 Eligibility and orchestration (Express, Step 114) — `apps/api/src/modules/ai/`
**Pure `isEligibleForAi(document, version)`** (unit-tested): requires `status === ACTIVE`, `aiProcessingAllowed`, `aiEligibleType` (PDF/DOCX/TXT/CSV — images and XLSX are **not** eligible), `confidentiality !== SENSITIVE` unless explicitly allowed by GOV_ADMIN (Batch 08), file bytes available, `origin === DOCTRACE`. Returns `{eligible, reasonCode}` used by UI chips (`NOT_ELIGIBLE_TYPE`, `EXCLUDED`, `SENSITIVE`, `ARCHIVED`, `DRAFT`, `NO_FILE`).
**Batch 08 event subscribers (`document-events` → `ai-processing.subscriber.ts`, registered at app start):**
- `version_ready` → enqueue job (trigger UPLOAD/REPLACE) if eligible and `AI_PROCESSING_ENABLED` is true (default true when `AI_BASE_URL` is set); set `extractedTextStatus = QUEUED`; **uploader can opt out** (wizard toggle → `aiProcessingAllowed` false is a Batch 08 control; plus a per-upload "process for AI" flag if Batch 08 exposed one — otherwise automatic).
- `archived` / `restricted(aiProcessingAllowed=false or SENSITIVE)` / `deleted` → cancel active job, **purge** (FastAPI `/v1/delete` + mark chunks STALE/delete, reset `aiIndex`, `extractedTextStatus = NOT_STARTED`); purge failures are retried by the reconciler, never ignored.
- `restored` → re-enqueue (trigger RESTORE).
**Job runner (in the Express process; Render keeps it alive):** `job-runner.ts` started from the server bootstrap (not in serverless/test unless explicitly invoked): every 5 s claims up to `AI_JOB_CONCURRENCY` (default 1–2) jobs with an **atomic `findOneAndUpdate` lease** (`leaseUntil`, `lockedBy`), heartbeats while running, and requeues expired leases (crash safety). Graceful shutdown stops claiming and releases leases.
**Stage execution (idempotent, resumable, bounded):**
1. **Wake/health:** `GET /health` with retry (cold start up to ~60 s, backoff) before the first call of a job; failure → transient `AI_SERVICE_UNAVAILABLE`.
2. **EXTRACT+CHUNK:** read bytes with `openDocumentStream`, compute sha256, POST `/v1/extract-chunk`; validate response with zod; reject if `fileSha256` mismatch or counts exceed caps.
3. **Persist chunks:** in a transaction replace any STAGED chunks for `(documentId, versionNo)` with the new set (`status:"STAGED"`), update job stats.
4. **EMBED+INDEX:** POST `/v1/index` (service batches embeddings and upserts; point id = deterministic UUIDv5 of `chunkId`; payload `{documentId, versionNo, projectId, agencyId, chunkId, chunkIndex, pageStart, pageEnd, category}` — **no text**); on success, in one transaction: mark the new chunks ACTIVE with `embeddingReference/model/dimension/indexedAt`, mark previous-version chunks STALE then delete them, set `Document.aiIndex`, `pageCount`, `extractedTextStatus = COMPLETED`, finish the job, write usage rows, audit, notice (only on failure).
5. **Version-supersede guard:** before each stage, re-check the document is still eligible and `currentVersionNo === job.versionNo`; if not → `SKIPPED` and purge staged data.
**Failure handling:** classify errors as **permanent** (`UNSUPPORTED_FORMAT`, `ENCRYPTED_PDF`, `SCANNED_NO_TEXT`, `EMPTY_TEXT`, `CORRUPT_FILE`, `TOO_LARGE`, `DIMENSION_MISMATCH`) → `FAILED`/`UNSUPPORTED` immediately (`extractedTextStatus` FAILED or UNSUPPORTED, original file untouched, user-visible reason), or **transient** (`AI_SERVICE_UNAVAILABLE`, `AI_SERVICE_TIMEOUT`, `EMBEDDING_PROVIDER_ERROR`, `EMBEDDING_RATE_LIMITED`, `VECTOR_STORE_ERROR`) → retry with backoff (default 30 s, 2 min, 10 min; max 3 attempts) then `FAILED`. **Budget exceeded** → `DEFERRED` until the next day (not failed). A **circuit breaker** in `ai-client.ts` (5 consecutive transient failures → open 60 s) prevents hammering a down service; jobs stay QUEUED with `nextAttemptAt`. If FastAPI is down, DocTrace and every other module keep working (show "AI processing unavailable", never an error page).
**Reconciliation sweep** (every 10 min + on startup, bounded to 200 docs): enqueues jobs for eligible documents whose current version isn't indexed and has no active job (covers lost in-process events after a crash), and retries unfinished purges. This is the self-healing path — log counts only.
**Manual controls:** `POST /api/v1/documents/:id/ai/reprocess` (`document.process`, scope-checked; creates a REPROCESS job unless one is active → 409 with the active job; rate-limited), `POST /api/v1/documents/:id/ai/cancel`, bulk `POST /api/v1/ai/processing/reprocess` (ids ≤ 50 or `status=FAILED` filter; per-item result list), and **`POST /api/v1/ai/processing/reindex`** (`ai.manage`, GOV_ADMIN/SUPER_ADMIN; required when the embedding model/dimension changes: creates a new collection name via the model slug+dimension, enqueues REINDEX jobs for all currently indexed docs in batches, old collection removed only after ≥ 95 % succeed and an explicit second confirm call — document the rollback: old collection stays untouched until then).

### 4.4 Extraction (Step 112) — FastAPI `extraction/`
**Format detection:** by magic bytes + declared MIME (never extension alone). Supported: **PDF** (`pypdf`), **DOCX** (`python-docx`, body paragraphs + headings + **tables rendered as `col | col | col` rows**, headers/footers excluded), **TXT/CSV** (UTF-8, fallback `utf-8-sig`/`cp1252` with warning `ENCODING_GUESSED`; CSV rows rendered as lines). Everything else → `UNSUPPORTED_FORMAT` (XLSX/images are explicitly unsupported, reported in `/v1/capabilities`).
**PDF specifics:** per-page text with page numbers (1-based) preserved; password-protected → `ENCRYPTED_PDF`; page cap (default 300) → process the first N pages and set `truncated:true` + warning `TRUNCATED_PAGES` (surfaced in the UI as "Only the first N pages are searchable"); a PDF where < 5 % of pages yield ≥ 20 characters of text → **`SCANNED_NO_TEXT`** (no OCR; message says the document appears scanned and OCR is not available); mixed → warning `PARTIAL_TEXT` listing page counts (not content).
**Quality heuristics (warnings, never silent):** `LOW_TEXT_QUALITY` when the ratio of replacement/control characters or isolated single-letter tokens is high (common with legacy-font Sinhala/Tamil PDFs); `LANGUAGE_DETECTED` via script-range counting only (Sinhala U+0D80–0DFF, Tamil U+0B80–0BFF, Latin) — **no language-ID dependency**; store dominant scripts in stats.
**Safety:** page/size/char caps (max 3 M characters), decompression guards for DOCX (entry count/ratio), no external resource fetching, no macro execution, no temp files on disk (in-memory only), per-call timeout, no stack traces to callers. Empty text → `EMPTY_TEXT`.
**Traceability:** extraction returns `pages: [{page, charCount}]` (no text in logs); chunk page ranges map back to original pages; DOCX has no pages → `pageStart/pageEnd = null` and `section` references only (never fake page numbers).

### 4.5 Chunking (Step 113a) and embeddings (Step 113b)
**Cleaning:** Unicode NFC, strip control chars/zero-width except ZWJ/ZWNJ (**required for Sinhala/Tamil shaping — don't strip them**), de-hyphenate line-break words (Latin only), collapse whitespace but keep paragraph breaks, drop headers/footers = lines repeating on > 50 % of pages (with ≥ 4 pages) and bare page numbers.
**Section detection (`sections.py`):** regex-based, conservative: numbered clauses (`1.`, `1.1`, `(a)` lead-ins), `ARTICLE|CLAUSE|SECTION|SCHEDULE|ANNEX(URE)|APPENDIX|CONDITIONS|SPECIAL PROVISIONS` headings, ALL-CAPS short lines, markdown-like `#` lines for TXT. Output a section title per chunk when confident, else none.
**Chunker (`chunker.py`):** respects section boundaries first, then paragraph/sentence boundaries; **target ≈ 1 200 characters, hard max ≈ 1 800, min ≈ 200 (merge small tails), overlap ≈ 150 characters** (sentence-aligned where possible). Rationale (put in a short code docstring): contracts and inspection reports keep obligations/clauses and dates together, ~300-token chunks embed well and keep citations precise; character-based sizing is used because Sinhala/Tamil tokenise poorly and no tokenizer dependency is wanted (`tokenEstimate = chars/4` Latin, `chars/2` Sinhala/Tamil, labelled an estimate). Each chunk: `chunkIndex`, stable `chunkId`, `text`, `pageStart/pageEnd`, `section`, `contentHash` (sha256 of normalised text), `charCount`, `tokenEstimate`. **Exact-duplicate chunks within a document are dropped** (count in `duplicatesDropped`); caps: ≤ 1 500 chunks per document (excess → `truncated`). Deterministic: same input + same `pipelineVersion` ⇒ identical chunk ids/hashes (test this).
**`PIPELINE_VERSION`** constant (e.g. `p1`) covers extraction+chunking logic; stored on jobs/documents; bumping it makes the reconciler offer "Reprocess outdated" in the processing center (manual action, not automatic mass processing).
**Embeddings adapter (`embeddings/base.py` + `openai_compatible.py`):** interface `embed(texts[]) → {vectors, model, dimension, tokens}`; OpenAI-compatible `/embeddings` HTTP via `httpx` using `EMBED_BASE_URL` (default OpenRouter's base) + `OPENROUTER_API_KEY`/`EMBED_API_KEY`; **model id only from env `AI_EMBED_MODEL`** — do **not** hard-code a model or price from memory. **Capability verification (preflight §3.5 and `npm run ai:smoke`):** with the real key, (1) confirm the embeddings endpoint answers for the configured model, (2) read the returned `dimension`, (3) check the provider's current catalog/pricing for the chosen model and record the verified per-million-token price in env (`AI_EMBED_PRICE_PER_M_TOKENS_MINOR`) **only if verified**, (4) run a tiny **multilingual sanity check** (an English sentence, its Sinhala and Tamil equivalents, and an unrelated sentence: similarity of the translations must exceed the unrelated pair; report numbers honestly — if it fails, report that the model is weak for si/ta rather than hiding it). Recommend a **low-cost multilingual embedding model** after this verification, plus one optional higher-quality alternative; list verified alternatives in the report. Provider-side: batch size ≤ 64 inputs and ≤ ~8 000 tokens per request (derive from the model), retry 429/5xx with exponential backoff + jitter (max 3), distinguish rate limiting (`EMBEDDING_RATE_LIMITED`) from hard errors, per-job token cap (`AI_EMBED_MAX_TOKENS_PER_DOC`, default sized for a 300-page document) → over cap = permanent `TOO_LARGE` with clear message, **daily budget** (`AI_EMBED_DAILY_TOKEN_BUDGET`, Asia/Colombo day, enforced in Express before starting a job; usage rows from `/v1/index` results). **Privacy:** only chunk text of eligible, non-sensitive documents is sent; note provider data-retention terms must be reviewed (report it); no document text ever stored by FastAPI.
**Dimension & versioning:** the dimension is read from the first live response (not assumed); the Qdrant collection name encodes model slug + dimension; mismatch with an existing collection → `DIMENSION_MISMATCH` (permanent, tells the admin to run reindex). Track `embeddingModel`/`embeddingDimension`/`pipelineVersion` on chunks, documents and jobs.

### 4.6 Qdrant (Step 114a) — `vectorstore/qdrant_store.py`
- Collection `{QDRANT_COLLECTION|infraos_chunks}__{modelSlug}__{dim}`, cosine distance; create-if-missing at startup/`/ready`; **payload indexes** on `documentId` (keyword), `projectId`, `agencyId`, `category` (keyword), `versionNo` (integer).
- **Upsert** in batches (≤ 100 points), deterministic UUIDv5 ids (idempotent retries); **swap**: after the new version is fully upserted, delete points with `documentId == X && versionNo != new` (so search never sees a half-indexed document and never sees stale versions; a failed swap leaves both until the next run — acceptable, the version-guard in search results filters to the document's `indexedVersionNo` in Express).
- **Delete** by payload filter (document purge); **search** with a `must` filter `documentId ∈ allowedDocumentIds` (+ optional category/project filters), `with_payload` minimal, score threshold optional; cap `topK`.
- Local dev: document `docker run -p 6333:6333 qdrant/qdrant` (README) — no new compose service required.
- Hosted: Qdrant Cloud URL + API key via env; TLS only; the Express API **never** holds an admin Qdrant key and never talks to Qdrant.

### 4.7 Express integration (`apps/api/src/modules/ai/`)
Files: `ai.config.ts` (parsed env: `AI_BASE_URL`, `AI_INTERNAL_SECRET`, `AI_PROCESSING_ENABLED`, `AI_JOB_CONCURRENCY`, `AI_EMBED_DAILY_TOKEN_BUDGET`, timeouts), `ai-client.ts` (signed requests per §4.1, timeouts per endpoint [health 10 s · extract-chunk 120 s · index 120 s · search 20 s], retries only for idempotent transient errors, circuit breaker, zod validation of every response, request-id propagation, **never logs bodies**), `ai.contracts.ts` (zod mirrors of the pydantic schemas), `processing/{job.model,job-runner,job.service,eligibility,reconciler,purge,budget}.ts`, `ai.routes.ts`, `ai.audit.ts`, `ai.constants.ts` (shared enums exported to `packages/shared-types`). Mount under `/api/v1`. Add the new env keys to `config/env.ts` (optional, validated; production boot **does not fail** if AI is unconfigured — the feature reports `unavailable`) and update `docs/setup/environment.md`.
**Routes (all `requireAuthenticated` + permission, strict zod, `noStore`, scope-checked → 404 out of scope, envelopes):**
| Method + path | Permission | Purpose |
|---|---|---|
| `GET /documents/:id/ai` | `document.read` | AI status: eligibility + reason, `extractedTextStatus`, current/last job (stages, attempt, error key, warnings, stats), `aiIndex`, `canReprocess` |
| `POST /documents/:id/ai/reprocess` · `…/cancel` | `document.process` | §4.3 |
| `GET /documents/:id/ai/chunks` | `document.read` **and** `document.download` | Paginated chunk **preview** for traceability (index, pages, section, text ≤ 1 500 chars/chunk, status) — respects confidentiality; audited as count only; never for SENSITIVE-without-permission |
| `GET /ai/processing/summary` | `document.process` | Counts by state within scope: AI-ready, queued, processing, failed, unsupported/scanned, excluded, not-eligible, outdated pipeline; coverage % of eligible docs; tokens today vs budget (`ai.manage` sees budget detail) |
| `GET /ai/processing/jobs` | `document.process` | Job list (filters status, trigger, date, document, agency; page ≤ 50), safe fields only |
| `POST /ai/processing/reprocess` | `document.process` | Bulk reprocess (§4.3) |
| `GET /ai/status` | `ai.manage` | Service health, readiness, collection/model/dimension, circuit state, last reconcile — **no secrets/URLs** |
| `POST /ai/processing/reindex` (+ confirm) | `ai.manage` | §4.3 |
| `POST /ai/search/diagnostic` | `document.process` + scope | **Retrieval check only:** `{query ≤ 300, projectId?, limit ≤ 8}` → Express computes the allow-list = `documentReadFilter` ∩ `extractedTextStatus=COMPLETED` (≤ 500 ids, newest first), calls `/v1/search`, drops hits whose chunk isn't ACTIVE/current in Mongo, hydrates snippet text (≤ 300 chars) from Mongo, returns `{documentId, docNo, title, chunkId, pages, section, score, snippet}`; audited (`ai.retrieval_diagnostic_run`, no query text); rate-limited (e.g. 20/10 min/user). Labelled "Diagnostic — not an answer". Batch 10 builds RAG on `/v1/search`, not on this route. |
Permission-matrix reality check: **the allow-list is built server-side and every returned hit is re-authorised against Mongo** — never trust the vector payload alone.

### 4.8 Permissions (minimal)
Add **`ai.manage`** (GOV_ADMIN, SUPER_ADMIN) for service status, reindex and budget detail; Batch 12 will reuse it for AI settings/usage. `document.process` stays the gate for reprocess/jobs/diagnostic. SUPER_ADMIN follows the existing platform write rule (only records with an owning agency). Use the same idempotent propagation path as earlier batches (sync script/seed/parity tests) and report the final matrix + the command for existing databases.

### 4.9 Seeds & smoke
- Extend the demo seed (idempotent, synthetic): ensure a few of the Batch 08 demo documents are in varied AI states **only if truthfully reproducible** — i.e. seed rows must **not** claim `COMPLETED` without chunks. Preferred: provide `npm run ai:demo-process` (processes the seeded eligible demo documents through the real pipeline when AI is configured) and seed only `NOT_STARTED`, one honest `UNSUPPORTED` (image/xlsx) and one `FAILED` job record that was produced by a real classification (e.g. a seeded encrypted/empty-text file generated programmatically). `reset-demo` must purge Qdrant points for demo docs (via FastAPI `/v1/delete` when reachable, otherwise print a clear warning) and delete chunks/jobs/usage rows; update `verify-demo` with counts only.
- `scripts/ai-smoke.ts` (`npm run ai:smoke`): reads env; checks `/health`, `/ready`, `/v1/capabilities`; runs the §4.5 embedding capability + multilingual check; processes a tiny generated TXT/PDF/DOCX through extract → index → diagnostic search → delete; prints a compact PASS/FAIL table; exits non-zero on failure; **prints "SKIPPED (no credentials)" rather than faking success.**

---

## 5. FRONTEND — PREMIUM, FUNCTIONAL (extends DocTrace from Batch 08)

### 5.1 Routes and files
Real **AI status** everywhere Batch 08 showed the neutral chip; new tab on the document details page; new `/documents/processing` page (**AI Processing Center**), nav sub-item under DocTrace gated by `document.process` (si/ta labels; update `route-access.ts` + test). Suggested files: `components/documents/ai/{ai-status-chip,processing-pipeline-stepper,ai-processing-panel,job-history-list,chunk-preview-list,reprocess-button,processing-center,processing-insight-strip,processing-jobs-table,service-status-card,retrieval-check-panel,reindex-dialog,eligibility-explainer,processing-toast}.tsx`; `lib/documents/ai/{api,types,messages,view,poll}.ts` (+ tiny tests for status derivation and poll interval helpers).

### 5.2 Design language
Same as Batches 04–08: calm enterprise surfaces, tabular numerals, status never colour-only (icon + label), skeletons, ≤ 200 ms motion with reduced-motion respected, 44 px mobile targets, aria-live for status changes. AI visuals: a **pipeline stepper** (Extract → Chunk → Embed → Index) with per-stage state (pending / running with subtle pulse / done / failed / skipped), **AI-ready badge** (sparkle-free, check-shield iconography), neutral grey for not-processed, amber for deferred/warnings, red for failed — each with text.

### 5.3 Screens (loading / empty / error / forbidden / offline states; every control functional)
**A. AI status chip (library table/grid/cards, preview drawer, linked-documents panels):** states `Not processed` · `Queued` · `Processing (stage)` · `AI-ready` · `Needs attention` (warnings) · `Failed` · `Unsupported` · `Scanned — no text` · `Excluded` · `Not eligible (reason)`; tooltip explains reason + last updated; click → details AI tab. Library filter `AI status` (and the Batch 08 `aiReady` filter now works); bulk action **Reprocess** (permitted roles).
**B. Document details → "AI processing" tab:** eligibility explainer (plain language: why eligible/not, with the control to change it if permitted — links to the Batch 08 restrict dialog); **pipeline stepper** with live status (polls `GET /documents/:id/ai` every 3 s while queued/running, backs off to 15 s, stops when terminal, pauses when the tab is hidden); stats cards (pages, chunks, tokens estimate, model, dimension, indexed at, pipeline version); **warnings** (Only first N pages indexed; Low text quality — Sinhala/Tamil legacy fonts; Partial text; Encoding guessed) with plain-language guidance; failure card with translated reason + **Reprocess** (disabled with reason when not permitted/ineligible/active) and **Cancel**; **job history** (attempts, trigger, status, duration, requester); **Extracted text preview** (paginated chunk list with page/section badges and a "page X of source" label, copy-less, shown only with `document.read` + `document.download`; hidden for SENSITIVE without permission) — the traceability view; "Open page N in preview" jumps the Batch 08 PDF preview to the page when the browser viewer supports `#page=N`.
**C. Upload wizard (Batch 08):** step 4 shows an **AI processing note** with eligibility (e.g. "This PDF will be processed for AI search after upload"/"Images are not processed"/"Sensitive documents are excluded") and, after upload, a live per-file AI-status line (non-blocking).
**D. AI Processing Center (`/documents/processing`):** header with scope chip + **Service status** card (`ai.manage` only: healthy/degraded/unavailable, model, dimension, collection, circuit state, last reconcile; others see a simple "AI processing: available/temporarily unavailable"); **insight strip** (click-to-filter): AI-ready · In progress · Failed · Unsupported/scanned · Excluded · Outdated pipeline · Coverage % of eligible; **jobs table** (document link, status chip, stage, attempt, trigger, started/duration, error key translated, row menu: Open document, Reprocess, Cancel) with filters (status, trigger, date, agency, text), pagination, bulk "Reprocess failed" with per-item result dialog; **Token usage today vs budget** bar (`ai.manage`; "estimated cost" only if a verified price is configured, else "tokens only"); **Retrieval check** panel (diagnostic): query box → real results list (doc title + docNo link, pages, section, score, snippet) with the permanent label "Diagnostic — not an answer; question answering arrives in the next release" and honest empty/failed states; **Reindex** dialog (`ai.manage`: shows current vs configured model/dimension, impact estimate = documents/chunks/approx tokens, typed confirm, progress, second-step "finalise"). Mobile: cards, bottom-sheet filters, full-screen result views.
**E. Honest degradation:** when FastAPI/Qdrant is down, banners say so and the rest of DocTrace keeps working; reprocess buttons remain usable and queue the job (status Queued with "waiting for AI service").

### 5.4 i18n and client
Complete `en/si/ta` strings for every status, stage, warning, error key, eligibility reason, button, dialog and aria-label; locale-aware numbers/dates/durations; never translate stored data. Reuse existing si/ta terminology; flag uncertain translations. API client: `guard()/moved()`, React Query keys with epoch/user/role, polling via `refetchInterval` function (no unbounded intervals, abort on unmount), precise invalidation (document list/detail/AI/summary/jobs).

---

## 6. AUTONOMOUS SELF-HEALING LOOP

At every ✔ checkpoint in §7 and before each push:
1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check`, `npm run lint` (touched workspaces), relevant vitest files (`ai.*`, `documents.*`, permission parity, inspections regression), `npm run db:indexes:check`, `pytest -q` in `apps/ai-service` (venv), `npm run db:seed:demo` + `db:seed:verify` if seeds changed, `npm run ai:smoke` when credentials exist, finally `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis); re-run only the failing command to confirm.
4. **Fix the root cause.** Never delete/skip/weaken tests, add `eslint-disable`/`@ts-ignore`/`any`/`# type: ignore` to hide errors, loosen auth/ACL/signature checks, hard-code expected outputs, route around Qdrant/the provider with fake results, or mark a stage "done" without the work. Pre-existing baseline failures: list and work around narrowly.
5. **Re-run.** **Max 3 repair iterations per distinct failure.** If still failing, stop that thread and record it under "Unresolved" (error text, hypotheses tried, what you need). **Never hide or downplay** unresolved errors — especially live-provider/Qdrant results you could not verify.
6. When critical checks are green, self-review against §9 before committing.
7. Keep a ≤ 12-line check log (command → pass/fail → fix) for the report.

---

## 7. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until its checks are green)

1. Preflight + branch (§3, §11). Stop-and-ask gates as written. ✔
2. **Shared types, env & permissions:** AI enums, env keys (+ catalog doc), `ai.manage` grant + parity tests. ✔
3. **Models & indexes & migration:** `documentChunks` extension + index swap script, `documentProcessingJobs`, `aiUsageRecords`, `Document.aiIndex`, `check-indexes`. ✔
4. **FastAPI skeleton:** config, security (HMAC), errors/logging, health/ready/capabilities, Dockerfile/render.yaml, README, `.env.example`; auth tests. ✔
5. **Extraction + chunking (+ pytest):** PDF/DOCX/TXT, scanned/encrypted/empty/quality handling, cleaner, sections, deterministic chunker. ✔
6. **Embeddings adapter + Qdrant store + `/v1/index|delete|search`** (+ pytest with a stub embedder and a local/in-memory Qdrant if available, else a thin fake store behind the same interface, test-only). ✔
7. **Express AI client + contracts + eligibility + job model/runner + subscribers + reconciler + purge + budget.** ✔
8. **Express routes** (status, reprocess/cancel, chunks preview, summary, jobs, bulk, status, reindex, diagnostic) + audit + notices. ✔
9. **Seeds, reset/verify, `ai:smoke`, `ai:demo-process`.** ✔
10. **Frontend foundation:** nav, client, messages skeleton, AI chip, stepper. ✔
11. **Document details AI tab + library chip/filter/bulk reprocess + upload-wizard note.** ✔
12. **AI Processing Center** (insights, jobs, service status, usage, retrieval check, reindex). ✔
13. i18n (si/ta) completion + responsive/a11y/visual polish (375/768/1280). ✔
14. Essential verification (§8), self-review (§9), cleanup, push, PR. ✔

---

## 8. ESSENTIAL VERIFICATION (small but complete)

**Automated (fast):**
- *Python (`pytest`):* HMAC auth (valid, bad signature, stale timestamp, missing headers, browser Origin rejected, `/docs` disabled in prod); extraction on tiny in-test fixtures (a handwritten minimal PDF, a `python-docx`-generated DOCX with a table, TXT incl. Sinhala + Tamil strings): text + page numbers correct; encrypted/empty/scanned-like (blank-page PDF)/corrupt → right error codes; chunker determinism (same input ⇒ same ids/hashes), size bounds, overlap, section titles, duplicate dropping, ZWJ/ZWNJ preserved; `/v1/search` rejects missing allow-list; delete idempotent; embeddings adapter retry/backoff with a stub HTTP server (429 → retry, 400 → no retry, dimension recorded).
- *Express (vitest, stub FastAPI via a local `http` server — no real provider calls in CI):* `isEligibleForAi` table; job state machine (claim lease atomicity, expired lease requeue, retry/backoff classification, permanent vs transient, DEFERRED on budget, version-supersede SKIPPED, one-active-job index); event subscribers (archive/restrict/delete purge; restore re-enqueue); reconciler finds orphans; circuit breaker; **contract fixtures** validated by both zod and pydantic; routes: scope isolation (other agency → 404), permission gates, `chunks` preview denied without `document.download` and for SENSITIVE, diagnostic builds the allow-list server-side and drops stale/unauthorised hits, no chunk text/secret/URL in any list/status response (JSON assertion), audit allowlist accepts new actions, migration script dry-run.
- *Live (manual, only with credentials; otherwise report SKIPPED):* `npm run ai:smoke` PASS table; upload real PDF + DOCX + a Sinhala/Tamil text file → AI-ready; replace a file → old vectors gone (query returns only new content); archive → purged; restore → re-indexed; scanned PDF → "Scanned — no text"; kill FastAPI → jobs wait/retry, UI shows "unavailable", DocTrace still works; restart → reconciler resumes.
**Manual browser walkthrough (375/768/1280):** upload → watch the stepper → AI-ready chip → AI tab (stats, chunks preview page refs) → Reprocess → Processing Center (filters, bulk reprocess, retrieval check as agency user → only own-agency documents appear; second-agency user sees none of them) → si/ta pass → keyboard-only pass through the AI tab and reindex dialog.
**Regression:** Batch 08 upload/download/search unchanged; inspections evidence untouched; `npm run test:api` (documents/identity/ai subsets), `npm run build:web`, `npm run lint`, `npm run type-check` (separate pre-existing failures from new).

---

## 9. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing; "AI-ready" without chunks **and** vectors; fake embeddings/OCR/retrieval; claims about model quality or price that weren't verified live.
- FastAPI reachable from the browser, reading MongoDB/the file store, or deciding permissions; search without an Express-supplied allow-list; trusting Qdrant payload for authorization; chunk text stored in Qdrant payloads or logs.
- Secrets, URLs, document text, file names or prompts in logs/audit/errors/URLs; `.env` committed; verbose stack traces to callers.
- Processing sensitive/excluded/archived documents; leftover vectors after archive/delete/replace/restrict; half-indexed documents visible to search.
- Unbounded retries/polling/concurrency; per-stage audit spam; unbounded cost (no per-doc cap, no daily budget); re-embedding the whole corpus automatically.
- Stripping ZWJ/ZWNJ (breaks Sinhala/Tamil); fabricated page numbers for DOCX; silent truncation; hiding scanned/low-quality documents.
- Atlas Vector Search or a second vector DB; new heavy dependencies (LangChain, torch, Celery, Redis, OCR); unrelated refactors; weakened/skipped tests; hidden unresolved errors.
- Colour-only status; hover-only mobile affordances; tap targets < 44 px; horizontal scroll on phones.

---

## 10. (reserved)

---

## 11. GITHUB WORKFLOW

- **Base:** `development` (once Batch 08 is merged; else §3.2).
- **Branch:** `feature/ai-processing-pipeline` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(ai): AI processing enums, env config and ai.manage permission (Steps 111-114 foundation)`
  2. `feat(ai): extend document chunks, add processing jobs and usage records with migration`
  3. `feat(ai-service): FastAPI service skeleton with signed service auth, health and capabilities (Step 111)`
  4. `feat(ai-service): PDF, DOCX and text extraction with quality and failure handling (Step 112)`
  5. `feat(ai-service): section-aware chunking and embedding adapter (Step 113)`
  6. `feat(ai-service): Qdrant vector store, index, delete and filtered search (Step 114)`
  7. `feat(ai): Express AI client, eligibility, durable job runner, reconciler and purge`
  8. `feat(ai): AI status, reprocess, chunk preview, processing summary, reindex and retrieval diagnostic APIs`
  9. `chore(ai): demo processing script, ai:smoke and seed/reset/verify updates`
  10. `feat(documents): AI status chips, pipeline stepper and document AI tab`
  11. `feat(documents): AI Processing Center with jobs, service status, usage and retrieval check`
  12. `feat(documents): si/ta copy, responsive and accessibility polish for AI processing`
  13. `test(ai): auth, extraction, chunking, job state machine, isolation and contract essentials`
- Before each commit: type-check + lint touched workspaces (+ `pytest` for `apps/ai-service`). Never commit `.env*`, secrets, `.venv`, real data or `node_modules`. Add `apps/ai-service/.venv`, `__pycache__`, `.pytest_cache` to `.gitignore`.
- **CI:** do not weaken `quality.yml`; optionally add one small `ai-service` job (setup-python 3.12, `pip install -e .[dev]`, `pytest -q`, **no secrets**) only if it's a few lines and cannot require network credentials — otherwise run `pytest` manually and say so.
- **Push:** `git push -u origin feature/ai-processing-pipeline` (no force). **Do not merge.** PR into `development` (squash): title `feat(ai): Phase 10 Batch 09 — FastAPI AI service, document extraction, chunking, embeddings and Qdrant indexing (Steps 111–114)`; body = shipped features per step, endpoints (Express + FastAPI), collections/indexes/migration, env vars (names only) and **Render deployment steps for the FastAPI service** (service type, build/start commands, health path, env group, Qdrant Cloud setup, free-tier cold-start note, `AI_BASE_URL` wiring on the API service), permission changes + the command for existing databases, verification results incl. the self-healing check log and **what was/wasn't verified live**, known gaps, decisions needed. If you can't open the PR, give me the exact title/body.

---

## 12. COMPLETION CRITERIA (all must be true)

- [ ] **Step 111:** FastAPI service with signed service-to-service auth, health/ready/capabilities, structured errors, safe logging, limits/timeouts, Dockerfile + Render config, README/env docs; Express client with timeouts, retries, circuit breaker and zod-validated responses.
- [ ] **Step 112:** PDF/DOCX/TXT(/CSV) extraction with page metadata, scanned/encrypted/empty/corrupt/low-quality handling, safe limits, supported-format reporting, reprocessing.
- [ ] **Step 113:** deterministic section-aware chunks with page/section refs and stable ids; cost-conscious batched embeddings via the adapter with verified model/dimension, usage records, per-doc and daily budgets.
- [ ] **Step 114:** Qdrant collection with payload indexes, idempotent upsert, version swap, deletion sync, Express-allow-list filtered search; durable job pipeline (lease, retries, DEFERRED, reconciler, purge); reprocess/cancel/bulk/reindex; real status UI (chips, stepper, AI tab, Processing Center, retrieval diagnostic) with honest degradation.
- [ ] Permissions via the documented path; scope isolation verified (other agency → 404, diagnostic returns only authorised documents); sensitive/excluded/archived docs never indexed.
- [ ] UI premium, consistent with Batches 04–08, responsive (375/768/1280), accessible, en/si/ta complete; **every control functional**.
- [ ] Self-healing loop executed; all critical checks green or explicitly **Unresolved**; live-provider/Qdrant verification reported truthfully (PASS/SKIPPED/FAILED); branch pushed; PR text ready.

---

## 13. FINAL REPORT (short)

(1) Preflight findings and deviations from §2 (Batch 08 presence, printed permission matrix, Python version, credential/Qdrant/embeddings gate outcome); (2) what shipped per step (111/112/113/114) incl. unique functions (signed service auth, Express durable job queue with reconciler, scanned/low-quality detection, section-aware chunks, version swap, retrieval diagnostic, Processing Center); (3) endpoints (Express + FastAPI), collections, indexes, migration, env vars (names only), permissions; (4) **verified embedding model, dimension, price (if verified), multilingual sanity numbers, recommended low-cost default and one higher-quality alternative**; (5) decisions needing my approval (`ai.manage`, thresholds: chunk sizes, page/char caps, retry/backoff, budgets, sensitive handling, reindex flow); (6) verification results + self-healing check log + live-verification status + any **Unresolved**; (7) uncertain translations; (8) **Render/Qdrant deployment checklist** and cold-start behaviour; (9) **Batch 10 handoff notes**: `/v1/search` contract and the allow-list/hydration/ACL re-check pattern, chunk statuses and `aiIndex` fields to trust, `aiUsageRecords` usage for chat costs, provider-adapter extension point for chat models (`AI_CHAT_MODEL`), what the diagnostic route does (and that Batch 10 must not build on it), known retrieval-quality limits for Sinhala/Tamil; (10) known gaps and sensible future work (OCR, chunk-vector reuse across versions, scheduled reconciliation, malware scanning).

Stop after the report. Do not start Batch 10.
