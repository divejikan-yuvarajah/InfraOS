# INFRAOS frontend conventions

**Step:** 08  
**App:** `apps/web`

## Folders

| Path | Responsibility |
|------|------------------|
| `src/app/` | App Router routes, layouts, loading, not-found |
| `src/components/ui/` | shadcn primitives (Button, Input, Card, Badge) |
| `src/components/providers/` | App-wide providers currently required |
| `src/components/layout/` | App shell later (not in Step 8) |
| `src/components/feedback/` | Empty/error/skeleton later |
| `src/features/` | Feature modules later — do not dump logic in pages |
| `src/lib/api/` | **One** HTTP client (`apiClient`) |
| `src/lib/env/` | Public env readers |
| `src/lib/utils.ts` | `cn()` for class names |
| `src/services/` | Thin feature wrappers over `apiClient` later |

## Server vs client components

- Default to Server Components for static/public shells.
- Add `"use client"` for providers, forms, maps, dashboards, and query hooks.
- Pages compose UI. They do not contain conflict math or Mongo shapes.

## API client

Import from `@/lib/api`. Use `NEXT_PUBLIC_API_BASE_URL`. Do not scatter `localhost` URLs. Do not implement refresh/login here. Credentials are included for future HTTP-only cookies.

## Style tokens

Flag-inspired foundation in `src/app/globals.css`:

```text
--infra-orange  #FF5B00
--infra-yellow  #FEB600
--infra-maroon  #8C1F28
--infra-green   #279541
```

Neutrals: background `#F8FAFC`, surface `#FFFFFF`, text `#111827` / `#475569` / `#64748B`, border `#E2E8F0`.

Do not add a second palette (wrapper navy/orange). Dark mode is P2 — do not auto-switch on `prefers-color-scheme`. Full design system expands in a later UI step.

## Components

Search `components/ui` before adding another button, input, card, or badge. Feature-specific UI stays in `features/` when those modules exist.

## Authorization

Frontend route chrome is UX only. Express enforces RBAC and resource checks.
