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
```

## Local URLs

| App | URL |
|-----|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Health (versioned) | http://localhost:4000/api/v1/health |
| Health (probe) | http://localhost:4000/health |

Run web and API in **two terminals**. A combined `dev` process is not required yet.

Set `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Copy `apps/api/.env.example` to `apps/api/.env` only if you need to override `PORT` or `CLIENT_URL`.

## Environment (Step 9)

| Name | Default | Purpose |
|------|---------|---------|
| `NODE_ENV` | `development` | logging / proxy |
| `PORT` | `4000` | HTTP listen |
| `CLIENT_URL` | `http://localhost:3000` | CORS allowlist (credentials) |
| `LOG_LEVEL` | `info` | Pino level |
| `API_PREFIX` | `/api/v1` | Versioned API mount |

Do not put JWT, Mongo, or AI secrets in this app yet. Full env validation is **Step 10**.
