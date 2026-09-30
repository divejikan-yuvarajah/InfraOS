# ADR-005 — REST API `/api/v1`

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

The team must share one contract style for parallel modules.

## Decision

Expose a **versioned REST API** at **`/api/v1`** with the success/error envelopes in [architecture-decisions.md](../architecture/architecture-decisions.md).

Document with **OpenAPI 3** when routes exist; Swagger UI not public-unauthenticated in production.

## Reasons

- Noun resources match projects, work-requests, conflicts
- Easy Supertest and TanStack Query
- Version prefix allows breaking V2 later without bikeshedding now

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| GraphQL | Extra authz surface and cache complexity |
| tRPC | Couples FE/BE more tightly than the course split |
| Unversioned `/api` | Harder to evolve |

## Trade-offs

- Some over-fetching vs GraphQL — mitigated with query `fields` later if needed (not now)

## Consequences

- Correct HTTP methods and status codes are mandatory
- Idempotency keys for sensitive POSTs in implementation steps

## Future revisit conditions

- Documented need for a BFF aggregation layer — still REST underneath
