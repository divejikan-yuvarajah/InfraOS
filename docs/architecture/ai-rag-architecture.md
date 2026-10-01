# INFRAOS AI and RAG Architecture

**Document:** `/docs/architecture/ai-rag-architecture.md`  
**Step:** 03  
**Status:** Locked  
**Does not change:** [ai-decisions.md](./ai-decisions.md), ADR-008, ADR-011

Express is the only browser-facing AI facade (`/api/v1/ai/...`).

---

## 1. RAG index

```mermaid
flowchart TD
  U[Document uploaded] --> X[FastAPI extract]
  X --> C[Clean]
  C --> K[Chunk]
  K --> E[Embed]
  E --> Q[Qdrant upsert + payload documentId]
  Q --> I[INDEXED]
```

---

## 2. RAG query

```mermaid
flowchart TD
  Q[Authorized question] --> N[Express ACL allow-list of document ids]
  N --> F[FastAPI RAG]
  F --> E[Embed question]
  E --> R[Qdrant filter by document ids]
  R --> P[Controlled prompt + citations]
  P --> L[LLM]
  L --> Z[Structured answer]
  Z --> N2[Express returns to user]
```

Fallbacks: unsupported file, empty extract, no chunks, model down, rate limit, weak match → warning, no fake citations.

Hallucination: always treat as assistance; show sources or “insufficient evidence.”

---

## 3. Risk

```mermaid
flowchart TD
  A[Authorized risk request] --> C[Express collects minimized features]
  C --> S[Sanitize]
  S --> F[FastAPI risk]
  F --> V[Validate JSON schema]
  V --> P[Persist riskAssessments]
  P --> UI[Score + factors + recommendation]
```

Model output **never** patches `projects.status`.

---

## 4. Optional vision (P2)

Reported % vs estimate % → recommend inspector. **Never** “fraud.”
