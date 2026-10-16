# INFRAOS backend setup

**Step:** 09  
**App:** `apps/api` (`@infraos/api`)

## Prerequisites

- Node.js 22 LTS
- npm 10+
- Repository root `npm install`

## Commands (from repository root)

```powershell
npm run dev:api
npm run lint:api
npm run type-check:api
npm run test:api
npm run build:api
npm run db:check
npm run db:seed:core
```

## Local URLs

| App | URL |
|-----|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Health (versioned) | http://localhost:4000/api/v1/health |
| Health (probe) | http://localhost:4000/health |
| Ready (versioned) | http://localhost:4000/api/v1/ready |
| Ready (probe) | http://localhost:4000/ready |

Run web and API in **two terminals**. A combined `dev` process is not required yet.

Set `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Copy `apps/api/.env.example` to `apps/api/.env`. Set `MONGODB_URI` and `MONGODB_DB_NAME=infraos_dev` using the [Atlas runbook](../setup/mongodb-atlas.md). Until those values exist, `npm run dev:api` still serves `/health`; `/ready` returns **503**.

## Environment

Canonical catalog: [../setup/environment.md](../setup/environment.md).

| Name | Default | Purpose |
|------|---------|---------|
| `NODE_ENV` | `development` | logging / proxy |
| `PORT` | `4000` | HTTP listen |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allowlist (credentials); required in production |
| `LOG_LEVEL` | `info` | Pino level |
| `API_PREFIX` | `/api/v1` | Versioned API mount |
| `MONGODB_URI` | none | Atlas connection string (private) |
| `MONGODB_DB_NAME` | `infraos_dev` in the example | Database name |

Auth, AI, and R2 secrets stay empty until those steps. Do not use `CLIENT_URL` or `JWT_SECRET`.
