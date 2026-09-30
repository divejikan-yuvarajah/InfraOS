# ADR-011 — RAG Vector Store (Qdrant)

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

DocTrace RAG needs embeddings storage. Options: Qdrant, Supabase pgvector, other managed stores, provider-native stores. Atlas Vector Search was also considered internally.

## Decision

Use **one** vector database: **Qdrant**.

- **Local:** Docker image for development  
- **Hosted:** Qdrant Cloud free/student-friendly tier for deployed P1

FastAPI is the only writer/reader of Qdrant. Express passes **allowed document IDs** for filtered search.

MongoDB may store chunk text for debugging; it is **not** the V1 kNN engine.

## Reasons

- Purpose-built vectors without adding PostgreSQL
- Atlas Vector Search often requires a paid cluster (M10+) — poor fit for a free Atlas M0-style class project
- Docker local is one container, not a second application DB
- Free/low-cost cloud exists

## Alternatives considered

| Alternative | Why not V1 |
|-------------|------------|
| Supabase pgvector | Second database (Postgres) |
| Pinecone | Cost and another vendor personality |
| Atlas Vector Search | Cluster tier barrier |
| In-memory cosine in FastAPI only | OK for 10 docs; collapses at demo scale |
| Multiple vector DBs | Forbidden |

## Trade-offs

- Another hosted credential (`QDRANT_URL` / API key)
- Operational burden is still far below Kafka/K8s

## Consequences

- Payload must include `documentId` / `projectId` for ACL filters
- Re-index job if embedding model changes (manual P1)

## Future revisit conditions

- Atlas cluster is already M10+ and the team wants one vendor — new ADR could move vectors to Atlas
- pgvector if the product later standardizes on PostGIS anyway
