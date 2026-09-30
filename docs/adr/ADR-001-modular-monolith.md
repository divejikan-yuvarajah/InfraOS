# ADR-001 — Modular Monolith + Dedicated AI Service

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

INFRAOS must deliver a P0 coordination spine in 45–60 days with several module owners. Temptation exists to split “microservices per module” for a portfolio look.

## Decision

Version 1 is a **modular monolith**: one Node.js/Express application containing feature modules, plus **one** FastAPI process solely for AI/RAG/ML computation.

## Reasons

- One authentication, authorization, and audit implementation
- One MongoDB system of record
- Parallel folders without network boundaries between ProjectTrace and RoadSync
- Python is justified for embeddings/RAG, not for CRUD

## Alternatives considered

| Alternative | Why not V1 |
|-------------|------------|
| Many microservices | Auth, data, and deploy explosion |
| Single process including Python models in Node | Weak ML/RAG ecosystem |
| Serverless functions as the only backend | Awkward for sockets, long RAG, GeoJSON jobs |

## Trade-offs

- A bug in one module can crash the API process — accept and use modules + tests
- Scaling is vertical/horizontal clones of the whole API, not per-module

## Consequences

- Team members own folders, not separate repos/services
- FastAPI must not grow agencies/projects APIs

## Future revisit conditions

- Sustained need to scale document processing independently
- Team size and ops maturity that can run Kubernetes (not expected in this course)
