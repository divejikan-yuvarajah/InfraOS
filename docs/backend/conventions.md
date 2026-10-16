# INFRAOS backend conventions

**Step:** 09  
**App:** `apps/api`

## App vs server

| File | Responsibility |
|------|----------------|
| `src/app.ts` | Create Express app, middleware, routes, 404, error handler |
| `src/server.ts` | Load config, listen, log startup, SIGINT/SIGTERM shutdown |
| `src/config/env.ts` | Zod env parse, staged secrets, INC-005 catalog |
| `src/config/database.ts` | One Mongoose connection per process, sanitized errors |

Tests import `createApp()` and do not listen on a port. They do not connect to Atlas.

## Request flow (current)

```text
requestId → pino-http → Helmet → CORS → JSON limit → rate limit
  → routes (/health, /ready, /api/v1)
  → JSON 404
  → error handler
```

AuthN, authz, MongoDB, and feature modules are **not** in this step.

## Modules

Only **health** exists. It is a route + controller (no repository). Feature modules follow `modules/<name>/` later and omit empty layers.

## Envelope

Success: `{ success: true, data, meta: { requestId } }`  
Error: `{ success: false, error: { code, message, details }, meta: { requestId } }`

Unknown routes: `404` / `ROUTE_NOT_FOUND` as JSON, never HTML.

## Errors

`AppError` has `statusCode`, `code`, `message`, `details`, `isOperational`.  
Zod failures become `400` / `VALIDATION_ERROR`.  
Unknown errors are logged with Pino and return `500` / `INTERNAL_ERROR` without stack traces.

## Logging

Pino. Request logs include method, path, status, duration, and requestId. Authorization, cookies, passwords, and bodies are not logged.

## Security baseline

- Helmet (`crossOriginResourcePolicy: cross-origin` so the Vercel/local web origin can call the API)
- `x-powered-by` disabled
- CORS exact `FRONTEND_ORIGIN`, `credentials: true`, never `*` with credentials
- Typed env only via `src/config/env.ts` — do not read `process.env` in modules
- Identity models in `modules/identity`; Agency model in `modules/agencies`
- JSON / urlencoded body limit **1mb** (uploads later)
- Baseline rate limit 300 / 15 minutes (health skipped; auth-specific limits later)

## Async errors

**Express 5** forwards rejected promises from async handlers. Do not add `express-async-errors`.

## Validation

`validate({ body, params, query })` wraps Zod. No Project/Auth schemas in this step.

## OpenAPI

Deferred until more routes exist. Style: OpenAPI 3 + Swagger UI in non-prod ([ADR-005](../adr/ADR-005-rest-api.md)).

## Rate limiting

Baseline only. Documented here so Step 9 does not skip the architecture pipeline. Login/refresh limits come with identity.
