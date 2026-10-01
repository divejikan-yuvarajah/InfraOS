# INFRAOS API documentation

**Step:** 09–11 foundation

Versioned REST base: **`/api/v1`** ([ADR-005](../adr/ADR-005-rest-api.md)). Envelope and errors: [../architecture/architecture-decisions.md](../architecture/architecture-decisions.md). Conventions: [../backend/conventions.md](../backend/conventions.md).

## Current routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/health` | Public | Liveness. Process up. No DB/env dump. |
| GET | `/health` | Public | Same liveness payload for uptime/Render probes. |
| GET | `/api/v1/ready` | Public | Readiness. **200** when MongoDB is connected; **503** `NOT_READY` otherwise. No URI/host. |
| GET | `/ready` | Public | Same readiness payload for infrastructure probes. |

OpenAPI / Swagger UI will be added when feature routes exist. Do not expose unauthenticated Swagger in production.
