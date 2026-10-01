# INFRAOS Architecture Decisions (Summary)

**Document:** `/docs/architecture/architecture-decisions.md`  
**Step:** 02  
**Status:** Locked  
**Normative ADRs:** `/docs/adr/`

This file is the narrative lock. Individual ADRs are the citable records.

---

## 1. Why a modular monolith

INFRAOS must ship a working P0 spine (create → map → conflict → coordinate → resolve → progress → map → audit) in 45–60 days, with parallel module owners.

One Express process with **feature modules** gives:

- one auth story
- one API envelope
- one MongoDB
- one deployment for business logic
- shared middleware (RBAC, Zod, audit)

A dedicated FastAPI process exists **only** because Python is the practical ecosystem for RAG/embeddings/ML — not because CRUD should be split.

Microservices would multiply auth, CORS, tracing, and “whose database is this?” before RoadSync exists.

---

## 2. Frontend decisions

| Topic | Decision |
|-------|----------|
| Framework | Next.js App Router, React, TypeScript ([ADR-002](../adr/ADR-002-nextjs-frontend.md)) |
| CSS | Tailwind + Step 8 token foundation (flag palette; no second navy/orange system) |
| Components | shadcn/ui customized, not stock shadcn look |
| Forms | RHF + Zod; **server Zod still mandatory** |
| Data | TanStack Query for API; Zustand for chrome/map UI only |
| Maps | MapLibre ([ADR-009](../adr/ADR-009-maplibre-gis.md)) |
| Motion | GSAP on marketing surfaces only |

Authorization on the frontend is **cosmetic**. 403 from the API is the real answer.

---

## 3. Backend request flow

```text
Client
  → HTTPS
  → Express route
  → request-id + Helmet + CORS + rate limit
  → authenticate (Bearer access JWT)
  → authorize (permission + resource)
  → validate (Zod)
  → controller
  → service (rules, workflows)
  → repository (MongoDB)
  → envelope response
```

Failures:

| Class | HTTP | Client |
|-------|------|--------|
| Validation | 400 | Field `details` |
| Unauthenticated | 401 | Re-login / refresh |
| Forbidden | 403 | Not a blank page |
| Missing | 404 | Safe message |
| Conflict / stale state | 409 | Retry with fresh data |
| Rate limit | 429 | Back off |
| AI / map tiles / storage down | 503 or feature fallback | P0 continues if AI |
| Unknown | 500 | Generic message, Pino log + request id |

No stack traces, Mongo errors, or secrets in JSON.

---

## 4. REST API

Base path: **`/api/v1`** ([ADR-005](../adr/ADR-005-rest-api.md)).

- Nouns, plural resources: `/projects`, `/work-requests`, `/conflicts`
- Filters and pagination via query string
- `Authorization: Bearer <access>` on protected routes
- Cookies used for **refresh** (and only that), not as the general API credential

### Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

`meta` may omit pagination on non-list responses. `requestId` should always be present.

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found",
    "details": null
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Idempotency: conflict resolution, payment approval, and similar POSTs should accept an optional `Idempotency-Key` header in implementation steps.

---

## 5. Validation

**Zod on Express** for params, query, body, headers where needed.

Must validate:

- ObjectIds
- enums / official statuses (reject unknown strings)
- dates (`start <= end`)
- money (non-negative, decimal rules later with LKR)
- GeoJSON type + coordinate ranges
- file MIME, size, extension consistency

Frontend Zod improves UX. It is **not** security.

Shared TypeScript types may be generated from Zod in a later monorepo step. Until then, duplicate carefully and keep server schemas canonical.

---

## 6. Database conventions (not full schemas)

Full field lists are later (Step 12+). Conventions now:

- `timestamps: true`
- explicit indexes for unique codes, foreign refs, and `2dsphere` on geometry
- references as ObjectId + documented collection name
- **soft delete** only where lists must hide without breaking history (prefer status flags: CANCELLED, DISABLED)
- **audit logs are append-only** (no update/delete API)
- list endpoints: skip/limit (default limit 20, max 100)

GeoJSON collections (conceptual): projects, workRequests, assets, citizenIssues (point), conflicts (derived geometries).

---

## 7. Realtime

Socket.IO is **P2** and optional.

Allowed events (when implemented): new conflict, coordination request, approval, major project alert.

Rules:

- REST remains source of truth
- notification **documents** in MongoDB are canonical ([BR-NOT-001](../planning/business-rules.md))
- CRUD pages must work with sockets off
- authenticate the socket with the same access token / short-lived socket ticket issued by Express

---

## 8. Testing

| Kind | Tool | Target |
|------|------|--------|
| Unit | Vitest | Zod schemas, conflict math, state machines |
| API | Vitest + Supertest | Authn/z, validation, 401/403/404 |
| E2E | Playwright | P0 spine when UI exists |
| RBAC / security | API tests | IDOR fixtures |

One runner (**Vitest**) for Node unit/API. Do not add Jest without superseding this decision.

Python AI service: **pytest** when the service exists.

No test theatre: do not require 100% coverage. Require tests for authz, status transitions, and spatial helpers.

---

## 9. Documentation tooling

- Architecture: Markdown + Mermaid (this `/docs` tree)
- API: OpenAPI 3 when routes exist; Swagger UI **disabled or protected** in production
- Env: `.env.example` keys only (Step 10)

---

## 10. Logging vs audit

| Stream | Tool | Content |
|--------|------|---------|
| Application logs | Pino | Operational events, errors, request id |
| Audit logs | MongoDB `auditLogs` | Who changed what (business) |
| Error SaaS | Sentry (prod, optional) | Unhandled exceptions |

Never mix passwords into either stream.

---

## 11. Consistency notes vs earlier artifacts

| Artifact | Resolution |
|----------|------------|
| GitHub starter README (Mapbox / Leaflet) | Superseded by MapLibre + OSM |
| Step 1 D-001 (vendors) | Closed in this step |
| Step 1 Q-006 (cookies) | Closed in [security-decisions.md](./security-decisions.md) |
| INC-001 colors | Nav/status locked Step 5; CSS variables locked Step 8; full component system later |
| Wrapper UI navy/orange vs flag colors | Not a technology ADR |

---

## 12. Related ADRs

ADR-001 through ADR-012 in `/docs/adr/`.
