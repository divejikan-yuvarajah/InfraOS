# Step 43 implementation and test matrix

**Branch:** `feature/auth-protected-access` (local, uncommitted)

## Source diff

| File | Role |
|---|---|
| `apps/web/src/lib/auth/route-access.ts` | Segment classifier and access decision |
| `apps/web/src/lib/auth/route-access.test.ts` | Classification and `next` attacks |
| `apps/web/src/lib/auth/redirect.ts` | Allowlist, safe query, fragment strip |
| `apps/web/src/lib/auth/state.ts` | Reactive snapshot and SSR snapshot |
| `apps/web/src/lib/auth/refresh-flight.ts` | 503 keeps a token; stale refresh cannot replace a newer sign-in |
| `apps/web/src/lib/auth/query-cache.ts` | Logout and expiry clear the query cache |
| `apps/web/src/lib/auth/auth.test.ts` | Snapshot, 503, expiry, epoch, stale refresh, cache |
| `apps/web/src/components/auth/route-access-guard.tsx` | Client guard, alert on retry |
| `apps/web/src/components/auth/workspace-home.tsx` | Dashboard shell and sign-out |
| `apps/web/src/app/dashboard/page.tsx` | Only new private page, `noindex` |
| `apps/web/src/styles/auth-access.css` | `[data-infra-app]` shell, reduced motion |
| `apps/web/src/lib/auth/messages.ts` | English access copy |
| `apps/web/src/components/auth/login-form.tsx` | Successful sign-in defaults to `/dashboard` |
| `apps/web/src/components/providers/app-providers.tsx` | Mounts the guard |
| `apps/web/src/components/providers/query-provider.tsx` | Registers the cache |

Not modified: `middleware.ts`, `app/page.tsx`, public landing styles, every API file.

## Commands

| Command | Exit | Count |
|---|---|---|
| `npm run test:web` | 0 | 26 files, 127 tests |
| `npm run test -w @infraos/web -- src/lib/auth/route-access.test.ts` | 0 | 6 tests, including `%00`, double-encoded `..`, backslash, and `#token=` |
| `npm run test:api` | 0 | 21 files, 256 tests |
| `npm run type-check` | 0 | web typegen and both `tsc` runs |
| `npm run lint` | 0 | 1 existing warning, `apps/web/src/components/data-table/data-table.tsx` |
| `npm run build` | 0 | web and API `tsc` |

## Browser

| Case | Result |
|---|---|
| Anonymous `/dashboard` with API down | **PASS** — retry alert, no workspace, no web storage |
| SSR `/dashboard` | **PASS** — checking copy only |
| Stubbed 401 | **PASS** — `/login?next=%2Fdashboard`. Not a live API call |
| `https://evil`, `//evil`, `/\`, `%2e%2e`, `%252e%252e`, `%00`, `#token=` | **PASS** — unit tests return null |
| `/`, `/si`, `/ta/forgot-password`, `/reset-password` | **PASS** — existing pages, not the access shell |
| 320, 390, 768, 1024, 1440 | **PASS** — no horizontal overflow |
| Keyboard focus and `role=alert` | **PASS** — heading received focus; retry copy is an alert |
| Reduced motion | **PASS** — `animation: none`, `transition: 0s` |
| Signed-in shell, live cookie reload, logout in the browser | **NOT RUN** |
| Live API | **BLOCKED** |
