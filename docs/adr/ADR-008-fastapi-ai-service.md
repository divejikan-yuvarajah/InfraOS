# ADR-008 — FastAPI AI Service

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

P1 needs risk scoring and DocTrace RAG. Python is the practical ecosystem. CRUD must not move to Python.

## Decision

Run a **Python 3.12 FastAPI** service for risk, extraction, embeddings, RAG, and optional later vision.

Express authorizes, minimizes data, persists official records, and is the only browser-facing API.

Internal auth: `AI_INTERNAL_SECRET`.

Provider access through an **adapter**; V1 default **OpenRouter**.

## Reasons

- Isolates heavy/slow jobs from the REST p95 path
- Matches course AI architecture
- Failure of AI does not stop P0

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| LLM calls from Next.js | Keys and ACL in the browser/BFF mess |
| LLM calls only in Express | Weaker PDF/ML libraries; still OK for tiny demos — FastAPI is the lock |
| Separate microservice per AI feature | Rejected complexity |

## Trade-offs

- Two runtimes to deploy (Render ×2)
- Schema drift if Express and FastAPI disagree — use JSON schema validation both sides

## Consequences

- No FastAPI routes for login, projects, or payments
- pytest for AI unit tests when the service exists

## Future revisit conditions

- If AI is never used and maintenance cost dominates — could fold trivial scoring into Node (new ADR)
