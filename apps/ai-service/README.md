# INFRAOS AI service

Stateless **Python 3.12 + FastAPI** compute service (Phase 10, Batch 09). It extracts text, chunks it, creates embeddings and indexes them in **Qdrant**. It is not an npm workspace, not a CRUD backend and **not reachable from the browser**.

## Boundaries (locked, ADR-008 / ADR-011)

- Express is the only caller and the only authority for users, roles, agency scope and records. This service never reads MongoDB or the document store and never decides permissions.
- Every `/v1/*` and `/ready` request is signed: `X-Infraos-Timestamp` (epoch ms, ±60 s), `X-Infraos-Request-Id`, `X-Infraos-Signature` = HMAC-SHA256(`AI_INTERNAL_SECRET`, `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`). For multipart uploads the hashed body is the JSON `metadata` part, which declares the file sha256 (the service re-hashes the file).
- Browser `Origin` headers are rejected, there is no CORS, and `/docs` is only served when `APP_ENV=development`.
- Vector search always requires an `allowedDocumentIds` list from Express. No chunk text is stored in Qdrant or logs.
- No OCR: scanned PDFs are reported as `SCANNED_NO_TEXT`.

## Endpoints

`GET /health` (open) · `GET /ready` · `GET /v1/capabilities` · `POST /v1/extract-chunk` · `POST /v1/index` · `POST /v1/delete` · `POST /v1/search` · `POST /v1/admin/reindex-plan` · `POST /v1/admin/drop-collection` (reindex finalise; refuses the active collection). Errors: `{ code, message, retryable, requestId }`.

## Local run

```powershell
cd apps/ai-service
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
copy .env.example .env        # then fill the values (the file is gitignored)
docker run -p 6333:6333 qdrant/qdrant
.venv\Scripts\python -m uvicorn app.main:app --port 8000
.venv\Scripts\python -m pytest
```

Live check (service + Qdrant + embeddings running): `npm run ai:smoke` from the repo root. It prints SKIPPED, never a fake pass, when credentials are missing.

Env names (values never in Git): `APP_ENV`, `PORT`, `AI_INTERNAL_SECRET` (must equal the API's), `OPENROUTER_API_KEY`, `AI_EMBED_MODEL` (canonical model variable; default `baai/bge-m3`), `EMBED_BASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`. Catalog: [../../docs/setup/environment.md](../../docs/setup/environment.md).

## Render

Declared in the root `render.yaml` as `infraos-ai` (Python web service, `rootDir apps/ai-service`, build `pip install .`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health `/health`). Free instances sleep and cold-start in 30–60 s; the Express job runner wakes the service and retries. Set `AI_BASE_URL` on `infraos-api` to this service's origin.

See [../../docs/architecture/ai-decisions.md](../../docs/architecture/ai-decisions.md) and [ADR-008](../../docs/adr/ADR-008-fastapi-ai-service.md).
