# INFRAOS Architecture Index

This folder is the **Step 2 source of truth** for technology and architecture decisions.

Product scope remains in [../planning/](../planning/README.md). Do not silently change P0/P1/P2/P3 or module names.

Detailed blueprints (request flows, module folders, page maps) belong to **Step 3**. This folder locks **what we use and why**.

## Documents

| File | Purpose |
|------|---------|
| [technology-stack.md](./technology-stack.md) | Locked stack, responsibilities, rejected alternatives |
| [architecture-decisions.md](./architecture-decisions.md) | Style, request flow, API envelope, validation, realtime |
| [dependency-rules.md](./dependency-rules.md) | What may be added and what is forbidden |
| [security-decisions.md](./security-decisions.md) | Authn, cookies, hashing, CORS, CSRF, AI security |
| [ai-decisions.md](./ai-decisions.md) | FastAPI boundary, providers, RAG, vector store |
| [deployment-decisions.md](./deployment-decisions.md) | Vercel, Render, Atlas, R2, CI, environments |

## ADRs

See [../adr/README.md](../adr/README.md).

## Document control

| Field | Value |
|-------|--------|
| Step | 02 — Final Technology Stack & Architecture Decisions |
| Status | Locked for Step 3+ |
| Application feature code in this step | None |
