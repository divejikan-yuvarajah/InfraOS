# `@infraos/api`

Express + TypeScript modular-monolith API for INFRAOS. This process is the **system of record**. Next.js is a client.

## Run

From the repository root:

```powershell
npm install
npm run dev:api
```

| Script | Command |
|--------|---------|
| Dev | `npm run dev:api` |
| Lint | `npm run lint:api` |
| Type-check | `npm run type-check:api` |
| Test | `npm run test:api` |
| Build | `npm run build:api` |
| Start (after build) | `npm run start -w @infraos/api` |

Health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)  
Probe: [http://localhost:4000/health](http://localhost:4000/health)

Copy `apps/api/.env.example` to `apps/api/.env` to override local non-secret defaults. Canonical names: [../../docs/setup/environment.md](../../docs/setup/environment.md).

Details: [../../docs/backend/setup.md](../../docs/backend/setup.md)
