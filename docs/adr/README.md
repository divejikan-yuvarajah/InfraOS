# INFRAOS Architecture Decision Records

ADRs record **why** a technology was chosen. The stack summary lives in [../architecture/technology-stack.md](../architecture/technology-stack.md).

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-001](./ADR-001-modular-monolith.md) | Modular monolith + one AI service | Accepted |
| [ADR-002](./ADR-002-nextjs-frontend.md) | Next.js App Router + React + TypeScript | Accepted |
| [ADR-003](./ADR-003-express-typescript-backend.md) | Node.js + Express + TypeScript | Accepted |
| [ADR-004](./ADR-004-mongodb-geojson.md) | MongoDB Atlas + Mongoose + GeoJSON | Accepted |
| [ADR-005](./ADR-005-rest-api.md) | REST `/api/v1` | Accepted |
| [ADR-006](./ADR-006-jwt-access-refresh-session.md) | Short-lived JWT + HTTP-only refresh cookie | Accepted |
| [ADR-007](./ADR-007-rbac-resource-authorization.md) | RBAC + resource-level authorization | Accepted |
| [ADR-008](./ADR-008-fastapi-ai-service.md) | Python FastAPI AI service | Accepted |
| [ADR-009](./ADR-009-maplibre-gis.md) | MapLibre GL + OSM-compatible tiles | Accepted |
| [ADR-010](./ADR-010-file-storage-provider.md) | S3-compatible storage (Cloudflare R2) | Accepted |
| [ADR-011](./ADR-011-rag-vector-store.md) | Qdrant for DocTrace vectors | Accepted |
| [ADR-012](./ADR-012-deployment-strategy.md) | Vercel + Render + Atlas + R2 | Accepted |

To change a locked decision, supersede the ADR. Do not silently edit history.
