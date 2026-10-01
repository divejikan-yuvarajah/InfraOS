# INFRAOS environment variables and secret management

**Step:** 10  
**Status:** Locked catalog  
**Closes:** [INC-005](../planning/assumptions-risks.md#inc-005--environment-variable-names)

This is the canonical env catalog. Do not introduce a second set of names.

---

## 1. File locations

| File | Role | Git |
|------|------|-----|
| `apps/web/.env.local` | Next.js public config | ignored |
| `apps/api/.env` | Express private config | ignored |
| `apps/ai-service/.env` | FastAPI private config (later) | ignored |
| `apps/web/.env.example` | Public names + local API origin | committed |
| `apps/api/.env.example` | Private names + non-secret defaults | committed |
| `apps/ai-service/.env.example` | AI names only | committed |
| `.env.example` | Index of canonical names (no secrets) | committed |

Do **not** copy the same secret into a root `.env`, `apps/api/.env`, and `apps/web/.env.local`. Frontend never needs backend secrets.

Local setup:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
Copy-Item apps\api\.env.example apps\api\.env
```

Then fill only the values you need. Health endpoints work with the non-secret defaults.

---

## 2. Public vs private

| Category | Prefix / location | Browser |
|----------|-------------------|---------|
| Public frontend | `NEXT_PUBLIC_*` only | Yes — bundled |
| Backend private | `apps/api/.env` | Never |
| AI private | `apps/ai-service/.env` | Never |

Only use `NEXT_PUBLIC_*` when the value is intentionally public.

Typed readers:

- Web: `apps/web/src/lib/env/public.ts` (`getPublicEnv`, `getPublicApiBaseUrl`)
- API: `apps/api/src/config/env.ts` (`parseEnv`, `env`)

Do not read `process.env` in controllers, services, or React feature modules.

---

## 3. Required now (Step 10)

These are enough to run the web and API foundations.

| Name | App | Default | Notes |
|------|-----|---------|-------|
| `NODE_ENV` | API | `development` | `development` \| `test` \| `production` |
| `PORT` | API | `4000` | Integer 1–65535 |
| `FRONTEND_ORIGIN` | API | `http://localhost:3000` in non-production | Exact CORS origin; required in production; no `*` |
| `LOG_LEVEL` | API | `info` | Pino: fatal, error, warn, info, debug, trace, silent |
| `API_PREFIX` | API | `/api/v1` | Versioned mount |
| `NEXT_PUBLIC_API_BASE_URL` | Web | none | Optional at build time; required at runtime when calling the API. Origin only (`http://localhost:4000`), not `/api/v1` |

The web **build** must not require Mongo, JWT, AI, or R2 secrets.

---

## 4. Required later (staged)

Empty values in `.env.example` are valid until the feature is implemented. When a secret **is** set, it is validated (URL shape, or ≥ 32 characters for signing/shared secrets). There are **no** insecure fallbacks such as `JWT_SECRET=secret`.

| When | Names |
|------|--------|
| Step 11 (MongoDB) — **required to connect** | `MONGODB_URI`, `MONGODB_DB_NAME` (`infraos_dev` / `infraos_test` / `infraos_prod`) |
| Authentication | `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_TTL` |
| AI service | `AI_BASE_URL`, `AI_INTERNAL_SECRET`, `OPENROUTER_API_KEY` |
| RAG | `QDRANT_URL`, `QDRANT_API_KEY` |
| Storage | `STORAGE_PROVIDER`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` |
| Maps (public) | `NEXT_PUBLIC_MAP_STYLE_URL` |

TTL strings (`15m`, `7d`) are documented defaults matching ADR-006. They are parsed when auth is implemented.

---

## 5. Canonical names (INC-005)

| Use | Canonical | Do not use |
|-----|-----------|------------|
| CORS / frontend origin | `FRONTEND_ORIGIN` | `CLIENT_URL` |
| Access JWT signing | `ACCESS_TOKEN_SECRET` | `JWT_SECRET` |
| Refresh signing/hash pepper | `REFRESH_TOKEN_SECRET` | `REFRESH_SECRET` |
| Express → FastAPI | `AI_INTERNAL_SECRET` | `AI_SERVICE_SECRET` |
| FastAPI base URL | `AI_BASE_URL` | `AI_SERVICE_URL` |
| Mongo connection | `MONGODB_URI` | `DATABASE_URL`, `MONGO_URI`, `MONGODB_URL` |

The API **rejects** the Step 7 prompt aliases if they are set, so a mixed catalog cannot silently ship.

---

## 6. Development / test / production databases

| Environment | `MONGODB_DB_NAME` |
|-------------|-------------------|
| Local development | `infraos_dev` |
| Automated tests | `infraos_test` |
| Production | `infraos_prod` |

Never point tests at production. `requireMongoConfig()` calls `assertSafeTestDatabaseName()` (name must **end with `_test`** when `NODE_ENV=test`) and blocks `_prod` names outside production. Atlas runbook: [mongodb-atlas.md](./mongodb-atlas.md).

---

## 7. Generating secrets later

When auth or AI is implemented, generate long random values. Do not invent memorable strings.

```powershell
node -e "console.log(crypto.randomBytes(48).toString('hex'))"
```

Minimum length enforced when a signing/shared secret is present: **32 characters**.

---

## 8. Logging and errors

- Validation errors name the **variable**, never the **value**.
- Pino redacts `SECRET_ENV_NAMES` plus Authorization / cookie / password / token fields.
- Allowed: `ACCESS_TOKEN_SECRET is missing` (when that feature requires it).
- Not allowed: `ACCESS_TOKEN_SECRET=...` or `MONGODB_URI=mongodb+srv://...`

---

## 9. Git ignore

Private files matching `.env`, `.env.local`, and `.env.*` are ignored. `.env.example` files stay tracked.

The Python ignore is `/env/` (repo-root virtualenv only). Do **not** ignore `apps/web/src/lib/env/` — that folder holds the public env reader.

If a real secret is ever committed:

1. Remove it from the index without rewriting history unless a maintainer explicitly authorizes that.
2. Rotate the credential.
3. Do not print the value in chat, issues, or logs.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Invalid environment configuration` on API start | Malformed `PORT`, `FRONTEND_ORIGIN`, `NODE_ENV`, or a rejected alias |
| `FRONTEND_ORIGIN is required in production` | Production start without an exact web origin |
| `use FRONTEND_ORIGIN instead` | Leftover `CLIENT_URL` from Step 7/9 examples |
| Web `API base URL is not configured` | Missing `NEXT_PUBLIC_API_BASE_URL` in `apps/web/.env.local` |
| CORS failure | `FRONTEND_ORIGIN` does not exactly match the browser origin |
| Web build asking for Mongo/JWT | A non-`NEXT_PUBLIC_` secret was imported into client code — do not do that |

---

## 11. Production hosts (later)

Vercel: public `NEXT_PUBLIC_*` only.  
Render (API): private secrets as service env vars.  
Render (AI): `AI_INTERNAL_SECRET` and provider keys.  
Atlas / R2 / Qdrant / OpenRouter: dashboard secrets, never Git.
