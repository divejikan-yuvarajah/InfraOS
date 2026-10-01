# INFRAOS Module Boundaries and Quality Rules

**Document:** `/docs/architecture/module-boundaries.md`  
**Step:** 03  
**Status:** Locked

This is the contract between teammates. Public API namespaces, shared types, and “do not touch” lists live here. Folder ownership: [team-integration.md](./team-integration.md).

---

## 1. Shared vs owned

**Shared (team leader / platform):**

- API envelope, error class, Pino, Zod helpers, auth middleware, RBAC middleware
- `apiClient` and query-key conventions on the frontend
- Env names (Step 10)
- Audit helper `audit.write(...)`
- Notification helper `notifications.publish(...)`

**Owned:** see team table. Other members consume **HTTP + shared types**, not another module’s Mongoose models.

---

## 2. Public interfaces (conceptual)

| Module | API namespace | Events it may publish (in-process) |
|--------|---------------|-------------------------------------|
| Identity | `/auth` `/users` `/roles` | `user.disabled` |
| Agencies | `/agencies` | — |
| ProjectTrace | `/projects` `/milestones` | `project.statusChanged` |
| RoadSync | `/work-requests` `/conflicts` `/coordination` | `conflict.detected` `coordination.pending` |
| InfraMap | `/map` | — |
| Contractors | `/contractors` | — |
| Finance | `/payments` | `payment.approved` |
| Documents | `/documents` | `document.uploaded` |
| Inspections | `/inspections` | `inspection.submitted` |
| Assets | `/assets` | `asset.created` |
| Citizen | `/issues` + public | `issue.submitted` |
| Notifications | `/notifications` | — |
| Reports | `/reports` | — |
| Audit | `/audit` | — |
| AI (Express facade) | `/ai` | `risk.recorded` |

In-process “events” are **function calls** to notification/audit services, not Kafka.

---

## 3. What a module must not do

- Change another module’s official status fields
- Query MongoDB from Next.js
- Call OpenRouter/Qdrant/R2 from the browser
- Trust `req.body.role` or `req.body.agencyId` as authorization
- Hardcode secrets
- Add a second axios/fetch stack
- Dump unrelated helpers into a global `utils.ts`
- Import in a cycle (RoadSync repository ↔ ProjectTrace repository)
- Swallow errors without logging `requestId`
- Make P0 workflows require FastAPI

---

## 4. Architecture quality rules

1. No cross-module database writes without the owning service.
2. No business logic in route files.
3. No database access from the frontend.
4. No direct AI provider call from the frontend.
5. No role trust from client input.
6. No hardcoded secrets.
7. No duplicate API clients.
8. No giant shared utility dumping ground.
9. No circular module dependency.
10. No unnecessary global state.
11. No silent error swallowing.
12. No external service without fallback (AI, tiles, email).
13. No second authentication system.
14. No second validation library.
15. Lists are paginated; map data is viewport-bounded.

---

## 5. Shared TypeScript types

Later: a small `packages/shared-types` **or** duplicated Zod-inferred types until the monorepo exists.

Canonical: **server Zod schemas**. Frontend may import from a shared package when Step 7 creates it — not the reverse (frontend types must not drive Mongo).
