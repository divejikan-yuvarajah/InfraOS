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

## Environment

Public only:

```text
NEXT_PUBLIC_API_BASE_URL
```

Never put `JWT_SECRET`, `REFRESH_SECRET`, `MONGODB_URI`, `AI_SERVICE_SECRET`, or storage keys in `NEXT_PUBLIC_*`. Full env validation is Step 10.

## Zustand

Not installed in this step. Later: sidebar, map UI filters, local preferences only. Server data stays in TanStack Query.
