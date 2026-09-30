# INFRAOS AI Decisions

**Document:** `/docs/architecture/ai-decisions.md`  
**Step:** 02  
**Status:** Locked  
**Related:** [ADR-008](../adr/ADR-008-fastapi-ai-service.md), [ADR-011](../adr/ADR-011-rag-vector-store.md)

AI **strengthens** INFRAOS. It is **not** required for the P0 spine ([mvp-priorities.md](../planning/mvp-priorities.md)).

---

## 1. Boundary

```text
Browser ──REST──▶ Express (authz, minimize payload, persist official data)
                      │
                      │ internal HTTPS + AI_INTERNAL_SECRET
                      ▼
                   FastAPI
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     LLM adapter   Qdrant     extractors
```

| May live in FastAPI | Must stay in Express |
|---------------------|----------------------|
| Risk feature computation | Official project/conflict/payment status |
| Chunking, embeddings, retrieve | Document ACL |
| RAG answer draft | User permissions |
| Optional later vision estimate | Inspection official outcome |

If FastAPI is down: ProjectTrace, RoadSync, InfraMap, audit still work. UI shows fallback for risk/RAG.

---

## 2. Provider adapter

Do **not** call a vendor SDK from services as if it were the domain model.

Interface (conceptual):

```text
complete(prompt, schema, limits) → structured result
embed(texts) → vectors
```

**V1 default implementation:** **OpenRouter** (OpenAI-compatible HTTP). One key can route to several models.

Also support behind the same interface (config switch, not a rewrite):

- Gemini
- Other OpenAI-compatible gateways
- Qwen / open-source endpoints

Business prompts and JSON schemas live in **our** code. Model IDs live in env (`AI_CHAT_MODEL`, `AI_EMBED_MODEL`).

Start with **one** chat model and **one** embedding model in production to control cost.

---

## 3. DocTrace RAG

Pipeline (P1):

```text
Authorized upload
  → R2
  → MongoDB metadata (UPLOADED)
  → FastAPI extract → clean → chunk
  → embed → Qdrant upsert (payload: documentId, projectId, chunkId, locator)
  → INDEXED
```

Query:

```text
Authorized question
  → Express checks document ACL
  → FastAPI embed question, search Qdrant **filtered by allowed document ids**
  → LLM with citations
  → Express returns answer + references + hallucination warning if weak match
```

ACL is enforced by **passing an allow-list of document IDs from Express**, not by trusting Qdrant filters alone from the client.

Unsupported/empty extract → `UNSUPPORTED` / `FAILED`; original file kept.

**One vector database only: Qdrant.** Chunk text may also be stored in MongoDB for audit/debug; vectors are not queried from MongoDB in V1.

---

## 4. Risk intelligence

Express collects **minimized numeric/categorical features** (dates, status, progress gap, open conflict count). FastAPI returns:

- score
- factors
- explanation
- recommendation

Persisted as `riskAssessments`. **Never** applied as a status mutation.

---

## 5. Later vision (P2)

Reported vs visible progress is **advisory**. Never label fraud ([BR-AI-003](../planning/business-rules.md)).

---

## 6. Copilot (P2/P3)

Only after search/RAG/list APIs are stable. Copilot is a client of those APIs, not a new SoR.

---

## 7. Failure and cost

| Event | Behavior |
|-------|----------|
| Timeout / 5xx | User-visible fallback; HTTP 503 on AI routes only |
| Invalid JSON from model | Discard; log; fallback |
| Budget / rate | 429 |
| No chunks | Honest empty retrieval message |

---

## 8. Why not put RAG in Node only

Possible, but Python extractors (PDF/text) and ML libraries are more mature. FastAPI is justified **for this workload**, not for agencies CRUD.
