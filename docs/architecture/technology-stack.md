# INFRAOS Technology Stack

**Document:** `/docs/architecture/technology-stack.md`  
**Step:** 02 — Final Technology Stack & Architecture Decisions  
**Status:** Locked  
**Product source of truth:** `/docs/planning/`

This document locks **what INFRAOS Version 1 uses**. ADRs explain **why**. Exact Next.js / Express patch versions are chosen when those apps are scaffolded (Steps 8–9), using the current stable major listed below.

**Step 7** created the npm workspace. **Step 8** scaffolds Next.js in `apps/web`. **Step 9** scaffolds Express in `apps/api`. There is still no product-feature code (no ProjectTrace/RoadSync).

---

## 1. Architectural style

**Modular monolith + one dedicated AI service**

```text
Users / Browser
      ↓
Next.js (Vercel)
      ↓  HTTPS REST + optional Socket.IO
Node.js Express API (Render)
      ↓
Feature modules (Identity, ProjectTrace, RoadSync, …)
      ↓
MongoDB Atlas  |  Cloudflare R2  |  OSM-compatible tiles
      ↓  (authorized internal calls only)
FastAPI AI service (Render)
      ↓
LLM provider (via adapter)  |  Qdrant
```

See [ADR-001](../adr/ADR-001-modular-monolith.md).

---

## 2. Locked stack

| Layer | Choice | Purpose |
|-------|--------|---------|
| Frontend framework | **Next.js (App Router) + React + TypeScript** | Routing, layouts, pages, RSC/client split |
| Styling | **Tailwind CSS** | Utility styling + design tokens (tokens resolved in later UI steps) |
| UI primitives | **shadcn/ui** | Accessible components, customized to INFRAOS |
| Forms | **React Hook Form + Zod** | Client validation UX |
| Server state | **TanStack Query** | Fetch, cache, mutation, invalidation |
| Client UI state | **Zustand (narrow)** | Sidebar, map filter UI, preferences — not server data |
| Maps | **MapLibre GL + OSM-compatible tiles** | GeoJSON layers, prototype GIS |
| Motion | **GSAP (landing / selected marketing only)** | Hero and story motion; respect `prefers-reduced-motion` |
| Backend runtime | **Node.js 22 LTS** | API process |
| Backend framework | **Express.js + TypeScript** | REST modular monolith |
| Validation (server) | **Zod** | Params, query, body, IDs, enums, GeoJSON, files |
| ODM | **Mongoose** | Models, indexes, validation, GeoJSON |
| Database | **MongoDB Atlas** | System of record + `2dsphere` |
| Authn | **JWT access + rotating refresh cookie** | Sessions |
| Password hashing | **bcryptjs** | Portable on Windows teammate machines |
| Authz | **RBAC + resource checks in Node** | BR-AUTH / BR-SCOPE |
| AI service | **Python 3.12 + FastAPI** | Risk, embeddings, RAG, optional later vision |
| LLM access | **Provider adapter (start: OpenRouter)** | No vendor lock in business logic |
| Vector store | **Qdrant** (Cloud + local Docker) | DocTrace chunks only |
| Files | **Cloudflare R2 (S3 API)**; local disk/MinIO in dev | Private documents and evidence |
| Realtime | **Socket.IO (optional, P2)** | Selected alerts only |
| API style | **REST `/api/v1`** | Stable contracts |
| API docs | **OpenAPI 3 + Swagger UI (non-prod)** | Describe routes when they exist |
| Logging | **Pino** | JSON application logs |
| Errors (prod) | **Sentry (optional, production)** | Crash visibility |
| Uptime | **UptimeRobot (or equivalent)** | Probe frontend + API health |
| Tests | **Vitest + Supertest + Playwright** | Unit, API, E2E |
| CI | **GitHub Actions** | lint, type-check, test, build |
| Frontend host | **Vercel** | Next.js |
| API + AI host | **Render** | Express and FastAPI |
| Repo | **Git + GitHub** | Already in use |

---

## 3. Frontend responsibilities

Next.js **may**:

- compose pages and layouts
- enforce UX route guards (redirect unauthenticated users)
- render MapLibre layers from API GeoJSON
- validate forms for usability
- cache server data with TanStack Query

Next.js **must not**:

- be the authorization authority
- trust `user.role` from the client as security
- call MongoDB, R2, Qdrant, or the FastAPI service directly
- store refresh tokens in `localStorage`
- duplicate large collections in Zustand

App Router is locked. There is no existing Pages Router app to preserve.

Client vs server components (implementation rule for Step 8+):

- default to Server Components for static/marketing shells
- use Client Components for maps, forms, sockets, query hooks, authenticated dashboards that need interactivity

---

## 4. Backend responsibilities

Express **owns**:

- authentication and session rotation
- RBAC and resource-level authorization
- business rules and official status transitions
- MongoDB writes
- file upload authorization and presigned/download grants
- audit events
- notification records
- whether an AI call is allowed, and which minimized payload is sent

Layering (skip empty ceremonial files):

```text
Route → Middleware → Controller → Service → Repository → MongoDB
```

| Layer | Does | Does not |
|-------|------|----------|
| Route | Wire path + middleware | Business rules |
| Controller | HTTP in/out, status codes | Transactions, conflict math |
| Service | Rules, workflows, orchestration | Raw query sprawl if a repo exists |
| Repository | Queries, indexes usage, GeoJSON filters | HTTP or RBAC policy (callers pass already-authz scope) |
| Middleware | Authn, authz, Zod, rate limit, request id | Feature-specific workflows |

A tiny module (e.g. health check) may omit a repository.

---

## 5. AI service responsibilities

FastAPI **owns** model/embedding/RAG **computation**.

FastAPI **must not**:

- accept browser traffic in production (internal secret + private network / allowlist)
- decide user roles
- write official project/conflict/payment status
- become a second CRUD backend

See [ai-decisions.md](./ai-decisions.md) and [ADR-008](../adr/ADR-008-fastapi-ai-service.md).

---

## 6. Mapping responsibilities

| Concern | Owner |
|---------|--------|
| Geometry validation on write | Express + Zod |
| Spatial query (nearby / bbox) | MongoDB `2dsphere` via repositories |
| Tile rendering | MapLibre + OSM-compatible raster/vector tiles |
| Layer styling | Frontend InfraMap feature |
| Full-database download | Forbidden — viewport + filters only |

Provider wrapper: a small `mapTiles` config (style URL, attribution) so Mapbox can replace OSM later without rewriting GeoJSON models.

The old GitHub marketing README mentioned Mapbox/Leaflet. **Those are not the V1 lock.** MapLibre + OSM is the lock ([ADR-009](../adr/ADR-009-maplibre-gis.md)).

---

## 7. Runtime versions (majors)

Pin exact versions at scaffold time.

| Runtime | Locked major |
|---------|----------------|
| Node.js | 22 LTS |
| TypeScript | 5.x |
| Next.js | **16.3.x** App Router (scaffolded Step 8: 16.3.8) |
| Python | 3.12 |
| MongoDB | Atlas 7.x/8.x compatible |

---

## 8. Explicitly rejected for Version 1

| Rejected | Why |
|----------|-----|
| Kubernetes, service mesh | Operational cost dwarf the team |
| Kafka, RabbitMQ, event sourcing, CQRS | P0 is request/response + MongoDB transactions where needed |
| Many microservices | Integration risk in 45–60 days |
| Second application database (Postgres) in V1 | Atlas is SoR; PostGIS is a **future revisit**, not a migration now |
| Supabase pgvector | Would add PostgreSQL |
| Atlas Vector Search as V1 default | Typically needs a paid cluster; Qdrant free/local is simpler for university |
| Cloudinary as primary document store | Image CDN defaults fight private PDF/ACL needs |
| GraphQL | Extra surface; REST matches the team prompts |
| Redux / Recoil / Jotai | Zustand only if needed; TanStack Query for server data |
| Prisma | Mongoose matches MongoDB + GeoJSON tutorials and team prompts |
| NestJS | Extra ceremony; Express is the locked backend |
| FastAPI for CRUD | Violates SoR boundary |
| Store JWT refresh in localStorage | XSS impact |
| MFA / OAuth | P2 |
| Dark mode libraries as P0 | P2 product |

---

## 9. Related documents

- [architecture-decisions.md](./architecture-decisions.md)
- [security-decisions.md](./security-decisions.md)
- [ai-decisions.md](./ai-decisions.md)
- [deployment-decisions.md](./deployment-decisions.md)
- [dependency-rules.md](./dependency-rules.md)
