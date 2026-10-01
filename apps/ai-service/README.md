# INFRAOS AI service

Dedicated **Python 3.12 + FastAPI** process for computation only. It is **not** an npm workspace and must not become a second CRUD backend.

This folder is documentation-only until the AI implementation step. Do not install FastAPI, LLM SDKs, or Qdrant clients yet.

## Future scope

- Risk analysis (decision support; never official status)
- Document processing (extract / chunk)
- Embeddings
- RAG over authorized document chunks
- Optional later vision (not P0)

## Boundaries (locked)

- Browser traffic is not accepted in production (internal secret + allowlist).
- FastAPI does not decide roles, write project/conflict/payment status, or replace Express.
- P0 coordination works if this service is unavailable.

See [../../docs/architecture/ai-decisions.md](../../docs/architecture/ai-decisions.md) and [ADR-008](../../docs/adr/ADR-008-fastapi-ai-service.md).
