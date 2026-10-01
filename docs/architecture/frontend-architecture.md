# INFRAOS Frontend Architecture

**Document:** `/docs/architecture/frontend-architecture.md`  
**Step:** 03  
**Status:** Locked  
**Stack:** ADR-002 (Next.js App Router)

The frontend is a **client of Express**. It is not a second backend.

---

## 1. Suggested folder layout

```text
apps/web/src/   (monorepo path locked in Step 7; Next.js itself is Step 8)
├── app/                    # App Router: pages, layouts, loading, error
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── layout/             # shell, sidebar, topbar
│   ├── common/
│   └── feedback/           # empty, error, skeleton, toast
├── features/
│   ├── auth/
│   ├── projects/           # ProjectTrace
│   ├── roadsync/
│   ├── map/
│   ├── contractors/
│   ├── finance/
│   ├── documents/
│   ├── inspections/
│   ├── assets/
│   ├── citizen/
│   ├── notifications/
│   └── reports/
├── hooks/
├── lib/                    # api client, query keys, env public
├── services/               # thin fetch wrappers — ONE API client
├── types/
└── styles/
```

Rules:

- Pages compose features; they do not contain conflict math or Mongo shapes.
- One `apiClient` (fetch + credentials + Bearer from memory).
- Server Components for marketing/public shells where possible.
- Client Components for map, forms, dashboards, sockets.

---

## 2. Page map

**Canonical IA:** [../ux/README.md](../ux/README.md) (Step 5). Sketch below matches that lock.

### Public

```text
/
/about
/features
/how-it-works
/public-projects
/public-projects/[id]
/public-map
/report-issue
/faq
/contact
```

### Auth

```text
/login
/verify-email
/forgot-password
/reset-password
```

Staff **self-register is not V1**. No `/register`.

### Protected application

```text
/dashboard
/projects
/projects/new
/projects/[id]                    → redirect to overview
/projects/[id]/overview
/projects/[id]/timeline
/projects/[id]/milestones
/projects/[id]/documents
/projects/[id]/finance
/projects/[id]/inspections
/projects/[id]/risks
/roadsync
/roadsync/work-requests
/roadsync/work-requests/new
/roadsync/work-requests/[id]
/roadsync/conflicts
/roadsync/conflicts/[id]
/roadsync/coordination
/map
/contractors
/contractors/[id]
/assets
/assets/[id]
/documents
/inspections
/inspections/[id]
/issues
/issues/[id]
/reports
/notifications
/profile
/settings
```

### Admin

```text
/admin
/admin/users
/admin/agencies
/admin/roles
/admin/audit-logs
/admin/system
```

### Errors

```text
/403
/404
/500
/maintenance
```

Role navigation: [../ux/navigation-by-role.md](../ux/navigation-by-role.md). Permissions: [../security/route-access-policy.md](../security/route-access-policy.md).

---

## 3. Request / UI flow

```mermaid
flowchart TD
  A[User action] --> B[RHF / client Zod]
  B --> C[apiClient]
  C --> D[Express]
  D --> E[TanStack Query cache]
  E --> F{Outcome}
  F -->|loading| L[Skeleton / spinner]
  F -->|empty| N[Empty copy + CTA]
  F -->|401| R[Try refresh once then /login]
  F -->|403| X[/403]
  F -->|4xx validation| V[Field errors]
  F -->|5xx| E2[Error + retry]
  F -->|success| S[Toast if useful + updated UI]
```

Retry: safe GET/list retries via TanStack Query. Do not auto-retry payments or conflict resolve.

---

## 4. State

| Kind | Tool |
|------|------|
| Server data | TanStack Query |
| Access token | memory (auth feature store) |
| Sidebar, map UI filters | Zustand |
| Forms | RHF |

Do not put project lists in Zustand.

---

## 5. Map UI

InfraMap feature owns MapLibre. Viewport changes debounce → `GET /api/v1/map` with bbox + filters. Detail **sheet** (not hover-only) for mobile.

GSAP: landing hero/stats only; honor `prefers-reduced-motion`.

---

## 6. Loading / empty / error / success

Every important feature screen must implement all four. Shared components in `components/feedback/`. Never a blank main pane.
