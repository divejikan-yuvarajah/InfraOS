# INFRAOS API documentation

**Step:** 09 foundation

Versioned REST base: **`/api/v1`** ([ADR-005](../adr/ADR-005-rest-api.md)). Envelope and errors: [../architecture/architecture-decisions.md](../architecture/architecture-decisions.md). Conventions: [../backend/conventions.md](../backend/conventions.md).

## Current routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/health` | Public | Process up. No DB/env dump. |
| GET | `/health` | Public | Same payload for uptime/Render probes. |

OpenAPI / Swagger UI will be added when feature routes exist. Do not expose unauthenticated Swagger in production.
