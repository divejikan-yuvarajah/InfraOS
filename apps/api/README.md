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
| DB check | `npm run db:check` |
| Lint | `npm run lint:api` |
| Type-check | `npm run type-check:api` |
| Test | `npm run test:api` |
| Build | `npm run build:api` |
| Start (after build) | `npm run start -w @infraos/api` |

Health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)  
Ready: [http://localhost:4000/api/v1/ready](http://localhost:4000/api/v1/ready) (503 until Atlas is connected)

Copy `apps/api/.env.example` to `apps/api/.env`. Atlas: [../../docs/setup/mongodb-atlas.md](../../docs/setup/mongodb-atlas.md).

Details: [../../docs/backend/setup.md](../../docs/backend/setup.md)
