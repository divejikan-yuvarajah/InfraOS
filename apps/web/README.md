# `@infraos/web`

Next.js (App Router) frontend for INFRAOS. This app is a **client of Express**. It must not call MongoDB, R2, Qdrant, or FastAPI directly.

## Run

From the repository root:

```powershell
npm install
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Command |
|--------|---------|
| Dev | `npm run dev:web` |
| Lint | `npm run lint:web` |
| Type-check | `npm run type-check:web` |
| Test | `npm run test -w @infraos/web` |
| Build | `npm run build:web` |

Copy `apps/web/.env.example` to `apps/web/.env.local`. Public vars only (`NEXT_PUBLIC_*`). Catalog: [../../docs/setup/environment.md](../../docs/setup/environment.md).

Details: [../../docs/frontend/setup.md](../../docs/frontend/setup.md)
