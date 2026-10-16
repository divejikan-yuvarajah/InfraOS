# INFRAOS frontend setup

**Step:** 08  
**App:** `apps/web` (`@infraos/web`)

## Prerequisites

- Node.js 22 LTS (`.nvmrc`)
- npm 10+
- Repository root `npm install`

## Commands (from repository root)

```powershell
npm run dev:web
npm run lint:web
npm run type-check:web
npm run build:web
npm run test -w @infraos/web
```

Dev server: `http://localhost:3000`

Point the API client at Express with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` in `apps/web/.env.local`. CORS allows `http://localhost:3000` by default.

## Environment

Public only:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_MAP_STYLE_URL
```

CORS uses API `FRONTEND_ORIGIN` (default `http://localhost:3000`).

Never put `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `MONGODB_URI`, `AI_INTERNAL_SECRET`, or storage keys in `NEXT_PUBLIC_*`. Catalog: [../setup/environment.md](../setup/environment.md).

## Zustand

Not installed in this step. Later: sidebar, map UI filters, local preferences only. Server data stays in TanStack Query.
